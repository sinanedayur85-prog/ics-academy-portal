'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'

// Model 4 (4.5s) duration + brief hold before entering the app
const SPLASH_DURATION_MS = 4800
const TITLE_TEXT = 'ICS ACADEMY'
const SUBTITLE_LETTERS = 'MANHAPPATTA'.split('')

// Model 4 timing constants (4.5s Smooth Detailed Sketch & Deliberate Typing)
const PETAL_DRAW_SEC = 1.25
const PETAL_STEP_DELAY_SEC = 0.46
const TITLE_START_MS = 680
const TITLE_CHAR_MS = 115
const SUBTITLE_FLOW_START_SEC =
  (TITLE_START_MS + TITLE_TEXT.length * TITLE_CHAR_MS + 120) / 1000

// Exact vector paths from BrandLogoMark (Zero background shadow/glow)
const LOGO_PATHS = [
  {
    id: 'emerald-left',
    d: 'M 133.5 74.94 C 124.97 103.64, 125.17 118.9, 138.01 146.36 C 97.57 191.81, 51.69 233.52, 38.62 295.7 C 34.61 314.79, 34.97 331.51, 34.91 350.75 C 23.84 324.9, 13.26 303.78, 11.82 274.74 C 7.98 197.29, 85.2 128.03, 133.5 74.94 Z',
    color: '#009245',
    strokeColor: '#009245',
  },
  {
    id: 'lime-bottom',
    d: 'M 144.19 154.98 C 153.4 165.61, 162.66 177.78, 170.06 189.73 C 122.77 260.51, 57.3 361.05, 118.1 443.78 C 134.48 466.06, 159.95 484.38, 186.3 492.69 C 202.45 497.79, 217.34 497.23, 233.58 499.6 C 218.41 500.46, 205.5 502.1, 190.11 500.47 C 108.01 491.8, 70.95 427.16, 38.6 359.6 C 38.94 346.52, 38.61 335.2, 40.58 322.07 C 51.25 251.09, 96.35 204.26, 144.19 154.98 Z',
    color: '#89C53F',
    strokeColor: '#89C53F',
  },
  {
    id: 'cyan-main',
    d: 'M 192.26 11.05 C 208.8 38.99, 219.45 65.35, 238.74 93.05 C 276.74 147.62, 341.68 200.08, 358.45 266.29 C 363.81 287.43, 365.27 304.81, 362.54 326.51 C 356.13 377.52, 309.16 461.06, 258.1 478.21 C 202.98 496.71, 140.31 461.33, 119.39 408.9 C 110.51 386.66, 110.63 365.56, 113.2 342.22 C 118.16 297.25, 143.81 266.34, 161.48 227.52 C 159.47 246.69, 156.79 262.64, 159.01 282.2 C 166.04 344.17, 210.3 387.72, 271.68 396.48 C 288.23 398.85, 301.01 397.08, 317.26 396.33 C 314.82 386.74, 314.16 376.54, 311.46 366.74 C 305.22 344.06, 295.53 325.17, 282.88 305.49 C 266 279.24, 244.32 254.97, 223.83 231.49 C 194.36 197.72, 141.08 148.01, 145.78 99.68 C 148.14 75.41, 164.33 56.8, 176.76 37.01 C 182.13 28.46, 186.93 19.55, 192.26 11.05 Z',
    color: '#00AFD9',
    strokeColor: '#00AFD9',
  },
  {
    id: 'lime-inner',
    d: 'M 231.52 256.23 C 266.84 297.83, 295.46 330.73, 307.55 385.55 C 259.98 386.53, 230.11 375.7, 197.52 340.5 C 221.23 309.34, 224.7 293.91, 231.52 256.23 Z',
    color: '#89C53F',
    strokeColor: '#89C53F',
  },
]

