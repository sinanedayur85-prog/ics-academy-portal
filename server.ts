import 'dotenv/config'
import express from 'express'
import { createServer as createHttpServer } from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import { createServer as createViteServer } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

type StudyMode = 'kitab' | 'qa' | 'translation' | 'dawa'
type OutputLanguage = 'ml' | 'en' | 'ar' | 'ur' | 'es' | 'de'
type ChatRole = 'usthad' | 'academic' | 'language' | 'campus'
type ChatModelTier = 'flash' | 'flash-lite'

interface ClientChatTurn {
  role: 'user' | 'model'
  text: string
}

function isUrduScript(text: string): boolean {
  if (!text) return false
  return /[\u0679\u067E\u0686\u0688\u0691\u0698\u06A9\u06AF\u06BA\u06BE\u06C1\u06C2\u06C3\u06CC\u06D2\u06D4]/.test(
    text,
  )
}

function didStudentSaySalam(text: string): boolean {
  if (!text) return false
  return (
    /\b(salam|salaam|assalam|as-salam|as\s+salam|alsalam|al-salam|assalamu|assalaamu)\b/i.test(text) ||
    /السلام|سلام|السَّلَام|سَلَام/.test(text) ||
    /സലാം|അസ്സലാമു/.test(text)
  )
}

function getSalamTurnDirective(isFirstTurn: boolean, userSaidSalam: boolean): string {
  if (userSaidSalam) {
    return `SALAM RULE: The student greeted you with Salam in this message, so begin your reply by returning Salam in Arabic script ("وَعَلَيْكُمُ السَّلَامُ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ" or "وَعَلَيْكُمُ السَّلَامُ") on its own separate first line, followed by a line break (\\n) before writing the student's name/salutation on the next line. NEVER write Salam in Latin/English or Malayalam letters.`
  }
  if (isFirstTurn) {
    return `SALAM RULE: The student did NOT say Salam in this message, and this is the first turn of the conversation. Do NOT say "وَعَلَيْكُمُ السَّلَامُ" (never return Salam when the student did not say Salam!). Instead, initiate the greeting yourself by writing "السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ" (or "السَّلَامُ عَلَيْكُمْ") in Arabic script on its own separate first line, followed by a line break (\\n), and then write your salutation (e.g. "My dear student...") on the next line. NEVER write Salam in Latin/English or Malayalam letters.`
  }
  return `SALAM RULE: The student did NOT say Salam in this follow-up message. Do NOT say "وَعَلَيْكُمُ السَّلَامُ" or repeat "السَّلَامُ عَلَيْكُمْ" — answer the student's follow-up question directly.`
}

