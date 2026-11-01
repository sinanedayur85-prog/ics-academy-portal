'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  UserCheck,
  UserCog,
  UserMinus,
  UserX,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ABSENT_REASONS,
  ATTENDANCE_LEAVE_REASONS,
  CLASS_USTHADS,
  CURRENT_SEMESTER,
  NOT_HELD_REASONS,
  getClassLeadersForClass,
  getClassSemesterTimetable,
  loadPeriodAttendanceSubmissions,
  savePeriodAttendanceSubmissions,
  students,
  type PeriodAttendanceStatus,
  type PeriodAttendanceSubmission,
  type PeriodSessionStatus,
  type Student,
} from '@/components/dashboard/data'
import { Panel } from '@/components/dashboard/panel'
import { ParentReportModal } from '@/components/dashboard/parent-report-modal'
import { cn } from '@/lib/utils'

const LEAVE_STORAGE_KEY = 'ics_leave_register_v1'

type StoredLeaveRecord = {
  id: string
  studentId: string
  studentName: string
  admissionNo: string
  className: string
  type: 'leave' | 'return'
  timestamp: string
}

function getTodayDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function loadOnLeaveStudentIdsForClass(className: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(LEAVE_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as StoredLeaveRecord[]
    if (!Array.isArray(parsed)) return new Set()

    const latestByStudent = new Map<string, 'leave' | 'return'>()
    const sorted = [...parsed].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    for (const rec of sorted) {
      if (rec.className === className && !latestByStudent.has(rec.studentId)) {
        latestByStudent.set(rec.studentId, rec.type)
      }
    }

    const onLeaveIds = new Set<string>()
    for (const [studentId, status] of latestByStudent.entries()) {
      if (status === 'leave') {
        onLeaveIds.add(studentId)
      }
    }
    return onLeaveIds
  } catch {
    return new Set()
  }
}

type ClassLeaderAttendanceCardProps = {
  leader: Student
  leaderId: string
  eyebrowLabel?: string
  submittedByNameOverride?: string
  highlightLeaderBadge?: boolean
  actorRoleLabel?: 'Class Leader' | 'Class Usthad' | 'Principal'
  controlledDate?: string
  onControlledDateChange?: (date: string) => void
}