export function SplashIntro() {
  const [visible, setVisible] = useState(true)
  const [typedTitleCount, setTypedTitleCount] = useState(0)
  const [isTypingTitle, setIsTypingTitle] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(false)
    }, SPLASH_DURATION_MS)

    return () => window.clearTimeout(timer)
  }, [])

  // Keyboard Typewriter animation ONLY for "ICS ACADEMY" (Model 4 timing)
  useEffect(() => {
    if (!visible) return

    const timeouts: number[] = []

    timeouts.push(
      window.setTimeout(() => {
        setIsTypingTitle(true)
      }, TITLE_START_MS),
    )

    for (let i = 1; i <= TITLE_TEXT.length; i++) {
      timeouts.push(
        window.setTimeout(() => {
          setTypedTitleCount(i)
        }, TITLE_START_MS + i * TITLE_CHAR_MS),
      )
    }

    const titleDoneMs = TITLE_START_MS + TITLE_TEXT.length * TITLE_CHAR_MS + 180
    timeouts.push(
      window.setTimeout(() => {
        setIsTypingTitle(false)
      }, titleDoneMs),
    )

    return () => {
      timeouts.forEach((t) => window.clearTimeout(t))
    }
  }, [visible])

  const visibleTitle = TITLE_TEXT.slice(0, typedTitleCount)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="ics-splash-intro"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: 1.01,
            transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
          }}
          onClick={() => setVisible(false)}
          role="status"
          aria-label="Loading ICS Academy Manhappatta"
          className="fixed inset-0 z-[120] flex flex-col items-center justify-center overflow-hidden bg-[#0a0b0e] text-white select-none"
        >
          <div className="relative z-10 flex flex-col items-center px-6">
            {/* 1. Model 4 (4.5s) Step-by-Step Petal Sketch & Fill (Zero background light / shadow) */}
            <div className="relative flex h-24 w-24 items-center justify-center sm:h-28 sm:w-28">
              <motion.svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 381 512"
                fill="none"
                shapeRendering="geometricPrecision"
                initial={{ scale: 0.94 }}
                animate={{ scale: 1 }}
                transition={{ duration: 2.9, ease: 'easeOut' }}
                className="h-20 w-auto sm:h-24"
              >
                {LOGO_PATHS.map((p, i) => {
                  const stepDelay = i * PETAL_STEP_DELAY_SEC
                  return (
                    <g key={p.id}>
                      {/* Crisp Brand Color Fill */}
                      <motion.path
                        d={p.d}
                        fill={p.color}
                        initial={{ fillOpacity: 0 }}
                        animate={{ fillOpacity: [0, 0, 1] }}
                        transition={{
                          duration: PETAL_DRAW_SEC * 0.92,
                          times: [0, 0.56, 1],
                          delay: stepDelay,
                          ease: 'easeOut',
                        }}
                      />
                      {/* Crisp Vector Sketch Outline */}
                      <motion.path
                        d={p.d}
                        stroke={p.strokeColor}
                        strokeWidth={8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        initial={{ pathLength: 0, strokeOpacity: 0 }}
                        animate={{
                          pathLength: [0, 1, 1],
                          strokeOpacity: [1, 1, 0],
                        }}
                        transition={{
                          duration: PETAL_DRAW_SEC,
                          times: [0, 0.72, 1],
                          delay: stepDelay,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      />
                    </g>
                  )
                })}
              </motion.svg>
            </div>

            {/* 2. Exact Home Screen Header Wordmark Alignment (BrandWordmark layout + El Messiri font-display) */}
            <div className="mt-4 inline-flex w-max flex-col font-display antialiased">
              {/* Top Line: "ICS ACADEMY" with Keyboard Typewriter Animation */}
              <span className="relative -ml-[0.078em] block text-3xl leading-none font-bold text-white sm:text-5xl">
                {/* Invisible full text preserves exact width so MANHAPPATTA below aligns edge-to-edge */}
                <span className="invisible select-none" aria-hidden="true">
                  {TITLE_TEXT}
                </span>
                <span className="absolute inset-y-0 left-0 flex items-center whitespace-pre">
                  <span>{visibleTitle}</span>
                  {isTypingTitle && (
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
                      className="ml-1 inline-block h-7 w-[2.5px] bg-[#89C53F] sm:h-10"
                    />
                  )}
                </span>
              </span>

              {/* Bottom Line: "MANHAPPATTA" in ICS Font (font-display), edge-to-edge aligned like Header, with Flowing Animation */}
              <span
                aria-label="MANHAPPATTA"
                className="mt-[2.4px] flex w-full justify-between text-[17px] leading-none font-semibold text-emerald-400 sm:text-[27px]"
              >
                {SUBTITLE_LETTERS.map((letter, index, letters) => (
                  <motion.span
                    key={index}
                    initial={{
                      opacity: 0,
                      x: -14,
                      y: 12,
                      filter: 'blur(5px)',
                    }}
                    animate={{
                      opacity: 1,
                      x: 0,
                      y: [12, -2, 0],
                      filter: 'blur(0px)',
                    }}
                    transition={{
                      duration: 0.75,
                      delay: SUBTITLE_FLOW_START_SEC + index * 0.055,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className={cn(
                      index === 0 && '-ml-[0.078em]',
                      index === letters.length - 1 && 'mr-[0.03em]',
                    )}
                  >
                    {letter}
                  </motion.span>
                ))}
              </span>
            </div>

            {/* 3. Clean Horizontal Sweep Line Underneath */}
            <div className="relative mt-6 h-[2px] w-48 overflow-hidden rounded-full bg-white/10 sm:w-64">
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '0%' }}
                transition={{
                  duration: 1.3,
                  delay: 2.7,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="relative h-full w-full rounded-full bg-gradient-to-r from-[#009245] via-[#89C53F] to-[#00AFD9]"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
