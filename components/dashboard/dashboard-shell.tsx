'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Award,
  BookMarked,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Library,
  LogOut,
  Megaphone,
  MessageSquareText,
} from 'lucide-react'
import { BrandWordmark } from '@/components/brand-wordmark'
import { AttendanceCard } from '@/components/dashboard/attendance-card'
import { students } from '@/components/dashboard/data'
import { DigitalLibrary } from '@/components/dashboard/digital-library'
import { ExamResultCard } from '@/components/dashboard/exam-result-card'
import { GeminiChatbot } from '@/components/dashboard/gemini-chatbot'
import { LeaveRegister } from '@/components/dashboard/leave-register'
import { LibraryBooks } from '@/components/dashboard/library-books'
import { NoticeBoard } from '@/components/dashboard/notice-board'
import { StudentSwitcher } from '@/components/dashboard/student-switcher'
import { Timetable } from '@/components/dashboard/timetable'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'

const navItems = [
  { label: "Da'wa College Chatbot", href: '#gemini-chatbot', icon: MessageSquareText },
  { label: 'Digital Library', href: '#digital-library', icon: Library },
  { label: 'Notice Board', href: '#notices', icon: Megaphone },
  { label: 'Attendance', href: '#attendance', icon: CalendarCheck },
  { label: 'Leave Register', href: '#leave', icon: ClipboardList },
  { label: 'Time Table', href: '#timetable', icon: CalendarDays },
  { label: 'Bahrul Uloom Library', href: '#library', icon: BookMarked },
  { label: 'Exam Result', href: '#results', icon: Award },
]

export function DashboardShell() {
  const student = students[0]
  const [isOnLeave, setIsOnLeave] = useState(false)

  return (
    <div className="min-h-svh bg-background transition-colors duration-300 dark:bg-gradient-to-br dark:from-[#081E21] dark:to-[#040F11] lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-background transition-colors duration-300 lg:flex">
        <Link href="/" className="flex h-20 items-center gap-3 border-b border-border px-6" aria-label="ICS Academy Manhappatta home">
          <Image
            src="/images/ics-mark-transparent.png"
            alt="ICS Academy logo"
            width={381}
            height={512}
            className="h-10 w-auto object-contain"
            priority
          />
          <BrandWordmark
            gapClassName="gap-0"
            topClassName="text-lg font-bold text-foreground leading-none"
            bottomClassName="-mt-[2px] text-[10px] font-semibold text-lime leading-none"
          />
        </Link>

        <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-1 p-4">
          <p className="px-3 pb-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {"Da'wa College"}
          </p>
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground"
            >
              <item.icon className="size-4 transition-colors group-hover:text-lime" aria-hidden="true" />
              {item.label}
            </a>
          ))}
        </nav>

        <div className="border-t border-border p-4">
          <Link
            href="/"
            onClick={(event) => {
              event.preventDefault()
              window.localStorage.removeItem('isAuthenticated')
              window.dispatchEvent(new CustomEvent('ics-logout'))
            }}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Log out
          </Link>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md transition-colors duration-300">
        <div className="flex h-20 items-center justify-between gap-4 px-5 md:px-8">
          <Link href="/" className="flex items-center gap-3 lg:hidden" aria-label="ICS Academy Manhappatta home">
            <Image
              src="/images/ics-mark-transparent.png"
              alt="ICS Academy logo"
              width={381}
              height={512}
              className="h-10 w-auto object-contain"
            />
            <BrandWordmark
              gapClassName="gap-0"
              topClassName="text-lg font-bold text-foreground leading-none"
              bottomClassName="-mt-[2px] text-[10px] font-semibold text-lime leading-none"
            />
          </Link>
          <div className="hidden lg:block">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Student Dashboard
            </p>
            <p className="text-sm text-foreground">Academic year 2026–27</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle className="text-foreground/85 hover:text-foreground dark:text-white/90 dark:hover:text-white" />
            <StudentSwitcher student={student} />
          </div>
        </div>

        <nav aria-label="Dashboard sections" className="border-t border-border lg:hidden">
          <ul className="flex gap-1 overflow-x-auto px-3 py-2">
            {navItems.map((item) => (
              <li key={item.href} className="shrink-0">
                <a
                  href={item.href}
                  className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground whitespace-nowrap shrink-0"
                >
                  <item.icon className="size-3.5" aria-hidden="true" />
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 md:px-8 md:py-10">
        <div
          key={student.id}
          className="flex flex-col justify-between gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 md:flex-row md:items-end"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-lime">
                {"Da'wa College Portal"}
              </p>
              <a
                href="#leave"
                role="status"
                aria-live="polite"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wide transition-colors duration-300',
                  isOnLeave
                    ? 'border-red-500/40 bg-red-500/15 text-red-600 dark:border-red-400/40 dark:bg-red-500/20 dark:text-red-400'
                    : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:border-lime/40 dark:bg-lime/15 dark:text-lime',
                )}
              >
                <span
                  className={cn(
                    'size-2 rounded-full',
                    isOnLeave ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 dark:bg-lime',
                  )}
                  aria-hidden="true"
                />
                {isOnLeave ? 'On Leave' : 'At Academy'}
              </a>
            </div>
            <h1 className="mt-1.5 flex flex-col font-display leading-tight text-foreground">
              <span className="text-xl font-normal text-muted-foreground md:text-2xl">
                Welcome,
              </span>
              <span className="mt-0.5 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                {student.firstName}
              </span>
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-xs text-muted-foreground sm:text-sm">
            <p>
              Class <span className="font-medium text-foreground">{student.className}</span>
            </p>
            <span className="text-border" aria-hidden="true">•</span>
            <p>
              Admission no. <span className="font-medium tabular-nums text-foreground">{student.admissionNo}</span>
            </p>
          </div>
        </div>

        <GeminiChatbot student={student} />

        <DigitalLibrary student={student} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="w-full min-w-0 lg:col-span-3">
            <NoticeBoard />
          </div>
          <div className="w-full min-w-0 lg:col-span-2">
            <AttendanceCard student={student} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="w-full min-w-0 lg:col-span-3">
            <LeaveRegister student={student} onLeaveStatusChange={setIsOnLeave} />
          </div>
          <div className="w-full min-w-0 lg:col-span-2">
            <LibraryBooks />
          </div>
        </div>

        <Timetable student={student} />

        <ExamResultCard />
      </main>
    </div>
  )
}
