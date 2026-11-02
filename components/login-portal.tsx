'use client'

import { useState, type FormEvent } from 'react'
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Crown,
  GraduationCap,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ACADEMY_PRINCIPAL,
  findClassLeaderByIdentifier,
  findPrincipalByIdentifier,
  findStudentByAdmissionNo,
  findUsthadByStaffId,
  CLASS_USTHADS,
  students,
  type ClassUsthad,
} from '@/components/dashboard/data'
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
  idPlaceholder: 'e.g. ICS2K261401',
  icon: GraduationCap,
  tone: 'lime',
}

const classLeaderRole: Role = {
  id: 'class-leader',
  tier: 'Tier 02',
  title: 'Class Leader (Main & Assistant)',
  description:
    'Each class has 2 leaders (Main Leader & Assistant Leader) with identical permissions to submit period attendance.',
  idLabel: 'Leader ID (Main / Assistant) or Admission number',
  idPlaceholder: 'e.g. CL-14 or ACL-14 (or ICS2K261401 / ICS2K261402)',
  icon: Users,
  tone: 'cyan',
}

const teacherRole: Role = {
  id: 'teacher',
  tier: 'Tier 03',
  title: 'Class Usthad (Teacher)',
  description:
    'Manage your assigned class attendance, leave register, notices, and digital Kitabs.',
  idLabel: 'Staff ID',
  idPlaceholder: 'e.g. UST-07 (or UST-14 to UST-05)',
  icon: BookOpen,
  tone: 'lime',
}

const principalRole: Role = {
  id: 'principal',
  tier: 'Tier 04',
  title: 'Principal',
  description:
    'Oversee all 11 classes, monitor unheld periods & assign substitute Usthads, announce official holidays, and manage campus records.',
  idLabel: 'Principal / Administrator ID',
  idPlaceholder: 'e.g. ADM-001 (or PRINCIPAL)',
  icon: Crown,
  tone: 'cyan',
}

