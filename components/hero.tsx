'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowRight, BookOpen, Users } from 'lucide-react'
import { BrandWordmark } from '@/components/brand-wordmark'
import { Button } from '@/components/ui/button'
import { CountUp } from '@/components/count-up'
import { cn } from '@/lib/utils'

const HERO_SLIDES = [
  {
    src: '/campus-1.jpg',
    alt: 'Aerial view of the ICS Academy Manhappatta campus set among green hills',
  },
  {
    src: '/campus-2.jpg',
    alt: 'ICS Academy Manhappatta main academic buildings and hillside grounds',
  },
  {
    src: '/campus-3.jpg',
    alt: 'Panoramic view of the ICS Academy Manhappatta digital campus',
  },
]

const SLIDE_INTERVAL_MS = 5000

export function Hero() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isInView, setIsInView] = useState(true)
  const [animCycle, setAnimCycle] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % HERO_SLIDES.length)
    }, SLIDE_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const node = contentRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsInView(true)
            setAnimCycle((prev) => prev + 1)
          } else {
            setIsInView(false)
          }
        }
      },
      { threshold: 0.25 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const revealClass = isInView ? 'animate-fade-in-up' : 'opacity-0 translate-y-12'

  return (
    <section
      id="about"
      className="relative isolate flex min-h-[90vh] items-center justify-center overflow-hidden border-b border-black/15 px-6 pt-36 pb-36 transition-colors duration-300 md:min-h-svh md:pt-44 md:pb-44 dark:border-white/20"
    >
      {/* Full-bleed Background Image Slider with Ken Burns Zoom & Crossfade */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-white transition-colors duration-300 dark:bg-[#081e21]"
      >
        {HERO_SLIDES.map((slide, index) => {
          const isActive = index === activeIndex
          return (
            <div
              key={slide.src}
              className={cn(
                'absolute inset-0 transition-opacity duration-1000 ease-in-out',
                isActive ? 'opacity-100' : 'opacity-0',
              )}
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                width={1920}
                height={1080}
                priority={index === 0}
                className={cn(
                  'h-full w-full object-cover object-center transition-transform duration-[6000ms] ease-out will-change-transform',
                  isActive ? 'scale-110' : 'scale-100',
                )}
              />
            </div>
          )
        })}

        {/* Dynamic Theme Overlay: Lighter white/55 in Light mode so the campus image is vibrantly visible, rich dark green in Dark mode */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/55 via-white/50 to-white/60 transition-colors duration-300 dark:from-[#081e21]/85 dark:via-emerald-950/75 dark:to-[#081e21]/85" />

        {/* Seamless Bottom Blending Gradient fading from white (Light mode) or #081e21 (Dark mode) to transparent */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white via-white/65 to-white/0 transition-colors duration-300 md:h-40 dark:from-[#081e21] dark:via-[#081e21]/75 dark:to-[#081e21]/0" />
      </div>

      {/* Centered Hero Content with Pure Black (Light Mode) and White (Dark Mode) Typography */}
      <div
        ref={contentRef}
        className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center"
      >
        <div key={animCycle} className="flex flex-col items-center">
          <span
            style={{ animationDelay: isInView ? '150ms' : '0ms' }}
            className={cn(
              revealClass,
              'inline-flex items-center gap-2 rounded-full border border-emerald-800/35 bg-white/75 px-4 py-1.5 text-xs font-semibold tracking-wider text-emerald-900 uppercase backdrop-blur-xs transition-colors duration-300 dark:border-lime/40 dark:bg-[#081e21]/50 dark:text-lime',
            )}
          >
            <span className="size-1.5 rounded-full bg-emerald-800 dark:bg-lime" aria-hidden="true" />
            Digital campus now open
          </span>

          <div
            style={{ animationDelay: isInView ? '350ms' : '0ms' }}
            className={cn(revealClass, 'mt-7 flex justify-center')}
          >
            <BrandWordmark
              as="h1"
              gapClassName="gap-[2px]"
              topClassName="text-5xl font-bold text-black transition-colors duration-300 dark:text-white sm:text-6xl lg:text-7xl"
              bottomClassName="-mt-1 text-2xl font-semibold text-emerald-900 transition-colors duration-300 dark:text-emerald-400 sm:text-3xl lg:text-[2.1rem]"
            />
          </div>

          <p
            style={{ animationDelay: isInView ? '550ms' : '0ms' }}
            className={cn(
              revealClass,
              'mt-7 max-w-2xl text-pretty font-sans text-base font-normal tracking-wide leading-relaxed text-black transition-colors duration-300 dark:font-light dark:text-white/90 sm:text-lg md:text-xl md:leading-loose',
            )}
          >
            A unified digital campus that brings students, class leaders, teachers and the principal
            together — attendance, assignments, announcements and results, all in one secure place.
          </p>

          <div
            style={{ animationDelay: isInView ? '750ms' : '0ms' }}
            className={cn(revealClass, 'mt-9 flex flex-wrap items-center justify-center gap-4')}
          >
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
              className="rounded-full border border-black/25 bg-white/75 px-6 py-3 text-sm font-semibold tracking-wide text-black backdrop-blur-xs transition-colors duration-300 hover:border-cyan hover:bg-white hover:underline dark:border-white/25 dark:bg-[#081e21]/40 dark:text-cyan dark:hover:bg-[#081e21]/65"
            >
              Talk to the office
            </a>
          </div>

          {/* Centered CountUp Stat Blocks Directly Under the Buttons */}
          <dl
            style={{ animationDelay: isInView ? '950ms' : '0ms' }}
            className={cn(
              revealClass,
              'mt-12 grid w-full max-w-md grid-cols-2 gap-8 border-t border-black/25 pt-8 transition-colors duration-300 dark:border-white/25',
            )}
          >
          <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-center sm:gap-3.5 sm:text-left">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-black/15 bg-white/75 text-cyan backdrop-blur-xs transition-colors duration-300 dark:border-white/15 dark:bg-[#081e21]/45">
              <Users className="size-5 text-cyan" aria-hidden="true" />
            </span>
            <div>
              <dt className="text-xs font-semibold tracking-wider text-black uppercase transition-colors duration-300 dark:font-medium dark:text-white/80">
                Learners
              </dt>
              <dd className="font-display text-3xl font-bold text-black transition-colors duration-300 dark:text-white sm:text-4xl">
                <CountUp end={1200} suffix="+" duration={4000} />
              </dd>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-center sm:gap-3.5 sm:text-left">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-black/15 bg-white/75 text-emerald-800 backdrop-blur-xs transition-colors duration-300 dark:border-white/15 dark:bg-[#081e21]/45 dark:text-lime">
              <BookOpen className="size-5 text-emerald-800 dark:text-lime" aria-hidden="true" />
            </span>
            <div>
              <dt className="text-xs font-semibold tracking-wider text-black uppercase transition-colors duration-300 dark:font-medium dark:text-white/80">
                Faculty
              </dt>
              <dd className="font-display text-3xl font-bold text-black transition-colors duration-300 dark:text-white sm:text-4xl">
                <CountUp end={60} suffix="+" duration={4000} />
              </dd>
            </div>
          </div>
          </dl>
        </div>
      </div>
    </section>
  )
}
