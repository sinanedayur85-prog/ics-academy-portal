import { GoogleGenAI, ThinkingLevel } from '@google/genai'

type OutputLanguage = 'ml' | 'en' | 'ar' | 'ur' | 'es' | 'de'
type ChatRole = 'usthad' | 'academic' | 'language' | 'campus'

interface ClientChatAttachment {
  mimeType: string
  data: string
  name?: string
}

interface ClientChatTurn {
  role: 'user' | 'model'
  text: string
}

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY
  return new GoogleGenAI({
    ...(apiKey ? { apiKey } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  })
}

function buildChatbotInstruction(
  role: ChatRole,
  language: OutputLanguage,
  studentName?: string,
  studentClass?: string,
): string {
  const langRule =
    language === 'ml'
      ? 'Respond in scholarly Malayalam (മലയാളം) script, keeping Islamic greetings (السَّلَامُ عَلَيْكُمْ / وَعَلَيْكُمُ السَّلَامُ) and quoted Quran/Hadith/Kitab phrases in vocalized Arabic script. Refer to the academy as "ഐ.സി.എസ് അക്കാദമി".'
      : language === 'ar'
        ? 'Respond 100% in clear Classical/Modern Standard Arabic (العربية الفصحى). Refer to the academy as "أكاديمية ICS".'
        : language === 'ur'
          ? 'Respond 100% in scholarly Urdu (اردو), keeping only quoted Quran/Hadith/Kitab phrases in Arabic script. Refer to the academy as "آئی سی ایس اکیڈمی".'
          : language === 'es'
            ? 'Respond in scholarly Spanish (Español). Refer to the academy as "ICS Academy".'
            : language === 'de'
              ? 'Respond in scholarly German (Deutsch). Refer to the academy as "ICS Academy".'
              : 'Respond in clear academic English with key Arabic technical/Kitab terms inside brackets in vocalized Arabic script. Refer to the academy as "ICS Academy".'

  return `You are the official Multi-Turn Multimodal Scholarly Chatbot for ICS Academy (Islamic Centre Sunniyya, Manhappatta — Da'wa College).
Student: ${studentName || "Da'wa College Scholar"}${studentClass ? ` (Class ${studentClass})` : ''}
Active Role: ${role}

Multimodal Image & Document Capabilities:
- When the student attaches a photo or PDF of a Kitab page, Arabic text, textbook page, handwritten notes, diagram, or exam paper:
  1. Accurately read/transcribe the relevant text from the image.
  2. Translate into the target language, explain word-by-word meanings (Mufradat), analyze Nahw/Sarf/I'rab grammar, explain Fiqh/academic concepts, or solve the exam questions shown.

Strict Institutional & Educational Scope:
- You are exclusively dedicated to educational, academic, linguistic, Islamic scholarly (Kitab/Fiqh/Tafsir/Hadith/Nahw/Sarf/Da'wa), and ICS Academy institutional matters.
- Politely decline any non-educational, entertainment, or off-topic requests.

Language Rule:
- ${langRule}`
}

export default async function handler(req: any, res: any) {
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

  const action = String(req.query?.action || '').trim()

  if (action === 'transcribe') {
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
        'gemini-3.8-flash',
        'gemini-3-flash-preview',
        'gemini-3.1-flash-lite',
        'gemini-3.1-flash-lite-preview',
        'gemini-2.5-flash',
        'gemini-3.5-transcribe',
      ]

      let transcript = ''
      for (const modelName of models) {
        try {
          const ai = getAiClient()
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                role: 'user',
                parts: [
                  { inlineData: { mimeType: cleanMime, data: cleanBase64 } },
                  { text: promptText },
                ],
              },
            ],
          })
          if (typeof response.text === 'string') {
            const raw = response.text.trim()
            transcript = raw.includes('__SILENT__') ? '' : raw
            break
          }
        } catch {
          continue
        }
      }

      res.status(200).json({ text: transcript })
      return
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Transcription failed',
      })
      return
    }
  }

  if (action === 'chat' || action === 'study-assistant') {
    try {
      const {
        message = '',
        prompt = '',
        history = [],
        role = 'usthad',
        language = 'en',
        studentName,
        studentClass,
        attachments = [],
      } = req.body ?? {}

      const rawText = String(message || prompt || '').trim()
      const validAttachments: ClientChatAttachment[] = Array.isArray(attachments)
        ? attachments.filter((a) => a && typeof a.data === 'string' && a.data.trim())
        : []

      if (!rawText && validAttachments.length === 0) {
        res.status(400).json({ error: 'Message or attachment is required.' })
        return
      }

      const validLanguage: OutputLanguage = ['ml', 'en', 'ar', 'ur', 'es', 'de'].includes(language)
        ? language
        : /[\u0D00-\u0D7F]/.test(rawText)
          ? 'ml'
          : 'en'

      const defaultPrompt =
        validLanguage === 'ml'
          ? 'ഈ ചിത്രത്തിലെ കിതാബ് ഭാഗം / പഠന വിഷയം വായിച്ച് മലയാളത്തിലേക്ക് വിവർത്തനം ചെയ്യുകയും പ്രധാന ആശയങ്ങൾ വിശദീകരിക്കുകയും ചെയ്യുക.'
          : 'Please examine this educational image/document, transcribe the key text, translate it clearly, and explain its scholarly meaning.'

      const finalPrompt = (rawText || defaultPrompt).slice(0, 3000)
      const systemInstruction = buildChatbotInstruction(
        role as ChatRole,
        validLanguage,
        studentName,
        studentClass,
      )

      const sanitizedHistory = (Array.isArray(history) ? (history as ClientChatTurn[]) : [])
        .filter((t) => t && typeof t.text === 'string' && t.text.trim())
        .slice(-14)
        .map((t) => ({
          role: t.role === 'model' ? ('model' as const) : ('user' as const),
          parts: [{ text: t.text.trim().slice(0, 3500) }],
        }))

      const inlineParts = validAttachments.slice(0, 3).map((att) => ({
        inlineData: {
          mimeType: (att.mimeType || 'image/jpeg').split(';')[0].trim(),
          data: att.data.replace(/^data:[^;]+;base64,/, '').trim(),
        },
      }))

      const models = [
        'gemini-3.8-flash',
        'gemini-3-flash-preview',
        'gemini-3.1-flash-lite',
        'gemini-3.1-flash-lite-preview',
        'gemini-2.5-flash',
      ]

      for (const modelName of models) {
        try {
          const ai = getAiClient()
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              ...sanitizedHistory,
              {
                role: 'user',
                parts: [...inlineParts, { text: finalPrompt }],
              },
            ],
            config: {
              systemInstruction,
              ...(modelName === 'gemini-3.8-flash'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          })
          if (response.text) {
            res.status(200).json({
              reply: response.text,
              response: response.text,
              modelUsed: modelName,
              language: validLanguage,
            })
            return
          }
        } catch {
          continue
        }
      }

      res.status(503).json({ error: 'AI models are busy.' })
      return
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Chat request failed',
      })
      return
    }
  }

  res.status(404).json({ error: 'Unknown AI route' })
}
