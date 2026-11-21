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
import { AnimatedWords } from '@/components/campus-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ACADEMY_PRINCIPAL,
  bindDeviceNotificationIdentity,
  findClassLeaderByIdentifier,
  findPrincipalByIdentifier,
  findStudentByAdmissionNo,
  findUsthadByStaffId,
  getCanonicalUsthadId,
  getPrimaryDeviceOwnerIdentity,
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
  tier: 'Student',
  title: 'Student',
  description: 'Attendance, Leave, Kitabs & Messenger.',
  idLabel: 'Student ID',
  idPlaceholder: 'e.g. ICS2K261401',
  icon: GraduationCap,
  tone: 'lime',
}

const classLeaderRole: Role = {
  id: 'class-leader',
  tier: 'Leader',
  title: 'Class Leader',
  description: 'Submit daily class attendance.',
  idLabel: 'Leader ID or Student ID',
  idPlaceholder: 'e.g. CL-14-01 or ICS2K261401',
  icon: Users,
  tone: 'cyan',
}

const teacherRole: Role = {
  id: 'teacher',
  tier: 'Usthad',
  title: 'Usthad',
  description: 'Mark period attendance, syllabus & class duties.',
  idLabel: 'Staff ID or Name',
  idPlaceholder: 'e.g. UST-14 or UST-09',
  icon: BookOpen,
  tone: 'lime',
}

const englishTeacherRole: Role = {
  id: 'teacher',
  tier: 'Teacher',
  title: 'Class Teacher',
  description: 'Manage class attendance, leave & notices.',
  idLabel: 'Staff ID or Name',
  idPlaceholder: 'e.g. UST-09',
  icon: BookOpen,
  tone: 'cyan',
}

