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

interface ClientChatAttachment {
  mimeType: string
  data: string
  name?: string
}

interface ClientChatTurn {
  role: 'user' | 'model'
  text: string
}

function isUrduScript(text: string): boolean {
  if (!text) return false
  if (/[\u0D00-\u0D7F]{2,}/.test(text)) return false
  return (
    /[\u0679\u067E\u0686\u0688\u0691\u0698\u06AF\u06BA\u06BE\u06C1\u06C2\u06C3\u06D2\u06D4]/.test(
      text,
    ) ||
    /(?:^|\s)(?:کیا|کیوں|کیسے|ہے|ہیں|میں|کو|سے|پر|اور|کا|کی|کے)(?:\s|$|[۔،؟!])/.test(text)
  )
}

function detectInputLanguage(
  text: string,
  fallbackLanguage: OutputLanguage,
  history?: ClientChatTurn[],
): OutputLanguage {
  if (!text || !text.trim()) return fallbackLanguage
  const clean = text.trim()

  // 1. If the user writes any Malayalam characters, always respond in Malayalam ('ml')
  if (/[\u0D00-\u0D7F]/.test(clean)) {
    return 'ml'
  }

  // 2. If the user writes Urdu-specific script/words, respond in Urdu ('ur')
  if (isUrduScript(clean)) {
    return 'ur'
  }

  // 3. Check Arabic vs Latin character counts (ignoring quoted Arabic passages and standalone Salam greetings)
  const stripped = clean
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(
      /(?:^|\s)(?:وعليكم\s+السلام|السلام\s+عليكم|سلام\s+عليكم|ورحمة\s+الله|وبركاته|بسم\s+الله\s+الرحمن\s+الرحيم)(?=\s|$|[،.؟!])/g,
      ' ',
    )
    .trim()
  const withoutQuotes = stripped
    .replace(/["“”«»'‘’][^"“”«»'‘’]{4,}["“”«»'‘’]/g, ' ')
    .trim()
  const targetForScriptCheck = withoutQuotes.length >= 4 ? withoutQuotes : stripped

  const arabicChars = (
    targetForScriptCheck.match(
      /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g,
    ) || []
  ).length
  const latinChars = (targetForScriptCheck.match(/[A-Za-z\u00C0-\u024F]/g) || []).length

  if (arabicChars > 0 && arabicChars > latinChars) {
    if (history && history.length > 0) {
      const recentTurns = history.slice(-4)
      for (let i = recentTurns.length - 1; i >= 0; i--) {
        const turnText = recentTurns[i]?.text || ''
        if (/[\u0D00-\u0D7F]{3,}/.test(turnText)) {
          return 'ml'
        }
        if (isUrduScript(turnText)) {
          return 'ur'
        }
        const turnLatin = (turnText.match(/[A-Za-z\u00C0-\u024F]/g) || []).length
        const turnArabic = (
          turnText.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) ||
          []
        ).length
        if (turnLatin >= 12 && turnLatin > turnArabic * 2) {
          if (fallbackLanguage === 'es' || fallbackLanguage === 'de' || fallbackLanguage === 'en') {
            return fallbackLanguage
          }
          return 'en'
        }
      }
    }
    return 'ar'
  }

  // 4. If written in Latin script (English / Spanish / German / Manglish)
  const totalLatinChars = (stripped.match(/[A-Za-z\u00C0-\u024F]/g) || []).length
  if (totalLatinChars >= 2) {
    if (
      /\b(enthanu|enthokkeyanu|enthokke|parayamo|parayu|engane|enganeyanu|vishadeekarikamo|vishadeekarikkuka|artham|sharthukal|farzukal|sunnathukal|vivarikkuka|entha|manassilayilla|padippikkamo|chodyam|utharam|malayalathil|paribhasha|sughamano|sugamano|namaskaram|niskaram|usthade|orennam|onnu|randu|moonnu|shariyano|athe|alla)\b/i.test(
        clean,
      )
    ) {
      return 'ml'
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
    // If short reply and previous turn in history was in Malayalam/Urdu, preserve thread language
    if (clean.length <= 24 && history && history.length > 0) {
      const lastTurn = history[history.length - 1]?.text || ''
      if (/[\u0D00-\u0D7F]{3,}/.test(lastTurn)) return 'ml'
      if (isUrduScript(lastTurn)) return 'ur'
    }
    return 'en'
  }

  return fallbackLanguage
}

