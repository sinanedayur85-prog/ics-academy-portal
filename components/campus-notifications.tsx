'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  Download,
  Send,
  Share,
  Smartphone,
  X,
} from 'lucide-react'
import {
  getCurrentSessionIdentity,
  isNotificationVisibleForStudent,
  pullCampusStateFromServer,
  subscribeRealtimeCampusNotificationsAndDelivery,
  type CampusNotification,
} from '@/components/dashboard/data'
import {
  clearGroupedPhoneNotifications,
  isAndroidNativeApp,
  syncNativeAndroidNotificationIdentity,
  triggerSystemNotification,
} from '@/lib/mobile-pdf'
import {
  disableWebPushSubscription,
  getActiveWebPushState,
  prefetchVapidPublicKey,
  sendTestWebPushNotification,
  syncWebPushSubscription,
  type PushSupportState,
} from '@/lib/web-push-client'
import { cn } from '@/lib/utils'

const LAST_TOASTED_NOTIF_ID_KEY = 'ics_last_toasted_notif_id_v2'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function getScopeStorageSuffix(studentId?: string, classNameFilter?: string): string {
  const session = getCurrentSessionIdentity()
  const raw = studentId || session.actorId || classNameFilter || session.className || 'campus'
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
}

/**
 * Silent Background Notification & Real-Time Web Push Coordinator:
 * - Automatically binds this phone's Web Push subscription (Android Chrome/PWA & iOS 16.4+ Add to Home Screen)
 *   to the signed-in student / class leader / usthad / principal so closed-app push notifications reach exact recipients.
 * - Subscribes to real-time updates & routes foreground notifications to the system notification bar cleanly.
 */
