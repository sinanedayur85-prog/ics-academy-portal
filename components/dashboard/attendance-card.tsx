'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck, CalendarClock, Search } from 'lucide-react'
import { MonthYearSelect } from '@/components/ui/month-year-select'
import {
  ABSENT_REASONS,
  ATTENDANCE_LEAVE_REASONS,
  getEffectiveStudentAttendance,
  loadAttendanceOverrides,
  loadCustomNotices,
  parseMonthId,
  toMonthId,
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

  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear())
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(() => {
    const now = new Date()
    return toMonthId(now.getFullYear(), now.getMonth() + 1)
  })

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
    () => getEffectiveStudentAttendance(student, overrides, customNotices, selectedYear),
    [student, overrides, customNotices, selectedYear],
  )
  const months = effective.monthlyAttendance

  const selectedMonth =
    selectedPeriodId === 'overall' ? undefined : months.find((m) => m.id === selectedPeriodId)

  const present = selectedMonth ? selectedMonth.present : effective.attendance.present
  const absent = selectedMonth ? selectedMonth.absent : effective.attendance.absent
  const leave = selectedMonth ? selectedMonth.leave : effective.attendance.leave
  const totalWorkingDays = present + absent + leave
  const openDays = selectedMonth ? selectedMonth.openDays : effective.attendance.openDays
  const closedDays = selectedMonth ? selectedMonth.closedDays : effective.attendance.closedDays
  const rate = totalWorkingDays > 0 ? Math.round((present / totalWorkingDays) * 1000) / 10 : 0

  const periodLabel = selectedMonth
    ? `${selectedMonth.month} ${selectedMonth.year}`
    : `Year ${selectedYear}`

  const metrics = [
    {
      label: 'Present',
      value: present,
      dot: 'bg-emerald-500',
      bar: 'bg-emerald-500',
    },
    {
      label: 'Absent',
      value: absent,
      dot: 'bg-destructive',
      bar: 'bg-destructive',
    },
    {
      label: 'Leave',
      value: leave,
      dot: 'bg-[#0095F6]',
      bar: 'bg-[#0095F6]',
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

  const handlePeriodChange = (nextMonthId: string, nextYear: number) => {
    setSelectedYear(nextYear)
    setSelectedPeriodId(nextMonthId)
  }

  return (
    <Panel
      id="attendance"
      eyebrow="Overview"
      title="Attendance"
      icon={CalendarCheck}
      action={
        <MonthYearSelect
          idPrefix="attendance-period"
          value={selectedPeriodId}
          year={selectedYear}
          allowAllMonths
          allMonthsLabel="All Months"
          onChange={handlePeriodChange}
          selectClassName="h-9 rounded-xl border-0 bg-muted/70 px-2.5 text-xs font-semibold text-foreground transition-colors outline-none hover:bg-muted"
        />
      }
    >
      {/* Selected Month / Year Circular Gauge + Open Days / Working Days / Closed Days */}
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
              className="stroke-[#0095F6] transition-[stroke-dashoffset] duration-700 ease-out"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - rate / 100)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-display text-3xl font-semibold leading-none tabular-nums text-foreground">
              {rate}%
            </span>
            <span className="mt-1 text-[11px] font-medium text-muted-foreground">
              {selectedMonth ? `${selectedMonth.shortMonth} ${selectedMonth.year}` : String(selectedYear)}
            </span>
          </div>
        </div>

        <dl className="flex w-full flex-col gap-3.5">
          {/* Open Days vs Working Days vs Closed Days */}
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted/45 p-3 text-xs">
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold tracking-wider text-emerald-700 uppercase dark:text-emerald-400">
                Open Days
              </span>
              <span className="mt-0.5 font-display text-base font-bold text-foreground tabular-nums">
                {openDays}
              </span>
              <span className="text-[10px] text-muted-foreground">Hostel Open</span>
            </div>
            <div className="flex flex-col border-l border-border/40 pl-2.5">
              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Working Days
              </span>
              <span className="mt-0.5 font-display text-base font-bold text-foreground tabular-nums">
                {totalWorkingDays}
              </span>
              <span className="text-[10px] text-muted-foreground">Class Days</span>
            </div>
            <div className="flex flex-col border-l border-border/40 pl-2.5">
              <span className="text-[10px] font-semibold tracking-wider text-amber-700 uppercase dark:text-amber-300">
                Closed Days
              </span>
              <span className="mt-0.5 font-display text-base font-bold text-amber-700 tabular-nums dark:text-amber-300">
                {closedDays}
              </span>
              <span className="text-[10px] text-muted-foreground">Official Leave</span>
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
              <strong className="text-foreground">{openDays} Open Days</strong> •{' '}
              <strong className="text-foreground">{totalWorkingDays} Working Days</strong> in{' '}
              <span className="font-medium text-foreground">{periodLabel}</span>
            </p>
            {selectedMonth && selectedMonth.closedDays > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                <CalendarClock className="size-3" aria-hidden="true" />
                {selectedMonth.officialHolidayNote}
              </span>
            ) : null}
          </div>
        </dl>
      </div>

      {/* Month-by-Month Breakdown Table for the Selected Year */}
      <div className="mt-6 border-t border-border/40 pt-4">
        <div className="mb-3 flex flex-col justify-between gap-2.5 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Monthly Breakdown ({selectedYear})
            </h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Fridays are counted in Open Days and excluded from Working Days
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedPeriodId('overall')}
            className={cn(
              'shrink-0 self-start whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold transition-colors sm:self-auto',
              selectedPeriodId === 'overall'
                ? 'bg-[#0095F6]/15 text-[#0077CC] dark:text-[#0095F6]'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {selectedYear}:{' '}
            {Math.round(
              (effective.attendance.present / Math.max(1, effective.attendance.workingDays)) * 1000,
            ) / 10}
            % ({effective.attendance.openDays} Open • {effective.attendance.workingDays} Working)
          </button>
        </div>

        {/* Search & Filter Monthly Records */}
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={monthSearch}
              onChange={(e) => setMonthSearch(e.target.value)}
              placeholder="Search month, reason, or holiday..."
              className="h-9 w-full rounded-full border-0 bg-muted/70 pr-3.5 pl-9 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:bg-muted"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'has-absent', label: 'Absent' },
                { id: 'has-leave', label: 'Leave' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMonthFilterType(tab.id)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all active:scale-[0.98]',
                  monthFilterType === tab.id
                    ? 'bg-[#0095F6] text-white'
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
            <p className="rounded-2xl bg-muted/35 p-4 text-center text-xs text-muted-foreground">
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
                  onClick={() => {
                    const parsed = parseMonthId(m.id)
                    setSelectedYear(parsed.year)
                    setSelectedPeriodId(m.id)
                  }}
                  className={cn(
                    'group flex w-full flex-col justify-between gap-2 rounded-2xl px-3.5 py-2.5 text-left transition-all duration-150 outline-none active:scale-[0.99] sm:flex-row sm:items-center',
                    isSelected ? 'bg-[#0095F6]/12' : 'bg-muted/35 hover:bg-muted/65',
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold text-foreground">
                        {m.month} {m.year}
                      </p>
                      <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
                        {m.openDays} Open Days
                      </span>
                      <span className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
                        {monthTotal} Working Days
                      </span>
                      {m.closedDays > 0 ? (
                        <span className="text-[10px] font-semibold text-amber-700 tabular-nums dark:text-amber-300">
                          • {m.closedDays} Closed
                        </span>
                      ) : null}
                    </div>
                    {m.closedDays > 0 ? (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {m.officialHolidayNote}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                    <span
                      title="Present days"
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-400"
                    >
                      <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                      P: {m.present}
                    </span>
                    <span
                      title="Absent days"
                      className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-destructive"
                    >
                      <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
                      A: {m.absent}
                    </span>
                    <span
                      title="Leave days"
                      className="inline-flex items-center gap-1 rounded-full bg-[#0095F6]/15 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-[#0077CC] dark:text-[#0095F6]"
                    >
                      <span className="size-1.5 rounded-full bg-[#0095F6]" aria-hidden="true" />
                      L: {m.leave}
                    </span>
                    <span
                      className={cn(
                        'min-w-[48px] rounded-full px-2.5 py-0.5 text-right text-xs font-bold tabular-nums',
                        isSelected
                          ? 'bg-[#0095F6] text-white'
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
