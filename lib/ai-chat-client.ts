'use client'

export type ChatRole = 'usthad' | 'academic' | 'language' | 'campus'
export type ChatLanguage = 'ml' | 'en' | 'ar' | 'ur' | 'es' | 'de'
export type ChatModelTier = 'flash' | 'flash-lite'
export type StudyMode = 'kitab' | 'qa' | 'translation' | 'dawa'

export interface ClientChatTurn {
  role: 'user' | 'model'
  text: string
}

export interface ClientChatAttachment {
  mimeType: string
  data: string
  name?: string
}

export interface AiChatRequestPayload {
  message: string
  history: ClientChatTurn[]
  role: ChatRole
  language: ChatLanguage
  languageMode: 'auto' | 'explicit'
  modelTier: ChatModelTier
  studentName?: string
  studentClass?: string
  attachments?: ClientChatAttachment[]
}

// Always target the live Vercel production server directly for native APK/Capacitor bundles
// (avoids 45-90s timeouts against sleeping preview containers).
const REMOTE_BACKEND_ORIGINS = ['https://ics-academy-manhappatta.vercel.app']

function isLocalCapacitorBundleOrigin(): boolean {
  if (typeof window === 'undefined') return false
  const { protocol, hostname, port } = window.location
  if (protocol === 'capacitor:' || protocol === 'file:') return true
  if (hostname === 'localhost' && (!port || port === '80' || port === '443')) {
    return true
  }
  return false
}

function getCandidateApiUrls(apiPath: string): string[] {
  if (typeof window === 'undefined') return [apiPath]
  const urls: string[] = []
  if (!isLocalCapacitorBundleOrigin()) {
    urls.push(apiPath)
  }
  const currentOrigin = window.location.origin
  for (const origin of REMOTE_BACKEND_ORIGINS) {
    if (origin !== currentOrigin) {
      urls.push(`${origin}${apiPath}`)
    }
  }
  return urls
}

function isLongFormPrompt(text: string): boolean {
  if (!text) return false
  return /(\d{1,2}\s*(?:pages?|pgs?|പേജ്|പേജുകൾ|പേജുള്ള|صفحة|صفحات|صفحے|páginas?|seiten?)|ഒരുപാട്\s*പേജ്|ധാരാളം\s*പേജ്|കൂടുതൽ\s*പേജ്|വിശാലമായി|വിശാലമായ|വിശദമായി|വിശദമായ|ദീർഘമായി|സമ്പൂർണ്ണ|പ്രബന്ധം|ഉപന്യാസം|many\s+pages|multiple\s+pages|long\s+(?:essay|note|notes|article|paper)|in\s+full\s+detail|in\s+depth|comprehensive|exhaustive|extensive|صفحات\s*كثيرة|عدة\s*صفحات|مفصل|موسع|شامل|مطول|کئی\s*صفحات|تفصیل\s*سے)/i.test(
    text,
  )
}

export async function streamAiChatReply(
  payload: AiChatRequestPayload,
  options?: {
    onDelta?: (delta: string, accumulated: string) => void
    onModelResolved?: (modelUsed: string) => void
    signal?: AbortSignal
  },
): Promise<{ reply: string; modelUsed: string }> {
  const urls = getCandidateApiUrls('/api/ai/chat')
  const hasAttachments = Array.isArray(payload.attachments) && payload.attachments.length > 0
  const isLongForm = isLongFormPrompt(payload.message)
  const firstByteTimeoutMs = isLongForm || hasAttachments ? 42000 : 25000
  const chunkIdleTimeoutMs = isLongForm ? 35000 : 28000
  const fallbackModelLabel =
    payload.modelTier === 'flash-lite' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen'

  let lastErrorMsg = ''

  for (const url of urls) {
    if (options?.signal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError')
    }

    const controller = new AbortController()
    const onExternalAbort = () => controller.abort()
    options?.signal?.addEventListener('abort', onExternalAbort, { once: true })

    let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(
      () => controller.abort(),
      firstByteTimeoutMs,
    )

    const resetIdleTimer = () => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => controller.abort(), chunkIdleTimeoutMs)
    }

    const clearTimer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream, application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({ ...payload, stream: true }),
      })

      const contentType = (res.headers.get('content-type') || '').toLowerCase()

      if (res.ok && contentType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let accumulated = ''
        let modelUsed = fallbackModelLabel
        let streamError = ''

        resetIdleTimer()

        try {
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            resetIdleTimer()

            buffer += decoder.decode(value, { stream: true })

            let sepIdx = buffer.indexOf('\n\n')
            while (sepIdx !== -1) {
              const rawEvent = buffer.slice(0, sepIdx)
              buffer = buffer.slice(sepIdx + 2)

              const lines = rawEvent.split('\n')
              for (const line of lines) {
                const trimmed = line.trim()
                if (!trimmed.startsWith('data:')) continue
                const jsonStr = trimmed.slice(5).trim()
                if (!jsonStr || jsonStr === '[DONE]') continue

                try {
                  const evt = JSON.parse(jsonStr) as {
                    type?: string
                    text?: string
                    modelUsed?: string
                    reply?: string
                    error?: string
                  }

                  if (evt.modelUsed) {
                    modelUsed = evt.modelUsed
                    options?.onModelResolved?.(modelUsed)
                  }

                  if (evt.type === 'delta' && typeof evt.text === 'string' && evt.text.length > 0) {
                    accumulated += evt.text
                    options?.onDelta?.(evt.text, accumulated)
                  } else if (evt.type === 'done') {
                    if (!accumulated && typeof evt.reply === 'string' && evt.reply.trim()) {
                      accumulated = evt.reply.trim()
                      options?.onDelta?.(accumulated, accumulated)
                    }
                  } else if (evt.type === 'error' && evt.error) {
                    streamError = evt.error
                  }
                } catch {
                  // Ignore malformed partial SSE line
                }
              }

              sepIdx = buffer.indexOf('\n\n')
            }
          }
        } finally {
          clearTimer()
          try {
            reader.releaseLock()
          } catch {
            // Ignore lock release errors
          }
        }

        if (accumulated.trim()) {
          return {
            reply: accumulated.trim(),
            modelUsed,
          }
        }
        if (streamError) {
          lastErrorMsg = streamError
        }
        continue
      }

      clearTimer()

      if (contentType.includes('application/json')) {
        const data = (await res.json()) as {
          reply?: string
          modelUsed?: string
          error?: string
        }
        if (res.ok && data && typeof data.reply === 'string' && data.reply.trim()) {
          const reply = data.reply.trim()
          const modelUsed = data.modelUsed || fallbackModelLabel
          options?.onModelResolved?.(modelUsed)
          options?.onDelta?.(reply, reply)
          return { reply, modelUsed }
        }
        if (data?.error) {
          lastErrorMsg = data.error
        }
      }
    } catch (err) {
      clearTimer()
      if (options?.signal?.aborted) {
        throw err
      }
      if (err instanceof Error && err.message) {
        lastErrorMsg = err.name === 'AbortError' ? 'AI response timed out. Please try again.' : err.message
      }
    } finally {
      options?.signal?.removeEventListener('abort', onExternalAbort)
    }
  }

  throw new Error(
    lastErrorMsg ||
      'Unable to reach the AI server. Please check your internet connection and try again.',
  )
}

