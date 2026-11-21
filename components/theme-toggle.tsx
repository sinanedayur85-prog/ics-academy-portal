'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

const THEME_STORAGE_KEY = 'ics-theme'

function syncSystemStatusBar(dark: boolean) {
  if (typeof document !== 'undefined') {
    const metaTheme = document.querySelector('meta[name="theme-color"]')
    if (metaTheme) {
      metaTheme.setAttribute('content', dark ? '#000000' : '#FFFFFF')
    }
  }
  if (typeof window !== 'undefined' && window.ICSNativeBridge?.setStatusBarTheme) {
    try {
      window.ICSNativeBridge.setStatusBarTheme(dark)
    } catch {
      // Ignore bridge error
    }
  }
}

export function ThemeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
    const root = document.documentElement
    const initialDark = saved ? saved === 'dark' : true
    root.classList.toggle('dark', initialDark)
    setIsDark(initialDark)
    setMounted(true)
    syncSystemStatusBar(initialDark)

    function handleThemeSync(e: Event) {
      const customEvent = e as CustomEvent<{ isDark: boolean }>
      if (customEvent.detail) {
        setIsDark(customEvent.detail.isDark)
        syncSystemStatusBar(customEvent.detail.isDark)
      }
    }

    window.addEventListener('ics-theme-change', handleThemeSync)
    return () => {
      window.removeEventListener('ics-theme-change', handleThemeSync)
    }
  }, [])

  function toggleTheme() {
    const nextDark = !isDark
    const root = document.documentElement
    root.classList.toggle('dark', nextDark)
    window.localStorage.setItem(THEME_STORAGE_KEY, nextDark ? 'dark' : 'light')
    setIsDark(nextDark)
    syncSystemStatusBar(nextDark)
    window.dispatchEvent(new CustomEvent('ics-theme-change', { detail: { isDark: nextDark } }))
  }

  const showDark = !mounted || isDark

  return (
    <button
      type="button"
      aria-label={showDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleTheme}
      className={cn(
        'relative inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-transparent p-0 text-[#0F1419] transition-all duration-200 outline-none hover:bg-muted active:scale-90 dark:text-[#F5F7FA] dark:hover:bg-white/10',
        className,
      )}
    >
      <span className="sr-only">{showDark ? 'Switch to light mode' : 'Switch to dark mode'}</span>
      <Sun
        className={cn(
          'absolute size-[21px] stroke-[1.9] transition-all duration-300 ease-out',
          showDark ? 'scale-0 -rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100',
        )}
        aria-hidden="true"
      />
      <Moon
        className={cn(
          'absolute size-[21px] stroke-[1.9] transition-all duration-300 ease-out',
          showDark ? 'scale-100 rotate-0 opacity-100' : 'scale-0 rotate-90 opacity-0',
        )}
        aria-hidden="true"
      />
    </button>
  )
}