export function ClassLeaderAttendanceCard({
  leader,
  leaderId,
  eyebrowLabel,
  submittedByNameOverride,
  highlightLeaderBadge = true,
  actorRoleLabel,
  controlledDate,
  onControlledDateChange,
}: ClassLeaderAttendanceCardProps) {
  const [internalDate, setInternalDate] = useState<string>(getTodayDateString)
  const selectedDate = controlledDate ?? internalDate
  const setSelectedDate = (nextDate: string) => {
    const clean = nextDate || getTodayDateString()
    setInternalDate(clean)
    onControlledDateChange?.(clean)
  }

  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState<number>(1)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [submissions, setSubmissions] = useState<Record<string, PeriodAttendanceSubmission>>({})
  const [draftRecords, setDraftRecords] = useState<Record<string, PeriodAttendanceStatus>>({})
  const [draftReasons, setDraftReasons] = useState<Record<string, string>>({})
  const [draftSessionStatus, setDraftSessionStatus] = useState<PeriodSessionStatus>('conducted')
  const [draftNotHeldReason, setDraftNotHeldReason] = useState<string>(NOT_HELD_REASONS[0])
  const [draftSubstituteUsthadId, setDraftSubstituteUsthadId] = useState<string>(
    () => CLASS_USTHADS[0]?.id ?? 'usthad-14',
  )
  const [onLeaveStudentIds, setOnLeaveStudentIds] = useState<Set<string>>(new Set())
  const [justSubmittedMessage, setJustSubmittedMessage] = useState<string | null>(null)
  const [reportStudent, setReportStudent] = useState<Student | null>(null)

  const effectiveRoleLabel =
    actorRoleLabel ?? (highlightLeaderBadge ? 'Class Leader' : 'Class Usthad')

  const classStudents = useMemo(
    () => students.filter((s) => s.className === leader.className),
    [leader.className],
  )

  const classLeaders = useMemo(
    () => getClassLeadersForClass(leader.className),
    [leader.className],
  )

  const timetable = useMemo(() => getClassSemesterTimetable(leader), [leader])
  const semesterSubjects =
    CURRENT_SEMESTER === 1 ? timetable.semester1 : timetable.semester2

  const periods = useMemo(
    () =>
      timetable.periods.map((period, idx) => {
        const slot = semesterSubjects[idx] ?? {
          subject: 'General Study',
          teacher: 'Class Usthad',
        }
        return {
          index: idx + 1,
          label: period.label,
          time: period.time,
          subject: slot.subject,
          teacher: slot.teacher,
        }
      }),
    [timetable.periods, semesterSubjects],
  )

  const activePeriod =
    periods.find((p) => p.index === selectedPeriodIndex) ?? periods[0]

  const currentSubmissionKey = `${selectedDate}__${leader.className}__${activePeriod.index}`
  const existingSubmission = submissions[currentSubmissionKey]

  useEffect(() => {
    function syncAll() {
      setSubmissions(loadPeriodAttendanceSubmissions())
      setOnLeaveStudentIds(loadOnLeaveStudentIdsForClass(leader.className))
    }
    syncAll()
    window.addEventListener('ics-period-attendance-updated', syncAll)
    window.addEventListener('storage', syncAll)
    return () => {
      window.removeEventListener('ics-period-attendance-updated', syncAll)
      window.removeEventListener('storage', syncAll)
    }
  }, [leader.className])

  useEffect(() => {
    const saved = submissions[currentSubmissionKey]
    const statusFromSaved: PeriodSessionStatus = saved?.sessionStatus ?? 'conducted'
    setDraftSessionStatus(statusFromSaved)
    setDraftNotHeldReason(saved?.notHeldReason ?? NOT_HELD_REASONS[0])
    if (saved?.substituteUsthad?.usthadId) {
      setDraftSubstituteUsthadId(saved.substituteUsthad.usthadId)
    } else {
      const otherUsthad =
        CLASS_USTHADS.find((u) => u.className !== leader.className) ?? CLASS_USTHADS[0]
      if (otherUsthad) setDraftSubstituteUsthadId(otherUsthad.id)
    }

    if (saved && saved.records && Object.keys(saved.records).length > 0) {
      const nextDraft: Record<string, PeriodAttendanceStatus> = {}
      const nextReasons: Record<string, string> = {}
      for (const student of classStudents) {
        const stStatus = saved.records[student.id] ?? 'present'
        nextDraft[student.id] = stStatus
        if (stStatus === 'absent') {
          nextReasons[student.id] = saved.reasons?.[student.id] ?? ABSENT_REASONS[0]
        } else if (stStatus === 'leave') {
          nextReasons[student.id] = saved.reasons?.[student.id] ?? ATTENDANCE_LEAVE_REASONS[0]
        }
      }
      setDraftRecords(nextDraft)
      setDraftReasons(nextReasons)
    } else {
      const nextDraft: Record<string, PeriodAttendanceStatus> = {}
      const nextReasons: Record<string, string> = {}
      for (const student of classStudents) {
        const isLeave = onLeaveStudentIds.has(student.id)
        nextDraft[student.id] = isLeave ? 'leave' : 'present'
        if (isLeave) {
          nextReasons[student.id] = ATTENDANCE_LEAVE_REASONS[0]
        }
      }
      setDraftRecords(nextDraft)
      setDraftReasons(nextReasons)
    }
    setJustSubmittedMessage(null)
  }, [currentSubmissionKey, submissions, classStudents, onLeaveStudentIds, leader.className])

  const isSessionNotHeld = draftSessionStatus === 'not-held'
  const isSessionSubstituted = draftSessionStatus === 'substituted'

  const selectedSubstituteUsthad = useMemo(
    () =>
      CLASS_USTHADS.find((u) => u.id === draftSubstituteUsthadId) ?? CLASS_USTHADS[0],
    [draftSubstituteUsthadId],
  )

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return classStudents
    return classStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q),
    )
  }, [classStudents, searchQuery])

  const summaryCounts = useMemo(() => {
    if (isSessionNotHeld) {
      return {
        total: classStudents.length,
        present: 0,
        absent: 0,
        leave: 0,
      }
    }
    let present = 0
    let absent = 0
    let leave = 0
    for (const student of classStudents) {
      const status = draftRecords[student.id] ?? 'present'
      if (status === 'present') present += 1
      else if (status === 'absent') absent += 1
      else leave += 1
    }
    return {
      total: classStudents.length,
      present,
      absent,
      leave,
    }
  }, [classStudents, draftRecords, isSessionNotHeld])

  const periodStatusCountsForDate = useMemo(() => {
    let conducted = 0
    let notHeld = 0
    let substituted = 0
    for (const p of periods) {
      const sub = submissions[`${selectedDate}__${leader.className}__${p.index}`]
      if (!sub) continue
      if (sub.sessionStatus === 'not-held') notHeld += 1
      else if (sub.sessionStatus === 'substituted') substituted += 1
      else conducted += 1
    }
    return {
      totalSubmitted: conducted + notHeld + substituted,
      conducted,
      notHeld,
      substituted,
    }
  }, [periods, submissions, selectedDate, leader.className])

  function handleStatusChange(studentId: string, status: PeriodAttendanceStatus) {
    if (isSessionNotHeld) return
    setDraftRecords((prev) => ({
      ...prev,
      [studentId]: status,
    }))
    setDraftReasons((prev) => {
      const next = { ...prev }
      if (status === 'absent') {
        if (!ABSENT_REASONS.includes(next[studentId] ?? '')) {
          next[studentId] = ABSENT_REASONS[0]
        }
      } else if (status === 'leave') {
        if (!ATTENDANCE_LEAVE_REASONS.includes(next[studentId] ?? '')) {
          next[studentId] = ATTENDANCE_LEAVE_REASONS[0]
        }
      } else {
        delete next[studentId]
      }
      return next
    })
    setJustSubmittedMessage(null)
  }

  function handleReasonChange(studentId: string, reason: string) {
    if (isSessionNotHeld) return
    setDraftReasons((prev) => ({
      ...prev,
      [studentId]: reason,
    }))
    setJustSubmittedMessage(null)
  }

  function handleMarkAllPresent() {
    if (isSessionNotHeld) return
    const next: Record<string, PeriodAttendanceStatus> = {}
    const nextReasons: Record<string, string> = {}
    for (const student of classStudents) {
      const isLeave = onLeaveStudentIds.has(student.id)
      next[student.id] = isLeave ? 'leave' : 'present'
      if (isLeave) {
        nextReasons[student.id] = ATTENDANCE_LEAVE_REASONS[0]
      }
    }
    setDraftRecords(next)
    setDraftReasons(nextReasons)
    setJustSubmittedMessage(null)
  }

  function handleResetPeriod() {
    if (existingSubmission && Object.keys(existingSubmission.records ?? {}).length > 0) {
      setDraftRecords({ ...existingSubmission.records })
      setDraftReasons({ ...(existingSubmission.reasons ?? {}) })
      setDraftSessionStatus(existingSubmission.sessionStatus ?? 'conducted')
      setDraftNotHeldReason(existingSubmission.notHeldReason ?? NOT_HELD_REASONS[0])
    } else {
      setDraftSessionStatus('conducted')
      const next: Record<string, PeriodAttendanceStatus> = {}
      const nextReasons: Record<string, string> = {}
      for (const student of classStudents) {
        const isLeave = onLeaveStudentIds.has(student.id)
        next[student.id] = isLeave ? 'leave' : 'present'
        if (isLeave) {
          nextReasons[student.id] = ATTENDANCE_LEAVE_REASONS[0]
        }
      }
      setDraftRecords(next)
      setDraftReasons(nextReasons)
    }
    setJustSubmittedMessage(null)
  }

  function handleSaveClassNotHeld() {
    const nowIso = new Date().toISOString()
    const actorDisplay = `${effectiveRoleLabel} • ${submittedByNameOverride ?? leader.name} (${leaderId})`

    const submission: PeriodAttendanceSubmission = {
      key: currentSubmissionKey,
      date: selectedDate,
      className: leader.className,
      periodIndex: activePeriod.index,
      periodLabel: activePeriod.label,
      periodTime: activePeriod.time,
      subject: activePeriod.subject,
      teacher: activePeriod.teacher,
      submittedByLeaderId: leaderId,
      submittedByName: submittedByNameOverride ?? leader.name,
      submittedAt: nowIso,
      records: {},
      reasons: {},
      sessionStatus: 'not-held',
      notHeldReason: draftNotHeldReason,
      markedNotHeldBy: actorDisplay,
    }

    const updated = {
      ...submissions,
      [currentSubmissionKey]: submission,
    }
    setDraftSessionStatus('not-held')
    setSubmissions(updated)
    savePeriodAttendanceSubmissions(updated)
    setJustSubmittedMessage(
      `${activePeriod.label} (${activePeriod.subject}) "ഉസ്താദ് ക്ലാസ് എടുത്തിട്ടില്ല (Class Not Held)" ആയി രേഖപ്പെടുത്തി. ഈ പിരീഡിൽ വിദ്യാർത്ഥികളുടെ ഹാജർ ലോക്ക് ചെയ്തിരിക്കുന്നു.`,
    )
  }

  function handleSubmitPeriodAttendance() {
    if (isSessionNotHeld) {
      handleSaveClassNotHeld()
      return
    }

    const nowIso = new Date().toISOString()
    const cleanReasons: Record<string, string> = {}
    for (const student of classStudents) {
      const stStatus = draftRecords[student.id] ?? 'present'
      if (stStatus === 'absent') {
        cleanReasons[student.id] = draftReasons[student.id] ?? ABSENT_REASONS[0]
      } else if (stStatus === 'leave') {
        cleanReasons[student.id] = draftReasons[student.id] ?? ATTENDANCE_LEAVE_REASONS[0]
      }
    }

    const effectiveTeacher =
      isSessionSubstituted && selectedSubstituteUsthad
        ? `${selectedSubstituteUsthad.shortName} (Substitute for ${activePeriod.teacher})`
        : activePeriod.teacher

    const submission: PeriodAttendanceSubmission = {
      key: currentSubmissionKey,
      date: selectedDate,
      className: leader.className,
      periodIndex: activePeriod.index,
      periodLabel: activePeriod.label,
      periodTime: activePeriod.time,
      subject: activePeriod.subject,
      teacher: effectiveTeacher,
      submittedByLeaderId: leaderId,
      submittedByName: submittedByNameOverride ?? leader.name,
      submittedAt: nowIso,
      records: { ...draftRecords },
      reasons: cleanReasons,
      sessionStatus: isSessionSubstituted ? 'substituted' : 'conducted',
      ...(isSessionSubstituted
        ? {
            notHeldReason: draftNotHeldReason,
            markedNotHeldBy:
              existingSubmission?.markedNotHeldBy ??
              `${effectiveRoleLabel} • ${submittedByNameOverride ?? leader.name}`,
            substituteUsthad: {
              usthadId: selectedSubstituteUsthad.id,
              usthadName: selectedSubstituteUsthad.name,
              assignedBy: `${effectiveRoleLabel} (${submittedByNameOverride ?? leader.name})`,
              assignedAt: nowIso,
            },
          }
        : {}),
    }

    const updated = {
      ...submissions,
      [currentSubmissionKey]: submission,
    }
    setSubmissions(updated)
    savePeriodAttendanceSubmissions(updated)
    setJustSubmittedMessage(
      isSessionSubstituted
        ? `${activePeriod.label} (${activePeriod.subject}) പകരക്കാരൻ ഉസ്താദ് (${selectedSubstituteUsthad.shortName}) എടുത്ത ക്ലാസ്സായി ഹാജർ രേഖപ്പെടുത്തി (${summaryCounts.present} Present, ${summaryCounts.absent} Absent, ${summaryCounts.leave} Leave).`
        : `${activePeriod.label} (${activePeriod.subject}) attendance submitted (${summaryCounts.present} Present, ${summaryCounts.absent} Absent, ${summaryCounts.leave} Leave).`,
    )
  }

  return (
    <Panel
      id="class-attendance"
      eyebrow={eyebrowLabel ?? `Class Leader Duty • ${leader.className}`}
      title="Class Period Session & Attendance Control"
      icon={UserCheck}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {periodStatusCountsForDate.notHeld > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-600 dark:text-red-400 tabular-nums">
              <Ban className="size-3.5" aria-hidden="true" />
              {periodStatusCountsForDate.notHeld} Not Held
            </span>
          )}
          {periodStatusCountsForDate.substituted > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan/40 bg-cyan/15 px-3 py-1 text-xs font-semibold text-cyan tabular-nums">
              <UserCog className="size-3.5" aria-hidden="true" />
              {periodStatusCountsForDate.substituted} Substituted
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-lime/40 dark:bg-lime/15 dark:text-lime tabular-nums">
            <UserCheck className="size-3.5" aria-hidden="true" />
            {periodStatusCountsForDate.totalSubmitted}/{periods.length} Periods Logged
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Top Bar: Date Picker & Leader Info */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Period-by-Period Session & Attendance Register • {leader.className}
            </p>
            <p className="text-sm text-foreground">
              Select each period below. If the Usthad did not take the class, mark{' '}
              <strong className="text-red-500 dark:text-red-400">
                Class Not Held (ഉസ്താദ് ക്ലാസ് എടുത്തിട്ടില്ല)
              </strong>{' '}
              to lock student attendance and alert the Principal.
            </p>
            {classLeaders.length > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Authorized Class Leaders:{' '}
                {classLeaders.map((cl, idx) => (
                  <span key={cl.leaderId}>
                    {idx > 0 ? '  •  ' : ''}
                    <strong className="text-cyan">
                      {cl.roleTitle}: {cl.studentName} ({cl.leaderId})
                    </strong>
                  </span>
                ))}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label
              htmlFor="leader-attendance-date"
              className="text-xs font-semibold tracking-wider text-muted-foreground uppercase whitespace-nowrap"
            >
              Date
            </label>
            <Input
              id="leader-attendance-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value || getTodayDateString())}
              className="h-10 w-44 rounded-xl tabular-nums"
            />
          </div>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Select Period (Semester {CURRENT_SEMESTER} Schedule)
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {activePeriod.time}
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Class periods"
            className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5"
          >
            {periods.map((period) => {
              const periodKey = `${selectedDate}__${leader.className}__${period.index}`
              const sub = submissions[periodKey]
              const isSubmitted = Boolean(sub)
              const sessionState = sub?.sessionStatus ?? (isSubmitted ? 'conducted' : 'pending')
              const isSelected = period.index === activePeriod.index

              return (
                <button
                  key={period.index}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedPeriodIndex(period.index)}
                  className={cn(
                    'flex flex-col justify-between gap-2 rounded-2xl border p-3.5 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isSelected
                      ? sessionState === 'not-held'
                        ? 'border-red-500 bg-red-500/10 shadow-[0_0_0_1px_rgba(239,68,68,0.6)]'
                        : 'border-lime bg-lime/10 shadow-[0_0_0_1px_var(--lime)]'
                      : sessionState === 'not-held'
                        ? 'border-red-500/40 bg-red-500/[0.04] hover:border-red-500/70'
                        : 'border-border bg-background/60 hover:border-foreground/30 hover:bg-background',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'text-xs font-bold tracking-wider uppercase',
                        isSelected
                          ? sessionState === 'not-held'
                            ? 'text-red-500 dark:text-red-400'
                            : 'text-lime'
                          : 'text-foreground',
                      )}
                    >
                      {period.label}
                    </span>
                    {sessionState === 'not-held' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
                        <Ban className="size-3.5" aria-hidden="true" />
                        Not Held
                      </span>
                    ) : sessionState === 'substituted' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan">
                        <UserCog className="size-3.5" aria-hidden="true" />
                        Substituted
                      </span>
                    ) : isSubmitted ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-lime">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        Conducted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        <Clock className="size-3" aria-hidden="true" />
                        Pending
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="line-clamp-1 text-sm font-semibold text-foreground">
                      {period.subject}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {sub?.substituteUsthad
                        ? `Sub: ${sub.substituteUsthad.usthadName}`
                        : period.teacher}
                    </p>
                  </div>

                  <p className="text-[11px] font-medium text-muted-foreground tabular-nums">
                    {period.time}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Period Session Status Control Bar (Conducted vs Class Not Held vs Substitute Usthad) */}
        <div
          className={cn(
            'flex flex-col gap-4 rounded-2xl border p-4 transition-colors',
            isSessionNotHeld
              ? 'border-red-500/50 bg-red-500/[0.06]'
              : isSessionSubstituted
                ? 'border-cyan/50 bg-cyan/[0.06]'
                : 'border-border bg-background/60',
          )}
        >
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {activePeriod.label} Session Control • ക്ലാസ് നടന്നോ എന്ന് തിരഞ്ഞെടുക്കുക
              </p>
              <p className="mt-0.5 text-sm text-foreground">
                ഉസ്താദ് ക്ലാസ് എടുത്തിട്ടില്ലെങ്കിൽ{' '}
                <strong className="text-red-600 dark:text-red-400">
                  &ldquo;Class Not Held (ഉസ്താദ് ക്ലാസ് എടുത്തിട്ടില്ല)&rdquo;
                </strong>{' '}
                തിരഞ്ഞെടുക്കുക. അപ്പോൾ വിദ്യാർത്ഥികളുടെ ഹാജർ ലോക്ക് ആകും.
              </p>
            </div>

            <div
              role="radiogroup"
              aria-label="Period session status"
              className="flex flex-wrap items-center gap-2"
            >
              <button
                type="button"
                role="radio"
                aria-checked={draftSessionStatus === 'conducted'}
                onClick={() => {
                  setDraftSessionStatus('conducted')
                  setJustSubmittedMessage(null)
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all',
                  draftSessionStatus === 'conducted'
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:border-lime dark:bg-lime/20 dark:text-lime'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground',
                )}
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Class Conducted (ക്ലാസ് നടന്നു)
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={draftSessionStatus === 'not-held'}
                onClick={() => {
                  setDraftSessionStatus('not-held')
                  setJustSubmittedMessage(null)
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all',
                  draftSessionStatus === 'not-held'
                    ? 'border-red-500 bg-red-500/20 text-red-700 dark:border-red-400 dark:text-red-300'
                    : 'border-border bg-background text-muted-foreground hover:border-red-500/40 hover:text-red-500',
                )}
              >
                <Ban className="size-4" aria-hidden="true" />
                Class Not Held (ഉസ്താദ് ക്ലാസ് എടുത്തിട്ടില്ല)
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={draftSessionStatus === 'substituted'}
                onClick={() => {
                  setDraftSessionStatus('substituted')
                  setJustSubmittedMessage(null)
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all',
                  draftSessionStatus === 'substituted'
                    ? 'border-cyan bg-cyan/20 text-cyan'
                    : 'border-border bg-background text-muted-foreground hover:border-cyan/40 hover:text-cyan',
                )}
              >
                <UserCog className="size-4" aria-hidden="true" />
                Substitute Usthad (പകരക്കാരൻ ഉസ്താദ്)
              </button>
            </div>
          </div>

          {/* Reason & Substitute Controls when Not Held or Substituted */}
          {(isSessionNotHeld || isSessionSubstituted) && (
            <div className="flex flex-col gap-3 border-t border-border/70 pt-3">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  ഉസ്താദ് ക്ലാസ് എടുക്കാത്തതിന്റെ കാരണം (Reason Why Regular Usthad Did Not Take Class):
                </span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {NOT_HELD_REASONS.map((reason) => {
                    const isSelected = draftNotHeldReason === reason
                    return (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => {
                          setDraftNotHeldReason(reason)
                          setJustSubmittedMessage(null)
                        }}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-all',
                          isSelected
                            ? isSessionNotHeld
                              ? 'border-red-500 bg-red-500/15 font-semibold text-red-700 dark:border-red-400 dark:text-red-200'
                              : 'border-cyan bg-cyan/15 font-semibold text-cyan'
                            : 'border-border bg-background/80 text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {isSelected ? (
                          <Check className="size-3.5 shrink-0" aria-hidden="true" />
                        ) : (
                          <span className="size-3.5 shrink-0 rounded-full border border-muted-foreground/40" />
                        )}
                        <span className="line-clamp-1">{reason}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {isSessionSubstituted && (
                <div className="flex flex-col justify-between gap-3 rounded-xl border border-cyan/30 bg-cyan/5 p-3 sm:flex-row sm:items-center">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-cyan uppercase">
                      Assign Substitute Usthad (പകരക്കാരൻ ഉസ്താദിനെ നിശ്ചയിക്കുക)
                    </span>
                    <span className="text-xs text-muted-foreground">
                      പകരക്കാരൻ ഉസ്താദ് ക്ലാസ് എടുക്കുമ്പോൾ വിദ്യാർത്ഥികളുടെ ഹാജർ രേഖപ്പെടുത്താവുന്നതാണ്.
                    </span>
                  </div>
                  <select
                    aria-label="Select Substitute Usthad"
                    value={draftSubstituteUsthadId}
                    onChange={(e) => {
                      setDraftSubstituteUsthadId(e.target.value)
                      setJustSubmittedMessage(null)
                    }}
                    className="h-10 rounded-xl border border-cyan/40 bg-background px-3 text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                  >
                    {CLASS_USTHADS.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.staffId} • {u.className})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isSessionNotHeld && (
                <div className="flex flex-col justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-2.5">
                    <Lock className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                    <div className="flex flex-col gap-0.5">
                      <p className="text-xs font-bold text-red-700 dark:text-red-300">
                        Student Attendance Locked — ക്ലാസ് നടക്കാത്ത സമയത്ത് ഹാജർ രേഖപ്പെടുത്താൻ സാധിക്കില്ല
                      </p>
                      <p className="text-xs text-red-600/90 dark:text-red-300/90">
                        ഈ പിരീഡിൽ ഉസ്താദ് ക്ലാസ് എടുത്തിട്ടില്ലാത്തതിനാൽ വിദ്യാർത്ഥികളുടെ Present / Absent / Leave ബട്ടണുകൾ ലോക്ക് ചെയ്തിരിക്കുന്നു. പ്രിൻസിപ്പൽ ഡാഷ്‌ബോർഡിൽ ഇത് നേരിട്ട് കാണാം.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handleSaveClassNotHeld}
                    className="h-10 rounded-xl bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700 whitespace-nowrap shrink-0"
                  >
                    <ShieldAlert className="mr-1.5 size-4" aria-hidden="true" />
                    Confirm Class Not Held
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Active Period Banner + Live Counters */}
        <div className="grid gap-4 rounded-2xl border border-border bg-background/60 p-4 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-lime uppercase">{activePeriod.label}</span>
              <span aria-hidden="true">•</span>
              <span className="tabular-nums">{activePeriod.time}</span>
              <span aria-hidden="true">•</span>
              <span>
                {isSessionSubstituted && selectedSubstituteUsthad
                  ? `Substitute: ${selectedSubstituteUsthad.name} (for ${activePeriod.teacher})`
                  : activePeriod.teacher}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="font-display text-lg font-bold text-foreground sm:text-xl">
                {activePeriod.subject}
              </h3>
              {isSessionNotHeld && (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/15 px-2.5 py-0.5 text-xs font-bold text-red-600 dark:text-red-400">
                  <Ban className="size-3" aria-hidden="true" />
                  Class Not Held • Attendance Locked
                </span>
              )}
              {isSessionSubstituted && (
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan/40 bg-cyan/15 px-2.5 py-0.5 text-xs font-bold text-cyan">
                  <UserCog className="size-3" aria-hidden="true" />
                  Substitute Usthad Active
                </span>
              )}
            </div>
            {existingSubmission ? (
              <p
                className={cn(
                  'text-xs',
                  existingSubmission.sessionStatus === 'not-held'
                    ? 'font-medium text-red-600 dark:text-red-400'
                    : 'text-emerald-600 dark:text-lime',
                )}
              >
                {existingSubmission.sessionStatus === 'not-held'
                  ? `Marked as Class Not Held by ${existingSubmission.markedNotHeldBy ?? existingSubmission.submittedByName} • Reason: ${existingSubmission.notHeldReason ?? NOT_HELD_REASONS[0]}`
                  : `Last submitted by ${existingSubmission.submittedByName} (${existingSubmission.submittedByLeaderId}) at ${new Date(
                      existingSubmission.submittedAt,
                    ).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Attendance not yet submitted for {activePeriod.label} on {selectedDate}.
              </p>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-xl border border-border bg-card/70 px-2.5 py-2">
              <p className="text-[11px] font-medium text-muted-foreground">Total</p>
              <p className="mt-0.5 font-display text-lg font-bold text-foreground tabular-nums">
                {summaryCounts.total}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2">
              <p className="text-[11px] font-medium text-emerald-700 dark:text-lime">Present</p>
              <p className="mt-0.5 font-display text-lg font-bold text-emerald-700 dark:text-lime tabular-nums">
                {isSessionNotHeld ? '—' : summaryCounts.present}
              </p>
            </div>
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-2.5 py-2">
              <p className="text-[11px] font-medium text-red-600 dark:text-red-400">Absent</p>
              <p className="mt-0.5 font-display text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">
                {isSessionNotHeld ? '—' : summaryCounts.absent}
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-2">
              <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Leave</p>
              <p className="mt-0.5 font-display text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                {isSessionNotHeld ? '—' : summaryCounts.leave}
              </p>
            </div>
          </div>
        </div>

        {/* Search & Bulk Actions */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student name or admission no..."
              className="h-10 rounded-xl pl-10 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSessionNotHeld}
              onClick={handleMarkAllPresent}
              className="rounded-xl text-xs font-semibold"
            >
              <Users className="mr-1.5 size-3.5" aria-hidden="true" />
              Mark All Present
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetPeriod}
              className="rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="mr-1.5 size-3.5" aria-hidden="true" />
              Reset
            </Button>
          </div>
        </div>

        {/* Student Roster List for Selected Period */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-background/50">
          {isSessionNotHeld && (
            <div className="flex items-center justify-between gap-3 border-b border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-700 dark:text-red-300">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                <span>
                  {activePeriod.label} ({activePeriod.subject}) ക്ലാസ് നടക്കാത്തതിനാൽ വിദ്യാർത്ഥികളുടെ ഹാജർ രേഖപ്പെടുത്തൽ ലോക്ക് ചെയ്തിരിക്കുന്നു.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDraftSessionStatus('substituted')}
                className="rounded-lg border border-cyan/50 bg-cyan/15 px-2.5 py-1 text-[11px] font-bold text-cyan hover:bg-cyan/25 whitespace-nowrap shrink-0"
              >
                Assign Substitute Usthad to Unlock
              </button>
            </div>
          )}

          <div className="hidden grid-cols-[2.5rem_1.5fr_1fr_1.4fr] items-center gap-4 border-b border-border bg-muted/40 px-4 py-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase sm:grid">
            <span>#</span>
            <span>Student Name</span>
            <span>Admission No.</span>
            <span className="text-right">{activePeriod.label} Status</span>
          </div>

          <div className={cn('divide-y divide-border', isSessionNotHeld && ' opacity-60')}>
            {filteredStudents.map((student, index) => {
              const status = draftRecords[student.id] ?? 'present'
              const isLiveOnLeave = onLeaveStudentIds.has(student.id)
              const reasonOptions =
                !isSessionNotHeld && status === 'absent'
                  ? ABSENT_REASONS
                  : !isSessionNotHeld && status === 'leave'
                    ? ATTENDANCE_LEAVE_REASONS
                    : null
              const selectedReason =
                draftReasons[student.id] ??
                (status === 'absent'
                  ? ABSENT_REASONS[0]
                  : status === 'leave'
                    ? ATTENDANCE_LEAVE_REASONS[0]
                    : '')

              return (
                <div
                  key={student.id}
                  className={cn(
                    'flex flex-col gap-2.5 px-4 py-3 transition-colors hover:bg-muted/25',
                    !isSessionNotHeld && status === 'absent' && 'bg-red-500/[0.03]',
                    !isSessionNotHeld && status === 'leave' && 'bg-amber-500/[0.03]',
                  )}
                >
                  <div className="flex flex-col justify-between gap-3 sm:grid sm:grid-cols-[2.5rem_1.5fr_1fr_1.4fr] sm:items-center sm:gap-4">
                    <span className="hidden text-xs font-medium text-muted-foreground tabular-nums sm:inline">
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    <div className="flex flex-col">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{student.name}</span>
                        {(() => {
                          const clMatch = classLeaders.find((c) => c.studentId === student.id)
                          if (!clMatch) return null
                          const isCurrent = highlightLeaderBadge && student.id === leader.id
                          return (
                            <span className="rounded-md bg-cyan/15 px-1.5 py-0.5 text-[10px] font-bold text-cyan">
                              {clMatch.roleTitle} ({clMatch.leaderId}){isCurrent ? ' • You' : ''}
                            </span>
                          )
                        })()}
                        {isLiveOnLeave && (
                          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            • On Leave in Register
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums sm:hidden">
                        {student.admissionNo}
                      </span>
                    </div>

                    <span className="hidden text-xs font-medium text-muted-foreground tabular-nums sm:inline">
                      {student.admissionNo}
                    </span>

                    <div
                      role="radiogroup"
                      aria-label={`Attendance status for ${student.name} in ${activePeriod.label}`}
                      className="flex items-center justify-end gap-1.5"
                    >
                      {isSessionNotHeld ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                          <Lock className="size-3.5" aria-hidden="true" />
                          Class Not Held (Locked)
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={status === 'present'}
                            onClick={() => handleStatusChange(student.id, 'present')}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all',
                              status === 'present'
                                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:border-lime dark:bg-lime/20 dark:text-lime'
                                : 'border-border bg-background text-muted-foreground hover:text-foreground',
                            )}
                          >
                            <UserCheck className="size-3.5" aria-hidden="true" />
                            Present
                          </button>

                          <button
                            type="button"
                            role="radio"
                            aria-checked={status === 'absent'}
                            onClick={() => handleStatusChange(student.id, 'absent')}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all',
                              status === 'absent'
                                ? 'border-red-500 bg-red-500/15 text-red-600 dark:border-red-400 dark:bg-red-500/20 dark:text-red-400'
                                : 'border-border bg-background text-muted-foreground hover:text-foreground',
                            )}
                          >
                            <UserX className="size-3.5" aria-hidden="true" />
                            Absent
                          </button>

                          <button
                            type="button"
                            role="radio"
                            aria-checked={status === 'leave'}
                            onClick={() => handleStatusChange(student.id, 'leave')}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all',
                              status === 'leave'
                                ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:border-amber-400 dark:bg-amber-500/20 dark:text-amber-300'
                                : 'border-border bg-background text-muted-foreground hover:text-foreground',
                            )}
                          >
                            <UserMinus className="size-3.5" aria-hidden="true" />
                            Leave
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setReportStudent(student)}
                        title={`Generate Parent PDF Report for ${student.name}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-cyan/40 bg-cyan/10 px-2.5 py-1.5 text-xs font-semibold text-cyan transition-all hover:bg-cyan/20 whitespace-nowrap shrink-0"
                      >
                        <FileText className="size-3.5" aria-hidden="true" />
                        Parent PDF
                      </button>
                    </div>
                  </div>

                  {/* 4-Reason Selector Bar when Absent or Leave is touched */}
                  {reasonOptions ? (
                    <div
                      className={cn(
                        'flex flex-col gap-2 rounded-xl border p-2.5 sm:ml-10 sm:flex-row sm:items-center sm:justify-between',
                        status === 'absent'
                          ? 'border-red-500/30 bg-red-500/5'
                          : 'border-amber-500/30 bg-amber-500/5',
                      )}
                    >
                      <span
                        className={cn(
                          'text-[11px] font-semibold tracking-wider uppercase whitespace-nowrap',
                          status === 'absent'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-700 dark:text-amber-300',
                        )}
                      >
                        {status === 'absent' ? 'Select Absent Reason:' : 'Select Leave Reason:'}
                      </span>

                      <div
                        role="radiogroup"
                        aria-label={`${status === 'absent' ? 'Absent' : 'Leave'} reason for ${student.name}`}
                        className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4"
                      >
                        {reasonOptions.map((reason) => {
                          const isReasonSelected = selectedReason === reason
                          return (
                            <button
                              key={reason}
                              type="button"
                              role="radio"
                              aria-checked={isReasonSelected}
                              onClick={() => handleReasonChange(student.id, reason)}
                              className={cn(
                                'flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all',
                                isReasonSelected
                                  ? status === 'absent'
                                    ? 'border-red-500 bg-red-500/20 font-semibold text-red-700 dark:border-red-400 dark:text-red-300'
                                    : 'border-amber-500 bg-amber-500/20 font-semibold text-amber-800 dark:border-amber-400 dark:text-amber-200'
                                  : 'border-border bg-background/80 text-muted-foreground hover:text-foreground',
                              )}
                            >
                              {isReasonSelected ? (
                                <Check className="size-3 shrink-0" aria-hidden="true" />
                              ) : null}
                              <span className="truncate">{reason}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        {/* Submit Footer & Confirmation Message */}
        <div className="flex flex-col justify-between gap-4 border-t border-border pt-4 sm:flex-row sm:items-center">
          <div role="status" aria-live="polite" className="text-sm">
            {justSubmittedMessage ? (
              <p className="flex items-center gap-2 font-medium text-emerald-600 dark:text-lime">
                <Check className="size-4 shrink-0" aria-hidden="true" />
                {justSubmittedMessage}
              </p>
            ) : isSessionNotHeld ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                ഈ പിരീഡിൽ ഉസ്താദ് ക്ലാസ് എടുത്തിട്ടില്ലെങ്കിൽ &ldquo;Record Class Not Held&rdquo; അമർത്തുക. വിദ്യാർത്ഥികളുടെ ഹാജർ രേഖപ്പെടുത്തൽ ലോക്ക് ചെയ്യപ്പെടും.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Submitting saves {activePeriod.label} ({activePeriod.subject}) attendance and selected Absent/Leave reasons for{' '}
                <span className="font-medium text-foreground">{leader.className}</span>.
              </p>
            )}
          </div>

          <Button
            type="button"
            onClick={handleSubmitPeriodAttendance}
            className={cn(
              'h-11 rounded-full px-6 text-sm font-semibold whitespace-nowrap shrink-0',
              isSessionNotHeld && 'bg-red-600 text-white hover:bg-red-700',
            )}
          >
            {isSessionNotHeld ? (
              <>
                <Ban className="mr-2 size-4" aria-hidden="true" />
                Record {activePeriod.label} as Class Not Held
              </>
            ) : (
              <>
                <Send className="mr-2 size-4" aria-hidden="true" />
                {existingSubmission
                  ? `Update ${activePeriod.label} Attendance`
                  : `Submit ${activePeriod.label} Attendance`}
              </>
            )}
          </Button>
        </div>
      </div>

      <ParentReportModal
        student={reportStudent}
        onClose={() => setReportStudent(null)}
        initialDate={selectedDate}
        preparedByRole={effectiveRoleLabel}
        preparedByName={submittedByNameOverride ?? leader.name}
        preparedById={leaderId}
        livePeriodDraft={
          reportStudent && !isSessionNotHeld
            ? {
                periodIndex: activePeriod.index,
                status: draftRecords[reportStudent.id] ?? 'present',
                reason: draftReasons[reportStudent.id],
              }
            : undefined
        }
      />
    </Panel>
  )
}
