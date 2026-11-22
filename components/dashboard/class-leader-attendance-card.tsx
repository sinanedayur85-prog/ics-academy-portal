'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  FileText,
  History,
  Lock,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Trash2,
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
  CLASS_USTHADS,
  NOT_HELD_REASONS,
  OFFICIAL_CLASS_USTHADS,
  deletePeriodAttendanceSubmission,
  doesUsthadMatchTeacherName,
  getActiveSemester,
  getClassLeadersForClass,
  getClassSemesterTimetable,
  isNonTeachingTimetableSlot,
  loadPeriodAttendanceSubmissions,
  savePeriodAttendanceSubmissions,
  students,
  type ClassUsthad,
  type PeriodAttendanceStatus,
  type PeriodAttendanceSubmission,
  type PeriodSessionStatus,
  type Student,
} from '@/components/dashboard/data'
import { Panel } from '@/components/dashboard/panel'
import { ParentReportModal } from '@/components/dashboard/parent-report-modal'
import { cn } from '@/lib/utils'

const LEAVE_STORAGE_KEY = 'ics_leave_register_v2'

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
  actorRoleLabel?: 'Class Leader' | 'Usthad' | 'Class Usthad' | 'Principal'
  restrictedUsthad?: ClassUsthad
  controlledDate?: string
  onControlledDateChange?: (date: string) => void
  controlledPeriodIndex?: number
  onControlledPeriodIndexChange?: (periodIndex: number) => void
}

