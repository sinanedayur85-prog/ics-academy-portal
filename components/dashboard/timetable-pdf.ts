'use client'

import type { jsPDF } from 'jspdf'
import {
  ALL_ACADEMY_CLASS_NAMES,
  BS_DEGREE_CLASS_NAMES,
  CLASS_USTHADS,
  HIGH_SCHOOL_CLASS_NAMES,
  doesUsthadMatchTeacherName,
  getActiveSemester,
  getClassSemesterTimetableByClassName,
  getUsthadScheduledPeriodsAcrossClasses,
  isNonTeachingTimetableSlot,
  isUsthadAssignedClassUsthadOfBatch,
  normalizeClassName,
  type ClassUsthad,
} from '@/components/dashboard/data'
import {
  loadVectorPdfAssets,
  registerOfficialVectorPdfFonts,
  shapeArabicLineForUthmanVector,
} from '@/components/dashboard/study-note-pdf'
import { downloadBlobOnDevice, printPdfBlobOnDevice } from '@/lib/mobile-pdf'

const ARABIC_REGEX = /[\u0600-\u06FF]/

function compactTimeLabel(raw: string): string {
  return raw
    .replace(/\s*[–-]\s*/g, '–')
    .replace(/\s+AM/gi, 'am')
    .replace(/\s+PM/gi, 'pm')
    .trim()
}

function compactTeacherForMatrix(raw: string): string {
  const cleaned = raw.trim()
  if (!cleaned) return ''
  if (cleaned.toLowerCase().includes('shaikhuna')) return 'Shaikhuna'
  if (cleaned.length <= 23) return cleaned
  return cleaned
    .replace(/^Usthad\s+Muhammed\s+/i, 'U. ')
    .replace(/^Usthad\s+Hafiz\s+/i, 'U. H. ')
    .replace(/^Usthad\s+Abdul\s+/i, 'U. A. ')
    .replace(/^Usthad\s+Abdu\s+/i, 'U. A. ')
    .replace(/^Usthad\s+/i, 'U. ')
}

function formatSingleLineFit(pdf: jsPDF, text: string, maxWidth: number): string {
  const clean = text.trim()
  if (!clean) return ''
  if (pdf.getTextWidth(clean) <= maxWidth) return clean
  let out = clean
  while (out.length > 3 && pdf.getTextWidth(`${out}…`) > maxWidth) {
    out = out.slice(0, -1).trimEnd()
  }
  return `${out}…`
}

function drawSafeVectorText(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  options?: {
    align?: 'left' | 'center' | 'right'
    hasUthman?: boolean
    weight?: 'normal' | 'bold'
  },
) {
  const value = text.trim()
  if (!value) return
  if (options?.hasUthman && ARABIC_REGEX.test(value)) {
    const shaped = shapeArabicLineForUthmanVector(value, false)
    pdf.setFont('UthmanTN1', options.weight === 'bold' ? 'bold' : 'normal')
    pdf.text(shaped, x, y, options.align ? { align: options.align } : undefined)
    return
  }
  pdf.text(value, x, y, options?.align ? { align: options.align } : undefined)
}

async function createLandscapeVectorPdf(): Promise<{
  pdf: jsPDF
  logoDataUrl: string | null
  hasUthman: boolean
  setFont: (style: 'normal' | 'semibold' | 'bold') => void
  setBrandFont: () => void
}> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  let hasPoppins = false
  let hasElMessiri = false
  let hasUthman = false
  let logoDataUrl: string | null = null

  try {
    const vectorAssets = await loadVectorPdfAssets()
    registerOfficialVectorPdfFonts(pdf, vectorAssets)
    hasPoppins = true
    hasElMessiri = true
    hasUthman = true
    logoDataUrl = vectorAssets.logoDataUrl
  } catch {
    // Fallback to built-in vector Helvetica
  }

  const setFont = (style: 'normal' | 'semibold' | 'bold') => {
    if (hasPoppins) {
      pdf.setFont('Poppins', style)
    } else {
      pdf.setFont('helvetica', style === 'normal' ? 'normal' : 'bold')
    }
  }

  const setBrandFont = () => {
    if (hasElMessiri) {
      pdf.setFont('ElMessiri', 'bold')
    } else {
      setFont('bold')
    }
  }

  return { pdf, logoDataUrl, hasUthman, setFont, setBrandFont }
}

