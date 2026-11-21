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
        className={`inline-flex items-center justify-between gap-2 text-left transition-all select-none outline-none border-0 ${cleanedClassName} ${
          isOpen ? "bg-accent dark:bg-[#242C33]" : ""
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-[0.985]"}`}
      >
        <span className="truncate flex-1">{selectedOption?.label ?? ""}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 opacity-70 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-[#0077CC] dark:text-[#0095F6]" : ""
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
            className="overflow-hidden rounded-3xl bg-white/98 dark:bg-[#1C2227]/98 backdrop-blur-xl shadow-[0_20px_55px_rgba(0,0,0,0.28)] dark:shadow-[0_24px_65px_rgba(0,0,0,0.78)] animate-in fade-in zoom-in-95 duration-150"
          >
            {showSearch && (
              <div className="p-2.5 bg-[#F3F5F7] dark:bg-[#151B20]">
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 text-[#657786] dark:text-[#8E9AA4] absolute left-3 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full rounded-full bg-white dark:bg-[#1C2227] border-0 pl-9 pr-3.5 py-2 text-xs font-medium text-[#0F1419] dark:text-[#F5F7FA] placeholder:text-[#657786] dark:placeholder:text-[#8E9AA4] focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div
              style={{ maxHeight: `${menuStyle.maxHeight - (showSearch ? 52 : 0)}px` }}
              className="overflow-y-auto overscroll-contain p-2 space-y-1 custom-scrollbar"
            >
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-[#657786] dark:text-[#8E9AA4]">
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
                      className={`w-full flex items-center justify-between gap-2.5 rounded-2xl px-3.5 py-2.5 text-left text-xs font-semibold transition-colors ${
                        opt.disabled
                          ? "opacity-40 cursor-not-allowed text-muted-foreground"
                          : isSelected
                            ? "bg-[#0095F6]/15 text-[#0077CC] dark:text-[#0095F6]"
                            : "text-[#0F1419] dark:text-[#F5F7FA] hover:bg-[#F3F5F7] dark:hover:bg-[#242C33] active:bg-[#E8ECEF] dark:active:bg-[#2C353D]"
                      }`}
                    >
                      <span className="leading-snug break-words pr-1">{opt.label}</span>
                      {isSelected && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0095F6] text-white">
                          <Check className="h-3 w-3 stroke-[3]" />
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
