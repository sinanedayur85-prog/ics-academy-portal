import * as React from 'react'
import { jsPDF } from 'jspdf'
import { CLASS_USTHADS, type Student } from '@/components/dashboard/data'
import { downloadBlobOnDevice, printPdfBlobOnDevice } from '@/lib/mobile-pdf'

export interface StudyNoteExportData {
  msgId: string
  prompt: string
  response: string
  personaTitle: string
}

export type CachedVectorPdfAssets = {
  regularB64: string
  semiBoldB64: string
  boldB64: string
  elMessiriBoldB64: string
  uthmanRegularB64: string
  uthmanBoldB64: string
  logoDataUrl: string | null
}

let cachedVectorAssetsPromise: Promise<CachedVectorPdfAssets> | null = null
let cachedVectorAssetsSync: CachedVectorPdfAssets | null = null

export function getCachedVectorPdfAssets(): CachedVectorPdfAssets | null {
  return cachedVectorAssetsSync
}

const EASTERN_ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const

export function toArabicNumerals(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => EASTERN_ARABIC_DIGITS[Number(d)] ?? d)
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(sub))
  }
  return window.btoa(binary)
}

export async function loadVectorPdfAssets(): Promise<CachedVectorPdfAssets> {
  if (cachedVectorAssetsSync) return cachedVectorAssetsSync
  if (cachedVectorAssetsPromise) return cachedVectorAssetsPromise

  cachedVectorAssetsPromise = (async () => {
    const [regRes, semiRes, boldRes, elMessiriRes, uthmanRegRes, uthmanBoldRes, logoRes] =
      await Promise.all([
        fetch('/fonts/Poppins-Regular.ttf'),
        fetch('/fonts/Poppins-SemiBold.ttf'),
        fetch('/fonts/Poppins-Bold.ttf'),
        fetch('/fonts/ElMessiri-Bold.ttf'),
        fetch('/fonts/UthmanTN1-Regular.ttf'),
        fetch('/fonts/UthmanTN1-Bold.ttf'),
        fetch('/images/ics-mark-transparent.png').catch(() => null),
      ])

    const [regBuf, semiBuf, boldBuf, elMessiriBuf, uthmanRegBuf, uthmanBoldBuf] =
      await Promise.all([
        regRes.arrayBuffer(),
        semiRes.arrayBuffer(),
        boldRes.arrayBuffer(),
        elMessiriRes.arrayBuffer(),
        uthmanRegRes.arrayBuffer(),
        uthmanBoldRes.arrayBuffer(),
      ])

    // Ensure KFGQPC Uthman Taha Naskh is also registered in document.fonts for any mixed-script canvas measurement
    if (typeof window !== 'undefined' && 'FontFace' in window && document.fonts) {
      try {
        const uthmanRegFace = new FontFace('KFGQPC Uthman Taha Naskh', uthmanRegBuf.slice(0), {
          weight: '400',
          style: 'normal',
        })
        const uthmanBoldFace = new FontFace('KFGQPC Uthman Taha Naskh', uthmanBoldBuf.slice(0), {
          weight: '700',
          style: 'normal',
        })
        const [loadedReg, loadedBold] = await Promise.all([
          uthmanRegFace.load(),
          uthmanBoldFace.load(),
        ])
        document.fonts.add(loadedReg)
        document.fonts.add(loadedBold)
      } catch {
        // Proceed even if FontFace registration is already satisfied
      }
    }

    let logoDataUrl: string | null = null
    if (logoRes && logoRes.ok) {
      const logoBuf = await logoRes.arrayBuffer()
      logoDataUrl = `data:image/png;base64,${arrayBufferToBase64(logoBuf)}`
    }

    const loaded: CachedVectorPdfAssets = {
      regularB64: arrayBufferToBase64(regBuf),
      semiBoldB64: arrayBufferToBase64(semiBuf),
      boldB64: arrayBufferToBase64(boldBuf),
      elMessiriBoldB64: arrayBufferToBase64(elMessiriBuf),
      uthmanRegularB64: arrayBufferToBase64(uthmanRegBuf),
      uthmanBoldB64: arrayBufferToBase64(uthmanBoldBuf),
      logoDataUrl,
    }
    cachedVectorAssetsSync = loaded
    return loaded
  })()

  return cachedVectorAssetsPromise
}

/**
 * Registers Poppins (normal, semibold, bold), ElMessiri (bold), and UthmanTN1 (normal, bold)
 * TrueType vector fonts on a jsPDF instance and disables jsPDF's broken built-in processArabic
 * hook so our exact UthmanTN1 Arabic Contextual Shaper renders 100% crisp vector Arabic glyphs.
 */
export function registerOfficialVectorPdfFonts(
  pdf: jsPDF,
  assets: CachedVectorPdfAssets,
): void {
  // Disable jsPDF's broken internal processArabic hook so UthmanTN1 codepoints are preserved
  const api = (jsPDF as unknown as { API?: { processArabic?: (t: unknown) => unknown } }).API
  if (api && typeof api.processArabic === 'function') {
    api.processArabic = (arg: unknown) => arg
  }
  const internalEvents = (
    pdf.internal as unknown as {
      events?: {
        getTopics?: () => Record<string, Record<string, unknown>>
        unsubscribe?: (key: string) => void
      }
    }
  ).events
  if (internalEvents && typeof internalEvents.getTopics === 'function') {
    const topics = internalEvents.getTopics()
    if (topics && topics.preProcessText && typeof internalEvents.unsubscribe === 'function') {
      for (const subKey of Object.keys(topics.preProcessText)) {
        internalEvents.unsubscribe(subKey)
      }
    }
  }

  pdf.addFileToVFS('Poppins-Regular.ttf', assets.regularB64)
  pdf.addFont('Poppins-Regular.ttf', 'Poppins', 'normal')
  pdf.addFileToVFS('Poppins-SemiBold.ttf', assets.semiBoldB64)
  pdf.addFont('Poppins-SemiBold.ttf', 'Poppins', 'semibold')
  pdf.addFileToVFS('Poppins-Bold.ttf', assets.boldB64)
  pdf.addFont('Poppins-Bold.ttf', 'Poppins', 'bold')

  pdf.addFileToVFS('ElMessiri-Bold.ttf', assets.elMessiriBoldB64)
  pdf.addFont('ElMessiri-Bold.ttf', 'ElMessiri', 'bold')
  pdf.addFont('ElMessiri-Bold.ttf', 'ElMessiri', 'normal')

  pdf.addFileToVFS('UthmanTN1-Regular.ttf', assets.uthmanRegularB64)
  pdf.addFont('UthmanTN1-Regular.ttf', 'UthmanTN1', 'normal')
  pdf.addFileToVFS('UthmanTN1-Bold.ttf', assets.uthmanBoldB64)
  pdf.addFont('UthmanTN1-Bold.ttf', 'UthmanTN1', 'bold')
}

