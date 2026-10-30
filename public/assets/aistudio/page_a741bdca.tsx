'use client'

import { useState } from 'react'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { Hero } from '@/components/hero'
import { LoginPortal, dawaCollegeRoles, englishSchoolRoles } from '@/components/login-portal'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

export default function Page() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  function handleStudentLogin() {
    setIsLoggedIn(true)
    window.scrollTo({ top: 0 })
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
          description="Four tiers of access, each tailored to what you need on campus. Select your role below and sign in with your academy credentials."
          roles={dawaCollegeRoles}
          gridClassName="sm:grid-cols-2 lg:grid-cols-4"
          onStudentLogin={handleStudentLogin}
        />
        <LoginPortal
          id="english-school-portal"
          eyebrow="ICS English School Portal"
          description="Three tiers of access, each tailored to what you need on campus."
          roles={englishSchoolRoles}
          gridClassName="grid-cols-1 md:grid-cols-3"
          className="mt-16 md:mt-24"
          onStudentLogin={handleStudentLogin}
        />
      </main>
      <SiteFooter />
    </>
  )
}
