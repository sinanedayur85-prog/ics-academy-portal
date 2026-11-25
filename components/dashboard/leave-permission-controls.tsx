'use client'

import { useMemo, useState } from 'react'
import {
  Check,
  Clock,
  Lock,
  RotateCcw,
  Search,
  ShieldCheck,
  Unlock,
  X,
} from 'lucide-react'
import {
  normalizeClassName,
  type Student,
} from '@/components/dashboard/data'
import {
  grantStudentLeavePermission,
  lockStudentLeavePermission,
  useAllLeavePermissions,
  type LeaveAllowedAction,
} from '@/components/dashboard/leave-permission-store'
import { StudentAvatar } from '@/components/dashboard/student-switcher'
import { ThemeSelect } from '@/components/ui/theme-select'
import { cn } from '@/lib/utils'

type LeavePermissionControlsProps = {
  /** Students that this staff member is authorized to unlock (Class Usthad: assigned classes; Principal: all classes). */
  eligibleStudents: Student[]
  actorId: string
  actorName: string
  actorRole: 'usthad' | 'principal'
  /** Optional list of class names for filtering (shown when > 1 class). */
  classFilterOptions?: string[]
}

export function LeavePermissionControls({
  eligibleStudents,
  actorId,
  actorName,
  actorRole,
  classFilterOptions,
}: LeavePermissionControlsProps) {
  const permissionsMap = useAllLeavePermissions()
  const [search, setSearch] = useState('')
  const [selectedClass, setSelectedClass] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<'all' | 'requested' | 'allowed'>('all')
  const [busyId, setBusyId] = useState<string | null>(null)

  const distinctClasses = useMemo(() => {
    if (classFilterOptions && classFilterOptions.length > 0) {
      return classFilterOptions
    }
    const seen = new Set<string>()
    for (const s of eligibleStudents) {
      seen.add(s.className)
    }
    return Array.from(seen)
  }, [classFilterOptions, eligibleStudents])

  const eligibleIdSet = useMemo(
    () => new Set(eligibleStudents.map((s) => s.id)),
    [eligibleStudents],
  )

  const pendingRequests = useMemo(() => {
    return eligibleStudents
      .map((student) => ({
        student,
        permission: permissionsMap[student.id],
      }))
      .filter((item) => item.permission?.status === 'requested')
      .sort((a, b) => (b.permission?.requestedAtMs ?? 0) - (a.permission?.requestedAtMs ?? 0))
  }, [eligibleStudents, permissionsMap])

  const activeUnlockedCount = useMemo(() => {
    let count = 0
    for (const [sid, rec] of Object.entries(permissionsMap)) {
      if (eligibleIdSet.has(sid) && rec.status === 'allowed' && rec.allowedAction !== 'none') {
        count++
      }
    }
    return count
  }, [permissionsMap, eligibleIdSet])

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase()
    return eligibleStudents.filter((student) => {
      if (
        selectedClass !== 'ALL' &&
        normalizeClassName(student.className) !== normalizeClassName(selectedClass)
      ) {
        return false
      }
      const perm = permissionsMap[student.id]
      if (statusFilter === 'requested' && perm?.status !== 'requested') return false
      if (
        statusFilter === 'allowed' &&
        !(perm?.status === 'allowed' && perm.allowedAction !== 'none')
      ) {
        return false
      }
      if (!q) return true
      return (
        student.name.toLowerCase().includes(q) ||
        student.admissionNo.toLowerCase().includes(q) ||
        student.className.toLowerCase().includes(q)
      )
    })
  }, [eligibleStudents, selectedClass, statusFilter, search, permissionsMap])

  async function handleGrant(
    student: Student,
    action: Exclude<LeaveAllowedAction, 'none'>,
    reregisterType?: 'leave' | 'return',
  ) {
    setBusyId(`${student.id}:${action}`)
    try {
      await grantStudentLeavePermission({
        student,
        action,
        reregisterType,
        actorId,
        actorName,
        actorRole,
      })
    } finally {
      setBusyId(null)
    }
  }

  async function handleLock(student: Student) {
    setBusyId(`${student.id}:lock`)
    try {
      await lockStudentLeavePermission({ student, consumed: false })
    } finally {
      setBusyId(null)
    }
  }

  if (eligibleStudents.length === 0) {
    return null
  }

  return (
    <div className="mb-6 rounded-2xl border border-border/60 bg-muted/35 p-4">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#0095F6]/15 text-[#0077CC] dark:text-[#0095F6]">
            <ShieldCheck className="size-4.5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-foreground">Student Leave Permission</h3>
            <p className="text-[11px] text-muted-foreground">
              One-time unlock for student self-registration • Auto-locks after submit
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
          {pendingRequests.length > 0 ? (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-700 tabular-nums dark:text-amber-300">
              {pendingRequests.length} Requested
            </span>
          ) : null}
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-700 tabular-nums dark:text-emerald-400">
            {activeUnlockedCount} Allowed
          </span>
        </div>
      </div>

      {/* Pending Requests Quick-Action Strip */}
      {pendingRequests.length > 0 ? (
        <div className="mb-3.5 space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            <Clock className="size-3.5" aria-hidden="true" />
            Pending Requests ({pendingRequests.length})
          </div>
          <div className="flex flex-col gap-2">
            {pendingRequests.map(({ student, permission }) => {
              const reqType = permission?.requestedAction === 'return' ? 'return' : 'leave'
              return (
                <div
                  key={student.id}
                  className="flex flex-col justify-between gap-2 rounded-xl bg-background/90 px-3 py-2.5 sm:flex-row sm:items-center dark:bg-black/40"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <StudentAvatar student={student} className="size-8 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-foreground">{student.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {student.className} • {reqType === 'return' ? 'Return Request' : 'Leave Request'}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => handleGrant(student, reqType)}
                      className="inline-flex h-8 items-center gap-1 rounded-full bg-emerald-600 px-3 text-[11px] font-semibold text-white transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                      {reqType === 'return' ? 'Allow Return' : 'Allow Leave'}
                    </button>
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => handleLock(student)}
                      className="inline-flex h-8 items-center gap-1 rounded-full bg-muted px-3 text-[11px] font-semibold text-muted-foreground transition-all hover:bg-destructive/15 hover:text-destructive active:scale-95 disabled:opacity-50"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                      Decline
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Search + Class + Status Filter Bar */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student name or ID..."
            className="h-9 w-full rounded-xl border-0 bg-background pr-3 pl-8 text-xs text-foreground placeholder:text-muted-foreground outline-none dark:bg-[#0B1014]"
          />
        </div>

        {distinctClasses.length > 1 ? (
          <ThemeSelect
            aria-label="Filter class"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="h-9 rounded-xl border-0 bg-background px-2.5 text-xs font-semibold text-foreground outline-none dark:bg-[#0B1014]"
          >
            <option value="ALL">All Classes</option>
            {distinctClasses.map((cls) => (
              <option key={cls} value={cls}>
                Class {cls}
              </option>
            ))}
          </ThemeSelect>
        ) : null}

        <div className="flex items-center gap-1">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'requested', label: 'Requested' },
              { id: 'allowed', label: 'Allowed' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                'h-9 rounded-xl px-3 text-[11px] font-semibold transition-all active:scale-95',
                statusFilter === tab.id
                  ? 'bg-[#0095F6] text-white'
                  : 'bg-background text-muted-foreground hover:text-foreground dark:bg-[#0B1014]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Student Permission Rows */}
      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
        {filteredStudents.length === 0 ? (
          <p className="rounded-xl bg-background/60 p-4 text-center text-xs text-muted-foreground">
            No students match your filter.
          </p>
        ) : (
          filteredStudents.map((student) => {
            const perm = permissionsMap[student.id]
            const isAllowed = perm?.status === 'allowed' && perm.allowedAction !== 'none'
            const isRequested = perm?.status === 'requested'
            const badgeText = isAllowed
              ? perm.allowedAction === 'reregister'
                ? 'Re-Register'
                : perm.allowedAction === 'return'
                  ? 'Return Allowed'
                  : 'Leave Allowed'
              : isRequested
                ? 'Requested'
                : 'Locked'

            return (
              <div
                key={student.id}
                className="flex flex-col justify-between gap-2.5 rounded-xl bg-background/85 px-3 py-2.5 sm:flex-row sm:items-center dark:bg-[#0B1014]"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <StudentAvatar student={student} className="size-8 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-xs font-semibold text-foreground">{student.name}</p>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold',
                          isAllowed
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                            : isRequested
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                              : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {badgeText}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {student.className} • {student.admissionNo}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => handleGrant(student, 'leave')}
                    className={cn(
                      'inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition-all active:scale-95 disabled:opacity-50',
                      isAllowed && perm?.allowedAction === 'leave'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-muted text-foreground hover:bg-emerald-600 hover:text-white',
                    )}
                  >
                    <Unlock className="size-3" aria-hidden="true" />
                    Allow Leave
                  </button>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => handleGrant(student, 'return')}
                    className={cn(
                      'inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition-all active:scale-95 disabled:opacity-50',
                      isAllowed && perm?.allowedAction === 'return'
                        ? 'bg-[#0095F6] text-white'
                        : 'bg-muted text-foreground hover:bg-[#0095F6] hover:text-white',
                    )}
                  >
                    <Unlock className="size-3" aria-hidden="true" />
                    Allow Return
                  </button>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => handleGrant(student, 'reregister', 'leave')}
                    className={cn(
                      'inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition-all active:scale-95 disabled:opacity-50',
                      isAllowed && perm?.allowedAction === 'reregister'
                        ? 'bg-amber-600 text-white'
                        : 'bg-muted text-foreground hover:bg-amber-600 hover:text-white',
                    )}
                  >
                    <RotateCcw className="size-3" aria-hidden="true" />
                    Re-Register
                  </button>
                  {isAllowed || isRequested ? (
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => handleLock(student)}
                      className="inline-flex h-8 items-center gap-1 rounded-full bg-destructive/12 px-2.5 text-[11px] font-semibold text-destructive transition-all hover:bg-destructive hover:text-white active:scale-95 disabled:opacity-50"
                    >
                      <Lock className="size-3" aria-hidden="true" />
                      Lock
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
