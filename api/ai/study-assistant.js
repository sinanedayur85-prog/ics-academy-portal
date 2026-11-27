import { GoogleGenAI, ThinkingLevel } from '@google/genai'

function getApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    ''
  ).trim()
}

function createAiClient(apiKey) {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  })
}

const unavailableModels = new Map()
let cachedWorkingModel = ''

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
${langRule}
STRICT PRIVACY RULE: Neither Usthads nor Students are permitted to view anything about other students or staff members in this Chatbot except their NAME (and class). Never disclose, guess, or generate any Admission ID (ICS2K...), Password, Batch number (e.g. Batch 14), Leader ID (CL-.../ACL-...), Staff ID (UST-.../ADM-...), attendance record, or leave status.`

    const baseModels = [
      'gemini-4-hydrogen',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-3-flash-preview',
      'gemini-3.1-flash-lite-preview',
    ]

    const now = Date.now()
    const prioritized =
      cachedWorkingModel && baseModels.includes(cachedWorkingModel)
        ? [cachedWorkingModel, ...baseModels.filter((m) => m !== cachedWorkingModel)]
        : baseModels
    const activeModels = prioritized.filter((m) => {
      const ts = unavailableModels.get(m)
      return !ts || now - ts > 15 * 60 * 1000
    })

    const ai = createAiClient(apiKey)

    for (const modelName of activeModels.length > 0 ? activeModels : prioritized) {
      try {
        const config = {
          systemInstruction,
          ...(modelName === 'gemini-4-hydrogen'
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : modelName === 'gemini-3.1-flash-lite'
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }
              : {}),
        }

        const response = await ai.models.generateContent({
          model: modelName,
          contents: cleanPrompt,
          config,
        })

        const replyText = String(response.text || '')
          .trim()
          .replace(/\bICS2K\d{2}[A-Z0-9]*\b/gi, '[Private Admission ID]')
          .replace(/\bICS-\d{4}-\d+\b/gi, '[Private Admission ID]')
          .replace(/\b(?:ACL|CL)-\d{1,3}(?:-[A-Z0-9]+)?\b/gi, '[Private Leader ID]')
          .replace(/\b(?:UST|ADM)-\d{1,4}\b/gi, '[Private Staff ID]')

        if (replyText) {
          cachedWorkingModel = modelName
          res.status(200).json({
            response: replyText,
            mode,
            language: validLanguage,
          })
          return
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('404') || msg.includes('NOT_FOUND')) {
          unavailableModels.set(modelName, Date.now())
        }
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
