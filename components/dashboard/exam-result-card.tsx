import { ArrowUpRight } from 'lucide-react'
import { EXAM_RESULTS_URL } from '@/components/dashboard/data'

export function ExamResultCard() {
  return (
    <section id="university-portal" aria-labelledby="university-portal-title" className="relative scroll-mt-24">
      {/* Fallback anchor for previous #results links */}
      <span id="results" className="absolute -top-24" aria-hidden="true" />
      <a
        href={EXAM_RESULTS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative flex flex-col gap-6 overflow-hidden rounded-2xl border border-lime/30 bg-gradient-to-br from-lime/15 via-card to-cyan/15 p-6 transition-all duration-300 outline-none hover:-translate-y-0.5 hover:border-lime/60 hover:shadow-[0_20px_60px_-25px] hover:shadow-lime/40 focus-visible:ring-3 focus-visible:ring-ring/50 md:flex-row md:items-center md:justify-between md:p-8"
      >
        <div className="flex items-center gap-4 sm:gap-4.5">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-white p-2.5 shadow-sm transition-colors duration-300 dark:border-lime/30 dark:bg-[#121418]/90 md:size-[4.5rem]">
            <img
              src="/assets/aistudio/jamiathul_hind_logo_d2ba1165.svg"
              alt="Jamiathul Hind Al Islamiyya Logo"
              className="size-full object-contain brightness-0 transition-all duration-300 dark:invert"
            />
          </span>
          <div className="flex flex-col justify-center">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-lime leading-tight">
              University Portal
            </p>
            <h2
              id="university-portal-title"
              className="mt-0.5 font-display text-xl font-semibold leading-tight text-foreground md:text-2xl"
            >
              Jamiathul Hind Al Islamiyya Website
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground leading-normal sm:text-sm">
              Visit the official university portal and academic website.
            </p>
          </div>
        </div>
        <span className="inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-transform duration-300 md:self-auto">
          Visit Website
          <ArrowUpRight
            className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
          <span className="sr-only">(opens in a new tab)</span>
        </span>
      </a>
    </section>
  )
}

