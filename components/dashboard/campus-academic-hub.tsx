'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Award,
  BookOpen,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Crown,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  HeartHandshake,
  Image as ImageIcon,
  Lock,
  Plus,
  Printer,
  Send,
  ShieldAlert,
  Sparkles,
  Star,
  Trophy,
  Unlock,
  Upload,
  UserCheck,
} from 'lucide-react'
import {
  HOLIDAY_ACTIVITY_CATEGORIES,
  calculateClassStarOfTheMonth,
  compressImageFileToDataUrl,
  computeStudentZadulKhairSummary,
  exportClassZadulKhairReportPdf,
  exportStudentZadulKhairReceiptPdf,
  loadCampusAcademicRecords,
  subscribeCampusAcademicRecords,
  upsertCampusAcademicRecord,
  type AcademicRecordStatus,
  type CampusAcademicRecord,
  type UnitTestQuestion,
  type UnitTestQuestionType,
} from '@/components/dashboard/academic-hub-data'
import {
  CLASS_USTHADS,
  OFFICIAL_CLASS_USTHADS,
  buildMonthMetaForId,
  doesUsthadMatchTeacherName,
  findUsthadForTeacherName,
  getActiveSemester,
  getClassSemesterTimetableByClassName,
  getUsthadScheduledPeriodsAcrossClasses,
  isNonTeachingTimetableSlot,
  normalizeClassName,
  parseMonthId,
  publishCampusNotification,
  students,
  type ClassUsthad,
  type Student,
} from '@/components/dashboard/data'
import { Panel } from '@/components/dashboard/panel'
import { ProfileInitialsAvatar } from '@/components/dashboard/student-switcher'
import { Button } from '@/components/ui/button'
import { DeleteActionMenu } from '@/components/ui/delete-action-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MonthYearSelect } from '@/components/ui/month-year-select'
import { ThemeSelect } from '@/components/ui/theme-select'
import { cn } from '@/lib/utils'

function formatTodayDateDisplay(): string {
  return new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const ARABIC_SCRIPT_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
const ARABIC_DIACRITICS_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g
const URDU_SPECIFIC_RE = /[ٹڈڑںےگچپژک]/
const MALAYALAM_SCRIPT_RE = /[\u0D00-\u0D7F]/
const EASTERN_ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const

function toEasternArabicNumerals(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => EASTERN_ARABIC_DIGITS[Number(d)] ?? d)
}

function getMultilingualTextProps(
  text?: string,
  fallbackText?: string,
): {
  dir: 'rtl' | 'ltr'
  lang: 'ar' | 'ur' | 'ml' | 'en'
  isRtl: boolean
  fontClass: string
  alignClass: string
} {
  const sample = (text && text.trim() ? text : fallbackText || '').trim()
  if (!sample) {
    return {
      dir: 'ltr',
      lang: 'en',
      isRtl: false,
      fontClass: 'font-poppins',
      alignClass: 'text-left',
    }
  }

  const stripped = sample.replace(ARABIC_DIACRITICS_RE, '')
  // Strip parenthetical/bracketed/quoted segments first so a single Arabic term in brackets
  // like "Raf' (رفع)" or "Dammah (ضمة)" does not flip an English/Malayalam sentence to RTL.
  const outsideParens = stripped
    .replace(/\([^)]*\)|\[[^\]]*\]|"[^"]*"|“[^”]*”|«[^»]*»/g, ' ')
    .trim()

  const countScripts = (str: string) => {
    const ar = (
      str.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []
    ).length
    const ml = (str.match(/[\u0D00-\u0D7F]/g) || []).length
    const lat = (str.match(/[A-Za-z\u00C0-\u024F]/g) || []).length
    return { ar, ml, lat, ltr: ml + lat }
  }

  const mainCounts = countScripts(outsideParens)
  const activeCounts =
    mainCounts.ar + mainCounts.ltr > 0 ? mainCounts : countScripts(stripped)

  if (activeCounts.ar > 0 && activeCounts.ar > activeCounts.ltr && activeCounts.ml < 2) {
    const isUr = URDU_SPECIFIC_RE.test(sample)
    return {
      dir: 'rtl',
      lang: isUr ? 'ur' : 'ar',
      isRtl: true,
      fontClass: isUr
        ? 'font-urdu text-base leading-loose'
        : 'font-arabic text-base leading-relaxed',
      alignClass: 'text-right',
    }
  }

  if (activeCounts.ml > 0 || MALAYALAM_SCRIPT_RE.test(sample)) {
    return {
      dir: 'ltr',
      lang: 'ml',
      isRtl: false,
      fontClass: 'font-malayalam leading-relaxed',
      alignClass: 'text-left',
    }
  }

  return {
    dir: 'ltr',
    lang: 'en',
    isRtl: false,
    fontClass: 'font-poppins',
    alignClass: 'text-left',
  }
}

function getSyllabusFieldRtlProps(text?: string): {
  dir: 'rtl' | 'ltr' | 'auto'
  lang?: 'ar' | 'ur' | 'ml' | 'en'
  isRtl: boolean
  inputClass: string
  displayClass: string
} {
  const raw = (text ?? '').trim()
  if (!raw) {
    return {
      dir: 'auto',
      lang: undefined,
      isRtl: false,
      inputClass: 'text-xs',
      displayClass: 'text-xs text-left',
    }
  }
  const hasAr = ARABIC_SCRIPT_RE.test(raw)
  const startsWithAr = /^[\s"'«»()[\]0-9\u0660-\u0669-]*[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(
    raw,
  )
  const mlProps = getMultilingualTextProps(raw)
  if (mlProps.isRtl || (hasAr && startsWithAr)) {
    const isUr = URDU_SPECIFIC_RE.test(raw)
    return {
      dir: 'rtl',
      lang: isUr ? 'ur' : 'ar',
      isRtl: true,
      inputClass: isUr
        ? 'font-urdu text-right text-sm leading-loose'
        : 'font-arabic text-right text-sm leading-relaxed',
      displayClass: isUr
        ? 'font-urdu text-right text-sm leading-loose'
        : 'font-arabic text-right text-sm leading-relaxed',
    }
  }
  if (mlProps.lang === 'ml') {
    return {
      dir: 'ltr',
      lang: 'ml',
      isRtl: false,
      inputClass: 'font-malayalam text-left text-xs',
      displayClass: 'font-malayalam text-left text-xs leading-relaxed',
    }
  }
  return {
    dir: 'ltr',
    lang: 'en',
    isRtl: false,
    inputClass: 'text-left text-xs',
    displayClass: 'text-left text-xs',
  }
}

function renderMultilingualInline(text?: string, isParentRtl = false): React.ReactNode {
  if (!text) return text
  const normalizedText = text.replace(/ദാ?അ്\s*വാ?/g, 'ദഅ്\u200cവ')
  if (!ARABIC_SCRIPT_RE.test(normalizedText) && !MALAYALAM_SCRIPT_RE.test(normalizedText)) {
    return normalizedText
  }

  if (isParentRtl) {
    const isUr = URDU_SPECIFIC_RE.test(normalizedText)
    return isUr ? normalizedText : toEasternArabicNumerals(normalizedText)
  }

  const scriptRunRegex =
    /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+(?:[\s،؛؟«»ـ\-/:,.0-9\u0660-\u0669\u06F0-\u06F9]+[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)*[،؛؟.!0-9\u0660-\u0669]*|[\u0D00-\u0D7F\u200C\u200D]+(?:\s+[\u0D00-\u0D7F\u200C\u200D]+)*)/g
  const parts = normalizedText.split(scriptRunRegex)
  if (parts.length <= 1) return normalizedText

  return parts.map((part, idx) => {
    if (!part) return null
    if (ARABIC_SCRIPT_RE.test(part)) {
      const isUr = URDU_SPECIFIC_RE.test(part)
      const displayPart = isUr ? part : toEasternArabicNumerals(part)
      return (
        <bdi
          key={`ar-${idx}`}
          dir="rtl"
          className={cn(
            isUr ? 'font-urdu' : 'font-arabic',
            'inline-block px-0.5 text-[1.08em] leading-normal font-normal',
          )}
        >
          {displayPart}
        </bdi>
      )
    }
    if (MALAYALAM_SCRIPT_RE.test(part)) {
      return (
        <span key={`ml-${idx}`} className="font-malayalam">
          {part}
        </span>
      )
    }
    return <span key={`tx-${idx}`}>{part}</span>
  })
}

type StudentHubTab = 'tests' | 'syllabus' | 'holiday' | 'zadul_khair' | 'discipline'
type UsthadHubTab = 'syllabus' | 'tests' | 'holiday' | 'discipline' | 'zadul_khair'

