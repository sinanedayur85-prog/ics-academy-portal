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
}

declare global {
  interface Window {
    ICSNativeBridge?: ICSNativeBridgeInterface;
  }
}

export function isAndroidNativeApp(): boolean {
  return typeof window !== 'undefined' && Boolean(window.ICSNativeBridge?.saveAndOpenFile);
}

export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
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