export function CampusNotificationBar({
  studentId,
  classNameFilter,
}: {
  studentId?: string
  classNameFilter?: string
}) {
  useEffect(() => {
    const syncAndroidIdentityNow = () => {
      const currentSession = getCurrentSessionIdentity()
      const resolvedActorId = (studentId || currentSession.actorId || '').trim()
      if (!resolvedActorId) return
      syncNativeAndroidNotificationIdentity({
        actorId: resolvedActorId,
        actorName: currentSession.actorName || '',
        role: currentSession.isPrincipal
          ? 'principal'
          : currentSession.isStaff
            ? 'usthad'
            : 'student',
        className: classNameFilter || currentSession.className || '',
        assignedClasses: currentSession.assignedClasses || [],
      })
    }

    // Sync signed-in identity to Native Android APK FCM & background notification service (zero user clicks needed)
    syncAndroidIdentityNow()
    const androidSyncRetry = window.setTimeout(syncAndroidIdentityNow, 1500)

    // Auto-sync Web Push subscription silently if Notification permission is already granted (iPhone Home Screen PWA & Web)
    if (!isAndroidNativeApp()) {
      void syncWebPushSubscription({
        requestPermission: false,
        overrideActorId: studentId,
        overrideClassName: classNameFilter,
      })
    }

    // Clear iOS/Android app icon badge when the user opens the app
    try {
      const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> }
      if (typeof nav.clearAppBadge === 'function') {
        void nav.clearAppBadge().catch(() => {})
      }
    } catch {
      // Ignore badge unsupported
    }

    // Subscribe to real-time Firestore notifications
    const unsubscribeRealtime = subscribeRealtimeCampusNotificationsAndDelivery(
      studentId,
      classNameFilter,
    )

    // Pull HTTP sync immediately + every 6 seconds while tab is visible (pauses when hidden to save battery)
    void pullCampusStateFromServer()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void pullCampusStateFromServer()
      }
    }, 6000)

    function handleWakeOrFocus() {
      if (document.visibilityState === 'visible') {
        syncAndroidIdentityNow()
        void pullCampusStateFromServer()
        if (!isAndroidNativeApp()) {
          void syncWebPushSubscription({
            requestPermission: false,
            overrideActorId: studentId,
            overrideClassName: classNameFilter,
          })
        }
        try {
          const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> }
          if (typeof nav.clearAppBadge === 'function') {
            void nav.clearAppBadge().catch(() => {})
          }
        } catch {
          // Ignore
        }
      }
    }
    window.addEventListener('focus', handleWakeOrFocus)
    document.addEventListener('visibilitychange', handleWakeOrFocus)

    function handleServiceWorkerMessage(e: MessageEvent) {
      const data = e.data as {
        type?: string
        href?: string
        notificationId?: string
      } | null
      if (!data) return
      if (data.type === 'ICS_CLEAR_GROUPED_NOTIFICATIONS') {
        clearGroupedPhoneNotifications()
      } else if (data.type === 'ICS_PUSH_RECEIVED') {
        if (data.notificationId) {
          const toastKey = `${LAST_TOASTED_NOTIF_ID_KEY}_${getScopeStorageSuffix(studentId, classNameFilter)}`
          window.sessionStorage.setItem(toastKey, data.notificationId)
        }
        void pullCampusStateFromServer()
      } else if (data.type === 'ICS_NAVIGATE_HASH' && data.href) {
        try {
          window.location.hash = data.href
        } catch {
          // Ignore
        }
      }
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)
    }

    function handleIncoming(e: Event) {
      const custom = e as CustomEvent<CampusNotification>
      const notif = custom.detail
      if (!notif || !notif.id) return

      // Strictly enforce personal student, recipient & batch visibility rules
      if (!isNotificationVisibleForStudent(notif, studentId, classNameFilter)) {
        return
      }

      const toastKey = `${LAST_TOASTED_NOTIF_ID_KEY}_${getScopeStorageSuffix(studentId, classNameFilter)}`
      const lastToasted = window.sessionStorage.getItem(toastKey)
      if (lastToasted === notif.id) return
      window.sessionStorage.setItem(toastKey, notif.id)

      // Skip phone notification if user currently has that exact chat open in foreground
      const activeChatOpen =
        document.visibilityState === 'visible' &&
        document.body.dataset.icsActiveChatVisible === 'true'
      const activePeerId = document.body.dataset.icsActiveChatPeer || ''
      const activeRoomType = document.body.dataset.icsActiveChatType || ''
      const activeRoomBatch = document.body.dataset.icsActiveChatBatch || ''
      const isViewingSameChatRoom =
        activeChatOpen &&
        notif.type === 'chat' &&
        ((notif.targetRecipientId && notif.actorId && notif.actorId === activePeerId) ||
          (notif.targetStaffOnly && activeRoomType === 'staff_group') ||
          (notif.targetClass &&
            activeRoomType === 'batch_group' &&
            notif.targetClass === activeRoomBatch))

      if (isViewingSameChatRoom) {
        clearGroupedPhoneNotifications()
        return
      }

      triggerSystemNotification(notif.title, notif.message, notif.href)
    }

    window.addEventListener('ics-campus-notification', handleIncoming)
    return () => {
      unsubscribeRealtime()
      window.clearTimeout(androidSyncRetry)
      window.clearInterval(timer)
      window.removeEventListener('focus', handleWakeOrFocus)
      document.removeEventListener('visibilitychange', handleWakeOrFocus)
      window.removeEventListener('ics-campus-notification', handleIncoming)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
      }
    }
  }, [studentId, classNameFilter])

  return null
}

