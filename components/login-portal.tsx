'use client'

import { useState, type FormEvent } from 'react'
import { ArrowRight, BookOpen, Check, Crown, GraduationCap, Users, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Role = {
  id: string
  tier: string
  title: string
  description: string
  idLabel: string
  idPlaceholder: string
  icon: LucideIcon
  tone: 'lime' | 'cyan'
}

const studentRole: Role = {
  id: 'student',
  tier: 'Tier 01',
  title: 'Student',
  description: 'View timetables, submit assignments and track your results.',
  idLabel: 'Admission number',
  idPlaceholder: 'e.g. ICS-2026-0142',
  icon: GraduationCap,
  tone: 'lime',
}

const classLeaderRole: Role = {
  id: 'class-leader',
  tier: 'Tier 02',
  title: 'Class Leader',
  description: 'Mark daily attendance and share notices with your class.',
  idLabel: 'Leader ID',
  idPlaceholder: 'e.g. CL-8B-03',
  icon: Users,
  tone: 'cyan',
}

const teacherRole: Role = {
  id: 'teacher',
  tier: 'Tier 03',
  title: 'Teacher',
  description: 'Manage classes, publish lessons and grade submissions.',
  idLabel: 'Staff ID',
  idPlaceholder: 'e.g. TCH-0217',
  icon: BookOpen,
  tone: 'lime',
}

const principalRole: Role = {
  id: 'principal',
  tier: 'Tier 04',
  title: 'Principal',
  description: 'Oversee the whole campus with reports and approvals.',
  idLabel: 'Administrator ID',
  idPlaceholder: 'e.g. ADM-001',
  icon: Crown,
  tone: 'cyan',
}

export const dawaCollegeRoles: Role[] = [studentRole, classLeaderRole, teacherRole, principalRole]

export const englishSchoolRoles: Role[] = [
  studentRole,
  { ...teacherRole, tier: 'Tier 02', tone: 'cyan' },
  { ...principalRole, tier: 'Tier 03', tone: 'lime' },
]

type LoginPortalProps = {
  id: string
  eyebrow: string
  description: string
  roles: Role[]
  gridClassName: string
  className?: string
  onStudentLogin?: () => void
}

const DEMO_STUDENT = { identifier: 'ICS-2026-0142', password: 'password123' }

export function LoginPortal({
  id,
  eyebrow,
  description,
  roles,
  gridClassName,
  className,
  onStudentLogin,
}: LoginPortalProps) {
  const [selectedId, setSelectedId] = useState(roles[0].id)
  const [invalid, setInvalid] = useState(false)
  const selected = roles.find((role) => role.id === selectedId) ?? roles[0]

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const identifier = String(data.get('identifier') ?? '').trim()
    const password = String(data.get('password') ?? '')
    const isValid =
      selected.id === 'student' &&
      identifier === DEMO_STUDENT.identifier &&
      password === DEMO_STUDENT.password
    if (isValid && onStudentLogin) {
      setInvalid(false)
      onStudentLogin()
      return
    }
    setInvalid(true)
  }

  return (
    <section id={id} className={cn('relative border-t border-border bg-card/40 transition-colors duration-300', className)}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 bottom-0 size-[28rem] rounded-full bg-lime/10 blur-3xl"
      />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-12 px-6 py-20 md:py-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="flex max-w-2xl flex-col gap-4"
        >
          <p className="text-sm font-semibold tracking-widest text-cyan uppercase">{eyebrow}</p>
          <h2 className="text-balance font-display text-4xl font-bold md:text-5xl">
            Choose your role to log in
          </h2>
          <p className="text-pretty font-light tracking-wide text-base leading-relaxed text-muted-foreground md:text-lg md:leading-loose">
            {description}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          role="radiogroup"
          aria-label={`Select your role for the ${eyebrow}`}
          className={cn('grid gap-4', gridClassName)}
        >
          {roles.map((role) => {
            const Icon = role.icon
            const isActive = role.id === selectedId
            const isLime = role.tone === 'lime'
            return (
              <button
                key={role.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => {
                  setSelectedId(role.id)
                  setInvalid(false)
                }}
                className={cn(
                  'group relative flex flex-col gap-6 rounded-3xl border bg-background/60 p-6 text-left transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? isLime
                      ? 'border-lime shadow-[0_0_0_1px_var(--lime)]'
                      : 'border-cyan shadow-[0_0_0_1px_var(--cyan)]'
                    : 'border-border hover:-translate-y-1 hover:border-foreground/25',
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'flex size-12 items-center justify-center rounded-2xl',
                      isLime ? 'bg-lime/15 text-lime' : 'bg-cyan/15 text-cyan',
                    )}
                  >
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  {isActive ? (
                    <span
                      className={cn(
                        'flex size-6 items-center justify-center rounded-full text-background',
                        isLime ? 'bg-lime' : 'bg-cyan',
                      )}
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground">{role.tier}</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="font-display text-2xl font-semibold">{role.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{role.description}</p>
                </div>
              </button>
            )
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.65, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="grid gap-8 rounded-3xl border border-border bg-background/70 p-6 backdrop-blur-md transition-colors duration-300 md:p-10 lg:grid-cols-[1fr_1.2fr] lg:items-center"
        >
          <div className="flex flex-col gap-3">
            <p className={cn('text-sm font-semibold', selected.tone === 'lime' ? 'text-lime' : 'text-cyan')}>
              {selected.tier} access
            </p>
            <h3 className="font-display text-3xl font-bold">Log in as {selected.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Forgot your credentials? Contact the academy office to reset your access.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" aria-describedby={`${id}-status`}>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-id`}>{selected.idLabel}</Label>
              <Input
                id={`${id}-id`}
                name="identifier"
                required
                autoComplete="username"
                placeholder={selected.idPlaceholder}
                className="h-12 rounded-xl"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-password`}>Password</Label>
              <Input
                id={`${id}-password`}
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                className="h-12 rounded-xl"
              />
            </div>
            <Button type="submit" className="h-12 rounded-full text-base font-semibold">
              Log in to portal
              <ArrowRight data-icon="inline-end" />
            </Button>
            <p
              id={`${id}-status`}
              role="status"
              className="min-h-5 text-sm text-red-500"
            >
              {invalid ? 'Invalid credentials' : ''}
            </p>
          </form>
        </motion.div>
      </div>
    </section>
  )
}
