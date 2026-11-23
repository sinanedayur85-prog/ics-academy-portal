'use client'

import { getCurrentSessionIdentity } from '@/components/dashboard/data'

export type PushSupportState =
  | 'subscribed'
  | 'ready'
  | 'denied'
  | 'ios-needs-home-screen'
  | 'unsupported'

export interface PushEnvironmentInfo {
  isIOS: boolean
  isAndroid: boolean
  isStandalone: boolean
  hasNotificationApi: boolean
  hasServiceWorker: boolean
  hasPushManager: boolean
  permission: NotificationPermission | 'unsupported'
}

const PUSH_SUB_OPT_OUT_KEY = 'ics_web_push_opt_out_v1'
const LAST_SYNCED_VAPID_KEY = 'ics_web_push_vapid_key_v1'

export function getPushEnvironmentInfo(): PushEnvironmentInfo {
  if (typeof window === 'undefined') {
    return {
      isIOS: false,
      isAndroid: false,
      isStandalone: false,
      hasNotificationApi: false,
      hasServiceWorker: false,
      hasPushManager: false,
      permission: 'unsupported',
    }
  }

  const ua = (window.navigator.userAgent || '').toLowerCase()
  const isIOS =
    /iphone|ipad|ipod/.test(ua) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
  const isAndroid = /android/.test(ua)
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    Boolean((window as unknown as { ICSNativeBridge?: unknown }).ICSNativeBridge)

  const hasNotificationApi = 'Notification' in window
  const hasServiceWorker = 'serviceWorker' in navigator
  const hasPushManager = 'PushManager' in window

  return {
    isIOS,
    isAndroid,
    isStandalone,
    hasNotificationApi,
    hasServiceWorker,
    hasPushManager,
    permission: hasNotificationApi ? Notification.permission : 'unsupported',
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const outputArray = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function getPushApiBases(): string[] {
  if (typeof window === 'undefined') return ['']
  const isCapacitorOrLocal =
    Boolean((window as unknown as { ICSNativeBridge?: unknown }).ICSNativeBridge) ||
    window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && /Android/i.test(navigator.userAgent))

  if (isCapacitorOrLocal) {
    return [
      'https://ais-pre-rhfqjrwneaewkmnanoof2j-896319436298.asia-east1.run.app',
      'https://ais-dev-rhfqjrwneaewkmnanoof2j-896319436298.asia-east1.run.app',
      '',
    ]
  }
  return ['']
}

async function fetchVapidPublicKey(): Promise<{ base: string; publicKey: string } | null> {
  for (const base of getPushApiBases()) {
    try {
      const res = await fetch(`${base}/api/push/vapid-public-key`, { cache: 'no-store' })
      if (!res.ok) continue
      const data = (await res.json()) as { ok?: boolean; publicKey?: string }
      if (data.ok && typeof data.publicKey === 'string' && data.publicKey.length > 20) {
        return { base, publicKey: data.publicKey }
      }
    } catch {
      // Try next base
    }
  }
  return null
}

function getNormalizedPortalRole(
  session: ReturnType<typeof getCurrentSessionIdentity>,
): 'student' | 'usthad' | 'principal' {
  if (session.isPrincipal || session.role === 'principal') return 'principal'
  if (session.isStaff || session.role === 'usthad') return 'usthad'
  return 'student'
}

export async function getActiveWebPushState(): Promise<{
  state: PushSupportState
  endpoint: string | null
  env: PushEnvironmentInfo
}> {
  const env = getPushEnvironmentInfo()

  if (env.isIOS && !env.isStandalone) {
    return { state: 'ios-needs-home-screen', endpoint: null, env }
  }

  if (!env.hasNotificationApi || !env.hasServiceWorker || !env.hasPushManager) {
    return { state: 'unsupported', endpoint: null, env }
  }

  if (env.permission === 'denied') {
    return { state: 'denied', endpoint: null, env }
  }

  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub && env.permission === 'granted') {
      return { state: 'subscribed', endpoint: sub.endpoint, env }
    }
  } catch {
    // Fall through to ready
  }

  return { state: 'ready', endpoint: null, env }
}

/**
 * Registers or re-syncs this device's Web Push subscription with the server for the currently signed-in
 * student / class leader / usthad / principal.
 * - When `requestPermission` is false (auto-sync on boot/login), it ONLY syncs if permission is already granted
 *   and the user has not explicitly opted out on this device.
 * - When `requestPermission` is true (triggered directly from a user tap — required on iOS 16.4+ PWA!),
 *   it prompts for Notification permission, subscribes with the VAPID public key, and binds the device.
 */