function drawLandscapeInstitutionalHeader(params: {
  pdf: jsPDF
  logoDataUrl: string | null
  setFont: (style: 'normal' | 'semibold' | 'bold') => void
  setBrandFont: () => void
  marginX: number
  y: number
  contentWidth: number
  headerH: number
  eyebrow: string
  subtitleLine1: string
  subtitleLine2: string
  badgeTop: string
  badgeMain: string
  badgeSub: string
}) {
  const {
    pdf,
    logoDataUrl,
    setFont,
    setBrandFont,
    marginX,
    y,
    contentWidth,
    headerH,
    eyebrow,
    subtitleLine1,
    subtitleLine2,
    badgeTop,
    badgeMain,
    badgeSub,
  } = params

  const pageRight = marginX + contentWidth

  // Dark Emerald-Teal Official Institutional Banner (#081E21)
  pdf.setFillColor(8, 30, 33)
  pdf.roundedRect(marginX, y, contentWidth, headerH, 3.2, 3.2, 'F')

  // Subtle lime accent strip on left edge
  pdf.setFillColor(163, 230, 53)
  pdf.roundedRect(marginX, y, 2.2, headerH, 1.1, 1.1, 'F')

  if (logoDataUrl) {
    const boxW = headerH >= 22 ? 14.5 : 12.2
    const boxH = headerH - 4.2
    const boxX = marginX + 5
    const boxY = y + 2.1
    pdf.setFillColor(255, 255, 255)
    pdf.roundedRect(boxX, boxY, boxW, boxH, 2.1, 2.1, 'F')
    const markH = boxH - 2.4
    const markW = markH * (381 / 512)
    const markX = boxX + (boxW - markW) / 2
    const markY = boxY + (boxH - markH) / 2
    pdf.addImage(logoDataUrl, 'PNG', markX, markY, markW, markH)
  }

  const textStartX = logoDataUrl ? marginX + (headerH >= 22 ? 23 : 20.5) : marginX + 6.5

  setFont('bold')
  pdf.setFontSize(6.8)
  pdf.setTextColor(163, 230, 53) // #a3e635 lime
  pdf.text(eyebrow, textStartX, y + 5.2)

  setBrandFont()
  pdf.setFontSize(headerH >= 22 ? 13.5 : 12)
  pdf.setTextColor(255, 255, 255)
  pdf.text('ICS ACADEMY MANHAPPATTA', textStartX, y + (headerH >= 22 ? 11.2 : 10.2))

  setFont('semibold')
  pdf.setFontSize(7.6)
  pdf.setTextColor(226, 232, 240)
  pdf.text(subtitleLine1, textStartX, y + (headerH >= 22 ? 16 : 14.2))

  setFont('normal')
  pdf.setFontSize(6.6)
  pdf.setTextColor(148, 163, 184)
  pdf.text(subtitleLine2, textStartX, y + (headerH >= 22 ? 20 : 17.6))

  // Right-side summary badge
  const badgeW = 54
  const badgeH = headerH - 5
  const badgeX = pageRight - badgeW - 4
  const badgeY = y + 2.5
  pdf.setFillColor(13, 46, 50)
  pdf.setDrawColor(163, 230, 53)
  pdf.setLineWidth(0.3)
  pdf.roundedRect(badgeX, badgeY, badgeW, badgeH, 2.2, 2.2, 'FD')

  setFont('bold')
  pdf.setFontSize(5.9)
  pdf.setTextColor(163, 230, 53)
  pdf.text(badgeTop, badgeX + badgeW / 2, badgeY + 4.1, { align: 'center' })

  setFont('bold')
  pdf.setFontSize(8.8)
  pdf.setTextColor(255, 255, 255)
  pdf.text(badgeMain, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1.5, { align: 'center' })

  setFont('normal')
  pdf.setFontSize(6)
  pdf.setTextColor(203, 213, 225)
  pdf.text(badgeSub, badgeX + badgeW / 2, badgeY + badgeH - 2, { align: 'center' })
}

function drawLandscapeFooter(params: {
  pdf: jsPDF
  setFont: (style: 'normal' | 'semibold' | 'bold') => void
  setBrandFont: () => void
  marginX: number
  pageWidth: number
  footerY: number
  leftLabel: string
  centerLabel: string
  rightLabel: string
}) {
  const { pdf, setFont, setBrandFont, marginX, pageWidth, footerY, leftLabel, centerLabel, rightLabel } =
    params
  pdf.setDrawColor(203, 213, 225)
  pdf.setLineWidth(0.3)
  pdf.line(marginX, footerY, pageWidth - marginX, footerY)

  setFont('semibold')
  pdf.setFontSize(6.8)
  pdf.setTextColor(51, 65, 85)
  pdf.text(leftLabel, marginX, footerY + 4.6)
  pdf.text(rightLabel, pageWidth - marginX, footerY + 4.6, { align: 'right' })

  setBrandFont()
  pdf.setFontSize(6.8)
  pdf.setTextColor(8, 30, 33)
  pdf.text(centerLabel, pageWidth / 2, footerY + 4.6, { align: 'center' })
}

