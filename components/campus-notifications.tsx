'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bell,
  BellRing,
  CalendarCheck,
  CheckCheck,
  ClipboardList,
  ExternalLink,
  Megaphone,
  UserCheck,
  X,
} from 'lucide-react'
import {
  loadCampusNotifications,
  pullCampusStateFromServer,
  type CampusNotification,
  type CampusNotificationType,
} from '@/components/dashboard/data'
import { triggerSystemNotification } from '@/lib/mobile-pdf'
import { cn } from '@/lib/utils'

const READ_NOTIF_IDS_STORAGE_KEY = 'ics_read_notification_ids_v1'
const LAST_TOASTED_NOTIF_ID_KEY = 'ics_last_toasted_notif_id_v1'

function loadReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(READ_NOTIF_IDS_STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function saveReadIds(set: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      READ_NOTIF_IDS_STORAGE_KEY,
      JSON.stringify(Array.from(set).slice(-120)),
    )
    window.dispatchEvent(new CustomEvent('ics-notifications-read-changed'))
  } catch {
    // Ignore storage errors
  }
}

function getNotificationMeta(type: CampusNotificationType) {
  switch (type) {
    case 'attendance':
      return {
        label: 'Attendance Update',
        Icon: CalendarCheck,
        badgeClass: 'bg-cyan/15 text-cyan border-cyan/30',
        iconClass: 'bg-cyan/15 text-cyan',
      }
    case 'period-attendance':
      return {
        label: 'Class Period Attendance',
        Icon: UserCheck,
        badgeClass: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
        iconClass: 'bg-emerald-500/15 text-emerald-500',
      }
    case 'leave':
      return {
        label: 'Leave Register Update',
        Icon: ClipboardList,
        badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        iconClass: 'bg-amber-500/15 text-amber-400',
      }
    case 'notice':
    default:
      return {
        label: 'Official Announcement',
        Icon: Megaphone,
        badgeClass: 'bg-lime/15 text-lime border-lime/30',
        iconClass: 'bg-lime/15 text-lime',
      }
  }
}

function formatRelativeTime(createdAtMs: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - createdAtMs) / 1000))
  if (diffSec < 45) return 'Just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  return new Date(createdAtMs).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })
}

export function CampusNotificationBar({
  studentId,
  classNameFilter,
}: {
  studentId?: string
  classNameFilter?: string
}) {
  const [activeToast, setActiveToast] = useState<CampusNotification | null>(null)

  useEffect(() => {
    // Poll cloud sync every 7 seconds for live Usthad notices & attendance updates
    pullCampusStateFromServer()
    const timer = window.setInterval(() => {
      pullCampusStateFromServer()
    }, 7000)

    function handleIncoming(e: Event) {
      const custom = e as CustomEvent<CampusNotification>
      const notif = custom.detail
      if (!notif || !notif.id) return

      // Filter out notifications targeted exclusively at another student
      if (
        studentId &&
        notif.targetStudentId &&
        notif.targetStudentId !== studentId
      ) {
        return
      }
      if (
        classNameFilter &&
        notif.targetClass &&
        notif.targetClass !== classNameFilter &&
        notif.type !== 'notice'
      ) {
        return
      }

      const lastToasted = window.sessionStorage.getItem(LAST_TOASTED_NOTIF_ID_KEY)
      if (lastToasted === notif.id) return
      window.sessionStorage.setItem(LAST_TOASTED_NOTIF_ID_KEY, notif.id)

      setActiveToast(notif)
      triggerSystemNotification(notif.title, notif.message)
    }

    window.addEventListener('ics-campus-notification', handleIncoming)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('ics-campus-notification', handleIncoming)
    }
  }, [studentId, classNameFilter])

  useEffect(() => {
    if (!activeToast) return
    const timeout = window.setTimeout(() => {
      setActiveToast(null)
    }, 9000)
    return () => window.clearTimeout(timeout)
  }, [activeToast])

  if (!activeToast || typeof document === 'undefined') return null

  const meta = getNotificationMeta(activeToast.type)
  const Icon = meta.Icon

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 top-[calc(max(var(--safe-top,0px),28px)+0.65rem)] z-[98] mx-auto max-w-lg animate-in fade-in slide-in-from-top-4 duration-300"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-lime/45 bg-[#081E21]/95 p-3.5 text-white shadow-2xl backdrop-blur-md">
        <div
          className={cn(
            'mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl',
            meta.iconClass,
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase',
                meta.badgeClass,
              )}
            >
              {meta.label}
            </span>
            <span className="text-[11px] text-white/65">
              {formatRelativeTime(activeToast.createdAtMs)}
            </span>
          </div>

          <p className="mt-1 text-xs font-bold leading-snug text-white sm:text-sm">
            {activeToast.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-white/80">
            {activeToast.message}
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            {activeToast.href && (
              <a
                href={activeToast.href}
                onClick={() => {
                  const read = loadReadIds()
                  read.add(activeToast.id)
                  saveReadIds(read)
                  setActiveToast(null)
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-lime px-2.5 py-1 text-[11px] font-bold text-slate-950 transition hover:bg-lime/90"
              >
                <span>View Details</span>
                <ExternalLink className="size-3" />
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                const read = loadReadIds()
                read.add(activeToast.id)
                saveReadIds(read)
                setActiveToast(null)
              }}
              className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/85 transition hover:bg-white/20 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveToast(null)}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-white/65 transition hover:bg-white/10 hover:text-white"
          aria-label="Close notification banner"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>,
    document.body,
  )
}