const principalRole: Role = {
  id: 'principal',
  tier: 'Admin',
  title: 'Principal',
  description: 'Manage all classes, teachers & holidays.',
  idLabel: 'Principal ID',
  idPlaceholder: 'e.g. ADM-001',
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
  englishTeacherRole,
  {
    ...principalRole,
    tier: 'Admin',
    tone: 'lime',
    description: 'Manage all classes, teachers & holidays.',
  },
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
  const [setAsPrimaryOwner, setSetAsPrimaryOwner] = useState(false)
  const primaryOwner = typeof window !== 'undefined' ? getPrimaryDeviceOwnerIdentity() : null

  function handleRoleSubmit(role: Role, event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const identifier = String(data.get('identifier') ?? '').trim()
    const password = String(data.get('password') ?? '').trim()
    const forceOverwritePrimaryOwner = setAsPrimaryOwner

    if (role.id === 'student' && password.length > 0) {
      const matchedStudent = findStudentByAdmissionNo(identifier)
      if (matchedStudent && onStudentLogin) {
        setInvalidRoleId(null)
        window.localStorage.setItem('loggedInStudentId', matchedStudent.id)
        window.localStorage.setItem(`ics_own_password_${matchedStudent.id}`, password)
        window.localStorage.setItem('authRole', 'student')
        bindDeviceNotificationIdentity(
          {
            role: 'student',
            actorId: matchedStudent.id,
            actorName: matchedStudent.name,
            className: matchedStudent.className,
            assignedClasses: [matchedStudent.className],
            isStaff: false,
            isPrincipal: false,
          },
          { forceOverwritePrimaryOwner },
        )
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
        window.localStorage.setItem(`ics_own_password_${students[0].id}`, password)
        window.localStorage.setItem('authRole', 'student')
        bindDeviceNotificationIdentity(
          {
            role: 'student',
            actorId: students[0].id,
            actorName: students[0].name,
            className: students[0].className,
            assignedClasses: [students[0].className],
            isStaff: false,
            isPrincipal: false,
          },
          { forceOverwritePrimaryOwner },
        )
        onStudentLogin()
        return
      }
    }

    if (role.id === 'class-leader' && password.length > 0) {
      const matchedLeader = findClassLeaderByIdentifier(identifier)
      if (matchedLeader && (onClassLeaderLogin || onStudentLogin)) {
        setInvalidRoleId(null)
        window.localStorage.setItem('loggedInStudentId', matchedLeader.student.id)
        window.localStorage.setItem(`ics_own_password_${matchedLeader.student.id}`, password)
        window.localStorage.setItem('loggedInLeaderId', matchedLeader.leaderId)
        window.localStorage.setItem(
          'loggedInLeaderRoleTitle',
          matchedLeader.roleTitle,
        )
        window.localStorage.setItem('authRole', 'class-leader')
        bindDeviceNotificationIdentity(
          {
            role: 'class-leader',
            actorId: matchedLeader.student.id,
            actorName: matchedLeader.student.name,
            className: matchedLeader.student.className,
            assignedClasses: [matchedLeader.student.className],
            isStaff: false,
            isPrincipal: false,
          },
          { forceOverwritePrimaryOwner },
        )
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
        window.localStorage.setItem('usthadStaffId', matchedUsthad.staffId)
        window.localStorage.setItem('authRole', 'usthad')
        const canonicalUsthadId = getCanonicalUsthadId(matchedUsthad.id)
        const isPrin = canonicalUsthadId === getCanonicalUsthadId(ACADEMY_PRINCIPAL.usthadId)
        bindDeviceNotificationIdentity(
          {
            role: 'usthad',
            actorId: canonicalUsthadId,
            actorName: matchedUsthad.name,
            className: matchedUsthad.className,
            assignedClasses: isPrin
              ? ACADEMY_PRINCIPAL.assignedClasses || ['BS 3', 'BS 1']
              : matchedUsthad.teachingBatches && matchedUsthad.teachingBatches.length > 0
                ? [...matchedUsthad.teachingBatches]
                : [matchedUsthad.className],
            isStaff: true,
            isPrincipal: isPrin,
          },
          { forceOverwritePrimaryOwner },
        )
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
        window.localStorage.setItem(
          'loggedInUsthadId',
          ACADEMY_PRINCIPAL.usthadId,
        )
        window.localStorage.setItem('authRole', 'principal')
        bindDeviceNotificationIdentity(
          {
            role: 'principal',
            actorId: ACADEMY_PRINCIPAL.usthadId,
            actorName: ACADEMY_PRINCIPAL.name,
            className: ACADEMY_PRINCIPAL.assignedClassName || 'BS 3',
            assignedClasses: ACADEMY_PRINCIPAL.assignedClasses || ['BS 3', 'BS 1'],
            isStaff: true,
            isPrincipal: true,
          },
          { forceOverwritePrimaryOwner },
        )
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
        'relative overflow-hidden bg-background transition-colors duration-200',
        className,
      )}
    >
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-10 px-6 py-20 md:py-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="flex max-w-2xl flex-col gap-3"
        >
          <p className="text-xs font-semibold tracking-[0.2em] text-[#0077CC] dark:text-[#0095F6] uppercase">
            {eyebrow}
          </p>
          <h2 className="text-balance font-display text-4xl font-bold md:text-5xl">
            <AnimatedWords text="Choose Your Role" stagger={0.08} />
          </h2>
          <p className="text-pretty font-normal tracking-wide text-base leading-relaxed text-muted-foreground md:text-lg">
            {description}
          </p>
        </motion.div>

        <div
          aria-label={`Select your role for the ${eyebrow}`}
          className={cn('grid items-start gap-4', gridClassName)}
        >
          {roles.map((role, index) => {
            const Icon = role.icon
            const isActive = role.id === selectedId
            const isInvalid = invalidRoleId === role.id

            return (
              <motion.div
                key={role.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.12 }}
                transition={{
                  duration: 1.25,
                  delay: index * 0.12,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="will-change-[transform,opacity]"
              >
                <div
                  className={cn(
                    'group relative flex flex-col rounded-3xl transition-all duration-200 ease-out',
                    isActive
                      ? 'bg-[#E9EEF2] dark:bg-[#141A1F]'
                      : 'bg-card hover:bg-[#EAEFF3] dark:hover:bg-[#11171D]',
                  )}
                >
                <button
                  type="button"
                  aria-expanded={isActive}
                  onClick={() => {
                    setSelectedId((prev) => (prev === role.id ? null : role.id))
                    setInvalidRoleId(null)
                  }}
                  className="flex w-full cursor-pointer flex-col gap-5 rounded-3xl p-6 text-left outline-none active:scale-[0.985] transition-transform duration-150"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'flex size-12 items-center justify-center rounded-2xl transition-colors',
                        isActive
                          ? 'bg-[#0095F6] text-white'
                          : 'bg-[#0095F6]/12 text-[#0077CC] dark:text-[#0095F6]',
                      )}
                    >
                      <Icon className="size-6 stroke-[1.9]" aria-hidden="true" />
                    </span>

                    <div className="flex items-center gap-2">
                      {isActive ? (
                        <span className="flex size-6 items-center justify-center rounded-full bg-[#0095F6] text-white">
                          <Check className="size-3.5 stroke-[2.5]" aria-hidden="true" />
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground">
                          {role.tier}
                        </span>
                      )}
                      <span
                        className={cn(
                          'flex size-7 items-center justify-center rounded-full bg-background/70 text-muted-foreground transition-transform duration-300 dark:bg-white/8',
                          isActive && 'rotate-180 bg-[#0095F6]/15 text-[#0095F6]',
                        )}
                      >
                        <ChevronDown className="size-4" aria-hidden="true" />
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <h3 className="font-display text-2xl font-semibold text-foreground">
                      {role.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {role.description}
                    </p>
                  </div>

                  {!isActive && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0077CC] dark:text-[#0095F6]">
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
                      <div className="px-6 pt-2 pb-6">
                        <div className="mb-4 flex flex-col gap-1">
                          <p className="text-xs font-bold tracking-wider text-[#0077CC] dark:text-[#0095F6] uppercase">
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
                              className="h-11 rounded-2xl bg-background dark:bg-black"
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
                              className="h-11 rounded-2xl bg-background dark:bg-black"
                            />
                          </div>

                          {primaryOwner && (
                            <div className="rounded-2xl bg-background/70 p-3.5 text-xs dark:bg-black/70">
                              <p className="font-semibold text-foreground">
                                Phone Notification Owner: {primaryOwner.actorName} ({primaryOwner.className})
                              </p>
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                If a friend logs in temporarily on this phone, their notifications will NOT come after they log out.
                              </p>
                              <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                                <input
                                  type="checkbox"
                                  checked={setAsPrimaryOwner}
                                  onChange={(e) => setSetAsPrimaryOwner(e.target.checked)}
                                  className="size-4 rounded accent-[#0095F6]"
                                />
                                <span>Set this new login ID as this phone&apos;s Primary Owner</span>
                              </label>
                            </div>
                          )}

                          <Button
                            type="submit"
                            className="mt-1 h-12 w-full rounded-full text-sm font-semibold"
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

                          <p className="text-xs leading-relaxed text-muted-foreground">
                            Forgot your credentials? Contact the academy office
                            to reset your access.
                          </p>
                        </form>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
