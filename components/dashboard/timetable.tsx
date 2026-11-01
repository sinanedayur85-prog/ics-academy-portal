'use client'

import { useEffect, useState } from 'react'
import { Ban, CalendarDays, CheckCircle2, Lock, UserCog } from 'lucide-react'
import {
  CURRENT_SEMESTER,
  getClassSemesterTimetable,
  loadPeriodAttendanceSubmissions,
  type PeriodAttendanceSubmission,
  type Student,
} from '@/components/dashboard/data'
import { Panel } from '@/components/dashboard/panel'
import { cn } from '@/lib/utils'

function getTodayDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function Timetable({ student }: { student: Student }) {
  const [submissions, setSubmissions] = useState<Record<string, PeriodAttendanceSubmission>>({})
  const todayDate = getTodayDateString()

  useEffect(() => {
    function syncAll() {
      setSubmissions(loadPeriodAttendanceSubmissions())
    }
    syncAll()
    window.addEventListener('ics-period-attendance-updated', syncAll)
    window.addEventListener('storage', syncAll)
    return () => {
      window.removeEventListener('ics-period-attendance-updated', syncAll)
      window.removeEventListener('storage', syncAll)
    }
  }, [])

  const classSchedule = getClassSemesterTimetable(student)
  const slots =
    CURRENT_SEMESTER === 1 ? classSchedule.semester1 : classSchedule.semester2

  return (
    <Panel
      id="timetable"
      eyebrow="Semester Schedule & Live Today's Session Status"
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
          const periodNum = periodIndex + 1
          const subKey = `${todayDate}__${student.className}__${periodNum}`
          const sub = submissions[subKey]
          const isNotHeld = sub?.sessionStatus === 'not-held'
          const isSubstituted = sub?.sessionStatus === 'substituted'
          const studentRecord = !isNotHeld ? sub?.records?.[student.id] : undefined

          return (
            <div
              key={period.label}
              className={cn(
                'flex flex-col justify-between rounded-xl border p-3.5 transition-colors duration-200',
                isNotHeld
                  ? 'border-red-500/40 bg-red-500/[0.05]'
                  : isSubstituted
                    ? 'border-cyan/40 bg-cyan/[0.05]'
                    : 'border-border bg-background/50 hover:border-lime/40 hover:bg-lime/5',
              )}
            >
              <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                <span
                  className={cn(
                    'text-xs font-semibold uppercase tracking-wider',
                    isNotHeld ? 'text-red-500 dark:text-red-400' : 'text-lime',
                  )}
                >
                  {period.label}
                </span>
                <span className="text-[0.7rem] tabular-nums text-muted-foreground">
                  {period.time}
                </span>
              </div>

              <div className="mt-2.5 flex flex-col gap-1.5">
                <p className="text-sm font-semibold leading-snug text-foreground">
                  {slot.subject}
                </p>
                <p className="text-xs font-normal text-muted-foreground">
                  {isSubstituted && sub?.substituteUsthad
                    ? `Sub: ${sub.substituteUsthad.usthadName}`
                    : slot.teacher}
                </p>

                {isNotHeld ? (
                  <div className="mt-1.5 flex flex-col gap-1 rounded-lg border border-red-500/30 bg-red-500/10 p-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400">
                      <Ban className="size-3 shrink-0" aria-hidden="true" />
                      ക്ലാസ് നടന്നിട്ടില്ല (Class Not Held)
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-red-600/85 dark:text-red-300/85">
                      <Lock className="size-2.5 shrink-0" aria-hidden="true" />
                      ഹാജർ ലോക്ക് ചെയ്തിരിക്കുന്നു
                    </span>
                  </div>
                ) : isSubstituted ? (
                  <div className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-cyan/30 bg-cyan/10 px-2 py-1 text-[11px] font-semibold text-cyan">
                    <UserCog className="size-3 shrink-0" aria-hidden="true" />
                    Substitute Class Held
                  </div>
                ) : studentRecord ? (
                  <div
                    className={cn(
                      'mt-1.5 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold',
                      studentRecord === 'present'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-lime'
                        : studentRecord === 'absent'
                          ? 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
                    )}
                  >
                    <CheckCircle2 className="size-3 shrink-0" aria-hidden="true" />
                    Today: {studentRecord.toUpperCase()}
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
