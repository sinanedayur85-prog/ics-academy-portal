'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  BookMarked,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Globe,
  Library,
  LogOut,
  Megaphone,
  MessageSquareText,
  UserCheck,
} from 'lucide-react'
import { AppUpdateButton } from '@/components/app-update-manager'
import { BrandWordmark } from '@/components/brand-wordmark'
import {
  CampusNotificationBar,
  CampusNotificationBell,
} from '@/components/campus-notifications'
import { AttendanceCard } from '@/components/dashboard/attendance-card'
import { ClassLeaderAttendanceCard } from '@/components/dashboard/class-leader-attendance-card'
import {
  getClassLeadersForClass,
  getLeaderInfoForStudent,
  students,
} from '@/components/dashboard/data'
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

const studentNavItems = [
  { label: 'Notice Board', href: '#notices', icon: Megaphone },
  { label: 'Attendance Status', href: '#attendance', icon: CalendarCheck },
  { label: 'Leave Register', href: '#leave', icon: ClipboardList },
  { label: "Da'wa College Chatbot", href: '#gemini-chatbot', icon: MessageSquareText },
  { label: 'Digital Library', href: '#digital-library', icon: Library },
  { label: 'Library', href: '#library', icon: BookMarked },
  { label: 'Time Table', href: '#timetable', icon: CalendarDays },
  { label: 'University Portal', href: '#university-portal', icon: Globe },
]

const classLeaderNavItems = [
  { label: 'Notice Board', href: '#notices', icon: Megaphone },
  { label: 'Attendance Status', href: '#attendance', icon: CalendarCheck },
  { label: 'Class Attendance', href: '#class-attendance', icon: UserCheck },
  { label: 'Leave Register', href: '#leave', icon: ClipboardList },
  { label: "Da'wa College Chatbot", href: '#gemini-chatbot', icon: MessageSquareText },
  { label: 'Digital Library', href: '#digital-library', icon: Library },
  { label: 'Library', href: '#library', icon: BookMarked },
  { label: 'Time Table', href: '#timetable', icon: CalendarDays },
  { label: 'University Portal', href: '#university-portal', icon: Globe },
]

type DashboardShellProps = {
  isClassLeader?: boolean
}

export function DashboardShell({ isClassLeader = false }: DashboardShellProps) {
  const [selectedStudentId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('loggedInStudentId')
      if (saved && students.some((s) => s.id === saved)) {
        return saved
      }
    }
    return students[0].id
  })
  const [isOnLeave, setIsOnLeave] = useState(false)

  const student = students.find((s) => s.id === selectedStudentId) ?? students[0]
  const leaderInfo = getLeaderInfoForStudent(student)
  const classLeaders = getClassLeadersForClass(student.className)
  const leaderId =
    (typeof window !== 'undefined' && window.localStorage.getItem('loggedInLeaderId')) ||
    leaderInfo.leaderId
  const leaderRoleTitle =
    (typeof window !== 'undefined' && window.localStorage.getItem('loggedInLeaderRoleTitle')) ||
    leaderInfo.roleTitle
  const navItems = isClassLeader ? classLeaderNavItems : studentNavItems

  return (
    <div className="min-h-svh overflow-x-hidden bg-background transition-colors duration-300 dark:bg-gradient-to-br dark:from-[#081E21] dark:to-[#040F11] lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-background pt-[var(--safe-top)] transition-colors duration-300 lg:flex">
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
            {isClassLeader ? "Da'wa College • Class Leader" : "Da'wa College"}
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
              window.localStorage.removeItem('loggedInStudentId')
              window.localStorage.removeItem('loggedInLeaderId')
              window.localStorage.removeItem('loggedInLeaderRoleTitle')
              window.localStorage.removeItem('authRole')
              window.dispatchEvent(new CustomEvent('ics-logout'))
            }}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Log out
          </Link>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-border bg-background/85 pt-[var(--safe-top)] backdrop-blur-md transition-colors duration-300">
        <div className="flex h-16 sm:h-20 items-center justify-between gap-2 px-3.5 sm:gap-4 sm:px-5 md:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3 lg:hidden" aria-label="ICS Academy Manhappatta home">
            <Image
              src="/images/ics-mark-transparent.png"
              alt="ICS Academy logo"
              width={381}
              height={512}
              className="h-9 sm:h-10 w-auto shrink-0 object-contain"
            />
            <BrandWordmark
              gapClassName="gap-0"
              topClassName="text-base sm:text-lg font-bold text-foreground leading-none"
              bottomClassName="-mt-[2px] text-[9.5px] sm:text-[10px] font-semibold text-lime leading-none"
            />
          </Link>
          <div className="hidden lg:block">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {isClassLeader ? 'Class Leader Dashboard' : 'Student Dashboard'}
            </p>
            <p className="text-sm text-foreground">Academic year 2026–27</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <AppUpdateButton />
            <CampusNotificationBell
              studentId={student.id}
              classNameFilter={student.className}
            />
            <ThemeToggle className="text-foreground/85 hover:text-foreground dark:text-white/90 dark:hover:text-white" />
            <StudentSwitcher student={student} />
          </div>
        </div>

        <nav aria-label="Dashboard sections" className="border-t border-border lg:hidden">
          <ul className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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

      <CampusNotificationBar
        studentId={student.id}
        classNameFilter={student.className}
      />

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-3.5 py-6 sm:gap-6 sm:px-5 sm:py-8 md:px-8 md:py-10">
        <div
          key={student.id}
          className="flex flex-col justify-between gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 md:flex-row md:items-end"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-lime">
                {isClassLeader ? "Da'wa College • Class Leader Portal" : "Da'wa College Portal"}
              </p>
              {isClassLeader && (
                <a
                  href="#class-attendance"
                  className="inline-flex items-center gap-1.5 rounded-full border border-cyan/40 bg-cyan/15 px-2.5 py-0.5 text-xs font-bold tracking-wide text-cyan transition-colors hover:bg-cyan/25"
                >
                  <UserCheck className="size-3.5" aria-hidden="true" />
                  {leaderRoleTitle} • {leaderId}
                </a>
              )}
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
            {classLeaders.length > 0 && (
              <>
                <span className="text-border" aria-hidden="true">•</span>
                <p>
                  Class Leaders:{' '}
                  <span className="font-medium text-cyan">
                    {classLeaders
                      .map((cl) => `${cl.studentName} (${cl.leaderId})`)
                      .join(' & ')}
                  </span>
                </p>
              </>
            )}
          </div>
        </div>

        <NoticeBoard />

        <AttendanceCard student={student} />

        {isClassLeader && (
          <ClassLeaderAttendanceCard leader={student} leaderId={leaderId} />
        )}

        <LeaveRegister student={student} onLeaveStatusChange={setIsOnLeave} />

        <GeminiChatbot student={student} />

        <DigitalLibrary student={student} />

        <LibraryBooks />

        <Timetable student={student} />

        <ExamResultCard />
      </main>
    </div>
  )
}
