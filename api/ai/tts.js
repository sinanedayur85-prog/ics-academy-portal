function getApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    ''
  ).trim()
}

function wrapPcm24kToWavBuffer(pcmBuffer) {
  const sampleRate = 24000
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8
  const blockAlign = (numChannels * bitsPerSample) / 8
  const dataSize = pcmBuffer.length
  const header = Buffer.alloc(44)

  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16) // Subchunk1Size (PCM)
  header.writeUInt16LE(1, 20) // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)

  return Buffer.concat([header, pcmBuffer])
}

async function synthesizeWithGeminiRest(apiKey, modelName, voiceName, text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelName,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`

  const body =
    modelName === 'gemini-3.8-flash-lite-tts'
      ? {
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text,
                  speechMetadata: {
                    style:
                      'Warm, clear, confident male Malayalam narrator explaining app features naturally step by step',
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        }
      : {
          contents: [
            {
              role: 'user',
              parts: [{ text }],
            },
          ],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName === 'Orbit' ? 'Orus' : voiceName,
                },
              },
            },
          },
        }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'aistudio-build',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`Gemini TTS ${modelName} HTTP ${res.status}`)
  }

  const data = await res.json()
  const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData
  if (!inlineData?.data) {
    throw new Error(`Gemini TTS ${modelName} returned empty audio`)
  }

  const rawMime = String(inlineData.mimeType || 'audio/wav')
  const rawBuf = Buffer.from(inlineData.data, 'base64')

  if (
    rawMime.toLowerCase().includes('l16') ||
    rawMime.toLowerCase().includes('pcm') ||
    rawBuf.subarray(0, 4).toString('ascii') !== 'RIFF'
  ) {
    const wavBuf = wrapPcm24kToWavBuffer(rawBuf)
    return {
      audioBase64: wavBuf.toString('base64'),
      mimeType: 'audio/wav',
      voiceUsed: voiceName,
    }
  }

  return {
    audioBase64: inlineData.data,
    mimeType: 'audio/wav',
    voiceUsed: voiceName,
  }
}

const memoryCache = new Map()

export default async function handler(req, res) {
  const origin = req.headers?.origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Accept, X-Requested-With',
  )
  res.setHeader('Permissions-Policy', 'microphone=*, camera=*, autoplay=*')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  try {
    const { text = '', language = 'ml', voiceName = 'Orbit' } = req.body ?? {}
    const cleanText = typeof text === 'string' ? text.trim().slice(0, 1800) : ''
    if (!cleanText) {
      res.status(400).json({ error: 'Text is required for speech synthesis.' })
      return
    }

    const selectedVoice =
      typeof voiceName === 'string' && voiceName.trim() ? voiceName.trim() : 'Orbit'
    const cacheKey = `orbit-v4:${selectedVoice}:${language}:${cleanText}`
    if (memoryCache.has(cacheKey)) {
      res.status(200).json(memoryCache.get(cacheKey))
      return
    }

    const apiKey = getApiKey()
    if (apiKey) {
      const candidates = [
        { model: 'gemini-3.8-flash-lite-tts', voice: selectedVoice },
        { model: 'gemini-2.5-flash-preview-tts', voice: 'Orus' },
        { model: 'gemini-2.5-flash-preview-tts', voice: 'Charon' },
      ]

      for (const candidate of candidates) {
        try {
          const payload = await synthesizeWithGeminiRest(
            apiKey,
            candidate.model,
            candidate.voice,
            cleanText,
          )
          if (memoryCache.size > 60) {
            const firstKey = memoryCache.keys().next().value
            if (firstKey) memoryCache.delete(firstKey)
          }
          memoryCache.set(cacheKey, payload)
          res.status(200).json(payload)
          return
        } catch {
          continue
        }
      }
    }

    // Fallback: native Malayalam speech synthesis
    const rawSentences = cleanText
      .split(/(?<=[.!?।])\s+|\n+/)
      .map((s) => s.trim())
      .filter(Boolean)

    const chunks = []
    for (const sentence of rawSentences) {
      if (sentence.length <= 180) {
        chunks.push(sentence)
      } else {
        const words = sentence.split(/\s+/)
        let current = ''
        for (const w of words) {
          if ((current + ' ' + w).trim().length > 180) {
            if (current) chunks.push(current.trim())
            current = w
          } else {
            current = (current + ' ' + w).trim()
          }
        }
        if (current) chunks.push(current.trim())
      }
    }

    const tl = language === 'ml' ? 'ml' : language === 'ar' ? 'ar' : 'en'
    const buffers = await Promise.all(
      chunks.map(async (chunk) => {
        const ttsUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=${tl}&client=gtx&q=${encodeURIComponent(chunk)}`
        const ttsRes = await fetch(ttsUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
        })
        if (!ttsRes.ok) {
          throw new Error(`TTS upstream status ${ttsRes.status}`)
        }
        const arrBuf = await ttsRes.arrayBuffer()
        return Buffer.from(arrBuf)
      }),
    )

    if (buffers.length > 0) {
      const combined = Buffer.concat(buffers)
      const payload = {
        audioBase64: combined.toString('base64'),
        mimeType: 'audio/mpeg',
        voiceUsed: 'fallback-raw',
      }
      memoryCache.set(cacheKey, payload)
      res.status(200).json(payload)
      return
    }

    res.status(500).json({ error: 'Unable to synthesize speech audio.' })
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'TTS failed',
    })
  }
}
