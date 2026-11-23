'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  FileText,
  Layers,
  Library,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  SearchX,
  Trash2,
  User,
  X,
} from 'lucide-react'
import {
  type LibraryBook,
  type LibraryItemType,
} from '@/components/dashboard/library-catalog-data'
import {
  deleteLibraryCatalogItem,
  getArabicCategoryForSubject,
  saveLibraryCatalogItem,
  useLibraryCatalog,
} from '@/components/dashboard/use-library-catalog'
import { Panel, fieldClassName } from '@/components/dashboard/panel'
import { DeleteActionMenu } from '@/components/ui/delete-action-menu'
import { ThemeSelect } from '@/components/ui/theme-select'
import { cn } from '@/lib/utils'

type CollectionTab = 'all' | 'kitab' | 'book'

const PAGE_SIZE = 60
const CUSTOM_CATEGORY_VALUE = '__custom__'

interface LibraryBooksProps {
  canEdit?: boolean
  actorId?: string
  actorName?: string
}

interface EditorFormState {
  id?: string
  type: LibraryItemType
  title: string
  categorySelect: string
  customCategory: string
  arabicCategory: string
  code: string
  author: string
  volumes: string
  publisher: string
  shelf: string
}

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

export function LibraryBooks({
  canEdit = false,
  actorId,
  actorName,
}: LibraryBooksProps = {}) {
  const {
    allBooks,
    kitabs,
    books,
    totalCount,
    kitabsCount,
    booksCount,
    kitabCategories,
    bookCategories,
  } = useLibraryCatalog()

  const [collection, setCollection] = useState<CollectionTab>('all')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('All')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [showAllCatalogue, setShowAllCatalogue] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsId = useId()

  // Principal CRUD modal state
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<'add' | 'edit'>('add')
  const [formState, setFormState] = useState<EditorFormState>({
    type: 'kitab',
    title: '',
    categorySelect: kitabCategories[0]?.name ?? 'Tafsir',
    customCategory: '',
    arabicCategory: kitabCategories[0]?.arabic ?? '',
    code: '',
    author: '',
    volumes: '',
    publisher: '',
    shelf: '',
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<LibraryBook | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Feedback banner
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!statusMessage) return
    const timer = window.setTimeout(() => setStatusMessage(null), 4000)
    return () => window.clearTimeout(timer)
  }, [statusMessage])

  useEffect(() => {
    if (!editorOpen && !deleteTarget) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (!saving) setEditorOpen(false)
        if (!deleting) setDeleteTarget(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editorOpen, deleteTarget, saving, deleting])

  const normalisedQuery = query.trim().toLowerCase()
  const hasActiveFilter = Boolean(
    normalisedQuery || categoryFilter !== 'All' || collection !== 'all',
  )

  const collectionPool = useMemo(() => {
    if (collection === 'kitab') return kitabs
    if (collection === 'book') return books
    return allBooks
  }, [collection, kitabs, books, allBooks])

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
        { key: 'All', label: 'All Kitabs', arabic: undefined, count: kitabsCount },
        ...kitabCategories.map((c) => ({
          key: c.name,
          label: c.name,
          arabic: c.arabic,
          count: categoryCounts.get(c.name) ?? 0,
        })),
      ]
    }
    if (collection === 'book') {
      return [
        { key: 'All', label: 'All Books', arabic: undefined, count: booksCount },
        ...bookCategories.map((c) => ({
          key: c,
          label: c,
          arabic: undefined,
          count: categoryCounts.get(c) ?? 0,
        })),
      ]
    }
    const uniqueNames: Array<{ key: string; label: string; arabic?: string; count: number }> = [
      { key: 'All', label: 'All Subjects', count: totalCount },
    ]
    const seen = new Set<string>()
    for (const c of kitabCategories) {
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
    for (const c of bookCategories) {
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
  }, [collection, categoryCounts, kitabsCount, booksCount, totalCount, kitabCategories, bookCategories])

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

  function openAddModal() {
    const defaultType: LibraryItemType = collection === 'book' ? 'book' : 'kitab'
    const defaultCat =
      defaultType === 'kitab'
        ? kitabCategories[0]?.name ?? 'Tafsir'
        : bookCategories[0] ?? 'Islamic & General'
    setEditorMode('add')
    setFormError(null)
    setFormState({
      type: defaultType,
      title: '',
      categorySelect: defaultCat,
      customCategory: '',
      arabicCategory:
        defaultType === 'kitab' ? getArabicCategoryForSubject(defaultCat) ?? '' : '',
      code: '',
      author: '',
      volumes: '',
      publisher: '',
      shelf: '',
    })
    setEditorOpen(true)
  }

  function openEditModal(book: LibraryBook) {
    const knownOptions =
      book.type === 'kitab' ? kitabCategories.map((c) => c.name) : bookCategories
    const isKnown = knownOptions.includes(book.category)
    setEditorMode('edit')
    setFormError(null)
    setFormState({
      id: book.id,
      type: book.type,
      title: book.title,
      categorySelect: isKnown ? book.category : CUSTOM_CATEGORY_VALUE,
      customCategory: isKnown ? '' : book.category,
      arabicCategory:
        book.arabicCategory ??
        (book.type === 'kitab' ? getArabicCategoryForSubject(book.category) ?? '' : ''),
      code: book.code ?? '',
      author: book.author ?? '',
      volumes: book.volumes ?? '',
      publisher: book.publisher ?? '',
      shelf: book.shelf ?? '',
    })
    setEditorOpen(true)
  }

  function handleFormTypeChange(nextType: LibraryItemType) {
    const defaultCat =
      nextType === 'kitab'
        ? kitabCategories[0]?.name ?? 'Tafsir'
        : bookCategories[0] ?? 'Islamic & General'
    setFormState((prev) => ({
      ...prev,
      type: nextType,
      categorySelect: defaultCat,
      customCategory: '',
      arabicCategory:
        nextType === 'kitab' ? getArabicCategoryForSubject(defaultCat) ?? '' : '',
    }))
  }

  function handleCategorySelectChange(nextVal: string) {
    setFormState((prev) => ({
      ...prev,
      categorySelect: nextVal,
      arabicCategory:
        prev.type === 'kitab' && nextVal !== CUSTOM_CATEGORY_VALUE
          ? getArabicCategoryForSubject(nextVal) ?? prev.arabicCategory
          : prev.arabicCategory,
    }))
  }

  async function handleSaveEditor(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return

    const finalTitle = formState.title.trim()
    const finalCategory =
      formState.categorySelect === CUSTOM_CATEGORY_VALUE
        ? formState.customCategory.trim()
        : formState.categorySelect.trim()

    if (!finalTitle) {
      setFormError('Please enter the Kitab or Book title.')
      return
    }
    if (!finalCategory) {
      setFormError('Please choose or enter a subject category.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      await saveLibraryCatalogItem(
        {
          id: editorMode === 'edit' ? formState.id : undefined,
          type: formState.type,
          title: finalTitle,
          category: finalCategory,
          arabicCategory: formState.type === 'kitab' ? formState.arabicCategory : undefined,
          code: formState.type === 'book' ? formState.code : undefined,
          author: formState.author,
          volumes: formState.type === 'kitab' ? formState.volumes : undefined,
          publisher: formState.publisher,
          shelf: formState.shelf,
        },
        actorId,
        actorName,
      )
      setEditorOpen(false)
      setShowAllCatalogue(true)
      setStatusMessage(
        editorMode === 'add'
          ? `Added "${finalTitle}" — synced live to all dashboards.`
          : `Updated "${finalTitle}" — synced live to all dashboards.`,
      )
    } catch {
      setFormError('Unable to save changes to cloud right now. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const removedTitle = deleteTarget.title
      await deleteLibraryCatalogItem(deleteTarget, actorId, actorName)
      setDeleteTarget(null)
      setStatusMessage(`Removed "${removedTitle}" from catalogue across all dashboards.`)
    } catch {
      setDeleteError('Unable to remove this entry right now. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const isViewingList = hasActiveFilter || showAllCatalogue

  const editorCategoryOptions = useMemo(() => {
    if (formState.type === 'kitab') {
      return kitabCategories.map((c) => ({
        value: c.name,
        label: c.arabic ? `${c.name} — ${c.arabic}` : c.name,
      }))
    }
    return bookCategories.map((c) => ({ value: c, label: c }))
  }, [formState.type, kitabCategories, bookCategories])

  return (
    <>
      <Panel
        id="library"
        eyebrow="Bahrul Uloom Library"
        title="Library Catalogue"
        icon={BookMarked}
        action={
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium tabular-nums">
            <span className="rounded-full bg-[#0095F6]/15 px-2.5 py-1 text-[0.7rem] font-semibold text-[#0077CC] dark:text-[#0095F6]">
              {totalCount.toLocaleString()} Titles
            </span>
            {canEdit ? (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1 rounded-full bg-[#0095F6] px-3 py-1 text-[0.7rem] font-semibold text-white transition-colors hover:bg-[#0084DC] active:scale-95"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                <span>Add</span>
              </button>
            ) : null}
          </div>
        }
      >
        <div className="flex flex-col gap-3.5">
          {statusMessage ? (
            <div
              role="status"
              className="flex items-center justify-between gap-2 rounded-2xl bg-emerald-500/12 px-3.5 py-2.5 text-xs font-medium text-emerald-700 dark:bg-[#89C53F]/15 dark:text-[#89C53F]"
            >
              <span className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{statusMessage}</span>
              </span>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                aria-label="Dismiss notification"
                className="shrink-0 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ) : null}

          {/* Top Collection Switcher: All / Kitabs (Arabic) / Books (Malayalam & English) */}
          <div
            role="tablist"
            aria-label="Library collection filter"
            className="grid grid-cols-3 gap-1.5 rounded-2xl bg-muted/60 p-1 dark:bg-[#141A1F]"
          >
            {(
              [
                { id: 'all', label: 'All', count: totalCount },
                { id: 'kitab', label: 'Kitabs', count: kitabsCount },
                { id: 'book', label: 'Books', count: booksCount },
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
                Search ICS Academy Library Kitabs and Malayalam or English Books by title, author, publisher, subject, shelf, or code
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
                    ? 'Search Arabic Kitab (e.g. تفسير، البخاري), author, shelf, or publisher...'
                    : collection === 'book'
                      ? 'Search Malayalam / English book, author, shelf, or code (e.g. MS01, E01)...'
                      : 'Search Kitabs (عربي), Malayalam & English books, author, shelf, or code...'
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
                  {canEdit
                    ? 'Manage Kitabs, Books & Shelf Locations'
                    : 'Search Kitabs & Books in ICS Library'}
                </p>
                <p className="mx-auto max-w-sm text-[11px] leading-relaxed text-muted-foreground">
                  Explore {kitabsCount.toLocaleString()} Arabic Kitabs across{' '}
                  {kitabCategories.length} Islamic subjects and {booksCount.toLocaleString()}{' '}
                  Malayalam &amp; English books across {bookCategories.length} categories.
                  {canEdit
                    ? ' Changes sync instantly to all Student and Usthad portals.'
                    : ''}
                </p>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => switchCollection('kitab')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#0095F6] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#0084DC] active:scale-95"
                >
                  <BookOpen className="size-3.5" aria-hidden="true" />
                  Browse Kitabs ({kitabsCount.toLocaleString()})
                </button>
                <button
                  type="button"
                  onClick={() => switchCollection('book')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-background px-4 text-xs font-semibold text-foreground transition-colors hover:bg-muted dark:bg-[#1C2329] dark:hover:bg-[#252E36] active:scale-95"
                >
                  <BookMarked className="size-3.5 text-[#0095F6]" aria-hidden="true" />
                  Browse Books ({booksCount.toLocaleString()})
                </button>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={openAddModal}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-500/15 px-4 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/25 dark:bg-[#89C53F]/15 dark:text-[#89C53F] dark:hover:bg-[#89C53F]/25 active:scale-95"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    Add New Title
                  </button>
                ) : null}
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
                    className="flex max-h-[540px] flex-col divide-y divide-border/35 overflow-y-auto pr-1 dark:divide-white/[0.06]"
                  >
                    {visibleResults.map((book) => (
                      <li key={book.id}>
                        <BookRow
                          book={book}
                          canEdit={canEdit}
                          onEdit={() => openEditModal(book)}
                          onDelete={() => {
                            setDeleteError(null)
                            setDeleteTarget(book)
                          }}
                        />
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
                    Try searching with a different Arabic, Malayalam, or English title, author name, publisher, shelf, or catalog code.
                  </p>
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="rounded-full bg-background px-4 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-[#0095F6] hover:text-white dark:bg-[#1C2329]"
                    >
                      Reset filters
                    </button>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={openAddModal}
                        className="inline-flex items-center gap-1 rounded-full bg-[#0095F6] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0084DC]"
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                        Add New Title
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Panel>

      {/* Principal Add / Edit Catalog Item Modal */}
      {canEdit && editorOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="library-editor-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-xs sm:p-4"
          onClick={() => {
            if (!saving) setEditorOpen(false)
          }}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-card text-foreground shadow-2xl dark:bg-[#0B1014]"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-wider text-[#0095F6] uppercase">
                  Bahrul Uloom Library
                </p>
                <h2
                  id="library-editor-title"
                  className="font-display text-base font-bold text-foreground"
                >
                  {editorMode === 'add' ? 'Add New Kitab / Book' : 'Edit Catalogue Entry'}
                </h2>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditorOpen(false)}
                aria-label="Close modal"
                className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground dark:bg-[#141A1F]"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            {/* Form Body */}
            <form
              onSubmit={handleSaveEditor}
              className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-5"
            >
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-muted/60 p-1 dark:bg-[#141A1F]">
                <button
                  type="button"
                  onClick={() => handleFormTypeChange('kitab')}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all',
                    formState.type === 'kitab'
                      ? 'bg-[#0095F6] text-white'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <BookOpen className="size-3.5" aria-hidden="true" />
                  <span>Kitab (Arabic)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleFormTypeChange('book')}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all',
                    formState.type === 'book'
                      ? 'bg-[#0095F6] text-white'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <BookMarked className="size-3.5" aria-hidden="true" />
                  <span>Book (Mal / Eng)</span>
                </button>
              </div>

              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="lib-edit-title"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  {formState.type === 'kitab' ? 'Kitab Name (اسم الكتاب) *' : 'Book Title *'}
                </label>
                <input
                  id="lib-edit-title"
                  type="text"
                  required
                  maxLength={240}
                  dir={formState.type === 'kitab' ? 'rtl' : 'ltr'}
                  value={formState.title}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder={
                    formState.type === 'kitab'
                      ? 'e.g. فتح المعين بشرح قرة العين'
                      : 'e.g. History of Islam'
                  }
                  className={cn(
                    fieldClassName,
                    'text-sm',
                    formState.type === 'kitab' && 'font-arabic text-right',
                  )}
                />
              </div>

              {/* Subject Category */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="lib-edit-category"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Subject / Category *
                  </label>
                  <ThemeSelect
                    id="lib-edit-category"
                    value={formState.categorySelect}
                    onChange={(e) => handleCategorySelectChange(e.target.value)}
                    className={cn(fieldClassName, 'h-10 px-3 text-xs font-medium')}
                  >
                    {editorCategoryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                    <option value={CUSTOM_CATEGORY_VALUE}>+ Custom Subject...</option>
                  </ThemeSelect>
                </div>

                {/* Shelf Location */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="lib-edit-shelf"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Shelf Location (Optional)
                  </label>
                  <input
                    id="lib-edit-shelf"
                    type="text"
                    maxLength={80}
                    value={formState.shelf}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, shelf: e.target.value }))
                    }
                    placeholder="e.g. Rack A — Shelf 02"
                    className={cn(fieldClassName, 'text-xs sm:text-sm')}
                  />
                </div>
              </div>

              {formState.categorySelect === CUSTOM_CATEGORY_VALUE ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="lib-edit-custom-cat"
                      className="text-xs font-semibold text-muted-foreground"
                    >
                      Custom Subject Name *
                    </label>
                    <input
                      id="lib-edit-custom-cat"
                      type="text"
                      required
                      maxLength={80}
                      value={formState.customCategory}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, customCategory: e.target.value }))
                      }
                      placeholder="e.g. Fiqh Shafi'i"
                      className={cn(fieldClassName, 'text-xs sm:text-sm')}
                    />
                  </div>
                  {formState.type === 'kitab' ? (
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="lib-edit-arabic-cat"
                        className="text-xs font-semibold text-muted-foreground"
                      >
                        Arabic Subject Label (Optional)
                      </label>
                      <input
                        id="lib-edit-arabic-cat"
                        type="text"
                        maxLength={80}
                        dir="rtl"
                        value={formState.arabicCategory}
                        onChange={(e) =>
                          setFormState((prev) => ({
                            ...prev,
                            arabicCategory: e.target.value,
                          }))
                        }
                        placeholder="الفقه الشافعي"
                        className={cn(fieldClassName, 'font-arabic text-right text-sm')}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Author */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="lib-edit-author"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  {formState.type === 'kitab' ? 'Author (المؤلف)' : 'Author'}
                </label>
                <input
                  id="lib-edit-author"
                  type="text"
                  maxLength={160}
                  dir={formState.type === 'kitab' ? 'rtl' : 'ltr'}
                  value={formState.author}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, author: e.target.value }))
                  }
                  placeholder={
                    formState.type === 'kitab'
                      ? 'e.g. الإمام النووي'
                      : 'e.g. Author name'
                  }
                  className={cn(
                    fieldClassName,
                    'text-xs sm:text-sm',
                    formState.type === 'kitab' && 'font-arabic text-right',
                  )}
                />
              </div>

              {/* Type-specific Details */}
              {formState.type === 'kitab' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="lib-edit-volumes"
                      className="text-xs font-semibold text-muted-foreground"
                    >
                      Volumes (جزء)
                    </label>
                    <input
                      id="lib-edit-volumes"
                      type="text"
                      maxLength={40}
                      value={formState.volumes}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, volumes: e.target.value }))
                      }
                      placeholder="e.g. 1-4 or 1"
                      className={cn(fieldClassName, 'text-xs sm:text-sm')}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="lib-edit-publisher"
                      className="text-xs font-semibold text-muted-foreground"
                    >
                      Publisher (النشر)
                    </label>
                    <input
                      id="lib-edit-publisher"
                      type="text"
                      maxLength={120}
                      dir="auto"
                      value={formState.publisher}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, publisher: e.target.value }))
                      }
                      placeholder="e.g. دار الفكر، DKI، PDF"
                      className={cn(fieldClassName, 'font-arabic text-xs sm:text-sm')}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="lib-edit-code"
                      className="text-xs font-semibold text-muted-foreground"
                    >
                      Catalog Code
                    </label>
                    <input
                      id="lib-edit-code"
                      type="text"
                      maxLength={32}
                      value={formState.code}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, code: e.target.value }))
                      }
                      placeholder="e.g. MS665, E59, H206"
                      className={cn(fieldClassName, 'font-mono text-xs sm:text-sm')}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="lib-edit-book-pub"
                      className="text-xs font-semibold text-muted-foreground"
                    >
                      Publisher (Optional)
                    </label>
                    <input
                      id="lib-edit-book-pub"
                      type="text"
                      maxLength={120}
                      value={formState.publisher}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, publisher: e.target.value }))
                      }
                      placeholder="e.g. IPB, DC Books"
                      className={cn(fieldClassName, 'text-xs sm:text-sm')}
                    />
                  </div>
                </div>
              )}

              {formError ? (
                <p className="rounded-xl bg-red-500/12 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400">
                  {formError}
                </p>
              ) : null}

              {/* Footer Actions */}
              <div className="mt-2 flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setEditorOpen(false)}
                  className="rounded-full bg-muted px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted/80 dark:bg-[#141A1F]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#0095F6] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0084DC] disabled:opacity-60 active:scale-95"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editorMode === 'add' ? 'Add to Catalogue' : 'Save Changes'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Principal Delete Confirmation Modal */}
      {canEdit && deleteTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="library-delete-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          onClick={() => {
            if (!deleting) setDeleteTarget(null)
          }}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-card p-5 text-foreground shadow-2xl dark:bg-[#0B1014]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-600 dark:text-red-400">
                <AlertTriangle className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  id="library-delete-title"
                  className="font-display text-sm font-bold text-foreground"
                >
                  Remove from Library Catalogue?
                </h3>
                <p
                  dir={deleteTarget.type === 'kitab' ? 'rtl' : 'ltr'}
                  className={cn(
                    'mt-1.5 break-words text-xs font-semibold text-foreground',
                    deleteTarget.type === 'kitab' && 'font-arabic text-right',
                  )}
                >
                  {deleteTarget.title}
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  This entry will be removed immediately from Principal, Usthad, and Student library catalogues.
                </p>
              </div>
            </div>

            {deleteError ? (
              <p className="mt-3 rounded-xl bg-red-500/12 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400">
                {deleteError}
              </p>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="rounded-full bg-muted px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted/80 dark:bg-[#141A1F]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60 active:scale-95"
              >
                {deleting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    <span>Remove</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function BookRow({
  book,
  canEdit,
  onEdit,
  onDelete,
}: {
  book: LibraryBook
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
}) {
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
        {/* Top Metadata Pills + Principal Edit/Delete Actions */}
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
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

          {canEdit ? (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${book.title}`}
                title="Edit details & shelf"
                className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-[#0095F6]/15 hover:text-[#0095F6] dark:bg-[#141A1F] active:scale-95"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
              </button>
              <DeleteActionMenu
                ariaLabel={`Options for ${book.title}`}
                buttonClassName="size-7 bg-muted dark:bg-[#141A1F]"
                onConfirmDelete={onDelete}
              />
            </div>
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
