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
  Trash2,
  Trophy,
  Upload,
  UserCheck,
} from 'lucide-react'
import {
  HOLIDAY_ACTIVITY_CATEGORIES,
  ZADUL_KHAIR_DEFAULT_FIXED_AMOUNT,
  calculateClassStarOfTheMonth,
  compressImageFileToDataUrl,
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
  MONTHS_META,
  doesUsthadMatchTeacherName,
  findUsthadForTeacherName,
  getClassSemesterTimetableByClassName,
  getUsthadScheduledPeriodsAcrossClasses,
  normalizeClassName,
  publishCampusNotification,
  students,
  type ClassUsthad,
  type Student,
} from '@/components/dashboard/data'
import { Panel } from '@/components/dashboard/panel'
import { ProfileInitialsAvatar } from '@/components/dashboard/student-switcher'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeSelect } from '@/components/ui/theme-select'
import { cn } from '@/lib/utils'

function formatTodayDateDisplay(): string {
  return new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
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
    <div className="relative overflow-hidden rounded-2xl border border-emerald-600/25 bg-gradient-to-br from-card via-[#F3FAF5] to-[#E8F5EC] p-5 text-foreground shadow-sm transition-colors duration-300 sm:p-6 dark:border-lime/35 dark:from-[#081E21] dark:via-[#0B272B] dark:to-[#071619] dark:text-white dark:shadow-lg">
      <div className="flex flex-col justify-between gap-4 border-b border-border/80 pb-4 sm:flex-row sm:items-center dark:border-white/10">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.18em] text-emerald-700 uppercase dark:text-lime">
            <Trophy className="size-3.5 text-emerald-600 dark:text-lime" aria-hidden="true" />
            Star of the Month · Class {summary.className}
          </p>
          <h3 className="mt-1 font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl dark:text-white">
            {summary.monthLabel} Academic & Attendance Excellence
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground dark:text-slate-300">
            Automatically selected from Monthly/Unit Test Marks (70% weight) + Monthly Attendance (30% weight)
          </p>
        </div>

        {onSelectMonth && (
          <div className="w-full sm:w-48">
            <ThemeSelect
              value={monthId}
              onChange={(e) => onSelectMonth(e.target.value)}
              aria-label="Select Star of the Month period"
              className="border-border bg-background/90 text-xs text-foreground dark:border-white/20 dark:bg-white/10 dark:text-white"
            >
              {MONTHS_META.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.month} {m.year}
                </option>
              ))}
            </ThemeSelect>
          </div>
        )}
      </div>

      {winner ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-12 lg:items-center">
          <div className="flex items-center gap-4 lg:col-span-7">
            <div className="relative shrink-0">
              <ProfileInitialsAvatar
                name={winner.student.name}
                avatarUrl={winner.student.avatarUrl}
                className="size-16 ring-2 ring-emerald-600/45 shadow-md sm:size-20 dark:ring-lime"
              />
              <span className="absolute -bottom-1.5 -right-1.5 flex size-7 items-center justify-center rounded-full bg-lime text-slate-950 shadow">
                <Crown className="size-4" aria-hidden="true" />
              </span>
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold text-emerald-700 dark:text-lime">
                #1 Ranked Performer · {winner.student.admissionNo}
              </p>
              <h4 className="truncate font-display text-xl font-bold text-foreground sm:text-2xl dark:text-white">
                {winner.student.name}
              </h4>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums dark:text-slate-300">
                Composite Score:{' '}
                <strong className="text-emerald-700 dark:text-lime">
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

          <div className="border-t border-border/80 pt-4 lg:col-span-5 lg:border-t-0 lg:border-l lg:pl-5 lg:pt-0 dark:border-white/10">
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase dark:text-slate-300">
              Class Top Performers ({summary.className})
            </p>
            <div className="mt-2.5 divide-y divide-border/70 dark:divide-white/10">
              {summary.allRankings.slice(0, 3).map((item) => (
                <div
                  key={item.student.id}
                  className="flex items-center justify-between gap-2 py-1.5 text-xs"
                >
                  <span className="truncate font-medium text-foreground dark:text-white">
                    <span className="mr-2 font-mono font-bold text-emerald-700 tabular-nums dark:text-lime">
                      #{item.rank}
                    </span>
                    {item.student.name}
                  </span>
                  <span className="shrink-0 font-mono text-muted-foreground tabular-nums dark:text-slate-300">
                    Test {item.testPercentage}% · Att {item.attendancePercentage}% ·{' '}
                    <strong className="text-emerald-700 dark:text-lime">
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
    const f = ansFrom || 'ഒന്നാം അദ്ധ്യായം'
    const t = ansTo || 'നിശ്ചയിച്ച അദ്ധ്യായം'
    return {
      fromChapter: f,
      toChapter: t,
      formattedRange: `${f} മുതൽ ${t} വരെ`,
    }
  }

  const raw = (row.subjectOrCategory || '').trim()
  if (raw.includes(' മുതൽ ')) {
    const [left, rightRaw] = raw.split(' മുതൽ ')
    const right = (rightRaw || '').replace(/\s*വരെ$/, '').trim()
    return {
      fromChapter: left.trim() || 'ഒന്നാം അദ്ധ്യായം',
      toChapter: right || 'നിശ്ചയിച്ച അദ്ധ്യായം',
      formattedRange: raw,
    }
  }

  return {
    fromChapter: raw || 'ഒന്നാം അദ്ധ്യായം (Starting Chapter)',
    toChapter: 'നിശ്ചയിച്ച അദ്ധ്യായം (Ending Chapter)',
    formattedRange: raw || 'അദ്ധ്യായം രേഖപ്പെടുത്തിയിട്ടില്ല',
  }
}

export function formatSyllabusChapterRange(fromChapter: string, toChapter: string): string {
  const f = fromChapter.trim() || 'ഒന്നാം അദ്ധ്യായം'
  const t = toChapter.trim() || 'നിശ്ചയിച്ച അദ്ധ്യായം'
  return `${f} മുതൽ ${t} വരെ`.slice(0, 120)
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

  // Ensure every timetable period has a syllabus tracker row for this month
  semTimetable.semester1.forEach((slot, pIdx) => {
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

    // Fallback to November 2026 chapter template if switching months
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
          fromChapter: 'ഒന്നാം അദ്ധ്യായം (Chapter 1)',
          toChapter: 'മൂന്നാം അദ്ധ്യായം (Chapter 3)',
          formattedRange: 'ഒന്നാം അദ്ധ്യായം (Chapter 1) മുതൽ മൂന്നാം അദ്ധ്യായം (Chapter 3) വരെ',
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
  const scheduledSlots = getUsthadScheduledPeriodsAcrossClasses(usthad, 1)
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
  const [newKitabUsthadId, setNewKitabUsthadId] = useState<string>(CLASS_USTHADS[0]?.id || 'usthad-09')
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

  // PDF Export loading state
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null)

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
      const fromChapter =
        (draft?.fromChapter ?? existingRange.fromChapter).trim() || 'ഒന്നാം അദ്ധ്യായം'
      const toChapter =
        (draft?.toChapter ?? existingRange.toChapter).trim() || 'നിശ്ചയിച്ച അദ്ധ്യായം'
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

      const updatedRecord: CampusAcademicRecord = {
        ...row,
        className: normClass,
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

      publishCampusNotification({
        type: 'notice',
        title: `ജാമിഅതുൽ ഹിന്ദ് സിലബസ് അപ്ഡേറ്റ് • Class ${normClass}`,
        message: `${student.name} (Class Leader) updated "${row.title}" (${row.studentName}): "${fromChapter}" മുതൽ "${toChapter}" വരെ — ആകെ ${totalPages} പേജ്, എടുത്തത് ${completedPages} പേജ്, ബാക്കി ${remainingPages} പേജ്.`,
        targetClass: normClass,
        targetStaffOnly: true,
        actorId: student.id,
        actorName: `${student.name} (Class Leader)`,
        href: '#academic-hub',
      })

      setStatusBanner(
        `✅ "${row.title}" ജാമിഅതുൽ ഹിന്ദ് സിലബസ് (${fromChapter} മുതൽ ${toChapter} വരെ) സേവ് ചെയ്ത് ${row.studentName}-നെ അറിയിച്ചു! (ആകെ: ${totalPages} പേജ് · എടുത്തത്: ${completedPages} · ബാക്കി: ${remainingPages} പേജ്)`,
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
      CLASS_USTHADS.find((u) => u.id === newKitabUsthadId) || CLASS_USTHADS[0]
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
      description: `Jamiathul Hind Monthly Syllabus target for Class ${normClass}.`,
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
      title: `പുതിയ കിതാബ് സിലബസ് • Class ${normClass}`,
      message: `${student.name} (Class Leader) added "${customRecord.title}" for ${matchedUsthad.name}: "${fromChapter}" മുതൽ "${toChapter}" വരെ (${totalPages} പേജ്, ബാക്കി ${remainingPages} പേജ്).`,
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
      `✅ പുതിയ കിതാബ് "${customRecord.title}" (${fromChapter} മുതൽ ${toChapter} വരെ) ചേർത്തു, ${matchedUsthad.name}-ന് അറിയിപ്പ് അയച്ചു!`,
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

  const currentMonthZadulKhair: CampusAcademicRecord = useMemo(() => {
    const found = myZadulKhairRecords.find((r) => r.month === selectedMonth)
    if (found) return found
    const mMeta = MONTHS_META.find((m) => m.id === selectedMonth)
    return {
      id: `zk_${selectedMonth}_${student.id}`,
      campusId: 'ics-academy',
      recordKind: 'zadul_khair',
      className: student.className,
      studentId: student.id,
      studentName: student.name,
      admissionNo: student.admissionNo,
      month: selectedMonth,
      title: 'Zadul Khair (زاد الخير) Monthly Household Contribution',
      subjectOrCategory: mMeta ? `${mMeta.month} ${mMeta.year}` : selectedMonth,
      status: 'unpaid',
      actorId: student.id,
      actorName: 'Class Usthad',
      dateString: formatTodayDateDisplay(),
      receiptNo: `ZK-${selectedMonth.replace('-', '')}-${student.admissionNo.slice(-4)}`,
      fixedAmount: ZADUL_KHAIR_DEFAULT_FIXED_AMOUNT,
      paidAmount: 0,
      isDeleted: false,
      updatedAtMs: Date.now(),
    }
  }, [myZadulKhairRecords, selectedMonth, student])

  async function handleSubmitUnitTest() {
    if (!currentTest) return
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

  async function handleExportMyZadulKhairPdf(mode: 'download' | 'print') {
    setPdfBusyId(`${currentMonthZadulKhair.id}_${mode}`)
    try {
      await exportStudentZadulKhairReceiptPdf({
        student,
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
        title="Jamiathul Hind Syllabus, Monthly Tests, Holiday Da'wa & Zadul Khair"
        eyebrow={`Class ${student.className} · ${student.name}${isClassLeader ? ' (Class Leader)' : ''}`}
        icon={Trophy}
      >
        {/* Tab Bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
          <button
            type="button"
            onClick={() => {
              setActiveTab('syllabus')
              setStatusBanner(null)
            }}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors',
              activeTab === 'syllabus'
                ? 'bg-lime text-slate-950 shadow-sm'
                : 'border border-border bg-background/60 text-muted-foreground hover:text-foreground',
            )}
          >
            <BookOpen className="size-3.5" aria-hidden="true" />
            <span>
              Jamiathul Hind Syllabus ({classSyllabusRows.length})
              {isClassLeader ? ' • ക്ലാസ്സ് ലീഡർ അപ്ഡേഷൻ' : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('tests')
              setStatusBanner(null)
            }}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors',
              activeTab === 'tests'
                ? 'bg-lime text-slate-950 shadow-sm'
                : 'border border-border bg-background/60 text-muted-foreground hover:text-foreground',
            )}
          >
            <ClipboardCheck className="size-3.5" aria-hidden="true" />
            <span>Monthly / Unit Tests ({classUnitTests.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('holiday')
              setStatusBanner(null)
            }}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors',
              activeTab === 'holiday'
                ? 'bg-lime text-slate-950 shadow-sm'
                : 'border border-border bg-background/60 text-muted-foreground hover:text-foreground',
            )}
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>Holiday & SSF Da&apos;wa / Ziyarat ({myHolidayLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('zadul_khair')
              setStatusBanner(null)
            }}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors',
              activeTab === 'zadul_khair'
                ? 'bg-lime text-slate-950 shadow-sm'
                : 'border border-border bg-background/60 text-muted-foreground hover:text-foreground',
            )}
          >
            <HeartHandshake className="size-3.5" aria-hidden="true" />
            <span>Zadul Khair (زاد الخير) & PDF</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('discipline')
              setStatusBanner(null)
            }}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors',
              activeTab === 'discipline'
                ? 'bg-lime text-slate-950 shadow-sm'
                : 'border border-border bg-background/60 text-muted-foreground hover:text-foreground',
            )}
          >
            <Lock className="size-3.5" aria-hidden="true" />
            <span>Private Usthad Advisory</span>
            {unacknowledgedDisciplineCount > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white tabular-nums">
                {unacknowledgedDisciplineCount}
              </span>
            )}
          </button>
        </div>

        {statusBanner && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-lime/40 bg-lime/10 px-4 py-3 text-xs font-medium text-foreground">
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
            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-emerald-600/25 bg-emerald-500/[0.06] p-4 sm:flex-row sm:items-center sm:p-5 dark:border-lime/30 dark:bg-lime/[0.06]">
              <div>
                <p className="text-xs font-bold tracking-wider text-emerald-700 uppercase dark:text-lime">
                  ജാമിഅതുൽ ഹിന്ദ് മാസ സിലബസ് · Jamiathul Hind Monthly Syllabus Updation
                </p>
                <h4 className="mt-1 font-display text-lg font-bold text-foreground sm:text-xl">
                  Class {normClass} — കിതാബുകളും അദ്ധ്യായങ്ങളും (മുതൽ – വരെ) പേജ് കണക്കും
                </h4>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isClassLeader
                    ? 'ക്ലാസ്സ് ലീഡർക്ക് ജാമിഅതുൽ ഹിന്ദ് നിശ്ചയിച്ച പ്രകാരം ഏത് അദ്ധ്യായം മുതൽ ഏത് അദ്ധ്യായം വരെ എടുക്കണം, എത്ര പേജാണ് എടുക്കേണ്ടത്, എത്ര പേജ് എടുത്തു എന്നിവ രേഖപ്പെടുത്തി ഉസ്താദുമാരെ അറിയിക്കാം.'
                    : 'ജാമിഅതുൽ ഹിന്ദ് നിശ്ചയിച്ച പ്രകാരം ഓരോ കിതാബിലും ഏത് അദ്ധ്യായം മുതൽ ഏത് അദ്ധ്യായം വരെ എടുക്കണം എന്നും പേജ് കണക്കും താഴെ കാണാം.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="w-44">
                  <ThemeSelect
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    aria-label="Select Syllabus Month"
                  >
                    {MONTHS_META.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.month} {m.year}
                      </option>
                    ))}
                  </ThemeSelect>
                </div>
                {isClassLeader && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowAddKitabForm((v) => !v)}
                    className="rounded-xl bg-lime text-xs font-semibold text-slate-950 hover:bg-lime/90"
                  >
                    <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
                    {showAddKitabForm ? 'Close Form' : 'Add Kitab / Subject'}
                  </Button>
                )}
              </div>
            </div>

            {/* 3-Box Summary KPI Strip */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-background/60 p-4">
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  ആകെ എടുക്കേണ്ട പേജുകൾ (Total Target Pages)
                </p>
                <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
                  {classSyllabusTotals.totalTarget}{' '}
                  <span className="text-xs font-normal text-muted-foreground">Pages</span>
                </p>
              </div>

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-[11px] font-semibold tracking-wider text-emerald-700 uppercase dark:text-lime">
                  ഇതുവരെ എടുത്ത പേജുകൾ (Completed Pages)
                </p>
                <p className="mt-1 font-display text-2xl font-bold text-emerald-700 tabular-nums dark:text-lime">
                  {classSyllabusTotals.totalCompleted}{' '}
                  <span className="text-xs font-normal opacity-80">Pages Completed</span>
                </p>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-[11px] font-semibold tracking-wider text-amber-800 uppercase dark:text-amber-300">
                  ഇനി എടുക്കാനുള്ള പേജുകൾ (Remaining Pages)
                </p>
                <p className="mt-1 font-display text-2xl font-bold text-amber-700 tabular-nums dark:text-amber-300">
                  {classSyllabusTotals.totalRemaining}{' '}
                  <span className="text-xs font-normal opacity-80">Pages Remaining</span>
                </p>
              </div>
            </div>

            {/* Class Leader Add Custom Kitab Form */}
            {isClassLeader && showAddKitabForm && (
              <form
                onSubmit={handleClassLeaderAddCustomKitab}
                className="space-y-4 rounded-2xl border border-lime/40 bg-background/80 p-4 sm:p-5"
              >
                <h5 className="font-display text-sm font-bold text-foreground">
                  പുതിയ കിതാബ് / വിഷയം ചേർക്കുക (Add Kitab to Class {normClass} Monthly Syllabus)
                </h5>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">കിതാബ് / വിഷയം (Kitab / Subject Name) *</Label>
                    <Input
                      value={newKitabName}
                      onChange={(e) => setNewKitabName(e.target.value)}
                      placeholder="e.g., Fath al-Mu'in / Minhaj"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">വിഷയം എടുക്കുന്ന ഉസ്താദ് (Teaching Usthad) *</Label>
                    <ThemeSelect
                      value={newKitabUsthadId}
                      onChange={(e) => setNewKitabUsthadId(e.target.value)}
                      aria-label="Select Teaching Usthad"
                    >
                      {CLASS_USTHADS.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.staffId})
                        </option>
                      ))}
                    </ThemeSelect>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">പിരീഡ് (Period Label)</Label>
                    <Input
                      value={newKitabPeriodLabel}
                      onChange={(e) => setNewKitabPeriodLabel(e.target.value)}
                      placeholder="e.g., Period 6 / Extra Kitab"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-emerald-700 dark:text-lime">
                      ഏത് അദ്ധ്യായം മുതൽ (From Chapter) *
                    </Label>
                    <Input
                      value={newKitabFromChapter}
                      onChange={(e) => setNewKitabFromChapter(e.target.value)}
                      placeholder="തുടങ്ങേണ്ട അദ്ധ്യായം..."
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-emerald-700 dark:text-lime">
                      ഏത് അദ്ധ്യായം വരെ (Up to Chapter) *
                    </Label>
                    <Input
                      value={newKitabToChapter}
                      onChange={(e) => setNewKitabToChapter(e.target.value)}
                      placeholder="അവസാനിക്കേണ്ട അദ്ധ്യായം..."
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">എത്ര പേജാണ് എടുക്കേണ്ടത് (Target Pages)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={1000}
                      value={newKitabTotalPages}
                      onChange={(e) => setNewKitabTotalPages(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">എത്ര പേജ് എടുത്തു (Completed Pages)</Label>
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
                    className="rounded-xl bg-lime text-xs font-semibold text-slate-950 hover:bg-lime/90"
                  >
                    <Send className="mr-1.5 size-3.5" aria-hidden="true" />
                    സേവ് ചെയ്ത് ഉസ്താദിനെ അറിയിക്കുക (Save & Notify Usthad)
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

                return (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-border bg-background/60 p-4 sm:p-5"
                  >
                    <div className="flex flex-col justify-between gap-3 border-b border-border/70 pb-3.5 sm:flex-row sm:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg border border-emerald-600/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-700 dark:border-lime/30 dark:bg-lime/10 dark:text-lime">
                            {row.admissionNo || 'Period'}
                          </span>
                          <span className="text-xs font-semibold text-muted-foreground">
                            ഉസ്താദ്: <strong className="text-foreground">{row.studentName}</strong>
                          </span>
                        </div>
                        <h5 className="mt-1.5 font-display text-base font-bold text-foreground sm:text-lg">
                          {row.title}
                        </h5>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums">
                        <div className="rounded-xl border border-border bg-card px-3 py-1.5">
                          <span className="text-muted-foreground">എടുക്കേണ്ടത്: </span>
                          <strong className="font-mono text-sm text-foreground">
                            {totalPagesVal}p
                          </strong>
                        </div>
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
                          <span className="text-emerald-700 dark:text-lime">എടുത്തത്: </span>
                          <strong className="font-mono text-sm text-emerald-700 dark:text-lime">
                            {completedPagesVal}p
                          </strong>
                        </div>
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
                          <span className="text-amber-800 dark:text-amber-300">ഇനി ബാക്കി: </span>
                          <strong className="font-mono text-sm text-amber-700 dark:text-amber-300">
                            {remainingPagesVal}p
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Jamiathul Hind Chapter Range Box (ഏത് അദ്ധ്യായം മുതൽ → ഏത് അദ്ധ്യായം വരെ) */}
                    <div className="mt-3 grid gap-2.5 rounded-xl border border-emerald-600/20 bg-emerald-500/[0.04] p-3 sm:grid-cols-2 dark:border-lime/25 dark:bg-lime/[0.04]">
                      <div>
                        <span className="block text-[10px] font-bold tracking-wider text-emerald-700 uppercase dark:text-lime">
                          ഏത് അദ്ധ്യായം മുതൽ (From Chapter)
                        </span>
                        <p className="mt-0.5 text-xs font-semibold text-foreground">
                          {fromChapterVal || 'രേഖപ്പെടുത്തിയിട്ടില്ല'}
                        </p>
                      </div>
                      <div className="border-t border-border/60 pt-2 sm:border-t-0 sm:border-l sm:pl-3 sm:pt-0">
                        <span className="block text-[10px] font-bold tracking-wider text-emerald-700 uppercase dark:text-lime">
                          ഏത് അദ്ധ്യായം വരെ (Up to Chapter)
                        </span>
                        <p className="mt-0.5 text-xs font-semibold text-foreground">
                          {toChapterVal || 'രേഖപ്പെടുത്തിയിട്ടില്ല'}
                        </p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                        <span>
                          ജാമിഅതുൽ ഹിന്ദ് സിലബസ് പുരോഗതി (Monthly Page Progress)
                        </span>
                        <span className="font-mono font-semibold text-emerald-700 dark:text-lime">
                          {progressPct}% Completed ({completedPagesVal}/{totalPagesVal} Pages)
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-600 transition-all duration-300 dark:bg-lime"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    {isClassLeader ? (
                      <div className="mt-4 space-y-3 border-t border-border/60 pt-3.5">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-emerald-700 dark:text-lime">
                              ഏത് അദ്ധ്യായം മുതൽ (From Chapter — തുടങ്ങേണ്ട അദ്ധ്യായം)
                            </Label>
                            <Input
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
                              placeholder="ഏത് അദ്ധ്യായം മുതൽ..."
                              className="h-9 text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-emerald-700 dark:text-lime">
                              ഏത് അദ്ധ്യായം വരെ (Up to Chapter — അവസാനിക്കേണ്ട അദ്ധ്യായം)
                            </Label>
                            <Input
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
                              placeholder="ഏത് അദ്ധ്യായം വരെ..."
                              className="h-9 text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-12 sm:items-end">
                          <div className="space-y-1 sm:col-span-4">
                            <Label className="text-[11px] text-muted-foreground">
                              എത്ര പേജാണ് എടുക്കേണ്ടത് (Target Pages)
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
                            <Label className="text-[11px] text-emerald-700 dark:text-lime">
                              എത്ര പേജ് എടുത്തു (Completed Pages)
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
                              className="h-9 w-full rounded-xl bg-lime text-xs font-semibold text-slate-950 hover:bg-lime/90"
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
              <div className="rounded-xl border border-border bg-background/50 p-6 text-center text-sm text-muted-foreground">
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
                  <div className="rounded-2xl border border-border bg-background/60 p-4 sm:p-6">
                    <div className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground tabular-nums">
                          {currentTest.subjectOrCategory} · {currentTest.dateString} · Conducted by{' '}
                          {currentTest.actorName}
                        </p>
                        <h4 className="mt-1 font-display text-lg font-bold text-foreground sm:text-xl">
                          {currentTest.title}
                        </h4>
                        {currentTest.description && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {currentTest.description}
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
                              <span className="text-emerald-700 dark:text-lime">
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

                    {currentSubmission?.remarks && (
                      <div className="mt-4 rounded-xl border border-lime/40 bg-lime/10 p-3.5 text-xs">
                        <p className="font-bold text-foreground">Usthad Evaluation Remarks:</p>
                        <p className="mt-1 text-muted-foreground">{currentSubmission.remarks}</p>
                      </div>
                    )}

                    {/* Questions List */}
                    <div className="mt-5 space-y-5">
                      {(currentTest.questions || []).map((q, qIndex) => {
                        const studentAns = draftAnswers[q.id] ?? ''
                        const awardedMarks = currentSubmission?.questionMarks?.[q.id]

                        return (
                          <div
                            key={q.id}
                            className="rounded-xl border border-border bg-card/70 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-semibold text-foreground">
                                <span className="mr-2 font-mono text-xs font-bold text-emerald-700 tabular-nums dark:text-lime">
                                  Q{qIndex + 1}.
                                </span>
                                {q.prompt}
                              </p>
                              <span className="shrink-0 font-mono text-xs font-semibold text-muted-foreground tabular-nums">
                                {typeof awardedMarks === 'number'
                                  ? `${awardedMarks}/${q.marks} Marks`
                                  : `${q.marks} Marks`}
                              </span>
                            </div>

                            {q.type === 'mcq' && Array.isArray(q.options) ? (
                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                {q.options.map((optText, optIdx) => {
                                  const isSelected = studentAns === String(optIdx)
                                  const showCorrect =
                                    currentSubmission?.status === 'graded' &&
                                    q.correctOptionIndex === optIdx
                                  return (
                                    <button
                                      key={`${q.id}_opt_${optIdx}`}
                                      type="button"
                                      onClick={() =>
                                        setDraftAnswers((prev) => ({
                                          ...prev,
                                          [q.id]: String(optIdx),
                                        }))
                                      }
                                      className={cn(
                                        'flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left text-xs transition-all',
                                        isSelected
                                          ? 'border-lime bg-lime/15 font-semibold text-foreground'
                                          : 'border-border bg-background/60 text-muted-foreground hover:text-foreground',
                                        showCorrect && 'ring-1 ring-emerald-500/60',
                                      )}
                                    >
                                      <span>
                                        <strong className="mr-2 font-mono">
                                          {String.fromCharCode(65 + optIdx)}.
                                        </strong>
                                        {optText}
                                      </span>
                                      {isSelected && (
                                        <CheckCircle2
                                          className="size-4 shrink-0 text-emerald-700 dark:text-lime"
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
                                  Type Your Answer (Objective / Short-Answer):
                                </Label>
                                <textarea
                                  id={`ans_${q.id}`}
                                  rows={3}
                                  value={studentAns}
                                  onChange={(e) =>
                                    setDraftAnswers((prev) => ({
                                      ...prev,
                                      [q.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Type your clear answer here..."
                                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-lime"
                                />
                                {currentSubmission?.status === 'graded' && q.expectedAnswer && (
                                  <p className="text-[11px] text-muted-foreground">
                                    <strong className="text-foreground">Model Key:</strong>{' '}
                                    {q.expectedAnswer}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                      <p className="text-xs text-muted-foreground">
                        {currentSubmission
                          ? `Last submitted on ${currentSubmission.dateString}. You can update and resubmit if needed.`
                          : 'Verify all MCQ selections and typed answers before submitting.'}
                      </p>
                      <Button
                        type="button"
                        disabled={isSubmittingTest}
                        onClick={handleSubmitUnitTest}
                        className="rounded-xl bg-lime font-semibold text-slate-950 hover:bg-lime/90"
                      >
                        <Send className="mr-2 size-4" aria-hidden="true" />
                        {isSubmittingTest
                          ? 'Submitting...'
                          : currentSubmission
                            ? 'Update & Resubmit Answers'
                            : 'Submit Test Answers'}
                      </Button>
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
              className="space-y-4 rounded-2xl border border-border bg-background/60 p-4 sm:p-5 lg:col-span-5"
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
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-lime"
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
                    className="rounded-xl text-xs"
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
                      className="rounded-xl text-xs text-red-500"
                    >
                      Remove Photo
                    </Button>
                  )}
                </div>
                {holidayPhotoUrl && (
                  <div className="overflow-hidden rounded-xl border border-border">
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
                className="w-full rounded-xl bg-lime font-semibold text-slate-950 hover:bg-lime/90"
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
                <div className="rounded-2xl border border-border bg-background/50 p-6 text-center text-xs text-muted-foreground">
                  You have not uploaded any holiday Academic, SSF Da&apos;wa, or Ziyarat logs yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {myHolidayLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-2xl border border-border bg-background/60 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground tabular-nums">
                          {log.subjectOrCategory} · {log.dateString}
                        </p>
                        <span
                          className={cn(
                            'text-xs font-bold',
                            log.status === 'verified'
                              ? 'text-emerald-700 dark:text-lime'
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
                        <div className="mt-3 overflow-hidden rounded-xl border border-border">
                          <img
                            src={log.photoUrl}
                            alt={log.title || 'Holiday proof'}
                            className="max-h-56 w-full object-cover"
                          />
                        </div>
                      )}

                      {log.remarks && (
                        <p className="mt-3 border-t border-border/70 pt-2.5 text-xs text-foreground">
                          <strong className="text-emerald-700 dark:text-lime">Usthad Note:</strong>{' '}
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

        {/* TAB 3: ZADUL KHAIR (زاد الخير) PERSONAL HOUSEHOLD LEDGER & OFFICIAL PDF */}
        {activeTab === 'zadul_khair' && (
          <div className="mt-5 space-y-5">
            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-background/60 p-4 sm:flex-row sm:items-center sm:p-5">
              <div>
                <p className="text-xs font-semibold tracking-wider text-emerald-700 uppercase dark:text-lime">
                  زاد الخير · Zadul Khair Household Contribution
                </p>
                <h4 className="mt-1 font-display text-lg font-bold text-foreground sm:text-xl">
                  {student.name} ({student.admissionNo})
                </h4>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Private household monthly contribution statement & official computerized receipt PDF.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={pdfBusyId !== null}
                  onClick={() => handleExportMyZadulKhairPdf('download')}
                  className="rounded-xl bg-lime text-xs font-semibold text-slate-950 hover:bg-lime/90"
                >
                  <Download className="mr-1.5 size-3.5" aria-hidden="true" />
                  {pdfBusyId?.endsWith('_download')
                    ? 'Preparing PDF...'
                    : 'Download Official Receipt PDF'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pdfBusyId !== null}
                  onClick={() => handleExportMyZadulKhairPdf('print')}
                  className="rounded-xl text-xs"
                >
                  <Printer className="mr-1.5 size-3.5" aria-hidden="true" />
                  Print Receipt
                </Button>
              </div>
            </div>

            {/* 3 Financial KPI Cards */}
            <div className="grid gap-3.5 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-background/60 p-4">
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Monthly Fixed Contribution
                </p>
                <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
                  ₹{(currentMonthZadulKhair.fixedAmount ?? ZADUL_KHAIR_DEFAULT_FIXED_AMOUNT).toLocaleString('en-IN')}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Receipt No: {currentMonthZadulKhair.receiptNo || '-'}
                </p>
              </div>

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-[11px] font-semibold tracking-wider text-emerald-700 uppercase dark:text-lime">
                  Paid Amount ({currentMonthZadulKhair.month})
                </p>
                <p className="mt-1 font-display text-2xl font-bold text-emerald-700 tabular-nums dark:text-lime">
                  ₹{(currentMonthZadulKhair.paidAmount ?? 0).toLocaleString('en-IN')}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Status:{' '}
                  <strong className="uppercase">{currentMonthZadulKhair.status}</strong> ·{' '}
                  {currentMonthZadulKhair.dateString}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-background/60 p-4">
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Remaining Balance
                </p>
                <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
                  ₹
                  {Math.max(
                    0,
                    (currentMonthZadulKhair.fixedAmount ?? ZADUL_KHAIR_DEFAULT_FIXED_AMOUNT) -
                      (currentMonthZadulKhair.paidAmount ?? 0),
                  ).toLocaleString('en-IN')}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Updated by {currentMonthZadulKhair.actorName}
                </p>
              </div>
            </div>

            {/* Personal Ledger Table */}
            <div className="overflow-x-auto rounded-2xl border border-border bg-background/60">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/50 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-3">Month</th>
                    <th className="px-4 py-3">Receipt No.</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Fixed (₹)</th>
                    <th className="px-4 py-3">Paid (₹)</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  {(myZadulKhairRecords.length > 0
                    ? myZadulKhairRecords
                    : [currentMonthZadulKhair]
                  ).map((row) => {
                    const mMeta = MONTHS_META.find((m) => m.id === row.month)
                    const mLabel = mMeta ? `${mMeta.month} ${mMeta.year}` : row.month
                    return (
                      <tr key={row.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-semibold text-foreground">{mLabel}</td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          {row.receiptNo || '-'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{row.dateString || '-'}</td>
                        <td className="px-4 py-3 font-mono">
                          ₹{(row.fixedAmount ?? ZADUL_KHAIR_DEFAULT_FIXED_AMOUNT).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-foreground">
                          ₹{(row.paidAmount ?? 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 font-semibold uppercase">
                          <span
                            className={cn(
                              row.status === 'paid'
                                ? 'text-emerald-700 dark:text-lime'
                                : row.status === 'partial'
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : 'text-red-600 dark:text-red-400',
                            )}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{row.remarks || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: STRICTLY PRIVATE DISCIPLINE / CONDUCT ADVISORY FOR THIS STUDENT ONLY */}
        {activeTab === 'discipline' && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-background/60 px-4 py-3 text-xs text-muted-foreground">
              <Lock className="size-4 shrink-0 text-emerald-700 dark:text-lime" aria-hidden="true" />
              <span>
                <strong>Confidentiality Guarantee:</strong> Notes in this section are strictly private between you ({student.name}) and your Class Usthad / Principal. No other student can view this record.
              </span>
            </div>

            {myDisciplineNotes.length === 0 ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
                <CheckCircle2 className="mx-auto size-8 text-emerald-700 dark:text-lime" aria-hidden="true" />
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
                    className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 sm:p-5"
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
                          className="rounded-xl bg-lime text-xs font-semibold text-slate-950 hover:bg-lime/90"
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
    return CLASS_USTHADS.find((u) => u.id === actorId || u.name === actorName)
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
        ? (draft?.chapter ?? row.subjectOrCategory ?? '').trim() || 'നിശ്ചയിച്ച അദ്ധ്യായം'
        : row.subjectOrCategory || 'നിശ്ചയിച്ച അദ്ധ്യായം'
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

      const updatedRecord: CampusAcademicRecord = {
        ...row,
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

      publishCampusNotification({
        type: 'notice',
        title: `കിതാബ് പേജ് അപ്ഡേറ്റ് • Class ${row.className}`,
        message: `${actorName} updated "${row.title}" (Class ${row.className}): എടുത്ത പേജ് ${completedPages}/${totalPages} (ഇനി ബാക്കി: ${remainingPages} പേജ്).`,
        targetClass: row.className,
        actorId,
        actorName,
        href: '#academic-hub',
      })

      setToastMessage(
        `✅ Class ${row.className} "${row.title}" പേജ് കണക്ക് അപ്ഡേറ്റ് ചെയ്തു! (എടുത്തത്: ${completedPages} പേജ് · ഇനി എടുക്കാനുള്ളത്: ${remainingPages} പേജ്)`,
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

  // --- 4. Zadul Khair Class Roster & PDF State ---
  const [defaultClassFixedAmount, setDefaultClassFixedAmount] = useState<number>(
    ZADUL_KHAIR_DEFAULT_FIXED_AMOUNT,
  )
  const [zkEdits, setZkEdits] = useState<
    Record<
      string,
      {
        fixedAmount: number
        paidAmount: number
        status: AcademicRecordStatus
        receiptNo: string
        remarks: string
      }
    >
  >({})
  const [pdfBusyKey, setPdfBusyKey] = useState<string | null>(null)

  const classZadulKhairByStudentId = useMemo(() => {
    const map = new Map<string, CampusAcademicRecord>()
    for (const r of records) {
      if (
        r.recordKind === 'zadul_khair' &&
        !r.isDeleted &&
        normalizeClassName(r.className) === normClass &&
        r.month === selectedMonth &&
        r.studentId
      ) {
        map.set(r.studentId, r)
      }
    }
    return map
  }, [records, normClass, selectedMonth])

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

  async function handleSaveStudentZadulKhair(student: Student) {
    const existing = classZadulKhairByStudentId.get(student.id)
    const draft = zkEdits[student.id]
    const fixedAmount = Number(
      draft?.fixedAmount ?? existing?.fixedAmount ?? defaultClassFixedAmount,
    )
    const paidAmount = Number(draft?.paidAmount ?? existing?.paidAmount ?? fixedAmount)
    const status: AcademicRecordStatus =
      paidAmount >= fixedAmount && fixedAmount > 0
        ? 'paid'
        : paidAmount > 0
          ? 'partial'
          : 'unpaid'
    const receiptNo =
      (draft?.receiptNo ?? existing?.receiptNo ?? '').trim() ||
      `ZK-${selectedMonth.replace('-', '')}-${student.admissionNo.slice(-4)}`
    const remarks =
      (draft?.remarks ?? existing?.remarks ?? '').trim() ||
      (status === 'paid'
        ? 'Full monthly Zadul Khair contribution received.'
        : status === 'partial'
          ? 'Partial contribution recorded.'
          : 'Pending monthly contribution.')

    const mMeta = MONTHS_META.find((m) => m.id === selectedMonth)

    const record: CampusAcademicRecord = {
      id: `zk_${selectedMonth}_${student.id}`,
      campusId: 'ics-academy',
      recordKind: 'zadul_khair',
      className: normClass,
      studentId: student.id,
      studentName: student.name,
      admissionNo: student.admissionNo,
      month: selectedMonth,
      title: 'Zadul Khair (زاد الخير) Monthly Household Contribution',
      subjectOrCategory: mMeta ? `${mMeta.month} ${mMeta.year}` : selectedMonth,
      remarks,
      status,
      actorId,
      actorName,
      dateString: formatTodayDateDisplay(),
      receiptNo,
      fixedAmount,
      paidAmount,
      isDeleted: false,
      updatedAtMs: Date.now(),
    }

    await upsertCampusAcademicRecord(record)

    publishCampusNotification({
      type: 'notice',
      title: `Zadul Khair Receipt Updated (${mMeta?.shortMonth || selectedMonth})`,
      message: `${actorName} updated your Zadul Khair record: Paid ₹${paidAmount} / ₹${fixedAmount} (${status.toUpperCase()}). Receipt PDF is ready.`,
      targetClass: normClass,
      targetStudentId: student.id,
      actorId,
      actorName,
      href: '#academic-hub',
    })

    setToastMessage(`Saved Zadul Khair record for ${student.name} (₹${paidAmount}).`)
  }

  async function handleMarkEntireClassPaid() {
    for (const stu of classStudents) {
      const existing = classZadulKhairByStudentId.get(stu.id)
      const fixedAmount = Number(existing?.fixedAmount ?? defaultClassFixedAmount)
      const mMeta = MONTHS_META.find((m) => m.id === selectedMonth)
      await upsertCampusAcademicRecord({
        id: `zk_${selectedMonth}_${stu.id}`,
        campusId: 'ics-academy',
        recordKind: 'zadul_khair',
        className: normClass,
        studentId: stu.id,
        studentName: stu.name,
        admissionNo: stu.admissionNo,
        month: selectedMonth,
        title: 'Zadul Khair (زاد الخير) Monthly Household Contribution',
        subjectOrCategory: mMeta ? `${mMeta.month} ${mMeta.year}` : selectedMonth,
        remarks: 'Full monthly Zadul Khair contribution received.',
        status: 'paid',
        actorId,
        actorName,
        dateString: formatTodayDateDisplay(),
        receiptNo: `ZK-${selectedMonth.replace('-', '')}-${stu.admissionNo.slice(-4)}`,
        fixedAmount,
        paidAmount: fixedAmount,
        isDeleted: false,
        updatedAtMs: Date.now(),
      })
    }
    setToastMessage(`Marked all ${classStudents.length} students in Class ${normClass} as PAID for ${selectedMonth}.`)
  }

  async function handleExportFullClassZadulKhairPdf(mode: 'download' | 'print') {
    setPdfBusyKey(`class_${mode}`)
    try {
      const rows = classStudents.map((stu) => {
        const existing = classZadulKhairByStudentId.get(stu.id)
        const draft = zkEdits[stu.id]
        const fixedAmount = Number(
          draft?.fixedAmount ?? existing?.fixedAmount ?? defaultClassFixedAmount,
        )
        const paidAmount = Number(draft?.paidAmount ?? existing?.paidAmount ?? 0)
        const status: AcademicRecordStatus =
          paidAmount >= fixedAmount && fixedAmount > 0
            ? 'paid'
            : paidAmount > 0
              ? 'partial'
              : 'unpaid'
        return {
          student: stu,
          fixedAmount,
          paidAmount,
          status,
          receiptNo:
            draft?.receiptNo ??
            existing?.receiptNo ??
            `ZK-${selectedMonth.replace('-', '')}-${stu.admissionNo.slice(-4)}`,
          dateString: existing?.dateString || formatTodayDateDisplay(),
          remarks: draft?.remarks ?? existing?.remarks ?? '',
        }
      })

      await exportClassZadulKhairReportPdf({
        className: normClass,
        monthId: selectedMonth,
        rows,
        preparedByName: actorName,
        preparedByRole: role === 'principal' ? 'Principal' : 'Usthad',
        mode,
      })
    } finally {
      setPdfBusyKey(null)
    }
  }

  async function handleExportSingleStudentReceiptFromUsthad(
    stu: Student,
    mode: 'download' | 'print',
  ) {
    setPdfBusyKey(`${stu.id}_${mode}`)
    try {
      const existing = classZadulKhairByStudentId.get(stu.id)
      const mMeta = MONTHS_META.find((m) => m.id === selectedMonth)
      const record: CampusAcademicRecord = existing || {
        id: `zk_${selectedMonth}_${stu.id}`,
        campusId: 'ics-academy',
        recordKind: 'zadul_khair',
        className: normClass,
        studentId: stu.id,
        studentName: stu.name,
        admissionNo: stu.admissionNo,
        month: selectedMonth,
        title: 'Zadul Khair (زاد الخير) Monthly Household Contribution',
        subjectOrCategory: mMeta ? `${mMeta.month} ${mMeta.year}` : selectedMonth,
        status: 'unpaid',
        actorId,
        actorName,
        dateString: formatTodayDateDisplay(),
        receiptNo: `ZK-${selectedMonth.replace('-', '')}-${stu.admissionNo.slice(-4)}`,
        fixedAmount: defaultClassFixedAmount,
        paidAmount: 0,
        isDeleted: false,
        updatedAtMs: Date.now(),
      }
      const historyRecords = records.filter(
        (r) => r.recordKind === 'zadul_khair' && !r.isDeleted && r.studentId === stu.id,
      )
      await exportStudentZadulKhairReceiptPdf({
        student: stu,
        record,
        historyRecords,
        mode,
      })
    } finally {
      setPdfBusyKey(null)
    }
  }

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
        title={`Class ${normClass} — Jamiathul Hind Syllabus, Monthly Tests, Holiday Da'wa & Zadul Khair`}
        eyebrow={`Managed by ${actorName} (${role === 'principal' ? 'Principal' : 'Usthad'})`}
        icon={Trophy}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
          <button
            type="button"
            onClick={() => setActiveTab('syllabus')}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors',
              activeTab === 'syllabus'
                ? 'bg-lime text-slate-950 shadow-sm'
                : 'border border-border bg-background/60 text-muted-foreground hover:text-foreground',
            )}
          >
            <BookOpen className="size-3.5" aria-hidden="true" />
            <span>
              Jamiathul Hind Syllabus & My Subjects (
              {myTeachingSyllabusRows.length || activeClassSyllabusRows.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tests')}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors',
              activeTab === 'tests'
                ? 'bg-lime text-slate-950 shadow-sm'
                : 'border border-border bg-background/60 text-muted-foreground hover:text-foreground',
            )}
          >
            <ClipboardCheck className="size-3.5" aria-hidden="true" />
            <span>Monthly / Unit Tests & Grading ({classTests.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('holiday')}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors',
              activeTab === 'holiday'
                ? 'bg-lime text-slate-950 shadow-sm'
                : 'border border-border bg-background/60 text-muted-foreground hover:text-foreground',
            )}
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>Holiday & SSF Da&apos;wa Logs ({classHolidayLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('discipline')}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors',
              activeTab === 'discipline'
                ? 'bg-lime text-slate-950 shadow-sm'
                : 'border border-border bg-background/60 text-muted-foreground hover:text-foreground',
            )}
          >
            <ShieldAlert className="size-3.5" aria-hidden="true" />
            <span>Private Student Discipline ({classDisciplineNotes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('zadul_khair')}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors',
              activeTab === 'zadul_khair'
                ? 'bg-lime text-slate-950 shadow-sm'
                : 'border border-border bg-background/60 text-muted-foreground hover:text-foreground',
            )}
          >
            <HeartHandshake className="size-3.5" aria-hidden="true" />
            <span>Zadul Khair (زاد الخير) Ledger & PDF</span>
          </button>
        </div>

        {toastMessage && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-lime/40 bg-lime/10 px-4 py-3 text-xs font-medium text-foreground">
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

        {/* USTHAD TAB 0: JAMIATHUL HIND MONTHLY SYLLABUS & MY TEACHING SUBJECTS ACROSS CLASSES */}
        {activeTab === 'syllabus' && (
          <div className="mt-5 space-y-6">
            {/* Section A: My Teaching Subjects Across All Classes */}
            {myTeachingSyllabusRows.length > 0 && (
              <div className="space-y-4 rounded-2xl border border-emerald-600/30 bg-emerald-500/[0.06] p-4 sm:p-5 dark:border-lime/35 dark:bg-lime/[0.06]">
                <div className="flex flex-col justify-between gap-3 border-b border-border/70 pb-3.5 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-xs font-bold tracking-wider text-emerald-700 uppercase dark:text-lime">
                      എൻ്റെ ക്ലാസ്സുകളും വിഷയങ്ങളും · My Teaching Subjects Across All Classes
                    </p>
                    <h4 className="mt-1 font-display text-base font-bold text-foreground sm:text-lg">
                      {actorName} — ജാമിഅതുൽ ഹിന്ദ് മാസ സിലബസ് & പേജ് കണക്ക് ({myTeachingSyllabusRows.length} Subjects)
                    </h4>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      നിങ്ങൾ വിവിധ ക്ലാസ്സുകളിൽ എടുക്കുന്ന കിതാബുകൾ, ക്ലാസ്സ് ലീഡർ രേഖപ്പെടുത്തിയ ജാമിഅതുൽ ഹിന്ദ് അദ്ധ്യായം (ഏത് മുതൽ ഏത് വരെ), എടുക്കേണ്ട പേജ്, എടുത്ത പേജ്, ഇനി എടുക്കാനുള്ള പേജ് എന്നിവ ഇവിടെ കാണാം. എടുത്ത പേജുകളുടെ എണ്ണം അപ്ഡേറ്റ് ചെയ്യാം.
                    </p>
                  </div>

                  <div className="w-44 shrink-0">
                    <ThemeSelect
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      aria-label="Select Syllabus Month"
                    >
                      {MONTHS_META.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.month} {m.year}
                        </option>
                      ))}
                    </ThemeSelect>
                  </div>
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

                    return (
                      <div
                        key={row.id}
                        className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-2xs"
                      >
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/35 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-800 dark:border-lime/40 dark:bg-lime/15 dark:text-lime">
                              Class {row.className} · {row.admissionNo}
                            </span>
                            <span className="font-mono text-xs font-bold text-emerald-700 tabular-nums dark:text-lime">
                              {progressPct}% Done
                            </span>
                          </div>

                          <h5 className="mt-2 font-display text-base font-bold text-foreground">
                            {row.title}
                          </h5>

                          <div className="mt-2 grid gap-2 rounded-lg border border-border/80 bg-background/70 p-2.5 sm:grid-cols-2">
                            <div>
                              <span className="block text-[10px] font-bold tracking-wider text-emerald-700 uppercase dark:text-lime">
                                ഏത് അദ്ധ്യായം മുതൽ (From)
                              </span>
                              <p className="mt-0.5 text-xs font-semibold text-foreground">
                                {parsedRange.fromChapter}
                              </p>
                            </div>
                            <div className="border-t border-border/60 pt-1.5 sm:border-t-0 sm:border-l sm:pl-2.5 sm:pt-0">
                              <span className="block text-[10px] font-bold tracking-wider text-emerald-700 uppercase dark:text-lime">
                                ഏത് അദ്ധ്യായം വരെ (Up To)
                              </span>
                              <p className="mt-0.5 text-xs font-semibold text-foreground">
                                {parsedRange.toChapter}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs tabular-nums">
                            <div className="rounded-lg border border-border bg-background/60 p-2">
                              <span className="block text-[10px] text-muted-foreground">
                                എടുക്കേണ്ടത്
                              </span>
                              <strong className="font-mono text-sm text-foreground">
                                {totalPagesVal}p
                              </strong>
                            </div>
                            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2">
                              <span className="block text-[10px] text-emerald-700 dark:text-lime">
                                എടുത്തത്
                              </span>
                              <strong className="font-mono text-sm text-emerald-700 dark:text-lime">
                                {completedPagesVal}p
                              </strong>
                            </div>
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
                              <span className="block text-[10px] text-amber-800 dark:text-amber-300">
                                ഇനി ബാക്കി
                              </span>
                              <strong className="font-mono text-sm text-amber-700 dark:text-amber-300">
                                {remainingPagesVal}p
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3.5 flex items-end gap-2 border-t border-border/70 pt-3">
                          <div className="flex-1 space-y-1">
                            <Label className="text-[11px] font-semibold text-foreground">
                              എത്ര പേജ് എടുത്തു (Update Completed Pages):
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
                            className="h-9 rounded-xl bg-lime px-3.5 text-xs font-semibold text-slate-950 hover:bg-lime/90"
                          >
                            <Check className="mr-1.5 size-3.5" aria-hidden="true" />
                            {savingSyllabusId === row.id ? 'Saving...' : 'Save Pages'}
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
                <div>
                  <h4 className="font-display text-base font-bold text-foreground">
                    Class {normClass} — Complete Jamiathul Hind Monthly Syllabus ({selectedMonth})
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    All subjects in Class {normClass} with prescribed chapter range (ഏത് മുതൽ ഏത് വരെ), target pages, completed pages, and remaining pages.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border bg-background/60">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-muted/50 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    <tr>
                      <th className="px-3.5 py-3">Period & Kitab</th>
                      <th className="px-3.5 py-3">Teaching Usthad</th>
                      <th className="px-3.5 py-3">ഏത് അദ്ധ്യായം മുതൽ – ഏത് വരെ</th>
                      <th className="px-3.5 py-3">എടുക്കേണ്ടത്</th>
                      <th className="px-3.5 py-3">എടുത്ത പേജ്</th>
                      <th className="px-3.5 py-3">ഇനി ബാക്കി</th>
                      <th className="px-3.5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border tabular-nums">
                    {activeClassSyllabusRows.map((row) => {
                      const parsedRange = extractSyllabusChapterRange(row)
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
                        <tr key={row.id} className="hover:bg-muted/25">
                          <td className="px-3.5 py-3">
                            <span className="font-mono text-[11px] font-bold text-emerald-700 dark:text-lime">
                              {row.admissionNo}
                            </span>
                            <p className="font-semibold text-foreground">{row.title}</p>
                          </td>
                          <td className="px-3.5 py-3 font-medium text-foreground">
                            {row.studentName}
                          </td>
                          <td className="px-3.5 py-3 text-foreground">
                            <div className="space-y-0.5 text-xs">
                              <p>
                                <span className="font-semibold text-emerald-700 dark:text-lime">
                                  മുതൽ:
                                </span>{' '}
                                {parsedRange.fromChapter}
                              </p>
                              <p>
                                <span className="font-semibold text-emerald-700 dark:text-lime">
                                  വരെ:
                                </span>{' '}
                                {parsedRange.toChapter}
                              </p>
                            </div>
                          </td>
                          <td className="px-3.5 py-3 font-mono font-bold text-foreground">
                            {totalVal} പേജ്
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
                              <span className="font-mono font-bold text-emerald-700 dark:text-lime">
                                {completedVal} പേജ്
                              </span>
                            )}
                          </td>
                          <td className="px-3.5 py-3 font-mono font-bold text-amber-700 dark:text-amber-300">
                            {remainingVal} പേജ്
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
                                className="h-8 rounded-lg bg-lime px-3 text-xs font-semibold text-slate-950 hover:bg-lime/90"
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
                className="rounded-xl bg-lime text-xs font-semibold text-slate-950 hover:bg-lime/90"
              >
                <Plus className="mr-1.5 size-4" aria-hidden="true" />
                {showCreateTestForm ? 'Hide Test Builder' : 'Create New Monthly / Unit Test'}
              </Button>
            </div>

            {showCreateTestForm && (
              <form
                onSubmit={handlePublishNewUnitTest}
                className="space-y-4 rounded-2xl border border-lime/35 bg-background/70 p-4 sm:p-6"
              >
                <h5 className="font-display text-base font-bold text-foreground">
                  Create New Monthly / Unit Test for Class {normClass}
                </h5>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Test Title</Label>
                    <Input
                      value={newTestTitle}
                      onChange={(e) => setNewTestTitle(e.target.value)}
                      placeholder="e.g., November Monthly Test — II"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Subject / Kitab Name</Label>
                    <Input
                      value={newTestSubject}
                      onChange={(e) => setNewTestSubject(e.target.value)}
                      placeholder="e.g., Fath al-Mu'in / Alfiyyah"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Instructions</Label>
                    <Input
                      value={newTestDescription}
                      onChange={(e) => setNewTestDescription(e.target.value)}
                      placeholder="Short instructions for students..."
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {newTestQuestions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="space-y-3 rounded-xl border border-border bg-card/70 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-emerald-700 dark:text-lime">
                          Question #{idx + 1} ({q.type === 'mcq' ? 'Multiple Choice' : 'Objective / Typed'})
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
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setNewTestQuestions((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="h-8 text-xs text-red-500"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <Input
                        value={q.prompt}
                        onChange={(e) => {
                          const val = e.target.value
                          setNewTestQuestions((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, prompt: val } : item)),
                          )
                        }}
                        placeholder="Type the question text here..."
                        required
                      />

                      {q.type === 'mcq' && Array.isArray(q.options) ? (
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          {q.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-2">
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
                                className="h-8 text-xs"
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Input
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
                          className="text-xs"
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addQuestionRow('mcq')}
                      className="rounded-xl text-xs"
                    >
                      <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
                      Add Multiple-Choice (MCQ)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addQuestionRow('objective')}
                      className="rounded-xl text-xs"
                    >
                      <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
                      Add Objective (Typed Answer)
                    </Button>
                  </div>

                  <Button
                    type="submit"
                    className="rounded-xl bg-lime font-semibold text-slate-950 hover:bg-lime/90"
                  >
                    Publish Test to Class {normClass}
                  </Button>
                </div>
              </form>
            )}

            {/* Grading Section */}
            {activeGradingTest && (
              <div className="space-y-4 rounded-2xl border border-border bg-background/60 p-4 sm:p-5">
                <div className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">
                      Evaluate Student Submissions
                    </p>
                    <h5 className="font-display text-lg font-bold text-foreground">
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

                      return (
                        <div
                          key={sub.id}
                          className="rounded-xl border border-border bg-card/80 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
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
                              <span className="text-emerald-700 dark:text-lime">{liveSum}</span>/
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

                              return (
                                <div
                                  key={q.id}
                                  className="flex flex-col justify-between gap-2 rounded-lg border border-border/60 bg-background/60 p-3 text-xs sm:flex-row sm:items-center"
                                >
                                  <div className="space-y-1">
                                    <p className="font-semibold text-foreground">
                                      Q{qIdx + 1} ({q.type.toUpperCase()} · Max {q.marks}M):{' '}
                                      {q.prompt}
                                    </p>
                                    <p className="text-muted-foreground">
                                      <strong className="text-foreground">Student Answer:</strong>{' '}
                                      {formattedAns}
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
                              value={gradingRemarksDraft[sub.id] ?? sub.remarks ?? ''}
                              onChange={(e) =>
                                setGradingRemarksDraft((prev) => ({
                                  ...prev,
                                  [sub.id]: e.target.value,
                                }))
                              }
                              placeholder="Add Usthad evaluation remarks for this student..."
                              className="h-9 flex-1 text-xs"
                            />
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleSaveStudentGrade(sub)}
                              className="rounded-xl bg-lime text-xs font-semibold text-slate-950 hover:bg-lime/90"
                            >
                              <Check className="mr-1.5 size-3.5" aria-hidden="true" />
                              Save & Publish Marks
                            </Button>
                          </div>
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
              <div className="rounded-2xl border border-border bg-background/50 p-6 text-center text-xs text-muted-foreground">
                No holiday Academic or SSF Da&apos;wa logs uploaded by Class {normClass} students yet.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {classHolidayLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-col justify-between rounded-2xl border border-border bg-background/60 p-4"
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
                              ? 'text-emerald-700 dark:text-lime'
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
                        <div className="mt-3 overflow-hidden rounded-xl border border-border">
                          <img
                            src={log.photoUrl}
                            alt={log.title || 'Student activity proof'}
                            className="max-h-52 w-full object-cover"
                          />
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-col gap-2 border-t border-border/70 pt-3 sm:flex-row">
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
                        className="h-8 rounded-xl bg-lime text-xs font-semibold text-slate-950 hover:bg-lime/90"
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
              className="space-y-4 rounded-2xl border border-border bg-background/60 p-4 sm:p-5 lg:col-span-5"
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
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-lime"
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
                className="w-full rounded-xl bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400"
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
                <div className="rounded-2xl border border-border bg-background/50 p-6 text-center text-xs text-muted-foreground">
                  No confidential discipline notes recorded for Class {normClass}.
                </div>
              ) : (
                <div className="space-y-3">
                  {classDisciplineNotes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-2xl border border-border bg-background/60 p-4"
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
                                ? 'text-emerald-700 dark:text-lime'
                                : 'text-amber-700 dark:text-amber-400',
                            )}
                          >
                            {note.acknowledged ? '✓ Acknowledged by Student' : 'Unread by Student'}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteDisciplineNote(note)}
                            className="h-7 px-2 text-red-500"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                      <h5 className="mt-2 font-display text-sm font-bold text-foreground">
                        {note.title}
                      </h5>
                      <p className="mt-1 text-xs text-muted-foreground">{note.description}</p>
                      {note.remarks && (
                        <p className="mt-1.5 text-xs text-foreground">
                          <strong className="text-emerald-700 dark:text-lime">
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

        {/* USTHAD TAB 4: ZADUL KHAIR (زاد الخير) CLASS LEDGER & OFFICIAL PDF GENERATOR */}
        {activeTab === 'zadul_khair' && (
          <div className="mt-5 space-y-5">
            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-background/60 p-4 sm:flex-row sm:items-center sm:p-5">
              <div>
                <p className="text-xs font-semibold tracking-wider text-emerald-700 uppercase dark:text-lime">
                  زاد الخير · Zadul Khair Class Collection Ledger
                </p>
                <h4 className="mt-1 font-display text-lg font-bold text-foreground">
                  Class {normClass} Monthly Household Contributions ({selectedMonth})
                </h4>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Update monthly fixed and paid amounts per student and export official ICS Academy Manhappatta PDF statements & receipts.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="w-44">
                  <ThemeSelect
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    aria-label="Select Zadul Khair Month"
                  >
                    {MONTHS_META.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.month} {m.year}
                      </option>
                    ))}
                  </ThemeSelect>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleMarkEntireClassPaid}
                  variant="outline"
                  className="rounded-xl text-xs"
                >
                  <CheckCircle2
                    className="mr-1.5 size-3.5 text-emerald-700 dark:text-lime"
                    aria-hidden="true"
                  />
                  Mark All Paid
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={pdfBusyKey !== null}
                  onClick={() => handleExportFullClassZadulKhairPdf('download')}
                  className="rounded-xl bg-lime text-xs font-semibold text-slate-950 hover:bg-lime/90"
                >
                  <Download className="mr-1.5 size-3.5" aria-hidden="true" />
                  {pdfBusyKey === 'class_download' ? 'Generating PDF...' : 'Class Statement PDF'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pdfBusyKey !== null}
                  onClick={() => handleExportFullClassZadulKhairPdf('print')}
                  className="rounded-xl text-xs"
                >
                  <Printer className="mr-1.5 size-3.5" aria-hidden="true" />
                  Print Class List
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border bg-background/60">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/50 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  <tr>
                    <th className="px-3 py-3">Student</th>
                    <th className="px-3 py-3">Receipt No.</th>
                    <th className="px-3 py-3">Fixed (₹)</th>
                    <th className="px-3 py-3">Paid (₹)</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Remarks</th>
                    <th className="px-3 py-3 text-right">Actions & Receipt PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  {classStudents.map((stu) => {
                    const saved = classZadulKhairByStudentId.get(stu.id)
                    const draft = zkEdits[stu.id]
                    const fixedVal =
                      draft?.fixedAmount ?? saved?.fixedAmount ?? defaultClassFixedAmount
                    const paidVal = draft?.paidAmount ?? saved?.paidAmount ?? 0
                    const statusVal: AcademicRecordStatus =
                      paidVal >= fixedVal && fixedVal > 0
                        ? 'paid'
                        : paidVal > 0
                          ? 'partial'
                          : 'unpaid'
                    const receiptVal =
                      draft?.receiptNo ??
                      saved?.receiptNo ??
                      `ZK-${selectedMonth.replace('-', '')}-${stu.admissionNo.slice(-4)}`
                    const remarksVal = draft?.remarks ?? saved?.remarks ?? ''

                    return (
                      <tr key={stu.id} className="hover:bg-muted/25">
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-foreground">{stu.name}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {stu.admissionNo}
                          </p>
                        </td>
                        <td className="px-3 py-2.5">
                          <Input
                            value={receiptVal}
                            onChange={(e) =>
                              setZkEdits((prev) => ({
                                ...prev,
                                [stu.id]: {
                                  fixedAmount: fixedVal,
                                  paidAmount: paidVal,
                                  status: statusVal,
                                  receiptNo: e.target.value,
                                  remarks: remarksVal,
                                },
                              }))
                            }
                            className="h-8 w-32 font-mono text-xs"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <Input
                            type="number"
                            min={0}
                            value={fixedVal}
                            onChange={(e) =>
                              setZkEdits((prev) => ({
                                ...prev,
                                [stu.id]: {
                                  fixedAmount: Number(e.target.value) || 0,
                                  paidAmount: paidVal,
                                  status: statusVal,
                                  receiptNo: receiptVal,
                                  remarks: remarksVal,
                                },
                              }))
                            }
                            className="h-8 w-24 font-mono text-xs"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <Input
                            type="number"
                            min={0}
                            value={paidVal}
                            onChange={(e) =>
                              setZkEdits((prev) => ({
                                ...prev,
                                [stu.id]: {
                                  fixedAmount: fixedVal,
                                  paidAmount: Number(e.target.value) || 0,
                                  status: statusVal,
                                  receiptNo: receiptVal,
                                  remarks: remarksVal,
                                },
                              }))
                            }
                            className="h-8 w-24 font-mono text-xs font-bold"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-semibold uppercase">
                          <span
                            className={cn(
                              statusVal === 'paid'
                                ? 'text-emerald-700 dark:text-lime'
                                : statusVal === 'partial'
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : 'text-red-600 dark:text-red-400',
                            )}
                          >
                            {statusVal}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Input
                            value={remarksVal}
                            onChange={(e) =>
                              setZkEdits((prev) => ({
                                ...prev,
                                [stu.id]: {
                                  fixedAmount: fixedVal,
                                  paidAmount: paidVal,
                                  status: statusVal,
                                  receiptNo: receiptVal,
                                  remarks: e.target.value,
                                },
                              }))
                            }
                            placeholder="Optional note..."
                            className="h-8 w-40 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleSaveStudentZadulKhair(stu)}
                              className="h-8 rounded-lg bg-lime px-2.5 text-xs font-semibold text-slate-950 hover:bg-lime/90"
                            >
                              Save
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={pdfBusyKey !== null}
                              onClick={() =>
                                handleExportSingleStudentReceiptFromUsthad(stu, 'download')
                              }
                              className="h-8 rounded-lg px-2.5 text-xs"
                              title="Download Student Zadul Khair Receipt PDF"
                            >
                              <Download className="size-3.5" aria-hidden="true" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>
    </section>
  )
}
