'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import {
  BOOK_CATEGORIES,
  KITAB_CATEGORIES,
  libraryGeneralBooks,
  libraryKitabs,
  type LibraryBook,
  type LibraryItemType,
} from '@/components/dashboard/library-catalog-data'
import { OperationType, db, handleFirestoreError } from '@/src/lib/firebase'

const COLLECTION_NAME = 'campusLibraryChanges'
const CAMPUS_ID = 'ics-academy'
const LOCAL_CACHE_KEY = 'ics_library_catalog_changes_v1'

export interface LibraryCatalogChangeRecord {
  id: string
  campusId: string
  itemType: LibraryItemType
  title: string
  category: string
  arabicCategory?: string
  code?: string
  author?: string
  volumes?: string
  publisher?: string
  shelf?: string
  isDeleted: boolean
  updatedByActorId: string
  updatedByName: string
  updatedAtMs: number
}

export interface SaveCatalogItemInput {
  id?: string
  type: LibraryItemType
  title: string
  category: string
  arabicCategory?: string
  code?: string
  author?: string
  volumes?: string
  publisher?: string
  shelf?: string
}

type ChangeMap = Record<string, LibraryCatalogChangeRecord>

const BASE_KITAB_ID_SET = new Set(libraryKitabs.map((item) => item.id))
const BASE_BOOK_ID_SET = new Set(libraryGeneralBooks.map((item) => item.id))

const KITAB_ARABIC_BY_NAME = new Map<string, string>(
  KITAB_CATEGORIES.map((c) => [c.name.toLowerCase(), c.arabic]),
)

export function getArabicCategoryForSubject(categoryName: string): string | undefined {
  return KITAB_ARABIC_BY_NAME.get(categoryName.trim().toLowerCase())
}

function readCachedChanges(): ChangeMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LOCAL_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as ChangeMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeCachedChanges(map: ChangeMap) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(map))
  } catch {
    // Ignore storage quota errors
  }
}

function cleanOptional(value: string | undefined, maxLen: number): string {
  return (value ?? '').trim().slice(0, maxLen)
}

function nonEmptyOrUndefined(value: string | undefined): string | undefined {
  const trimmed = (value ?? '').trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeItemId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120)
  return cleaned.length >= 2 ? cleaned : `custom-${Date.now()}`
}

function normalizePrincipalActorId(raw?: string): string {
  const cleaned = (raw ?? '').replace(/[^a-zA-Z0-9_-]/g, '')
  if (cleaned.startsWith('principal-') && cleaned.length >= 11 && cleaned.length <= 64) {
    return cleaned
  }
  const suffix = cleaned.replace(/^principal-?/, '') || 'academy-admin'
  return `principal-${suffix}`.slice(0, 64)
}

function normalizeActorName(raw?: string): string {
  const trimmed = (raw ?? '').trim().slice(0, 120)
  return trimmed.length > 0 ? trimmed : 'Principal'
}

// Module-level TTL-cached cloud sync so library catalog changes are fetched once
// per 5 minutes (instead of keeping a permanent Firestore onSnapshot listener open on every device).
const LIBRARY_SYNC_TTL_MS = 5 * 60 * 1000
let sharedChanges: ChangeMap = readCachedChanges()
let hasInitialSnapshot = false
let lastFetchedAtMs = 0
let fetchInFlight = false
const listeners = new Set<() => void>()

function emitChange() {
  writeCachedChanges(sharedChanges)
  for (const listener of listeners) {
    listener()
  }
}

function parseSnapshotDoc(docId: string, data: Record<string, unknown>): LibraryCatalogChangeRecord | null {
  const itemType = data.itemType === 'kitab' || data.itemType === 'book' ? data.itemType : null
  const title = typeof data.title === 'string' ? data.title : ''
  const category = typeof data.category === 'string' ? data.category : ''
  if (!itemType || !title || !category) return null

  return {
    id: typeof data.id === 'string' && data.id ? data.id : docId,
    campusId: typeof data.campusId === 'string' ? data.campusId : CAMPUS_ID,
    itemType,
    title,
    category,
    arabicCategory: typeof data.arabicCategory === 'string' ? data.arabicCategory : '',
    code: typeof data.code === 'string' ? data.code : '',
    author: typeof data.author === 'string' ? data.author : '',
    volumes: typeof data.volumes === 'string' ? data.volumes : '',
    publisher: typeof data.publisher === 'string' ? data.publisher : '',
    shelf: typeof data.shelf === 'string' ? data.shelf : '',
    isDeleted: Boolean(data.isDeleted),
    updatedByActorId: typeof data.updatedByActorId === 'string' ? data.updatedByActorId : 'principal-academy-admin',
    updatedByName: typeof data.updatedByName === 'string' ? data.updatedByName : 'Principal',
    updatedAtMs: typeof data.updatedAtMs === 'number' && data.updatedAtMs > 0 ? data.updatedAtMs : Date.now(),
  }
}

