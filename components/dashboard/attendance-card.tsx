'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck, CalendarClock, ChevronDown, Search } from 'lucide-react'
import {
  ABSENT_REASONS,
  ATTENDANCE_LEAVE_REASONS,
  getEffectiveStudentAttendance,
  loadAttendanceOverrides,
  loadCustomNotices,
  type AttendanceOverrideMap,
  type Notice,
  type Student,
} from '@/components/dashboard/data'
import { Panel } from '@/components/dashboard/panel'
import { cn } from '@/lib/utils'

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function AttendanceCard({ student }: { student: Student }) {
  const [overrides, setOverrides] = useState<AttendanceOverrideMap>({})
  const [customNotices, setCustomNotices] = useState<Notice[]>([])
  const [monthSearch, setMonthSearch] = useState('')
  const [monthFilterType, setMonthFilterType] = useState<'all' | 'has-absent' | 'has-leave'>('all')

  useEffect(() => {
    function syncAll() {
      setOverrides(loadAttendanceOverrides())
      setCustomNotices(loadCustomNotices())
    }
    syncAll()
    window.addEventListener('ics-attendance-updated', syncAll)
    window.addEventListener('ics-notices-updated', syncAll)
    window.addEventListener('storage', syncAll)
    return () => {
      window.removeEventListener('ics-attendance-updated', syncAll)
      window.removeEventListener('ics-notices-updated', syncAll)
      window.removeEventListener('storage', syncAll)
    }
  }, [])

  const effective = useMemo(
    () => getEffectiveStudentAttendance(student, overrides, customNotices),
    [student, overrides, customNotices],
  )
  const months = effective.monthlyAttendance
  const defaultMonth = months.find((m) => m.id === '2026-10') ?? months[0]
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(defaultMonth?.id ?? 'overall')

  const selectedMonth = months.find((m) => m.id === selectedPeriodId)

  const present = selectedMonth ? selectedMonth.present : effective.attendance.present
  const absent = selectedMonth ? selectedMonth.absent : effective.attendance.absent
  const leave = selectedMonth ? selectedMonth.leave : effective.attendance.leave
  const totalWorkingDays = present + absent + leave
  const officialHolidayDays = selectedMonth
    ? selectedMonth.officialHolidayDays
    : effective.attendance.officialHolidayDays
  const rate = totalWorkingDays > 0 ? Math.round((present / totalWorkingDays) * 1000) / 10 : 0

  const periodLabel = selectedMonth
    ? `${selectedMonth.month} ${selectedMonth.year}`
    : 'Academic Year 2026 (Overall)'

  const metrics = [
    {
      label: 'Present (Working Days Attended)',
      value: present,
      dot: 'bg-lime',
      bar: 'bg-lime',
      text: 'text-lime',
    },
    {
      label: 'Absent (On Working Days)',
      value: absent,
      dot: 'bg-destructive',
      bar: 'bg-destructive',
      text: 'text-destructive',
    },
    {
      label: 'Student Personal Leave (On Working Days)',
      value: leave,
      dot: 'bg-cyan',
      bar: 'bg-cyan',
      text: 'text-cyan',
    },
  ]

  const filteredMonths = useMemo(() => {
    const q = monthSearch.trim().toLowerCase()
    return months.filter((m) => {
      if (monthFilterType === 'has-absent' && m.absent === 0) return false
      if (monthFilterType === 'has-leave' && m.leave === 0) return false
      if (!q) return true
      const ov = overrides[`${student.id}__${m.id}`]
      const absR = m.absent > 0 ? (ov?.absentReason ?? ABSENT_REASONS[0]) : ''
      const lvR = m.leave > 0 ? (ov?.leaveReason ?? ATTENDANCE_LEAVE_REASONS[0]) : ''
      return (
        m.month.toLowerCase().includes(q) ||
        m.shortMonth.toLowerCase().includes(q) ||
        String(m.year).includes(q) ||
        m.officialHolidayNote.toLowerCase().includes(q) ||
        absR.toLowerCase().includes(q) ||
        lvR.toLowerCase().includes(q)
      )
    })
  }, [months, monthSearch, monthFilterType, overrides, student.id])

  return (
    <Panel
      id="attendance"
      eyebrow="Working Days & Student Attendance Record"
      title="Attendance Status"
      icon={CalendarCheck}
      action={
        <div className="relative">
          <label htmlFor="attendance-month-select" className="sr-only">
            Select attendance month
          </label>
          <select
            id="attendance-month-select"
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="h-9 appearance-none rounded-xl border border-input bg-muted/60 pr-8 pl-3 text-xs font-semibold text-foreground transition-colors outline-none hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 dark:[color-scheme:dark]"
          >
            {months.map((m) => (
              <option key={m.id} value={m.id}>
                {m.month} {m.year} ({m.workingDays} Working Days)
              </option>
            ))}
            <option value="overall">
              All Months (Overall — {effective.attendance.workingDays} Working Days)
            </option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      }
    >
      {/* Selected Month / Period Circular Gauge + Present / Absent / Leave Bars */}
      <div className="flex flex-col items-center gap-6 sm:flex-row lg:flex-col xl:flex-row">
        <div className="relative size-36 shrink-0">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="10" className="stroke-muted" />
            <circle
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              className="stroke-lime transition-[stroke-dashoffset] duration-700 ease-out"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - rate / 100)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-display text-3xl font-semibold leading-none tabular-nums text-foreground">
              {rate}%
            </span>
            <span className="mt-1 text-[11px] font-medium text-muted-foreground">
              {selectedMonth ? `${selectedMonth.shortMonth} ${selectedMonth.year}` : 'Overall'}
            </span>
          </div>
        </div>

        <dl className="flex w-full flex-col gap-3.5">
          {/* Summary Pills: Total Working Days vs Official Academy Holidays Excluded */}
          <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-border bg-background/60 p-2.5 text-xs">
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Total Working Days
              </span>
              <span className="mt-0.5 font-display text-base font-bold text-foreground tabular-nums">
                {totalWorkingDays} Days
              </span>
              <span className="text-[10px] text-muted-foreground">
                Present + Absent + Personal Leave
              </span>
            </div>
            <div className="flex flex-col border-l border-border pl-2.5">
              <span className="text-[10px] font-semibold tracking-wider text-emerald-700 uppercase dark:text-lime">
                Official Academy Holidays
              </span>
              <span className="mt-0.5 font-display text-base font-bold text-emerald-700 tabular-nums dark:text-lime">
                {officialHolidayDays} Days (Excluded)
              </span>
              <span className="text-[10px] text-muted-foreground">
                2nd Sat & Festival Leaves not counted
              </span>
            </div>
          </div>

          {metrics.map((metric) => (
            <div key={metric.label}>
              <div className="mb-1.5 flex items-center justify-between text-xs sm:text-sm">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <span className={`size-2 rounded-full ${metric.dot}`} aria-hidden="true" />
                  {metric.label}
                </dt>
                <dd className="font-semibold tabular-nums text-foreground">
                  {metric.value}{' '}
                  <span className="font-normal text-muted-foreground">
                    {metric.value === 1 ? 'day' : 'days'}
                  </span>
                </dd>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div
                  className={`h-full rounded-full transition-[width] duration-700 ease-out ${metric.bar}`}
                  style={{
                    width: `${totalWorkingDays > 0 ? (metric.value / totalWorkingDays) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>
              <strong className="text-foreground">{totalWorkingDays} working days</strong> in{' '}
              <span className="font-medium text-foreground">{periodLabel}</span>
            </p>
            {selectedMonth ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-lime">
                <CalendarClock className="size-3" aria-hidden="true" />
                {selectedMonth.officialHolidayNote}
              </span>
            ) : null}
          </div>
        </dl>
      </div>

      {/* Month-by-Month Breakdown Table for the Logged-in Student */}
      <div className="mt-6 border-t border-border pt-4">
        <div className="mb-3 flex flex-col justify-between gap-2.5 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Monthly Working Days & Leave Breakdown (Jan – Dec 2026)
            </h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Official 2nd Saturday & Festival holidays are excluded from Working Days
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedPeriodId('overall')}
            className={cn(
              'shrink-0 self-start whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors sm:self-auto',
              selectedPeriodId === 'overall'
                ? 'bg-lime/15 text-lime'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            Overall:{' '}
            {Math.round(
              (effective.attendance.present / Math.max(1, effective.attendance.workingDays)) * 1000,
            ) / 10}
            % ({effective.attendance.present}/{effective.attendance.workingDays}d)
          </button>
        </div>

        {/* Search & Filter Monthly Records */}
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={monthSearch}
              onChange={(e) => setMonthSearch(e.target.value)}
              placeholder="Search month, year, reason, or holiday (e.g. May, Eid, Medical)..."
              className="h-8 w-full rounded-lg border border-input bg-background/60 pr-3 pl-8 text-xs text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none"
            />
          </div>
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'all', label: 'All Months' },
                { id: 'has-absent', label: 'With Absent' },
                { id: 'has-leave', label: 'With Leave' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMonthFilterType(tab.id)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  monthFilterType === tab.id
                    ? 'bg-lime text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
          {filteredMonths.length === 0 ? (
            <p className="rounded-xl border border-border/60 bg-muted/20 p-4 text-center text-xs text-muted-foreground">
              No monthly records match your filter.
            </p>
          ) : (
            filteredMonths.map((m) => {
              const monthTotal = m.workingDays
              const monthRate =
                monthTotal > 0 ? Math.round((m.present / monthTotal) * 1000) / 10 : 0
              const isSelected = selectedPeriodId === m.id

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedPeriodId(m.id)}
                  className={cn(
                    'group flex w-full flex-col justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 sm:flex-row sm:items-center',
                    isSelected
                      ? 'border-lime/50 bg-lime/10 shadow-xs'
                      : 'border-border/60 bg-muted/30 hover:border-foreground/20 hover:bg-muted/60',
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold text-foreground">
                        {m.month} {m.year}
                      </p>
                      <span className="rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
                        {monthTotal} Working Days
                      </span>
                      <span className="text-[10px] font-medium text-emerald-700 tabular-nums dark:text-lime">
                        • {m.officialHolidayDays}d Official Holiday Excluded
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {m.officialHolidayNote}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                    <span
                      title="Present days (on working days)"
                      className="inline-flex items-center gap-1 rounded-md bg-lime/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-800 dark:text-lime"
                    >
                      <span className="size-1.5 rounded-full bg-lime" aria-hidden="true" />
                      P: {m.present}
                    </span>
                    <span
                      title="Absent days (on working days)"
                      className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-destructive"
                    >
                      <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
                      A: {m.absent}
                    </span>
                    <span
                      title="Student personal leave days (on working days)"
                      className="inline-flex items-center gap-1 rounded-md bg-cyan/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-sky-700 dark:text-cyan"
                    >
                      <span className="size-1.5 rounded-full bg-cyan" aria-hidden="true" />
                      L: {m.leave}
                    </span>
                    <span
                      className={cn(
                        'min-w-[48px] rounded-lg px-2 py-0.5 text-right text-xs font-bold tabular-nums',
                        isSelected
                          ? 'bg-lime text-primary-foreground'
                          : 'bg-background/80 text-foreground',
                      )}
                    >
                      {monthRate}%
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </Panel>
  )
}

