'use client'

import { useId, useMemo, useRef, useState } from 'react'
import { BookMarked, CalendarClock, Search, SearchX, X } from 'lucide-react'
import { libraryBooks, type LibraryBook } from '@/components/dashboard/data'
import { Panel, fieldClassName } from '@/components/dashboard/panel'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'issued' | 'available'

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'issued', label: 'On loan' },
  { id: 'available', label: 'Available' },
]

const dueFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function matchesQuery(book: LibraryBook, query: string) {
  if (!query) return true
  const haystack = `${book.title} ${book.author}`.toLowerCase()
  return haystack.includes(query)
}

function isOverdue(book: LibraryBook) {
  if (book.status !== 'issued' || !book.due) return false
  return book.due < new Date().toISOString().slice(0, 10)
}

export function LibraryBooks() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsId = useId()
  const filterGroupId = useId()

  const normalisedQuery = query.trim().toLowerCase()
  const issuedCount = libraryBooks.filter((book) => book.status === 'issued').length

  const results = useMemo(
    () =>
      libraryBooks.filter((book) => {
        if (filter !== 'all' && book.status !== filter) return false
        return matchesQuery(book, normalisedQuery)
      }),
    [filter, normalisedQuery],
  )

  const resultSummary = normalisedQuery
    ? `${results.length} ${results.length === 1 ? 'book' : 'books'} matching “${query.trim()}”`
    : `${results.length} ${results.length === 1 ? 'book' : 'books'} in the catalogue`

  function clearSearch() {
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <Panel
      id="library"
      eyebrow="College library catalogue"
      title="Library"
      icon={BookMarked}
      action={
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium tabular-nums text-muted-foreground">
          {issuedCount} on loan
        </span>
      }
    >
      <form role="search" onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="library-search" className="sr-only">
            Search for books by title or author
          </label>
          <div className="relative">
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
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title or author"
              autoComplete="off"
              aria-controls={resultsId}
              className={cn(fieldClassName, 'pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden')}
            />
            {query ? (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <X className="size-4" aria-hidden="true" />
                <span className="sr-only">Clear search</span>
              </button>
            ) : null}
          </div>
        </div>

        <div
          role="radiogroup"
          aria-labelledby={filterGroupId}
          className="flex flex-wrap gap-1 rounded-xl border border-border bg-background/60 p-1"
        >
          <span id={filterGroupId} className="sr-only">
            Filter books by availability
          </span>
          {filters.map((item) => {
            const selected = filter === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setFilter(item.id)}
                className={cn(
                  'flex h-9 min-w-0 flex-1 items-center justify-center rounded-lg px-3 text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
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
      </form>

      <p id={`${resultsId}-status`} role="status" aria-live="polite" className="mt-4 text-xs text-muted-foreground">
        {resultSummary}
      </p>

      {results.length > 0 ? (
        <ul id={resultsId} aria-describedby={`${resultsId}-status`} className="mt-3 flex flex-col divide-y divide-border">
          {results.map((book) => (
            <li key={book.id}>
              <BookRow book={book} />
            </li>
          ))}
        </ul>
      ) : (
        <div
          id={resultsId}
          className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-background/40 px-4 py-8 text-center"
        >
          <SearchX className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">No books found</p>
          <p className="max-w-[16rem] text-sm leading-relaxed text-muted-foreground">
            {normalisedQuery
              ? 'Try a different title or author, or clear the search to browse the full catalogue.'
              : 'Nothing matches this filter. Switch to All to see every title.'}
          </p>
          {normalisedQuery || filter !== 'all' ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setFilter('all')
                inputRef.current?.focus()
              }}
              className="mt-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors outline-none hover:border-lime/40 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Reset filters
            </button>
          ) : null}
        </div>
      )}
    </Panel>
  )
}

function BookRow({ book }: { book: LibraryBook }) {
  const overdue = isOverdue(book)
  const issued = book.status === 'issued'

  return (
    <article className="group flex gap-3 py-3.5 first:pt-0 last:pb-0">
      <span
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background/60 text-lime transition-colors group-hover:border-lime/40"
      >
        <BookMarked className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[0.7rem] font-semibold',
              overdue ? 'bg-destructive/15 text-destructive' : issued ? 'bg-cyan/15 text-cyan' : 'bg-lime/15 text-lime',
            )}
          >
            {overdue ? 'Overdue' : issued ? 'On loan' : 'Available'}
          </span>
          {issued && book.due ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[0.7rem] font-medium',
                overdue ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              <CalendarClock className="size-3" aria-hidden="true" />
              {overdue ? 'Was due' : 'Due'} {dueFormatter.format(new Date(`${book.due}T00:00:00`))}
            </span>
          ) : (
            <span className="text-[0.7rem] font-medium text-muted-foreground">Ready to issue</span>
          )}
        </div>
        <h3 className="text-sm font-semibold text-pretty text-foreground">{book.title}</h3>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{book.author}</p>
      </div>
    </article>
  )
}
