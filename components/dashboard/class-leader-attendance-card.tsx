'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  CheckCircle2,
  Clock,
  FileText,
  RotateCcw,
  Search,
  Send,
  UserCheck,
  UserMinus,
  UserX,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ABSENT_REASONS,
  ATTENDANCE_LEAVE_REASONS,
  CURRENT_SEMESTER,
  getClassLeadersForClass,
  getClassSemesterTimetable,
  loadPeriodAttendanceSubmissions,
  savePeriodAttendanceSubmissions,
  students,
  type PeriodAttendanceStatus,
  type PeriodAttendanceSubmission,
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
}

export function ClassLeaderAttendanceCard({
  leader,
  leaderId,
  eyebrowLabel,
  submittedByNameOverride,
  highlightLeaderBadge = true,
}: ClassLeaderAttendanceCardProps) {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString)
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState<number>(1)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [submissions, setSubmissions] = useState<Record<string, PeriodAttendanceSubmission>>({})
  const [draftRecords, setDraftRecords] = useState<Record<string, PeriodAttendanceStatus>>({})
  const [draftReasons, setDraftReasons] = useState<Record<string, string>>({})
  const [onLeaveStudentIds, setOnLeaveStudentIds] = useState<Set<string>>(new Set())
  const [justSubmittedMessage, setJustSubmittedMessage] = useState<string | null>(null)
  const [reportStudent, setReportStudent] = useState<Student | null>(null)

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
    if (saved && saved.records) {
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
  }, [currentSubmissionKey, submissions, classStudents, onLeaveStudentIds])

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
  }, [classStudents, draftRecords])

  const submittedPeriodsCountForDate = useMemo(() => {
    return periods.filter(
      (p) => Boolean(submissions[`${selectedDate}__${leader.className}__${p.index}`]),
    ).length
  }, [periods, submissions, selectedDate, leader.className])

  function handleStatusChange(studentId: string, status: PeriodAttendanceStatus) {
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
    setDraftReasons((prev) => ({
      ...prev,
      [studentId]: reason,
    }))
    setJustSubmittedMessage(null)
  }

  function handleMarkAllPresent() {
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
    if (existingSubmission) {
      setDraftRecords({ ...existingSubmission.records })
      setDraftReasons({ ...(existingSubmission.reasons ?? {}) })
    } else {
      handleMarkAllPresent()
    }
    setJustSubmittedMessage(null)
  }

  function handleSubmitPeriodAttendance() {
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
      records: { ...draftRecords },
      reasons: cleanReasons,
    }

    const updated = {
      ...submissions,
      [currentSubmissionKey]: submission,
    }
    setSubmissions(updated)
    savePeriodAttendanceSubmissions(updated)
    setJustSubmittedMessage(
      `${activePeriod.label} (${activePeriod.subject}) attendance submitted (${summaryCounts.present} Present, ${summaryCounts.absent} Absent, ${summaryCounts.leave} Leave).`,
    )
  }

  return (
    <Panel
      id="class-attendance"
      eyebrow={eyebrowLabel ?? `Class Leader Duty • ${leader.className}`}
      title="Class Attendance Submission"
      icon={UserCheck}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan/40 bg-cyan/15 px-3 py-1 text-xs font-semibold text-cyan tabular-nums">
            <UserCheck className="size-3.5" aria-hidden="true" />
            {submittedPeriodsCountForDate}/{periods.length} Periods Submitted
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Top Bar: Date Picker & Leader Info */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Period-by-Period Attendance Register • Main & Assistant Class Leaders
            </p>
            <p className="text-sm text-foreground">
              Select each period below, mark student status for{' '}
              <span className="font-semibold text-lime">{leader.className}</span>, and choose a reason when marking Absent or Leave.
            </p>
            {classLeaders.length > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Authorized Leaders (Same Role & Permissions):{' '}
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
              const isSubmitted = Boolean(submissions[periodKey])
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
                      ? 'border-lime bg-lime/10 shadow-[0_0_0_1px_var(--lime)]'
                      : 'border-border bg-background/60 hover:border-foreground/30 hover:bg-background',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'text-xs font-bold tracking-wider uppercase',
                        isSelected ? 'text-lime' : 'text-foreground',
                      )}
                    >
                      {period.label}
                    </span>
                    {isSubmitted ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-lime">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        Submitted
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
                      {period.teacher}
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

        {/* Active Period Banner + Live Counters */}
        <div className="grid gap-4 rounded-2xl border border-border bg-background/60 p-4 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-lime uppercase">{activePeriod.label}</span>
              <span aria-hidden="true">•</span>
              <span className="tabular-nums">{activePeriod.time}</span>
              <span aria-hidden="true">•</span>
              <span>{activePeriod.teacher}</span>
            </div>
            <h3 className="font-display text-lg font-bold text-foreground sm:text-xl">
              {activePeriod.subject}
            </h3>
            {existingSubmission ? (
              <p className="text-xs text-emerald-600 dark:text-lime">
                Last submitted by {existingSubmission.submittedByName} (
                {existingSubmission.submittedByLeaderId}) at{' '}
                {new Date(existingSubmission.submittedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
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
                {summaryCounts.present}
              </p>
            </div>
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-2.5 py-2">
              <p className="text-[11px] font-medium text-red-600 dark:text-red-400">Absent</p>
              <p className="mt-0.5 font-display text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">
                {summaryCounts.absent}
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-2">
              <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Leave</p>
              <p className="mt-0.5 font-display text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                {summaryCounts.leave}
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
        <div className="overflow-hidden rounded-2xl border border-border bg-background/50">
          <div className="hidden grid-cols-[2.5rem_1.5fr_1fr_1.4fr] items-center gap-4 border-b border-border bg-muted/40 px-4 py-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase sm:grid">
            <span>#</span>
            <span>Student Name</span>
            <span>Admission No.</span>
            <span className="text-right">{activePeriod.label} Status</span>
          </div>

          <div className="divide-y divide-border">
            {filteredStudents.map((student, index) => {
              const status = draftRecords[student.id] ?? 'present'
              const isLiveOnLeave = onLeaveStudentIds.has(student.id)
              const reasonOptions =
                status === 'absent'
                  ? ABSENT_REASONS
                  : status === 'leave'
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
                    status === 'absent' && 'bg-red-500/[0.03]',
                    status === 'leave' && 'bg-amber-500/[0.03]',
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
            className="h-11 rounded-full px-6 text-sm font-semibold whitespace-nowrap shrink-0"
          >
            <Send className="mr-2 size-4" aria-hidden="true" />
            {existingSubmission
              ? `Update ${activePeriod.label} Attendance`
              : `Submit ${activePeriod.label} Attendance`}
          </Button>
        </div>
      </div>

      <ParentReportModal
        student={reportStudent}
        onClose={() => setReportStudent(null)}
        initialDate={selectedDate}
        preparedByRole={highlightLeaderBadge ? 'Class Leader' : 'Class Usthad'}
        preparedByName={submittedByNameOverride ?? leader.name}
        preparedById={leaderId}
        livePeriodDraft={
          reportStudent
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
