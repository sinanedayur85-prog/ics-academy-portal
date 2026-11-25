'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import {
  publishCampusNotification,
  type Student,
} from '@/components/dashboard/data'
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase'

export type LeavePermissionStatus = 'locked' | 'requested' | 'allowed'
export type LeaveRequestedAction = 'none' | 'leave' | 'return'
export type LeaveAllowedAction = 'none' | 'leave' | 'return' | 'reregister'

export type StudentLeavePermission = {
  studentId: string
  campusId: 'ics-academy'
  className: string
  studentName: string
  status: LeavePermissionStatus
  requestedAction: LeaveRequestedAction
  allowedAction: LeaveAllowedAction
  reregisterType: 'none' | 'leave' | 'return'
  requestedAtMs: number
  grantedAtMs: number
  grantedById: string
  grantedByName: string
  grantedByRole: 'none' | 'usthad' | 'principal'
  targetRecordId: string
  lastUsedAtMs: number
  updatedAtMs: number
}

const STORAGE_KEY = 'ics_leave_permissions_v1'
const UPDATE_EVENT = 'ics-leave-permissions-updated'
const COLLECTION_NAME = 'campusLeavePermissions'

export function createDefaultPermission(student: {
  id: string
  name: string
  className: string
}): StudentLeavePermission {
  return {
    studentId: student.id,
    campusId: 'ics-academy',
    className: student.className,
    studentName: student.name,
    status: 'locked',
    requestedAction: 'none',
    allowedAction: 'none',
    reregisterType: 'none',
    requestedAtMs: 0,
    grantedAtMs: 0,
    grantedById: '',
    grantedByName: '',
    grantedByRole: 'none',
    targetRecordId: '',
    lastUsedAtMs: 0,
    updatedAtMs: 1,
  }
}

export function loadLocalLeavePermissions(): Record<string, StudentLeavePermission> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, StudentLeavePermission>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveLocalLeavePermissions(map: Record<string, StudentLeavePermission>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT))
  } catch {
    // Ignore storage quota errors
  }
}

function normalizeDocData(
  studentId: string,
  data: Record<string, unknown>,
): StudentLeavePermission {
  const status: LeavePermissionStatus =
    data.status === 'allowed' || data.status === 'requested' ? data.status : 'locked'
  const requestedAction: LeaveRequestedAction =
    data.requestedAction === 'leave' || data.requestedAction === 'return'
      ? data.requestedAction
      : 'none'
  const allowedAction: LeaveAllowedAction =
    data.allowedAction === 'leave' ||
    data.allowedAction === 'return' ||
    data.allowedAction === 'reregister'
      ? data.allowedAction
      : 'none'
  const reregisterType: 'none' | 'leave' | 'return' =
    data.reregisterType === 'leave' || data.reregisterType === 'return'
      ? data.reregisterType
      : 'none'
  const grantedByRole: 'none' | 'usthad' | 'principal' =
    data.grantedByRole === 'usthad' || data.grantedByRole === 'principal'
      ? data.grantedByRole
      : 'none'

  return {
    studentId: typeof data.studentId === 'string' && data.studentId ? data.studentId : studentId,
    campusId: 'ics-academy',
    className: typeof data.className === 'string' ? data.className : '',
    studentName: typeof data.studentName === 'string' ? data.studentName : '',
    status,
    requestedAction,
    allowedAction,
    reregisterType,
    requestedAtMs: typeof data.requestedAtMs === 'number' ? data.requestedAtMs : 0,
    grantedAtMs: typeof data.grantedAtMs === 'number' ? data.grantedAtMs : 0,
    grantedById: typeof data.grantedById === 'string' ? data.grantedById : '',
    grantedByName: typeof data.grantedByName === 'string' ? data.grantedByName : '',
    grantedByRole,
    targetRecordId: typeof data.targetRecordId === 'string' ? data.targetRecordId : '',
    lastUsedAtMs: typeof data.lastUsedAtMs === 'number' ? data.lastUsedAtMs : 0,
    updatedAtMs: typeof data.updatedAtMs === 'number' && data.updatedAtMs > 0 ? data.updatedAtMs : 1,
  }
}

