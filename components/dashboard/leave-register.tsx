'use client'

import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Timestamp,
} from 'firebase/firestore'
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Cloud,
  Filter,
  LogIn,
  LogOut,
  Search,
} from 'lucide-react'
import {
  ABSENT_REASONS,
  ATTENDANCE_LEAVE_REASONS,
  getEffectiveStudentAttendance,
  leaveReasons,
  loadAttendanceOverrides,
  loadPeriodAttendanceSubmissions,
  type AttendanceOverrideMap,
  type PeriodAttendanceSubmission,
  type Student,
} from '@/components/dashboard/data'
import { Panel, fieldClassName } from '@/components/dashboard/panel'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from '@/src/lib/firebase'
import { cn } from '@/lib/utils'

const MAX_WORDS = 1000
const MIN_RETURN_HOURS = 12
const MIN_RETURN_DELAY_MS = MIN_RETURN_HOURS * 60 * 60 * 1000

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const
type MonthShort = (typeof MONTHS)[number]

const BASE_YEARS = ['2025', '2026', '2027', '2028']

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
const PERIODS = ['AM', 'PM'] as const
type Meridiem = (typeof PERIODS)[number]

type DateValue = {
  day: string
  month: MonthShort
  year: string
}

type Time12Value = {
  hour: string
  minute: string
  period: Meridiem
}

type Tab = 'application' | 'return'

export interface SavedLeaveEntry {
  id: string
  uid: string
  studentId: string
  studentName: string
  admissionNo: string
  recordType: Tab
  dateString: string
  timeString: string
  reason: string
  details: string
  status: 'pending' | 'recorded'
  createdAtMs: number
  syncedToCloud: boolean
}

const tabs: { id: Tab; label: string; icon: typeof LogOut }[] = [
  { id: 'application', label: 'Leave Registration', icon: LogOut },
  { id: 'return', label: 'Return Registry', icon: LogIn },
]

