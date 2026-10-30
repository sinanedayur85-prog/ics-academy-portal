'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

const THEME_STORAGE_KEY = 'ics-theme'

export function ThemeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
    const root = document.documentElement
    const initialDark = saved ? saved === 'dark' : root.classList.contains('dark')
    root.classList.toggle('dark', initialDark)
    setIsDark(initialDark)
    setMounted(true)

    function handleThemeSync(e: Event) {
      const customEvent = e as CustomEvent<{ isDark: boolean }>
      if (customEvent.detail) {
        setIsDark(customEvent.detail.isDark)
      }
    }
    window.addEventListener('ics-theme-change', handleThemeSync)
    return () => window.removeEventListener('ics-theme-change', handleThemeSync)
  }, [])

  function toggleTheme() {
    const nextDark = !isDark
    const root = document.documentElement
    root.classList.toggle('dark', nextDark)
    window.localStorage.setItem(THEME_STORAGE_KEY, nextDark ? 'dark' : 'light')
    setIsDark(nextDark)
    window.dispatchEvent(new CustomEvent('ics-theme-change', { detail: { isDark: nextDark } }))
  }

  const showDark = !mounted || isDark

  return (
    <button
      type="button"
      aria-label={showDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleTheme}
      className={cn(
        'relative inline-flex size-9 shrink-0 cursor-pointer items-center justify-center bg-transparent p-0 text-black transition-colors duration-200 outline-none hover:text-black/70 focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-white/90 dark:hover:text-white',
        className,
      )}
    >
      <span className="sr-only">{showDark ? 'Switch to light mode' : 'Switch to dark mode'}</span>
      <Sun
        className={cn(
          'absolute size-5 transition-all duration-300 ease-out',
          showDark ? 'scale-0 -rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100',
        )}
        aria-hidden="true"
      />
      <Moon
        className={cn(
          'absolute size-5 transition-all duration-300 ease-out',
          showDark ? 'scale-100 rotate-0 opacity-100' : 'scale-0 rotate-90 opacity-0',
        )}
        aria-hidden="true"
      />
    </button>
  )
}
