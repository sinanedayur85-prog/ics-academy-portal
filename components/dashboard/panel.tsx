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
        'scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card p-4 transition-colors duration-300 hover:border-foreground/15 sm:p-5 md:p-6',
        className,
      )}
    >
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-lime">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <p className="break-words text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-[0.7rem] sm:tracking-[0.18em]">
                {eyebrow}
              </p>
            ) : null}
            <h2
              id={`${id}-title`}
              className="break-words font-display text-lg font-semibold leading-tight text-foreground sm:text-xl"
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
  'h-11 w-full min-w-0 rounded-lg border border-input bg-input/30 px-3 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:[color-scheme:dark]'
