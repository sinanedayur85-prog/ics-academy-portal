'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Camera,
  Check,
  Crown,
  Eye,
  ImagePlus,
  Loader2,
  Lock,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Trash2,
  Type,
  Unlock,
  User,
  Users,
  Video,
  X,
} from 'lucide-react'
import { ImageCropperModal } from '@/components/dashboard/image-cropper-modal'
import { cn } from '@/lib/utils'

export interface CampusChatStatus {
  id: string
  actorId: string
  actorName: string
  actorRole: 'student' | 'usthad' | 'principal'
  actorAvatarUrl?: string
  type: 'text' | 'image'
  text: string
  bgStyle: string
  mediaUrl?: string
  createdAtMs: number
  expiresAtMs: number
  viewedByMap: Record<string, number>
}

export const STATUS_BG_PRESETS: Array<{ id: string; label: string; className: string }> = [
  {
    id: 'ig-sunset',
    label: 'Sunset',
    className: 'bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]',
  },
  {
    id: 'midnight-violet',
    label: 'Violet',
    className: 'bg-gradient-to-br from-[#1e1b4b] via-[#5b21b6] to-[#be185d]',
  },
  {
    id: 'ocean-blue',
    label: 'Ocean',
    className: 'bg-gradient-to-br from-[#0f172a] via-[#0369a1] to-[#06b6d4]',
  },
  {
    id: 'emerald-dusk',
    label: 'Emerald',
    className: 'bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#10b981]',
  },
  {
    id: 'amber-gold',
    label: 'Amber',
    className: 'bg-gradient-to-br from-[#78350f] via-[#d97706] to-[#f59e0b]',
  },
  {
    id: 'obsidian',
    label: 'Obsidian',
    className: 'bg-gradient-to-br from-[#09090b] via-[#18181b] to-[#27272a]',
  },
]

export function getStatusBgClass(bgStyle: string): string {
  return (
    STATUS_BG_PRESETS.find((p) => p.id === bgStyle)?.className || STATUS_BG_PRESETS[0].className
  )
}

function formatStatusRelativeTime(tsMs: number): string {
  const diffSec = Math.max(1, Math.floor((Date.now() - tsMs) / 1000))
  if (diffSec < 60) return 'Just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  return `${diffHr}h ago`
}

async function compressStatusPhotoToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'))
      return
    }
    const objUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const encode = (maxDim: number, quality: number) => {
          const w = img.naturalWidth || img.width || 1080
          const h = img.naturalHeight || img.height || 1080
          const scale = Math.max(w, h) > maxDim ? maxDim / Math.max(w, h) : 1
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(w * scale))
          canvas.height = Math.max(1, Math.round(h * scale))
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('Canvas unavailable')
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          return canvas.toDataURL('image/jpeg', quality)
        }
        let out = encode(1080, 0.8)
        if (out.length > 260_000) out = encode(900, 0.72)
        if (out.length > 340_000) out = encode(720, 0.65)
        URL.revokeObjectURL(objUrl)
        resolve(out)
      } catch (err) {
        URL.revokeObjectURL(objUrl)
        reject(err instanceof Error ? err : new Error('Could not process photo.'))
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(objUrl)
      reject(new Error('Unable to read image.'))
    }
    img.src = objUrl
  })
}

/* ============================================================================
 * 1. INSTAGRAM-STYLE STORY / STATUS CREATOR MODAL
 * ============================================================================ */
export interface StatusCreatorModalProps {
  open: boolean
  actorName: string
  actorAvatarUrl?: string
  onClose: () => void
  onPublish: (payload: {
    type: 'text' | 'image'
    text: string
    bgStyle: string
    mediaUrl?: string
  }) => Promise<void>
}

