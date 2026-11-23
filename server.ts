import 'dotenv/config'
import { spawn } from 'child_process'
import express from 'express'
import { createServer as createHttpServer } from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import { createServer as createViteServer } from 'vite'
import * as webpush from 'web-push'

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

function enforceRespectfulMalayalamPronouns(text: string): string {
  if (!text || !/[\u0D00-\u0D7F]/.test(text)) return text
  const pre = '(^|[\\s,.;:!?()[\\]"\'“”‘’—–-])'
  const post = '(?=$|[\\s,.;:!?()[\\]"\'“”‘’—–-])'
  return text
    .replace(new RegExp(`${pre}നിന്റെ${post}`, 'g'), '$1താങ്കളുടെ')
    .replace(new RegExp(`${pre}നിനക്ക്${post}`, 'g'), '$1താങ്കൾക്ക്')
    .replace(new RegExp(`${pre}നിനക്കു${post}`, 'g'), '$1താങ്കൾക്ക്')
    .replace(new RegExp(`${pre}നിന്നോട്${post}`, 'g'), '$1താങ്കളോട്')
    .replace(new RegExp(`${pre}നിന്നോടു${post}`, 'g'), '$1താങ്കളോട്')
    .replace(new RegExp(`${pre}നിന്നെ${post}`, 'g'), '$1താങ്കളെ')
    .replace(new RegExp(`${pre}നിന്നിൽ${post}`, 'g'), '$1താങ്കളിൽ')
    .replace(new RegExp(`${pre}നിങ്ങളുടെ${post}`, 'g'), '$1താങ്കളുടെ')
    .replace(new RegExp(`${pre}നിങ്ങൾക്ക്${post}`, 'g'), '$1താങ്കൾക്ക്')
    .replace(new RegExp(`${pre}നിങ്ങൾക്കു${post}`, 'g'), '$1താങ്കൾക്ക്')
    .replace(new RegExp(`${pre}നിങ്ങളോട്${post}`, 'g'), '$1താങ്കളോട്')
    .replace(new RegExp(`${pre}നിങ്ങളോടു${post}`, 'g'), '$1താങ്കളോട്')
    .replace(new RegExp(`${pre}നിങ്ങളെ${post}`, 'g'), '$1താങ്കളെ')
    .replace(new RegExp(`${pre}നിങ്ങളിൽ${post}`, 'g'), '$1താങ്കളിൽ')
    .replace(new RegExp(`${pre}നിങ്ങൾ${post}`, 'g'), '$1താങ്കൾ')
    .replace(new RegExp(`${pre}നീ${post}`, 'g'), '$1താങ്കൾ')
}

function redactPrivateIdsFromBotReply(text: string): string {
  if (!text) return text
  const redacted = text
    .replace(/\bICS2K\d{2}[A-Z0-9]*\b/gi, '[Private Admission ID]')
    .replace(/\bICS-\d{4}-\d+\b/gi, '[Private Admission ID]')
    .replace(/\b(?:ACL|CL)-\d{1,3}(?:-[A-Z0-9]+)?\b/gi, '[Private Leader ID]')
    .replace(/\b(?:UST|ADM)-\d{1,4}\b/gi, '[Private Staff ID]')
  return enforceRespectfulMalayalamPronouns(redacted)
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

interface LongFormRequestInfo {
  isLongForm: boolean
  requestedPages: number | null
}

function detectLongFormRequest(text: string): LongFormRequestInfo {
  if (!text) return { isLongForm: false, requestedPages: null }
  const normalized = text
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))

  // Match explicit page counts across English, Malayalam, Arabic, Urdu, Spanish, German
  const pageNumMatch =
    /(\d{1,2})\s*(?:pages?|pgs?|പേജ്|പേജുകൾ|പേജുള്ള|പേജിന്റെ|പേജിൽ|صفحة|صفحات|صفحے|صفحات|páginas?|seiten?)/i.exec(
      normalized,
    ) ||
    /(?:pages?|പേജ്|പേജുകൾ|صفحة|صفحات)\s*[:\-]?\s*(\d{1,2})/i.exec(normalized)

  if (pageNumMatch) {
    const num = Number(pageNumMatch[1])
    if (Number.isFinite(num) && num >= 2) {
      return { isLongForm: true, requestedPages: Math.min(num, 30) }
    }
  }

  // Match qualitative multi-page / expansive / detailed study document requests
  const expansiveRegex =
    /(?:ഒരുപാട്\s*പേജ്|ധാരാളം\s*പേജ്|കൂടുതൽ\s*പേജ്|പല\s*പേജ്|വിശാലമായി|വിശാലമായ|വിശദമായി|വിശദമായ|ദീർഘമായി|ദീർഘമായ|സമ്പൂർണ്ണ|മുഴുവനായി|പ്രബന്ധം|ഉപന്യാസം|റിസർച്ച്|വലിയ\s*നോട്ട്|many\s+pages|multiple\s+pages|several\s+pages|long\s+(?:essay|note|notes|article|paper|speech|explanation)|in\s+full\s+detail|in\s+depth|in-depth|comprehensive|exhaustive|extensive|full\s+study\s+notes?|research\s+paper|complete\s+guide|elaborate\s+thoroughly|صفحات\s*كثيرة|عدة\s*صفحات|مفصل|موسع|شامل|مطول|بحث\s*(?:كامل|مفصل|طويل)|مقال\s*طويل|کئی\s*صفحات|تفصیل\s*سے|مفصل|مکمل\s*مضمون|en\s+detalle|extenso|ausführlich|umfangreich)/i

  if (expansiveRegex.test(normalized)) {
    return { isLongForm: true, requestedPages: null }
  }

  return { isLongForm: false, requestedPages: null }
}

function buildLongFormTurnDirective(info: LongFormRequestInfo): string {
  if (!info.isLongForm) return ''
  const targetDesc = info.requestedPages
    ? `The student specifically asked for approximately ${info.requestedPages} pages (~${Math.min(
        info.requestedPages * 550,
        9000,
      )}+ rich scholarly words across multiple well-developed sections).`
    : 'The student asked for an extensive, multi-page, deeply comprehensive scholarly study document (aim for 2,000–4,500+ rich words spanning multiple A4 pages).'

  return ` MULTI-PAGE COMPREHENSIVE DEPTH MODE (CRITICAL): ${targetDesc} DO NOT summarize, DO NOT abbreviate, and DO NOT cut short! Write an exhaustive, publication-grade scholarly document structured with clear Markdown headings (## and ###), rich multi-paragraph prose in every section, bold key terms (**...**), authentic Quranic/Hadith/Kitab Arabic quotations in blockquotes (> ...), detailed linguistic/Fiqh/historical/academic analysis, juristic or scholarly comparisons, structured numbered/bulleted breakdowns, practical examples, and a conclusion with review questions so that when exported to PDF/DOCX it forms a genuinely multi-page reference note.`
}

