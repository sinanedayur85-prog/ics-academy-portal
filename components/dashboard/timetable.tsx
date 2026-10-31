import { CalendarDays } from 'lucide-react'
import {
  CURRENT_SEMESTER,
  getClassSemesterTimetable,
  type Student,
} from '@/components/dashboard/data'
import { Panel } from '@/components/dashboard/panel'

export function Timetable({ student }: { student: Student }) {
  const classSchedule = getClassSemesterTimetable(student)
  const slots =
    CURRENT_SEMESTER === 1 ? classSchedule.semester1 : classSchedule.semester2

  return (
    <Panel
      id="timetable"
      eyebrow="Semester Schedule"
      title="Time Table"
      icon={CalendarDays}
      action={
        <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-lime/15 dark:text-lime">
          Semester {CURRENT_SEMESTER}
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {classSchedule.periods.map((period, periodIndex) => {
          const slot = slots[periodIndex]
          if (!slot) return null

          return (
            <div
              key={period.label}
              className="flex flex-col justify-between rounded-xl border border-border bg-background/50 p-3.5 transition-colors duration-200 hover:border-lime/40 hover:bg-lime/5"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-lime">
                  {period.label}
                </span>
                <span className="text-[0.7rem] tabular-nums text-muted-foreground">
                  {period.time}
                </span>
              </div>

              <div className="mt-2.5">
                <p className="text-sm font-semibold leading-snug text-foreground">
                  {slot.subject}
                </p>
                <p className="mt-1 text-xs font-normal text-muted-foreground">
                  {slot.teacher}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
