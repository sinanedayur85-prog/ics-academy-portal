'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, Check, ImagePlus, Loader2, ShieldAlert, X } from 'lucide-react'
import { type Student } from '@/components/dashboard/data'
import { ImageCropperModal } from '@/components/dashboard/image-cropper-modal'
import {
  saveProfilePhotoToFirestore,
  type ProfilePhotoActorRole,
} from '@/components/dashboard/profile-photo-store'

export type ProfilePhotoModalProps = {
  actorId: string
  actorRole: ProfilePhotoActorRole
  name: string
  subtitle: string
  currentAvatarUrl?: string
  mandatoryPolicy?: boolean
  open: boolean
  onClose: () => void
  onPhotoUpdated?: (newAvatarUrl: string) => void
}

type StudentProfilePhotoModalProps = {
  student: Student
  open: boolean
  onClose: () => void
  onPhotoUpdated?: (newAvatarUrl: string) => void
}

export function ProfilePhotoModal({
  actorId,
  actorRole,
  name,
  subtitle,
  currentAvatarUrl,
  mandatoryPolicy = false,
  open,
  onClose,
  onPhotoUpdated,
}: ProfilePhotoModalProps) {
  const [mounted, setMounted] = useState(false)
  const [rawCropSourceUrl, setRawCropSourceUrl] = useState<string | null>(null)
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [savedToast, setSavedToast] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      if (rawCropSourceUrl && rawCropSourceUrl.startsWith('blob:')) {
        URL.revokeObjectURL(rawCropSourceUrl)
      }
      setRawCropSourceUrl(null)
      setPendingPreviewUrl(null)
      setErrorMessage(null)
      setSavedToast(false)
      setIsSaving(false)
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving && !rawCropSourceUrl) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose, isSaving, rawCropSourceUrl])

  if (!open || !mounted) return null

  const activePhotoUrl = pendingPreviewUrl || currentAvatarUrl || ''
  const hasPhoto = Boolean(activePhotoUrl)
  const isProcessing = false

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file.')
      return
    }

    setErrorMessage(null)
    setSavedToast(false)
    if (rawCropSourceUrl && rawCropSourceUrl.startsWith('blob:')) {
      URL.revokeObjectURL(rawCropSourceUrl)
    }
    const objUrl = URL.createObjectURL(file)
    setRawCropSourceUrl(objUrl)
  }

  function handleCancelCrop() {
    if (rawCropSourceUrl && rawCropSourceUrl.startsWith('blob:')) {
      URL.revokeObjectURL(rawCropSourceUrl)
    }
    setRawCropSourceUrl(null)
  }

  function handleConfirmCrop(croppedDataUrl: string) {
    if (rawCropSourceUrl && rawCropSourceUrl.startsWith('blob:')) {
      URL.revokeObjectURL(rawCropSourceUrl)
    }
    setRawCropSourceUrl(null)
    setPendingPreviewUrl(croppedDataUrl)
  }

  async function handleSavePhoto() {
    if (!pendingPreviewUrl || isSaving) return
    setIsSaving(true)
    setErrorMessage(null)
    const savedUrl = pendingPreviewUrl
    try {
      const ok = await saveProfilePhotoToFirestore({
        actorId,
        actorRole,
        actorName: name,
        avatarUrl: savedUrl,
      })
      if (!ok) {
        setErrorMessage('Could not sync photo right now. Check your connection and try again.')
        return
      }
      setPendingPreviewUrl(null)
      setErrorMessage(null)
      setSavedToast(true)
      onPhotoUpdated?.(savedUrl)
      window.setTimeout(() => {
        setSavedToast(false)
      }, 2600)
    } finally {
      setIsSaving(false)
    }
  }

  function openPhotoPicker() {
    setErrorMessage(null)
    fileInputRef.current?.click()
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${name} profile photo`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !pendingPreviewUrl && !isSaving) {
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
            {name}
          </p>
          <p className="truncate text-xs text-white/65">{subtitle}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          aria-label="Close full screen profile photo"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95 disabled:opacity-50"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      {/* Center Full-Screen Photo Stage */}
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget && !pendingPreviewUrl && !isSaving) {
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
              alt={`${name} profile photo`}
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
              {mandatoryPolicy ? 'Profile Photo Required' : 'Add Profile Photo'}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-white/70">
              {mandatoryPolicy
                ? 'Every student must have a profile photo. Please upload a clear photo now.'
                : 'Upload a clear photo so everyone in Chats can recognize you.'}
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
            Profile photo updated for everyone
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
                disabled={isProcessing || isSaving}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/12 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/20 active:scale-[0.98] disabled:opacity-50"
              >
                <Camera className="size-4" aria-hidden="true" />
                Choose Another
              </button>
              <button
                type="button"
                onClick={() => void handleSavePhoto()}
                disabled={isProcessing || isSaving}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#0095F6] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0084DC] active:scale-[0.98] disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="size-4" aria-hidden="true" />
                )}
                {isSaving ? 'Saving…' : 'Save Photo'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openPhotoPicker}
              disabled={isProcessing || isSaving}
              className="flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl bg-[#0095F6] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0084DC] active:scale-[0.98] disabled:opacity-50"
            >
              <Camera className="size-4.5" aria-hidden="true" />
              {hasPhoto ? 'Change Profile Photo' : 'Upload Profile Photo'}
            </button>
          )}

          <p className="text-center text-[11px] text-white/55">
            {mandatoryPolicy
              ? 'A profile photo is mandatory for all students and visible to everyone in Chats.'
              : 'Your profile photo is visible to everyone in Chats.'}
          </p>
        </div>
      </div>

      <ImageCropperModal
        open={Boolean(rawCropSourceUrl)}
        imageSrc={rawCropSourceUrl}
        title="Crop Profile Photo"
        subtitle="Drag to move · Zoom to fit inside the circle"
        confirmLabel="Use Cropped Photo"
        onCancel={handleCancelCrop}
        onConfirm={handleConfirmCrop}
      />
    </div>,
    document.body,
  )
}

export function StudentProfilePhotoModal({
  student,
  open,
  onClose,
  onPhotoUpdated,
}: StudentProfilePhotoModalProps) {
  return (
    <ProfilePhotoModal
      actorId={student.id}
      actorRole="student"
      name={student.name}
      subtitle={`Class ${student.className} • ${student.admissionNo}`}
      currentAvatarUrl={student.avatarUrl}
      mandatoryPolicy
      open={open}
      onClose={onClose}
      onPhotoUpdated={onPhotoUpdated}
    />
  )
}