export const dawaCollegeRoles: Role[] = [
  studentRole,
  classLeaderRole,
  teacherRole,
  principalRole,
]

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
  onClassLeaderLogin?: () => void
  onUsthadLogin?: (usthad: ClassUsthad) => void
  onPrincipalLogin?: () => void
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
  onClassLeaderLogin,
  onUsthadLogin,
  onPrincipalLogin,
}: LoginPortalProps) {
  // Null by default so the login form only appears directly below the card the user clicks
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [invalidRoleId, setInvalidRoleId] = useState<string | null>(null)

  function handleRoleSubmit(role: Role, event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const identifier = String(data.get('identifier') ?? '').trim()
    const password = String(data.get('password') ?? '').trim()

    if (role.id === 'student' && password.length > 0) {
      const matchedStudent = findStudentByAdmissionNo(identifier)
      if (matchedStudent && onStudentLogin) {
        setInvalidRoleId(null)
        window.localStorage.setItem('loggedInStudentId', matchedStudent.id)
        window.localStorage.setItem('authRole', 'student')
        onStudentLogin()
        return
      }
      if (
        identifier.toUpperCase() === DEMO_STUDENT.identifier &&
        password === DEMO_STUDENT.password &&
        onStudentLogin
      ) {
        setInvalidRoleId(null)
        window.localStorage.setItem('loggedInStudentId', students[0].id)
        window.localStorage.setItem('authRole', 'student')
        onStudentLogin()
        return
      }
    }

    if (role.id === 'class-leader' && password.length > 0) {
      const matchedLeader = findClassLeaderByIdentifier(identifier)
      if (matchedLeader && (onClassLeaderLogin || onStudentLogin)) {
        setInvalidRoleId(null)
        window.localStorage.setItem('loggedInStudentId', matchedLeader.student.id)
        window.localStorage.setItem('loggedInLeaderId', matchedLeader.leaderId)
        window.localStorage.setItem(
          'loggedInLeaderRoleTitle',
          matchedLeader.roleTitle,
        )
        window.localStorage.setItem('authRole', 'class-leader')
        if (onClassLeaderLogin) {
          onClassLeaderLogin()
        } else {
          onStudentLogin?.()
        }
        return
      }
    }

    if (role.id === 'teacher' && password.length > 0) {
      const matchedUsthad =
        findUsthadByStaffId(identifier) ??
        (identifier.toUpperCase() === 'TCH-0217' ? CLASS_USTHADS[0] : undefined)
      if (matchedUsthad && onUsthadLogin) {
        setInvalidRoleId(null)
        window.localStorage.setItem('loggedInUsthadId', matchedUsthad.id)
        window.localStorage.setItem('authRole', 'usthad')
        onUsthadLogin(matchedUsthad)
        return
      }
    }

    if (role.id === 'principal' && password.length > 0) {
      const matchedPrincipal = findPrincipalByIdentifier(identifier)
      if (matchedPrincipal && onPrincipalLogin) {
        setInvalidRoleId(null)
        window.localStorage.setItem(
          'loggedInPrincipalId',
          ACADEMY_PRINCIPAL.staffId,
        )
        window.localStorage.setItem('authRole', 'principal')
        onPrincipalLogin()
        return
      }
    }

    setInvalidRoleId(role.id)
  }

  return (
    <section
      id={id}
      className={cn(
        'relative border-t border-border bg-card/40 transition-colors duration-300',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 bottom-0 size-[28rem] rounded-full bg-lime/10 blur-3xl"
      />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-10 px-6 py-20 md:py-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="flex max-w-2xl flex-col gap-4"
        >
          <p className="text-sm font-semibold tracking-widest text-cyan uppercase">
            {eyebrow}
          </p>
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
          aria-label={`Select your role for the ${eyebrow}`}
          className={cn('grid items-start gap-4', gridClassName)}
        >
          {roles.map((role) => {
            const Icon = role.icon
            const isActive = role.id === selectedId
            const isLime = role.tone === 'lime'
            const isInvalid = invalidRoleId === role.id

            return (
              <div
                key={role.id}
                className={cn(
                  'group relative flex flex-col rounded-3xl border bg-background/60 transition-all duration-300',
                  isActive
                    ? isLime
                      ? 'border-lime bg-background/90 shadow-[0_0_0_1px_var(--lime)]'
                      : 'border-cyan bg-background/90 shadow-[0_0_0_1px_var(--cyan)]'
                    : 'border-border hover:-translate-y-0.5 hover:border-foreground/25',
                )}
              >
                <button
                  type="button"
                  aria-expanded={isActive}
                  onClick={() => {
                    setSelectedId((prev) => (prev === role.id ? null : role.id))
                    setInvalidRoleId(null)
                  }}
                  className="flex w-full flex-col gap-5 rounded-3xl p-6 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'flex size-12 items-center justify-center rounded-2xl',
                        isLime
                          ? 'bg-lime/15 text-lime'
                          : 'bg-cyan/15 text-cyan',
                      )}
                    >
                      <Icon className="size-6" aria-hidden="true" />
                    </span>

                    <div className="flex items-center gap-2">
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
                        <span className="text-xs font-medium text-muted-foreground">
                          {role.tier}
                        </span>
                      )}
                      <span
                        className={cn(
                          'flex size-7 items-center justify-center rounded-full border border-border/70 bg-muted/40 text-muted-foreground transition-transform duration-300',
                          isActive &&
                            (isLime
                              ? 'rotate-180 border-lime/40 bg-lime/15 text-lime'
                              : 'rotate-180 border-cyan/40 bg-cyan/15 text-cyan'),
                        )}
                      >
                        <ChevronDown className="size-4" aria-hidden="true" />
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <h3 className="font-display text-2xl font-semibold">
                      {role.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {role.description}
                    </p>
                  </div>

                  {!isActive && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 text-xs font-semibold',
                        isLime ? 'text-lime' : 'text-cyan',
                      )}
                    >
                      Tap to enter ID &amp; Password
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.div
                      key={`${role.id}-login-form`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border/80 px-6 pt-5 pb-6">
                        <div className="mb-4 flex flex-col gap-1">
                          <p
                            className={cn(
                              'text-xs font-bold tracking-wider uppercase',
                              isLime ? 'text-lime' : 'text-cyan',
                            )}
                          >
                            {role.tier} access
                          </p>
                          <p className="text-sm font-semibold text-foreground">
                            Log in as {role.title}
                          </p>
                        </div>

                        <form
                          onSubmit={(e) => handleRoleSubmit(role, e)}
                          className="flex flex-col gap-4"
                          aria-describedby={`${id}-${role.id}-status`}
                        >
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`${id}-${role.id}-id`}>
                              {role.idLabel}
                            </Label>
                            <Input
                              id={`${id}-${role.id}-id`}
                              name="identifier"
                              required
                              autoFocus
                              autoComplete="username"
                              placeholder={role.idPlaceholder}
                              onChange={() => {
                                if (isInvalid) setInvalidRoleId(null)
                              }}
                              className="h-11 rounded-xl"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`${id}-${role.id}-password`}>
                              Password
                            </Label>
                            <Input
                              id={`${id}-${role.id}-password`}
                              name="password"
                              type="password"
                              required
                              autoComplete="current-password"
                              placeholder="Enter your password"
                              onChange={() => {
                                if (isInvalid) setInvalidRoleId(null)
                              }}
                              className="h-11 rounded-xl"
                            />
                          </div>

                          <Button
                            type="submit"
                            className="mt-1 h-11 w-full rounded-full text-sm font-semibold"
                          >
                            Log in to portal
                            <ArrowRight data-icon="inline-end" />
                          </Button>

                          {isInvalid && (
                            <p
                              id={`${id}-${role.id}-status`}
                              role="status"
                              className="text-xs font-medium text-red-500"
                            >
                              Invalid credentials. Please check your ID and
                              password.
                            </p>
                          )}

                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            Forgot your credentials? Contact the academy office
                            to reset your access.
                          </p>
                        </form>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
