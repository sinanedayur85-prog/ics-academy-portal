'use client'

import { useEffect } from 'react'
import {
  getCurrentSessionIdentity,
  isNotificationVisibleForStudent,
  pullCampusStateFromServer,
  subscribeRealtimeCampusNotificationsAndDelivery,
  type CampusNotification,
} from '@/components/dashboard/data'
import {
  clearGroupedPhoneNotifications,
  triggerSystemNotification,
} from '@/lib/mobile-pdf'

const LAST_TOASTED_NOTIF_ID_KEY = 'ics_last_toasted_notif_id_v2'

function getScopeStorageSuffix(studentId?: string, classNameFilter?: string): string {
  const session = getCurrentSessionIdentity()
  const raw = studentId || session.actorId || classNameFilter || session.className || 'campus'
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
}

/**
 * Silent Background Notification Coordinator:
 * - Renders ZERO in-app notification popups or floating banners.
 * - Subscribes to real-time Firestore updates & chat delivery receipts (<200ms).
 * - Routes incoming notifications exclusively to the phone's system notification bar
 *   as a single grouped list (first item plays the phone's default notification sound;
 *   subsequent items silently append to the same notification list).
 */
export function CampusNotificationBar({
  studentId,
  classNameFilter,
}: {
  studentId?: string
  classNameFilter?: string
}) {
  useEffect(() => {
    function handleUserGesturePermissionRequest() {
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'default'
      ) {
        Notification.requestPermission().catch(() => {})
      }
    }
    window.addEventListener('click', handleUserGesturePermissionRequest, { passive: true })
    window.addEventListener('touchend', handleUserGesturePermissionRequest, { passive: true })
    window.addEventListener('keydown', handleUserGesturePermissionRequest, { passive: true })

    // Subscribe to real-time Firestore notifications & instant chat delivery receipts (<200ms)
    const unsubscribeRealtime = subscribeRealtimeCampusNotificationsAndDelivery(
      studentId,
      classNameFilter,
    )

    // Pull HTTP sync immediately + every 4 seconds as backup
    void pullCampusStateFromServer()
    const timer = window.setInterval(() => {
      void pullCampusStateFromServer()
    }, 4000)

    function handleWakeOrFocus() {
      if (document.visibilityState === 'visible') {
        void pullCampusStateFromServer()
      }
    }
    window.addEventListener('focus', handleWakeOrFocus)
    document.addEventListener('visibilitychange', handleWakeOrFocus)

    function handleServiceWorkerMessage(e: MessageEvent) {
      const data = e.data as { type?: string; href?: string } | null
      if (!data) return
      if (data.type === 'ICS_CLEAR_GROUPED_NOTIFICATIONS') {
        clearGroupedPhoneNotifications()
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
      window.clearInterval(timer)
      window.removeEventListener('click', handleUserGesturePermissionRequest)
      window.removeEventListener('touchend', handleUserGesturePermissionRequest)
      window.removeEventListener('keydown', handleUserGesturePermissionRequest)
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
 * In-app notification bell and modal are disabled per user preference.
 */
export function CampusNotificationBell(_props: {
  studentId?: string
  classNameFilter?: string
  className?: string
}) {
  return null
}
