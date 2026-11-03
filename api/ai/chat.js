function getApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    ''
  ).trim()
}

function isUrduScript(text) {
  if (!text) return false
  if (/[\u0D00-\u0D7F]{2,}/.test(text)) return false
  return (
    /[\u0679\u067E\u0686\u0688\u0691\u0698\u06AF\u06BA\u06BE\u06C1\u06C2\u06C3\u06D2\u06D4]/.test(
      text,
    ) ||
    /(?:^|\s)(?:کیا|کیوں|کیسے|ہے|ہیں|میں|کو|سے|پر|اور|کا|کی|کے)(?:\s|$|[۔،؟!])/.test(text)
  )
}

function detectInputLanguage(text, fallbackLanguage, history) {
  if (!text || !text.trim()) {
    if (Array.isArray(history) && history.length > 0) {
      for (let i = history.length - 1; i >= 0; i--) {
        const t = history[i]?.text || ''
        if (/[\u0D00-\u0D7F]{2,}/.test(t)) return 'ml'
        if (isUrduScript(t)) return 'ur'
      }
    }
    return fallbackLanguage
  }

  const clean = text.trim()

  if (/[\u0D00-\u0D7F]/.test(clean)) {
    return 'ml'
  }

  if (/\b(in\s+malayalam|malayalathil|malayalam\s+meaning|malayalam\s+translation)\b/i.test(clean)) {
    return 'ml'
  }

  if (isUrduScript(clean)) {
    return 'ur'
  }

  if (
    /\b(enthanu|enthokkeyanu|enthokke|parayamo|parayu|engane|enganeyanu|vishadeekarikamo|vishadeekarikkuka|artham|sharthukal|farzukal|sunnathukal|vivarikkuka|entha|manassilayilla|padippikkamo|chodyam|utharam|paribhasha|sughamano|sugamano|namaskaram|niskaram|usthade|orennam|onnu|randu|moonnu|shariyano|athe|alla)\b/i.test(
      clean,
    )
  ) {
    return 'ml'
  }

  const stripped = clean
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(
      /(?:^|\s)(?:وعليكم\s+السلام|السلام\s+عليكم|سلام\s+عليكم|ورحمة\s+الله|وبركاته|بسم\s+الله\s+الرحمن\s+الرحيم)(?=\s|$|[،.؟!])/g,
      ' ',
    )
    .trim()
  const withoutQuotes = stripped.replace(/["“”«»'‘’][^"“”«»'‘’]{4,}["“”«»'‘’]/g, ' ').trim()
  const target = withoutQuotes.length >= 4 ? withoutQuotes : stripped

  const arabicChars = (
    target.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []
  ).length
  const latinChars = (target.match(/[A-Za-z\u00C0-\u024F]/g) || []).length

  if (arabicChars > 0 && arabicChars > latinChars) {
    return 'ar'
  }

  if (
    /[¿¡ñÑáéíóúÁÉÍÓÚ]/.test(clean) ||
    /\b(qué|cómo|cuál|cuáles|explica|explicar|según|por\s+favor|hola|gracias|condiciones|diferencia)\b/i.test(
      clean,
    )
  ) {
    return 'es'
  }

  if (
    /[äöüßÄÖÜ]/.test(clean) ||
    /\b(erkläre|erklären|gemäß|was\s+ist|wie\s+sind|bitte|danke|bedingungen|unterschied)\b/i.test(
      clean,
    )
  ) {
    return 'de'
  }

  if (clean.length <= 24 && Array.isArray(history) && history.length > 0) {
    const lastTurn = history[history.length - 1]?.text || ''
    if (/[\u0D00-\u0D7F]{3,}/.test(lastTurn)) return 'ml'
    if (isUrduScript(lastTurn)) return 'ur'
  }

  return fallbackLanguage
}

function didStudentSaySalam(text) {
  if (!text) return false
  return (
    /\b(salam|salaam|assalam|as-salam|as\s+salam|alsalam|al-salam|assalamu|assalaamu)\b/i.test(
      text,
    ) ||
    /السلام|سلام|السَّلَام|سَلَام/.test(text) ||
    /സലാം|അസ്സലാമു/.test(text)
  )
}

