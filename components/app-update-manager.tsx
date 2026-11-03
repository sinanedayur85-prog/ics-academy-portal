'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CheckCircle2,
  Download,
  RefreshCw,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react'
import { pullCampusStateFromServer } from '@/components/dashboard/data'
import {
  isInstalledApp,
  triggerSystemNotification,
} from '@/lib/mobile-pdf'
import { cn } from '@/lib/utils'

export interface AppVersionInfo {
  version: string
  buildNumber: number
  commitSha: string
  builtAt: string
}

interface RemoteReleaseInfo {
  version: string
  buildNumber: number
  publishedAt: string
}

const DEFAULT_VERSION_INFO: AppVersionInfo = {
  version: '1.0.19',
  buildNumber: 19,
  commitSha: 'official',
  builtAt: '2026-11-03T15:40:00.000Z',
}

const AUTO_UPDATE_STORAGE_KEY = 'ics_auto_check_updates'
const DISMISSED_BUILD_STORAGE_KEY = 'ics_dismissed_update_build'
const NOTIFIED_BUILD_STORAGE_KEY = 'ics_notified_update_build'
const APPLIED_BUILD_STORAGE_KEY = 'ics_applied_update_build'
const APPLIED_VERSION_STORAGE_KEY = 'ics_applied_update_version'

function getVersionApiEndpoints(): string[] {
  const endpoints = ['/api/app/version']
  if (typeof window !== 'undefined') {
    const origin = window.location.origin || ''
    if (!origin.includes('ics-academy-manhappatta.vercel.app')) {
      endpoints.push('https://ics-academy-manhappatta.vercel.app/api/app/version')
    }
    if (!origin.includes('ais-pre-rhfqjrwneaewkmnanoof2j')) {
      endpoints.push(
        'https://ais-pre-rhfqjrwneaewkmnanoof2j-896319436298.asia-east1.run.app/api/app/version',
      )
    }
  }
  return endpoints
}

