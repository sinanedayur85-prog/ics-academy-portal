'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { Hero } from '@/components/hero'
import { LoginPortal, dawaCollegeRoles, englishSchoolRoles } from '@/components/login-portal'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { cn } from '@/lib/utils'

const AUTH_STORAGE_KEY = 'isAuthenticated'

export default function Page() {
  const [hasMounted, setHasMounted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showEnglishPortal, setShowEnglishPortal] = useState(false)

  useEffect(() => {
    const authenticated = window.localStorage.getItem(AUTH_STORAGE_KEY) === 'true'
    setIsLoggedIn(authenticated)
    setHasMounted(true)

    function handleLogout() {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      setIsLoggedIn(false)
      window.scrollTo({ top: 0 })
    }

    window.addEventListener('ics-logout', handleLogout)
    return () => window.removeEventListener('ics-logout', handleLogout)
  }, [])

  function handleStudentLogin() {
    window.localStorage.setItem(AUTH_STORAGE_KEY, 'true')
    setIsLoggedIn(true)
    window.scrollTo({ top: 0 })
  }

  // Wait for client mount before rendering persistent auth state to prevent hydration mismatch
  if (!hasMounted) {
    return <div className="min-h-svh bg-background" aria-hidden="true" />
  }

  if (isLoggedIn) {
    return <DashboardShell />
  }

  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <LoginPortal
          id="portal"
          eyebrow="Da'wa College Portal"
          description="Four tiers of access, each tailored to what you need on campus. Select your role below and log in with your academy credentials."
          roles={dawaCollegeRoles}
          gridClassName="sm:grid-cols-2 lg:grid-cols-4"
          className="border-t-0 bg-background"
          onStudentLogin={handleStudentLogin}
        />

        {/* Toggle Divider Section between Da'wa College Portal and ICS English School Portal */}
        <div className="relative border-t border-border bg-background/60 py-10 md:py-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto h-px max-w-5xl -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan/30 to-transparent"
          />
          <div className="relative mx-auto flex max-w-7xl flex-col items-center justify-center px-6">
            <button
              type="button"
              aria-expanded={showEnglishPortal}
              aria-controls="english-school-portal-region"
              onClick={() => setShowEnglishPortal((prev) => !prev)}
              className={cn(
                'group inline-flex items-center gap-3 rounded-full border px-6 py-3.5 text-sm font-semibold transition-all duration-300 outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                showEnglishPortal
                  ? 'border-cyan bg-card text-cyan shadow-[0_0_30px_-8px_var(--cyan)]'
                  : 'border-cyan/40 bg-card/90 text-foreground shadow-lg shadow-black/25 hover:-translate-y-0.5 hover:border-cyan hover:text-cyan hover:shadow-[0_0_25px_-8px_var(--cyan)]',
              )}
            >
              <span className="tracking-wide">
                {showEnglishPortal ? 'Hide ICS English School Portal' : 'ICS English School Portal'}
              </span>
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full bg-cyan/15 text-cyan transition-transform duration-300',
                  showEnglishPortal && 'rotate-180 bg-cyan text-background',
                )}
              >
                <ChevronDown className="size-4" aria-hidden="true" />
              </span>
            </button>
          </div>
        </div>

        {/* Smooth Height & Fade Collapsible Region for ICS English School Portal */}
        <div
          id="english-school-portal-region"
          aria-hidden={!showEnglishPortal}
          className={cn(
            'grid transition-all duration-500 ease-in-out',
            showEnglishPortal
              ? 'grid-rows-[1fr] opacity-100'
              : 'pointer-events-none grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="overflow-hidden">
            <LoginPortal
              id="english-school-portal"
              eyebrow="ICS English School Portal"
              description="Three tiers of access, each tailored to what you need on campus."
              roles={englishSchoolRoles}
              gridClassName="grid-cols-1 md:grid-cols-3"
              onStudentLogin={handleStudentLogin}
            />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
