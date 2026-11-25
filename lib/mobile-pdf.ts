'use client';

export interface ICSNativeBridgeInterface {
  saveAndOpenFile?: (
    base64Data: string,
    fileName: string,
    mimeType: string,
    action: 'download' | 'print' | 'share'
  ) => void;
  printCurrentPage?: (jobName: string) => void;
  setStatusBarTheme?: (isDark: boolean) => void;
  downloadAndInstallApk?: (apkUrl: string) => void;
  clearWebCacheAndReload?: () => void;
  showNotification?: (title: string, message: string) => void;
  showNotificationWithHref?: (title: string, message: string, href: string) => void;
  showChatNotification?: (
    title: string,
    message: string,
    href: string,
    senderId: string,
    senderAvatarUrl: string
  ) => void;
  clearNotifications?: () => void;
  peekPendingNotificationHref?: () => string;
  consumePendingNotificationHref?: () => string;
  syncNotificationIdentity?: (
    actorId: string,
    actorName: string,
    role: string,
    className: string,
    assignedClassesJson: string
  ) => void;
}

declare global {
  interface Window {
    ICSNativeBridge?: ICSNativeBridgeInterface;
    Capacitor?: {
      isNativePlatform?: () => boolean;
    };
  }
}

export function isAndroidNativeApp(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.ICSNativeBridge || window.Capacitor?.isNativePlatform?.())
  );
}

export function syncNativeAndroidNotificationIdentity(identity: {
  actorId: string;
  actorName: string;
  role: string;
  className: string;
  assignedClasses: string[];
}): void {
  if (typeof window === 'undefined') return;
  if (!identity.actorId) return;
  try {
    window.ICSNativeBridge?.syncNotificationIdentity?.(
      identity.actorId,
      identity.actorName || '',
      identity.role || 'student',
      identity.className || '',
      JSON.stringify(Array.isArray(identity.assignedClasses) ? identity.assignedClasses : []),
    );
  } catch {
    // Ignore on older APK builds without syncNotificationIdentity
  }
}

export interface ParsedNotificationTarget {
  href: string;
  baseHash: string;
  roomId?: string;
  callId?: string;
  callAction?: 'accept' | 'decline';
}

const PENDING_NOTIF_HREF_KEY = 'ics_pending_notif_href_v1';
const PENDING_NOTIF_TS_KEY = 'ics_pending_notif_ts_v1';
const PENDING_NOTIF_ROOM_KEY = 'ics_pending_notif_room_v1';

const VALID_NOTIFICATION_HASHES = new Set([
  'campus-chat',
  'notices',
  'usthad-notices',
  'attendance',
  'class-attendance',
  'usthad-attendance',
  'leave',
  'usthad-leave',
  'academic-hub',
  'timetable',
  'usthad-timetable',
  'digital-library',
  'library',
  'usthad-library',
  'usthad-kitabs',
  'university-portal',
  'gemini-chatbot',
  'class-roster',
]);

export function parseNotificationHref(rawHref?: string | null): ParsedNotificationTarget | null {
  if (!rawHref || typeof rawHref !== 'string') return null;
  let cleaned = rawHref.trim();
  if (!cleaned) return null;
  if (cleaned.startsWith('/#')) cleaned = cleaned.slice(1);
  if (!cleaned.startsWith('#')) {
    const hashIdx = cleaned.indexOf('#');
    if (hashIdx >= 0) {
      cleaned = cleaned.slice(hashIdx);
    } else {
      cleaned = `#${cleaned}`;
    }
  }
  const withoutHash = cleaned.slice(1);
  const qIdx = withoutHash.indexOf('?');
  const baseHash = (qIdx >= 0 ? withoutHash.slice(0, qIdx) : withoutHash).trim();
  if (!baseHash || !VALID_NOTIFICATION_HASHES.has(baseHash)) return null;

  let roomId: string | undefined;
  let callId: string | undefined;
  let callAction: 'accept' | 'decline' | undefined;
  if (qIdx >= 0) {
    try {
      const params = new URLSearchParams(withoutHash.slice(qIdx + 1));
      const rawRoom = params.get('room');
      if (rawRoom && /^[a-zA-Z0-9_-]{3,160}$/.test(rawRoom.trim())) {
        roomId = rawRoom.trim();
      }
      const rawCallId = params.get('callId');
      if (rawCallId && /^[a-zA-Z0-9_-]{4,96}$/.test(rawCallId.trim())) {
        callId = rawCallId.trim();
      }
      const rawCallAction = params.get('callAction');
      if (rawCallAction === 'accept' || rawCallAction === 'decline') {
        callAction = rawCallAction;
      }
    } catch {
      // Ignore malformed query string
    }
  }

  const queryParts: string[] = [];
  if (roomId) queryParts.push(`room=${encodeURIComponent(roomId)}`);
  if (callId) queryParts.push(`callId=${encodeURIComponent(callId)}`);
  if (callAction) queryParts.push(`callAction=${encodeURIComponent(callAction)}`);
  const normalizedHref = queryParts.length > 0 ? `#${baseHash}?${queryParts.join('&')}` : `#${baseHash}`;

  return {
    href: normalizedHref,
    baseHash,
    roomId,
    callId,
    callAction,
  };
}

