import * as React from 'react'
import { jsPDF } from 'jspdf'
import { CLASS_USTHADS, type Student } from '@/components/dashboard/data'
import { downloadBlobOnDevice, printPdfBlobOnDevice } from '@/lib/mobile-pdf'
import {
  drawVectorRtlMarker,
  ensureHarfBuzzVectorFonts,
  HarfBuzzVectorPdfSession,
  layoutHarfBuzzVectorParagraph,
  type VectorParagraphLayout,
} from '@/lib/harfbuzz-vector-pdf'

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
  soraRegularB64: string
  soraSemiBoldB64: string
  soraBoldB64: string
  elMessiriBoldB64: string
  uthmanRegularB64: string
  uthmanBoldB64: string
  regularBuf: ArrayBuffer
  semiBoldBuf: ArrayBuffer
  boldBuf: ArrayBuffer
  soraRegularBuf: ArrayBuffer
  soraSemiBoldBuf: ArrayBuffer
  soraBoldBuf: ArrayBuffer
  uthmanRegularBuf: ArrayBuffer
  uthmanBoldBuf: ArrayBuffer
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

async function fetchArrayBufferSafe(url: string, retries = 1): Promise<ArrayBuffer> {
  let lastError: unknown = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        cache: attempt === 0 ? 'force-cache' : 'reload',
      })
      if (!res.ok) {
        throw new Error(`Failed to fetch ${url} (${res.status})`)
      }
      const buffer = await res.arrayBuffer()
      if (!buffer || buffer.byteLength === 0) {
        throw new Error(`Empty response buffer for ${url}`)
      }
      return buffer
    } catch (err) {
      lastError = err
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 150))
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to load ${url}`)
}

export async function loadVectorPdfAssets(): Promise<CachedVectorPdfAssets> {
  if (cachedVectorAssetsSync) return cachedVectorAssetsSync
  if (cachedVectorAssetsPromise) return cachedVectorAssetsPromise

  cachedVectorAssetsPromise = (async () => {
    const [
      regBuf,
      semiBuf,
      boldBuf,
      soraRegBuf,
      soraSemiBuf,
      soraBoldBuf,
      elMessiriBuf,
      uthmanRegBuf,
      uthmanBoldBuf,
      logoBuf,
    ] = await Promise.all([
      fetchArrayBufferSafe('/fonts/Poppins-Regular.ttf'),
      fetchArrayBufferSafe('/fonts/Poppins-SemiBold.ttf'),
      fetchArrayBufferSafe('/fonts/Poppins-Bold.ttf'),
      fetchArrayBufferSafe('/fonts/Sora-Regular.ttf'),
      fetchArrayBufferSafe('/fonts/Sora-SemiBold.ttf'),
      fetchArrayBufferSafe('/fonts/Sora-Bold.ttf'),
      fetchArrayBufferSafe('/fonts/ElMessiri-Bold.ttf'),
      fetchArrayBufferSafe('/fonts/UthmanTN1-Regular.ttf'),
      fetchArrayBufferSafe('/fonts/UthmanTN1-Bold.ttf'),
      fetchArrayBufferSafe('/images/ics-mark-transparent.png', 0).catch(() => null),
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

    const logoDataUrl = logoBuf
      ? `data:image/png;base64,${arrayBufferToBase64(logoBuf)}`
      : null

    const loaded: CachedVectorPdfAssets = {
      regularB64: arrayBufferToBase64(regBuf),
      semiBoldB64: arrayBufferToBase64(semiBuf),
      boldB64: arrayBufferToBase64(boldBuf),
      soraRegularB64: arrayBufferToBase64(soraRegBuf),
      soraSemiBoldB64: arrayBufferToBase64(soraSemiBuf),
      soraBoldB64: arrayBufferToBase64(soraBoldBuf),
      elMessiriBoldB64: arrayBufferToBase64(elMessiriBuf),
      uthmanRegularB64: arrayBufferToBase64(uthmanRegBuf),
      uthmanBoldB64: arrayBufferToBase64(uthmanBoldBuf),
      regularBuf: regBuf,
      semiBoldBuf: semiBuf,
      boldBuf: boldBuf,
      soraRegularBuf: soraRegBuf,
      soraSemiBoldBuf: soraSemiBuf,
      soraBoldBuf: soraBoldBuf,
      uthmanRegularBuf: uthmanRegBuf,
      uthmanBoldBuf: uthmanBoldBuf,
      logoDataUrl,
    }
    cachedVectorAssetsSync = loaded
    return loaded
  })().catch((err) => {
    cachedVectorAssetsPromise = null
    throw err
  })

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
    // Also disable jsPDF's built-in bidiEngine (doBidiReorder) in postProcessText, which
    // otherwise re-reverses our already-shaped visual LTR UthmanTN1 Arabic strings and breaks letter connections.
    // Keep the TrueType Unicode glyph encoder subscriber in postProcessText intact.
    if (topics && topics.postProcessText && typeof internalEvents.unsubscribe === 'function') {
      for (const [subKey, entry] of Object.entries(topics.postProcessText)) {
        const fn = Array.isArray(entry) ? entry[0] : entry
        if (typeof fn === 'function') {
          const fnSrc = fn.toString()
          if (fnSrc.includes('doBidiReorder') || fnSrc.includes('isInputVisual')) {
            internalEvents.unsubscribe(subKey)
          }
        }
      }
    }
  }

  pdf.addFileToVFS('Poppins-Regular.ttf', assets.regularB64)
  pdf.addFont('Poppins-Regular.ttf', 'Poppins', 'normal')
  pdf.addFileToVFS('Poppins-SemiBold.ttf', assets.semiBoldB64)
  pdf.addFont('Poppins-SemiBold.ttf', 'Poppins', 'semibold')
  pdf.addFileToVFS('Poppins-Bold.ttf', assets.boldB64)
  pdf.addFont('Poppins-Bold.ttf', 'Poppins', 'bold')

  pdf.addFileToVFS('Sora-Regular.ttf', assets.soraRegularB64)
  pdf.addFont('Sora-Regular.ttf', 'Sora', 'normal')
  pdf.addFileToVFS('Sora-SemiBold.ttf', assets.soraSemiBoldB64)
  pdf.addFont('Sora-SemiBold.ttf', 'Sora', 'semibold')
  pdf.addFileToVFS('Sora-Bold.ttf', assets.soraBoldB64)
  pdf.addFont('Sora-Bold.ttf', 'Sora', 'bold')

  pdf.addFileToVFS('ElMessiri-Bold.ttf', assets.elMessiriBoldB64)
  pdf.addFont('ElMessiri-Bold.ttf', 'ElMessiri', 'bold')
  pdf.addFont('ElMessiri-Bold.ttf', 'ElMessiri', 'normal')

  pdf.addFileToVFS('UthmanTN1-Regular.ttf', assets.uthmanRegularB64)
  pdf.addFont('UthmanTN1-Regular.ttf', 'UthmanTN1', 'normal')
  pdf.addFileToVFS('UthmanTN1-Bold.ttf', assets.uthmanBoldB64)
  pdf.addFont('UthmanTN1-Bold.ttf', 'UthmanTN1', 'bold')

  attachSoraDigitsToJsPdf(pdf)
}

/**
 * Wraps `pdf.text` on a jsPDF instance (after `'Sora'` normal/semibold/bold fonts are registered)
 * so every ASCII digit run (`0-9`) drawn in body fonts (`Poppins` / `helvetica`) automatically
 * renders in crisp vector `Sora` matching the active weight and alignment.
 */
export function attachSoraDigitsToJsPdf(pdf: jsPDF): void {
  const flagged = pdf as unknown as { __icsSoraDigitsAttached?: boolean }
  if (flagged.__icsSoraDigitsAttached) return
  flagged.__icsSoraDigitsAttached = true

  const origText = pdf.text.bind(pdf)
  let inWrapper = false

  pdf.text = ((
    text: string | string[],
    x: number,
    y: number,
    options?: Record<string, unknown>,
    transform?: unknown,
  ) => {
    if (inWrapper) {
      return origText(text, x, y, options as never, transform as never)
    }

    const opts = options && typeof options === 'object' ? options : undefined
    // Preserve native behavior for rotated/exotic text transforms
    if (
      transform !== undefined ||
      (opts &&
        (opts.angle !== undefined ||
          opts.rotationDirection !== undefined ||
          opts.renderingMode !== undefined ||
          opts.charSpace !== undefined))
    ) {
      return origText(text, x, y, options as never, transform as never)
    }

    const activeFont = pdf.getFont()
    const origFontName = activeFont?.fontName || 'Poppins'
    const origFontStyle = activeFont?.fontStyle || 'normal'

    if (
      origFontName === 'Sora' ||
      origFontName === 'ElMessiri' ||
      origFontName === 'UthmanTN1'
    ) {
      return origText(text, x, y, options as never, transform as never)
    }

    const rawLines = Array.isArray(text) ? text.map((t) => String(t)) : [String(text)]
    if (!rawLines.some((line) => /[0-9]/.test(line))) {
      return origText(text, x, y, options as never, transform as never)
    }

    const maxWidth = typeof opts?.maxWidth === 'number' && opts.maxWidth > 0 ? opts.maxWidth : 0
    const lines: string[] = maxWidth
      ? rawLines.flatMap((line) => pdf.splitTextToSize(line, maxWidth) as string[])
      : rawLines

    const align = typeof opts?.align === 'string' ? opts.align : 'left'
    const soraStyle: 'normal' | 'semibold' | 'bold' =
      origFontStyle === 'bold'
        ? 'bold'
        : origFontStyle === 'semibold'
          ? 'semibold'
          : 'normal'

    const lineStep = (pdf.getFontSize() / pdf.internal.scaleFactor) * pdf.getLineHeightFactor()
    const passthroughOpts: Record<string, unknown> | undefined =
      opts && opts.baseline !== undefined ? { baseline: opts.baseline } : undefined

    inWrapper = true
    try {
      let curY = y
      for (const line of lines) {
        if (!line) {
          curY += lineStep
          continue
        }
        const segments = line.split(/([0-9]+)/g).filter((s) => s.length > 0)
        const segWidths: number[] = []
        let totalW = 0

        for (const seg of segments) {
          if (/^[0-9]+$/.test(seg)) {
            pdf.setFont('Sora', soraStyle)
          } else {
            pdf.setFont(origFontName, origFontStyle)
          }
          const w = pdf.getTextWidth(seg)
          segWidths.push(w)
          totalW += w
        }

        let curX = x
        if (align === 'right') {
          curX = x - totalW
        } else if (align === 'center') {
          curX = x - totalW / 2
        }

        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i]
          if (/^[0-9]+$/.test(seg)) {
            pdf.setFont('Sora', soraStyle)
          } else {
            pdf.setFont(origFontName, origFontStyle)
          }
          origText(seg, curX, curY, passthroughOpts as never)
          curX += segWidths[i]
        }

        curY += lineStep
      }
    } finally {
      pdf.setFont(origFontName, origFontStyle)
      inWrapper = false
    }

    return pdf
  }) as typeof pdf.text
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

interface InlineRun {
  text: string
  bold: boolean
  italic: boolean
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
    .replace(/\*\*/g, '')
    .trim()
}

/**
 * Parses inline markdown (**bold**, __bold__, ***bold italic***, *italic*, `code`)
 * into styled runs while preserving exact punctuation and attaching trailing colons
 * onto bold labels so RTL Arabic/Urdu labels never visually separate from their colon.
 */
function parseInlineMarkdownRuns(
  rawText: string,
  baseBold = false,
  baseItalic = false,
  isRtl = false,
): InlineRun[] {
  const runs: InlineRun[] = []
  const tokenRegex =
    /(\*\*\*[\s\S]+?\*\*\*|___[\s\S]+?___|\*\*[\s\S]+?\*\*|__[\s\S]+?__|`[^`]+`|\*[^\s*](?:[\s\S]*?[^\s*])?\*|_[^\s_](?:[\s\S]*?[^\s_])?_)/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  const pushRun = (text: string, bold: boolean, italic: boolean) => {
    const cleaned = text.replace(/\*\*/g, '')
    if (!cleaned) return
    const prev = runs[runs.length - 1]
    if (prev && prev.bold === bold && prev.italic === italic) {
      prev.text += cleaned
    } else {
      runs.push({ text: cleaned, bold, italic })
    }
  }

  while ((match = tokenRegex.exec(rawText)) !== null) {
    if (match.index > lastIndex) {
      pushRun(rawText.slice(lastIndex, match.index), baseBold, baseItalic)
    }
    const token = match[0]
    if (
      (token.startsWith('***') && token.endsWith('***')) ||
      (token.startsWith('___') && token.endsWith('___'))
    ) {
      pushRun(token.slice(3, -3), true, true)
    } else if (
      (token.startsWith('**') && token.endsWith('**')) ||
      (token.startsWith('__') && token.endsWith('__'))
    ) {
      pushRun(token.slice(2, -2), true, baseItalic)
    } else if (token.startsWith('`') && token.endsWith('`')) {
      pushRun(token.slice(1, -1), true, baseItalic)
    } else if (
      (token.startsWith('*') && token.endsWith('*')) ||
      (token.startsWith('_') && token.endsWith('_'))
    ) {
      pushRun(token.slice(1, -1), baseBold, true)
    } else {
      pushRun(token, baseBold, baseItalic)
    }
    lastIndex = match.index + token.length
  }

  if (lastIndex < rawText.length) {
    pushRun(rawText.slice(lastIndex), baseBold, baseItalic)
  }

  // Bind leading colon/punctuation immediately after a bold label onto the bold run
  // (e.g. `**قصد التراب**: أي...` -> bold `قصد التراب:` + normal ` أي...`)
  if (isRtl && runs.length > 1) {
    for (let i = 0; i < runs.length - 1; i++) {
      const cur = runs[i]
      const next = runs[i + 1]
      if (cur.bold && !next.bold) {
        const leadingPunct = /^([:：؛،\-–—])(.*)$/s.exec(next.text)
        if (leadingPunct) {
          cur.text += leadingPunct[1]
          next.text = leadingPunct[2]
        }
      }
    }
  }

  return runs.filter((r) => r.text.length > 0)
}

