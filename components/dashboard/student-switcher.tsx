'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { Award, BookOpen, Eye, EyeOff, GraduationCap, Hash, KeyRound, LogOut, PlayCircle, ShieldCheck, User, Volume2 } from 'lucide-react'
import type { ClassUsthad, PrincipalProfile, Student } from '@/components/dashboard/data'
import { AppVideoGuideModal, unlockAndroidAudioOnGesture } from '@/components/dashboard/app-video-guide'
import { cn } from '@/lib/utils'

function initials(name: string) {
  const cleanedParts = name
    .split(' ')
    .map((part) => part.trim())
    .filter(
      (part) =>
        Boolean(part) &&
        ![
          'dr.',
          'dr',
          'usthad',
          'prof.',
          'prof',
          'shaykh',
          'shaikhuna',
          'maulana',
          'hafiz',
        ].includes(part.toLowerCase()),
    )
  const source = cleanedParts.length > 0 ? cleanedParts : name.split(' ').filter(Boolean)
  return source
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function ProfileInitialsAvatar({
  name,
  avatarUrl,
  className,
}: {
  name: string
  avatarUrl?: string
  className?: string
}) {
  if (avatarUrl) {
    return (
      <span
        className={cn(
          'relative inline-flex size-9 shrink-0 overflow-hidden rounded-full bg-muted',
          className,
        )}
      >
        <img
          src={avatarUrl}
          alt={name}
          className="size-full object-cover object-top"
        />
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#7C3AED] via-[#4F46E5] to-[#0095F6] text-xs font-bold text-white',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

export function StudentAvatar({ student, className }: { student: Student; className?: string }) {
  return (
    <ProfileInitialsAvatar
      name={student.name}
      avatarUrl={student.avatarUrl}
      className={className}
    />
  )
}

type StudentSwitcherProps = {
  student: Student
}

export function StudentSwitcher({ student }: StudentSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [showOwnPassword, setShowOwnPassword] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const popoverId = useId()

  const ownPassword =
    (typeof window !== 'undefined' &&
      window.localStorage.getItem(`ics_own_password_${student.id}`)) ||
    student.admissionNo

  const isClassLeader =
    typeof window !== 'undefined' && window.localStorage.getItem('authRole') === 'class-leader'

  useEffect(() => {
    if (!open) {
      setShowOwnPassword(false)
      return
    }
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="My Profile"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-full bg-muted p-0.5 transition-transform duration-150 outline-none active:scale-95',
          open && 'scale-95',
        )}
      >
        <StudentAvatar student={student} className="size-full" />
        <span className="sr-only">My Profile</span>
      </button>

      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Logged-in student profile"
          className="absolute right-0 z-50 mt-2.5 w-[min(20rem,calc(100vw-1.5rem))] origin-top-right rounded-3xl bg-popover p-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)] animate-in fade-in-0 zoom-in-95 duration-150"
        >
          <div className="flex items-center gap-3.5 pb-4">
            <StudentAvatar
              student={student}
              className="size-14 text-sm"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#0077CC] dark:text-[#0095F6]">
                Logged-in Student
              </p>
              <p className="mt-0.5 truncate font-display text-lg font-semibold text-foreground">
                {student.name}
              </p>
            </div>
          </div>

          <dl className="mb-3.5 flex flex-col gap-2.5 rounded-2xl bg-card p-3.5 text-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="size-3.5 text-[#0077CC] dark:text-[#0095F6]" aria-hidden="true" />
                Full Name
              </dt>
              <dd className="text-right text-xs font-medium text-foreground">{student.name}</dd>
            </div>

            <div className="h-px bg-border/40" aria-hidden="true" />

            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <Hash className="size-3.5 text-[#0077CC] dark:text-[#0095F6]" aria-hidden="true" />
                My Admission ID
              </dt>
              <dd className="font-mono text-xs font-semibold tabular-nums text-[#0077CC] dark:text-[#0095F6]">
                {student.admissionNo}
              </dd>
            </div>

            <div className="h-px bg-border/40" aria-hidden="true" />

            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <KeyRound className="size-3.5 text-[#0077CC] dark:text-[#0095F6]" aria-hidden="true" />
                My Password
              </dt>
              <dd className="flex items-center gap-1.5 font-mono text-xs font-semibold text-foreground">
                <span>{showOwnPassword ? ownPassword : '••••••••'}</span>
                <button
                  type="button"
                  onClick={() => setShowOwnPassword((v) => !v)}
                  aria-label={showOwnPassword ? 'Hide password' : 'Show password'}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-[#0095F6]"
                >
                  {showOwnPassword ? (
                    <EyeOff className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Eye className="size-3.5" aria-hidden="true" />
                  )}
                </button>
              </dd>
            </div>

            <div className="h-px bg-border/40" aria-hidden="true" />

            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <GraduationCap className="size-3.5 text-[#0077CC] dark:text-[#0095F6]" aria-hidden="true" />
                Class
              </dt>
              <dd className="text-right text-xs font-medium text-foreground">
                Class {student.className} ({student.batch})
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => {
              unlockAndroidAudioOnGesture()
              setOpen(false)
              setGuideOpen(true)
            }}
            className="mb-2 flex h-12 w-full items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-[#7C3AED]/15 via-[#4F46E5]/15 to-[#0095F6]/15 px-3.5 text-left transition-all duration-150 outline-none hover:from-[#7C3AED]/25 hover:to-[#0095F6]/25 active:scale-[0.98]"
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#7C3AED] to-[#0095F6] text-white">
                <PlayCircle className="size-4" aria-hidden="true" />
              </span>
              <span className="flex flex-col leading-tight min-w-0">
                <span className="truncate text-xs font-bold text-foreground">
                  App Video Guide
                </span>
                <span className="truncate text-[10.5px] font-medium text-[#0077CC] dark:text-[#38BDF8]">
                  മലയാളം ശബ്ദ സഹായി • Screen Demo
                </span>
              </span>
            </span>
            <Volume2 className="size-4 shrink-0 text-[#0095F6] animate-pulse" aria-hidden="true" />
          </button>

          <Link
            href="/"
            onClick={(event) => {
              event.preventDefault()
              setOpen(false)
              window.localStorage.removeItem('isAuthenticated')
              window.localStorage.removeItem('loggedInStudentId')
              window.localStorage.removeItem(`ics_own_password_${student.id}`)
              window.dispatchEvent(new CustomEvent('ics-logout'))
            }}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-muted px-4 text-xs font-semibold text-foreground transition-colors duration-150 outline-none hover:bg-red-500/15 hover:text-red-500 active:scale-[0.98] dark:bg-[#232A30]"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Log out
          </Link>
        </div>
      ) : null}

      {guideOpen ? (
        <AppVideoGuideModal
          onClose={() => setGuideOpen(false)}
          initialRole={isClassLeader ? 'class-leader' : 'student'}
        />
      ) : null}
    </div>
  )
}

export function UsthadSwitcher({ usthad }: { usthad: ClassUsthad }) {
  const [open, setOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const popoverId = useId()

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="My Profile"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-full bg-muted p-0.5 transition-transform duration-150 outline-none active:scale-95',
          open && 'scale-95',
        )}
      >
        <ProfileInitialsAvatar
          name={usthad.name}
          avatarUrl={usthad.avatarUrl}
          className="size-full"
        />
        <span className="sr-only">Usthad account profile</span>
      </button>

      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Logged-in Class Usthad profile"
          className="absolute right-0 z-50 mt-2.5 w-[min(21rem,calc(100vw-1.5rem))] origin-top-right rounded-3xl bg-popover p-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)] animate-in fade-in-0 zoom-in-95 duration-150"
        >
          <div className="flex items-center gap-3.5 pb-4">
            <ProfileInitialsAvatar
              name={usthad.name}
              avatarUrl={usthad.avatarUrl}
              className="size-14 text-sm"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#0077CC] dark:text-[#0095F6]">
                {usthad.designation}
              </p>
              <p className="mt-0.5 truncate font-display text-lg font-semibold text-foreground">
                {usthad.name}
              </p>
            </div>
          </div>

          <dl className="mb-3.5 flex flex-col gap-2.5 rounded-2xl bg-card p-3.5 text-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="size-3.5 text-[#0077CC] dark:text-[#0095F6]" aria-hidden="true" />
                Full Name
              </dt>
              <dd className="text-right text-xs font-medium text-foreground">{usthad.name}</dd>
            </div>

            <div className="h-px bg-border/40" aria-hidden="true" />

            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <Hash className="size-3.5 text-[#0077CC] dark:text-[#0095F6]" aria-hidden="true" />
                Staff ID
              </dt>
              <dd className="font-mono text-xs font-semibold tabular-nums text-[#0077CC] dark:text-[#0095F6]">
                {usthad.staffId}
              </dd>
            </div>

            <div className="h-px bg-border/40" aria-hidden="true" />

            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <GraduationCap className="size-3.5 text-[#0077CC] dark:text-[#0095F6]" aria-hidden="true" />
                {usthad.teachingBatches && usthad.teachingBatches.length > 1
                  ? 'Assigned Classes'
                  : 'Class'}
              </dt>
              <dd className="text-right text-xs font-medium text-foreground">
                {usthad.teachingBatches && usthad.teachingBatches.length > 1
                  ? `Class ${usthad.teachingBatches.join(' & ')}`
                  : `Class ${usthad.className} (${usthad.batch})`}
              </dd>
            </div>

            <div className="h-px bg-border/40" aria-hidden="true" />

            <div className="flex items-start justify-between gap-3">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <BookOpen className="size-3.5 text-[#0077CC] dark:text-[#0095F6]" aria-hidden="true" />
                Department
              </dt>
              <dd className="text-right text-xs font-medium text-foreground">
                {usthad.specialization}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => {
              unlockAndroidAudioOnGesture()
              setOpen(false)
              setGuideOpen(true)
            }}
            className="mb-2 flex h-12 w-full items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-[#7C3AED]/15 via-[#4F46E5]/15 to-[#0095F6]/15 px-3.5 text-left transition-all duration-150 outline-none hover:from-[#7C3AED]/25 hover:to-[#0095F6]/25 active:scale-[0.98]"
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#7C3AED] to-[#0095F6] text-white">
                <PlayCircle className="size-4" aria-hidden="true" />
              </span>
              <span className="flex flex-col leading-tight min-w-0">
                <span className="truncate text-xs font-bold text-foreground">
                  App Video Guide
                </span>
                <span className="truncate text-[10.5px] font-medium text-[#0077CC] dark:text-[#38BDF8]">
                  മലയാളം ശബ്ദ സഹായി • Screen Demo
                </span>
              </span>
            </span>
            <Volume2 className="size-4 shrink-0 text-[#0095F6] animate-pulse" aria-hidden="true" />
          </button>

          {usthad.isPrincipalRole ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                window.dispatchEvent(
                  new CustomEvent('ics-switch-role', {
                    detail: { role: 'principal', usthadId: usthad.id },
                  }),
                )
              }}
              className="mb-2 flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-[#0095F6] px-4 text-xs font-semibold text-white transition-all duration-150 outline-none hover:bg-[#0084DC] active:scale-[0.98]"
            >
              <ShieldCheck className="size-4" aria-hidden="true" />
              Switch to Principal Command Center
            </button>
          ) : null}

          <Link
            href="/"
            onClick={(event) => {
              event.preventDefault()
              setOpen(false)
              window.localStorage.removeItem('isAuthenticated')
              window.localStorage.removeItem('authRole')
              window.localStorage.removeItem('loggedInUsthadId')
              window.dispatchEvent(new CustomEvent('ics-logout'))
            }}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-muted px-4 text-xs font-semibold text-foreground transition-colors duration-150 outline-none hover:bg-red-500/15 hover:text-red-500 active:scale-[0.98] dark:bg-[#232A30]"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Log out
          </Link>
        </div>
      ) : null}

      {guideOpen ? (
        <AppVideoGuideModal
          onClose={() => setGuideOpen(false)}
          initialRole="usthad"
        />
      ) : null}
    </div>
  )
}

