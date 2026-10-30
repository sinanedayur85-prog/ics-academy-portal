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
  LogOut,
  Megaphone,
} from 'lucide-react'
import { BrandWordmark } from '@/components/brand-wordmark'
import { AttendanceCard } from '@/components/dashboard/attendance-card'
import { students } from '@/components/dashboard/data'
import { ExamResultCard } from '@/components/dashboard/exam-result-card'
import { LeaveRegister } from '@/components/dashboard/leave-register'
import { LibraryBooks } from '@/components/dashboard/library-books'
import { NoticeBoard } from '@/components/dashboard/notice-board'
import { StudentSwitcher } from '@/components/dashboard/student-switcher'
import { Timetable } from '@/components/dashboard/timetable'

const navItems = [
  { label: 'Notice Board', href: '#notices', icon: Megaphone },
  { label: 'Attendance', href: '#attendance', icon: CalendarCheck },
  { label: 'Leave Register', href: '#leave', icon: ClipboardList },
  { label: 'Time Table', href: '#timetable', icon: CalendarDays },
  { label: 'Library', href: '#library', icon: BookMarked },
  { label: 'Exam Result', href: '#results', icon: Award },
]

export function DashboardShell() {
  const [student, setStudent] = useState(students[0])

  return (
    <div className="min-h-svh bg-gradient-to-br from-[#081E21] to-[#040F11] lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-background lg:flex">
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
            gapClassName="gap-[2px]"
            topClassName="text-lg font-bold text-foreground leading-none"
            bottomClassName="text-[0.7rem] font-semibold text-lime leading-none"
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
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </Link>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
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
              className="hidden sm:inline-flex"
              gapClassName="gap-[2px]"
              topClassName="text-lg font-bold text-foreground leading-none"
              bottomClassName="text-[0.7rem] font-semibold text-lime leading-none"
            />
          </Link>
          <div className="hidden lg:block">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Student Dashboard
            </p>
            <p className="text-sm text-foreground">Academic year 2026–27</p>
          </div>
          <StudentSwitcher student={student} onChange={setStudent} />
        </div>

        <nav aria-label="Dashboard sections" className="border-t border-border lg:hidden">
          <ul className="flex gap-1 overflow-x-auto px-3 py-2">
            {navItems.map((item) => (
              <li key={item.href} className="shrink-0">
                <a
                  href={item.href}
                  className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
          className="flex flex-col justify-between gap-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 md:flex-row md:items-end"
        >
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-lime">{"Da'wa College Portal"}</p>
            <h1 className="mt-2 font-display text-3xl font-semibold text-foreground text-balance md:text-4xl">
              Welcome, {student.firstName}
              <span className="text-muted-foreground"> — Class {student.className}</span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Admission no. <span className="font-medium tabular-nums text-foreground">{student.admissionNo}</span>
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <NoticeBoard />
          </div>
          <div className="lg:col-span-2">
            <AttendanceCard student={student} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <LeaveRegister student={student} />
          </div>
          <div className="lg:col-span-2">
            <LibraryBooks />
          </div>
        </div>

        <Timetable student={student} />

        <ExamResultCard />
      </main>
    </div>
  )
}
