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

const REMOTE_BACKEND_ORIGINS = [
  'https://ais-dev-rhfqjrwneaewkmnanoof2j-896319436298.asia-east1.run.app',
  'https://ais-pre-rhfqjrwneaewkmnanoof2j-896319436298.asia-east1.run.app',
  'https://ics-academy-manhappatta.vercel.app',
]

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

export async function fetchAiChatReply(payload: {
  message: string
  history: ClientChatTurn[]
  role: ChatRole
  language: ChatLanguage
  languageMode: 'auto' | 'explicit'
  modelTier: ChatModelTier
  studentName?: string
  studentClass?: string
  attachments?: ClientChatAttachment[]
}): Promise<{ reply: string; modelUsed: string }> {
  const urls = getCandidateApiUrls('/api/ai/chat')
  const hasAttachments = Array.isArray(payload.attachments) && payload.attachments.length > 0
  let lastErrorMsg = ''

  for (const url of urls) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), hasAttachments ? 40000 : 30000)

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
        const data = (await res.json()) as {
          reply?: string
          modelUsed?: string
          error?: string
        }
        if (res.ok && data && typeof data.reply === 'string' && data.reply.trim()) {
          return {
            reply: data.reply.trim(),
            modelUsed:
              data.modelUsed ||
              (payload.modelTier === 'flash-lite'
                ? 'gemini-3.1-flash-lite'
                : 'gemini-3.8-flash'),
          }
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
      'AI സെർവറുമായി ബന്ധപ്പെടാൻ സാധിച്ചില്ല. ദയവായി ഇന്റർനെറ്റ് കണക്ഷൻ അല്ലെങ്കിൽ സെർവർ ക്രമീകരണം പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.',
  )
}

export async function fetchAiStudyAssistantReply(payload: {
  prompt: string
  mode: StudyMode
  language: ChatLanguage
  languageMode: 'auto' | 'explicit'
  studentName?: string
}): Promise<{ response: string }> {
  const urls = getCandidateApiUrls('/api/ai/study-assistant')
  let lastErrorMsg = ''

  for (const url of urls) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

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
      'AI സെർവറുമായി ബന്ധപ്പെടാൻ സാധിച്ചില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.',
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

