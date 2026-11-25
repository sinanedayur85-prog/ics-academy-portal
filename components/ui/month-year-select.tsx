'use client'

import { ThemeSelect } from '@/components/ui/theme-select'
import {
  ALL_MONTH_NAMES,
  getAvailableYears,
  parseMonthId,
  toMonthId,
} from '@/components/dashboard/data'
import { cn } from '@/lib/utils'

type MonthYearSelectProps = {
  /** Value in 'YYYY-MM' format, or 'overall' when allowAllMonths is enabled */
  value: string
  onChange: (nextValue: string, nextYear: number) => void
  /** Optional active year used when value === 'overall' */
  year?: number
  /** Alias for year */
  selectedYear?: number
  onYearChange?: (nextYear: number) => void
  allowAllMonths?: boolean
  allMonthsLabel?: string
  shortMonthLabels?: boolean
  idPrefix?: string
  className?: string
  selectClassName?: string
}

export function MonthYearSelect({
  value,
  onChange,
  year,
  selectedYear,
  onYearChange,
  allowAllMonths = false,
  allMonthsLabel = 'All Months',
  shortMonthLabels = false,
  idPrefix = 'period',
  className,
  selectClassName,
}: MonthYearSelectProps) {
  const years = getAvailableYears()
  const isOverall = value === 'overall'
  const parsed = !isOverall ? parseMonthId(value) : null
  const activeYear = parsed?.year ?? year ?? selectedYear ?? new Date().getFullYear()
  const activeMonth = isOverall ? 'overall' : String(parsed?.monthNumber ?? new Date().getMonth() + 1)

  const yearOptions = years.includes(activeYear)
    ? years
    : [...years, activeYear].sort((a, b) => a - b)

  const baseSelectCls = cn(
    'h-9 rounded-xl border-0 bg-muted/70 px-2.5 text-xs font-semibold text-foreground transition-colors outline-none hover:bg-muted',
    selectClassName,
  )

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <label htmlFor={`${idPrefix}-month`} className="sr-only">
        Month
      </label>
      <ThemeSelect
        id={`${idPrefix}-month`}
        value={activeMonth}
        onChange={(e) => {
          const next = e.target.value
          if (next === 'overall') {
            onChange('overall', activeYear)
            return
          }
          const monthNum = Number.parseInt(next, 10)
          if (!Number.isNaN(monthNum)) {
            onChange(toMonthId(activeYear, monthNum), activeYear)
          }
        }}
        className={baseSelectCls}
      >
        {allowAllMonths && <option value="overall">{allMonthsLabel}</option>}
        {ALL_MONTH_NAMES.map((name, idx) => {
          const monthNum = idx + 1
          return (
            <option key={monthNum} value={String(monthNum)}>
              {shortMonthLabels ? name.slice(0, 3) : name}
            </option>
          )
        })}
      </ThemeSelect>

      <label htmlFor={`${idPrefix}-year`} className="sr-only">
        Year
      </label>
      <ThemeSelect
        id={`${idPrefix}-year`}
        value={String(activeYear)}
        onChange={(e) => {
          const nextYear = Number.parseInt(e.target.value, 10)
          if (Number.isNaN(nextYear)) return
          onYearChange?.(nextYear)
          if (isOverall) {
            onChange('overall', nextYear)
          } else {
            const monthNum = parsed?.monthNumber ?? new Date().getMonth() + 1
            onChange(toMonthId(nextYear, monthNum), nextYear)
          }
        }}
        className={cn(baseSelectCls, 'w-[76px] tabular-nums')}
      >
        {yearOptions.map((y) => (
          <option key={y} value={String(y)}>
            {y}
          </option>
        ))}
      </ThemeSelect>
    </div>
  )
}
