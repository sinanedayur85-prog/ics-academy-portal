import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type PanelProps = {
  id: string
  title: string
  eyebrow?: string
  icon: LucideIcon
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function Panel({ id, title, eyebrow, icon: Icon, action, className, children }: PanelProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        'scroll-mt-24 overflow-hidden rounded-3xl bg-card p-4 transition-colors duration-200 sm:p-5 md:p-6',
        className,
      )}
    >
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 sm:items-center sm:gap-4">
        <div className="flex min-w-0 max-w-full items-center gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#0095F6]/12 text-[#0077CC] dark:text-[#0095F6]">
            <Icon className="size-5 stroke-[1.9]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-xs">
                {eyebrow}
              </p>
            ) : null}
            <h2
              id={`${id}-title`}
              className="font-display text-lg font-semibold leading-tight text-foreground sm:text-xl"
            >
              {title}
            </h2>
          </div>
        </div>
        {action ? <div className="w-full min-w-0 max-w-full sm:w-auto">{action}</div> : null}
      </header>
      {children}
    </section>
  )
}

export const fieldClassName =
  'h-11 w-full min-w-0 rounded-xl border-0 bg-muted px-3.5 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:bg-accent dark:bg-[#141A1F] dark:focus-visible:bg-[#1C2329] dark:[color-scheme:dark]'