function getTurnLanguageEnforcement(
  language: OutputLanguage,
  isFirstTurn = true,
  userSaidSalam = false,
  isExplicitLanguage = false,
  longFormInfo: LongFormRequestInfo = { isLongForm: false, requestedPages: null },
): string {
  const salamRule = getSalamTurnDirective(isFirstTurn, userSaidSalam)
  const modePrefix = isExplicitLanguage
    ? 'EXPLICIT RESPONSE LANGUAGE SELECTED BY USER (Even if the question or attached image text above is in another language, the user has explicitly selected this target language for the reply — you MUST write your explanation/translation in this selected language ONLY!): '
    : 'AUTO-DETECTED QUESTION LANGUAGE (Reply in the requested target language): '

  const followUpRule =
    'FOLLOW-UP & CONVERSATION RULE: Answer the exact message the student sent! If the student says "ഹായ്" / "Hi" / "Hello" / "Salam", greet them warmly and briefly in 2-3 sentences and ask what topic or Kitab they want to study. If your previous message ended with a follow-up question or quiz question and the student is now answering that question, DO NOT treat their answer as a new question — evaluate their answer directly (e.g., "മാശാ അല്ലാഹ്! താങ്കളുടെ ഉത്തരം വളരെ കൃത്യമാണ്..." / "Masha\'Allah, your answer is correct!"), explain why, and continue naturally.'

  const longFormRule = buildLongFormTurnDirective(longFormInfo)

  switch (language) {
    case 'ur':
      return `\n\n[LANGUAGE & CONVERSATION INSTRUCTION — ${modePrefix}${salamRule} ${followUpRule}${longFormRule} Write your explanation in URDU (اردو) language. Refer to the institution in Urdu as "آئی سی ایس اکیڈمی" (ICS Academy). Keep quoted Quranic Ayahs, Hadith, Islamic greetings (السَّلَامُ عَلَيْكُمْ / وَعَلَيْكُمُ السَّلَامُ), and Kitab Ibarats in Arabic script, and explain everything else in Urdu (اردو).]`
    case 'ml':
      return `\n\n[LANGUAGE & CONVERSATION INSTRUCTION — ${modePrefix}${salamRule} ${followUpRule}${longFormRule} Write your explanation, translation, salutation, headings, and follow-up questions in natural, scholarly MALAYALAM (മലയാളം) script! RESPECTFUL ADDRESS RULE FOR MUTA'ALLIMS: Always address the student respectfully as "താങ്കൾ" (Thankal), "താങ്കളുടെ" (your), "താങ്കൾക്ക്" (to you), "താങ്കളോട്" (with you) — NEVER use "നീ", "നിന്റെ", "നിനക്ക്", "നിന്നോട്", "നിന്നെ", or "നിങ്ങൾ"! Keep Islamic greetings (السَّلَامُ عَلَيْكُمْ / وَعَلَيْكُمُ السَّلَامُ), quoted Quran/Hadith/Kitab Ibarats, and Arabic Fiqh/Nahw terms inside brackets in Arabic script. Refer to the institution in Malayalam as "ഐ.സി.എസ് അക്കാദമി".]`
    case 'ar':
      return `\n\n[LANGUAGE & CONVERSATION INSTRUCTION — ${modePrefix}${salamRule} ${followUpRule}${longFormRule} Respond in clear Classical/Modern Standard Arabic (العربية الفصحى). Refer to the institution as "أكاديمية ICS".]`
    case 'es':
      return `\n\n[LANGUAGE & CONVERSATION INSTRUCTION — ${modePrefix}${salamRule} ${followUpRule}${longFormRule} Respond in Spanish (Español). Refer to the institution as "ICS Academy".]`
    case 'de':
      return `\n\n[LANGUAGE & CONVERSATION INSTRUCTION — ${modePrefix}${salamRule} ${followUpRule}${longFormRule} Respond in German (Deutsch). Refer to the institution as "ICS Academy".]`
    case 'en':
    default:
      return `\n\n[LANGUAGE & CONVERSATION INSTRUCTION — ${modePrefix}${salamRule} ${followUpRule}${longFormRule} Respond in clear academic English (and if the student explicitly asked to translate into Malayalam or another language, include that requested translation clearly!). Present key Arabic terms with their vocalized Arabic script inside brackets (...) beside the English term. Always write the Salam itself in Arabic script (السَّلَامُ عَلَيْكُمْ or وَعَلَيْكُمُ السَّلَامُ) on its own line.]`
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
- When referring to the institution in Malayalam, say "ഐ.സി.എസ് അക്കാദമി" or "ഐ.സി.എസ് അക്കാദമിയുടെ" (never add "മഞ്ഞപ്പറ്റയുടെ").
- STRICT RESPECTFUL ADDRESS RULE FOR MUTA'ALLIMS (CRITICAL): Students of sacred knowledge (Muta'allims / മുതഅല്ലിമുകൾ) must ALWAYS be addressed with high respect using "താങ്കൾ" (Thankal), "താങ്കളുടെ" (your), "താങ്കൾക്ക്" (to you), "താങ്കളോട്" (with you), and "താങ്കളെ". NEVER address the student using "നീ", "നിന്റെ", "നിനക്ക്", "നിന്നോട്", "നിന്നെ", or "നിങ്ങൾ"!`
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
- Keep the tone respectful, scholarly, encouraging, and pedagogically clear.
- STRICT PRIVACY & DATA PROTECTION RULE (CRITICAL): Neither Usthads nor Students nor any user is allowed to view or obtain any other person's Admission ID, Password, Batch number, Class Leader ID, Staff ID, attendance percentage, leave record, or personal details in this Chatbot — ONLY names (and class) may ever be mentioned. If anyone asks for another student's or Usthad's Admission ID, password, batch number, attendance, leave status, or private details, politely refuse and state that for institutional privacy, only names are visible in the Chatbot.`
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
- CRITICAL MALAYALAM RULE: In Malayalam, refer to the academy simply as "ഐ.സി.എസ് അക്കാദമി" or "ഐ.സി.എസ് അക്കാദമിയുടെ" (do not say "ഐ.സി.എസ് അക്കാദമി മഞ്ഞപ്പറ്റയുടെ").
- STRICT RESPECTFUL ADDRESS RULE FOR MUTA'ALLIMS (CRITICAL): Students of sacred knowledge (Muta'allims / മുതഅല്ലിമുകൾ) must ALWAYS be addressed with high respect using "താങ്കൾ" (Thankal), "താങ്കളുടെ" (your), "താങ്കൾക്ക്" (to you), "താങ്കളോട്" (with you), and "താങ്കളെ". NEVER address the student using "നീ", "നിന്റെ", "നിനക്ക്", "നിന്നോട്", "നിന്നെ", or "നിങ്ങൾ"!`
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

Strict Student & Staff Data Privacy Rule (CRITICAL — APPLIES TO BOTH USTHADS AND STUDENTS):
- In this Chatbot, neither Usthads nor Students nor Class Leaders are permitted to see anything about other students or staff members except their NAME (and class).
- You do NOT have access to, and MUST NEVER disclose, guess, or fabricate any person's Admission ID (e.g. ICS2K...), Password, Batch number (e.g. Batch 14, Batch 07), Class Leader ID (CL-... / ACL-...), Staff ID (UST-... / ADM-...), attendance record, leave status, exam marks, or personal information.
- If any user (whether Student, Class Leader, Usthad, or Principal) asks for another person's Admission ID, password, batch number, login ID, attendance, leave details, or personal data, politely refuse in the target response language and state that for strict institutional privacy, only names are visible in the Chatbot and private records (Admission IDs, passwords, batch numbers, attendance, leave records, etc.) cannot be accessed here.

Language Instruction:
- ${languageDirective}

Conversation Guidelines:
- Maintain continuity with previous messages in the thread, but ALWAYS obey the current Language Instruction above even if earlier messages in the conversation history were in a different language.
- Keep answers clear, well-structured with Markdown headings (##, ###), bold key terms (**...**), blockquotes (> ...) for Kitab/Quran/Hadith quotes, and bullet/numbered points.
- EXPANSIVE MULTI-PAGE DOCUMENT CAPABILITY (CRITICAL): Whenever a student requests multiple pages, a detailed treatise, a long essay/speech, or extensive study notes (e.g., "5 pages", "10 pages", "ഒരുപാട് പേജുകൾ", "വിശാലമായി എഴുതൂ", "بحث مطول من عدة صفحات"), NEVER condense or stop after a short summary! Write deeply and thoroughly across full chapters, subsections, classical evidences, scholarly commentary, examples, and review questions proportionate to the number of pages requested (roughly 500–650 words per A4 page).`
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
  isLongForm = false,
): Promise<string> {
  const models = [
    'gemini-4-hydrogen',
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
      const useLowThinking =
        modelName === 'gemini-4-hydrogen' || modelName === 'gemini-3.8-flash'
      const timeoutMs = isLongForm
        ? 110000
        : modelName.includes('lite')
          ? 28000
          : 42000
      const response = await withTimeout(
        ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            ...(useLowThinking
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          },
        }),
        timeoutMs,
        modelName,
      )
      if (response.text) {
        if (!isResponseValidForLanguage(response.text, language)) {
          console.warn(`Model ${modelName} returned wrong script for ${language}, retrying next model...`)
          continue
        }
        return redactPrivateIdsFromBotReply(response.text)
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
  const longFormInfo = detectLongFormRequest(message)

  // For multi-page / expansive study document requests, prioritize full-capacity Flash models first
  const modelOrder =
    preferredTier === 'flash-lite' && !longFormInfo.isLongForm
      ? ([
          'gemini-3.1-flash-lite',
          'gemini-4-hydrogen',
          'gemini-3.1-flash-lite-preview',
          'gemini-3.8-flash',
          'gemini-3-flash-preview',
          'gemini-2.5-flash-lite',
          'gemini-2.5-flash',
          'gemini-flash-lite-latest',
        ] as const)
      : ([
          'gemini-4-hydrogen',
          'gemini-3.8-flash',
          'gemini-3-flash-preview',
          'gemini-2.5-flash',
          'gemini-3.1-flash-lite',
          'gemini-3.1-flash-lite-preview',
          'gemini-2.5-flash-lite',
          'gemini-flash-lite-latest',
        ] as const)

  // Preserve rich multi-turn conversation history so follow-up answers and "continue next pages" work seamlessly
  const sanitizedHistory = history
    .filter((turn) => Boolean(turn && typeof turn.text === 'string' && turn.text.trim()))
    .slice(-16)
    .map((turn) => ({
      role: turn.role === 'model' ? ('model' as const) : ('user' as const),
      parts: [{ text: turn.text.trim().slice(0, 12000) }],
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
  const enforcedMessage = `${message}${getTurnLanguageEnforcement(
    language,
    isFirstTurn,
    userSaidSalam,
    isExplicitLanguage,
    longFormInfo,
  )}`

  let lastError: unknown = null

  for (const modelName of modelOrder) {
    try {
      const ai = getAiClient()
      let responseText: string | undefined
      const useLowThinking =
        modelName === 'gemini-4-hydrogen' || modelName === 'gemini-3.8-flash'
      const requestTimeoutMs = longFormInfo.isLongForm
        ? 115000
        : validAttachments.length > 0
          ? 45000
          : modelName.includes('lite')
            ? 28000
            : 45000

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
              ...(useLowThinking
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          }),
          requestTimeoutMs,
          modelName,
        )
        responseText = response.text
      } else {
        const chat = ai.chats.create({
          model: modelName,
          history: sanitizedHistory,
          config: {
            systemInstruction,
            ...(useLowThinking
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          },
        })

        const response = await withTimeout(
          chat.sendMessage({ message: enforcedMessage }),
          requestTimeoutMs,
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
          reply: redactPrivateIdsFromBotReply(responseText),
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

      const longFormInfo = detectLongFormRequest(trimmedPrompt)
      const text = await generateWithFallback(
        `${trimmedPrompt}${getTurnLanguageEnforcement(
          validLanguage,
          true,
          didStudentSaySalam(trimmedPrompt),
          isExplicitLanguage,
          longFormInfo,
        )}`,
        buildSystemInstruction(validMode, validLanguage, studentName),
        validLanguage,
        longFormInfo.isLongForm,
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

      const cleanMessage = (rawMessage || defaultAttachmentPrompt).slice(0, 4500)
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

  const ttsCache = new Map<string, { audioBase64: string; mimeType: string }>()

  function transformToMaleVoiceMp3(inputMp3: Buffer): Promise<Buffer> {
    return new Promise((resolve) => {
      try {
        const ff = spawn('ffmpeg', [
          '-hide_banner',
          '-loglevel',
          'error',
          '-f',
          'mp3',
          '-i',
          'pipe:0',
          '-af',
          'rubberband=pitch=0.775:formant=shifted:tempo=1.03,equalizer=f=135:width_type=o:width=1.4:g=3.5,equalizer=f=3200:width_type=o:width=2.0:g=-1.5',
          '-codec:a',
          'libmp3lame',
          '-b:a',
          '64k',
          '-f',
          'mp3',
          'pipe:1',
        ])
        const outChunks: Buffer[] = []
        ff.stdout.on('data', (chunk: Buffer) => outChunks.push(chunk))
        ff.on('error', () => resolve(inputMp3))
        ff.on('close', (code) => {
          if (code === 0 && outChunks.length > 0) {
            resolve(Buffer.concat(outChunks))
          } else {
            resolve(inputMp3)
          }
        })
        ff.stdin.on('error', () => {
          // ignore broken pipe
        })
        ff.stdin.write(inputMp3)
        ff.stdin.end()
      } catch {
        resolve(inputMp3)
      }
    })
  }

  function convertWavToMp3(inputWav: Buffer): Promise<{ buffer: Buffer; mimeType: string }> {
    return new Promise((resolve) => {
      try {
        const ff = spawn('ffmpeg', [
          '-hide_banner',
          '-loglevel',
          'error',
          '-i',
          'pipe:0',
          '-ar',
          '44100',
          '-ac',
          '1',
          '-codec:a',
          'libmp3lame',
          '-b:a',
          '64k',
          '-f',
          'mp3',
          'pipe:1',
        ])
        const outChunks: Buffer[] = []
        ff.stdout.on('data', (chunk: Buffer) => outChunks.push(chunk))
        ff.on('error', () => resolve({ buffer: inputWav, mimeType: 'audio/wav' }))
        ff.on('close', (code) => {
          if (code === 0 && outChunks.length > 0) {
            resolve({ buffer: Buffer.concat(outChunks), mimeType: 'audio/mpeg' })
          } else {
            resolve({ buffer: inputWav, mimeType: 'audio/wav' })
          }
        })
        ff.stdin.on('error', () => {
          // ignore broken pipe
        })
        ff.stdin.write(inputWav)
        ff.stdin.end()
      } catch {
        resolve({ buffer: inputWav, mimeType: 'audio/wav' })
      }
    })
  }

  app.post('/api/ai/tts', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const { text = '', language = 'ml', voiceName = 'Orbit' } = req.body ?? {}
      const cleanText = typeof text === 'string' ? text.trim().slice(0, 1800) : ''
      if (!cleanText) {
        res.status(400).json({ error: 'Text is required for speech synthesis.' })
        return
      }

      const selectedVoice =
        typeof voiceName === 'string' && voiceName.trim() ? voiceName.trim() : 'Orbit'
      const cacheKey = `orbit-v4:${selectedVoice}:${language}:${cleanText}`
      const cached = ttsCache.get(cacheKey)
      if (cached) {
        res.json(cached)
        return
      }

      // 1. Primary: Official Gemini 3.8 Flash Lite TTS (`gemini-3.8-flash-lite-tts`) with 'Orbit' male voice
      try {
        const ai = getAiClient()
        const ttsResponse = await withTimeout(
          ai.models.generateContent({
            model: 'gemini-3.8-flash-lite-tts',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: cleanText,
                    speechMetadata: {
                      style:
                        'Warm, clear, confident male Malayalam narrator explaining app features naturally step by step',
                    },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: selectedVoice },
                },
              },
            },
          }),
          18000,
          'gemini-3.8-flash-lite-tts',
        )

        const inlineAudio =
          ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData
        if (inlineAudio?.data) {
          const rawWavBuf = Buffer.from(inlineAudio.data, 'base64')
          const converted = await convertWavToMp3(rawWavBuf)
          const payload = {
            audioBase64: converted.buffer.toString('base64'),
            mimeType: converted.mimeType,
            voiceUsed: selectedVoice,
          }
          if (ttsCache.size > 100) {
            const firstKey = ttsCache.keys().next().value
            if (firstKey) ttsCache.delete(firstKey)
          }
          ttsCache.set(cacheKey, payload)
          res.json(payload)
          return
        }
      } catch (err) {
        console.warn('Gemini Orbit TTS fallback triggered:', err instanceof Error ? err.message : err)
      }

      // 2. Fallback: Native Malayalam speech synthesis transformed to Male baritone voice
      try {
        const rawSentences = cleanText
          .split(/(?<=[.!?।])\s+|\n+/)
          .map((s) => s.trim())
          .filter(Boolean)

        const chunks: string[] = []
        for (const sentence of rawSentences) {
          if (sentence.length <= 180) {
            chunks.push(sentence)
          } else {
            const words = sentence.split(/\s+/)
            let current = ''
            for (const w of words) {
              if ((current + ' ' + w).trim().length > 180) {
                if (current) chunks.push(current.trim())
                current = w
              } else {
                current = (current + ' ' + w).trim()
              }
            }
            if (current) chunks.push(current.trim())
          }
        }

        const tl = language === 'ml' ? 'ml' : language === 'ar' ? 'ar' : 'en'
        const buffers = await Promise.all(
          chunks.map(async (chunk) => {
            const ttsUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=${tl}&client=gtx&q=${encodeURIComponent(chunk)}`
            const ttsRes = await withTimeout(
              fetch(ttsUrl, {
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                },
              }),
              5000,
              'native-tts',
            )
            if (!ttsRes.ok) {
              throw new Error(`TTS upstream status ${ttsRes.status}`)
            }
            const arrBuf = await ttsRes.arrayBuffer()
            return Buffer.from(arrBuf)
          }),
        )

        if (buffers.length > 0) {
          const combinedRaw = Buffer.concat(buffers)
          const finalMp3 = await transformToMaleVoiceMp3(combinedRaw)
          const payload = {
            audioBase64: finalMp3.toString('base64'),
            mimeType: 'audio/mpeg',
          }
          if (ttsCache.size > 100) {
            const firstKey = ttsCache.keys().next().value
            if (firstKey) ttsCache.delete(firstKey)
          }
          ttsCache.set(cacheKey, payload)
          res.json(payload)
          return
        }
      } catch {
        // Ignore fallback error
      }

      res.status(500).json({ error: 'Unable to synthesize speech audio.' })
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : 'Failed to synthesize speech.'
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

  // Enable CORS on /api/campus/* so Website (ais-dev / ais-pre), Android APK, and iPhone Home Screen PWA can sync seamlessly
  app.use('/api/campus', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }
    next()
  })

  // Real-time Campus Sync & Notifications State (Notices, Attendance, Period Attendance, Notifications)
  interface ServerCampusNotification {
    id: string
    type: 'notice' | 'attendance' | 'period-attendance' | 'leave' | 'chat'
    title: string
    message: string
    category?: string
    targetClass?: string
    targetClasses?: string[]
    targetStudentId?: string
    targetRecipientId?: string
    targetStaffOnly?: boolean
    actorId?: string
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
    deletedPeriodKeys: Record<string, number>
    academyAdminConfig: Record<string, unknown> | null
    notifications: ServerCampusNotification[]
  }

  const campusState: ServerCampusState = {
    updatedAtMs: Date.now(),
    customNotices: null,
    attendanceOverrides: null,
    periodSubmissions: null,
    deletedPeriodKeys: {},
    academyAdminConfig: null,
    notifications: [],
  }

  // Real-Time Background Web Push (VAPID) for Android PWA/Chrome & iPhone iOS 16.4+ Add to Home Screen
  interface StoredPushSubscription {
    endpoint: string
    keys: {
      p256dh: string
      auth: string
    }
    actorId: string
    actorRole: 'student' | 'usthad' | 'principal'
    actorName: string
    className: string
    assignedClasses: string[]
    platform: string
    updatedAtMs: number
  }

  const ALLOWED_PUSH_HOST_SUFFIXES = [
    'fcm.googleapis.com',
    'android.googleapis.com',
    'web.push.apple.com',
    '.push.apple.com',
    'updates.push.services.mozilla.com',
    '.push.services.mozilla.com',
    '.notify.windows.com',
    '.push.samsungosp.com',
  ]

  function isValidPushEndpointUrl(raw: string): boolean {
    if (typeof raw !== 'string' || raw.length < 16 || raw.length > 2048) return false
    try {
      const parsed = new URL(raw)
      if (parsed.protocol !== 'https:') return false
      const host = parsed.hostname.toLowerCase()
      if (
        !host ||
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host === '169.254.169.254' ||
        /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
      ) {
        return false
      }
      return ALLOWED_PUSH_HOST_SUFFIXES.some((suffix) =>
        suffix.startsWith('.') ? host.endsWith(suffix) : host === suffix,
      )
    } catch {
      return false
    }
  }

  function isValidBase64UrlKey(raw: unknown): raw is string {
    return (
      typeof raw === 'string' &&
      raw.length >= 16 &&
      raw.length <= 256 &&
      /^[A-Za-z0-9_-]+={0,2}$/.test(raw)
    )
  }

  function isValidPushActorId(raw: unknown): raw is string {
    return (
      typeof raw === 'string' &&
      raw.length >= 4 &&
      raw.length <= 64 &&
      /^(st[d]?|usthad|principal)-[a-zA-Z0-9_-]+$/.test(raw)
    )
  }

  function normalizePushClassLabel(raw?: string): string {
    if (!raw || typeof raw !== 'string') return ''
    return raw
      .replace(/^class\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase()
  }

  const envVapidPublic = (process.env.VAPID_PUBLIC_KEY || '').trim()
  const envVapidPrivate = (process.env.VAPID_PRIVATE_KEY || '').trim()
  const envVapidSubject =
    (process.env.VAPID_SUBJECT || '').trim() || 'mailto:admin@icsacademy.edu'

  let vapidPublicKey = ''
  let vapidReady = false
  try {
    const keys =
      envVapidPublic && envVapidPrivate
        ? { publicKey: envVapidPublic, privateKey: envVapidPrivate }
        : webpush.generateVAPIDKeys()
    webpush.setVapidDetails(envVapidSubject, keys.publicKey, keys.privateKey)
    vapidPublicKey = keys.publicKey
    vapidReady = true
  } catch (err) {
    console.error('Web Push VAPID initialization error:', err)
  }

  const pushSubscriptionsByEndpoint = new Map<string, StoredPushSubscription>()

  function pruneOldPushSubscriptions() {
    if (pushSubscriptionsByEndpoint.size <= 1500) return
    const sorted = Array.from(pushSubscriptionsByEndpoint.entries()).sort(
      (a, b) => b[1].updatedAtMs - a[1].updatedAtMs,
    )
    for (const [endpoint] of sorted.slice(1200)) {
      pushSubscriptionsByEndpoint.delete(endpoint)
    }
  }

  function isPushSubscriptionTargeted(
    sub: StoredPushSubscription,
    notif: ServerCampusNotification,
  ): boolean {
    const myActorId = sub.actorId
    const myActorName = sub.actorName
    const isStaff = sub.actorRole === 'usthad' || sub.actorRole === 'principal'
    const isPrincipal = sub.actorRole === 'principal'

    // 1. Never push back to the sender
    if (notif.actorId && myActorId && notif.actorId === myActorId) {
      return false
    }
    if (
      !notif.actorId &&
      notif.actorName &&
      myActorName &&
      notif.actorName.trim().toLowerCase() === myActorName.trim().toLowerCase()
    ) {
      return false
    }

    // 2. Direct 1-on-1 Chat / Specific Recipient / Call Target
    if (notif.targetRecipientId) {
      return notif.targetRecipientId === myActorId
    }

    // 3. Staff Room Group Targeting (Usthads & Principal only)
    if (notif.targetStaffOnly) {
      return isStaff
    }

    const normMyClass = normalizePushClassLabel(sub.className)
    const normAssigned = sub.assignedClasses.map(normalizePushClassLabel).filter(Boolean)
    const normTargetClass = normalizePushClassLabel(notif.targetClass)
    const normTargetClasses = Array.isArray(notif.targetClasses)
      ? notif.targetClasses.map(normalizePushClassLabel).filter(Boolean)
      : []

    // 4. Batch Group Chat Targeting
    if (notif.type === 'chat') {
      if (normTargetClass && normTargetClass !== 'ALL') {
        if (!isStaff) {
          return normMyClass === normTargetClass
        }
        return normMyClass === normTargetClass || normAssigned.includes(normTargetClass)
      }
      return false
    }

    // 5. Student / Class Leader targeting
    if (!isStaff) {
      if (notif.targetStudentId && notif.targetStudentId !== myActorId) {
        return false
      }
      if (notif.type === 'attendance' || notif.type === 'leave') {
        return Boolean(notif.targetStudentId && notif.targetStudentId === myActorId)
      }
      if (normTargetClasses.length > 0 && !normTargetClasses.includes('ALL')) {
        if (normMyClass && !normTargetClasses.includes(normMyClass)) {
          return false
        }
      }
      if (normTargetClass && normTargetClass !== 'ALL') {
        if (normMyClass && normTargetClass !== normMyClass) {
          return false
        }
      }
      return true
    }

    // 6. Usthad (non-Principal) targeting
    if (!isPrincipal) {
      if (normTargetClasses.length > 0 && !normTargetClasses.includes('ALL')) {
        const matchesAny =
          (normMyClass && normTargetClasses.includes(normMyClass)) ||
          normAssigned.some((c) => normTargetClasses.includes(c))
        if (!matchesAny) return false
      }
      if (normTargetClass && normTargetClass !== 'ALL') {
        const matchesSingle =
          normMyClass === normTargetClass || normAssigned.includes(normTargetClass)
        if (!matchesSingle) return false
      }
    }

    return true
  }

  async function sendWebPushToSubscription(
    sub: StoredPushSubscription,
    payloadObj: {
      title: string
      body: string
      href: string
      tag: string
      notificationId: string
      type: string
      requireInteraction?: boolean
    },
    urgency: 'normal' | 'high' = 'normal',
  ): Promise<boolean> {
    if (!vapidReady) return false
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys,
        },
        JSON.stringify(payloadObj),
        {
          TTL: urgency === 'high' ? 60 : 60 * 60 * 6,
          urgency,
        },
      )
      return true
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode
      if (statusCode === 404 || statusCode === 410) {
        pushSubscriptionsByEndpoint.delete(sub.endpoint)
      }
      return false
    }
  }

  function dispatchWebPushForNotification(notif: ServerCampusNotification) {
    if (!vapidReady || pushSubscriptionsByEndpoint.size === 0) return
    const payload = {
      title: String(notif.title || 'ICS Academy').slice(0, 140),
      body: String(notif.message || 'Open ICS Academy to view details.').slice(0, 320),
      href: notif.href || '#notices',
      tag: `ics-notif-${notif.type || 'notice'}-${notif.id}`,
      notificationId: notif.id,
      type: notif.type || 'notice',
      requireInteraction: false,
    }
    const urgency: 'normal' | 'high' =
      notif.type === 'chat' || notif.type === 'leave' || notif.type === 'attendance'
        ? 'high'
        : 'normal'

    for (const sub of pushSubscriptionsByEndpoint.values()) {
      if (isPushSubscriptionTargeted(sub, notif)) {
        void sendWebPushToSubscription(sub, payload, urgency)
      }
    }
  }

  function dispatchWebPushForIncomingCall(record: {
    id: string
    callType: 'voice' | 'video'
    callerId: string
    callerName: string
    calleeId: string
  }) {
    if (!vapidReady || pushSubscriptionsByEndpoint.size === 0 || !record.calleeId) return
    const callLabel = record.callType === 'video' ? 'Incoming Video Call' : 'Incoming Voice Call'
    const payload = {
      title: `${callLabel} — ${record.callerName}`,
      body: 'Tap to open ICS Academy and answer.',
      href: '#campus-chat',
      tag: `ics-call-${record.id}`,
      notificationId: `call_${record.id}`,
      type: 'call',
      requireInteraction: true,
    }

    for (const sub of pushSubscriptionsByEndpoint.values()) {
      if (sub.actorId === record.calleeId && sub.actorId !== record.callerId) {
        void sendWebPushToSubscription(sub, payload, 'high')
      }
    }
  }

  app.use('/api/push', (req, res, next) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : ''
    const isAllowedOrigin =
      !origin ||
      /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.(run\.app|vercel\.app|netlify\.app)$/i.test(origin) ||
      /^(capacitor|https?):\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
    if (origin && isAllowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }
    next()
  })

  app.get('/api/push/vapid-public-key', (_req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.json({
      ok: vapidReady,
      publicKey: vapidPublicKey,
      persistentEnvConfigured: Boolean(envVapidPublic && envVapidPrivate),
    })
  })

  app.post('/api/push/subscribe', (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const {
        subscription,
        actorId,
        actorRole,
        actorName,
        className,
        assignedClasses,
        platform,
      } = req.body ?? {}

      if (!subscription || typeof subscription !== 'object') {
        res.status(400).json({ error: 'Valid push subscription is required.' })
        return
      }
      const endpoint = typeof subscription.endpoint === 'string' ? subscription.endpoint.trim() : ''
      const p256dh = subscription.keys?.p256dh
      const authKey = subscription.keys?.auth

      if (!isValidPushEndpointUrl(endpoint) || !isValidBase64UrlKey(p256dh) || !isValidBase64UrlKey(authKey)) {
        res.status(400).json({ error: 'Invalid push subscription endpoint or keys.' })
        return
      }

      if (!isValidPushActorId(actorId)) {
        res.status(400).json({ error: 'Valid portal actorId is required.' })
        return
      }

      const safeRole: 'student' | 'usthad' | 'principal' =
        actorRole === 'principal' || actorRole === 'usthad' ? actorRole : 'student'
      const safeName =
        typeof actorName === 'string' && actorName.trim()
          ? actorName.trim().slice(0, 120)
          : 'Campus Member'
      const safeClass =
        typeof className === 'string' ? className.trim().slice(0, 60) : ''
      const safeAssigned = Array.isArray(assignedClasses)
        ? assignedClasses
            .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
            .map((c) => c.trim().slice(0, 60))
            .slice(0, 20)
        : []
      const safePlatform =
        typeof platform === 'string' ? platform.trim().slice(0, 40) : 'web'

      pushSubscriptionsByEndpoint.set(endpoint, {
        endpoint,
        keys: { p256dh, auth: authKey },
        actorId,
        actorRole: safeRole,
        actorName: safeName,
        className: safeClass,
        assignedClasses: safeAssigned,
        platform: safePlatform,
        updatedAtMs: Date.now(),
      })
      pruneOldPushSubscriptions()

      res.json({
        ok: true,
        actorId,
        actorRole: safeRole,
        activeDevicesForActor: Array.from(pushSubscriptionsByEndpoint.values()).filter(
          (s) => s.actorId === actorId,
        ).length,
      })
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to register push subscription.',
      })
    }
  })

  app.post('/api/push/unsubscribe', (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint.trim() : ''
    if (endpoint && isValidPushEndpointUrl(endpoint)) {
      pushSubscriptionsByEndpoint.delete(endpoint)
    }
    res.json({ ok: true })
  })

  app.post('/api/push/test', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint.trim() : ''
      if (!endpoint || !isValidPushEndpointUrl(endpoint)) {
        res.status(400).json({ error: 'Valid push endpoint is required.' })
        return
      }
      const sub = pushSubscriptionsByEndpoint.get(endpoint)
      if (!sub) {
        res.status(404).json({ error: 'Device subscription not found. Please enable notifications first.' })
        return
      }
      const delivered = await sendWebPushToSubscription(
        sub,
        {
          title: 'ICS Academy — Notifications Active',
          body: `Real-time alerts are active for ${sub.actorName}${sub.className ? ` (${sub.className})` : ''}.`,
          href: '#notices',
          tag: `ics-test-${Date.now()}`,
          notificationId: `test_${Date.now()}`,
          type: 'test',
          requireInteraction: false,
        },
        'high',
      )
      res.json({ ok: delivered })
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to send test push notification.',
      })
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
    mediaType: 'none' | 'voice' | 'image' | 'pdf' | 'call' | 'location' | 'contact' | 'poll'
    callMeta?: {
      callId: string
      callType: 'voice' | 'video'
      callStatus: 'ringing' | 'accepted' | 'connected' | 'declined' | 'missed' | 'ended' | 'busy'
      durationSec?: number
      callerId: string
      calleeId: string
    }
    locationMeta?: {
      label: string
      address?: string
      latitude: number
      longitude: number
    }
    contactMeta?: {
      actorId: string
      name: string
      role: 'student' | 'usthad' | 'principal'
      subtitle?: string
      avatarUrl?: string
    }
    pollMeta?: {
      question: string
      options: { id: string; text: string }[]
      allowMultiple: boolean
      votes: Record<string, string[]>
    }
    mediaUrl?: string
    mediaName?: string
    mediaSizeLabel?: string
    mediaDurationSec?: number
    imageQuality?: 'standard' | 'hd'
    imageDimensions?: string
    replyTo?: ServerChatReplyRef
    reactions: Record<string, string[]>
    deliveredTo: string[]
    deliveredAtMap?: Record<string, number>
    readBy: string[]
    readAtMap?: Record<string, number>
    starredBy?: string[]
    isForwarded?: boolean
    isDeleted?: boolean
    deletedBy?: string
    deletedById?: string
    deletedFor?: string[]
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
    isOnline?: boolean
    hideOnline?: boolean
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

  function isRoomRelevantToActor(
    rId: string,
    actorId: string,
    className?: string,
    isStaff?: boolean,
  ): boolean {
    if (!actorId) return false
    if (rId.startsWith('direct__')) {
      const parts = rId.split('__')
      return parts[1] === actorId || parts[2] === actorId
    }
    if (rId === 'staff_group__usthads') {
      return Boolean(isStaff)
    }
    if (rId.startsWith('batch_group__')) {
      if (isStaff) return true
      if (!className) return false
      const roomBatch = rId.replace(/^batch_group__/, '').trim().toLowerCase()
      const userBatch = className.replace(/^Class\s+/i, '').trim().toLowerCase()
      return roomBatch === userBatch
    }
    return false
  }

  function acknowledgeDeliveryForActor(
    actorId?: string,
    className?: string,
    isStaff?: boolean,
  ): boolean {
    if (!actorId || typeof actorId !== 'string') return false
    let changed = false
    const now = Date.now()
    for (const [rId, list] of Object.entries(campusChatState.messagesByRoom)) {
      if (!Array.isArray(list) || list.length === 0) continue
      if (!isRoomRelevantToActor(rId, actorId, className, isStaff)) continue
      for (const msg of list) {
        if (!Array.isArray(msg.deliveredTo)) {
          msg.deliveredTo = msg.senderId ? [msg.senderId] : []
        }
        if (!msg.deliveredAtMap || typeof msg.deliveredAtMap !== 'object') {
          msg.deliveredAtMap = {}
        }
        if (!msg.deliveredTo.includes(actorId)) {
          msg.deliveredTo.push(actorId)
          if (!msg.deliveredAtMap[actorId]) {
            msg.deliveredAtMap[actorId] = now
          }
          changed = true
        } else if (actorId !== msg.senderId && !msg.deliveredAtMap[actorId]) {
          msg.deliveredAtMap[actorId] = now
          changed = true
        }
      }
    }
    if (changed) {
      campusChatState.updatedAtMs = now
    }
    return changed
  }

  app.get('/api/campus/state', (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    const qActorId = typeof req.query.actorId === 'string' ? req.query.actorId.trim() : ''
    const qClassName = typeof req.query.className === 'string' ? req.query.className.trim() : ''
    const qIsStaff = req.query.isStaff === 'true'
    if (qActorId) {
      acknowledgeDeliveryForActor(qActorId, qClassName, qIsStaff)
    }
    res.json(campusState)
  })

  app.post('/api/campus/sync', (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const {
        customNotices,
        attendanceOverrides,
        periodSubmissions,
        deletedPeriodKey,
        deletedAtMs,
        academyAdminConfig,
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

      if (academyAdminConfig && typeof academyAdminConfig === 'object') {
        campusState.academyAdminConfig = academyAdminConfig as Record<string, unknown>
        campusState.updatedAtMs = Date.now()
      }

      if (typeof deletedPeriodKey === 'string' && deletedPeriodKey) {
        if (campusState.periodSubmissions && deletedPeriodKey in campusState.periodSubmissions) {
          delete campusState.periodSubmissions[deletedPeriodKey]
        }
        campusState.deletedPeriodKeys[deletedPeriodKey] =
          typeof deletedAtMs === 'number' ? deletedAtMs : Date.now()
        campusState.updatedAtMs = Date.now()
      }

      if (periodSubmissions && typeof periodSubmissions === 'object') {
        const incomingMap = periodSubmissions as Record<string, unknown>
        const nextSubs: Record<string, unknown> = {
          ...(campusState.periodSubmissions || {}),
        }
        for (const [k, val] of Object.entries(incomingMap)) {
          nextSubs[k] = val
          delete campusState.deletedPeriodKeys[k]
        }
        campusState.periodSubmissions = nextSubs
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
          const normalizedNotif: ServerCampusNotification = {
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
            targetRecipientId: incomingNotif.targetRecipientId,
            targetStaffOnly: Boolean(incomingNotif.targetStaffOnly),
            actorId: incomingNotif.actorId,
            actorName: incomingNotif.actorName,
            href: incomingNotif.href || '#notices',
            createdAt: incomingNotif.createdAt || new Date().toISOString(),
            createdAtMs: Number(incomingNotif.createdAtMs) || Date.now(),
          }
          campusState.notifications = [normalizedNotif, ...campusState.notifications].slice(0, 80)
          campusState.updatedAtMs = Date.now()
          dispatchWebPushForNotification(normalizedNotif)
        }
      }

      res.json({ ok: true, state: campusState })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Sync failed' })
    }
  })

  app.get('/api/campus/chat/state', (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    const now = Date.now()
    const qActorId = typeof req.query.actorId === 'string' ? req.query.actorId.trim() : ''
    const qClassName = typeof req.query.className === 'string' ? req.query.className.trim() : ''
    const qIsStaff = req.query.isStaff === 'true'
    const qReadRoomId = typeof req.query.readRoomId === 'string' ? req.query.readRoomId.trim() : ''

    if (qActorId) {
      acknowledgeDeliveryForActor(qActorId, qClassName, qIsStaff)
      if (qReadRoomId && Array.isArray(campusChatState.messagesByRoom[qReadRoomId])) {
        for (const msg of campusChatState.messagesByRoom[qReadRoomId]) {
          if (!Array.isArray(msg.deliveredTo)) msg.deliveredTo = msg.senderId ? [msg.senderId] : []
          if (!msg.deliveredAtMap || typeof msg.deliveredAtMap !== 'object') msg.deliveredAtMap = {}
          if (!msg.deliveredTo.includes(qActorId)) {
            msg.deliveredTo.push(qActorId)
            if (!msg.deliveredAtMap[qActorId]) msg.deliveredAtMap[qActorId] = now
            campusChatState.updatedAtMs = now
          } else if (qActorId !== msg.senderId && !msg.deliveredAtMap[qActorId]) {
            msg.deliveredAtMap[qActorId] = now
            campusChatState.updatedAtMs = now
          }
          if (!Array.isArray(msg.readBy)) msg.readBy = msg.senderId ? [msg.senderId] : []
          if (!msg.readAtMap || typeof msg.readAtMap !== 'object') msg.readAtMap = {}
          if (!msg.readBy.includes(qActorId)) {
            msg.readBy.push(qActorId)
            if (!msg.readAtMap[qActorId]) msg.readAtMap[qActorId] = now
            campusChatState.updatedAtMs = now
          } else if (qActorId !== msg.senderId && !msg.readAtMap[qActorId]) {
            msg.readAtMap[qActorId] = now
            campusChatState.updatedAtMs = now
          }
        }
      }
    }

    // Clean up stale typing indicators older than 8 seconds and mark stale presence (>15s) as offline
    for (const rId of Object.keys(campusChatState.typingMap)) {
      const roomTyping = campusChatState.typingMap[rId]
      if (!roomTyping) continue
      for (const aId of Object.keys(roomTyping)) {
        if (now - roomTyping[aId].updatedAtMs > 8000 || roomTyping[aId].mode === 'idle') {
          delete roomTyping[aId]
        }
      }
    }
    for (const aId of Object.keys(campusChatState.presenceMap)) {
      const p = campusChatState.presenceMap[aId]
      if (p && p.isOnline && now - p.lastSeenMs > 15000) {
        p.isOnline = false
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
        actorClassName,
        message,
        messageId,
        messageIds,
        starred,
        deleteMode,
        emoji,
        onlyAdminsCanPost,
        pinnedMessageId,
        typingMode,
        hideOnline,
        sendReadReceipts,
      } = req.body ?? {}

      const now = Date.now()
      const isStaffActor = actorRole === 'usthad' || actorRole === 'principal'

      if (action === 'leave_presence') {
        if (actorId && typeof actorId === 'string') {
          const existing = campusChatState.presenceMap[actorId]
          campusChatState.presenceMap[actorId] = {
            actorId,
            actorName: String(actorName || existing?.actorName || 'Campus Member').slice(0, 120),
            actorRole:
              actorRole === 'principal' || actorRole === 'usthad' ? actorRole : 'student',
            lastSeenMs: now,
            isOnline: false,
            hideOnline: Boolean(hideOnline ?? existing?.hideOnline),
          }
          for (const rId of Object.keys(campusChatState.typingMap)) {
            if (campusChatState.typingMap[rId]?.[actorId]) {
              delete campusChatState.typingMap[rId][actorId]
            }
          }
        }
        res.json({ ok: true, state: campusChatState })
        return
      }

      if (actorId && typeof actorId === 'string') {
        const shouldHide = Boolean(hideOnline)
        campusChatState.presenceMap[actorId] = {
          actorId,
          actorName: String(actorName || 'Campus Member').slice(0, 120),
          actorRole:
            actorRole === 'principal' || actorRole === 'usthad' ? actorRole : 'student',
          lastSeenMs: now,
          isOnline: !shouldHide,
          hideOnline: shouldHide,
        }
        // Automatically mark all incoming messages for this actor as delivered
        acknowledgeDeliveryForActor(
          actorId,
          typeof actorClassName === 'string' ? actorClassName : undefined,
          isStaffActor,
        )
      }

      if (action === 'mark_delivered_all') {
        res.json({ ok: true, state: campusChatState })
        return
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
        if (roomMeta.onlyAdminsCanPost && !isStaffActor) {
          res.status(403).json({
            error: 'Only Usthads and Principal can send messages in this group right now.',
          })
          return
        }

        const msgId =
          typeof message.id === 'string' && message.id
            ? message.id
            : `msg_${now}_${Math.random().toString(36).slice(2, 7)}`

        const senderIdStr = String(message.senderId || actorId || 'unknown').slice(0, 120)
        const senderNameStr = String(message.senderName || actorName || 'Member').slice(0, 120)

        // Check if recipient peer in a direct chat is currently online; if so, include them in deliveredTo immediately
        const initialDelivered = new Set<string>(
          Array.isArray(message.deliveredTo) ? message.deliveredTo : [senderIdStr],
        )
        initialDelivered.add(senderIdStr)
        const initialDeliveredAtMap: Record<string, number> =
          message.deliveredAtMap && typeof message.deliveredAtMap === 'object'
            ? { ...(message.deliveredAtMap as Record<string, number>) }
            : {}
        if (roomId.startsWith('direct__')) {
          const parts = roomId.split('__')
          const peerId = parts[1] === senderIdStr ? parts[2] : parts[1]
          if (peerId) {
            const peerPresence = campusChatState.presenceMap[peerId]
            if (peerPresence && now - peerPresence.lastSeenMs < 20000) {
              initialDelivered.add(peerId)
              if (!initialDeliveredAtMap[peerId]) {
                initialDeliveredAtMap[peerId] = now
              }
            }
          }
        }

        const initialReadBy = new Set<string>(
          Array.isArray(message.readBy) ? message.readBy : [senderIdStr],
        )
        initialReadBy.add(senderIdStr)
        const initialReadAtMap: Record<string, number> =
          message.readAtMap && typeof message.readAtMap === 'object'
            ? { ...(message.readAtMap as Record<string, number>) }
            : {}

        const existingIdx = campusChatState.messagesByRoom[roomId].findIndex(
          (m) => m.id === msgId,
        )
        if (existingIdx === -1) {
          const newMsg: ServerChatMessage = {
            id: msgId,
            roomId,
            senderId: senderIdStr,
            senderName: senderNameStr,
            senderRole:
              message.senderRole === 'principal' || message.senderRole === 'usthad'
                ? message.senderRole
                : 'student',
            senderBadge: message.senderBadge ? String(message.senderBadge).slice(0, 80) : undefined,
            text: String(message.text || '').slice(0, 4000),
            mediaType: ['none', 'voice', 'image', 'pdf', 'call', 'location', 'contact', 'poll'].includes(
              message.mediaType,
            )
              ? message.mediaType
              : 'none',
            callMeta:
              message.callMeta && typeof message.callMeta === 'object'
                ? {
                    callId: String(message.callMeta.callId || '').slice(0, 128),
                    callType: message.callMeta.callType === 'video' ? 'video' : 'voice',
                    callStatus: (
                      ['ringing', 'accepted', 'connected', 'declined', 'missed', 'ended', 'busy'].includes(
                        message.callMeta.callStatus,
                      )
                        ? message.callMeta.callStatus
                        : 'ended'
                    ) as
                      | 'ringing'
                      | 'accepted'
                      | 'connected'
                      | 'declined'
                      | 'missed'
                      | 'ended'
                      | 'busy',
                    durationSec:
                      typeof message.callMeta.durationSec === 'number'
                        ? Math.max(0, Math.min(86400, Math.round(message.callMeta.durationSec)))
                        : undefined,
                    callerId: String(message.callMeta.callerId || '').slice(0, 64),
                    calleeId: String(message.callMeta.calleeId || '').slice(0, 64),
                  }
                : undefined,
            locationMeta:
              message.locationMeta && typeof message.locationMeta === 'object'
                ? {
                    label: String(message.locationMeta.label || 'Shared Location').slice(0, 140),
                    address: message.locationMeta.address
                      ? String(message.locationMeta.address).slice(0, 220)
                      : undefined,
                    latitude: Number(message.locationMeta.latitude) || 0,
                    longitude: Number(message.locationMeta.longitude) || 0,
                  }
                : undefined,
            contactMeta:
              message.contactMeta && typeof message.contactMeta === 'object'
                ? {
                    actorId: String(message.contactMeta.actorId || '').slice(0, 64),
                    name: String(message.contactMeta.name || 'Campus Member').slice(0, 120),
                    role:
                      message.contactMeta.role === 'principal' ||
                      message.contactMeta.role === 'usthad'
                        ? message.contactMeta.role
                        : 'student',
                    subtitle: message.contactMeta.subtitle
                      ? String(message.contactMeta.subtitle).slice(0, 120)
                      : undefined,
                    avatarUrl: message.contactMeta.avatarUrl
                      ? String(message.contactMeta.avatarUrl).slice(0, 500)
                      : undefined,
                  }
                : undefined,
            pollMeta:
              message.pollMeta && typeof message.pollMeta === 'object'
                ? {
                    question: String(message.pollMeta.question || '').slice(0, 240),
                    options: Array.isArray(message.pollMeta.options)
                      ? message.pollMeta.options.slice(0, 8).map((opt: { id?: string; text?: string }, idx: number) => ({
                          id: String(opt?.id || `opt_${idx}`),
                          text: String(opt?.text || '').slice(0, 120),
                        }))
                      : [],
                    allowMultiple: Boolean(message.pollMeta.allowMultiple),
                    votes:
                      message.pollMeta.votes && typeof message.pollMeta.votes === 'object'
                        ? (message.pollMeta.votes as Record<string, string[]>)
                        : {},
                  }
                : undefined,
            mediaUrl: message.mediaUrl ? String(message.mediaUrl) : undefined,
            mediaName: message.mediaName ? String(message.mediaName).slice(0, 180) : undefined,
            mediaSizeLabel: message.mediaSizeLabel
              ? String(message.mediaSizeLabel).slice(0, 40)
              : undefined,
            mediaDurationSec:
              typeof message.mediaDurationSec === 'number' ? message.mediaDurationSec : undefined,
            imageQuality:
              message.imageQuality === 'hd' || message.imageQuality === 'standard'
                ? message.imageQuality
                : undefined,
            imageDimensions: message.imageDimensions
              ? String(message.imageDimensions).slice(0, 40)
              : undefined,
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
            deliveredTo: Array.from(initialDelivered),
            deliveredAtMap: initialDeliveredAtMap,
            readBy: Array.from(initialReadBy),
            readAtMap: initialReadAtMap,
            starredBy: Array.isArray(message.starredBy) ? message.starredBy.map(String) : [],
            isForwarded: Boolean(message.isForwarded),
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

          // Also guarantee a corresponding Campus Notification in campusState.notifications
          // so any device polling /api/campus/state immediately receives the message notification!
          const deterministicNotifId = `notif_chat_${msgId}`
          if (!campusState.notifications.some((n) => n.id === deterministicNotifId)) {
            const preview =
              newMsg.mediaType === 'pdf'
                ? `📄 Shared PDF Note: ${newMsg.mediaName || 'Document'}`
                : newMsg.mediaType === 'voice'
                  ? `🎤 Sent a Voice Note`
                  : newMsg.mediaType === 'image'
                    ? `📷 Shared ${newMsg.imageQuality === 'hd' ? 'HD ' : ''}Photo${newMsg.text ? `: ${newMsg.text.slice(0, 80)}` : ''}`
                    : newMsg.text.slice(0, 120)

            let targetRecipientId: string | undefined
            let targetClass: string | undefined
            let targetStaffOnly: boolean | undefined
            let notifTitle = `New Message from ${senderNameStr}`

            if (roomId.startsWith('direct__')) {
              const parts = roomId.split('__')
              targetRecipientId = parts[1] === senderIdStr ? parts[2] : parts[1]
            } else if (roomId.startsWith('batch_group__')) {
              targetClass = roomId.replace(/^batch_group__/, '').trim()
              notifTitle = `${senderNameStr} • ${targetClass} Group`
            } else if (roomId === 'staff_group__usthads') {
              targetStaffOnly = true
              notifTitle = `${senderNameStr} • Staff Room`
            }

            const chatNotif: ServerCampusNotification = {
              id: deterministicNotifId,
              type: 'chat',
              title: notifTitle,
              message: preview,
              targetRecipientId,
              targetClass,
              targetStaffOnly,
              actorId: senderIdStr,
              actorName: senderNameStr,
              href: '#campus-chat',
              createdAt: newMsg.createdAt,
              createdAtMs: newMsg.createdAtMs,
            }
            campusState.notifications = [chatNotif, ...campusState.notifications].slice(0, 80)
            campusState.updatedAtMs = now
            dispatchWebPushForNotification(chatNotif)
          }
        } else {
          // Merge deliveredTo and readBy if message already exists
          const existingMsg = campusChatState.messagesByRoom[roomId][existingIdx]
          existingMsg.deliveredTo = Array.from(
            new Set([...(existingMsg.deliveredTo || []), ...Array.from(initialDelivered)]),
          )
          existingMsg.readBy = Array.from(
            new Set([...(existingMsg.readBy || []), ...Array.from(initialReadBy)]),
          )
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
      } else if (action === 'mark_delivered' && actorId) {
        const list = campusChatState.messagesByRoom[roomId] || []
        let changed = false
        for (const msg of list) {
          if (!Array.isArray(msg.deliveredTo)) {
            msg.deliveredTo = msg.senderId ? [msg.senderId] : []
          }
          if (!msg.deliveredAtMap || typeof msg.deliveredAtMap !== 'object') {
            msg.deliveredAtMap = {}
          }
          if (!msg.deliveredTo.includes(actorId)) {
            msg.deliveredTo.push(actorId)
            if (!msg.deliveredAtMap[actorId]) msg.deliveredAtMap[actorId] = now
            changed = true
          } else if (actorId !== msg.senderId && !msg.deliveredAtMap[actorId]) {
            msg.deliveredAtMap[actorId] = now
            changed = true
          }
        }
        if (changed) {
          campusChatState.updatedAtMs = now
        }
      } else if (action === 'mark_read' && actorId) {
        const list = campusChatState.messagesByRoom[roomId] || []
        let changed = false
        for (const msg of list) {
          if (!Array.isArray(msg.deliveredTo)) {
            msg.deliveredTo = msg.senderId ? [msg.senderId] : []
          }
          if (!msg.deliveredAtMap || typeof msg.deliveredAtMap !== 'object') {
            msg.deliveredAtMap = {}
          }
          if (!msg.deliveredTo.includes(actorId)) {
            msg.deliveredTo.push(actorId)
            if (!msg.deliveredAtMap[actorId]) msg.deliveredAtMap[actorId] = now
            changed = true
          } else if (actorId !== msg.senderId && !msg.deliveredAtMap[actorId]) {
            msg.deliveredAtMap[actorId] = now
            changed = true
          }
          if (sendReadReceipts !== false) {
            if (!Array.isArray(msg.readBy)) {
              msg.readBy = msg.senderId ? [msg.senderId] : []
            }
            if (!msg.readAtMap || typeof msg.readAtMap !== 'object') {
              msg.readAtMap = {}
            }
            if (!msg.readBy.includes(actorId)) {
              msg.readBy.push(actorId)
              if (!msg.readAtMap[actorId]) msg.readAtMap[actorId] = now
              changed = true
            } else if (actorId !== msg.senderId && !msg.readAtMap[actorId]) {
              msg.readAtMap[actorId] = now
              changed = true
            }
          }
        }
        if (changed) {
          campusChatState.updatedAtMs = now
        }
      } else if (action === 'toggle_star' && actorId) {
        const list = campusChatState.messagesByRoom[roomId] || []
        const idsToUpdate: string[] = Array.isArray(messageIds)
          ? messageIds.map(String)
          : messageId
            ? [String(messageId)]
            : []
        let changed = false
        for (const target of list) {
          if (!idsToUpdate.includes(target.id) || target.isDeleted) continue
          const curStars = Array.isArray(target.starredBy) ? target.starredBy : []
          const shouldStar = typeof starred === 'boolean' ? starred : !curStars.includes(actorId)
          if (shouldStar && !curStars.includes(actorId)) {
            target.starredBy = [...curStars, actorId].slice(0, 300)
            changed = true
          } else if (!shouldStar && curStars.includes(actorId)) {
            target.starredBy = curStars.filter((id) => id !== actorId)
            changed = true
          }
        }
        if (changed) {
          campusChatState.updatedAtMs = now
        }
      } else if (action === 'toggle_pin') {
        const canPinRoom =
          isStaffActor ||
          (roomId.startsWith('direct__') && actorId && roomId.split('__').includes(String(actorId)))
        if (canPinRoom) {
          campusChatState.roomsMeta[roomId].pinnedMessageId =
            typeof pinnedMessageId === 'string' && pinnedMessageId ? pinnedMessageId : null
          campusChatState.roomsMeta[roomId].updatedAtMs = now
          campusChatState.updatedAtMs = now
        }
      } else if (action === 'delete_message' && messageId) {
        const list = campusChatState.messagesByRoom[roomId] || []
        const target = list.find((m) => m.id === messageId)
        if (target) {
          if (deleteMode === 'me' && actorId) {
            const curDeletedFor = Array.isArray(target.deletedFor) ? target.deletedFor : []
            if (!curDeletedFor.includes(actorId)) {
              target.deletedFor = [...curDeletedFor, actorId]
            }
            campusChatState.updatedAtMs = now
          } else {
            target.isDeleted = true
            target.deletedBy = String(actorName || 'Member').slice(0, 80)
            target.deletedById = actorId ? String(actorId).slice(0, 120) : undefined
            target.text = ''
            target.mediaType = 'none'
            target.mediaUrl = undefined
            if (campusChatState.roomsMeta[roomId].pinnedMessageId === messageId) {
              campusChatState.roomsMeta[roomId].pinnedMessageId = null
            }
            campusChatState.updatedAtMs = now
          }
        }
      } else if (action === 'vote_poll' && messageId && actorId && req.body?.optionId) {
        const optionId = String(req.body.optionId)
        const list = campusChatState.messagesByRoom[roomId] || []
        const target = list.find((m) => m.id === messageId)
        if (target && target.pollMeta) {
          const votes: Record<string, string[]> = { ...(target.pollMeta.votes || {}) }
          const curForOption = Array.isArray(votes[optionId]) ? [...votes[optionId]] : []
          const alreadyVoted = curForOption.includes(actorId)
          if (!target.pollMeta.allowMultiple) {
            for (const key of Object.keys(votes)) {
              votes[key] = (votes[key] || []).filter((id) => id !== actorId)
            }
          }
          if (alreadyVoted) {
            votes[optionId] = (votes[optionId] || []).filter((id) => id !== actorId)
          } else {
            votes[optionId] = Array.from(new Set([...(votes[optionId] || []), actorId]))
          }
          target.pollMeta = { ...target.pollMeta, votes }
          campusChatState.updatedAtMs = now
        }
      } else if (action === 'clear_chat_for_me' && actorId) {
        const list = campusChatState.messagesByRoom[roomId] || []
        for (const msg of list) {
          const cur = Array.isArray(msg.deletedFor) ? msg.deletedFor : []
          if (!cur.includes(actorId)) {
            msg.deletedFor = [...cur, actorId]
          }
        }
        campusChatState.updatedAtMs = now
      } else if (action === 'toggle_group_lock') {
        if (isStaffActor) {
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

  // Real-Time WhatsApp-Style 1-on-1 Voice & Video Call Signaling (Server Dual-Sync Fallback)
  type ServerCallStatus =
    | 'ringing'
    | 'accepted'
    | 'connected'
    | 'declined'
    | 'missed'
    | 'ended'
    | 'busy'

  interface ServerCampusCall {
    id: string
    campusId: 'ics-academy'
    roomId: string
    callType: 'voice' | 'video'
    callerId: string
    callerName: string
    callerRole: 'student' | 'usthad' | 'principal'
    callerSubtitle?: string
    calleeId: string
    calleeName: string
    calleeRole: 'student' | 'usthad' | 'principal'
    calleeSubtitle?: string
    status: ServerCallStatus
    offerSdp: string
    answerSdp?: string
    callerCandidates: string[]
    calleeCandidates: string[]
    startedAtMs: number
    connectedAtMs?: number
    endedAtMs?: number
    durationSec?: number
    updatedAtMs: number
  }

  const campusCallsStore: Record<string, ServerCampusCall> = {}

  function cleanupStaleCampusCalls(now: number) {
    const entries = Object.values(campusCallsStore)
    for (const c of entries) {
      if (c.status === 'ringing' && now - c.startedAtMs > 50000) {
        c.status = 'missed'
        c.endedAtMs = now
        c.durationSec = 0
        c.updatedAtMs = now
      }
    }
    if (entries.length > 220) {
      const sorted = entries.sort((a, b) => b.startedAtMs - a.startedAtMs)
      for (const stale of sorted.slice(200)) {
        delete campusCallsStore[stale.id]
      }
    }
  }

  app.get('/api/campus/call/state', (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    const now = Date.now()
    cleanupStaleCampusCalls(now)
    const actorId = typeof req.query.actorId === 'string' ? req.query.actorId.trim() : ''
    const callId = typeof req.query.callId === 'string' ? req.query.callId.trim() : ''

    if (callId && campusCallsStore[callId]) {
      res.json({ ok: true, call: campusCallsStore[callId], calls: [campusCallsStore[callId]] })
      return
    }

    const calls = Object.values(campusCallsStore)
      .filter((c) => !actorId || c.callerId === actorId || c.calleeId === actorId)
      .sort((a, b) => b.startedAtMs - a.startedAtMs)
      .slice(0, 80)

    res.json({ ok: true, calls })
  })

  app.post('/api/campus/call/action', (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const now = Date.now()
      cleanupStaleCampusCalls(now)
      const {
        action,
        callId,
        call,
        actorId,
        answerSdp,
        candidate,
        candidateSide,
        durationSec,
      } = req.body ?? {}

      const id = String(callId || call?.id || '').trim().slice(0, 128)
      if (!id) {
        res.status(400).json({ error: 'callId is required' })
        return
      }

      if (action === 'initiate' && call && typeof call === 'object') {
        const record: ServerCampusCall = {
          id,
          campusId: 'ics-academy',
          roomId: String(call.roomId || '').slice(0, 160),
          callType: call.callType === 'video' ? 'video' : 'voice',
          callerId: String(call.callerId || actorId || '').slice(0, 64),
          callerName: String(call.callerName || 'Member').slice(0, 120),
          callerRole:
            call.callerRole === 'principal' || call.callerRole === 'usthad'
              ? call.callerRole
              : 'student',
          callerSubtitle: call.callerSubtitle ? String(call.callerSubtitle).slice(0, 120) : undefined,
          calleeId: String(call.calleeId || '').slice(0, 64),
          calleeName: String(call.calleeName || 'Member').slice(0, 120),
          calleeRole:
            call.calleeRole === 'principal' || call.calleeRole === 'usthad'
              ? call.calleeRole
              : 'student',
          calleeSubtitle: call.calleeSubtitle ? String(call.calleeSubtitle).slice(0, 120) : undefined,
          status: 'ringing',
          offerSdp: String(call.offerSdp || '').slice(0, 24000),
          callerCandidates: Array.isArray(call.callerCandidates)
            ? call.callerCandidates.map(String).slice(0, 60)
            : [],
          calleeCandidates: [],
          startedAtMs: Number(call.startedAtMs) || now,
          updatedAtMs: now,
        }
        campusCallsStore[id] = record
        dispatchWebPushForIncomingCall(record)
        res.json({ ok: true, call: record })
        return
      }

      const existing = campusCallsStore[id]
      if (!existing) {
        res.json({ ok: true, call: null })
        return
      }

      const isTerminal =
        existing.status === 'declined' ||
        existing.status === 'missed' ||
        existing.status === 'ended' ||
        existing.status === 'busy'

      if (!isTerminal) {
        if (action === 'answer') {
          existing.status = 'accepted'
          if (typeof answerSdp === 'string' && answerSdp.length > 0) {
            existing.answerSdp = answerSdp.slice(0, 24000)
          }
          existing.connectedAtMs = existing.connectedAtMs || now
          existing.updatedAtMs = now
        } else if (action === 'connected') {
          existing.status = 'connected'
          existing.connectedAtMs = existing.connectedAtMs || now
          existing.updatedAtMs = now
        } else if (action === 'add_ice' && typeof candidate === 'string' && candidate.length > 0) {
          const side =
            candidateSide === 'caller' || actorId === existing.callerId ? 'caller' : 'callee'
          if (side === 'caller') {
            if (!existing.callerCandidates.includes(candidate) && existing.callerCandidates.length < 60) {
              existing.callerCandidates.push(candidate)
            }
          } else if (
            !existing.calleeCandidates.includes(candidate) &&
            existing.calleeCandidates.length < 60
          ) {
            existing.calleeCandidates.push(candidate)
          }
          existing.updatedAtMs = now
        } else if (
          action === 'decline' ||
          action === 'missed' ||
          action === 'ended' ||
          action === 'end' ||
          action === 'busy'
        ) {
          existing.status =
            action === 'decline'
              ? 'declined'
              : action === 'end'
                ? 'ended'
                : (action as ServerCallStatus)
          existing.endedAtMs = now
          existing.durationSec =
            typeof durationSec === 'number'
              ? Math.max(0, Math.min(86400, Math.round(durationSec)))
              : existing.connectedAtMs
                ? Math.max(0, Math.round((now - existing.connectedAtMs) / 1000))
                : 0
          existing.updatedAtMs = now
        }
      }

      res.json({ ok: true, call: existing })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Call action failed' })
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