export function peekPendingNotificationHref(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const nativeHref = window.ICSNativeBridge?.peekPendingNotificationHref?.();
    const parsedNative = parseNotificationHref(nativeHref);
    if (parsedNative) return parsedNative.href;
  } catch {
    // Ignore on older APKs
  }
  try {
    const saved = window.sessionStorage.getItem(PENDING_NOTIF_HREF_KEY);
    const savedTs = Number(window.sessionStorage.getItem(PENDING_NOTIF_TS_KEY) || '0');
    if (saved && Date.now() - savedTs < 60_000) {
      const parsedSaved = parseNotificationHref(saved);
      if (parsedSaved) return parsedSaved.href;
    }
  } catch {
    // Ignore
  }
  const parsedHash = parseNotificationHref(window.location.hash);
  if (parsedHash) return parsedHash.href;
  return null;
}

export function consumePendingNotificationHref(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const nativeHref = window.ICSNativeBridge?.consumePendingNotificationHref?.();
    const parsedNative = parseNotificationHref(nativeHref);
    if (parsedNative) return parsedNative.href;
  } catch {
    // Ignore on older APKs
  }
  try {
    const saved = window.sessionStorage.getItem(PENDING_NOTIF_HREF_KEY);
    const savedTs = Number(window.sessionStorage.getItem(PENDING_NOTIF_TS_KEY) || '0');
    window.sessionStorage.removeItem(PENDING_NOTIF_HREF_KEY);
    window.sessionStorage.removeItem(PENDING_NOTIF_TS_KEY);
    if (saved && Date.now() - savedTs < 60_000) {
      const parsedSaved = parseNotificationHref(saved);
      if (parsedSaved) return parsedSaved.href;
    }
  } catch {
    // Ignore
  }
  return null;
}

export function peekPendingNotificationChatRoomId(): string | null {
  if (typeof window === 'undefined') return null;
  const fromHash = parseNotificationHref(window.location.hash);
  if (fromHash?.baseHash === 'campus-chat' && fromHash.roomId) {
    return fromHash.roomId;
  }
  try {
    const raw = window.sessionStorage.getItem(PENDING_NOTIF_ROOM_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { roomId?: string; ts?: number };
      if (parsed?.roomId && Date.now() - (parsed.ts || 0) < 30_000) {
        return parsed.roomId;
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

export function clearPendingNotificationChatRoomId(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_NOTIF_ROOM_KEY);
  } catch {
    // Ignore
  }
}

export function dispatchNotificationNavigation(rawHref?: string | null): boolean {
  if (typeof window === 'undefined') return false;
  // Only deep-link directly into dashboard sections/chats when user is already logged in
  if (window.localStorage.getItem('isAuthenticated') !== 'true') {
    return false;
  }
  const parsed = parseNotificationHref(rawHref);
  if (!parsed) return false;

  try {
    window.sessionStorage.setItem(PENDING_NOTIF_HREF_KEY, parsed.href);
    window.sessionStorage.setItem(PENDING_NOTIF_TS_KEY, String(Date.now()));
    if (parsed.baseHash === 'campus-chat' && parsed.roomId) {
      window.sessionStorage.setItem(
        PENDING_NOTIF_ROOM_KEY,
        JSON.stringify({ roomId: parsed.roomId, ts: Date.now() }),
      );
    }
  } catch {
    // Ignore storage issues
  }

  try {
    if (window.location.hash !== parsed.href) {
      window.location.hash = parsed.href;
    }
  } catch {
    // Ignore hash error
  }

  window.dispatchEvent(new CustomEvent('ics-notification-navigate', { detail: parsed }));
  clearGroupedPhoneNotifications();
  return true;
}

export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Returns true ONLY when the portal is opened inside an installed mobile/tablet app
 * (Android APK, Capacitor native runtime, Android WebView, or installed standalone PWA on mobile/tablet).
 * Returns false on regular websites opened in a desktop or mobile browser.
 */
export function isInstalledApp(): boolean {
  if (typeof window === 'undefined') return false;
  if (Boolean(window.ICSNativeBridge)) return true;
  if (Boolean(window.Capacitor?.isNativePlatform?.())) return true;

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const isAndroidWebView = /;\s*wv\)/i.test(ua) || (/Android/i.test(ua) && /Version\/[\d.]+/i.test(ua) && !/Chrome\/[\d.]+\s+Mobile\s+Safari/i.test(ua));
  if (isAndroidWebView) return true;

  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    (typeof navigator !== 'undefined' && (navigator as unknown as { standalone?: boolean }).standalone === true);

  if (isStandalone && isMobileDevice()) return true;

  // Capacitor Android local server uses https://localhost on an Android device
  if (window.location.hostname === 'localhost' && /Android/i.test(ua)) {
    return true;
  }

  return false;
}

const GROUPED_NOTIFICATION_TAG = 'ics-academy-grouped-updates';
const GROUPED_QUEUE_STORAGE_KEY = 'ics_grouped_phone_notifs_v1';

interface QueuedPhoneNotificationItem {
  title: string;
  message: string;
  href: string;
  timestamp: number;
}

function loadQueuedPhoneNotifications(): QueuedPhoneNotificationItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(GROUPED_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedPhoneNotificationItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueuedPhoneNotifications(items: QueuedPhoneNotificationItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      GROUPED_QUEUE_STORAGE_KEY,
      JSON.stringify(items.slice(-12))
    );
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Clears the grouped phone notification list when the user opens Messenger or taps the notification,
 * so the next future batch of messages starts fresh and plays the phone's default notification sound once.
 */
export function clearGroupedPhoneNotifications(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(GROUPED_QUEUE_STORAGE_KEY);
  } catch {
    // Ignore
  }

  try {
    window.ICSNativeBridge?.clearNotifications?.();
  } catch {
    // Ignore
  }

  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => reg.getNotifications({ tag: GROUPED_NOTIFICATION_TAG }))
        .then((list) => {
          for (const n of list) {
            n.close();
          }
        })
        .catch(() => {});
    }
  } catch {
    // Ignore
  }
}

