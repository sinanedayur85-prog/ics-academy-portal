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

// Warm-instance model caches so unavailable (404) models are skipped in 0ms on subsequent requests
const UNAVAILABLE_MODEL_TTL_MS = 15 * 60 * 1000
const unavailableModels = new Map()
const preferredWorkingModelByTier = new Map()

function isModelMarkedUnavailable(modelName) {
  const ts = unavailableModels.get(modelName)
  if (!ts) return false
  if (Date.now() - ts > UNAVAILABLE_MODEL_TTL_MS) {
    unavailableModels.delete(modelName)
    return false
  }
  return true
}

function markModelUnavailable(modelName) {
  unavailableModels.set(modelName, Date.now())
}

function isNotFoundModelError(err) {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes('404') ||
    msg.includes('NOT_FOUND') ||
    msg.includes('is not found') ||
    msg.includes('not supported for generateContent') ||
    msg.includes('no longer available')
  )
}

function isTransientOrFallbackError(err) {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    isNotFoundModelError(err) ||
    msg.includes('TIMEOUT:') ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('overloaded') ||
    msg.includes('fetch failed') ||
    msg.includes('ECONNRESET') ||
    msg.includes('socket hang up')
  )
}

function getOrderedModels(modelTier, isLongForm) {
  const tierKey = modelTier === 'flash-lite' && !isLongForm ? 'fast' : 'deep'
  const baseList =
    tierKey === 'fast'
      ? [
          'gemini-3.1-flash-lite',
          'gemini-4-hydrogen',
          'gemini-2.5-flash-lite',
          'gemini-2.5-flash',
          'gemini-3.1-flash-lite-preview',
          'gemini-3-flash-preview',
        ]
      : [
          'gemini-4-hydrogen',
          'gemini-3.1-flash-lite',
          'gemini-2.5-flash',
          'gemini-3-flash-preview',
          'gemini-2.5-flash-lite',
          'gemini-3.1-flash-lite-preview',
        ]

  const preferred = preferredWorkingModelByTier.get(tierKey)
  const prioritized =
    preferred && baseList.includes(preferred)
      ? [preferred, ...baseList.filter((m) => m !== preferred)]
      : baseList

  const filtered = prioritized.filter((m) => !isModelMarkedUnavailable(m))
  return {
    tierKey,
    models: filtered.length > 0 ? filtered : prioritized,
  }
}

