import { CalendarDays } from 'lucide-react'
import { getTimetable, periods, weekDays, type Student } from '@/components/dashboard/data'
import { Panel } from '@/components/dashboard/panel'
import { cn } from '@/lib/utils'

const TODAY_INDEX = 2

export function Timetable({ student }: { student: Student }) {
  const schedule = getTimetable(student)

  return (
    <Panel
      id="timetable"
      eyebrow={`Class ${student.className} · Weekly schedule`}
      title="Time Table"
      icon={CalendarDays}
    >
      <div className="-mx-5 overflow-x-auto px-5 md:-mx-6 md:px-6">
        <table className="w-full min-w-[640px] border-separate border-spacing-1.5 text-sm">
          <caption className="sr-only">Weekly class schedule for class {student.className}</caption>
          <thead>
            <tr>
              <th scope="col" className="w-16 text-left text-xs font-medium text-muted-foreground">
                <span className="sr-only">Day</span>
              </th>
              {periods.map((period) => (
                <th key={period.label} scope="col" className="pb-1 text-left font-normal">
                  <span className="block text-xs font-semibold text-foreground">{period.label}</span>
                  <span className="block text-[0.7rem] tabular-nums text-muted-foreground">{period.time}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekDays.map((day, dayIndex) => {
              const isToday = dayIndex === TODAY_INDEX
              return (
                <tr key={day}>
                  <th
                    scope="row"
                    className={cn(
                      'rounded-lg px-2 text-left text-xs font-semibold uppercase tracking-wider',
                      isToday ? 'text-lime' : 'text-muted-foreground',
                    )}
                  >
                    {day}
                    {isToday ? <span className="sr-only"> (today)</span> : null}
                  </th>
                  {schedule[dayIndex].map((slot, periodIndex) => (
                    <td
                      key={periodIndex}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 font-medium transition-colors duration-200',
                        isToday
                          ? 'border-lime/30 bg-lime/10 text-foreground'
                          : 'border-border bg-background/50 text-foreground/90 hover:border-cyan/40 hover:bg-cyan/5',
                      )}
                    >
                      <span className="block">{slot.subject}</span>
                      <span className="mt-0.5 block text-xs font-normal text-gray-400/80">{slot.teacher}</span>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
