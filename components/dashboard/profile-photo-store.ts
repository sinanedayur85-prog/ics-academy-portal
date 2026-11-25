'use client'

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import {
  ACADEMY_PRINCIPAL,
  OFFICIAL_CLASS_USTHADS,
  applySyncedProfilePhotos,
  getCanonicalProfilePhotoActorId,
  loadAcademyAdminConfig,
  students,
  updateStudentProfilePhoto,
  updateUsthadProfilePhoto,
} from '@/components/dashboard/data'
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase'

export type ProfilePhotoActorRole = 'student' | 'usthad' | 'principal'

export type SyncedProfilePhotoRecord = {
  actorId: string
  actorRole: ProfilePhotoActorRole
  actorName: string
  avatarUrl: string
  updatedAtMs: number
}

const COLLECTION_NAME = 'campusProfilePhotos'
const STORAGE_KEY = 'ics_campus_profile_photos_v1'
const LAST_SYNC_MS_KEY = 'ics_campus_profile_photos_sync_ms_v1'
const PROFILE_PHOTO_SYNC_TTL_MS = 15 * 60 * 1000
export const PROFILE_PHOTOS_UPDATED_EVENT = 'ics-profile-photos-updated'
const MAX_AVATAR_URL_LENGTH = 245_000

let activeRefCount = 0
let activeRefreshTimer: number | null = null
let activeFetchPromise: Promise<void> | null = null
let hasMigratedLocalPhotos = false
const inFlightOptimisticUpdates = new Map<string, SyncedProfilePhotoRecord>()

function isValidAvatarUrl(url: string): boolean {
  const clean = url.trim()
  if (!clean || clean.length > MAX_AVATAR_URL_LENGTH) return false
  return (
    /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(clean) ||
    clean.startsWith('/') ||
    clean.startsWith('https://')
  )
}

function isValidPortalActorId(actorId: string): boolean {
  return /^(st[d]?|usthad|principal)-[a-zA-Z0-9_-]+$/.test(actorId) && actorId.length >= 4 && actorId.length <= 64
}

export function loadCachedProfilePhotos(): Record<string, SyncedProfilePhotoRecord> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, SyncedProfilePhotoRecord>
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

function saveCachedProfilePhotos(records: Record<string, SyncedProfilePhotoRecord>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // Ignore localStorage quota limits; Firestore remains source of truth
  }
}

function applyRecordsToApp(records: Record<string, SyncedProfilePhotoRecord>): void {
  const urlMap: Record<string, string> = {}
  for (const [id, rec] of Object.entries(records)) {
    if (rec && typeof rec.avatarUrl === 'string' && isValidAvatarUrl(rec.avatarUrl)) {
      const canonical = getCanonicalProfilePhotoActorId(rec.actorId || id)
      if (canonical) {
        urlMap[canonical] = rec.avatarUrl
      }
    }
  }
  applySyncedProfilePhotos(urlMap)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PROFILE_PHOTOS_UPDATED_EVENT))
    window.dispatchEvent(new CustomEvent('ics-academy-config-updated'))
  }
}

async function persistPhotoDocToFirestore(record: SyncedProfilePhotoRecord): Promise<void> {
  const canonicalId = getCanonicalProfilePhotoActorId(record.actorId)
  if (!isValidPortalActorId(canonicalId) || !isValidAvatarUrl(record.avatarUrl)) {
    return
  }
  const docRef = doc(db, COLLECTION_NAME, canonicalId)
  const path = `${COLLECTION_NAME}/${canonicalId}`
  const safeName = (record.actorName || canonicalId).trim().slice(0, 120) || 'Member'
  const safeRole: ProfilePhotoActorRole =
    record.actorRole === 'principal' || record.actorRole === 'usthad' ? record.actorRole : 'student'
  const safeUpdatedAtMs = Math.max(1, Math.floor(record.updatedAtMs || Date.now()))

  try {
    const snap = await getDoc(docRef)
    if (snap.exists()) {
      await updateDoc(docRef, {
        actorRole: safeRole,
        actorName: safeName,
        avatarUrl: record.avatarUrl,
        updatedAtMs: safeUpdatedAtMs,
      })
    } else {
      await setDoc(docRef, {
        actorId: canonicalId,
        campusId: 'ics-academy',
        actorRole: safeRole,
        actorName: safeName,
        avatarUrl: record.avatarUrl,
        createdAt: serverTimestamp(),
        updatedAtMs: safeUpdatedAtMs,
      })
    }
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, path)
    } catch {
      // Logged with structured FirestoreErrorInfo
    }
    throw error
  }
}