// ==================== UTHMAN TAHA NASKH 100% VECTOR ARABIC SHAPER ====================
// Maps Unicode Arabic/Urdu base codepoints to [isolated, final, initial, medial] glyphs in UthmanTN1
const UTHMAN_ARABIC_FORMS: Record<number, number[]> = {
  0x0621: [0x0621], // ء
  0x0622: [0x0622, 0xfe82], // آ
  0x0623: [0x0623, 0xfe84], // أ
  0x0624: [0x0624, 0xfe86], // ؤ
  0x0625: [0x0625, 0xfe88], // إ
  0x0626: [0x0626, 0xfe8a, 0xfe8b, 0xfe8c], // ئ
  0x0627: [0x0627, 0xfe8e], // ا
  0x0628: [0x0628, 0xfe90, 0xfe91, 0xfe92], // ب
  0x0629: [0x0629, 0xfe94], // ة
  0x062a: [0x062a, 0xfe96, 0xfe97, 0xfe98], // ت
  0x062b: [0x062b, 0xfe9a, 0xfe9b, 0xfe9c], // ث
  0x062c: [0x062c, 0xfe9e, 0xfe9f, 0xfea0], // ج
  0x062d: [0x062d, 0xfea2, 0xfea3, 0xfea4], // ح
  0x062e: [0x062e, 0xfea6, 0xfea7, 0xfea8], // خ
  0x062f: [0x062f, 0xfeaa], // د
  0x0630: [0x0630, 0xfeac], // ذ
  0x0631: [0x0631, 0xfeae], // ر
  0x0632: [0x0632, 0xfeb0], // ز
  0x0633: [0x0633, 0xfeb2, 0xfeb3, 0xfeb4], // س
  0x0634: [0x0634, 0xfeb6, 0xfeb7, 0xfeb8], // ش
  0x0635: [0x0635, 0xfeba, 0xfebb, 0xfebc], // ص
  0x0636: [0x0636, 0xfebe, 0xfebf, 0xfec0], // ض
  0x0637: [0x0637, 0xfec2, 0xfec3, 0xfec4], // ط
  0x0638: [0x0638, 0xfec6, 0xfec7, 0xfec8], // ظ
  0x0639: [0x0639, 0xfeca, 0xfecb, 0xfecc], // ع
  0x063a: [0x063a, 0xfece, 0xfecf, 0xfed0], // غ
  0x0641: [0x0641, 0xfed2, 0xfed3, 0xfed4], // ف
  0x0642: [0x0642, 0xfed6, 0xfed7, 0xfed8], // ق
  0x0643: [0x0643, 0xfeda, 0xfedb, 0xfedc], // ك
  0x0644: [0x0644, 0xfede, 0xfedf, 0xfee0], // ل
  0x0645: [0x0645, 0xfee2, 0xfee3, 0xfee4], // م
  0x0646: [0x0646, 0xfee6, 0xfee7, 0xfee8], // ن
  0x0647: [0x0647, 0xfeea, 0xfeeb, 0xfeec], // ه
  0x0648: [0x0648, 0xfeee], // و
  0x0649: [0x0649, 0xfef0, 0xfbe8, 0xfbe9], // ى
  0x064a: [0x064a, 0xfef2, 0xfef3, 0xfef4], // ي
  0x0671: [0x0627, 0xfe8e], // ٱ
  0x0679: [0x0679, 0xfb67, 0xfb68, 0xfb69], // ٹ
  0x067e: [0x067e, 0xfb57, 0xfb58, 0xfb59], // پ
  0x0686: [0x0686, 0xfb7b, 0xfb7c, 0xfb7d], // چ
  0x0688: [0x0688, 0xfb89], // ڈ
  0x0691: [0x0691, 0xfb8d], // ڑ
  0x0698: [0x0698, 0xfb8b], // ژ
  0x06a9: [0x06a9, 0xfb8f, 0xfb90, 0xfb91], // ک
  0x06af: [0x06af, 0xfb93, 0xfb94, 0xfb95], // گ
  0x06ba: [0x06ba, 0xfb9f], // ں
  0x06be: [0x06be, 0xfbab, 0xfbac, 0xfbad], // ھ
  0x06c1: [0x06c1, 0xfba7, 0xfba8, 0xfba9], // ہ
  0x06cc: [0x064a, 0xfef2, 0xfef3, 0xfef4], // ی
  0x06d2: [0x06d2, 0xfbaf], // ے
}

const LAM_ALEF_ISOLATED: Record<number, number> = {
  0x0622: 0xfef5,
  0x0623: 0xfef7,
  0x0625: 0xfef9,
  0x0627: 0xfefb,
  0x0671: 0xfefb,
}

const LAM_ALEF_FINAL: Record<number, number> = {
  0x0622: 0xfef6,
  0x0623: 0xfef8,
  0x0625: 0xfefa,
  0x0627: 0xfefc,
  0x0671: 0xfefc,
}

const RTL_BRACKET_MIRROR: Record<string, string> = {
  '(': ')',
  ')': '(',
  '[': ']',
  ']': '[',
  '{': '}',
  '}': '{',
  '«': '»',
  '»': '«',
  '<': '>',
  '>': '<',
}

function isArabicDiacriticCode(cp: number): boolean {
  return (
    (cp >= 0x0610 && cp <= 0x061a) ||
    (cp >= 0x064b && cp <= 0x065f) ||
    cp === 0x0670 ||
    (cp >= 0x06d6 && cp <= 0x06ed)
  )
}

function canArabicJoinLeft(cp: number): boolean {
  const f = UTHMAN_ARABIC_FORMS[cp]
  return Boolean(f && f.length === 4)
}

function canArabicJoinRight(cp: number): boolean {
  const f = UTHMAN_ARABIC_FORMS[cp]
  return Boolean(f && f.length >= 2)
}

/**
 * Shapes an Arabic/Urdu word into contextual UthmanTN1 glyphs (preserving all harakat
 * on each base letter) and returns the visual left-to-right string for jsPDF.
 */
function shapeArabicWordToVisualLtr(word: string): string {
  const clusters: Array<{
    baseCp: number
    char: string
    diacritics: string
    isArabic: boolean
  }> = []

  for (let i = 0; i < word.length; i++) {
    const cp = word.charCodeAt(i)
    if (isArabicDiacriticCode(cp) && clusters.length > 0) {
      clusters[clusters.length - 1].diacritics += word[i]
    } else if (cp === 0x0640) {
      // Skip tatweel kashida so letters join directly in UthmanTN1
      continue
    } else {
      clusters.push({
        baseCp: cp,
        char: word[i],
        diacritics: '',
        isArabic: Boolean(UTHMAN_ARABIC_FORMS[cp]),
      })
    }
  }

  const shapedVisualClusters: string[] = []
  let prevJoinsLeft = false

  for (let i = 0; i < clusters.length; i++) {
    const cur = clusters[i]
    if (!cur.isArabic) {
      shapedVisualClusters.push(cur.char + cur.diacritics)
      prevJoinsLeft = false
      continue
    }

    const next = clusters[i + 1]

    // Lam + Alef ligature resolution
    if (cur.baseCp === 0x0644 && next && LAM_ALEF_ISOLATED[next.baseCp]) {
      const ligCp = prevJoinsLeft ? LAM_ALEF_FINAL[next.baseCp] : LAM_ALEF_ISOLATED[next.baseCp]
      shapedVisualClusters.push(String.fromCharCode(ligCp) + cur.diacritics + next.diacritics)
      prevJoinsLeft = false
      i++
      continue
    }

    const nextJoinsRight = Boolean(next && next.isArabic && canArabicJoinRight(next.baseCp))
    const forms = UTHMAN_ARABIC_FORMS[cur.baseCp]
    let formIdx = 0
    if (prevJoinsLeft && nextJoinsRight && forms.length === 4) {
      formIdx = 3 // medial
    } else if (prevJoinsLeft && forms.length >= 2) {
      formIdx = 1 // final
    } else if (nextJoinsRight && forms.length === 4) {
      formIdx = 2 // initial
    } else {
      formIdx = 0 // isolated
    }

    const shapedCp = forms[formIdx] ?? cur.baseCp
    shapedVisualClusters.push(String.fromCharCode(shapedCp) + cur.diacritics)
    prevJoinsLeft = canArabicJoinLeft(cur.baseCp)
  }

  return shapedVisualClusters.reverse().join('')
}

/**
 * Converts a logical RTL Arabic/Urdu line into a visual left-to-right string ready for
 * `pdf.text(visualLine, rightX, y, { align: 'right' })` using the embedded UthmanTN1 font.
 */
export function shapeArabicLineForUthmanVector(
  logicalLine: string,
  convertWesternDigits = true,
): string {
  const normalized = (convertWesternDigits ? toArabicNumerals(logicalLine) : logicalLine)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, '-')

  // Tokenize into whitespace, Arabic letter+diacritic runs, number runs, Latin runs, or punctuation
  const tokenRegex =
    /(\s+|[\u0621-\u064A\u0671-\u06D3\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]+|[0-9\u0660-\u0669\u06F0-\u06F9]+|[A-Za-z\u00C0-\u024F]+|.)/g
  const rawTokens = normalized.match(tokenRegex) || []

  const visualTokens = rawTokens.map((tok) => {
    if (/^\s+$/.test(tok)) return ' '
    if (/^[\u0621-\u064A\u0671-\u06D3]/.test(tok)) {
      return shapeArabicWordToVisualLtr(tok)
    }
    if (/^[0-9\u0660-\u0669\u06F0-\u06F9]+$/.test(tok)) {
      // Numbers in Arabic read left-to-right (e.g., ١٢ stays ١ then ٢)
      return tok
    }
    if (/^[A-Za-z\u00C0-\u024F]+$/.test(tok)) {
      return tok
    }
    if (RTL_BRACKET_MIRROR[tok]) {
      return RTL_BRACKET_MIRROR[tok]
    }
    return tok
  })

  return visualTokens.reverse().join('')
}