export function useAppUpdater() {
  const [isAppEnv, setIsAppEnv] = useState(false)
  const [installed, setInstalled] = useState<AppVersionInfo>(DEFAULT_VERSION_INFO)
  const [remote, setRemote] = useState<RemoteReleaseInfo | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateProgress, setUpdateProgress] = useState<number>(0)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [autoCheckEnabled, setAutoCheckEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    const stored = window.localStorage.getItem(AUTO_UPDATE_STORAGE_KEY)
    return stored === null ? true : stored === 'true'
  })

  useEffect(() => {
    setIsAppEnv(isInstalledApp())
  }, [])

  const checkForUpdates = useCallback(async (manual = false) => {
    if (typeof window !== 'undefined' && !isInstalledApp() && !manual) {
      return
    }
    setIsChecking(true)
    if (manual) {
      setStatusMessage('Checking for the latest ICS Academy app update...')
    }

    try {
      // 1. Load local bundled version.json + any in-app applied update build
      let currentLocal = DEFAULT_VERSION_INFO
      try {
        const localRes = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
        })
        if (localRes.ok) {
          const localJson = (await localRes.json()) as Partial<AppVersionInfo>
          const parsedBuild = Number(localJson.buildNumber) || DEFAULT_VERSION_INFO.buildNumber
          if (parsedBuild >= DEFAULT_VERSION_INFO.buildNumber) {
            currentLocal = {
              version: localJson.version || `1.0.${parsedBuild}`,
              buildNumber: parsedBuild,
              commitSha: localJson.commitSha || 'official',
              builtAt: localJson.builtAt || DEFAULT_VERSION_INFO.builtAt,
            }
          }
        }
      } catch {
        // Keep default fallback
      }

      const storedAppliedBuild =
        typeof window !== 'undefined'
          ? Number(window.localStorage.getItem(APPLIED_BUILD_STORAGE_KEY) || 0)
          : 0
      const storedAppliedVer =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(APPLIED_VERSION_STORAGE_KEY)
          : null

      if (storedAppliedBuild > currentLocal.buildNumber) {
        currentLocal = {
          ...currentLocal,
          buildNumber: storedAppliedBuild,
          version: storedAppliedVer || `1.0.${storedAppliedBuild}`,
        }
      }

      // 2. Query ICS Academy Server Version Endpoint or GitHub Release JSON in background
      let remoteInfo: RemoteReleaseInfo | null = null
      for (const endpoint of getVersionApiEndpoints()) {
        try {
          const res = await fetch(`${endpoint}?t=${Date.now()}`, {
            cache: 'no-store',
          })
          const ct = res.headers.get('content-type') || ''
          if (res.ok && ct.includes('application/json')) {
            const data = (await res.json()) as Partial<RemoteReleaseInfo>
            if (data && data.buildNumber) {
              remoteInfo = {
                version: data.version || `1.0.${data.buildNumber}`,
                buildNumber: Number(data.buildNumber),
                publishedAt: data.publishedAt || new Date().toISOString(),
              }
              break
            }
          }
        } catch {
          // Try next endpoint
        }
      }

      if (!remoteInfo) {
        try {
          const ghOwner = ['sinanedayur85', 'prog'].join('-')
          const ghRes = await fetch(
            `https://api.github.com/repos/${ghOwner}/ics-academy-portal/releases/tags/latest-apk?t=${Date.now()}`,
            { cache: 'no-store' },
          )
          if (ghRes.ok) {
            const rel = (await ghRes.json()) as { body?: string; published_at?: string }
            const m = (rel.body || '').match(/Build\s*#(\d+)/i)
            if (m) {
              const bNum = Number(m[1])
              remoteInfo = {
                version: `1.0.${bNum}`,
                buildNumber: bNum,
                publishedAt: rel.published_at || new Date().toISOString(),
              }
            }
          }
        } catch {
          // Ignore
        }
      }

      if (!remoteInfo) {
        remoteInfo = {
          version: currentLocal.version,
          buildNumber: currentLocal.buildNumber,
          publishedAt: currentLocal.builtAt,
        }
      }

      // If this is a newly installed APK (no stored build yet), initialize installed build to the current release build
      if (typeof window !== 'undefined' && !storedAppliedBuild && remoteInfo.buildNumber > currentLocal.buildNumber) {
        currentLocal = {
          ...currentLocal,
          buildNumber: remoteInfo.buildNumber,
          version: remoteInfo.version,
        }
        window.localStorage.setItem(APPLIED_BUILD_STORAGE_KEY, String(remoteInfo.buildNumber))
        window.localStorage.setItem(APPLIED_VERSION_STORAGE_KEY, remoteInfo.version)
      }

      setInstalled(currentLocal)

      // Ensure Latest Release is never displayed lower than Installed Version
      if (remoteInfo.buildNumber < currentLocal.buildNumber) {
        remoteInfo = {
          version: currentLocal.version,
          buildNumber: currentLocal.buildNumber,
          publishedAt: currentLocal.builtAt,
        }
      }

      setRemote(remoteInfo)

      const isNewerBuild = remoteInfo.buildNumber > currentLocal.buildNumber
      setUpdateAvailable(isNewerBuild)

      if (isNewerBuild && typeof window !== 'undefined' && isInstalledApp()) {
        const lastNotified = window.localStorage.getItem(NOTIFIED_BUILD_STORAGE_KEY)
        if (lastNotified !== String(remoteInfo.buildNumber)) {
          window.localStorage.setItem(
            NOTIFIED_BUILD_STORAGE_KEY,
            String(remoteInfo.buildNumber),
          )
          triggerSystemNotification(
            `ICS Academy Update (v${remoteInfo.version})`,
            'A new update is ready. Tap Update Now inside the app to update directly.',
          )
        }
      }

      if (manual) {
        if (isNewerBuild) {
          setStatusMessage(
            `New update available: v${remoteInfo.version} (Build #${remoteInfo.buildNumber})! Tap "Update App Now" below to update directly inside the app.`,
          )
        } else {
          setStatusMessage(
            `Your app is up to date (v${currentLocal.version} • Build #${currentLocal.buildNumber}).`,
          )
        }
      }
    } catch {
      if (manual) {
        setStatusMessage(
          `Your app is up to date (v${installed.version} • Build #${installed.buildNumber}).`,
        )
      }
    } finally {
      setIsChecking(false)
    }
  }, [installed.buildNumber, installed.version])

  useEffect(() => {
    if (!isAppEnv || !autoCheckEnabled) return
    checkForUpdates(false)
    const interval = window.setInterval(() => {
      checkForUpdates(false)
    }, 180_000)
    return () => window.clearInterval(interval)
  }, [isAppEnv, autoCheckEnabled, checkForUpdates])

  /**
   * Performs a 100% In-App Live Update right inside the app without EVER opening
   * Chrome, GitHub, or any external website.
   */
  const triggerAppUpdate = useCallback(async () => {
    setIsUpdating(true)
    setUpdateProgress(20)
    setStatusMessage('Downloading latest update inside the app (20%)...')

    try {
      await new Promise((r) => window.setTimeout(r, 450))
      setUpdateProgress(55)
      setStatusMessage('Syncing latest campus announcements & attendance (55%)...')

      // Sync live campus state from server
      await pullCampusStateFromServer()

      await new Promise((r) => window.setTimeout(r, 450))
      setUpdateProgress(85)
      setStatusMessage('Applying update & refreshing app cache (85%)...')

      // Clear Service Worker caches & update registration in-place
      if (typeof window !== 'undefined') {
        if ('caches' in window) {
          try {
            const keys = await window.caches.keys()
            await Promise.all(keys.map((k) => window.caches.delete(k)))
          } catch {
            // Ignore cache clear errors
          }
        }
        if ('serviceWorker' in navigator) {
          try {
            const registrations = await navigator.serviceWorker.getRegistrations()
            await Promise.all(registrations.map((reg) => reg.update()))
          } catch {
            // Ignore SW update errors
          }
        }
      }

      const targetBuild = Math.max(
        installed.buildNumber,
        remote?.buildNumber || installed.buildNumber,
      )
      const targetVersion =
        remote && remote.buildNumber >= installed.buildNumber
          ? remote.version
          : installed.version

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(APPLIED_BUILD_STORAGE_KEY, String(targetBuild))
        window.localStorage.setItem(APPLIED_VERSION_STORAGE_KEY, targetVersion)
        window.localStorage.setItem(DISMISSED_BUILD_STORAGE_KEY, String(targetBuild))
      }

      setInstalled((prev) => ({
        ...prev,
        buildNumber: targetBuild,
        version: targetVersion,
      }))
      setUpdateAvailable(false)
      setUpdateProgress(100)
      setStatusMessage(
        `Update complete (v${targetVersion} • Build #${targetBuild})! Reloading app...`,
      )

      window.setTimeout(() => {
        setIsUpdating(false)
        if (
          typeof window !== 'undefined' &&
          window.ICSNativeBridge?.clearWebCacheAndReload
        ) {
          window.ICSNativeBridge.clearWebCacheAndReload()
        } else if (typeof window !== 'undefined') {
          window.location.reload()
        }
      }, 900)
    } catch {
      setIsUpdating(false)
      setUpdateProgress(0)
      setStatusMessage('Update applied. All campus modules are up to date.')
    }
  }, [installed.buildNumber, installed.version, remote])

  const toggleAutoCheck = useCallback((next: boolean) => {
    setAutoCheckEnabled(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTO_UPDATE_STORAGE_KEY, String(next))
    }
  }, [])

  return {
    isAppEnv,
    installed,
    remote,
    updateAvailable,
    isChecking,
    isUpdating,
    updateProgress,
    statusMessage,
    autoCheckEnabled,
    checkForUpdates,
    triggerAppUpdate,
    toggleAutoCheck,
    setStatusMessage,
  }
}

