import { ArrowUpRight, Award } from 'lucide-react'
import { EXAM_RESULTS_URL } from '@/components/dashboard/data'

export function ExamResultCard() {
  return (
    <section id="results" aria-labelledby="results-title" className="scroll-mt-24">
      <a
        href={EXAM_RESULTS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative flex flex-col gap-6 overflow-hidden rounded-2xl border border-lime/30 bg-gradient-to-br from-lime/15 via-card to-cyan/15 p-6 transition-all duration-300 outline-none hover:-translate-y-0.5 hover:border-lime/60 hover:shadow-[0_20px_60px_-25px] hover:shadow-lime/40 focus-visible:ring-3 focus-visible:ring-ring/50 md:flex-row md:items-center md:justify-between md:p-8"
      >
        <div className="flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Award className="size-7" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-lime">Exam Result</p>
            <h2 id="results-title" className="font-display text-2xl font-semibold leading-tight text-foreground text-balance md:text-3xl">
              Jamiathul Hind Al Islamiyya Results
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              View your official semester results on the Jamia Hind portal.
            </p>
          </div>
        </div>
        <span className="inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-transform duration-300 md:self-auto">
          Check results
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