async function emitPdfOutput(pdf: jsPDF, fileName: string, mode: 'download' | 'print') {
  const blob = pdf.output('blob')
  if (mode === 'print') {
    await printPdfBlobOnDevice(blob, fileName)
  } else {
    await downloadBlobOnDevice(blob, fileName, 'application/pdf')
  }
}

/**
 * 1. Principal Master Timetable — ALL 11 Classes in ONE crisp A4 Landscape 100% Vector Grid PDF
 * Rows = All 11 Classes (High School 8th–HS 2B & BS Degree BS 1–BS 5)
 * Columns = Periods 1 to Max Periods (with time, subject & Usthad in every cell)
 */
export async function exportAllClassesMasterTimetablePdf(params: {
  semester?: 1 | 2
  preparedByName?: string
  mode: 'download' | 'print'
}): Promise<void> {
  const semester = params.semester ?? getActiveSemester()
  const { pdf, logoDataUrl, hasUthman, setFont, setBrandFont } = await createLandscapeVectorPdf()

  const pageWidth = 297
  const marginX = 7.5
  const contentWidth = pageWidth - marginX * 2 // 282mm
  let y = 7

  const classList = [...ALL_ACADEMY_CLASS_NAMES]
  const schedulesByClass = classList.map((className) => {
    const schedule = getClassSemesterTimetableByClassName(className)
    const slots = semester === 1 ? schedule.semester1 : schedule.semester2
    const classUsthad = CLASS_USTHADS.find(
      (u) => normalizeClassName(u.className) === normalizeClassName(className),
    )
    return {
      className,
      schedule,
      slots,
      classUsthadName: classUsthad?.shortName || classUsthad?.name || '',
      isBsDegree: BS_DEGREE_CLASS_NAMES.includes(className),
    }
  })

  const maxPeriods = Math.max(
    8,
    ...schedulesByClass.map((entry) => entry.schedule.periods.length),
  )

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  drawLandscapeInstitutionalHeader({
    pdf,
    logoDataUrl,
    setFont,
    setBrandFont,
    marginX,
    y,
    contentWidth,
    headerH: 20,
    eyebrow: 'OFFICIAL MASTER ACADEMIC TIMETABLE • ALL 11 CLASSES',
    subtitleLine1: `Islamic Cultural Society • Manhappatta, Kerala  •  Semester ${semester} (Academic Year 2026–27)`,
    subtitleLine2: `High School (${HIGH_SCHOOL_CLASS_NAMES.join(', ')})  |  BS Degree (${BS_DEGREE_CLASS_NAMES.join(', ')})`,
    badgeTop: 'MASTER MATRIX',
    badgeMain: `SEMESTER ${semester}`,
    badgeSub: `11 Classes • ${todayFormatted}`,
  })

  y += 23

  // Column Geometry across 282mm
  const classColW = 24
  const periodColW = (contentWidth - classColW) / maxPeriods

  // Table Header Row
  const headerRowH = 8.2
  pdf.setFillColor(8, 30, 33)
  pdf.roundedRect(marginX, y, contentWidth, headerRowH, 1.4, 1.4, 'F')

  // Vertical crisp separators in header
  pdf.setDrawColor(28, 63, 68)
  pdf.setLineWidth(0.2)
  for (let p = 0; p < maxPeriods; p++) {
    const colX = marginX + classColW + p * periodColW
    pdf.line(colX, y + 1, colX, y + headerRowH - 1)
  }

  setFont('bold')
  pdf.setFontSize(6.6)
  pdf.setTextColor(163, 230, 53)
  pdf.text('CLASS', marginX + classColW / 2, y + 5.2, { align: 'center' })

  pdf.setTextColor(255, 255, 255)
  for (let p = 0; p < maxPeriods; p++) {
    const cx = marginX + classColW + p * periodColW + periodColW / 2
    pdf.text(`PERIOD ${p + 1}`, cx, y + 5.2, { align: 'center' })
  }

  y += headerRowH

  // Compute exact row height so all 11 rows fit effortlessly above footer (footerY = 199)
  const footerY = 199.5
  const dividerGap = 2.6 // Subtle visual band separating High School & BS Degree
  const availableH = footerY - 3.5 - y - dividerGap
  const rowH = Math.min(14.5, Math.floor((availableH / schedulesByClass.length) * 10) / 10)

  let insertedDegreeDivider = false

  schedulesByClass.forEach((entry, rowIdx) => {
    if (entry.isBsDegree && !insertedDegreeDivider) {
      insertedDegreeDivider = true
      pdf.setFillColor(236, 253, 245)
      pdf.setDrawColor(16, 185, 129)
      pdf.setLineWidth(0.25)
      pdf.rect(marginX, y, contentWidth, dividerGap, 'FD')
      setFont('bold')
      pdf.setFontSize(4.7)
      pdf.setTextColor(4, 120, 87)
      pdf.text(
        'BS DEGREE WING (BS 1 – BS 5) • EXTENDED DARS & KITAB SCHEDULE',
        marginX + 3,
        y + 1.85,
      )
      y += dividerGap
    }

    const rowBg: [number, number, number] =
      rowIdx % 2 === 0 ? [255, 255, 255] : [248, 250, 252]

    // Row base rectangle
    pdf.setFillColor(...rowBg)
    pdf.setDrawColor(203, 213, 225)
    pdf.setLineWidth(0.22)
    pdf.rect(marginX, y, contentWidth, rowH, 'FD')

    // Class identity column cell (subtle emerald tint for BS, slate tint for HS)
    if (entry.isBsDegree) {
      pdf.setFillColor(240, 253, 244)
    } else {
      pdf.setFillColor(241, 245, 249)
    }
    pdf.setDrawColor(203, 213, 225)
    pdf.rect(marginX, y, classColW, rowH, 'FD')

    setFont('bold')
    pdf.setFontSize(7.6)
    pdf.setTextColor(8, 30, 33)
    pdf.text(entry.className, marginX + classColW / 2, y + 5.3, { align: 'center' })

    setFont('normal')
    pdf.setFontSize(4.8)
    pdf.setTextColor(71, 85, 105)
    const cuShort = formatSingleLineFit(
      pdf,
      compactTeacherForMatrix(entry.classUsthadName),
      classColW - 2.2,
    )
    if (cuShort) {
      pdf.text(cuShort, marginX + classColW / 2, y + 8.9, { align: 'center' })
    }

    setFont('semibold')
    pdf.setFontSize(4.5)
    pdf.setTextColor(4, 120, 87)
    pdf.text(
      `${entry.schedule.periods.length} Periods`,
      marginX + classColW / 2,
      y + rowH - 1.8,
      { align: 'center' },
    )

    // Period cells
    for (let p = 0; p < maxPeriods; p++) {
      const cellX = marginX + classColW + p * periodColW
      const period = entry.schedule.periods[p]
      const slot = entry.slots[p]

      if (!period || !slot) {
        pdf.setFillColor(248, 250, 252)
        pdf.setDrawColor(226, 232, 240)
        pdf.setLineWidth(0.2)
        pdf.rect(cellX, y, periodColW, rowH, 'FD')
        setFont('normal')
        pdf.setFontSize(6)
        pdf.setTextColor(180, 190, 204)
        pdf.text('—', cellX + periodColW / 2, y + rowH / 2 + 1, { align: 'center' })
        continue
      }

      const isNonTeaching = isNonTeachingTimetableSlot(slot)
      if (isNonTeaching) {
        pdf.setFillColor(244, 246, 248)
      } else {
        pdf.setFillColor(...rowBg)
      }
      pdf.setDrawColor(203, 213, 225)
      pdf.setLineWidth(0.2)
      pdf.rect(cellX, y, periodColW, rowH, 'FD')

      const innerPad = 1.2
      const cellInnerW = periodColW - innerPad * 2

      // Top micro time label
      setFont('normal')
      pdf.setFontSize(4.5)
      pdf.setTextColor(100, 116, 139)
      const timeTxt = formatSingleLineFit(pdf, compactTimeLabel(period.time), cellInnerW)
      pdf.text(timeTxt, cellX + innerPad, y + 3.1)

      if (isNonTeaching) {
        setFont('semibold')
        pdf.setFontSize(5.6)
        pdf.setTextColor(100, 116, 139)
        const nonTeachLabel = slot.subject.toLowerCase().includes('refreshment')
          ? 'Refreshment'
          : 'Free Period'
        pdf.text(nonTeachLabel, cellX + periodColW / 2, y + rowH / 2 + 2.2, {
          align: 'center',
        })
        continue
      }

      // Subject (up to 2 crisp wrapped vector lines)
      setFont('bold')
      pdf.setFontSize(5.4)
      pdf.setTextColor(15, 23, 42)
      if (hasUthman && ARABIC_REGEX.test(slot.subject)) {
        drawSafeVectorText(pdf, slot.subject, cellX + periodColW / 2, y + 7.2, {
          align: 'center',
          hasUthman,
          weight: 'bold',
        })
      } else {
        const subjectLines = pdf.splitTextToSize(slot.subject.trim(), cellInnerW).slice(0, 2) as string[]
        if (subjectLines.length === 1) {
          pdf.text(subjectLines[0], cellX + innerPad, y + 6.9)
        } else {
          pdf.text(subjectLines[0], cellX + innerPad, y + 6.1)
          pdf.text(
            formatSingleLineFit(pdf, subjectLines[1], cellInnerW),
            cellX + innerPad,
            y + 8.6,
          )
        }
      }

      // Teacher / Usthad name at bottom of cell
      setFont('semibold')
      pdf.setFontSize(4.7)
      pdf.setTextColor(4, 120, 87)
      const teacherTxt = formatSingleLineFit(
        pdf,
        compactTeacherForMatrix(slot.teacher),
        cellInnerW,
      )
      pdf.text(teacherTxt, cellX + innerPad, y + rowH - 1.6)
    }

    y += rowH
  })

  drawLandscapeFooter({
    pdf,
    setFont,
    setBrandFont,
    marginX,
    pageWidth,
    footerY,
    leftLabel: `Prepared By: ${params.preparedByName || 'Principal'} • ICS Academy`,
    centerLabel: 'ICS ACADEMY MANHAPPATTA • OFFICIAL MASTER TIMETABLE (A4 LANDSCAPE)',
    rightLabel: 'Principal Seal & Signature: _______________________',
  })

  await emitPdfOutput(
    pdf,
    `ICS_Academy_Master_Timetable_Sem${semester}.pdf`,
    params.mode,
  )
}

