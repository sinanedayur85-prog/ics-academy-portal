'use client'

import { useState } from 'react'
import { CalendarCheck, ChevronDown } from 'lucide-react'
import type { Student } from '@/components/dashboard/data'
import { Panel } from '@/components/dashboard/panel'
import { cn } from '@/lib/utils'

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function AttendanceCard({ student }: { student: Student }) {
  const months = student.monthlyAttendance
  const defaultMonth = months.find((m) => m.id === '2026-10') ?? months[0]
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(defaultMonth?.id ?? 'overall')

  const selectedMonth = months.find((m) => m.id === selectedPeriodId)

  const present = selectedMonth ? selectedMonth.present : student.attendance.present
  const absent = selectedMonth ? selectedMonth.absent : student.attendance.absent
  const leave = selectedMonth ? selectedMonth.leave : student.attendance.leave
  const total = present + absent + leave
  const rate = total > 0 ? Math.round((present / total) * 1000) / 10 : 0

  const periodLabel = selectedMonth
    ? `${selectedMonth.month} ${selectedMonth.year}`
    : 'Academic Year (Overall)'

  const metrics = [
    { label: 'Present', value: present, dot: 'bg-lime', bar: 'bg-lime', text: 'text-lime' },
    { label: 'Absent', value: absent, dot: 'bg-destructive', bar: 'bg-destructive', text: 'text-destructive' },
    { label: 'On leave', value: leave, dot: 'bg-cyan', bar: 'bg-cyan', text: 'text-cyan' },
  ]

  return (
    <Panel
      id="attendance"
      eyebrow="Monthly Record"
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
                {m.month} {m.year}
              </option>
            ))}
            <option value="overall">All Months (Overall)</option>
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
          {metrics.map((metric) => (
            <div key={metric.label}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
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
                  style={{ width: `${total > 0 ? (metric.value / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            {total} working days recorded in <span className="font-medium text-foreground">{periodLabel}</span>
          </p>
        </dl>
      </div>

      {/* Month-by-Month Breakdown Table for the Logged-in Student */}
      <div className="mt-6 border-t border-border pt-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Monthly Breakdown
            </h3>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
              (Jan – Dec)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedPeriodId('overall')}
            className={cn(
              'shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors',
              selectedPeriodId === 'overall'
                ? 'bg-lime/15 text-lime'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            Overall: {Math.round((student.attendance.present / (student.attendance.present + student.attendance.absent + student.attendance.leave)) * 1000) / 10}%
          </button>
        </div>

        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
          {months.map((m) => {
            const monthTotal = m.present + m.absent + m.leave
            const monthRate = monthTotal > 0 ? Math.round((m.present / monthTotal) * 1000) / 10 : 0
            const isSelected = selectedPeriodId === m.id

            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedPeriodId(m.id)}
                className={cn(
                  'group flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-all duration-200',
                  isSelected
                    ? 'border-lime/50 bg-lime/10 shadow-xs'
                    : 'border-border/60 bg-muted/30 hover:border-foreground/20 hover:bg-muted/60',
                )}
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    {m.month} {m.year}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{monthTotal} working days</p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                  <span
                    title="Present days"
                    className="inline-flex items-center gap-1 rounded-md bg-lime/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-800 dark:text-lime"
                  >
                    <span className="size-1.5 rounded-full bg-lime" aria-hidden="true" />
                    P: {m.present}
                  </span>
                  <span
                    title="Absent days"
                    className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-destructive"
                  >
                    <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
                    A: {m.absent}
                  </span>
                  <span
                    title="Leave days"
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
          })}
        </div>
      </div>
    </Panel>
  )
}