function getTurnLanguageEnforcement(
  language: OutputLanguage,
  isFirstTurn = true,
  userSaidSalam = false,
): string {
  const salamRule = getSalamTurnDirective(isFirstTurn, userSaidSalam)
  switch (language) {
    case 'ur':
      return `\n\n[LANGUAGE INSTRUCTION: ${salamRule} You MUST write your entire explanation in URDU (اردو) language ONLY — do NOT write the explanation, headings, or follow-up questions in Arabic or Malayalam! Always refer to the institution in Urdu as "آئی سی ایس اکیڈمی" (ICS Academy). Use authentic Urdu vocabulary, grammar, and verbs (e.g., ہے، ہیں، میں، کی، کے، کا، اس جملے کی نحوی ترکیب درج ذیل ہے، غور و فکر کے لیے سوال). Keep only the quoted Quranic Ayah, Hadith, Islamic greeting (السَّلَامُ عَلَيْكُمْ / وَعَلَيْكُمُ السَّلَامُ), or Kitab Ibarat in Arabic script, and explain everything else 100% in Urdu (اردو).]`
    case 'ml':
      return `\n\n[LANGUAGE INSTRUCTION: ${salamRule} Respond primarily in Malayalam (മലയാളം). Keep Islamic greetings (السَّلَامُ عَلَيْكُمْ / وَعَلَيْكُمُ السَّلَامُ) and quoted Kitab Ibarats in Arabic script, put a newline after the Arabic Salam, and refer to the institution in Malayalam as "ഐ.സി.എസ് അക്കാദമി".]`
    case 'ar':
      return `\n\n[LANGUAGE INSTRUCTION: ${salamRule} Respond entirely in clear Classical/Modern Standard Arabic (العربية الفصحى). Never mix Malayalam words. Refer to the institution as "أكاديمية ICS".]`
    case 'es':
      return `\n\n[LANGUAGE INSTRUCTION: ${salamRule} Respond entirely in Spanish (Español). NEVER use Malayalam script or Malayalam words — always write "ICS Academy" in Latin script. Put a newline (\\n) after the Arabic Salam so the Spanish salutation starts on a new line.]`
    case 'de':
      return `\n\n[LANGUAGE INSTRUCTION: ${salamRule} Respond entirely in German (Deutsch). NEVER use Malayalam script or Malayalam words — always write "ICS Academy" in Latin script. Put a newline (\\n) after the Arabic Salam so the German salutation starts on a new line.]`
    case 'en':
    default:
      return `\n\n[LANGUAGE INSTRUCTION: ${salamRule} Respond in clear academic English. When explaining Islamic, Fiqh, Nahw/Sarf, or Kitab concepts in English, naturally present key Arabic terms and book/concept names with their original vocalized Arabic script inside brackets (...) right beside the English term — for example: Tayammum (التَّيَمُّم), Niyyah (النِّيَّة), Fard (فَرْض), Shart (شَرْط), Mubtada' (مُبْتَدَأ), Fathul Mueen (فَتْحُ الْمُعِينِ). NEVER use Malayalam script or Malayalam words anywhere in your response (always write "ICS Academy" in English, NEVER write "ഐ.സി.എസ് അക്കാദമി"). Always write the Salam itself in Arabic script (السَّلَامُ عَلَيْكُمْ or وَعَلَيْكُمُ السَّلَامُ) on its own line, followed by a newline (\\n), and write the English salutation (e.g., "My dear student...") on the next line.]`
  }
}