async function migrateExistingLocalPhotosToFirestore(
  remoteRecords: Record<string, SyncedProfilePhotoRecord>,
): Promise<void> {
  if (hasMigratedLocalPhotos || typeof window === 'undefined') return
  hasMigratedLocalPhotos = true

  const config = loadAcademyAdminConfig()
  const toUpload: SyncedProfilePhotoRecord[] = []

  // Migrate any locally saved student custom photos not yet in Firestore
  for (const [studentId, edit] of Object.entries(config.editedStudents ?? {})) {
    const avatarUrl = typeof edit?.avatarUrl === 'string' ? edit.avatarUrl.trim() : ''
    if (!avatarUrl || !avatarUrl.startsWith('data:image/') || !isValidAvatarUrl(avatarUrl)) continue
    const canonicalId = getCanonicalProfilePhotoActorId(studentId)
    if (!isValidPortalActorId(canonicalId) || remoteRecords[canonicalId]) continue
    const matchedStudent = students.find((s) => s.id === canonicalId)
    toUpload.push({
      actorId: canonicalId,
      actorRole: 'student',
      actorName: matchedStudent?.name || edit.name || canonicalId,
      avatarUrl,
      updatedAtMs: Math.max(1, config.updatedAtMs || Date.now()),
    })
  }

  // Migrate any locally saved usthad/principal custom photos not yet in Firestore
  for (const [usthadId, edit] of Object.entries(config.editedUsthads ?? {})) {
    const avatarUrl = typeof edit?.avatarUrl === 'string' ? edit.avatarUrl.trim() : ''
    if (!avatarUrl || !avatarUrl.startsWith('data:image/') || !isValidAvatarUrl(avatarUrl)) continue
    const canonicalId = getCanonicalProfilePhotoActorId(usthadId)
    if (!isValidPortalActorId(canonicalId) || remoteRecords[canonicalId]) continue
    const matchedUsthad = OFFICIAL_CLASS_USTHADS.find((u) => u.id === canonicalId)
    const isPrincipal = canonicalId === ACADEMY_PRINCIPAL.usthadId
    toUpload.push({
      actorId: canonicalId,
      actorRole: isPrincipal ? 'principal' : 'usthad',
      actorName: matchedUsthad?.name || (isPrincipal ? ACADEMY_PRINCIPAL.name : canonicalId),
      avatarUrl,
      updatedAtMs: Math.max(1, config.updatedAtMs || Date.now()),
    })
  }

  for (const rec of toUpload) {
    try {
      await persistPhotoDocToFirestore(rec)
    } catch {
      // Ignore individual migration error; user can re-upload anytime
    }
  }
}

export async function saveProfilePhotoToFirestore(input: {
  actorId: string
  actorRole: ProfilePhotoActorRole
  actorName: string
  avatarUrl: string
}): Promise<boolean> {
  const canonicalId = getCanonicalProfilePhotoActorId(input.actorId)
  const cleanAvatar = typeof input.avatarUrl === 'string' ? input.avatarUrl.trim() : ''
  if (!isValidPortalActorId(canonicalId) || !isValidAvatarUrl(cleanAvatar)) {
    return false
  }

  const record: SyncedProfilePhotoRecord = {
    actorId: canonicalId,
    actorRole: input.actorRole,
    actorName: (input.actorName || canonicalId).trim().slice(0, 120),
    avatarUrl: cleanAvatar,
    updatedAtMs: Date.now(),
  }

  // 1. Optimistic immediate update across local state, localStorage, and live UI
  inFlightOptimisticUpdates.set(canonicalId, record)
  const cached = loadCachedProfilePhotos()
  cached[canonicalId] = record
  saveCachedProfilePhotos(cached)

  if (record.actorRole === 'student') {
    updateStudentProfilePhoto(canonicalId, cleanAvatar)
  } else {
    updateUsthadProfilePhoto(canonicalId, cleanAvatar)
  }
  applyRecordsToApp(cached)

  // 2. Persist to Firestore so EVERY student, Usthad, and Principal sees it immediately in Chats & dashboards
  try {
    await persistPhotoDocToFirestore(record)
    return true
  } catch {
    return false
  } finally {
    const latest = inFlightOptimisticUpdates.get(canonicalId)
    if (latest && latest.updatedAtMs === record.updatedAtMs) {
      inFlightOptimisticUpdates.delete(canonicalId)
    }
  }
}