function isResponseValidForLanguage(text: string, _language: OutputLanguage): boolean {
  return Boolean(text && text.trim().length > 0)
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
  isExplicitLanguage = false,
): string {
  const salamRule = getSalamTurnDirective(isFirstTurn, userSaidSalam)
  const modePrefix = isExplicitLanguage
    ? 'EXPLICIT RESPONSE LANGUAGE SELECTED BY USER (Even if the question or attached image text above is in another language, the user has explicitly selected this target language for the reply — you MUST write your explanation/translation in this selected language ONLY!): '
    : 'AUTO-DETECTED QUESTION LANGUAGE (Reply in the requested target language): '

  const followUpRule =
    'FOLLOW-UP & CONVERSATION RULE: Answer the exact message the student sent! If the student says "ഹായ്" / "Hi" / "Hello" / "Salam", greet them warmly and briefly in 2-3 sentences and ask what topic or Kitab they want to study. If your previous message ended with a follow-up question or quiz question and the student is now answering that question, DO NOT treat their answer as a new question — evaluate their answer directly (e.g., "മാശാ അല്ലാഹ്! താങ്കളുടെ ഉത്തരം വളരെ കൃത്യമാണ്..." / "Masha\'Allah, your answer is correct!"), explain why, and continue naturally.'

  switch (language) {
    case 'ur':
      return `\n\n[LANGUAGE & CONVERSATION INSTRUCTION — ${modePrefix}${salamRule} ${followUpRule} Write your explanation in URDU (اردو) language. Refer to the institution in Urdu as "آئی سی ایس اکیڈمی" (ICS Academy). Keep quoted Quranic Ayahs, Hadith, Islamic greetings (السَّلَامُ عَلَيْكُمْ / وَعَلَيْكُمُ السَّلَامُ), and Kitab Ibarats in Arabic script, and explain everything else in Urdu (اردو).]`
    case 'ml':
      return `\n\n[LANGUAGE & CONVERSATION INSTRUCTION — ${modePrefix}${salamRule} ${followUpRule} Write your explanation, translation, salutation, headings, and follow-up questions in natural, scholarly MALAYALAM (മലയാളം) script! Keep Islamic greetings (السَّلَامُ عَلَيْكُمْ / وَعَلَيْكُمُ السَّلَامُ), quoted Quran/Hadith/Kitab Ibarats, and Arabic Fiqh/Nahw terms inside brackets in Arabic script. Refer to the institution in Malayalam as "ഐ.സി.എസ് അക്കാദമി".]`
    case 'ar':
      return `\n\n[LANGUAGE & CONVERSATION INSTRUCTION — ${modePrefix}${salamRule} ${followUpRule} Respond in clear Classical/Modern Standard Arabic (العربية الفصحى). Refer to the institution as "أكاديمية ICS".]`
    case 'es':
      return `\n\n[LANGUAGE & CONVERSATION INSTRUCTION — ${modePrefix}${salamRule} ${followUpRule} Respond in Spanish (Español). Refer to the institution as "ICS Academy".]`
    case 'de':
      return `\n\n[LANGUAGE & CONVERSATION INSTRUCTION — ${modePrefix}${salamRule} ${followUpRule} Respond in German (Deutsch). Refer to the institution as "ICS Academy".]`
    case 'en':
    default:
      return `\n\n[LANGUAGE & CONVERSATION INSTRUCTION — ${modePrefix}${salamRule} ${followUpRule} Respond in clear academic English (and if the student explicitly asked to translate into Malayalam or another language, include that requested translation clearly!). Present key Arabic terms with their vocalized Arabic script inside brackets (...) beside the English term. Always write the Salam itself in Arabic script (السَّلَامُ عَلَيْكُمْ or وَعَلَيْكُمُ السَّلَامُ) on its own line.]`
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
Break down complex Ibarats step by step, read and translate photos of Kitab pages accurately, remember earlier questions in the conversation, and ask thoughtful follow-up reflection questions to deepen the student's mastery.`,
    academic: `Role: Academic & Exam Tutor at ICS Academy.
You help Da'wa College students master integrated Islamic and modern academic subjects (Humanities, Commerce, History, English, Sociology, Science, Mathematics, Islamic History).
Read uploaded textbook pages, handwritten notes, diagrams, or question papers, and provide structured exam-ready points, memory aids, timelines, and multi-turn revision quizzes.`,
    language: `Role: Multilingual Language Coach (Arabic · English · Malayalam · Urdu · Spanish · German) at ICS Academy.
You coach students in Arabic conversation (Muhadathah), academic English, Malayalam, Urdu (اردو), Spanish (Español), and German (Deutsch) conversation, writing, and scholarly translation (including translating photos of book pages, signs, or notes).
Correct grammar gently, highlight root letters (Maddah) and vocabulary (Mufradat), and encourage the student to reply in the target language.`,
    campus: `Role: Campus & Da'wa Advisor at ICS Academy.
You guide students on Da'wa speech preparation (Khutbah/elocution), essay writing, study timetables, Digital Library Kitab recommendations, and holistic spiritual-academic routines.`,
  }

  return `You are the official Multi-Turn Multimodal Scholarly Chatbot for ICS Academy (Islamic Centre Sunniyya, Manhappatta — Da'wa College).
Student: ${studentName || "Da'wa College Scholar"}${studentClass ? ` (Class ${studentClass})` : ''}
${rolePersonas[role] || rolePersonas.usthad}

Multimodal Image & Document Capabilities (Kitabs, Textbooks, Notes & Translation):
- When the student attaches a photo or PDF of a Kitab page, Arabic text, textbook page, handwritten notes, diagram, or exam paper:
  1. Accurately read/transcribe the relevant text from the image (including vocalized Arabic script, Malayalam, English, or Urdu).
  2. Perform the requested task thoroughly: translate into the target language, explain word-by-word meanings (Mufradat), analyze Nahw/Sarf/I'rab grammar, explain Fiqh/academic concepts, or solve the exam questions shown.

Strict Institutional & Educational Scope (CRITICAL):
- You are exclusively dedicated to educational, academic, linguistic, Islamic scholarly (Kitab/Fiqh/Tafsir/Hadith/Nahw/Sarf/Da'wa), and ICS Academy institutional matters.
- If a student uploads an image or asks a question that is clearly non-educational or inappropriate (such as movies, cinema/celebrity gossip, video games, entertainment trivia, or off-topic chat unrelated to learning or ICS Academy), politely decline in the target response language and remind the student that this platform is exclusively for ICS Academy educational, linguistic, and scholarly studies.

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
  language: OutputLanguage = 'ml',
): Promise<string> {
  const models = [
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-lite-latest',
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
        if (!isResponseValidForLanguage(response.text, language)) {
          console.warn(`Model ${modelName} returned wrong script for ${language}, retrying next model...`)
          continue
        }
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
  isExplicitLanguage = false,
  attachments: ClientChatAttachment[] = [],
): Promise<{ reply: string; modelUsed: string }> {
  const modelOrder =
    preferredTier === 'flash-lite'
      ? ([
          'gemini-3.1-flash-lite',
          'gemini-3.1-flash-lite-preview',
          'gemini-3.8-flash',
          'gemini-3-flash-preview',
          'gemini-2.5-flash-lite',
          'gemini-2.5-flash',
          'gemini-flash-lite-latest',
        ] as const)
      : ([
          'gemini-3.8-flash',
          'gemini-3-flash-preview',
          'gemini-3.1-flash-lite',
          'gemini-3.1-flash-lite-preview',
          'gemini-2.5-flash',
          'gemini-2.5-flash-lite',
          'gemini-flash-lite-latest',
        ] as const)

  // Preserve full multi-turn conversation history so follow-up answers to Usthad questions always have context
  const sanitizedHistory = history
    .filter((turn) => Boolean(turn && typeof turn.text === 'string' && turn.text.trim()))
    .slice(-16)
    .map((turn) => ({
      role: turn.role === 'model' ? ('model' as const) : ('user' as const),
      parts: [{ text: turn.text.trim().slice(0, 4000) }],
    }))

  const validAttachments = Array.isArray(attachments)
    ? attachments
        .filter(
          (att) =>
            att &&
            typeof att.data === 'string' &&
            att.data.trim().length > 0 &&
            typeof att.mimeType === 'string',
        )
        .slice(0, 3)
        .map((att) => ({
          inlineData: {
            mimeType: att.mimeType.split(';')[0].trim() || 'image/jpeg',
            data: att.data.replace(/^data:[^;]+;base64,/, '').trim(),
          },
        }))
    : []

  const isFirstTurn = sanitizedHistory.length === 0
  const userSaidSalam = didStudentSaySalam(message)
  const enforcedMessage = `${message}${getTurnLanguageEnforcement(language, isFirstTurn, userSaidSalam, isExplicitLanguage)}`

  let lastError: unknown = null

  for (const modelName of modelOrder) {
    try {
      const ai = getAiClient()
      let responseText: string | undefined

      if (validAttachments.length > 0) {
        const multimodalContents = [
          ...sanitizedHistory,
          {
            role: 'user' as const,
            parts: [...validAttachments, { text: enforcedMessage }],
          },
        ]
        const response = await withTimeout(
          ai.models.generateContent({
            model: modelName,
            contents: multimodalContents,
            config: {
              systemInstruction,
              ...(modelName === 'gemini-3.8-flash'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          }),
          35000,
          modelName,
        )
        responseText = response.text
      } else {
        const chat = ai.chats.create({
          model: modelName,
          history: sanitizedHistory,
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
        responseText = response.text
      }

      if (responseText) {
        if (!isResponseValidForLanguage(responseText, language)) {
          console.warn(
            `Chat model ${modelName} returned mismatched language script for '${language}', trying next model...`,
          )
          continue
        }
        return {
          reply: responseText,
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

  app.use(express.json({ limit: '25mb' }))

  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'microphone=*, camera=*, autoplay=*')
    next()
  })

  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin
    res.setHeader('Access-Control-Allow-Origin', origin || '*')
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Accept, X-Requested-With',
    )
    if (req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }
    next()
  })

  app.post('/api/ai/study-assistant', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const {
        prompt,
        mode = 'kitab',
        language = 'en',
        languageMode = 'auto',
        studentName,
      } = req.body ?? {}

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
        : 'en'
      const isExplicitLanguage = languageMode === 'explicit'
      const validLanguage: OutputLanguage = isExplicitLanguage
        ? requestedLanguage
        : detectInputLanguage(trimmedPrompt, requestedLanguage)

      const text = await generateWithFallback(
        `${trimmedPrompt}${getTurnLanguageEnforcement(validLanguage, true, didStudentSaySalam(trimmedPrompt), isExplicitLanguage)}`,
        buildSystemInstruction(validMode, validLanguage, studentName),
        validLanguage,
      )

      res.json({
        response: text,
        mode: validMode,
        language: validLanguage,
      })
    } catch (error) {
      console.error('Gemini study assistant error:', error)
      if (isTransientOrTimeoutError(error)) {
        res.status(429).json({
          error:
            'The AI server is currently busy. Please try again in a few moments.',
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
        message = '',
        history = [],
        role = 'usthad',
        language = 'en',
        languageMode = 'auto',
        modelTier = 'flash-lite',
        studentName,
        studentClass,
        attachments = [],
      } = req.body ?? {}

      const hasAttachments = Array.isArray(attachments) && attachments.length > 0
      const rawMessage = typeof message === 'string' ? message.trim() : ''

      if (!rawMessage && !hasAttachments) {
        res.status(400).json({ error: 'Please enter a message or attach a study image/document.' })
        return
      }

      const defaultAttachmentPrompt =
        language === 'ml'
          ? 'ഈ ചിത്രത്തിലെ കിതാബ് ഭാഗം / പഠന വിഷയം വായിച്ച് മലയാളത്തിലേക്ക് വിവർത്തനം ചെയ്യുകയും പ്രധാന ആശയങ്ങൾ വിശദീകരിക്കുകയും ചെയ്യുക.'
          : 'Please examine this educational image/document, transcribe the key text, translate it clearly, and explain its scholarly meaning and key takeaways.'

      const cleanMessage = (rawMessage || defaultAttachmentPrompt).slice(0, 3000)
      const validRole: ChatRole = ['usthad', 'academic', 'language', 'campus'].includes(role)
        ? role
        : 'usthad'
      const requestedLanguage: OutputLanguage = ['ml', 'en', 'ar', 'ur', 'es', 'de'].includes(language)
        ? language
        : 'en'
      const isExplicitLanguage = languageMode === 'explicit'
      const validTier: ChatModelTier = modelTier === 'flash' ? 'flash' : 'flash-lite'
      const safeHistory: ClientChatTurn[] = Array.isArray(history) ? history : []
      const validLanguage: OutputLanguage = isExplicitLanguage
        ? requestedLanguage
        : rawMessage
          ? detectInputLanguage(cleanMessage, requestedLanguage, safeHistory)
          : requestedLanguage

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
        isExplicitLanguage,
        attachments,
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
        res.status(429).json({
          error:
            'The AI server is currently busy or timed out. Please try again in a few moments.',
        })
        return
      }
      const errMessage =
        error instanceof Error ? error.message : 'Failed to receive reply from Gemini chatbot.'
      res.status(500).json({ error: errMessage })
    }
  })

  app.post('/api/ai/transcribe', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
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

      // Fast Path 1: Live SpeechRecognition phonetic/script auto-resolver (~300ms)
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

        const fastTextModels = [
          'gemini-3.1-flash-lite',
          'gemini-3.1-flash-lite-preview',
          'gemini-3.8-flash',
          'gemini-2.5-flash-lite',
          'gemini-2.5-flash',
        ] as const

        for (const modelName of fastTextModels) {
          try {
            const ai = getAiClient()
            const response = await withTimeout(
              ai.models.generateContent({
                model: modelName,
                contents: scriptPrompt,
                ...(modelName === 'gemini-3.8-flash'
                  ? { config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } }
                  : {}),
              }),
              6000,
              modelName,
            )
            if (typeof response.text === 'string' && response.text.trim()) {
              res.json({
                text: response.text
                  .trim()
                  .replace(/^["'“”]+|["'“”]+$/g, '')
                  .trim(),
              })
              return
            }
          } catch {
            continue
          }
        }

        res.json({ text: cleanSpoken })
        return
      }

      // Fast Path 2: Multimodal Audio Blob Transcription
      if (!audioBase64 || typeof audioBase64 !== 'string') {
        res.status(200).json({ text: '' })
        return
      }

      const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '').trim()
      const cleanMime = String(mimeType || 'audio/webm').split(';')[0].trim() || 'audio/webm'

      const promptText = `Listen carefully to this audio clip from an ICS Academy student.
1. If the audio is silent, contains only background noise/clicks, or has no clear human speech, output ONLY the exact token: __SILENT__
2. Do NOT invent, guess, or hallucinate any words if no one is speaking.
3. CRITICAL: Do NOT translate the speech into English! Transcribe the spoken words verbatim in ${langHint}. Never transliterate Malayalam, Arabic, or Urdu speech into English/Latin letters. Output ONLY the transcribed text itself with no quotes, prefixes, or commentary.`

      const transcribeModels = [
        'gemini-3.1-flash-lite',
        'gemini-3.5-transcribe',
        'gemini-3.8-flash',
        'gemini-3.1-flash-lite-preview',
        'gemini-3-flash-preview',
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash',
      ] as const

      let transcript = ''
      for (const modelName of transcribeModels) {
        try {
          const ai = getAiClient()
          const response = await withTimeout(
            ai.models.generateContent({
              model: modelName,
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      inlineData: {
                        mimeType: cleanMime,
                        data: cleanBase64,
                      },
                    },
                    { text: promptText },
                  ],
                },
              ],
              ...(modelName === 'gemini-3.8-flash'
                ? { config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } }
                : {}),
            }),
            8000,
            modelName,
          )
          if (typeof response.text === 'string') {
            const raw = response.text.trim()
            if (raw.includes('__SILENT__') || /^["'\s]*$/.test(raw)) {
              transcript = ''
            } else {
              transcript = raw.replace(/^["'“”]+|["'“”]+$/g, '').trim()
            }
            break
          }
        } catch {
          continue
        }
      }

      res.json({ text: transcript })
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : 'Failed to transcribe voice input.'
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

  // Real-time Campus Sync & Notifications State (Notices, Attendance, Period Attendance, Notifications)
  interface ServerCampusNotification {
    id: string
    type: 'notice' | 'attendance' | 'period-attendance' | 'leave'
    title: string
    message: string
    category?: string
    targetClass?: string
    targetClasses?: string[]
    targetStudentId?: string
    actorName?: string
    href?: string
    createdAt: string
    createdAtMs: number
  }

  interface ServerCampusState {
    updatedAtMs: number
    customNotices: unknown[] | null
    attendanceOverrides: Record<string, unknown> | null
    periodSubmissions: Record<string, unknown> | null
    notifications: ServerCampusNotification[]
  }

  const campusState: ServerCampusState = {
    updatedAtMs: Date.now(),
    customNotices: null,
    attendanceOverrides: null,
    periodSubmissions: null,
    notifications: [],
  }

  app.get('/api/campus/state', (_req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.json(campusState)
  })

  app.post('/api/campus/sync', (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const {
        customNotices,
        attendanceOverrides,
        periodSubmissions,
        notification,
      } = req.body ?? {}

      if (Array.isArray(customNotices)) {
        campusState.customNotices = customNotices.slice(0, 100)
        campusState.updatedAtMs = Date.now()
      }

      if (attendanceOverrides && typeof attendanceOverrides === 'object') {
        campusState.attendanceOverrides = {
          ...(campusState.attendanceOverrides || {}),
          ...(attendanceOverrides as Record<string, unknown>),
        }
        campusState.updatedAtMs = Date.now()
      }

      if (periodSubmissions && typeof periodSubmissions === 'object') {
        campusState.periodSubmissions = {
          ...(campusState.periodSubmissions || {}),
          ...(periodSubmissions as Record<string, unknown>),
        }
        campusState.updatedAtMs = Date.now()
      }

      if (notification && typeof notification === 'object' && notification.title) {
        const incomingNotif = notification as ServerCampusNotification
        const safeId =
          typeof incomingNotif.id === 'string' && incomingNotif.id
            ? incomingNotif.id
            : `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        const exists = campusState.notifications.some((n) => n.id === safeId)
        if (!exists) {
          campusState.notifications = [
            {
              id: safeId,
              type: incomingNotif.type || 'notice',
              title: String(incomingNotif.title).slice(0, 180),
              message: String(incomingNotif.message || '').slice(0, 500),
              category: incomingNotif.category,
              targetClass: incomingNotif.targetClass,
              targetClasses: Array.isArray(incomingNotif.targetClasses)
                ? incomingNotif.targetClasses
                : undefined,
              targetStudentId: incomingNotif.targetStudentId,
              actorName: incomingNotif.actorName,
              href: incomingNotif.href || '#notices',
              createdAt: incomingNotif.createdAt || new Date().toISOString(),
              createdAtMs: Number(incomingNotif.createdAtMs) || Date.now(),
            },
            ...campusState.notifications,
          ].slice(0, 60)
          campusState.updatedAtMs = Date.now()
        }
      }

      res.json({ ok: true, state: campusState })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Sync failed' })
    }
  })

  // Real-Time WhatsApp-Style Campus Messenger State (Rooms, Messages, Presence, Typing, Moderation)
  interface ServerChatReplyRef {
    messageId: string
    senderName: string
    previewText: string
  }

  interface ServerChatMessage {
    id: string
    roomId: string
    senderId: string
    senderName: string
    senderRole: 'student' | 'usthad' | 'principal'
    senderBadge?: string
    text: string
    mediaType: 'none' | 'voice' | 'image' | 'pdf'
    mediaUrl?: string
    mediaName?: string
    mediaSizeLabel?: string
    mediaDurationSec?: number
    replyTo?: ServerChatReplyRef
    reactions: Record<string, string[]>
    readBy: string[]
    isDeleted?: boolean
    deletedBy?: string
    createdAt: string
    createdAtMs: number
  }

  interface ServerChatRoomMeta {
    roomId: string
    onlyAdminsCanPost: boolean
    pinnedMessageId: string | null
    updatedAtMs: number
  }

  interface ServerPresenceEntry {
    actorId: string
    actorName: string
    actorRole: 'student' | 'usthad' | 'principal'
    lastSeenMs: number
  }

  interface ServerTypingEntry {
    actorId: string
    actorName: string
    mode: 'typing' | 'recording' | 'idle'
    updatedAtMs: number
  }

  interface ServerCampusChatState {
    updatedAtMs: number
    roomsMeta: Record<string, ServerChatRoomMeta>
    messagesByRoom: Record<string, ServerChatMessage[]>
    presenceMap: Record<string, ServerPresenceEntry>
    typingMap: Record<string, Record<string, ServerTypingEntry>>
  }

  const campusChatState: ServerCampusChatState = {
    updatedAtMs: Date.now(),
    roomsMeta: {},
    messagesByRoom: {},
    presenceMap: {},
    typingMap: {},
  }

  app.get('/api/campus/chat/state', (_req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    // Clean up stale typing indicators older than 8 seconds
    const now = Date.now()
    for (const rId of Object.keys(campusChatState.typingMap)) {
      const roomTyping = campusChatState.typingMap[rId]
      if (!roomTyping) continue
      for (const aId of Object.keys(roomTyping)) {
        if (now - roomTyping[aId].updatedAtMs > 8000 || roomTyping[aId].mode === 'idle') {
          delete roomTyping[aId]
        }
      }
    }
    res.json(campusChatState)
  })

  app.post('/api/campus/chat/action', (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const {
        action,
        roomId,
        actorId,
        actorName,
        actorRole,
        message,
        messageId,
        emoji,
        onlyAdminsCanPost,
        pinnedMessageId,
        typingMode,
      } = req.body ?? {}

      const now = Date.now()

      if (actorId && typeof actorId === 'string') {
        campusChatState.presenceMap[actorId] = {
          actorId,
          actorName: String(actorName || 'Campus Member').slice(0, 120),
          actorRole:
            actorRole === 'principal' || actorRole === 'usthad' ? actorRole : 'student',
          lastSeenMs: now,
        }
      }

      if (action === 'heartbeat') {
        if (roomId && typeof roomId === 'string' && actorId && typeof actorId === 'string') {
          if (!campusChatState.typingMap[roomId]) {
            campusChatState.typingMap[roomId] = {}
          }
          if (typingMode === 'typing' || typingMode === 'recording') {
            campusChatState.typingMap[roomId][actorId] = {
              actorId,
              actorName: String(actorName || 'Member').slice(0, 80),
              mode: typingMode,
              updatedAtMs: now,
            }
          } else {
            delete campusChatState.typingMap[roomId][actorId]
          }
        }
        res.json({ ok: true, state: campusChatState })
        return
      }

      if (!roomId || typeof roomId !== 'string') {
        res.status(400).json({ error: 'roomId is required' })
        return
      }

      if (!campusChatState.roomsMeta[roomId]) {
        campusChatState.roomsMeta[roomId] = {
          roomId,
          onlyAdminsCanPost: false,
          pinnedMessageId: null,
          updatedAtMs: now,
        }
      }

      if (!Array.isArray(campusChatState.messagesByRoom[roomId])) {
        campusChatState.messagesByRoom[roomId] = []
      }

      if (action === 'send_message' && message && typeof message === 'object') {
        const roomMeta = campusChatState.roomsMeta[roomId]
        const isStaff = actorRole === 'usthad' || actorRole === 'principal'
        if (roomMeta.onlyAdminsCanPost && !isStaff) {
          res.status(403).json({
            error: 'Only Usthads and Principal can send messages in this group right now.',
          })
          return
        }

        const msgId =
          typeof message.id === 'string' && message.id
            ? message.id
            : `msg_${now}_${Math.random().toString(36).slice(2, 7)}`

        const existingIdx = campusChatState.messagesByRoom[roomId].findIndex(
          (m) => m.id === msgId,
        )
        if (existingIdx === -1) {
          const newMsg: ServerChatMessage = {
            id: msgId,
            roomId,
            senderId: String(message.senderId || actorId || 'unknown').slice(0, 120),
            senderName: String(message.senderName || actorName || 'Member').slice(0, 120),
            senderRole:
              message.senderRole === 'principal' || message.senderRole === 'usthad'
                ? message.senderRole
                : 'student',
            senderBadge: message.senderBadge ? String(message.senderBadge).slice(0, 80) : undefined,
            text: String(message.text || '').slice(0, 4000),
            mediaType: ['none', 'voice', 'image', 'pdf'].includes(message.mediaType)
              ? message.mediaType
              : 'none',
            mediaUrl: message.mediaUrl ? String(message.mediaUrl) : undefined,
            mediaName: message.mediaName ? String(message.mediaName).slice(0, 180) : undefined,
            mediaSizeLabel: message.mediaSizeLabel
              ? String(message.mediaSizeLabel).slice(0, 40)
              : undefined,
            mediaDurationSec:
              typeof message.mediaDurationSec === 'number' ? message.mediaDurationSec : undefined,
            replyTo:
              message.replyTo && typeof message.replyTo === 'object'
                ? {
                    messageId: String(message.replyTo.messageId || ''),
                    senderName: String(message.replyTo.senderName || '').slice(0, 100),
                    previewText: String(message.replyTo.previewText || '').slice(0, 200),
                  }
                : undefined,
            reactions:
              message.reactions && typeof message.reactions === 'object'
                ? message.reactions
                : {},
            readBy: Array.isArray(message.readBy)
              ? message.readBy
              : [String(message.senderId || actorId || '')],
            isDeleted: false,
            createdAt: message.createdAt || new Date(now).toISOString(),
            createdAtMs: Number(message.createdAtMs) || now,
          }
          campusChatState.messagesByRoom[roomId] = [
            ...campusChatState.messagesByRoom[roomId],
            newMsg,
          ].slice(-150)
          campusChatState.roomsMeta[roomId].updatedAtMs = now
          campusChatState.updatedAtMs = now
        }

        if (actorId && campusChatState.typingMap[roomId]) {
          delete campusChatState.typingMap[roomId][actorId]
        }
      } else if (action === 'toggle_reaction' && messageId && emoji && actorId) {
        const list = campusChatState.messagesByRoom[roomId] || []
        const target = list.find((m) => m.id === messageId)
        if (target && !target.isDeleted) {
          const safeEmoji = String(emoji).slice(0, 12)
          const currentReactors = Array.isArray(target.reactions[safeEmoji])
            ? target.reactions[safeEmoji]
            : []
          if (currentReactors.includes(actorId)) {
            target.reactions[safeEmoji] = currentReactors.filter((id) => id !== actorId)
            if (target.reactions[safeEmoji].length === 0) {
              delete target.reactions[safeEmoji]
            }
          } else {
            target.reactions[safeEmoji] = [...currentReactors, actorId]
          }
          campusChatState.updatedAtMs = now
        }
      } else if (action === 'mark_read' && actorId) {
        const list = campusChatState.messagesByRoom[roomId] || []
        let changed = false
        for (const msg of list) {
          if (!Array.isArray(msg.readBy)) msg.readBy = []
          if (!msg.readBy.includes(actorId)) {
            msg.readBy.push(actorId)
            changed = true
          }
        }
        if (changed) {
          campusChatState.updatedAtMs = now
        }
      } else if (action === 'toggle_pin') {
        const isStaff = actorRole === 'usthad' || actorRole === 'principal'
        if (isStaff) {
          campusChatState.roomsMeta[roomId].pinnedMessageId =
            typeof pinnedMessageId === 'string' && pinnedMessageId ? pinnedMessageId : null
          campusChatState.roomsMeta[roomId].updatedAtMs = now
          campusChatState.updatedAtMs = now
        }
      } else if (action === 'delete_message' && messageId) {
        const list = campusChatState.messagesByRoom[roomId] || []
        const target = list.find((m) => m.id === messageId)
        const isStaff = actorRole === 'usthad' || actorRole === 'principal'
        if (target && (isStaff || target.senderId === actorId)) {
          target.isDeleted = true
          target.deletedBy = String(actorName || (isStaff ? 'Usthad' : 'Sender')).slice(0, 80)
          target.text = ''
          target.mediaType = 'none'
          target.mediaUrl = undefined
          if (campusChatState.roomsMeta[roomId].pinnedMessageId === messageId) {
            campusChatState.roomsMeta[roomId].pinnedMessageId = null
          }
          campusChatState.updatedAtMs = now
        }
      } else if (action === 'toggle_group_lock') {
        const isStaff = actorRole === 'usthad' || actorRole === 'principal'
        if (isStaff) {
          campusChatState.roomsMeta[roomId].onlyAdminsCanPost = Boolean(onlyAdminsCanPost)
          campusChatState.roomsMeta[roomId].updatedAtMs = now
          campusChatState.updatedAtMs = now
        }
      }

      res.json({ ok: true, state: campusChatState })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Chat action failed' })
    }
  })

  app.get('/api/app/version', async (_req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    try {
      let version = '1.0.6'
      let buildNumber = 6
      let publishedAt = new Date().toISOString()

      try {
        const fs = await import('fs')
        const versionFilePath = path.join(__dirname, 'public', 'version.json')
        if (fs.existsSync(versionFilePath)) {
          const parsed = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'))
          if (parsed.version) version = String(parsed.version)
          if (parsed.buildNumber) buildNumber = Number(parsed.buildNumber)
          if (parsed.builtAt) publishedAt = String(parsed.builtAt)
        }
      } catch {
        // Ignore local read error
      }

      try {
        const ghOwner = ['sinanedayur85', 'prog'].join('-')
        const ghRepo = 'ics-academy-portal'
        const ghRes = await fetch(
          `https://api.github.com/repos/${ghOwner}/${ghRepo}/releases/tags/latest-apk`,
          {
            headers: {
              Accept: 'application/vnd.github+json',
              'User-Agent': 'ics-academy-portal',
            },
          },
        )
        if (ghRes.ok) {
          const releaseData = (await ghRes.json()) as {
            body?: string
            published_at?: string
          }
          const bodyText = releaseData?.body || ''
          const buildMatch = bodyText.match(/Build\s*#(\d+)/i)
          const versionMatch = bodyText.match(/Version:\s*([0-9.]+)/i)
          if (buildMatch) {
            const remoteBuild = Number(buildMatch[1])
            if (remoteBuild >= buildNumber) {
              buildNumber = remoteBuild
              version = versionMatch ? versionMatch[1] : `1.0.${remoteBuild}`
              publishedAt = releaseData?.published_at || publishedAt
            }
          }
        }
      } catch {
        // Return local server version if offline
      }

      res.json({
        version,
        buildNumber,
        publishedAt,
      })
    } catch {
      res.json({
        version: '1.0.6',
        buildNumber: 6,
        publishedAt: new Date().toISOString(),
      })
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

  httpServer.on('error', (err) => {
    console.error('HTTP server error:', err)
  })

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`ICS Academy server running on http://localhost:${PORT}`)
  })
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
})

startServer().catch((err) => {
  console.error('Failed to start server:', err)
})

