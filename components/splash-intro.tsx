'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BrandLogoMark } from '@/components/brand-wordmark'

const SPLASH_DURATION_MS = 2500
const TITLE_LETTERS = 'ICS ACADEMY'.split('')

export function SplashIntro() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(false)
    }, SPLASH_DURATION_MS)

    return () => window.clearTimeout(timer)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="ics-splash-intro"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: 1.03,
            transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
          }}
          onClick={() => setVisible(false)}
          role="status"
          aria-label="Loading ICS Academy Manhappatta"
          className="fixed inset-0 z-[120] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-[#0a0b0e] text-white select-none"
        >
          {/* Soft ambient radial glow in the dark splash canvas */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-1/2 left-1/2 size-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-[#8cc63f]/12 via-[#00aeef]/10 to-amber-400/10 blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col items-center px-6">
            {/* 1. Orbital Ring + ICS Logo Mark (Felizia-style orbital ring with glowing dots) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.78, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex size-24 items-center justify-center sm:size-28"
            >
              {/* Outer thin static ring */}
              <svg
                viewBox="0 0 120 120"
                className="pointer-events-none absolute inset-0 size-full"
                aria-hidden="true"
              >
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="1"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="43"
                  fill="none"
                  stroke="rgba(140,198,63,0.18)"
                  strokeWidth="1"
                />
              </svg>

              {/* Rotating orbital arc + glowing satellite dots */}
              <motion.svg
                viewBox="0 0 120 120"
                animate={{ rotate: 360 }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
                className="pointer-events-none absolute inset-0 size-full"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="ics-orbit-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8cc63f" stopOpacity="1" />
                    <stop offset="55%" stopColor="#f59e0b" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#00aeef" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="url(#ics-orbit-grad)"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeDasharray="125 210"
                />
                {/* Primary glowing dot on outer ring */}
                <circle cx="112" cy="60" r="2.8" fill="#fde68a" />
                {/* Secondary cyan dot on inner ring */}
                <circle cx="17" cy="60" r="2" fill="#00aeef" />
              </motion.svg>

              {/* ICS Water-Drop Emblem in Center */}
              <motion.div
                initial={{ opacity: 0, scale: 0.65 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="relative flex items-center justify-center"
              >
                <BrandLogoMark className="h-11 w-auto drop-shadow-[0_0_18px_rgba(0,174,239,0.35)] sm:h-12" />
              </motion.div>
            </motion.div>

            {/* 2. Main Stylized English Heading: ICS ACADEMY */}
            <div className="mt-6 flex flex-wrap items-center justify-center overflow-hidden">
              {TITLE_LETTERS.map((char, idx) => (
                <motion.span
                  key={idx}
                  initial={{ opacity: 0, y: 26, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{
                    duration: 0.5,
                    delay: 0.22 + idx * 0.038,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className={
                    char === ' '
                      ? ' inline-block w-3 sm:w-4'
                      : 'font-display text-3xl font-bold tracking-[0.12em] text-white sm:text-5xl'
                  }
                >
                  {char}
                </motion.span>
              ))}
            </div>

            {/* 3. Spaced Subtitle: MANHAPPATTA */}
            <motion.p
              initial={{ opacity: 0, y: 8, letterSpacing: '0.2em' }}
              animate={{ opacity: 0.78, y: 0, letterSpacing: '0.42em' }}
              transition={{ duration: 0.7, delay: 0.62, ease: [0.16, 1, 0.3, 1] }}
              className="mt-2 pl-[0.42em] text-[10px] font-medium text-white/80 uppercase sm:text-xs"
            >
              MANHAPPATTA
            </motion.p>

            {/* 4. Glowing Horizontal Sweep Line Underneath (ആ വര) */}
            <div className="relative mt-6 h-[2px] w-48 overflow-hidden rounded-full bg-white/10 sm:w-64">
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '0%' }}
                transition={{ duration: 1.75, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="relative h-full w-full rounded-full bg-gradient-to-r from-transparent via-[#8cc63f] to-[#00aeef]"
              >
                <span className="absolute top-1/2 right-0 size-2 -translate-y-1/2 rounded-full bg-amber-200 shadow-[0_0_12px_3px_rgba(140,198,63,0.95)]" />
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
