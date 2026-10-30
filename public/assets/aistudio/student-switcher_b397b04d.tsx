'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { students, type Student } from '@/components/dashboard/data'
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
  onChange: (student: Student) => void
}

export function StudentSwitcher({ student, onChange }: StudentSwitcherProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listId = useId()

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
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 items-center gap-2.5 rounded-full border border-border bg-card py-1 pr-3 pl-1 text-left transition-colors duration-200 outline-none hover:border-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <StudentAvatar student={student} />
        <span className="hidden flex-col leading-tight sm:flex">
          <span className="text-sm font-semibold text-foreground">{student.name}</span>
          <span className="text-xs text-muted-foreground">Class {student.className}</span>
        </span>
        <span className="sr-only">Switch student</span>
        <ChevronDown
          className={cn('size-4 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-72 origin-top-right rounded-2xl border border-border bg-popover p-1.5 shadow-2xl shadow-black/40 animate-in fade-in-0 zoom-in-95 duration-150">
          <p className="px-3 pt-2 pb-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Switch student
          </p>
          <ul id={listId} role="listbox" aria-label="Students" className="max-h-80 overflow-y-auto">
            {students.map((option) => {
              const selected = option.id === student.id
              return (
                <li key={option.id} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-150 outline-none focus-visible:bg-muted',
                      selected ? 'bg-muted' : 'hover:bg-muted/70',
                    )}
                  >
                    <StudentAvatar student={option} className="size-8 text-[0.65rem]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{option.name}</span>
                      <span className="block text-xs text-muted-foreground">Class {option.className}</span>
                    </span>
                    {selected ? <Check className="size-4 text-lime" aria-hidden="true" /> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
