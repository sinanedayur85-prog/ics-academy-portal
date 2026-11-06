'use client'

import { useEffect, useRef, useState } from 'react'
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
  MessageCircle,
  MessageSquareText,
  Sparkles,
  UserCheck,
} from 'lucide-react'
import { AppUpdateButton } from '@/components/app-update-manager'
import { BrandLogoMark, BrandWordmark } from '@/components/brand-wordmark'
import {
  CampusNotificationBar,
  CampusNotificationBell,
} from '@/components/campus-notifications'
import { AttendanceCard } from '@/components/dashboard/attendance-card'
import { CampusMessenger } from '@/components/dashboard/campus-messenger'
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
  { label: 'Campus Messenger', href: '#campus-chat', icon: MessageCircle },
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
  { label: 'Campus Messenger', href: '#campus-chat', icon: MessageCircle },
  { label: "Da'wa College Chatbot", href: '#gemini-chatbot', icon: MessageSquareText },
  { label: 'Digital Library', href: '#digital-library', icon: Library },
  { label: 'Library', href: '#library', icon: BookMarked },
  { label: 'Time Table', href: '#timetable', icon: CalendarDays },
  { label: 'University Portal', href: '#university-portal', icon: Globe },
]

type MobileTabId = 'home' | 'attendance' | 'campus-chat' | 'chatbot' | 'leave' | 'library'
type MobileAttendanceSubTab = 'personal' | 'class-leader'
type MobileResourceSubTab = 'digital-library' | 'library' | 'timetable' | 'university-portal'

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
  const [mobileTab, setMobileTab] = useState<MobileTabId>('home')
  const [mobileAttendanceSubTab, setMobileAttendanceSubTab] =
    useState<MobileAttendanceSubTab>('personal')
  const [mobileResourceSubTab, setMobileResourceSubTab] =
    useState<MobileResourceSubTab>('digital-library')
  const mobileScrollRef = useRef<HTMLDivElement | null>(null)

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

  // Automatically sync hash navigation (from notification banners or badges) to mobile tabs
  useEffect(() => {
    const syncHashToMobileTab = () => {
      if (typeof window === 'undefined') return
      const hash = window.location.hash.replace('#', '')
      if (!hash) return
      if (hash === 'notices') {
        setMobileTab('home')
      } else if (hash === 'attendance') {
        setMobileTab('attendance')
        setMobileAttendanceSubTab('personal')
      } else if (hash === 'class-attendance') {
        setMobileTab('attendance')
        setMobileAttendanceSubTab('class-leader')
      } else if (hash === 'campus-chat') {
        setMobileTab('campus-chat')
      } else if (hash === 'gemini-chatbot') {
        setMobileTab('chatbot')
      } else if (hash === 'leave') {
        setMobileTab('leave')
      } else if (
        hash === 'digital-library' ||
        hash === 'library' ||
        hash === 'timetable' ||
        hash === 'university-portal'
      ) {
        setMobileTab('library')
        setMobileResourceSubTab(hash)
      }
    }

    syncHashToMobileTab()
    window.addEventListener('hashchange', syncHashToMobileTab)
    return () => window.removeEventListener('hashchange', syncHashToMobileTab)
  }, [])

  const selectMobileTab = (tab: MobileTabId) => {
    setMobileTab(tab)
    if (mobileScrollRef.current) {
      mobileScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <div className="min-h-svh bg-background transition-colors duration-300 dark:bg-gradient-to-br dark:from-[#0A0B0E] dark:to-[#060709] max-lg:fixed max-lg:inset-0 max-lg:flex max-lg:flex-col max-lg:overflow-hidden lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-background pt-[var(--safe-top)] transition-colors duration-300 lg:flex">
        <Link href="/" className="flex h-20 items-center gap-3 border-b border-border px-6" aria-label="ICS Academy Manhappatta home">
          <BrandLogoMark className="h-10 w-auto" />
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

      <header className="z-40 shrink-0 border-b border-border bg-background/95 pt-[var(--safe-top)] backdrop-blur-md transition-colors duration-300 lg:sticky lg:top-0">
        <div className="flex h-16 sm:h-20 items-center justify-between gap-2 px-3.5 sm:gap-4 sm:px-5 md:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3 lg:hidden" aria-label="ICS Academy Manhappatta home">
            <BrandLogoMark className="h-9 sm:h-11 w-auto shrink-0" />
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
      </header>

      <div
        ref={mobileScrollRef}
        className={cn(
          'max-lg:flex-1 max-lg:min-h-0 max-lg:w-full',
          mobileTab === 'chatbot' || mobileTab === 'campus-chat'
            ? 'max-lg:flex max-lg:flex-col max-lg:overflow-hidden'
            : 'max-lg:overflow-y-auto max-lg:overflow-x-hidden max-lg:overscroll-y-contain',
        )}
      >
        <div
          className={cn(
            (mobileTab === 'chatbot' || mobileTab === 'campus-chat') && 'hidden lg:block',
          )}
        >
          <CampusNotificationBar
            studentId={student.id}
            classNameFilter={student.className}
          />
        </div>

        <main
          className={cn(
            'mx-auto flex max-w-7xl flex-col gap-5 px-3.5 py-5 sm:gap-6 sm:px-5 sm:py-7 md:px-8 md:py-10',
            (mobileTab === 'chatbot' || mobileTab === 'campus-chat') &&
              'max-lg:flex-1 max-lg:min-h-0 max-lg:w-full max-lg:max-w-none max-lg:gap-0 max-lg:px-0 max-lg:py-0 max-lg:overflow-hidden',
          )}
        >
        {/* Welcome Student Header — Shown on Home Tab on Phone/Tablet, Always Shown on Desktop */}
        <div
          key={student.id}
          className={cn(
            'flex flex-col justify-between gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 md:flex-row md:items-end',
            mobileTab !== 'home' && 'hidden lg:flex',
          )}
        >
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-lime">
                {isClassLeader ? "Da'wa College • Class Leader Portal" : "Da'wa College Portal"}
              </p>
              {isClassLeader && (
                <a
                  href="#class-attendance"
                  onClick={(e) => {
                    if (window.innerWidth < 1024) {
                      e.preventDefault()
                      setMobileTab('attendance')
                      setMobileAttendanceSubTab('class-leader')
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-cyan/40 bg-cyan/15 px-2.5 py-0.5 text-xs font-bold tracking-wide text-cyan transition-colors hover:bg-cyan/25"
                >
                  <UserCheck className="size-3.5" aria-hidden="true" />
                  {leaderRoleTitle} • {leaderId}
                </a>
              )}
              <a
                href="#leave"
                onClick={(e) => {
                  if (window.innerWidth < 1024) {
                    e.preventDefault()
                    setMobileTab('leave')
                  }
                }}
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

        {/* 1. HOME / NOTICE BOARD TAB */}
        <div className={cn(mobileTab === 'home' ? 'block' : 'hidden lg:block')}>
          <NoticeBoard studentClass={student.className} />
        </div>

        {/* 2. ATTENDANCE TAB (With Class Leader Sub-Switcher on Phone/Tablet) */}
        {isClassLeader && mobileTab === 'attendance' ? (
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-border bg-card/85 p-1.5 shadow-xs lg:hidden">
            <button
              type="button"
              onClick={() => setMobileAttendanceSubTab('personal')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all',
                mobileAttendanceSubTab === 'personal'
                  ? 'bg-lime text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <CalendarCheck className="size-4" aria-hidden="true" />
              <span>My Attendance</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileAttendanceSubTab('class-leader')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all',
                mobileAttendanceSubTab === 'class-leader'
                  ? 'bg-cyan text-[#062023] shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <UserCheck className="size-4" aria-hidden="true" />
              <span>Class Attendance</span>
            </button>
          </div>
        ) : null}

        <div
          className={cn(
            mobileTab === 'attendance' &&
              (!isClassLeader || mobileAttendanceSubTab === 'personal')
              ? 'block'
              : 'hidden lg:block',
          )}
        >
          <AttendanceCard student={student} />
        </div>

        {isClassLeader && (
          <div
            className={cn(
              mobileTab === 'attendance' && mobileAttendanceSubTab === 'class-leader'
                ? 'block'
                : 'hidden lg:block',
            )}
          >
            <ClassLeaderAttendanceCard leader={student} leaderId={leaderId} />
          </div>
        )}

        {/* 3. LEAVE REGISTER TAB (Always mounted so onLeaveStatusChange stays active) */}
        <div className={cn(mobileTab === 'leave' ? 'block' : 'hidden lg:block')}>
          <LeaveRegister student={student} onLeaveStatusChange={setIsOnLeave} />
        </div>

        {/* 3.5. WHATSAPP-STYLE CAMPUS MESSENGER (Students & Usthads Chat) */}
        <div
          className={cn(
            mobileTab === 'campus-chat'
              ? 'max-lg:flex max-lg:flex-1 max-lg:min-h-0 max-lg:flex-col max-lg:overflow-hidden block'
              : 'hidden lg:block',
          )}
        >
          <CampusMessenger role="student" student={student} mobileFullScreen />
        </div>

        {/* 4. FULL-SCREEN AI CHATBOT TAB */}
        <div
          className={cn(
            mobileTab === 'chatbot'
              ? 'max-lg:flex max-lg:flex-1 max-lg:min-h-0 max-lg:flex-col max-lg:overflow-hidden block'
              : 'hidden lg:block',
          )}
        >
          <GeminiChatbot student={student} mobileFullScreen />
        </div>

        {/* 5. LIBRARY, TIMETABLE & UNIVERSITY PORTAL TAB */}
        {mobileTab === 'library' ? (
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-border bg-card/85 p-1.5 shadow-xs sm:grid-cols-4 lg:hidden">
            {(
              [
                { id: 'digital-library', label: 'Digital Kitabs', icon: Library },
                { id: 'library', label: 'Library', icon: BookMarked },
                { id: 'timetable', label: 'Time Table', icon: CalendarDays },
                { id: 'university-portal', label: 'Exam Results', icon: Globe },
              ] as const
            ).map((sub) => {
              const active = mobileResourceSubTab === sub.id
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setMobileResourceSubTab(sub.id)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all',
                    active
                      ? 'bg-lime text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <sub.icon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{sub.label}</span>
                </button>
              )
            })}
          </div>
        ) : null}

        <div
          className={cn(
            mobileTab === 'library' && mobileResourceSubTab === 'digital-library'
              ? 'block'
              : 'hidden lg:block',
          )}
        >
          <DigitalLibrary student={student} />
        </div>

        <div
          className={cn(
            mobileTab === 'library' && mobileResourceSubTab === 'library'
              ? 'block'
              : 'hidden lg:block',
          )}
        >
          <LibraryBooks />
        </div>

        <div
          className={cn(
            mobileTab === 'library' && mobileResourceSubTab === 'timetable'
              ? 'block'
              : 'hidden lg:block',
          )}
        >
          <Timetable student={student} />
        </div>

        <div
          className={cn(
            mobileTab === 'library' && mobileResourceSubTab === 'university-portal'
              ? 'block'
              : 'hidden lg:block',
          )}
        >
          <ExamResultCard />
        </div>
        </main>
      </div>

      {/* PHONE & TABLET BOTTOM NAVIGATION MENU BAR (Hidden on Desktop lg:) */}
      <nav
        aria-label="Mobile & Tablet Bottom Navigation"
        className="z-50 shrink-0 border-t border-border/85 bg-background/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid h-16 max-w-xl grid-cols-6 items-center px-1">
          <button
            type="button"
            onClick={() => selectMobileTab('home')}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 transition-colors',
              mobileTab === 'home'
                ? 'text-lime'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'flex h-7 w-10 items-center justify-center rounded-full transition-all',
                mobileTab === 'home' && 'bg-lime/15',
              )}
            >
              <Megaphone className="size-4" aria-hidden="true" />
            </span>
            <span className="text-[10px] font-semibold leading-none">Notices</span>
          </button>

          <button
            type="button"
            onClick={() => selectMobileTab('attendance')}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 transition-colors',
              mobileTab === 'attendance'
                ? 'text-lime'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'relative flex h-7 w-10 items-center justify-center rounded-full transition-all',
                mobileTab === 'attendance' && 'bg-lime/15',
              )}
            >
              <CalendarCheck className="size-4" aria-hidden="true" />
              {isClassLeader ? (
                <span className="absolute -top-0.5 right-1 size-2 rounded-full bg-cyan" />
              ) : null}
            </span>
            <span className="text-[10px] font-semibold leading-none">Attendance</span>
          </button>

          {/* Campus Chat (WhatsApp-Style Messenger for Usthads & Students) */}
          <button
            type="button"
            onClick={() => selectMobileTab('campus-chat')}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 transition-colors',
              mobileTab === 'campus-chat'
                ? 'text-lime'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'relative flex h-7 w-10 items-center justify-center rounded-full transition-all',
                mobileTab === 'campus-chat' && 'bg-lime/15',
              )}
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              <span className="absolute -top-0.5 right-1 size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] font-semibold leading-none">Chat</span>
          </button>

          {/* Gemini AI Chatbot Tab */}
          <button
            type="button"
            onClick={() => selectMobileTab('chatbot')}
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-1 transition-all',
              mobileTab === 'chatbot'
                ? 'text-lime'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'flex h-8 w-11 items-center justify-center rounded-2xl border transition-all duration-200',
                mobileTab === 'chatbot'
                  ? 'border-lime/60 bg-lime text-primary-foreground shadow-md shadow-lime/25 scale-105'
                  : 'border-lime/35 bg-lime/10 text-lime hover:bg-lime/20',
              )}
            >
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            <span
              className={cn(
                'text-[10px] font-bold leading-none',
                mobileTab === 'chatbot' ? 'text-lime' : 'text-foreground/90',
              )}
            >
              AI Chat
            </span>
          </button>

          <button
            type="button"
            onClick={() => selectMobileTab('leave')}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 transition-colors',
              mobileTab === 'leave'
                ? 'text-lime'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'relative flex h-7 w-12 items-center justify-center rounded-full transition-all',
                mobileTab === 'leave' && 'bg-lime/15',
              )}
            >
              <ClipboardList className="size-4" aria-hidden="true" />
              <span
                className={cn(
                  'absolute -top-0.5 right-1.5 size-2 rounded-full',
                  isOnLeave ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 dark:bg-lime',
                )}
              />
            </span>
            <span className="text-[10.5px] font-semibold leading-none">Leave</span>
          </button>

          <button
            type="button"
            onClick={() => selectMobileTab('library')}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 transition-colors',
              mobileTab === 'library'
                ? 'text-lime'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'flex h-7 w-12 items-center justify-center rounded-full transition-all',
                mobileTab === 'library' && 'bg-lime/15',
              )}
            >
              <Library className="size-4" aria-hidden="true" />
            </span>
            <span className="text-[10.5px] font-semibold leading-none">Library</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