async function refreshLibraryChangesIfStale() {
  if (typeof window === 'undefined' || fetchInFlight) return
  if (lastFetchedAtMs > 0 && Date.now() - lastFetchedAtMs < LIBRARY_SYNC_TTL_MS) return

  fetchInFlight = true
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('campusId', '==', CAMPUS_ID),
    )
    const snapshot = await getDocs(q)
    const nextMap: ChangeMap = {}
    snapshot.forEach((docSnap) => {
      const parsed = parseSnapshotDoc(docSnap.id, docSnap.data() as Record<string, unknown>)
      if (parsed) {
        nextMap[parsed.id] = parsed
      }
    })
    sharedChanges = nextMap
    hasInitialSnapshot = true
    lastFetchedAtMs = Date.now()
    emitChange()
  } catch (err) {
    // Pause retries for this TTL window if quota or network temporarily fails, while preserving error diagnostics
    lastFetchedAtMs = Date.now()
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('permission') || msg.includes('insufficient')) {
      try {
        handleFirestoreError(err, OperationType.LIST, COLLECTION_NAME)
      } catch {
        // Structured diagnostic already logged by handleFirestoreError
      }
    }
  } finally {
    fetchInFlight = false
  }
}

function buildLibraryBookFromChange(
  change: LibraryCatalogChangeRecord,
  base?: LibraryBook,
): LibraryBook {
  const isKitab = change.itemType === 'kitab'
  const arabicCat =
    nonEmptyOrUndefined(change.arabicCategory) ??
    (isKitab ? getArabicCategoryForSubject(change.category) : undefined)

  return {
    id: change.id,
    type: change.itemType,
    title: change.title,
    arabicTitle: isKitab ? change.title : undefined,
    category: change.category,
    arabicCategory: isKitab ? arabicCat : undefined,
    code: isKitab ? undefined : nonEmptyOrUndefined(change.code),
    author: nonEmptyOrUndefined(change.author),
    volumes: isKitab ? nonEmptyOrUndefined(change.volumes) : undefined,
    publisher: nonEmptyOrUndefined(change.publisher),
    shelf: nonEmptyOrUndefined(change.shelf),
    callNo: base?.callNo,
  }
}

