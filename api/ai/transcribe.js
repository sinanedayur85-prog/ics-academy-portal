function getApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    ''
  ).trim()
}

async function callGeminiTranscribe(apiKey, modelName, cleanMime, cleanBase64, promptText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelName,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: cleanMime, data: cleanBase64 } },
            { text: promptText },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`Gemini API ${res.status}`)
  }

  const data = await res.json()
  const parts = data?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('')
    .trim()
}

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

  const apiKey = getApiKey()

  if (!apiKey) {
    res.status(503).json({ error: 'GEMINI_API_KEY is not configured for voice transcription.' })
    return
  }

  try {
    const { audioBase64, mimeType = 'audio/webm', language = 'auto' } = req.body ?? {}
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      res.status(400).json({ error: 'Missing audio data.' })
      return
    }

    const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '').trim()
    const cleanMime = String(mimeType || 'audio/webm').split(';')[0].trim() || 'audio/webm'

    const langHint =
      language === 'ml'
        ? 'Malayalam (മലയാളം script)'
        : language === 'ar'
          ? 'Arabic (العربية script)'
          : language === 'ur'
            ? 'Urdu (اردو script)'
            : language === 'en'
              ? 'English'
              : 'the exact spoken language (Malayalam, English, Arabic, or Urdu)'

    const promptText = `Listen carefully to this audio clip from an ICS Academy student.
1. If the audio is silent, contains only background noise/clicks, or has no clear human speech, output ONLY the exact token: __SILENT__
2. Do NOT invent or guess words if no one is speaking.
3. If there is clear human speech, transcribe the spoken words accurately into ${langHint} and output ONLY the transcribed text itself.`

    const models = [
      'gemini-2.5-flash',
      'gemini-3-flash-preview',
      'gemini-3.1-flash-lite-preview',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
    ]

    let transcript = ''
    for (const modelName of models) {
      try {
        const raw = await callGeminiTranscribe(
          apiKey,
          modelName,
          cleanMime,
          cleanBase64,
          promptText,
        )
        if (typeof raw === 'string') {
          transcript = raw.includes('__SILENT__') ? '' : raw
          break
        }
      } catch {
        continue
      }
    }

    res.status(200).json({ text: transcript })
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Transcription failed',
    })
  }
}
