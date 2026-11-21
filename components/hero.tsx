'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowRight, BookOpen, Users } from 'lucide-react'
import { motion } from 'motion/react'
import { BrandLogoMark, BrandWordmark } from '@/components/brand-wordmark'
import { AnimatedWords } from '@/components/campus-motion'
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
            setAnimCycle((prev) => prev + 1)
          }
        }
      },
      { threshold: 0.2 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      id="about"
      className="relative isolate flex min-h-[90vh] items-center justify-center overflow-hidden px-6 pt-36 pb-36 transition-colors duration-300 md:min-h-svh md:pt-44 md:pb-44"
    >
      {/* Full-bleed Background Image Slider with Ken Burns Zoom & Crossfade */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-white transition-colors duration-300 dark:bg-black"
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

        {/* Dynamic Theme Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/55 to-white/75 transition-colors duration-300 dark:from-black/82 dark:via-black/78 dark:to-black/95" />

        {/* Seamless Bottom Blending Gradient */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-white via-white/75 to-white/0 transition-colors duration-300 md:h-44 dark:from-black dark:via-black/80 dark:to-black/0" />
      </div>

      {/* Centered Hero Content with Repeatable Scroll Animations */}
      <div
        ref={contentRef}
        className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center"
      >
        <div className="flex flex-col items-center">
          {/* Eyebrow Chip */}
          <motion.span
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-1.5 text-xs font-semibold tracking-wider text-[#0077CC] uppercase backdrop-blur-md transition-colors duration-300 dark:bg-[#0B1014]/90 dark:text-[#0095F6]"
          >
            <BrandLogoMark className="h-4 w-auto" />
            Digital Campus • 2026
          </motion.span>

          {/* Main Wordmark + Underline Sweep */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 1.25, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="mt-7 flex flex-col items-center justify-center"
          >
            <BrandWordmark
              as="h1"
              gapClassName="gap-1 sm:gap-1.5"
              topClassName="text-5xl font-bold text-[#009245] dark:text-[#89C53F] transition-colors duration-300 sm:text-6xl lg:text-7xl leading-none"
              bottomClassName="text-2xl font-semibold text-[#0077CC] transition-colors duration-300 dark:text-[#0095F6] sm:text-3xl lg:text-[2.1rem] leading-none"
            />

            {/* Animated underline under ICS ACADEMY MANHAPPATTA */}
            <div className="relative mt-4 h-[2px] w-44 overflow-hidden rounded-full bg-[#0F1419]/10 sm:w-64 dark:bg-white/15">
              <motion.div
                initial={{ x: '-100%' }}
                whileInView={{ x: '0%' }}
                viewport={{ once: false, amount: 0.2 }}
                transition={{ duration: 1.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="h-full w-full rounded-full bg-gradient-to-r from-transparent via-[#0095F6] to-[#7C3AED]"
              />
            </div>
          </motion.div>

          {/* Moving Words Description */}
          <p className="mt-7 max-w-2xl text-pretty font-sans text-base font-normal tracking-wide leading-relaxed text-[#0F1419] transition-colors duration-300 dark:font-light dark:text-white/90 sm:text-lg md:text-xl md:leading-loose">
            <AnimatedWords
              text="One unified digital campus bringing students, class leaders, Usthads, and the Principal together — attendance, leave, notices, Kitabs, and messenger in one place."
              stagger={0.035}
              delay={0.15}
            />
          </p>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 1.2, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="mt-9 flex flex-wrap items-center justify-center gap-3.5"
          >
            <Button
              nativeButton={false}
              render={<a href="#portal" />}
              className="h-12 rounded-full px-7 text-base font-semibold"
            >
              Open Portal
              <ArrowRight data-icon="inline-end" />
            </Button>
            <a
              href="#contact"
              className="rounded-full bg-white/85 px-6 py-3 text-sm font-semibold tracking-wide text-[#0F1419] backdrop-blur-md transition-all duration-200 hover:bg-white active:scale-[0.98] dark:bg-[#141A1F]/90 dark:text-[#F5F7FA] dark:hover:bg-[#1C2329]"
            >
              Contact Office
            </a>
          </motion.div>

          {/* Centered CountUp Stat Blocks */}
          <motion.dl
            key={animCycle}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 1.25, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="mt-12 grid w-full max-w-md grid-cols-2 gap-8 pt-8 transition-colors duration-300"
          >
            <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-center sm:gap-3.5 sm:text-left">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/85 text-[#0095F6] backdrop-blur-md transition-colors duration-300 dark:bg-[#0B1014]/90">
                <Users className="size-5 stroke-[1.9]" aria-hidden="true" />
              </span>
              <div>
                <dt className="text-xs font-semibold tracking-wider text-[#0F1419]/80 uppercase transition-colors duration-300 dark:font-medium dark:text-[#8E9AA4]">
                  Students
                </dt>
                <dd className="font-display text-3xl font-bold tabular-nums text-[#0F1419] transition-colors duration-300 dark:text-white sm:text-4xl">
                  <CountUp end={1200} suffix="+" duration={4000} />
                </dd>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-center sm:gap-3.5 sm:text-left">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/85 text-[#0077CC] backdrop-blur-md transition-colors duration-300 dark:bg-[#0B1014]/90 dark:text-[#38BDF8]">
                <BookOpen className="size-5 stroke-[1.9]" aria-hidden="true" />
              </span>
              <div>
                <dt className="text-xs font-semibold tracking-wider text-[#0F1419]/80 uppercase transition-colors duration-300 dark:font-medium dark:text-[#8E9AA4]">
                  Faculty
                </dt>
                <dd className="font-display text-3xl font-bold tabular-nums text-[#0F1419] transition-colors duration-300 dark:text-white sm:text-4xl">
                  <CountUp end={60} suffix="+" duration={4000} />
                </dd>
              </div>
            </div>
          </motion.dl>
        </div>
      </div>
    </section>
  )
}

