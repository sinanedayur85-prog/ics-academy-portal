'use client'

import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

const MARQUEE_ITEMS = [
  'ICS ACADEMY MANHAPPATTA',
  "DA'WA COLLEGE",
  'BAHRUL ULOOM RESEARCH CENTRE',
  'ICS ENGLISH SCHOOL',
  'ONE VISION • ENDLESS KNOWLEDGE',
  '11 ACADEMIC CLASSES',
  'DIGITAL CAMPUS 2026',
]

/**
 * Clean borderless scrolling text ticker between Hero and Portal sections,
 * with a simple outline diamond icon separating each phrase.
 */
export function CampusMarqueeRibbon() {
  const repeatedItems = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS]

  return (
    <div
      aria-label="ICS Academy Campus Highlights"
      className="relative z-20 overflow-hidden bg-background py-5 transition-colors duration-300"
    >
      <motion.div
        animate={{ x: ['0%', '-33.333%'] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
        className="flex w-max items-center gap-8 whitespace-nowrap"
      >
        {repeatedItems.map((item, idx) => (
          <div key={idx} className="inline-flex items-center gap-8">
            <span className="font-display text-xs font-semibold tracking-[0.22em] text-foreground/80 uppercase sm:text-sm">
              {item}
            </span>
            <span
              aria-hidden="true"
              className="inline-block size-2 rotate-45 border border-foreground/45 bg-transparent"
            />
          </div>
        ))}
      </motion.div>
    </div>
  )
}

/**
 * Splits a sentence into words that animate smoothly into place every time the user scrolls.
 */
export function AnimatedWords({
  text,
  className,
  wordClassName,
  stagger = 0.04,
  delay = 0,
}: {
  text: string
  className?: string
  wordClassName?: string
  stagger?: number
  delay?: number
}) {
  const words = text.split(' ')

  return (
    <motion.span
      initial="hidden"
      whileInView="visible"
      viewport={{ once: false, amount: 0.25 }}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: stagger,
            delayChildren: delay,
          },
        },
      }}
      className={cn('inline', className)}
    >
      {words.map((word, idx) => (
        <span key={idx} className="inline-block overflow-hidden align-bottom">
          <motion.span
            variants={{
              hidden: { opacity: 0, y: 12 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 1.05, ease: [0.22, 1, 0.36, 1] },
              },
            }}
            className={cn('inline-block will-change-[transform,opacity]', wordClassName)}
          >
            {word}
            {idx < words.length - 1 ? '\u00A0' : ''}
          </motion.span>
        </span>
      ))}
    </motion.span>
  )
}
