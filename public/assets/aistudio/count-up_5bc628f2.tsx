'use client'

import { useEffect, useState } from 'react'

type CountUpProps = {
  end: number
  suffix?: string
  duration?: number
}

const formatter = new Intl.NumberFormat('en-US')

export function CountUp({ end, suffix = '', duration = 4000 }: CountUpProps) {
  const [value, setValue] = useState(0)

  useEffect(() => {
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
  }, [end, duration])

  const finalText = `${formatter.format(end)}${suffix}`

  return (
    <>
      <span aria-hidden="true" className="tabular-nums">
        {formatter.format(value)}
        {suffix}
      </span>
      <span className="sr-only">{finalText}</span>
    </>
  )
}
