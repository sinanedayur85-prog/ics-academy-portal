'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Megaphone, Pin, ShieldCheck, Users } from 'lucide-react'
import {
  MONTHS_META,
  formatTargetClassesBadge,
  getNoticeTargetClasses,
  isNoticeVisibleForClass,
  loadCustomNotices,
  notices,
  type Notice,
} from '@/components/dashboard/data'
import { Panel } from '@/components/dashboard/panel'
import { cn } from '@/lib/utils'

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' })

const categoryTone: Record<string, string> = {
  Exam: 'bg-cyan/15 text-cyan',
  Event: 'bg-lime/15 text-lime',
  Hostel: 'bg-foreground/10 text-foreground',
  Academic: 'bg-foreground/10 text-muted-foreground',
}

export function NoticeBoard({ studentClass }: { studentClass?: string }) {
  const [customNotices, setCustomNotices] = useState<Notice[]>([])

  useEffect(() => {
    function syncNotices() {
      setCustomNotices(loadCustomNotices())
    }
    syncNotices()
    window.addEventListener('ics-notices-updated', syncNotices)
    window.addEventListener('storage', syncNotices)
    return () => {
      window.removeEventListener('ics-notices-updated', syncNotices)
      window.removeEventListener('storage', syncNotices)
    }
  }, [])

  const allNotices = useMemo(() => {
    const combined = [...customNotices, ...notices].filter((nt) =>
      isNoticeVisibleForClass(nt, studentClass),
    )
    return combined.sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) {
        return a.pinned ? -1 : 1
      }
      return b.date.localeCompare(a.date)
    })
  }, [customNotices, studentClass])

  return (
    <Panel
      id="notices"
      eyebrow={
        studentClass
          ? `Announcements & Holiday Schedule • ${studentClass}`
          : 'Latest announcements & official holiday schedule'
      }
      title="Notice Board"
      icon={Megaphone}
      action={
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {allNotices.length} active
        </span>
      }
    >
      {allNotices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-lime/15 text-lime">
            <Megaphone className="size-5" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">
            No Announcements Published Yet
          </p>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            Official announcements, exam schedules, and holiday notices will appear here as soon as they are published by the Principal or Class Usthads.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {allNotices.map((notice) => {
            const parsedDate = new Date(notice.date)
            const formatted = Number.isNaN(parsedDate.getTime())
              ? '30 Oct'
              : dateFormatter.format(parsedDate)
            const [day, month] = formatted.split(' ')
            const hMeta = notice.holidayMeta
            const monthLabel = hMeta?.monthId
              ? MONTHS_META.find((m) => m.id === hMeta.monthId)?.month ?? hMeta.monthId
              : null
            const targetBatches = getNoticeTargetClasses(notice)
            const targetBadgeText = formatTargetClassesBadge(targetBatches)
            const isBatchSpecific = targetBatches.length > 0

            return (
              <li key={notice.id} className="group flex gap-4 py-4 first:pt-0 last:pb-0">
                <time
                  dateTime={notice.date}
                  className="flex w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-background/60 py-2 transition-colors group-hover:border-lime/40"
                >
                  <span className="font-display text-lg font-semibold leading-none tabular-nums text-foreground">
                    {day}
                  </span>
                  <span className="mt-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    {month}
                  </span>
                </time>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[0.7rem] font-semibold',
                        categoryTone[notice.category] ?? categoryTone.Academic,
                      )}
                    >
                      {notice.category}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold',
                        isBatchSpecific
                          ? 'border-cyan/40 bg-cyan/15 text-cyan'
                          : 'border-border bg-muted/60 text-muted-foreground',
                      )}
                    >
                      <Users className="size-3" aria-hidden="true" />
                      {targetBadgeText}
                    </span>
                    {hMeta?.isOfficialHoliday ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-lime/40 bg-lime/15 px-2.5 py-0.5 text-[0.7rem] font-bold text-emerald-700 dark:text-lime">
                        <CalendarClock className="size-3" aria-hidden="true" />
                        {hMeta.holidayType === 'monthly-second-saturday'
                          ? 'Official 2nd Saturday Leave'
                          : 'Official Festival / Batch Holiday'}
                      </span>
                    ) : null}
                    {notice.pinned ? (
                      <span className="inline-flex items-center gap-1 text-[0.7rem] font-medium text-lime">
                        <Pin className="size-3" aria-hidden="true" /> Pinned
                      </span>
                    ) : null}
                  </div>
                  <h3 className="text-sm font-semibold text-foreground text-pretty">
                    {notice.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
                    {notice.body}
                  </p>

                  {hMeta?.isOfficialHoliday ? (
                    <div className="mt-2.5 grid gap-2.5 rounded-xl border border-lime/30 bg-lime/[0.06] p-3 text-xs sm:grid-cols-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                          Departure Date & Time
                        </span>
                        <span className="font-semibold text-foreground">
                          {hMeta.departureDate}
                        </span>
                        <span className="text-[11px] font-medium text-emerald-700 dark:text-lime">
                          {hMeta.departureTime}
                        </span>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                          Return to Campus
                        </span>
                        <span className="font-semibold text-foreground">
                          {hMeta.returnDate}
                        </span>
                        <span className="text-[11px] font-medium text-cyan">
                          {hMeta.returnTime}
                        </span>
                      </div>

                      <div className="flex flex-col justify-between gap-0.5 border-t border-border/60 pt-2 sm:border-t-0 sm:border-l sm:pl-3 sm:pt-0">
                        <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                          Working Days Impact ({targetBadgeText})
                        </span>
                        <span className="font-semibold text-emerald-700 dark:text-lime">
                          -{hMeta.holidayDaysDeducted} Days Excluded ({monthLabel ?? hMeta.monthId})
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <ShieldCheck className="size-3 text-lime" aria-hidden="true" />
                          Not counted as student leave • {hMeta.announcedBy}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