export function StatusCreatorModal({
  open,
  actorName,
  actorAvatarUrl,
  onClose,
  onPublish,
}: StatusCreatorModalProps) {
  const [mounted, setMounted] = useState(false)
  const [mode, setMode] = useState<'text' | 'image'>('text')
  const [text, setText] = useState('')
  const [bgStyle, setBgStyle] = useState(STATUS_BG_PRESETS[0].id)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      setMode('text')
      setText('')
      setBgStyle(STATUS_BG_PRESETS[0].id)
      setImageDataUrl(null)
      setIsPublishing(false)
      setErrorMsg(null)
    }
  }, [open])

  if (!open || !mounted) return null

  const handleSelectPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErrorMsg(null)
    try {
      const compressed = await compressStatusPhotoToDataUrl(file)
      setImageDataUrl(compressed)
      setMode('image')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load image.')
    }
  }

  const canPost = mode === 'image' ? Boolean(imageDataUrl) : text.trim().length > 0

  const handleSubmit = async () => {
    if (!canPost || isPublishing) return
    setIsPublishing(true)
    setErrorMsg(null)
    try {
      await onPublish({
        type: mode,
        text: text.trim().slice(0, 240),
        bgStyle,
        mediaUrl: mode === 'image' ? imageDataUrl || undefined : undefined,
      })
      onClose()
    } catch {
      setErrorMsg('Could not publish status. Please check your connection.')
    } finally {
      setIsPublishing(false)
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add to your story"
      className={cn(
        'fixed inset-0 z-[140] flex flex-col text-white animate-in fade-in-0 duration-150',
        mode === 'text' ? getStatusBgClass(bgStyle) : 'bg-black',
      )}
      style={{
        paddingTop: 'var(--safe-top, 0px)',
        paddingBottom: 'var(--safe-bottom, 0px)',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => void handleSelectPhoto(e)}
        className="hidden"
      />

      {/* Top Controls */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 text-xs font-bold ring-2 ring-white/50">
            {actorAvatarUrl ? (
              <img src={actorAvatarUrl} alt={actorName} className="size-full object-cover object-top" />
            ) : (
              actorName.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-poppins text-sm font-semibold text-white">Add to Story</p>
            <p className="truncate text-[11px] text-white/75">Visible for 24 hours in Chats</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('text')
              setErrorMsg(null)
            }}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors',
              mode === 'text'
                ? 'bg-white text-black'
                : 'bg-black/40 text-white hover:bg-black/60',
            )}
          >
            <Type className="size-3.5" aria-hidden="true" />
            <span>Text</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors',
              mode === 'image'
                ? 'bg-white text-black'
                : 'bg-black/40 text-white hover:bg-black/60',
            )}
          >
            <ImagePlus className="size-3.5" aria-hidden="true" />
            <span>Photo</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isPublishing}
            aria-label="Close story creator"
            className="flex size-10 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Main Canvas Stage */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-4">
        {mode === 'text' ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={240}
            placeholder="Share a thought, reminder, or update…"
            rows={4}
            autoFocus
            className="w-full max-w-md resize-none bg-transparent text-center font-poppins text-2xl font-bold leading-snug text-white placeholder:text-white/55 focus:outline-none sm:text-3xl"
          />
        ) : imageDataUrl ? (
          <div className="relative flex max-h-full w-full max-w-lg flex-col items-center justify-center">
            <img
              src={imageDataUrl}
              alt="Status preview"
              className="max-h-[62svh] w-auto max-w-full rounded-3xl object-contain shadow-2xl ring-1 ring-white/15"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
            >
              Change Photo
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-3 rounded-3xl border border-white/20 bg-white/10 px-10 py-10 text-center transition-colors hover:bg-white/15"
          >
            <ImagePlus className="size-10 text-white/85" aria-hidden="true" />
            <span className="text-sm font-semibold">Tap to pick a photo</span>
          </button>
        )}

        {errorMsg && (
          <p className="mt-4 rounded-2xl bg-black/60 px-4 py-2 text-xs text-red-200">{errorMsg}</p>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="shrink-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-4 pb-5 pt-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-md flex-col gap-3">
          {mode === 'text' ? (
            <div className="flex items-center justify-center gap-2.5">
              {STATUS_BG_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setBgStyle(preset.id)}
                  aria-label={`Background ${preset.label}`}
                  className={cn(
                    'size-8 rounded-full transition-transform',
                    preset.className,
                    bgStyle === preset.id
                      ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-black/40'
                      : 'opacity-80 hover:opacity-100',
                  )}
                />
              ))}
            </div>
          ) : (
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={180}
              placeholder="Add a caption…"
              className="h-11 w-full rounded-full bg-white/15 px-4 text-sm text-white placeholder:text-white/60 backdrop-blur-md focus:outline-none focus:ring-1 focus:ring-white/40"
            />
          )}

          <button
            type="button"
            disabled={!canPost || isPublishing}
            onClick={() => void handleSubmit()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-bold text-black shadow-lg transition-transform hover:bg-white/95 active:scale-[0.98] disabled:opacity-45"
          >
            {isPublishing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-4" aria-hidden="true" />
            )}
            <span>{isPublishing ? 'Sharing to Story…' : 'Share to Story'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ============================================================================
 * 2. INSTAGRAM-STYLE FULL-SCREEN STORY / STATUS VIEWER MODAL
 * ============================================================================ */
export interface StatusViewerModalProps {
  open: boolean
  statuses: CampusChatStatus[]
  initialIndex?: number
  currentActorId: string
  resolveActorName: (actorId: string, fallbackName: string) => string
  resolveActorAvatar: (actorId: string, fallbackAvatar?: string) => string | undefined
  onClose: () => void
  onMarkViewed: (statusId: string) => void
  onDeleteStatus: (statusId: string) => Promise<void>
  onReplyToStatus: (targetActorId: string, status: CampusChatStatus, replyText: string) => void
  onAddAnotherStory?: () => void
}

export function StatusViewerModal({
  open,
  statuses,
  initialIndex = 0,
  currentActorId,
  resolveActorName,
  resolveActorAvatar,
  onClose,
  onMarkViewed,
  onDeleteStatus,
  onReplyToStatus,
  onAddAnotherStory,
}: StatusViewerModalProps) {
  const [mounted, setMounted] = useState(false)
  const [activeIdx, setActiveIdx] = useState(initialIndex)
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [showViewersSheet, setShowViewersSheet] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sentReplyFlash, setSentReplyFlash] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (open) {
      setActiveIdx(Math.min(initialIndex, Math.max(0, statuses.length - 1)))
      setProgress(0)
      setIsPaused(false)
      setShowViewersSheet(false)
      setReplyText('')
      setSentReplyFlash(false)
    }
  }, [open, initialIndex, statuses.length])

  const currentStatus = statuses[activeIdx] || null

  useEffect(() => {
    if (!open || !currentStatus) return
    if (currentStatus.actorId !== currentActorId) {
      onMarkViewed(currentStatus.id)
    }
  }, [open, currentStatus?.id, currentStatus?.actorId, currentActorId, onMarkViewed])

  useEffect(() => {
    if (!open || !currentStatus || isPaused || showViewersSheet || replyText.trim().length > 0) {
      return
    }
    const durationMs = currentStatus.type === 'image' ? 6000 : 5200
    const stepMs = 50
    const increment = (stepMs / durationMs) * 100
    const timer = window.setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment
        if (next >= 100) {
          if (activeIdx < statuses.length - 1) {
            setActiveIdx((i) => i + 1)
            return 0
          }
          onClose()
          return 100
        }
        return next
      })
    }, stepMs)
    return () => window.clearInterval(timer)
  }, [
    open,
    currentStatus,
    isPaused,
    showViewersSheet,
    replyText,
    activeIdx,
    statuses.length,
    onClose,
  ])

  if (!open || !mounted || !currentStatus) return null

  const isOwn = currentStatus.actorId === currentActorId
  const authorDisplayName = resolveActorName(currentStatus.actorId, currentStatus.actorName)
  const authorAvatar = resolveActorAvatar(currentStatus.actorId, currentStatus.actorAvatarUrl)

  const viewersList = Object.entries(currentStatus.viewedByMap || {})
    .filter(([id]) => id !== currentStatus.actorId)
    .sort((a, b) => b[1] - a[1])

  const goPrev = () => {
    if (activeIdx > 0) {
      setActiveIdx((i) => i - 1)
      setProgress(0)
    } else {
      setProgress(0)
    }
  }

  const goNext = () => {
    if (activeIdx < statuses.length - 1) {
      setActiveIdx((i) => i + 1)
      setProgress(0)
    } else {
      onClose()
    }
  }

  const handleSendReply = (textToSend: string) => {
    const clean = textToSend.trim()
    if (!clean) return
    onReplyToStatus(currentStatus.actorId, currentStatus, clean)
    setReplyText('')
    setSentReplyFlash(true)
    window.setTimeout(() => setSentReplyFlash(false), 1800)
  }

  const handleDeleteCurrent = async () => {
    if (isDeleting) return
    setIsDeleting(true)
    try {
      await onDeleteStatus(currentStatus.id)
      if (statuses.length <= 1) {
        onClose()
      } else {
        setActiveIdx((i) => Math.max(0, Math.min(i, statuses.length - 2)))
        setProgress(0)
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${authorDisplayName} story`}
      className={cn(
        'fixed inset-0 z-[145] flex flex-col select-none text-white animate-in fade-in-0 duration-150',
        currentStatus.type === 'text' ? getStatusBgClass(currentStatus.bgStyle) : 'bg-black',
      )}
      style={{
        paddingTop: 'var(--safe-top, 0px)',
        paddingBottom: 'var(--safe-bottom, 0px)',
      }}
    >
      {/* Segmented Instagram Progress Bars */}
      <div className="flex shrink-0 items-center gap-1.5 px-3 pt-2.5">
        {statuses.map((st, idx) => (
          <div key={st.id} className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full bg-white transition-[width] duration-75 ease-linear"
              style={{
                width: idx < activeIdx ? '100%' : idx === activeIdx ? `${progress}%` : '0%',
              }}
            />
          </div>
        ))}
      </div>

      {/* Top Author Header */}
      <div className="z-20 flex shrink-0 items-center justify-between gap-2 px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 text-xs font-bold ring-1 ring-white/40">
            {authorAvatar ? (
              <img
                src={authorAvatar}
                alt={authorDisplayName}
                className="size-full object-cover object-top"
              />
            ) : (
              authorDisplayName.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-poppins text-sm font-semibold text-white">
                {authorDisplayName}
              </p>
              <span className="shrink-0 text-xs text-white/70">
                {formatStatusRelativeTime(currentStatus.createdAtMs)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isOwn && onAddAnotherStory && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onAddAnotherStory()
              }}
              aria-label="Add another story"
              title="Add another story"
              className="flex size-9 items-center justify-center rounded-full bg-black/35 text-white hover:bg-black/55"
            >
              <Plus className="size-4.5" aria-hidden="true" />
            </button>
          )}
          {isOwn && (
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => void handleDeleteCurrent()}
              aria-label="Delete this story"
              title="Delete story"
              className="flex size-9 items-center justify-center rounded-full bg-black/35 text-red-200 hover:bg-red-500/40"
            >
              {isDeleting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close story viewer"
            className="flex size-9 items-center justify-center rounded-full bg-black/35 text-white hover:bg-black/55"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Main Story Stage with Tap Left / Tap Right & Hold-to-Pause */}
      <div
        onPointerDown={() => setIsPaused(true)}
        onPointerUp={() => setIsPaused(false)}
        onPointerCancel={() => setIsPaused(false)}
        className="relative flex min-h-0 flex-1 items-center justify-center px-5"
      >
        {/* Invisible Left / Right Navigation Tap Zones */}
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous story"
          className="absolute inset-y-0 left-0 z-10 w-[30%] cursor-pointer bg-transparent"
        />
        <button
          type="button"
          onClick={goNext}
          aria-label="Next story"
          className="absolute inset-y-0 right-0 z-10 w-[70%] cursor-pointer bg-transparent"
        />

        {currentStatus.type === 'image' && currentStatus.mediaUrl ? (
          <div className="flex max-h-full w-full flex-col items-center justify-center">
            <img
              src={currentStatus.mediaUrl}
              alt={currentStatus.text || `${authorDisplayName} story`}
              className="max-h-[72svh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
            />
            {currentStatus.text && (
              <p className="mt-4 max-w-md rounded-2xl bg-black/60 px-4 py-2 text-center text-sm font-medium text-white backdrop-blur-md">
                {currentStatus.text}
              </p>
            )}
          </div>
        ) : (
          <p className="max-w-md whitespace-pre-wrap text-center font-poppins text-2xl font-bold leading-snug text-white drop-shadow-sm sm:text-3xl">
            {currentStatus.text}
          </p>
        )}

        {sentReplyFlash && (
          <div className="pointer-events-none absolute bottom-4 z-30 rounded-full bg-black/80 px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
            Reply sent to chat
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="z-20 shrink-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-4 pb-5 pt-3">
        {isOwn ? (
          <div className="mx-auto flex max-w-md items-center justify-center">
            <button
              type="button"
              onClick={() => setShowViewersSheet((v) => !v)}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white/15 px-5 text-xs font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/25"
            >
              <Eye className="size-4" aria-hidden="true" />
              <span className="tabular-nums">
                Seen by {viewersList.length} {viewersList.length === 1 ? 'person' : 'people'}
              </span>
            </button>
          </div>
        ) : (
          <div className="mx-auto flex max-w-md flex-col gap-2.5">
            <div className="flex items-center justify-center gap-3">
              {['❤️', '🔥', '👏', '😂', '🤲'].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleSendReply(emoji)}
                  className="flex size-10 items-center justify-center rounded-full bg-white/15 text-lg transition-transform hover:scale-110 active:scale-95"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSendReply(replyText)
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onFocus={() => setIsPaused(true)}
                onBlur={() => setIsPaused(false)}
                placeholder={`Reply to ${authorDisplayName.split(' ')[0]}…`}
                className="h-11 flex-1 rounded-full border border-white/30 bg-black/40 px-4 text-sm text-white placeholder:text-white/65 backdrop-blur-md focus:border-white/70 focus:outline-none"
              />
              {replyText.trim().length > 0 && (
                <button
                  type="submit"
                  aria-label="Send reply"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#0095F6] text-white transition-transform active:scale-95"
                >
                  <Send className="size-4.5" aria-hidden="true" />
                </button>
              )}
            </form>
          </div>
        )}
      </div>

      {/* Viewers Bottom Sheet (For Own Status) */}
      {isOwn && showViewersSheet && (
        <div
          onClick={() => setShowViewersSheet(false)}
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[60svh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-[#121212] text-white shadow-2xl"
          >
            <div className="mx-auto my-2.5 h-1.5 w-10 rounded-full bg-white/25" />
            <div className="flex items-center justify-between border-b border-white/10 px-5 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="size-4 text-white/75" aria-hidden="true" />
                <h4 className="font-poppins text-sm font-semibold tabular-nums">
                  Viewers ({viewersList.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowViewersSheet(false)}
                className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {viewersList.length === 0 ? (
                <p className="py-8 text-center text-xs text-white/55">
                  No one has viewed this story yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {viewersList.map(([viewerId, viewedMs]) => {
                    const vName = resolveActorName(viewerId, viewerId)
                    const vAvatar = resolveActorAvatar(viewerId)
                    return (
                      <div key={viewerId} className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/15 text-xs font-bold">
                            {vAvatar ? (
                              <img
                                src={vAvatar}
                                alt={vName}
                                className="size-full object-cover object-top"
                              />
                            ) : (
                              vName.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <p className="truncate text-sm font-medium text-white">{vName}</p>
                        </div>
                        <span className="shrink-0 text-xs text-white/55">
                          {formatStatusRelativeTime(viewedMs)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}

/* ============================================================================
 * 3. INSTAGRAM-STYLE PROFILE & STORY ACTION SHEET (Tap Any Avatar in Chat)
 * ============================================================================ */
export interface ProfileAndStatusSheetProps {
  open: boolean
  isOwnProfile: boolean
  actorId: string
  displayName: string
  officialName: string
  roleSubtitle: string
  avatarUrl?: string
  avatarText: string
  onlineStatusText?: string
  hasActiveStatus: boolean
  hasUnseenStatus: boolean
  savedContactNickname?: string
  ownChatDisplayName?: string
  onClose: () => void
  onViewStatus?: () => void
  onAddStatus?: () => void
  onViewProfilePhoto?: () => void
  onChangeOwnPhoto?: () => void
  onSaveContactNickname?: (nickname: string) => void
  onSaveOwnDisplayName?: (displayName: string) => void
  onOpenChat?: () => void
  onStartVoiceCall?: () => void
  onStartVideoCall?: () => void
}

export function ProfileAndStatusSheet({
  open,
  isOwnProfile,
  displayName,
  officialName,
  roleSubtitle,
  avatarUrl,
  avatarText,
  onlineStatusText,
  hasActiveStatus,
  hasUnseenStatus,
  savedContactNickname = '',
  ownChatDisplayName = '',
  onClose,
  onViewStatus,
  onAddStatus,
  onViewProfilePhoto,
  onChangeOwnPhoto,
  onSaveContactNickname,
  onSaveOwnDisplayName,
  onOpenChat,
  onStartVoiceCall,
  onStartVideoCall,
}: ProfileAndStatusSheetProps) {
  const [mounted, setMounted] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (open) {
      setEditingName(false)
      setNameInput(isOwnProfile ? ownChatDisplayName : savedContactNickname)
    }
  }, [open, isOwnProfile, ownChatDisplayName, savedContactNickname])

  if (!open || !mounted) return null

  const handleSaveName = () => {
    const clean = nameInput.trim().slice(0, 48)
    if (isOwnProfile) {
      onSaveOwnDisplayName?.(clean)
    } else {
      onSaveContactNickname?.(clean)
    }
    setEditingName(false)
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${displayName} profile and story options`}
      onClick={onClose}
      className="fixed inset-0 z-[125] flex items-end justify-center bg-black/65 backdrop-blur-xs sm:items-center sm:p-4 animate-in fade-in-0 duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-t-3xl bg-white text-zinc-950 shadow-2xl sm:rounded-3xl dark:bg-[#121212] dark:text-white animate-in slide-in-from-bottom-4 duration-200"
        style={{ paddingBottom: 'max(var(--safe-bottom, 0px), 1rem)' }}
      >
        {/* Drag Handle */}
        <div className="mx-auto my-2.5 h-1.5 w-10 rounded-full bg-zinc-300 dark:bg-white/20 sm:hidden" />

        {/* Profile Header with Instagram Story Gradient Ring */}
        <div className="flex flex-col items-center px-5 pb-4 pt-3 text-center">
          <button
            type="button"
            onClick={() => {
              if (hasActiveStatus && onViewStatus) {
                onClose()
                onViewStatus()
              } else if (avatarUrl && onViewProfilePhoto) {
                onClose()
                onViewProfilePhoto()
              } else if (isOwnProfile && onChangeOwnPhoto) {
                onClose()
                onChangeOwnPhoto()
              }
            }}
            className="relative transition-transform active:scale-95"
            aria-label={hasActiveStatus ? 'View story' : 'View profile photo'}
          >
            <div
              className={cn(
                'rounded-full p-[3px]',
                hasActiveStatus
                  ? hasUnseenStatus
                    ? 'bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]'
                    : 'bg-zinc-300 dark:bg-zinc-600'
                  : 'bg-transparent',
              )}
            >
              <div className="rounded-full bg-white p-[3px] dark:bg-[#121212]">
                <div className="flex size-20 items-center justify-center overflow-hidden rounded-full bg-zinc-200 font-poppins text-xl font-bold text-zinc-700 dark:bg-[#262626] dark:text-zinc-200">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="size-full object-cover object-top"
                    />
                  ) : (
                    avatarText
                  )}
                </div>
              </div>
            </div>
          </button>

          <h3 className="mt-3 font-poppins text-lg font-bold leading-tight">{displayName}</h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {officialName !== displayName ? `${officialName} · ` : ''}
            {roleSubtitle}
          </p>
          {onlineStatusText && (
            <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {onlineStatusText}
            </p>
          )}
        </div>

        {/* Inline Name Editor (Option A or Option B) */}
        {editingName && (
          <div className="mx-4 mb-3 rounded-2xl bg-zinc-100 p-3 dark:bg-white/[0.06]">
            <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
              {isOwnProfile
                ? 'Your Chat Display Name (Visible to everyone in Chats only)'
                : 'Saved Chat Name (Visible only to you in Chats)'}
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={48}
                placeholder={officialName}
                autoFocus
                className="h-10 flex-1 rounded-xl bg-white px-3 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#0095F6] dark:bg-black dark:text-white"
              />
              <button
                type="button"
                onClick={handleSaveName}
                className="flex h-10 items-center justify-center rounded-xl bg-[#0095F6] px-4 text-xs font-bold text-white hover:bg-[#0084DC]"
              >
                Save
              </button>
            </div>
            {(isOwnProfile ? ownChatDisplayName : savedContactNickname) && (
              <button
                type="button"
                onClick={() => {
                  setNameInput('')
                  if (isOwnProfile) onSaveOwnDisplayName?.('')
                  else onSaveContactNickname?.('')
                  setEditingName(false)
                }}
                className="mt-2 text-[11px] font-semibold text-rose-500 hover:underline"
              >
                Reset to official name ({officialName})
              </button>
            )}
          </div>
        )}

        {/* Action List */}
        <div className="space-y-1 px-3 pb-2">
          {hasActiveStatus && onViewStatus && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onViewStatus()
              }}
              className="flex h-12 w-full items-center gap-3.5 rounded-2xl px-3.5 text-left text-sm font-semibold transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.07]"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white">
                <Eye className="size-4" aria-hidden="true" />
              </span>
              <span>View Story / Status</span>
            </button>
          )}

          {isOwnProfile && onAddStatus && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onAddStatus()
              }}
              className="flex h-12 w-full items-center gap-3.5 rounded-2xl px-3.5 text-left text-sm font-semibold transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.07]"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white">
                <Plus className="size-4.5" aria-hidden="true" />
              </span>
              <span>Add to Your Story</span>
            </button>
          )}

          {avatarUrl && onViewProfilePhoto && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onViewProfilePhoto()
              }}
              className="flex h-12 w-full items-center gap-3.5 rounded-2xl px-3.5 text-left text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.07]"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-white">
                <User className="size-4" aria-hidden="true" />
              </span>
              <span>View Profile Photo</span>
            </button>
          )}

          {isOwnProfile && onChangeOwnPhoto && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onChangeOwnPhoto()
              }}
              className="flex h-12 w-full items-center gap-3.5 rounded-2xl px-3.5 text-left text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.07]"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-[#0095F6]/15 text-[#0095F6]">
                <Camera className="size-4" aria-hidden="true" />
              </span>
              <span>Change &amp; Crop Profile Photo</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setEditingName((prev) => !prev)}
            className="flex h-12 w-full items-center gap-3.5 rounded-2xl px-3.5 text-left text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.07]"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-white">
              <Pencil className="size-4" aria-hidden="true" />
            </span>
            <span>
              {isOwnProfile
                ? ownChatDisplayName
                  ? 'Edit My Chat Name'
                  : 'Set My Chat Display Name'
                : savedContactNickname
                  ? 'Edit Saved Contact Name'
                  : 'Save Custom Name in Chats'}
            </span>
          </button>

          {!isOwnProfile && (onOpenChat || onStartVoiceCall || onStartVideoCall) && (
            <div className="grid grid-cols-3 gap-2 px-1 pt-2">
              {onOpenChat && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onOpenChat()
                  }}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-[#0095F6] text-xs font-semibold text-white transition-colors hover:bg-[#0084DC]"
                >
                  <MessageCircle className="size-4" aria-hidden="true" />
                  <span>Message</span>
                </button>
              )}
              {onStartVoiceCall && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onStartVoiceCall()
                  }}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-zinc-100 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                >
                  <Phone className="size-4" aria-hidden="true" />
                  <span>Audio</span>
                </button>
              )}
              {onStartVideoCall && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onStartVideoCall()
                  }}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-zinc-100 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                >
                  <Video className="size-4" aria-hidden="true" />
                  <span>Video</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ============================================================================
 * 4. GROUP INFO, GROUP PHOTO CROPPER & ADMIN PROMOTION MODAL
 * ============================================================================ */
