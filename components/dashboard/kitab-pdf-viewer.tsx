'use client'

import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Layers,
  Loader2,
  Maximize2,
  Minimize2,
  Printer,
  RotateCcw,
  Share2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { downloadBlobOnDevice, printPdfBlobOnDevice } from '@/lib/mobile-pdf'
import { cn } from '@/lib/utils'

// Configure PDF.js worker using Vite asset URL so it works offline & inside sandboxed iframes
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
}

export async function getPdfBlobPageCount(blob: Blob): Promise<number | null> {
  try {
    const buffer = await blob.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
    })
    const pdfDoc = await loadingTask.promise
    const count = pdfDoc.numPages
    void loadingTask.destroy()
    return count > 0 ? count : null
  } catch {
    return null
  }
}

interface PdfSinglePageCanvasProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy
  pageNumber: number
  containerWidth: number
  zoom: number
}

function PdfSinglePageCanvas({
  pdfDoc,
  pageNumber,
  containerWidth,
  zoom,
}: PdfSinglePageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [rendering, setRendering] = useState(true)
  const [pageError, setPageError] = useState(false)

  useEffect(() => {
    let cancelled = false
    let renderTask: pdfjsLib.RenderTask | null = null

    async function renderPage() {
      if (!canvasRef.current) return
      setRendering(true)
      setPageError(false)

      try {
        const page = await pdfDoc.getPage(pageNumber)
        if (cancelled || !canvasRef.current) return

        const unscaledViewport = page.getViewport({ scale: 1 })
        const safeWidth = Math.max(260, containerWidth - 24)
        const baseScale = safeWidth / Math.max(1, unscaledViewport.width)
        const finalScale = baseScale * zoom
        const viewport = page.getViewport({ scale: finalScale })

        const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2.5) : 1.5
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        if (!context) return

        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`

        context.setTransform(dpr, 0, 0, dpr, 0, 0)
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, viewport.width, viewport.height)

        renderTask = page.render({
          canvasContext: context,
          canvas,
          viewport,
        })

        await renderTask.promise
        if (!cancelled) {
          setRendering(false)
        }
      } catch (err) {
        const name = (err as { name?: string })?.name
        if (name === 'RenderingCancelledException' || cancelled) return
        setPageError(true)
        setRendering(false)
      }
    }

    void renderPage()

    return () => {
      cancelled = true
      if (renderTask) {
        try {
          renderTask.cancel()
        } catch {
          // Ignore cancel error
        }
      }
    }
  }, [pdfDoc, pageNumber, containerWidth, zoom])

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative overflow-hidden rounded-lg border border-slate-300 bg-white shadow-md">
        <canvas ref={canvasRef} className="block max-w-none bg-white" />
        {rendering ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-full bg-slate-900/85 px-3 py-1.5 text-xs font-medium text-white shadow">
              <Loader2 className="size-3.5 animate-spin text-lime" aria-hidden="true" />
              <span>Rendering Page {pageNumber}...</span>
            </div>
          </div>
        ) : null}
        {pageError ? (
          <div className="flex h-48 w-72 items-center justify-center bg-white p-4 text-center text-xs text-slate-600">
            Unable to render page {pageNumber}.
          </div>
        ) : null}
      </div>
      <span className="mt-1.5 rounded-full bg-background/90 px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground shadow-xs border border-border/60">
        Page {pageNumber}
      </span>
    </div>
  )
}

export interface KitabPdfViewerProps {
  blob: Blob | null
  title: string
  arabicTitle?: string
  author: string
  categoryLabel: string
  classBatch: string
  storagePath: string
  summary: string
  excerpt?: {
    chapterTitle: string
    arabicMatn: string
    transliteration: string
    malayalamMeaning: string
    englishCommentary: string
  }
  isFullScreen?: boolean
  onToggleFullScreen?: () => void
  onDownloadPdf?: () => void
}

export function KitabPdfCanvasViewer({
  blob,
  title,
  arabicTitle,
  author,
  categoryLabel,
  classBatch,
  storagePath,
  summary,
  excerpt,
  isFullScreen = false,
  onToggleFullScreen,
  onDownloadPdf,
}: KitabPdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = useState<number>(640)
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [viewMode, setViewMode] = useState<'scroll' | 'single'>('scroll')
  const [zoom, setZoom] = useState<number>(1)
  const [loadingDoc, setLoadingDoc] = useState<boolean>(true)
  const [loadError, setLoadError] = useState<boolean>(false)
  const [maxRenderedScrollPages, setMaxRenderedScrollPages] = useState<number>(12)

  // Track container width for crisp responsive mobile & desktop rendering
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const updateWidth = () => {
      if (el.clientWidth > 0) {
        setContainerWidth(el.clientWidth)
      }
    }
    updateWidth()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateWidth())
      observer.observe(el)
      return () => observer.disconnect()
    } else {
      window.addEventListener('resize', updateWidth)
      return () => window.removeEventListener('resize', updateWidth)
    }
  }, [isFullScreen])

  // Load PDF binary from Blob into PDF.js
  useEffect(() => {
    let cancelled = false
    let activeLoadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null

    async function loadPdfFromBlob() {
      if (!blob) {
        setLoadingDoc(false)
        return
      }
      setLoadingDoc(true)
      setLoadError(false)
      setCurrentPage(1)
      setMaxRenderedScrollPages(12)

      try {
        const arrayBuffer = await blob.arrayBuffer()
        if (cancelled) return

        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
        })
        activeLoadingTask = loadingTask
        const doc = await loadingTask.promise
        if (cancelled) {
          void loadingTask.destroy()
          return
        }

        setPdfDoc(doc)
        setNumPages(doc.numPages)
        setLoadingDoc(false)
      } catch {
        if (!cancelled) {
          setLoadError(true)
          setLoadingDoc(false)
        }
      }
    }

    void loadPdfFromBlob()

    return () => {
      cancelled = true
      if (activeLoadingTask) {
        void activeLoadingTask.destroy()
      }
    }
  }, [blob])

  async function handleShareOrDownloadPdf() {
    const safeName =
      storagePath.split('/').pop() ||
      `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'kitab'}.pdf`
    if (blob) {
      await downloadBlobOnDevice(blob, safeName, 'application/pdf')
      return
    }
    onDownloadPdf?.()
  }

  async function handlePrintPdf() {
    if (!blob) {
      onDownloadPdf?.()
      return
    }
    const safeName =
      storagePath.split('/').pop() ||
      `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'kitab'}.pdf`
    await printPdfBlobOnDevice(blob, safeName)
  }

  const pagesToRenderInScroll = Math.min(numPages, maxRenderedScrollPages)

  return (
    <div className="flex flex-col gap-2.5">
      {/* Interactive PDF Viewer Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/80 px-3 py-2 text-xs shadow-xs">
        {/* Page Navigation & View Mode */}
        <div className="flex flex-wrap items-center gap-1.5">
          {numPages > 0 && !loadError ? (
            <>
              <div className="inline-flex items-center rounded-lg border border-border bg-card p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('single')
                    setCurrentPage((p) => Math.max(1, p - 1))
                  }}
                  disabled={currentPage <= 1}
                  aria-label="Previous page"
                  className="flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <span className="px-2 font-mono text-[11px] font-semibold tabular-nums text-foreground">
                  {viewMode === 'scroll' ? `${numPages} ${numPages === 1 ? 'Page' : 'Pages'}` : `${currentPage} / ${numPages}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('single')
                    setCurrentPage((p) => Math.min(numPages, p + 1))
                  }}
                  disabled={currentPage >= numPages}
                  aria-label="Next page"
                  className="flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted disabled:opacity-40"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </div>

              {numPages > 1 ? (
                <button
                  type="button"
                  onClick={() => setViewMode((m) => (m === 'scroll' ? 'single' : 'scroll'))}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-colors',
                    viewMode === 'scroll'
                      ? 'border-lime/50 bg-lime/15 text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Layers className="size-3.5 text-lime" aria-hidden="true" />
                  <span>{viewMode === 'scroll' ? 'All Pages Scroll' : 'Single Page'}</span>
                </button>
              ) : null}
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
              <FileText className="size-3.5 text-lime" aria-hidden="true" />
              <span>Built-in PDF Reader</span>
            </span>
          )}
        </div>

        {/* Zoom & Full-Screen Controls */}
        <div className="flex items-center gap-1.5">
          <div className="inline-flex items-center rounded-lg border border-border bg-card p-0.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.2) * 10) / 10))}
              disabled={zoom <= 0.6}
              aria-label="Zoom out"
              className="flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted disabled:opacity-40"
            >
              <ZoomOut className="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              title="Reset zoom to Fit Width"
              className="px-2 font-mono text-[11px] font-semibold tabular-nums text-foreground hover:text-lime"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.2, Math.round((z + 0.2) * 10) / 10))}
              disabled={zoom >= 2.2}
              aria-label="Zoom in"
              className="flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted disabled:opacity-40"
            >
              <ZoomIn className="size-3.5" aria-hidden="true" />
            </button>
          </div>

          {zoom !== 1 ? (
            <button
              type="button"
              onClick={() => setZoom(1)}
              aria-label="Reset zoom"
              className="flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}

          {onToggleFullScreen ? (
            <button
              type="button"
              onClick={onToggleFullScreen}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[11px] font-medium text-foreground transition-colors hover:border-lime/40 hover:bg-muted"
            >
              {isFullScreen ? (
                <>
                  <Minimize2 className="size-3.5 text-lime" aria-hidden="true" />
                  <span className="hidden sm:inline">Exit Full Screen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="size-3.5 text-lime" aria-hidden="true" />
                  <span className="hidden sm:inline">Full Screen</span>
                </>
              )}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => void handlePrintPdf()}
            title="Print Kitab PDF"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[11px] font-medium text-foreground transition-colors hover:border-lime/40 hover:bg-muted"
          >
            <Printer className="size-3.5 text-lime" aria-hidden="true" />
            <span className="hidden sm:inline">Print</span>
          </button>

          <button
            type="button"
            onClick={() => void handleShareOrDownloadPdf()}
            title="Download or Open in External PDF App"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[11px] font-medium text-foreground transition-colors hover:border-lime/40 hover:bg-muted"
          >
            <Share2 className="size-3.5 text-lime" aria-hidden="true" />
            <span className="hidden sm:inline">Save / Open</span>
          </button>
        </div>
      </div>

      {/* Main Scrollable PDF Viewport */}
      <div
        ref={containerRef}
        className={cn(
          'w-full overflow-auto rounded-xl border border-border bg-slate-900/45 p-3 sm:p-4',
          isFullScreen ? 'h-[calc(100svh-13.5rem)]' : 'h-[58svh]',
        )}
      >
        {loadingDoc ? (
          <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="size-7 animate-spin text-lime" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Loading PDF Preview...
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{title}</p>
            </div>
          </div>
        ) : pdfDoc && numPages > 0 && !loadError ? (
          <div className="flex flex-col items-center gap-5">
            {viewMode === 'single' ? (
              <PdfSinglePageCanvas
                pdfDoc={pdfDoc}
                pageNumber={currentPage}
                containerWidth={containerWidth}
                zoom={zoom}
              />
            ) : (
              <>
                {Array.from({ length: pagesToRenderInScroll }, (_, idx) => idx + 1).map(
                  (pageNum) => (
                    <PdfSinglePageCanvas
                      key={pageNum}
                      pdfDoc={pdfDoc}
                      pageNumber={pageNum}
                      containerWidth={containerWidth}
                      zoom={zoom}
                    />
                  ),
                )}

                {numPages > pagesToRenderInScroll ? (
                  <button
                    type="button"
                    onClick={() => setMaxRenderedScrollPages((prev) => prev + 12)}
                    className="my-2 inline-flex h-10 items-center gap-2 rounded-xl border border-lime/40 bg-lime/15 px-5 text-xs font-semibold text-foreground transition-colors hover:bg-lime/25"
                  >
                    Load More Pages ({pagesToRenderInScroll} of {numPages} shown)
                  </button>
                ) : null}
              </>
            )}
          </div>
        ) : (
          /* Clean Built-in Academic Document Sheet Fallback (if a non-standard PDF is loaded) */
          <div className="mx-auto max-w-2xl rounded-xl border border-slate-300 bg-white p-6 text-slate-900 shadow-lg sm:p-8">
            <div className="border-b-2 border-emerald-800 pb-4">
              <p className="text-[11px] font-bold tracking-widest text-emerald-800 uppercase">
                ICS Academy Manhappatta • Dawa College Digital Library
              </p>
              <h4 className="mt-1.5 text-lg font-bold text-slate-900 sm:text-xl">{title}</h4>
              {arabicTitle ? (
                <p dir="rtl" className="font-arabic mt-1 text-base font-semibold text-emerald-950">
                  {arabicTitle}
                </p>
              ) : null}
              <p className="mt-1 text-xs font-medium text-slate-600">
                Author: <span className="font-semibold text-slate-900">{author}</span> •{' '}
                {categoryLabel} • {classBatch}
              </p>
            </div>

            <div className="mt-4 space-y-4 text-xs leading-relaxed text-slate-700 sm:text-sm">
              <div>
                <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                  Syllabus Overview & Summary
                </p>
                <p className="mt-1 text-slate-800">{summary}</p>
              </div>

              {excerpt ? (
                <>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
                    <p className="text-xs font-bold text-emerald-900">{excerpt.chapterTitle}</p>
                    <p
                      dir="rtl"
                      className="font-arabic mt-2 text-base leading-loose text-slate-900"
                    >
                      {excerpt.arabicMatn}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                      Malayalam Meaning
                    </p>
                    <p className="font-malayalam mt-1 text-slate-800">{excerpt.malayalamMeaning}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                      Scholarly Commentary
                    </p>
                    <p className="mt-1 text-slate-800">{excerpt.englishCommentary}</p>
                  </div>
                </>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500">
                <span className="font-mono">{storagePath}</span>
                {onDownloadPdf ? (
                  <button
                    type="button"
                    onClick={onDownloadPdf}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-900"
                  >
                    <Download className="size-3.5" aria-hidden="true" />
                    Download PDF File
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