function buildChatbotInstruction(role, language, studentName, studentClass) {
  const langRule =
    language === 'ml'
      ? `Respond in natural, fluent, scholarly Malayalam (മലയാളം) script.
- Keep Islamic greetings (السَّلَامُ عَلَيْكُمْ / وَعَلَيْكُمُ السَّلَامُ) on their own line in Arabic script, and keep quoted Quranic verses, Hadith, and Kitab terms in vocalized Arabic script alongside clear Malayalam explanation.
- Refer to the institution in Malayalam as "ഐ.സി.എസ് അക്കാദമി".`
      : language === 'ar'
        ? `Respond 100% in clear Classical/Modern Standard Arabic (العربية الفصحى). Refer to the institution as "أكاديمية ICS".`
        : language === 'ur'
          ? `Respond 100% in eloquent, scholarly Urdu (اردو), keeping only quoted Quran/Hadith/Kitab phrases in Arabic script. Refer to the institution as "آئی سی ایس اکیڈمی".`
          : language === 'es'
            ? `Respond in clear, scholarly Spanish (Español). Refer to the institution as "ICS Academy".`
            : language === 'de'
              ? `Respond in clear, scholarly German (Deutsch). Refer to the institution as "ICS Academy".`
              : `Respond in clear academic English with key Arabic technical/Kitab terms inside brackets in vocalized Arabic script. Refer to the institution as "ICS Academy". (If the student explicitly asks to translate into Malayalam or another language, provide the requested translation clearly.)`

  const rolePersonas = {
    usthad: `Role: Usthad Kitab & Fiqh Mentor at ICS Academy (Da'wa College). You guide students on classical Kitabs (Fathul Mueen, Mahalli, Tafsir Jalalayn, Riyad as-Salihin, Alfiyyah Ibn Malik), Usul al-Fiqh, Nahw/Sarf, and Shafi'i jurisprudence.`,
    academic: `Role: Academic & Exam Tutor at ICS Academy. You help Da'wa College students master integrated Islamic and modern academic subjects (Humanities, History, English, Sociology, Science, Commerce).`,
    language: `Role: Multilingual Language Coach (Arabic · English · Malayalam · Urdu · Spanish · German) at ICS Academy.`,
    campus: `Role: Campus & Da'wa Advisor at ICS Academy. You guide students on Da'wa speech preparation, essay writing, study timetables, and Kitab study habits.`,
  }

  return `You are the official Multi-Turn Multimodal Scholarly Chatbot for ICS Academy (Islamic Centre Sunniyya, Manhappatta — Da'wa College).
Student: ${studentName || "Da'wa College Scholar"}${studentClass ? ` (Class ${studentClass})` : ''}
${rolePersonas[role] || rolePersonas.usthad}

CRITICAL CONVERSATIONAL & FOLLOW-UP INTELLIGENCE (ACT LIKE REAL GOOGLE GEMINI):
1. Direct & Specific Answers: Answer the exact question the student asked! Never give a generic template reply.
2. Greetings & Short Messages: If the student says "ഹായ്", "Hi", "Hello", "അസ്സലാമു അലൈക്കും", or a brief greeting, respond warmly and naturally in 2-3 sentences as their Usthad/Mentor and ask what topic, Kitab passage, or study photo they would like help with today.
3. Evaluating Student Answers to Follow-Up Questions: Look at the conversation history! If your previous message ended with a follow-up question or quiz question, and the student's new message is answering that question, DO NOT treat their answer as a new question! Instead, evaluate whether their answer is right or wrong (e.g. "മാശാ അല്ലാഹ്! താങ്കൾ നൽകിയ ഉത്തരം വളരെ കൃത്യമാണ്..." / "Masha'Allah, your answer is spot on!"), explain why, and continue the lesson naturally.
4. Multimodal Image & Document Capabilities: When the student attaches a photo or PDF of a Kitab page, Arabic text, textbook page, handwritten notes, or exam paper:
   - Read and transcribe the exact text visible in the image.
   - Translate it clearly into the requested language(s) (including Malayalam and English when requested) and explain the word-by-word meanings, Nahw/Sarf grammar, or Fiqh/academic rulings.
5. Institutional Scope: Dedicate responses to educational, academic, linguistic, Islamic scholarly, and ICS Academy matters.

Language Rule:
${langRule}`
}

