'use client'

import { useEffect, useRef, useState } from 'react'

type CountUpProps = {
  end: number
  suffix?: string
  duration?: number
}

const formatter = new Intl.NumberFormat('en-US')

export function CountUp({ end, suffix = '', duration = 4000 }: CountUpProps) {
  const [value, setValue] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const elementRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const node = elementRef.current
    if (!node) return

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setIsVisible(entry.isIntersecting)
        }
      },
      { threshold: 0.2 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isVisible) {
      setValue(0)
      return
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(end)
      return
    }

    let frame = 0
    let start: number | null = null

    const tick = (now: number) => {
      if (start === null) start = now
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * end))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isVisible, end, duration])

  const finalText = `${formatter.format(end)}${suffix}`

  return (
    <>
      <span ref={elementRef} aria-hidden="true" className="tabular-nums">
        {formatter.format(value)}
        {suffix}
      </span>
      <span className="sr-only">{finalText}</span>
    </>
  )
}
