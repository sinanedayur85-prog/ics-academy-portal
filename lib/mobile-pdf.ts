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
  return typeof window !== 'undefined' && Boolean(window.ICSNativeBridge?.saveAndOpenFile);
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

export function playWhatsAppStyleNotificationTone(): void {
  if (typeof window === 'undefined') return;
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([180, 80, 180]);
    }
  } catch {
    // Ignore vibrate restrictions
  }

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Note 1 (pleasant WhatsApp-style marimba/chime pop)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.09); // A5
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.19);

    // Note 2 (higher harmonic confirmation note)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, now + 0.11); // D6
    gain2.gain.setValueAtTime(0.001, now + 0.11);
    gain2.gain.exponentialRampToValueAtTime(0.15, now + 0.13);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.11);
    osc2.stop(now + 0.35);

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 500);
  } catch {
    // AudioContext may be blocked before user interaction
  }
}

export function triggerSystemNotification(title: string, message: string): void {
  if (typeof window === 'undefined') return;

  playWhatsAppStyleNotificationTone();

  // 1. Native Android APK status-bar heads-up notification
  if (window.ICSNativeBridge?.showNotification) {
    try {
      window.ICSNativeBridge.showNotification(title, message);
      return;
    } catch {
      // Fallback below
    }
  }

  // 2. Web Notification API / Service Worker notification (Android Chrome, PWA, Tablet, Desktop)
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
          .then((reg) => {
            reg.showNotification(title, {
              body: message,
              icon: '/icons/icon-192.png',
              badge: '/icons/icon-192.png',
              tag: `ics-notif-${Date.now()}`,
            });
          })
          .catch(() => {
            new Notification(title, {
              body: message,
              icon: '/icons/icon-192.png',
            });
          });
      } else {
        new Notification(title, {
          body: message,
          icon: '/icons/icon-192.png',
        });
      }
    } catch {
      // Ignore notification errors
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