export async function fetchAiChatReply(
  payload: AiChatRequestPayload,
): Promise<{ reply: string; modelUsed: string }> {
  return streamAiChatReply(payload)
}

export async function fetchAiStudyAssistantReply(payload: {
  prompt: string
  mode: StudyMode
  language: ChatLanguage
  languageMode: 'auto' | 'explicit'
  studentName?: string
}): Promise<{ response: string }> {
  const urls = getCandidateApiUrls('/api/ai/study-assistant')
  const requestTimeoutMs = isLongFormPrompt(payload.prompt) ? 90000 : 35000
  let lastErrorMsg = ''

  for (const url of urls) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(payload),
      })
      clearTimeout(timeoutId)

      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const data = (await res.json()) as { response?: string; error?: string }
        if (res.ok && data && typeof data.response === 'string' && data.response.trim()) {
          return { response: data.response.trim() }
        }
        if (data?.error) {
          lastErrorMsg = data.error
        }
      }
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof Error && err.message) {
        lastErrorMsg = err.message
      }
    }
  }

  throw new Error(
    lastErrorMsg ||
      'Unable to reach the AI server. Please try again shortly.',
  )
}

export async function transcribeVoiceAudio(payload: {
  audioBase64: string
  mimeType: string
  language: string
}): Promise<string> {
  const urls = getCandidateApiUrls('/api/ai/transcribe')

  for (const url of urls) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 14000)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(payload),
      })
      clearTimeout(timeoutId)

      const contentType = res.headers.get('content-type') || ''
      if (res.ok && contentType.includes('application/json')) {
        const data = (await res.json()) as { text?: string }
        if (data && typeof data.text === 'string' && data.text.trim()) {
          return data.text.trim()
        }
      }
    } catch {
      clearTimeout(timeoutId)
    }
  }

  return ''
}

export async function normalizeSpokenVoiceText(payload: {
  rawTranscript: string
  language: string
}): Promise<string> {
  const clean = payload.rawTranscript.trim()
  if (!clean) return ''

  const urls = getCandidateApiUrls('/api/ai/transcribe')

  for (const url of urls) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 7000)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          rawTranscript: clean,
          language: payload.language,
        }),
      })
      clearTimeout(timeoutId)

      const contentType = res.headers.get('content-type') || ''
      if (res.ok && contentType.includes('application/json')) {
        const data = (await res.json()) as { text?: string }
        if (data && typeof data.text === 'string' && data.text.trim()) {
          return data.text.trim()
        }
      }
    } catch {
      clearTimeout(timeoutId)
    }
  }

  return clean
}

const clientTtsAudioCache = new Map<
  string,
  { audioBase64: string; mimeType: string; voiceUsed?: string }
>()

export async function fetchTtsSpeechAudio(payload: {
  text: string
  language?: 'ml' | 'en' | 'ar'
  voiceGender?: 'male' | 'female'
  voiceName?: string
}): Promise<{ audioBase64: string; mimeType: string; voiceUsed?: string } | null> {
  const clean = payload.text.trim()
  if (!clean) return null

  const voiceName = payload.voiceName ?? 'Orbit'
  const lang = payload.language ?? 'ml'
  const cacheKey = `orbit-v4:${voiceName}:${lang}:${clean}`
  const cached = clientTtsAudioCache.get(cacheKey)
  if (cached) return cached

  const urls = getCandidateApiUrls('/api/ai/tts')

  for (const url of urls) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          text: clean,
          language: lang,
          voiceName,
        }),
      })
      clearTimeout(timeoutId)

      const contentType = res.headers.get('content-type') || ''
      if (res.ok && contentType.includes('application/json')) {
        const data = (await res.json()) as {
          audioBase64?: string
          mimeType?: string
          voiceUsed?: string
        }
        if (data?.audioBase64) {
          const result = {
            audioBase64: data.audioBase64,
            mimeType: data.mimeType || 'audio/mpeg',
            voiceUsed: data.voiceUsed || voiceName,
          }
          clientTtsAudioCache.set(cacheKey, result)
          return result
        }
      }
    } catch {
      clearTimeout(timeoutId)
    }
  }

  return null
}
