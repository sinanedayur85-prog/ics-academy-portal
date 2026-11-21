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
  Trophy,
  UserCheck,
} from 'lucide-react'
import { AppUpdateButton } from '@/components/app-update-manager'
import { BrandLogoMark, BrandWordmark } from '@/components/brand-wordmark'
import {
  CampusNotificationBar,
  CampusNotificationBell,
} from '@/components/campus-notifications'
import { AttendanceCard } from '@/components/dashboard/attendance-card'
import { StudentAcademicHub } from '@/components/dashboard/campus-academic-hub'
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
import { StudentAvatar, StudentSwitcher } from '@/components/dashboard/student-switcher'
import { Timetable } from '@/components/dashboard/timetable'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'

const studentNavItems = [
  { label: 'Notices', href: '#notices', icon: Megaphone },
  { label: 'Tests & Zadul Khair', href: '#academic-hub', icon: Trophy },
  { label: 'Attendance', href: '#attendance', icon: CalendarCheck },
  { label: 'Leave', href: '#leave', icon: ClipboardList },
  { label: 'Messenger', href: '#campus-chat', icon: MessageCircle },
  { label: 'AI Guide', href: '#gemini-chatbot', icon: MessageSquareText },
  { label: 'Kitabs', href: '#digital-library', icon: Library },
  { label: 'Books', href: '#library', icon: BookMarked },
  { label: 'Timetable', href: '#timetable', icon: CalendarDays },
  { label: 'Results', href: '#university-portal', icon: Globe },
]

