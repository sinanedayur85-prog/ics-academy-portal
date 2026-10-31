'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { jsPDF } from 'jspdf'
import {
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  GraduationCap,
  Loader2,
  Printer,
  ShieldCheck,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ABSENT_REASONS,
  ATTENDANCE_LEAVE_REASONS,
  CLASS_USTHADS,
  CURRENT_SEMESTER,
  getClassSemesterTimetable,
  getEffectiveStudentAttendance,
  loadAttendanceOverrides,
  loadPeriodAttendanceSubmissions,
  type AttendanceOverrideMap,
  type PeriodAttendanceStatus,
  type PeriodAttendanceSubmission,
  type Student,
} from '@/components/dashboard/data'
import type { SavedLeaveEntry } from '@/components/dashboard/leave-register'
import { cn } from '@/lib/utils'

type CachedPdfAssets = {
  regularB64: string
  semiBoldB64: string
  boldB64: string
  logoDataUrl: string | null
}

let cachedPdfAssetsPromise: Promise<CachedPdfAssets> | null = null

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

async function loadPdfAssets(): Promise<CachedPdfAssets> {
  if (cachedPdfAssetsPromise) return cachedPdfAssetsPromise

  cachedPdfAssetsPromise = (async () => {
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

  return cachedPdfAssetsPromise
}

function sanitizeId(raw: string) {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120) || 'student'
}

function getTodayDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function loadStudentLeaveEntries(studentId: string): SavedLeaveEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const safeId = sanitizeId(studentId)
    const raw = window.localStorage.getItem(`ics_leave_records_${safeId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedLeaveEntry[]
    return Array.isArray(parsed)
      ? parsed.sort((a, b) => b.createdAtMs - a.createdAtMs)
      : []
  } catch {
    return []
  }
}

export type DraftPeriodSnapshot = {
  periodIndex: number
  status: PeriodAttendanceStatus
  reason?: string
}

type ParentReportModalProps = {
  student: Student | null
  onClose: () => void
  initialDate?: string
  preparedByRole: string
  preparedByName: string
  preparedById: string
  livePeriodDraft?: DraftPeriodSnapshot
}

export function ParentReportModal({
  student,
  onClose,
  initialDate,
  preparedByRole,
  preparedByName,
  preparedById,
  livePeriodDraft,
}: ParentReportModalProps) {
  const [mounted, setMounted] = useState(false)
  const [reportDate, setReportDate] = useState<string>(
    initialDate || getTodayDateString(),
  )
  const [overrides, setOverrides] = useState<AttendanceOverrideMap>({})
  const [periodSubmissions, setPeriodSubmissions] = useState<
    Record<string, PeriodAttendanceSubmission>
  >({})
  const [leaveEntries, setLeaveEntries] = useState<SavedLeaveEntry[]>([])
  const [downloading, setDownloading] = useState(false)
  const [downloadedToast, setDownloadedToast] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (initialDate) {
      setReportDate(initialDate)
    }
  }, [initialDate])

  useEffect(() => {
    if (!student) return
    setOverrides(loadAttendanceOverrides())
    setPeriodSubmissions(loadPeriodAttendanceSubmissions())
    setLeaveEntries(loadStudentLeaveEntries(student.id))
  }, [student])

  const classUsthad = useMemo(() => {
    if (!student) return CLASS_USTHADS[0]
    return (
      CLASS_USTHADS.find((u) => u.className === student.className) ??
      CLASS_USTHADS[0]
    )
  }, [student])

  const effectiveAttendance = useMemo(() => {
    if (!student) return null
    return getEffectiveStudentAttendance(student, overrides)
  }, [student, overrides])

  const overallStats = useMemo(() => {
    if (!effectiveAttendance) {
      return {
        present: 0,
        absent: 0,
        leave: 0,
        total: 0,
        officialHolidays: 0,
        rate: 0,
      }
    }
    const { present, absent, leave, workingDays, officialHolidayDays } =
      effectiveAttendance.attendance
    const total = workingDays || present + absent + leave
    const rate = total > 0 ? Math.round((present / total) * 1000) / 10 : 0
    return {
      present,
      absent,
      leave,
      total,
      officialHolidays: officialHolidayDays,
      rate,
    }
  }, [effectiveAttendance])

  const isCurrentlyOnLeave = useMemo(() => {
    const latest = leaveEntries[0]
    return latest?.recordType === 'application'
  }, [leaveEntries])

  const periodRows = useMemo(() => {
    if (!student) return []
    const timetable = getClassSemesterTimetable(student)
    const semesterSlots =
      CURRENT_SEMESTER === 1 ? timetable.semester1 : timetable.semester2

    return timetable.periods.map((period, idx) => {
      const periodIndex = idx + 1
      const slot = semesterSlots[idx] ?? {
        subject: 'General Study',
        teacher: classUsthad.shortName,
      }
      const key = `${reportDate}__${student.className}__${periodIndex}`
      const savedSub = periodSubmissions[key]

      let status: PeriodAttendanceStatus | 'not-submitted' = 'not-submitted'
      let reason = '—'

      if (savedSub && savedSub.records[student.id]) {
        status = savedSub.records[student.id]
        if (status === 'absent') {
          reason = savedSub.reasons?.[student.id] ?? ABSENT_REASONS[0]
        } else if (status === 'leave') {
          reason = savedSub.reasons?.[student.id] ?? ATTENDANCE_LEAVE_REASONS[0]
        }
      } else if (
        livePeriodDraft &&
        livePeriodDraft.periodIndex === periodIndex &&
        reportDate === (initialDate || getTodayDateString())
      ) {
        status = livePeriodDraft.status
        if (status === 'absent') {
          reason = livePeriodDraft.reason ?? ABSENT_REASONS[0]
        } else if (status === 'leave') {
          reason = livePeriodDraft.reason ?? ATTENDANCE_LEAVE_REASONS[0]
        }
      }

      return {
        periodIndex,
        label: period.label,
        time: period.time,
        subject: slot.subject,
        teacher: slot.teacher,
        status,
        reason,
        isSubmitted: Boolean(savedSub),
      }
    })
  }, [
    student,
    classUsthad.shortName,
    reportDate,
    periodSubmissions,
    livePeriodDraft,
    initialDate,
  ])

  const leavePages = useMemo(() => {
    const chunkSize = 12
    if (leaveEntries.length === 0) return [[]]
    const chunks: SavedLeaveEntry[][] = []
    for (let i = 0; i < leaveEntries.length; i += chunkSize) {
      chunks.push(leaveEntries.slice(i, i + chunkSize))
    }
    return chunks
  }, [leaveEntries])

  const totalPages = 1 + leavePages.length
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])

  if (!student || !effectiveAttendance) return null

  const issueDateFormatted = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  async function handleDownloadPdf() {
    if (!student || !effectiveAttendance) return
    setDownloading(true)
    setDownloadedToast(null)

    try {
      const assets = await loadPdfAssets()
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      })

      // Register embedded Poppins TrueType fonts for 100% vector text at any zoom level
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

      const drawOuterSheetCard = () => {
        pdf.setFillColor(255, 255, 255)
        pdf.setDrawColor(203, 213, 225)
        pdf.setLineWidth(0.3)
        pdf.roundedRect(8, 8, 194, 281, 3, 3, 'FD')
      }

      const drawPageFooter = (pageNum: number) => {
        pdf.setDrawColor(226, 232, 240)
        pdf.setLineWidth(0.25)
        pdf.line(13, 279, 197, 279)

        setFont('normal', 7.5)
        pdf.setTextColor(100, 116, 139)
        pdf.text(
          `ICS Academy Manhappatta  |  ${student.name} (${student.admissionNo})`,
          13,
          283.5,
        )

        setFont('semibold', 7.5)
        pdf.setTextColor(51, 65, 85)
        pdf.text(`Page ${pageNum} of ${totalPages}`, 197, 283.5, {
          align: 'right',
        })
      }

      const LOGO_ASPECT_RATIO = 381 / 512

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

      // ==================== VECTOR PAGE 1 ====================
      drawOuterSheetCard()

      // 1. Official ICS Academy Header Banner
      pdf.setFillColor(8, 30, 33) // #081E21
      pdf.roundedRect(13, 13, 184, 22, 2.8, 2.8, 'F')

      // White Logo Badge (16x16mm square with exact 381:512 object-contain logo)
      drawLogoBadge(16.5, 16, 16, 2, 1.8)

      // Header Texts
      setFont('bold', 7.5)
      pdf.setTextColor(163, 230, 53) // #a3e635
      pdf.text("ICS ACADEMY MANHAPPATTA  •  DA'WA COLLEGE", 35.5, 19.2)

      setFont('bold', 12.5)
      pdf.setTextColor(255, 255, 255)
      pdf.text('Official Student Attendance & Leave Report', 35.5, 25.2)

      setFont('normal', 8)
      pdf.setTextColor(203, 213, 225)
      pdf.text('For Parents / Guardians  •  Academic Year 2026-27', 35.5, 30.2)

      // Official Statement Pill
      pdf.setFillColor(28, 51, 54)
      pdf.roundedRect(159.5, 16.2, 34, 5.8, 1.5, 1.5, 'F')
      setFont('semibold', 7.2)
      pdf.setTextColor(163, 230, 53)
      pdf.text('Official Statement', 176.5, 20.1, { align: 'center' })

      setFont('normal', 8)
      pdf.setTextColor(203, 213, 225)
      pdf.text(`Issued: ${issueDateFormatted}`, 193.5, 27.5, { align: 'right' })

      // 2. Student Profile & Overall Summary Card
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
      pdf.text(student.name, 16.5, 48.8)

      setFont('normal', 8.2)
      pdf.setTextColor(71, 85, 105)
      pdf.text('Admission No.: ', 16.5, 54)
      const admLabelW = pdf.getTextWidth('Admission No.: ')
      setFont('bold', 8.2)
      pdf.setTextColor(15, 23, 42)
      pdf.text(student.admissionNo, 16.5 + admLabelW, 54)

      setFont('normal', 8.2)
      pdf.setTextColor(71, 85, 105)
      pdf.text('Class & Batch: ', 16.5, 59)
      const clsLabelW = pdf.getTextWidth('Class & Batch: ')
      setFont('semibold', 8.2)
      pdf.setTextColor(15, 23, 42)
      pdf.text(student.className, 16.5 + clsLabelW, 59)

      setFont('normal', 8.2)
      pdf.setTextColor(71, 85, 105)
      pdf.text('Class Usthad: ', 16.5, 64)
      const ustLabelW = pdf.getTextWidth('Class Usthad: ')
      setFont('semibold', 8.2)
      pdf.setTextColor(15, 23, 42)
      pdf.text(`${classUsthad.name} (${classUsthad.staffId})`, 16.5 + ustLabelW, 64)

      // Right Column: White Inner Stats Box
      pdf.setFillColor(255, 255, 255)
      pdf.setDrawColor(226, 232, 240)
      pdf.roundedRect(105, 41.5, 89, 24.5, 1.8, 1.8, 'FD')

      setFont('semibold', 8)
      pdf.setTextColor(71, 85, 105)
      pdf.text('Working Days Attendance:', 108.5, 47.2)

      setFont('bold', 9)
      pdf.setTextColor(4, 120, 87) // #047857
      pdf.text(
        `${overallStats.rate}% (${overallStats.present}/${overallStats.total} Working Days)`,
        190.5,
        47.2,
        { align: 'right' },
      )

      // Present / Absent / Leave counts
      setFont('normal', 8)
      pdf.setTextColor(71, 85, 105)
      pdf.text('Present: ', 108.5, 54)
      const presW = pdf.getTextWidth('Present: ')
      setFont('bold', 8)
      pdf.setTextColor(4, 120, 87)
      pdf.text(`${overallStats.present}d`, 108.5 + presW, 54)

      setFont('normal', 8)
      pdf.setTextColor(71, 85, 105)
      pdf.text('Absent: ', 142, 54)
      const absW = pdf.getTextWidth('Absent: ')
      setFont('bold', 8)
      pdf.setTextColor(220, 38, 38)
      pdf.text(`${overallStats.absent}d`, 142 + absW, 54)

      setFont('normal', 8)
      pdf.setTextColor(71, 85, 105)
      const leaveValStr = `${overallStats.leave}d`
      setFont('bold', 8)
      const leaveValW = pdf.getTextWidth(leaveValStr)
      pdf.setTextColor(217, 119, 6)
      pdf.text(leaveValStr, 190.5, 54, { align: 'right' })
      setFont('normal', 8)
      pdf.setTextColor(71, 85, 105)
      pdf.text('Leave: ', 190.5 - leaveValW, 54, { align: 'right' })

      pdf.setDrawColor(241, 245, 249)
      pdf.line(108.5, 57.4, 190.5, 57.4)

      setFont('normal', 8)
      pdf.setTextColor(100, 116, 139)
      pdf.text('Current Campus Status:', 108.5, 62.5)

      setFont('bold', 8)
      if (isCurrentlyOnLeave) {
        pdf.setTextColor(220, 38, 38)
        pdf.text('ON LEAVE', 190.5, 62.5, { align: 'right' })
      } else {
        pdf.setTextColor(4, 120, 87)
        pdf.text('AT ACADEMY', 190.5, 62.5, { align: 'right' })
      }

      // 3. Section 1: Daily Period-by-Period Attendance & Reasons (All 6 Periods)
      setFont('bold', 8.2)
      pdf.setTextColor(30, 41, 59)
      pdf.text(
        `1. DAILY PERIOD-BY-PERIOD ATTENDANCE & REASONS (${reportDate})`,
        13,
        74.5,
      )

      setFont('normal', 7.2)
      pdf.setTextColor(100, 116, 139)
      pdf.text(
        `Semester ${CURRENT_SEMESTER} Schedule  •  All ${periodRows.length} Periods`,
        197,
        74.5,
        { align: 'right' },
      )

      const s1Top = 76.8
      const s1HeaderH = 6.8
      const s1RowH = 9.4
      const s1TotalH = s1HeaderH + periodRows.length * s1RowH

      // Header background
      pdf.setFillColor(241, 245, 249)
      pdf.rect(13, s1Top, 184, s1HeaderH, 'F')

      setFont('bold', 7.2)
      pdf.setTextColor(51, 65, 85)
      pdf.text('PERIOD & TIME', 16, s1Top + 4.5)
      pdf.text('SUBJECT & USTHAD', 56, s1Top + 4.5)
      pdf.text('STATUS', 119, s1Top + 4.5)
      pdf.text('ABSENT / LEAVE REASON', 145, s1Top + 4.5)

      pdf.setDrawColor(226, 232, 240)
      pdf.setLineWidth(0.22)
      pdf.line(13, s1Top + s1HeaderH, 197, s1Top + s1HeaderH)

      periodRows.forEach((row, idx) => {
        const rowY = s1Top + s1HeaderH + idx * s1RowH
        if (idx > 0) {
          pdf.setDrawColor(226, 232, 240)
          pdf.line(13, rowY, 197, rowY)
        }

        // Col 1: Period & Time
        setFont('semibold', 8)
        pdf.setTextColor(15, 23, 42)
        pdf.text(row.label, 16, rowY + 3.9)
        setFont('normal', 7)
        pdf.setTextColor(100, 116, 139)
        pdf.text(row.time.replace(/–/g, '-'), 16, rowY + 7.5)

        // Col 2: Subject & Usthad
        setFont('semibold', 8)
        pdf.setTextColor(30, 41, 59)
        pdf.text(row.subject, 56, rowY + 3.9)
        setFont('normal', 7)
        pdf.setTextColor(100, 116, 139)
        pdf.text(row.teacher, 56, rowY + 7.5)

        // Col 3: Status
        setFont('bold', 8)
        if (row.status === 'present') {
          pdf.setTextColor(4, 120, 87)
          pdf.text('Present', 119, rowY + 5.6)
        } else if (row.status === 'absent') {
          pdf.setTextColor(220, 38, 38)
          pdf.text('Absent', 119, rowY + 5.6)
        } else if (row.status === 'leave') {
          pdf.setTextColor(217, 119, 6)
          pdf.text('On Leave', 119, rowY + 5.6)
        } else {
          pdf.setTextColor(148, 163, 184)
          pdf.text('Not Marked', 119, rowY + 5.6)
        }

        // Col 4: Reason
        setFont('normal', 7.6)
        pdf.setTextColor(51, 65, 85)
        const cleanReason = row.reason === '—' ? '-' : row.reason
        const wrappedReason = pdf.splitTextToSize(cleanReason, 49) as string[]
        if (wrappedReason.length === 1) {
          pdf.text(wrappedReason[0], 145, rowY + 5.6)
        } else {
          pdf.text(wrappedReason.slice(0, 2), 145, rowY + 4.1)
        }
      })

      // Outer border of Section 1 Table
      pdf.setDrawColor(226, 232, 240)
      pdf.setLineWidth(0.25)
      pdf.roundedRect(13, s1Top, 184, s1TotalH, 1.8, 1.8, 'S')

      // 4. Section 2: Monthly Attendance Summary & Reasons (All 12 Months)
      const s2TitleY = s1Top + s1TotalH + 6.5
      setFont('bold', 8.2)
      pdf.setTextColor(30, 41, 59)
      pdf.text(
        '2. MONTHLY WORKING DAYS, ATTENDANCE & REASONS (2026)',
        13,
        s2TitleY,
      )

      setFont('normal', 7)
      pdf.setTextColor(100, 116, 139)
      pdf.text(
        `${overallStats.total} Working Days  •  ${overallStats.officialHolidays}d Official Holidays Excluded`,
        197,
        s2TitleY,
        { align: 'right' },
      )

      const s2Top = s2TitleY + 2.3
      const s2HeaderH = 6.8
      const s2RowH = 7.1
      const months = effectiveAttendance.monthlyAttendance
      const s2TotalH = s2HeaderH + months.length * s2RowH

      pdf.setFillColor(241, 245, 249)
      pdf.rect(13, s2Top, 184, s2HeaderH, 'F')

      setFont('bold', 6.9)
      pdf.setTextColor(51, 65, 85)
      pdf.text('MONTH', 16, s2Top + 4.5)
      pdf.text('WORK DAYS', 56, s2Top + 4.5, { align: 'right' })
      pdf.text('PRESENT', 72, s2Top + 4.5, { align: 'right' })
      pdf.text('ABSENT', 86, s2Top + 4.5, { align: 'right' })
      pdf.text('LEAVE', 100, s2Top + 4.5, { align: 'right' })
      pdf.text('RATE', 115, s2Top + 4.5, { align: 'right' })
      pdf.text('ABSENT / LEAVE REASON', 120, s2Top + 4.5)

      pdf.setDrawColor(226, 232, 240)
      pdf.line(13, s2Top + s2HeaderH, 197, s2Top + s2HeaderH)

      months.forEach((m, idx) => {
        const rowY = s2Top + s2HeaderH + idx * s2RowH
        if (idx > 0) {
          pdf.setDrawColor(226, 232, 240)
          pdf.line(13, rowY, 197, rowY)
        }

        const tot = m.workingDays || m.present + m.absent + m.leave
        const rt = tot > 0 ? Math.round((m.present / tot) * 1000) / 10 : 0
        const ov = overrides[`${student.id}__${m.id}`]
        const reasonsList: string[] = []
        if (m.absent > 0) {
          reasonsList.push(`Absent: ${ov?.absentReason ?? ABSENT_REASONS[0]}`)
        }
        if (m.leave > 0) {
          reasonsList.push(
            `Leave: ${ov?.leaveReason ?? ATTENDANCE_LEAVE_REASONS[0]}`,
          )
        }

        setFont('semibold', 7.6)
        pdf.setTextColor(15, 23, 42)
        pdf.text(`${m.month} ${m.year}`, 16, rowY + 4.8)

        setFont('semibold', 7.6)
        pdf.setTextColor(71, 85, 105)
        pdf.text(`${tot}d`, 56, rowY + 4.8, { align: 'right' })

        pdf.setTextColor(4, 120, 87)
        pdf.text(`${m.present}d`, 72, rowY + 4.8, { align: 'right' })

        pdf.setTextColor(220, 38, 38)
        pdf.text(`${m.absent}d`, 86, rowY + 4.8, { align: 'right' })

        pdf.setTextColor(217, 119, 6)
        pdf.text(`${m.leave}d`, 100, rowY + 4.8, { align: 'right' })

        setFont('bold', 7.6)
        pdf.setTextColor(15, 23, 42)
        pdf.text(`${rt}%`, 115, rowY + 4.8, { align: 'right' })

        setFont('normal', 7.0)
        pdf.setTextColor(71, 85, 105)
        const reasonText =
          reasonsList.length > 0 ? reasonsList.join('  •  ') : '-'
        const wrapped = pdf.splitTextToSize(reasonText, 74) as string[]
        if (wrapped.length <= 1) {
          pdf.text(wrapped[0] ?? '-', 120, rowY + 4.8)
        } else {
          setFont('normal', 6.4)
          pdf.text(wrapped[0], 120, rowY + 3.2)
          pdf.text(wrapped[1], 120, rowY + 6.0)
        }
      })

      pdf.setDrawColor(226, 232, 240)
      pdf.setLineWidth(0.25)
      pdf.roundedRect(13, s2Top, 184, s2TotalH, 1.8, 1.8, 'S')

      drawPageFooter(1)

      // ==================== VECTOR PAGE 2+ (LEAVE REGISTER & SIGNATURE) ====================
      leavePages.forEach((chunk, pageIdx) => {
        const pageNumber = pageIdx + 2
        const isLastPage = pageNumber === totalPages

        pdf.addPage()
        drawOuterSheetCard()

        // Continuation Header Banner
        pdf.setFillColor(8, 30, 33)
        pdf.roundedRect(13, 13, 184, 17, 2.5, 2.5, 'F')

        // White Logo Badge (12x12mm square with exact 381:512 object-contain logo)
        drawLogoBadge(16, 15.5, 12, 1.8, 1.4)

        setFont('bold', 7)
        pdf.setTextColor(163, 230, 53)
        pdf.text(
          'ICS ACADEMY MANHAPPATTA  •  OFFICIAL ATTENDANCE & LEAVE REPORT',
          31,
          19.5,
        )

        setFont('bold', 10)
        pdf.setTextColor(255, 255, 255)
        pdf.text(
          `${student.name} (${student.admissionNo})  •  ${student.className}`,
          31,
          25.2,
        )

        setFont('semibold', 8)
        pdf.setTextColor(163, 230, 53)
        pdf.text(`Page ${pageNumber} of ${totalPages}`, 193.5, 19.8, {
          align: 'right',
        })

        setFont('normal', 7.5)
        pdf.setTextColor(203, 213, 225)
        pdf.text(`Issued: ${issueDateFormatted}`, 193.5, 25.2, {
          align: 'right',
        })

        // Section 3: Campus Leave & Return Register History
        setFont('bold', 8.2)
        pdf.setTextColor(30, 41, 59)
        const partLabel = leavePages.length > 1 ? ` (PART ${pageIdx + 1})` : ''
        pdf.text(
          `3. CAMPUS LEAVE & RETURN REGISTER HISTORY${partLabel}`,
          13,
          36.5,
        )

        setFont('normal', 7.2)
        pdf.setTextColor(100, 116, 139)
        pdf.text(
          `Total Recorded Entries: ${leaveEntries.length}`,
          197,
          36.5,
          { align: 'right' },
        )

        let nextSectionY = 58

        if (chunk.length === 0) {
          setFont('normal', 8.2)
          const emptyMsg = `No campus leave departures or returns have been recorded in the register for ${student.name} (${student.admissionNo}) during this period.`
          const emptyLines = pdf.splitTextToSize(emptyMsg, 174) as string[]
          const emptyBoxH = emptyLines.length > 1 ? 16.5 : 13

          pdf.setFillColor(248, 250, 252)
          pdf.setDrawColor(226, 232, 240)
          pdf.setLineWidth(0.25)
          pdf.roundedRect(13, 39, 184, emptyBoxH, 2, 2, 'FD')

          pdf.setTextColor(71, 85, 105)
          if (emptyLines.length === 1) {
            pdf.text(emptyLines[0], 17.5, 46.8)
          } else {
            pdf.text(emptyLines[0], 17.5, 45.4)
            pdf.text(emptyLines[1], 17.5, 50.2)
          }
          nextSectionY = 39 + emptyBoxH + 8
        } else {
          const s3Top = 39
          const s3HeaderH = 7
          const s3RowH = 9
          const s3TotalH = s3HeaderH + chunk.length * s3RowH

          pdf.setFillColor(241, 245, 249)
          pdf.rect(13, s3Top, 184, s3HeaderH, 'F')

          setFont('bold', 7.2)
          pdf.setTextColor(51, 65, 85)
          pdf.text('DATE & TIME', 16, s3Top + 4.6)
          pdf.text('ENTRY TYPE', 61, s3Top + 4.6)
          pdf.text('LEAVE REASON', 98, s3Top + 4.6)
          pdf.text('DETAILS / REMARKS', 145, s3Top + 4.6)

          pdf.setDrawColor(226, 232, 240)
          pdf.line(13, s3Top + s3HeaderH, 197, s3Top + s3HeaderH)

          chunk.forEach((entry, idx) => {
            const rowY = s3Top + s3HeaderH + idx * s3RowH
            if (idx > 0) {
              pdf.setDrawColor(226, 232, 240)
              pdf.line(13, rowY, 197, rowY)
            }

            setFont('normal', 7.6)
            pdf.setTextColor(51, 65, 85)
            pdf.text(`${entry.dateString}  •  ${entry.timeString}`, 16, rowY + 5.5)

            setFont('bold', 7.8)
            if (entry.recordType === 'application') {
              pdf.setTextColor(220, 38, 38)
              pdf.text('Leave Departure', 61, rowY + 5.5)
            } else {
              pdf.setTextColor(4, 120, 87)
              pdf.text('Campus Return', 61, rowY + 5.5)
            }

            setFont('semibold', 7.8)
            pdf.setTextColor(30, 41, 59)
            const reasonLines = pdf.splitTextToSize(entry.reason, 44) as string[]
            pdf.text(reasonLines[0] ?? '-', 98, rowY + 5.5)

            setFont('normal', 7.5)
            pdf.setTextColor(71, 85, 105)
            const detailStr = entry.details || 'Verified by Academy'
            const detailLines = pdf.splitTextToSize(detailStr, 49) as string[]
            if (detailLines.length <= 1) {
              pdf.text(detailLines[0] ?? 'Verified by Academy', 145, rowY + 5.5)
            } else {
              pdf.text(detailLines.slice(0, 2), 145, rowY + 4.0)
            }
          })

          pdf.setDrawColor(226, 232, 240)
          pdf.setLineWidth(0.25)
          pdf.roundedRect(13, s3Top, 184, s3TotalH, 1.8, 1.8, 'S')
          nextSectionY = s3Top + s3TotalH + 8
        }

        // Official Verification & Class Usthad Signature Box on Final Page
        if (isLastPage) {
          const sigBoxY = Math.max(nextSectionY, 232)
          pdf.setFillColor(248, 250, 252)
          pdf.setDrawColor(226, 232, 240)
          pdf.setLineWidth(0.25)
          pdf.roundedRect(13, sigBoxY, 184, 38, 2.2, 2.2, 'FD')

          setFont('bold', 8.5)
          pdf.setTextColor(15, 23, 42)
          pdf.text(
            `Report Prepared By: ${preparedByName} (${preparedByRole})`,
            17,
            sigBoxY + 9,
          )

          setFont('normal', 8)
          pdf.setTextColor(51, 65, 85)
          pdf.text(
            `Official ID: ${preparedById}  •  Date: ${issueDateFormatted}`,
            17,
            sigBoxY + 14.8,
          )

          setFont('normal', 7.2)
          pdf.setTextColor(100, 116, 139)
          const noteLines = pdf.splitTextToSize(
            'This is an official attendance and leave statement issued by ICS Academy Manhappatta. Parents / Guardians may contact the Class Usthad for any clarification.',
            95,
          ) as string[]
          pdf.text(noteLines, 17, sigBoxY + 21)

          // Signature Line & Usthad Details
          pdf.setDrawColor(100, 116, 139)
          pdf.setLineWidth(0.4)
          pdf.line(133, sigBoxY + 19, 191, sigBoxY + 19)

          setFont('bold', 8)
          pdf.setTextColor(15, 23, 42)
          pdf.text("CLASS USTHAD'S SIGNATURE & SEAL", 162, sigBoxY + 24, {
            align: 'center',
          })

          setFont('semibold', 8.5)
          pdf.setTextColor(30, 41, 59)
          pdf.text(classUsthad.name, 162, sigBoxY + 29, { align: 'center' })

          setFont('normal', 7.2)
          pdf.setTextColor(100, 116, 139)
          pdf.text(
            `${classUsthad.fullClassLabel} (${classUsthad.staffId})`,
            162,
            sigBoxY + 33.5,
            { align: 'center' },
          )
        }

        drawPageFooter(pageNumber)
      })

      const safeFileName = `ICS_Report_${student.admissionNo}_${student.name.replace(/\s+/g, '_')}.pdf`
      pdf.save(safeFileName)
      setDownloadedToast(
        `Downloaded ${safeFileName} (${totalPages} A4 Vector Pages)`,
      )
    } catch (err) {
      console.error('Failed to generate PDF:', err)
    } finally {
      setDownloading(false)
    }
  }

  function handlePrintReport() {
    window.print()
  }

  const pageFontStyle = {
    margin: 0,
    WebkitPrintColorAdjust: 'exact' as const,
    printColorAdjust: 'exact' as const,
    WebkitFontSmoothing: 'antialiased' as const,
    fontFamily:
      "'Poppins', 'Tajawal', 'Noto Serif Malayalam', system-ui, -apple-system, sans-serif",
  }

  const modalContent = (
    <div
      id="printable-parent-report-container"
      role="dialog"
      aria-modal="true"
      aria-labelledby="parent-report-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm sm:p-5 print:static print:bg-white print:p-0"
    >
      <div className="flex h-[94vh] max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl print:h-auto print:max-h-none print:max-w-none print:rounded-none print:border-0 print:bg-white print:shadow-none">
        {/* Top Action Bar (Hidden when printing) */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-5 py-3.5 print:hidden no-print">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-lime/15 text-lime">
              <FileText className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2
                id="parent-report-modal-title"
                className="font-display text-base font-bold text-foreground sm:text-lg"
              >
                Parent Attendance & Leave PDF Report ({totalPages} A4 Pages)
              </h2>
              <p className="text-xs text-muted-foreground">
                {student.name} ({student.admissionNo}) • {student.className} • Scroll down to preview all pages
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="pdf-report-date"
                className="text-xs font-medium text-muted-foreground"
              >
                Period Date:
              </label>
              <Input
                id="pdf-report-date"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value || getTodayDateString())}
                className="h-9 w-38 rounded-xl text-xs tabular-nums"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrintReport}
              className="h-9 rounded-xl px-3.5 text-xs font-semibold"
            >
              <Printer className="mr-1.5 size-3.5" aria-hidden="true" />
              Print Report
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={downloading}
              onClick={() => void handleDownloadPdf()}
              className="h-9 rounded-xl px-4 text-xs font-semibold"
            >
              {downloading ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="mr-1.5 size-3.5" aria-hidden="true" />
              )}
              Download PDF
            </Button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close report preview"
              className="flex size-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {downloadedToast ? (
          <div className="flex shrink-0 items-center gap-2 border-b border-lime/30 bg-lime/10 px-5 py-2 text-xs font-semibold text-emerald-700 dark:text-lime print:hidden no-print">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            <span>{downloadedToast}</span>
          </div>
        ) : null}

        {/* Scrollable Multi-Page A4 Preview Container */}
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto bg-slate-200/80 p-4 sm:p-6 print:overflow-visible print:bg-white print:p-0">
          <div
            id="printable-parent-report-sheet"
            className="mx-auto flex w-fit flex-col items-center gap-6 pb-8 print:w-full print:gap-0 print:pb-0"
          >
            {/* ==================== A4 PAGE 1 ==================== */}
            <div
              ref={(el) => {
                pageRefs.current[0] = el
              }}
              style={pageFontStyle}
              className="a4-report-page m-0 flex h-auto w-[760px] min-w-[760px] max-w-[760px] shrink-0 flex-col gap-3 rounded-xl border border-slate-300 bg-white p-6 text-slate-900 shadow-md print:w-full print:min-w-0 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
            >
              {/* 1. Official ICS Academy Header & Logo */}
              <div className="flex flex-row items-center justify-between gap-3 rounded-xl bg-[#081E21] px-4 py-3 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/95 p-1.5 shadow-xs">
                    <img
                      src="/images/ics-mark-transparent.png"
                      alt="ICS Academy Logo"
                      crossOrigin="anonymous"
                      className="h-full w-auto object-contain"
                    />
                  </div>
                  <div>
                    <p className="text-[9.5px] font-bold tracking-[0.15em] text-[#a3e635] uppercase">
                      ICS Academy Manhappatta • Da&apos;wa College
                    </p>
                    <h3 className="mt-0.5 text-[15px] font-bold tracking-tight text-white leading-snug">
                      Official Student Attendance & Leave Report
                    </h3>
                    <p className="text-[10.5px] text-slate-300">
                      For Parents / Guardians • Academic Year 2026–27
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-[9.5px] font-semibold text-[#a3e635]">
                    <ShieldCheck className="size-3" aria-hidden="true" />
                    Official Statement
                  </span>
                  <p className="mt-1 text-[10.5px] text-slate-300 tabular-nums">
                    Issued: {issueDateFormatted}
                  </p>
                </div>
              </div>

              {/* 2. Student Profile & Overall Summary */}
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-col justify-center gap-0.5 text-[11px] leading-snug">
                  <p className="text-[9.5px] font-bold tracking-wider text-slate-500 uppercase">
                    Student Information
                  </p>
                  <p className="text-[13px] font-bold text-slate-900">
                    {student.name}
                  </p>
                  <p className="text-slate-600">
                    Admission No.:{' '}
                    <span className="font-mono font-semibold text-slate-900">
                      {student.admissionNo}
                    </span>
                  </p>
                  <p className="text-slate-600">
                    Class & Batch:{' '}
                    <span className="font-semibold text-slate-900">
                      {student.className}
                    </span>
                  </p>
                  <p className="text-slate-600">
                    Class Usthad:{' '}
                    <span className="font-semibold text-slate-900">
                      {classUsthad.name} ({classUsthad.staffId})
                    </span>
                  </p>
                </div>

                <div className="flex flex-col justify-between gap-1 rounded-md border border-slate-200 bg-white p-2.5 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-600">
                      Working Days Attendance:
                    </span>
                    <span className="text-[12px] font-bold text-emerald-700 tabular-nums">
                      {overallStats.rate}% ({overallStats.present}/{overallStats.total} Working Days)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 tabular-nums">
                    <span>
                      Present: <strong className="text-emerald-700">{overallStats.present}d</strong>
                    </span>
                    <span>
                      Absent: <strong className="text-red-600">{overallStats.absent}d</strong>
                    </span>
                    <span>
                      Personal Leave: <strong className="text-amber-600">{overallStats.leave}d</strong>
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-1">
                    <span className="font-medium text-slate-500">
                      Current Campus Status:
                    </span>
                    <span
                      className={cn(
                        'text-[10.5px] font-bold uppercase',
                        isCurrentlyOnLeave ? 'text-red-600' : 'text-emerald-700',
                      )}
                    >
                      {isCurrentlyOnLeave ? 'On Leave' : 'At Academy'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Section 1: Daily Period-by-Period Attendance & Reasons (All 6 Periods) */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="flex items-center gap-1.5 text-[10.5px] font-bold tracking-wider text-slate-800 uppercase">
                    <CalendarCheck className="size-3.5 text-emerald-700" aria-hidden="true" />
                    1. Daily Period-by-Period Attendance & Reasons ({reportDate})
                  </h4>
                  <span className="text-[9.5px] font-medium text-slate-500">
                    Semester {CURRENT_SEMESTER} Schedule • All {periodRows.length} Periods
                  </span>
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full table-fixed border-collapse text-left text-[10.5px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100 text-[9.5px] font-bold text-slate-700 uppercase">
                        <th className="w-[22%] px-2.5 py-1.5">Period & Time</th>
                        <th className="w-[34%] px-2.5 py-1.5">Subject & Usthad</th>
                        <th className="w-[14%] px-2.5 py-1.5">Status</th>
                        <th className="w-[30%] px-2.5 py-1.5">Absent / Leave Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {periodRows.map((row) => (
                        <tr key={row.periodIndex} className="leading-snug">
                          <td className="px-2.5 py-1.5 font-semibold text-slate-900 tabular-nums">
                            <span>{row.label}</span>
                            <span className="block text-[9.5px] font-normal text-slate-500">
                              {row.time}
                            </span>
                          </td>
                          <td className="px-2.5 py-1.5 text-slate-800 break-words">
                            <span className="font-semibold">{row.subject}</span>
                            <span className="block text-[9.5px] text-slate-500">
                              {row.teacher}
                            </span>
                          </td>
                          <td className="px-2.5 py-1.5 text-[10.5px] font-bold">
                            {row.status === 'present' ? (
                              <span className="text-emerald-700">Present</span>
                            ) : row.status === 'absent' ? (
                              <span className="text-red-600">Absent</span>
                            ) : row.status === 'leave' ? (
                              <span className="text-amber-600">On Leave</span>
                            ) : (
                              <span className="text-slate-400">Not Marked</span>
                            )}
                          </td>
                          <td className="px-2.5 py-1.5 text-[10px] font-medium text-slate-700 break-words">
                            {row.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Section 2: Monthly Attendance Breakdown & Reasons (All 12 Months) */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="flex items-center gap-1.5 text-[10.5px] font-bold tracking-wider text-slate-800 uppercase">
                    <GraduationCap className="size-3.5 text-emerald-700" aria-hidden="true" />
                    2. Monthly Working Days, Attendance & Reasons (2026)
                  </h4>
                  <span className="text-[9.5px] font-medium text-slate-500">
                    {overallStats.total} Working Days • {overallStats.officialHolidays}d Official Holidays Excluded
                  </span>
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full table-fixed border-collapse text-left text-[10.5px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100 text-[9.5px] font-bold text-slate-700 uppercase">
                        <th className="w-[16%] px-2.5 py-1.5">Month</th>
                        <th className="w-[10%] px-1.5 py-1.5 text-right">Work Days</th>
                        <th className="w-[8%] px-1.5 py-1.5 text-right">Present</th>
                        <th className="w-[8%] px-1.5 py-1.5 text-right">Absent</th>
                        <th className="w-[8%] px-1.5 py-1.5 text-right">Leave</th>
                        <th className="w-[9%] px-1.5 py-1.5 text-right">Rate</th>
                        <th className="w-[41%] px-2.5 py-1.5">Absent / Leave Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {effectiveAttendance.monthlyAttendance.map((m) => {
                        const tot = m.workingDays || m.present + m.absent + m.leave
                        const rt = tot > 0 ? Math.round((m.present / tot) * 1000) / 10 : 0
                        const ov = overrides[`${student.id}__${m.id}`]
                        const reasonsList: string[] = []
                        if (m.absent > 0) {
                          reasonsList.push(`Absent: ${ov?.absentReason ?? ABSENT_REASONS[0]}`)
                        }
                        if (m.leave > 0) {
                          reasonsList.push(`Leave: ${ov?.leaveReason ?? ATTENDANCE_LEAVE_REASONS[0]}`)
                        }
                        return (
                          <tr key={m.id} className="leading-snug">
                            <td className="px-2.5 py-1 font-semibold text-slate-900">
                              {m.month} {m.year}
                            </td>
                            <td className="px-1.5 py-1 text-right font-mono font-semibold text-slate-600 tabular-nums">
                              {tot}d
                            </td>
                            <td className="px-1.5 py-1 text-right font-mono font-semibold text-emerald-700 tabular-nums">
                              {m.present}d
                            </td>
                            <td className="px-1.5 py-1 text-right font-mono font-semibold text-red-600 tabular-nums">
                              {m.absent}d
                            </td>
                            <td className="px-1.5 py-1 text-right font-mono font-semibold text-amber-600 tabular-nums">
                              {m.leave}d
                            </td>
                            <td className="px-1.5 py-1 text-right font-mono font-bold text-slate-900 tabular-nums">
                              {rt}%
                            </td>
                            <td className="px-2.5 py-1 text-[9.5px] text-slate-600 break-words">
                              {reasonsList.length > 0 ? reasonsList.join(' • ') : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Page 1 Footer */}
              <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-2 text-[9.5px] text-slate-500">
                <span>
                  ICS Academy Manhappatta • {student.name} ({student.admissionNo})
                </span>
                <span className="font-semibold text-slate-700">
                  Page 1 of {totalPages}
                </span>
              </div>
            </div>

            {/* ==================== A4 PAGE 2+ (LEAVE REGISTER & SIGNATURE) ==================== */}
            {leavePages.map((chunk, pageIdx) => {
              const pageNumber = pageIdx + 2
              const isLastPage = pageNumber === totalPages

              return (
                <div
                  key={`leave-page-${pageNumber}`}
                  ref={(el) => {
                    pageRefs.current[pageIdx + 1] = el
                  }}
                  style={pageFontStyle}
                  className="a4-report-page m-0 flex h-auto w-[760px] min-w-[760px] max-w-[760px] shrink-0 flex-col justify-between gap-4 rounded-xl border border-slate-300 bg-white p-6 text-slate-900 shadow-md print:w-full print:min-w-0 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
                >
                  <div className="flex flex-col gap-3.5">
                    {/* Continuation Header */}
                    <div className="flex flex-row items-center justify-between gap-3 rounded-xl bg-[#081E21] px-4 py-2.5 text-white">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/95 p-1">
                          <img
                            src="/images/ics-mark-transparent.png"
                            alt="ICS Academy Logo"
                            crossOrigin="anonymous"
                            className="h-full w-auto object-contain"
                          />
                        </div>
                        <div>
                          <p className="text-[9px] font-bold tracking-[0.15em] text-[#a3e635] uppercase">
                            ICS Academy Manhappatta • Official Attendance & Leave Report
                          </p>
                          <p className="text-[12px] font-bold text-white">
                            {student.name} ({student.admissionNo}) • {student.className}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-[10px] text-slate-300">
                        <span className="font-semibold text-[#a3e635]">
                          Page {pageNumber} of {totalPages}
                        </span>
                        <p className="tabular-nums">Issued: {issueDateFormatted}</p>
                      </div>
                    </div>

                    {/* Section 3: Campus Leave & Return Register Log */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <h4 className="flex items-center gap-1.5 text-[10.5px] font-bold tracking-wider text-slate-800 uppercase">
                          <ClipboardList className="size-3.5 text-emerald-700" aria-hidden="true" />
                          3. Campus Leave & Return Register History
                          {leavePages.length > 1 ? ` (Part ${pageIdx + 1})` : ''}
                        </h4>
                        <span className="text-[9.5px] font-medium text-slate-500">
                          Total Recorded Entries: {leaveEntries.length}
                        </span>
                      </div>

                      {chunk.length === 0 ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-[11px] text-slate-600">
                          No campus leave departures or returns have been recorded in the register for{' '}
                          <strong className="text-slate-900">{student.name}</strong> ({student.admissionNo}) during this period.
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-lg border border-slate-200">
                          <table className="w-full table-fixed border-collapse text-left text-[10.5px]">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-100 text-[9.5px] font-bold text-slate-700 uppercase">
                                <th className="w-[24%] px-2.5 py-1.5">Date & Time</th>
                                <th className="w-[20%] px-2.5 py-1.5">Entry Type</th>
                                <th className="w-[26%] px-2.5 py-1.5">Leave Reason</th>
                                <th className="w-[30%] px-2.5 py-1.5">Details / Remarks</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {chunk.map((entry) => (
                                <tr key={entry.id} className="leading-snug">
                                  <td className="px-2.5 py-1.5 font-mono text-[10px] text-slate-700 tabular-nums">
                                    {entry.dateString} • {entry.timeString}
                                  </td>
                                  <td className="px-2.5 py-1.5 text-[10.5px] font-bold">
                                    {entry.recordType === 'application' ? (
                                      <span className="text-red-600">Leave Departure</span>
                                    ) : (
                                      <span className="text-emerald-700">Campus Return</span>
                                    )}
                                  </td>
                                  <td className="px-2.5 py-1.5 font-semibold text-slate-800 break-words">
                                    {entry.reason}
                                  </td>
                                  <td className="px-2.5 py-1.5 text-[10px] text-slate-600 break-words">
                                    {entry.details || 'Verified by Academy'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Official Verification & Class Usthad Signature Column on Final Page */}
                  {isLastPage ? (
                    <div className="mt-4 flex flex-col gap-3">
                      <div className="grid grid-cols-2 items-end gap-6 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex flex-col gap-1 text-[10.5px] text-slate-600 leading-snug">
                          <p className="text-[11px] font-bold text-slate-900">
                            Report Prepared By: {preparedByName} ({preparedByRole})
                          </p>
                          <p>
                            Official ID: <span className="font-mono font-semibold text-slate-900">{preparedById}</span> • Date:{' '}
                            {issueDateFormatted}
                          </p>
                          <p className="mt-1 text-[9.5px] text-slate-500">
                            This is an official attendance and leave statement issued by ICS Academy Manhappatta. Parents / Guardians may contact the Class Usthad for any clarification.
                          </p>
                        </div>

                        <div className="flex flex-col items-end pt-8">
                          <div className="w-60 border-t-2 border-slate-400 pt-1.5 text-center">
                            <p className="text-[10.5px] font-bold text-slate-900 uppercase">
                              Class Usthad&apos;s Signature & Seal
                            </p>
                            <p className="mt-0.5 text-[11px] font-semibold text-slate-800">
                              {classUsthad.name}
                            </p>
                            <p className="text-[9.5px] text-slate-500">
                              {classUsthad.fullClassLabel} ({classUsthad.staffId})
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-[9.5px] text-slate-500">
                        <span>
                          ICS Academy Manhappatta • {student.name} ({student.admissionNo})
                        </span>
                        <span className="font-semibold text-slate-700">
                          Page {pageNumber} of {totalPages}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-2 text-[9.5px] text-slate-500">
                      <span>
                        ICS Academy Manhappatta • {student.name} ({student.admissionNo})
                      </span>
                      <span className="font-semibold text-slate-700">
                        Page {pageNumber} of {totalPages}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )

  if (!mounted) return null

  return createPortal(modalContent, document.body)
}
