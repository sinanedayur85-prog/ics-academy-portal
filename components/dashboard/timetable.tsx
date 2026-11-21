'use client'

import { useEffect, useState } from 'react'
import { Ban, CalendarDays, CheckCircle2, Coffee, Lock, UserCog } from 'lucide-react'
import {
  getActiveSemester,
  getClassSemesterTimetable,
  isNonTeachingTimetableSlot,
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
  const [, setConfigVersion] = useState(0)
  const todayDate = getTodayDateString()

  useEffect(() => {
    function syncAll() {
      setSubmissions(loadPeriodAttendanceSubmissions())
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
  }, [])

  const activeSemester = getActiveSemester()
  const classSchedule = getClassSemesterTimetable(student)
  const slots = activeSemester === 1 ? classSchedule.semester1 : classSchedule.semester2

  return (
    <Panel
      id="timetable"
      eyebrow="Schedule"
      title="Timetable"
      icon={CalendarDays}
      action={
        <span className="inline-flex items-center rounded-full bg-[#0095F6]/15 px-3 py-1 text-xs font-semibold text-[#0077CC] dark:text-[#0095F6]">
          Semester {activeSemester}
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {classSchedule.periods.map((period, periodIndex) => {
          const slot = slots[periodIndex]
          if (!slot) return null
          const isNonTeaching = isNonTeachingTimetableSlot(slot)
          const isRefreshment =
            slot.subject.toLowerCase().includes('refreshment') ||
            slot.subject.toLowerCase().includes('break')
          const periodNum = periodIndex + 1
          const subKey = `${todayDate}__${student.className}__${periodNum}`
          const sub = !isNonTeaching ? submissions[subKey] : undefined
          const isNotHeld = sub?.sessionStatus === 'not-held'
          const isSubstituted = sub?.sessionStatus === 'substituted'
          const studentRecord = !isNotHeld ? sub?.records?.[student.id] : undefined

          return (
            <div
              key={`${period.label}_${periodNum}`}
              className={cn(
                'flex flex-col justify-between rounded-2xl p-3.5 transition-colors duration-150',
                isNonTeaching
                  ? 'bg-muted/50'
                  : isNotHeld
                    ? 'bg-red-500/10'
                    : isSubstituted
                      ? 'bg-[#0095F6]/10'
                      : 'bg-muted/70 hover:bg-muted dark:bg-[#141A1F] dark:hover:bg-[#1C2329]',
              )}
            >
              <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
                <span
                  className={cn(
                    'text-xs font-semibold uppercase tracking-wider',
                    isNonTeaching
                      ? 'text-muted-foreground'
                      : isNotHeld
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-[#0077CC] dark:text-[#0095F6]',
                  )}
                >
                  {period.label}
                </span>
                <span className="text-[0.7rem] tabular-nums text-muted-foreground">
                  {period.time}
                </span>
              </div>

              <div className="mt-2.5 flex flex-col gap-1.5">
                <p
                  className={cn(
                    'text-sm font-semibold leading-snug',
                    isNonTeaching ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {slot.subject}
                </p>
                <p className="text-xs font-normal text-muted-foreground">
                  {isNonTeaching
                    ? isRefreshment
                      ? 'Break Interval'
                      : 'Free Period'
                    : isSubstituted && sub?.substituteUsthad
                      ? `Sub: ${sub.substituteUsthad.usthadName}`
                      : slot.teacher}
                </p>

                {isNonTeaching ? (
                  <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-xl bg-background/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    <Coffee className="size-3 shrink-0" aria-hidden="true" />
                    {isRefreshment ? 'Refreshment Break' : 'No Class Scheduled'}
                  </div>
                ) : isNotHeld ? (
                  <div className="mt-1.5 flex flex-col gap-1 rounded-xl bg-red-500/15 p-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400">
                      <Ban className="size-3 shrink-0" aria-hidden="true" />
                      Class Not Held
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-red-600/85 dark:text-red-300/85">
                      <Lock className="size-2.5 shrink-0" aria-hidden="true" />
                      Attendance Locked
                    </span>
                  </div>
                ) : isSubstituted ? (
                  <div className="mt-1.5 inline-flex items-center gap-1 rounded-xl bg-[#0095F6]/15 px-2.5 py-1 text-[11px] font-semibold text-[#0077CC] dark:text-[#38BDF8]">
                    <UserCog className="size-3 shrink-0" aria-hidden="true" />
                    Substitute Class Held
                  </div>
                ) : studentRecord ? (
                  <div
                    className={cn(
                      'mt-1.5 inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-semibold',
                      studentRecord === 'present'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : studentRecord === 'absent'
                          ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
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
