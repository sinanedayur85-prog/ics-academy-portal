'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, Check, ImagePlus, Loader2, ShieldAlert, X } from 'lucide-react'
import {
  type Student,
  updateStudentProfilePhoto,
} from '@/components/dashboard/data'

type StudentProfilePhotoModalProps = {
  student: Student
  open: boolean
  onClose: () => void
  onPhotoUpdated?: (newAvatarUrl: string) => void
}

async function compressProfilePhotoToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please select a valid image file.'))
      return
    }
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const targetSize = 512
        const canvas = document.createElement('canvas')
        canvas.width = targetSize
        canvas.height = targetSize
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(objectUrl)
          reject(new Error('Unable to process image on this device.'))
          return
        }

        // Center-crop to square with slight upper bias for portraits so faces stay centered
        const srcWidth = img.naturalWidth || img.width
        const srcHeight = img.naturalHeight || img.height
        const cropSide = Math.min(srcWidth, srcHeight)
        const sx = Math.max(0, (srcWidth - cropSide) / 2)
        const sy =
          srcHeight > srcWidth
            ? Math.max(0, (srcHeight - cropSide) * 0.28)
            : Math.max(0, (srcHeight - cropSide) / 2)

        ctx.fillStyle = '#0B1014'
        ctx.fillRect(0, 0, targetSize, targetSize)
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, sx, sy, cropSide, cropSide, 0, 0, targetSize, targetSize)

        let dataUrl = canvas.toDataURL('image/jpeg', 0.84)
        // Ensure compact storage & fast sync across devices
        if (dataUrl.length > 95_000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.72)
        }
        URL.revokeObjectURL(objectUrl)
        resolve(dataUrl)
      } catch (err) {
        URL.revokeObjectURL(objectUrl)
        reject(err instanceof Error ? err : new Error('Failed to process photo.'))
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read the selected photo. Please try another image.'))
    }
    img.src = objectUrl
  })
}

export function StudentProfilePhotoModal({
  student,
  open,
  onClose,
  onPhotoUpdated,
}: StudentProfilePhotoModalProps) {
  const [mounted, setMounted] = useState(false)
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [savedToast, setSavedToast] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      setPendingPreviewUrl(null)
      setErrorMessage(null)
      setSavedToast(false)
      setIsProcessing(false)
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open || !mounted) return null

  const activePhotoUrl = pendingPreviewUrl || student.avatarUrl || ''
  const hasPhoto = Boolean(activePhotoUrl)

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset input so selecting the same file again still triggers onChange
    event.target.value = ''
    if (!file) return

    setErrorMessage(null)
    setSavedToast(false)
    setIsProcessing(true)
    try {
      const compressed = await compressProfilePhotoToDataUrl(file)
      setPendingPreviewUrl(compressed)
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to load that photo. Please try another.',
      )
    } finally {
      setIsProcessing(false)
    }
  }

  function handleSavePhoto() {
    if (!pendingPreviewUrl) return
    const ok = updateStudentProfilePhoto(student.id, pendingPreviewUrl)
    if (!ok) {
      setErrorMessage('Please choose a valid photo before saving.')
      return
    }
    const savedUrl = pendingPreviewUrl
    setPendingPreviewUrl(null)
    setErrorMessage(null)
    setSavedToast(true)
    onPhotoUpdated?.(savedUrl)
    window.setTimeout(() => {
      setSavedToast(false)
    }, 2600)
  }

  function openPhotoPicker() {
    setErrorMessage(null)
    fileInputRef.current?.click()
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${student.name} profile photo`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !pendingPreviewUrl) {
          onClose()
        }
      }}
      className="fixed inset-0 z-[130] flex flex-col bg-black/95 text-white backdrop-blur-md animate-in fade-in-0 duration-200"
      style={{
        paddingTop: 'var(--safe-top, 0px)',
        paddingBottom: 'var(--safe-bottom, 0px)',
      }}
    >
      {/* Hidden file picker — gallery / camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* Top Header Bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold text-white sm:text-lg">
            {student.name}
          </p>
          <p className="truncate text-xs text-white/65">
            Class {student.className} • {student.admissionNo}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close full screen profile photo"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      {/* Center Full-Screen Photo Stage */}
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget && !pendingPreviewUrl) {
            onClose()
          }
        }}
        className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-3"
      >
        {isProcessing ? (
          <div className="flex flex-col items-center gap-3 text-white/80">
            <Loader2 className="size-10 animate-spin text-[#38BDF8]" aria-hidden="true" />
            <p className="text-sm font-medium">Preparing photo…</p>
          </div>
        ) : hasPhoto ? (
          <div className="relative flex max-h-full max-w-full flex-col items-center justify-center">
            <img
              src={activePhotoUrl}
              alt={`${student.name} profile photo`}
              className="max-h-[68svh] w-auto max-w-[92vw] rounded-2xl object-contain shadow-[0_24px_80px_rgba(0,0,0,0.75)] ring-1 ring-white/15 animate-in zoom-in-95 duration-200"
            />
            {pendingPreviewUrl ? (
              <span className="mt-3 rounded-full bg-[#0095F6]/20 px-3 py-1 text-xs font-semibold text-[#38BDF8] ring-1 ring-[#38BDF8]/30">
                New Photo Preview — Tap Save to apply
              </span>
            ) : null}
          </div>
        ) : (
          <div className="flex max-w-sm flex-col items-center rounded-3xl border border-white/15 bg-white/[0.06] px-6 py-8 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-[#0095F6]/20 text-[#38BDF8]">
              <ImagePlus className="size-8" aria-hidden="true" />
            </div>
            <p className="mt-4 font-display text-lg font-semibold text-white">
              Profile Photo Required
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-white/70">
              Every student must have a profile photo. Please upload a clear photo now.
            </p>
          </div>
        )}

        {savedToast ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/40 animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
          >
            <Check className="size-4" aria-hidden="true" />
            Profile photo updated
          </div>
        ) : null}

        {errorMessage ? (
          <div
            role="alert"
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-red-500/20 px-4 py-2.5 text-xs font-medium text-red-200 ring-1 ring-red-400/40"
          >
            <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        ) : null}
      </div>

      {/* Bottom Thumb-Zone Action Controls (Change/Upload Only — No Remove Option) */}
      <div className="shrink-0 border-t border-white/10 bg-black/80 px-4 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-md flex-col gap-2.5">
          {pendingPreviewUrl ? (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={openPhotoPicker}
                disabled={isProcessing}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/12 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/20 active:scale-[0.98] disabled:opacity-50"
              >
                <Camera className="size-4" aria-hidden="true" />
                Choose Another
              </button>
              <button
                type="button"
                onClick={handleSavePhoto}
                disabled={isProcessing}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#0095F6] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0084DC] active:scale-[0.98] disabled:opacity-50"
              >
                <Check className="size-4" aria-hidden="true" />
                Save Photo
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openPhotoPicker}
              disabled={isProcessing}
              className="flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl bg-[#0095F6] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0084DC] active:scale-[0.98] disabled:opacity-50"
            >
              <Camera className="size-4.5" aria-hidden="true" />
              {hasPhoto ? 'Change Profile Photo' : 'Upload Profile Photo'}
            </button>
          )}

          <p className="text-center text-[11px] text-white/55">
            A profile photo is mandatory for all students and cannot be removed.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
