function getApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    ''
  ).trim()
}

function detectLanguage(text, fallbackLanguage) {
  if (!text) return fallbackLanguage
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml'
  if (/[\u0679\u067E\u0686\u0688\u0691\u0698\u06AF\u06BA\u06BE\u06C1\u06C2\u06C3\u06D2\u06D4]/.test(text)) {
    return 'ur'
  }
  const arabicChars = (
    text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []
  ).length
  const latinChars = (text.match(/[A-Za-z]/g) || []).length
  if (arabicChars > 0 && arabicChars > latinChars) return 'ar'
  return fallbackLanguage
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

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const apiKey = getApiKey()

  if (!apiKey) {
    res.status(503).json({
      error: 'GEMINI_API_KEY is not configured in Vercel Environment Variables.',
    })
    return
  }

  try {
    const {
      prompt = '',
      mode = 'kitab',
      language = 'en',
      languageMode = 'auto',
      studentName,
    } = req.body ?? {}

    const cleanPrompt = String(prompt || '').trim().slice(0, 3000)
    if (!cleanPrompt) {
      res.status(400).json({ error: 'Prompt is required.' })
      return
    }

    const requestedLang = ['ml', 'en', 'ar', 'ur', 'es', 'de'].includes(language) ? language : 'en'
    const validLanguage =
      languageMode === 'explicit' ? requestedLang : detectLanguage(cleanPrompt, requestedLang)

    const langRule =
      validLanguage === 'ml'
        ? 'Respond in natural, scholarly Malayalam (മലയാളം) script, keeping Arabic Kitab citations in vocalized Arabic script.'
        : validLanguage === 'ar'
          ? 'Respond in Classical/Modern Standard Arabic (العربية الفصحى).'
          : validLanguage === 'ur'
            ? 'Respond in scholarly Urdu (اردو).'
            : 'Respond in clear academic English with Arabic technical terms in vocalized Arabic script.'

    const systemInstruction = `You are the official AI Academic & Kitab Scholar for ICS Academy (Islamic Centre Sunniyya, Manhappatta — Da'wa College).
Student: ${studentName || "Da'wa College Scholar"}
Mode: ${mode}
${langRule}`

    const models = [
      'gemini-2.5-flash',
      'gemini-3-flash-preview',
      'gemini-3.1-flash-lite-preview',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
    ]

    for (const modelName of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          modelName,
        )}:generateContent?key=${encodeURIComponent(apiKey)}`

        const apiRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: cleanPrompt }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
          }),
        })

        if (!apiRes.ok) continue
        const data = await apiRes.json()
        const parts = data?.candidates?.[0]?.content?.parts
        const replyText = Array.isArray(parts)
          ? parts
              .map((p) => (typeof p?.text === 'string' ? p.text : ''))
              .join('')
              .trim()
          : ''

        if (replyText) {
          res.status(200).json({
            response: replyText,
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
