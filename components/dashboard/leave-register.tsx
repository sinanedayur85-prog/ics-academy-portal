'use client'

import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'
import {
  collection,
  deleteDoc,
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
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Cloud,
  LogIn,
  LogOut,
  Trash2,
} from 'lucide-react'
import { leaveReasons, type Student } from '@/components/dashboard/data'
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

  async function handleDeleteEntry(entry: SavedLeaveEntry) {
    setLocalEntries((prev) => prev.filter((item) => item.id !== entry.id))
    if (entry.syncedToCloud) {
      const path = `leaveRecords/${entry.id}`
      try {
        await deleteDoc(doc(db, 'leaveRecords', entry.id))
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.DELETE, path)
        } catch {
          // Logged by handleFirestoreError
        }
      }
    }
  }

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

  useEffect(() => {
    onLeaveStatusChange?.(isOnLeave)
  }, [isOnLeave, onLeaveStatusChange])

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

      {displayedEntries.length > 0 ? (
        <div className="mt-6 border-t border-border pt-4">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">
              Recent Leave & Return Logs
            </p>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {displayedEntries.length} recorded
            </span>
          </div>
          <ul className="flex max-h-44 flex-col gap-2 overflow-y-auto pr-1">
            {displayedEntries.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-foreground font-medium">
                    <span>
                      {item.recordType === 'application' ? 'Leave Application' : 'Campus Return'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-lime">{item.reason}</span>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {item.dateString} at {item.timeString} · Status: {item.status}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeleteEntry(item)}
                  aria-label="Delete leave record"
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