export async function syncWebPushSubscription(options?: {
  requestPermission?: boolean
  overrideActorId?: string
  overrideClassName?: string
}): Promise<{
  ok: boolean
  state: PushSupportState
  endpoint?: string
  error?: string
}> {
  const env = getPushEnvironmentInfo()

  if (env.isIOS && !env.isStandalone) {
    return { ok: false, state: 'ios-needs-home-screen' }
  }
  if (!env.hasNotificationApi || !env.hasServiceWorker || !env.hasPushManager) {
    return { ok: false, state: 'unsupported', error: 'Push notifications are not supported on this browser.' }
  }

  const requestPermission = Boolean(options?.requestPermission)
  if (requestPermission) {
    try {
      window.localStorage.removeItem(PUSH_SUB_OPT_OUT_KEY)
    } catch {
      // Ignore storage error
    }
  } else {
    try {
      if (window.localStorage.getItem(PUSH_SUB_OPT_OUT_KEY) === '1') {
        return { ok: false, state: 'ready' }
      }
    } catch {
      // Ignore
    }
  }

  let permission: NotificationPermission = Notification.permission
  if (permission === 'default' && requestPermission) {
    try {
      permission = await Notification.requestPermission()
    } catch {
      permission = Notification.permission
    }
  }

  if (permission === 'denied') {
    return {
      ok: false,
      state: 'denied',
      error: 'Notifications are blocked in your phone/browser settings. Please allow notifications for ICS Academy.',
    }
  }

  if (permission !== 'granted') {
    return { ok: false, state: 'ready' }
  }

  const session = getCurrentSessionIdentity()
  const effectiveActorId = (options?.overrideActorId || session.actorId || '').trim()
  if (!effectiveActorId) {
    return { ok: false, state: 'ready', error: 'Sign in first to enable notifications for your account.' }
  }

  const vapid = await fetchVapidPublicKey()
  if (!vapid) {
    return { ok: false, state: 'ready', error: 'Push service is temporarily unreachable.' }
  }

  try {
    let registration = await navigator.serviceWorker.getRegistration('/')
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
    }
    const readyReg = await navigator.serviceWorker.ready

    let subscription = await readyReg.pushManager.getSubscription()
    const previousVapid = (() => {
      try {
        return window.localStorage.getItem(LAST_SYNCED_VAPID_KEY) || ''
      } catch {
        return ''
      }
    })()

    // If server VAPID key changed (e.g. fresh container / rotated key), cleanly renew subscription
    if (subscription && previousVapid && previousVapid !== vapid.publicKey) {
      try {
        await subscription.unsubscribe()
      } catch {
        // Ignore unsubscribe error
      }
      subscription = null
    }

    if (!subscription) {
      subscription = await readyReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
      })
    }

    const subJson = subscription.toJSON()
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      return { ok: false, state: 'ready', error: 'Could not read push subscription keys.' }
    }

    const platform = env.isIOS
      ? env.isStandalone
        ? 'ios-pwa'
        : 'ios-web'
      : env.isAndroid
        ? env.isStandalone
          ? 'android-pwa'
          : 'android-web'
        : 'desktop-web'

    const res = await fetch(`${vapid.base}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: {
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          },
        },
        actorId: effectiveActorId,
        actorRole: getNormalizedPortalRole(session),
        actorName: session.actorName || 'Campus Member',
        className: options?.overrideClassName || session.className || '',
        assignedClasses: session.assignedClasses || [],
        platform,
      }),
    })

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { error?: string }
      return {
        ok: false,
        state: 'ready',
        error: errBody.error || 'Could not register device with notification server.',
      }
    }

    try {
      window.localStorage.setItem(LAST_SYNCED_VAPID_KEY, vapid.publicKey)
    } catch {
      // Ignore
    }

    window.dispatchEvent(new CustomEvent('ics-push-status-changed'))
    return { ok: true, state: 'subscribed', endpoint: subJson.endpoint }
  } catch (err) {
    return {
      ok: false,
      state: 'ready',
      error: err instanceof Error ? err.message : 'Failed to enable push notifications.',
    }
  }
}

export async function disableWebPushSubscription(): Promise<boolean> {
  try {
    window.localStorage.setItem(PUSH_SUB_OPT_OUT_KEY, '1')
  } catch {
    // Ignore
  }
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      const endpoint = sub.endpoint
      for (const base of getPushApiBases()) {
        try {
          await fetch(`${base}/api/push/unsubscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint }),
          })
          break
        } catch {
          // Try next base
        }
      }
      await sub.unsubscribe()
    }
    window.dispatchEvent(new CustomEvent('ics-push-status-changed'))
    return true
  } catch {
    return false
  }
}

export async function sendTestWebPushNotification(): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { ok: false, error: 'Service Worker unavailable.' }
  }
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) {
      return { ok: false, error: 'Please enable notifications first.' }
    }
    for (const base of getPushApiBases()) {
      try {
        const res = await fetch(`${base}/api/push/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        if (res.ok) {
          const data = (await res.json()) as { ok?: boolean }
          return { ok: Boolean(data.ok) }
        }
        const errData = (await res.json().catch(() => ({}))) as { error?: string }
        return { ok: false, error: errData.error || 'Could not deliver test alert.' }
      } catch {
        // Try next base
      }
    }
    return { ok: false, error: 'Push server unreachable.' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Test failed.' }
  }
}