export function PrincipalSwitcher({ principal }: { principal: PrincipalProfile }) {
  const [open, setOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const popoverId = useId()

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="My Profile"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-full bg-muted p-0.5 transition-transform duration-150 outline-none active:scale-95',
          open && 'scale-95',
        )}
      >
        <ProfileInitialsAvatar
          name={principal.name}
          avatarUrl={principal.avatarUrl}
          className="size-full"
        />
        <span className="sr-only">Principal account profile</span>
      </button>

      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Logged-in Principal profile"
          className="absolute right-0 z-50 mt-2.5 w-[min(21rem,calc(100vw-1.5rem))] origin-top-right rounded-3xl bg-popover p-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)] animate-in fade-in-0 zoom-in-95 duration-150"
        >
          <div className="flex items-center gap-3.5 pb-4">
            <ProfileInitialsAvatar
              name={principal.name}
              avatarUrl={principal.avatarUrl}
              className="size-14 text-sm"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#0077CC] dark:text-[#0095F6]">
                Principal
              </p>
              <p className="mt-0.5 truncate font-display text-lg font-semibold text-foreground">
                {principal.name}
              </p>
            </div>
          </div>

          <dl className="mb-3.5 flex flex-col gap-2.5 rounded-2xl bg-card p-3.5 text-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="size-3.5 text-[#0077CC] dark:text-[#0095F6]" aria-hidden="true" />
                Full Name
              </dt>
              <dd className="text-right text-xs font-medium text-foreground">{principal.name}</dd>
            </div>

            <div className="h-px bg-border/40" aria-hidden="true" />

            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <Hash className="size-3.5 text-[#0077CC] dark:text-[#0095F6]" aria-hidden="true" />
                Principal / Usthad ID
              </dt>
              <dd className="font-mono text-xs font-semibold tabular-nums text-[#0077CC] dark:text-[#0095F6]">
                {principal.staffId} / {principal.usthadStaffId}
              </dd>
            </div>

            <div className="h-px bg-border/40" aria-hidden="true" />

            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5 text-[#0077CC] dark:text-[#0095F6]" aria-hidden="true" />
                Role
              </dt>
              <dd className="text-right text-xs font-medium text-foreground">
                Principal (All 11 Classes)
              </dd>
            </div>

            <div className="h-px bg-border/40" aria-hidden="true" />

            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <GraduationCap className="size-3.5 text-[#0077CC] dark:text-[#38BDF8]" aria-hidden="true" />
                Assigned Classes
              </dt>
              <dd className="text-right text-xs font-semibold text-[#0077CC] dark:text-[#38BDF8]">
                Class {principal.assignedClassesLabel} ({principal.assignedBatch})
              </dd>
            </div>

            <div className="h-px bg-border/40" aria-hidden="true" />

            <div className="flex items-start justify-between gap-3">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <Award className="size-3.5 text-[#0077CC] dark:text-[#0095F6]" aria-hidden="true" />
                Institution
              </dt>
              <dd className="text-right text-xs font-medium text-foreground">
                ICS Academy Manhappatta
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => {
              unlockAndroidAudioOnGesture()
              setOpen(false)
              setGuideOpen(true)
            }}
            className="mb-2 flex h-12 w-full items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-[#7C3AED]/15 via-[#4F46E5]/15 to-[#0095F6]/15 px-3.5 text-left transition-all duration-150 outline-none hover:from-[#7C3AED]/25 hover:to-[#0095F6]/25 active:scale-[0.98]"
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#7C3AED] to-[#0095F6] text-white">
                <PlayCircle className="size-4" aria-hidden="true" />
              </span>
              <span className="flex flex-col leading-tight min-w-0">
                <span className="truncate text-xs font-bold text-foreground">
                  App Video Guide
                </span>
                <span className="truncate text-[10.5px] font-medium text-[#0077CC] dark:text-[#38BDF8]">
                  മലയാളം ശബ്ദ സഹായി • Screen Demo
                </span>
              </span>
            </span>
            <Volume2 className="size-4 shrink-0 text-[#0095F6] animate-pulse" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false)
              window.dispatchEvent(
                new CustomEvent('ics-switch-role', {
                  detail: { role: 'usthad', usthadId: principal.usthadId },
                }),
              )
            }}
            className="mb-2 flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-[#0095F6] px-4 text-xs font-semibold text-white transition-all duration-150 outline-none hover:bg-[#0084DC] active:scale-[0.98]"
          >
            <BookOpen className="size-4" aria-hidden="true" />
            Switch to My Class Usthad Workspace
          </button>

          <Link
            href="/"
            onClick={(event) => {
              event.preventDefault()
              setOpen(false)
              window.localStorage.removeItem('isAuthenticated')
              window.localStorage.removeItem('authRole')
              window.dispatchEvent(new CustomEvent('ics-logout'))
            }}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-muted px-4 text-xs font-semibold text-foreground transition-colors duration-150 outline-none hover:bg-red-500/15 hover:text-red-500 active:scale-[0.98] dark:bg-[#232A30]"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Log out
          </Link>
        </div>
      ) : null}

      {guideOpen ? (
        <AppVideoGuideModal
          onClose={() => setGuideOpen(false)}
          initialRole="principal"
        />
      ) : null}
    </div>
  )
}