function buildModelConfig(modelName, systemInstruction, isLongForm) {
  const config = {
    ...(systemInstruction ? { systemInstruction } : {}),
  }

  // Only pass thinkingLevel to Gemini 3/4 series models (lowest latency for chat)
  if (modelName === 'gemini-4-hydrogen') {
    config.thinkingConfig = {
      thinkingLevel: isLongForm ? ThinkingLevel.MEDIUM : ThinkingLevel.LOW,
    }
  } else if (modelName === 'gemini-3.1-flash-lite') {
    config.thinkingConfig = {
      thinkingLevel: ThinkingLevel.MINIMAL,
    }
  }

  return config
}

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`TIMEOUT: ${label} exceeded ${timeoutMs}ms`))
    }, timeoutMs)

    promise
      .then((val) => {
        clearTimeout(timer)
        resolve(val)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
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
- Refer to the institution in Malayalam as "ഐ.സി.എസ് അക്കാദമി".
- Always address the student respectfully as "താങ്കൾ" (never "നീ" or "നിങ്ങൾ").`
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
6. STRICT STUDENT & STAFF PRIVACY RULE (CRITICAL — APPLIES TO BOTH USTHADS AND STUDENTS): In this Chatbot, neither Usthads nor Students nor anyone is permitted to view anything about other students or staff members except their NAME (and class). Never disclose, guess, or generate any person's Admission ID (ICS2K...), Password, Batch number (e.g. Batch 14, Batch 07), Class Leader ID (CL-... / ACL-...), Staff ID (UST-... / ADM-...), attendance record, leave status, or personal data. If anyone asks for another person's Admission ID, password, batch number, attendance, leave details, or private information, politely refuse and state that for institutional privacy, only names are visible in the Chatbot.
7. EXPANSIVE MULTI-PAGE DOCUMENT CAPABILITY (CRITICAL): Whenever a student requests multiple pages, a detailed essay/treatise, or extensive study notes (e.g. "5 pages", "10 pages", "ഒരുപാട് പേജുകൾ", "വിശാലമായി എഴുതൂ", "بحث مطول من عدة صفحات"), NEVER condense or stop early! Write deeply and exhaustively across full chapters (##, ###), bold key terms (**...**), blockquotes (> ...) for Quran/Hadith/Kitab quotes, scholarly comparisons, examples, and review questions proportionate to the requested page count (~500-650 words per A4 page).

Language Rule:
${langRule}`
}

function detectLongFormRequest(text) {
  if (!text) return { isLongForm: false, requestedPages: null }
  const normalized = String(text)
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))

  const pageNumMatch =
    /(\d{1,2})\s*(?:pages?|pgs?|പേജ്|പേജുകൾ|പേജുള്ള|പേജിന്റെ|പേജിൽ|صفحة|صفحات|صفحے|páginas?|seiten?)/i.exec(
      normalized,
    ) || /(?:pages?|പേജ്|പേജുകൾ|صفحة|صفحات)\s*[:\-]?\s*(\d{1,2})/i.exec(normalized)

  if (pageNumMatch) {
    const num = Number(pageNumMatch[1])
    if (Number.isFinite(num) && num >= 2) {
      return { isLongForm: true, requestedPages: Math.min(num, 30) }
    }
  }

  const expansiveRegex =
    /(?:ഒരുപാട്\s*പേജ്|ധാരാളം\s*പേജ്|കൂടുതൽ\s*പേജ്|പല\s*പേജ്|വിശാലമായി|വിശാലമായ|വിശദമായി|വിശദമായ|ദീർഘമായി|ദീർഘമായ|സമ്പൂർണ്ണ|മുഴുവനായി|പ്രബന്ധം|ഉപന്യാസം|റിസർച്ച്|വലിയ\s*നോട്ട്|many\s+pages|multiple\s+pages|several\s+pages|long\s+(?:essay|note|notes|article|paper|speech|explanation)|in\s+full\s+detail|in\s+depth|in-depth|comprehensive|exhaustive|extensive|full\s+study\s+notes?|research\s+paper|complete\s+guide|elaborate\s+thoroughly|صفحات\s*كثيرة|عدة\s*صفحات|مفصل|موسع|شامل|مطول|بحث\s*(?:كامل|مفصل|طويل)|مقال\s*طويل|کئی\s*صفحات|تفصیل\s*سے|مفصل|مکمل\s*مضمون|en\s+detalle|extenso|ausführlich|umfangreich)/i

  return { isLongForm: expansiveRegex.test(normalized), requestedPages: null }
}

function redactPrivateIds(text) {
  if (!text) return text
  return String(text)
    .replace(/\bICS2K\d{2}[A-Z0-9]*\b/gi, '[Private Admission ID]')
    .replace(/\bICS-\d{4}-\d+\b/gi, '[Private Admission ID]')
    .replace(/\b(?:ACL|CL)-\d{1,3}(?:-[A-Z0-9]+)?\b/gi, '[Private Leader ID]')
    .replace(/\b(?:UST|ADM)-\d{1,4}\b/gi, '[Private Staff ID]')
    .replace(/\s*•\s*Batch\s+\d+\b/gi, '')
}

function writeSseEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
  if (typeof res.flush === 'function') {
    res.flush()
  }
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
      modelTier = 'flash-lite',
      studentName,
      studentClass,
      attachments = [],
      stream = false,
    } = req.body ?? {}

    const wantsStream = Boolean(stream)
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

    const longFormInfo = detectLongFormRequest(finalPrompt)
    const maxHistoryTurns = longFormInfo.isLongForm ? 12 : 10
    const maxTurnChars = longFormInfo.isLongForm ? 6000 : 3500

    const sanitizedHistory = safeHistory
      .filter((t) => t && typeof t.text === 'string' && t.text.trim())
      .slice(-maxHistoryTurns)
      .map((t) => ({
        role: t.role === 'model' ? 'model' : 'user',
        parts: [{ text: t.text.trim().slice(0, maxTurnChars) }],
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
    const longFormHint = longFormInfo.isLongForm
      ? `\n[MULTI-PAGE COMPREHENSIVE DEPTH MODE: ${
          longFormInfo.requestedPages
            ? `Write approximately ${longFormInfo.requestedPages} full A4 pages (~${Math.min(
                longFormInfo.requestedPages * 550,
                9000,
              )}+ words).`
            : 'Write an extensive, multi-page scholarly document (2,000-4,500+ words).'
        } Do NOT summarize or cut short. Use structured headings (##, ###), bold key terms (**...**), Arabic Kitab/Quran/Hadith quotes in blockquotes (> ...), deep analysis, examples, and review questions.]`
      : ''

    const langNameMap = {
      ml: 'Malayalam (മലയാളം script)',
      en: 'English',
      ar: 'Arabic (العربية الفصحى)',
      ur: 'Urdu (اردو script)',
      es: 'Spanish (Español)',
      de: 'German (Deutsch)',
    }

    const promptWithDirective = `${finalPrompt}${salamHint}${longFormHint}\n[Respond in ${langNameMap[validLanguage] || 'Malayalam'}. If the student is answering a previous question from you, evaluate their answer directly.]`

    const contents = [
      ...sanitizedHistory,
      {
        role: 'user',
        parts: [...inlineParts, { text: promptWithDirective }],
      },
    ]

    const { tierKey, models } = getOrderedModels(modelTier, longFormInfo.isLongForm)
    const ai = createAiClient(apiKey)

    if (wantsStream) {
      let clientClosed = false
      req.on('close', () => {
        clientClosed = true
      })

      let lastError = ''
      const firstChunkTimeoutMs =
        longFormInfo.isLongForm || validAttachments.length > 0 ? 22000 : 14000

      for (const modelName of models) {
        if (clientClosed) return
        try {
          const config = buildModelConfig(modelName, systemInstruction, longFormInfo.isLongForm)
          const streamIterable = await withTimeout(
            ai.models.generateContentStream({
              model: modelName,
              contents,
              config,
            }),
            firstChunkTimeoutMs,
            `${modelName} connect`,
          )

          const iterator = streamIterable[Symbol.asyncIterator]()
          let firstText = ''

          // Read until first non-empty text chunk BEFORE sending SSE headers so fallback stays clean
          while (true) {
            const step = await withTimeout(
              iterator.next(),
              firstChunkTimeoutMs,
              `${modelName} first token`,
            )
            if (step.done) break
            const chunkText = typeof step.value?.text === 'string' ? step.value.text : ''
            if (chunkText) {
              firstText = redactPrivateIds(chunkText)
              break
            }
          }

          if (!firstText) {
            continue
          }

          preferredWorkingModelByTier.set(tierKey, modelName)

          if (clientClosed) return

          res.status(200)
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
          res.setHeader('Cache-Control', 'no-cache, no-transform')
          res.setHeader('Connection', 'keep-alive')
          res.setHeader('X-Accel-Buffering', 'no')
          if (typeof res.flushHeaders === 'function') {
            res.flushHeaders()
          }

          writeSseEvent(res, {
            type: 'meta',
            modelUsed: modelName,
            role,
            language: validLanguage,
          })
          writeSseEvent(res, { type: 'delta', text: firstText })

          while (!clientClosed) {
            const nextStep = await withTimeout(iterator.next(), 25000, `${modelName} chunk`)
            if (nextStep.done) break
            const deltaText = typeof nextStep.value?.text === 'string' ? nextStep.value.text : ''
            if (deltaText) {
              writeSseEvent(res, { type: 'delta', text: redactPrivateIds(deltaText) })
            }
          }

          if (!clientClosed) {
            writeSseEvent(res, { type: 'done', modelUsed: modelName })
            res.end()
          }
          return
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err)
          if (isNotFoundModelError(err)) {
            markModelUnavailable(modelName)
          }
          if (res.headersSent) {
            if (!clientClosed) {
              writeSseEvent(res, { type: 'error', error: lastError })
              res.end()
            }
            return
          }
          if (isTransientOrFallbackError(err)) {
            continue
          }
          break
        }
      }

      if (!res.headersSent) {
        res.status(503).json({
          error: `AI service error: ${lastError || 'All models busy. Please try again.'}`,
        })
      }
      return
    }

    // Standard non-streaming JSON response (100% backward compatible for older APKs)
    let lastError = ''
    const requestTimeoutMs = longFormInfo.isLongForm ? 55000 : validAttachments.length > 0 ? 35000 : 25000

    for (const modelName of models) {
      try {
        const config = buildModelConfig(modelName, systemInstruction, longFormInfo.isLongForm)
        const response = await withTimeout(
          ai.models.generateContent({
            model: modelName,
            contents,
            config,
          }),
          requestTimeoutMs,
          modelName,
        )
        const replyText = redactPrivateIds(String(response.text || '').trim())
        if (replyText) {
          preferredWorkingModelByTier.set(tierKey, modelName)
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
        if (isNotFoundModelError(err)) {
          markModelUnavailable(modelName)
        }
        if (isTransientOrFallbackError(err)) {
          continue
        }
        break
      }
    }

    res.status(503).json({
      error: `AI service error: ${lastError || 'All models busy. Please try again.'}`,
    })
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Chat request failed',
      })
    } else {
      res.end()
    }
  }
}