/**
 * 2. Single Class Timetable — Spacious A4 Landscape 100% Vector Table PDF
 * Works for Principal, Class Usthads, and Teaching Usthads viewing any class.
 */
export async function exportClassTimetablePdf(params: {
  className: string
  semester?: 1 | 2
  preparedByName?: string
  preparedByRole?: string
  highlightUsthad?: Pick<ClassUsthad, 'id' | 'staffId' | 'name' | 'shortName'> | null
  mode: 'download' | 'print'
}): Promise<void> {
  const semester = params.semester ?? getActiveSemester()
  const normClass = normalizeClassName(params.className)
  const schedule = getClassSemesterTimetableByClassName(normClass)
  const slots = semester === 1 ? schedule.semester1 : schedule.semester2
  const classUsthad = CLASS_USTHADS.find(
    (u) => normalizeClassName(u.className) === normClass,
  )

  const { pdf, logoDataUrl, hasUthman, setFont, setBrandFont } = await createLandscapeVectorPdf()

  const pageWidth = 297
  const marginX = 11
  const contentWidth = pageWidth - marginX * 2 // 275mm
  let y = 10

  const teachingCount = slots.filter((s) => s && !isNonTeachingTimetableSlot(s)).length
  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  drawLandscapeInstitutionalHeader({
    pdf,
    logoDataUrl,
    setFont,
    setBrandFont,
    marginX,
    y,
    contentWidth,
    headerH: 24,
    eyebrow: `OFFICIAL CLASS TIMETABLE • CLASS ${normClass.toUpperCase()}`,
    subtitleLine1: `${classUsthad?.fullClassLabel || `Class ${normClass}`}  •  Class Usthad: ${classUsthad?.name || 'Assigned Faculty'}`,
    subtitleLine2: `Academic Year 2026–27  |  Semester ${semester}  |  ${teachingCount} Teaching Periods (${schedule.periods.length} Total Slots)`,
    badgeTop: 'CLASS SCHEDULE',
    badgeMain: `CLASS ${normClass}`,
    badgeSub: `Semester ${semester} • ${todayFormatted}`,
  })

  y += 29

  // Structured Table Columns across 275mm
  const colWidths = [16, 30, 52, 95, 60, 22] // SL, Period, Time, Subject, Usthad, Type
  const colX: number[] = []
  let cursorX = marginX
  colWidths.forEach((w) => {
    colX.push(cursorX)
    cursorX += w
  })

  const tableHeaderH = 9.2
  pdf.setFillColor(8, 30, 33)
  pdf.roundedRect(marginX, y, contentWidth, tableHeaderH, 1.6, 1.6, 'F')

  setFont('bold')
  pdf.setFontSize(7.6)
  pdf.setTextColor(255, 255, 255)
  const headers = ['SL', 'PERIOD', 'TIME SLOT', 'SUBJECT / KITAB', 'USTHAD / FACULTY', 'TYPE']
  headers.forEach((h, idx) => {
    if (idx === 0 || idx === 5) {
      pdf.text(h, colX[idx] + colWidths[idx] / 2, y + 5.9, { align: 'center' })
    } else {
      pdf.text(h, colX[idx] + 3, y + 5.9)
    }
  })

  y += tableHeaderH

  const footerY = 196
  const maxBodyH = footerY - 8 - y
  const rowCount = Math.max(1, schedule.periods.length)
  const rowH = Math.min(14.5, Math.max(10.5, Math.floor((maxBodyH / rowCount) * 10) / 10))

  schedule.periods.forEach((period, idx) => {
    const slot = slots[idx] ?? { subject: 'Free Period', teacher: 'No One' }
    const isNonTeaching = isNonTeachingTimetableSlot(slot)
    const isHighlightedMine = Boolean(
      !isNonTeaching &&
        params.highlightUsthad &&
        doesUsthadMatchTeacherName(params.highlightUsthad, slot.teacher),
    )

    if (isHighlightedMine) {
      pdf.setFillColor(236, 253, 245)
    } else if (isNonTeaching) {
      pdf.setFillColor(244, 246, 248)
    } else if (idx % 2 === 0) {
      pdf.setFillColor(255, 255, 255)
    } else {
      pdf.setFillColor(248, 250, 252)
    }

    pdf.setDrawColor(203, 213, 225)
    pdf.setLineWidth(0.25)
    pdf.rect(marginX, y, contentWidth, rowH, 'FD')

    // Crisp vertical column rules
    pdf.setDrawColor(226, 232, 240)
    for (let c = 1; c < colX.length; c++) {
      pdf.line(colX[c], y, colX[c], y + rowH)
    }

    const textY = y + rowH / 2 + 1.5

    // SL
    setFont('semibold')
    pdf.setFontSize(8.5)
    pdf.setTextColor(100, 116, 139)
    pdf.text(String(idx + 1).padStart(2, '0'), colX[0] + colWidths[0] / 2, textY, {
      align: 'center',
    })

    // Period Label
    setFont('bold')
    pdf.setFontSize(8.8)
    pdf.setTextColor(isNonTeaching ? 100 : 8, isNonTeaching ? 116 : 30, isNonTeaching ? 139 : 33)
    pdf.text(period.label, colX[1] + 3, textY)

    // Time Slot
    setFont('semibold')
    pdf.setFontSize(8.4)
    pdf.setTextColor(51, 65, 85)
    pdf.text(period.time, colX[2] + 3, textY)

    // Subject / Kitab
    setFont('bold')
    pdf.setFontSize(9.2)
    pdf.setTextColor(isNonTeaching ? 100 : 15, isNonTeaching ? 116 : 23, isNonTeaching ? 139 : 42)
    const subjText = isNonTeaching
      ? slot.subject.toLowerCase().includes('refreshment')
        ? 'Refreshment Break'
        : 'Free / Study Period'
      : slot.subject
    if (hasUthman && ARABIC_REGEX.test(subjText)) {
      drawSafeVectorText(pdf, subjText, colX[3] + colWidths[3] - 3, textY, {
        align: 'right',
        hasUthman,
        weight: 'bold',
      })
    } else {
      pdf.text(formatSingleLineFit(pdf, subjText, colWidths[3] - 6), colX[3] + 3, textY)
    }

    // Teacher / Usthad
    setFont(isHighlightedMine ? 'bold' : 'normal')
    pdf.setFontSize(8.6)
    pdf.setTextColor(
      isHighlightedMine ? 4 : isNonTeaching ? 148 : 51,
      isHighlightedMine ? 120 : isNonTeaching ? 163 : 65,
      isHighlightedMine ? 87 : isNonTeaching ? 184 : 85,
    )
    const teacherDisplay = isNonTeaching ? '—' : slot.teacher
    pdf.text(formatSingleLineFit(pdf, teacherDisplay, colWidths[4] - 6), colX[4] + 3, textY)

    // Type
    setFont('bold')
    pdf.setFontSize(7)
    if (isHighlightedMine) {
      pdf.setTextColor(4, 120, 87)
      pdf.text('MY PERIOD', colX[5] + colWidths[5] / 2, textY, { align: 'center' })
    } else if (isNonTeaching) {
      pdf.setTextColor(148, 163, 184)
      pdf.text('BREAK', colX[5] + colWidths[5] / 2, textY, { align: 'center' })
    } else {
      pdf.setTextColor(3, 105, 161)
      pdf.text('CLASS', colX[5] + colWidths[5] / 2, textY, { align: 'center' })
    }

    y += rowH
  })

  drawLandscapeFooter({
    pdf,
    setFont,
    setBrandFont,
    marginX,
    pageWidth,
    footerY,
    leftLabel: `Prepared By: ${params.preparedByName || classUsthad?.name || 'Academy Office'}${params.preparedByRole ? ` (${params.preparedByRole})` : ''}`,
    centerLabel: `ICS ACADEMY MANHAPPATTA • CLASS ${normClass.toUpperCase()} TIMETABLE (SEMESTER ${semester})`,
    rightLabel: 'Principal Seal & Signature: _______________________',
  })

  const safeClass = normClass.replace(/[^a-zA-Z0-9_-]/g, '_')
  await emitPdfOutput(
    pdf,
    `ICS_Timetable_Class_${safeClass}_Sem${semester}.pdf`,
    params.mode,
  )
}