export function ClassLeaderAttendanceCard({
  leader,
  leaderId,
  eyebrowLabel,
  submittedByNameOverride,
  highlightLeaderBadge = true,
  actorRoleLabel,
  restrictedUsthad,
  controlledDate,
  onControlledDateChange,
  controlledPeriodIndex,
  onControlledPeriodIndexChange,
}: ClassLeaderAttendanceCardProps) {
  const [internalDate, setInternalDate] = useState<string>(getTodayDateString)
  const selectedDate = controlledDate ?? internalDate
  const setSelectedDate = (nextDate: string) => {
    const clean = nextDate || getTodayDateString()
    setInternalDate(clean)
    onControlledDateChange?.(clean)
  }

  const [internalPeriodIndex, setInternalPeriodIndex] = useState<number>(1)
  const selectedPeriodIndex = controlledPeriodIndex ?? internalPeriodIndex
  const setSelectedPeriodIndex = (nextIdx: number) => {
    setInternalPeriodIndex(nextIdx)
    onControlledPeriodIndexChange?.(nextIdx)
  }

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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false)
  const [reportStudent, setReportStudent] = useState<Student | null>(null)
  const [configVersion, setConfigVersion] = useState(0)

  const effectiveRoleLabel =
    actorRoleLabel ?? (highlightLeaderBadge ? 'Class Leader' : 'Usthad')
  const isStaffViewer =
    effectiveRoleLabel === 'Usthad' ||
    effectiveRoleLabel === 'Class Usthad' ||
    effectiveRoleLabel === 'Principal'

  const classStudents = useMemo(
    () => students.filter((s) => s.className === leader.className),
    [leader.className, configVersion],
  )

  const classLeaders = useMemo(
    () => getClassLeadersForClass(leader.className),
    [leader.className, configVersion],
  )

  const activeSemester = getActiveSemester()
  const timetable = useMemo(
    () => getClassSemesterTimetable(leader),
    [leader, configVersion],
  )
  const semesterSubjects =
    activeSemester === 1 ? timetable.semester1 : timetable.semester2

  const periods = useMemo(
    () =>
      timetable.periods.map((period, idx) => {
        const slot = semesterSubjects[idx] ?? {
          subject: 'General Study',
          teacher: 'Usthad',
        }
        return {
          index: idx + 1,
          label: period.label,
          time: period.time,
          subject: slot.subject,
          teacher: slot.teacher,
          isNonTeaching: isNonTeachingTimetableSlot(slot),
        }
      }),
    [timetable.periods, semesterSubjects],
  )

  // When restrictedUsthad is passed and class changes, auto-select the Usthad's first scheduled period in this class
  useEffect(() => {
    if (!restrictedUsthad) return
    const currentSlot = periods.find((p) => p.index === selectedPeriodIndex)
    if (
      currentSlot &&
      !currentSlot.isNonTeaching &&
      doesUsthadMatchTeacherName(restrictedUsthad, currentSlot.teacher)
    ) {
      return
    }
    const firstOwned = periods.find(
      (p) => !p.isNonTeaching && doesUsthadMatchTeacherName(restrictedUsthad, p.teacher),
    )
    if (firstOwned) {
      setInternalPeriodIndex(firstOwned.index)
      onControlledPeriodIndexChange?.(firstOwned.index)
    }
  }, [leader.className, restrictedUsthad, periods])

  const activePeriod =
    periods.find((p) => p.index === selectedPeriodIndex) ?? periods[0]

  const isActivePeriodNonTeaching = Boolean(activePeriod?.isNonTeaching)
  const teachingPeriodsCount = useMemo(
    () => periods.filter((p) => !p.isNonTeaching).length,
    [periods],
  )

  const isPeriodLockedForUsthad = useMemo(() => {
    if (isActivePeriodNonTeaching) return true
    if (!restrictedUsthad) return false
    return !doesUsthadMatchTeacherName(restrictedUsthad, activePeriod.teacher)
  }, [isActivePeriodNonTeaching, restrictedUsthad, activePeriod.teacher])

  const currentSubmissionKey = `${selectedDate}__${leader.className}__${activePeriod.index}`
  const existingSubmission = submissions[currentSubmissionKey]

  useEffect(() => {
    function syncAll() {
      setSubmissions(loadPeriodAttendanceSubmissions())
      setOnLeaveStudentIds(loadOnLeaveStudentIdsForClass(leader.className))
      setConfigVersion((v) => v + 1)
    }
    syncAll()
    window.addEventListener('ics-period-attendance-updated', syncAll)
    window.addEventListener('ics-academy-config-updated', syncAll)
    window.addEventListener('storage', syncAll)
    return () => {
      window.removeEventListener('ics-period-attendance-updated', syncAll)
      window.removeEventListener('ics-academy-config-updated', syncAll)
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
    setConfirmDeleteOpen(false)
  }, [currentSubmissionKey, submissions, classStudents, onLeaveStudentIds, leader.className])

  const isSessionNotHeld = draftSessionStatus === 'not-held'
  const isSessionSubstituted = draftSessionStatus === 'substituted'

  const selectedSubstituteUsthad = useMemo(
    () =>
      OFFICIAL_CLASS_USTHADS.find((u) => u.id === draftSubstituteUsthadId) ??
      CLASS_USTHADS.find((u) => u.id === draftSubstituteUsthadId) ??
      CLASS_USTHADS[0],
    [draftSubstituteUsthadId],
  )

  const hasUnsavedChanges = useMemo(() => {
    if (!existingSubmission) return true
    const savedSessionStatus: PeriodSessionStatus =
      existingSubmission.sessionStatus ?? 'conducted'
    if (draftSessionStatus !== savedSessionStatus) return true

    if (draftSessionStatus === 'not-held') {
      const savedReason = existingSubmission.notHeldReason ?? NOT_HELD_REASONS[0]
      return draftNotHeldReason !== savedReason
    }

    if (draftSessionStatus === 'substituted') {
      const savedReason = existingSubmission.notHeldReason ?? NOT_HELD_REASONS[0]
      if (draftNotHeldReason !== savedReason) return true
      const savedSubId = existingSubmission.substituteUsthad?.usthadId ?? ''
      if ((selectedSubstituteUsthad?.id ?? '') !== savedSubId) return true
    }

    for (const student of classStudents) {
      const curStatus = draftRecords[student.id] ?? 'present'
      const savedStatus = existingSubmission.records?.[student.id] ?? 'present'
      if (curStatus !== savedStatus) return true
      if (curStatus === 'absent') {
        const curReason = draftReasons[student.id] ?? ABSENT_REASONS[0]
        const savedReason = existingSubmission.reasons?.[student.id] ?? ABSENT_REASONS[0]
        if (curReason !== savedReason) return true
      } else if (curStatus === 'leave') {
        const curReason = draftReasons[student.id] ?? ATTENDANCE_LEAVE_REASONS[0]
        const savedReason =
          existingSubmission.reasons?.[student.id] ?? ATTENDANCE_LEAVE_REASONS[0]
        if (curReason !== savedReason) return true
      }
    }

    return false
  }, [
    existingSubmission,
    draftSessionStatus,
    draftNotHeldReason,
    selectedSubstituteUsthad,
    classStudents,
    draftRecords,
    draftReasons,
  ])

  const isAllDefaultPresent = useMemo(() => {
    if (isSessionNotHeld) return false
    return classStudents.every((s) => {
      const expected = onLeaveStudentIds.has(s.id) ? 'leave' : 'present'
      return (draftRecords[s.id] ?? 'present') === expected
    })
  }, [isSessionNotHeld, classStudents, onLeaveStudentIds, draftRecords])

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return classStudents
    return classStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        ((isStaffViewer || s.id === leader.id) &&
          s.admissionNo.toLowerCase().includes(q)),
    )
  }, [classStudents, searchQuery, isStaffViewer, leader.id])

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
      if (p.isNonTeaching) continue
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
    if (isSessionNotHeld || isPeriodLockedForUsthad) return
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
    if (isSessionNotHeld || isPeriodLockedForUsthad) return
    setDraftReasons((prev) => ({
      ...prev,
      [studentId]: reason,
    }))
    setJustSubmittedMessage(null)
  }

  function handleMarkAllPresent() {
    if (isSessionNotHeld || isPeriodLockedForUsthad) return
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
    if (isPeriodLockedForUsthad) return
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
    if (isPeriodLockedForUsthad) return
    if (existingSubmission && !hasUnsavedChanges) return
    const nowIso = new Date().toISOString()
    const actorName = submittedByNameOverride ?? leader.name
    const actorDisplay = `${effectiveRoleLabel} • ${actorName} (${leaderId})`
    const isUpdatingExisting = Boolean(existingSubmission)

    const persistedRole: 'Class Leader' | 'Class Usthad' | 'Principal' =
      effectiveRoleLabel === 'Usthad' ? 'Class Usthad' : effectiveRoleLabel

    const submission: PeriodAttendanceSubmission = {
      key: currentSubmissionKey,
      date: selectedDate,
      className: leader.className,
      periodIndex: activePeriod.index,
      periodLabel: activePeriod.label,
      periodTime: activePeriod.time,
      subject: activePeriod.subject,
      teacher: activePeriod.teacher,
      submittedByLeaderId: existingSubmission?.submittedByLeaderId ?? leaderId,
      submittedByName: existingSubmission?.submittedByName ?? actorName,
      submittedByRole: existingSubmission?.submittedByRole ?? persistedRole,
      submittedAt: existingSubmission?.submittedAt ?? nowIso,
      ...(isUpdatingExisting
        ? {
            lastEditedByName: actorName,
            lastEditedByRole: persistedRole,
            lastEditedById: leaderId,
            lastEditedAt: nowIso,
            editCount: (existingSubmission?.editCount ?? 0) + 1,
          }
        : { editCount: 0 }),
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
    setConfirmDeleteOpen(false)
    setJustSubmittedMessage(
      `${activePeriod.label} (${activePeriod.subject}) marked as "Class Not Held". Student attendance is locked for this period.`,
    )
  }

  function handleSubmitPeriodAttendance() {
    if (isPeriodLockedForUsthad) return
    if (existingSubmission && !hasUnsavedChanges) return
    if (isSessionNotHeld) {
      handleSaveClassNotHeld()
      return
    }

    const nowIso = new Date().toISOString()
    const actorName = submittedByNameOverride ?? leader.name
    const isUpdatingExisting = Boolean(existingSubmission)
    const persistedRole: 'Class Leader' | 'Class Usthad' | 'Principal' =
      effectiveRoleLabel === 'Usthad' ? 'Class Usthad' : effectiveRoleLabel

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
      submittedByLeaderId: existingSubmission?.submittedByLeaderId ?? leaderId,
      submittedByName: existingSubmission?.submittedByName ?? actorName,
      submittedByRole: existingSubmission?.submittedByRole ?? persistedRole,
      submittedAt: existingSubmission?.submittedAt ?? nowIso,
      ...(isUpdatingExisting
        ? {
            lastEditedByName: actorName,
            lastEditedByRole: persistedRole,
            lastEditedById: leaderId,
            lastEditedAt: nowIso,
            editCount: (existingSubmission?.editCount ?? 0) + 1,
          }
        : { editCount: 0 }),
      records: { ...draftRecords },
      reasons: cleanReasons,
      sessionStatus: 'conducted',
    }

    const updated = {
      ...submissions,
      [currentSubmissionKey]: submission,
    }
    setSubmissions(updated)
    savePeriodAttendanceSubmissions(updated)
    setConfirmDeleteOpen(false)
    setJustSubmittedMessage(
      isUpdatingExisting
        ? `${activePeriod.label} (${activePeriod.subject}) attendance updated (${summaryCounts.present} Present, ${summaryCounts.absent} Absent, ${summaryCounts.leave} Leave).`
        : `${activePeriod.label} (${activePeriod.subject}) attendance submitted (${summaryCounts.present} Present, ${summaryCounts.absent} Absent, ${summaryCounts.leave} Leave).`,
    )
  }

  function handleDeletePeriodSubmission() {
    if (isPeriodLockedForUsthad) return
    const actorName = submittedByNameOverride ?? leader.name
    const nextMap = deletePeriodAttendanceSubmission(currentSubmissionKey, {
      name: actorName,
      role: effectiveRoleLabel,
    })
    setSubmissions(nextMap)
    setDraftSessionStatus('conducted')
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
    setConfirmDeleteOpen(false)
    setJustSubmittedMessage(
      `${activePeriod.label} (${activePeriod.subject}) attendance deleted and reset to Pending.`,
    )
  }

  return (
    <Panel
      id="class-attendance"
      eyebrow={eyebrowLabel ?? (isStaffViewer ? leader.className : 'Daily Register')}
      title="Period Attendance"
      icon={UserCheck}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {periodStatusCountsForDate.notHeld > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-600 dark:text-red-400 tabular-nums">
              <Ban className="size-3.5" aria-hidden="true" />
              {periodStatusCountsForDate.notHeld} Not Held
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0095F6]/15 px-3 py-1 text-xs font-semibold text-[#0077CC] dark:text-[#0095F6] tabular-nums">
            <UserCheck className="size-3.5" aria-hidden="true" />
            {periodStatusCountsForDate.totalSubmitted}/{teachingPeriodsCount} Periods
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Top Bar: Date Picker & Leader Info */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl bg-muted/45 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {isStaffViewer ? `Class ${leader.className} Periods` : 'Daily Periods'}
            </p>
            {classLeaders.length > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Leaders:{' '}
                {classLeaders.map((cl, idx) => (
                  <span key={cl.leaderId}>
                    {idx > 0 ? '  ·  ' : ''}
                    <strong className="text-[#0077CC] dark:text-[#0095F6]">
                      {cl.studentName}
                      {isStaffViewer || cl.studentId === leader.id
                        ? ` (${cl.leaderId})`
                        : ''}
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
              className="h-10 w-44 rounded-full tabular-nums"
            />
          </div>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Select Period (Semester {activeSemester} Schedule)
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {activePeriod.time}
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Class periods"
            className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5"
          >
            {periods.map((period) => {
              const periodKey = `${selectedDate}__${leader.className}__${period.index}`
              const sub = !period.isNonTeaching ? submissions[periodKey] : undefined
              const isSubmitted = Boolean(sub)
              const sessionState = sub?.sessionStatus ?? (isSubmitted ? 'conducted' : 'pending')
              const isSelected = period.index === activePeriod.index
              const isOwnedByRestrictedUsthad = restrictedUsthad
                ? !period.isNonTeaching && doesUsthadMatchTeacherName(restrictedUsthad, period.teacher)
                : true
              const isBreakSlot =
                period.subject.toLowerCase().includes('refreshment') ||
                period.subject.toLowerCase().includes('break')

              return (
                <button
                  key={period.index}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedPeriodIndex(period.index)}
                  className={cn(
                    'flex flex-col justify-between gap-2 rounded-2xl p-3.5 text-left transition-all duration-150 outline-none active:scale-[0.98]',
                    period.isNonTeaching
                      ? isSelected
                        ? 'bg-muted/80 shadow-xs'
                        : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                      : isSelected
                        ? sessionState === 'not-held'
                          ? 'bg-red-500/15 shadow-xs'
                          : 'bg-[#0095F6]/15 shadow-xs'
                        : sessionState === 'not-held'
                          ? 'bg-red-500/[0.06] hover:bg-red-500/12'
                          : !isOwnedByRestrictedUsthad
                            ? 'bg-muted/30 opacity-80 hover:opacity-100'
                            : 'bg-muted/40 hover:bg-muted/70',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'text-xs font-bold tracking-wider uppercase',
                        period.isNonTeaching
                          ? 'text-muted-foreground'
                          : isSelected
                            ? sessionState === 'not-held'
                              ? 'text-red-500 dark:text-red-400'
                              : 'text-[#0077CC] dark:text-[#0095F6]'
                            : 'text-foreground',
                      )}
                    >
                      {period.label}
                    </span>
                    {period.isNonTeaching ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                        <Coffee className="size-3" aria-hidden="true" />
                        {isBreakSlot ? 'Break' : 'Free'}
                      </span>
                    ) : sessionState === 'not-held' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
                        <Ban className="size-3.5" aria-hidden="true" />
                        Not Held
                      </span>
                    ) : isSubmitted ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
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
                      {period.isNonTeaching
                        ? isBreakSlot
                          ? 'Refreshment Interval'
                          : 'No Class Scheduled'
                        : period.teacher}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground tabular-nums">
                      {period.time}
                    </p>
                    {restrictedUsthad && !period.isNonTeaching && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-[10px] font-bold',
                          isOwnedByRestrictedUsthad
                            ? 'text-[#0077CC] dark:text-[#0095F6]'
                            : 'text-muted-foreground',
                        )}
                      >
                        {isOwnedByRestrictedUsthad ? (
                          '• My Period'
                        ) : (
                          <>
                            <Lock className="size-2.5" aria-hidden="true" />
                            View Only
                          </>
                        )}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Break / Free Period Informational View (No Attendance Required) */}
        {isActivePeriodNonTeaching ? (
          <div className="flex flex-col justify-between gap-4 rounded-2xl bg-muted/40 p-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-muted-foreground">
                <Coffee className="size-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">
                  {activePeriod.label} ({activePeriod.subject}) • {activePeriod.time}
                </p>
                <p className="text-xs text-muted-foreground">
                  Break / Free period ({activePeriod.subject}). No attendance needed.
                </p>
              </div>
            </div>
            {(() => {
              const nextTeaching = restrictedUsthad
                ? periods.find(
                    (p) => !p.isNonTeaching && doesUsthadMatchTeacherName(restrictedUsthad, p.teacher),
                  )
                : periods.find((p) => !p.isNonTeaching)
              if (!nextTeaching) return null
              return (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setSelectedPeriodIndex(nextTeaching.index)}
                  className="shrink-0 rounded-full bg-[#0095F6] px-4 text-xs font-semibold text-white hover:bg-[#0077CC]"
                >
                  {restrictedUsthad ? 'My Period' : `Go to ${nextTeaching.label}`}
                </Button>
              )
            })()}
          </div>
        ) : (
          <>
        {/* Strict Period Ownership Lock Notice when viewing another Usthad's period */}
        {isPeriodLockedForUsthad && restrictedUsthad && (
          <div className="flex flex-col justify-between gap-3 rounded-2xl bg-amber-500/12 p-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <Lock
                className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  {activePeriod.label} ({activePeriod.subject}) — Assigned to{' '}
                  <span className="underline">{activePeriod.teacher}</span>
                </p>
                <p className="text-xs text-amber-800/90 dark:text-amber-300/90">
                  Only {activePeriod.teacher} or the Class Leader can edit attendance for this period.
                </p>
              </div>
            </div>
            {periods.some((p) => !p.isNonTeaching && doesUsthadMatchTeacherName(restrictedUsthad, p.teacher)) && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const myFirst = periods.find(
                    (p) => !p.isNonTeaching && doesUsthadMatchTeacherName(restrictedUsthad, p.teacher),
                  )
                  if (myFirst) setSelectedPeriodIndex(myFirst.index)
                }}
                className="shrink-0 rounded-full bg-[#0095F6] px-4 text-xs font-semibold text-white hover:bg-[#0077CC]"
              >
                My Period
              </Button>
            )}
          </div>
        )}

        {/* Period Session Status Control Bar (Conducted vs Class Not Held) */}
        <div
          className={cn(
            'flex flex-col gap-4 rounded-2xl p-4 transition-colors',
            isSessionNotHeld
              ? 'bg-red-500/10'
              : 'bg-muted/45',
            isPeriodLockedForUsthad && 'opacity-65',
          )}
        >
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {activePeriod.label} Status
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Select{' '}
                <strong className="text-red-600 dark:text-red-400">
                  &ldquo;Class Not Held&rdquo;
                </strong>{' '}
                if this session did not take place.
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
                disabled={isPeriodLockedForUsthad}
                aria-checked={draftSessionStatus === 'conducted'}
                onClick={() => {
                  if (isPeriodLockedForUsthad) return
                  setDraftSessionStatus('conducted')
                  setJustSubmittedMessage(null)
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
                  draftSessionStatus === 'conducted'
                    ? 'bg-emerald-500/18 text-emerald-700 dark:text-emerald-400'
                    : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Class Conducted
              </button>

              <button
                type="button"
                role="radio"
                disabled={isPeriodLockedForUsthad}
                aria-checked={draftSessionStatus === 'not-held'}
                onClick={() => {
                  if (isPeriodLockedForUsthad) return
                  setDraftSessionStatus('not-held')
                  setJustSubmittedMessage(null)
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
                  draftSessionStatus === 'not-held'
                    ? 'bg-red-500/20 text-red-700 dark:text-red-300'
                    : 'bg-card text-muted-foreground hover:bg-red-500/10 hover:text-red-500',
                )}
              >
                <Ban className="size-4" aria-hidden="true" />
                Class Not Held
              </button>
            </div>
          </div>

          {/* Reason Controls when Not Held */}
          {isSessionNotHeld && (
            <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Reason Why Regular Usthad Did Not Take Class:
                </span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {NOT_HELD_REASONS.map((reason) => {
                    const isSelected = draftNotHeldReason === reason
                    return (
                      <button
                        key={reason}
                        type="button"
                        disabled={isPeriodLockedForUsthad}
                        onClick={() => {
                          if (isPeriodLockedForUsthad) return
                          setDraftNotHeldReason(reason)
                          setJustSubmittedMessage(null)
                        }}
                        className={cn(
                          'flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition-all disabled:cursor-not-allowed',
                          isSelected
                            ? 'bg-red-500/18 font-semibold text-red-700 dark:text-red-200'
                            : 'bg-card/80 text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {isSelected ? (
                          <Check className="size-3.5 shrink-0" aria-hidden="true" />
                        ) : (
                          <span className="size-3.5 shrink-0 rounded-full bg-muted-foreground/25" />
                        )}
                        <span className="line-clamp-1">{reason}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {isSessionNotHeld && (
                <div className="flex flex-col justify-between gap-3 rounded-2xl bg-red-500/12 p-3.5 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-2.5">
                    <Lock className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                    <div className="flex flex-col gap-0.5">
                      <p className="text-xs font-bold text-red-700 dark:text-red-300">
                        Student Attendance Locked — Cannot record attendance when class is not held
                      </p>
                      <p className="text-xs text-red-600/90 dark:text-red-300/90">
                        Present / Absent / Leave controls are locked because the Usthad did not take this period. This status is visible on the Principal Dashboard.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    disabled={
                      isPeriodLockedForUsthad || Boolean(existingSubmission && !hasUnsavedChanges)
                    }
                    onClick={handleSaveClassNotHeld}
                    className="h-10 rounded-full bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <ShieldAlert className="mr-1.5 size-4" aria-hidden="true" />
                    {existingSubmission?.sessionStatus === 'not-held' && !hasUnsavedChanges
                      ? 'Class Not Held Saved ✓'
                      : 'Confirm Class Not Held'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Active Period Banner + Live Counters */}
        <div className="grid gap-4 rounded-2xl bg-muted/45 p-4 xl:grid-cols-[1.2fr_1fr] xl:items-center">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-[#0077CC] uppercase dark:text-[#0095F6]">
                {activePeriod.label}
              </span>
              <span aria-hidden="true">•</span>
              <span className="tabular-nums">{activePeriod.time}</span>
              <span aria-hidden="true">•</span>
              <span className="font-medium text-foreground">{activePeriod.teacher}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="font-display text-lg font-bold text-foreground sm:text-xl">
                {activePeriod.subject}
              </h3>
              {isSessionNotHeld && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-bold text-red-600 dark:text-red-400">
                  <Ban className="size-3" aria-hidden="true" />
                  Class Not Held • Attendance Locked
                </span>
              )}
              {isPeriodLockedForUsthad && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                  <Lock className="size-3" aria-hidden="true" />
                  Read-Only ({activePeriod.teacher})
                </span>
              )}
            </div>
            {existingSubmission ? (
              <div className="mt-1 flex flex-col gap-1">
                <p
                  className={cn(
                    'text-xs tabular-nums',
                    existingSubmission.sessionStatus === 'not-held'
                      ? 'font-medium text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400',
                  )}
                >
                  {existingSubmission.sessionStatus === 'not-held'
                    ? `Marked as Class Not Held by ${existingSubmission.markedNotHeldBy ?? existingSubmission.submittedByName} • Reason: ${existingSubmission.notHeldReason ?? NOT_HELD_REASONS[0]}`
                    : `Submitted by: ${existingSubmission.submittedByName}${
                        existingSubmission.submittedByRole
                          ? ` (${existingSubmission.submittedByRole})`
                          : isStaffViewer || existingSubmission.submittedByLeaderId === leaderId
                            ? ` (${existingSubmission.submittedByLeaderId})`
                            : ''
                      } • ${new Date(existingSubmission.submittedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`}
                </p>

                {existingSubmission.lastEditedAt && existingSubmission.lastEditedByName ? (
                  <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-[#0077CC] dark:text-[#0095F6] tabular-nums">
                    <History className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      Edited by:{' '}
                      <strong className="font-semibold">{existingSubmission.lastEditedByName}</strong>
                      {existingSubmission.lastEditedByRole
                        ? ` (${existingSubmission.lastEditedByRole})`
                        : ''}{' '}
                      •{' '}
                      {new Date(existingSubmission.lastEditedAt).toLocaleDateString([], {
                        day: '2-digit',
                        month: 'short',
                      })}{' '}
                      {new Date(existingSubmission.lastEditedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {existingSubmission.editCount && existingSubmission.editCount > 1
                        ? ` • Edited ${existingSubmission.editCount} times`
                        : ''}
                    </span>
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Attendance not yet submitted for {activePeriod.label} on {selectedDate}.
              </p>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-xl bg-card/85 px-2.5 py-2">
              <p className="text-[11px] font-medium text-muted-foreground">Total</p>
              <p className="mt-0.5 font-display text-lg font-bold text-foreground tabular-nums">
                {summaryCounts.total}
              </p>
            </div>
            <div className="rounded-xl bg-emerald-500/12 px-2.5 py-2">
              <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Present</p>
              <p className="mt-0.5 font-display text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {isSessionNotHeld ? '—' : summaryCounts.present}
              </p>
            </div>
            <div className="rounded-xl bg-red-500/12 px-2.5 py-2">
              <p className="text-[11px] font-medium text-red-600 dark:text-red-400">Absent</p>
              <p className="mt-0.5 font-display text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">
                {isSessionNotHeld ? '—' : summaryCounts.absent}
              </p>
            </div>
            <div className="rounded-xl bg-amber-500/12 px-2.5 py-2">
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
              placeholder={
                isStaffViewer
                  ? 'Search student name or admission no...'
                  : 'Search student name...'
              }
              className="h-10 rounded-full pl-10 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isSessionNotHeld || isPeriodLockedForUsthad || isAllDefaultPresent}
              onClick={handleMarkAllPresent}
              className="rounded-full text-xs font-semibold"
            >
              <Users className="mr-1.5 size-3.5" aria-hidden="true" />
              Mark All Present
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={
                isPeriodLockedForUsthad ||
                (existingSubmission
                  ? !hasUnsavedChanges
                  : draftSessionStatus === 'conducted' && isAllDefaultPresent)
              }
              onClick={handleResetPeriod}
              className="rounded-full text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="mr-1.5 size-3.5" aria-hidden="true" />
              Reset
            </Button>
          </div>
        </div>

        {/* Student Roster List for Selected Period */}
        <div className="relative overflow-hidden rounded-2xl bg-muted/35">
          {isSessionNotHeld && (
            <div className="flex items-center justify-between gap-3 bg-red-500/12 px-4 py-3 text-xs text-red-700 dark:text-red-300">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                <span>
                  Student attendance is locked because {activePeriod.label} ({activePeriod.subject}) was not held.
                </span>
              </div>
            </div>
          )}

          <div className="hidden grid-cols-[2.5rem_1.5fr_1fr_1.4fr] items-center gap-4 bg-muted/60 px-4 py-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase sm:grid">
            <span>#</span>
            <span>Student Name</span>
            <span>{isStaffViewer ? 'Admission No.' : 'Class'}</span>
            <span className="text-right">{activePeriod.label} Status</span>
          </div>

          <div
            className={cn(
              'divide-y divide-border/35',
              (isSessionNotHeld || isPeriodLockedForUsthad) && 'opacity-70',
            )}
          >
            {filteredStudents.map((student, index) => {
              const status = draftRecords[student.id] ?? 'present'
              const isLiveOnLeave = onLeaveStudentIds.has(student.id)
              const reasonOptions =
                !isSessionNotHeld && !isPeriodLockedForUsthad && status === 'absent'
                  ? ABSENT_REASONS
                  : !isSessionNotHeld && !isPeriodLockedForUsthad && status === 'leave'
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
                    'flex flex-col gap-2.5 px-4 py-3 transition-colors hover:bg-muted/35',
                    !isSessionNotHeld && status === 'absent' && 'bg-red-500/[0.05]',
                    !isSessionNotHeld && status === 'leave' && 'bg-amber-500/[0.05]',
                  )}
                >
                  <div className="flex flex-col justify-between gap-3 sm:grid sm:grid-cols-[2.5rem_1.5fr_1fr_1.4fr] sm:items-center sm:gap-4">
                    <span className="hidden text-xs font-medium text-muted-foreground tabular-nums sm:inline">
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    <div className="flex flex-col">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium whitespace-nowrap text-foreground">{student.name}</span>
                        {(() => {
                          const clMatch = classLeaders.find((c) => c.studentId === student.id)
                          if (!clMatch) return null
                          const isCurrent = highlightLeaderBadge && student.id === leader.id
                          return (
                            <span className="rounded-full bg-[#0095F6]/15 px-2 py-0.5 text-[10px] font-bold text-[#0077CC] dark:text-[#0095F6]">
                              {clMatch.roleTitle}
                              {isCurrent ? ' • You' : ''}
                            </span>
                          )
                        })()}
                        {isLiveOnLeave && (
                          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            • On Leave in Register
                          </span>
                        )}
                      </div>
                      {(isStaffViewer || student.id === leader.id) && (
                        <span className="text-xs text-muted-foreground tabular-nums sm:hidden">
                          {student.admissionNo}
                        </span>
                      )}
                    </div>

                    <span className="hidden text-xs font-medium text-muted-foreground tabular-nums sm:inline">
                      {isStaffViewer || student.id === leader.id
                        ? student.admissionNo
                        : ''}
                    </span>

                    <div
                      role="radiogroup"
                      aria-label={`Attendance status for ${student.name} in ${activePeriod.label}`}
                      className="flex flex-wrap items-center justify-start gap-1.5 sm:justify-end"
                    >
                      {isSessionNotHeld ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                          <Lock className="size-3.5" aria-hidden="true" />
                          Class Not Held (Locked)
                        </span>
                      ) : isPeriodLockedForUsthad ? (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase',
                            status === 'present'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : status === 'absent'
                                ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
                          )}
                        >
                          <Lock className="size-3" aria-hidden="true" />
                          {status}
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={status === 'present'}
                            onClick={() => handleStatusChange(student.id, 'present')}
                            className={cn(
                              'inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-all active:scale-[0.97] sm:px-3 sm:text-xs',
                              status === 'present'
                                ? 'bg-emerald-500/18 text-emerald-700 dark:text-emerald-400'
                                : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                          >
                            <UserCheck className="size-3.5 shrink-0" aria-hidden="true" />
                            Present
                          </button>

                          <button
                            type="button"
                            role="radio"
                            aria-checked={status === 'absent'}
                            onClick={() => handleStatusChange(student.id, 'absent')}
                            className={cn(
                              'inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-all active:scale-[0.97] sm:px-3 sm:text-xs',
                              status === 'absent'
                                ? 'bg-red-500/18 text-red-600 dark:text-red-400'
                                : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                          >
                            <UserX className="size-3.5 shrink-0" aria-hidden="true" />
                            Absent
                          </button>

                          <button
                            type="button"
                            role="radio"
                            aria-checked={status === 'leave'}
                            onClick={() => handleStatusChange(student.id, 'leave')}
                            className={cn(
                              'inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-all active:scale-[0.97] sm:px-3 sm:text-xs',
                              status === 'leave'
                                ? 'bg-amber-500/18 text-amber-700 dark:text-amber-300'
                                : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                          >
                            <UserMinus className="size-3.5 shrink-0" aria-hidden="true" />
                            Leave
                          </button>
                        </>
                      )}

                      {(isStaffViewer || student.id === leader.id) && (
                        <button
                          type="button"
                          onClick={() => setReportStudent(student)}
                          title={`Generate Parent PDF Report for ${student.name}`}
                          className="inline-flex items-center justify-center gap-1 rounded-full bg-[#0095F6]/15 px-2.5 py-1.5 text-[11px] font-semibold text-[#0077CC] dark:text-[#0095F6] transition-all hover:bg-[#0095F6]/25 whitespace-nowrap shrink-0 sm:px-3 sm:text-xs"
                        >
                          <FileText className="size-3.5 shrink-0" aria-hidden="true" />
                          Parent PDF
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 4-Reason Selector Bar when Absent or Leave is touched */}
                  {reasonOptions ? (
                    <div
                      className={cn(
                        'flex flex-col gap-2 rounded-2xl p-2.5 sm:ml-10 sm:flex-row sm:items-center sm:justify-between',
                        status === 'absent'
                          ? 'bg-red-500/8'
                          : 'bg-amber-500/8',
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
                                'flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                                isReasonSelected
                                  ? status === 'absent'
                                    ? 'bg-red-500/20 font-semibold text-red-700 dark:text-red-300'
                                    : 'bg-amber-500/20 font-semibold text-amber-800 dark:text-amber-200'
                                  : 'bg-card/80 text-muted-foreground hover:bg-muted hover:text-foreground',
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
        <div className="flex flex-col justify-between gap-4 border-t border-border/40 pt-4 sm:flex-row sm:items-center">
          <div role="status" aria-live="polite" className="text-sm">
            {justSubmittedMessage ? (
              <p className="flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="size-4 shrink-0" aria-hidden="true" />
                {justSubmittedMessage}
              </p>
            ) : isPeriodLockedForUsthad ? (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Locked: Only {activePeriod.teacher} or the Class Leader can record/edit attendance for {activePeriod.label}.
              </p>
            ) : isSessionNotHeld ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                Click &ldquo;Record Class Not Held&rdquo; if the Usthad did not conduct this period. Student attendance will be locked.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Submitting saves {activePeriod.label} ({activePeriod.subject}) attendance and selected Absent/Leave reasons.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:justify-end">
            {existingSubmission && !isPeriodLockedForUsthad ? (
              confirmDeleteOpen ? (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-red-500/12 px-3 py-1.5">
                  <span className="text-xs font-semibold text-red-600 dark:text-red-300">
                    Delete attendance for this period?
                  </span>
                  <button
                    type="button"
                    onClick={handleDeletePeriodSubmission}
                    className="inline-flex h-8 items-center gap-1 rounded-full bg-red-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-red-700 whitespace-nowrap"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOpen(false)}
                    className="inline-flex h-8 items-center rounded-full bg-card px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground whitespace-nowrap"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setConfirmDeleteOpen(true)
                    setJustSubmittedMessage(null)
                  }}
                  className="h-11 rounded-full bg-red-500/12 px-4 text-xs font-semibold text-red-600 hover:bg-red-500/20 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 whitespace-nowrap shrink-0"
                >
                  <Trash2 className="mr-1.5 size-4" aria-hidden="true" />
                  Delete Attendance
                </Button>
              )
            ) : null}

            <Button
              type="button"
              disabled={isPeriodLockedForUsthad || Boolean(existingSubmission && !hasUnsavedChanges)}
              onClick={handleSubmitPeriodAttendance}
              className={cn(
                'h-11 rounded-full px-6 text-sm font-semibold whitespace-nowrap shrink-0 disabled:opacity-55',
                isSessionNotHeld
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-[#0095F6] text-white hover:bg-[#0077CC]',
              )}
            >
              {isPeriodLockedForUsthad ? (
                <>
                  <Lock className="mr-2 size-4" aria-hidden="true" />
                  {activePeriod.teacher} Only
                </>
              ) : existingSubmission && !hasUnsavedChanges ? (
                <>
                  <Check className="mr-2 size-4" aria-hidden="true" />
                  {activePeriod.label} Saved
                </>
              ) : isSessionNotHeld ? (
                <>
                  <Ban className="mr-2 size-4" aria-hidden="true" />
                  Record {activePeriod.label} Not Held
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
          </>
        )}
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