function buildSystemInstruction(mode: StudyMode, language: OutputLanguage, studentName?: string) {
  const languageLabel =
    language === 'ml'
      ? 'Malayalam (മലയാളം, with clear Arabic terms/quotes where appropriate)'
      : language === 'ar'
        ? 'Classical & Modern Standard Arabic (العربية الفصحى with clear vocalization where helpful)'
        : language === 'ur'
          ? 'Scholarly Urdu (اردو — NOT Arabic; write all explanations, headings, word-by-word meanings, and conclusions in Urdu)'
          : language === 'es'
            ? 'Academic Spanish (Español, with vocalized Arabic script for quoted Kitab verses where appropriate)'
            : language === 'de'
              ? 'Academic German (Deutsch, with vocalized Arabic script for quoted Kitab verses where appropriate)'
              : 'English (100% in English with key Arabic scholarly/Kitab terms provided in vocalized Arabic script inside brackets (...) alongside English; never mix Malayalam script)'

  const modeDirectives: Record<StudyMode, string> = {
    kitab: `You are in "Kitab & Ibarat Explainer" mode for ICS Academy (Da'wa College).
When a student provides an Arabic passage (Ibarat) or topic from classical Islamic texts (such as Fathul Mueen, Mahalli, Tafsir Jalalayn, Riyad as-Salihin, Alfiyyah Ibn Malik, Qatr al-Nada, etc.):
1. Provide the full vocalized Arabic text (with Harakat / Tashkeel) if applicable.
2. Give a clear word-by-word or phrase-by-phrase meaning in ${languageLabel}.
3. Explain the grammatical structure (Nahw / Sarf / I'rab) of key words concisely in ${languageLabel}.
4. Provide a comprehensive scholarly commentary (Sharh) and practical Fiqh/academic takeaway in ${languageLabel}.`,
    qa: `You are in "Islamic & Academic Subject Q&A" mode for ICS Academy (Da'wa College).
Provide accurate, well-structured scholarly answers in ${languageLabel} covering Fiqh (especially Shafi'i jurisprudence alongside comparative context when asked), Hadith sciences, Tafsir, Aqeedah, Islamic History, or modern academic subjects (Humanities, Science, English, Commerce).
Structure your answer with clear headings, key concepts, authentic references, and a concise summary for exam preparation.`,
    translation: `You are in "Multilingual Scholarly Translator" mode (Arabic ↔ Malayalam ↔ English ↔ Urdu ↔ Spanish ↔ German) for ICS Academy.
For the student's input text:
1. Provide a natural, accurate scholarly translation in the requested target language (${languageLabel}).
2. Include parallel versions in Arabic (with vocalization for key phrases) and the target language so the student can compare nuances.
3. List 3-5 important vocabulary terms (Mufradat) with their root letters and meanings in ${languageLabel}.`,
    dawa: `You are in "Da'wa Speech & Article Outliner" mode for ICS Academy students.
Create an inspiring, well-researched speech or essay outline in ${languageLabel} on the requested topic:
1. Compelling Title & Opening Hook (with an appropriate Quranic verse or Prophetic Hadith in Arabic script + meaning in ${languageLabel}).
2. 3-4 Core Arguments / Thematic Points with historical or contemporary context in ${languageLabel}.
3. Practical Moral & Social Application for modern youth and society in ${languageLabel}.
4. Memorable Conclusion & Du'a.`,
  }

  const languageSpecificFormatting =
    language === 'ml'
      ? `- Whenever using Islamic greetings, ALWAYS write them in Arabic script (السَّلَامُ عَلَيْكُمْ or وَعَلَيْكُمُ السَّلَامُ) on a separate line and NEVER transliterate them in Malayalam script ("അസ്സലാമു അലൈക്കും").
- When referring to the institution in Malayalam, say "ഐ.സി.എസ് അക്കാദമി" or "ഐ.സി.എസ് അക്കാദമിയുടെ" (never add "മഞ്ഞപ്പറ്റയുടെ").`
      : language === 'en'
        ? `- Write all explanations in English, and enrich your English explanation by placing important Arabic technical terms, Fiqh rulings, grammatical (Nahw/Sarf) terms, and Kitab titles in vocalized Arabic script inside brackets (...) alongside the English words — e.g., Tayammum (التَّيَمُّم), Niyyah (النِّيَّة), Fard (فَرْض), Shart (شَرْط), Mubtada' (مُبْتَدَأ), Khabar (خَبَر), Fathul Mueen (فَتْحُ الْمُعِينِ).
- NEVER include any Malayalam script or Malayalam words (always write "ICS Academy" in English, never "ഐ.സി.എസ് അക്കാദമി").
- Whenever using Islamic greetings (السَّلَامُ عَلَيْكُمْ or وَعَلَيْكُمُ السَّلَامُ), ALWAYS write them in Arabic script on their own separate line (never write "As-salāmu ʿalaykum" or "Wa ʿalaykumu s-salām" in Latin letters), followed by a newline before the English salutation.`
        : language === 'ur'
          ? `- CRITICAL FOR URDU (اردو): You MUST write all explanations, headings, grammatical analysis, and takeaways in URDU (اردو), NEVER in Arabic or Malayalam! Refer to the institution as "آئی سی ایس اکیڈمی".`
          : `- Never include Malayalam script when responding in ${languageLabel}. Always refer to the institution as "ICS Academy" and write Islamic greetings (السَّلَامُ عَلَيْكُمْ / وَعَلَيْكُمُ السَّلَامُ) in Arabic script on their own line.`

  return `You are the official AI Study & Kitab Research Assistant for ICS Academy (Da'wa College).
Student Name: ${studentName || "Da'wa College Scholar"}
Primary Output Language: ${languageLabel}

${modeDirectives[mode] || modeDirectives.kitab}

Formatting Rules:
- Use clean, readable sections with clear numbered or bulleted points.
${languageSpecificFormatting}
- Whenever quoting Quranic verses, Hadith, or classical Kitab phrases, write the Arabic text accurately and provide its meaning in ${languageLabel}.
- Keep the tone respectful, scholarly, encouraging, and pedagogically clear.`
}

