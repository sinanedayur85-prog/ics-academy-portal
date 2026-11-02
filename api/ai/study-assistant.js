import { GoogleGenAI, ThinkingLevel } from '@google/genai'

const CLOUD_RUN_BACKENDS = [
  'https://ais-pre-rhfqjrwneaewkmnanoof2j-896319436298.asia-east1.run.app',
]

function getApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    ''
  ).trim()
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
    for (const backend of CLOUD_RUN_BACKENDS) {
      try {
        const proxyRes = await fetch(`${backend}/api/ai/study-assistant`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req.body ?? {}),
        })
        const ct = proxyRes.headers.get('content-type') || ''
        if (proxyRes.ok && ct.includes('application/json')) {
          const data = await proxyRes.json()
          res.status(200).json(data)
          return
        }
      } catch {
        // Continue
      }
    }

    res.status(503).json({
      error:
        'GEMINI_API_KEY ക്രമീകരിച്ചിട്ടില്ല. ദയവായി Vercel Settings → Environment Variables-ൽ GEMINI_API_KEY ചേർക്കുക.',
    })
    return
  }

  try {
    const { prompt = '', mode = 'kitab', language = 'ml', studentName } = req.body ?? {}
    const cleanPrompt = String(prompt).trim().slice(0, 3000)
    if (!cleanPrompt) {
      res.status(400).json({ error: 'Prompt is required.' })
      return
    }

    const validLanguage = ['ml', 'en', 'ar', 'ur', 'es', 'de'].includes(language)
      ? language
      : /[\u0D00-\u0D7F]/.test(cleanPrompt)
        ? 'ml'
        : 'en'

    const langLabel =
      validLanguage === 'ml'
        ? 'Malayalam (മലയാളം script)'
        : validLanguage === 'ar'
          ? 'Arabic (العربية الفصحى)'
          : validLanguage === 'ur'
            ? 'Urdu (اردو script)'
            : validLanguage === 'es'
              ? 'Spanish (Español)'
              : validLanguage === 'de'
                ? 'German (Deutsch)'
                : 'English'

    const systemInstruction = `You are the official AI Study & Kitab Research Assistant for ICS Academy (Da'wa College).
Student: ${studentName || "Da'wa College Scholar"}
Mode: ${mode}
Primary Output Language: ${langLabel}
Provide an accurate, scholarly, well-structured explanation in ${langLabel}.`

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    })

    const models = [
      'gemini-3.8-flash',
      'gemini-3-flash-preview',
      'gemini-3.1-flash-lite',
      'gemini-3.1-flash-lite-preview',
      'gemini-2.5-flash',
    ]

    for (const modelName of models) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: cleanPrompt,
          config: {
            systemInstruction,
            ...(modelName === 'gemini-3.8-flash'
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          },
        })
        if (response.text && response.text.trim()) {
          res.status(200).json({
            response: response.text.trim(),
            mode,
            language: validLanguage,
          })
          return
        }
      } catch {
        continue
      }
    }

    res.status(503).json({ error: 'AI models are currently busy.' })
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Study assistant failed',
    })
  }
}