async function persistPermissionToFirestore(perm: StudentLeavePermission): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, perm.studentId)
  const path = `${COLLECTION_NAME}/${perm.studentId}`
  try {
    const snap = await getDoc(docRef)
    const mutableFields = {
      className: perm.className.slice(0, 40) || '8th',
      studentName: perm.studentName.slice(0, 120) || 'Student',
      status: perm.status,
      requestedAction: perm.requestedAction,
      allowedAction: perm.allowedAction,
      reregisterType: perm.reregisterType,
      requestedAtMs: Math.max(0, Math.floor(perm.requestedAtMs)),
      grantedAtMs: Math.max(0, Math.floor(perm.grantedAtMs)),
      grantedById: perm.grantedById.slice(0, 64),
      grantedByName: perm.grantedByName.slice(0, 120),
      grantedByRole: perm.grantedByRole,
      targetRecordId: perm.targetRecordId.slice(0, 128),
      lastUsedAtMs: Math.max(0, Math.floor(perm.lastUsedAtMs)),
      updatedAtMs: Math.max(1, Math.floor(perm.updatedAtMs)),
    }
    if (snap.exists()) {
      await updateDoc(docRef, mutableFields)
    } else {
      await setDoc(docRef, {
        studentId: perm.studentId,
        campusId: 'ics-academy',
        ...mutableFields,
        createdAt: serverTimestamp(),
      })
    }
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, path)
    } catch {
      // Logged safely; local state already updated optimistically
    }
  }
}

function writeLocalAndCloud(nextPerm: StudentLeavePermission): void {
  const all = loadLocalLeavePermissions()
  all[nextPerm.studentId] = nextPerm
  saveLocalLeavePermissions(all)
  void persistPermissionToFirestore(nextPerm)
}

export function requestStudentLeavePermission(input: {
  student: Student
  action: 'leave' | 'return'
}): StudentLeavePermission {
  const now = Date.now()
  const existing =
    loadLocalLeavePermissions()[input.student.id] ?? createDefaultPermission(input.student)

  const next: StudentLeavePermission = {
    ...existing,
    studentId: input.student.id,
    campusId: 'ics-academy',
    className: input.student.className,
    studentName: input.student.name,
    status: 'requested',
    requestedAction: input.action,
    allowedAction: 'none',
    reregisterType: 'none',
    requestedAtMs: now,
    updatedAtMs: now,
  }

  writeLocalAndCloud(next)

  publishCampusNotification({
    type: 'leave',
    title:
      input.action === 'return'
        ? `Return Request • ${input.student.name}`
        : `Leave Request • ${input.student.name}`,
    message: `${input.student.name} (Class ${input.student.className}) requested ${
      input.action === 'return' ? 'Return' : 'Leave'
    } permission.`,
    targetClass: input.student.className,
    targetStaffOnly: true,
    actorId: input.student.id,
    actorName: input.student.name,
    href: '#usthad-leave',
  })

  return next
}

export function grantStudentLeavePermission(input: {
  student: { id: string; name: string; className: string }
  action: 'leave' | 'return' | 'reregister'
  reregisterType?: 'leave' | 'return'
  actorId: string
  actorName: string
  actorRole: 'usthad' | 'principal'
  targetRecordId?: string
}): StudentLeavePermission {
  const now = Date.now()
  const existing =
    loadLocalLeavePermissions()[input.student.id] ?? createDefaultPermission(input.student)

  const next: StudentLeavePermission = {
    ...existing,
    studentId: input.student.id,
    campusId: 'ics-academy',
    className: input.student.className,
    studentName: input.student.name,
    status: 'allowed',
    requestedAction: 'none',
    allowedAction: input.action,
    reregisterType:
      input.action === 'reregister' ? input.reregisterType ?? 'leave' : 'none',
    grantedAtMs: now,
    grantedById: input.actorId,
    grantedByName: input.actorName,
    grantedByRole: input.actorRole,
    targetRecordId: input.targetRecordId ?? '',
    updatedAtMs: now,
  }

  writeLocalAndCloud(next)

  const title =
    input.action === 'reregister'
      ? 'Re-Register Allowed'
      : input.action === 'return'
        ? 'Return Allowed'
        : 'Leave Allowed'

  publishCampusNotification({
    type: 'leave',
    title,
    message: `${input.actorName} unlocked one-time ${
      input.action === 'reregister'
        ? 'Re-Register'
        : input.action === 'return'
          ? 'Return'
          : 'Leave'
    } access.`,
    targetStudentId: input.student.id,
    targetClass: input.student.className,
    actorId: input.actorId,
    actorName: input.actorName,
    href: '#leave',
  })

  return next
}