function buildChatbotSystemInstruction(
  role: ChatRole,
  language: OutputLanguage,
  studentName?: string,
  studentClass?: string,
): string {
  const languageDirective =
    language === 'ml'
      ? `Respond primarily in natural, scholarly Malayalam (മലയാളം), including accurate vocalized Arabic script for Quranic verses, Hadith, Islamic greetings, and Kitab terms.
- CRITICAL MALAYALAM RULE: Never write "അസ്സലാമു അലൈക്കും" or "വഅലൈക്കുമുസ്സലാം" in Malayalam letters. Always write Islamic greetings in Arabic script: "السَّلَامُ عَلَيْكُمْ" or "وَعَلَيْكُمُ السَّلَامُ" on their own line.
- CRITICAL MALAYALAM RULE: In Malayalam, refer to the academy simply as "ഐ.സി.എസ് അക്കാദമി" or "ഐ.സി.എസ് അക്കാദമിയുടെ" (do not say "ഐ.സി.എസ് അക്കാദമി മഞ്ഞപ്പറ്റയുടെ").`
      : language === 'ar'
        ? `Respond 100% in clear Classical/Modern Standard Arabic (العربية الفصحى) with helpful vocalization (Tashkeel). Never mix Malayalam script or words. Refer to the academy as "أكاديمية ICS".`
        : language === 'ur'
          ? `Respond 100% in eloquent, scholarly URDU (اردو).
- CRITICAL URDU RULE: Urdu (اردو) is NOT Arabic! You MUST write all explanations, headings, word-by-word meanings, Nahw/Sarf grammatical analysis, and follow-up reflection questions in URDU (اردو) using Urdu sentences and verbs (such as ہے، ہیں، تھا، میں، سے، کو، پر، غور و فکر کے لیے سوال، نحوی ترکیب اور اعراب).
- NEVER write your explanation or follow-up questions in Arabic (for example, NEVER write "سؤال للتفكر", "في النحو العربي", "أعطني مثالاً", or "أنتظر إجابتك" in Arabic) and NEVER mix Malayalam words. Refer to the academy in Urdu as "آئی سی ایس اکیڈمی".
- Keep ONLY the quoted Quranic verses, Hadith, Islamic greetings (السَّلَامُ عَلَيْكُمْ / وَعَلَيْكُمُ السَّلَامُ), and the original Kitab Ibarat phrase in vocalized Arabic, and explain everything else in pure Urdu (اردو).`
          : language === 'es'
            ? `Respond in clear, scholarly Spanish (Español). NEVER use Malayalam words or script — always refer to the academy as "ICS Academy". Always write Islamic greetings (السَّلَامُ عَلَيْكُمْ / وَعَلَيْكُمُ السَّلَامُ) in Arabic script on their own separate line, followed by a newline before your Spanish salutation and explanation.`
            : language === 'de'
              ? `Respond in clear, scholarly German (Deutsch). NEVER use Malayalam words or script — always refer to the academy as "ICS Academy". Always write Islamic greetings (السَّلَامُ عَلَيْكُمْ / وَعَلَيْكُمُ السَّلَامُ) in Arabic script on their own separate line, followed by a newline before your German salutation and explanation.`
              : `Respond in clear academic English.
- ARABIC TERMS IN BRACKETS RULE: When presenting Islamic, Fiqh, Usul, Nahw/Sarf, or Kitab concepts in English, include the key Arabic terms in vocalized Arabic script inside brackets (...) alongside the English words — for example: Tayammum (التَّيَمُّم), Niyyah (النِّيَّة), Fard (فَرْض), Shart (شَرْط), Sa'eed (صَعِيد), Mubtada' (مُبْتَدَأ), Khabar (خَبَر), Fathul Mueen (فَتْحُ الْمُعِينِ).
- CRITICAL ENGLISH RULE: NEVER use Malayalam script or Malayalam words anywhere in an English response! Always write the institution's name in English as "ICS Academy" (NEVER write "ഐ.സി.എസ് അക്കാദമി" in an English response).
- CRITICAL SALAM & SALUTATION RULE:
  1. Always write Salam in Arabic script ("السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ" or "وَعَلَيْكُمُ السَّلَامُ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ") — NEVER write "As-salāmu ʿalaykum" or "Wa ʿalaykumu s-salām" in English letters.
  2. Only say "وَعَلَيْكُمُ السَّلَامُ" if the student greeted you with Salam in their message! If the student did NOT say Salam and it is the first turn, initiate Salam with "السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ".
  3. Always put a newline (\\n) immediately after the Arabic Salam so that the English address (e.g., "My dear student ${studentName || ''},") appears on its own separate line below the Salam.`

  const rolePersonas: Record<ChatRole, string> = {
    usthad: `Role: Usthad Kitab & Fiqh Mentor at ICS Academy (Da'wa College).
You engage in multi-turn scholarly dialogue on classical Kitabs (Fathul Mueen, Mahalli, Tafsir Jalalayn, Riyad as-Salihin, Alfiyyah Ibn Malik), Usul al-Fiqh, Nahw/Sarf, and Shafi'i jurisprudence.
Break down complex Ibarats step by step, remember earlier questions in the conversation, and ask thoughtful follow-up reflection questions to deepen the student's mastery.`,
    academic: `Role: Academic & Exam Tutor at ICS Academy.
You help Da'wa College students master integrated Islamic and modern academic subjects (Humanities, Commerce, History, English, Sociology, Islamic History).
Provide structured exam-ready points, memory aids, timelines, and multi-turn revision quizzes based on the ongoing conversation.`,
    language: `Role: Multilingual Language Coach (Arabic · English · Malayalam · Urdu · Spanish · German) at ICS Academy.
You coach students in Arabic conversation (Muhadathah), academic English, Malayalam, Urdu (اردو), Spanish (Español), and German (Deutsch) conversation, writing, and scholarly translation.
Correct grammar gently, highlight root letters (Maddah) and vocabulary (Mufradat), and encourage the student to reply in the target language.`,
    campus: `Role: Campus & Da'wa Advisor at ICS Academy.
You guide students on Da'wa speech preparation (Khutbah/elocution), essay writing, study timetables, Digital Library Kitab recommendations, and holistic spiritual-academic routines.`,
  }

  return `You are the official Multi-Turn Gemini Chatbot for ICS Academy (Da'wa College).
Student: ${studentName || "Da'wa College Scholar"}${studentClass ? ` (Class ${studentClass})` : ''}
${rolePersonas[role] || rolePersonas.usthad}

Language Instruction:
- ${languageDirective}

Conversation Guidelines:
- Maintain continuity with previous messages in the thread, but ALWAYS obey the current Language Instruction above even if earlier messages in the conversation history were in a different language.
- Keep answers clear, well-structured with bullet points or numbered steps when appropriate, and supportive.`
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
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

function isTransientOrTimeoutError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    msg.includes('TIMEOUT:') ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('404') ||
    msg.includes('NOT_FOUND') ||
    msg.includes('no longer available') ||
    msg.includes('overloaded') ||
    msg.includes('fetch failed')
  )
}