async function fetchProfilePhotosFromFirestore(force = false): Promise<void> {
  if (typeof window === 'undefined') return
  if (!force) {
    try {
      const lastSync = Number(window.localStorage.getItem(LAST_SYNC_MS_KEY) || '0')
      if (lastSync > 0 && Date.now() - lastSync < PROFILE_PHOTO_SYNC_TTL_MS) {
        return
      }
    } catch {
      // Proceed with fetch
    }
  }
  if (activeFetchPromise) return activeFetchPromise

  activeFetchPromise = (async () => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('campusId', '==', 'ics-academy'),
        limit(200),
      )
      const snapshot = await getDocs(q)
      const merged: Record<string, SyncedProfilePhotoRecord> = {
        ...loadCachedProfilePhotos(),
      }
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>
        const rawActorId =
          typeof data.actorId === 'string' && data.actorId ? data.actorId : docSnap.id
        const canonicalId = getCanonicalProfilePhotoActorId(rawActorId)
        const avatarUrl = typeof data.avatarUrl === 'string' ? data.avatarUrl.trim() : ''
        if (!canonicalId || !isValidAvatarUrl(avatarUrl)) return

        const role: ProfilePhotoActorRole =
          data.actorRole === 'principal' || data.actorRole === 'usthad'
            ? data.actorRole
            : 'student'
        const updatedAtMs =
          typeof data.updatedAtMs === 'number' && data.updatedAtMs > 0 ? data.updatedAtMs : 1

        merged[canonicalId] = {
          actorId: canonicalId,
          actorRole: role,
          actorName: typeof data.actorName === 'string' ? data.actorName : canonicalId,
          avatarUrl,
          updatedAtMs,
        }
      })

      for (const [id, optimistic] of inFlightOptimisticUpdates.entries()) {
        const remote = merged[id]
        if (!remote || optimistic.updatedAtMs >= remote.updatedAtMs) {
          merged[id] = optimistic
        }
      }

      saveCachedProfilePhotos(merged)
      try {
        window.localStorage.setItem(LAST_SYNC_MS_KEY, String(Date.now()))
      } catch {
        // Ignore storage error
      }
      applyRecordsToApp(merged)
      void migrateExistingLocalPhotosToFirestore(merged)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes('permission') || msg.includes('insufficient')) {
        try {
          handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME)
        } catch {
          // Logged safely; cached profile photos remain active
        }
      }
    } finally {
      activeFetchPromise = null
    }
  })()

  return activeFetchPromise
}

/**
 * Starts cached Firestore synchronization for all campus profile photos (15-min TTL instead of permanent 24/7 listener).
 * Reference-counted so multiple components can safely call it and clean up on unmount.
 */
export function startCampusProfilePhotosSync(): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  activeRefCount += 1

  // Immediately hydrate from local cache on mount for instant zero-flicker avatars
  const initialCached = loadCachedProfilePhotos()
  if (Object.keys(initialCached).length > 0) {
    applyRecordsToApp(initialCached)
  }

  void fetchProfilePhotosFromFirestore(false)

  if (activeRefreshTimer === null) {
    activeRefreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchProfilePhotosFromFirestore(false)
      }
    }, PROFILE_PHOTO_SYNC_TTL_MS)
  }

  return () => {
    activeRefCount = Math.max(0, activeRefCount - 1)
    if (activeRefCount === 0 && activeRefreshTimer !== null) {
      window.clearInterval(activeRefreshTimer)
      activeRefreshTimer = null
    }
  }
}
