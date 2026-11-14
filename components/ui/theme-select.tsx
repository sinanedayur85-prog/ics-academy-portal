import React, { useState, useRef, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, Check, Search } from "lucide-react"

interface ParsedOption {
  value: string
  label: string
  disabled?: boolean
}

function extractOptions(children: React.ReactNode): ParsedOption[] {
  const options: ParsedOption[] = []

  const traverse = (node: React.ReactNode) => {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) return

      if (child.type === "option") {
        const props = child.props as {
          value?: string | number
          disabled?: boolean
          children?: React.ReactNode
        }
        const label =
          typeof props.children === "string" || typeof props.children === "number"
            ? String(props.children)
            : React.Children.toArray(props.children)
                .map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : ""))
                .join("")
        const value = props.value !== undefined ? String(props.value) : label
        options.push({
          value,
          label: label.trim(),
          disabled: Boolean(props.disabled),
        })
      } else if (child.props && (child.props as { children?: React.ReactNode }).children) {
        traverse((child.props as { children?: React.ReactNode }).children)
      }
    })
  }

  traverse(children)
  return options
}

export interface ThemeSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  children?: React.ReactNode
}

export function ThemeSelect({
  value,
  defaultValue,
  onChange,
  children,
  className = "",
  disabled = false,
  id,
  name,
  required,
  "aria-label": ariaLabel,
}: ThemeSelectProps) {
  const options = useMemo(() => extractOptions(children), [children])
  const [internalValue, setInternalValue] = useState<string>(() => {
    if (value !== undefined) return String(value)
    if (defaultValue !== undefined) return String(defaultValue)
    return options[0]?.value ?? ""
  })

  const currentValue = value !== undefined ? String(value) : internalValue
  const selectedOption =
    options.find((opt) => opt.value === currentValue) || options[0] || { value: "", label: "" }

  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [menuStyle, setMenuStyle] = useState<{
    top?: number
    bottom?: number
    left: number
    width: number
    maxHeight: number
  }>({ left: 0, width: 220, maxHeight: 280 })

  const showSearch = options.length > 10

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options
    const q = searchQuery.toLowerCase().trim()
    return options.filter((opt) => opt.label.toLowerCase().includes(q))
  }, [options, searchQuery])

  const updatePosition = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    const margin = 12

    const desiredWidth = Math.max(rect.width, 200)
    const width = Math.min(desiredWidth, viewportW - margin * 2)
    let left = rect.left
    if (left + width > viewportW - margin) {
      left = Math.max(margin, viewportW - width - margin)
    }
    if (left < margin) left = margin

    const spaceBelow = viewportH - rect.bottom - margin
    const spaceAbove = rect.top - margin

    if (spaceBelow >= 220 || spaceBelow >= spaceAbove) {
      setMenuStyle({
        top: rect.bottom + 6,
        left,
        width,
        maxHeight: Math.min(320, Math.max(160, spaceBelow - 8)),
      })
    } else {
      setMenuStyle({
        bottom: viewportH - rect.top + 6,
        left,
        width,
        maxHeight: Math.min(320, Math.max(160, spaceAbove - 8)),
      })
    }
  }

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("")
      return
    }
    updatePosition()

    const handleScrollOrResize = (e: Event) => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) {
        return
      }
      updatePosition()
    }

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (triggerRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setIsOpen(false)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    window.addEventListener("resize", handleScrollOrResize)
    window.addEventListener("scroll", handleScrollOrResize, true)
    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("touchstart", handlePointerDown, { passive: true })
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("resize", handleScrollOrResize)
      window.removeEventListener("scroll", handleScrollOrResize, true)
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("touchstart", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  const handleSelect = (newValue: string) => {
    if (value === undefined) {
      setInternalValue(newValue)
    }
    if (onChange) {
      const syntheticEvent = {
        target: { value: newValue, name: name || "", id: id || "" },
        currentTarget: { value: newValue, name: name || "", id: id || "" },
        preventDefault: () => {},
        stopPropagation: () => {},
      } as unknown as React.ChangeEvent<HTMLSelectElement>
      onChange(syntheticEvent)
    }
    setIsOpen(false)
  }

  const cleanedClassName = className
    .replace(/\bappearance-none\b/g, "")
    .replace(/\bpr-8\b/g, "")
    .replace(/\bpr-7\b/g, "")
    .trim()

  return (
    <>
      {name && <input type="hidden" name={name} value={currentValue} required={required} />}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev)
        }}
        className={`inline-flex items-center justify-between gap-2 text-left transition-all select-none ${cleanedClassName} ${
          isOpen
            ? "ring-2 ring-lime/40 border-lime/60 dark:border-lime/60"
            : ""
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className="truncate flex-1">{selectedOption?.label ?? ""}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-emerald-600 dark:text-lime" : ""
          }`}
        />
      </button>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: "fixed",
              top: menuStyle.top !== undefined ? `${menuStyle.top}px` : undefined,
              bottom: menuStyle.bottom !== undefined ? `${menuStyle.bottom}px` : undefined,
              left: `${menuStyle.left}px`,
              width: `${menuStyle.width}px`,
              zIndex: 9999,
            }}
            className="overflow-hidden rounded-2xl border border-slate-200/90 dark:border-[#252a34] bg-white/98 dark:bg-[#111318]/98 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.35)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.75)] animate-in fade-in zoom-in-95 duration-150"
          >
            {showSearch && (
              <div className="p-2 border-b border-slate-100 dark:border-[#1e222b] bg-slate-50/60 dark:bg-[#151820]">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full rounded-xl bg-white dark:bg-[#0c0e12] border border-slate-200 dark:border-[#252a34] pl-8 pr-3 py-1.5 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 dark:focus:border-lime"
                  />
                </div>
              </div>
            )}

            <div
              style={{ maxHeight: `${menuStyle.maxHeight - (showSearch ? 48 : 0)}px` }}
              className="overflow-y-auto overscroll-contain p-1.5 space-y-0.5 custom-scrollbar"
            >
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                  No matching options
                </div>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = opt.value === currentValue
                  return (
                    <button
                      key={`${opt.value}-${idx}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={opt.disabled}
                      onClick={() => {
                        if (!opt.disabled) handleSelect(opt.value)
                      }}
                      className={`w-full flex items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors ${
                        opt.disabled
                          ? "opacity-40 cursor-not-allowed text-slate-400 dark:text-slate-600"
                          : isSelected
                            ? "bg-emerald-500/12 dark:bg-lime/15 text-emerald-700 dark:text-lime border border-emerald-500/25 dark:border-lime/30"
                            : "text-slate-700 dark:text-slate-200 hover:bg-slate-100/90 dark:hover:bg-[#1b1f28] active:bg-slate-200/70 dark:active:bg-[#232834]"
                      }`}
                    >
                      <span className="leading-snug break-words pr-1">{opt.label}</span>
                      {isSelected && (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 dark:bg-lime text-white dark:text-[#09120e]">
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </span>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
