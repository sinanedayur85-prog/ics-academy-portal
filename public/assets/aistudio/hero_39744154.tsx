import Image from 'next/image'
import { ArrowRight, BookOpen, Users } from 'lucide-react'
import { BrandWordmark } from '@/components/brand-wordmark'
import { Button } from '@/components/ui/button'
import { CountUp } from '@/components/count-up'

export function Hero() {
  return (
    <section id="about" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-40 size-[32rem] rounded-full bg-cyan/10 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 md:py-24 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col items-start gap-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-3 py-1 text-xs font-medium text-lime">
            <span className="size-1.5 rounded-full bg-lime" aria-hidden="true" />
            Digital campus now open
          </span>

          <BrandWordmark
            as="h1"
            gapClassName="gap-[2px]"
            topClassName="text-5xl font-bold text-foreground sm:text-6xl lg:text-7xl"
            bottomClassName="-mt-1 text-2xl font-semibold text-lime sm:text-3xl lg:text-[2.1rem]"
          />

          <p className="max-w-xl text-pretty font-sans text-base leading-relaxed text-muted-foreground md:text-lg">
            A unified digital campus that brings students, class leaders, teachers and the
            principal together — attendance, assignments, announcements and results, all in one
            secure place.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Button
              nativeButton={false}
              render={<a href="#portal" />}
              className="h-12 rounded-full px-7 text-base font-semibold"
            >
              Access the portal
              <ArrowRight data-icon="inline-end" />
            </Button>
            <a
              href="#contact"
              className="text-sm font-medium text-cyan underline-offset-4 hover:underline"
            >
              Talk to the office
            </a>
          </div>

          <dl className="grid w-full max-w-md grid-cols-2 gap-6 border-t border-border pt-6">
            <div className="flex items-center gap-3">
              <Users className="size-5 text-cyan" aria-hidden="true" />
              <div>
                <dt className="text-xs text-muted-foreground">Learners</dt>
                <dd className="font-display text-xl font-semibold">
                  <CountUp end={1200} suffix="+" duration={4000} />
                </dd>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <BookOpen className="size-5 text-lime" aria-hidden="true" />
              <div>
                <dt className="text-xs text-muted-foreground">Faculty</dt>
                <dd className="font-display text-xl font-semibold">
                  <CountUp end={60} suffix="+" duration={4000} />
                </dd>
              </div>
            </div>
          </dl>
        </div>

        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-lime/40 via-transparent to-cyan/40 opacity-60 blur-xl"
          />
          <div className="relative overflow-hidden rounded-[1.75rem] border border-border">
            <Image
              src="/images/campus-aerial.jpeg"
              alt="Aerial view of the ICS Academy campus with white buildings set among green hills"
              width={1280}
              height={960}
              className="aspect-[4/5] w-full object-cover brightness-75 contrast-115 saturate-80 hue-rotate-15"
              priority
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[#0b3a40]/45 mix-blend-color"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan/10 via-transparent to-background/40 mix-blend-soft-light"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(8,30,33,0.75)_100%)]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[1.75rem] shadow-[inset_0_0_80px_rgba(8,30,33,0.9)]"
            />
            <div className="absolute inset-x-4 bottom-4 flex items-center justify-between rounded-2xl border border-border bg-background/80 px-4 py-3 backdrop-blur-md">
              <div>
                <p className="font-display text-base font-semibold">Main Campus</p>
              </div>
              <span className="rounded-full bg-cyan/15 px-3 py-1 text-xs font-medium text-cyan">
                Est. campus
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
