'use client'

import { useId, useMemo, useRef, useState } from 'react'
import {
  BookMarked,
  BookOpen,
  CalendarClock,
  Compass,
  MapPin,
  Search,
  SearchX,
  X,
} from 'lucide-react'
import { libraryBooks, type LibraryBook } from '@/components/dashboard/data'
import { Panel, fieldClassName } from '@/components/dashboard/panel'
import { cn } from '@/lib/utils'

type AvailabilityFilter = 'all' | 'available' | 'issued' | 'reference'

const AVAILABILITY_FILTERS: { id: AvailabilityFilter; label: string }[] = [
  { id: 'all', label: 'All Status' },
  { id: 'available', label: 'Available' },
  { id: 'issued', label: 'On Loan' },
  { id: 'reference', label: 'Reference' },
]

const CATEGORIES = [
  'All',
  'Fiqh',
  'Hadith',
  'Tafsir',
  'Usul',
  'Tasawwuf',
  'Arabic & Nahw',
  'History',
] as const

const dueFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function matchesQuery(book: LibraryBook, query: string) {
  if (!query) return true
  const haystack = [
    book.title,
    book.arabicTitle,
    book.author,
    book.category,
    book.shelf,
    book.callNo,
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export function LibraryBooks() {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<AvailabilityFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('All')
  const [showAllCatalogue, setShowAllCatalogue] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsId = useId()
  const filterGroupId = useId()

  const normalisedQuery = query.trim().toLowerCase()
  const hasActiveSearch = Boolean(normalisedQuery || categoryFilter !== 'All' || statusFilter !== 'all')

  const results = useMemo(() => {
    return libraryBooks.filter((book) => {
      if (statusFilter !== 'all' && book.status !== statusFilter) return false
      if (categoryFilter !== 'All' && book.category !== categoryFilter) return false
      return matchesQuery(book, normalisedQuery)
    })
  }, [statusFilter, categoryFilter, normalisedQuery])

  const totalAvailable = libraryBooks.filter((b) => b.status === 'available').length
  const totalOnLoan = libraryBooks.filter((b) => b.status === 'issued').length
  const totalRef = libraryBooks.filter((b) => b.status === 'reference').length

  function clearSearch() {
    setQuery('')
    setStatusFilter('all')
    setCategoryFilter('All')
    setShowAllCatalogue(false)
    inputRef.current?.focus()
  }

  return (
    <Panel
      id="library"
      eyebrow="BAHRUL ULOOM RESEARCH CENTRE"
      title="LIBRARY"
      icon={BookMarked}
      action={
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium tabular-nums">
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[0.7rem] font-semibold text-emerald-600 dark:text-lime">
            {totalAvailable} Available
          </span>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[0.7rem] text-muted-foreground">
            {totalOnLoan} On loan
          </span>
          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[0.7rem] font-semibold text-amber-600 dark:text-amber-400">
            {totalRef} Ref
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-3.5">
        {/* Search Input */}
        <form role="search" onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-2.5">
          <div className="relative w-full">
            <label htmlFor="library-search" className="sr-only">
              Search Bahrul Uloom Knowledge Research Centre books by title, Arabic name, author, or shelf
            </label>
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              id="library-search"
              name="q"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                if (event.target.value) setShowAllCatalogue(true)
              }}
              placeholder="Search Kitab, Arabic title (e.g. فتح المعين), author, or topic..."
              autoComplete="off"
              aria-controls={resultsId}
              className={cn(fieldClassName, 'pl-10 pr-9 text-xs sm:text-sm [&::-webkit-search-cancel-button]:hidden')}
            />
            {query ? (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {/* Availability and Category Pills */}
          <div className="flex flex-col gap-2">
            <div
              role="radiogroup"
              aria-labelledby={filterGroupId}
              className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-background/60 p-1"
            >
              <span id={filterGroupId} className="sr-only">
                Filter by availability status
              </span>
              {AVAILABILITY_FILTERS.map((item) => {
                const selected = statusFilter === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setStatusFilter(item.id)
                      setShowAllCatalogue(true)
                    }}
                    className={cn(
                      'flex h-7 min-w-0 flex-1 items-center justify-center rounded-lg px-2 text-[0.7rem] font-medium whitespace-nowrap transition-all outline-none sm:h-8 sm:px-3 sm:text-xs',
                      selected
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>

            {/* Category horizontal scroll pills */}
            <div className="flex gap-1 overflow-x-auto pb-0.5 text-xs">
              {CATEGORIES.map((cat) => {
                const active = categoryFilter === cat
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setCategoryFilter(cat)
                      setShowAllCatalogue(true)
                    }}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-[0.7rem] sm:text-xs font-medium whitespace-nowrap transition-colors shrink-0',
                      active
                        ? 'border border-lime/40 bg-lime/15 text-foreground'
                        : 'border border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>
        </form>

        {/* When not searching and not browsing: show clean search prompt */}
        {!hasActiveSearch && !showAllCatalogue ? (
          <div
            id={resultsId}
            className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-background/40 px-4 py-6 text-center"
          >
            <Search className="size-5 text-lime" aria-hidden="true" />
            <p className="font-malayalam text-xs font-semibold text-foreground">
              ലൈബ്രറിയിലെ ഗ്രന്ഥങ്ങൾ സെർച്ച് ചെയ്യുക
            </p>
            <p className="font-malayalam max-w-xs text-[11px] leading-relaxed text-muted-foreground">
              ബഹ്റുൽ ഉലൂം നോളജ് റിസർച്ച് സെന്ററിലുള്ള ഗ്രന്ഥങ്ങളും അവയുടെ ഷെൽഫ് ലൊക്കേഷനും കണ്ടെത്താൻ മുകളിലെ സെർച്ച് ബോക്സിൽ കിതാബിന്റെ പേരോ വിഷയമോ ടൈപ്പ് ചെയ്യുക.
            </p>
            <button
              type="button"
              onClick={() => setShowAllCatalogue(true)}
              className="mt-1 inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-[11px] font-medium text-foreground transition-colors hover:border-lime/40 hover:bg-muted"
            >
              <BookOpen className="size-3.5 text-lime" aria-hidden="true" />
              Browse Full Catalogue ({libraryBooks.length} Kitabs)
            </button>
          </div>
        ) : (
          <>
            {/* Results Info & Count */}
            <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
              <p id={`${resultsId}-status`} role="status" aria-live="polite" className="text-xs text-muted-foreground">
                Found <span className="font-semibold tabular-nums text-foreground">{results.length}</span>{' '}
                {results.length === 1 ? 'Kitab' : 'Kitabs'}
                {categoryFilter !== 'All' ? ` in ${categoryFilter}` : ''}
              </p>

              <button
                type="button"
                onClick={clearSearch}
                className="text-xs font-medium text-lime hover:underline whitespace-nowrap shrink-0"
              >
                Clear
              </button>
            </div>

            {/* Kitab Listing - Compact and constrained scroll list so mobile card doesn't stretch endlessly */}
            {results.length > 0 ? (
              <ul
                id={resultsId}
                aria-describedby={`${resultsId}-status`}
                className="flex max-h-[460px] flex-col divide-y divide-border/60 overflow-y-auto pr-1"
              >
                {results.map((book) => (
                  <li key={book.id}>
                    <BookRow book={book} />
                  </li>
                ))}
              </ul>
            ) : (
              <div
                id={resultsId}
                className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-background/40 px-4 py-8 text-center"
              >
                <SearchX className="size-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-xs font-semibold text-foreground">No matching Kitabs found</p>
                <p className="font-malayalam max-w-xs text-[11px] leading-relaxed text-muted-foreground">
                  ഈ പേരിലോ വിഷയത്തിലോ ഉള്ള കിതാബ് ബഹ്റുൽ ഉലൂം നോളജ് റിസർച്ച് സെന്ററിൽ കണ്ടെത്തിയില്ല. മറ്റൊരു പദം ഉപയോഗിച്ച് സെർച്ച് ചെയ്യുക.
                </p>
                <button
                  type="button"
                  onClick={clearSearch}
                  className="mt-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-lime/40 hover:bg-muted"
                >
                  Reset filters
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  )
}

function BookRow({ book }: { book: LibraryBook }) {
  const isIssued = book.status === 'issued'
  const isReference = book.status === 'reference'
  const isAvailable = book.status === 'available'

  return (
    <article className="group flex min-w-0 items-start gap-2.5 py-3 first:pt-1 last:pb-1">
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background/60 text-lime transition-colors group-hover:border-lime/40"
      >
        <BookOpen className="size-3.5" />
      </span>

      <div className="min-w-0 flex-1">
        {/* Status & Category Tag */}
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          {isAvailable ? (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-600 dark:text-lime">
              Available
            </span>
          ) : isIssued ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-sky-600 dark:text-sky-400">
              <CalendarClock className="size-2.5" aria-hidden="true" />
              On loan {book.due ? `(${dueFormatter.format(new Date(`${book.due}T00:00:00`))})` : ''}
            </span>
          ) : (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-600 dark:text-amber-400">
              Reference Only
            </span>
          )}

          <span className="text-[0.65rem] font-medium text-muted-foreground">
            {book.category}
          </span>
        </div>

        {/* Titles */}
        <h3 className="break-words text-left font-display text-xs sm:text-sm font-semibold leading-snug text-foreground">
          {book.title}
        </h3>
        {book.arabicTitle ? (
          <p
            dir="rtl"
            className="font-arabic mt-0.5 break-words text-left text-[11px] sm:text-xs font-medium text-foreground/85"
          >
            {book.arabicTitle}
          </p>
        ) : null}

        <p className="mt-0.5 break-words text-left text-[11px] text-muted-foreground">
          {book.author}
        </p>

        {/* Shelf location & Call Number */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[0.7rem] text-muted-foreground">
          <span className="inline-flex items-center gap-1 text-foreground/90 font-medium">
            <MapPin className="size-3 text-lime shrink-0" aria-hidden="true" />
            {book.shelf}
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
            <Compass className="size-2.5 shrink-0" aria-hidden="true" />
            {book.callNo}
          </span>
        </div>
      </div>
    </article>
  )
}