export async function saveLibraryCatalogItem(
  input: SaveCatalogItemInput,
  actorId?: string,
  actorName?: string,
): Promise<LibraryCatalogChangeRecord> {
  const title = input.title.trim().slice(0, 240)
  const category = input.category.trim().slice(0, 80)
  if (!title) throw new Error('Title is required.')
  if (!category) throw new Error('Subject category is required.')

  const isNewCustom = !input.id
  const itemId = isNewCustom
    ? normalizeItemId(
        `custom-${input.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      )
    : normalizeItemId(input.id as string)

  const nowMs = Date.now()
  const safeActorId = normalizePrincipalActorId(actorId)
  const safeActorName = normalizeActorName(actorName)

  const arabicCatRaw =
    input.type === 'kitab'
      ? cleanOptional(input.arabicCategory, 80) ||
        cleanOptional(getArabicCategoryForSubject(category), 80)
      : ''

  const mutableFields = {
    itemType: input.type,
    title,
    category,
    arabicCategory: arabicCatRaw,
    code: input.type === 'book' ? cleanOptional(input.code, 32) : '',
    author: cleanOptional(input.author, 160),
    volumes: input.type === 'kitab' ? cleanOptional(input.volumes, 40) : '',
    publisher: cleanOptional(input.publisher, 120),
    shelf: cleanOptional(input.shelf, 80),
    isDeleted: false,
    updatedByActorId: safeActorId,
    updatedByName: safeActorName,
    updatedAtMs: nowMs,
  }

  const record: LibraryCatalogChangeRecord = {
    id: itemId,
    campusId: CAMPUS_ID,
    ...mutableFields,
  }

  // Optimistic local update for immediate responsiveness
  const previousMap = sharedChanges
  sharedChanges = { ...sharedChanges, [itemId]: record }
  emitChange()

  const docRef = doc(db, COLLECTION_NAME, itemId)
  const alreadyExistsLocally = Boolean(previousMap[itemId])

  try {
    let existsInCloud = alreadyExistsLocally
    if (!existsInCloud && !hasInitialSnapshot) {
      try {
        const snap = await getDoc(docRef)
        existsInCloud = snap.exists()
      } catch {
        existsInCloud = false
      }
    }

    if (existsInCloud) {
      await updateDoc(docRef, mutableFields)
    } else {
      await setDoc(docRef, {
        id: itemId,
        campusId: CAMPUS_ID,
        ...mutableFields,
        createdAt: serverTimestamp(),
      })
    }
    return record
  } catch (err) {
    // Roll back optimistic state if Firestore write failed
    sharedChanges = previousMap
    emitChange()
    handleFirestoreError(
      err,
      alreadyExistsLocally ? OperationType.UPDATE : OperationType.CREATE,
      `${COLLECTION_NAME}/${itemId}`,
    )
  }
}

export async function deleteLibraryCatalogItem(
  book: LibraryBook,
  actorId?: string,
  actorName?: string,
): Promise<void> {
  const itemId = normalizeItemId(book.id)
  const nowMs = Date.now()
  const safeActorId = normalizePrincipalActorId(actorId)
  const safeActorName = normalizeActorName(actorName)

  const mutableFields = {
    itemType: book.type,
    title: book.title.trim().slice(0, 240) || 'Removed Item',
    category: book.category.trim().slice(0, 80) || 'General',
    arabicCategory: cleanOptional(book.arabicCategory, 80),
    code: cleanOptional(book.code, 32),
    author: cleanOptional(book.author, 160),
    volumes: cleanOptional(book.volumes, 40),
    publisher: cleanOptional(book.publisher, 120),
    shelf: cleanOptional(book.shelf, 80),
    isDeleted: true,
    updatedByActorId: safeActorId,
    updatedByName: safeActorName,
    updatedAtMs: nowMs,
  }

  const record: LibraryCatalogChangeRecord = {
    id: itemId,
    campusId: CAMPUS_ID,
    ...mutableFields,
  }

  const previousMap = sharedChanges
  sharedChanges = { ...sharedChanges, [itemId]: record }
  emitChange()

  const docRef = doc(db, COLLECTION_NAME, itemId)
  const alreadyExistsLocally = Boolean(previousMap[itemId])

  try {
    let existsInCloud = alreadyExistsLocally
    if (!existsInCloud && !hasInitialSnapshot) {
      try {
        const snap = await getDoc(docRef)
        existsInCloud = snap.exists()
      } catch {
        existsInCloud = false
      }
    }

    if (existsInCloud) {
      await updateDoc(docRef, mutableFields)
    } else {
      await setDoc(docRef, {
        id: itemId,
        campusId: CAMPUS_ID,
        ...mutableFields,
        createdAt: serverTimestamp(),
      })
    }
  } catch (err) {
    sharedChanges = previousMap
    emitChange()
    handleFirestoreError(
      err,
      alreadyExistsLocally ? OperationType.UPDATE : OperationType.CREATE,
      `${COLLECTION_NAME}/${itemId}`,
    )
  }
}

export function useLibraryCatalog() {
  const [changes, setChanges] = useState<ChangeMap>(() => sharedChanges)

  useEffect(() => {
    const sync = () => setChanges({ ...sharedChanges })
    listeners.add(sync)
    void refreshLibraryChangesIfStale()
    // Sync immediately in case cache changed between render and effect
    sync()

    return () => {
      listeners.delete(sync)
    }
  }, [])

  return useMemo(() => {
    const customKitabs: LibraryBook[] = []
    const customBooks: LibraryBook[] = []

    const changeEntries = Object.values(changes).sort((a, b) => b.updatedAtMs - a.updatedAtMs)
    for (const ch of changeEntries) {
      if (ch.isDeleted) continue
      const isBase = BASE_KITAB_ID_SET.has(ch.id) || BASE_BOOK_ID_SET.has(ch.id)
      if (!isBase) {
        const built = buildLibraryBookFromChange(ch)
        if (built.type === 'kitab') {
          customKitabs.push(built)
        } else {
          customBooks.push(built)
        }
      }
    }

    const mergedKitabs: LibraryBook[] = [...customKitabs]
    const mergedBooks: LibraryBook[] = [...customBooks]

    for (const baseItem of libraryKitabs) {
      const override = changes[baseItem.id]
      if (override) {
        if (override.isDeleted) continue
        const built = buildLibraryBookFromChange(override, baseItem)
        if (built.type === 'kitab') {
          mergedKitabs.push(built)
        } else {
          mergedBooks.push(built)
        }
      } else {
        mergedKitabs.push(baseItem)
      }
    }

    for (const baseItem of libraryGeneralBooks) {
      const override = changes[baseItem.id]
      if (override) {
        if (override.isDeleted) continue
        const built = buildLibraryBookFromChange(override, baseItem)
        if (built.type === 'kitab') {
          mergedKitabs.push(built)
        } else {
          mergedBooks.push(built)
        }
      } else {
        mergedBooks.push(baseItem)
      }
    }

    // Dynamic categories: standard categories first, plus any custom category added by Principal
    const kitabCategoryList: Array<{ name: string; arabic?: string }> = KITAB_CATEGORIES.map(
      (c) => ({ name: c.name, arabic: c.arabic }),
    )
    const knownKitabCats = new Set(kitabCategoryList.map((c) => c.name))
    for (const item of mergedKitabs) {
      if (!knownKitabCats.has(item.category)) {
        knownKitabCats.add(item.category)
        kitabCategoryList.push({ name: item.category, arabic: item.arabicCategory })
      }
    }

    const bookCategoryList: string[] = [...BOOK_CATEGORIES]
    const knownBookCats = new Set(bookCategoryList)
    for (const item of mergedBooks) {
      if (!knownBookCats.has(item.category)) {
        knownBookCats.add(item.category)
        bookCategoryList.push(item.category)
      }
    }

    const allBooks: LibraryBook[] = [...mergedKitabs, ...mergedBooks]

    return {
      allBooks,
      kitabs: mergedKitabs,
      books: mergedBooks,
      totalCount: allBooks.length,
      kitabsCount: mergedKitabs.length,
      booksCount: mergedBooks.length,
      kitabCategories: kitabCategoryList,
      bookCategories: bookCategoryList,
    }
  }, [changes])
}
