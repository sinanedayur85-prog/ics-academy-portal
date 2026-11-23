'use client'

import { useEffect, useRef, useState } from 'react'
import { MoreVertical, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DeleteActionMenuProps {
  onConfirmDelete: () => void | Promise<void>
  ariaLabel?: string
  deleteLabel?: string
  cancelLabel?: string
  buttonClassName?: string
  menuAlign?: 'right' | 'left'
  disabled?: boolean
}

/**
 * Safe three-dots (⋮) action menu that prevents accidental one-tap deletions.
 * Tapping the three dots reveals an explicit Delete / Cancel choice.
 */
export function DeleteActionMenu({
  onConfirmDelete,
  ariaLabel = 'More options',
  deleteLabel = 'Delete',
  cancelLabel = 'Cancel',
  buttonClassName,
  menuAlign = 'right',
  disabled = false,
}: DeleteActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  async function handleConfirm() {
    if (busy) return
    setBusy(true)
    try {
      await onConfirmDelete()
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={containerRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        disabled={disabled || busy}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Options"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((prev) => !prev)
        }}
        className={cn(
          'inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0095F6]/50 disabled:opacity-50',
          open && 'bg-muted text-foreground',
          buttonClassName,
        )}
      >
        <MoreVertical className="size-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'absolute top-full z-50 mt-1.5 w-36 overflow-hidden rounded-2xl border border-border/70 bg-popover p-1.5 shadow-lg ring-1 ring-black/5 dark:bg-[#141A1F] dark:ring-white/10',
            menuAlign === 'right' ? 'right-0' : 'left-0',
          )}
        >
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => void handleConfirm()}
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-red-600 transition-colors hover:bg-red-500/12 active:scale-[0.98] disabled:opacity-50 dark:text-red-400"
          >
            <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{busy ? 'Deleting...' : deleteLabel}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => setOpen(false)}
            className="mt-0.5 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.98]"
          >
            <X className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{cancelLabel}</span>
          </button>
        </div>
      )}
    </div>
  )
}
