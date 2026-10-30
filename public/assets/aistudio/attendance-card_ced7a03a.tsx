import { CalendarCheck } from 'lucide-react'
import type { Student } from '@/components/dashboard/data'
import { Panel } from '@/components/dashboard/panel'

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function AttendanceCard({ student }: { student: Student }) {
  const { present, absent, leave } = student.attendance
  const total = present + absent + leave
  const rate = Math.round((present / total) * 1000) / 10

  const metrics = [
    { label: 'Present', value: present, dot: 'bg-lime', bar: 'bg-lime' },
    { label: 'Absent', value: absent, dot: 'bg-destructive', bar: 'bg-destructive' },
    { label: 'On leave', value: leave, dot: 'bg-cyan', bar: 'bg-cyan' },
  ]

  return (
    <Panel id="attendance" eyebrow="This academic year" title="Attendance Status" icon={CalendarCheck}>
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
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl font-semibold leading-none text-foreground">{rate}%</span>
            <span className="mt-1 text-xs text-muted-foreground">attendance</span>
          </div>
        </div>

        <dl className="flex w-full flex-col gap-4">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <span className={`size-2 rounded-full ${metric.dot}`} aria-hidden="true" />
                  {metric.label}
                </dt>
                <dd className="font-semibold tabular-nums text-foreground">
                  {metric.value} <span className="font-normal text-muted-foreground">days</span>
                </dd>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div
                  className={`h-full rounded-full transition-[width] duration-700 ease-out ${metric.bar}`}
                  style={{ width: `${(metric.value / total) * 100}%` }}
                />
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">{total} working days recorded</p>
        </dl>
      </div>
    </Panel>
  )
}