export function StarOfTheMonthSpotlight({
  className,
  monthId,
  records,
  onSelectMonth,
}: {
  className: string
  monthId: string
  records: CampusAcademicRecord[]
  onSelectMonth?: (monthId: string) => void
}) {
  const summary = useMemo(
    () => calculateClassStarOfTheMonth(className, monthId, records),
    [className, monthId, records],
  )

  const winner = summary.winner

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-[#EFF6FF] to-[#E6F1FE] p-5 text-foreground transition-colors duration-300 sm:p-6 dark:from-[#0B1014] dark:via-[#0E151B] dark:to-[#0B1014] dark:text-white">
      <div className="flex flex-col justify-between gap-4 border-b border-border/40 pb-4 sm:flex-row sm:items-center dark:border-white/10">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.18em] text-[#0077CC] uppercase dark:text-[#0095F6]">
            <Trophy className="size-3.5 text-[#0077CC] dark:text-[#0095F6]" aria-hidden="true" />
            Star of the Month · Class {summary.className}
          </p>
          <h3 className="mt-1 font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl dark:text-white">
            {summary.monthLabel} Top Performer
          </h3>
        </div>

        {onSelectMonth && (
          <MonthYearSelect
            idPrefix="star-month-period"
            value={monthId}
            year={parseMonthId(monthId).year}
            onChange={(nextMonthId) => onSelectMonth(nextMonthId)}
            selectClassName="h-9 rounded-xl border-0 bg-background/90 px-2.5 text-xs font-semibold text-foreground dark:bg-white/10 dark:text-white"
          />
        )}
      </div>

      {winner ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-12 lg:items-center">
          <div className="flex items-center gap-4 lg:col-span-7">
            <div className="relative shrink-0">
              <ProfileInitialsAvatar
                name={winner.student.name}
                avatarUrl={winner.student.avatarUrl}
                className="size-16 sm:size-20"
              />
              <span className="absolute -bottom-1.5 -right-1.5 flex size-7 items-center justify-center rounded-full bg-[#0095F6] text-white shadow">
                <Crown className="size-4" aria-hidden="true" />
              </span>
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#0077CC] dark:text-[#0095F6]">
                #1 Ranked Performer · {winner.student.admissionNo}
              </p>
              <h4 className="truncate font-display text-xl font-bold text-foreground sm:text-2xl dark:text-white">
                {winner.student.name}
              </h4>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums dark:text-slate-300">
                Composite Score:{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">
                  {winner.compositeScore}%
                </strong>{' '}
                · Unit Tests:{' '}
                <strong className="text-foreground dark:text-white">
                  {winner.testPercentage}%
                </strong>{' '}
                ({winner.totalObtainedMarks}/{winner.totalMaxMarks || 20} marks) · Attendance:{' '}
                <strong className="text-foreground dark:text-white">
                  {winner.attendancePercentage}%
                </strong>
              </p>
            </div>
          </div>

          <div className="border-t border-border/40 pt-4 lg:col-span-5 lg:border-t-0 lg:border-l lg:pl-5 lg:pt-0 dark:border-white/10">
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase dark:text-slate-300">
              Class Top Performers ({summary.className})
            </p>
            <div className="mt-2.5 divide-y divide-border/40 dark:divide-white/10">
              {summary.allRankings.slice(0, 3).map((item) => (
                <div
                  key={item.student.id}
                  className="flex items-center justify-between gap-2 py-1.5 text-xs"
                >
                  <span className="truncate font-medium text-foreground dark:text-white">
                    <span className="mr-2 font-mono font-bold text-[#0077CC] tabular-nums dark:text-[#0095F6]">
                      #{item.rank}
                    </span>
                    {item.student.name}
                  </span>
                  <span className="shrink-0 font-mono text-muted-foreground tabular-nums dark:text-slate-300">
                    Test {item.testPercentage}% · Att {item.attendancePercentage}% ·{' '}
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      {item.compositeScore}%
                    </strong>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground dark:text-slate-300">
          No graded monthly test records available for this class yet.
        </p>
      )}
    </div>
  )
}

export function extractSyllabusChapterRange(row: CampusAcademicRecord): {
  fromChapter: string
  toChapter: string
  formattedRange: string
} {
  const ansFrom = row.answers?.fromChapter?.trim()
  const ansTo = row.answers?.toChapter?.trim()
  if (ansFrom || ansTo) {
    const f = ansFrom || ''
    const t = ansTo || ''
    return {
      fromChapter: f,
      toChapter: t,
      formattedRange: f && t ? `${f} to ${t}` : f || t || 'Not recorded',
    }
  }

  const raw = (row.subjectOrCategory || '').trim()
  if (raw.includes(' to ')) {
    const [left, ...rest] = raw.split(' to ')
    const right = rest.join(' to ').trim()
    return {
      fromChapter: left.trim(),
      toChapter: right,
      formattedRange: raw,
    }
  }

  if (raw.includes(' \u0D2E\u0D41\u0D24\u0D7D ')) {
    const [left, rightRaw] = raw.split(' \u0D2E\u0D41\u0D24\u0D7D ')
    const right = (rightRaw || '').replace(/\s*\u0D35\u0D30\u0D46$/, '').trim()
    const cleanLeft = left.trim()
    const cleanRight = right
    return {
      fromChapter: cleanLeft,
      toChapter: cleanRight,
      formattedRange: cleanLeft && cleanRight ? `${cleanLeft} to ${cleanRight}` : cleanLeft || cleanRight || 'Not recorded',
    }
  }

  return {
    fromChapter: raw,
    toChapter: '',
    formattedRange: raw || 'Not recorded',
  }
}

export function formatSyllabusChapterRange(fromChapter: string, toChapter: string): string {
  const f = fromChapter.trim()
  const t = toChapter.trim()
  if (f && t) return `${f} to ${t}`.slice(0, 120)
  return (f || t || 'Not recorded').slice(0, 120)
}

export function buildClassSyllabusRows(
  className: string,
  monthId: string,
  allRecords: CampusAcademicRecord[],
): CampusAcademicRecord[] {
  const normClass = normalizeClassName(className)
  const cleanBatchSlug = normClass.replace(/\s+/g, '_').toLowerCase()
  const semTimetable = getClassSemesterTimetableByClassName(normClass)

  const existingForMonth = allRecords.filter(
    (r) =>
      r.recordKind === 'monthly_syllabus' &&
      !r.isDeleted &&
      normalizeClassName(r.className) === normClass &&
      (r.month || '2026-11') === monthId,
  )

  const byId = new Map<string, CampusAcademicRecord>()
  for (const rec of existingForMonth) {
    byId.set(rec.id, rec)
  }

  // Ensure every teaching timetable period has a syllabus tracker row for this month
  const activeSlots =
    getActiveSemester() === 1 ? semTimetable.semester1 : semTimetable.semester2
  activeSlots.forEach((slot, pIdx) => {
    if (isNonTeachingTimetableSlot(slot)) return
    const periodNumber = pIdx + 1
    const periodLabel = semTimetable.periods[pIdx]?.label || `Period ${periodNumber}`
    const deterministicId = `syl_${monthId}_${cleanBatchSlug}_p${periodNumber}`
    const matchByPeriod = existingForMonth.find(
      (r) => r.id === deterministicId || r.admissionNo === periodLabel,
    )
    if (matchByPeriod) {
      byId.set(matchByPeriod.id, matchByPeriod)
      return
    }

    // Fallback to previous month template if switching months
    const novFallback = allRecords.find(
      (r) =>
        r.recordKind === 'monthly_syllabus' &&
        !r.isDeleted &&
        normalizeClassName(r.className) === normClass &&
        r.admissionNo === periodLabel,
    )
    const assignedTeacher = findUsthadForTeacherName(slot.teacher)
    const fallbackRange = novFallback
      ? extractSyllabusChapterRange(novFallback)
      : {
          fromChapter: '',
          toChapter: '',
          formattedRange: 'Not recorded',
        }

    byId.set(deterministicId, {
      id: deterministicId,
      campusId: 'ics-academy',
      recordKind: 'monthly_syllabus',
      className: normClass,
      studentId: assignedTeacher?.id || 'usthad-bs3',
      studentName: slot.teacher,
      admissionNo: periodLabel,
      month: monthId,
      title: slot.subject,
      subjectOrCategory: fallbackRange.formattedRange,
      answers: {
        fromChapter: fallbackRange.fromChapter,
        toChapter: fallbackRange.toChapter,
      },
      description: `Jamiathul Hind Monthly Syllabus target for Class ${normClass} (${slot.subject}).`,
      remarks: 'Monthly syllabus tracking active.',
      status: 'active',
      actorId: assignedTeacher?.id || 'usthad-bs3',
      actorName: slot.teacher,
      dateString: formatTodayDateDisplay(),
      totalMarks: novFallback?.totalMarks ?? 25,
      obtainedMarks: 0,
      isDeleted: false,
      updatedAtMs: 0,
    })
  })

  return Array.from(byId.values()).sort((a, b) =>
    (a.admissionNo || '').localeCompare(b.admissionNo || '', undefined, { numeric: true }),
  )
}

export function buildUsthadTeachingSyllabusRows(
  usthad: ClassUsthad,
  monthId: string,
  allRecords: CampusAcademicRecord[],
): CampusAcademicRecord[] {
  const scheduledSlots = getUsthadScheduledPeriodsAcrossClasses(usthad, getActiveSemester())
  const resultMap = new Map<string, CampusAcademicRecord>()

  for (const slot of scheduledSlots) {
    const classRows = buildClassSyllabusRows(slot.className, monthId, allRecords)
    const matched = classRows.find(
      (r) => r.admissionNo === slot.periodLabel || r.title === slot.subject,
    )
    if (matched) {
      resultMap.set(matched.id, matched)
    }
  }

  // Also include any custom syllabus rows assigned to this Usthad
  for (const r of allRecords) {
    if (
      r.recordKind === 'monthly_syllabus' &&
      !r.isDeleted &&
      (r.month || '2026-11') === monthId &&
      (r.studentId === usthad.id || doesUsthadMatchTeacherName(usthad, r.studentName || ''))
    ) {
      resultMap.set(r.id, r)
    }
  }

  return Array.from(resultMap.values())
}

function ClassZadulKhairManager({
  className,
  selectedMonth,
  onSelectMonth,
  records,
  actorId,
  actorName,
  actorRoleLabel,
  onNotify,
}: {
  className: string
  selectedMonth: string
  onSelectMonth: (monthId: string) => void
  records: CampusAcademicRecord[]
  actorId: string
  actorName: string
  actorRoleLabel: 'Class Leader' | 'Usthad' | 'Principal'
  onNotify?: (message: string) => void
}) {
  const normClass = normalizeClassName(className)
  const classStudents = useMemo(
    () => students.filter((s) => normalizeClassName(s.className) === normClass),
    [normClass],
  )

  const [zkEdits, setZkEdits] = useState<
    Record<
      string,
      {
        paidAmount: string
        receiptNo: string
      }
    >
  >({})
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null)
  const [pdfBusyKey, setPdfBusyKey] = useState<string | null>(null)

  useEffect(() => {
    setZkEdits({})
  }, [normClass, selectedMonth])

  const selectedMonthMeta = buildMonthMetaForId(selectedMonth)
  const selectedMonthLabel = `${selectedMonthMeta.month} ${selectedMonthMeta.year}`

  const studentRows = useMemo(() => {
    return classStudents.map((stu) => {
      const summary = computeStudentZadulKhairSummary(stu.id, selectedMonth, records)
      const saved = summary.currentMonthRecord
      const draft = zkEdits[stu.id]
      const rawAmountStr =
        draft !== undefined
          ? draft.paidAmount
          : summary.currentMonthlyContribution > 0
            ? String(summary.currentMonthlyContribution)
            : ''
      const parsedAmount = Math.max(0, Math.round(Number(rawAmountStr) || 0))
      const isRecorded = parsedAmount > 0
      const receiptNo =
        draft?.receiptNo ??
        saved?.receiptNo ??
        `ZK-${selectedMonth.replace('-', '')}-${stu.admissionNo.slice(-4)}`

      return {
        student: stu,
        saved,
        summary,
        rawAmountStr,
        previousAmount: summary.previousContribution,
        currentAmount: parsedAmount,
        totalAmount: summary.previousContribution + parsedAmount,
        isRecorded,
        receiptNo,
      }
    })
  }, [classStudents, selectedMonth, records, zkEdits])

  const classTotals = useMemo(() => {
    let previous = 0
    let current = 0
    let total = 0
    let recordedCount = 0
    for (const row of studentRows) {
      previous += row.previousAmount
      current += row.currentAmount
      total += row.totalAmount
      if (row.isRecorded) recordedCount += 1
    }
    return { previous, current, total, recordedCount }
  }, [studentRows])

  async function handleSaveStudentContribution(row: (typeof studentRows)[number]) {
    setSavingStudentId(row.student.id)
    try {
      const paidAmount = row.currentAmount
      const status: AcademicRecordStatus = paidAmount > 0 ? 'received' : 'not_recorded'
      const receiptNo =
        paidAmount > 0
          ? row.receiptNo.trim() ||
            `ZK-${selectedMonth.replace('-', '')}-${row.student.admissionNo.slice(-4)}`
          : ''
      const record: CampusAcademicRecord = {
        id: `zk_${selectedMonth}_${row.student.id}`,
        campusId: 'ics-academy',
        recordKind: 'zadul_khair',
        className: normClass,
        studentId: row.student.id,
        studentName: row.student.name,
        admissionNo: row.student.admissionNo,
        month: selectedMonth,
        title: 'Zadul Khair Voluntary Household Contribution',
        subjectOrCategory: selectedMonthLabel,
        remarks: '',
        status,
        actorId,
        actorName,
        dateString: paidAmount > 0 ? formatTodayDateDisplay() : '',
        receiptNo,
        paidAmount,
        isDeleted: false,
        updatedAtMs: Date.now(),
      }

      await upsertCampusAcademicRecord(record)

      if (paidAmount > 0) {
        publishCampusNotification({
          type: 'notice',
          title: `Zadul Khair Receipt Updated (${selectedMonthMeta?.shortMonth || selectedMonth})`,
          message: `${actorName} recorded your voluntary Zadul Khair contribution of ₹${paidAmount.toLocaleString('en-IN')} for ${selectedMonthLabel}. Official Receipt PDF is ready.`,
          targetClass: normClass,
          targetStudentId: row.student.id,
          actorId,
          actorName,
          href: '#academic-hub',
        })
      }

      setZkEdits((prev) => {
        const next = { ...prev }
        delete next[row.student.id]
        return next
      })

      onNotify?.(
        paidAmount > 0
          ? `Saved voluntary Zadul Khair contribution of ₹${paidAmount.toLocaleString('en-IN')} for ${row.student.name} (${selectedMonthLabel}).`
          : `Marked ${row.student.name} as Not Recorded for ${selectedMonthLabel}.`,
      )
    } finally {
      setSavingStudentId(null)
    }
  }

  async function handleExportClassPdf(mode: 'download' | 'print') {
    setPdfBusyKey(`class_${mode}`)
    try {
      await exportClassZadulKhairReportPdf({
        className: normClass,
        monthId: selectedMonth,
        rows: studentRows.map((row) => ({
          student: row.student,
          previousAmount: row.previousAmount,
          currentAmount: row.currentAmount,
          totalAmount: row.totalAmount,
          isRecorded: row.isRecorded,
          receiptNo: row.receiptNo,
          dateString: row.saved?.dateString || (row.isRecorded ? formatTodayDateDisplay() : '—'),
          remarks: '',
        })),
        preparedByName: actorName,
        preparedByRole: actorRoleLabel,
        mode,
      })
    } finally {
      setPdfBusyKey(null)
    }
  }

  async function handleExportSingleStudentReceipt(
    row: (typeof studentRows)[number],
    mode: 'download' | 'jpg' | 'print',
  ) {
    setPdfBusyKey(`${row.student.id}_${mode}`)
    try {
      const record: CampusAcademicRecord = {
        id: `zk_${selectedMonth}_${row.student.id}`,
        campusId: 'ics-academy',
        recordKind: 'zadul_khair',
        className: normClass,
        studentId: row.student.id,
        studentName: row.student.name,
        admissionNo: row.student.admissionNo,
        month: selectedMonth,
        title: 'Zadul Khair Voluntary Household Contribution',
        subjectOrCategory: selectedMonthLabel,
        remarks: '',
        status: row.isRecorded ? 'received' : 'not_recorded',
        actorId: row.saved?.actorId || actorId,
        actorName: row.saved?.actorName || actorName,
        dateString: row.saved?.dateString || (row.isRecorded ? formatTodayDateDisplay() : ''),
        receiptNo: row.isRecorded ? row.receiptNo : '',
        paidAmount: row.currentAmount,
        isDeleted: false,
        updatedAtMs: Date.now(),
      }
      const otherRecords = records.filter(
        (r) =>
          r.recordKind === 'zadul_khair' &&
          !r.isDeleted &&
          r.studentId === row.student.id &&
          r.month !== selectedMonth,
      )
      await exportStudentZadulKhairReceiptPdf({
        student: row.student,
        selectedMonth,
        record,
        historyRecords: [...otherRecords, record],
        mode,
      })
    } finally {
      setPdfBusyKey(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 rounded-2xl bg-muted/45 p-4 sm:flex-row sm:items-center sm:p-5">
        <div>
          <p className="text-xs font-semibold tracking-wider text-[#0077CC] uppercase dark:text-[#0095F6]">
            Zadul Khair · {actorRoleLabel}
          </p>
          <h4 className="mt-1 font-display text-lg font-bold text-foreground">
            Class {normClass} Ledger ({selectedMonthLabel})
          </h4>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MonthYearSelect
            idPrefix="zk-staff-period"
            value={selectedMonth}
            year={parseMonthId(selectedMonth).year}
            onChange={(nextMonthId) => onSelectMonth(nextMonthId)}
            selectClassName="h-9 rounded-xl border border-input bg-background px-2.5 text-xs font-semibold text-foreground outline-none"
          />
          <Button
            type="button"
            size="sm"
            disabled={pdfBusyKey !== null}
            onClick={() => handleExportClassPdf('download')}
            className="rounded-full bg-[#0095F6] text-xs font-semibold text-white hover:bg-[#0077CC]"
          >
            <Download className="mr-1.5 size-3.5" aria-hidden="true" />
            {pdfBusyKey === 'class_download' ? 'Generating PDF...' : 'Class Statement PDF'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pdfBusyKey !== null}
            onClick={() => handleExportClassPdf('print')}
            className="rounded-full text-xs"
          >
            <Printer className="mr-1.5 size-3.5" aria-hidden="true" />
            Print Class List
          </Button>
        </div>
      </div>

      {/* 3 Class Voluntary Summary Cards */}
      <div className="grid gap-3.5 sm:grid-cols-3">
        <div className="rounded-2xl bg-muted/45 p-4">
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Previous Contribution
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
            ₹{classTotals.previous.toLocaleString('en-IN')}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Prior months cumulative · Class {normClass}
          </p>
        </div>

        <div className="rounded-2xl bg-emerald-500/12 p-4">
          <p className="text-[11px] font-semibold tracking-wider text-emerald-700 uppercase dark:text-emerald-400">
            Current Monthly Contribution
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
            ₹{classTotals.current.toLocaleString('en-IN')}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {selectedMonthLabel} · {classTotals.recordedCount} of {studentRows.length} recorded
          </p>
        </div>

        <div className="rounded-2xl bg-[#0095F6]/10 p-4">
          <p className="text-[11px] font-semibold tracking-wider text-[#0077CC] uppercase dark:text-[#0095F6]">
            Total Contribution
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
            ₹{classTotals.total.toLocaleString('en-IN')}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Previous + Current cumulative total
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-muted/35">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border/40 bg-muted/50 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-3">Student</th>
              <th className="px-3 py-3">Receipt No.</th>
              <th className="px-3 py-3">Previous (₹)</th>
              <th className="px-3 py-3">Current Month (₹)</th>
              <th className="px-3 py-3">Total (₹)</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3 text-right">Save &amp; Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 tabular-nums">
            {studentRows.map((row) => (
              <tr key={row.student.id} className="hover:bg-muted/30">
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-foreground">{row.student.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {row.student.admissionNo}
                  </p>
                </td>
                <td className="px-3 py-2.5">
                  <Input
                    value={row.receiptNo}
                    onChange={(e) =>
                      setZkEdits((prev) => ({
                        ...prev,
                        [row.student.id]: {
                          paidAmount: row.rawAmountStr,
                          receiptNo: e.target.value,
                        },
                      }))
                    }
                    className="h-8 w-32 font-mono text-xs"
                  />
                </td>
                <td className="px-3 py-2.5 font-mono text-muted-foreground">
                  ₹{row.previousAmount.toLocaleString('en-IN')}
                </td>
                <td className="px-3 py-2.5">
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="0"
                    value={row.rawAmountStr}
                    onChange={(e) =>
                      setZkEdits((prev) => ({
                        ...prev,
                        [row.student.id]: {
                          paidAmount: e.target.value,
                          receiptNo: row.receiptNo,
                        },
                      }))
                    }
                    className="h-8 w-24 font-mono text-xs font-bold"
                  />
                </td>
                <td className="px-3 py-2.5 font-mono font-bold text-foreground">
                  ₹{row.totalAmount.toLocaleString('en-IN')}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                      row.isRecorded
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {row.isRecorded ? 'Received' : 'Not Recorded'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      disabled={savingStudentId === row.student.id}
                      onClick={() => handleSaveStudentContribution(row)}
                      className="h-8 rounded-full bg-[#0095F6] px-3 text-xs font-semibold text-white hover:bg-[#0077CC]"
                    >
                      {savingStudentId === row.student.id ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pdfBusyKey !== null}
                      onClick={() => handleExportSingleStudentReceipt(row, 'download')}
                      className="h-8 rounded-full px-2.5 text-[11px] font-semibold"
                      title="Download Receipt PDF"
                    >
                      <Download className="mr-1 size-3" aria-hidden="true" />
                      {pdfBusyKey === `${row.student.id}_download` ? '...' : 'PDF'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pdfBusyKey !== null}
                      onClick={() => handleExportSingleStudentReceipt(row, 'jpg')}
                      className="h-8 rounded-full px-2.5 text-[11px] font-semibold"
                      title="Download Receipt JPG"
                    >
                      <ImageIcon className="mr-1 size-3" aria-hidden="true" />
                      {pdfBusyKey === `${row.student.id}_jpg` ? '...' : 'JPG'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pdfBusyKey !== null}
                      onClick={() => handleExportSingleStudentReceipt(row, 'print')}
                      className="h-8 rounded-full px-2 text-xs"
                      title="Print Receipt"
                    >
                      <Printer className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function StudentAcademicHub({
  student,
  isClassLeader = false,
}: {
  student: Student
  isClassLeader?: boolean
}) {
  const [records, setRecords] = useState<CampusAcademicRecord[]>([])
  const [activeTab, setActiveTab] = useState<StudentHubTab>(isClassLeader ? 'syllabus' : 'tests')
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-11')
  const [statusBanner, setStatusBanner] = useState<string | null>(null)

  // Active Test Runner State
  const [selectedTestId, setSelectedTestId] = useState<string>('')
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({})
  const [isSubmittingTest, setIsSubmittingTest] = useState(false)

  // Jamiathul Hind Monthly Syllabus Draft Edits (for Class Leader)
  const [syllabusEdits, setSyllabusEdits] = useState<
    Record<
      string,
      {
        fromChapter: string
        toChapter: string
        totalPages: number
        completedPages: number
        remarks: string
      }
    >
  >({})
  const [savingSyllabusId, setSavingSyllabusId] = useState<string | null>(null)
  const [showAddKitabForm, setShowAddKitabForm] = useState(false)
  const [newKitabName, setNewKitabName] = useState('')
  const [newKitabPeriodLabel, setNewKitabPeriodLabel] = useState('Extra Kitab')
  const [newKitabUsthadId, setNewKitabUsthadId] = useState<string>(
    OFFICIAL_CLASS_USTHADS[0]?.id || 'usthad-09',
  )
  const [newKitabFromChapter, setNewKitabFromChapter] = useState('')
  const [newKitabToChapter, setNewKitabToChapter] = useState('')
  const [newKitabTotalPages, setNewKitabTotalPages] = useState('25')
  const [newKitabCompletedPages, setNewKitabCompletedPages] = useState('0')

  // Holiday & SSF Da'wa Log Form State
  const [holidayCategory, setHolidayCategory] = useState<string>(HOLIDAY_ACTIVITY_CATEGORIES[0])
  const [holidayTitle, setHolidayTitle] = useState<string>('')
  const [holidayDate, setHolidayDate] = useState<string>(formatTodayDateDisplay)
  const [holidayDescription, setHolidayDescription] = useState<string>('')
  const [holidayPhotoUrl, setHolidayPhotoUrl] = useState<string>('')
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [isSavingHoliday, setIsSavingHoliday] = useState(false)
  const photoInputRef = useRef<HTMLInputElement | null>(null)

  // PDF Export & Class Leader Zadul Khair view state
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null)
  const [zkLeaderView, setZkLeaderView] = useState<'personal' | 'class'>('personal')

  useEffect(() => {
    setRecords(loadCampusAcademicRecords())
    const unsub = subscribeCampusAcademicRecords((updated) => {
      setRecords(updated)
    })
    return unsub
  }, [])

  const normClass = normalizeClassName(student.className)

  const classSyllabusRows = useMemo(
    () => buildClassSyllabusRows(normClass, selectedMonth, records),
    [normClass, selectedMonth, records],
  )

  const classSyllabusTotals = useMemo(() => {
    let totalTarget = 0
    let totalCompleted = 0
    for (const r of classSyllabusRows) {
      const draft = syllabusEdits[r.id]
      const t = Number(draft?.totalPages ?? r.totalMarks ?? 0)
      const c = Number(draft?.completedPages ?? r.obtainedMarks ?? 0)
      totalTarget += t
      totalCompleted += c
    }
    return {
      totalTarget,
      totalCompleted,
      totalRemaining: Math.max(0, totalTarget - totalCompleted),
    }
  }, [classSyllabusRows, syllabusEdits])

  async function handleClassLeaderSaveSyllabusRow(row: CampusAcademicRecord) {
    if (!isClassLeader) return
    setSavingSyllabusId(row.id)
    try {
      const existingRange = extractSyllabusChapterRange(row)
      const draft = syllabusEdits[row.id]
      const fromChapter = (draft?.fromChapter ?? existingRange.fromChapter).trim()
      const toChapter = (draft?.toChapter ?? existingRange.toChapter).trim()
      const formattedChapterRange = formatSyllabusChapterRange(fromChapter, toChapter)
      const totalPages = Math.max(0, Math.min(1000, Number(draft?.totalPages ?? row.totalMarks ?? 0)))
      const completedPages = Math.max(
        0,
        Math.min(1000, Number(draft?.completedPages ?? row.obtainedMarks ?? 0)),
      )
      const remainingPages = Math.max(0, totalPages - completedPages)
      const remarks =
        (draft?.remarks ?? row.remarks ?? '').trim() ||
        `Updated by Class Leader ${student.name}: ${completedPages}/${totalPages} pages (${remainingPages} remaining).`

      const matchedTeacher = findUsthadForTeacherName(row.studentName || '')
      const updatedRecord: CampusAcademicRecord = {
        ...row,
        className: normClass,
        studentId: matchedTeacher?.id || row.studentId,
        month: selectedMonth,
        subjectOrCategory: formattedChapterRange,
        answers: {
          fromChapter,
          toChapter,
        },
        totalMarks: totalPages,
        obtainedMarks: completedPages,
        remarks,
        status: completedPages >= totalPages && totalPages > 0 ? 'verified' : 'active',
        actorId: student.id,
        actorName: `${student.name} (Class Leader)`,
        dateString: formatTodayDateDisplay(),
        isDeleted: false,
        updatedAtMs: Date.now(),
      }

      await upsertCampusAcademicRecord(updatedRecord)

      setSyllabusEdits((prev) => {
        if (!(row.id in prev)) return prev
        const next = { ...prev }
        delete next[row.id]
        return next
      })

      publishCampusNotification({
        type: 'notice',
        title: `Syllabus Update · Class ${normClass}`,
        message: `${student.name} (Class Leader) updated "${row.title}" (${row.studentName}): ${formattedChapterRange} — Target: ${totalPages}p, Completed: ${completedPages}p, Remaining: ${remainingPages}p.`,
        targetClass: normClass,
        targetStaffOnly: true,
        actorId: student.id,
        actorName: `${student.name} (Class Leader)`,
        href: '#academic-hub',
      })

      setStatusBanner(
        `Saved "${row.title}" and notified ${row.studentName}.`,
      )
    } finally {
      setSavingSyllabusId(null)
    }
  }

  async function handleClassLeaderAddCustomKitab(e: React.FormEvent) {
    e.preventDefault()
    if (
      !isClassLeader ||
      !newKitabName.trim() ||
      !newKitabFromChapter.trim() ||
      !newKitabToChapter.trim()
    )
      return
    const matchedUsthad =
      OFFICIAL_CLASS_USTHADS.find((u) => u.id === newKitabUsthadId) ||
      CLASS_USTHADS.find((u) => u.id === newKitabUsthadId) ||
      OFFICIAL_CLASS_USTHADS[0]
    const fromChapter = newKitabFromChapter.trim()
    const toChapter = newKitabToChapter.trim()
    const formattedRange = formatSyllabusChapterRange(fromChapter, toChapter)
    const totalPages = Math.max(1, Math.min(1000, Number(newKitabTotalPages) || 25))
    const completedPages = Math.max(0, Math.min(1000, Number(newKitabCompletedPages) || 0))
    const remainingPages = Math.max(0, totalPages - completedPages)
    const cleanSlug = normClass.replace(/\s+/g, '_').toLowerCase()

    const customRecord: CampusAcademicRecord = {
      id: `syl_${selectedMonth}_${cleanSlug}_extra_${Date.now()}`,
      campusId: 'ics-academy',
      recordKind: 'monthly_syllabus',
      className: normClass,
      studentId: matchedUsthad.id,
      studentName: matchedUsthad.name,
      admissionNo: newKitabPeriodLabel.trim() || 'Extra Kitab',
      month: selectedMonth,
      title: newKitabName.trim(),
      subjectOrCategory: formattedRange,
      answers: {
        fromChapter,
        toChapter,
      },
      description: `Monthly syllabus target for Class ${normClass}.`,
      remarks: `Added by Class Leader ${student.name}.`,
      status: completedPages >= totalPages ? 'verified' : 'active',
      actorId: student.id,
      actorName: `${student.name} (Class Leader)`,
      dateString: formatTodayDateDisplay(),
      totalMarks: totalPages,
      obtainedMarks: completedPages,
      isDeleted: false,
      updatedAtMs: Date.now(),
    }

    await upsertCampusAcademicRecord(customRecord)

    publishCampusNotification({
      type: 'notice',
      title: `New Kitab Syllabus · Class ${normClass}`,
      message: `${student.name} (Class Leader) added "${customRecord.title}" for ${matchedUsthad.name}: ${fromChapter} to ${toChapter} (${totalPages} pages, ${remainingPages} remaining).`,
      targetClass: normClass,
      targetStaffOnly: true,
      actorId: student.id,
      actorName: `${student.name} (Class Leader)`,
      href: '#academic-hub',
    })

    setNewKitabName('')
    setNewKitabFromChapter('')
    setNewKitabToChapter('')
    setShowAddKitabForm(false)
    setStatusBanner(
      `Added "${customRecord.title}" (${fromChapter} to ${toChapter}) and notified ${matchedUsthad.name}.`,
    )
  }

  const classUnitTests = useMemo(
    () =>
      records.filter(
        (r) =>
          r.recordKind === 'unit_test' &&
          !r.isDeleted &&
          normalizeClassName(r.className) === normClass,
      ),
    [records, normClass],
  )

  const mySubmissionsByTestId = useMemo(() => {
    const map = new Map<string, CampusAcademicRecord>()
    for (const r of records) {
      if (
        r.recordKind === 'test_submission' &&
        !r.isDeleted &&
        r.studentId === student.id &&
        r.subjectOrCategory
      ) {
        map.set(r.subjectOrCategory, r)
      }
    }
    return map
  }, [records, student.id])

  useEffect(() => {
    if (classUnitTests.length > 0 && !selectedTestId) {
      setSelectedTestId(classUnitTests[0].id)
    }
  }, [classUnitTests, selectedTestId])

  const currentTest = useMemo(
    () => classUnitTests.find((t) => t.id === selectedTestId) || classUnitTests[0] || null,
    [classUnitTests, selectedTestId],
  )

  const currentSubmission = currentTest ? mySubmissionsByTestId.get(currentTest.id) : undefined
  const isSubmissionLocked = Boolean(currentSubmission && !currentSubmission.acknowledged)

  useEffect(() => {
    if (currentSubmission?.answers) {
      setDraftAnswers(currentSubmission.answers)
    } else {
      setDraftAnswers({})
    }
  }, [currentTest?.id, currentSubmission])

  // Student's Holiday / SSF Da'wa / Ziyarat logs
  const myHolidayLogs = useMemo(
    () =>
      records.filter(
        (r) => r.recordKind === 'holiday_log' && !r.isDeleted && r.studentId === student.id,
      ),
    [records, student.id],
  )

  // Strictly private Discipline Notes for THIS student ONLY
  const myDisciplineNotes = useMemo(
    () =>
      records.filter(
        (r) => r.recordKind === 'discipline_note' && !r.isDeleted && r.studentId === student.id,
      ),
    [records, student.id],
  )

  const unacknowledgedDisciplineCount = useMemo(
    () => myDisciplineNotes.filter((n) => !n.acknowledged).length,
    [myDisciplineNotes],
  )

  // Strictly personal Zadul Khair records for THIS student ONLY
  const myZadulKhairRecords = useMemo(
    () =>
      records.filter(
        (r) => r.recordKind === 'zadul_khair' && !r.isDeleted && r.studentId === student.id,
      ),
    [records, student.id],
  )

  const myZadulKhairSummary = useMemo(
    () => computeStudentZadulKhairSummary(student.id, selectedMonth, myZadulKhairRecords),
    [student.id, selectedMonth, myZadulKhairRecords],
  )

  const currentMonthZadulKhair: CampusAcademicRecord = useMemo(() => {
    if (myZadulKhairSummary.currentMonthRecord) return myZadulKhairSummary.currentMonthRecord
    return {
      id: `zk_${selectedMonth}_${student.id}`,
      campusId: 'ics-academy',
      recordKind: 'zadul_khair',
      className: student.className,
      studentId: student.id,
      studentName: student.name,
      admissionNo: student.admissionNo,
      month: selectedMonth,
      title: 'Zadul Khair (زاد الخير) Voluntary Household Contribution',
      subjectOrCategory: myZadulKhairSummary.selectedMonthLabel,
      status: 'not_recorded',
      actorId: student.id,
      actorName: 'Class Usthad / Leader',
      dateString: '',
      receiptNo: '',
      paidAmount: 0,
      isDeleted: false,
      updatedAtMs: Date.now(),
    }
  }, [myZadulKhairSummary, selectedMonth, student])

  async function handleSubmitUnitTest() {
    if (!currentTest) return
    if (isSubmissionLocked) {
      setStatusBanner(
        `Re-submission is locked. Please request permission from ${currentTest.actorName || 'your Subject Usthad'} to re-submit.`,
      )
      return
    }
    const questions = currentTest.questions || []
    if (questions.length === 0) return

    setIsSubmittingTest(true)
    try {
      // Auto-score MCQ questions right away; Objective questions get initial 0 until Usthad grades or if exact match
      const autoQuestionMarks: Record<string, number> = {}
      let autoObtained = 0
      let hasObjective = false

      for (const q of questions) {
        const rawAns = (draftAnswers[q.id] ?? '').trim()
        if (q.type === 'mcq') {
          const chosenIdx = Number(rawAns)
          const isCorrect =
            rawAns !== '' &&
            Number.isFinite(chosenIdx) &&
            chosenIdx === (q.correctOptionIndex ?? 0)
          const pts = isCorrect ? q.marks : 0
          autoQuestionMarks[q.id] = pts
          autoObtained += pts
        } else {
          hasObjective = true
          autoQuestionMarks[q.id] = currentSubmission?.questionMarks?.[q.id] ?? 0
          autoObtained += autoQuestionMarks[q.id]
        }
      }

      const submissionRecord: CampusAcademicRecord = {
        id: `sub_${currentTest.id}_${student.id}`,
        campusId: 'ics-academy',
        recordKind: 'test_submission',
        className: student.className,
        studentId: student.id,
        studentName: student.name,
        admissionNo: student.admissionNo,
        month: currentTest.month || selectedMonth,
        title: currentTest.title || 'Monthly Unit Test',
        subjectOrCategory: currentTest.id,
        description: currentTest.subjectOrCategory || 'Monthly Evaluation',
        status: hasObjective ? 'submitted' : 'graded',
        actorId: student.id,
        actorName: student.name,
        dateString: formatTodayDateDisplay(),
        totalMarks: currentTest.totalMarks || 20,
        obtainedMarks: autoObtained,
        answers: draftAnswers,
        questionMarks: autoQuestionMarks,
        acknowledged: false,
        isDeleted: false,
        updatedAtMs: Date.now(),
      }

      await upsertCampusAcademicRecord(submissionRecord)

      publishCampusNotification({
        type: 'notice',
        title: `Test Submitted: ${student.name}`,
        message: `${student.name} (${student.admissionNo}) submitted answers for "${currentTest.title}".`,
        targetClass: student.className,
        targetStaffOnly: true,
        actorId: student.id,
        actorName: student.name,
        href: '#academic-hub',
      })

      setStatusBanner(
        hasObjective
          ? 'Your answers have been submitted! MCQs are auto-scored and your Class Usthad will review and grade your typed Objective answers.'
          : 'Your test has been submitted and graded!',
      )
    } finally {
      setIsSubmittingTest(false)
    }
  }

  async function handleHolidayPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingPhoto(true)
    try {
      const compressed = await compressImageFileToDataUrl(file, 900, 0.7)
      setHolidayPhotoUrl(compressed)
    } catch {
      setStatusBanner('Could not process the selected photo. Please try another image.')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  async function handleUploadHolidayActivity(e: React.FormEvent) {
    e.preventDefault()
    if (!holidayTitle.trim() || !holidayDescription.trim()) return
    setIsSavingHoliday(true)
    try {
      const newRecord: CampusAcademicRecord = {
        id: `hol_${student.id}_${Date.now()}`,
        campusId: 'ics-academy',
        recordKind: 'holiday_log',
        className: student.className,
        studentId: student.id,
        studentName: student.name,
        admissionNo: student.admissionNo,
        month: selectedMonth,
        title: holidayTitle.trim(),
        subjectOrCategory: holidayCategory,
        description: holidayDescription.trim(),
        photoUrl: holidayPhotoUrl || undefined,
        status: 'pending',
        actorId: student.id,
        actorName: student.name,
        dateString: holidayDate.trim() || formatTodayDateDisplay(),
        isDeleted: false,
        updatedAtMs: Date.now(),
      }

      await upsertCampusAcademicRecord(newRecord)

      publishCampusNotification({
        type: 'notice',
        title: `Holiday / SSF Da'wa Log: ${student.name}`,
        message: `${student.name} (${student.className}) uploaded "${holidayTitle.trim()}" (${holidayCategory}).`,
        targetClass: student.className,
        targetStaffOnly: true,
        actorId: student.id,
        actorName: student.name,
        href: '#academic-hub',
      })

      setHolidayTitle('')
      setHolidayDescription('')
      setHolidayPhotoUrl('')
      setStatusBanner('Your Holiday Academic / SSF Da’wa / Ziyarat activity has been uploaded for Usthad verification.')
    } finally {
      setIsSavingHoliday(false)
    }
  }

  async function handleAcknowledgeDisciplineNote(note: CampusAcademicRecord) {
    await upsertCampusAcademicRecord({
      ...note,
      acknowledged: true,
      actorId: student.id,
      updatedAtMs: Date.now(),
    })
    setStatusBanner('You have acknowledged the Usthad’s confidential guidance note.')
  }

  async function handleExportMyZadulKhairPdf(mode: 'download' | 'jpg' | 'print') {
    setPdfBusyId(`${currentMonthZadulKhair.id}_${mode}`)
    try {
      await exportStudentZadulKhairReceiptPdf({
        student,
        selectedMonth,
        record: currentMonthZadulKhair,
        historyRecords: myZadulKhairRecords,
        mode,
      })
    } finally {
      setPdfBusyId(null)
    }
  }

  return (
    <section id="academic-hub" className="scroll-mt-24 space-y-6">
      {/* 1. Star of the Month Spotlight Banner (Visible to all students in the class) */}
      <StarOfTheMonthSpotlight
        className={student.className}
        monthId={selectedMonth}
        records={records}
        onSelectMonth={setSelectedMonth}
      />

      {/* 2. Main Student Academic, Syllabus, Da'wa, Conduct & Zadul Khair Panel */}
      <Panel
        id="student-academic-hub-panel"
        title="Academic Hub"
        eyebrow={`Class ${student.className} · ${student.name}${isClassLeader ? ' (Class Leader)' : ''}`}
        icon={Trophy}
      >
        {/* Tab Bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-4">
          <button
            type="button"
            onClick={() => {
              setActiveTab('syllabus')
              setStatusBanner(null)
            }}
            className={cn(
              'flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.98]',
              activeTab === 'syllabus'
                ? 'bg-[#0095F6] text-white'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <BookOpen className="size-3.5" aria-hidden="true" />
            <span>Syllabus ({classSyllabusRows.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('tests')
              setStatusBanner(null)
            }}
            className={cn(
              'flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.98]',
              activeTab === 'tests'
                ? 'bg-[#0095F6] text-white'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <ClipboardCheck className="size-3.5" aria-hidden="true" />
            <span>Unit Tests ({classUnitTests.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('holiday')
              setStatusBanner(null)
            }}
            className={cn(
              'flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.98]',
              activeTab === 'holiday'
                ? 'bg-[#0095F6] text-white'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>Da&apos;wa Logs ({myHolidayLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('zadul_khair')
              setStatusBanner(null)
            }}
            className={cn(
              'flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.98]',
              activeTab === 'zadul_khair'
                ? 'bg-[#0095F6] text-white'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <HeartHandshake className="size-3.5" aria-hidden="true" />
            <span>Zadul Khair</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('discipline')
              setStatusBanner(null)
            }}
            className={cn(
              'flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.98]',
              activeTab === 'discipline'
                ? 'bg-[#0095F6] text-white'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Lock className="size-3.5" aria-hidden="true" />
            <span>Advisory</span>
            {unacknowledgedDisciplineCount > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white tabular-nums">
                {unacknowledgedDisciplineCount}
              </span>
            )}
          </button>
        </div>

        {statusBanner && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-emerald-500/12 px-4 py-3 text-xs font-medium text-foreground">
            <span>{statusBanner}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* TAB 0: JAMIATHUL HIND MONTHLY SYLLABUS UPDATION & KITAB PAGE TRACKER */}
        {activeTab === 'syllabus' && (
          <div className="mt-5 space-y-5">
            <div className="flex flex-col justify-between gap-4 rounded-2xl bg-[#0095F6]/10 p-4 sm:flex-row sm:items-center sm:p-5">
              <div>
                <p className="text-xs font-bold tracking-wider text-[#0077CC] uppercase dark:text-[#0095F6]">
                  Monthly Syllabus
                </p>
                <h4 className="mt-1 font-display text-lg font-bold text-foreground sm:text-xl">
                  Class {normClass} Syllabus
                </h4>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <MonthYearSelect
                  idPrefix="student-syllabus-period"
                  value={selectedMonth}
                  year={parseMonthId(selectedMonth).year}
                  onChange={(nextMonthId) => setSelectedMonth(nextMonthId)}
                  selectClassName="h-9 rounded-xl border border-input bg-background px-2.5 text-xs font-semibold text-foreground outline-none"
                />
                {isClassLeader && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowAddKitabForm((v) => !v)}
                    className="rounded-full bg-[#0095F6] text-xs font-semibold text-white hover:bg-[#0077CC]"
                  >
                    <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
                    {showAddKitabForm ? 'Close' : 'Add Kitab'}
                  </Button>
                )}
              </div>
            </div>

            {/* 3-Box Summary KPI Strip */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-muted/45 p-4">
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Target Pages
                </p>
                <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
                  {classSyllabusTotals.totalTarget}{' '}
                  <span className="text-xs font-normal text-muted-foreground">Pages</span>
                </p>
              </div>

              <div className="rounded-2xl bg-emerald-500/12 p-4">
                <p className="text-[11px] font-semibold tracking-wider text-emerald-700 uppercase dark:text-emerald-400">
                  Completed
                </p>
                <p className="mt-1 font-display text-2xl font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
                  {classSyllabusTotals.totalCompleted}{' '}
                  <span className="text-xs font-normal opacity-80">Pages</span>
                </p>
              </div>

              <div className="rounded-2xl bg-amber-500/12 p-4">
                <p className="text-[11px] font-semibold tracking-wider text-amber-800 uppercase dark:text-amber-300">
                  Remaining
                </p>
                <p className="mt-1 font-display text-2xl font-bold text-amber-700 tabular-nums dark:text-amber-300">
                  {classSyllabusTotals.totalRemaining}{' '}
                  <span className="text-xs font-normal opacity-80">Pages</span>
                </p>
              </div>
            </div>

            {/* Class Leader Add Custom Kitab Form */}
            {isClassLeader && showAddKitabForm && (
              <form
                onSubmit={handleClassLeaderAddCustomKitab}
                className="space-y-4 rounded-2xl bg-muted/45 p-4 sm:p-5"
              >
                <h5 className="font-display text-sm font-bold text-foreground">
                  Add Kitab · Class {normClass}
                </h5>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Kitab / Subject *</Label>
                    {(() => {
                      const titleRtl = getSyllabusFieldRtlProps(newKitabName)
                      return (
                        <Input
                          dir={titleRtl.dir}
                          lang={titleRtl.lang}
                          value={newKitabName}
                          onChange={(e) => setNewKitabName(e.target.value)}
                          placeholder="e.g., Fath al-Mu'in / فتح المعين"
                          required
                          className={titleRtl.inputClass}
                        />
                      )
                    })()}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Usthad *</Label>
                    <ThemeSelect
                      value={newKitabUsthadId}
                      onChange={(e) => setNewKitabUsthadId(e.target.value)}
                      aria-label="Select Teaching Usthad"
                    >
                      {OFFICIAL_CLASS_USTHADS.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.staffId})
                        </option>
                      ))}
                    </ThemeSelect>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Period</Label>
                    <Input
                      value={newKitabPeriodLabel}
                      onChange={(e) => setNewKitabPeriodLabel(e.target.value)}
                      placeholder="e.g., Period 6"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#0077CC] dark:text-[#0095F6]">
                      From *
                    </Label>
                    {(() => {
                      const fromRtl = getSyllabusFieldRtlProps(newKitabFromChapter)
                      return (
                        <Input
                          dir={fromRtl.dir}
                          lang={fromRtl.lang}
                          value={newKitabFromChapter}
                          onChange={(e) => setNewKitabFromChapter(e.target.value)}
                          placeholder="Start line / من قوله..."
                          required
                          className={fromRtl.inputClass}
                        />
                      )
                    })()}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#0077CC] dark:text-[#0095F6]">
                      To *
                    </Label>
                    {(() => {
                      const toRtl = getSyllabusFieldRtlProps(newKitabToChapter)
                      return (
                        <Input
                          dir={toRtl.dir}
                          lang={toRtl.lang}
                          value={newKitabToChapter}
                          onChange={(e) => setNewKitabToChapter(e.target.value)}
                          placeholder="End line / إلى قوله..."
                          required
                          className={toRtl.inputClass}
                        />
                      )
                    })()}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Target Pages</Label>
                    <Input
                      type="number"
                      min={1}
                      max={1000}
                      value={newKitabTotalPages}
                      onChange={(e) => setNewKitabTotalPages(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Completed Pages</Label>
                    <Input
                      type="number"
                      min={0}
                      max={1000}
                      value={newKitabCompletedPages}
                      onChange={(e) => setNewKitabCompletedPages(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    className="rounded-full bg-[#0095F6] text-xs font-semibold text-white hover:bg-[#0077CC]"
                  >
                    <Send className="mr-1.5 size-3.5" aria-hidden="true" />
                    Save & Notify
                  </Button>
                </div>
              </form>
            )}

            {/* Kitab Syllabus Cards / Rows */}
            <div className="space-y-3.5">
              {classSyllabusRows.map((row) => {
                const parsedRange = extractSyllabusChapterRange(row)
                const draft = syllabusEdits[row.id]
                const fromChapterVal = draft?.fromChapter ?? parsedRange.fromChapter
                const toChapterVal = draft?.toChapter ?? parsedRange.toChapter
                const totalPagesVal = Number(draft?.totalPages ?? row.totalMarks ?? 0)
                const completedPagesVal = Number(draft?.completedPages ?? row.obtainedMarks ?? 0)
                const remainingPagesVal = Math.max(0, totalPagesVal - completedPagesVal)
                const progressPct =
                  totalPagesVal > 0
                    ? Math.min(100, Math.round((completedPagesVal / totalPagesVal) * 100))
                    : 0

                const fromRtl = getSyllabusFieldRtlProps(fromChapterVal)
                const toRtl = getSyllabusFieldRtlProps(toChapterVal)
                const titleRtl = getSyllabusFieldRtlProps(row.title)

                return (
                  <div
                    key={row.id}
                    className="rounded-2xl bg-muted/40 p-4 sm:p-5"
                  >
                    <div className="flex flex-col justify-between gap-3 border-b border-border/40 pb-3.5 sm:flex-row sm:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#0095F6]/12 px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#0077CC] dark:text-[#0095F6]">
                            {row.admissionNo || 'Period'}
                          </span>
                          <span className="text-xs font-semibold text-muted-foreground">
                            Usthad: <strong className="text-foreground">{row.studentName}</strong>
                          </span>
                        </div>
                        <h5
                          dir={titleRtl.dir}
                          lang={titleRtl.lang}
                          className={cn(
                            'mt-1.5 text-base font-bold text-foreground sm:text-lg',
                            titleRtl.isRtl ? 'font-arabic text-right' : 'font-display',
                          )}
                        >
                          {row.title}
                        </h5>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 text-xs tabular-nums">
                        <div className="rounded-xl bg-card px-3 py-1.5">
                          <span className="text-muted-foreground">Target: </span>
                          <strong className="font-mono text-sm text-foreground">
                            {totalPagesVal}p
                          </strong>
                        </div>
                        <div className="rounded-xl bg-emerald-500/12 px-3 py-1.5">
                          <span className="text-emerald-700 dark:text-emerald-400">Done: </span>
                          <strong className="font-mono text-sm text-emerald-700 dark:text-emerald-400">
                            {completedPagesVal}p
                          </strong>
                        </div>
                        <div className="rounded-xl bg-amber-500/12 px-3 py-1.5">
                          <span className="text-amber-800 dark:text-amber-300">Left: </span>
                          <strong className="font-mono text-sm text-amber-700 dark:text-amber-300">
                            {remainingPagesVal}p
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Syllabus Portion Range Box */}
                    <div className="mt-3 grid gap-2.5 rounded-xl bg-card/80 p-3 sm:grid-cols-2">
                      <div>
                        <span className="block text-[10px] font-bold tracking-wider text-[#0077CC] uppercase dark:text-[#0095F6]">
                          From
                        </span>
                        <p
                          dir={fromRtl.dir}
                          lang={fromRtl.lang}
                          className={cn(
                            'mt-0.5 break-words font-semibold text-foreground',
                            fromRtl.displayClass,
                          )}
                        >
                          {fromChapterVal
                            ? renderMultilingualInline(fromChapterVal, fromRtl.isRtl)
                            : 'Not recorded'}
                        </p>
                      </div>
                      <div className="border-t border-border/40 pt-2 sm:border-t-0 sm:border-l sm:pl-3 sm:pt-0">
                        <span className="block text-[10px] font-bold tracking-wider text-[#0077CC] uppercase dark:text-[#0095F6]">
                          To
                        </span>
                        <p
                          dir={toRtl.dir}
                          lang={toRtl.lang}
                          className={cn(
                            'mt-0.5 break-words font-semibold text-foreground',
                            toRtl.displayClass,
                          )}
                        >
                          {toChapterVal
                            ? renderMultilingualInline(toChapterVal, toRtl.isRtl)
                            : 'Not recorded'}
                        </p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                        <span>Page Progress</span>
                        <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                          {progressPct}% ({completedPagesVal}/{totalPagesVal} Pages)
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-[#0095F6] transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    {isClassLeader ? (
                      <div className="mt-4 space-y-3 border-t border-border/40 pt-3.5">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-[#0077CC] dark:text-[#0095F6]">
                              From
                            </Label>
                            <Input
                              dir={fromRtl.dir}
                              lang={fromRtl.lang}
                              value={fromChapterVal}
                              onChange={(e) =>
                                setSyllabusEdits((prev) => ({
                                  ...prev,
                                  [row.id]: {
                                    fromChapter: e.target.value,
                                    toChapter: toChapterVal,
                                    totalPages: totalPagesVal,
                                    completedPages: completedPagesVal,
                                    remarks: draft?.remarks ?? row.remarks ?? '',
                                  },
                                }))
                              }
                              placeholder="Start line / من قوله..."
                              className={cn('h-9', fromRtl.inputClass)}
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-[#0077CC] dark:text-[#0095F6]">
                              To
                            </Label>
                            <Input
                              dir={toRtl.dir}
                              lang={toRtl.lang}
                              value={toChapterVal}
                              onChange={(e) =>
                                setSyllabusEdits((prev) => ({
                                  ...prev,
                                  [row.id]: {
                                    fromChapter: fromChapterVal,
                                    toChapter: e.target.value,
                                    totalPages: totalPagesVal,
                                    completedPages: completedPagesVal,
                                    remarks: draft?.remarks ?? row.remarks ?? '',
                                  },
                                }))
                              }
                              placeholder="End line / إلى قوله..."
                              className={cn('h-9', toRtl.inputClass)}
                            />
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-12 sm:items-end">
                          <div className="space-y-1 sm:col-span-4">
                            <Label className="text-[11px] text-muted-foreground">
                              Target Pages
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              max={1000}
                              value={totalPagesVal}
                              onChange={(e) =>
                                setSyllabusEdits((prev) => ({
                                  ...prev,
                                  [row.id]: {
                                    fromChapter: fromChapterVal,
                                    toChapter: toChapterVal,
                                    totalPages: Math.max(0, Number(e.target.value) || 0),
                                    completedPages: completedPagesVal,
                                    remarks: draft?.remarks ?? row.remarks ?? '',
                                  },
                                }))
                              }
                              className="h-9 font-mono text-xs font-bold tabular-nums"
                            />
                          </div>

                          <div className="space-y-1 sm:col-span-4">
                            <Label className="text-[11px] text-emerald-700 dark:text-emerald-400">
                              Completed Pages
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              max={1000}
                              value={completedPagesVal}
                              onChange={(e) =>
                                setSyllabusEdits((prev) => ({
                                  ...prev,
                                  [row.id]: {
                                    fromChapter: fromChapterVal,
                                    toChapter: toChapterVal,
                                    totalPages: totalPagesVal,
                                    completedPages: Math.max(0, Number(e.target.value) || 0),
                                    remarks: draft?.remarks ?? row.remarks ?? '',
                                  },
                                }))
                              }
                              className="h-9 font-mono text-xs font-bold tabular-nums"
                            />
                          </div>

                          <div className="sm:col-span-4">
                            <Button
                              type="button"
                              size="sm"
                              disabled={savingSyllabusId === row.id}
                              onClick={() => handleClassLeaderSaveSyllabusRow(row)}
                              className="h-9 w-full rounded-full bg-[#0095F6] text-xs font-semibold text-white hover:bg-[#0077CC]"
                            >
                              <Send className="mr-1.5 size-3.5" aria-hidden="true" />
                              {savingSyllabusId === row.id
                                ? 'Saving...'
                                : 'Save & Notify Usthad'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2.5 text-[11px] text-muted-foreground">
                        Last updated by {row.actorName} on {row.dateString || 'Nov 2026'}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TAB 1: MONTHLY / UNIT TESTS RUNNER */}
        {activeTab === 'tests' && (
          <div className="mt-5 space-y-5">
            {classUnitTests.length === 0 ? (
              <div className="rounded-2xl bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                No Monthly or Unit Tests have been published for Class {student.className} yet.
              </div>
            ) : (
              <>
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Select Class Test
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Answer Multiple-Choice (MCQ) and typed Objective questions and submit to your Class Usthad.
                    </p>
                  </div>
                  <div className="w-full sm:w-80">
                    <ThemeSelect
                      value={currentTest?.id || ''}
                      onChange={(e) => setSelectedTestId(e.target.value)}
                      aria-label="Select Monthly or Unit Test"
                    >
                      {classUnitTests.map((t) => {
                        const sub = mySubmissionsByTestId.get(t.id)
                        const tag =
                          sub?.status === 'graded'
                            ? `Graded (${sub.obtainedMarks}/${sub.totalMarks})`
                            : sub
                              ? 'Submitted'
                              : 'Open'
                        return (
                          <option key={t.id} value={t.id}>
                            {t.title} · {tag}
                          </option>
                        )
                      })}
                    </ThemeSelect>
                  </div>
                </div>

                {currentTest && (
                  <div className="rounded-2xl bg-muted/40 p-4 sm:p-6">
                    {(() => {
                      const titleLang = getMultilingualTextProps(currentTest.title)
                      const descLang = getMultilingualTextProps(
                        currentTest.description,
                        currentTest.title,
                      )
                      const remarksLang = getMultilingualTextProps(currentSubmission?.remarks)
                      return (
                        <>
                          <div className="flex flex-col justify-between gap-3 border-b border-border/40 pb-4 sm:flex-row sm:items-center">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-muted-foreground tabular-nums">
                                <span
                                  dir={
                                    getMultilingualTextProps(currentTest.subjectOrCategory).dir
                                  }
                                  className={
                                    getMultilingualTextProps(currentTest.subjectOrCategory)
                                      .fontClass
                                  }
                                >
                                  {renderMultilingualInline(
                                    currentTest.subjectOrCategory,
                                    getMultilingualTextProps(currentTest.subjectOrCategory).isRtl,
                                  )}
                                </span>{' '}
                                · {currentTest.dateString} · Conducted by {currentTest.actorName}
                              </p>
                              <h4
                                dir={titleLang.dir}
                                lang={titleLang.lang}
                                className={cn(
                                  'mt-1 text-lg font-bold text-foreground sm:text-xl',
                                  titleLang.isRtl ? titleLang.fontClass : 'font-display',
                                  titleLang.alignClass,
                                )}
                              >
                                {renderMultilingualInline(currentTest.title, titleLang.isRtl)}
                              </h4>
                              {currentTest.description && (
                                <p
                                  dir={descLang.dir}
                                  lang={descLang.lang}
                                  className={cn(
                                    'mt-1 text-xs text-muted-foreground',
                                    descLang.fontClass,
                                    descLang.alignClass,
                                  )}
                                >
                                  {renderMultilingualInline(
                                    currentTest.description,
                                    descLang.isRtl,
                                  )}
                                </p>
                              )}
                            </div>

                            <div className="shrink-0 text-left sm:text-right">
                              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                                Maximum Marks
                              </p>
                              <p className="font-display text-2xl font-bold text-foreground tabular-nums">
                                {currentSubmission ? (
                                  <>
                                    <span className="text-emerald-600 dark:text-emerald-400">
                                      {currentSubmission.obtainedMarks ?? 0}
                                    </span>
                                    <span className="text-muted-foreground">
                                      /{currentTest.totalMarks || 20}
                                    </span>
                                  </>
                                ) : (
                                  <span>{currentTest.totalMarks || 20} Marks</span>
                                )}
                              </p>
                              <p className="text-xs font-medium text-muted-foreground">
                                {currentSubmission?.status === 'graded'
                                  ? 'Graded & Verified by Usthad'
                                  : currentSubmission
                                    ? 'Submitted · Awaiting Objective Grading'
                                    : 'Not Submitted Yet'}
                              </p>
                            </div>
                          </div>

                          {currentSubmission?.acknowledged && (
                            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-500/12 px-3.5 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              <Unlock className="size-4 shrink-0" aria-hidden="true" />
                              <span>
                                Re-submission approved by {currentTest.actorName || 'Subject Usthad'}. You may update and submit your answers once.
                              </span>
                            </div>
                          )}

                          {currentSubmission?.remarks && (
                            <div className="mt-4 rounded-2xl bg-[#0095F6]/10 p-3.5 text-xs">
                              <p className="font-bold text-foreground">
                                Usthad Evaluation Remarks:
                              </p>
                              <p
                                dir={remarksLang.dir}
                                lang={remarksLang.lang}
                                className={cn(
                                  'mt-1 text-muted-foreground',
                                  remarksLang.fontClass,
                                  remarksLang.alignClass,
                                )}
                              >
                                {renderMultilingualInline(
                                  currentSubmission.remarks,
                                  remarksLang.isRtl,
                                )}
                              </p>
                            </div>
                          )}

                          {/* Questions List */}
                          <div className="mt-5 space-y-4">
                            {(currentTest.questions || []).map((q, qIndex) => {
                              const studentAns = draftAnswers[q.id] ?? ''
                              const awardedMarks = currentSubmission?.questionMarks?.[q.id]
                              const promptLang = getMultilingualTextProps(
                                q.prompt,
                                currentTest.title,
                              )
                              const ansLang = getMultilingualTextProps(studentAns, q.prompt)
                              const keyLang = getMultilingualTextProps(
                                q.expectedAnswer,
                                q.prompt,
                              )

                              return (
                                <div
                                  key={q.id}
                                  className="rounded-2xl bg-card p-4"
                                >
                                  <div
                                    className={cn(
                                      'flex items-start justify-between gap-3',
                                      promptLang.isRtl && 'flex-row-reverse',
                                    )}
                                  >
                                    <p
                                      dir={promptLang.dir}
                                      lang={promptLang.lang}
                                      className={cn(
                                        'min-w-0 flex-1 text-sm font-semibold text-foreground',
                                        promptLang.fontClass,
                                        promptLang.alignClass,
                                      )}
                                    >
                                      <span
                                        dir="ltr"
                                        className={cn(
                                          'inline-block font-mono text-xs font-bold text-[#0077CC] tabular-nums dark:text-[#0095F6]',
                                          promptLang.isRtl ? 'ml-2' : 'mr-2',
                                        )}
                                      >
                                        Q{qIndex + 1}.
                                      </span>
                                      {renderMultilingualInline(q.prompt, promptLang.isRtl)}
                                    </p>
                                    <span className="shrink-0 font-mono text-xs font-semibold text-muted-foreground tabular-nums">
                                      {typeof awardedMarks === 'number'
                                        ? `${awardedMarks}/${q.marks} Marks`
                                        : `${q.marks} Marks`}
                                    </span>
                                  </div>

                                  {q.type === 'mcq' && Array.isArray(q.options) ? (
                                    <div
                                      dir={promptLang.dir}
                                      className="mt-3 grid gap-2 sm:grid-cols-2"
                                    >
                                      {q.options.map((optText, optIdx) => {
                                        const isSelected = studentAns === String(optIdx)
                                        const showCorrect =
                                          currentSubmission?.status === 'graded' &&
                                          q.correctOptionIndex === optIdx
                                        const optLang = getMultilingualTextProps(
                                          optText,
                                          q.prompt,
                                        )
                                        return (
                                          <button
                                            key={`${q.id}_opt_${optIdx}`}
                                            type="button"
                                            disabled={isSubmissionLocked}
                                            dir={optLang.dir}
                                            lang={optLang.lang}
                                            onClick={() => {
                                              if (isSubmissionLocked) return
                                              setDraftAnswers((prev) => ({
                                                ...prev,
                                                [q.id]: String(optIdx),
                                              }))
                                            }}
                                            className={cn(
                                              'flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-xs transition-all',
                                              !isSubmissionLocked && 'active:scale-[0.98]',
                                              isSubmissionLocked && 'cursor-not-allowed opacity-85',
                                              optLang.alignClass,
                                              optLang.fontClass,
                                              showCorrect
                                                ? 'bg-emerald-500/15 font-semibold text-foreground'
                                                : isSelected
                                                  ? 'bg-[#0095F6]/15 font-semibold text-foreground'
                                                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                                            )}
                                          >
                                            <span className="min-w-0 flex-1">
                                              <strong
                                                dir="ltr"
                                                className={cn(
                                                  'inline-block font-mono',
                                                  optLang.isRtl ? 'ml-2' : 'mr-2',
                                                )}
                                              >
                                                {String.fromCharCode(65 + optIdx)}.
                                              </strong>
                                              {renderMultilingualInline(optText, optLang.isRtl)}
                                            </span>
                                            {isSelected && (
                                              <CheckCircle2
                                                className="size-4 shrink-0 text-[#0077CC] dark:text-[#0095F6]"
                                                aria-hidden="true"
                                              />
                                            )}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  ) : (
                                    <div className="mt-3 space-y-2">
                                      <Label
                                        htmlFor={`ans_${q.id}`}
                                        className="text-xs text-muted-foreground"
                                      >
                                        Type Your Answer (Arabic, Urdu, Malayalam, English, Español, Deutsch):
                                      </Label>
                                      <textarea
                                        id={`ans_${q.id}`}
                                        rows={3}
                                        disabled={isSubmissionLocked}
                                        readOnly={isSubmissionLocked}
                                        dir={ansLang.dir}
                                        lang={ansLang.lang}
                                        value={studentAns}
                                        onChange={(e) => {
                                          if (isSubmissionLocked) return
                                          setDraftAnswers((prev) => ({
                                            ...prev,
                                            [q.id]: e.target.value,
                                          }))
                                        }}
                                        placeholder={
                                          promptLang.isRtl
                                            ? 'اكتب إجابتك هنا...'
                                            : 'Type your clear answer here...'
                                        }
                                        className={cn(
                                          'w-full rounded-2xl border-0 bg-popover px-3.5 py-2.5 text-xs text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-80',
                                          ansLang.fontClass,
                                          ansLang.alignClass,
                                        )}
                                      />
                                      {currentSubmission?.status === 'graded' &&
                                        q.expectedAnswer && (
                                          <p
                                            dir={keyLang.dir}
                                            lang={keyLang.lang}
                                            className={cn(
                                              'text-[11px] text-muted-foreground',
                                              keyLang.fontClass,
                                              keyLang.alignClass,
                                            )}
                                          >
                                            <strong className="text-foreground">Model Key:</strong>{' '}
                                            {renderMultilingualInline(
                                              q.expectedAnswer,
                                              keyLang.isRtl,
                                            )}
                                          </p>
                                        )}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </>
                      )
                    })()}

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-4">
                      {isSubmissionLocked ? (
                        <>
                          <p className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Lock className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                            <span>
                              Submitted on {currentSubmission?.dateString}. Re-submission is locked and requires {currentTest.actorName || 'Subject Usthad'}&apos;s approval.
                            </span>
                          </p>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3.5 py-2 text-xs font-semibold text-muted-foreground">
                            <Lock className="size-3.5" aria-hidden="true" />
                            Answers Locked
                          </span>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground">
                            {currentSubmission?.acknowledged
                              ? `Re-submission approved by ${currentTest.actorName || 'Subject Usthad'}. Submit your updated answers once ready.`
                              : 'Verify all MCQ selections and typed answers before submitting. Answers lock after submission.'}
                          </p>
                          <Button
                            type="button"
                            disabled={isSubmittingTest}
                            onClick={handleSubmitUnitTest}
                            className="rounded-full bg-[#0095F6] font-semibold text-white hover:bg-[#0077CC]"
                          >
                            <Send className="mr-2 size-4" aria-hidden="true" />
                            {isSubmittingTest
                              ? 'Submitting...'
                              : currentSubmission?.acknowledged
                                ? 'Submit Updated Answers'
                                : 'Submit Test Answers'}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 2: HOLIDAY ACADEMIC & SSF DA'WA / ZIYARAT LOG */}
        {activeTab === 'holiday' && (
          <div className="mt-5 grid gap-6 lg:grid-cols-12">
            <form
              onSubmit={handleUploadHolidayActivity}
              className="space-y-4 rounded-2xl bg-muted/40 p-4 sm:p-5 lg:col-span-5"
            >
              <div>
                <h4 className="font-display text-base font-bold text-foreground">
                  Upload Holiday Academic / SSF Da&apos;wa / Ziyarat Activity
                </h4>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Record your holiday Kitab study, SSF Da&apos;wa work, or Maqbara Ziyarat visits for your Class Usthad to inspect and verify.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Activity Category</Label>
                <ThemeSelect
                  value={holidayCategory}
                  onChange={(e) => setHolidayCategory(e.target.value)}
                  aria-label="Select Holiday Activity Category"
                >
                  {HOLIDAY_ACTIVITY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </ThemeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="holiday-title" className="text-xs">
                  Activity Title / Kitab / Maqbara Name
                </Label>
                <Input
                  id="holiday-title"
                  value={holidayTitle}
                  onChange={(e) => setHolidayTitle(e.target.value)}
                  placeholder="e.g., SSF Unit Da'wa Circle & Mamburam Maqbara Ziyarat"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="holiday-date" className="text-xs">
                  Date of Activity
                </Label>
                <Input
                  id="holiday-date"
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  placeholder="e.g., 15 Nov 2026"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="holiday-desc" className="text-xs">
                  Detailed Summary & Reflection
                </Label>
                <textarea
                  id="holiday-desc"
                  rows={4}
                  value={holidayDescription}
                  onChange={(e) => setHolidayDescription(e.target.value)}
                  placeholder="Describe the chapters studied, SSF Da'wa activities conducted, or Ziyarat performed..."
                  required
                  className="w-full rounded-2xl border-0 bg-popover px-3.5 py-2.5 text-xs text-foreground outline-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Optional Photo Proof (Notes / Event / Ziyarat)</Label>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleHolidayPhotoChange}
                  className="hidden"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isUploadingPhoto}
                    onClick={() => photoInputRef.current?.click()}
                    className="rounded-full text-xs"
                  >
                    <Camera className="mr-1.5 size-3.5" aria-hidden="true" />
                    {isUploadingPhoto
                      ? 'Compressing Photo...'
                      : holidayPhotoUrl
                        ? 'Change Photo Proof'
                        : 'Attach Photo Proof'}
                  </Button>
                  {holidayPhotoUrl && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setHolidayPhotoUrl('')}
                      className="rounded-full text-xs text-red-500"
                    >
                      Remove Photo
                    </Button>
                  )}
                </div>
                {holidayPhotoUrl && (
                  <div className="overflow-hidden rounded-2xl bg-card">
                    <img
                      src={holidayPhotoUrl}
                      alt="Uploaded activity proof"
                      className="max-h-44 w-full object-cover"
                    />
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSavingHoliday}
                className="w-full rounded-full bg-[#0095F6] font-semibold text-white hover:bg-[#0077CC]"
              >
                <Upload className="mr-2 size-4" aria-hidden="true" />
                {isSavingHoliday ? 'Uploading Activity...' : 'Submit Activity to Class Usthad'}
              </Button>
            </form>

            <div className="space-y-3 lg:col-span-7">
              <h4 className="font-display text-base font-bold text-foreground">
                My Submitted Holiday & SSF Da&apos;wa Logs ({myHolidayLogs.length})
              </h4>

              {myHolidayLogs.length === 0 ? (
                <div className="rounded-2xl bg-muted/40 p-6 text-center text-xs text-muted-foreground">
                  You have not uploaded any holiday Academic, SSF Da&apos;wa, or Ziyarat logs yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {myHolidayLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-2xl bg-muted/40 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground tabular-nums">
                          {log.subjectOrCategory} · {log.dateString}
                        </p>
                        <span
                          className={cn(
                            'text-xs font-bold',
                            log.status === 'verified'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400',
                          )}
                        >
                          {log.status === 'verified'
                            ? '✓ Verified by Class Usthad'
                            : '⏳ Pending Usthad Review'}
                        </span>
                      </div>
                      <h5 className="mt-1 font-display text-base font-bold text-foreground">
                        {log.title}
                      </h5>
                      <p className="mt-1.5 whitespace-pre-line text-xs text-muted-foreground">
                        {log.description}
                      </p>

                      {log.photoUrl && (
                        <div className="mt-3 overflow-hidden rounded-2xl bg-card">
                          <img
                            src={log.photoUrl}
                            alt={log.title || 'Holiday proof'}
                            className="max-h-56 w-full object-cover"
                          />
                        </div>
                      )}

                      {log.remarks && (
                        <p className="mt-3 border-t border-border/40 pt-2.5 text-xs text-foreground">
                          <strong className="text-[#0077CC] dark:text-[#0095F6]">Usthad Note:</strong>{' '}
                          {log.remarks}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ZADUL KHAIR (زاد الخير) VOLUNTARY HOUSEHOLD LEDGER & CLASS LEADER ENTRY */}
        {activeTab === 'zadul_khair' && (
          <div className="mt-5 space-y-5">
            {isClassLeader && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0095F6]/10 px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-foreground">
                  <Crown className="size-4 shrink-0 text-[#0077CC] dark:text-[#0095F6]" aria-hidden="true" />
                  <span>
                    <strong>Class Leader Access ({normClass}):</strong> Switch to Class Entry to record voluntary monthly Zadul Khair contributions directly for your class.
                  </span>
                </div>
                <div className="inline-flex rounded-full bg-card p-1">
                  <button
                    type="button"
                    onClick={() => setZkLeaderView('personal')}
                    className={cn(
                      'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all active:scale-[0.98]',
                      zkLeaderView === 'personal'
                        ? 'bg-[#0095F6] text-white'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    My Contribution
                  </button>
                  <button
                    type="button"
                    onClick={() => setZkLeaderView('class')}
                    className={cn(
                      'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all active:scale-[0.98]',
                      zkLeaderView === 'class'
                        ? 'bg-[#0095F6] text-white'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Class Entry ({normClass})
                  </button>
                </div>
              </div>
            )}

            {isClassLeader && zkLeaderView === 'class' ? (
              <ClassZadulKhairManager
                className={normClass}
                selectedMonth={selectedMonth}
                onSelectMonth={setSelectedMonth}
                records={records}
                actorId={student.id}
                actorName={`${student.name} (Class Leader)`}
                actorRoleLabel="Class Leader"
                onNotify={setStatusBanner}
              />
            ) : (
              <>
                <div className="flex flex-col justify-between gap-4 rounded-2xl bg-muted/45 p-4 sm:flex-row sm:items-center sm:p-5">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-[#0077CC] uppercase dark:text-[#0095F6]">
                      Zadul Khair Receipt
                    </p>
                    <h4 className="mt-1 font-display text-lg font-bold text-foreground sm:text-xl">
                      {student.name} ({student.admissionNo})
                    </h4>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <MonthYearSelect
                      idPrefix="student-zk-period"
                      value={selectedMonth}
                      year={parseMonthId(selectedMonth).year}
                      onChange={(nextMonthId) => setSelectedMonth(nextMonthId)}
                      selectClassName="h-9 rounded-xl border border-input bg-background px-2.5 text-xs font-semibold text-foreground outline-none"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={pdfBusyId !== null}
                      onClick={() => handleExportMyZadulKhairPdf('download')}
                      className="rounded-full bg-[#0095F6] text-xs font-semibold text-white hover:bg-[#0077CC]"
                    >
                      <Download className="mr-1.5 size-3.5" aria-hidden="true" />
                      {pdfBusyId?.endsWith('_download') ? 'Preparing PDF...' : 'Download PDF'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pdfBusyId !== null}
                      onClick={() => handleExportMyZadulKhairPdf('jpg')}
                      className="rounded-full text-xs font-semibold"
                    >
                      <ImageIcon className="mr-1.5 size-3.5" aria-hidden="true" />
                      {pdfBusyId?.endsWith('_jpg') ? 'Saving JPG...' : 'Download JPG'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pdfBusyId !== null}
                      onClick={() => handleExportMyZadulKhairPdf('print')}
                      className="rounded-full text-xs"
                    >
                      <Printer className="mr-1.5 size-3.5" aria-hidden="true" />
                      Print
                    </Button>
                  </div>
                </div>

                {/* 3 Voluntary Contribution KPI Shapes: PREVIOUS / CURRENT MONTHLY / TOTAL */}
                <div className="grid gap-3.5 sm:grid-cols-3">
                  <div className="rounded-2xl bg-muted/45 p-4">
                    <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                      Previous Contribution
                    </p>
                    <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
                      ₹{myZadulKhairSummary.previousContribution.toLocaleString('en-IN')}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Prior months before {myZadulKhairSummary.selectedMonthLabel}
                    </p>
                  </div>

                  <div
                    className={cn(
                      'rounded-2xl p-4',
                      myZadulKhairSummary.currentMonthlyContribution > 0
                        ? 'bg-emerald-500/12'
                        : 'bg-muted/45',
                    )}
                  >
                    <p
                      className={cn(
                        'text-[11px] font-semibold tracking-wider uppercase',
                        myZadulKhairSummary.currentMonthlyContribution > 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-muted-foreground',
                      )}
                    >
                      Current Monthly Contribution
                    </p>
                    <p
                      className={cn(
                        'mt-1 font-display text-2xl font-bold tabular-nums',
                        myZadulKhairSummary.currentMonthlyContribution > 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-foreground',
                      )}
                    >
                      ₹{myZadulKhairSummary.currentMonthlyContribution.toLocaleString('en-IN')}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {myZadulKhairSummary.selectedMonthLabel} ·{' '}
                      <strong>
                        {myZadulKhairSummary.currentMonthlyContribution > 0
                          ? 'Received'
                          : 'Not Recorded'}
                      </strong>
                      {currentMonthZadulKhair.dateString ? ` · ${currentMonthZadulKhair.dateString}` : ''}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#0095F6]/10 p-4">
                    <p className="text-[11px] font-semibold tracking-wider text-[#0077CC] uppercase dark:text-[#0095F6]">
                      Total Contribution
                    </p>
                    <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
                      ₹{myZadulKhairSummary.totalContribution.toLocaleString('en-IN')}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Previous + Current Total
                      {myZadulKhairSummary.currentMonthRecord?.actorName
                        ? ` · Recorded by ${myZadulKhairSummary.currentMonthRecord.actorName}`
                        : ''}
                    </p>
                  </div>
                </div>

                {/* Full Academic-Year Monthly Contribution Ledger Table */}
                <div className="overflow-x-auto rounded-2xl bg-muted/35">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border/40 bg-muted/50 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                      <tr>
                        <th className="px-4 py-3">Month</th>
                        <th className="px-4 py-3">Receipt No.</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Contribution (₹)</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 tabular-nums">
                      {myZadulKhairSummary.monthlyRows.map((row) => (
                        <tr
                          key={row.monthId}
                          onClick={() => setSelectedMonth(row.monthId)}
                          className={cn(
                            'cursor-pointer transition-colors hover:bg-muted/30',
                            row.isSelectedMonth && 'bg-[#0095F6]/10',
                          )}
                        >
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {row.monthLabel}
                          </td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">
                            {row.receiptNo}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{row.dateString}</td>
                          <td className="px-4 py-3 font-mono font-bold text-foreground">
                            {row.isRecorded ? `₹${row.amount.toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                                row.isRecorded
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                  : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {row.statusLabel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-border/40 bg-emerald-500/10 font-semibold tabular-nums">
                      <tr>
                        <td className="px-4 py-3 text-foreground" colSpan={3}>
                          Total Contribution (2026–27)
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          ₹{myZadulKhairSummary.fullAcademicYearTotal.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-xs text-emerald-700 dark:text-emerald-400">
                          {myZadulKhairSummary.recordedMonthsCount}{' '}
                          {myZadulKhairSummary.recordedMonthsCount === 1 ? 'Month' : 'Months'} Recorded
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 4: STRICTLY PRIVATE DISCIPLINE / CONDUCT ADVISORY FOR THIS STUDENT ONLY */}
        {activeTab === 'discipline' && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-2.5 rounded-2xl bg-muted/45 px-4 py-3 text-xs text-muted-foreground">
              <Lock className="size-4 shrink-0 text-[#0077CC] dark:text-[#0095F6]" aria-hidden="true" />
              <span>
                <strong>Confidentiality Guarantee:</strong> Notes in this section are strictly private between you ({student.name}) and your Class Usthad / Principal. No other student can view this record.
              </span>
            </div>

            {myDisciplineNotes.length === 0 ? (
              <div className="rounded-2xl bg-emerald-500/12 p-6 text-center">
                <CheckCircle2 className="mx-auto size-8 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <h4 className="mt-2 font-display text-base font-bold text-foreground">
                  Exemplary Institutional Conduct — No Disciplinary Notes
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Alhamdulillah! No institutional discipline violations or warnings have been recorded for your profile.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myDisciplineNotes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-2xl bg-amber-500/12 p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-amber-800 uppercase tabular-nums dark:text-amber-300">
                        {note.status} Note · {note.dateString} · Logged by {note.actorName}
                      </p>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {note.acknowledged ? '✓ Acknowledged by Student' : 'Action Required'}
                      </span>
                    </div>
                    <h5 className="mt-1.5 font-display text-base font-bold text-foreground">
                      {note.title}
                    </h5>
                    <p className="mt-1 text-xs text-foreground/90">{note.description}</p>
                    {note.remarks && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        <strong className="text-foreground">Usthad Corrective Advice:</strong>{' '}
                        {note.remarks}
                      </p>
                    )}

                    {!note.acknowledged && (
                      <div className="mt-3 pt-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleAcknowledgeDisciplineNote(note)}
                          className="rounded-full bg-[#0095F6] text-xs font-semibold text-white hover:bg-[#0077CC]"
                        >
                          <Check className="mr-1.5 size-3.5" aria-hidden="true" />
                          I Have Read & Acknowledged This Guidance
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Panel>
    </section>
  )
}

export function UsthadAcademicHub({
  actorId,
  actorName,
  role,
  activeClassName,
  usthad,
}: {
  actorId: string
  actorName: string
  role: 'usthad' | 'principal'
  activeClassName: string
  usthad?: ClassUsthad
}) {
  const [records, setRecords] = useState<CampusAcademicRecord[]>([])
  const [activeTab, setActiveTab] = useState<UsthadHubTab>('syllabus')
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-11')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const resolvedUsthad = useMemo<ClassUsthad | undefined>(() => {
    if (usthad) return usthad
    return (
      OFFICIAL_CLASS_USTHADS.find((u) => u.id === actorId || u.name === actorName) ??
      CLASS_USTHADS.find((u) => u.id === actorId || u.name === actorName) ??
      OFFICIAL_CLASS_USTHADS.find((u) => doesUsthadMatchTeacherName(u, actorName))
    )
  }, [usthad, actorId, actorName])

  const normClass = normalizeClassName(activeClassName || 'BS 3')
  const classStudents = useMemo(
    () => students.filter((s) => normalizeClassName(s.className) === normClass),
    [normClass],
  )

  useEffect(() => {
    setRecords(loadCampusAcademicRecords())
    const unsub = subscribeCampusAcademicRecords((updated) => {
      setRecords(updated)
    })
    return unsub
  }, [])

  // --- 0. Jamiathul Hind Monthly Syllabus & Kitab Page Tracker State ---
  const [usthadSyllabusEdits, setUsthadSyllabusEdits] = useState<
    Record<
      string,
      {
        chapter: string
        totalPages: number
        completedPages: number
        remarks: string
      }
    >
  >({})
  const [savingSyllabusId, setSavingSyllabusId] = useState<string | null>(null)

  const myTeachingSyllabusRows = useMemo(
    () =>
      resolvedUsthad
        ? buildUsthadTeachingSyllabusRows(resolvedUsthad, selectedMonth, records)
        : [],
    [resolvedUsthad, selectedMonth, records],
  )

  const activeClassSyllabusRows = useMemo(
    () => buildClassSyllabusRows(normClass, selectedMonth, records),
    [normClass, selectedMonth, records],
  )

  async function handleUsthadUpdateSyllabusPages(
    row: CampusAcademicRecord,
    allowFullEdit: boolean,
  ) {
    setSavingSyllabusId(row.id)
    try {
      const draft = usthadSyllabusEdits[row.id]
      const chapter = allowFullEdit
        ? (draft?.chapter ?? row.subjectOrCategory ?? '').trim() || 'Not recorded'
        : row.subjectOrCategory || 'Not recorded'
      const totalPages = allowFullEdit
        ? Math.max(0, Math.min(1000, Number(draft?.totalPages ?? row.totalMarks ?? 0)))
        : Math.max(0, Math.min(1000, Number(row.totalMarks ?? 0)))
      const completedPages = Math.max(
        0,
        Math.min(1000, Number(draft?.completedPages ?? row.obtainedMarks ?? 0)),
      )
      const remainingPages = Math.max(0, totalPages - completedPages)
      const remarks =
        (draft?.remarks ?? row.remarks ?? '').trim() ||
        `Updated by ${actorName}: ${completedPages}/${totalPages} pages completed (${remainingPages} pages remaining).`

      const matchedTeacher = findUsthadForTeacherName(row.studentName || '')
      const updatedRecord: CampusAcademicRecord = {
        ...row,
        studentId: matchedTeacher?.id || row.studentId,
        month: selectedMonth,
        subjectOrCategory: chapter,
        totalMarks: totalPages,
        obtainedMarks: completedPages,
        remarks,
        status: completedPages >= totalPages && totalPages > 0 ? 'verified' : 'active',
        actorId,
        actorName,
        dateString: formatTodayDateDisplay(),
        isDeleted: false,
        updatedAtMs: Date.now(),
      }

      await upsertCampusAcademicRecord(updatedRecord)

      setUsthadSyllabusEdits((prev) => {
        if (!(row.id in prev)) return prev
        const next = { ...prev }
        delete next[row.id]
        return next
      })

      publishCampusNotification({
        type: 'notice',
        title: `Syllabus Update · Class ${row.className}`,
        message: `${actorName} updated "${row.title}" (Class ${row.className}): ${completedPages}/${totalPages} pages completed (${remainingPages} remaining).`,
        targetClass: row.className,
        actorId,
        actorName,
        href: '#academic-hub',
      })

      setToastMessage(
        `Updated "${row.title}" (Class ${row.className}): ${completedPages}/${totalPages} pages completed.`,
      )
    } finally {
      setSavingSyllabusId(null)
    }
  }

  // --- 1. Monthly / Unit Test Builder & Grader State ---
  const [showCreateTestForm, setShowCreateTestForm] = useState(false)
  const [newTestTitle, setNewTestTitle] = useState('')
  const [newTestSubject, setNewTestSubject] = useState('')
  const [newTestDescription, setNewTestDescription] = useState('')
  const [newTestQuestions, setNewTestQuestions] = useState<UnitTestQuestion[]>([
    {
      id: 'q1',
      type: 'mcq',
      prompt: '',
      options: ['', '', '', ''],
      correctOptionIndex: 0,
      marks: 5,
    },
    {
      id: 'q2',
      type: 'objective',
      prompt: '',
      expectedAnswer: '',
      marks: 10,
    },
  ])
  const [selectedTestIdForGrading, setSelectedTestIdForGrading] = useState<string>('')
  const [gradingMarksDraft, setGradingMarksDraft] = useState<
    Record<string, Record<string, number>>
  >({})
  const [gradingRemarksDraft, setGradingRemarksDraft] = useState<Record<string, string>>({})

  const classTests = useMemo(
    () =>
      records.filter(
        (r) =>
          r.recordKind === 'unit_test' &&
          !r.isDeleted &&
          normalizeClassName(r.className) === normClass,
      ),
    [records, normClass],
  )

  useEffect(() => {
    if (classTests.length > 0 && ! classTests.some((t) => t.id === selectedTestIdForGrading)) {
      setSelectedTestIdForGrading(classTests[0].id)
    }
  }, [classTests, selectedTestIdForGrading])

  const activeGradingTest = useMemo(
    () => classTests.find((t) => t.id === selectedTestIdForGrading) || classTests[0] || null,
    [classTests, selectedTestIdForGrading],
  )

  const submissionsForActiveTest = useMemo(
    () =>
      activeGradingTest
        ? records.filter(
            (r) =>
              r.recordKind === 'test_submission' &&
              !r.isDeleted &&
              r.subjectOrCategory === activeGradingTest.id,
          )
        : [],
    [records, activeGradingTest],
  )

  const canManageActiveTestResubmit = useMemo(() => {
    if (!activeGradingTest) return false
    if (role === 'principal') return true
    if (activeGradingTest.actorId === actorId) return true
    if (
      activeGradingTest.actorName &&
      actorName &&
      activeGradingTest.actorName.trim().toLowerCase() === actorName.trim().toLowerCase()
    ) {
      return true
    }
    if (resolvedUsthad && activeGradingTest.actorName) {
      return doesUsthadMatchTeacherName(resolvedUsthad, activeGradingTest.actorName)
    }
    return false
  }, [activeGradingTest, role, actorId, actorName, resolvedUsthad])

  // --- 2. Holiday & SSF Da'wa Verification State ---
  const classHolidayLogs = useMemo(
    () =>
      records.filter(
        (r) =>
          r.recordKind === 'holiday_log' &&
          !r.isDeleted &&
          normalizeClassName(r.className) === normClass,
      ),
    [records, normClass],
  )
  const [holidayRemarksDraft, setHolidayRemarksDraft] = useState<Record<string, string>>({})

  // --- 3. Confidential Student Discipline State ---
  const [disciplineStudentId, setDisciplineStudentId] = useState<string>('')
  const [disciplineSeverity, setDisciplineSeverity] = useState<'advisory' | 'warning' | 'serious'>(
    'advisory',
  )
  const [disciplineTitle, setDisciplineTitle] = useState<string>('')
  const [disciplineDesc, setDisciplineDesc] = useState<string>('')
  const [disciplineAdvice, setDisciplineAdvice] = useState<string>('')

  useEffect(() => {
    if (classStudents.length > 0 && !classStudents.some((s) => s.id === disciplineStudentId)) {
      setDisciplineStudentId(classStudents[0].id)
    }
  }, [classStudents, disciplineStudentId])

  const classDisciplineNotes = useMemo(
    () =>
      records.filter(
        (r) =>
          r.recordKind === 'discipline_note' &&
          !r.isDeleted &&
          normalizeClassName(r.className) === normClass,
      ),
    [records, normClass],
  )

  // --- 4. Zadul Khair handled by shared voluntary ClassZadulKhairManager ---

  function addQuestionRow(type: UnitTestQuestionType) {
    setNewTestQuestions((prev) => [
      ...prev,
      {
        id: `q${prev.length + 1}_${Date.now().toString().slice(-3)}`,
        type,
        prompt: '',
        options: type === 'mcq' ? ['', '', '', ''] : undefined,
        correctOptionIndex: type === 'mcq' ? 0 : undefined,
        expectedAnswer: type === 'objective' ? '' : undefined,
        marks: type === 'mcq' ? 5 : 10,
      },
    ])
  }

  async function handlePublishNewUnitTest(e: React.FormEvent) {
    e.preventDefault()
    if (!newTestTitle.trim() || newTestQuestions.length === 0) return

    const validQuestions = newTestQuestions.filter((q) => q.prompt.trim().length > 0)
    if (validQuestions.length === 0) return

    const totalMarks = validQuestions.reduce((acc, q) => acc + (Number(q.marks) || 5), 0)
    const testId = `test_${normClass.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`

    const record: CampusAcademicRecord = {
      id: testId,
      campusId: 'ics-academy',
      recordKind: 'unit_test',
      className: normClass,
      month: selectedMonth,
      title: newTestTitle.trim(),
      subjectOrCategory: newTestSubject.trim() || 'Monthly Kitab Evaluation',
      description: newTestDescription.trim() || 'Answer all MCQ and Objective questions.',
      status: 'active',
      actorId,
      actorName,
      dateString: formatTodayDateDisplay(),
      totalMarks,
      questions: validQuestions,
      isDeleted: false,
      updatedAtMs: Date.now(),
    }

    await upsertCampusAcademicRecord(record)

    publishCampusNotification({
      type: 'notice',
      title: `New Monthly/Unit Test: ${record.title}`,
      message: `${actorName} published "${record.title}" (${totalMarks} marks) for Class ${normClass}.`,
      targetClass: normClass,
      actorId,
      actorName,
      href: '#academic-hub',
    })

    setShowCreateTestForm(false)
    setSelectedTestIdForGrading(testId)
    setNewTestTitle('')
    setNewTestSubject('')
    setNewTestDescription('')
    setToastMessage(`Published "${record.title}" for Class ${normClass}.`)
  }

  async function handleSaveStudentGrade(sub: CampusAcademicRecord) {
    if (!activeGradingTest) return
    const questions = activeGradingTest.questions || []
    const draftMap = gradingMarksDraft[sub.id] || sub.questionMarks || {}
    const updatedQuestionMarks: Record<string, number> = {}
    let totalObtained = 0

    for (const q of questions) {
      const val = Number(draftMap[q.id] ?? sub.questionMarks?.[q.id] ?? 0)
      const clamped = Math.max(0, Math.min(q.marks, Number.isFinite(val) ? val : 0))
      updatedQuestionMarks[q.id] = clamped
      totalObtained += clamped
    }

    const remarks = (gradingRemarksDraft[sub.id] ?? sub.remarks ?? '').trim()

    const updatedSub: CampusAcademicRecord = {
      ...sub,
      status: 'graded',
      obtainedMarks: totalObtained,
      totalMarks: activeGradingTest.totalMarks || 20,
      questionMarks: updatedQuestionMarks,
      remarks: remarks || 'Evaluated by Class Usthad.',
      acknowledged: false,
      actorId,
      updatedAtMs: Date.now(),
    }

    await upsertCampusAcademicRecord(updatedSub)

    if (sub.studentId) {
      publishCampusNotification({
        type: 'notice',
        title: `Test Marks Published: ${activeGradingTest.title}`,
        message: `You scored ${totalObtained}/${activeGradingTest.totalMarks || 20} in ${activeGradingTest.title}.`,
        targetClass: normClass,
        targetStudentId: sub.studentId,
        actorId,
        actorName,
        href: '#academic-hub',
      })
    }

    setToastMessage(
      `Saved marks (${totalObtained}/${activeGradingTest.totalMarks || 20}) for ${sub.studentName}. Star of the Month updated!`,
    )
  }

  async function handleToggleStudentResubmitApproval(sub: CampusAcademicRecord) {
    if (!activeGradingTest || !canManageActiveTestResubmit) return
    const nextAllowed = !Boolean(sub.acknowledged)

    await upsertCampusAcademicRecord({
      ...sub,
      acknowledged: nextAllowed,
      actorId,
      updatedAtMs: Date.now(),
    })

    if (nextAllowed && sub.studentId) {
      publishCampusNotification({
        type: 'notice',
        title: `Re-submission Approved: ${activeGradingTest.title}`,
        message: `${actorName} allowed you to edit and re-submit your answers for "${activeGradingTest.title}".`,
        targetClass: normClass,
        targetStudentId: sub.studentId,
        actorId,
        actorName,
        href: '#academic-hub',
      })
    }

    setToastMessage(
      nextAllowed
        ? `Allowed ${sub.studentName} to re-submit "${activeGradingTest.title}".`
        : `Locked re-submission for ${sub.studentName} on "${activeGradingTest.title}".`,
    )
  }

  async function handleVerifyHolidayLog(log: CampusAcademicRecord) {
    const remark =
      (holidayRemarksDraft[log.id] ?? log.remarks ?? '').trim() ||
      `Verified and appreciated by ${actorName}. Barakallahu Feekum.`
    await upsertCampusAcademicRecord({
      ...log,
      status: 'verified',
      remarks: remark,
      actorId,
      updatedAtMs: Date.now(),
    })

    if (log.studentId) {
      publishCampusNotification({
        type: 'notice',
        title: `Holiday / SSF Da'wa Activity Verified`,
        message: `${actorName} verified your activity "${log.title}": ${remark}`,
        targetClass: normClass,
        targetStudentId: log.studentId,
        actorId,
        actorName,
        href: '#academic-hub',
      })
    }

    setToastMessage(`Verified holiday activity for ${log.studentName}.`)
  }

  async function handleCreateDisciplineNote(e: React.FormEvent) {
    e.preventDefault()
    const targetStu = classStudents.find((s) => s.id === disciplineStudentId)
    if (!targetStu || !disciplineTitle.trim() || !disciplineDesc.trim()) return

    const noteRecord: CampusAcademicRecord = {
      id: `disc_${targetStu.id}_${Date.now()}`,
      campusId: 'ics-academy',
      recordKind: 'discipline_note',
      className: normClass,
      studentId: targetStu.id,
      studentName: targetStu.name,
      admissionNo: targetStu.admissionNo,
      month: selectedMonth,
      title: disciplineTitle.trim(),
      description: disciplineDesc.trim(),
      remarks: disciplineAdvice.trim() || undefined,
      status: disciplineSeverity,
      actorId,
      actorName,
      dateString: formatTodayDateDisplay(),
      acknowledged: false,
      isDeleted: false,
      updatedAtMs: Date.now(),
    }

    await upsertCampusAcademicRecord(noteRecord)

    publishCampusNotification({
      type: 'notice',
      title: `Private Advisory from ${actorName}`,
      message: `A confidential conduct advisory "${noteRecord.title}" has been recorded for your profile.`,
      targetClass: normClass,
      targetStudentId: targetStu.id,
      actorId,
      actorName,
      href: '#academic-hub',
    })

    setDisciplineTitle('')
    setDisciplineDesc('')
    setDisciplineAdvice('')
    setToastMessage(
      `Recorded private conduct note for ${targetStu.name} (visible only to ${targetStu.name} & staff).`,
    )
  }

  async function handleDeleteDisciplineNote(note: CampusAcademicRecord) {
    await upsertCampusAcademicRecord({
      ...note,
      status: 'deleted',
      isDeleted: true,
      actorId,
      updatedAtMs: Date.now(),
    })
    setToastMessage(`Removed discipline note for ${note.studentName}.`)
  }

  // Zadul Khair save & PDF export actions are encapsulated in ClassZadulKhairManager.

  return (
    <section id="academic-hub" className="scroll-mt-24 space-y-6">
      {/* 1. Automatic Star of the Month Banner for this Class */}
      <StarOfTheMonthSpotlight
        className={normClass}
        monthId={selectedMonth}
        records={records}
        onSelectMonth={setSelectedMonth}
      />

      {/* 2. Usthad / Principal Control Hub */}
      <Panel
        id="usthad-academic-hub-panel"
        title={`Class ${normClass} Hub`}
        eyebrow={`${actorName} · ${role === 'principal' ? 'Principal' : 'Usthad'}`}
        icon={Trophy}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-4">
          <button
            type="button"
            onClick={() => setActiveTab('syllabus')}
            className={cn(
              'flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.98]',
              activeTab === 'syllabus'
                ? 'bg-[#0095F6] text-white'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <BookOpen className="size-3.5" aria-hidden="true" />
            <span>
              Syllabus ({myTeachingSyllabusRows.length || activeClassSyllabusRows.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tests')}
            className={cn(
              'flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.98]',
              activeTab === 'tests'
                ? 'bg-[#0095F6] text-white'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <ClipboardCheck className="size-3.5" aria-hidden="true" />
            <span>Unit Tests ({classTests.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('holiday')}
            className={cn(
              'flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.98]',
              activeTab === 'holiday'
                ? 'bg-[#0095F6] text-white'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>Da&apos;wa Logs ({classHolidayLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('discipline')}
            className={cn(
              'flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.98]',
              activeTab === 'discipline'
                ? 'bg-[#0095F6] text-white'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <ShieldAlert className="size-3.5" aria-hidden="true" />
            <span>Conduct ({classDisciplineNotes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('zadul_khair')}
            className={cn(
              'flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.98]',
              activeTab === 'zadul_khair'
                ? 'bg-[#0095F6] text-white'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <HeartHandshake className="size-3.5" aria-hidden="true" />
            <span>Zadul Khair</span>
          </button>
        </div>

        {toastMessage && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-emerald-500/12 px-4 py-3 text-xs font-medium text-foreground">
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
        )}

        {/* USTHAD TAB 0: MONTHLY SYLLABUS & MY TEACHING SUBJECTS */}
        {activeTab === 'syllabus' && (
          <div className="mt-5 space-y-6">
            {/* Section A: My Teaching Subjects Across All Classes */}
            {myTeachingSyllabusRows.length > 0 && (
              <div className="space-y-4 rounded-2xl bg-[#0095F6]/10 p-4 sm:p-5">
                <div className="flex flex-col justify-between gap-3 border-b border-border/40 pb-3.5 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-xs font-bold tracking-wider text-[#0077CC] uppercase dark:text-[#0095F6]">
                      My Subjects
                    </p>
                    <h4 className="mt-1 font-display text-base font-bold text-foreground sm:text-lg">
                      Monthly Syllabus ({myTeachingSyllabusRows.length})
                    </h4>
                  </div>

                  <MonthYearSelect
                    idPrefix="usthad-syllabus-period"
                    value={selectedMonth}
                    year={parseMonthId(selectedMonth).year}
                    onChange={(nextMonthId) => setSelectedMonth(nextMonthId)}
                    selectClassName="h-9 rounded-xl border border-input bg-background px-2.5 text-xs font-semibold text-foreground outline-none"
                  />
                </div>

                <div className="grid gap-3.5 md:grid-cols-2">
                  {myTeachingSyllabusRows.map((row) => {
                    const parsedRange = extractSyllabusChapterRange(row)
                    const draft = usthadSyllabusEdits[row.id]
                    const totalPagesVal = Number(draft?.totalPages ?? row.totalMarks ?? 0)
                    const completedPagesVal = Number(
                      draft?.completedPages ?? row.obtainedMarks ?? 0,
                    )
                    const remainingPagesVal = Math.max(0, totalPagesVal - completedPagesVal)
                    const progressPct =
                      totalPagesVal > 0
                        ? Math.min(100, Math.round((completedPagesVal / totalPagesVal) * 100))
                        : 0

                    const fromRtl = getSyllabusFieldRtlProps(parsedRange.fromChapter)
                    const toRtl = getSyllabusFieldRtlProps(parsedRange.toChapter)
                    const titleRtl = getSyllabusFieldRtlProps(row.title)

                    return (
                      <div
                        key={row.id}
                        className="flex flex-col justify-between rounded-2xl bg-card p-4"
                      >
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0095F6]/12 px-2.5 py-0.5 font-mono text-xs font-bold text-[#0077CC] dark:text-[#0095F6]">
                              Class {row.className} · {row.admissionNo}
                            </span>
                            <span className="font-mono text-xs font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                              {progressPct}% Done
                            </span>
                          </div>

                          <h5
                            dir={titleRtl.dir}
                            lang={titleRtl.lang}
                            className={cn(
                              'mt-2 text-base font-bold text-foreground',
                              titleRtl.isRtl ? 'font-arabic text-right' : 'font-display',
                            )}
                          >
                            {row.title}
                          </h5>

                          <div className="mt-2 grid gap-2 rounded-xl bg-muted/45 p-2.5 sm:grid-cols-2">
                            <div>
                              <span className="block text-[10px] font-bold tracking-wider text-[#0077CC] uppercase dark:text-[#0095F6]">
                                From
                              </span>
                              <p
                                dir={fromRtl.dir}
                                lang={fromRtl.lang}
                                className={cn(
                                  'mt-0.5 break-words font-semibold text-foreground',
                                  fromRtl.displayClass,
                                )}
                              >
                                {parsedRange.fromChapter
                                  ? renderMultilingualInline(parsedRange.fromChapter, fromRtl.isRtl)
                                  : 'Not recorded'}
                              </p>
                            </div>
                            <div className="border-t border-border/40 pt-1.5 sm:border-t-0 sm:border-l sm:pl-2.5 sm:pt-0">
                              <span className="block text-[10px] font-bold tracking-wider text-[#0077CC] uppercase dark:text-[#0095F6]">
                                To
                              </span>
                              <p
                                dir={toRtl.dir}
                                lang={toRtl.lang}
                                className={cn(
                                  'mt-0.5 break-words font-semibold text-foreground',
                                  toRtl.displayClass,
                                )}
                              >
                                {parsedRange.toChapter
                                  ? renderMultilingualInline(parsedRange.toChapter, toRtl.isRtl)
                                  : 'Not recorded'}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs tabular-nums">
                            <div className="rounded-xl bg-muted/45 p-2">
                              <span className="block text-[10px] text-muted-foreground">
                                Target
                              </span>
                              <strong className="font-mono text-sm text-foreground">
                                {totalPagesVal}p
                              </strong>
                            </div>
                            <div className="rounded-xl bg-emerald-500/12 p-2">
                              <span className="block text-[10px] text-emerald-700 dark:text-emerald-400">
                                Done
                              </span>
                              <strong className="font-mono text-sm text-emerald-700 dark:text-emerald-400">
                                {completedPagesVal}p
                              </strong>
                            </div>
                            <div className="rounded-xl bg-amber-500/12 p-2">
                              <span className="block text-[10px] text-amber-800 dark:text-amber-300">
                                Left
                              </span>
                              <strong className="font-mono text-sm text-amber-700 dark:text-amber-300">
                                {remainingPagesVal}p
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3.5 flex items-end gap-2 border-t border-border/40 pt-3">
                          <div className="flex-1 space-y-1">
                            <Label className="text-[11px] font-semibold text-foreground">
                              Completed Pages
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              max={1000}
                              value={completedPagesVal}
                              onChange={(e) =>
                                setUsthadSyllabusEdits((prev) => ({
                                  ...prev,
                                  [row.id]: {
                                    chapter: row.subjectOrCategory || '',
                                    totalPages: totalPagesVal,
                                    completedPages: Math.max(0, Number(e.target.value) || 0),
                                    remarks: draft?.remarks ?? row.remarks ?? '',
                                  },
                                }))
                              }
                              className="h-9 font-mono text-xs font-bold tabular-nums"
                            />
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            disabled={savingSyllabusId === row.id}
                            onClick={() =>
                              handleUsthadUpdateSyllabusPages(row, role === 'principal')
                            }
                            className="h-9 rounded-full bg-[#0095F6] px-4 text-xs font-semibold text-white hover:bg-[#0077CC]"
                          >
                            <Check className="mr-1.5 size-3.5" aria-hidden="true" />
                            {savingSyllabusId === row.id ? 'Saving...' : 'Save'}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Section B: Full Class Syllabus Table for Active Class */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-display text-base font-bold text-foreground">
                  Class {normClass} Syllabus ({selectedMonth})
                </h4>
              </div>

              <div className="overflow-x-auto rounded-2xl bg-muted/35">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/40 bg-muted/50 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    <tr>
                      <th className="px-3.5 py-3">Kitab</th>
                      <th className="px-3.5 py-3">Usthad</th>
                      <th className="px-3.5 py-3">Portion (From – To)</th>
                      <th className="px-3.5 py-3">Target</th>
                      <th className="px-3.5 py-3">Done</th>
                      <th className="px-3.5 py-3">Left</th>
                      <th className="px-3.5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 tabular-nums">
                    {activeClassSyllabusRows.map((row) => {
                      const parsedRange = extractSyllabusChapterRange(row)
                      const fromRtl = getSyllabusFieldRtlProps(parsedRange.fromChapter)
                      const toRtl = getSyllabusFieldRtlProps(parsedRange.toChapter)
                      const titleRtl = getSyllabusFieldRtlProps(row.title)
                      const canEditThisSubject =
                        role === 'principal' ||
                        row.studentId === actorId ||
                        (resolvedUsthad
                          ? doesUsthadMatchTeacherName(resolvedUsthad, row.studentName || '')
                          : false)
                      const draft = usthadSyllabusEdits[row.id]
                      const totalVal = Number(draft?.totalPages ?? row.totalMarks ?? 0)
                      const completedVal = Number(draft?.completedPages ?? row.obtainedMarks ?? 0)
                      const remainingVal = Math.max(0, totalVal - completedVal)

                      return (
                        <tr key={row.id} className="hover:bg-muted/30">
                          <td className="px-3.5 py-3">
                            <span className="font-mono text-[11px] font-bold text-[#0077CC] dark:text-[#0095F6]">
                              {row.admissionNo}
                            </span>
                            <p
                              dir={titleRtl.dir}
                              lang={titleRtl.lang}
                              className={cn(
                                'font-semibold text-foreground',
                                titleRtl.isRtl && 'font-arabic text-right text-sm',
                              )}
                            >
                              {row.title}
                            </p>
                          </td>
                          <td className="px-3.5 py-3 font-medium text-foreground">
                            {row.studentName}
                          </td>
                          <td className="px-3.5 py-3 text-foreground">
                            <div className="space-y-1 text-xs">
                              <div>
                                <span className="block text-[10px] font-semibold text-[#0077CC] uppercase dark:text-[#0095F6]">
                                  From
                                </span>
                                <p
                                  dir={fromRtl.dir}
                                  lang={fromRtl.lang}
                                  className={cn('font-medium text-foreground', fromRtl.displayClass)}
                                >
                                  {parsedRange.fromChapter
                                    ? renderMultilingualInline(parsedRange.fromChapter, fromRtl.isRtl)
                                    : 'Not recorded'}
                                </p>
                              </div>
                              <div>
                                <span className="block text-[10px] font-semibold text-[#0077CC] uppercase dark:text-[#0095F6]">
                                  To
                                </span>
                                <p
                                  dir={toRtl.dir}
                                  lang={toRtl.lang}
                                  className={cn('font-medium text-foreground', toRtl.displayClass)}
                                >
                                  {parsedRange.toChapter
                                    ? renderMultilingualInline(parsedRange.toChapter, toRtl.isRtl)
                                    : 'Not recorded'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3.5 py-3 font-mono font-bold text-foreground">
                            {totalVal}p
                          </td>
                          <td className="px-3.5 py-3">
                            {canEditThisSubject ? (
                              <Input
                                type="number"
                                min={0}
                                max={1000}
                                value={completedVal}
                                onChange={(e) =>
                                  setUsthadSyllabusEdits((prev) => ({
                                    ...prev,
                                    [row.id]: {
                                      chapter: row.subjectOrCategory || '',
                                      totalPages: totalVal,
                                      completedPages: Math.max(0, Number(e.target.value) || 0),
                                      remarks: draft?.remarks ?? row.remarks ?? '',
                                    },
                                  }))
                                }
                                className="h-8 w-24 font-mono text-xs font-bold tabular-nums"
                              />
                            ) : (
                              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                {completedVal}p
                              </span>
                            )}
                          </td>
                          <td className="px-3.5 py-3 font-mono font-bold text-amber-700 dark:text-amber-300">
                            {remainingVal}p
                          </td>
                          <td className="px-3.5 py-3 text-right">
                            {canEditThisSubject ? (
                              <Button
                                type="button"
                                size="sm"
                                disabled={savingSyllabusId === row.id}
                                onClick={() =>
                                  handleUsthadUpdateSyllabusPages(row, role === 'principal')
                                }
                                className="h-8 rounded-full bg-[#0095F6] px-3.5 text-xs font-semibold text-white hover:bg-[#0077CC]"
                              >
                                Save
                              </Button>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">View Only</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* USTHAD TAB 1: MONTHLY / UNIT TEST CREATION & STUDENT SUBMISSION GRADING */}
        {activeTab === 'tests' && (
          <div className="mt-5 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-display text-base font-bold text-foreground">
                  Class {normClass} Monthly / Unit Tests (MCQ & Objective)
                </h4>
                <p className="text-xs text-muted-foreground">
                  Type Multiple-Choice and Objective questions for students, evaluate their submitted answers, and assign marks.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowCreateTestForm((v) => !v)}
                className="rounded-full bg-[#0095F6] text-xs font-semibold text-white hover:bg-[#0077CC]"
              >
                <Plus className="mr-1.5 size-4" aria-hidden="true" />
                {showCreateTestForm ? 'Hide Test Builder' : 'Create New Monthly / Unit Test'}
              </Button>
            </div>

            {showCreateTestForm && (
              <form
                onSubmit={handlePublishNewUnitTest}
                className="space-y-4 rounded-2xl bg-muted/45 p-4 sm:p-6"
              >
                <h5 className="font-display text-base font-bold text-foreground">
                  Create New Monthly / Unit Test for Class {normClass}
                </h5>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Test Title</Label>
                    <Input
                      dir={getMultilingualTextProps(newTestTitle).dir}
                      lang={getMultilingualTextProps(newTestTitle).lang}
                      value={newTestTitle}
                      onChange={(e) => setNewTestTitle(e.target.value)}
                      placeholder="e.g., الاختبار الشهري / November Monthly Test"
                      required
                      className={cn(
                        getMultilingualTextProps(newTestTitle).fontClass,
                        getMultilingualTextProps(newTestTitle).alignClass,
                      )}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Subject / Kitab Name</Label>
                    <Input
                      dir={getMultilingualTextProps(newTestSubject, newTestTitle).dir}
                      lang={getMultilingualTextProps(newTestSubject, newTestTitle).lang}
                      value={newTestSubject}
                      onChange={(e) => setNewTestSubject(e.target.value)}
                      placeholder="e.g., فتح المعين / Fath al-Mu'in"
                      required
                      className={cn(
                        getMultilingualTextProps(newTestSubject, newTestTitle).fontClass,
                        getMultilingualTextProps(newTestSubject, newTestTitle).alignClass,
                      )}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Instructions</Label>
                    <Input
                      dir={getMultilingualTextProps(newTestDescription, newTestTitle).dir}
                      lang={getMultilingualTextProps(newTestDescription, newTestTitle).lang}
                      value={newTestDescription}
                      onChange={(e) => setNewTestDescription(e.target.value)}
                      placeholder="Short instructions for students..."
                      className={cn(
                        getMultilingualTextProps(newTestDescription, newTestTitle).fontClass,
                        getMultilingualTextProps(newTestDescription, newTestTitle).alignClass,
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {newTestQuestions.map((q, idx) => {
                    const qPromptLang = getMultilingualTextProps(q.prompt, newTestTitle)
                    const qExpectedLang = getMultilingualTextProps(
                      q.expectedAnswer,
                      q.prompt || newTestTitle,
                    )
                    return (
                      <div
                        key={q.id}
                        className="space-y-3 rounded-2xl bg-card p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-[#0077CC] dark:text-[#0095F6]">
                            Question #{idx + 1} (
                            {q.type === 'mcq' ? 'Multiple Choice' : 'Objective / Typed'})
                          </span>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs">Marks:</Label>
                            <Input
                              type="number"
                              min={1}
                              max={100}
                              value={q.marks}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 5
                                setNewTestQuestions((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, marks: val } : item)),
                                )
                              }}
                              className="h-8 w-20 text-xs tabular-nums"
                            />
                            {newTestQuestions.length > 1 && (
                              <DeleteActionMenu
                                ariaLabel={`Options for Question #${idx + 1}`}
                                onConfirmDelete={() =>
                                  setNewTestQuestions((prev) => prev.filter((_, i) => i !== idx))
                                }
                              />
                            )}
                          </div>
                        </div>

                        <Input
                          dir={qPromptLang.dir}
                          lang={qPromptLang.lang}
                          value={q.prompt}
                          onChange={(e) => {
                            const val = e.target.value
                            setNewTestQuestions((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, prompt: val } : item)),
                            )
                          }}
                          placeholder="اكتب السؤال هنا / Type the question text here..."
                          required
                          className={cn(qPromptLang.fontClass, qPromptLang.alignClass)}
                        />

                        {q.type === 'mcq' && Array.isArray(q.options) ? (
                          <div
                            dir={qPromptLang.dir}
                            className="grid gap-2.5 sm:grid-cols-2"
                          >
                            {q.options.map((opt, optIdx) => {
                              const optLang = getMultilingualTextProps(
                                opt,
                                q.prompt || newTestTitle,
                              )
                              return (
                                <div
                                  key={optIdx}
                                  dir={optLang.dir}
                                  className="flex items-center gap-2"
                                >
                                  <input
                                    type="radio"
                                    name={`correct_${q.id}`}
                                    checked={(q.correctOptionIndex ?? 0) === optIdx}
                                    onChange={() =>
                                      setNewTestQuestions((prev) =>
                                        prev.map((item, i) =>
                                          i === idx ? { ...item, correctOptionIndex: optIdx } : item,
                                        ),
                                      )
                                    }
                                    title="Mark as correct option"
                                  />
                                  <Input
                                    dir={optLang.dir}
                                    lang={optLang.lang}
                                    value={opt}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      setNewTestQuestions((prev) =>
                                        prev.map((item, i) => {
                                          if (i !== idx) return item
                                          const nextOpts = [...(item.options || ['', '', '', ''])]
                                          nextOpts[optIdx] = val
                                          return { ...item, options: nextOpts }
                                        }),
                                      )
                                    }}
                                    placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                                    required
                                    className={cn(
                                      'h-9 text-xs',
                                      optLang.fontClass,
                                      optLang.alignClass,
                                    )}
                                  />
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <Input
                            dir={qExpectedLang.dir}
                            lang={qExpectedLang.lang}
                            value={q.expectedAnswer || ''}
                            onChange={(e) => {
                              const val = e.target.value
                              setNewTestQuestions((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, expectedAnswer: val } : item,
                                ),
                              )
                            }}
                            placeholder="Optional model answer / key for reference during grading..."
                            className={cn(
                              'text-xs',
                              qExpectedLang.fontClass,
                              qExpectedLang.alignClass,
                            )}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addQuestionRow('mcq')}
                      className="rounded-full text-xs"
                    >
                      <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
                      Add Multiple-Choice (MCQ)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addQuestionRow('objective')}
                      className="rounded-full text-xs"
                    >
                      <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
                      Add Objective (Typed Answer)
                    </Button>
                  </div>

                  <Button
                    type="submit"
                    className="rounded-full bg-[#0095F6] font-semibold text-white hover:bg-[#0077CC]"
                  >
                    Publish Test to Class {normClass}
                  </Button>
                </div>
              </form>
            )}

            {/* Grading Section */}
            {activeGradingTest && (
              <div className="space-y-4 rounded-2xl bg-muted/40 p-4 sm:p-5">
                <div className="flex flex-col justify-between gap-3 border-b border-border/40 pb-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">
                      Evaluate Student Submissions
                    </p>
                    <h5
                      dir={getMultilingualTextProps(activeGradingTest.title).dir}
                      className={cn(
                        'text-lg font-bold text-foreground',
                        getMultilingualTextProps(activeGradingTest.title).isRtl
                          ? getMultilingualTextProps(activeGradingTest.title).fontClass
                          : 'font-display',
                      )}
                    >
                      {activeGradingTest.title} · {activeGradingTest.subjectOrCategory} (
                      {activeGradingTest.totalMarks} Marks)
                    </h5>
                  </div>
                  <div className="w-full sm:w-72">
                    <ThemeSelect
                      value={activeGradingTest.id}
                      onChange={(e) => setSelectedTestIdForGrading(e.target.value)}
                      aria-label="Select test to grade"
                    >
                      {classTests.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} ({t.totalMarks}M)
                        </option>
                      ))}
                    </ThemeSelect>
                  </div>
                </div>

                {submissionsForActiveTest.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    No student submissions received for this test yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {submissionsForActiveTest.map((sub) => {
                      const questions = activeGradingTest.questions || []
                      const draftQMarks = gradingMarksDraft[sub.id] || sub.questionMarks || {}
                      const liveSum = questions.reduce(
                        (acc, q) => acc + Number(draftQMarks[q.id] ?? 0),
                        0,
                      )
                      const remarksVal = gradingRemarksDraft[sub.id] ?? sub.remarks ?? ''
                      const remarksLang = getMultilingualTextProps(
                        remarksVal,
                        activeGradingTest.title,
                      )

                      return (
                        <div
                          key={sub.id}
                          className="rounded-2xl bg-card p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
                            <div>
                              <h6 className="font-display text-sm font-bold text-foreground">
                                {sub.studentName}{' '}
                                <span className="font-mono text-xs font-normal text-muted-foreground">
                                  ({sub.admissionNo})
                                </span>
                              </h6>
                              <p className="text-[11px] text-muted-foreground tabular-nums">
                                Submitted on {sub.dateString} · Status:{' '}
                                <strong className="uppercase">{sub.status}</strong>
                              </p>
                            </div>
                            <div className="text-right font-mono text-sm font-bold tabular-nums">
                              Total:{' '}
                              <span className="text-emerald-600 dark:text-emerald-400">{liveSum}</span>/
                              {activeGradingTest.totalMarks || 20}
                            </div>
                          </div>

                          <div className="mt-3 space-y-2.5">
                            {questions.map((q, qIdx) => {
                              const rawAns = sub.answers?.[q.id] ?? ''
                              const formattedAns =
                                q.type === 'mcq' && Array.isArray(q.options)
                                  ? q.options[Number(rawAns)]
                                    ? `${String.fromCharCode(65 + Number(rawAns))}. ${q.options[Number(rawAns)]}`
                                    : 'No option selected'
                                  : rawAns || 'No answer typed'
                              const currentMark = Number(draftQMarks[q.id] ?? 0)
                              const qLang = getMultilingualTextProps(
                                q.prompt,
                                activeGradingTest.title,
                              )
                              const ansLang = getMultilingualTextProps(formattedAns, q.prompt)

                              return (
                                <div
                                  key={q.id}
                                  className="flex flex-col justify-between gap-2 rounded-xl bg-muted/45 p-3 text-xs sm:flex-row sm:items-center"
                                >
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <p
                                      dir={qLang.dir}
                                      lang={qLang.lang}
                                      className={cn(
                                        'font-semibold text-foreground',
                                        qLang.fontClass,
                                        qLang.alignClass,
                                      )}
                                    >
                                      <span dir="ltr" className="font-mono text-xs">
                                        Q{qIdx + 1} ({q.type.toUpperCase()} · Max {q.marks}M):{' '}
                                      </span>
                                      {renderMultilingualInline(q.prompt, qLang.isRtl)}
                                    </p>
                                    <p
                                      dir={ansLang.dir}
                                      lang={ansLang.lang}
                                      className={cn(
                                        'text-muted-foreground',
                                        ansLang.fontClass,
                                        ansLang.alignClass,
                                      )}
                                    >
                                      <strong dir="ltr" className="font-poppins text-foreground">
                                        Student Answer:{' '}
                                      </strong>
                                      {renderMultilingualInline(formattedAns, ansLang.isRtl)}
                                    </p>
                                  </div>

                                  <div className="flex shrink-0 items-center gap-2">
                                    <Label className="text-[11px] text-muted-foreground">
                                      Marks (/{q.marks}):
                                    </Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={q.marks}
                                      value={currentMark}
                                      onChange={(e) => {
                                        const val = Number(e.target.value)
                                        setGradingMarksDraft((prev) => ({
                                          ...prev,
                                          [sub.id]: {
                                            ...(prev[sub.id] || sub.questionMarks || {}),
                                            [q.id]: val,
                                          },
                                        }))
                                      }}
                                      className="h-8 w-20 text-xs font-bold tabular-nums"
                                    />
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Input
                              dir={remarksLang.dir}
                              lang={remarksLang.lang}
                              value={remarksVal}
                              onChange={(e) =>
                                setGradingRemarksDraft((prev) => ({
                                  ...prev,
                                  [sub.id]: e.target.value,
                                }))
                              }
                              placeholder="Add Usthad evaluation remarks for this student..."
                              className={cn(
                                'h-9 flex-1 text-xs',
                                remarksLang.fontClass,
                                remarksLang.alignClass,
                              )}
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              {canManageActiveTestResubmit ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void handleToggleStudentResubmitApproval(sub)}
                                  className={cn(
                                    'rounded-full text-xs font-semibold',
                                    sub.acknowledged
                                      ? 'border-amber-500/40 bg-amber-500/12 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300'
                                      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300',
                                  )}
                                >
                                  {sub.acknowledged ? (
                                    <>
                                      <Lock className="mr-1.5 size-3.5" aria-hidden="true" />
                                      Lock Re-submit
                                    </>
                                  ) : (
                                    <>
                                      <Unlock className="mr-1.5 size-3.5" aria-hidden="true" />
                                      Allow Re-submit
                                    </>
                                  )}
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleSaveStudentGrade(sub)}
                                className="rounded-full bg-[#0095F6] text-xs font-semibold text-white hover:bg-[#0077CC]"
                              >
                                <Check className="mr-1.5 size-3.5" aria-hidden="true" />
                                Save &amp; Publish Marks
                              </Button>
                            </div>
                          </div>
                          {!canManageActiveTestResubmit && (
                            <p className="mt-2 text-[11px] text-muted-foreground">
                              Re-submission approval is restricted to {activeGradingTest.actorName || 'Subject Usthad'} or Principal.
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* USTHAD TAB 2: HOLIDAY ACADEMIC & SSF DA'WA / ZIYARAT VERIFICATION */}
        {activeTab === 'holiday' && (
          <div className="mt-5 space-y-4">
            <div>
              <h4 className="font-display text-base font-bold text-foreground">
                Class {normClass} — Student Holiday Academic & SSF Da&apos;wa / Ziyarat Uploads
              </h4>
              <p className="text-xs text-muted-foreground">
                Inspect student holiday study reports, SSF Da&apos;wa activities, and Maqbara Ziyarat logs and verify them.
              </p>
            </div>

            {classHolidayLogs.length === 0 ? (
              <div className="rounded-2xl bg-muted/40 p-6 text-center text-xs text-muted-foreground">
                No holiday Academic or SSF Da&apos;wa logs uploaded by Class {normClass} students yet.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {classHolidayLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-col justify-between rounded-2xl bg-muted/40 p-4"
                  >
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {log.studentName}{' '}
                          <span className="font-mono font-normal text-muted-foreground">
                            ({log.admissionNo})
                          </span>
                        </span>
                        <span
                          className={cn(
                            'text-xs font-bold',
                            log.status === 'verified'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400',
                          )}
                        >
                          {log.status === 'verified' ? '✓ Verified' : '⏳ Pending Review'}
                        </span>
                      </div>

                      <p className="mt-1 text-[11px] font-medium text-muted-foreground tabular-nums">
                        {log.subjectOrCategory} · {log.dateString}
                      </p>
                      <h5 className="mt-1 font-display text-base font-bold text-foreground">
                        {log.title}
                      </h5>
                      <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">
                        {log.description}
                      </p>

                      {log.photoUrl && (
                        <div className="mt-3 overflow-hidden rounded-2xl bg-card">
                          <img
                            src={log.photoUrl}
                            alt={log.title || 'Student activity proof'}
                            className="max-h-52 w-full object-cover"
                          />
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-col gap-2 border-t border-border/40 pt-3 sm:flex-row">
                      <Input
                        value={holidayRemarksDraft[log.id] ?? log.remarks ?? ''}
                        onChange={(e) =>
                          setHolidayRemarksDraft((prev) => ({
                            ...prev,
                            [log.id]: e.target.value,
                          }))
                        }
                        placeholder="Add Usthad appreciation / verification note..."
                        className="h-8 flex-1 text-xs"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleVerifyHolidayLog(log)}
                        className="h-8 rounded-full bg-[#0095F6] px-3.5 text-xs font-semibold text-white hover:bg-[#0077CC]"
                      >
                        <CheckCircle2 className="mr-1.5 size-3.5" aria-hidden="true" />
                        {log.status === 'verified' ? 'Update Note' : 'Verify Activity'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* USTHAD TAB 3: CONFIDENTIAL STUDENT DISCIPLINE NOTES */}
        {activeTab === 'discipline' && (
          <div className="mt-5 grid gap-6 lg:grid-cols-12">
            <form
              onSubmit={handleCreateDisciplineNote}
              className="space-y-4 rounded-2xl bg-muted/40 p-4 sm:p-5 lg:col-span-5"
            >
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-amber-700 uppercase dark:text-amber-400">
                  <Lock className="size-3.5" aria-hidden="true" />
                  Strictly Confidential Student Note
                </p>
                <h4 className="mt-1 font-display text-base font-bold text-foreground">
                  Record Institutional Discipline Violation / Guidance
                </h4>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Visible <strong>ONLY</strong> to the selected student and Usthads/Principal. Other students can never see this note.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Target Student (Class {normClass})</Label>
                <ThemeSelect
                  value={disciplineStudentId}
                  onChange={(e) => setDisciplineStudentId(e.target.value)}
                  aria-label="Select target student for confidential discipline note"
                >
                  {classStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.admissionNo})
                    </option>
                  ))}
                </ThemeSelect>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Severity Level</Label>
                <ThemeSelect
                  value={disciplineSeverity}
                  onChange={(e) =>
                    setDisciplineSeverity(
                      e.target.value as 'advisory' | 'warning' | 'serious',
                    )
                  }
                  aria-label="Select discipline severity level"
                >
                  <option value="advisory">Advisory / Gentle Reminder</option>
                  <option value="warning">Formal Warning</option>
                  <option value="serious">Serious Institutional Violation</option>
                </ThemeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="disc-title" className="text-xs">
                  Incident / Discipline Subject
                </Label>
                <Input
                  id="disc-title"
                  value={disciplineTitle}
                  onChange={(e) => setDisciplineTitle(e.target.value)}
                  placeholder="e.g., Late arrival to Fajr Jama'ah / Dress code reminder"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="disc-desc" className="text-xs">
                  Details of Observation
                </Label>
                <textarea
                  id="disc-desc"
                  rows={3}
                  value={disciplineDesc}
                  onChange={(e) => setDisciplineDesc(e.target.value)}
                  placeholder="Describe the disciplinary observation privately..."
                  required
                  className="w-full rounded-2xl border-0 bg-popover px-3.5 py-2.5 text-xs text-foreground outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="disc-advice" className="text-xs">
                  Corrective Advice from Usthad
                </Label>
                <Input
                  id="disc-advice"
                  value={disciplineAdvice}
                  onChange={(e) => setDisciplineAdvice(e.target.value)}
                  placeholder="e.g., Maintain punctuality and report to Class Usthad tomorrow."
                />
              </div>

              <Button
                type="submit"
                className="w-full rounded-full bg-amber-500 font-semibold text-white hover:bg-amber-600"
              >
                <Lock className="mr-2 size-4" aria-hidden="true" />
                Save Private Note for Selected Student Only
              </Button>
            </form>

            <div className="space-y-3 lg:col-span-7">
              <h4 className="font-display text-base font-bold text-foreground">
                Confidential Discipline Log — Class {normClass} ({classDisciplineNotes.length})
              </h4>

              {classDisciplineNotes.length === 0 ? (
                <div className="rounded-2xl bg-muted/40 p-6 text-center text-xs text-muted-foreground">
                  No confidential discipline notes recorded for Class {normClass}.
                </div>
              ) : (
                <div className="space-y-3">
                  {classDisciplineNotes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-2xl bg-muted/40 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-display text-sm font-bold text-foreground">
                            {note.studentName}{' '}
                            <span className="font-mono text-xs font-normal text-muted-foreground">
                              ({note.admissionNo})
                            </span>
                          </span>
                          <p className="text-[11px] text-muted-foreground tabular-nums">
                            {note.status.toUpperCase()} · {note.dateString} · By {note.actorName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'text-xs font-semibold',
                              note.acknowledged
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-700 dark:text-amber-400',
                            )}
                          >
                            {note.acknowledged ? '✓ Acknowledged by Student' : 'Unread by Student'}
                          </span>
                          <DeleteActionMenu
                            ariaLabel={`Options for ${note.title}`}
                            onConfirmDelete={() => handleDeleteDisciplineNote(note)}
                          />
                        </div>
                      </div>
                      <h5 className="mt-2 font-display text-sm font-bold text-foreground">
                        {note.title}
                      </h5>
                      <p className="mt-1 text-xs text-muted-foreground">{note.description}</p>
                      {note.remarks && (
                        <p className="mt-1.5 text-xs text-foreground">
                          <strong className="text-[#0077CC] dark:text-[#0095F6]">
                            Corrective Advice:
                          </strong>{' '}
                          {note.remarks}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* USTHAD / PRINCIPAL TAB 4: ZADUL KHAIR (زاد الخير) VOLUNTARY CLASS LEDGER & PDF GENERATOR */}
        {activeTab === 'zadul_khair' && (
          <div className="mt-5">
            <ClassZadulKhairManager
              className={normClass}
              selectedMonth={selectedMonth}
              onSelectMonth={setSelectedMonth}
              records={records}
              actorId={actorId}
              actorName={actorName}
              actorRoleLabel={role === 'principal' ? 'Principal' : 'Usthad'}
              onNotify={setToastMessage}
            />
          </div>
        )}
      </Panel>
    </section>
  )
}
