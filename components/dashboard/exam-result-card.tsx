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
        className="group relative flex flex-col gap-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#7C3AED]/12 via-card to-[#0095F6]/12 p-6 transition-all duration-200 outline-none hover:from-[#7C3AED]/18 hover:to-[#0095F6]/18 active:scale-[0.99] md:flex-row md:items-center md:justify-between md:p-8"
      >
        <div className="flex items-center gap-4 sm:gap-4.5">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white p-2.5 transition-colors duration-200 dark:bg-[#141A1F] md:size-[4.5rem]">
            <img
              src="/images/jamiathul-hind-logo.svg"
              alt="Jamiathul Hind Al Islamiyya Logo"
              className="size-full object-contain brightness-0 transition-all duration-300 dark:invert"
            />
          </span>
          <div className="flex flex-col justify-center">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#0077CC] dark:text-[#0095F6] leading-tight">
              Results
            </p>
            <h2
              id="university-portal-title"
              className="mt-0.5 font-display text-xl font-semibold leading-tight text-foreground md:text-2xl"
            >
              Jamiathul Hind
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground leading-normal sm:text-sm">
              University Portal
            </p>
          </div>
        </div>
        <span className="inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-[#0095F6] px-6 text-sm font-semibold text-white transition-all duration-150 group-hover:bg-[#0084DC] md:self-auto">
          Open Portal
          <ArrowUpRight
            className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
          <span className="sr-only">(opens in a new tab)</span>
        </span>
      </a>
    </section>
  )
}