/**
 * 3. Usthad Personal Teaching Timetable — A4 Landscape 100% Vector Table PDF
 * Works for both Class Usthads and Subject / Teaching Usthads across all their assigned classes.
 */
export async function exportUsthadPersonalTimetablePdf(params: {
  usthad: ClassUsthad
  semester?: 1 | 2
  mode: 'download' | 'print'
}): Promise<void> {
  const { usthad, mode } = params
  const semester = params.semester ?? getActiveSemester()
  const scheduled = getUsthadScheduledPeriodsAcrossClasses(usthad, semester)
  const uniqueClasses = Array.from(new Set(scheduled.map((s) => s.className)))

  const { pdf, logoDataUrl, hasUthman, setFont, setBrandFont } = await createLandscapeVectorPdf()

  const pageWidth = 297
  const marginX = 11
  const contentWidth = pageWidth - marginX * 2 // 275mm
  let y = 10

  const isClassUsthad = isUsthadAssignedClassUsthadOfBatch(usthad, usthad.className)
  const roleDesc = isClassUsthad
    ? `Class Usthad (${usthad.fullClassLabel})`
    : usthad.designation || 'Faculty Usthad'
  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  drawLandscapeInstitutionalHeader({
    pdf,
    logoDataUrl,
    setFont,
    setBrandFont,
    marginX,
    y,
    contentWidth,
    headerH: 24,
    eyebrow: 'FACULTY PERSONAL TEACHING TIMETABLE',
    subtitleLine1: `${usthad.name}  •  Staff ID: ${usthad.staffId}  •  ${roleDesc}`,
    subtitleLine2: `Semester ${semester} (2026–27)  |  Classes Covered: ${uniqueClasses.length > 0 ? uniqueClasses.join(', ') : usthad.className}  |  Total Scheduled Periods: ${scheduled.length}`,
    badgeTop: 'FACULTY SCHEDULE',
    badgeMain: `${scheduled.length} PERIODS`,
    badgeSub: `Semester ${semester} • ${todayFormatted}`,
  })

  y += 29

  // Structured Table Columns across 275mm
  const colWidths = [16, 28, 50, 34, 102, 45] // SL, Period, Time, Class, Subject, Role
  const colX: number[] = []
  let cursorX = marginX
  colWidths.forEach((w) => {
    colX.push(cursorX)
    cursorX += w
  })

  const drawTableHeader = (topY: number) => {
    const tableHeaderH = 9.2
    pdf.setFillColor(8, 30, 33)
    pdf.roundedRect(marginX, topY, contentWidth, tableHeaderH, 1.6, 1.6, 'F')

    setFont('bold')
    pdf.setFontSize(7.6)
    pdf.setTextColor(255, 255, 255)
    const headers = ['SL', 'PERIOD', 'TIME SLOT', 'CLASS', 'SUBJECT / KITAB', 'ASSIGNMENT']
    headers.forEach((h, idx) => {
      if (idx === 0 || idx === 3) {
        pdf.text(h, colX[idx] + colWidths[idx] / 2, topY + 5.9, { align: 'center' })
      } else {
        pdf.text(h, colX[idx] + 3, topY + 5.9)
      }
    })
    return topY + tableHeaderH
  }

  y = drawTableHeader(y)

  const footerY = 196

  if (scheduled.length === 0) {
    pdf.setFillColor(248, 250, 252)
    pdf.setDrawColor(203, 213, 225)
    pdf.roundedRect(marginX, y + 4, contentWidth, 24, 2, 2, 'FD')
    setFont('semibold')
    pdf.setFontSize(9.5)
    pdf.setTextColor(71, 85, 105)
    pdf.text(
      `No teaching periods scheduled for ${usthad.name} in Semester ${semester}.`,
      pageWidth / 2,
      y + 17,
      { align: 'center' },
    )
  } else {
    const maxBodyH = footerY - 8 - y
    const rowH =
      scheduled.length <= 12
        ? Math.min(13.5, Math.max(10.5, Math.floor((maxBodyH / scheduled.length) * 10) / 10))
        : 9.8

    scheduled.forEach((slot, idx) => {
      if (y + rowH > footerY - 5) {
        drawLandscapeFooter({
          pdf,
          setFont,
          setBrandFont,
          marginX,
          pageWidth,
          footerY,
          leftLabel: `Faculty: ${usthad.name} (${usthad.staffId})`,
          centerLabel: `ICS ACADEMY MANHAPPATTA • PERSONAL TIMETABLE (SEMESTER ${semester})`,
          rightLabel: 'Continued on next page…',
        })
        pdf.addPage('a4', 'landscape')
        y = 12
        y = drawTableHeader(y)
      }

      const isOwnBatch = isUsthadAssignedClassUsthadOfBatch(usthad, slot.className)
      if (isOwnBatch) {
        pdf.setFillColor(236, 253, 245)
      } else if (idx % 2 === 0) {
        pdf.setFillColor(255, 255, 255)
      } else {
        pdf.setFillColor(248, 250, 252)
      }

      pdf.setDrawColor(203, 213, 225)
      pdf.setLineWidth(0.25)
      pdf.rect(marginX, y, contentWidth, rowH, 'FD')

      pdf.setDrawColor(226, 232, 240)
      for (let c = 1; c < colX.length; c++) {
        pdf.line(colX[c], y, colX[c], y + rowH)
      }

      const textY = y + rowH / 2 + 1.5

      // SL
      setFont('semibold')
      pdf.setFontSize(8.3)
      pdf.setTextColor(100, 116, 139)
      pdf.text(String(idx + 1).padStart(2, '0'), colX[0] + colWidths[0] / 2, textY, {
        align: 'center',
      })

      // Period
      setFont('bold')
      pdf.setFontSize(8.6)
      pdf.setTextColor(8, 30, 33)
      pdf.text(slot.periodLabel, colX[1] + 3, textY)

      // Time
      setFont('semibold')
      pdf.setFontSize(8.3)
      pdf.setTextColor(51, 65, 85)
      pdf.text(slot.time, colX[2] + 3, textY)

      // Class
      setFont('bold')
      pdf.setFontSize(8.8)
      pdf.setTextColor(isOwnBatch ? 4 : 3, isOwnBatch ? 120 : 105, isOwnBatch ? 87 : 161)
      pdf.text(`Class ${slot.className}`, colX[3] + colWidths[3] / 2, textY, {
        align: 'center',
      })

      // Subject
      setFont('bold')
      pdf.setFontSize(9)
      pdf.setTextColor(15, 23, 42)
      if (hasUthman && ARABIC_REGEX.test(slot.subject)) {
        drawSafeVectorText(pdf, slot.subject, colX[4] + colWidths[4] - 3, textY, {
          align: 'right',
          hasUthman,
          weight: 'bold',
        })
      } else {
        pdf.text(formatSingleLineFit(pdf, slot.subject, colWidths[4] - 6), colX[4] + 3, textY)
      }

      // Role
      setFont('semibold')
      pdf.setFontSize(7.5)
      pdf.setTextColor(isOwnBatch ? 4 : 71, isOwnBatch ? 120 : 85, isOwnBatch ? 87 : 105)
      pdf.text(isOwnBatch ? 'Own Class (Class Usthad)' : 'Subject Teaching', colX[5] + 3, textY)

      y += rowH
    })
  }

  drawLandscapeFooter({
    pdf,
    setFont,
    setBrandFont,
    marginX,
    pageWidth,
    footerY,
    leftLabel: `Faculty: ${usthad.name} (${usthad.staffId})`,
    centerLabel: `ICS ACADEMY MANHAPPATTA • PERSONAL TEACHING TIMETABLE (SEMESTER ${semester})`,
    rightLabel: 'Principal Seal & Signature: _______________________',
  })

  const safeName = usthad.name.replace(/[^a-zA-Z0-9_-]/g, '_')
  await emitPdfOutput(
    pdf,
    `ICS_Timetable_${safeName}_Sem${semester}.pdf`,
    mode,
  )
}