/**
 * Word-wraps a logical Arabic/Urdu paragraph to fit strictly within `maxWidthMm`
 * using the embedded vector UthmanTN1 font metrics, returning visual LTR strings
 * ready to draw right-aligned via `pdf.text(line, rightX, y, { align: 'right' })`.
 */
export function splitVectorArabicTextToLines(
  pdf: jsPDF,
  logicalText: string,
  maxWidthMm: number,
  fontSizePt: number,
  weight: 'normal' | 'bold' = 'normal',
  convertWesternDigits = true,
): string[] {
  const clean = stripMarkdownTokens(
    convertWesternDigits ? toArabicNumerals(logicalText) : logicalText,
  )
  if (!clean) return []

  pdf.setFont('UthmanTN1', weight)
  pdf.setFontSize(fontSizePt)

  const words = clean.split(/\s+/).filter(Boolean)
  const logicalLines: string[] = []
  let currentLogical = ''

  for (const word of words) {
    const candidate = currentLogical ? `${currentLogical} ${word}` : word
    const shapedCandidate = shapeArabicLineForUthmanVector(candidate, convertWesternDigits)
    const widthMm = pdf.getTextWidth(shapedCandidate)

    if (widthMm > maxWidthMm - 1 && currentLogical) {
      logicalLines.push(currentLogical)
      currentLogical = word
    } else {
      currentLogical = candidate
    }
  }
  if (currentLogical) {
    logicalLines.push(currentLogical)
  }

  return logicalLines.map((ln) => shapeArabicLineForUthmanVector(ln, convertWesternDigits))
}

export function isUrduText(text: string): boolean {
  if (!text) return false
  if (/[\u0D00-\u0D7F]{2,}/.test(text)) return false
  return (
    /[\u0679\u067E\u0686\u0688\u0691\u0698\u06AF\u06BA\u06BE\u06C1\u06C2\u06C3\u06D2\u06D4]/.test(
      text,
    ) ||
    /(?:^|\s)(?:کیا|کیوں|کیسے|ہے|ہیں|میں|کو|سے|پر|اور|کا|کی|کے)(?:\s|$|[۔،؟!])/.test(text)
  )
}

export function isUrduLine(line: string): boolean {
  if (!line) return false
  if (/[\u0D00-\u0D7F]{2,}/.test(line)) return false
  return (
    /[\u0679\u067E\u0686\u0688\u0691\u0698\u06AF\u06BA\u06BE\u06C1\u06C2\u06C3\u06D2\u06D4]/.test(
      line,
    ) ||
    /(?:^|\s)(?:کیا|کیوں|کیسے|ہے|ہیں|میں|کو|سے|پر|اور|کا|کی|کے)(?:\s|$|[۔،؟!])/.test(line)
  )
}

export function detectInputLanguage<T extends 'ml' | 'en' | 'ar' | 'ur' | 'es' | 'de'>(
  text: string,
  fallbackLanguage: T,
  history?: { role: 'user' | 'model'; text: string }[],
): T {
  if (!text || !text.trim()) {
    if (history && history.length > 0) {
      for (let i = history.length - 1; i >= 0; i--) {
        const turnText = history[i]?.text || ''
        if (/[\u0D00-\u0D7F]{3,}/.test(turnText)) return 'ml' as T
        if (isUrduText(turnText)) return 'ur' as T
      }
    }
    return fallbackLanguage
  }
  const clean = text.trim()

  if (
    /[\u0D00-\u0D7F]/.test(clean) ||
    /\b(in\s+malayalam|malayalathil|malayalam\s+meaning|malayalam\s+translation)\b/i.test(clean)
  ) {
    return 'ml' as T
  }

  if (isUrduText(clean)) {
    return 'ur' as T
  }

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
          return 'ml' as T
        }
        if (isUrduText(turnText)) {
          return 'ur' as T
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
          return 'en' as T
        }
      }
    }
    return 'ar' as T
  }

  const totalLatinChars = (stripped.match(/[A-Za-z\u00C0-\u024F]/g) || []).length
  if (totalLatinChars >= 2) {
    if (
      /\b(enthanu|enthokkeyanu|enthokke|parayamo|parayu|engane|enganeyanu|vishadeekarikamo|vishadeekarikkuka|artham|sharthukal|farzukal|sunnathukal|vivarikkuka|entha|manassilayilla|padippikkamo|chodyam|utharam|malayalathil|paribhasha|sughamano|sugamano|namaskaram|niskaram|usthade|orennam|onnu|randu|moonnu|shariyano|athe|alla)\b/i.test(
        clean,
      )
    ) {
      return 'ml' as T
    }
    if (
      /[¿¡ñÑáéíóúÁÉÍÓÚ]/.test(clean) ||
      /\b(qué|cómo|cuál|cuáles|explica|explicar|según|por\s+favor|hola|gracias|condiciones|diferencia)\b/i.test(
        clean,
      )
    ) {
      return 'es' as T
    }
    if (
      /[äöüßÄÖÜ]/.test(clean) ||
      /\b(erkläre|erklären|gemäß|was\s+ist|wie\s+sind|bitte|danke|bedingungen|unterschied)\b/i.test(
        clean,
      )
    ) {
      return 'de' as T
    }
    if (clean.length <= 24 && history && history.length > 0) {
      const lastTurn = history[history.length - 1]?.text || ''
      if (/[\u0D00-\u0D7F]{3,}/.test(lastTurn)) return 'ml' as T
      if (isUrduText(lastTurn)) return 'ur' as T
    }
    return 'en' as T
  }

  return fallbackLanguage
}

export function isArabicText(text: string): boolean {
  if (!text) return false
  if (/[\u0D00-\u0D7F]{2,}/.test(text)) return false
  const stripped = text.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
  const arabicChars = (
    stripped.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []
  ).length
  const ltrChars = (stripped.match(/[A-Za-z\u00C0-\u024F\u0D00-\u0D7F]/g) || []).length
  return arabicChars > 0 && arabicChars > ltrChars
}

export function isArabicLine(line: string): boolean {
  if (!line) return false
  if (/[\u0D00-\u0D7F]{2,}/.test(line)) return false
  const stripped = line.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
  const arabicChars = (
    stripped.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []
  ).length
  const ltrChars = (stripped.match(/[A-Za-z\u00C0-\u024F\u0D00-\u0D7F]/g) || []).length
  if (ltrChars >= 4 && arabicChars <= ltrChars * 1.5) {
    return false
  }
  return arabicChars > 0 && arabicChars > ltrChars
}

function hasMalayalamScript(text: string): boolean {
  if (!text) return false
  return /[\u0D00-\u0D7F]/.test(text)
}

function hasArabicOrUrduScript(text: string): boolean {
  if (!text) return false
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text)
}