/**
 * Kept as a silent no-op so existing callers compile cleanly.
 * Custom in-app audio chimes are disabled per user preference; only the phone's
 * standard system notification sound is used on the first notification in a group.
 */
export function unlockNotificationAudio(): void {
  // No custom in-app sound
}

export function playWhatsAppStyleNotificationTone(): void {
  // No custom in-app sound
}

/**
 * Delivers notifications exclusively to the phone's system notification bar as a SINGLE grouped list.
 * - First notification in a batch: uses the phone's default system notification tone (`silent: false`, `onlyAlertOnce: true`).
 * - Subsequent notifications while unread items exist in the list: updates the same single notification card
 *   in-place with a consolidated multi-line list silently (`silent: true`, `renotify: false`).
 */
export function triggerSystemNotification(
  title: string,
  message: string,
  href = '#notices',
  meta?: {
    actorId?: string;
    actorAvatarUrl?: string;
  },
): void {
  if (typeof window === 'undefined') return;

  const cleanTitle = (title || 'ICS Academy')
    .replace(/^New\s+Message\s+from\s+/i, '')
    .trim() || 'ICS Academy';
  const cleanMessage = (message || '').trim();
  if (!cleanMessage && !cleanTitle) return;

  const safeHref = href || '#notices';
  const actorId = typeof meta?.actorId === 'string' ? meta.actorId.trim() : '';
  const rawAvatar = typeof meta?.actorAvatarUrl === 'string' ? meta.actorAvatarUrl.trim() : '';
  const safeAvatarUrl =
    rawAvatar &&
    rawAvatar.length <= 240 &&
    (rawAvatar.startsWith('/images/') ||
      rawAvatar.startsWith('/icons/') ||
      rawAvatar.startsWith('https://'))
      ? rawAvatar
      : '';

  const queue = loadQueuedPhoneNotifications();
  const isFirstInGroup = queue.length === 0;
  const nextQueue = [
    ...queue,
    {
      title: cleanTitle,
      message: cleanMessage,
      href: safeHref,
      timestamp: Date.now(),
    },
  ].slice(-10);
  saveQueuedPhoneNotifications(nextQueue);

  // 1. Native Android APK WhatsApp-style chat notification with real sender profile photo
  if (safeHref.startsWith('#campus-chat') && window.ICSNativeBridge?.showChatNotification) {
    try {
      window.ICSNativeBridge.showChatNotification(
        cleanTitle,
        cleanMessage,
        safeHref,
        actorId,
        safeAvatarUrl,
      );
      return;
    } catch {
      // Fallback below
    }
  }
  if (window.ICSNativeBridge?.showNotificationWithHref) {
    try {
      window.ICSNativeBridge.showNotificationWithHref(cleanTitle, cleanMessage, safeHref);
      return;
    } catch {
      // Fallback below
    }
  }
  if (window.ICSNativeBridge?.showNotification) {
    try {
      window.ICSNativeBridge.showNotification(cleanTitle, cleanMessage);
      return;
    } catch {
      // Fallback below
    }
  }

  // 2. Web Notification API / Service Worker notification (Android Chrome, iOS Home Screen PWA, Mobile Browser)
  if ('Notification' in window && Notification.permission === 'granted') {
    const groupedTitle =
      nextQueue.length === 1
        ? cleanTitle
        : `ICS Academy • ${nextQueue.length} New Updates`;

    const groupedBody =
      nextQueue.length === 1
        ? cleanMessage
        : nextQueue
            .map((item) => `• ${item.title}: ${item.message}`)
            .join('\n');

    const latestHref = nextQueue[nextQueue.length - 1]?.href || safeHref;
    const isDirectChat =
      safeHref.startsWith('#campus-chat') &&
      !safeHref.includes('batch_group__') &&
      !safeHref.includes('staff_group__') &&
      nextQueue.length === 1;

    const notifOptions: NotificationOptions & { renotify?: boolean } = {
      body: groupedBody,
      icon: isDirectChat && safeAvatarUrl ? safeAvatarUrl : '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: GROUPED_NOTIFICATION_TAG,
      renotify: isFirstInGroup,
      silent: !isFirstInGroup,
      data: { href: latestHref },
    };

    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
          .then((reg) => {
            reg.showNotification(groupedTitle, notifOptions);
          })
          .catch(() => {
            try {
              new Notification(groupedTitle, notifOptions);
            } catch {
              // Ignore if blocked
            }
          });
      } else {
        new Notification(groupedTitle, notifOptions);
      }
    } catch {
      // Ignore if blocked
    }
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const commaIdx = result.indexOf(',');
        resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
      } else {
        reject(new Error('Failed to convert Blob to Base64'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

function triggerAnchorDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Unified file download helper that works across:
 * 1. Android APK WebView (via window.ICSNativeBridge -> MediaStore.Downloads + FileProvider viewer)
 * 2. Mobile browsers / WebViews (via Web Share API file sheet + fallback anchor download)
 * 3. Desktop browsers (via standard <a download> click)
 */
export async function downloadBlobOnDevice(
  blob: Blob,
  fileName: string,
  mimeType = 'application/pdf'
): Promise<void> {
  const normalizedBlob = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });

  // 1. Native Android APK Bridge
  if (typeof window !== 'undefined' && window.ICSNativeBridge?.saveAndOpenFile) {
    try {
      const base64 = await blobToBase64(normalizedBlob);
      window.ICSNativeBridge.saveAndOpenFile(base64, fileName, mimeType, 'download');
      return;
    } catch (err) {
      console.error('Native APK bridge download failed, falling back:', err);
    }
  }

  // 2. Mobile Browser / WebView without native bridge
  if (isMobileDevice()) {
    try {
      const file = new File([normalizedBlob], fileName, { type: mimeType });
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        // Also trigger anchor download first for mobile browsers that support direct download
        triggerAnchorDownload(normalizedBlob, fileName);
        try {
          await navigator.share({
            files: [file],
            title: fileName,
          });
        } catch (shareErr: unknown) {
          // Ignore AbortError when user closes share sheet after downloading
          if (shareErr instanceof Error && shareErr.name === 'AbortError') {
            return;
          }
        }
        return;
      }
    } catch {
      // Fallback to anchor download below
    }
  }

  // 3. Standard Desktop / Fallback Download
  triggerAnchorDownload(normalizedBlob, fileName);
}

