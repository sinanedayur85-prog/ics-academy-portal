'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Loader2, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react'

export interface ImageCropperModalProps {
  open: boolean
  imageSrc: string | null
  title?: string
  subtitle?: string
  confirmLabel?: string
  outputSize?: number
  maxDataUrlBytes?: number
  onCancel: () => void
  onConfirm: (croppedDataUrl: string) => void | Promise<void>
}

const STAGE_SIZE = 288

export function ImageCropperModal({
  open,
  imageSrc,
  title = 'Crop & Adjust Photo',
  subtitle = 'Drag to reposition · Pinch or slide to zoom',
  confirmLabel = 'Apply Photo',
  outputSize = 512,
  maxDataUrlBytes = 135_000,
  onCancel,
  onConfirm,
}: ImageCropperModalProps) {
  const [mounted, setMounted] = useState(false)
  const [imgMeta, setImgMeta] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isExporting, setIsExporting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const imgRef = useRef<HTMLImageElement | null>(null)
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open || !imageSrc) {
      setImgMeta(null)
      setZoom(1)
      setRotation(0)
      setOffset({ x: 0, y: 0 })
      setIsExporting(false)
      setLoadError(null)
      pointersRef.current.clear()
      dragStartRef.current = null
      pinchStartRef.current = null
      return
    }

    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      imgRef.current = img
      const w = img.naturalWidth || img.width || 1
      const h = img.naturalHeight || img.height || 1
      setImgMeta({ w, h })
      setZoom(1)
      setRotation(0)
      setOffset({ x: 0, y: 0 })
      setLoadError(null)
    }
    img.onerror = () => {
      if (cancelled) return
      setLoadError('Could not load this image. Please try another photo.')
    }
    img.src = imageSrc

    return () => {
      cancelled = true
    }
  }, [open, imageSrc])

  // Compute effective base scale so the shorter rotated image edge fills STAGE_SIZE
  const getBaseMetrics = useCallback(
    (meta: { w: number; h: number }, rotDeg: number) => {
      const swapped = Math.abs(rotDeg % 180) === 90
      const effW = swapped ? meta.h : meta.w
      const effH = swapped ? meta.w : meta.h
      const baseScale = Math.max(STAGE_SIZE / effW, STAGE_SIZE / effH)
      return { effW, effH, baseScale }
    },
    [],
  )

  const clampOffset = useCallback(
    (x: number, y: number, targetZoom: number, rotDeg: number) => {
      if (!imgMeta) return { x: 0, y: 0 }
      const { effW, effH, baseScale } = getBaseMetrics(imgMeta, rotDeg)
      const dispW = effW * baseScale * targetZoom
      const dispH = effH * baseScale * targetZoom
      const maxX = Math.max(0, (dispW - STAGE_SIZE) / 2)
      const maxY = Math.max(0, (dispH - STAGE_SIZE) / 2)
      return {
        x: Math.max(-maxX, Math.min(maxX, x)),
        y: Math.max(-maxY, Math.min(maxY, y)),
      }
    },
    [imgMeta, getBaseMetrics],
  )

  const handleZoomChange = (nextZoom: number) => {
    const clampedZoom = Math.max(1, Math.min(3.5, nextZoom))
    setZoom(clampedZoom)
    setOffset((prev) => clampOffset(prev.x, prev.y, clampedZoom, rotation))
  }

  const handleRotate = () => {
    const nextRot = (rotation + 90) % 360
    setRotation(nextRot)
    setOffset((prev) => clampOffset(prev.x, prev.y, zoom, nextRot))
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointersRef.current.size === 1) {
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        ox: offset.x,
        oy: offset.y,
      }
      pinchStartRef.current = null
    } else if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values())
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
      pinchStartRef.current = { dist: Math.max(10, dist), zoom }
      dragStartRef.current = null
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointersRef.current.size === 2 && pinchStartRef.current) {
      const pts = Array.from(pointersRef.current.values())
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
      const factor = dist / pinchStartRef.current.dist
      handleZoomChange(pinchStartRef.current.zoom * factor)
    } else if (pointersRef.current.size === 1 && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      setOffset(
        clampOffset(dragStartRef.current.ox + dx, dragStartRef.current.oy + dy, zoom, rotation),
      )
    }
  }

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size === 1) {
      const remaining = Array.from(pointersRef.current.values())[0]
      dragStartRef.current = {
        x: remaining.x,
        y: remaining.y,
        ox: offset.x,
        oy: offset.y,
      }
      pinchStartRef.current = null
    } else {
      dragStartRef.current = null
      pinchStartRef.current = null
    }
  }

  const handleConfirmCrop = async () => {
    if (!imgRef.current || !imgMeta || isExporting) return
    setIsExporting(true)
    try {
      const { baseScale } = getBaseMetrics(imgMeta, rotation)
      const renderCropped = (size: number, quality: number) => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas unavailable')

        ctx.fillStyle = '#0B1014'
        ctx.fillRect(0, 0, size, size)
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'

        const ratio = size / STAGE_SIZE
        const totalScale = baseScale * zoom * ratio

        ctx.save()
        ctx.translate(size / 2 + offset.x * ratio, size / 2 + offset.y * ratio)
        ctx.rotate((rotation * Math.PI) / 180)
        ctx.scale(totalScale, totalScale)
        ctx.drawImage(imgRef.current!, -imgMeta.w / 2, -imgMeta.h / 2)
        ctx.restore()

        return canvas.toDataURL('image/jpeg', quality)
      }

      let dataUrl = renderCropped(outputSize, 0.86)
      if (dataUrl.length > maxDataUrlBytes) {
        dataUrl = renderCropped(outputSize, 0.74)
      }
      if (dataUrl.length > maxDataUrlBytes * 1.25) {
        dataUrl = renderCropped(Math.min(384, outputSize), 0.7)
      }
      if (dataUrl.length > maxDataUrlBytes * 1.5) {
        dataUrl = renderCropped(320, 0.64)
      }

      await onConfirm(dataUrl)
    } catch {
      setLoadError('Unable to crop this photo. Please try another image.')
    } finally {
      setIsExporting(false)
    }
  }

  if (!open || !mounted || !imageSrc) return null

  const metrics = imgMeta ? getBaseMetrics(imgMeta, rotation) : null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[150] flex flex-col bg-black/96 text-white backdrop-blur-md animate-in fade-in-0 duration-150"
      style={{
        paddingTop: 'var(--safe-top, 0px)',
        paddingBottom: 'var(--safe-bottom, 0px)',
      }}
    >
      {/* Top Bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <div className="min-w-0">
          <h3 className="truncate font-poppins text-base font-semibold text-white">{title}</h3>
          <p className="truncate text-xs text-white/60">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={isExporting}
          aria-label="Cancel crop"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95 disabled:opacity-50"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      {/* Interactive Circular Crop Stage */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-2">
        {loadError ? (
          <div className="max-w-xs rounded-2xl bg-red-500/15 px-5 py-4 text-center text-xs text-red-200 ring-1 ring-red-400/30">
            {loadError}
          </div>
        ) : !metrics ? (
          <div className="flex flex-col items-center gap-3 text-white/75">
            <Loader2 className="size-8 animate-spin text-[#0095F6]" aria-hidden="true" />
            <p className="text-xs font-medium">Loading photo…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5">
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUpOrCancel}
              onPointerCancel={handlePointerUpOrCancel}
              onWheel={(e) => {
                e.preventDefault()
                handleZoomChange(zoom + (e.deltaY < 0 ? 0.14 : -0.14))
              }}
              className="relative cursor-grab touch-none select-none overflow-hidden rounded-3xl bg-[#0B1014] shadow-[0_24px_80px_rgba(0,0,0,0.85)] ring-1 ring-white/15 active:cursor-grabbing"
              style={{ width: STAGE_SIZE, height: STAGE_SIZE }}
            >
              {/* Transformable Image */}
              <img
                src={imageSrc}
                alt="Crop preview"
                draggable={false}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: imgMeta!.w,
                  height: imgMeta!.h,
                  maxWidth: 'none',
                  transformOrigin: 'center center',
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${metrics.baseScale * zoom})`,
                  willChange: 'transform',
                }}
              />

              {/* Circular Dark Vignette Mask + Crisp Grid */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  boxShadow: 'inset 0 0 0 9999px rgba(0, 0, 0, 0.52)',
                  borderRadius: '9999px',
                  border: '2px solid rgba(255, 255, 255, 0.85)',
                }}
              />
              {/* Subtle rule-of-thirds guide lines inside circle */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-full opacity-25"
              >
                <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white" />
                <div className="absolute top-1/3 left-0 right-0 h-px bg-white" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-white" />
              </div>
            </div>

            {/* Zoom & Rotate Controls */}
            <div className="flex w-full max-w-[300px] items-center gap-3">
              <button
                type="button"
                onClick={() => handleZoomChange(zoom - 0.25)}
                aria-label="Zoom out"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95"
              >
                <ZoomOut className="size-4" aria-hidden="true" />
              </button>
              <input
                type="range"
                min={1}
                max={3.5}
                step={0.02}
                value={zoom}
                onChange={(e) => handleZoomChange(Number(e.target.value))}
                aria-label="Zoom level"
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-[#0095F6]"
              />
              <button
                type="button"
                onClick={() => handleZoomChange(zoom + 0.25)}
                aria-label="Zoom in"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95"
              >
                <ZoomIn className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={handleRotate}
                title="Rotate 90°"
                aria-label="Rotate photo 90 degrees"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95"
              >
                <RotateCw className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="shrink-0 border-t border-white/10 bg-black/85 px-4 py-4 sm:px-6">
        <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isExporting}
            className="flex h-12 items-center justify-center rounded-2xl bg-white/12 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/20 active:scale-[0.98] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirmCrop()}
            disabled={isExporting || !metrics || Boolean(loadError)}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#0095F6] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0084DC] active:scale-[0.98] disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            <span>{isExporting ? 'Cropping…' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
