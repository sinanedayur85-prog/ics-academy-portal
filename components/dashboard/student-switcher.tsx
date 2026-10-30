'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, GraduationCap, Hash, LogOut, User } from 'lucide-react'
import type { Student } from '@/components/dashboard/data'
import { cn } from '@/lib/utils'

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
}

export function StudentAvatar({ student, className }: { student: Student; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-lime to-cyan text-xs font-bold text-primary-foreground',
        className,
      )}
    >
      {initials(student.name)}
    </span>
  )
}

type StudentSwitcherProps = {
  student: Student
}

export function StudentSwitcher({ student }: StudentSwitcherProps) {
  const [open, setOpen] = useState(false)
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
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex h-11 items-center gap-2.5 rounded-full border bg-card py-1 pr-3 pl-1 text-left transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          open ? 'border-lime/50' : 'border-border hover:border-lime/30',
        )}
      >
        <StudentAvatar student={student} />
        <span className="hidden flex-col leading-tight sm:flex">
          <span className="text-sm font-semibold text-foreground">{student.name}</span>
          <span className="text-xs text-muted-foreground">Class {student.className}</span>
        </span>
        <span className="sr-only">Account profile</span>
        <ChevronDown
          className={cn('size-4 text-muted-foreground transition-transform duration-200', open && 'rotate-180 text-lime')}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Logged-in student profile"
          className="absolute right-0 z-50 mt-2 w-80 origin-top-right rounded-2xl border border-border bg-popover p-4 shadow-2xl shadow-black/50 animate-in fade-in-0 zoom-in-95 duration-150"
        >
          <div className="flex items-center gap-3.5 border-b border-border pb-4">
            <StudentAvatar student={student} className="size-12 text-sm shadow-sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-lime">
                Logged-in Student
              </p>
              <p className="mt-0.5 truncate font-display text-lg font-semibold text-foreground">
                {student.name}
              </p>
            </div>
          </div>

          <dl className="my-3.5 flex flex-col gap-2.5 rounded-xl border border-border bg-background/60 p-3.5 text-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="size-3.5 text-lime" aria-hidden="true" />
                Full Name
              </dt>
              <dd className="text-right text-xs font-medium text-foreground">{student.name}</dd>
            </div>

            <div className="h-px bg-border/60" aria-hidden="true" />

            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <Hash className="size-3.5 text-lime" aria-hidden="true" />
                Admission / Reg. No.
              </dt>
              <dd className="font-mono text-xs font-semibold tabular-nums text-lime">
                {student.admissionNo}
              </dd>
            </div>

            <div className="h-px bg-border/60" aria-hidden="true" />

            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <GraduationCap className="size-3.5 text-lime" aria-hidden="true" />
                Class / Batch
              </dt>
              <dd className="text-right text-xs font-medium text-foreground">
                Class {student.className}
              </dd>
            </div>
          </dl>

          <Link
            href="/"
            onClick={(event) => {
              event.preventDefault()
              setOpen(false)
              window.localStorage.removeItem('isAuthenticated')
              window.dispatchEvent(new CustomEvent('ics-logout'))
            }}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-lime/30 bg-lime/10 px-4 text-xs font-semibold text-lime transition-colors duration-200 outline-none hover:border-lime hover:bg-lime hover:text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Log out
          </Link>
        </div>
      ) : null}
    </div>
  )
}