export function CampusNotificationBell({
  studentId,
  classNameFilter,
  className,
}: {
  studentId?: string
  classNameFilter?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<CampusNotification[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  const refreshNotifications = useCallback(() => {
    setNotifications(loadCampusNotifications())
    setReadIds(loadReadIds())
  }, [])

  useEffect(() => {
    refreshNotifications()
    window.addEventListener('ics-campus-notification', refreshNotifications)
    window.addEventListener('ics-notices-updated', refreshNotifications)
    window.addEventListener('ics-attendance-updated', refreshNotifications)
    window.addEventListener('ics-period-attendance-updated', refreshNotifications)
    window.addEventListener('ics-notifications-read-changed', refreshNotifications)
    window.addEventListener('storage', refreshNotifications)
    return () => {
      window.removeEventListener('ics-campus-notification', refreshNotifications)
      window.removeEventListener('ics-notices-updated', refreshNotifications)
      window.removeEventListener('ics-attendance-updated', refreshNotifications)
      window.removeEventListener('ics-period-attendance-updated', refreshNotifications)
      window.removeEventListener('ics-notifications-read-changed', refreshNotifications)
      window.removeEventListener('storage', refreshNotifications)
    }
  }, [refreshNotifications])

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (studentId && n.targetStudentId && n.targetStudentId !== studentId) {
        return false
      }
      if (
        classNameFilter &&
        n.targetClass &&
        n.targetClass !== classNameFilter &&
        n.type !== 'notice'
      ) {
        return false
      }
      return true
    })
  }, [notifications, studentId, classNameFilter])

  const unreadCount = useMemo(() => {
    return filteredNotifications.filter((n) => !readIds.has(n.id)).length
  }, [filteredNotifications, readIds])

  const markAllAsRead = useCallback(() => {
    const next = new Set(readIds)
    for (const n of filteredNotifications) {
      next.add(n.id)
    }
    setReadIds(next)
    saveReadIds(next)
  }, [filteredNotifications, readIds])

  const requestAndTestNotification = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        try {
          await Notification.requestPermission()
        } catch {
          // Ignore permission request error
        }
      }
    }
    const sample: CampusNotification = {
      id: `test_${Date.now()}`,
      type: 'notice',
      title: 'ICS Academy Live Notifications Active',
      message:
        'You will immediately receive notification bars for all Usthad announcements, holiday notices, and attendance updates.',
      actorName: 'ICS Academy Portal',
      href: '#notices',
      createdAt: new Date().toISOString(),
      createdAtMs: Date.now(),
    }
    window.dispatchEvent(
      new CustomEvent('ics-campus-notification', { detail: sample }),
    )
    setOpen(false)
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          pullCampusStateFromServer()
        }}
        title="Campus Announcements & Attendance Notifications"
        aria-label="Open notifications"
        className={cn(
          'relative inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card/80 text-foreground transition-colors hover:border-lime/50 hover:bg-muted',
          unreadCount > 0 && 'border-lime/50 bg-lime/10 text-lime',
          className,
        )}
      >
        {unreadCount > 0 ? (
          <BellRing className="size-4" aria-hidden="true" />
        ) : (
          <Bell className="size-4" aria-hidden="true" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex min-w-[18px] items-center justify-center rounded-full bg-lime px-1 py-0.5 text-[10px] font-extrabold leading-none text-slate-950 shadow">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="campus-notifications-title"
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4 pt-[max(1rem,var(--safe-top))] pb-6 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <div
              className="my-auto flex max-h-[calc(100dvh-2.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime/15 text-lime">
                    <BellRing className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h3
                      id="campus-notifications-title"
                      className="text-base font-bold text-foreground"
                    >
                      Notifications &amp; Alerts
                    </h3>
                    <p className="truncate text-xs text-muted-foreground">
                      Usthad Announcements &amp; Attendance Updates
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition hover:bg-muted"
                    >
                      <CheckCheck className="size-3.5 text-lime" />
                      <span>Mark read</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label="Close notifications"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 divide-y divide-border overflow-y-auto px-5 py-2">
                {filteredNotifications.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    No notifications yet.
                  </div>
                ) : (
                  filteredNotifications.map((item) => {
                    const meta = getNotificationMeta(item.type)
                    const Icon = meta.Icon
                    const isUnread = !readIds.has(item.id)

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'flex items-start gap-3.5 py-3.5 transition-colors',
                          isUnread && 'bg-lime/[0.04] -mx-2 px-2 rounded-xl',
                        )}
                      >
                        <div
                          className={cn(
                            'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl',
                            meta.iconClass,
                          )}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
                                meta.badgeClass,
                              )}
                            >
                              {meta.label}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {formatRelativeTime(item.createdAtMs)}
                            </span>
                          </div>

                          <p className="mt-1 text-xs font-bold text-foreground sm:text-sm">
                            {item.title}
                          </p>
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                            {item.message}
                          </p>

                          {item.href && (
                            <div className="mt-2">
                              <a
                                href={item.href}
                                onClick={() => {
                                  const next = new Set(readIds)
                                  next.add(item.id)
                                  setReadIds(next)
                                  saveReadIds(next)
                                  setOpen(false)
                                }}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-lime hover:underline"
                              >
                                <span>Open section</span>
                                <ExternalLink className="size-3" />
                              </a>
                            </div>
                          )}
                        </div>

                        {isUnread && (
                          <span
                            className="mt-2 size-2 shrink-0 rounded-full bg-lime"
                            aria-label="Unread"
                          />
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/20 px-5 py-3">
                <span className="text-[11px] text-muted-foreground">
                  Real-time alerts for notices &amp; attendance
                </span>
                <button
                  type="button"
                  onClick={requestAndTestNotification}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-lime/15 px-3 py-1.5 text-xs font-bold text-lime transition hover:bg-lime/25"
                >
                  <BellRing className="size-3.5" />
                  <span>Test Notification Bar</span>
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
