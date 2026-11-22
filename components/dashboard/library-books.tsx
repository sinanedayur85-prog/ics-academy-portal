'use client'

import { useId, useMemo, useRef, useState } from 'react'
import {
  BookMarked,
  BookOpen,
  Building2,
  ChevronDown,
  FileText,
  Layers,
  Library,
  MapPin,
  Search,
  SearchX,
  User,
  X,
} from 'lucide-react'
import {
  BOOK_CATEGORIES,
  BOOKS_COUNT,
  KITAB_CATEGORIES,
  KITABS_COUNT,
  libraryBooks,
  libraryGeneralBooks,
  libraryKitabs,
  type LibraryBook,
} from '@/components/dashboard/library-catalog-data'
import { Panel, fieldClassName } from '@/components/dashboard/panel'
import { cn } from '@/lib/utils'

type CollectionTab = 'all' | 'kitab' | 'book'

const PAGE_SIZE = 60

function matchesQuery(book: LibraryBook, query: string) {
  if (!query) return true
  const haystack = [
    book.title,
    book.arabicTitle,
    book.author,
    book.publisher,
    book.category,
    book.arabicCategory,
    book.code,
    book.volumes,
    book.shelf,
    book.callNo,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export function LibraryBooks() {
  const [collection, setCollection] = useState<CollectionTab>('all')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('All')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [showAllCatalogue, setShowAllCatalogue] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsId = useId()

  const normalisedQuery = query.trim().toLowerCase()
  const hasActiveFilter = Boolean(
    normalisedQuery || categoryFilter !== 'All' || collection !== 'all',
  )

  const collectionPool = useMemo(() => {
    if (collection === 'kitab') return libraryKitabs
    if (collection === 'book') return libraryGeneralBooks
    return libraryBooks
  }, [collection])

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of collectionPool) {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1)
    }
    return counts
  }, [collectionPool])

  const availableCategories = useMemo(() => {
    if (collection === 'kitab') {
      return [
        { key: 'All', label: 'All Kitabs', arabic: undefined, count: KITABS_COUNT },
        ...KITAB_CATEGORIES.map((c) => ({
          key: c.name,
          label: c.name,
          arabic: c.arabic,
          count: categoryCounts.get(c.name) ?? 0,
        })),
      ]
    }
    if (collection === 'book') {
      return [
        { key: 'All', label: 'All Books', arabic: undefined, count: BOOKS_COUNT },
        ...BOOK_CATEGORIES.map((c) => ({
          key: c,
          label: c,
          arabic: undefined,
          count: categoryCounts.get(c) ?? 0,
        })),
      ]
    }
    // Combined quick subjects when viewing All
    const uniqueNames: Array<{ key: string; label: string; arabic?: string; count: number }> = [
      { key: 'All', label: 'All Subjects', count: libraryBooks.length },
    ]
    const seen = new Set<string>()
    for (const c of KITAB_CATEGORIES) {
      if (!seen.has(c.name)) {
        seen.add(c.name)
        uniqueNames.push({
          key: c.name,
          label: c.name,
          arabic: c.arabic,
          count: categoryCounts.get(c.name) ?? 0,
        })
      }
    }
    for (const c of BOOK_CATEGORIES) {
      if (!seen.has(c)) {
        seen.add(c)
        uniqueNames.push({
          key: c,
          label: c,
          count: categoryCounts.get(c) ?? 0,
        })
      }
    }
    return uniqueNames
  }, [collection, categoryCounts])

  const results = useMemo(() => {
    return collectionPool.filter((book) => {
      if (categoryFilter !== 'All' && book.category !== categoryFilter) return false
      return matchesQuery(book, normalisedQuery)
    })
  }, [collectionPool, categoryFilter, normalisedQuery])

  const visibleResults = useMemo(
    () => results.slice(0, visibleCount),
    [results, visibleCount],
  )
  const remainingCount = Math.max(0, results.length - visibleResults.length)

  function switchCollection(next: CollectionTab) {
    setCollection(next)
    setCategoryFilter('All')
    setVisibleCount(PAGE_SIZE)
    setShowAllCatalogue(true)
  }

  function selectCategory(cat: string) {
    setCategoryFilter(cat)
    setVisibleCount(PAGE_SIZE)
    setShowAllCatalogue(true)
  }

  function clearSearch() {
    setQuery('')
    setCategoryFilter('All')
    setCollection('all')
    setVisibleCount(PAGE_SIZE)
    setShowAllCatalogue(false)
    inputRef.current?.focus()
  }

  const isViewingList = hasActiveFilter || showAllCatalogue

  return (
    <Panel
      id="library"
      eyebrow="Bahrul Uloom Library"
      title="Library Catalogue"
      icon={BookMarked}
      action={
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium tabular-nums">
          <span className="rounded-full bg-[#0095F6]/15 px-2.5 py-0.5 text-[0.7rem] font-semibold text-[#0077CC] dark:text-[#0095F6]">
            {libraryBooks.length.toLocaleString()} Titles
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-3.5">
        {/* Top Collection Switcher: All / Kitabs (Arabic) / Books (Malayalam & English) */}
        <div
          role="tablist"
          aria-label="Library collection filter"
          className="grid grid-cols-3 gap-1.5 rounded-2xl bg-muted/60 p-1 dark:bg-[#141A1F]"
        >
          {(
            [
              { id: 'all', label: 'All', count: libraryBooks.length },
              { id: 'kitab', label: 'Kitabs', count: KITABS_COUNT },
              { id: 'book', label: 'Books', count: BOOKS_COUNT },
            ] as const
          ).map((tab) => {
            const active = collection === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => switchCollection(tab.id)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all active:scale-[0.98]',
                  active
                    ? 'bg-[#0095F6] text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.2 text-[10px] tabular-nums',
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-background/60 text-muted-foreground dark:bg-black/30',
                  )}
                >
                  {tab.count.toLocaleString()}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search Input & Subject Pills */}
        <form
          role="search"
          onSubmit={(event) => event.preventDefault()}
          className="flex flex-col gap-2.5"
        >
          <div className="relative w-full">
            <label htmlFor="library-search" className="sr-only">
              Search ICS Academy Library Kitabs and Malayalam or English Books by title, author, publisher, subject, or code
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
                setVisibleCount(PAGE_SIZE)
                if (event.target.value) setShowAllCatalogue(true)
              }}
              placeholder={
                collection === 'kitab'
                  ? 'Search Arabic Kitab (e.g. تفسير، البخاري), author, or publisher...'
                  : collection === 'book'
                    ? 'Search Malayalam / English book, author, or code (e.g. MS01, E01)...'
                    : 'Search Kitabs (عربي), Malayalam & English books, author, publisher, or code...'
              }
              autoComplete="off"
              aria-controls={resultsId}
              className={cn(
                fieldClassName,
                'pl-10 pr-9 text-xs sm:text-sm [&::-webkit-search-cancel-button]:hidden',
              )}
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setVisibleCount(PAGE_SIZE)
                  inputRef.current?.focus()
                }}
                aria-label="Clear search text"
                className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-background/60 hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {/* Horizontal Scroll Subject Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 text-xs [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {availableCategories.map((cat) => {
              const active = categoryFilter === cat.key
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => selectCategory(cat.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.7rem] sm:text-xs font-semibold whitespace-nowrap transition-all shrink-0 active:scale-95',
                    active
                      ? 'bg-[#0095F6] text-white'
                      : 'bg-muted text-muted-foreground hover:text-foreground dark:bg-[#141A1F]',
                  )}
                >
                  <span>{cat.label}</span>
                  {cat.arabic && collection === 'kitab' ? (
                    <span className="font-arabic text-[0.7rem] opacity-85" dir="rtl">
                      {cat.arabic}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      'text-[10px] tabular-nums',
                      active ? 'text-white/85' : 'text-muted-foreground/75',
                    )}
                  >
                    {cat.count}
                  </span>
                </button>
              )
            })}
          </div>
        </form>

        {/* Initial Clean Browse Overview */}
        {!isViewingList ? (
          <div
            id={resultsId}
            className="flex flex-col items-center gap-3 rounded-2xl bg-muted/50 px-4 py-6 text-center dark:bg-[#141A1F]"
          >
            <div className="flex size-10 items-center justify-center rounded-2xl bg-[#0095F6]/15 text-[#0077CC] dark:text-[#0095F6]">
              <Library className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-semibold text-foreground">
                Search Kitabs & Books in ICS Library
              </p>
              <p className="mx-auto max-w-sm text-[11px] leading-relaxed text-muted-foreground">
                Explore {KITABS_COUNT} Arabic Kitabs across 13 Islamic subjects and{' '}
                {BOOKS_COUNT.toLocaleString()} Malayalam &amp; English books across 13 categories.
              </p>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => switchCollection('kitab')}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#0095F6] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#0084DC] active:scale-95"
              >
                <BookOpen className="size-3.5" aria-hidden="true" />
                Browse Kitabs ({KITABS_COUNT})
              </button>
              <button
                type="button"
                onClick={() => switchCollection('book')}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-background px-4 text-xs font-semibold text-foreground transition-colors hover:bg-muted dark:bg-[#1C2329] dark:hover:bg-[#252E36] active:scale-95"
              >
                <BookMarked className="size-3.5 text-[#0095F6]" aria-hidden="true" />
                Browse Books ({BOOKS_COUNT.toLocaleString()})
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Results Info & Reset */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <p
                id={`${resultsId}-status`}
                role="status"
                aria-live="polite"
                className="text-xs text-muted-foreground"
              >
                Showing{' '}
                <span className="font-semibold tabular-nums text-foreground">
                  {visibleResults.length.toLocaleString()}
                </span>
                {remainingCount > 0 ? (
                  <>
                    {' '}
                    of{' '}
                    <span className="font-semibold tabular-nums text-foreground">
                      {results.length.toLocaleString()}
                    </span>
                  </>
                ) : null}{' '}
                {collection === 'kitab'
                  ? results.length === 1
                    ? 'Kitab'
                    : 'Kitabs'
                  : collection === 'book'
                    ? results.length === 1
                      ? 'Book'
                      : 'Books'
                    : results.length === 1
                      ? 'Title'
                      : 'Titles'}
                {categoryFilter !== 'All' ? ` in ${categoryFilter}` : ''}
              </p>

              <button
                type="button"
                onClick={clearSearch}
                className="text-xs font-semibold text-[#0077CC] dark:text-[#0095F6] hover:underline whitespace-nowrap shrink-0"
              >
                Reset
              </button>
            </div>

            {/* Catalogue Listing */}
            {results.length > 0 ? (
              <div className="flex flex-col gap-2">
                <ul
                  id={resultsId}
                  aria-describedby={`${resultsId}-status`}
                  className="flex max-h-[520px] flex-col divide-y divide-border/35 overflow-y-auto pr-1 dark:divide-white/[0.06]"
                >
                  {visibleResults.map((book) => (
                    <li key={book.id}>
                      <BookRow book={book} />
                    </li>
                  ))}
                </ul>

                {remainingCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                    className="mx-auto mt-1 inline-flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-[#0095F6] hover:text-white dark:bg-[#141A1F] dark:hover:bg-[#0095F6] active:scale-95"
                  >
                    <ChevronDown className="size-3.5" aria-hidden="true" />
                    Load more ({Math.min(PAGE_SIZE, remainingCount)} of{' '}
                    {remainingCount.toLocaleString()} remaining)
                  </button>
                ) : null}
              </div>
            ) : (
              <div
                id={resultsId}
                className="flex flex-col items-center gap-2 rounded-2xl bg-muted/50 px-4 py-8 text-center dark:bg-[#141A1F]"
              >
                <SearchX className="size-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-xs font-semibold text-foreground">
                  No matching titles found
                </p>
                <p className="max-w-xs text-[11px] leading-relaxed text-muted-foreground">
                  Try searching with a different Arabic, Malayalam, or English title, author name, publisher, or catalog code.
                </p>
                <button
                  type="button"
                  onClick={clearSearch}
                  className="mt-1 rounded-full bg-background px-4 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-[#0095F6] hover:text-white dark:bg-[#1C2329]"
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
  const isKitab = book.type === 'kitab'
  const isPdfPublisher = book.publisher?.toUpperCase() === 'PDF'

  return (
    <article className="group flex min-w-0 items-start gap-3 py-3 first:pt-1 last:pb-1">
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl',
          isKitab
            ? 'bg-[#0095F6]/15 text-[#0077CC] dark:text-[#0095F6]'
            : 'bg-emerald-500/12 text-emerald-700 dark:bg-[#89C53F]/15 dark:text-[#89C53F]',
        )}
      >
        {isKitab ? <BookOpen className="size-4" /> : <BookMarked className="size-4" />}
      </span>

      <div className="min-w-0 flex-1">
        {/* Top Metadata Pills: Collection/Code + Subject Category */}
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          {!isKitab && book.code ? (
            <span className="rounded-md bg-[#0095F6]/12 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-tight text-[#0077CC] dark:text-[#0095F6]">
              {book.code}
            </span>
          ) : null}

          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground dark:bg-[#141A1F]">
            <span>{book.category}</span>
            {book.arabicCategory ? (
              <span className="font-arabic text-[0.7rem] text-foreground/75" dir="rtl">
                · {book.arabicCategory}
              </span>
            ) : null}
          </span>

          {isKitab && isPdfPublisher ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
              <FileText className="size-2.5" aria-hidden="true" />
              PDF
            </span>
          ) : null}
        </div>

        {/* Title */}
        {isKitab ? (
          <h3
            dir="rtl"
            className="font-arabic break-words text-right text-sm sm:text-[15px] font-semibold leading-relaxed text-foreground"
          >
            {book.title}
          </h3>
        ) : (
          <h3 className="break-words text-left font-display text-xs sm:text-sm font-semibold leading-snug text-foreground">
            {book.title}
          </h3>
        )}

        {/* Author */}
        {book.author ? (
          isKitab ? (
            <p
              dir="rtl"
              className="font-arabic mt-0.5 flex items-center justify-end gap-1.5 break-words text-right text-xs text-muted-foreground"
            >
              <span>{book.author}</span>
              <User className="size-3 shrink-0 opacity-70" aria-hidden="true" />
            </p>
          ) : (
            <p className="mt-0.5 flex items-center gap-1 break-words text-left text-[11px] text-muted-foreground">
              <User className="size-3 shrink-0 opacity-70" aria-hidden="true" />
              <span>{book.author}</span>
            </p>
          )
        ) : null}

        {/* Bottom Details: Volumes, Publisher, and Optional Shelf (shown only once assigned) */}
        {(book.volumes || (book.publisher && !isPdfPublisher) || book.shelf) ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.7rem]">
            {book.volumes ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#0095F6]/12 px-2.5 py-0.5 font-semibold text-[#0077CC] dark:text-[#0095F6]">
                <Layers className="size-3 shrink-0" aria-hidden="true" />
                <span>Vol: {book.volumes}</span>
              </span>
            ) : null}

            {book.publisher && !isPdfPublisher ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground dark:bg-[#141A1F]">
                <Building2 className="size-3 shrink-0 opacity-75" aria-hidden="true" />
                <span className="font-arabic" dir="auto">
                  {book.publisher}
                </span>
              </span>
            ) : null}

            {book.shelf ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-0.5 font-semibold text-emerald-700 dark:bg-[#89C53F]/15 dark:text-[#89C53F]">
                <MapPin className="size-3 shrink-0" aria-hidden="true" />
                {book.shelf}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  )
}