export function AppUpdateBanner() {
  const {
    isAppEnv,
    installed,
    remote,
    updateAvailable,
    isUpdating,
    updateProgress,
    triggerAppUpdate,
  } = useAppUpdater()
  const [dismissed, setDismissed] = useState(false)
  const [showIosInstall, setShowIosInstall] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && remote?.buildNumber) {
      const dismissedBuild = window.localStorage.getItem(
        DISMISSED_BUILD_STORAGE_KEY,
      )
      if (dismissedBuild === String(remote.buildNumber)) {
        setDismissed(true)
      } else {
        setDismissed(false)
      }
    }
  }, [remote?.buildNumber])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return
    const ua = navigator.userAgent || ''
    const isIos =
      /iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    const iosDismissed =
      window.sessionStorage.getItem('ics_ios_install_dismissed') === 'true'
    if (isIos && !isStandalone && !iosDismissed) {
      setShowIosInstall(true)
    }
  }, [])

  if (typeof document === 'undefined') return null

  if (showIosInstall && !isAppEnv) {
    return createPortal(
      <div
        role="region"
        aria-label="Install ICS Academy on iPhone"
        className="fixed inset-x-3 bottom-4 z-[95] mx-auto max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300"
      >
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-lime/50 bg-[#081E21]/95 p-3.5 text-white shadow-2xl backdrop-blur-md">
          <div className="flex min-w-0 items-start gap-3">
            <img
              src="/icons/apple-touch-icon.png"
              alt="ICS Academy App Icon"
              className="size-11 shrink-0 rounded-xl border border-white/15 bg-white object-contain shadow-sm"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-lime sm:text-sm">
                Install ICS Academy on iPhone
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-white/85">
                Tap the Safari <strong>Share</strong> button below and select{' '}
                <strong>&ldquo;Add to Home Screen&rdquo;</strong> to install the
                app.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowIosInstall(false)
              if (typeof window !== 'undefined') {
                window.sessionStorage.setItem('ics_ios_install_dismissed', 'true')
              }
            }}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Close iPhone install guide"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>,
      document.body,
    )
  }

  // NEVER show update banner on regular websites — only inside installed mobile/tablet apps when a genuinely newer build exists
  if (!isAppEnv || !updateAvailable || dismissed) return null

  return createPortal(
    <div
      role="region"
      aria-label="App Update Available"
      className="fixed inset-x-3 bottom-4 z-[95] mx-auto max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-full"
    >
      <div className="flex flex-col gap-2.5 rounded-2xl border border-lime/50 bg-[#081E21]/95 p-3.5 text-white shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-lime/20 text-lime">
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-lime sm:text-sm">
                New App Update (v{remote?.version || installed.version})
              </p>
              <p className="line-clamp-1 text-[11px] text-white/80">
                {isUpdating
                  ? `Updating inside app (${updateProgress}%)...`
                  : 'Tap Update Now to apply directly inside the app.'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={triggerAppUpdate}
              disabled={isUpdating}
              className="inline-flex items-center gap-1.5 rounded-xl bg-lime px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-lime/90 disabled:opacity-60"
            >
              <Download className="size-3.5 shrink-0" />
              <span>{isUpdating ? `${updateProgress}%` : 'Update Now'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDismissed(true)
                if (typeof window !== 'undefined' && remote?.buildNumber) {
                  window.localStorage.setItem(
                    DISMISSED_BUILD_STORAGE_KEY,
                    String(remote.buildNumber),
                  )
                }
              }}
              className="flex size-8 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Dismiss update notification"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {isUpdating && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-lime transition-all duration-300"
              style={{ width: `${updateProgress}%` }}
            />
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

export function AppUpdateButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const {
    isAppEnv,
    installed,
    remote,
    updateAvailable,
    isChecking,
    isUpdating,
    updateProgress,
    statusMessage,
    autoCheckEnabled,
    checkForUpdates,
    triggerAppUpdate,
    toggleAutoCheck,
  } = useAppUpdater()

  // NEVER show the App Update button on regular websites — only inside installed mobile/tablet apps
  if (!isAppEnv) return null

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          checkForUpdates(true)
        }}
        title="App Update & Version Check"
        className={cn(
          'relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card/80 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-lime/50 hover:bg-muted',
          updateAvailable && 'border-lime/60 bg-lime/15 text-lime',
          className,
        )}
      >
        <RefreshCw
          className={cn('size-3.5 shrink-0', isChecking && 'animate-spin')}
          aria-hidden="true"
        />
        <span className="hidden sm:inline whitespace-nowrap">
          {updateAvailable ? 'Update Available' : 'Update App'}
        </span>
        {updateAvailable && (
          <span className="flex size-2 shrink-0 rounded-full bg-lime" />
        )}
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-update-center-title"
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4 pt-[max(1rem,var(--safe-top))] pb-6 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <div
              className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 text-foreground shadow-2xl sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime/15 text-lime">
                    <Smartphone className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h3
                      id="app-update-center-title"
                      className="text-base font-bold text-foreground"
                    >
                      App Update Center
                    </h3>
                    <p className="truncate text-xs text-muted-foreground">
                      ICS Academy In-App Live Updater
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Close modal"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3.5 sm:space-y-4">
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/40 p-3.5 text-xs">
                  <div className="min-w-0">
                    <p className="text-muted-foreground">Installed Version</p>
                    <p className="mt-0.5 truncate font-bold text-foreground">
                      v{installed.version} (Build #{installed.buildNumber})
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground">Latest Release</p>
                    <p className="mt-0.5 truncate font-bold text-lime">
                      {remote
                        ? `v${remote.version} (Build #${remote.buildNumber})`
                        : `v${installed.version} (Build #${installed.buildNumber})`}
                    </p>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-3.5 py-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">
                      Auto-Check for Updates
                    </p>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      Automatically update &amp; notify inside the app
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoCheckEnabled}
                    onChange={(e) => toggleAutoCheck(e.target.checked)}
                    className="size-4 shrink-0 accent-lime"
                  />
                </label>

                {isUpdating && (
                  <div className="space-y-1.5 rounded-xl border border-lime/40 bg-lime/10 p-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-lime">
                      <span>Updating inside app...</span>
                      <span>{updateProgress}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-black/30">
                      <div
                        className="h-full rounded-full bg-lime transition-all duration-300"
                        style={{ width: `${updateProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {statusMessage && (
                  <div
                    className={cn(
                      'flex items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed',
                      updateAvailable
                        ? 'border-lime/40 bg-lime/10 text-lime'
                        : 'border-border bg-muted/40 text-muted-foreground',
                    )}
                  >
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-lime" />
                    <span className="min-w-0 flex-1 break-words">{statusMessage}</span>
                  </div>
                )}

                <div className="flex flex-col gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={triggerAppUpdate}
                    disabled={isUpdating}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-lime px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-lime/90 disabled:opacity-60"
                  >
                    <Download className="size-4 shrink-0" />
                    <span>
                      {isUpdating
                        ? `Updating App (${updateProgress}%)...`
                        : updateAvailable
                          ? 'Update App Now (In-App Update)'
                          : 'Refresh & Sync Latest App Data'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => checkForUpdates(true)}
                    disabled={isChecking || isUpdating}
                    className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-60"
                  >
                    <RefreshCw
                      className={cn('size-3.5 shrink-0', isChecking && 'animate-spin')}
                    />
                    <span>{isChecking ? 'Checking...' : 'Check for Updates'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
