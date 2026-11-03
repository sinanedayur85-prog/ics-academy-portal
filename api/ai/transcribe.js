function getApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    ''
  ).trim()
}

async function callGeminiParts(apiKey, modelName, parts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelName,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'aistudio-build',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`Gemini API ${res.status}`)
  }

  const data = await res.json()
  const outParts = data?.candidates?.[0]?.content?.parts
  if (!Array.isArray(outParts)) return ''
  return outParts
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
    const {
      audioBase64,
      rawTranscript,
      mimeType = 'audio/webm',
      language = 'auto',
    } = req.body ?? {}

    const langHint =
      language === 'ml'
        ? 'Malayalam (മലയാളം script — do NOT write in English or Manglish)'
        : language === 'ar'
          ? 'Arabic (العربية script)'
          : language === 'ur'
            ? 'Urdu (اردو script)'
            : language === 'es'
              ? 'Spanish (Español)'
              : language === 'de'
                ? 'German (Deutsch)'
                : language === 'en'
                  ? 'English'
                  : 'the EXACT language spoken by the student in its native script: if spoken in Malayalam, write in Malayalam script (മലയാളം); if spoken in Arabic, write in Arabic script (العربية); if spoken in Urdu, write in Urdu script (اردو); if spoken in English, write in English; if spoken in Spanish, write in Español; if spoken in German, write in Deutsch'

    const models = [
      'gemini-3.1-flash-lite',
      'gemini-3.1-flash-lite-preview',
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-3.5-transcribe',
      'gemini-3.8-flash',
      'gemini-3-flash-preview',
    ]

    if (typeof rawTranscript === 'string' && rawTranscript.trim().length > 0) {
      const cleanSpoken = rawTranscript.trim().slice(0, 1500)
      const scriptPrompt = `You are a real-time speech-to-text script normalizer for ICS Academy (Da'wa College).
A student just spoke into a live voice recognizer, which captured the following phonetic transcript:
"""
${cleanSpoken}
"""

Your ONLY job is to output the exact words the student spoke in ${langHint}:
1. NEVER translate the meaning into another language and NEVER answer the question! Output ONLY what the student said.
2. Why this normalization is needed: Browser SpeechRecognition runs in a single locale (like 'ml-IN' or 'en-IN'), so:
   - If the student spoke English while the recognizer was in 'ml-IN' mode, English words may be written phonetically in Malayalam letters (e.g., "വാട്ട് ആർ ദി കണ്ടീഷൻസ് ഓഫ് വുളൂ" or "ഹൗ ആർ യു") -> convert them to clean English ("What are the conditions of Wudu?", "How are you?").
   - If the student spoke Malayalam while the recognizer was in 'en-IN' mode, Malayalam words may be written in Latin/Manglish or phonetic English words (e.g., "enthanu niskarathinte farzukal", "sukhamano", "assalamu alaikum usthad") -> convert them to natural Malayalam script ("എന്താണ് നിസ്കാരത്തിന്റെ ഫർളുകൾ?", "സുഖമാണോ?", "അസ്സലാമു അലൈക്കും ഉസ്താദേ").
   - If the student spoke Malayalam and it is already in Malayalam script (e.g., "അസ്സലാമു അലൈക്കും ഉസ്താദേ എന്താണ് വിശേഷം"), keep it in clean Malayalam script!
   - If the student spoke Arabic (even if written phonetically in Malayalam or Latin script like "മാ ഹിയ ശുറൂത്തു സ്വലാത്ത്" or "ma hiya shuroot as salah" or "കൈഫ ഹാലുക്ക"), output it in clean Arabic script ("مَا هِيَ شُرُوطُ الصَّلَاةِ؟", "كَيْفَ حَالُكَ؟").
   - If the student spoke Urdu (even if written phonetically in Malayalam or Latin script like "നമാസ് കെ ഫറായിസ് ക്യാ ഹേ" or "namaz ke faraiz kya hain" or "ആപ് കൈസേ ഹേ"), output it in clean Urdu script ("نماز کے فرائض کیا ہیں؟", "آپ کیسے ہیں؟").
   - If the student spoke Spanish or German phonetically, output it in clean Español or Deutsch.
3. Output ONLY the final normalized text with no quotes, no markdown, and no explanation.`

      for (const modelName of models) {
        try {
          const raw = await callGeminiParts(apiKey, modelName, [{ text: scriptPrompt }])
          if (typeof raw === 'string' && raw.trim()) {
            res.status(200).json({
              text: raw.trim().replace(/^["'“”]+|["'“”]+$/g, '').trim(),
            })
            return
          }
        } catch {
          continue
        }
      }

      res.status(200).json({ text: cleanSpoken })
      return
    }

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      res.status(200).json({ text: '' })
      return
    }

    const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '').trim()
    const cleanMime = String(mimeType || 'audio/webm').split(';')[0].trim() || 'audio/webm'

    const promptText = `Listen carefully to this audio clip from an ICS Academy student.
1. If the audio is silent, contains only background noise/clicks, or has no clear human speech, output ONLY the exact token: __SILENT__
2. Do NOT invent or guess words if no one is speaking.
3. CRITICAL: Do NOT translate the speech into English! Transcribe the spoken words verbatim in ${langHint}. Never transliterate Malayalam, Arabic, or Urdu speech into English/Latin letters. Output ONLY the transcribed text itself with no quotes, prefixes, or commentary.`

    let transcript = ''
    for (const modelName of models) {
      try {
        const raw = await callGeminiParts(apiKey, modelName, [
          { inlineData: { mimeType: cleanMime, data: cleanBase64 } },
          { text: promptText },
        ])
        if (typeof raw === 'string') {
          transcript = raw.includes('__SILENT__')
            ? ''
            : raw.replace(/^["'“”]+|["'“”]+$/g, '').trim()
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
