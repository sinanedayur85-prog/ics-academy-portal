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
import { isAndroidNativeApp } from '@/lib/mobile-pdf'
import { cn } from '@/lib/utils'

export interface AppVersionInfo {
  version: string
  buildNumber: number
  commitSha: string
  builtAt: string
  repo: string
  apkDownloadUrl: string
}

interface RemoteReleaseInfo {
  version: string
  buildNumber: number
  publishedAt: string
  apkDownloadUrl: string
  releaseNotes?: string
}

const DEFAULT_VERSION_INFO: AppVersionInfo = {
  version: '1.0.1',
  buildNumber: 1,
  commitSha: 'local',
  builtAt: '2026-11-01T00:00:00.000Z',
  repo: 'sinanedayur85-prog/ics-academy-portal',
  apkDownloadUrl:
    'https://github.com/sinanedayur85-prog/ics-academy-portal/releases/download/latest-apk/ICS-Academy-Manhappatta.apk',
}

const AUTO_UPDATE_STORAGE_KEY = 'ics_auto_check_updates'
const DISMISSED_BUILD_STORAGE_KEY = 'ics_dismissed_update_build'

export function useAppUpdater() {
  const [installed, setInstalled] = useState<AppVersionInfo>(DEFAULT_VERSION_INFO)
  const [remote, setRemote] = useState<RemoteReleaseInfo | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [autoCheckEnabled, setAutoCheckEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    const stored = window.localStorage.getItem(AUTO_UPDATE_STORAGE_KEY)
    return stored === null ? true : stored === 'true'
  })

  const checkForUpdates = useCallback(
    async (manual = false) => {
      setIsChecking(true)
      if (manual) {
        setStatusMessage('Checking GitHub Releases for the latest APK version...')
      }

      try {
        // 1. Load local bundled version.json
        let currentLocal = DEFAULT_VERSION_INFO
        try {
          const localRes = await fetch(`/version.json?t=${Date.now()}`, {
            cache: 'no-store',
          })
          if (localRes.ok) {
            const localJson = (await localRes.json()) as Partial<AppVersionInfo>
            currentLocal = {
              version: localJson.version || DEFAULT_VERSION_INFO.version,
              buildNumber: Number(localJson.buildNumber) || 1,
              commitSha: localJson.commitSha || 'local',
              builtAt: localJson.builtAt || DEFAULT_VERSION_INFO.builtAt,
              repo: localJson.repo || DEFAULT_VERSION_INFO.repo,
              apkDownloadUrl:
                localJson.apkDownloadUrl || DEFAULT_VERSION_INFO.apkDownloadUrl,
            }
            setInstalled(currentLocal)
          }
        } catch {
          // Keep default fallback
        }

        // 2. Query GitHub Releases API for latest-apk tag
        const apiUrl = `https://api.github.com/repos/${currentLocal.repo}/releases/tags/latest-apk`
        const ghRes = await fetch(apiUrl, {
          headers: { Accept: 'application/vnd.github+json' },
          cache: 'no-store',
        })

        if (!ghRes.ok) {
          if (manual) {
            if (ghRes.status === 404) {
              setStatusMessage(
                'Direct APK download ready. (Note: Make sure your GitHub repository is set to Public so automatic version checks can read release info.)',
              )
            } else {
              setStatusMessage(
                'Could not reach update server right now. You can still tap "Update App Now" below.',
              )
            }
          }
          setIsChecking(false)
          return
        }

        const releaseData = await ghRes.json()
        const bodyText: string = releaseData?.body || ''
        const buildMatch = bodyText.match(/Build\s*#(\d+)/i)
        const versionMatch = bodyText.match(/Version:\s*([0-9.]+)/i)

        const asset = Array.isArray(releaseData?.assets)
          ? releaseData.assets.find((a: { name?: string }) =>
              a?.name?.endsWith('.apk'),
            )
          : null

        const remoteBuildNum = buildMatch
          ? Number(buildMatch[1])
          : currentLocal.buildNumber
        const remoteVersion = versionMatch
          ? versionMatch[1]
          : `1.0.${remoteBuildNum}`
        const remoteDownloadUrl =
          asset?.browser_download_url || currentLocal.apkDownloadUrl
        const publishedAt =
          asset?.updated_at ||
          releaseData?.published_at ||
          new Date().toISOString()

        const remoteInfo: RemoteReleaseInfo = {
          version: remoteVersion,
          buildNumber: remoteBuildNum,
          publishedAt,
          apkDownloadUrl: remoteDownloadUrl,
          releaseNotes: bodyText,
        }
        setRemote(remoteInfo)

        const isNewerBuild =
          remoteBuildNum > currentLocal.buildNumber ||
          (currentLocal.commitSha !== 'local' &&
            new Date(publishedAt).getTime() >
              new Date(currentLocal.builtAt).getTime() + 90_000)

        setUpdateAvailable(isNewerBuild)

        if (manual) {
          if (isNewerBuild) {
            setStatusMessage(
              `New update available: v${remoteVersion} (Build #${remoteBuildNum})! Tap "Update App Now" to install.`,
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
            'Unable to check online status right now. You can still tap "Update App Now" to download the latest APK.',
          )
        }
      } finally {
        setIsChecking(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!autoCheckEnabled) return
    checkForUpdates(false)
    const interval = window.setInterval(() => {
      checkForUpdates(false)
    }, 180_000)
    return () => window.clearInterval(interval)
  }, [autoCheckEnabled, checkForUpdates])

  const triggerAppUpdate = useCallback(() => {
    const targetUrl = remote?.apkDownloadUrl || installed.apkDownloadUrl
    setIsUpdating(true)

    if (
      typeof window !== 'undefined' &&
      window.ICSNativeBridge?.downloadAndInstallApk
    ) {
      setStatusMessage(
        'Downloading update in background... Android installer will open automatically.',
      )
      window.ICSNativeBridge.downloadAndInstallApk(targetUrl)
      window.setTimeout(() => {
        setIsUpdating(false)
      }, 6000)
      return
    }

    // Fallback for mobile/desktop browsers or older APK builds without downloadAndInstallApk
    setStatusMessage('Starting APK download...')
    const link = document.createElement('a')
    link.href = targetUrl
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.download = 'ICS-Academy-Manhappatta.apk'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    window.setTimeout(() => {
      setIsUpdating(false)
    }, 3000)
  }, [installed.apkDownloadUrl, remote?.apkDownloadUrl])

  const toggleAutoCheck = useCallback((next: boolean) => {
    setAutoCheckEnabled(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTO_UPDATE_STORAGE_KEY, String(next))
    }
  }, [])

  return {
    installed,
    remote,
    updateAvailable,
    isChecking,
    isUpdating,
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
    installed,
    remote,
    updateAvailable,
    isUpdating,
    triggerAppUpdate,
  } = useAppUpdater()
  const [dismissed, setDismissed] = useState(false)

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

  if (!updateAvailable || dismissed) return null

  return (
    <div className="sticky top-0 z-50 border-b border-lime/40 bg-emerald-950/95 px-4 py-2.5 text-white backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs sm:text-sm">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-lime/20 text-lime">
            <Sparkles className="size-3.5" />
          </span>
          <span>
            <strong className="font-semibold text-lime">
              New App Update Available
            </strong>{' '}
            (v{remote?.version || installed.version}) — Tap update to install the
            latest features.
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={triggerAppUpdate}
            disabled={isUpdating}
            className="inline-flex items-center gap-1.5 rounded-full bg-lime px-3.5 py-1 text-xs font-bold text-slate-950 transition hover:bg-lime/90 disabled:opacity-60"
          >
            <Download className="size-3.5" />
            {isUpdating ? 'Updating...' : 'Update Now'}
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
            className="rounded-full p-1 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Dismiss update notification"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function AppUpdateButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const {
    installed,
    remote,
    updateAvailable,
    isChecking,
    isUpdating,
    statusMessage,
    autoCheckEnabled,
    checkForUpdates,
    triggerAppUpdate,
    toggleAutoCheck,
  } = useAppUpdater()

  const isNative = typeof window !== 'undefined' && isAndroidNativeApp()

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
                      ICS Academy Android &amp; Web Updater
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
                        : 'Ready to check'}
                    </p>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-3.5 py-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">
                      Auto-Check for Updates
                    </p>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      Automatically notify when a new version is built
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoCheckEnabled}
                    onChange={(e) => toggleAutoCheck(e.target.checked)}
                    className="size-4 shrink-0 accent-lime"
                  />
                </label>

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
                        ? 'Downloading & Opening Installer...'
                        : isNative
                          ? 'Update App Now (One-Click Install)'
                          : 'Download Latest APK Update'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => checkForUpdates(true)}
                    disabled={isChecking}
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
