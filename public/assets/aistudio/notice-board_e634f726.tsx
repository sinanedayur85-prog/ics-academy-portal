import { Megaphone, Pin } from 'lucide-react'
import { notices } from '@/components/dashboard/data'
import { Panel } from '@/components/dashboard/panel'
import { cn } from '@/lib/utils'

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' })

const categoryTone: Record<string, string> = {
  Exam: 'bg-cyan/15 text-cyan',
  Event: 'bg-lime/15 text-lime',
  Hostel: 'bg-foreground/10 text-foreground',
  Academic: 'bg-foreground/10 text-muted-foreground',
}

export function NoticeBoard() {
  return (
    <Panel
      id="notices"
      eyebrow="Latest announcements"
      title="Notice Board"
      icon={Megaphone}
      action={
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {notices.length} new
        </span>
      }
    >
      <ul className="flex flex-col divide-y divide-border">
        {notices.map((notice) => {
          const [day, month] = dateFormatter.format(new Date(notice.date)).split(' ')
          return (
            <li key={notice.id} className="group flex gap-4 py-4 first:pt-0 last:pb-0">
              <time
                dateTime={notice.date}
                className="flex w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-background/60 py-2 transition-colors group-hover:border-lime/40"
              >
                <span className="font-display text-lg font-semibold leading-none text-foreground">{day}</span>
                <span className="mt-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  {month}
                </span>
              </time>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-[0.7rem] font-semibold', categoryTone[notice.category])}>
                    {notice.category}
                  </span>
                  {notice.pinned ? (
                    <span className="inline-flex items-center gap-1 text-[0.7rem] font-medium text-lime">
                      <Pin className="size-3" aria-hidden="true" /> Pinned
                    </span>
                  ) : null}
                </div>
                <h3 className="text-sm font-semibold text-foreground text-pretty">{notice.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">{notice.body}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