export function lockStudentLeavePermission(input: {
  student: { id: string; name: string; className: string }
  consumed?: boolean
}): StudentLeavePermission {
  const now = Date.now()
  const existing =
    loadLocalLeavePermissions()[input.student.id] ?? createDefaultPermission(input.student)

  const next: StudentLeavePermission = {
    ...existing,
    studentId: input.student.id,
    campusId: 'ics-academy',
    className: input.student.className,
    studentName: input.student.name,
    status: 'locked',
    requestedAction: 'none',
    allowedAction: 'none',
    reregisterType: 'none',
    targetRecordId: '',
    lastUsedAtMs: input.consumed ? now : existing.lastUsedAtMs,
    updatedAtMs: now,
  }

  writeLocalAndCloud(next)
  return next
}

export function useStudentLeavePermission(student: {
  id: string
  name: string
  className: string
}): StudentLeavePermission {
  const [permission, setPermission] = useState<StudentLeavePermission>(() => {
    const local = loadLocalLeavePermissions()[student.id]
    return local ?? createDefaultPermission(student)
  })

  useEffect(() => {
    const syncLocal = () => {
      const local = loadLocalLeavePermissions()[student.id]
      if (local) {
        setPermission((prev) => (local.updatedAtMs >= prev.updatedAtMs ? local : prev))
      } else {
        setPermission(createDefaultPermission(student))
      }
    }
    syncLocal()
    window.addEventListener(UPDATE_EVENT, syncLocal)
    window.addEventListener('storage', syncLocal)

    const docRef = doc(db, COLLECTION_NAME, student.id)
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (!snap.exists()) return
        const remote = normalizeDocData(student.id, snap.data() as Record<string, unknown>)
        const localAll = loadLocalLeavePermissions()
        const existingLocal = localAll[student.id]
        if (!existingLocal || remote.updatedAtMs >= existingLocal.updatedAtMs) {
          localAll[student.id] = remote
          saveLocalLeavePermissions(localAll)
          setPermission(remote)
        }
      },
      (error) => {
        const msg = error instanceof Error ? error.message : String(error)
        if (msg.includes('permission') || msg.includes('insufficient')) {
          try {
            handleFirestoreError(error, OperationType.GET, `${COLLECTION_NAME}/${student.id}`)
          } catch {
            // Logged safely
          }
        }
      },
    )

    return () => {
      window.removeEventListener(UPDATE_EVENT, syncLocal)
      window.removeEventListener('storage', syncLocal)
      unsub()
    }
  }, [student.id, student.name, student.className])

  return permission
}

export function useAllLeavePermissions(): Record<string, StudentLeavePermission> {
  const [permissions, setPermissions] = useState<Record<string, StudentLeavePermission>>(() =>
    loadLocalLeavePermissions(),
  )

  useEffect(() => {
    const syncLocal = () => {
      setPermissions(loadLocalLeavePermissions())
    }
    syncLocal()
    window.addEventListener(UPDATE_EVENT, syncLocal)
    window.addEventListener('storage', syncLocal)

    const q = query(collection(db, COLLECTION_NAME), where('campusId', '==', 'ics-academy'))
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const merged = { ...loadLocalLeavePermissions() }
        let changed = false
        for (const docSnap of snapshot.docs) {
          const remote = normalizeDocData(docSnap.id, docSnap.data() as Record<string, unknown>)
          const existing = merged[remote.studentId]
          if (!existing || remote.updatedAtMs >= existing.updatedAtMs) {
            merged[remote.studentId] = remote
            changed = true
          }
        }
        if (changed) {
          saveLocalLeavePermissions(merged)
          setPermissions(merged)
        }
      },
      (error) => {
        const msg = error instanceof Error ? error.message : String(error)
        if (msg.includes('permission') || msg.includes('insufficient')) {
          try {
            handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME)
          } catch {
            // Logged safely
          }
        }
      },
    )

    return () => {
      window.removeEventListener(UPDATE_EVENT, syncLocal)
      window.removeEventListener('storage', syncLocal)
      unsub()
    }
  }, [])

  return permissions
}