async function callGeminiGenerateContent(apiKey, modelName, contents, systemInstruction) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelName,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`

  const body = {
    contents,
    ...(systemInstruction
      ? {
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
        }
      : {}),
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 300)}`)
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
    res.status(503).json({
      error:
        'GEMINI_API_KEY ക്രമീകരിച്ചിട്ടില്ല. ദയവായി Vercel Settings → Environment Variables-ൽ GEMINI_API_KEY ചേർക്കുക.',
    })
    return
  }

  try {
    const {
      message = '',
      history = [],
      role = 'usthad',
      language = 'en',
      languageMode = 'auto',
      modelTier = 'flash',
      studentName,
      studentClass,
      attachments = [],
    } = req.body ?? {}

    const rawText = String(message || '').trim()
    const validAttachments = Array.isArray(attachments)
      ? attachments.filter((a) => a && typeof a.data === 'string' && a.data.trim())
      : []

    if (!rawText && validAttachments.length === 0) {
      res.status(400).json({ error: 'Message or attachment is required.' })
      return
    }

    const safeHistory = Array.isArray(history) ? history : []
    const requestedLang = ['ml', 'en', 'ar', 'ur', 'es', 'de'].includes(language) ? language : 'en'
    const isExplicit = languageMode === 'explicit'
    const validLanguage = isExplicit
      ? requestedLang
      : detectInputLanguage(rawText, requestedLang, safeHistory)

    const defaultPrompt =
      validLanguage === 'ml'
        ? 'ഈ ചിത്രത്തിലെ പാഠഭാഗം വായിച്ച് മലയാളത്തിലേക്ക് വിവർത്തനം ചെയ്യുകയും പ്രധാന ആശയങ്ങൾ വിശദീകരിക്കുകയും ചെയ്യുക.'
        : 'Please read the text in this study image, translate it clearly into Malayalam and English, and explain the key scholarly points.'

    const finalPrompt = (rawText || defaultPrompt).slice(0, 4000)
    const systemInstruction = buildChatbotInstruction(
      role,
      validLanguage,
      studentName,
      studentClass,
    )

    const sanitizedHistory = safeHistory
      .filter((t) => t && typeof t.text === 'string' && t.text.trim())
      .slice(-16)
      .map((t) => ({
        role: t.role === 'model' ? 'model' : 'user',
        parts: [{ text: t.text.trim().slice(0, 4000) }],
      }))

    const inlineParts = validAttachments.slice(0, 3).map((att) => ({
      inlineData: {
        mimeType: String(att.mimeType || 'image/jpeg').split(';')[0].trim() || 'image/jpeg',
        data: String(att.data).replace(/^data:[^;]+;base64,/, '').trim(),
      },
    }))

    const userSaidSalam = didStudentSaySalam(finalPrompt)
    const isFirstTurn = sanitizedHistory.length === 0
    const salamHint = userSaidSalam
      ? '\n[The student greeted with Salam; start your reply with "وَعَلَيْكُمُ السَّلَامُ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ" on its own line.]'
      : isFirstTurn
        ? '\n[First message in thread; start your reply with "السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ" on its own line.]'
        : ''

    const langNameMap = {
      ml: 'Malayalam (മലയാളം script)',
      en: 'English',
      ar: 'Arabic (العربية الفصحى)',
      ur: 'Urdu (اردو script)',
      es: 'Spanish (Español)',
      de: 'German (Deutsch)',
    }

    const promptWithDirective = `${finalPrompt}${salamHint}\n[Respond in ${langNameMap[validLanguage] || 'Malayalam'}. If the student is answering a previous question from you, evaluate their answer directly.]`

    const models =
      modelTier === 'flash-lite'
        ? [
            'gemini-2.5-flash',
            'gemini-2.5-flash-lite',
            'gemini-3.1-flash-lite-preview',
            'gemini-3-flash-preview',
            'gemini-2.0-flash',
          ]
        : [
            'gemini-2.5-flash',
            'gemini-3-flash-preview',
            'gemini-3.1-flash-lite-preview',
            'gemini-2.5-flash-lite',
            'gemini-2.0-flash',
          ]

    const contents = [
      ...sanitizedHistory,
      {
        role: 'user',
        parts: [...inlineParts, { text: promptWithDirective }],
      },
    ]

    let lastError = ''
    for (const modelName of models) {
      try {
        const replyText = await callGeminiGenerateContent(
          apiKey,
          modelName,
          contents,
          systemInstruction,
        )
        if (replyText) {
          res.status(200).json({
            reply: replyText,
            modelUsed: modelName,
            role,
            language: validLanguage,
          })
          return
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
        continue
      }
    }

    res.status(503).json({
      error: `AI service error: ${lastError || 'All models busy. Please try again.'}`,
    })
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Chat request failed',
    })
  }
}
