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
        'scroll-mt-24 rounded-2xl border border-border bg-card p-5 transition-colors duration-300 hover:border-foreground/15 md:p-6',
        className,
      )}
    >
      <header className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-lime">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div>
            {eyebrow ? (
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {eyebrow}
              </p>
            ) : null}
            <h2 id={`${id}-title`} className="font-display text-xl font-semibold leading-tight text-foreground">
              {title}
            </h2>
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

export const fieldClassName =
  'h-11 w-full min-w-0 rounded-lg border border-input bg-input/30 px-3 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive [color-scheme:dark]'