/**
 * Compact Header Push Notification & PWA Install Control:
 * - Portals its modal to document.body so sticky header backdrop-blur never traps or clips it on iOS/Android.
 * - Pre-fetches the VAPID public key when opened so iPhone iOS 16.4+ keeps the user tap gesture intact.
 */
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
  const [isNativeApk, setIsNativeApk] = useState(false)
  const [pushState, setPushState] = useState<PushSupportState>('ready')
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [testBusy, setTestBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null,
  )
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  const refreshState = useCallback(async () => {
    if (isAndroidNativeApp()) {
      setIsNativeApk(true)
      return
    }
    const info = await getActiveWebPushState()
    setPushState(info.state)
    setIsIOS(info.env.isIOS)
    setIsStandalone(info.env.isStandalone)
  }, [])

  useEffect(() => {
    void refreshState()
    const onStatusChange = () => {
      void refreshState()
    }
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    const onAppInstalled = () => {
      setDeferredPrompt(null)
      setIsStandalone(true)
    }

    window.addEventListener('ics-push-status-changed', onStatusChange)
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('ics-push-status-changed', onStatusChange)
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [refreshState])

  const session = getCurrentSessionIdentity()
  const ownerLabel = session.actorName || 'Your Account'
  const ownerSub = classNameFilter || session.className || (session.isPrincipal ? 'Principal' : '')

  const handleEnablePush = async () => {
    setBusy(true)
    setFeedback(null)
    const res = await syncWebPushSubscription({
      requestPermission: true,
      overrideActorId: studentId,
      overrideClassName: classNameFilter,
    })
    setPushState(res.state)
    if (res.ok) {
      setFeedback({
        kind: 'success',
        text: 'Real-time background notifications are now active on this device.',
      })
    } else if (res.error) {
      setFeedback({ kind: 'error', text: res.error })
    }
    setBusy(false)
  }

  const handleDisablePush = async () => {
    setBusy(true)
    setFeedback(null)
    await disableWebPushSubscription()
    await refreshState()
    setFeedback({
      kind: 'success',
      text: 'Background notifications paused on this device.',
    })
    setBusy(false)
  }

  const handleSendTest = async () => {
    setTestBusy(true)
    setFeedback(null)
    const res = await sendTestWebPushNotification()
    if (res.ok) {
      setFeedback({
        kind: 'success',
        text: 'Test push sent! Check your phone notification bar.',
      })
    } else {
      setFeedback({
        kind: 'error',
        text: res.error || 'Could not send test alert right now.',
      })
    }
    setTestBusy(false)
  }

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
      setIsStandalone(true)
    }
  }

  // Inside the GitHub Android APK, notifications are managed automatically via the native Android
  // bridge + background service — keep the header completely clean with no Bell button.
  if (isNativeApk || isAndroidNativeApp()) {
    return null
  }

  const isSubscribed = pushState === 'subscribed'
  const needsSetup = pushState === 'ready' || pushState === 'ios-needs-home-screen'

  const modalNode =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Real-Time Notifications"
              className="w-full max-w-md max-h-[85dvh] overflow-y-auto rounded-3xl border border-border/70 bg-card p-5 text-card-foreground shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-2xl',
                      isSubscribed
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : 'bg-[#0095F6]/15 text-[#0095F6]',
                    )}
                  >
                    {isSubscribed ? (
                      <BellRing className="size-5" />
                    ) : (
                      <Bell className="size-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold leading-tight">
                      Real-Time Notifications
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {ownerLabel}
                      {ownerSub ? ` · ${ownerSub}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {pushState === 'ios-needs-home-screen' ? (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-relaxed">
                    <div className="flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
                      <Smartphone className="size-4 shrink-0" />
                      <span>Add ICS Academy to iPhone Home Screen First</span>
                    </div>
                    <p className="mt-1.5 text-foreground/85">
                      On iPhone (iOS 16.4+), real-time notifications when the app is closed work
                      only after adding the app to your Home Screen:
                    </p>
                    <ol className="mt-2.5 space-y-1.5 pl-4 list-decimal text-foreground/90">
                      <li>
                        Tap the{' '}
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <Share className="inline size-3.5" /> Share
                        </span>{' '}
                        button in Safari.
                      </li>
                      <li>
                        Scroll down and tap <strong>Add to Home Screen</strong>, then{' '}
                        <strong>Add</strong>.
                      </li>
                      <li>
                        Open <strong>ICS Academy</strong> from your Home Screen and tap this Bell
                        icon to turn on alerts.
                      </li>
                    </ol>
                  </div>
                ) : isSubscribed ? (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-4 shrink-0" />
                      <span>Active on This Device</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-foreground/80">
                      Notices, chats, calls, attendance, leave, unit test and syllabus updates
                      targeted to your account will arrive in real time—even when the app is closed.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={testBusy}
                        onClick={() => void handleSendTest()}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <Send className="size-3.5" />
                        {testBusy ? 'Sending...' : 'Send Test Alert'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDisablePush()}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-60"
                      >
                        <BellOff className="size-3.5" />
                        Turn Off
                      </button>
                    </div>
                  </div>
                ) : pushState === 'denied' ? (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs leading-relaxed text-foreground/90">
                    <p className="font-semibold text-rose-600 dark:text-rose-400">
                      Notifications Blocked in Device Settings
                    </p>
                    <p className="mt-1">
                      Open your phone&apos;s Browser / App Settings → Notifications → allow{' '}
                      <strong>ICS Academy</strong>, then return here and tap Enable.
                    </p>
                  </div>
                ) : pushState === 'unsupported' ? (
                  <div className="rounded-2xl border border-border bg-muted/50 p-4 text-xs leading-relaxed text-muted-foreground">
                    This browser does not support background Web Push. On Android use Chrome and
                    install the app; on iPhone use Safari → Share → Add to Home Screen (iOS 16.4+).
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[#0095F6]/25 bg-[#0095F6]/8 p-4">
                    <p className="text-xs leading-relaxed text-foreground/85">
                      Receive instant alerts on your phone—even when ICS Academy is closed—for
                      messages, calls, class notices, attendance, leave updates, monthly tests and
                      syllabus changes meant specifically for you.
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleEnablePush()}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0095F6] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0081d6] active:scale-[0.98] disabled:opacity-60"
                    >
                      <BellRing className="size-4" />
                      {busy ? 'Enabling...' : 'Enable Real-Time Notifications'}
                    </button>
                  </div>
                )}

                {!isStandalone && deferredPrompt && (
                  <button
                    type="button"
                    onClick={() => void handleInstallPwa()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-muted/60 px-4 py-2.5 text-xs font-semibold text-foreground transition hover:bg-muted"
                  >
                    <Download className="size-4 text-[#0095F6]" />
                    Install ICS Academy App on Home Screen
                  </button>
                )}

                {!isStandalone && !isIOS && !deferredPrompt && (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Tip: For the best Android experience, tap Chrome menu (⋮) →{' '}
                    <strong>Add to Home screen / Install app</strong>.
                  </p>
                )}

                {feedback && (
                  <div
                    className={cn(
                      'rounded-xl px-3.5 py-2.5 text-xs font-medium',
                      feedback.kind === 'success'
                        ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
                    )}
                  >
                    {feedback.text}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFeedback(null)
          void refreshState()
          void prefetchVapidPublicKey()
          setOpen(true)
        }}
        title={
          isSubscribed
            ? 'Real-time Push Notifications Active'
            : 'Enable Real-Time Push Notifications'
        }
        aria-label="Notification Settings"
        className={cn(
          'relative flex size-8 sm:size-9 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground/80 transition-colors hover:bg-muted hover:text-foreground active:scale-95',
          className,
        )}
      >
        {isSubscribed ? (
          <BellRing className="size-4 text-emerald-500" aria-hidden="true" />
        ) : pushState === 'denied' ? (
          <BellOff className="size-4 text-rose-500" aria-hidden="true" />
        ) : (
          <Bell className="size-4" aria-hidden="true" />
        )}
        {isSubscribed && (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-emerald-500 ring-2 ring-background" />
        )}
        {needsSetup && (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[#0095F6] ring-2 ring-background animate-pulse" />
        )}
      </button>

      {modalNode}
    </>
  )
}
