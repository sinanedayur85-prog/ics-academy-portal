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

type CachedVectorPdfAssets = {
  regularB64: string
  semiBoldB64: string
  boldB64: string
  logoDataUrl: string | null
}

let cachedVectorAssetsPromise: Promise<CachedVectorPdfAssets> | null = null

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

async function loadVectorPdfAssets(): Promise<CachedVectorPdfAssets> {
  if (cachedVectorAssetsPromise) return cachedVectorAssetsPromise

  cachedVectorAssetsPromise = (async () => {
    const [regRes, semiRes, boldRes, logoRes] = await Promise.all([
      fetch('/fonts/Poppins-Regular.ttf'),
      fetch('/fonts/Poppins-SemiBold.ttf'),
      fetch('/fonts/Poppins-Bold.ttf'),
      fetch('/images/ics-mark-transparent.png').catch(() => null),
    ])

    const [regBuf, semiBuf, boldBuf] = await Promise.all([
      regRes.arrayBuffer(),
      semiRes.arrayBuffer(),
      boldRes.arrayBuffer(),
    ])

    let logoDataUrl: string | null = null
    if (logoRes && logoRes.ok) {
      const logoBuf = await logoRes.arrayBuffer()
      logoDataUrl = `data:image/png;base64,${arrayBufferToBase64(logoBuf)}`
    }

    return {
      regularB64: arrayBufferToBase64(regBuf),
      semiBoldB64: arrayBufferToBase64(semiBuf),
      boldB64: arrayBufferToBase64(boldBuf),
      logoDataUrl,
    }
  })()

  return cachedVectorAssetsPromise
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

  // 1. If the user writes any Malayalam characters or explicitly requests Malayalam, respond in Malayalam ('ml')
  if (
    /[\u0D00-\u0D7F]/.test(clean) ||
    /\b(in\s+malayalam|malayalathil|malayalam\s+meaning|malayalam\s+translation)\b/i.test(clean)
  ) {
    return 'ml' as T
  }

  // 2. If the user writes Urdu-specific script/words, respond in Urdu ('ur')
  if (isUrduText(clean)) {
    return 'ur' as T
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

  // 4. If written in Latin script (English / Spanish / German / Manglish)
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

function hasComplexScript(text: string): boolean {
  if (!text) return false
  return /[\u0D00-\u0D7F\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(
    text,
  )
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
 * Renders a single line or wrapped paragraph containing Malayalam, Arabic, or Urdu script
 * using the browser's native 2D Canvas HarfBuzz text shaper at 4x resolution, returning
 * a crisp transparent PNG data URL and exact physical height in millimeters so it embeds
 * cleanly inside the vector PDF layout without ever overflowing.
 */
function renderComplexScriptBlockToPng(params: {
  text: string
  widthMm: number
  fontSizePt: number
  fontWeight: 'normal' | 'semibold' | 'bold'
  colorHex: string
  alignRight?: boolean
}): { dataUrl: string; heightMm: number } | null {
  if (typeof document === 'undefined') return null
  const cleanText = stripMarkdownTokens(params.text)
  if (!cleanText) return null

  const pxPerMm = 3.7795275591 // 96 DPI base
  const scale = 4 // 384 DPI ultra-sharp output
  const widthPx = Math.floor(params.widthMm * pxPerMm)
  const fontSizePx = Math.round(params.fontSizePt * 1.3333)
  const isUr = isUrduText(cleanText)
  const isAr = isArabicLine(cleanText) || isArabicText(cleanText)
  const isMl = /[\u0D00-\u0D7F]/.test(cleanText)

  const lineHeightPx = Math.round(fontSizePx * (isUr ? 2.15 : isMl ? 1.72 : 1.65))
  const weightNum =
    params.fontWeight === 'bold' ? 700 : params.fontWeight === 'semibold' ? 600 : 400
  const fontFamily = isUr
    ? "'Noto Nastaliq Urdu', 'Tajawal', sans-serif"
    : isAr && !isMl
      ? "'Tajawal', 'Poppins', sans-serif"
      : "'Noto Serif Malayalam', 'Poppins', 'Tajawal', sans-serif"

  const measureCanvas = document.createElement('canvas')
  const mCtx = measureCanvas.getContext('2d')
  if (!mCtx) return null
  mCtx.font = `${weightNum} ${fontSizePx}px ${fontFamily}`

  // Word-wrap strictly within widthPx
  const words = cleanText.split(/\s+/)
  const wrappedLines: string[] = []
  let currentLine = ''

  for (const word of words) {
    if (!word) continue
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const metrics = mCtx.measureText(testLine)
    if (metrics.width > widthPx - 4 && currentLine) {
      wrappedLines.push(currentLine)
      // If a single very long token exceeds widthPx, split it safely by character
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

  const useRtl = Boolean(params.alignRight || (isAr && !isMl))
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
    /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+(?:[\s،؛؟«»ـ\-/:,.0-9\u0660-\u0669\u06F0-\u06F9]+[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)*[،؛؟.!]*|[\u0D00-\u0D7F\u200C\u200D]+(?:\s+[\u0D00-\u0D7F\u200C\u200D]+)*)/g
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
      return (
        <bdi
          key={`${keyPrefix}-ar-${idx}`}
          dir="rtl"
          style={{
            fontFamily: partIsUrdu
              ? "'Noto Nastaliq Urdu', 'Tajawal', serif"
              : "'Tajawal', 'Noto Sans Arabic', sans-serif",
            fontWeight: 600,
            margin: '0 2px',
          }}
        >
          {part}
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
 * Generates a 100% Vector ICS Academy Official Study Note PDF matching the exact
 * visual design, embedded Poppins TrueType fonts, Dark Teal (#081E21) header banner,
 * white logo badge, student & mentor summary card, and bordered page cards of the
 * Official Parent Attendance & Leave Report PDF.
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

  if (typeof document !== 'undefined' && document.fonts && typeof document.fonts.ready !== 'undefined') {
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

  // Register embedded Poppins TrueType fonts for 100% crisp vector text at any zoom level
  pdf.addFileToVFS('Poppins-Regular.ttf', assets.regularB64)
  pdf.addFont('Poppins-Regular.ttf', 'Poppins', 'normal')
  pdf.addFileToVFS('Poppins-SemiBold.ttf', assets.semiBoldB64)
  pdf.addFont('Poppins-SemiBold.ttf', 'Poppins', 'semibold')
  pdf.addFileToVFS('Poppins-Bold.ttf', assets.boldB64)
  pdf.addFont('Poppins-Bold.ttf', 'Poppins', 'bold')

  const setFont = (weight: 'normal' | 'semibold' | 'bold', sizePt: number) => {
    pdf.setFont('Poppins', weight)
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
    pdf.setDrawColor(203, 213, 225) // #cbd5e1
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

  // Header Texts
  setFont('bold', 7.5)
  pdf.setTextColor(163, 230, 53) // #a3e635
  pdf.text("ICS ACADEMY MANHAPPATTA  •  DA'WA COLLEGE", 35.5, 19.2)

  setFont('bold', 12.2)
  pdf.setTextColor(255, 255, 255)
  pdf.text('Official Academic Study Note & Reference', 35.5, 25.2)

  setFont('normal', 8)
  pdf.setTextColor(203, 213, 225)
  pdf.text(
    `${safeNote.personaTitle}  •  Academic Year 2026-27`,
    35.5,
    30.2,
  )

  // Official Statement Pill on the right
  pdf.setFillColor(28, 51, 54)
  pdf.roundedRect(157.5, 16.2, 36, 5.8, 1.5, 1.5, 'F')
  setFont('semibold', 7.1)
  pdf.setTextColor(163, 230, 53)
  pdf.text('Official Study Note', 175.5, 20.1, { align: 'center' })

  setFont('normal', 7.8)
  pdf.setTextColor(203, 213, 225)
  pdf.text(`Issued: ${issueDateFormatted}`, 193.5, 27.5, { align: 'right' })

  // 2. Student Profile & Mentor Summary Card (Identical to Parent Report PDF)
  pdf.setFillColor(248, 250, 252) // #f8fafc
  pdf.setDrawColor(226, 232, 240) // #e2e8f0
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
  pdf.text('Admission No.: ', 16.5, 54)
  const admLabelW = pdf.getTextWidth('Admission No.: ')
  setFont('bold', 8.2)
  pdf.setTextColor(15, 23, 42)
  pdf.text(safeStudent.admissionNo, 16.5 + admLabelW, 54)

  setFont('normal', 8.2)
  pdf.setTextColor(71, 85, 105)
  pdf.text('Class & Batch: ', 16.5, 59)
  const clsLabelW = pdf.getTextWidth('Class & Batch: ')
  setFont('semibold', 8.2)
  pdf.setTextColor(15, 23, 42)
  pdf.text(safeStudent.className, 16.5 + clsLabelW, 59)

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
  pdf.setTextColor(4, 120, 87) // #047857
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

    if (!hasComplexScript(promptText)) {
      const cleanPrompt = sanitizeVectorLatinText(promptText)
      setFont('semibold', 8.8)
      const wrappedPrompt = (pdf.splitTextToSize(cleanPrompt, innerWidthMm) as string[]).slice(0, 5)
      const lineH = 4.6
      const boxH = Math.max(12, wrappedPrompt.length * lineH + 6.5)

      pdf.setFillColor(240, 253, 244) // #f0fdf4
      pdf.setDrawColor(187, 247, 208) // #bbf7d0
      pdf.setLineWidth(0.25)
      pdf.roundedRect(13, qBoxTop, 184, boxH, 2, 2, 'FD')

      setFont('semibold', 8.8)
      pdf.setTextColor(6, 78, 59) // #064e3b
      wrappedPrompt.forEach((ln, idx) => {
        pdf.text(ln, 16.5, qBoxTop + 5.2 + idx * lineH)
      })

      cursorY = qBoxTop + boxH + 6.5
    } else {
      const renderedPrompt = renderComplexScriptBlockToPng({
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
        pdf.addImage(
          renderedPrompt.dataUrl,
          'PNG',
          16.5,
          qBoxTop + 3,
          innerWidthMm,
          imgH,
          undefined,
          'FAST',
        )
      }

      cursorY = qBoxTop + boxH + 6.5
    }
  }

  // ==================== 4. SECTION 2: STUDY NOTE & EXPLANATION ====================
  setFont('bold', 8.2)
  pdf.setTextColor(30, 41, 59)
  pdf.text('2. STUDY NOTE & SCHOLARLY EXPLANATION', 13, cursorY)

  setFont('normal', 7.2)
  pdf.setTextColor(100, 116, 139)
  pdf.text("ICS Academy Manhappatta  •  Da'wa College", 197, cursorY, { align: 'right' })

  let cardTopY = cursorY + 2.3
  const headerBarH = 6.8

  const drawStudyCardHeaderBar = (topY: number, isContinuation: boolean) => {
    pdf.setFillColor(241, 245, 249) // #f1f5f9
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

  const PAGE_BOTTOM_LIMIT = 270 // Leaves clean space above footer at y=279
  const INNER_LEFT_X = 16.5
  const INNER_RIGHT_X = 193.5
  const INNER_WIDTH_MM = INNER_RIGHT_X - INNER_LEFT_X // 177mm

  const closeCurrentStudyCardAndStartNewPage = () => {
    // Close current page's study card border
    const cardHeight = Math.max(20, cursorY - cardTopY + 2)
    pdf.setDrawColor(226, 232, 240)
    pdf.setLineWidth(0.25)
    pdf.roundedRect(13, cardTopY, 184, cardHeight, 1.8, 1.8, 'S')

    // Add new page with Official ICS Academy Continuation Header
    pdf.addPage()
    drawOuterSheetCard()

    // Continuation Header Banner (Identical to Page 2 of Parent Report PDF)
    pdf.setFillColor(8, 30, 33)
    pdf.roundedRect(13, 13, 184, 17, 2.5, 2.5, 'F')
    drawLogoBadge(16, 15.5, 12, 1.8, 1.4)

    setFont('bold', 7)
    pdf.setTextColor(163, 230, 53)
    pdf.text('ICS ACADEMY MANHAPPATTA  •  OFFICIAL ACADEMIC STUDY NOTE', 31, 19.5)

    setFont('bold', 10)
    pdf.setTextColor(255, 255, 255)
    pdf.text(
      `${safeStudent.name} (${safeStudent.admissionNo})  •  ${safeStudent.className}`,
      31,
      25.2,
    )

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

      if (!hasComplexScript(content)) {
        const cleanHeading = sanitizeVectorLatinText(content)
        setFont('bold', fontSizePt)
        const wrapped = pdf.splitTextToSize(cleanHeading, INNER_WIDTH_MM) as string[]
        const lineH = level <= 2 ? 4.8 : 4.4
        const blockH = wrapped.length * lineH + 3.5

        ensureSpace(blockH)
        cursorY += 1.5
        setFont('bold', fontSizePt)
        pdf.setTextColor(6, 78, 59) // #064e3b
        wrapped.forEach((ln, idx) => {
          pdf.text(ln, INNER_LEFT_X, cursorY + 3.5 + idx * lineH)
        })
        cursorY += wrapped.length * lineH + 1.5

        if (level <= 2) {
          pdf.setDrawColor(209, 250, 229) // #d1fae5
          pdf.setLineWidth(0.25)
          pdf.line(INNER_LEFT_X, cursorY, INNER_RIGHT_X, cursorY)
          cursorY += 2
        }
      } else {
        const rendered = renderComplexScriptBlockToPng({
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
            undefined,
            'FAST',
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

      if (!hasComplexScript(content)) {
        const cleanQuote = sanitizeVectorLatinText(content)
        setFont('normal', 8.6)
        const wrapped = pdf.splitTextToSize(cleanQuote, quoteInnerW) as string[]
        const lineH = 4.3
        const boxH = wrapped.length * lineH + 4.5

        ensureSpace(boxH + 2)
        pdf.setFillColor(236, 253, 245) // #ecfdf5
        pdf.roundedRect(INNER_LEFT_X, cursorY, INNER_WIDTH_MM, boxH, 1.5, 1.5, 'F')
        pdf.setFillColor(5, 150, 105) // #059669 accent bar
        pdf.rect(INNER_LEFT_X, cursorY, 1.2, boxH, 'F')

        setFont('normal', 8.6)
        pdf.setTextColor(30, 41, 59)
        wrapped.forEach((ln, idx) => {
          pdf.text(ln, INNER_LEFT_X + 4.5, cursorY + 4.2 + idx * lineH)
        })
        cursorY += boxH + 2.2
      } else {
        const rendered = renderComplexScriptBlockToPng({
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
          pdf.rect(
            isAr ? INNER_RIGHT_X - 1.2 : INNER_LEFT_X,
            cursorY,
            1.2,
            boxH,
            'F',
          )
          pdf.addImage(
            rendered.dataUrl,
            'PNG',
            INNER_LEFT_X + 4,
            cursorY + 2,
            quoteInnerW,
            rendered.heightMm,
            undefined,
            'FAST',
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
      const bulletIndentMm = 5
      const bulletTextWidthMm = INNER_WIDTH_MM - bulletIndentMm

      if (!hasComplexScript(content)) {
        const cleanItem = sanitizeVectorLatinText(content)
        const boldPrefixMatch = /^\*\*([^*]+)\*\*:?\s*(.*)$/.exec(content)
        setFont('normal', 8.8)
        const wrapped = pdf.splitTextToSize(cleanItem, bulletTextWidthMm) as string[]
        const lineH = 4.4
        const blockH = wrapped.length * lineH + 1.2

        ensureSpace(blockH)
        // Vector emerald bullet dot
        pdf.setFillColor(4, 120, 87)
        pdf.circle(INNER_LEFT_X + 1.5, cursorY + 2.5, 0.75, 'F')

        setFont(boldPrefixMatch && wrapped.length === 1 ? 'semibold' : 'normal', 8.8)
        pdf.setTextColor(30, 41, 59)
        wrapped.forEach((ln, idx) => {
          pdf.text(ln, INNER_LEFT_X + bulletIndentMm, cursorY + 3.6 + idx * lineH)
        })
        cursorY += blockH
      } else {
        const rendered = renderComplexScriptBlockToPng({
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
            undefined,
            'FAST',
          )
          cursorY += rendered.heightMm + 1.2
        }
      }
      continue
    }

    // Numbered List Item (1., 2., etc.)
    const numberedMatch = /^(\s*)(\d+[.)])\s+(.+)$/.exec(line)
    if (numberedMatch) {
      const numLabel = numberedMatch[2]
      const content = numberedMatch[3].trim()
      const isAr = isArabicLine(content)
      const numIndentMm = 6.5
      const numTextWidthMm = INNER_WIDTH_MM - numIndentMm

      if (!hasComplexScript(content)) {
        const cleanItem = sanitizeVectorLatinText(content)
        setFont('normal', 8.8)
        const wrapped = pdf.splitTextToSize(cleanItem, numTextWidthMm) as string[]
        const lineH = 4.4
        const blockH = wrapped.length * lineH + 1.4

        ensureSpace(blockH)
        setFont('bold', 8.8)
        pdf.setTextColor(4, 120, 87)
        pdf.text(numLabel, INNER_LEFT_X, cursorY + 3.6)

        setFont('normal', 8.8)
        pdf.setTextColor(30, 41, 59)
        wrapped.forEach((ln, idx) => {
          pdf.text(ln, INNER_LEFT_X + numIndentMm, cursorY + 3.6 + idx * lineH)
        })
        cursorY += blockH
      } else {
        const rendered = renderComplexScriptBlockToPng({
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
            numLabel,
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
            undefined,
            'FAST',
          )
          cursorY += rendered.heightMm + 1.4
        }
      }
      continue
    }

    // Standard Paragraph
    const isAr = isArabicLine(trimmed)
    if (!hasComplexScript(trimmed)) {
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
    } else {
      const rendered = renderComplexScriptBlockToPng({
        text: trimmed,
        widthMm: INNER_WIDTH_MM,
        fontSizePt: 9.4,
        fontWeight: 'normal',
        colorHex: '#1e293b',
        alignRight: isAr,
      })
      if (rendered) {
        // If a single complex paragraph is taller than a full page, slice it cleanly
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
          undefined,
          'FAST',
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

    // Vector Page Footer (Identical to Parent Report PDF)
    pdf.setDrawColor(226, 232, 240)
    pdf.setLineWidth(0.25)
    pdf.line(13, 279, 197, 279)

    setFont('normal', 7.5)
    pdf.setTextColor(100, 116, 139)
    pdf.text(
      `ICS Academy Manhappatta  |  ${safeStudent.name} (${safeStudent.admissionNo})`,
      13,
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