function stripMarkdownTokens(text: string): string {
  return text
    .replace(/\*\*\*([\s\S]+?)\*\*\*/g, '$1')
    .replace(/___([\s\S]+?)___/g, '$1')
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    .replace(/__([\s\S]+?)__/g, '$1')
    .replace(/\*([^\s*](?:[\s\S]*?[^\s*])?)\*/g, '$1')
    .replace(/_([^\s_](?:[\s\S]*?[^\s_])?)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

function sanitizeVectorLatinText(text: string): string {
  return stripMarkdownTokens(text)
    .replace(/[•‧∙]/g, '-')
    .replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Renders Malayalam (or mixed Malayalam+Arabic) lines using the browser's HarfBuzz
 * shaper at 5x resolution with KFGQPC Uthman Taha Naskh preloaded.
 * Note: Pure Arabic/Urdu lines do NOT use this—they are rendered as 100% TrueType
 * Vector glyphs directly via `UthmanTN1` in `jsPDF`!
 */
function renderMalayalamBlockToPng(params: {
  text: string
  widthMm: number
  fontSizePt: number
  fontWeight: 'normal' | 'semibold' | 'bold'
  colorHex: string
  alignRight?: boolean
}): { dataUrl: string; heightMm: number } | null {
  if (typeof document === 'undefined') return null
  const cleanText = stripMarkdownTokens(params.text).replace(/ദാ?അ്\s*വാ?/g, 'ദഅ്\u200cവ')
  if (!cleanText) return null

  const pxPerMm = 3.7795275591
  const scale = 5
  const widthPx = Math.floor(params.widthMm * pxPerMm)
  const fontSizePx = Math.round(params.fontSizePt * 1.3333)
  const lineHeightPx = Math.round(fontSizePx * 1.72)
  const weightNum =
    params.fontWeight === 'bold' ? 700 : params.fontWeight === 'semibold' ? 600 : 400
  const fontFamily =
    "'Noto Serif Malayalam', 'KFGQPC Uthman Taha Naskh', 'Poppins', sans-serif"

  const measureCanvas = document.createElement('canvas')
  const mCtx = measureCanvas.getContext('2d')
  if (!mCtx) return null
  mCtx.font = `${weightNum} ${fontSizePx}px ${fontFamily}`

  const words = cleanText.split(/\s+/)
  const wrappedLines: string[] = []
  let currentLine = ''

  for (const word of words) {
    if (!word) continue
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const metrics = mCtx.measureText(testLine)
    if (metrics.width > widthPx - 4 && currentLine) {
      wrappedLines.push(currentLine)
      if (mCtx.measureText(word).width > widthPx - 4) {
        let charChunk = ''
        for (const ch of Array.from(word)) {
          if (mCtx.measureText(charChunk + ch).width > widthPx - 8 && charChunk) {
            wrappedLines.push(charChunk)
            charChunk = ch
          } else {
            charChunk += ch
          }
        }
        currentLine = charChunk
      } else {
        currentLine = word
      }
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) {
    wrappedLines.push(currentLine)
  }

  if (wrappedLines.length === 0) return null

  const padTopPx = Math.ceil(fontSizePx * 0.25)
  const padBottomPx = Math.ceil(fontSizePx * 0.35)
  const totalHeightPx = wrappedLines.length * lineHeightPx + padTopPx + padBottomPx

  const canvas = document.createElement('canvas')
  canvas.width = widthPx * scale
  canvas.height = totalHeightPx * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.scale(scale, scale)
  ctx.clearRect(0, 0, widthPx, totalHeightPx)
  ctx.font = `${weightNum} ${fontSizePx}px ${fontFamily}`
  ctx.fillStyle = params.colorHex
  ctx.textBaseline = 'top'

  const useRtl = Boolean(params.alignRight)
  ctx.direction = useRtl ? 'rtl' : 'ltr'
  ctx.textAlign = useRtl ? 'right' : 'left'
  const drawX = useRtl ? widthPx - 2 : 2

  wrappedLines.forEach((ln, idx) => {
    const drawY = padTopPx + idx * lineHeightPx
    ctx.fillText(ln, drawX, drawY)
  })

  return {
    dataUrl: canvas.toDataURL('image/png'),
    heightMm: totalHeightPx / pxPerMm,
  }
}

export function renderPrintScriptRuns(text: string, keyPrefix: string): React.ReactNode {
  const scriptRegex =
    /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+(?:[\s،؛؟«»ـ\-/:,.0-9\u0660-\u0669\u06F0-\u06F9]+[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)*[،؛؟.!0-9\u0660-\u0669]*|[\u0D00-\u0D7F\u200C\u200D]+(?:\s+[\u0D00-\u0D7F\u200C\u200D]+)*)/g
  const parts = text.split(scriptRegex)
  if (parts.length <= 1) return text

  return parts.map((part, idx) => {
    if (!part) return null
    if (/[\u0D00-\u0D7F]/.test(part)) {
      return (
        <span
          key={`${keyPrefix}-ml-${idx}`}
          style={{ fontFamily: "'Noto Serif Malayalam', Georgia, serif" }}
        >
          {part}
        </span>
      )
    }
    if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(part)) {
      const partIsUrdu = isUrduText(part)
      const displayPart = partIsUrdu ? part : toArabicNumerals(part)
      return (
        <bdi
          key={`${keyPrefix}-ar-${idx}`}
          dir="rtl"
          style={{
            fontFamily: partIsUrdu
              ? "'Noto Nastaliq Urdu', 'KFGQPC Uthman Taha Naskh', serif"
              : "'KFGQPC Uthman Taha Naskh', 'Noto Sans Arabic', serif",
            fontWeight: 600,
            margin: '0 2px',
          }}
        >
          {displayPart}
        </bdi>
      )
    }
    return <React.Fragment key={`${keyPrefix}-tx-${idx}`}>{part}</React.Fragment>
  })
}

export function StudyNotePrintTemplate({
  note,
  student,
  containerRef,
}: {
  note: StudyNoteExportData | null
  student: Student
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  if (!note) return null
  return <div ref={containerRef} className="hidden" aria-hidden="true" />
}

/**
 * Generates a 100% Vector ICS Academy Official Study Note PDF with:
 * - Embedded ElMessiri-Bold.ttf for "ICS ACADEMY MANHAPPATTA" in headers & footers
 * - Embedded UthmanTN1-Regular.ttf & UthmanTN1-Bold.ttf for 100% true vector
 *   KFGQPC Uthman Taha Naskh Arabic & Eastern Arabic numerals (٠-٩)
 * - Embedded Poppins-Regular/SemiBold/Bold.ttf for English/Latin text
 */
export async function exportStudyNoteDirectPdf({
  element,
  fileName,
  action = 'download',
  note,
  student,
}: {
  element?: HTMLElement | null
  fileName: string
  action?: 'download' | 'print'
  note?: StudyNoteExportData | null
  student?: Student
}): Promise<void> {
  void element

  if (
    typeof document !== 'undefined' &&
    document.fonts &&
    typeof document.fonts.ready !== 'undefined'
  ) {
    try {
      await document.fonts.ready
    } catch {
      // Proceed even if web font promise rejects
    }
  }

  const assets = await loadVectorPdfAssets()
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  registerOfficialVectorPdfFonts(pdf, assets)

  const setFont = (weight: 'normal' | 'semibold' | 'bold', sizePt: number) => {
    pdf.setFont('Poppins', weight)
    pdf.setFontSize(sizePt)
  }

  const setElMessiriFont = (sizePt: number) => {
    pdf.setFont('ElMessiri', 'bold')
    pdf.setFontSize(sizePt)
  }

  const setUthmanFont = (weight: 'normal' | 'bold', sizePt: number) => {
    pdf.setFont('UthmanTN1', weight)
    pdf.setFontSize(sizePt)
  }

  const safeStudent: Student =
    student ??
    ({
      id: 'student',
      name: 'ICS Academy Student',
      firstName: 'Student',
      admissionNo: 'ICS-2026',
      className: 'BS 4',
      semester: 'Semester 2',
      cgpa: 0,
      creditsCompleted: 0,
      creditsTotal: 0,
      attendance: {
        overall: 100,
        present: 100,
        absent: 0,
        leave: 0,
        workingDays: 100,
        officialHolidayDays: 0,
      },
      subjects: [],
      monthlyAttendance: [],
    } as unknown as Student)

  const safeNote: StudyNoteExportData = note ?? {
    msgId: 'note-001',
    prompt: fileName || 'Academic Study Note',
    response: '',
    personaTitle: 'Usthad Kitab Mentor',
  }

  const classUsthad =
    CLASS_USTHADS.find((u) => u.className === safeStudent.className) ?? CLASS_USTHADS[0]

  const issueDateFormatted = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  const refCode = `ICS-NOTE-${safeNote.msgId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || '2026'}`
  const LOGO_ASPECT_RATIO = 381 / 512

  const drawOuterSheetCard = () => {
    pdf.setFillColor(255, 255, 255)
    pdf.setDrawColor(203, 213, 225)
    pdf.setLineWidth(0.3)
    pdf.roundedRect(8, 8, 194, 281, 3, 3, 'FD')
  }

  const drawLogoBadge = (
    boxX: number,
    boxY: number,
    boxSize: number,
    radius: number,
    pad: number,
  ) => {
    pdf.setFillColor(255, 255, 255)
    pdf.roundedRect(boxX, boxY, boxSize, boxSize, radius, radius, 'F')
    if (!assets.logoDataUrl) return
    const drawH = boxSize - pad * 2
    const drawW = drawH * LOGO_ASPECT_RATIO
    const imgX = boxX + (boxSize - drawW) / 2
    const imgY = boxY + (boxSize - drawH) / 2
    pdf.addImage(assets.logoDataUrl, 'PNG', imgX, imgY, drawW, drawH)
  }

  // ==================== VECTOR PAGE 1 HEADER & STUDENT SUMMARY ====================
  drawOuterSheetCard()

  // 1. Official ICS Academy Dark Teal Header Banner (#081E21)
  pdf.setFillColor(8, 30, 33)
  pdf.roundedRect(13, 13, 184, 22, 2.8, 2.8, 'F')

  // White Logo Badge (16x16mm square with exact 381:512 object-contain logo)
  drawLogoBadge(16.5, 16, 16, 2, 1.8)

  // Header Brand Title in El Messiri Bold (matches app header/footer font)
  setElMessiriFont(8.4)
  pdf.setTextColor(163, 230, 53) // #a3e635
  pdf.text("ICS ACADEMY MANHAPPATTA  •  DA'WA COLLEGE", 35.5, 19.2)

  setFont('bold', 12.2)
  pdf.setTextColor(255, 255, 255)
  pdf.text('Official Academic Study Note & Reference', 35.5, 25.2)

  setFont('normal', 8)
  pdf.setTextColor(203, 213, 225)
  pdf.text(`${safeNote.personaTitle}  •  Academic Year 2026-27`, 35.5, 30.2)

  // Official Statement Pill on the right
  pdf.setFillColor(28, 51, 54)
  pdf.roundedRect(157.5, 16.2, 36, 5.8, 1.5, 1.5, 'F')
  setFont('semibold', 7.1)
  pdf.setTextColor(163, 230, 53)
  pdf.text('Official Study Note', 175.5, 20.1, { align: 'center' })

  setFont('normal', 7.8)
  pdf.setTextColor(203, 213, 225)
  pdf.text(`Issued: ${issueDateFormatted}`, 193.5, 27.5, { align: 'right' })

  // 2. Student Profile & Mentor Summary Card
  pdf.setFillColor(248, 250, 252)
  pdf.setDrawColor(226, 232, 240)
  pdf.setLineWidth(0.25)
  pdf.roundedRect(13, 38.5, 184, 30.5, 2.2, 2.2, 'FD')

  // Left Column: Student Info
  setFont('bold', 7)
  pdf.setTextColor(100, 116, 139)
  pdf.text('STUDENT INFORMATION', 16.5, 43.5)

  setFont('bold', 10.5)
  pdf.setTextColor(15, 23, 42)
  pdf.text(safeStudent.name, 16.5, 48.8)

  setFont('normal', 8.2)
  pdf.setTextColor(71, 85, 105)
  pdf.text('Class: ', 16.5, 54)
  const clsLabelW = pdf.getTextWidth('Class: ')
  setFont('semibold', 8.2)
  pdf.setTextColor(15, 23, 42)
  pdf.text(safeStudent.className, 16.5 + clsLabelW, 54)

  setFont('normal', 8.2)
  pdf.setTextColor(71, 85, 105)
  pdf.text('Institution: ', 16.5, 59)
  const instLabelW = pdf.getTextWidth('Institution: ')
  setElMessiriFont(8.5)
  pdf.setTextColor(15, 23, 42)
  pdf.text("ICS ACADEMY MANHAPPATTA (Da'wa College)", 16.5 + instLabelW, 59)

  setFont('normal', 8.2)
  pdf.setTextColor(71, 85, 105)
  pdf.text('Class Usthad: ', 16.5, 64)
  const ustLabelW = pdf.getTextWidth('Class Usthad: ')
  setFont('semibold', 8.2)
  pdf.setTextColor(15, 23, 42)
  pdf.text(`${classUsthad.name} (${classUsthad.staffId})`, 16.5 + ustLabelW, 64)

  // Right Column: White Inner Mentor & Reference Box
  pdf.setFillColor(255, 255, 255)
  pdf.setDrawColor(226, 232, 240)
  pdf.roundedRect(105, 41.5, 89, 24.5, 1.8, 1.8, 'FD')

  setFont('semibold', 7.8)
  pdf.setTextColor(71, 85, 105)
  pdf.text('Scholarly Mentor:', 108.5, 47.2)

  setFont('bold', 8.4)
  pdf.setTextColor(4, 120, 87)
  const cleanPersona = sanitizeVectorLatinText(safeNote.personaTitle) || 'Da-wa College Mentor'
  pdf.text(cleanPersona.slice(0, 28), 190.5, 47.2, { align: 'right' })

  setFont('normal', 7.8)
  pdf.setTextColor(71, 85, 105)
  pdf.text('Reference ID:', 108.5, 53.8)
  setFont('bold', 8)
  pdf.setTextColor(15, 23, 42)
  pdf.text(refCode, 190.5, 53.8, { align: 'right' })

  pdf.setDrawColor(241, 245, 249)
  pdf.line(108.5, 57.2, 190.5, 57.2)

  setFont('normal', 7.8)
  pdf.setTextColor(100, 116, 139)
  pdf.text('Document Status:', 108.5, 62.4)
  setFont('bold', 7.8)
  pdf.setTextColor(4, 120, 87)
  pdf.text('VERIFIED STUDY NOTE', 190.5, 62.4, { align: 'right' })

  let cursorY = 74.5

  // ==================== 3. SECTION 1: QUESTION / STUDY TOPIC ====================
  if (safeNote.prompt && safeNote.prompt.trim()) {
    setFont('bold', 8.2)
    pdf.setTextColor(30, 41, 59)
    pdf.text('1. QUESTION / STUDY TOPIC', 13, cursorY)

    setFont('normal', 7.2)
    pdf.setTextColor(100, 116, 139)
    pdf.text('Student Inquiry & Topic Focus', 197, cursorY, { align: 'right' })

    const qBoxTop = cursorY + 2.2
    const promptText = safeNote.prompt.trim()
    const innerWidthMm = 177 // x=16.5 to x=193.5
    const promptHasMl = hasMalayalamScript(promptText)
    const promptHasAr = hasArabicOrUrduScript(promptText)

    if (!promptHasMl && !promptHasAr) {
      const cleanPrompt = sanitizeVectorLatinText(promptText)
      setFont('semibold', 8.8)
      const wrappedPrompt = (pdf.splitTextToSize(cleanPrompt, innerWidthMm) as string[]).slice(0, 5)
      const lineH = 4.6
      const boxH = Math.max(12, wrappedPrompt.length * lineH + 6.5)

      pdf.setFillColor(240, 253, 244)
      pdf.setDrawColor(187, 247, 208)
      pdf.setLineWidth(0.25)
      pdf.roundedRect(13, qBoxTop, 184, boxH, 2, 2, 'FD')

      setFont('semibold', 8.8)
      pdf.setTextColor(6, 78, 59)
      wrappedPrompt.forEach((ln, idx) => {
        pdf.text(ln, 16.5, qBoxTop + 5.2 + idx * lineH)
      })

      cursorY = qBoxTop + boxH + 6.5
    } else if (promptHasAr && !promptHasMl) {
      // 100% TRUE VECTOR KFGQPC Uthman Taha Naskh Question Box
      const isUr = isUrduText(promptText)
      const vectorLines = splitVectorArabicTextToLines(
        pdf,
        promptText,
        innerWidthMm,
        11.2,
        'bold',
        !isUr,
      ).slice(0, 5)
      const lineH = 5.8
      const boxH = Math.max(13, vectorLines.length * lineH + 6.5)

      pdf.setFillColor(240, 253, 244)
      pdf.setDrawColor(187, 247, 208)
      pdf.setLineWidth(0.25)
      pdf.roundedRect(13, qBoxTop, 184, boxH, 2, 2, 'FD')

      setUthmanFont('bold', 11.2)
      pdf.setTextColor(6, 78, 59)
      vectorLines.forEach((vLine, idx) => {
        pdf.text(vLine, 193.5, qBoxTop + 6.2 + idx * lineH, { align: 'right' })
      })

      cursorY = qBoxTop + boxH + 6.5
    } else {
      const renderedPrompt = renderMalayalamBlockToPng({
        text: promptText,
        widthMm: innerWidthMm,
        fontSizePt: 9.5,
        fontWeight: 'semibold',
        colorHex: '#064e3b',
        alignRight: isArabicText(promptText),
      })

      const imgH = renderedPrompt ? Math.min(renderedPrompt.heightMm, 32) : 10
      const boxH = imgH + 6

      pdf.setFillColor(240, 253, 244)
      pdf.setDrawColor(187, 247, 208)
      pdf.setLineWidth(0.25)
      pdf.roundedRect(13, qBoxTop, 184, boxH, 2, 2, 'FD')

      if (renderedPrompt) {
        pdf.addImage(renderedPrompt.dataUrl, 'PNG', 16.5, qBoxTop + 3, innerWidthMm, imgH)
      }

      cursorY = qBoxTop + boxH + 6.5
    }
  }

  // ==================== 4. SECTION 2: STUDY NOTE & EXPLANATION ====================
  setFont('bold', 8.2)
  pdf.setTextColor(30, 41, 59)
  pdf.text('2. STUDY NOTE & SCHOLARLY EXPLANATION', 13, cursorY)

  setElMessiriFont(7.6)
  pdf.setTextColor(100, 116, 139)
  pdf.text("ICS ACADEMY MANHAPPATTA  •  DA'WA COLLEGE", 197, cursorY, { align: 'right' })

  let cardTopY = cursorY + 2.3
  const headerBarH = 6.8

  const drawStudyCardHeaderBar = (topY: number, isContinuation: boolean) => {
    pdf.setFillColor(241, 245, 249)
    pdf.rect(13, topY, 184, headerBarH, 'F')

    setFont('bold', 7.1)
    pdf.setTextColor(51, 65, 85)
    pdf.text(
      isContinuation
        ? 'SCHOLARLY EXPLANATION & NOTES (CONTINUED)'
        : 'SCHOLARLY EXPLANATION & STRUCTURED STUDY NOTES',
      16.5,
      topY + 4.5,
    )

    setFont('semibold', 7.0)
    pdf.setTextColor(4, 120, 87)
    pdf.text(refCode, 193.5, topY + 4.5, { align: 'right' })

    pdf.setDrawColor(226, 232, 240)
    pdf.setLineWidth(0.22)
    pdf.line(13, topY + headerBarH, 197, topY + headerBarH)
  }

  drawStudyCardHeaderBar(cardTopY, false)
  cursorY = cardTopY + headerBarH + 4.5

  const PAGE_BOTTOM_LIMIT = 270
  const INNER_LEFT_X = 16.5
  const INNER_RIGHT_X = 193.5
  const INNER_WIDTH_MM = INNER_RIGHT_X - INNER_LEFT_X // 177mm

  const closeCurrentStudyCardAndStartNewPage = () => {
    const cardHeight = Math.max(20, cursorY - cardTopY + 2)
    pdf.setDrawColor(226, 232, 240)
    pdf.setLineWidth(0.25)
    pdf.roundedRect(13, cardTopY, 184, cardHeight, 1.8, 1.8, 'S')

    pdf.addPage()
    drawOuterSheetCard()

    pdf.setFillColor(8, 30, 33)
    pdf.roundedRect(13, 13, 184, 17, 2.5, 2.5, 'F')
    drawLogoBadge(16, 15.5, 12, 1.8, 1.4)

    setElMessiriFont(7.6)
    pdf.setTextColor(163, 230, 53)
    pdf.text('ICS ACADEMY MANHAPPATTA  •  OFFICIAL ACADEMIC STUDY NOTE', 31, 19.5)

    setFont('bold', 10)
    pdf.setTextColor(255, 255, 255)
    pdf.text(`${safeStudent.name}  •  ${safeStudent.className}`, 31, 25.2)

    setFont('normal', 7.5)
    pdf.setTextColor(203, 213, 225)
    pdf.text(`Issued: ${issueDateFormatted}`, 193.5, 25.2, { align: 'right' })

    cardTopY = 34
    drawStudyCardHeaderBar(cardTopY, true)
    cursorY = cardTopY + headerBarH + 4.5
  }

  const ensureSpace = (neededMm: number) => {
    if (cursorY + neededMm > PAGE_BOTTOM_LIMIT) {
      closeCurrentStudyCardAndStartNewPage()
    }
  }

  const responseIsOverallArabic = isArabicText(safeNote.response || '')
  const responseIsOverallUrdu = isUrduText(safeNote.response || '')
  const rawLines = (safeNote.response || '').split('\n')

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trimEnd()
    const trimmed = line.trim()

    if (!trimmed) {
      cursorY += 2.2
      continue
    }

    // Horizontal Rule
    if (/^---+$|^\*\*\*+$/.test(trimmed)) {
      ensureSpace(5)
      pdf.setDrawColor(226, 232, 240)
      pdf.setLineWidth(0.2)
      pdf.line(INNER_LEFT_X, cursorY + 1.5, INNER_RIGHT_X, cursorY + 1.5)
      cursorY += 4.5
      continue
    }

    // Markdown Heading (#, ##, ###, ####)
    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed)
    if (headingMatch) {
      const level = headingMatch[1].length
      const content = headingMatch[2].trim()
      const fontSizePt = level <= 2 ? 10.5 : 9.5
      const hasMl = hasMalayalamScript(content)
      const hasAr = hasArabicOrUrduScript(content)

      if (!hasMl && !hasAr) {
        const cleanHeading = sanitizeVectorLatinText(content)
        setFont('bold', fontSizePt)
        const wrapped = pdf.splitTextToSize(cleanHeading, INNER_WIDTH_MM) as string[]
        const lineH = level <= 2 ? 4.8 : 4.4
        const blockH = wrapped.length * lineH + 3.5

        ensureSpace(blockH)
        cursorY += 1.5
        setFont('bold', fontSizePt)
        pdf.setTextColor(6, 78, 59)
        wrapped.forEach((ln, idx) => {
          pdf.text(ln, INNER_LEFT_X, cursorY + 3.5 + idx * lineH)
        })
        cursorY += wrapped.length * lineH + 1.5

        if (level <= 2) {
          pdf.setDrawColor(209, 250, 229)
          pdf.setLineWidth(0.25)
          pdf.line(INNER_LEFT_X, cursorY, INNER_RIGHT_X, cursorY)
          cursorY += 2
        }
      } else if (hasAr && !hasMl) {
        // 100% Vector KFGQPC Uthman Taha Naskh Heading
        const isUr = responseIsOverallUrdu || isUrduLine(content)
        const arPt = level <= 2 ? 12.2 : 11.2
        const vectorLines = splitVectorArabicTextToLines(
          pdf,
          content,
          INNER_WIDTH_MM,
          arPt,
          'bold',
          !isUr,
        )
        const lineH = level <= 2 ? 6.2 : 5.6

        cursorY += 1.5
        setUthmanFont('bold', arPt)
        pdf.setTextColor(6, 78, 59)
        for (const vLine of vectorLines) {
          ensureSpace(lineH + 1)
          setUthmanFont('bold', arPt)
          pdf.setTextColor(6, 78, 59)
          pdf.text(vLine, INNER_RIGHT_X, cursorY + 4.5, { align: 'right' })
          cursorY += lineH
        }
        cursorY += 1

        if (level <= 2) {
          pdf.setDrawColor(209, 250, 229)
          pdf.setLineWidth(0.25)
          pdf.line(INNER_LEFT_X, cursorY, INNER_RIGHT_X, cursorY)
          cursorY += 2
        }
      } else {
        const rendered = renderMalayalamBlockToPng({
          text: content,
          widthMm: INNER_WIDTH_MM,
          fontSizePt: fontSizePt + 0.5,
          fontWeight: 'bold',
          colorHex: '#064e3b',
          alignRight: isArabicLine(content),
        })
        if (rendered) {
          ensureSpace(rendered.heightMm + 4)
          cursorY += 1
          pdf.addImage(
            rendered.dataUrl,
            'PNG',
            INNER_LEFT_X,
            cursorY,
            INNER_WIDTH_MM,
            rendered.heightMm,
          )
          cursorY += rendered.heightMm + 1.5
          if (level <= 2) {
            pdf.setDrawColor(209, 250, 229)
            pdf.setLineWidth(0.25)
            pdf.line(INNER_LEFT_X, cursorY, INNER_RIGHT_X, cursorY)
            cursorY += 2
          }
        }
      }
      continue
    }

    // Blockquote (> ...)
    const quoteMatch = /^>\s*(.+)$/.exec(trimmed)
    if (quoteMatch) {
      const content = quoteMatch[1].trim()
      const quoteInnerW = INNER_WIDTH_MM - 8
      const isAr = isArabicLine(content)
      const hasMl = hasMalayalamScript(content)
      const hasAr = hasArabicOrUrduScript(content)

      if (!hasMl && !hasAr) {
        const cleanQuote = sanitizeVectorLatinText(content)
        setFont('normal', 8.6)
        const wrapped = pdf.splitTextToSize(cleanQuote, quoteInnerW) as string[]
        const lineH = 4.3
        const boxH = wrapped.length * lineH + 4.5

        ensureSpace(boxH + 2)
        pdf.setFillColor(236, 253, 245)
        pdf.roundedRect(INNER_LEFT_X, cursorY, INNER_WIDTH_MM, boxH, 1.5, 1.5, 'F')
        pdf.setFillColor(5, 150, 105)
        pdf.rect(INNER_LEFT_X, cursorY, 1.2, boxH, 'F')

        setFont('normal', 8.6)
        pdf.setTextColor(30, 41, 59)
        wrapped.forEach((ln, idx) => {
          pdf.text(ln, INNER_LEFT_X + 4.5, cursorY + 4.2 + idx * lineH)
        })
        cursorY += boxH + 2.2
      } else if (hasAr && !hasMl) {
        // 100% Vector KFGQPC Uthman Taha Naskh Blockquote
        const isUr = responseIsOverallUrdu || isUrduLine(content)
        const arPt = 11.2
        const vectorLines = splitVectorArabicTextToLines(
          pdf,
          content,
          quoteInnerW,
          arPt,
          'bold',
          !isUr,
        )
        const lineH = 5.8
        const boxH = vectorLines.length * lineH + 4.8

        ensureSpace(boxH + 2)
        pdf.setFillColor(236, 253, 245)
        pdf.roundedRect(INNER_LEFT_X, cursorY, INNER_WIDTH_MM, boxH, 1.5, 1.5, 'F')
        pdf.setFillColor(5, 150, 105)
        pdf.rect(INNER_RIGHT_X - 1.2, cursorY, 1.2, boxH, 'F')

        setUthmanFont('bold', arPt)
        pdf.setTextColor(6, 78, 59)
        vectorLines.forEach((vLine, idx) => {
          pdf.text(vLine, INNER_RIGHT_X - 4, cursorY + 5.2 + idx * lineH, { align: 'right' })
        })
        cursorY += boxH + 2.2
      } else {
        const rendered = renderMalayalamBlockToPng({
          text: content,
          widthMm: quoteInnerW,
          fontSizePt: 9.2,
          fontWeight: 'semibold',
          colorHex: '#064e3b',
          alignRight: isAr,
        })
        if (rendered) {
          const boxH = rendered.heightMm + 4
          ensureSpace(boxH + 2)
          pdf.setFillColor(236, 253, 245)
          pdf.roundedRect(INNER_LEFT_X, cursorY, INNER_WIDTH_MM, boxH, 1.5, 1.5, 'F')
          pdf.setFillColor(5, 150, 105)
          pdf.rect(isAr ? INNER_RIGHT_X - 1.2 : INNER_LEFT_X, cursorY, 1.2, boxH, 'F')
          pdf.addImage(
            rendered.dataUrl,
            'PNG',
            INNER_LEFT_X + 4,
            cursorY + 2,
            quoteInnerW,
            rendered.heightMm,
          )
          cursorY += boxH + 2.2
        }
      }
      continue
    }

    // Bullet List Item (*, -, •)
    const bulletMatch = /^(\s*)([*\-•])\s+(.+)$/.exec(line)
    if (bulletMatch) {
      const content = bulletMatch[3].trim()
      const isAr = isArabicLine(content)
      const hasMl = hasMalayalamScript(content)
      const hasAr = hasArabicOrUrduScript(content)
      const bulletIndentMm = 5
      const bulletTextWidthMm = INNER_WIDTH_MM - bulletIndentMm

      if (!hasMl && !hasAr) {
        const cleanItem = sanitizeVectorLatinText(content)
        const boldPrefixMatch = /^\*\*([^*]+)\*\*:?\s*(.*)$/.exec(content)
        setFont('normal', 8.8)
        const wrapped = pdf.splitTextToSize(cleanItem, bulletTextWidthMm) as string[]
        const lineH = 4.4
        const blockH = wrapped.length * lineH + 1.2

        ensureSpace(blockH)
        pdf.setFillColor(4, 120, 87)
        pdf.circle(INNER_LEFT_X + 1.5, cursorY + 2.5, 0.75, 'F')

        setFont(boldPrefixMatch && wrapped.length === 1 ? 'semibold' : 'normal', 8.8)
        pdf.setTextColor(30, 41, 59)
        wrapped.forEach((ln, idx) => {
          pdf.text(ln, INNER_LEFT_X + bulletIndentMm, cursorY + 3.6 + idx * lineH)
        })
        cursorY += blockH
      } else if (hasAr && !hasMl) {
        // 100% Vector KFGQPC Uthman Taha Naskh Bullet Item
        const isUr = responseIsOverallUrdu || isUrduLine(content)
        const arPt = 11.2
        const vectorLines = splitVectorArabicTextToLines(
          pdf,
          content,
          bulletTextWidthMm,
          arPt,
          'normal',
          !isUr,
        )
        const lineH = 5.8

        ensureSpace(lineH + 1.5)
        pdf.setFillColor(4, 120, 87)
        pdf.circle(INNER_RIGHT_X - 1.5, cursorY + 3.2, 0.75, 'F')

        for (const vLine of vectorLines) {
          ensureSpace(lineH + 0.5)
          setUthmanFont('normal', arPt)
          pdf.setTextColor(30, 41, 59)
          pdf.text(vLine, INNER_RIGHT_X - bulletIndentMm, cursorY + 4.4, { align: 'right' })
          cursorY += lineH
        }
        cursorY += 0.8
      } else {
        const rendered = renderMalayalamBlockToPng({
          text: content,
          widthMm: bulletTextWidthMm,
          fontSizePt: 9.2,
          fontWeight: 'normal',
          colorHex: '#1e293b',
          alignRight: isAr,
        })
        if (rendered) {
          ensureSpace(rendered.heightMm + 1.5)
          pdf.setFillColor(4, 120, 87)
          pdf.circle(
            isAr ? INNER_RIGHT_X - 1.5 : INNER_LEFT_X + 1.5,
            cursorY + 3.2,
            0.75,
            'F',
          )
          pdf.addImage(
            rendered.dataUrl,
            'PNG',
            isAr ? INNER_LEFT_X : INNER_LEFT_X + bulletIndentMm,
            cursorY,
            bulletTextWidthMm,
            rendered.heightMm,
          )
          cursorY += rendered.heightMm + 1.2
        }
      }
      continue
    }

    // Numbered List Item (1., 2., ١., ٢., etc.)
    const numberedMatch = /^(\s*)([0-9\u0660-\u0669\u06F0-\u06F9]+[.)])\s+(.+)$/.exec(line)
    if (numberedMatch) {
      const rawNumLabel = numberedMatch[2]
      const content = numberedMatch[3].trim()
      const isAr = isArabicLine(content) || responseIsOverallArabic
      const isUr = isAr && (responseIsOverallUrdu || isUrduLine(content))
      const hasMl = hasMalayalamScript(content)
      const hasAr = hasArabicOrUrduScript(content)
      const numIndentMm = 7.5
      const numTextWidthMm = INNER_WIDTH_MM - numIndentMm

      if (!hasMl && !hasAr) {
        const cleanItem = sanitizeVectorLatinText(content)
        setFont('normal', 8.8)
        const wrapped = pdf.splitTextToSize(cleanItem, numTextWidthMm) as string[]
        const lineH = 4.4
        const blockH = wrapped.length * lineH + 1.4

        ensureSpace(blockH)
        setFont('bold', 8.8)
        pdf.setTextColor(4, 120, 87)
        pdf.text(rawNumLabel, INNER_LEFT_X, cursorY + 3.6)

        setFont('normal', 8.8)
        pdf.setTextColor(30, 41, 59)
        wrapped.forEach((ln, idx) => {
          pdf.text(ln, INNER_LEFT_X + numIndentMm, cursorY + 3.6 + idx * lineH)
        })
        cursorY += blockH
      } else if (hasAr && !hasMl) {
        // 100% Vector KFGQPC Uthman Taha Naskh Numbered List Item with Eastern Arabic Numerals (١., ٢., ٣.)
        const arPt = 11.2
        const vectorLines = splitVectorArabicTextToLines(
          pdf,
          content,
          numTextWidthMm,
          arPt,
          'normal',
          !isUr,
        )
        const lineH = 5.8

        ensureSpace(lineH + 1.5)
        // Format number in Arabic numerals (e.g. "1." -> ".١" in visual RTL so the dot is to the left of the Arabic numeral)
        const digitsOnly = rawNumLabel.replace(/[^0-9\u0660-\u0669\u06F0-\u06F9]/g, '')
        const arabicDigits = isUr ? digitsOnly : toArabicNumerals(digitsOnly)
        const visualNumLabel = `.${arabicDigits}`

        setUthmanFont('bold', 11.5)
        pdf.setTextColor(4, 120, 87)
        pdf.text(visualNumLabel, INNER_RIGHT_X, cursorY + 4.4, { align: 'right' })

        for (const vLine of vectorLines) {
          ensureSpace(lineH + 0.5)
          setUthmanFont('normal', arPt)
          pdf.setTextColor(30, 41, 59)
          pdf.text(vLine, INNER_RIGHT_X - numIndentMm, cursorY + 4.4, { align: 'right' })
          cursorY += lineH
        }
        cursorY += 1.0
      } else {
        const rendered = renderMalayalamBlockToPng({
          text: content,
          widthMm: numTextWidthMm,
          fontSizePt: 9.2,
          fontWeight: 'normal',
          colorHex: '#1e293b',
          alignRight: isAr,
        })
        if (rendered) {
          ensureSpace(rendered.heightMm + 1.5)
          setFont('bold', 8.8)
          pdf.setTextColor(4, 120, 87)
          pdf.text(
            rawNumLabel,
            isAr ? INNER_RIGHT_X : INNER_LEFT_X,
            cursorY + 4.2,
            isAr ? { align: 'right' } : undefined,
          )
          pdf.addImage(
            rendered.dataUrl,
            'PNG',
            isAr ? INNER_LEFT_X : INNER_LEFT_X + numIndentMm,
            cursorY,
            numTextWidthMm,
            rendered.heightMm,
          )
          cursorY += rendered.heightMm + 1.4
        }
      }
      continue
    }

    // Standard Paragraph
    const isAr = isArabicLine(trimmed)
    const hasMl = hasMalayalamScript(trimmed)
    const hasAr = hasArabicOrUrduScript(trimmed)

    if (!hasMl && !hasAr) {
      const cleanPara = sanitizeVectorLatinText(trimmed)
      const isFullyBold = /^\*\*[^*]+\*\*$/.test(trimmed)
      setFont(isFullyBold ? 'semibold' : 'normal', 8.8)
      const wrapped = pdf.splitTextToSize(cleanPara, INNER_WIDTH_MM) as string[]
      const lineH = 4.4
      const blockH = wrapped.length * lineH + 1.5

      ensureSpace(blockH)
      setFont(isFullyBold ? 'semibold' : 'normal', 8.8)
      pdf.setTextColor(30, 41, 59)
      wrapped.forEach((ln, idx) => {
        pdf.text(ln, INNER_LEFT_X, cursorY + 3.6 + idx * lineH)
      })
      cursorY += blockH
    } else if (hasAr && !hasMl) {
      // 100% Vector KFGQPC Uthman Taha Naskh Paragraph
      const isUr = responseIsOverallUrdu || isUrduLine(trimmed)
      const isFullyBold = /^\*\*[^*]+\*\*$/.test(trimmed)
      const arPt = 11.2
      const arWeight: 'normal' | 'bold' = isFullyBold ? 'bold' : 'normal'
      const vectorLines = splitVectorArabicTextToLines(
        pdf,
        trimmed,
        INNER_WIDTH_MM,
        arPt,
        arWeight,
        !isUr,
      )
      const lineH = 5.8

      for (const vLine of vectorLines) {
        ensureSpace(lineH + 0.5)
        setUthmanFont(arWeight, arPt)
        pdf.setTextColor(30, 41, 59)
        pdf.text(vLine, INNER_RIGHT_X, cursorY + 4.4, { align: 'right' })
        cursorY += lineH
      }
      cursorY += 1.0
    } else {
      const rendered = renderMalayalamBlockToPng({
        text: trimmed,
        widthMm: INNER_WIDTH_MM,
        fontSizePt: 9.4,
        fontWeight: 'normal',
        colorHex: '#1e293b',
        alignRight: isAr,
      })
      if (rendered) {
        const maxSingleBlockMm = PAGE_BOTTOM_LIMIT - 48
        const drawH = Math.min(rendered.heightMm, maxSingleBlockMm)
        ensureSpace(drawH + 1.5)
        pdf.addImage(
          rendered.dataUrl,
          'PNG',
          INNER_LEFT_X,
          cursorY,
          INNER_WIDTH_MM,
          drawH,
        )
        cursorY += drawH + 1.5
      }
    }
  }

  // Close the final page's Study Note Card border
  const finalCardHeight = Math.max(24, cursorY - cardTopY + 3.5)
  pdf.setDrawColor(226, 232, 240)
  pdf.setLineWidth(0.25)
  pdf.roundedRect(13, cardTopY, 184, finalCardHeight, 1.8, 1.8, 'S')

  // ==================== FINAL PASS: VECTOR PAGE FOOTERS & PAGE NUMBERS ====================
  const totalPages = pdf.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p)

    if (p > 1) {
      setFont('semibold', 8)
      pdf.setTextColor(163, 230, 53)
      pdf.text(`Page ${p} of ${totalPages}`, 193.5, 19.8, { align: 'right' })
    }

    // Vector Page Footer with El Messiri Brand Name
    pdf.setDrawColor(226, 232, 240)
    pdf.setLineWidth(0.25)
    pdf.line(13, 279, 197, 279)

    setElMessiriFont(7.8)
    pdf.setTextColor(8, 30, 33)
    const footerBrand = 'ICS ACADEMY MANHAPPATTA'
    pdf.text(footerBrand, 13, 283.5)
    const brandW = pdf.getTextWidth(footerBrand)

    setFont('normal', 7.5)
    pdf.setTextColor(100, 116, 139)
    pdf.text(
      `  |  ${safeStudent.name} • ${safeStudent.className}`,
      13 + brandW,
      283.5,
    )

    setFont('semibold', 7.5)
    pdf.setTextColor(51, 65, 85)
    pdf.text(`Page ${p} of ${totalPages}`, 197, 283.5, { align: 'right' })
  }

  const safeFilename =
    (fileName.trim() || 'ics-academy-study-note')
      .toLowerCase()
      .replace(/[^a-z0-9\u0D00-\u0D7F\u0600-\u06FF]+/gi, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70) || 'ics-academy-study-note'

  const pdfBlob = pdf.output('blob')
  if (action === 'print') {
    await printPdfBlobOnDevice(pdfBlob, `${safeFilename}.pdf`)
  } else {
    await downloadBlobOnDevice(pdfBlob, `${safeFilename}.pdf`, 'application/pdf')
  }
}
