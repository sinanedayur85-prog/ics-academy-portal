import type { jsPDF } from 'jspdf'
import type * as HarfBuzzModuleTypes from 'harfbuzzjs'

export type HbFontKey =
  | 'arabicRegular'
  | 'arabicBold'
  | 'malayalamRegular'
  | 'malayalamBold'
  | 'urduRegular'
  | 'urduBold'
  | 'latinRegular'
  | 'latinSemiBold'
  | 'latinBold'

export interface VectorInlineRun {
  text: string
  bold: boolean
  italic: boolean
}

interface HbFontEntry {
  key: HbFontKey
  blob: HarfBuzzModuleTypes.Blob
  face: HarfBuzzModuleTypes.Face
  font: HarfBuzzModuleTypes.Font
  upem: number
  glyphPdfPathCache: Map<number, string>
}

interface ShapedGlyphInstance {
  gid: number
  xAdvance: number
  yAdvance: number
  xOffset: number
  yOffset: number
}

interface ShapedVectorPiece {
  fontKey: HbFontKey
  fontSizePt: number
  bold: boolean
  italic: boolean
  glyphs: ShapedGlyphInstance[]
  widthMm: number
}

export interface VectorWrappedLine {
  pieces: ShapedVectorPiece[]
  widthMm: number
}

export interface VectorParagraphLayout {
  lines: VectorWrappedLine[]
  lineHeightMm: number
  baselineOffsetMm: number
  fontSizeMm: number
  isRtl: boolean
}

const PT_PER_MM = 72 / 25.4 // 2.8346456693

const FONT_URLS: Record<HbFontKey, string> = {
  arabicRegular: '/fonts/UthmanTN1-Regular.ttf',
  arabicBold: '/fonts/UthmanTN1-Bold.ttf',
  malayalamRegular: '/fonts/NotoSerifMalayalam-Regular.ttf',
  malayalamBold: '/fonts/NotoSerifMalayalam-Bold.ttf',
  urduRegular: '/fonts/NotoNastaliqUrdu-Regular.ttf',
  urduBold: '/fonts/NotoNastaliqUrdu-Bold.ttf',
  latinRegular: '/fonts/Poppins-Regular.ttf',
  latinSemiBold: '/fonts/Poppins-SemiBold.ttf',
  latinBold: '/fonts/Poppins-Bold.ttf',
}

let hbModulePromise: Promise<typeof HarfBuzzModuleTypes> | null = null
const loadedFontEntries = new Map<HbFontKey, HbFontEntry>()
const pendingFontLoads = new Map<HbFontKey, Promise<HbFontEntry>>()

async function getHarfBuzzModule(): Promise<typeof HarfBuzzModuleTypes> {
  if (!hbModulePromise) {
    hbModulePromise = import('harfbuzzjs').catch((err) => {
      hbModulePromise = null
      throw err
    })
  }
  return hbModulePromise
}