function sanitizeVectorLatinFragment(text: string): string {
  return text
    .replace(/[•‧∙]/g, '-')
    .replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, ' ')
}

function sanitizeVectorLatinText(text: string): string {
  return sanitizeVectorLatinFragment(stripMarkdownTokens(text))
    .replace(/\s+/g, ' ')
    .trim()
}

function prepareStyledVectorRuns(params: {
  rawText: string
  baseWeight: 'normal' | 'semibold' | 'bold'
  isRtl: boolean
  isArabic: boolean
  isUrdu: boolean
  hasMalayalam: boolean
}): InlineRun[] {
  let prepared = params.rawText.trim()
  if (!prepared) return []

  if (params.hasMalayalam) {
    prepared = prepared.replace(/ദാ?അ്\s*വാ?/g, 'ദഅ്\u200cവ')
  }
  if (params.isArabic && !params.isUrdu && !params.hasMalayalam) {
    prepared = toArabicNumerals(prepared)
  }

  return parseInlineMarkdownRuns(prepared, params.baseWeight === 'bold', false, params.isRtl)
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
 * Generates an ICS Academy Official Study Note PDF with 100% INFINITE-ZOOM VECTOR QUALITY:
 * - Embedded ElMessiri-Bold.ttf for "ICS ACADEMY MANHAPPATTA" in headers & footers
 * - Embedded Poppins-Regular/SemiBold/Bold.ttf with TRUE inline **bold** support for English/Spanish/German
 * - True HarfBuzz OpenType Vector Form XObject engine for Arabic (KFGQPC Uthman Taha Naskh Regular/Bold),
 *   Urdu (Noto Nastaliq Urdu Regular/Bold), Malayalam (Noto Serif Malayalam Regular/Bold), and mixed-script
 *   text — ZERO rasterization, razor-sharp at 1600%+ zoom, 100% connected cursive letters, exact GPOS Harakat,
 *   true inline **bold** & *italic*, Markdown tables, and seamless unlimited multi-page pagination.
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

  // Load HarfBuzz WASM + only the script TTFs actually needed for this document
  const combinedDocText = `${safeNote.prompt || ''}\n${safeNote.response || ''}`
  const docHasMalayalam = hasMalayalamScript(combinedDocText)
  const docHasArabicOrUrdu = hasArabicOrUrduScript(combinedDocText)
  const docHasUrdu = docHasArabicOrUrdu && isUrduText(combinedDocText)

  let hbSession: HarfBuzzVectorPdfSession | null = null
  if (docHasMalayalam || docHasArabicOrUrdu) {
    const hb = await ensureHarfBuzzVectorFonts({
      loadArabic: docHasArabicOrUrdu,
      loadMalayalam: docHasMalayalam,
      loadUrdu: docHasUrdu,
      loadLatin: true,
      buffers: {
        arabicRegular: assets.uthmanRegularBuf,
        arabicBold: assets.uthmanBoldBuf,
        latinRegular: assets.regularBuf,
        latinSemiBold: assets.semiBoldBuf,
        latinBold: assets.boldBuf,
        soraRegular: assets.soraRegularBuf,
        soraSemiBold: assets.soraSemiBoldBuf,
        soraBold: assets.soraBoldBuf,
      },
    })
    hbSession = new HarfBuzzVectorPdfSession(pdf, hb)
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

  // ==================== PAGE 1 HEADER & STUDENT SUMMARY ====================
  drawOuterSheetCard()

  // 1. Official ICS Academy Dark Teal Header Banner (#081E21)
  pdf.setFillColor(8, 30, 33)
  pdf.roundedRect(13, 13, 184, 22, 2.8, 2.8, 'F')

  // White Logo Badge (16x16mm square with exact 381:512 object-contain logo)
  drawLogoBadge(16.5, 16, 16, 2, 1.8)

  // Header Brand Title: El Messiri strictly for ICS ACADEMY MANHAPPATTA, Sora for suffix
  setElMessiriFont(8.4)
  pdf.setTextColor(163, 230, 53)
  const hdrBrand = 'ICS ACADEMY MANHAPPATTA'
  pdf.text(hdrBrand, 35.5, 19.2)
  const hdrBrandW = pdf.getTextWidth(hdrBrand)
  pdf.setFont('Sora', 'bold')
  pdf.setFontSize(7.6)
  pdf.text("  •  DA'WA COLLEGE", 35.5 + hdrBrandW, 19.2)

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
  const instBrand = 'ICS ACADEMY MANHAPPATTA'
  pdf.text(instBrand, 16.5 + instLabelW, 59)
  const instBrandW = pdf.getTextWidth(instBrand)
  setFont('semibold', 8.0)
  pdf.text(" (Da'wa College)", 16.5 + instLabelW + instBrandW, 59)

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
    } else if (hbSession) {
      const promptIsUr = isUrduText(promptText)
      const promptIsAr = isArabicText(promptText) || (promptHasAr && !promptHasMl)
      const promptFontPt = promptIsAr && !promptHasMl ? 11.4 : 9.5
      const promptRuns = prepareStyledVectorRuns({
        rawText: promptText,
        baseWeight: 'bold',
        isRtl: promptIsAr,
        isArabic: promptHasAr,
        isUrdu: promptIsUr,
        hasMalayalam: promptHasMl,
      })
      const layout = layoutHarfBuzzVectorParagraph({
        hb: hbSession.getHarfBuzz(),
        runs: promptRuns,
        widthMm: innerWidthMm,
        fontSizePt: promptFontPt,
        baseWeight: 'bold',
        isRtl: promptIsAr,
        isArabic: promptHasAr,
        isUrdu: promptIsUr,
        hasMalayalam: promptHasMl,
      })

      const limitedLines = layout ? layout.lines.slice(0, 5) : []
      const contentH = layout ? limitedLines.length * layout.lineHeightMm : 8
      const boxH = Math.max(13, contentH + 5.2)

      pdf.setFillColor(240, 253, 244)
      pdf.setDrawColor(187, 247, 208)
      pdf.setLineWidth(0.25)
      pdf.roundedRect(13, qBoxTop, 184, boxH, 2, 2, 'FD')

      if (layout && limitedLines.length > 0) {
        const startY = qBoxTop + (boxH - contentH) / 2
        limitedLines.forEach((ln, idx) => {
          hbSession.drawLine({
            line: ln,
            xLeftMm: 16.5,
            xRightMm: 16.5 + innerWidthMm,
            baselineYMm: startY + idx * layout.lineHeightMm + layout.baselineOffsetMm,
            isRtl: promptIsAr,
            normalRgb: [6, 78, 59],
            boldRgb: [6, 78, 59],
          })
        })
      }

      cursorY = qBoxTop + boxH + 6.5
    }
  }

  // ==================== 4. SECTION 2: STUDY NOTE & EXPLANATION ====================
  setFont('bold', 8.2)
  pdf.setTextColor(30, 41, 59)
  pdf.text('2. STUDY NOTE & SCHOLARLY EXPLANATION', 13, cursorY)

  pdf.setFont('Sora', 'semibold')
  pdf.setFontSize(7.1)
  pdf.setTextColor(100, 116, 139)
  const sec2Suffix = "  •  DA'WA COLLEGE"
  const sec2SuffixW = pdf.getTextWidth(sec2Suffix)
  pdf.text(sec2Suffix, 197, cursorY, { align: 'right' })
  setElMessiriFont(7.6)
  pdf.text('ICS ACADEMY MANHAPPATTA', 197 - sec2SuffixW, cursorY, { align: 'right' })

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
    const contBrand = 'ICS ACADEMY MANHAPPATTA'
    pdf.text(contBrand, 31, 19.5)
    const contBrandW = pdf.getTextWidth(contBrand)
    pdf.setFont('Sora', 'bold')
    pdf.setFontSize(7.0)
    pdf.text('  •  OFFICIAL ACADEMIC STUDY NOTE', 31 + contBrandW, 19.5)

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

  /**
   * Draws pure Latin text (English/Spanish/German) in crisp vector Poppins with TRUE inline
   * **bold** formatting and clean line-by-line pagination across unlimited pages.
   */
  const drawVectorRichLatinPaginated = (params: {
    rawText: string
    xMm: number
    widthMm: number
    fontSizePt: number
    lineHeightMm: number
    baseWeight: 'normal' | 'semibold' | 'bold'
    normalColor: [number, number, number]
    boldColor: [number, number, number]
    onFirstLine?: (firstLineY: number) => void
  }) => {
    const runs = parseInlineMarkdownRuns(
      params.rawText,
      params.baseWeight === 'bold',
      false,
      false,
    )
    if (runs.length === 0) return

    const tokens: Array<{ text: string; bold: boolean; isSpace: boolean }> = []
    for (const run of runs) {
      const safeStr = sanitizeVectorLatinFragment(run.text)
      const pieces = safeStr.match(/(\s+|\S+)/g) || []
      for (const piece of pieces) {
        const isSpace = /^\s+$/.test(piece)
        tokens.push({
          text: isSpace ? ' ' : piece,
          bold: run.bold,
          isSpace,
        })
      }
    }

    const measureTokenWidth = (text: string, bold: boolean): number => {
      const weight = bold ? 'bold' : params.baseWeight
      setFont(weight, params.fontSizePt)
      return pdf.getTextWidth(text)
    }

    const mergeLineTokens = (
      lineToks: Array<{ text: string; bold: boolean; isSpace: boolean }>,
    ): Array<{ text: string; bold: boolean }> => {
      let start = 0
      let end = lineToks.length
      while (start < end && lineToks[start].isSpace) start++
      while (end > start && lineToks[end - 1].isSpace) end--
      const merged: Array<{ text: string; bold: boolean }> = []
      for (let idx = start; idx < end; idx++) {
        const t = lineToks[idx]
        const prev = merged[merged.length - 1]
        if (prev && prev.bold === t.bold) {
          prev.text += t.text
        } else {
          merged.push({ text: t.text, bold: t.bold })
        }
      }
      return merged
    }

    const wrapped: Array<Array<{ text: string; bold: boolean }>> = []
    let curTokens: Array<{ text: string; bold: boolean; isSpace: boolean }> = []
    let curWidth = 0

    for (const tok of tokens) {
      if (tok.isSpace && curTokens.length === 0) continue
      const w = measureTokenWidth(tok.text, tok.bold)
      if (curWidth + w > params.widthMm && curTokens.length > 0 && !tok.isSpace) {
        const merged = mergeLineTokens(curTokens)
        if (merged.length > 0) wrapped.push(merged)
        curTokens = [tok]
        curWidth = w
      } else {
        curTokens.push(tok)
        curWidth += w
      }
    }
    const lastMerged = mergeLineTokens(curTokens)
    if (lastMerged.length > 0) wrapped.push(lastMerged)

    wrapped.forEach((lineSegs, lineIdx) => {
      ensureSpace(params.lineHeightMm + 0.5)
      if (lineIdx === 0 && params.onFirstLine) {
        params.onFirstLine(cursorY)
      }
      let drawX = params.xMm
      const baselineY = cursorY + params.lineHeightMm * 0.78
      for (const seg of lineSegs) {
        const weight = seg.bold ? 'bold' : params.baseWeight
        setFont(weight, params.fontSizePt)
        const [r, g, b] = seg.bold ? params.boldColor : params.normalColor
        pdf.setTextColor(r, g, b)
        pdf.text(seg.text, drawX, baselineY)
        drawX += pdf.getTextWidth(seg.text)
      }
      cursorY += params.lineHeightMm
    })
  }

  /**
   * Draws Arabic, Urdu, Malayalam, or mixed-script blocks as 100% INFINITE-ZOOM VECTOR
   * HarfBuzz OpenType Form XObjects — ZERO rasterization, ZERO broken Arabic/Malayalam
   * letters, razor-sharp at 1600%+ zoom, TRUE inline **bold** & *italic*, and seamless
   * line-by-line pagination across unlimited pages.
   */
  const drawHarfBuzzVectorPaginated = (params: {
    rawText: string
    xMm: number
    widthMm: number
    fontSizePt: number
    baseWeight: 'normal' | 'semibold' | 'bold'
    normalRgb: [number, number, number]
    boldRgb: [number, number, number]
    isRtl: boolean
    isArabic: boolean
    isUrdu: boolean
    hasMalayalam: boolean
    onFirstLine?: (firstTopY: number, firstBaselineY: number, fontSizeMm: number) => void
  }) => {
    if (!hbSession) return
    const runs = prepareStyledVectorRuns({
      rawText: params.rawText,
      baseWeight: params.baseWeight,
      isRtl: params.isRtl,
      isArabic: params.isArabic,
      isUrdu: params.isUrdu,
      hasMalayalam: params.hasMalayalam,
    })
    const layout = layoutHarfBuzzVectorParagraph({
      hb: hbSession.getHarfBuzz(),
      runs,
      widthMm: params.widthMm,
      fontSizePt: params.fontSizePt,
      baseWeight: params.baseWeight,
      isRtl: params.isRtl,
      isArabic: params.isArabic,
      isUrdu: params.isUrdu,
      hasMalayalam: params.hasMalayalam,
    })
    if (!layout) return

    layout.lines.forEach((lineObj, lineIdx) => {
      ensureSpace(layout.lineHeightMm + 0.6)
      const baselineY = cursorY + layout.baselineOffsetMm
      if (lineIdx === 0 && params.onFirstLine) {
        params.onFirstLine(cursorY, baselineY, layout.fontSizeMm)
      }
      hbSession.drawLine({
        line: lineObj,
        xLeftMm: params.xMm,
        xRightMm: params.xMm + params.widthMm,
        baselineYMm: baselineY,
        isRtl: params.isRtl,
        normalRgb: params.normalRgb,
        boldRgb: params.boldRgb,
      })
      cursorY += layout.lineHeightMm
    })
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
    if (/^---+$|^\*\*\*+$|^___+$/.test(trimmed)) {
      ensureSpace(5)
      pdf.setDrawColor(226, 232, 240)
      pdf.setLineWidth(0.2)
      pdf.line(INNER_LEFT_X, cursorY + 1.5, INNER_RIGHT_X, cursorY + 1.5)
      cursorY += 4.5
      continue
    }

    // Markdown Table Block (| col1 | col2 | ...)
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')) {
      const tableRows: string[][] = []
      while (i < rawLines.length) {
        const tLine = rawLines[i].trim()
        if (!tLine.startsWith('|') || !tLine.endsWith('|')) {
          i--
          break
        }
        // Skip alignment separator rows (e.g. | --- | :---: |)
        if (!/^\|[\s:|\-]+\|$/.test(tLine)) {
          const cells = tLine
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim())
          if (cells.length > 0) tableRows.push(cells)
        }
        i++
      }

      if (tableRows.length > 0) {
        const colCount = Math.max(...tableRows.map((r) => r.length))
        const colW = INNER_WIDTH_MM / Math.max(1, colCount)
        const tableIsRtl =
          responseIsOverallArabic ||
          responseIsOverallUrdu ||
          isArabicText(tableRows.map((r) => r.join(' ')).join(' '))

        tableRows.forEach((row, rIdx) => {
          const isHeaderRow = rIdx === 0
          const orderedCells = tableIsRtl ? [...row].reverse() : row
          const cellRenderData: Array<{
            vectorLayout?: VectorParagraphLayout | null
            vectorIsRtl?: boolean
            latinLines?: string[]
            heightMm: number
            isRich: boolean
          }> = []
          let maxRowH = 7

          for (let c = 0; c < colCount; c++) {
            const cellRaw = orderedCells[c] ?? ''
            const cellHasMl = hasMalayalamScript(cellRaw)
            const cellHasAr = hasArabicOrUrduScript(cellRaw)
            const cellInnerW = Math.max(12, colW - 3)

            if (!cellHasMl && !cellHasAr) {
              const cleanCell = sanitizeVectorLatinText(cellRaw)
              setFont(isHeaderRow ? 'bold' : 'normal', 8)
              const wrapped = pdf.splitTextToSize(cleanCell, cellInnerW) as string[]
              const h = Math.max(6.5, wrapped.length * 4 + 2.5)
              maxRowH = Math.max(maxRowH, h)
              cellRenderData.push({ latinLines: wrapped, heightMm: h, isRich: false })
            } else if (hbSession) {
              const cIsUr = responseIsOverallUrdu || isUrduLine(cellRaw)
              const cIsAr = isArabicLine(cellRaw) || (cellHasAr && !cellHasMl)
              const cRuns = prepareStyledVectorRuns({
                rawText: cellRaw,
                baseWeight: isHeaderRow ? 'bold' : 'normal',
                isRtl: cIsAr,
                isArabic: cellHasAr,
                isUrdu: cIsUr,
                hasMalayalam: cellHasMl,
              })
              const vLayout = layoutHarfBuzzVectorParagraph({
                hb: hbSession.getHarfBuzz(),
                runs: cRuns,
                widthMm: cellInnerW,
                fontSizePt: cIsAr && !cellHasMl ? 10.2 : 8.5,
                baseWeight: isHeaderRow ? 'bold' : 'normal',
                isRtl: cIsAr,
                isArabic: cellHasAr,
                isUrdu: cIsUr,
                hasMalayalam: cellHasMl,
              })
              const contentH = vLayout ? vLayout.lines.length * vLayout.lineHeightMm : 4.5
              const h = Math.max(6.5, contentH + 2.8)
              maxRowH = Math.max(maxRowH, h)
              cellRenderData.push({
                vectorLayout: vLayout,
                vectorIsRtl: cIsAr,
                heightMm: contentH,
                isRich: true,
              })
            }
          }

          ensureSpace(maxRowH + 1)
          pdf.setFillColor(
            isHeaderRow ? 236 : rIdx % 2 === 0 ? 255 : 248,
            isHeaderRow ? 253 : rIdx % 2 === 0 ? 255 : 250,
            isHeaderRow ? 245 : rIdx % 2 === 0 ? 255 : 252,
          )
          pdf.setDrawColor(226, 232, 240)
          pdf.setLineWidth(0.2)
          pdf.rect(INNER_LEFT_X, cursorY, INNER_WIDTH_MM, maxRowH, 'FD')

          for (let c = 0; c < colCount; c++) {
            const cellX = INNER_LEFT_X + c * colW
            if (c > 0) {
              pdf.line(cellX, cursorY, cellX, cursorY + maxRowH)
            }
            const cData = cellRenderData[c]
            if (!cData) continue
            if (cData.isRich && cData.vectorLayout && hbSession) {
              const vLayout = cData.vectorLayout
              const cellInnerW = Math.max(12, colW - 3)
              const startY = cursorY + 1.4
              vLayout.lines.forEach((ln, lnIdx) => {
                hbSession.drawLine({
                  line: ln,
                  xLeftMm: cellX + 1.5,
                  xRightMm: cellX + 1.5 + cellInnerW,
                  baselineYMm: startY + lnIdx * vLayout.lineHeightMm + vLayout.baselineOffsetMm,
                  isRtl: Boolean(cData.vectorIsRtl),
                  normalRgb: isHeaderRow ? [6, 78, 59] : [30, 41, 59],
                  boldRgb: isHeaderRow ? [6, 78, 59] : [15, 23, 42],
                })
              })
            } else if (cData.latinLines) {
              setFont(isHeaderRow ? 'bold' : 'normal', 8)
              pdf.setTextColor(isHeaderRow ? 6 : 30, isHeaderRow ? 78 : 41, isHeaderRow ? 59 : 59)
              cData.latinLines.forEach((ln, lnIdx) => {
                pdf.text(ln, cellX + 1.5, cursorY + 4.3 + lnIdx * 4)
              })
            }
          }
          cursorY += maxRowH
        })
        cursorY += 2.5
      }
      continue
    }

    // Markdown Heading (#, ##, ###, ####)
    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed)
    if (headingMatch) {
      const level = headingMatch[1].length
      const content = headingMatch[2].trim()
      const hasMl = hasMalayalamScript(content)
      const hasAr = hasArabicOrUrduScript(content)

      if (!hasMl && !hasAr) {
        const fontSizePt = level <= 2 ? 10.5 : 9.5
        const lineH = level <= 2 ? 4.9 : 4.5
        ensureSpace(lineH * 2 + 4)
        cursorY += 1.6
        drawVectorRichLatinPaginated({
          rawText: content,
          xMm: INNER_LEFT_X,
          widthMm: INNER_WIDTH_MM,
          fontSizePt,
          lineHeightMm: lineH,
          baseWeight: 'bold',
          normalColor: [6, 78, 59],
          boldColor: [6, 78, 59],
        })
        cursorY += 1.2
        if (level <= 2) {
          pdf.setDrawColor(209, 250, 229)
          pdf.setLineWidth(0.25)
          pdf.line(INNER_LEFT_X, cursorY, INNER_RIGHT_X, cursorY)
          cursorY += 2.2
        }
      } else {
        const isUr = responseIsOverallUrdu || isUrduLine(content)
        const isAr = isArabicLine(content) || (hasAr && !hasMl)
        const fontPt = isAr && !hasMl ? (level <= 2 ? 13.0 : 11.8) : level <= 2 ? 10.8 : 9.8

        ensureSpace(12)
        cursorY += 1.5
        drawHarfBuzzVectorPaginated({
          rawText: content,
          xMm: INNER_LEFT_X,
          widthMm: INNER_WIDTH_MM,
          fontSizePt: fontPt,
          baseWeight: 'bold',
          normalRgb: [6, 78, 59],
          boldRgb: [6, 78, 59],
          isRtl: isAr,
          isArabic: hasAr,
          isUrdu: isUr,
          hasMalayalam: hasMl,
        })
        cursorY += 1.0
        if (level <= 2) {
          pdf.setDrawColor(209, 250, 229)
          pdf.setLineWidth(0.25)
          pdf.line(INNER_LEFT_X, cursorY, INNER_RIGHT_X, cursorY)
          cursorY += 2.2
        }
      }
      continue
    }

    // Blockquote (> ...)
    const quoteMatch = /^>\s*(.+)$/.exec(trimmed)
    if (quoteMatch) {
      const content = quoteMatch[1].trim()
      const quoteInnerW = INNER_WIDTH_MM - 8
      const hasMl = hasMalayalamScript(content)
      const hasAr = hasArabicOrUrduScript(content)
      const isAr = isArabicLine(content) || (hasAr && !hasMl)

      if (!hasMl && !hasAr) {
        const cleanQuote = sanitizeVectorLatinText(content)
        setFont('normal', 8.6)
        const estLines = (pdf.splitTextToSize(cleanQuote, quoteInnerW) as string[]).length
        const lineH = 4.4
        const estH = estLines * lineH + 4.5
        ensureSpace(Math.min(estH + 2, 40))
        const boxStartY = cursorY
        cursorY += 2.2
        drawVectorRichLatinPaginated({
          rawText: content,
          xMm: INNER_LEFT_X + 4.5,
          widthMm: quoteInnerW,
          fontSizePt: 8.6,
          lineHeightMm: lineH,
          baseWeight: 'normal',
          normalColor: [30, 41, 59],
          boldColor: [6, 78, 59],
        })
        const boxH = Math.max(8, cursorY - boxStartY + 2)
        pdf.setFillColor(5, 150, 105)
        pdf.rect(INNER_LEFT_X, boxStartY, 1.2, boxH, 'F')
        pdf.setDrawColor(167, 243, 208)
        pdf.setLineWidth(0.2)
        pdf.roundedRect(INNER_LEFT_X, boxStartY, INNER_WIDTH_MM, boxH, 1.5, 1.5, 'S')
        cursorY = boxStartY + boxH + 2.2
      } else if (hbSession) {
        const isUr = responseIsOverallUrdu || isUrduLine(content)
        const fontPt = isAr && !hasMl ? 11.6 : 9.4
        const qRuns = prepareStyledVectorRuns({
          rawText: content,
          baseWeight: 'semibold',
          isRtl: isAr,
          isArabic: hasAr,
          isUrdu: isUr,
          hasMalayalam: hasMl,
        })
        const layout = layoutHarfBuzzVectorParagraph({
          hb: hbSession.getHarfBuzz(),
          runs: qRuns,
          widthMm: quoteInnerW,
          fontSizePt: fontPt,
          baseWeight: 'semibold',
          isRtl: isAr,
          isArabic: hasAr,
          isUrdu: isUr,
          hasMalayalam: hasMl,
        })
        if (layout) {
          let idxLine = 0
          while (idxLine < layout.lines.length) {
            let avail = PAGE_BOTTOM_LIMIT - cursorY - 4.5
            if (avail < layout.lineHeightMm + 2) {
              closeCurrentStudyCardAndStartNewPage()
              avail = PAGE_BOTTOM_LIMIT - cursorY - 4.5
            }
            const fitCount = Math.max(1, Math.floor(avail / layout.lineHeightMm))
            const slice = layout.lines.slice(idxLine, idxLine + fitCount)
            const contentH = slice.length * layout.lineHeightMm
            const boxH = contentH + 3.8

            pdf.setFillColor(236, 253, 245)
            pdf.roundedRect(INNER_LEFT_X, cursorY, INNER_WIDTH_MM, boxH, 1.5, 1.5, 'F')
            pdf.setFillColor(5, 150, 105)
            pdf.rect(isAr ? INNER_RIGHT_X - 1.2 : INNER_LEFT_X, cursorY, 1.2, boxH, 'F')

            const startY = cursorY + 1.9
            slice.forEach((ln, sIdx) => {
              hbSession.drawLine({
                line: ln,
                xLeftMm: INNER_LEFT_X + 4,
                xRightMm: INNER_LEFT_X + 4 + quoteInnerW,
                baselineYMm: startY + sIdx * layout.lineHeightMm + layout.baselineOffsetMm,
                isRtl: isAr,
                normalRgb: [6, 78, 59],
                boldRgb: [6, 78, 59],
              })
            })

            cursorY += boxH + 2.2
            idxLine += slice.length
            if (idxLine < layout.lines.length) {
              closeCurrentStudyCardAndStartNewPage()
            }
          }
        }
      }
      continue
    }

    // Bullet List Item (*, -, •) including nested sub-bullets
    const bulletMatch = /^(\s*)([*\-•])\s+(.+)$/.exec(line)
    if (bulletMatch) {
      const leadingSpaces = bulletMatch[1].length
      const nestOffsetMm = Math.min(8, Math.floor(leadingSpaces / 2) * 3.5)
      const content = bulletMatch[3].trim()
      const hasMl = hasMalayalamScript(content)
      const hasAr = hasArabicOrUrduScript(content)
      const isAr = isArabicLine(content) || (hasAr && !hasMl)
      const bulletIndentMm = 5 + nestOffsetMm
      const bulletTextWidthMm = INNER_WIDTH_MM - bulletIndentMm

      if (!hasMl && !hasAr) {
        drawVectorRichLatinPaginated({
          rawText: content,
          xMm: INNER_LEFT_X + bulletIndentMm,
          widthMm: bulletTextWidthMm,
          fontSizePt: 8.8,
          lineHeightMm: 4.5,
          baseWeight: 'normal',
          normalColor: [30, 41, 59],
          boldColor: [15, 23, 42],
          onFirstLine: (firstY) => {
            pdf.setFillColor(4, 120, 87)
            pdf.circle(INNER_LEFT_X + nestOffsetMm + 1.6, firstY + 2.5, 0.75, 'F')
          },
        })
        cursorY += 1.0
      } else {
        const isUr = responseIsOverallUrdu || isUrduLine(content)
        const fontPt = isAr && !hasMl ? 11.4 : 9.3
        drawHarfBuzzVectorPaginated({
          rawText: content,
          xMm: isAr ? INNER_LEFT_X : INNER_LEFT_X + bulletIndentMm,
          widthMm: bulletTextWidthMm,
          fontSizePt: fontPt,
          baseWeight: 'normal',
          normalRgb: [30, 41, 59],
          boldRgb: [15, 23, 42],
          isRtl: isAr,
          isArabic: hasAr,
          isUrdu: isUr,
          hasMalayalam: hasMl,
          onFirstLine: (_firstTopY, firstBaselineY, fontSizeMm) => {
            pdf.setFillColor(4, 120, 87)
            pdf.circle(
              isAr ? INNER_RIGHT_X - nestOffsetMm - 1.6 : INNER_LEFT_X + nestOffsetMm + 1.6,
              firstBaselineY - fontSizeMm * 0.28,
              0.75,
              'F',
            )
          },
        })
        cursorY += 1.0
      }
      continue
    }

    // Numbered List Item (1., 2., ١., ٢., etc.)
    const numberedMatch = /^(\s*)([0-9\u0660-\u0669\u06F0-\u06F9]+[.)])\s+(.+)$/.exec(line)
    if (numberedMatch) {
      const leadingSpaces = numberedMatch[1].length
      const nestOffsetMm = Math.min(8, Math.floor(leadingSpaces / 2) * 3.5)
      const rawNumLabel = numberedMatch[2]
      const content = numberedMatch[3].trim()
      const hasMl = hasMalayalamScript(content)
      const hasAr = hasArabicOrUrduScript(content)
      const isAr = isArabicLine(content) || (hasAr && !hasMl) || (responseIsOverallArabic && !hasMl)
      const isUr = isAr && (responseIsOverallUrdu || isUrduLine(content))
      const numIndentMm = 8.5 + nestOffsetMm
      const numTextWidthMm = INNER_WIDTH_MM - numIndentMm

      if (!hasMl && !hasAr) {
        drawVectorRichLatinPaginated({
          rawText: content,
          xMm: INNER_LEFT_X + numIndentMm,
          widthMm: numTextWidthMm,
          fontSizePt: 8.8,
          lineHeightMm: 4.5,
          baseWeight: 'normal',
          normalColor: [30, 41, 59],
          boldColor: [15, 23, 42],
          onFirstLine: (firstY) => {
            setFont('bold', 8.8)
            pdf.setTextColor(4, 120, 87)
            pdf.text(rawNumLabel, INNER_LEFT_X + nestOffsetMm, firstY + 3.5)
          },
        })
        cursorY += 1.2
      } else {
        const fontPt = isAr && !hasMl ? 11.4 : 9.3
        const digitsOnly = rawNumLabel.replace(/[^0-9\u0660-\u0669\u06F0-\u06F9]/g, '')
        const formattedMarker =
          isAr && !hasMl && !isUr ? `${toArabicNumerals(digitsOnly)}.` : rawNumLabel

        drawHarfBuzzVectorPaginated({
          rawText: content,
          xMm: isAr ? INNER_LEFT_X : INNER_LEFT_X + numIndentMm,
          widthMm: numTextWidthMm,
          fontSizePt: fontPt,
          baseWeight: 'normal',
          normalRgb: [30, 41, 59],
          boldRgb: [15, 23, 42],
          isRtl: isAr,
          isArabic: hasAr,
          isUrdu: isUr,
          hasMalayalam: hasMl,
          onFirstLine: (_firstTopY, firstBaselineY) => {
            if (isAr && hbSession) {
              drawVectorRtlMarker({
                session: hbSession,
                text: formattedMarker,
                xRightMm: INNER_RIGHT_X - nestOffsetMm,
                baselineYMm: firstBaselineY,
                fontSizePt: fontPt,
                rgb: [4, 120, 87],
                isUrdu: isUr,
              })
            } else {
              setFont('bold', 8.8)
              pdf.setTextColor(4, 120, 87)
              pdf.text(rawNumLabel, INNER_LEFT_X + nestOffsetMm, firstBaselineY)
            }
          },
        })
        cursorY += 1.2
      }
      continue
    }

    // Standard Paragraph
    const hasMl = hasMalayalamScript(trimmed)
    const hasAr = hasArabicOrUrduScript(trimmed)
    const isAr = isArabicLine(trimmed) || (hasAr && !hasMl)

    if (!hasMl && !hasAr) {
      drawVectorRichLatinPaginated({
        rawText: trimmed,
        xMm: INNER_LEFT_X,
        widthMm: INNER_WIDTH_MM,
        fontSizePt: 8.8,
        lineHeightMm: 4.5,
        baseWeight: 'normal',
        normalColor: [30, 41, 59],
        boldColor: [15, 23, 42],
      })
      cursorY += 1.4
    } else {
      const isUr = responseIsOverallUrdu || isUrduLine(trimmed)
      const fontPt = isAr && !hasMl ? 11.4 : 9.4
      drawHarfBuzzVectorPaginated({
        rawText: trimmed,
        xMm: INNER_LEFT_X,
        widthMm: INNER_WIDTH_MM,
        fontSizePt: fontPt,
        baseWeight: 'normal',
        normalRgb: [30, 41, 59],
        boldRgb: [15, 23, 42],
        isRtl: isAr,
        isArabic: hasAr,
        isUrdu: isUr,
        hasMalayalam: hasMl,
      })
      cursorY += 1.4
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