async function generateWithFallback(
  contents: string,
  systemInstruction: string,
): Promise<string> {
  const models = [
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
  ] as const
  let lastError: unknown = null

  for (const modelName of models) {
    try {
      const ai = getAiClient()
      const response = await withTimeout(
        ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            ...(modelName === 'gemini-3.8-flash'
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          },
        }),
        modelName.includes('lite') ? 20000 : 30000,
        modelName,
      )
      if (response.text) {
        return response.text
      }
    } catch (err) {
      lastError = err
      if (isTransientOrTimeoutError(err)) {
        console.warn(`Model ${modelName} slow/busy, falling back to next available model...`)
        continue
      }
      throw err
    }
  }

  throw lastError ?? new Error('All study assistant models are currently busy.')
}

async function sendMultiTurnChatWithFallback(
  message: string,
  history: ClientChatTurn[],
  systemInstruction: string,
  preferredTier: ChatModelTier,
  language: OutputLanguage,
): Promise<{ reply: string; modelUsed: string }> {
  const modelOrder =
    preferredTier === 'flash-lite'
      ? ([
          'gemini-3.5-flash-lite',
          'gemini-flash-lite-latest',
          'gemini-3.6-flash',
          'gemini-3.5-flash',
          'gemini-3-flash-preview',
          'gemini-3.1-flash-lite',
          'gemini-3.8-flash',
        ] as const)
      : ([
          'gemini-3.6-flash',
          'gemini-3.5-flash',
          'gemini-3-flash-preview',
          'gemini-3.5-flash-lite',
          'gemini-flash-lite-latest',
          'gemini-3.8-flash',
          'gemini-3.1-flash-lite',
        ] as const)

  const formattedHistory = history
    .filter((turn) => turn && typeof turn.text === 'string' && turn.text.trim().length > 0)
    .slice(-24)
    .map((turn) => ({
      role: turn.role === 'model' ? ('model' as const) : ('user' as const),
      parts: [{ text: turn.text.trim().slice(0, 4000) }],
    }))

  const isFirstTurn = formattedHistory.length === 0
  const userSaidSalam = didStudentSaySalam(message)
  const enforcedMessage = `${message}${getTurnLanguageEnforcement(language, isFirstTurn, userSaidSalam)}`

  let lastError: unknown = null

  for (const modelName of modelOrder) {
    try {
      const ai = getAiClient()
      const chat = ai.chats.create({
        model: modelName,
        history: formattedHistory,
        config: {
          systemInstruction,
          ...(modelName === 'gemini-3.8-flash'
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
        },
      })

      const response = await withTimeout(
        chat.sendMessage({ message: enforcedMessage }),
        modelName.includes('lite') ? 20000 : 30000,
        modelName,
      )

      if (response.text) {
        return {
          reply: response.text,
          modelUsed: modelName,
        }
      }
    } catch (err) {
      lastError = err
      if (isTransientOrTimeoutError(err)) {
        console.warn(`Chat model ${modelName} slow/busy, falling back immediately...`)
        continue
      }
      throw err
    }
  }

  throw lastError ?? new Error('All Gemini chat models are currently busy.')
}

async function startServer() {
  const app = express()
  const httpServer = createHttpServer(app)
  const PORT = Number(process.env.PORT) || 3000

  app.use(express.json({ limit: '1mb' }))

  app.post('/api/ai/study-assistant', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const { prompt, mode = 'kitab', language = 'ml', studentName } = req.body ?? {}

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        res.status(400).json({ error: 'Please enter a question or Kitab passage to analyze.' })
        return
      }

      const trimmedPrompt = prompt.trim().slice(0, 2000)
      const validMode: StudyMode = ['kitab', 'qa', 'translation', 'dawa'].includes(mode)
        ? mode
        : 'kitab'
      const requestedLanguage: OutputLanguage = ['ml', 'en', 'ar', 'ur', 'es', 'de'].includes(language)
        ? language
        : 'ml'
      const validLanguage: OutputLanguage = isUrduScript(trimmedPrompt) ? 'ur' : requestedLanguage

      const text = await generateWithFallback(
        `${trimmedPrompt}${getTurnLanguageEnforcement(validLanguage)}`,
        buildSystemInstruction(validMode, validLanguage, studentName),
      )

      res.json({
        response: text,
        mode: validMode,
        language: validLanguage,
      })
    } catch (error) {
      console.error('Gemini study assistant error:', error)
      if (isTransientOrTimeoutError(error)) {
        // Use HTTP 429 instead of 503 because Nginx proxy_intercept_errors replaces 502/503/504 with warmup.html
        res.status(429).json({
          error:
            'AI സെർവറിൽ ഇപ്പോൾ തിരക്ക് കൂടുതലാണ്. ദയവായി ഏതാനും നിമിഷങ്ങൾക്ക് ശേഷം വീണ്ടും ശ്രമിക്കുക.',
        })
        return
      }
      const message =
        error instanceof Error ? error.message : 'Failed to generate scholarly response.'
      res.status(500).json({ error: message })
    }
  })

  app.post('/api/ai/chat', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const {
        message,
        history = [],
        role = 'usthad',
        language = 'ml',
        modelTier = 'flash-lite',
        studentName,
        studentClass,
      } = req.body ?? {}

      if (!message || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ error: 'Please enter a message to send to the chatbot.' })
        return
      }

      const cleanMessage = message.trim().slice(0, 2000)
      const validRole: ChatRole = ['usthad', 'academic', 'language', 'campus'].includes(role)
        ? role
        : 'usthad'
      const requestedLanguage: OutputLanguage = ['ml', 'en', 'ar', 'ur', 'es', 'de'].includes(language)
        ? language
        : 'ml'
      // If the user's question itself is written in Urdu script, always respond in Urdu ('ur')
      const validLanguage: OutputLanguage = isUrduScript(cleanMessage) ? 'ur' : requestedLanguage
      const validTier: ChatModelTier = modelTier === 'flash' ? 'flash' : 'flash-lite'
      const safeHistory: ClientChatTurn[] = Array.isArray(history) ? history : []

      const systemInstruction = buildChatbotSystemInstruction(
        validRole,
        validLanguage,
        studentName,
        studentClass,
      )

      const { reply, modelUsed } = await sendMultiTurnChatWithFallback(
        cleanMessage,
        safeHistory,
        systemInstruction,
        validTier,
        validLanguage,
      )

      res.json({
        reply,
        modelUsed,
        role: validRole,
        language: validLanguage,
      })
    } catch (error) {
      console.error('Gemini multi-turn chat error:', error)
      if (isTransientOrTimeoutError(error)) {
        // Use HTTP 429 instead of 503 because Nginx proxy_intercept_errors replaces 502/503/504 with warmup.html
        res.status(429).json({
          error:
            'AI സെർവറിൽ ഇപ്പോൾ തിരക്ക് കൂടുതലാണ് അല്ലെങ്കിൽ മറുപടി തയ്യാറാക്കാൻ സമയമെടുത്തു. ദയവായി ഏതാനും നിമിഷങ്ങൾക്ക് ശേഷം വീണ്ടും ശ്രമിക്കുക.',
        })
        return
      }
      const errMessage =
        error instanceof Error ? error.message : 'Failed to receive reply from Gemini chatbot.'
      res.status(500).json({ error: errMessage })
    }
  })

  app.post('/api/workspace/export-note-pdf', async (req, res) => {
    try {
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing Google Workspace authorization token.' })
        return
      }

      const {
        title = 'ICS Academy Study Note',
        prompt = '',
        response = '',
        studentName = '',
        studentClass = '',
        personaTitle = "Da'wa College Chatbot",
      } = req.body ?? {}

      if (!response || typeof response !== 'string' || !response.trim()) {
        res.status(400).json({ error: 'Note content is required to create a Google Doc.' })
        return
      }

      const safeTitle = String(title).trim().slice(0, 120) || 'ICS Academy Study Note'

      // 1. Create a new Google Docs document
      const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: safeTitle }),
      })

      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}))
        const errMsg =
          (errData as { error?: { message?: string } })?.error?.message ||
          `Google Docs creation failed (${createRes.status})`
        res.status(createRes.status).json({ error: errMsg })
        return
      }

      const createdDoc = (await createRes.json()) as { documentId: string; title: string }
      const documentId = createdDoc.documentId

      // 2. Insert formatted study note content into the Google Doc via batchUpdate
      const dateStr = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })

      const headerBlock = `ICS ACADEMY — DA'WA COLLEGE STUDY NOTE\n`
      const metaBlock = `Student: ${studentName || 'Student'}${studentClass ? ` | Class: ${studentClass}` : ''} | Date: ${dateStr}\nMentor: ${personaTitle}\n------------------------------------------------------------\n\n`
      const questionBlock = prompt ? `Question / Topic:\n${String(prompt).trim()}\n\n` : ''
      const answerBlock = `Study Note:\n${String(response).trim()}\n`
      const fullBodyText = `${headerBlock}${metaBlock}${questionBlock}${answerBlock}`

      const updateRes = await fetch(
        `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                insertText: {
                  location: { index: 1 },
                  text: fullBodyText,
                },
              },
            ],
          }),
        },
      )

      if (!updateRes.ok) {
        const errData = await updateRes.json().catch(() => ({}))
        const errMsg =
          (errData as { error?: { message?: string } })?.error?.message ||
          `Failed to populate Google Doc (${updateRes.status})`
        res.status(updateRes.status).json({ error: errMsg })
        return
      }

      // 3. Export the Google Doc as a PDF via Google Drive API
      const exportRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(documentId)}/export?mimeType=application/pdf`,
        {
          method: 'GET',
          headers: {
            Authorization: authHeader,
          },
        },
      )

      if (!exportRes.ok) {
        const errText = await exportRes.text().catch(() => '')
        res.status(exportRes.status).json({
          error: `Google Drive PDF export failed (${exportRes.status}): ${errText.slice(0, 200)}`,
          documentId,
          docUrl: `https://docs.google.com/document/d/${documentId}/edit`,
        })
        return
      }

      const pdfBuffer = Buffer.from(await exportRes.arrayBuffer())
      res.json({
        documentId,
        title: safeTitle,
        docUrl: `https://docs.google.com/document/d/${documentId}/edit`,
        pdfBase64: pdfBuffer.toString('base64'),
      })
    } catch (error) {
      console.error('Google Docs PDF export error:', error)
      const message =
        error instanceof Error ? error.message : 'Failed to export study note via Google Docs.'
      res.status(500).json({ error: message })
    }
  })

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distPath = path.join(__dirname, 'dist')
    app.use(express.static(distPath))
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'))
    })
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`ICS Academy server running on http://localhost:${PORT}`)
  })
}

void startServer()