export interface GroupMemberItem {
  id: string
  name: string
  officialName: string
  role: 'student' | 'usthad' | 'principal'
  subtitle: string
  avatarUrl?: string
  isStaffAdmin: boolean
  isPromotedStudentAdmin: boolean
}

export interface GroupInfoModalProps {
  open: boolean
  roomId: string
  groupTitle: string
  groupSubtitle: string
  groupAvatarUrl?: string
  isStaffRoom: boolean
  canManageGroupPhoto: boolean
  canPromoteStudents: boolean
  onlyAdminsCanPost: boolean
  members: GroupMemberItem[]
  onClose: () => void
  onUpdateGroupPhoto: (croppedDataUrl: string) => Promise<void>
  onToggleStudentAdmin: (studentId: string, makeAdmin: boolean) => Promise<void>
  onToggleOnlyAdminsCanPost?: () => void
  onViewGroupPhotoFull?: () => void
}

export function GroupInfoModal({
  open,
  groupTitle,
  groupSubtitle,
  groupAvatarUrl,
  isStaffRoom,
  canManageGroupPhoto,
  canPromoteStudents,
  onlyAdminsCanPost,
  members,
  onClose,
  onUpdateGroupPhoto,
  onToggleStudentAdmin,
  onToggleOnlyAdminsCanPost,
  onViewGroupPhotoFull,
}: GroupInfoModalProps) {
  const [mounted, setMounted] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [rawCropUrl, setRawCropUrl] = useState<string | null>(null)
  const [isSavingPhoto, setIsSavingPhoto] = useState(false)
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      setMemberSearch('')
      if (rawCropUrl && rawCropUrl.startsWith('blob:')) {
        URL.revokeObjectURL(rawCropUrl)
      }
      setRawCropUrl(null)
    }
  }, [open, rawCropUrl])

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase()
    const sorted = [...members].sort((a, b) => {
      const aRank = a.isStaffAdmin ? 0 : a.isPromotedStudentAdmin ? 1 : 2
      const bRank = b.isStaffAdmin ? 0 : b.isPromotedStudentAdmin ? 1 : 2
      if (aRank !== bRank) return aRank - bRank
      return a.name.localeCompare(b.name)
    })
    if (!q) return sorted
    return sorted.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.officialName.toLowerCase().includes(q) ||
        m.subtitle.toLowerCase().includes(q),
    )
  }, [members, memberSearch])

  if (!open || !mounted) return null

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    if (rawCropUrl && rawCropUrl.startsWith('blob:')) URL.revokeObjectURL(rawCropUrl)
    setRawCropUrl(URL.createObjectURL(file))
  }

  const handleConfirmGroupCrop = async (croppedDataUrl: string) => {
    if (rawCropUrl && rawCropUrl.startsWith('blob:')) URL.revokeObjectURL(rawCropUrl)
    setRawCropUrl(null)
    setIsSavingPhoto(true)
    try {
      await onUpdateGroupPhoto(croppedDataUrl)
    } finally {
      setIsSavingPhoto(false)
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${groupTitle} info`}
      onClick={onClose}
      className="fixed inset-0 z-[125] flex items-end justify-center bg-black/70 backdrop-blur-xs sm:items-center sm:p-4 animate-in fade-in-0 duration-150"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFilePick}
        className="hidden"
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[86svh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white text-zinc-950 shadow-2xl sm:rounded-3xl dark:bg-[#121212] dark:text-white"
        style={{ paddingBottom: 'var(--safe-bottom, 0px)' }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200/70 px-5 py-3.5 dark:border-white/10">
          <h3 className="font-poppins text-base font-bold">Group Info</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close group info"
            className="flex size-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/10"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Group Avatar + Admin Camera Edit Button */}
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (groupAvatarUrl && onViewGroupPhotoFull) {
                    onViewGroupPhotoFull()
                  } else if (canManageGroupPhoto) {
                    fileInputRef.current?.click()
                  }
                }}
                className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-violet-500/15 text-violet-700 ring-2 ring-zinc-200 transition-transform active:scale-95 dark:bg-[#1e1b2e] dark:text-violet-200 dark:ring-white/15"
              >
                {groupAvatarUrl ? (
                  <img
                    src={groupAvatarUrl}
                    alt={groupTitle}
                    className="size-full object-cover"
                  />
                ) : isStaffRoom ? (
                  <Crown className="size-9 text-amber-500" aria-hidden="true" />
                ) : (
                  <Users className="size-9" aria-hidden="true" />
                )}
              </button>

              {canManageGroupPhoto && (
                <button
                  type="button"
                  disabled={isSavingPhoto}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Change group photo"
                  className="absolute bottom-0 right-0 flex size-9 items-center justify-center rounded-full bg-[#0095F6] text-white shadow-md ring-2 ring-white transition-transform hover:bg-[#0084DC] active:scale-95 dark:ring-[#121212]"
                >
                  {isSavingPhoto ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Camera className="size-4" aria-hidden="true" />
                  )}
                </button>
              )}
            </div>

            <h4 className="mt-3 font-poppins text-lg font-bold">{groupTitle}</h4>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {groupSubtitle} · {members.length} members
            </p>
            {canManageGroupPhoto && (
              <button
                type="button"
                disabled={isSavingPhoto}
                onClick={() => fileInputRef.current?.click()}
                className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0095F6] hover:underline"
              >
                <Camera className="size-3.5" aria-hidden="true" />
                <span>{groupAvatarUrl ? 'Change & Crop Group Photo' : 'Add Group Photo'}</span>
              </button>
            )}
            {!canManageGroupPhoto && (
              <p className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-500">
                Only group admins can change the group photo
              </p>
            )}
          </div>

          {/* Admin Settings Row (for Batch Groups) */}
          {!isStaffRoom && canManageGroupPhoto && onToggleOnlyAdminsCanPost && (
            <button
              type="button"
              onClick={onToggleOnlyAdminsCanPost}
              className="mt-5 flex w-full items-center justify-between gap-3 rounded-2xl bg-zinc-100 px-4 py-3 text-left transition-colors hover:bg-zinc-200/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
            >
              <div className="flex min-w-0 items-center gap-3">
                {onlyAdminsCanPost ? (
                  <Lock className="size-4.5 shrink-0 text-amber-500" aria-hidden="true" />
                ) : (
                  <Unlock className="size-4.5 shrink-0 text-emerald-500" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold">Send Messages</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {onlyAdminsCanPost ? 'Only Group Admins can message' : 'All group members can message'}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-xs font-semibold text-[#0095F6]">Change</span>
            </button>
          )}

          {/* Members & Admin Management */}
          <div className="mt-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Members ({members.length})
              </p>
              {canPromoteStudents && !isStaffRoom && (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Tap Make Admin to promote students
                </p>
              )}
            </div>

            {members.length > 6 && (
              <div className="relative mt-2.5">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search members…"
                  className="h-9 w-full rounded-xl bg-zinc-100 pl-9 pr-3 text-xs text-zinc-900 placeholder:text-zinc-500 focus:outline-none dark:bg-white/[0.08] dark:text-white"
                />
              </div>
            )}

            <div className="mt-3 space-y-2">
              {filteredMembers.map((member) => {
                const isAdmin = member.isStaffAdmin || member.isPromotedStudentAdmin
                const isBusy = busyStudentId === member.id
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-2.5 rounded-2xl px-2 py-1.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-xs font-bold text-zinc-700 dark:bg-[#262626] dark:text-zinc-200">
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.name}
                            className="size-full object-cover object-top"
                          />
                        ) : (
                          member.name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-semibold">{member.name}</p>
                          {isAdmin && (
                            <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-[#0095F6]">
                              <ShieldCheck className="size-3.5" aria-hidden="true" />
                              <span>Admin</span>
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                          {member.subtitle}
                        </p>
                      </div>
                    </div>

                    {canPromoteStudents && !isStaffRoom && member.role === 'student' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={async () => {
                          setBusyStudentId(member.id)
                          try {
                            await onToggleStudentAdmin(member.id, !member.isPromotedStudentAdmin)
                          } finally {
                            setBusyStudentId(null)
                          }
                        }}
                        className={cn(
                          'inline-flex h-8 shrink-0 items-center gap-1 rounded-xl px-2.5 text-[11px] font-semibold transition-colors whitespace-nowrap disabled:opacity-50',
                          member.isPromotedStudentAdmin
                            ? 'bg-rose-500/12 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400'
                            : 'bg-[#0095F6]/12 text-[#0095F6] hover:bg-[#0095F6]/20',
                        )}
                      >
                        {isBusy ? (
                          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                        ) : member.isPromotedStudentAdmin ? (
                          <Check className="size-3" aria-hidden="true" />
                        ) : (
                          <Shield className="size-3" aria-hidden="true" />
                        )}
                        <span>{member.isPromotedStudentAdmin ? 'Remove Admin' : 'Make Admin'}</span>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <ImageCropperModal
        open={Boolean(rawCropUrl)}
        imageSrc={rawCropUrl}
        title="Crop Group Photo"
        subtitle="Drag & zoom to center your group picture"
        confirmLabel="Save Group Photo"
        onCancel={() => {
          if (rawCropUrl && rawCropUrl.startsWith('blob:')) URL.revokeObjectURL(rawCropUrl)
          setRawCropUrl(null)
        }}
        onConfirm={handleConfirmGroupCrop}
      />
    </div>,
    document.body,
  )
}
