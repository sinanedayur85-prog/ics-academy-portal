'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CalendarClock,
  Download,
  Loader2,
  Megaphone,
  Pin,
  Printer,
  ShieldCheck,
  Users,
} from 'lucide-react'
import {
  MONTHS_META,
  formatTargetClassesBadge,
  getNoticeTargetClasses,
  isNoticeVisibleForClass,
  loadCustomNotices,
  notices,
  type Notice,
} from '@/components/dashboard/data'
import { exportNoticeAsPdf, printOfficialNotice } from '@/components/dashboard/notice-pdf'
import { Panel } from '@/components/dashboard/panel'
import { cn } from '@/lib/utils'

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' })

const categoryTone: Record<string, string> = {
  Exam: 'bg-[#7C3AED]/15 text-[#7C3AED] dark:text-[#A78BFA]',
  Event: 'bg-[#0095F6]/15 text-[#0077CC] dark:text-[#0095F6]',
  Hostel: 'bg-foreground/10 text-foreground',
  Academic: 'bg-muted text-muted-foreground',
}

export function NoticeBoard({
  studentClass,
  allowExport = false,
  issuerLabel,
}: {
  studentClass?: string
  allowExport?: boolean
  issuerLabel?: string
}) {
  const [customNotices, setCustomNotices] = useState<Notice[]>([])
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null)

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

  async function handleNoticeExport(notice: Notice, mode: 'pdf' | 'print') {
    const key = `${mode}:${notice.id}`
    if (busyActionKey) return
    setBusyActionKey(key)
    try {
      if (mode === 'pdf') {
        await exportNoticeAsPdf(notice, issuerLabel)
      } else {
        await printOfficialNotice(notice, issuerLabel)
      }
    } finally {
      setBusyActionKey(null)
    }
  }

  return (
    <Panel
      id="notices"
      eyebrow="Campus"
      title="Notices"
      icon={Megaphone}
      action={
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {allNotices.length} active
        </span>
      }
    >
      {allNotices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-muted/60 px-4 py-10 text-center">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#0095F6]/15 text-[#0077CC] dark:text-[#0095F6]">
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
        <ul className="flex flex-col divide-y divide-border/50">
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
            const isPdfBusy = busyActionKey === `pdf:${notice.id}`
            const isPrintBusy = busyActionKey === `print:${notice.id}`

            return (
              <li key={notice.id} className="group flex gap-4 py-4 first:pt-0 last:pb-0">
                <time
                  dateTime={notice.date}
                  className="flex w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-muted py-2.5"
                >
                  <span className="font-display text-lg font-semibold leading-none tabular-nums text-foreground">
                    {day}
                  </span>
                  <span className="mt-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    {month}
                  </span>
                </time>
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold',
                          categoryTone[notice.category] ?? categoryTone.Academic,
                        )}
                      >
                        {notice.category}
                      </span>
                      {!studentClass && (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold',
                            isBatchSpecific
                              ? 'bg-[#0095F6]/15 text-[#0077CC] dark:text-[#38BDF8]'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          <Users className="size-3" aria-hidden="true" />
                          {targetBadgeText}
                        </span>
                      )}
                      {hMeta?.isOfficialHoliday ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#0095F6]/15 px-2.5 py-0.5 text-[0.7rem] font-semibold text-[#0077CC] dark:text-[#0095F6]">
                          <CalendarClock className="size-3" aria-hidden="true" />
                          {hMeta.holidayType === 'monthly-second-saturday'
                            ? 'Official 2nd Saturday Leave'
                            : 'Official Festival / Batch Holiday'}
                        </span>
                      ) : null}
                      {notice.pinned ? (
                        <span className="inline-flex items-center gap-1 text-[0.7rem] font-semibold text-[#0077CC] dark:text-[#0095F6]">
                          <Pin className="size-3" aria-hidden="true" /> Pinned
                        </span>
                      ) : null}
                    </div>

                    {allowExport ? (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          disabled={Boolean(busyActionKey)}
                          onClick={() => void handleNoticeExport(notice, 'pdf')}
                          title="Download Notice PDF"
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-border/60 bg-background px-2 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                        >
                          {isPdfBusy ? (
                            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                          ) : (
                            <Download className="size-3 text-[#0077CC] dark:text-[#0095F6]" aria-hidden="true" />
                          )}
                          PDF
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(busyActionKey)}
                          onClick={() => void handleNoticeExport(notice, 'print')}
                          title="Print Official Notice"
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-border/60 bg-background px-2 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                        >
                          {isPrintBusy ? (
                            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                          ) : (
                            <Printer className="size-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                          )}
                          Print
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <h3 className="text-sm font-semibold text-foreground text-pretty">
                    {notice.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
                    {notice.body}
                  </p>

                  {hMeta?.isOfficialHoliday ? (
                    <div className="mt-3 grid gap-2.5 rounded-2xl bg-[#0095F6]/[0.07] p-3.5 text-xs dark:bg-[#141A1F] sm:grid-cols-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                          Departure Date & Time
                        </span>
                        <span className="font-semibold text-foreground">
                          {hMeta.departureDate}
                        </span>
                        <span className="text-[11px] font-medium text-[#0077CC] dark:text-[#0095F6]">
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
                        <span className="text-[11px] font-medium text-[#0077CC] dark:text-[#38BDF8]">
                          {hMeta.returnTime}
                        </span>
                      </div>

                      <div className="flex flex-col justify-between gap-0.5 border-t border-border/50 pt-2 sm:border-t-0 sm:border-l sm:pl-3 sm:pt-0">
                        <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                          Working Days Impact{!studentClass ? ` (${targetBadgeText})` : ''}
                        </span>
                        <span className="font-semibold text-[#0077CC] dark:text-[#0095F6]">
                          -{hMeta.holidayDaysDeducted} Days Excluded ({monthLabel ?? hMeta.monthId})
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <ShieldCheck className="size-3 text-[#0095F6]" aria-hidden="true" />
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