const classLeaderNavItems = [
  { label: 'Notices', href: '#notices', icon: Megaphone },
  { label: 'Tests & Zadul Khair', href: '#academic-hub', icon: Trophy },
  { label: 'Attendance', href: '#attendance', icon: CalendarCheck },
  { label: 'Class Attendance', href: '#class-attendance', icon: UserCheck },
  { label: 'Leave', href: '#leave', icon: ClipboardList },
  { label: 'Messenger', href: '#campus-chat', icon: MessageCircle },
  { label: 'AI Guide', href: '#gemini-chatbot', icon: MessageSquareText },
  { label: 'Kitabs', href: '#digital-library', icon: Library },
  { label: 'Books', href: '#library', icon: BookMarked },
  { label: 'Timetable', href: '#timetable', icon: CalendarDays },
  { label: 'Results', href: '#university-portal', icon: Globe },
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
      if (hash === 'notices' || hash === 'academic-hub') {
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
    <div className="lg:min-h-svh bg-background transition-colors duration-200 max-lg:fixed max-lg:inset-0 max-lg:flex max-lg:flex-col max-lg:overflow-hidden lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-background pt-[var(--safe-top)] transition-colors duration-200 lg:flex dark:bg-[#0B1014]">
        <Link href="/" className="flex h-20 items-center gap-3 px-6 active:opacity-80" aria-label="ICS Academy Manhappatta home">
          <BrandLogoMark className="h-10 w-auto" />
          <BrandWordmark
            className="pt-[2px]"
            gapClassName="gap-[1px]"
            topClassName="translate-y-[1px] text-lg font-bold text-foreground leading-none"
            bottomClassName="text-[10px] font-semibold text-[#0077CC] dark:text-[#0095F6] leading-none"
          />
        </Link>

        <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-1 px-3 py-2">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {isClassLeader ? "Da'wa College • Class Leader" : "Da'wa College"}
          </p>
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3.5 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-150 hover:bg-card hover:text-foreground active:scale-[0.98]"
            >
              <item.icon className="size-[19px] stroke-[1.85] transition-colors group-hover:text-[#0095F6]" aria-hidden="true" />
              {item.label}
            </a>
          ))}
        </nav>

        <div className="p-3">
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
            className="flex items-center gap-3.5 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            <LogOut className="size-[19px] stroke-[1.85]" aria-hidden="true" />
            Log out
          </Link>
        </div>
      </aside>

      <header className="z-40 shrink-0 bg-background/95 pt-[var(--safe-top)] backdrop-blur-xl transition-colors duration-200 lg:sticky lg:top-0">
        <div className="flex h-16 sm:h-20 items-center justify-between gap-2 px-3.5 sm:gap-4 sm:px-5 md:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 sm:gap-3 lg:hidden active:opacity-80" aria-label="ICS Academy Manhappatta home">
            <BrandLogoMark className="h-8 sm:h-10 w-auto shrink-0" />
            <BrandWordmark
              className="pt-[2px]"
              gapClassName="gap-[1px]"
              topClassName="translate-y-[1px] text-[15px] sm:text-lg font-bold text-foreground leading-none"
              bottomClassName="text-[8.5px] sm:text-[10px] font-semibold text-[#0077CC] dark:text-[#0095F6] leading-none"
            />
          </Link>
          <div className="hidden lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {isClassLeader ? 'Class Leader Dashboard' : 'Student Dashboard'}
            </p>
            <p className="text-sm font-medium text-foreground">Academic year 2026–27</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <AppUpdateButton />
            <ThemeToggle />
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
        <CampusNotificationBar
          studentId={student.id}
          classNameFilter={student.className}
        />

        <main
          className={cn(
            'mx-auto flex max-w-7xl flex-col lg:gap-6 lg:px-8 lg:py-10',
            mobileTab === 'chatbot' || mobileTab === 'campus-chat'
              ? 'max-lg:flex-1 max-lg:min-h-0 max-lg:w-full max-lg:max-w-none max-lg:gap-0 max-lg:p-0 max-lg:overflow-hidden'
              : 'gap-5 px-3.5 py-5 sm:gap-6 sm:px-5 sm:py-7 md:px-8 md:py-10',
          )}
        >
        {/* Welcome Student Header — Shown on Home Tab on Phone/Tablet, Always Shown on Desktop */}
        <div
          key={student.id}
          className={cn(
            'flex flex-col justify-between gap-2.5 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 2xl:flex-row 2xl:items-end',
            mobileTab !== 'home' && 'hidden lg:flex',
          )}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#0077CC] dark:text-[#0095F6]">
                {isClassLeader ? 'Class Leader' : 'Student'}
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
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#0095F6]/14 px-3 py-0.5 text-xs font-semibold tracking-wide text-[#0077CC] dark:text-[#0095F6] transition-colors hover:bg-[#0095F6]/22"
                >
                  <UserCheck className="size-3.5" aria-hidden="true" />
                  {leaderId}
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
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold tracking-wide transition-colors duration-200',
                  isOnLeave
                    ? 'bg-red-500/15 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                    : 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
                )}
              >
                <span
                  className={cn(
                    'size-2 rounded-full',
                    isOnLeave ? 'bg-red-500 animate-pulse' : 'bg-emerald-500',
                  )}
                  aria-hidden="true"
                />
                {isOnLeave ? 'On Leave' : 'At Academy'}
              </a>
            </div>
            <div className="mt-2 flex items-center gap-3.5">
              {student.avatarUrl && (
                <StudentAvatar
                  student={student}
                  className="size-14 sm:size-16"
                />
              )}
              <h1 className="flex flex-col font-display leading-tight text-foreground">
                <span className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                  {student.firstName}
                </span>
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-xs text-muted-foreground sm:text-sm">
            <p>
              Class <span className="font-semibold text-foreground">{student.className}</span>
            </p>
            <p>
              ID <span className="font-mono font-semibold tabular-nums text-foreground">{student.admissionNo}</span>
            </p>
            {classLeaders.length > 0 && (
              <p>
                Leaders:{' '}
                <span className="font-semibold text-[#0077CC] dark:text-[#0095F6]">
                  {classLeaders
                    .map((cl) => cl.studentName)
                    .join(' & ')}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* 1. HOME / NOTICE BOARD & STUDENT ACADEMIC HUB */}
        <div className={cn(mobileTab === 'home' ? 'space-y-5 block' : 'hidden lg:block lg:space-y-6')}>
          <NoticeBoard studentClass={student.className} />
          <StudentAcademicHub student={student} isClassLeader={isClassLeader} />
        </div>

        {/* 2. ATTENDANCE TAB (With Class Leader Sub-Switcher on Phone/Tablet) */}
        {isClassLeader && mobileTab === 'attendance' ? (
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-card p-1.5 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileAttendanceSubTab('personal')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all active:scale-[0.98]',
                mobileAttendanceSubTab === 'personal'
                  ? 'bg-[#0095F6] text-white'
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
                'flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all active:scale-[0.98]',
                mobileAttendanceSubTab === 'class-leader'
                  ? 'bg-[#0095F6] text-white'
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
              ? 'max-lg:flex max-lg:flex-1 max-lg:min-h-0 max-lg:w-full max-lg:flex-col max-lg:overflow-hidden block'
              : 'hidden lg:block',
          )}
        >
          <CampusMessenger
            role="student"
            student={student}
            mobileFullScreen
            mobileTabActive={mobileTab === 'campus-chat'}
          />
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
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-card p-1.5 sm:grid-cols-4 lg:hidden">
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
                    'flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-xs font-semibold transition-all active:scale-[0.98]',
                    active
                      ? 'bg-[#0095F6] text-white'
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

      {/* INSTAGRAM-STYLE PHONE & TABLET BOTTOM NAVIGATION BAR */}
      <nav
        aria-label="Mobile & Tablet Bottom Navigation"
        className="z-50 shrink-0 bg-background/96 pb-[var(--safe-bottom)] backdrop-blur-xl lg:hidden dark:bg-[#0B1014]/96"
      >
        <div className="mx-auto grid h-[62px] max-w-xl grid-cols-6 items-center px-1.5">
          <button
            type="button"
            onClick={() => selectMobileTab('home')}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-2xl py-1 transition-all active:scale-90',
              mobileTab === 'home'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'flex h-8 w-12 items-center justify-center rounded-full transition-all',
                mobileTab === 'home' && 'bg-foreground/10 dark:bg-white/12',
              )}
            >
              <Megaphone className={cn('size-[20px]', mobileTab === 'home' ? 'stroke-[2.4]' : 'stroke-[1.85]')} aria-hidden="true" />
            </span>
            <span className={cn('text-[10.5px] leading-none', mobileTab === 'home' ? 'font-bold' : 'font-medium')}>Notices</span>
          </button>

          <button
            type="button"
            onClick={() => selectMobileTab('attendance')}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-2xl py-1 transition-all active:scale-90',
              mobileTab === 'attendance'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'relative flex h-8 w-12 items-center justify-center rounded-full transition-all',
                mobileTab === 'attendance' && 'bg-foreground/10 dark:bg-white/12',
              )}
            >
              <CalendarCheck className={cn('size-[20px]', mobileTab === 'attendance' ? 'stroke-[2.4]' : 'stroke-[1.85]')} aria-hidden="true" />
              {isClassLeader ? (
                <span className="absolute top-1 right-2 size-2 rounded-full bg-[#0095F6]" />
              ) : null}
            </span>
            <span className={cn('text-[10.5px] leading-none', mobileTab === 'attendance' ? 'font-bold' : 'font-medium')}>Attendance</span>
          </button>

          {/* Campus Messenger */}
          <button
            type="button"
            onClick={() => selectMobileTab('campus-chat')}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-2xl py-1 transition-all active:scale-90',
              mobileTab === 'campus-chat'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'relative flex h-8 w-12 items-center justify-center rounded-full transition-all',
                mobileTab === 'campus-chat' && 'bg-foreground/10 dark:bg-white/12',
              )}
            >
              <MessageCircle className={cn('size-[20px]', mobileTab === 'campus-chat' ? 'stroke-[2.4]' : 'stroke-[1.85]')} aria-hidden="true" />
              <span className="absolute top-1 right-2 size-2 rounded-full bg-[#0095F6]" />
            </span>
            <span className={cn('text-[10.5px] leading-none', mobileTab === 'campus-chat' ? 'font-bold' : 'font-medium')}>Chat</span>
          </button>

          {/* AI Chat Tab (Instagram Purple-Blue Gradient) */}
          <button
            type="button"
            onClick={() => selectMobileTab('chatbot')}
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-90',
              mobileTab === 'chatbot'
                ? 'text-[#0095F6]'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'flex h-8 w-12 items-center justify-center rounded-full transition-all duration-200',
                mobileTab === 'chatbot'
                  ? 'bg-gradient-to-tr from-[#7C3AED] via-[#4F46E5] to-[#0095F6] text-white scale-105'
                  : 'bg-[#0095F6]/12 text-[#0077CC] dark:text-[#0095F6]',
              )}
            >
              <Sparkles className="size-[19px] stroke-[2.1]" aria-hidden="true" />
            </span>
            <span
              className={cn(
                'text-[10.5px] leading-none',
                mobileTab === 'chatbot' ? 'font-bold text-[#0095F6]' : 'font-medium text-foreground/85',
              )}
            >
              AI Chat
            </span>
          </button>

          <button
            type="button"
            onClick={() => selectMobileTab('leave')}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-2xl py-1 transition-all active:scale-90',
              mobileTab === 'leave'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'relative flex h-8 w-12 items-center justify-center rounded-full transition-all',
                mobileTab === 'leave' && 'bg-foreground/10 dark:bg-white/12',
              )}
            >
              <ClipboardList className={cn('size-[20px]', mobileTab === 'leave' ? 'stroke-[2.4]' : 'stroke-[1.85]')} aria-hidden="true" />
              <span
                className={cn(
                  'absolute top-1 right-2 size-2 rounded-full',
                  isOnLeave ? 'bg-red-500 animate-pulse' : 'bg-emerald-500',
                )}
              />
            </span>
            <span className={cn('text-[10.5px] leading-none', mobileTab === 'leave' ? 'font-bold' : 'font-medium')}>Leave</span>
          </button>

          <button
            type="button"
            onClick={() => selectMobileTab('library')}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-2xl py-1 transition-all active:scale-90',
              mobileTab === 'library'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'flex h-8 w-12 items-center justify-center rounded-full transition-all',
                mobileTab === 'library' && 'bg-foreground/10 dark:bg-white/12',
              )}
            >
              <Library className={cn('size-[20px]', mobileTab === 'library' ? 'stroke-[2.4]' : 'stroke-[1.85]')} aria-hidden="true" />
            </span>
            <span className={cn('text-[10.5px] leading-none', mobileTab === 'library' ? 'font-bold' : 'font-medium')}>Library</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