/**
 * Unified PDF print helper that works across:
 * 1. Android APK WebView (via window.ICSNativeBridge -> Android PrintManager with exact PDF document)
 * 2. Mobile browsers (via Web Share API sheet which offers "Print" / "Save" on Android & iOS)
 * 3. Desktop browsers (via fallbackWindowPrint or window.print())
 */
export async function printPdfBlobOnDevice(
  blob: Blob,
  fileName: string,
  fallbackWindowPrint?: () => void
): Promise<void> {
  const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });

  // 1. Native Android APK Bridge -> Native Android PrintManager
  if (typeof window !== 'undefined' && window.ICSNativeBridge?.saveAndOpenFile) {
    try {
      const base64 = await blobToBase64(pdfBlob);
      window.ICSNativeBridge.saveAndOpenFile(base64, fileName, 'application/pdf', 'print');
      return;
    } catch (err) {
      console.error('Native APK bridge print failed, falling back:', err);
    }
  }

  // 2. Mobile Browser / WebView without native bridge
  if (isMobileDevice()) {
    try {
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: fileName,
        });
        return;
      }
    } catch (shareErr: unknown) {
      if (shareErr instanceof Error && shareErr.name === 'AbortError') {
        return;
      }
    }
    // If Web Share isn't available on mobile, trigger download so user still gets the PDF
    triggerAnchorDownload(pdfBlob, fileName);
    return;
  }

  // 3. Desktop Browser -> window.print()
  if (fallbackWindowPrint) {
    fallbackWindowPrint();
  } else if (typeof window !== 'undefined') {
    window.print();
  }
}