async function fetchFontArrayBuffer(url: string): Promise<ArrayBuffer> {
  let lastError: unknown = null
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const res = await fetch(url, {
        cache: attempt === 0 ? 'force-cache' : 'reload',
      })
      if (!res.ok) {
        throw new Error(`Failed to fetch font ${url} (${res.status})`)
      }
      const buf = await res.arrayBuffer()
      if (!buf || buf.byteLength === 0) {
        throw new Error(`Empty font buffer for ${url}`)
      }
      return buf
    } catch (err) {
      lastError = err
      if (attempt < 1) {
        await new Promise((resolve) => setTimeout(resolve, 120))
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch font ${url}`)
}

async function ensureFontEntry(
  key: HbFontKey,
  providedBuffer?: ArrayBuffer,
): Promise<HbFontEntry> {
  const existing = loadedFontEntries.get(key)
  if (existing) return existing

  const inFlight = pendingFontLoads.get(key)
  if (inFlight) return inFlight

  const loadPromise = (async () => {
    const hb = await getHarfBuzzModule()
    const rawBuffer = providedBuffer
      ? providedBuffer.slice(0)
      : await fetchFontArrayBuffer(FONT_URLS[key])
    const bytes = new Uint8Array(rawBuffer)
    const blob = new hb.Blob(bytes)
    const face = new hb.Face(blob)
    const font = new hb.Font(face)
    const entry: HbFontEntry = {
      key,
      blob,
      face,
      font,
      upem: face.upem || 1000,
      glyphPdfPathCache: new Map<number, string>(),
    }
    loadedFontEntries.set(key, entry)
    return entry
  })().finally(() => {
    pendingFontLoads.delete(key)
  })

  pendingFontLoads.set(key, loadPromise)
  return loadPromise
}

/**
 * Ensures HarfBuzz WASM and all required TrueType OpenType fonts are loaded and cached.
 * Reuses pre-fetched ArrayBuffers when provided to avoid duplicate network requests.
 */
export async function ensureHarfBuzzVectorFonts(options: {
  loadArabic?: boolean
  loadMalayalam?: boolean
  loadUrdu?: boolean
  loadLatin?: boolean
  buffers?: Partial<Record<HbFontKey, ArrayBuffer>>
}): Promise<typeof HarfBuzzModuleTypes> {
  const hb = await getHarfBuzzModule()
  const keysToLoad: HbFontKey[] = []

  if (options.loadArabic !== false) {
    keysToLoad.push('arabicRegular', 'arabicBold')
  }
  if (options.loadLatin !== false) {
    keysToLoad.push('latinRegular', 'latinSemiBold', 'latinBold')
  }
  if (options.loadMalayalam) {
    keysToLoad.push('malayalamRegular', 'malayalamBold')
  }
  if (options.loadUrdu) {
    keysToLoad.push('urduRegular', 'urduBold')
  }

  await Promise.all(
    keysToLoad.map((k) => ensureFontEntry(k, options.buffers?.[k])),
  )
  return hb
}

function getFontEntryOrFallback(key: HbFontKey): HbFontEntry {
  const direct = loadedFontEntries.get(key)
  if (direct) return direct
  if (key === 'urduBold') return loadedFontEntries.get('arabicBold') ?? loadedFontEntries.get('arabicRegular')!
  if (key === 'urduRegular') return loadedFontEntries.get('arabicRegular')!
  if (key === 'malayalamBold') return loadedFontEntries.get('malayalamRegular') ?? loadedFontEntries.get('latinBold')!
  if (key === 'latinSemiBold') return loadedFontEntries.get('latinBold') ?? loadedFontEntries.get('latinRegular')!
  return loadedFontEntries.get('latinRegular') ?? loadedFontEntries.values().next().value!
}

/**
 * Converts a HarfBuzz glyph outline (M, L, Q, C, Z in font units) into compact native PDF
 * vector path operators (m, l, c, h, f). Cached per (font, glyphId) forever.
 */
function getGlyphPdfPathCommands(entry: HbFontEntry, gid: number): string {
  const cached = entry.glyphPdfPathCache.get(gid)
  if (cached !== undefined) return cached

  const cmds = entry.font.glyphToJson(gid)
  if (!cmds || cmds.length === 0) {
    entry.glyphPdfPathCache.set(gid, '')
    return ''
  }

  const out: string[] = []
  let cx = 0
  let cy = 0
  let hasGeometry = false

  for (let i = 0; i < cmds.length; i++) {
    const c = cmds[i]
    const v = c.values
    if (c.type === 'M') {
      cx = v[0]
      cy = v[1]
      out.push(`${Math.round(cx)} ${Math.round(cy)} m`)
      hasGeometry = true
    } else if (c.type === 'L') {
      cx = v[0]
      cy = v[1]
      out.push(`${Math.round(cx)} ${Math.round(cy)} l`)
    } else if (c.type === 'Q') {
      const qx = v[0]
      const qy = v[1]
      const nx = v[2]
      const ny = v[3]
      // Exact quadratic-to-cubic Bezier degree elevation
      const c1x = Math.round(cx + (2 / 3) * (qx - cx))
      const c1y = Math.round(cy + (2 / 3) * (qy - cy))
      const c2x = Math.round(nx + (2 / 3) * (qx - nx))
      const c2y = Math.round(ny + (2 / 3) * (qy - ny))
      out.push(`${c1x} ${c1y} ${c2x} ${c2y} ${Math.round(nx)} ${Math.round(ny)} c`)
      cx = nx
      cy = ny
    } else if (c.type === 'C') {
      out.push(
        `${Math.round(v[0])} ${Math.round(v[1])} ${Math.round(v[2])} ${Math.round(v[3])} ${Math.round(v[4])} ${Math.round(v[5])} c`,
      )
      cx = v[4]
      cy = v[5]
    } else if (c.type === 'Z') {
      out.push('h')
    }
  }

  if (!hasGeometry) {
    entry.glyphPdfPathCache.set(gid, '')
    return ''
  }

  out.push('f')
  const pdfStream = out.join('\n')
  entry.glyphPdfPathCache.set(gid, pdfStream)
  return pdfStream
}

/**
 * Per-PDF document session that registers each unique (font, glyphId) ONCE as a reusable
 * PDF Form XObject (/XoN). Every occurrence of that glyph in the PDF is just a tiny matrix
 * transform + /XoN Do call — yielding 100% infinite-zoom vector curves at tiny file sizes.
 */
export class HarfBuzzVectorPdfSession {
  private readonly pdf: jsPDF
  private readonly hb: typeof HarfBuzzModuleTypes
  private readonly formKeyByGlyph = new Map<string, string | null>()

  constructor(pdf: jsPDF, hb: typeof HarfBuzzModuleTypes) {
    this.pdf = pdf
    this.hb = hb
  }

  getHarfBuzz(): typeof HarfBuzzModuleTypes {
    return this.hb
  }

  private writeStream(chunk: string): void {
    const internal = this.pdf.internal as unknown as {
      write: (...args: string[]) => void
    }
    internal.write(chunk)
  }

  ensureGlyphFormKey(fontKey: HbFontKey, gid: number): string | null {
    const cacheKey = `${fontKey}:${gid}`
    if (this.formKeyByGlyph.has(cacheKey)) {
      return this.formKeyByGlyph.get(cacheKey) ?? null
    }

    const entry = getFontEntryOrFallback(fontKey)
    const pathStream = getGlyphPdfPathCommands(entry, gid)
    if (!pathStream) {
      this.formKeyByGlyph.set(cacheKey, null)
      return null
    }

    const formId = `HB_${fontKey}_${gid}`
    // Generous BBox in font units so tall Nastaliq ascenders/descenders and Arabic Harakat never clip
    this.pdf.beginFormObject(-4500, -4500, 9000, 9000, this.pdf.Matrix(1, 0, 0, 1, 0, 0))
    this.writeStream(pathStream)
    this.pdf.endFormObject(formId)
    this.formKeyByGlyph.set(cacheKey, formId)
    return formId
  }

  /**
   * Pre-registers all unique glyph Form XObjects used in a line BEFORE opening any
   * `q ... rg` color state on the page stream.
   */
  private preRegisterLineGlyphs(pieces: ShapedVectorPiece[]): void {
    for (let p = 0; p < pieces.length; p++) {
      const piece = pieces[p]
      for (let g = 0; g < piece.glyphs.length; g++) {
        this.ensureGlyphFormKey(piece.fontKey, piece.glyphs[g].gid)
      }
    }
  }

  /**
   * Draws a pre-shaped VectorWrappedLine at exact page coordinates (mm) as 100% vector Form XObjects.
   */
  drawLine(params: {
    line: VectorWrappedLine
    xLeftMm: number
    xRightMm: number
    baselineYMm: number
    isRtl: boolean
    normalRgb: [number, number, number]
    boldRgb: [number, number, number]
  }): void {
    const { line, xLeftMm, xRightMm, baselineYMm, isRtl, normalRgb, boldRgb } = params
    if (line.pieces.length === 0) return

    // Step 1: Register every glyph Form XObject at top-level graphics state
    this.preRegisterLineGlyphs(line.pieces)

    // Step 2: Emit vector glyph instances in visual order
    const k = this.pdf.internal.scaleFactor
    const pageHeightMm = this.pdf.internal.pageSize.getHeight()
    const oyPt = (pageHeightMm - baselineYMm) * k

    let cursorMm = isRtl ? xRightMm : xLeftMm

    for (let p = 0; p < line.pieces.length; p++) {
      const piece = line.pieces[p]
      let pieceStartMm: number
      if (isRtl) {
        cursorMm -= piece.widthMm
        pieceStartMm = cursorMm
      } else {
        pieceStartMm = cursorMm
        cursorMm += piece.widthMm
      }

      if (piece.glyphs.length === 0) continue

      const entry = getFontEntryOrFallback(piece.fontKey)
      const scale = piece.fontSizePt / entry.upem
      const skew = piece.italic ? scale * 0.18 : 0
      const rgb = piece.bold ? boldRgb : normalRgb
      const r = (rgb[0] / 255).toFixed(3)
      const g = (rgb[1] / 255).toFixed(3)
      const b = (rgb[2] / 255).toFixed(3)

      const oxPt = pieceStartMm * k
      let penX = 0
      let penY = 0

      this.writeStream(`q ${r} ${g} ${b} rg`)
      for (let i = 0; i < piece.glyphs.length; i++) {
        const gl = piece.glyphs[i]
        const formId = this.ensureGlyphFormKey(piece.fontKey, gl.gid)
        if (formId) {
          const gx = oxPt + (penX + gl.xOffset) * scale
          const gy = oyPt + (penY + gl.yOffset) * scale
          this.pdf.doFormObject(formId, this.pdf.Matrix(scale, 0, skew, scale, gx, gy))
        }
        penX += gl.xAdvance
        penY += gl.yAdvance
      }
      this.writeStream('Q')
    }
  }
}

// ==================== BIDI + SCRIPT SEGMENTATION & HARFBUZZ SHAPING ====================

type ScriptAtomKind = 'arabic' | 'urdu' | 'malayalam' | 'latin' | 'number'

interface DirectionalSubRun {
  text: string
  script: ScriptAtomKind
  direction: 'rtl' | 'ltr'
}

const ARABIC_CHAR_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
const MALAYALAM_CHAR_RE = /[\u0D00-\u0D7F]/

/**
 * Splits a single styled text segment into script- and direction-homogeneous sub-runs
 * in logical reading order so HarfBuzz shapes every Arabic, Urdu, Malayalam, Latin, and
 * numeric run with exact OpenType GSUB/GPOS and proper BiDi ordering.
 */
function splitIntoDirectionalSubRuns(
  text: string,
  lineIsRtl: boolean,
  lineIsUrdu: boolean,
  lineHasMalayalam: boolean,
): DirectionalSubRun[] {
  if (!text) return []

  if (lineIsRtl) {
    // RTL line (Arabic or Urdu):
    // - Multi-word Latin phrases -> LTR Poppins
    // - Number runs (e.g. ١٢٣ or 2026-27) -> LTR in Arabic/Urdu font so digits read left-to-right
    // - Malayalam runs -> LTR NotoSerifMalayalam
    // - Everything else (Arabic/Urdu words, harakat, spaces, punctuation) -> RTL Arabic/Urdu font
    const rtlSplitRe =
      /([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F0-9._/\-']*(?:\s+[A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F0-9._/\-']*)*|[\u0D00-\u0D7F][\u0D00-\u0D7F\u200C\u200D]*(?:\s+[\u0D00-\u0D7F][\u0D00-\u0D7F\u200C\u200D]*)*|[0-9\u0660-\u0669\u06F0-\u06F9]+(?:[.,/:\\-][0-9\u0660-\u0669\u06F0-\u06F9]+)*)/g
    const parts = text.split(rtlSplitRe)
    const out: DirectionalSubRun[] = []
    for (const part of parts) {
      if (!part) continue
      if (/^[A-Za-z\u00C0-\u024F]/.test(part)) {
        out.push({ text: part, script: 'latin', direction: 'ltr' })
      } else if (MALAYALAM_CHAR_RE.test(part)) {
        out.push({ text: part, script: 'malayalam', direction: 'ltr' })
      } else if (/^[0-9\u0660-\u0669\u06F0-\u06F9]/.test(part)) {
        out.push({ text: part, script: 'number', direction: 'ltr' })
      } else {
        out.push({ text: part, script: lineIsUrdu ? 'urdu' : 'arabic', direction: 'rtl' })
      }
    }
    return out
  }

  // LTR line (Malayalam, or English/Latin with embedded Arabic/Urdu quotations):
  // Extract contiguous Arabic/Urdu phrases (including internal spaces/arabic punctuation)
  const embeddedArabicRe =
    /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+(?:[\s،؛؟«»ـ:\-0-9\u0660-\u0669\u06F0-\u06F9]+[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)*[،؛؟]*)/g
  const parts = text.split(embeddedArabicRe)
  const out: DirectionalSubRun[] = []

  for (const part of parts) {
    if (!part) continue
    if (ARABIC_CHAR_RE.test(part)) {
      // Embedded RTL Arabic/Urdu phrase inside an LTR line.
      // If it contains multi-digit numbers, split internally and reverse logical order so
      // visual left-to-right drawing places the RTL phrase properly right-to-left.
      const subParts = part.split(/([0-9\u0660-\u0669\u06F0-\u06F9]+(?:[.,/:\\-][0-9\u0660-\u0669\u06F0-\u06F9]+)*)/g).filter(Boolean)
      const visualRtlPieces: DirectionalSubRun[] = []
      for (const sp of subParts) {
        if (/^[0-9\u0660-\u0669\u06F0-\u06F9]/.test(sp)) {
          visualRtlPieces.push({ text: sp, script: 'number', direction: 'ltr' })
        } else {
          visualRtlPieces.push({
            text: sp,
            script: lineIsUrdu ? 'urdu' : 'arabic',
            direction: 'rtl',
          })
        }
      }
      // Since the parent line draws LTR, reverse the RTL sub-pieces so the first Arabic word
      // appears on the RIGHT of the embedded phrase and the last word on the LEFT.
      visualRtlPieces.reverse()
      out.push(...visualRtlPieces)
    } else if (lineHasMalayalam) {
      // Keep Malayalam text, spaces, digits, and punctuation unified in NotoSerifMalayalam
      // for crisp consistent serif typography and baseline alignment.
      out.push({ text: part, script: 'malayalam', direction: 'ltr' })
    } else {
      out.push({ text: part, script: 'latin', direction: 'ltr' })
    }
  }

  return out
}

function resolveFontForSubRun(
  sub: DirectionalSubRun,
  bold: boolean,
  baseWeight: 'normal' | 'semibold' | 'bold',
  lineIsUrdu: boolean,
  lineIsRtl: boolean,
  baseFontSizePt: number,
): { fontKey: HbFontKey; fontSizePt: number; hbScript: string; hbLang: string } {
  const isBold = bold || baseWeight === 'bold'
  const isSemiBold = !isBold && baseWeight === 'semibold'

  if (sub.script === 'urdu' || (sub.script === 'number' && lineIsUrdu)) {
    return {
      fontKey: isBold ? 'urduBold' : 'urduRegular',
      fontSizePt: lineIsRtl ? baseFontSizePt : baseFontSizePt * 1.12,
      hbScript: 'Arab',
      hbLang: 'ur',
    }
  }
  if (sub.script === 'arabic' || sub.script === 'number') {
    return {
      fontKey: isBold ? 'arabicBold' : 'arabicRegular',
      fontSizePt: lineIsRtl ? baseFontSizePt : baseFontSizePt * 1.16,
      hbScript: 'Arab',
      hbLang: 'ar',
    }
  }
  if (sub.script === 'malayalam') {
    return {
      fontKey: isBold ? 'malayalamBold' : 'malayalamRegular',
      fontSizePt: baseFontSizePt,
      hbScript: 'Mlym',
      hbLang: 'ml',
    }
  }
  // Latin inside Arabic/Malayalam
  return {
    fontKey: isBold ? 'latinBold' : isSemiBold ? 'latinSemiBold' : 'latinRegular',
    fontSizePt: lineIsRtl ? baseFontSizePt * 0.84 : baseFontSizePt,
    hbScript: 'Latn',
    hbLang: 'en',
  }
}

function shapeStyledSegmentsWithHarfBuzz(
  hb: typeof HarfBuzzModuleTypes,
  segments: VectorInlineRun[],
  params: {
    fontSizePt: number
    baseWeight: 'normal' | 'semibold' | 'bold'
    isRtl: boolean
    isUrdu: boolean
    hasMalayalam: boolean
  },
): { pieces: ShapedVectorPiece[]; totalWidthMm: number } {
  const pieces: ShapedVectorPiece[] = []
  let totalWidthMm = 0

  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const seg = segments[sIdx]
    const subRuns = splitIntoDirectionalSubRuns(
      seg.text,
      params.isRtl,
      params.isUrdu,
      params.hasMalayalam,
    )

    for (let rIdx = 0; rIdx < subRuns.length; rIdx++) {
      const sub = subRuns[rIdx]
      if (!sub.text) continue

      const resolved = resolveFontForSubRun(
        sub,
        seg.bold,
        params.baseWeight,
        params.isUrdu,
        params.isRtl,
        params.fontSizePt,
      )
      const entry = getFontEntryOrFallback(resolved.fontKey)

      const buffer = new hb.Buffer()
      buffer.addText(sub.text)
      buffer.setDirection(sub.direction === 'rtl' ? hb.Direction.RTL : hb.Direction.LTR)
      buffer.setScript(resolved.hbScript)
      buffer.setLanguage(resolved.hbLang)
      hb.shape(entry.font, buffer)

      const infos = buffer.getGlyphInfos()
      const positions = buffer.getGlyphPositions()

      const glyphs: ShapedGlyphInstance[] = new Array(infos.length)
      let totalAdvUnits = 0
      for (let i = 0; i < infos.length; i++) {
        const pos = positions[i]
        glyphs[i] = {
          gid: infos[i].codepoint,
          xAdvance: pos.xAdvance,
          yAdvance: pos.yAdvance,
          xOffset: pos.xOffset,
          yOffset: pos.yOffset,
        }
        totalAdvUnits += pos.xAdvance
      }

      const widthMm = ((totalAdvUnits / entry.upem) * resolved.fontSizePt) / PT_PER_MM
      totalWidthMm += widthMm

      pieces.push({
        fontKey: resolved.fontKey,
        fontSizePt: resolved.fontSizePt,
        bold: seg.bold || params.baseWeight === 'bold',
        italic: seg.italic,
        glyphs,
        widthMm,
      })
    }
  }

  return { pieces, totalWidthMm }
}

/**
 * Word-wraps rich inline-markdown text using exact HarfBuzz OpenType advance widths and
 * returns pre-shaped 100% vector lines ready for pagination and Form XObject rendering.
 */
export function layoutHarfBuzzVectorParagraph(params: {
  hb: typeof HarfBuzzModuleTypes
  runs: VectorInlineRun[]
  widthMm: number
  fontSizePt: number
  baseWeight: 'normal' | 'semibold' | 'bold'
  isRtl: boolean
  isArabic: boolean
  isUrdu: boolean
  hasMalayalam: boolean
}): VectorParagraphLayout | null {
  if (params.runs.length === 0) return null

  const usableWidthMm = Math.max(10, params.widthMm - 0.6)
  const fontSizeMm = params.fontSizePt / PT_PER_MM

  const lineHeightMultiplier = params.isUrdu
    ? 2.22
    : params.isArabic && !params.hasMalayalam
      ? 1.78
      : 1.66
  const lineHeightMm = fontSizeMm * lineHeightMultiplier
  const baselineOffsetMm =
    params.isUrdu
      ? lineHeightMm * 0.60
      : params.isArabic && !params.hasMalayalam
        ? lineHeightMm * 0.64
        : lineHeightMm * 0.68

  // Break runs into word + space tokens while preserving bold/italic
  const tokens: Array<{ text: string; bold: boolean; italic: boolean; isSpace: boolean }> = []
  for (const run of params.runs) {
    const pieces = run.text.match(/(\s+|\S+)/g) || []
    for (const piece of pieces) {
      const isSpace = /^\s+$/.test(piece)
      tokens.push({
        text: isSpace ? ' ' : piece,
        bold: run.bold,
        italic: run.italic,
        isSpace,
      })
    }
  }

  const mergeTokensToRuns = (
    lineTokens: Array<{ text: string; bold: boolean; italic: boolean; isSpace: boolean }>,
  ): VectorInlineRun[] => {
    let start = 0
    let end = lineTokens.length
    while (start < end && lineTokens[start].isSpace) start++
    while (end > start && lineTokens[end - 1].isSpace) end--

    const merged: VectorInlineRun[] = []
    for (let i = start; i < end; i++) {
      const tok = lineTokens[i]
      const prev = merged[merged.length - 1]
      if (prev && prev.bold === tok.bold && prev.italic === tok.italic) {
        prev.text += tok.text
      } else {
        merged.push({ text: tok.text, bold: tok.bold, italic: tok.italic })
      }
    }
    return merged
  }

  const shapeOpts = {
    fontSizePt: params.fontSizePt,
    baseWeight: params.baseWeight,
    isRtl: params.isRtl,
    isUrdu: params.isUrdu,
    hasMalayalam: params.hasMalayalam,
  }

  const wrappedLines: VectorWrappedLine[] = []
  let currentLineTokens: Array<{ text: string; bold: boolean; italic: boolean; isSpace: boolean }> =
    []

  const pushFinalizedLine = (
    toks: Array<{ text: string; bold: boolean; italic: boolean; isSpace: boolean }>,
  ) => {
    const segs = mergeTokensToRuns(toks)
    if (segs.length === 0) return
    const shaped = shapeStyledSegmentsWithHarfBuzz(params.hb, segs, shapeOpts)
    if (shaped.pieces.length > 0) {
      wrappedLines.push({ pieces: shaped.pieces, widthMm: shaped.totalWidthMm })
    }
  }

  // Fast-path approximate token width cache to avoid O(N^2) shaping on very long lines,
  // followed by exact full-line HarfBuzz verification whenever approaching the margin.
  const tokenWidthCache = new Map<string, number>()
  const measureSingleTokenMm = (tok: {
    text: string
    bold: boolean
    italic: boolean
  }): number => {
    const cacheKey = `${tok.bold ? '1' : '0'}:${tok.italic ? '1' : '0'}:${tok.text}`
    const cached = tokenWidthCache.get(cacheKey)
    if (cached !== undefined) return cached
    const shaped = shapeStyledSegmentsWithHarfBuzz(
      params.hb,
      [{ text: tok.text, bold: tok.bold, italic: tok.italic }],
      shapeOpts,
    )
    tokenWidthCache.set(cacheKey, shaped.totalWidthMm)
    return shaped.totalWidthMm
  }

  let approxWidthMm = 0

  for (let t = 0; t < tokens.length; t++) {
    const tok = tokens[t]
    if (tok.isSpace && currentLineTokens.length === 0) {
      continue
    }

    const tokW = measureSingleTokenMm(tok)
    const candidateTokens = [...currentLineTokens, tok]
    const approxCandidateMm = approxWidthMm + tokW

    // Only run exact full-line shaping when approaching or exceeding the line width
    let exceeds = false
    if (approxCandidateMm > usableWidthMm * 0.88 && currentLineTokens.length > 0 && !tok.isSpace) {
      const candidateSegs = mergeTokensToRuns(candidateTokens)
      const exactW = shapeStyledSegmentsWithHarfBuzz(params.hb, candidateSegs, shapeOpts).totalWidthMm
      exceeds = exactW > usableWidthMm
    }

    if (exceeds) {
      pushFinalizedLine(currentLineTokens)
      currentLineTokens = [tok]
      approxWidthMm = tokW

      // Handle an exceptionally long unbroken token (e.g. URL or long compound word)
      if (tokW > usableWidthMm) {
        const chars = Array.from(tok.text)
        let chunk = ''
        currentLineTokens = []
        approxWidthMm = 0
        for (const ch of chars) {
          const testChunk = chunk + ch
          const testW = shapeStyledSegmentsWithHarfBuzz(
            params.hb,
            [{ text: testChunk, bold: tok.bold, italic: tok.italic }],
            shapeOpts,
          ).totalWidthMm
          if (testW > usableWidthMm && chunk) {
            const finalizedChunk = shapeStyledSegmentsWithHarfBuzz(
              params.hb,
              [{ text: chunk, bold: tok.bold, italic: tok.italic }],
              shapeOpts,
            )
            wrappedLines.push({
              pieces: finalizedChunk.pieces,
              widthMm: finalizedChunk.totalWidthMm,
            })
            chunk = ch
          } else {
            chunk = testChunk
          }
        }
        if (chunk) {
          const chunkTok = { text: chunk, bold: tok.bold, italic: tok.italic, isSpace: false }
          currentLineTokens = [chunkTok]
          approxWidthMm = measureSingleTokenMm(chunkTok)
        }
      }
    } else {
      currentLineTokens = candidateTokens
      approxWidthMm = approxCandidateMm
    }
  }

  if (currentLineTokens.length > 0) {
    pushFinalizedLine(currentLineTokens)
  }

  if (wrappedLines.length === 0) return null

  return {
    lines: wrappedLines,
    lineHeightMm,
    baselineOffsetMm,
    fontSizeMm,
    isRtl: params.isRtl,
  }
}

/**
 * Draws a crisp 100% vector RTL list marker (e.g. "١.", "١٢.") right-aligned at xRightMm
 * on the exact same baseline as the first line of the list item.
 */
export function drawVectorRtlMarker(params: {
  session: HarfBuzzVectorPdfSession
  text: string
  xRightMm: number
  baselineYMm: number
  fontSizePt: number
  rgb: [number, number, number]
  isUrdu: boolean
}): void {
  if (!params.text.trim()) return
  const shaped = shapeStyledSegmentsWithHarfBuzz(
    params.session.getHarfBuzz(),
    [{ text: params.text.trim(), bold: true, italic: false }],
    {
      fontSizePt: params.fontSizePt,
      baseWeight: 'bold',
      isRtl: true,
      isUrdu: params.isUrdu,
      hasMalayalam: false,
    },
  )
  if (shaped.pieces.length === 0) return

  params.session.drawLine({
    line: { pieces: shaped.pieces, widthMm: shaped.totalWidthMm },
    xLeftMm: params.xRightMm - 20,
    xRightMm: params.xRightMm,
    baselineYMm: params.baselineYMm,
    isRtl: true,
    normalRgb: params.rgb,
    boldRgb: params.rgb,
  })
}