function countWords(text: string) {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

function sanitizeId(raw: string) {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120) || `leave_${Date.now()}`
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatTimestampToParts(ms: number): {
  date: DateValue
  time: Time12Value
  dateString: string
  timeString: string
} {
  const d = new Date(ms)
  const hours24 = d.getHours()
  const period: Meridiem = hours24 >= 12 ? 'PM' : 'AM'
  const hours12 = hours24 % 12 || 12
  const date: DateValue = {
    day: pad(d.getDate()),
    month: MONTHS[d.getMonth()],
    year: String(d.getFullYear()),
  }
  const time: Time12Value = {
    hour: pad(hours12),
    minute: pad(d.getMinutes()),
    period,
  }
  return {
    date,
    time,
    dateString: `${date.day} ${date.month} ${date.year}`,
    timeString: `${time.hour}:${time.minute} ${time.period}`,
  }
}

function getCurrentDateTime(): { date: DateValue; time: Time12Value } {
  const { date, time } = formatTimestampToParts(Date.now())
  return { date, time }
}

function parseDateTimeToMs(dateString: string, timeString: string, fallbackMs: number): number {
  const dateParts = dateString.trim().split(/\s+/)
  const timeParts = timeString.trim().split(/[:\s]+/)
  if (dateParts.length === 3 && timeParts.length === 3) {
    const day = Number.parseInt(dateParts[0], 10)
    const monthIdx = MONTHS.indexOf(dateParts[1] as MonthShort)
    const year = Number.parseInt(dateParts[2], 10)
    let hour = Number.parseInt(timeParts[0], 10)
    const minute = Number.parseInt(timeParts[1], 10)
    const period = timeParts[2]?.toUpperCase()
    if (
      !Number.isNaN(day) &&
      monthIdx >= 0 &&
      !Number.isNaN(year) &&
      !Number.isNaN(hour) &&
      !Number.isNaN(minute)
    ) {
      if (period === 'PM' && hour < 12) hour += 12
      if (period === 'AM' && hour === 12) hour = 0
      return new Date(year, monthIdx, day, hour, minute, 0, 0).getTime()
    }
  }
  return fallbackMs
}

function parseDateOnlyToDayStartMs(dateString: string, fallbackMs: number): number {
  const dateParts = dateString.trim().split(/\s+/)
  if (dateParts.length === 3) {
    const day = Number.parseInt(dateParts[0], 10)
    const monthIdx = MONTHS.indexOf(dateParts[1] as MonthShort)
    const year = Number.parseInt(dateParts[2], 10)
    if (!Number.isNaN(day) && monthIdx >= 0 && !Number.isNaN(year)) {
      return new Date(year, monthIdx, day, 0, 0, 0, 0).getTime()
    }
  }
  const fallback = new Date(fallbackMs)
  return new Date(
    fallback.getFullYear(),
    fallback.getMonth(),
    fallback.getDate(),
    0,
    0,
    0,
    0,
  ).getTime()
}

function getNextCalendarDayStartMs(dayStartMs: number): number {
  const d = new Date(dayStartMs)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime()
}

export function LeaveRegister({
  student,
  onLeaveStatusChange,
}: {
  student: Student
  onLeaveStatusChange?: (isOnLeave: boolean) => void
}) {
  const [activeTab, setActiveTab] = useState<Tab>('application')
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [cloudEntries, setCloudEntries] = useState<SavedLeaveEntry[]>([])
  const [localEntries, setLocalEntries] = useState<SavedLeaveEntry[]>([])

  const safeStudentId = sanitizeId(student.id)
  const activeUid = firebaseUser ? firebaseUser.uid : `portal_${safeStudentId}`
  const storageKey = `ics_leave_records_${safeStudentId}`

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved) as SavedLeaveEntry[]
        if (Array.isArray(parsed)) {
          setLocalEntries(parsed)
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }, [storageKey])

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(localEntries))
    } catch {
      // Ignore storage write errors
    }
  }, [localEntries, storageKey])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user)
      setAuthReady(true)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!authReady) return

    const path = 'leaveRecords'
    const q = query(
      collection(db, path),
      where('uid', '==', activeUid),
      where('studentId', '==', safeStudentId),
    )
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: SavedLeaveEntry[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data()
          const createdAt = data.createdAt as Timestamp | undefined
          return {
            id: docSnap.id,
            uid: String(data.uid ?? activeUid),
            studentId: String(data.studentId ?? safeStudentId),
            studentName: String(data.studentName ?? student.name),
            admissionNo: String(data.admissionNo ?? student.admissionNo),
            recordType: data.recordType === 'return' ? 'return' : 'application',
            dateString: String(data.dateString ?? ''),
            timeString: String(data.timeString ?? ''),
            reason: String(data.reason ?? ''),
            details: String(data.details ?? ''),
            status: data.status === 'recorded' ? 'recorded' : 'pending',
            createdAtMs: createdAt?.toMillis ? createdAt.toMillis() : Date.now(),
            syncedToCloud: true,
          }
        })
        items.sort((a, b) => b.createdAtMs - a.createdAtMs)
        setCloudEntries(items)
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, path)
        } catch {
          // Logged by handleFirestoreError
        }
      },
    )

    return () => unsubscribe()
  }, [authReady, activeUid, safeStudentId, student.admissionNo, student.name])

  async function recordLeaveEntry(
    entry: Omit<SavedLeaveEntry, 'id' | 'uid' | 'createdAtMs' | 'syncedToCloud'>,
  ) {
    const recordId = sanitizeId(`leave_${safeStudentId}_${Date.now()}`)
    const nextItem: SavedLeaveEntry = {
      ...entry,
      id: recordId,
      uid: activeUid,
      createdAtMs: Date.now(),
      syncedToCloud: true,
    }

    setLocalEntries((prev) => [nextItem, ...prev])

    const path = `leaveRecords/${recordId}`
    try {
      await setDoc(doc(db, 'leaveRecords', recordId), {
        uid: activeUid,
        studentId: safeStudentId,
        studentName: entry.studentName.slice(0, 120),
        admissionNo: entry.admissionNo.slice(0, 40),
        recordType: entry.recordType,
        dateString: entry.dateString.slice(0, 40),
        timeString: entry.timeString.slice(0, 20),
        reason: entry.reason.slice(0, 120),
        details: entry.details.slice(0, 6000),
        status: entry.status,
        createdAt: serverTimestamp(),
      })
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, path)
      } catch {
        // Logged by handleFirestoreError; local entry remains visible
      }
    }
  }

  // Sync Period Attendance & Monthly Attendance Overrides for unified Leave & Absent Search
  const [periodSubmissions, setPeriodSubmissions] = useState<
    Record<string, PeriodAttendanceSubmission>
  >({})
  const [attendanceOverrides, setAttendanceOverrides] = useState<AttendanceOverrideMap>({})

  // Search & Filter State for Leave & Absent History
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMonth, setFilterMonth] = useState<string>('all')
  const [filterYear, setFilterYear] = useState<string>('all')
  const [filterDay, setFilterDay] = useState<string>('all')
  const [filterPeriodTime, setFilterPeriodTime] = useState<string>('all')
  const [filterRecordCategory, setFilterRecordCategory] = useState<
    'all' | 'leave-departure' | 'campus-return' | 'period-absent-leave' | 'monthly-absent-leave'
  >('all')
  const [showAllMatchingRecords, setShowAllMatchingRecords] = useState(false)

  useEffect(() => {
    function syncAttendanceRecords() {
      setPeriodSubmissions(loadPeriodAttendanceSubmissions())
      setAttendanceOverrides(loadAttendanceOverrides())
    }
    syncAttendanceRecords()
    window.addEventListener('ics-period-attendance-updated', syncAttendanceRecords)
    window.addEventListener('ics-attendance-updated', syncAttendanceRecords)
    window.addEventListener('storage', syncAttendanceRecords)
    return () => {
      window.removeEventListener('ics-period-attendance-updated', syncAttendanceRecords)
      window.removeEventListener('ics-attendance-updated', syncAttendanceRecords)
      window.removeEventListener('storage', syncAttendanceRecords)
    }
  }, [])

  const displayedEntries = useMemo(() => {
    const combined =
      cloudEntries.length > 0
        ? [
            ...cloudEntries,
            ...localEntries.filter((le) => !cloudEntries.some((ce) => ce.id === le.id)),
          ]
        : localEntries
    return [...combined].sort((a, b) => b.createdAtMs - a.createdAtMs)
  }, [cloudEntries, localEntries])

  const latestEntry = displayedEntries[0] ?? null
  const isOnLeave = latestEntry?.recordType === 'application'
  const activeLeaveEntry = isOnLeave ? latestEntry : null
  const latestApplicationEntry =
    displayedEntries.find((item) => item.recordType === 'application') ?? null
  const latestReturnEntry =
    displayedEntries.find((item) => item.recordType === 'return') ?? null

  useEffect(() => {
    onLeaveStatusChange?.(isOnLeave)
  }, [isOnLeave, onLeaveStatusChange])

  // Build unified searchable items across Leave Register, Period Absents/Leaves, and Monthly Absents/Leaves
  const unifiedHistoryItems = useMemo(() => {
    type UnifiedRecordItem = {
      id: string
      category: 'leave-departure' | 'campus-return' | 'period-absent-leave' | 'monthly-absent-leave'
      badgeLabel: string
      badgeTone: 'red' | 'emerald' | 'amber' | 'cyan'
      title: string
      reason: string
      details: string
      dateLabel: string
      timeLabel: string
      dayStr: string
      monthShort: string
      yearStr: string
      sortMs: number
    }

    const items: UnifiedRecordItem[] = []

    // 1. Leave Register Entries (Departures & Returns)
    for (const entry of displayedEntries) {
      const parts = entry.dateString.trim().split(/\s+/)
      const dayStr = (parts[0] ?? '').padStart(2, '0')
      const monthShort = parts[1] ?? ''
      const yearStr = parts[2] ?? '2026'
      const isApp = entry.recordType === 'application'

      items.push({
        id: `lr-${entry.id}`,
        category: isApp ? 'leave-departure' : 'campus-return',
        badgeLabel: isApp ? 'Leave Departure' : 'Campus Return',
        badgeTone: isApp ? 'red' : 'emerald',
        title: isApp ? `Personal Leave — ${entry.reason}` : 'Returned to Academy Campus',
        reason: entry.reason,
        details: entry.details || (isApp ? 'Outpass registered in Leave Register' : 'Verified return to campus'),
        dateLabel: entry.dateString,
        timeLabel: entry.timeString,
        dayStr,
        monthShort,
        yearStr,
        sortMs: entry.createdAtMs,
      })
    }

    // 2. Period-by-Period Absent & Leave Records for this student
    for (const sub of Object.values(periodSubmissions)) {
      if (sub.className !== student.className) continue
      const stStatus = sub.records?.[student.id]
      if (stStatus !== 'absent' && stStatus !== 'leave') continue

      const reason =
        sub.reasons?.[student.id] ??
        (stStatus === 'absent' ? ABSENT_REASONS[0] : ATTENDANCE_LEAVE_REASONS[0])
      const [yStr, mNumStr, dStr] = sub.date.split('-')
      const mIdx = Math.max(0, Math.min(11, (Number(mNumStr) || 1) - 1))
      const monthShort = MONTHS[mIdx] ?? 'Oct'
      const dayFormatted = `${(dStr ?? '01').padStart(2, '0')} ${monthShort} ${yStr ?? '2026'}`

      items.push({
        id: `prd-${sub.key}-${student.id}`,
        category: 'period-absent-leave',
        badgeLabel: stStatus === 'absent' ? `Period Absent (${sub.periodLabel})` : `Period Leave (${sub.periodLabel})`,
        badgeTone: stStatus === 'absent' ? 'red' : 'amber',
        title: `${sub.subject} • ${sub.periodLabel}`,
        reason,
        details: `Usthad: ${sub.teacher} • Marked by ${sub.submittedByName} (${sub.submittedByLeaderId})`,
        dateLabel: dayFormatted,
        timeLabel: sub.periodTime,
        dayStr: (dStr ?? '01').padStart(2, '0'),
        monthShort,
        yearStr: yStr ?? '2026',
        sortMs: new Date(sub.submittedAt || sub.date).getTime() || Date.now(),
      })
    }

    // 3. Monthly Attendance Absent & Student Personal Leave Records
    const effective = getEffectiveStudentAttendance(student, attendanceOverrides)
    for (const m of effective.monthlyAttendance) {
      if (m.absent === 0 && m.leave === 0) continue
      const ov = attendanceOverrides[`${student.id}__${m.id}`]
      const absReason = m.absent > 0 ? (ov?.absentReason ?? ABSENT_REASONS[0]) : null
      const lvReason = m.leave > 0 ? (ov?.leaveReason ?? ATTENDANCE_LEAVE_REASONS[0]) : null
      const combinedReason = [
        absReason ? `Absent (${m.absent}d): ${absReason}` : null,
        lvReason ? `Personal Leave (${m.leave}d): ${lvReason}` : null,
      ]
        .filter(Boolean)
        .join(' • ')

      items.push({
        id: `mth-${student.id}-${m.id}`,
        category: 'monthly-absent-leave',
        badgeLabel: `Monthly Record (${m.shortMonth} ${m.year})`,
        badgeTone: 'cyan',
        title: `${m.month} ${m.year} — ${m.absent}d Absent, ${m.leave}d Personal Leave`,
        reason: combinedReason,
        details: `${m.workingDays} Working Days (${m.present}d Present • ${m.officialHolidayDays}d Official Holiday Excluded)`,
        dateLabel: `${m.month} ${m.year}`,
        timeLabel: 'Monthly Summary',
        dayStr: 'all',
        monthShort: m.shortMonth,
        yearStr: String(m.year),
        sortMs: new Date(`${m.id}-15T12:00:00`).getTime(),
      })
    }

    return items.sort((a, b) => b.sortMs - a.sortMs)
  }, [displayedEntries, periodSubmissions, student, attendanceOverrides])

  const hasActiveSearchOrFilter =
    searchQuery.trim().length > 0 ||
    filterMonth !== 'all' ||
    filterYear !== 'all' ||
    filterDay !== 'all' ||
    filterPeriodTime !== 'all' ||
    filterRecordCategory !== 'all'

  const filteredHistoryItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return unifiedHistoryItems.filter((item) => {
      if (filterRecordCategory !== 'all' && item.category !== filterRecordCategory) return false
      if (filterMonth !== 'all' && item.monthShort !== filterMonth) return false
      if (filterYear !== 'all' && item.yearStr !== filterYear) return false
      if (filterDay !== 'all' && item.dayStr !== filterDay) return false
      if (filterPeriodTime !== 'all') {
        const tUpper = item.timeLabel.toUpperCase()
        if (!tUpper.includes(filterPeriodTime.toUpperCase())) return false
      }
      if (!q) return true
      return (
        item.title.toLowerCase().includes(q) ||
        item.reason.toLowerCase().includes(q) ||
        item.details.toLowerCase().includes(q) ||
        item.dateLabel.toLowerCase().includes(q) ||
        item.timeLabel.toLowerCase().includes(q) ||
        item.badgeLabel.toLowerCase().includes(q)
      )
    })
  }, [
    unifiedHistoryItems,
    searchQuery,
    filterRecordCategory,
    filterMonth,
    filterYear,
    filterDay,
    filterPeriodTime,
  ])

  return (
    <Panel
      id="leave"
      eyebrow="Campus Movement & Leave Registry"
      title="Leave Register"
      icon={ClipboardList}
      className="border-lime/20"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold tracking-wide',
              isOnLeave
                ? 'border-red-500/40 bg-red-500/15 text-red-600 dark:border-red-400/40 dark:bg-red-500/20 dark:text-red-400'
                : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:border-lime/40 dark:bg-lime/15 dark:text-lime',
            )}
          >
            <span
              className={cn(
                'size-2 rounded-full',
                isOnLeave ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 dark:bg-lime',
              )}
              aria-hidden="true"
            />
            {isOnLeave ? 'On Leave' : 'At Academy'}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-lime">
            <Cloud className="size-3.5" aria-hidden="true" />
            Firebase Synced
          </span>
        </div>
      }
    >
      {/* 1. CURRENT ACTIVE LEAVE STATUS & REASON BANNER */}
      <div
        className={cn(
          'mb-5 flex flex-col justify-between gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center',
          isOnLeave && activeLeaveEntry
            ? 'border-red-500/40 bg-red-500/10'
            : 'border-emerald-500/35 bg-emerald-500/[0.07] dark:border-lime/30 dark:bg-lime/[0.06]',
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl',
              isOnLeave
                ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                : 'bg-emerald-500/20 text-emerald-700 dark:bg-lime/20 dark:text-lime',
            )}
          >
            <CalendarClock className="size-5" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
                Current Campus Status
              </span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-bold',
                  isOnLeave
                    ? 'bg-red-500/20 text-red-700 dark:text-red-300'
                    : 'bg-emerald-500/20 text-emerald-800 dark:bg-lime/20 dark:text-lime',
                )}
              >
                {isOnLeave ? 'Currently On Leave (ലീവിലാണ്)' : 'Present At Academy (ക്യാമ്പസിലുണ്ട്)'}
              </span>
            </div>

            {isOnLeave && activeLeaveEntry ? (
              <div className="text-xs leading-relaxed text-foreground">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                  Active Leave Reason: <span className="underline decoration-red-500/40 underline-offset-4">{activeLeaveEntry.reason}</span>
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  Departed on{' '}
                  <strong className="font-mono text-foreground">{activeLeaveEntry.dateString}</strong> at{' '}
                  <strong className="font-mono text-foreground">{activeLeaveEntry.timeString}</strong>
                  {activeLeaveEntry.details ? ` • Note: ${activeLeaveEntry.details}` : ''}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {student.name} is currently at the academy campus.
                {latestReturnEntry
                  ? ` Last returned on ${latestReturnEntry.dateString} at ${latestReturnEntry.timeString}.`
                  : ' No active personal leave outpass is currently open.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 2. LEAVE APPLICATION & RETURN TABS */}
      <div
        role="tablist"
        aria-label="Leave register"
        className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-border bg-background/60 p-1"
      >
        {tabs.map((tab) => {
          const selected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`leave-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`leave-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex h-10 min-w-0 items-center justify-center gap-1.5 sm:gap-2 rounded-lg px-2 sm:px-3 text-xs sm:text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                selected
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <tab.icon className="size-3.5 sm:size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{tab.label}</span>
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`leave-panel-${activeTab}`}
        aria-labelledby={`leave-tab-${activeTab}`}
        className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300"
        key={`${activeTab}-${student.id}`}
      >
        {activeTab === 'application' ? (
          <LeaveApplicationForm
            student={student}
            isOnLeave={isOnLeave}
            latestApplicationEntry={latestApplicationEntry}
            onRecord={recordLeaveEntry}
          />
        ) : (
          <ReturnRegistryForm
            student={student}
            activeLeaveEntry={activeLeaveEntry}
            onRecord={recordLeaveEntry}
          />
        )}
      </div>

      {/* 3. SEARCH & FILTER LEAVE, RETURN & ABSENT HISTORY (No Delete Buttons) */}
      <div className="mt-6 border-t border-border pt-5">
        <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-foreground uppercase">
              <Filter className="size-3.5 text-lime" aria-hidden="true" />
              Search & Filter Leave / Absent Records
            </h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Search by Month, Year, Date/Day, Time, or Reason to view when you took leave or were marked absent.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAllMatchingRecords((prev) => !prev)}
            className="self-start rounded-lg border border-border bg-background/70 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-lime/50 hover:text-lime sm:self-auto"
          >
            {showAllMatchingRecords || hasActiveSearchOrFilter
              ? `Showing ${filteredHistoryItems.length} Record${filteredHistoryItems.length === 1 ? '' : 's'}`
              : `View All History (${unifiedHistoryItems.length})`}
          </button>
        </div>

        {/* Search Input + Month / Year / Day / Time / Category Filters */}
        <div className="grid gap-2.5 rounded-2xl border border-border bg-background/50 p-3.5 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative sm:col-span-2">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setShowAllMatchingRecords(true)
              }}
              placeholder="Search reason, subject, date, or time..."
              className="h-9 w-full rounded-lg border border-input bg-background pr-3 pl-8 text-xs text-foreground placeholder:text-muted-foreground focus-visible:border-lime focus-visible:outline-none"
            />
          </div>

          <div>
            <label htmlFor="leave-search-category" className="sr-only">
              Record Category
            </label>
            <select
              id="leave-search-category"
              value={filterRecordCategory}
              onChange={(e) => {
                setFilterRecordCategory(
                  e.target.value as
                    | 'all'
                    | 'leave-departure'
                    | 'campus-return'
                    | 'period-absent-leave'
                    | 'monthly-absent-leave',
                )
                setShowAllMatchingRecords(true)
              }}
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus-visible:border-lime focus-visible:outline-none dark:[color-scheme:dark]"
            >
              <option value="all">All Record Types</option>
              <option value="leave-departure">Leave Departures</option>
              <option value="campus-return">Campus Returns</option>
              <option value="period-absent-leave">Period Absent / Leave</option>
              <option value="monthly-absent-leave">Monthly Absent / Leave</option>
            </select>
          </div>

          <div>
            <label htmlFor="leave-search-month" className="sr-only">
              Filter by Month
            </label>
            <select
              id="leave-search-month"
              value={filterMonth}
              onChange={(e) => {
                setFilterMonth(e.target.value)
                setShowAllMatchingRecords(true)
              }}
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus-visible:border-lime focus-visible:outline-none dark:[color-scheme:dark]"
            >
              <option value="all">All Months</option>
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="leave-search-year" className="sr-only">
              Filter by Year
            </label>
            <select
              id="leave-search-year"
              value={filterYear}
              onChange={(e) => {
                setFilterYear(e.target.value)
                setShowAllMatchingRecords(true)
              }}
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus-visible:border-lime focus-visible:outline-none dark:[color-scheme:dark]"
            >
              <option value="all">All Years</option>
              {BASE_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label htmlFor="leave-search-day" className="sr-only">
                Filter by Day
              </label>
              <select
                id="leave-search-day"
                value={filterDay}
                onChange={(e) => {
                  setFilterDay(e.target.value)
                  setShowAllMatchingRecords(true)
                }}
                className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs text-foreground focus-visible:border-lime focus-visible:outline-none dark:[color-scheme:dark]"
              >
                <option value="all">Any Day</option>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    Day {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="leave-search-time" className="sr-only">
                Filter by Time
              </label>
              <select
                id="leave-search-time"
                value={filterPeriodTime}
                onChange={(e) => {
                  setFilterPeriodTime(e.target.value)
                  setShowAllMatchingRecords(true)
                }}
                className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs text-foreground focus-visible:border-lime focus-visible:outline-none dark:[color-scheme:dark]"
              >
                <option value="all">Any Time</option>
                <option value="AM">Morning (AM)</option>
                <option value="PM">Afternoon/Eve (PM)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Search Results Display */}
        {showAllMatchingRecords || hasActiveSearchOrFilter ? (
          <div className="mt-3">
            {filteredHistoryItems.length === 0 ? (
              <p className="rounded-xl border border-border/60 bg-background/40 p-4 text-center text-xs text-muted-foreground">
                No leave or absent records found matching your search filters.
              </p>
            ) : (
              <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
                {filteredHistoryItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-xs sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase',
                            item.badgeTone === 'red' &&
                              'bg-red-500/15 text-red-600 dark:text-red-400',
                            item.badgeTone === 'emerald' &&
                              'bg-emerald-500/15 text-emerald-700 dark:text-lime',
                            item.badgeTone === 'amber' &&
                              'bg-amber-500/15 text-amber-700 dark:text-amber-400',
                            item.badgeTone === 'cyan' &&
                              'bg-cyan/15 text-sky-700 dark:text-cyan',
                          )}
                        >
                          {item.badgeLabel}
                        </span>
                        <span className="font-semibold text-foreground">{item.title}</span>
                      </div>
                      <p className="text-xs font-medium text-lime">{item.reason}</p>
                      <p className="text-[11px] text-muted-foreground">{item.details}</p>
                    </div>
                    <div className="shrink-0 text-left font-mono text-[11px] tabular-nums text-muted-foreground sm:text-right">
                      <p className="font-semibold text-foreground">{item.dateLabel}</p>
                      <p>{item.timeLabel}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </Panel>
  )
}

function SuccessMessage({ message }: { message: string }) {
  return (
    <p
      role="status"
      className="flex items-center gap-2 rounded-lg border border-lime/30 bg-lime/10 px-3 py-2.5 text-sm text-lime animate-in fade-in-0 duration-300"
    >
      <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}

const selectTriggerClassName =
  'h-11 w-full min-w-0 rounded-lg border border-input bg-background/90 pl-2 pr-6 sm:pl-3 sm:pr-8 text-xs sm:text-sm font-medium tabular-nums cursor-pointer appearance-none transition-all hover:border-lime/40 focus-visible:border-lime focus-visible:ring-3 focus-visible:ring-lime/30 text-foreground outline-none dark:[color-scheme:dark]'

type DateSelectGroupProps = {
  idPrefix: string
  label: string
  value: DateValue
  onChange: (next: DateValue) => void
}

function DateSelectGroup({ idPrefix, label, value, onChange }: DateSelectGroupProps) {
  const yearOptions = BASE_YEARS.includes(value.year)
    ? BASE_YEARS
    : Array.from(new Set([value.year, ...BASE_YEARS])).sort()

  return (
    <div className="flex flex-col gap-2" role="group" aria-labelledby={`${idPrefix}-label`}>
      <Label id={`${idPrefix}-label`} htmlFor={`${idPrefix}-day`}>
        {label}
      </Label>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        <div className="relative">
          <label htmlFor={`${idPrefix}-day`} className="sr-only">
            Day
          </label>
          <select
            id={`${idPrefix}-day`}
            name={`${idPrefix}Day`}
            required
            value={value.day}
            onChange={(e) => onChange({ ...value, day: e.target.value })}
            className={selectTriggerClassName}
          >
            {DAYS.map((day) => (
              <option key={day} value={day} className="bg-card text-foreground">
                {day}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-1.5 sm:right-2.5 size-3.5 sm:size-4 -translate-y-1/2 text-lime"
            aria-hidden="true"
          />
        </div>

        <div className="relative">
          <label htmlFor={`${idPrefix}-month`} className="sr-only">
            Month
          </label>
          <select
            id={`${idPrefix}-month`}
            name={`${idPrefix}Month`}
            required
            value={value.month}
            onChange={(e) => onChange({ ...value, month: e.target.value as MonthShort })}
            className={selectTriggerClassName}
          >
            {MONTHS.map((month) => (
              <option key={month} value={month} className="bg-card text-foreground">
                {month}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-1.5 sm:right-2.5 size-3.5 sm:size-4 -translate-y-1/2 text-lime"
            aria-hidden="true"
          />
        </div>

        <div className="relative">
          <label htmlFor={`${idPrefix}-year`} className="sr-only">
            Year
          </label>
          <select
            id={`${idPrefix}-year`}
            name={`${idPrefix}Year`}
            required
            value={value.year}
            onChange={(e) => onChange({ ...value, year: e.target.value })}
            className={cn(selectTriggerClassName, 'font-semibold text-lime')}
          >
            {yearOptions.map((yr) => (
              <option key={yr} value={yr} className="bg-card text-foreground">
                {yr}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-1.5 sm:right-2.5 size-3.5 sm:size-4 -translate-y-1/2 text-lime"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  )
}

type TimeSelectGroupProps = {
  idPrefix: string
  label: string
  value: Time12Value
  onChange: (next: Time12Value) => void
}

function TimeSelectGroup({ idPrefix, label, value, onChange }: TimeSelectGroupProps) {
  return (
    <div className="flex flex-col gap-2" role="group" aria-labelledby={`${idPrefix}-label`}>
      <Label id={`${idPrefix}-label`} htmlFor={`${idPrefix}-hour`}>
        {label}
      </Label>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        <div className="relative">
          <label htmlFor={`${idPrefix}-hour`} className="sr-only">
            Hour
          </label>
          <select
            id={`${idPrefix}-hour`}
            name={`${idPrefix}Hour`}
            required
            value={value.hour}
            onChange={(e) => onChange({ ...value, hour: e.target.value })}
            className={selectTriggerClassName}
          >
            {HOURS.map((hr) => (
              <option key={hr} value={hr} className="bg-card text-foreground">
                {hr}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-1.5 sm:right-2.5 size-3.5 sm:size-4 -translate-y-1/2 text-lime"
            aria-hidden="true"
          />
        </div>

        <div className="relative">
          <label htmlFor={`${idPrefix}-minute`} className="sr-only">
            Minute
          </label>
          <select
            id={`${idPrefix}-minute`}
            name={`${idPrefix}Minute`}
            required
            value={value.minute}
            onChange={(e) => onChange({ ...value, minute: e.target.value })}
            className={selectTriggerClassName}
          >
            {MINUTES.map((min) => (
              <option key={min} value={min} className="bg-card text-foreground">
                {min}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-1.5 sm:right-2.5 size-3.5 sm:size-4 -translate-y-1/2 text-lime"
            aria-hidden="true"
          />
        </div>

        <div className="relative">
          <label htmlFor={`${idPrefix}-period`} className="sr-only">
            AM or PM
          </label>
          <select
            id={`${idPrefix}-period`}
            name={`${idPrefix}Period`}
            required
            value={value.period}
            onChange={(e) => onChange({ ...value, period: e.target.value as Meridiem })}
            className={cn(selectTriggerClassName, 'font-semibold text-lime')}
          >
            {PERIODS.map((p) => (
              <option key={p} value={p} className="bg-card text-foreground">
                {p}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-1.5 sm:right-2.5 size-3.5 sm:size-4 -translate-y-1/2 text-lime"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  )
}

function LeaveApplicationForm({
  student,
  isOnLeave,
  latestApplicationEntry,
  onRecord,
}: {
  student: Student
  isOnLeave: boolean
  latestApplicationEntry: SavedLeaveEntry | null
  onRecord: (entry: Omit<SavedLeaveEntry, 'id' | 'uid' | 'createdAtMs' | 'syncedToCloud'>) => Promise<void>
}) {
  const [departureDate, setDepartureDate] = useState<DateValue>({
    day: '01',
    month: 'Jan',
    year: '2026',
  })
  const [departureTime, setDepartureTime] = useState<Time12Value>({
    hour: '09',
    minute: '00',
    period: 'AM',
  })
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const showDetails = reason === 'Other'
  const words = countWords(details)
  const overLimit = showDetails && words > MAX_WORDS

  function fillCurrentDateTime() {
    const { date, time } = getCurrentDateTime()
    setDepartureDate(date)
    setDepartureTime(time)
  }

  useEffect(fillCurrentDateTime, [])

  const selectedDateString = `${departureDate.day} ${departureDate.month} ${departureDate.year}`
  const selectedDayStartMs = parseDateOnlyToDayStartMs(selectedDateString, Date.now())

  const lastLeaveDayStartMs = latestApplicationEntry
    ? parseDateOnlyToDayStartMs(latestApplicationEntry.dateString, latestApplicationEntry.createdAtMs)
    : null

  const nextAllowedDayStartMs =
    lastLeaveDayStartMs !== null ? getNextCalendarDayStartMs(lastLeaveDayStartMs) : null
  const nextAllowedDateFormatted =
    nextAllowedDayStartMs !== null ? formatTimestampToParts(nextAllowedDayStartMs).dateString : null

  const isSameOrEarlierDay =
    nextAllowedDayStartMs !== null && selectedDayStartMs < nextAllowedDayStartMs

  const isLeaveBlocked = isOnLeave || isSameOrEarlierDay

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (overLimit || !reason || isLeaveBlocked) return

    void onRecord({
      studentId: student.id,
      studentName: student.name,
      admissionNo: student.admissionNo,
      recordType: 'application',
      dateString: selectedDateString,
      timeString: `${departureTime.hour}:${departureTime.minute} ${departureTime.period}`,
      reason,
      details: showDetails ? details : '',
      status: 'pending',
    })

    setSubmitted(true)
    setReason('')
    setDetails('')
    fillCurrentDateTime()
  }

  return (
    <form onSubmit={handleSubmit} onChange={() => setSubmitted(false)} className="flex flex-col gap-5">
      {latestApplicationEntry && isLeaveBlocked ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-500/35 bg-red-500/10 p-3.5 text-xs leading-relaxed text-red-700 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500 dark:text-red-400" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold text-red-800 dark:text-red-200">
              {isOnLeave
                ? 'Currently On Leave — Next Leave Registration Locked'
                : 'One Leave Registration Per Day Limit'}
            </p>
            <p>
              Last leave registered for{' '}
              <span className="font-semibold">{latestApplicationEntry.dateString}</span> at{' '}
              <span className="font-semibold">{latestApplicationEntry.timeString}</span>. A student can
              register leave only once per day; the next leave registration is permitted only from the
              next day (<span className="font-semibold">{nextAllowedDateFormatted}</span>)
              {isOnLeave ? ' after registering your return to the academy.' : '.'}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-5">
        <DateSelectGroup
          idPrefix="departure-date"
          label="Departure date"
          value={departureDate}
          onChange={setDepartureDate}
        />
        <TimeSelectGroup
          idPrefix="departure-time"
          label="Departure time"
          value={departureTime}
          onChange={setDepartureTime}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="leave-reason">Reason</Label>
        <select
          id="leave-reason"
          name="reason"
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className={cn(fieldClassName, 'cursor-pointer')}
        >
          <option value="" disabled>
            Select a reason
          </option>
          {leaveReasons.map((r) => (
            <option key={r} value={r} className="bg-card">
              {r}
            </option>
          ))}
        </select>
      </div>

      {showDetails ? (
        <div className="flex flex-col gap-2 animate-in fade-in-0 slide-in-from-top-1 duration-300">
          <div className="flex items-center justify-between">
            <Label htmlFor="leave-details">Detailed reason</Label>
            <span
              id="leave-details-count"
              className={cn('text-xs tabular-nums', overLimit ? 'text-destructive' : 'text-muted-foreground')}
            >
              {words} / {MAX_WORDS} words
            </span>
          </div>
          <textarea
            id="leave-details"
            name="details"
            rows={6}
            required
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Max 1000 words"
            aria-describedby="leave-details-count"
            aria-invalid={overLimit || undefined}
            className={cn(fieldClassName, 'h-auto min-h-36 resize-y py-3 leading-relaxed')}
          />
        </div>
      ) : null}

      {submitted ? <SuccessMessage message="Leave registration submitted. Status updated to On Leave." /> : null}

      <Button
        type="submit"
        disabled={overLimit || isLeaveBlocked}
        className="h-11 w-full rounded-full font-semibold sm:w-auto sm:self-end sm:px-8"
      >
        Submit Registration
      </Button>
    </form>
  )
}

function ReturnRegistryForm({
  student,
  activeLeaveEntry,
  onRecord,
}: {
  student: Student
  activeLeaveEntry: SavedLeaveEntry | null
  onRecord: (entry: Omit<SavedLeaveEntry, 'id' | 'uid' | 'createdAtMs' | 'syncedToCloud'>) => Promise<void>
}) {
  const [returnDate, setReturnDate] = useState<DateValue>({
    day: '01',
    month: 'Jan',
    year: '2026',
  })
  const [returnTime, setReturnTime] = useState<Time12Value>({
    hour: '05',
    minute: '00',
    period: 'PM',
  })
  const [submitted, setSubmitted] = useState(false)

  function fillCurrentDateTime() {
    const { date, time } = getCurrentDateTime()
    setReturnDate(date)
    setReturnTime(time)
  }

  useEffect(fillCurrentDateTime, [])

  const selectedReturnDateString = `${returnDate.day} ${returnDate.month} ${returnDate.year}`
  const selectedReturnTimeString = `${returnTime.hour}:${returnTime.minute} ${returnTime.period}`
  const selectedReturnMs = parseDateTimeToMs(
    selectedReturnDateString,
    selectedReturnTimeString,
    Date.now(),
  )

  const departureMs = activeLeaveEntry
    ? parseDateTimeToMs(
        activeLeaveEntry.dateString,
        activeLeaveEntry.timeString,
        activeLeaveEntry.createdAtMs,
      )
    : null

  const minReturnMs = departureMs !== null ? departureMs + MIN_RETURN_DELAY_MS : null
  const minReturnFormatted = minReturnMs !== null ? formatTimestampToParts(minReturnMs) : null

  const isTwelveHoursMet =
    activeLeaveEntry !== null && minReturnMs !== null && selectedReturnMs >= minReturnMs

  const remainingHours =
    minReturnMs !== null && selectedReturnMs < minReturnMs
      ? Math.max(1, Math.ceil((minReturnMs - selectedReturnMs) / (1000 * 60 * 60)))
      : 0

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeLeaveEntry || !isTwelveHoursMet) return

    void onRecord({
      studentId: student.id,
      studentName: student.name,
      admissionNo: student.admissionNo,
      recordType: 'return',
      dateString: selectedReturnDateString,
      timeString: selectedReturnTimeString,
      reason: 'Campus Return',
      details: '',
      status: 'recorded',
    })
    setSubmitted(true)
    fillCurrentDateTime()
  }

  return (
    <form onSubmit={handleSubmit} onChange={() => setSubmitted(false)} className="flex flex-col gap-5">
      {!activeLeaveEntry ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3.5 text-xs leading-relaxed text-emerald-800 dark:border-lime/35 dark:bg-lime/10 dark:text-lime"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Student is Currently At Academy</p>
            <p className="mt-0.5 text-muted-foreground">
              There is no active leave to return from. Return registration is enabled only when a
              student is on leave.
            </p>
          </div>
        </div>
      ) : (
        <div
          role="status"
          className={cn(
            'flex items-start gap-3 rounded-xl border p-3.5 text-xs leading-relaxed',
            isTwelveHoursMet
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:border-lime/35 dark:bg-lime/10 dark:text-lime'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300',
          )}
        >
          <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">
              {isTwelveHoursMet
                ? '12-Hour Minimum Leave Period Completed — Eligible to Return'
                : `Minimum 1 Day (12 Hours) Required Before Return (${remainingHours}h remaining)`}
            </p>
            <p className="text-muted-foreground">
              Leave started on{' '}
              <span className="font-semibold text-foreground">
                {activeLeaveEntry.dateString} at {activeLeaveEntry.timeString}
              </span>
              . Return can only be registered from{' '}
              <span className="font-semibold text-foreground">
                {minReturnFormatted?.dateString} at {minReturnFormatted?.timeString}
              </span>{' '}
              onwards (minimum 12 hours after departure).
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-5">
        <DateSelectGroup
          idPrefix="return-date"
          label="Return date"
          value={returnDate}
          onChange={setReturnDate}
        />
        <TimeSelectGroup
          idPrefix="return-time"
          label="Return time"
          value={returnTime}
          onChange={setReturnTime}
        />
      </div>

      {submitted ? <SuccessMessage message="Return registered. Welcome back to campus (At Academy)." /> : null}

      <Button
        type="submit"
        disabled={!activeLeaveEntry || !isTwelveHoursMet}
        className="h-11 w-full rounded-full font-semibold sm:w-auto sm:self-end sm:px-8"
      >
        Register return
      </Button>
    </form>
  )
}
