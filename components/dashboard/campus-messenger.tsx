'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCheck,
  Copy,
  Crown,
  Download,
  FileText,
  Forward,
  Image as ImageIcon,
  Info,
  Lock,
  MessageSquarePlus,
  MessageSquareText,
  Mic,
  MoreVertical,
  Paperclip,
  Pause,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Pin,
  Play,
  Reply,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Smile,
  Sparkles,
  Star,
  Trash2,
  Unlock,
  Users,
  Video,
  Volume2,
  X,
} from 'lucide-react'
import {
  formatCallDuration,
  makeDirectCallRoomId,
  useCampusCall,
  type CallMediaType,
  type CampusCallStatus,
} from '@/components/dashboard/campus-call-provider'
import { ThemeSelect } from '@/components/ui/theme-select'
import {
  ACADEMY_CLASSES,
  ACADEMY_PRINCIPAL,
  CLASS_USTHADS,
  OFFICIAL_CLASS_USTHADS,
  ensureCleanLaunchStorage,
  getCanonicalUsthadId,
  publishCampusNotification,
  pullCampusStateFromServer,
  students,
  type ClassUsthad,
  type PrincipalProfile,
  type Student,
} from '@/components/dashboard/data'
import { buildKitabPdfBlob, CURATED_KITABS } from '@/components/dashboard/digital-library'
import { clearGroupedPhoneNotifications, unlockNotificationAudio } from '@/lib/mobile-pdf'
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase'
import { cn } from '@/lib/utils'

export type MessengerRole = 'student' | 'usthad' | 'principal'

export interface ChatReplyRef {
  messageId: string
  senderName: string
  previewText: string
}

export interface ChatCallMeta {
  callId: string
  callType: CallMediaType
  callStatus: CampusCallStatus
  durationSec?: number
  callerId: string
  calleeId: string
}

export interface ChatMessage {
  id: string
  roomId: string
  senderId: string
  senderName: string
  senderRole: MessengerRole
  senderBadge?: string
  text: string
  mediaType: 'none' | 'voice' | 'image' | 'pdf' | 'call'
  callMeta?: ChatCallMeta
  mediaUrl?: string
  mediaName?: string
  mediaSizeLabel?: string
  mediaDurationSec?: number
  imageQuality?: 'standard' | 'hd'
  imageDimensions?: string
  replyTo?: ChatReplyRef
  reactions: Record<string, string[]>
  deliveredTo?: string[]
  deliveredAtMap?: Record<string, number>
  readBy: string[]
  readAtMap?: Record<string, number>
  starredBy?: string[]
  isForwarded?: boolean
  isDeleted?: boolean
  deletedBy?: string
  deletedById?: string
  deletedFor?: string[]
  createdAt: string
  createdAtMs: number
}

export interface ChatRoomMeta {
  roomId: string
  onlyAdminsCanPost: boolean
  pinnedMessageId: string | null
  updatedAtMs: number
}

export interface ChatPresenceEntry {
  actorId: string
  actorName: string
  actorRole: MessengerRole
  lastSeenMs: number
  isOnline?: boolean
  hideOnline?: boolean
}

export interface ChatUserSettings {
  showOnlineStatus: boolean
  sendReadReceipts: boolean
  enterToSend: boolean
  soundEffects: boolean
  chatFontSize: 'small' | 'medium' | 'large'
  chatWallpaper: 'default' | 'pitch_dark' | 'soft_mint' | 'warm_slate'
  defaultImageQuality: 'standard' | 'hd'
}

export interface ChatTypingEntry {
  actorId: string
  actorName: string
  mode: 'typing' | 'recording' | 'idle'
  updatedAtMs: number
}

export interface ChatRoomDescriptor {
  roomId: string
  type: 'batch_group' | 'staff_group' | 'direct_usthad' | 'direct_student'
  title: string
  subtitle: string
  badgeLabel: string
  batchName?: string
  peerId?: string
  peerRole?: MessengerRole
  avatarText: string
  avatarUrl?: string
  isStaffOnly?: boolean
}

const LOCAL_CHAT_MESSAGES_KEY = 'ics_campus_messenger_messages_v2'
const LOCAL_CHAT_META_KEY = 'ics_campus_messenger_meta_v2'
const LOCAL_CHAT_SETTINGS_KEY = 'ics_campus_chat_settings_v1'
const QUICK_REACTIONS = ['👍', '❤️', '🤲', '📚', '✅', '🌟'] as const

const DEFAULT_CHAT_SETTINGS: ChatUserSettings = {
  showOnlineStatus: true,
  sendReadReceipts: true,
  enterToSend: true,
  soundEffects: true,
  chatFontSize: 'medium',
  chatWallpaper: 'default',
  defaultImageQuality: 'standard',
}

function loadChatSettings(): ChatUserSettings {
  if (typeof window === 'undefined') return DEFAULT_CHAT_SETTINGS
  try {
    const raw = window.localStorage.getItem(LOCAL_CHAT_SETTINGS_KEY)
    if (!raw) return DEFAULT_CHAT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<ChatUserSettings>
    return {
      showOnlineStatus:
        typeof parsed.showOnlineStatus === 'boolean'
          ? parsed.showOnlineStatus
          : DEFAULT_CHAT_SETTINGS.showOnlineStatus,
      sendReadReceipts:
        typeof parsed.sendReadReceipts === 'boolean'
          ? parsed.sendReadReceipts
          : DEFAULT_CHAT_SETTINGS.sendReadReceipts,
      enterToSend:
        typeof parsed.enterToSend === 'boolean'
          ? parsed.enterToSend
          : DEFAULT_CHAT_SETTINGS.enterToSend,
      soundEffects:
        typeof parsed.soundEffects === 'boolean'
          ? parsed.soundEffects
          : DEFAULT_CHAT_SETTINGS.soundEffects,
      chatFontSize:
        parsed.chatFontSize === 'small' ||
        parsed.chatFontSize === 'medium' ||
        parsed.chatFontSize === 'large'
          ? parsed.chatFontSize
          : DEFAULT_CHAT_SETTINGS.chatFontSize,
      chatWallpaper:
        parsed.chatWallpaper === 'default' ||
        parsed.chatWallpaper === 'pitch_dark' ||
        parsed.chatWallpaper === 'soft_mint' ||
        parsed.chatWallpaper === 'warm_slate'
          ? parsed.chatWallpaper
          : DEFAULT_CHAT_SETTINGS.chatWallpaper,
      defaultImageQuality:
        parsed.defaultImageQuality === 'hd' || parsed.defaultImageQuality === 'standard'
          ? parsed.defaultImageQuality
          : DEFAULT_CHAT_SETTINGS.defaultImageQuality,
    }
  } catch {
    return DEFAULT_CHAT_SETTINGS
  }
}

function playSubtleSendSound() {
  if (typeof window === 'undefined') return
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(520, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(740, ctx.currentTime + 0.06)
    gain.gain.setValueAtTime(0.04, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.07)
  } catch {
    // Ignore audio context restrictions
  }
}

const CHAT_SYNC_BASES = [
  '/api/campus/chat',
  'https://ais-pre-rhfqjrwneaewkmnanoof2j-896319436298.asia-east1.run.app/api/campus/chat',
  'https://ais-dev-rhfqjrwneaewkmnanoof2j-896319436298.asia-east1.run.app/api/campus/chat',
]

function getOrderedChatSyncBases(): string[] {
  if (typeof window === 'undefined') return ['/api/campus/chat']
  const isCapacitorOrLocal =
    Boolean((window as unknown as { ICSNativeBridge?: unknown }).ICSNativeBridge) ||
    window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && /Android/i.test(navigator.userAgent))

  if (isCapacitorOrLocal) {
    return [
      'https://ais-pre-rhfqjrwneaewkmnanoof2j-896319436298.asia-east1.run.app/api/campus/chat',
      'https://ais-dev-rhfqjrwneaewkmnanoof2j-896319436298.asia-east1.run.app/api/campus/chat',
      '/api/campus/chat',
    ]
  }
  return CHAT_SYNC_BASES
}

function sanitizeFirestoreDocId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128) || 'doc'
}

async function prepareMediaUrlForFirestore(
  mediaType: ChatMessage['mediaType'],
  mediaUrl?: string,
): Promise<string | undefined> {
  if (!mediaUrl || mediaUrl.startsWith('blob:')) return undefined
  if (mediaUrl.length <= 720000) return mediaUrl
  if (
    mediaType === 'image' &&
    mediaUrl.startsWith('data:image/') &&
    typeof window !== 'undefined'
  ) {
    const attemptCompress = (maxDim: number, quality: number) =>
      new Promise<string | undefined>((resolve) => {
        const img = new window.Image()
        img.onload = () => {
          try {
            const w = Math.max(1, img.naturalWidth || img.width || 1280)
            const h = Math.max(1, img.naturalHeight || img.height || 960)
            const scale = Math.max(w, h) > maxDim ? maxDim / Math.max(w, h) : 1
            const canvas = document.createElement('canvas')
            canvas.width = Math.max(1, Math.round(w * scale))
            canvas.height = Math.max(1, Math.round(h * scale))
            const ctx = canvas.getContext('2d')
            if (!ctx) {
              resolve(undefined)
              return
            }
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            const compressed = canvas.toDataURL('image/jpeg', quality)
            resolve(compressed.length <= 740000 ? compressed : undefined)
          } catch {
            resolve(undefined)
          }
        }
        img.onerror = () => resolve(undefined)
        img.src = mediaUrl
      })
    const firstPass = await attemptCompress(1440, 0.76)
    if (firstPass) return firstPass
    return attemptCompress(960, 0.65)
  }
  return undefined
}

function buildFirestoreChatMessagePayload(msg: ChatMessage, safeMediaUrl?: string) {
  const payload: Record<string, unknown> = {
    id: msg.id,
    campusId: 'ics-academy',
    roomId: msg.roomId.slice(0, 160),
    senderId: msg.senderId,
    senderName: (msg.senderName || 'Campus Member').slice(0, 120),
    senderRole: msg.senderRole,
    text: (msg.text || '').slice(0, 8000),
    mediaType: msg.mediaType,
    reactions: msg.reactions || {},
    deliveredTo:
      Array.isArray(msg.deliveredTo) && msg.deliveredTo.length > 0
        ? msg.deliveredTo.slice(0, 300)
        : [msg.senderId],
    deliveredAtMap:
      msg.deliveredAtMap && typeof msg.deliveredAtMap === 'object'
        ? msg.deliveredAtMap
        : {},
    readBy:
      Array.isArray(msg.readBy) && msg.readBy.length > 0
        ? msg.readBy.slice(0, 300)
        : [msg.senderId],
    readAtMap:
      msg.readAtMap && typeof msg.readAtMap === 'object' ? msg.readAtMap : {},
    starredBy: Array.isArray(msg.starredBy) ? msg.starredBy.slice(0, 300) : [],
    isForwarded: Boolean(msg.isForwarded),
    deletedFor: Array.isArray(msg.deletedFor) ? msg.deletedFor.slice(0, 300) : [],
    isDeleted: Boolean(msg.isDeleted),
    createdAt: serverTimestamp(),
    createdAtMs: Math.floor(msg.createdAtMs || Date.now()),
  }

  if (msg.senderBadge) payload.senderBadge = msg.senderBadge.slice(0, 80)
  if (safeMediaUrl && safeMediaUrl.length <= 750000) payload.mediaUrl = safeMediaUrl
  if (msg.mediaName) payload.mediaName = msg.mediaName.slice(0, 200)
  if (msg.mediaSizeLabel) payload.mediaSizeLabel = msg.mediaSizeLabel.slice(0, 64)
  if (typeof msg.mediaDurationSec === 'number') {
    payload.mediaDurationSec = Math.max(0, Math.min(3600, Math.round(msg.mediaDurationSec)))
  }
  if (msg.imageQuality === 'standard' || msg.imageQuality === 'hd') {
    payload.imageQuality = msg.imageQuality
  }
  if (msg.imageDimensions) payload.imageDimensions = msg.imageDimensions.slice(0, 40)
  if (msg.replyTo) {
    payload.replyTo = {
      messageId: String(msg.replyTo.messageId).slice(0, 128),
      senderName: String(msg.replyTo.senderName).slice(0, 120),
      previewText: String(msg.replyTo.previewText).slice(0, 200),
    }
  }
  return payload
}

export function makeDirectRoomId(idA: string, idB: string): string {
  const sorted = [idA.trim(), idB.trim()].sort()
  return `direct__${sorted[0]}__${sorted[1]}`
}

export function makeBatchRoomId(className: string): string {
  const clean = className.split('•')[0].replace(/^Class\s+/i, '').trim()
  return `batch_group__${clean}`
}

export const STAFF_ROOM_ID = 'staff_group__usthads'

/**
 * Generates a valid, playable short WAV data URL for synthesized voice notes
 * when browser MediaRecorder is unavailable or blocked inside a sandboxed preview.
 */
function createSynthesizedVoiceWavDataUrl(durationSec = 4): string {
  const sampleRate = 8000
  const numSamples = Math.max(1, Math.min(15, durationSec)) * sampleRate
  const buffer = new ArrayBuffer(44 + numSamples)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + numSamples, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  writeString(36, 'data')
  view.setUint32(40, numSamples, true)

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    const envelope = Math.sin(Math.PI * (i / numSamples))
    const freq = 220 + 60 * Math.sin(2 * Math.PI * 2.5 * t)
    const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 28
    view.setUint8(44 + i, Math.max(0, Math.min(255, Math.round(128 + sample))))
  }

  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return `data:audio/wav;base64,${typeof window !== 'undefined' ? window.btoa(binary) : ''}`
}

const IST_TIME_ZONE = 'Asia/Kolkata'
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const MS_PER_DAY = 24 * 60 * 60 * 1000

function getIstDayNumber(ms: number): number {
  return Math.floor((ms + IST_OFFSET_MS) / MS_PER_DAY)
}

function getIstYear(ms: number): number {
  return new Date(ms + IST_OFFSET_MS).getUTCFullYear()
}

function formatChatTime(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString('en-IN', {
      timeZone: IST_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return 'Just now'
  }
}

function formatLastSeenStatus(ms: number, nowMs: number = Date.now()): string {
  try {
    const timeStr = new Date(ms)
      .toLocaleTimeString('en-IN', {
        timeZone: IST_TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
      .toLowerCase()
    const diffDays = getIstDayNumber(nowMs) - getIstDayNumber(ms)
    if (diffDays <= 0) {
      return `last seen today at ${timeStr}`
    }
    if (diffDays === 1) {
      return `last seen yesterday at ${timeStr}`
    }
    const sameYear = getIstYear(ms) === getIstYear(nowMs)
    const datePart = new Date(ms).toLocaleDateString('en-IN', {
      timeZone: IST_TIME_ZONE,
      day: 'numeric',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' }),
    })
    return `last seen ${datePart} at ${timeStr}`
  } catch {
    return `last seen ${formatChatTime(ms)}`
  }
}

function formatSidebarDateOrTime(ms: number, nowMs: number = Date.now()): string {
  try {
    const diffDays = getIstDayNumber(nowMs) - getIstDayNumber(ms)
    if (diffDays <= 0) {
      return formatChatTime(ms)
    }
    if (diffDays === 1) {
      return 'Yesterday'
    }
    const sameYear = getIstYear(ms) === getIstYear(nowMs)
    return new Date(ms).toLocaleDateString('en-IN', {
      timeZone: IST_TIME_ZONE,
      day: 'numeric',
      month: 'short',
      ...(sameYear ? {} : { year: '2-digit' }),
    })
  } catch {
    return formatChatTime(ms)
  }
}

function formatReceiptTimestamp(ms?: number): string {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return '—'
  try {
    const nowMs = Date.now()
    const timeStr = new Date(ms)
      .toLocaleTimeString('en-IN', {
        timeZone: IST_TIME_ZONE,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      .toLowerCase()
    const diffDays = getIstDayNumber(nowMs) - getIstDayNumber(ms)
    if (diffDays <= 0) {
      return `Today, ${timeStr}`
    }
    if (diffDays === 1) {
      return `Yesterday, ${timeStr}`
    }
    const sameYear = getIstYear(ms) === getIstYear(nowMs)
    const datePart = new Date(ms).toLocaleDateString('en-IN', {
      timeZone: IST_TIME_ZONE,
      day: 'numeric',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' }),
    })
    return `${datePart}, ${timeStr}`
  } catch {
    return '—'
  }
}

function sanitizeTimestampMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const num = Number(v)
    if (k && Number.isFinite(num) && num > 0) {
      out[k] = Math.floor(num)
    }
  }
  return out
}

function mergeTimestampMaps(
  a?: Record<string, number>,
  b?: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const src of [a, b]) {
    if (!src || typeof src !== 'object') continue
    for (const [k, v] of Object.entries(src)) {
      const num = Number(v)
      if (!k || !Number.isFinite(num) || num <= 0) continue
      if (!out[k] || num < out[k]) {
        out[k] = Math.floor(num)
      }
    }
  }
  return out
}

function resolveActorDirectoryProfile(actorId: string): {
  id: string
  name: string
  subtitle: string
  avatarText: string
  avatarUrl?: string
  role: MessengerRole
} {
  const canonical = getCanonicalUsthadId(actorId)
  if (canonical === ACADEMY_PRINCIPAL.usthadId || actorId === ACADEMY_PRINCIPAL.id) {
    return {
      id: canonical,
      name: ACADEMY_PRINCIPAL.name,
      subtitle: 'Principal • ICS Academy',
      avatarText: 'PR',
      avatarUrl:
        OFFICIAL_CLASS_USTHADS.find((u) => u.id === ACADEMY_PRINCIPAL.usthadId)?.avatarUrl,
      role: 'principal',
    }
  }
  const usthadMatch =
    OFFICIAL_CLASS_USTHADS.find((u) => u.id === actorId || u.id === canonical) ||
    CLASS_USTHADS.find((u) => u.id === actorId || u.id === canonical)
  if (usthadMatch) {
    return {
      id: usthadMatch.id,
      name: usthadMatch.name,
      subtitle: usthadMatch.designation || `Class ${usthadMatch.className} Usthad`,
      avatarText: usthadMatch.name
        .replace(/^Usthad\s+/i, '')
        .slice(0, 2)
        .toUpperCase(),
      avatarUrl: usthadMatch.avatarUrl,
      role: 'usthad',
    }
  }
  const studentMatch = students.find((s) => s.id === actorId)
  if (studentMatch) {
    return {
      id: studentMatch.id,
      name: studentMatch.name,
      subtitle: `Class ${studentMatch.className} • ${studentMatch.admissionNo}`,
      avatarText: studentMatch.firstName.slice(0, 2).toUpperCase(),
      avatarUrl: studentMatch.avatarUrl,
      role: 'student',
    }
  }
  return {
    id: actorId,
    name: actorId,
    subtitle: 'ICS Academy Member',
    avatarText: actorId.slice(0, 2).toUpperCase(),
    role: 'student',
  }
}

function formatVoiceDuration(sec: number): string {
  const clean = Math.max(1, Math.round(sec || 1))
  const m = Math.floor(clean / 60)
  const s = clean % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function buildInitialSeedMessages(): Record<string, ChatMessage[]> {
  return {}
}

function buildInitialSeedMeta(): Record<string, ChatRoomMeta> {
  return {}
}

function loadLocalMessages(): Record<string, ChatMessage[]> {
  const seeded = buildInitialSeedMessages()
  if (typeof window === 'undefined') return seeded
  ensureCleanLaunchStorage()
  try {
    const raw = window.localStorage.getItem(LOCAL_CHAT_MESSAGES_KEY)
    if (!raw) return seeded
    const parsed = JSON.parse(raw) as Record<string, ChatMessage[]>
    if (!parsed || typeof parsed !== 'object') return seeded
    const merged: Record<string, ChatMessage[]> = { ...seeded }
    for (const [roomId, msgs] of Object.entries(parsed)) {
      if (Array.isArray(msgs) && msgs.length > 0) {
        merged[roomId] = msgs.map((m) =>
          m.mediaType === 'voice' && m.text.includes('Voice Message')
            ? { ...m, text: '' }
            : m,
        )
      }
    }
    return merged
  } catch {
    return seeded
  }
}

function loadLocalMeta(): Record<string, ChatRoomMeta> {
  const seeded = buildInitialSeedMeta()
  if (typeof window === 'undefined') return seeded
  ensureCleanLaunchStorage()
  try {
    const raw = window.localStorage.getItem(LOCAL_CHAT_META_KEY)
    if (!raw) return seeded
    const parsed = JSON.parse(raw) as Record<string, ChatRoomMeta>
    if (!parsed || typeof parsed !== 'object') return seeded
    return { ...seeded, ...parsed }
  } catch {
    return seeded
  }
}

export interface CampusMessengerProps {
  role: MessengerRole
  student?: Student
  usthad?: ClassUsthad
  principal?: PrincipalProfile
  activeClassName?: string
  mobileFullScreen?: boolean
  isMessengerVisible?: boolean
  mobileTabActive?: boolean
}

export function CampusMessenger({
  role,
  student,
  usthad,
  principal = ACADEMY_PRINCIPAL,
  activeClassName,
  mobileFullScreen = true,
  isMessengerVisible,
  mobileTabActive,
}: CampusMessengerProps) {
  // Resolve current actor identity (canonicalizing Usthad/Principal IDs so rooms always match)
  const actor = useMemo(() => {
    if (role === 'principal') {
      return {
        id: getCanonicalUsthadId(principal.usthadId || 'usthad-07'),
        name: principal.name,
        role: 'principal' as MessengerRole,
        badge: 'Principal',
        className: principal.assignedClassName || 'BS 3',
        isStaff: true,
      }
    }
    if (role === 'usthad' && usthad) {
      const canonicalId = getCanonicalUsthadId(usthad.id)
      const isPrincipalDual = canonicalId === ACADEMY_PRINCIPAL.usthadId
      return {
        id: canonicalId,
        name: usthad.name,
        role: (isPrincipalDual ? 'principal' : 'usthad') as MessengerRole,
        badge: usthad.designation.split('•')[0].trim(),
        className: activeClassName || usthad.className,
        isStaff: true,
      }
    }
    const activeStudent = student ?? students[0]
    return {
      id: activeStudent.id,
      name: activeStudent.name,
      role: 'student' as MessengerRole,
      badge: activeStudent.className,
      className: activeStudent.className,
      isStaff: false,
    }
  }, [role, student, usthad, principal, activeClassName])

  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, ChatMessage[]>>(() =>
    loadLocalMessages(),
  )
  const [roomsMeta, setRoomsMeta] = useState<Record<string, ChatRoomMeta>>(() =>
    loadLocalMeta(),
  )
  const [presenceMap, setPresenceMap] = useState<Record<string, ChatPresenceEntry>>({})
  const [typingMap, setTypingMap] = useState<Record<string, Record<string, ChatTypingEntry>>>({})

  // User Chat Settings State
  const [chatSettings, setChatSettings] = useState<ChatUserSettings>(() => loadChatSettings())
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settingsToast, setSettingsToast] = useState<string | null>(null)

  // Global Voice & Video Calling Context
  const {
    startCall,
    callHistory,
    unreadMissedCallsCount,
    markMissedCallsSeen,
    registerActiveCallActor,
    activeCall,
  } = useCampusCall()

  // Keep global call provider synced with the exact resolved messenger actor identity
  useEffect(() => {
    registerActiveCallActor({
      id: actor.id,
      name: actor.name,
      role: actor.role,
      subtitle: actor.badge,
    })
  }, [actor.id, actor.name, actor.role, actor.badge, registerActiveCallActor])

  // Filter tabs & search
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | 'groups' | 'usthads' | 'students' | 'staff' | 'calls'
  >('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [studentBatchFilter, setStudentBatchFilter] = useState<string>(() => actor.className)
  const [showNewChatModal, setShowNewChatModal] = useState(false)

  // Active room selection & mobile pane state
  const defaultRoomId = useMemo(() => {
    if (actor.isStaff) {
      return makeBatchRoomId(actor.className)
    }
    return makeBatchRoomId(actor.className)
  }, [actor.className, actor.isStaff])

  const [selectedRoomId, setSelectedRoomId] = useState<string>(defaultRoomId)
  const [mobileShowChatPane, setMobileShowChatPane] = useState<boolean>(false)
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean>(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 1024,
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleResize = () => setIsDesktopViewport(window.innerWidth >= 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isTabShown =
    isMessengerVisible !== undefined
      ? isMessengerVisible
      : isDesktopViewport
        ? true
        : (mobileTabActive ?? true)
  const isConversationPaneOpen = isTabShown && (isDesktopViewport || mobileShowChatPane)

  const knownPresenceIdsRef = useRef<Set<string>>(new Set())
  const knownMetaIdsRef = useRef<Set<string>>(new Set())
  const firestoreMessageIdsRef = useRef<Set<string>>(new Set())
  const sentReceiptKeysRef = useRef<Set<string>>(new Set())

  // Keep default room and per-actor "Delete for me" list synced when student/usthad switches profile
  useEffect(() => {
    setSelectedRoomId(makeBatchRoomId(actor.className))
    setStudentBatchFilter(actor.className)
    setDeleteModalMessages([])
    setSelectedMessageIds([])
    setShowSelectionMoreMenu(false)
    setInfoMessageId(null)
    setForwardMessageIds([])
    setForwardTargetRoomIds([])
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(`ics_chat_deleted_for_me_${actor.id}`)
        setDeletedForMeIds(raw ? (JSON.parse(raw) as string[]) : [])
      } catch {
        setDeletedForMeIds([])
      }
      try {
        const rawStars = window.localStorage.getItem(`ics_chat_starred_ids_${actor.id}`)
        setLocalStarredIds(rawStars ? (JSON.parse(rawStars) as string[]) : [])
      } catch {
        setLocalStarredIds([])
      }
    }
  }, [actor.className, actor.id])

  // Composer & WhatsApp Multi-Selection / Info / Forward / Starred State
  const [inputText, setInputText] = useState('')
  const [replyingTo, setReplyingTo] = useState<ChatReplyRef | null>(null)
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([])
  const [showSelectionMoreMenu, setShowSelectionMoreMenu] = useState(false)
  const [infoMessageId, setInfoMessageId] = useState<string | null>(null)
  const [forwardMessageIds, setForwardMessageIds] = useState<string[]>([])
  const [forwardTargetRoomIds, setForwardTargetRoomIds] = useState<string[]>([])
  const [forwardSearchQuery, setForwardSearchQuery] = useState('')
  const [forwardBatchFilter, setForwardBatchFilter] = useState<string>('ALL')
  const [showStarredModal, setShowStarredModal] = useState(false)
  const [newChatSearchQuery, setNewChatSearchQuery] = useState('')
  const [actionToast, setActionToast] = useState<string | null>(null)
  const [deleteModalMessages, setDeleteModalMessages] = useState<ChatMessage[]>([])
  const [localStarredIds, setLocalStarredIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(`ics_chat_starred_ids_${actor.id}`)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })
  const [deletedForMeIds, setDeletedForMeIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(`ics_chat_deleted_for_me_${actor.id}`)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })
  const [deletedForEveryoneMap, setDeletedForEveryoneMap] = useState<
    Record<string, { deletedBy: string; deletedById: string }>
  >(() => {
    if (typeof window === 'undefined') return {}
    try {
      const raw = window.localStorage.getItem('ics_chat_deleted_for_everyone_v1')
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  })
  const longPressTimerRef = useRef<number | null>(null)
  const longPressTriggeredRef = useRef<boolean>(false)
  const actionToastTimerRef = useRef<number | null>(null)
  const selectionMoreMenuRef = useRef<HTMLDivElement | null>(null)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [pendingAttachment, setPendingAttachment] = useState<{
    mediaType: 'image' | 'pdf'
    mediaUrl: string
    mediaName: string
    mediaSizeLabel: string
    imageQuality?: 'standard' | 'hd'
    imageDimensions?: string
    standardVariant?: {
      url: string
      dimensions: string
      sizeLabel: string
    }
    hdVariant?: {
      url: string
      dimensions: string
      sizeLabel: string
    }
  } | null>(null)
  const [showPhotoQualitySheet, setShowPhotoQualitySheet] = useState(false)
  const [photoQualityToast, setPhotoQualityToast] = useState<string | null>(null)
  const [lightboxImage, setLightboxImage] = useState<{
    messageId?: string
    url: string
    name: string
    quality?: 'standard' | 'hd'
    dimensions?: string
  } | null>(null)

  // Voice Note Recorder state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<number | null>(null)

  // Audio playback state
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)
  const [playbackProgress, setPlaybackProgress] = useState<number>(0)
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const pdfInputRef = useRef<HTMLInputElement | null>(null)
  const attachMenuRef = useRef<HTMLDivElement | null>(null)
  const attachButtonRef = useRef<HTMLButtonElement | null>(null)
  const lastTypingSentMsRef = useRef<number>(0)

  // Automatically close Attachment Menu when tapping any other icon or anywhere outside
  useEffect(() => {
    if (!showAttachMenu) return
    const handleGlobalPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (attachMenuRef.current?.contains(target)) return
      if (attachButtonRef.current?.contains(target)) return
      setShowAttachMenu(false)
    }
    document.addEventListener('pointerdown', handleGlobalPointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', handleGlobalPointerDown, true)
    }
  }, [showAttachMenu])

  // Build available rooms for this user
  const allRooms = useMemo<ChatRoomDescriptor[]>(() => {
    const list: ChatRoomDescriptor[] = []

    // 1. Staff Room (Strictly for Principal & Usthads only)
    if (actor.isStaff) {
      list.push({
        roomId: STAFF_ROOM_ID,
        type: 'staff_group',
        title: 'Staff Room',
        subtitle: '9 Usthads',
        badgeLabel: 'Staff',
        avatarText: 'SR',
        isStaffOnly: true,
      })
    }

    // 2. Class Batch Groups
    if (actor.isStaff) {
      // Usthads & Principal can access their assigned class group first, then all other batch groups
      const orderedClasses = [...ACADEMY_CLASSES].sort((a, b) => {
        if (a.className === actor.className) return -1
        if (b.className === actor.className) return 1
        return 0
      })
      for (const cls of orderedClasses) {
        const isOwnClass = cls.className === actor.className
        list.push({
          roomId: makeBatchRoomId(cls.className),
          type: 'batch_group',
          title: isOwnClass ? 'My Class Group' : `${cls.fullLabel} Group`,
          subtitle: '',
          badgeLabel: '',
          batchName: cls.className,
          avatarText: 'CG',
        })
      }
    } else {
      // Student sees ONLY their own class group as "My Class Group"
      const myCls =
        ACADEMY_CLASSES.find((c) => c.className === actor.className) ?? ACADEMY_CLASSES[0]
      list.push({
        roomId: makeBatchRoomId(myCls.className),
        type: 'batch_group',
        title: 'My Class Group',
        subtitle: '',
        badgeLabel: '',
        batchName: myCls.className,
        avatarText: 'CG',
      })
    }

    // 3. Direct Chats with all 9 Teaching & Class Usthads (Show only name)
    for (const u of OFFICIAL_CLASS_USTHADS) {
      if (u.id === actor.id) continue
      const isPrincipalUsthad = u.id === ACADEMY_PRINCIPAL.usthadId
      list.push({
        roomId: makeDirectRoomId(actor.id, u.id),
        type: 'direct_usthad',
        title: u.name,
        subtitle: '',
        badgeLabel: '',
        batchName: u.className,
        peerId: u.id,
        peerRole: isPrincipalUsthad ? 'principal' : 'usthad',
        avatarText: u.name
          .replace(/^Usthad\s+/i, '')
          .slice(0, 2)
          .toUpperCase(),
        avatarUrl: u.avatarUrl,
      })
    }

    // 4. Direct Chats with Students (All students can chat with every student across all batches)
    const normalizedSearch = searchQuery.trim().toLowerCase()
    const targetStudents = students.filter((s) => {
      if (s.id === actor.id) return false
      const dId = makeDirectRoomId(actor.id, s.id)
      const hasHistory = (messagesByRoom[dId]?.length ?? 0) > 0
      if (hasHistory) return true
      if (normalizedSearch) {
        return (
          s.name.toLowerCase().includes(normalizedSearch) ||
          s.className.toLowerCase().includes(normalizedSearch) ||
          s.admissionNo.toLowerCase().includes(normalizedSearch)
        )
      }
      if (studentBatchFilter === 'ALL') return true
      return s.className === studentBatchFilter
    })

    for (const st of targetStudents) {
      list.push({
        roomId: makeDirectRoomId(actor.id, st.id),
        type: 'direct_student',
        title: st.name,
        subtitle: st.className !== actor.className ? `Class ${st.className}` : '',
        badgeLabel: st.className !== actor.className ? st.className : '',
        batchName: st.className,
        peerId: st.id,
        peerRole: 'student',
        avatarText: st.firstName.slice(0, 2).toUpperCase(),
        avatarUrl: st.avatarUrl,
      })
    }

    return list
  }, [actor.id, actor.className, actor.isStaff, messagesByRoom, studentBatchFilter, searchQuery])

  // Persist messages & room meta to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(LOCAL_CHAT_MESSAGES_KEY, JSON.stringify(messagesByRoom))
    } catch {
      // Ignore quota errors
    }
  }, [messagesByRoom])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(LOCAL_CHAT_META_KEY, JSON.stringify(roomsMeta))
    } catch {
      // Ignore quota errors
    }
  }, [roomsMeta])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(LOCAL_CHAT_SETTINGS_KEY, JSON.stringify(chatSettings))
    } catch {
      // Ignore quota errors
    }
  }, [chatSettings])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(
        `ics_chat_deleted_for_me_${actor.id}`,
        JSON.stringify(deletedForMeIds),
      )
    } catch {
      // Ignore quota errors
    }
  }, [deletedForMeIds, actor.id])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(
        'ics_chat_deleted_for_everyone_v1',
        JSON.stringify(deletedForEveryoneMap),
      )
    } catch {
      // Ignore quota errors
    }
  }, [deletedForEveryoneMap])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(
        `ics_chat_starred_ids_${actor.id}`,
        JSON.stringify(localStarredIds),
      )
    } catch {
      // Ignore quota errors
    }
  }, [localStarredIds, actor.id])

  // Clear selection / info panel when switching rooms
  useEffect(() => {
    setSelectedMessageIds([])
    setShowSelectionMoreMenu(false)
    setInfoMessageId(null)
  }, [selectedRoomId])

  // Close selection overflow menu on outside tap or Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (showSelectionMoreMenu) {
        setShowSelectionMoreMenu(false)
      } else if (infoMessageId) {
        setInfoMessageId(null)
      } else if (selectedMessageIds.length > 0) {
        setSelectedMessageIds([])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSelectionMoreMenu, infoMessageId, selectedMessageIds.length])

  useEffect(() => {
    if (!showSelectionMoreMenu) return
    const handleOutside = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (selectionMoreMenuRef.current?.contains(target)) return
      setShowSelectionMoreMenu(false)
    }
    document.addEventListener('pointerdown', handleOutside, true)
    return () => document.removeEventListener('pointerdown', handleOutside, true)
  }, [showSelectionMoreMenu])

  const showToast = useCallback((msg: string) => {
    setActionToast(msg)
    if (actionToastTimerRef.current) {
      window.clearTimeout(actionToastTimerRef.current)
    }
    actionToastTimerRef.current = window.setTimeout(() => {
      setActionToast(null)
    }, 2400)
  }, [])

  const isMessageHiddenForMe = useCallback(
    (msg: ChatMessage) => {
      if (deletedForMeIds.includes(msg.id)) return true
      if (Array.isArray(msg.deletedFor) && msg.deletedFor.includes(actor.id)) return true
      return false
    },
    [deletedForMeIds, actor.id],
  )

  const isMessageStarredByMe = useCallback(
    (msg: ChatMessage) => {
      if (Array.isArray(msg.starredBy) && msg.starredBy.includes(actor.id)) return true
      return localStarredIds.includes(msg.id)
    },
    [actor.id, localStarredIds],
  )

  const updateChatSetting = <K extends keyof ChatUserSettings>(
    key: K,
    value: ChatUserSettings[K],
  ) => {
    setChatSettings((prev) => ({ ...prev, [key]: value }))
  }

  // Real-Time Server Sync Helper
  const mergeIncomingChatStates = useCallback(
    (
      states: Array<{
        roomsMeta?: Record<string, ChatRoomMeta>
        messagesByRoom?: Record<string, ChatMessage[]>
        presenceMap?: Record<string, ChatPresenceEntry>
        typingMap?: Record<string, Record<string, ChatTypingEntry>>
      }>,
    ) => {
      if (states.length === 0) return

      // Merge presenceMap (taking latest lastSeenMs per actor)
      const mergedPresence: Record<string, ChatPresenceEntry> = {}
      for (const st of states) {
        if (!st.presenceMap) continue
        for (const [aId, p] of Object.entries(st.presenceMap)) {
          const cur = mergedPresence[aId]
          if (!cur || (p.lastSeenMs || 0) >= (cur.lastSeenMs || 0)) {
            mergedPresence[aId] = p
          }
        }
      }
      if (Object.keys(mergedPresence).length > 0) {
        setPresenceMap((prev) => ({ ...prev, ...mergedPresence }))
      }

      // Merge typingMap
      const mergedTyping: Record<string, Record<string, ChatTypingEntry>> = {}
      for (const st of states) {
        if (!st.typingMap) continue
        for (const [rId, roomTypers] of Object.entries(st.typingMap)) {
          if (!roomTypers) continue
          mergedTyping[rId] = { ...(mergedTyping[rId] || {}), ...roomTypers }
        }
      }
      setTypingMap(mergedTyping)

      // Merge roomsMeta (latest updatedAtMs wins)
      const mergedMeta: Record<string, ChatRoomMeta> = {}
      for (const st of states) {
        if (!st.roomsMeta) continue
        for (const [rId, meta] of Object.entries(st.roomsMeta)) {
          const cur = mergedMeta[rId]
          if (!cur || (meta.updatedAtMs || 0) >= (cur.updatedAtMs || 0)) {
            mergedMeta[rId] = meta
          }
        }
      }
      if (Object.keys(mergedMeta).length > 0) {
        setRoomsMeta((prev) => ({ ...prev, ...mergedMeta }))
      }

      // Merge messagesByRoom across all endpoints monotonically (preserving deliveredTo & readBy sets)
      const hasAnyMessages = states.some(
        (st) => st.messagesByRoom && Object.keys(st.messagesByRoom).length > 0,
      )
      if (!hasAnyMessages) return

      let localDeletedEverMap: Record<string, { deletedBy: string; deletedById: string }> = {}
      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem('ics_chat_deleted_for_everyone_v1')
          if (raw) localDeletedEverMap = JSON.parse(raw)
        } catch {
          // Ignore
        }
      }

      let discoveredNewIncomingFromOthers = false

      setMessagesByRoom((prev) => {
        let anyRoomChanged = false
        const next = { ...prev }
        const allRoomIds = new Set<string>()
        for (const st of states) {
          if (st.messagesByRoom) {
            for (const rId of Object.keys(st.messagesByRoom)) {
              allRoomIds.add(rId)
            }
          }
        }

        for (const rId of allRoomIds) {
          let roomChanged = false
          const localList = next[rId] ?? []
          const byId = new Map<string, ChatMessage>()
          for (const m of localList) byId.set(m.id, m)

          // Check if this room belongs to the current user (for automatic delivery receipt)
          const isMyRoom =
            (rId.startsWith('direct__') && rId.split('__').includes(actor.id)) ||
            (rId === STAFF_ROOM_ID && actor.isStaff) ||
            (rId.startsWith('batch_group__') &&
              (actor.isStaff || rId === makeBatchRoomId(actor.className)))

          for (const st of states) {
            const serverMsgs = st.messagesByRoom?.[rId]
            if (!Array.isArray(serverMsgs) || serverMsgs.length === 0) continue

            for (const sm of serverMsgs) {
              const existing = byId.get(sm.id)
              if (!existing && sm.senderId !== actor.id && isMyRoom) {
                discoveredNewIncomingFromOthers = true
              }

              const localTombstone = localDeletedEverMap[sm.id]
              const shouldBeDeleted = Boolean(
                existing?.isDeleted || sm.isDeleted || localTombstone,
              )
              const mergedDeletedFor = Array.from(
                new Set([...(existing?.deletedFor ?? []), ...(sm.deletedFor ?? [])]),
              )

              // Monotonically union readBy & deliveredTo and earliest timestamps across local and server states
              const mergedReadBy = Array.from(
                new Set(
                  [
                    sm.senderId,
                    ...(existing?.readBy ?? []),
                    ...(sm.readBy ?? []),
                  ].filter(Boolean),
                ),
              )
              const mergedDeliveredTo = Array.from(
                new Set(
                  [
                    sm.senderId,
                    ...(existing?.deliveredTo ?? []),
                    ...(sm.deliveredTo ?? []),
                    ...mergedReadBy,
                    ...(isMyRoom ? [actor.id] : []),
                  ].filter(Boolean),
                ),
              )
              const mergedDeliveredAtMap = mergeTimestampMaps(
                existing?.deliveredAtMap,
                sm.deliveredAtMap,
              )
              if (isMyRoom && actor.id !== sm.senderId && !mergedDeliveredAtMap[actor.id]) {
                mergedDeliveredAtMap[actor.id] = Date.now()
              }
              const mergedReadAtMap = mergeTimestampMaps(
                existing?.readAtMap,
                sm.readAtMap,
              )
              const mergedStarredBy = Array.isArray(sm.starredBy)
                ? sm.starredBy
                : (existing?.starredBy ?? [])
              const mergedIsForwarded = Boolean(sm.isForwarded || existing?.isForwarded)

              // Merge reactions across endpoints
              const mergedReactions: Record<string, string[]> = {
                ...(existing?.reactions ?? {}),
                ...(sm.reactions ?? {}),
              }

              const mergedMsg: ChatMessage = shouldBeDeleted
                ? {
                    ...sm,
                    deliveredTo: mergedDeliveredTo,
                    deliveredAtMap: mergedDeliveredAtMap,
                    readBy: mergedReadBy,
                    readAtMap: mergedReadAtMap,
                    starredBy: [],
                    isForwarded: mergedIsForwarded,
                    reactions: mergedReactions,
                    isDeleted: true,
                    deletedBy:
                      existing?.deletedBy ||
                      sm.deletedBy ||
                      localTombstone?.deletedBy ||
                      'Member',
                    deletedById:
                      existing?.deletedById ||
                      sm.deletedById ||
                      localTombstone?.deletedById,
                    deletedFor: mergedDeletedFor,
                    text: '',
                    mediaType: 'none',
                    mediaUrl: undefined,
                  }
                : {
                    ...sm,
                    deliveredTo: mergedDeliveredTo,
                    deliveredAtMap: mergedDeliveredAtMap,
                    readBy: mergedReadBy,
                    readAtMap: mergedReadAtMap,
                    starredBy: mergedStarredBy,
                    isForwarded: mergedIsForwarded,
                    reactions: mergedReactions,
                    deletedFor: mergedDeletedFor,
                  }

              const prevDeliveredLen = existing?.deliveredTo?.length ?? 0
              const prevReadLen = existing?.readBy?.length ?? 0

              if (
                !existing ||
                existing.isDeleted !== mergedMsg.isDeleted ||
                existing.deletedById !== mergedMsg.deletedById ||
                prevDeliveredLen !== mergedDeliveredTo.length ||
                prevReadLen !== mergedReadBy.length ||
                Object.keys(existing.deliveredAtMap ?? {}).length !==
                  Object.keys(mergedDeliveredAtMap).length ||
                Object.keys(existing.readAtMap ?? {}).length !==
                  Object.keys(mergedReadAtMap).length ||
                JSON.stringify(existing.starredBy ?? []) !==
                  JSON.stringify(mergedMsg.starredBy ?? []) ||
                JSON.stringify(existing.deletedFor ?? []) !==
                  JSON.stringify(mergedMsg.deletedFor ?? []) ||
                JSON.stringify(existing.reactions) !== JSON.stringify(mergedMsg.reactions)
              ) {
                byId.set(sm.id, mergedMsg)
                roomChanged = true
                anyRoomChanged = true
              }
            }
          }

          if (roomChanged) {
            next[rId] = Array.from(byId.values()).sort(
              (a, b) => a.createdAtMs - b.createdAtMs,
            )
          }
        }
        return anyRoomChanged ? next : prev
      })

      if (discoveredNewIncomingFromOthers) {
        void pullCampusStateFromServer()
      }
    },
    [actor.id, actor.className, actor.isStaff],
  )

  const sendChatActionToServer = useCallback(
    async (payload: Record<string, unknown>) => {
      const bases = Array.from(new Set(getOrderedChatSyncBases()))
      const bodyStr = JSON.stringify({
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        actorClassName: actor.className,
        hideOnline: !chatSettings.showOnlineStatus,
        sendReadReceipts: chatSettings.sendReadReceipts,
        ...payload,
      })

      const results = await Promise.allSettled(
        bases.map(async (base) => {
          const res = await fetch(`${base}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: bodyStr,
          })
          if (!res.ok) throw new Error('Not OK')
          return (await res.json()) as {
            state?: {
              roomsMeta?: Record<string, ChatRoomMeta>
              messagesByRoom?: Record<string, ChatMessage[]>
              presenceMap?: Record<string, ChatPresenceEntry>
              typingMap?: Record<string, Record<string, ChatTypingEntry>>
            }
          }
        }),
      )

      const returnedStates = results
        .filter(
          (
            r,
          ): r is PromiseFulfilledResult<{
            state?: {
              roomsMeta?: Record<string, ChatRoomMeta>
              messagesByRoom?: Record<string, ChatMessage[]>
              presenceMap?: Record<string, ChatPresenceEntry>
              typingMap?: Record<string, Record<string, ChatTypingEntry>>
            }
          }> => r.status === 'fulfilled' && Boolean(r.value?.state),
        )
        .map((r) => r.value.state!)

      if (returnedStates.length > 0) {
        mergeIncomingChatStates(returnedStates)
      }
    },
    [
      actor.id,
      actor.name,
      actor.role,
      actor.className,
      chatSettings.showOnlineStatus,
      chatSettings.sendReadReceipts,
      mergeIncomingChatStates,
    ],
  )

  const pullChatStateFromServer = useCallback(async () => {
    const bases = Array.from(new Set(getOrderedChatSyncBases()))
    const isDesktopOrMobilePaneOpen =
      typeof window !== 'undefined' && (window.innerWidth >= 1024 || mobileShowChatPane)
    const isTabVisible =
      typeof document === 'undefined' || document.visibilityState === 'visible'

    const queryParams = new URLSearchParams({
      t: String(Date.now()),
      actorId: actor.id,
      className: actor.className,
      isStaff: String(Boolean(actor.isStaff)),
    })
    if (isConversationPaneOpen && isTabVisible && chatSettings.sendReadReceipts && selectedRoomId) {
      queryParams.set('readRoomId', selectedRoomId)
    }

    const results = await Promise.allSettled(
      bases.map(async (base) => {
        const res = await fetch(`${base}/state?${queryParams.toString()}`, {
          method: 'GET',
          cache: 'no-store',
        })
        if (!res.ok) throw new Error('Not OK')
        return (await res.json()) as {
          roomsMeta?: Record<string, ChatRoomMeta>
          messagesByRoom?: Record<string, ChatMessage[]>
          presenceMap?: Record<string, ChatPresenceEntry>
          typingMap?: Record<string, Record<string, ChatTypingEntry>>
        }
      }),
    )

    const validStates = results
      .filter(
        (
          r,
        ): r is PromiseFulfilledResult<{
          roomsMeta?: Record<string, ChatRoomMeta>
          messagesByRoom?: Record<string, ChatMessage[]>
          presenceMap?: Record<string, ChatPresenceEntry>
          typingMap?: Record<string, Record<string, ChatTypingEntry>>
        }> => r.status === 'fulfilled' && Boolean(r.value),
      )
      .map((r) => r.value)

    if (validStates.length > 0) {
      mergeIncomingChatStates(validStates)
    }
  }, [
    actor.id,
    actor.className,
    actor.isStaff,
    isConversationPaneOpen,
    selectedRoomId,
    chatSettings.sendReadReceipts,
    mergeIncomingChatStates,
  ])

  const syncPresenceToFirestore = useCallback(
    async (opts: {
      isOnline: boolean
      roomId?: string
      typingMode?: 'idle' | 'typing' | 'recording'
    }) => {
      if (!actor.id) return
      const docRef = doc(db, 'campusChatPresence', actor.id)
      const now = Math.floor(Date.now())
      const mutableFields = {
        actorName: actor.name.slice(0, 120),
        actorRole: actor.role,
        lastSeenMs: now,
        isOnline: opts.isOnline,
        hideOnline: !chatSettings.showOnlineStatus,
        typingRoomId: (opts.roomId || '').slice(0, 160),
        typingMode: opts.typingMode || 'idle',
        typingUpdatedAtMs: now,
      }
      try {
        if (knownPresenceIdsRef.current.has(actor.id)) {
          await updateDoc(docRef, mutableFields)
          return
        }
        try {
          await updateDoc(docRef, mutableFields)
          knownPresenceIdsRef.current.add(actor.id)
        } catch {
          await setDoc(docRef, {
            campusId: 'ics-academy',
            actorId: actor.id,
            ...mutableFields,
            createdAt: serverTimestamp(),
          })
          knownPresenceIdsRef.current.add(actor.id)
        }
      } catch {
        // Ignore transient offline errors
      }
    },
    [actor.id, actor.name, actor.role, chatSettings.showOnlineStatus],
  )

  const syncRoomMetaToFirestore = useCallback(
    async (
      roomId: string,
      onlyAdminsCanPost: boolean,
      pinnedMessageId: string | null,
    ) => {
      if (!actor.id || !roomId) return
      const roomDocId = sanitizeFirestoreDocId(roomId)
      const metaRef = doc(db, 'campusChatMeta', roomDocId)
      const now = Math.floor(Date.now())
      const mutableFields = {
        onlyAdminsCanPost,
        pinnedMessageId,
        updatedByActorId: actor.id,
        updatedAtMs: now,
      }
      try {
        if (knownMetaIdsRef.current.has(roomDocId)) {
          await updateDoc(metaRef, mutableFields)
          return
        }
        try {
          await updateDoc(metaRef, mutableFields)
          knownMetaIdsRef.current.add(roomDocId)
        } catch {
          await setDoc(metaRef, {
            campusId: 'ics-academy',
            roomId: roomId.slice(0, 160),
            ...mutableFields,
            createdAt: serverTimestamp(),
          })
          knownMetaIdsRef.current.add(roomDocId)
        }
      } catch {
        // Ignore transient offline errors
      }
    },
    [actor.id],
  )

  // Real-time Firestore listeners (<200ms) for Chat Messages, Delivery/Read Receipts, Room Meta & Presence/Typing
  useEffect(() => {
    const unsubscribes: Array<() => void> = []

    try {
      const msgQuery = query(
        collection(db, 'campusChatMessages'),
        where('createdAtMs', '>', 0),
        orderBy('createdAtMs', 'desc'),
        limit(250),
      )
      const unsubMsgs = onSnapshot(
        msgQuery,
        (snapshot) => {
          const grouped: Record<string, ChatMessage[]> = {}
          snapshot.forEach((docSnap) => {
            const raw = docSnap.data() as Record<string, unknown>
            if (!raw || typeof raw.id !== 'string' || typeof raw.roomId !== 'string') return
            firestoreMessageIdsRef.current.add(raw.id)

            const msg: ChatMessage = {
              id: raw.id,
              roomId: raw.roomId,
              senderId: String(raw.senderId || ''),
              senderName: String(raw.senderName || 'Member'),
              senderRole: (raw.senderRole as MessengerRole) || 'student',
              senderBadge:
                typeof raw.senderBadge === 'string' ? raw.senderBadge : undefined,
              text: typeof raw.text === 'string' ? raw.text : '',
              mediaType:
                (raw.mediaType as ChatMessage['mediaType']) || 'none',
              callMeta:
                raw.callMeta && typeof raw.callMeta === 'object'
                  ? {
                      callId: String((raw.callMeta as Record<string, unknown>).callId || ''),
                      callType:
                        (raw.callMeta as Record<string, unknown>).callType === 'video'
                          ? 'video'
                          : 'voice',
                      callStatus: (
                        [
                          'ringing',
                          'accepted',
                          'connected',
                          'declined',
                          'missed',
                          'ended',
                          'busy',
                        ].includes(String((raw.callMeta as Record<string, unknown>).callStatus))
                          ? String((raw.callMeta as Record<string, unknown>).callStatus)
                          : 'ended'
                      ) as CampusCallStatus,
                      durationSec:
                        typeof (raw.callMeta as Record<string, unknown>).durationSec === 'number'
                          ? Number((raw.callMeta as Record<string, unknown>).durationSec)
                          : undefined,
                      callerId: String((raw.callMeta as Record<string, unknown>).callerId || ''),
                      calleeId: String((raw.callMeta as Record<string, unknown>).calleeId || ''),
                    }
                  : undefined,
              mediaUrl: typeof raw.mediaUrl === 'string' && raw.mediaUrl ? raw.mediaUrl : undefined,
              mediaName: typeof raw.mediaName === 'string' ? raw.mediaName : undefined,
              mediaSizeLabel:
                typeof raw.mediaSizeLabel === 'string' ? raw.mediaSizeLabel : undefined,
              mediaDurationSec:
                typeof raw.mediaDurationSec === 'number' ? raw.mediaDurationSec : undefined,
              imageQuality:
                raw.imageQuality === 'hd' || raw.imageQuality === 'standard'
                  ? raw.imageQuality
                  : undefined,
              imageDimensions:
                typeof raw.imageDimensions === 'string' ? raw.imageDimensions : undefined,
              replyTo:
                raw.replyTo && typeof raw.replyTo === 'object'
                  ? (raw.replyTo as ChatReplyRef)
                  : undefined,
              reactions:
                raw.reactions && typeof raw.reactions === 'object'
                  ? (raw.reactions as Record<string, string[]>)
                  : {},
              deliveredTo: Array.isArray(raw.deliveredTo)
                ? raw.deliveredTo.map(String)
                : [String(raw.senderId || '')],
              deliveredAtMap: sanitizeTimestampMap(raw.deliveredAtMap),
              readBy: Array.isArray(raw.readBy)
                ? raw.readBy.map(String)
                : [String(raw.senderId || '')],
              readAtMap: sanitizeTimestampMap(raw.readAtMap),
              starredBy: Array.isArray(raw.starredBy) ? raw.starredBy.map(String) : [],
              isForwarded: raw.isForwarded === true,
              isDeleted: raw.isDeleted === true,
              deletedBy: typeof raw.deletedBy === 'string' ? raw.deletedBy : undefined,
              deletedById: typeof raw.deletedById === 'string' ? raw.deletedById : undefined,
              deletedFor: Array.isArray(raw.deletedFor)
                ? raw.deletedFor.map(String)
                : [],
              createdAt:
                typeof raw.createdAtMs === 'number'
                  ? new Date(raw.createdAtMs).toISOString()
                  : new Date().toISOString(),
              createdAtMs: typeof raw.createdAtMs === 'number' ? raw.createdAtMs : Date.now(),
            }

            if (!grouped[msg.roomId]) grouped[msg.roomId] = []
            grouped[msg.roomId].push(msg)

            // Immediately acknowledge delivery + timestamp in Firestore if this room belongs to the current user
            const isMyRoom =
              (msg.roomId.startsWith('direct__') &&
                msg.roomId.split('__').includes(actor.id)) ||
              (msg.roomId === STAFF_ROOM_ID && actor.isStaff) ||
              (msg.roomId.startsWith('batch_group__') &&
                (actor.isStaff || msg.roomId === makeBatchRoomId(actor.className)))

            const needsDeliveredArray = !(msg.deliveredTo ?? []).includes(actor.id)
            const needsDeliveredTs = !msg.deliveredAtMap?.[actor.id]

            if (
              isMyRoom &&
              !msg.isDeleted &&
              msg.senderId !== actor.id &&
              (needsDeliveredArray || needsDeliveredTs)
            ) {
              const delivKey = `d:${msg.id}:${actor.id}`
              if (!sentReceiptKeysRef.current.has(delivKey)) {
                sentReceiptKeysRef.current.add(delivKey)
                const delivNow = Math.floor(Date.now())
                const updateFields: Record<string, unknown> = {
                  deliveredTo: arrayUnion(actor.id),
                }
                if (needsDeliveredTs) {
                  updateFields[`deliveredAtMap.${actor.id}`] = delivNow
                }
                void updateDoc(doc(db, 'campusChatMessages', msg.id), updateFields).catch(() => {
                  sentReceiptKeysRef.current.delete(delivKey)
                })
              }
            }
          })

          for (const rId of Object.keys(grouped)) {
            grouped[rId].sort((a, b) => a.createdAtMs - b.createdAtMs)
          }

          if (Object.keys(grouped).length > 0) {
            mergeIncomingChatStates([{ messagesByRoom: grouped }])
          }
        },
        (error) => {
          const msg = error instanceof Error ? error.message : String(error)
          if (msg.includes('permission') || msg.includes('insufficient')) {
            try {
              handleFirestoreError(error, OperationType.LIST, 'campusChatMessages')
            } catch {
              // Logged cleanly
            }
          }
        },
      )
      unsubscribes.push(unsubMsgs)
    } catch {
      // Ignore listener attach error
    }

    try {
      const metaQuery = query(
        collection(db, 'campusChatMeta'),
        where('campusId', '==', 'ics-academy'),
      )
      const unsubMeta = onSnapshot(metaQuery, (snapshot) => {
        const fsMeta: Record<string, ChatRoomMeta> = {}
        snapshot.forEach((docSnap) => {
          knownMetaIdsRef.current.add(docSnap.id)
          const raw = docSnap.data() as Record<string, unknown>
          if (!raw || typeof raw.roomId !== 'string') return
          fsMeta[raw.roomId] = {
            roomId: raw.roomId,
            onlyAdminsCanPost: Boolean(raw.onlyAdminsCanPost),
            pinnedMessageId:
              typeof raw.pinnedMessageId === 'string' ? raw.pinnedMessageId : null,
            updatedAtMs:
              typeof raw.updatedAtMs === 'number' ? raw.updatedAtMs : Date.now(),
          }
        })
        if (Object.keys(fsMeta).length > 0) {
          mergeIncomingChatStates([{ roomsMeta: fsMeta }])
        }
      })
      unsubscribes.push(unsubMeta)
    } catch {
      // Ignore listener attach error
    }

    try {
      const presenceQuery = query(
        collection(db, 'campusChatPresence'),
        where('campusId', '==', 'ics-academy'),
      )
      const unsubPresence = onSnapshot(presenceQuery, (snapshot) => {
        const fsPresence: Record<string, ChatPresenceEntry> = {}
        const fsTyping: Record<string, Record<string, ChatTypingEntry>> = {}
        snapshot.forEach((docSnap) => {
          knownPresenceIdsRef.current.add(docSnap.id)
          const raw = docSnap.data() as Record<string, unknown>
          if (!raw || typeof raw.actorId !== 'string') return
          const entry: ChatPresenceEntry = {
            actorId: raw.actorId,
            actorName: String(raw.actorName || 'Member'),
            actorRole: (raw.actorRole as MessengerRole) || 'student',
            lastSeenMs: typeof raw.lastSeenMs === 'number' ? raw.lastSeenMs : 0,
            isOnline: typeof raw.isOnline === 'boolean' ? raw.isOnline : true,
            hideOnline: Boolean(raw.hideOnline),
          }
          fsPresence[entry.actorId] = entry

          const typingRoomId = typeof raw.typingRoomId === 'string' ? raw.typingRoomId : ''
          const typingMode = raw.typingMode as 'typing' | 'recording' | 'idle'
          const typingUpdatedAtMs =
            typeof raw.typingUpdatedAtMs === 'number' ? raw.typingUpdatedAtMs : 0
          if (typingRoomId && (typingMode === 'typing' || typingMode === 'recording')) {
            if (!fsTyping[typingRoomId]) fsTyping[typingRoomId] = {}
            fsTyping[typingRoomId][entry.actorId] = {
              actorId: entry.actorId,
              actorName: entry.actorName,
              mode: typingMode,
              updatedAtMs: typingUpdatedAtMs,
            }
          }
        })
        mergeIncomingChatStates([{ presenceMap: fsPresence, typingMap: fsTyping }])
      })
      unsubscribes.push(unsubPresence)
    } catch {
      // Ignore listener attach error
    }

    return () => {
      for (const unsub of unsubscribes) {
        try {
          unsub()
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }, [actor.id, actor.className, actor.isStaff, mergeIncomingChatStates])

  // Poll chat state & send presence heartbeat every 4 seconds (HTTP backup + Firestore heartbeat)
  useEffect(() => {
    void pullChatStateFromServer()
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      void sendChatActionToServer({
        action: 'heartbeat',
        roomId: selectedRoomId,
        typingMode: 'idle',
      })
      void syncPresenceToFirestore({
        isOnline: true,
        roomId: selectedRoomId,
        typingMode: 'idle',
      })
    }

    const interval = window.setInterval(() => {
      void pullChatStateFromServer()
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void sendChatActionToServer({
          action: 'heartbeat',
          roomId: selectedRoomId,
          typingMode: isRecordingVoice ? 'recording' : 'idle',
        })
        void syncPresenceToFirestore({
          isOnline: true,
          roomId: selectedRoomId,
          typingMode: isRecordingVoice ? 'recording' : 'idle',
        })
      }
    }, 4000)

    const handleVisibilityOrLeave = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        void sendChatActionToServer({ action: 'leave_presence' })
        void syncPresenceToFirestore({ isOnline: false, roomId: '', typingMode: 'idle' })
      } else {
        void pullChatStateFromServer()
        void sendChatActionToServer({
          action: 'heartbeat',
          roomId: selectedRoomId,
          typingMode: 'idle',
        })
        void syncPresenceToFirestore({
          isOnline: true,
          roomId: selectedRoomId,
          typingMode: 'idle',
        })
      }
    }

    const handlePageHide = () => {
      void sendChatActionToServer({ action: 'leave_presence' })
      void syncPresenceToFirestore({ isOnline: false, roomId: '', typingMode: 'idle' })
    }

    window.addEventListener('visibilitychange', handleVisibilityOrLeave)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handlePageHide)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('visibilitychange', handleVisibilityOrLeave)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handlePageHide)
      void sendChatActionToServer({ action: 'leave_presence' })
      void syncPresenceToFirestore({ isOnline: false, roomId: '', typingMode: 'idle' })
    }
  }, [
    pullChatStateFromServer,
    sendChatActionToServer,
    syncPresenceToFirestore,
    selectedRoomId,
    isRecordingVoice,
  ])

  // Active room descriptor & messages
  const activeRoom = useMemo<ChatRoomDescriptor>(() => {
    const found = allRooms.find((r) => r.roomId === selectedRoomId)
    if (found) return found
    return allRooms[0]
  }, [allRooms, selectedRoomId])

  // Tell CampusNotificationBar whether user is actively viewing this exact open chat room
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (isConversationPaneOpen && activeRoom) {
      document.body.dataset.icsActiveChatVisible = 'true'
      document.body.dataset.icsActiveChatPeer = activeRoom.peerId || ''
      document.body.dataset.icsActiveChatType = activeRoom.type || ''
      document.body.dataset.icsActiveChatBatch = activeRoom.batchName || ''
      clearGroupedPhoneNotifications()
    } else {
      document.body.dataset.icsActiveChatVisible = 'false'
      document.body.dataset.icsActiveChatPeer = ''
      document.body.dataset.icsActiveChatType = ''
      document.body.dataset.icsActiveChatBatch = ''
    }
    return () => {
      document.body.dataset.icsActiveChatVisible = 'false'
      document.body.dataset.icsActiveChatPeer = ''
      document.body.dataset.icsActiveChatType = ''
      document.body.dataset.icsActiveChatBatch = ''
    }
  }, [isConversationPaneOpen, activeRoom])

  const activeMessages = useMemo<ChatMessage[]>(() => {
    const raw = messagesByRoom[activeRoom.roomId] ?? []
    return raw.filter((m) => !isMessageHiddenForMe(m))
  }, [messagesByRoom, activeRoom.roomId, isMessageHiddenForMe])

  const activeRoomMeta = useMemo<ChatRoomMeta>(() => {
    return (
      roomsMeta[activeRoom.roomId] ?? {
        roomId: activeRoom.roomId,
        onlyAdminsCanPost: false,
        pinnedMessageId: null,
        updatedAtMs: Date.now(),
      }
    )
  }, [roomsMeta, activeRoom.roomId])

  const pinnedMessage = useMemo<ChatMessage | null>(() => {
    if (!activeRoomMeta.pinnedMessageId) return null
    return (
      activeMessages.find(
        (m) => m.id === activeRoomMeta.pinnedMessageId && !m.isDeleted,
      ) ?? null
    )
  }, [activeRoomMeta.pinnedMessageId, activeMessages])

  // Mark messages in active room as delivered & read by current actor ONLY when conversation is visibly open
  useEffect(() => {
    const isTabVisible =
      typeof document === 'undefined' || document.visibilityState === 'visible'
    if (!isConversationPaneOpen || !isTabVisible) return

    const rId = activeRoom.roomId
    const list = messagesByRoom[rId] ?? []
    const toUpdate = list.filter(
      (m) =>
        m.senderId !== actor.id &&
        (!(m.deliveredTo ?? []).includes(actor.id) ||
          !m.deliveredAtMap?.[actor.id] ||
          (chatSettings.sendReadReceipts &&
            (!m.readBy.includes(actor.id) || !m.readAtMap?.[actor.id]))),
    )
    if (toUpdate.length === 0) return

    const nowMs = Math.floor(Date.now())

    setMessagesByRoom((prev) => {
      const currentList = prev[rId] ?? []
      return {
        ...prev,
        [rId]: currentList.map((m) => {
          if (m.senderId === actor.id) return m
          const nextDelivered = Array.from(new Set([...(m.deliveredTo ?? [m.senderId]), actor.id]))
          const nextDeliveredAtMap = {
            ...(m.deliveredAtMap ?? {}),
            ...(m.deliveredAtMap?.[actor.id] ? {} : { [actor.id]: nowMs }),
          }
          const nextRead = chatSettings.sendReadReceipts
            ? Array.from(new Set([...m.readBy, actor.id]))
            : m.readBy
          const nextReadAtMap =
            chatSettings.sendReadReceipts && !m.readAtMap?.[actor.id]
              ? { ...(m.readAtMap ?? {}), [actor.id]: nowMs }
              : (m.readAtMap ?? {})
          return {
            ...m,
            deliveredTo: nextDelivered,
            deliveredAtMap: nextDeliveredAtMap,
            readBy: nextRead,
            readAtMap: nextReadAtMap,
          }
        }),
      }
    })

    for (const m of toUpdate) {
      if (!firestoreMessageIdsRef.current.has(m.id)) continue
      const receiptKey = `${chatSettings.sendReadReceipts ? 'rt' : 'dt'}:${m.id}:${actor.id}`
      if (sentReceiptKeysRef.current.has(receiptKey)) continue
      sentReceiptKeysRef.current.add(receiptKey)
      const updatePayload: Record<string, unknown> = {
        deliveredTo: arrayUnion(actor.id),
      }
      if (!m.deliveredAtMap?.[actor.id]) {
        updatePayload[`deliveredAtMap.${actor.id}`] = nowMs
      }
      if (chatSettings.sendReadReceipts) {
        updatePayload.readBy = arrayUnion(actor.id)
        if (!m.readAtMap?.[actor.id]) {
          updatePayload[`readAtMap.${actor.id}`] = nowMs
        }
      }
      void updateDoc(doc(db, 'campusChatMessages', m.id), updatePayload).catch(() => {
        sentReceiptKeysRef.current.delete(receiptKey)
      })
    }

    void sendChatActionToServer({
      action: 'mark_read',
      roomId: rId,
      sendReadReceipts: chatSettings.sendReadReceipts,
    })
  }, [
    activeRoom.roomId,
    actor.id,
    messagesByRoom,
    isConversationPaneOpen,
    sendChatActionToServer,
    chatSettings.sendReadReceipts,
  ])

  // Scroll to bottom when messages change in active room
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [activeRoom.roomId, activeMessages.length])

  // Filtered & sorted room list for left sidebar / mobile roster
  const filteredRooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return allRooms
      .filter((r) => {
        if (categoryFilter === 'groups' && r.type !== 'batch_group') return false
        if (categoryFilter === 'staff' && r.type !== 'staff_group') return false
        if (categoryFilter === 'usthads' && r.type !== 'direct_usthad') return false
        if (categoryFilter === 'students' && r.type !== 'direct_student') return false
        if (!q) return true
        return (
          r.title.toLowerCase().includes(q) ||
          r.subtitle.toLowerCase().includes(q) ||
          r.badgeLabel.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        // Keep Staff Room and User's own Batch Group at the top, then sort by latest message timestamp
        const aIsPrimary =
          a.roomId === STAFF_ROOM_ID || a.roomId === makeBatchRoomId(actor.className)
        const bIsPrimary =
          b.roomId === STAFF_ROOM_ID || b.roomId === makeBatchRoomId(actor.className)
        if (aIsPrimary && !bIsPrimary) return -1
        if (!aIsPrimary && bIsPrimary) return 1

        const aMsgs = messagesByRoom[a.roomId] ?? []
        const bMsgs = messagesByRoom[b.roomId] ?? []
        const aLast = aMsgs[aMsgs.length - 1]?.createdAtMs ?? 0
        const bLast = bMsgs[bMsgs.length - 1]?.createdAtMs ?? 0
        return bLast - aLast
      })
  }, [allRooms, categoryFilter, searchQuery, actor.className, messagesByRoom])

  // Strictly check if a specific peer is actively using the app right now (within last 15 seconds)
  const isPeerOnline = useCallback(
    (peerId?: string): boolean => {
      if (!peerId) return false
      if (!chatSettings.showOnlineStatus) return false
      const entry = presenceMap[peerId]
      if (!entry) return false
      if (entry.hideOnline || entry.isOnline === false) return false
      return Date.now() - entry.lastSeenMs < 15000
    },
    [presenceMap, chatSettings.showOnlineStatus],
  )

  // Format WhatsApp-style header status for the currently open chat room
  const getOpenChatHeaderStatus = useCallback(
    (room: ChatRoomDescriptor): { isOnlineNow: boolean; text: string } => {
      if (room.type === 'batch_group' || room.type === 'staff_group') {
        return { isOnlineNow: false, text: room.subtitle }
      }
      if (!room.peerId || !chatSettings.showOnlineStatus) {
        return { isOnlineNow: false, text: room.subtitle }
      }
      if (isPeerOnline(room.peerId)) {
        return { isOnlineNow: true, text: 'online' }
      }
      const entry = presenceMap[room.peerId]
      if (entry && !entry.hideOnline && entry.lastSeenMs > 0) {
        return {
          isOnlineNow: false,
          text: formatLastSeenStatus(entry.lastSeenMs),
        }
      }
      return { isOnlineNow: false, text: room.subtitle }
    },
    [chatSettings.showOnlineStatus, isPeerOnline, presenceMap],
  )

  // Active typing / recording users in a room (excluding current user)
  const getRoomTypingText = useCallback(
    (roomId: string): string | null => {
      const roomTyping = typingMap[roomId]
      if (!roomTyping) return null
      const activeEntries = Object.values(roomTyping).filter(
        (t) => t.actorId !== actor.id && Date.now() - t.updatedAtMs < 8000 && t.mode !== 'idle',
      )
      if (activeEntries.length === 0) return null
      const first = activeEntries[0]
      if (first.mode === 'recording') {
        return `${first.actorName} is recording a voice note...`
      }
      return `${first.actorName} is typing...`
    },
    [typingMap, actor.id],
  )

  // Broadcast typing state when typing
  const handleInputChange = (value: string) => {
    setInputText(value)
    const now = Date.now()
    if (value.trim() && now - lastTypingSentMsRef.current > 2000) {
      lastTypingSentMsRef.current = now
      void sendChatActionToServer({
        action: 'heartbeat',
        roomId: activeRoom.roomId,
        typingMode: 'typing',
      })
      void syncPresenceToFirestore({
        isOnline: true,
        roomId: activeRoom.roomId,
        typingMode: 'typing',
      })
    }
  }

  // Core send message handler
  const dispatchMessage = useCallback(
    (params: {
      text: string
      mediaType?: 'none' | 'voice' | 'image' | 'pdf'
      mediaUrl?: string
      mediaName?: string
      mediaSizeLabel?: string
      mediaDurationSec?: number
      imageQuality?: 'standard' | 'hd'
      imageDimensions?: string
    }) => {
      if (activeRoomMeta.onlyAdminsCanPost && !actor.isStaff) return
      unlockNotificationAudio()

      const now = Date.now()
      const msgId = `msg_${now}_${Math.random().toString(36).slice(2, 7)}`
      const newMsg: ChatMessage = {
        id: msgId,
        roomId: activeRoom.roomId,
        senderId: actor.id,
        senderName: actor.name,
        senderRole: actor.role,
        senderBadge: actor.badge,
        text: params.text.trim(),
        mediaType: params.mediaType ?? 'none',
        mediaUrl: params.mediaUrl,
        mediaName: params.mediaName,
        mediaSizeLabel: params.mediaSizeLabel,
        mediaDurationSec: params.mediaDurationSec,
        imageQuality: params.imageQuality,
        imageDimensions: params.imageDimensions,
        replyTo: replyingTo ?? undefined,
        reactions: {},
        deliveredTo: [actor.id],
        deliveredAtMap: {},
        readBy: [actor.id],
        readAtMap: {},
        starredBy: [],
        isForwarded: false,
        isDeleted: false,
        createdAt: new Date(now).toISOString(),
        createdAtMs: now,
      }

      setMessagesByRoom((prev) => ({
        ...prev,
        [activeRoom.roomId]: [...(prev[activeRoom.roomId] ?? []), newMsg],
      }))

      if (chatSettings.soundEffects) {
        playSubtleSendSound()
      }

      setInputText('')
      setReplyingTo(null)
      setPendingAttachment(null)
      setShowPhotoQualitySheet(false)
      setPhotoQualityToast(null)
      setShowAttachMenu(false)

      // Persist directly to Firestore for instant cross-domain delivery & WhatsApp ticks (<200ms)
      void (async () => {
        try {
          const safeMediaUrl = await prepareMediaUrlForFirestore(
            newMsg.mediaType,
            newMsg.mediaUrl,
          )
          const fsPayload = buildFirestoreChatMessagePayload(newMsg, safeMediaUrl)
          await setDoc(doc(db, 'campusChatMessages', newMsg.id), fsPayload)
          firestoreMessageIdsRef.current.add(newMsg.id)
        } catch {
          // Fallback to HTTP sync already dispatched below
        }
      })()

      void syncPresenceToFirestore({
        isOnline: true,
        roomId: activeRoom.roomId,
        typingMode: 'idle',
      })

      void sendChatActionToServer({
        action: 'send_message',
        roomId: activeRoom.roomId,
        message: newMsg,
      })

      // Build notification preview text for the message
      const preview =
        newMsg.mediaType === 'pdf'
          ? `📄 Shared PDF Note: ${newMsg.mediaName || 'Document'}`
          : newMsg.mediaType === 'voice'
            ? `🎤 Sent a Voice Note (${formatVoiceDuration(newMsg.mediaDurationSec || 4)})`
            : newMsg.mediaType === 'image'
              ? `📷 Shared ${newMsg.imageQuality === 'hd' ? 'HD ' : ''}Photo${newMsg.text ? `: ${newMsg.text.slice(0, 80)}` : ''}`
              : newMsg.text.slice(0, 120)

      const deterministicNotifId = `notif_chat_${msgId}`

      // 1. Direct 1-on-1 Chat (Student <-> Usthad, Student <-> Student, Usthad <-> Usthad)
      // Strictly notify ONLY the target recipient (peerId)
      if (
        (activeRoom.type === 'direct_usthad' || activeRoom.type === 'direct_student') &&
        activeRoom.peerId
      ) {
        publishCampusNotification({
          id: deterministicNotifId,
          type: 'chat',
          title: `New Message from ${actor.name}`,
          message: preview,
          targetRecipientId: activeRoom.peerId,
          actorId: actor.id,
          actorName: actor.name,
          href: '#campus-chat',
        })
      }
      // 2. Class Batch Group Chat (Notify ONLY members & Class Usthad of that batch, excluding sender)
      else if (activeRoom.type === 'batch_group' && activeRoom.batchName) {
        publishCampusNotification({
          id: deterministicNotifId,
          type: 'chat',
          title: `${actor.name} • ${activeRoom.batchName} Group`,
          message: preview,
          targetClass: activeRoom.batchName,
          actorId: actor.id,
          actorName: actor.name,
          href: '#campus-chat',
        })
      }
      // 3. Staff Room Group Chat (Notify ONLY Usthads & Principal, excluding sender)
      else if (activeRoom.type === 'staff_group') {
        publishCampusNotification({
          id: deterministicNotifId,
          type: 'chat',
          title: `${actor.name} • Staff Room`,
          message: preview,
          targetStaffOnly: true,
          actorId: actor.id,
          actorName: actor.name,
          href: '#campus-chat',
        })
      }
    },
    [
      activeRoom,
      activeRoomMeta.onlyAdminsCanPost,
      actor,
      replyingTo,
      sendChatActionToServer,
      syncPresenceToFirestore,
      chatSettings.soundEffects,
    ],
  )

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pendingAttachment) {
      dispatchMessage({
        text: inputText,
        mediaType: pendingAttachment.mediaType,
        mediaUrl: pendingAttachment.mediaUrl,
        mediaName: pendingAttachment.mediaName,
        mediaSizeLabel: pendingAttachment.mediaSizeLabel,
        imageQuality: pendingAttachment.imageQuality,
        imageDimensions: pendingAttachment.imageDimensions,
      })
      return
    }
    if (!inputText.trim()) return
    dispatchMessage({ text: inputText, mediaType: 'none' })
  }

  // Voice Note Recording Handlers
  const startVoiceRecording = async () => {
    if (activeRoomMeta.onlyAdminsCanPost && !actor.isStaff) return
    setShowAttachMenu(false)
    setSelectedMessageIds([])
    setShowSelectionMoreMenu(false)
    setShowSettingsModal(false)
    setShowNewChatModal(false)
    setIsRecordingVoice(true)
    setRecordingSeconds(0)
    recordedChunksRef.current = []

    void sendChatActionToServer({
      action: 'heartbeat',
      roomId: activeRoom.roomId,
      typingMode: 'recording',
    })
    void syncPresenceToFirestore({
      isOnline: true,
      roomId: activeRoom.roomId,
      typingMode: 'recording',
    })

    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current)
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1)
    }, 1000)

    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const recorder = new MediaRecorder(stream)
        mediaRecorderRef.current = recorder
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data)
          }
        }
        recorder.start(250)
      }
    } catch {
      // Fallback to synthesized WAV when finishing if mic is unavailable in preview iframe
    }
  }

  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop())
        mediaRecorderRef.current.stop()
      } catch {
        // Ignore
      }
      mediaRecorderRef.current = null
    }
    recordedChunksRef.current = []
    setIsRecordingVoice(false)
    setRecordingSeconds(0)
    void sendChatActionToServer({
      action: 'heartbeat',
      roomId: activeRoom.roomId,
      typingMode: 'idle',
    })
    void syncPresenceToFirestore({
      isOnline: true,
      roomId: activeRoom.roomId,
      typingMode: 'idle',
    })
  }

  const finishAndSendVoiceRecording = () => {
    const duration = Math.max(1, recordingSeconds)
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        try {
          recorder.stream.getTracks().forEach((t) => t.stop())
        } catch {
          // Ignore
        }
        if (recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          })
          const reader = new FileReader()
          reader.onloadend = () => {
            const dataUrl =
              typeof reader.result === 'string'
                ? reader.result
                : createSynthesizedVoiceWavDataUrl(duration)
            dispatchMessage({
              text: '',
              mediaType: 'voice',
              mediaUrl: dataUrl,
              mediaName: `Voice_Note_${Date.now()}.wav`,
              mediaDurationSec: duration,
            })
          }
          reader.readAsDataURL(blob)
        } else {
          dispatchMessage({
            text: '',
            mediaType: 'voice',
            mediaUrl: createSynthesizedVoiceWavDataUrl(duration),
            mediaName: `Voice_Note_${Date.now()}.wav`,
            mediaDurationSec: duration,
          })
        }
      }
      try {
        recorder.stop()
      } catch {
        dispatchMessage({
          text: '',
          mediaType: 'voice',
          mediaUrl: createSynthesizedVoiceWavDataUrl(duration),
          mediaName: `Voice_Note_${Date.now()}.wav`,
          mediaDurationSec: duration,
        })
      }
    } else {
      dispatchMessage({
        text: '',
        mediaType: 'voice',
        mediaUrl: createSynthesizedVoiceWavDataUrl(duration),
        mediaName: `Voice_Note_${Date.now()}.wav`,
        mediaDurationSec: duration,
      })
    }

    mediaRecorderRef.current = null
    setIsRecordingVoice(false)
    setRecordingSeconds(0)
  }

  // Audio Playback Handler
  const handleTogglePlayVoice = (msg: ChatMessage) => {
    if (playingMessageId === msg.id && audioElementRef.current) {
      audioElementRef.current.pause()
      setPlayingMessageId(null)
      return
    }

    if (audioElementRef.current) {
      audioElementRef.current.pause()
      audioElementRef.current = null
    }

    const audioSrc =
      msg.mediaUrl || createSynthesizedVoiceWavDataUrl(msg.mediaDurationSec || 4)
    const audio = new Audio(audioSrc)
    audio.playbackRate = playbackRate
    audioElementRef.current = audio
    setPlayingMessageId(msg.id)
    setPlaybackProgress(0)

    audio.ontimeupdate = () => {
      const total = audio.duration || msg.mediaDurationSec || 4
      setPlaybackProgress(Math.min(100, Math.round((audio.currentTime / total) * 100)))
    }
    audio.onended = () => {
      setPlayingMessageId(null)
      setPlaybackProgress(0)
    }
    audio.onerror = () => {
      setPlayingMessageId(null)
      setPlaybackProgress(0)
    }
    void audio.play().catch(() => {
      setPlayingMessageId(null)
    })
  }

  const handleCyclePlaybackRate = () => {
    const nextRate: 1 | 1.5 | 2 = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1
    setPlaybackRate(nextRate)
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = nextRate
    }
  }

  // Helper to format byte sizes cleanly
  const formatByteSize = (bytes: number): string => {
    const kb = Math.max(1, Math.round(bytes / 1024))
    return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
  }

  // Switch between Standard and HD quality for a pending photo attachment
  const handleSelectPhotoQuality = (quality: 'standard' | 'hd') => {
    setPendingAttachment((prev) => {
      if (!prev || prev.mediaType !== 'image') return prev
      const chosen = quality === 'hd' ? prev.hdVariant : prev.standardVariant
      if (!chosen) return { ...prev, imageQuality: quality }
      return {
        ...prev,
        imageQuality: quality,
        mediaUrl: chosen.url,
        imageDimensions: chosen.dimensions,
        mediaSizeLabel: `${chosen.sizeLabel} • ${quality === 'hd' ? 'HD' : 'Standard'}`,
      }
    })
    setShowPhotoQualitySheet(false)
    setPhotoQualityToast(
      quality === 'hd' ? 'Photo set to HD quality' : 'Photo set to standard quality',
    )
    window.setTimeout(() => {
      setPhotoQualityToast(null)
    }, 2600)
  }

  // File Attachment Handlers (PDF & Photo with WhatsApp Standard vs HD Quality Processing)
  const handleFileSelected = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'image' | 'pdf',
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    const sizeKb = Math.max(1, Math.round(file.size / 1024))
    const rawSizeLabel =
      sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`

    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') return
      const rawDataUrl = reader.result

      if (type === 'pdf') {
        setPendingAttachment({
          mediaType: 'pdf',
          mediaUrl: rawDataUrl,
          mediaName: file.name,
          mediaSizeLabel: `${rawSizeLabel} • PDF`,
        })
        setShowAttachMenu(false)
        return
      }

      // Process Image into Standard Quality & HD Quality variants (WhatsApp style)
      const img = new window.Image()
      img.onload = () => {
        const origW = Math.max(1, img.naturalWidth || img.width || 1280)
        const origH = Math.max(1, img.naturalHeight || img.height || 960)

        const renderVariant = (maxDim: number, jpegQuality: number, scaleIfSmaller = 1) => {
          const maxSide = Math.max(origW, origH)
          const scale =
            maxSide > maxDim ? maxDim / maxSide : scaleIfSmaller
          const targetW = Math.max(1, Math.round(origW * scale))
          const targetH = Math.max(1, Math.round(origH * scale))
          try {
            const canvas = document.createElement('canvas')
            canvas.width = targetW
            canvas.height = targetH
            const ctx = canvas.getContext('2d')
            if (!ctx) {
              return {
                url: rawDataUrl,
                dimensions: `${origW} × ${origH}`,
                sizeLabel: rawSizeLabel,
              }
            }
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
            ctx.drawImage(img, 0, 0, targetW, targetH)
            const outUrl = canvas.toDataURL('image/jpeg', jpegQuality)
            const approxBytes = Math.round((outUrl.length * 3) / 4)
            return {
              url: outUrl,
              dimensions: `${targetW} × ${targetH}`,
              sizeLabel: formatByteSize(approxBytes),
            }
          } catch {
            return {
              url: rawDataUrl,
              dimensions: `${origW} × ${origH}`,
              sizeLabel: rawSizeLabel,
            }
          }
        }

        const standardVariant = renderVariant(
          1280,
          0.72,
          Math.max(origW, origH) <= 1280 ? 0.78 : 1,
        )
        const hdVariant = renderVariant(2560, 0.94, 1)

        const initialQuality = chatSettings.defaultImageQuality || 'standard'
        const activeVariant = initialQuality === 'hd' ? hdVariant : standardVariant

        setPendingAttachment({
          mediaType: 'image',
          mediaUrl: activeVariant.url,
          mediaName: file.name,
          mediaSizeLabel: `${activeVariant.sizeLabel} • ${initialQuality === 'hd' ? 'HD' : 'Standard'}`,
          imageQuality: initialQuality,
          imageDimensions: activeVariant.dimensions,
          standardVariant,
          hdVariant,
        })
        setShowPhotoQualitySheet(false)
        setShowAttachMenu(false)
      }
      img.onerror = () => {
        const initialQuality = chatSettings.defaultImageQuality || 'standard'
        setPendingAttachment({
          mediaType: 'image',
          mediaUrl: rawDataUrl,
          mediaName: file.name,
          mediaSizeLabel: `${rawSizeLabel} • ${initialQuality === 'hd' ? 'HD' : 'Standard'}`,
          imageQuality: initialQuality,
          imageDimensions: '1280 × 960',
        })
        setShowAttachMenu(false)
      }
      img.src = rawDataUrl
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleQuickShareSampleKitabPdf = () => {
    const kitab = CURATED_KITABS[0]
    const pdfBlob = buildKitabPdfBlob(kitab)
    const url = URL.createObjectURL(pdfBlob)
    dispatchMessage({
      text: `📚 ${kitab.title} (${kitab.arabicTitle}) — Syllabus Study Note (PDF).`,
      mediaType: 'pdf',
      mediaUrl: url,
      mediaName: `${kitab.title.replace(/\s+/g, '_')}_Notes.pdf`,
      mediaSizeLabel: '1.2 MB • Kitab PDF',
    })
  }

  const handleOpenOrDownloadPdf = (msg: ChatMessage) => {
    if (msg.mediaUrl) {
      const a = document.createElement('a')
      a.href = msg.mediaUrl
      a.download = msg.mediaName || 'ICS_Academy_Note.pdf'
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      return
    }
    const sampleBlob = buildKitabPdfBlob(CURATED_KITABS[0])
    const blobUrl = URL.createObjectURL(sampleBlob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = msg.mediaName || 'ICS_Academy_Note.pdf'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Reactions, Pinning, Deleting & Group Lock Handlers
  const handleToggleReaction = (messageId: string, emoji: string) => {
    const rId = activeRoom.roomId
    const targetMsg = (messagesByRoom[rId] ?? []).find((m) => m.id === messageId)
    let updatedReactionsForFs: Record<string, string[]> | null = null
    if (targetMsg) {
      const cur = targetMsg.reactions[emoji] ?? []
      const nextReactors = cur.includes(actor.id)
        ? cur.filter((id) => id !== actor.id)
        : [...cur, actor.id]
      const nextReactions = { ...targetMsg.reactions }
      if (nextReactors.length === 0) {
        delete nextReactions[emoji]
      } else {
        nextReactions[emoji] = nextReactors
      }
      updatedReactionsForFs = nextReactions
    }

    setMessagesByRoom((prev) => {
      const list = prev[rId] ?? []
      return {
        ...prev,
        [rId]: list.map((m) => {
          if (m.id !== messageId) return m
          const cur = m.reactions[emoji] ?? []
          const nextReactors = cur.includes(actor.id)
            ? cur.filter((id) => id !== actor.id)
            : [...cur, actor.id]
          const nextReactions = { ...m.reactions }
          if (nextReactors.length === 0) {
            delete nextReactions[emoji]
          } else {
            nextReactions[emoji] = nextReactors
          }
          return { ...m, reactions: nextReactions }
        }),
      }
    })
    setSelectedMessageIds([])
    setShowSelectionMoreMenu(false)
    if (updatedReactionsForFs && firestoreMessageIdsRef.current.has(messageId)) {
      void updateDoc(doc(db, 'campusChatMessages', messageId), {
        reactions: updatedReactionsForFs,
      }).catch(() => {})
    }
    void sendChatActionToServer({
      action: 'toggle_reaction',
      roomId: rId,
      messageId,
      emoji,
    })
  }

  const canPinActiveRoom =
    actor.isStaff ||
    activeRoom.type === 'direct_student' ||
    activeRoom.type === 'direct_usthad'

  const handleTogglePinMessage = (messageId: string | null) => {
    if (!canPinActiveRoom) return
    const rId = activeRoom.roomId
    const nextPin = activeRoomMeta.pinnedMessageId === messageId ? null : messageId
    setRoomsMeta((prev) => ({
      ...prev,
      [rId]: {
        ...(prev[rId] ?? { roomId: rId, onlyAdminsCanPost: false, pinnedMessageId: null }),
        pinnedMessageId: nextPin,
        updatedAtMs: Date.now(),
      },
    }))
    setSelectedMessageIds([])
    setShowSelectionMoreMenu(false)
    showToast(nextPin ? 'Message pinned' : 'Message unpinned')
    void syncRoomMetaToFirestore(rId, activeRoomMeta.onlyAdminsCanPost, nextPin)
    void sendChatActionToServer({
      action: 'toggle_pin',
      roomId: rId,
      pinnedMessageId: nextPin,
    })
  }

  const handleToggleStarMessages = (targetMsgs: ChatMessage[], roomIdOverride?: string) => {
    const valid = targetMsgs.filter((m) => !m.isDeleted)
    if (valid.length === 0) return
    const allAlreadyStarred = valid.every((m) => isMessageStarredByMe(m))
    const shouldStar = !allAlreadyStarred
    const targetIds = valid.map((m) => m.id)

    setLocalStarredIds((prev) => {
      if (shouldStar) {
        return Array.from(new Set([...prev, ...targetIds]))
      }
      return prev.filter((id) => !targetIds.includes(id))
    })

    setMessagesByRoom((prev) => {
      const next = { ...prev }
      const roomsToTouch = new Set(valid.map((m) => roomIdOverride || m.roomId))
      for (const rId of roomsToTouch) {
        const list = next[rId] ?? []
        next[rId] = list.map((m) => {
          if (!targetIds.includes(m.id)) return m
          const cur = Array.isArray(m.starredBy) ? m.starredBy : []
          const updated = shouldStar
            ? Array.from(new Set([...cur, actor.id])).slice(0, 300)
            : cur.filter((id) => id !== actor.id)
          return { ...m, starredBy: updated }
        })
      }
      return next
    })

    for (const m of valid) {
      if (firestoreMessageIdsRef.current.has(m.id)) {
        void updateDoc(doc(db, 'campusChatMessages', m.id), {
          starredBy: shouldStar ? arrayUnion(actor.id) : arrayRemove(actor.id),
        }).catch(() => {})
      }
    }

    const byRoom = new Map<string, string[]>()
    for (const m of valid) {
      const rId = roomIdOverride || m.roomId
      byRoom.set(rId, [...(byRoom.get(rId) ?? []), m.id])
    }
    for (const [rId, ids] of byRoom.entries()) {
      void sendChatActionToServer({
        action: 'toggle_star',
        roomId: rId,
        messageIds: ids,
        starred: shouldStar,
      })
    }

    setSelectedMessageIds([])
    setShowSelectionMoreMenu(false)
    showToast(
      shouldStar
        ? valid.length === 1
          ? 'Message starred'
          : `${valid.length} messages starred`
        : valid.length === 1
          ? 'Removed from starred'
          : `Removed ${valid.length} messages from starred`,
    )
  }

  const formatMessageForCopyOrShare = (msgs: ChatMessage[]): string => {
    const valid = msgs.filter((m) => !m.isDeleted)
    if (valid.length === 0) return ''
    if (valid.length === 1) {
      const m = valid[0]
      if (m.text) return m.text
      if (m.mediaType === 'pdf') return `📄 ${m.mediaName || 'PDF Document'}`
      if (m.mediaType === 'voice')
        return `🎤 Voice Note (${formatVoiceDuration(m.mediaDurationSec || 4)})`
      if (m.mediaType === 'image') return `📷 ${m.mediaName || 'Photo'}`
      return ''
    }
    return valid
      .map((m) => {
        const body =
          m.text ||
          (m.mediaType === 'pdf'
            ? `📄 ${m.mediaName || 'PDF Document'}`
            : m.mediaType === 'voice'
              ? `🎤 Voice Note (${formatVoiceDuration(m.mediaDurationSec || 4)})`
              : `📷 ${m.mediaName || 'Photo'}`)
        return `[${formatChatTime(m.createdAtMs)}] ${m.senderName}: ${body}`
      })
      .join('\n')
  }

  const handleCopyMessages = async (targetMsgs: ChatMessage[]) => {
    const formatted = formatMessageForCopyOrShare(targetMsgs)
    if (!formatted) return
    try {
      await navigator.clipboard.writeText(formatted)
      showToast(
        targetMsgs.length === 1 ? 'Message copied' : `${targetMsgs.length} messages copied`,
      )
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = formatted
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        showToast(
          targetMsgs.length === 1 ? 'Message copied' : `${targetMsgs.length} messages copied`,
        )
      } catch {
        showToast('Unable to copy text')
      }
    }
    setSelectedMessageIds([])
    setShowSelectionMoreMenu(false)
  }

  const handleShareMessages = async (targetMsgs: ChatMessage[]) => {
    const formatted = formatMessageForCopyOrShare(targetMsgs)
    if (!formatted) return
    setSelectedMessageIds([])
    setShowSelectionMoreMenu(false)
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'ICS Academy Messenger',
          text: formatted,
        })
        showToast('Shared successfully')
        return
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(formatted)
      showToast('Copied to share')
    } catch {
      showToast('Unable to share')
    }
  }

  const handleDeleteForEveryone = (messageIds: string[]) => {
    if (messageIds.length === 0) return
    const rId = activeRoom.roomId
    setDeletedForEveryoneMap((prev) => {
      const next = { ...prev }
      for (const id of messageIds) {
        next[id] = { deletedBy: actor.name, deletedById: actor.id }
      }
      return next
    })
    setMessagesByRoom((prev) => {
      const list = prev[rId] ?? []
      return {
        ...prev,
        [rId]: list.map((m) =>
          messageIds.includes(m.id)
            ? {
                ...m,
                isDeleted: true,
                deletedBy: actor.name,
                deletedById: actor.id,
                text: '',
                mediaType: 'none',
                mediaUrl: undefined,
                starredBy: [],
              }
            : m,
        ),
      }
    })
    if (activeRoomMeta.pinnedMessageId && messageIds.includes(activeRoomMeta.pinnedMessageId)) {
      handleTogglePinMessage(null)
    }
    setDeleteModalMessages([])
    setSelectedMessageIds([])
    setShowSelectionMoreMenu(false)
    setLightboxImage(null)
    if (infoMessageId && messageIds.includes(infoMessageId)) {
      setInfoMessageId(null)
    }
    for (const messageId of messageIds) {
      if (firestoreMessageIdsRef.current.has(messageId)) {
        void updateDoc(doc(db, 'campusChatMessages', messageId), {
          isDeleted: true,
          deletedBy: actor.name.slice(0, 120),
          deletedById: actor.id,
          text: '',
          mediaType: 'none',
          mediaUrl: '',
        }).catch(() => {})
      }
      void sendChatActionToServer({
        action: 'delete_message',
        deleteMode: 'everyone',
        roomId: rId,
        messageId,
      })
    }
    showToast(
      messageIds.length === 1
        ? 'Deleted for everyone'
        : `Deleted ${messageIds.length} messages for everyone`,
    )
  }

  const handleDeleteForMe = (messageIds: string[]) => {
    if (messageIds.length === 0) return
    const rId = activeRoom.roomId
    setDeletedForMeIds((prev) => Array.from(new Set([...prev, ...messageIds])))
    setLocalStarredIds((prev) => prev.filter((id) => !messageIds.includes(id)))
    setMessagesByRoom((prev) => {
      const list = prev[rId] ?? []
      return {
        ...prev,
        [rId]: list.map((m) =>
          messageIds.includes(m.id)
            ? {
                ...m,
                deletedFor: Array.from(new Set([...(m.deletedFor ?? []), actor.id])),
              }
            : m,
        ),
      }
    })
    setDeleteModalMessages([])
    setSelectedMessageIds([])
    setShowSelectionMoreMenu(false)
    setLightboxImage(null)
    if (infoMessageId && messageIds.includes(infoMessageId)) {
      setInfoMessageId(null)
    }
    for (const messageId of messageIds) {
      if (firestoreMessageIdsRef.current.has(messageId)) {
        void updateDoc(doc(db, 'campusChatMessages', messageId), {
          deletedFor: arrayUnion(actor.id),
        }).catch(() => {})
      }
      void sendChatActionToServer({
        action: 'delete_message',
        deleteMode: 'me',
        roomId: rId,
        messageId,
      })
    }
    showToast(
      messageIds.length === 1 ? 'Deleted for you' : `Deleted ${messageIds.length} messages for you`,
    )
  }

  const handleConfirmForwardMessages = () => {
    const sourceMsgs = activeMessages.filter(
      (m) => forwardMessageIds.includes(m.id) && !m.isDeleted,
    )
    if (sourceMsgs.length === 0 || forwardTargetRoomIds.length === 0) return

    const baseNow = Date.now()
    let seq = 0

    for (const targetRoomId of forwardTargetRoomIds) {
      const targetMeta = roomsMeta[targetRoomId]
      if (targetMeta?.onlyAdminsCanPost && !actor.isStaff) continue

      const isDirect = targetRoomId.startsWith('direct__')
      const directPeerId = isDirect
        ? targetRoomId.split('__').find((p, idx) => idx > 0 && p !== actor.id)
        : undefined
      const isBatch = targetRoomId.startsWith('batch_group__')
      const batchName = isBatch ? targetRoomId.replace(/^batch_group__/, '').trim() : undefined
      const isStaffRoom = targetRoomId === STAFF_ROOM_ID

      for (const src of sourceMsgs) {
        seq += 1
        const now = baseNow + seq
        const msgId = `msg_${now}_${Math.random().toString(36).slice(2, 7)}`
        const forwardedMsg: ChatMessage = {
          id: msgId,
          roomId: targetRoomId,
          senderId: actor.id,
          senderName: actor.name,
          senderRole: actor.role,
          senderBadge: actor.badge,
          text: src.text,
          mediaType: src.mediaType,
          mediaUrl: src.mediaUrl,
          mediaName: src.mediaName,
          mediaSizeLabel: src.mediaSizeLabel,
          mediaDurationSec: src.mediaDurationSec,
          imageQuality: src.imageQuality,
          imageDimensions: src.imageDimensions,
          reactions: {},
          deliveredTo: [actor.id],
          deliveredAtMap: {},
          readBy: [actor.id],
          readAtMap: {},
          starredBy: [],
          isForwarded: true,
          isDeleted: false,
          createdAt: new Date(now).toISOString(),
          createdAtMs: now,
        }

        setMessagesByRoom((prev) => ({
          ...prev,
          [targetRoomId]: [...(prev[targetRoomId] ?? []), forwardedMsg],
        }))

        void (async () => {
          try {
            const safeMediaUrl = await prepareMediaUrlForFirestore(
              forwardedMsg.mediaType,
              forwardedMsg.mediaUrl,
            )
            const fsPayload = buildFirestoreChatMessagePayload(forwardedMsg, safeMediaUrl)
            await setDoc(doc(db, 'campusChatMessages', forwardedMsg.id), fsPayload)
            firestoreMessageIdsRef.current.add(forwardedMsg.id)
          } catch {
            // Fallback already handled via HTTP sync
          }
        })()

        void sendChatActionToServer({
          action: 'send_message',
          roomId: targetRoomId,
          message: forwardedMsg,
        })

        const preview =
          forwardedMsg.mediaType === 'pdf'
            ? `📄 Forwarded PDF: ${forwardedMsg.mediaName || 'Document'}`
            : forwardedMsg.mediaType === 'voice'
              ? `🎤 Forwarded Voice Note`
              : forwardedMsg.mediaType === 'image'
                ? `📷 Forwarded Photo${forwardedMsg.text ? `: ${forwardedMsg.text.slice(0, 80)}` : ''}`
                : forwardedMsg.text.slice(0, 120)

        const deterministicNotifId = `notif_chat_${msgId}`
        if (isDirect && directPeerId) {
          publishCampusNotification({
            id: deterministicNotifId,
            type: 'chat',
            title: `New Message from ${actor.name}`,
            message: preview,
            targetRecipientId: directPeerId,
            actorId: actor.id,
            actorName: actor.name,
            href: '#campus-chat',
          })
        } else if (isBatch && batchName) {
          publishCampusNotification({
            id: deterministicNotifId,
            type: 'chat',
            title: `${actor.name} • ${batchName} Group`,
            message: preview,
            targetClass: batchName,
            actorId: actor.id,
            actorName: actor.name,
            href: '#campus-chat',
          })
        } else if (isStaffRoom) {
          publishCampusNotification({
            id: deterministicNotifId,
            type: 'chat',
            title: `${actor.name} • Staff Room`,
            message: preview,
            targetStaffOnly: true,
            actorId: actor.id,
            actorName: actor.name,
            href: '#campus-chat',
          })
        }
      }
    }

    const destCount = forwardTargetRoomIds.length
    const msgCount = sourceMsgs.length
    if (destCount === 1) {
      setSelectedRoomId(forwardTargetRoomIds[0])
      setMobileShowChatPane(true)
    }
    setForwardMessageIds([])
    setForwardTargetRoomIds([])
    setForwardSearchQuery('')
    setSelectedMessageIds([])
    setShowSelectionMoreMenu(false)
    showToast(
      `Forwarded ${msgCount === 1 ? 'message' : `${msgCount} messages`} to ${destCount === 1 ? '1 chat' : `${destCount} chats`}`,
    )
  }

  const toggleSelectMessage = (msgId: string) => {
    setShowSelectionMoreMenu(false)
    setSelectedMessageIds((prev) =>
      prev.includes(msgId) ? prev.filter((id) => id !== msgId) : [...prev, msgId],
    )
  }

  const selectedMessages = useMemo(
    () => activeMessages.filter((m) => selectedMessageIds.includes(m.id)),
    [activeMessages, selectedMessageIds],
  )
  const nonDeletedSelectedMessages = useMemo(
    () => selectedMessages.filter((m) => !m.isDeleted),
    [selectedMessages],
  )
  const singleSelectedMessage = selectedMessages.length === 1 ? selectedMessages[0] : null
  const isAllSelectedStarred =
    nonDeletedSelectedMessages.length > 0 &&
    nonDeletedSelectedMessages.every((m) => isMessageStarredByMe(m))
  const canShowInfoAction = Boolean(
    singleSelectedMessage &&
      !singleSelectedMessage.isDeleted &&
      singleSelectedMessage.senderId === actor.id,
  )

  const infoMessage = useMemo(
    () => (infoMessageId ? activeMessages.find((m) => m.id === infoMessageId) ?? null : null),
    [infoMessageId, activeMessages],
  )

  const allStarredItems = useMemo(() => {
    const items: Array<{ msg: ChatMessage; roomTitle: string; roomId: string }> = []
    for (const [rId, list] of Object.entries(messagesByRoom)) {
      if (!Array.isArray(list)) continue
      for (const m of list) {
        if (m.isDeleted || isMessageHiddenForMe(m)) continue
        if (!isMessageStarredByMe(m)) continue
        let roomTitle = rId
        if (rId === STAFF_ROOM_ID) {
          roomTitle = 'Staff Room'
        } else if (rId.startsWith('batch_group__')) {
          const b = rId.replace(/^batch_group__/, '')
          roomTitle = b === actor.className ? 'My Class Group' : `${b} Group`
        } else if (rId.startsWith('direct__')) {
          const peerId = rId.split('__').find((p, i) => i > 0 && p !== actor.id)
          roomTitle = peerId ? resolveActorDirectoryProfile(peerId).name : 'Direct Chat'
        }
        items.push({ msg: m, roomTitle, roomId: rId })
      }
    }
    return items.sort((a, b) => b.msg.createdAtMs - a.msg.createdAtMs)
  }, [messagesByRoom, isMessageHiddenForMe, isMessageStarredByMe, actor.className, actor.id])

  // Complete list of forwardable destinations (groups + all Usthads + all Students)
  const allForwardRooms = useMemo<ChatRoomDescriptor[]>(() => {
    const list: ChatRoomDescriptor[] = []
    if (actor.isStaff) {
      list.push({
        roomId: STAFF_ROOM_ID,
        type: 'staff_group',
        title: 'Staff Room',
        subtitle: 'Usthads & Principal',
        badgeLabel: 'Staff',
        avatarText: 'SR',
        isStaffOnly: true,
      })
      for (const cls of ACADEMY_CLASSES) {
        list.push({
          roomId: makeBatchRoomId(cls.className),
          type: 'batch_group',
          title: cls.className === actor.className ? 'My Class Group' : `${cls.fullLabel} Group`,
          subtitle: cls.fullLabel,
          badgeLabel: cls.className,
          batchName: cls.className,
          avatarText: 'CG',
        })
      }
    } else {
      const myCls =
        ACADEMY_CLASSES.find((c) => c.className === actor.className) ?? ACADEMY_CLASSES[0]
      list.push({
        roomId: makeBatchRoomId(myCls.className),
        type: 'batch_group',
        title: 'My Class Group',
        subtitle: myCls.fullLabel,
        badgeLabel: myCls.className,
        batchName: myCls.className,
        avatarText: 'CG',
      })
    }
    for (const u of OFFICIAL_CLASS_USTHADS) {
      if (u.id === actor.id) continue
      list.push({
        roomId: makeDirectRoomId(actor.id, u.id),
        type: 'direct_usthad',
        title: u.name,
        subtitle: u.designation || 'Usthad',
        badgeLabel: 'Usthad',
        batchName: u.className,
        peerId: u.id,
        peerRole: u.id === ACADEMY_PRINCIPAL.usthadId ? 'principal' : 'usthad',
        avatarText: u.name.replace(/^Usthad\s+/i, '').slice(0, 2).toUpperCase(),
        avatarUrl: u.avatarUrl,
      })
    }
    for (const st of students) {
      if (st.id === actor.id) continue
      list.push({
        roomId: makeDirectRoomId(actor.id, st.id),
        type: 'direct_student',
        title: st.name,
        subtitle: `Class ${st.className} • ${st.admissionNo}`,
        badgeLabel: st.className,
        batchName: st.className,
        peerId: st.id,
        peerRole: 'student',
        avatarText: st.firstName.slice(0, 2).toUpperCase(),
        avatarUrl: st.avatarUrl,
      })
    }
    return list
  }, [actor.id, actor.className, actor.isStaff])

  const handleToggleGroupLock = () => {
    if (!actor.isStaff) return
    const rId = activeRoom.roomId
    const nextLocked = !activeRoomMeta.onlyAdminsCanPost
    setRoomsMeta((prev) => ({
      ...prev,
      [rId]: {
        ...(prev[rId] ?? { roomId: rId, onlyAdminsCanPost: false, pinnedMessageId: null }),
        onlyAdminsCanPost: nextLocked,
        updatedAtMs: Date.now(),
      },
    }))
    void syncRoomMetaToFirestore(rId, nextLocked, activeRoomMeta.pinnedMessageId)
    void sendChatActionToServer({
      action: 'toggle_group_lock',
      roomId: rId,
      onlyAdminsCanPost: nextLocked,
    })
  }

  const scrollToMessage = (messageId: string) => {
    const el = document.getElementById(`chat-msg-${messageId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-2', 'ring-lime')
      window.setTimeout(() => {
        el.classList.remove('ring-2', 'ring-lime')
      }, 1800)
    }
  }

  const activeTypingBanner = getRoomTypingText(activeRoom.roomId)

  return (
    <section
      id="campus-chat"
      aria-label="ICS Academy Campus Messenger"
      className={cn(
        'flex flex-col overflow-hidden bg-background transition-colors lg:rounded-3xl lg:border lg:border-border lg:bg-card/95 lg:shadow-lg',
        mobileFullScreen
          ? 'h-full w-full flex-1 rounded-none border-0 shadow-none lg:h-[760px]'
          : 'h-[720px] sm:h-[760px]',
      )}
    >
      <div className="flex h-full min-h-0 flex-1 overflow-hidden">
        {/* LEFT PANE: WHATSAPP CONVERSATION ROSTER */}
        <div
          className={cn(
            'flex h-full w-full flex-col bg-background lg:w-[290px] xl:w-[360px] lg:shrink-0 lg:border-r lg:border-border lg:bg-background/80',
            mobileShowChatPane ? 'hidden lg:flex' : 'flex',
          )}
        >
          {/* Roster Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border bg-card/90 px-4 py-3.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:border-[#262a33] dark:bg-[#1a1d24] dark:text-zinc-100">
                  <MessageSquareText className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate font-display text-base font-bold tracking-tight text-foreground">
                    Messenger
                  </h2>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {actor.name}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setShowAttachMenu(false)
                  setSelectedMessageIds([])
                  setShowSelectionMoreMenu(false)
                  setShowSettingsModal(false)
                  setShowNewChatModal(false)
                  if (isRecordingVoice) cancelVoiceRecording()
                  setShowStarredModal(true)
                }}
                title="Starred Messages"
                aria-label="Open Starred Messages"
                className="relative flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background/80 text-muted-foreground transition-colors hover:bg-muted hover:text-amber-500 dark:border-[#262a33] dark:bg-[#1a1d24] dark:text-zinc-200 dark:hover:bg-[#222630]"
              >
                <Star className="size-4" aria-hidden="true" />
                {allStarredItems.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 font-poppins text-[9px] font-bold text-black">
                    {allStarredItems.length > 99 ? '99+' : allStarredItems.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAttachMenu(false)
                  setSelectedMessageIds([])
                  setShowSelectionMoreMenu(false)
                  setShowSettingsModal(false)
                  setShowStarredModal(false)
                  if (isRecordingVoice) cancelVoiceRecording()
                  setShowNewChatModal((prev) => !prev)
                }}
                title="Start a new chat with an Usthad or Student"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-500/25 dark:border-[#262a33] dark:bg-[#1a1d24] dark:text-zinc-100 dark:hover:bg-[#222630] shrink-0"
              >
                <MessageSquarePlus className="size-3.5" aria-hidden="true" />
                <span>New Chat</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAttachMenu(false)
                  setSelectedMessageIds([])
                  setShowSelectionMoreMenu(false)
                  setShowNewChatModal(false)
                  setShowStarredModal(false)
                  if (isRecordingVoice) cancelVoiceRecording()
                  setShowSettingsModal((prev) => !prev)
                }}
                title="Chat Settings"
                aria-label="Open Chat Settings"
                className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background/80 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:border-[#262a33] dark:bg-[#1a1d24] dark:text-zinc-200 dark:hover:bg-[#222630]"
              >
                <Settings className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Search & Category Filter Bar */}
          <div className="flex flex-col gap-2.5 border-b border-border/80 bg-background/60 p-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="h-9 w-full rounded-xl border border-input bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-emerald-500 dark:focus:border-zinc-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'groups', label: 'Groups' },
                  ...(actor.isStaff ? [{ id: 'staff', label: 'Staff' } as const] : []),
                  { id: 'usthads', label: 'Teachers' },
                  { id: 'students', label: 'Students' },
                  { id: 'calls', label: 'Calls' },
                ] as const
              ).map((tab) => {
                const active = categoryFilter === tab.id
                const showMissedBadge = tab.id === 'calls' && unreadMissedCallsCount > 0
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setCategoryFilter(tab.id)
                      if (tab.id === 'calls') {
                        markMissedCallsSeen()
                      }
                    }}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 border',
                      active
                        ? 'border-emerald-600 bg-emerald-600 text-white dark:border-[#343946] dark:bg-[#222630] dark:text-zinc-100'
                        : 'border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {tab.id === 'calls' && <Phone className="size-3" aria-hidden="true" />}
                    <span>{tab.label}</span>
                    {showMissedBadge && (
                      <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 font-poppins text-[9px] font-bold text-white tabular-nums">
                        {unreadMissedCallsCount > 99 ? '99+' : unreadMissedCallsCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Class selector when viewing Students tab (Available for ALL students & staff) */}
            {categoryFilter === 'students' && (
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Class:
                </span>
                <ThemeSelect
                  value={studentBatchFilter}
                  onChange={(e) => setStudentBatchFilter(e.target.value)}
                  aria-label="Filter students"
                  className="h-8 flex-1 rounded-lg border border-input bg-card px-2.5 text-xs font-semibold text-foreground"
                >
                  <option value={actor.className}>My Class ({actor.className})</option>
                  <option value="ALL">All Students ({students.length})</option>
                  {ACADEMY_CLASSES.map((c) => (
                    <option key={c.id} value={c.className}>
                      {c.fullLabel}
                    </option>
                  ))}
                </ThemeSelect>
              </div>
            )}
          </div>

          {/* Scrollable Room List OR Dedicated Calls History List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/50">
            {categoryFilter === 'calls' ? (
              (() => {
                const q = searchQuery.trim().toLowerCase()
                const filteredCalls = callHistory.filter((rec) => {
                  if (!q) return true
                  const isOutgoing = rec.callerId === actor.id
                  const peerName = (isOutgoing ? rec.calleeName : rec.callerName).toLowerCase()
                  const peerSub = (
                    (isOutgoing ? rec.calleeSubtitle : rec.callerSubtitle) || ''
                  ).toLowerCase()
                  return peerName.includes(q) || peerSub.includes(q) || rec.callType.includes(q)
                })

                if (filteredCalls.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                      <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                        <Phone className="size-5" aria-hidden="true" />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-foreground">No calls yet</p>
                      <p className="mt-1 max-w-[230px] text-xs leading-relaxed text-muted-foreground">
                        Open any student or Usthad chat and tap the voice or video call icon at the
                        top to place a direct call.
                      </p>
                    </div>
                  )
                }

                return filteredCalls.map((rec) => {
                  const isOutgoing = rec.callerId === actor.id
                  const peerId = isOutgoing ? rec.calleeId : rec.callerId
                  const peerName = isOutgoing ? rec.calleeName : rec.callerName
                  const peerRole = isOutgoing ? rec.calleeRole : rec.callerRole
                  const peerSubtitle = isOutgoing ? rec.calleeSubtitle : rec.callerSubtitle
                  const isMissedIncoming =
                    !isOutgoing && (rec.status === 'missed' || rec.status === 'declined')
                  const directRoomId = rec.roomId || makeDirectCallRoomId(actor.id, peerId)
                  const matchingRoom = allRooms.find(
                    (r) => r.roomId === directRoomId || r.peerId === peerId,
                  )
                  const avatarUrl = matchingRoom?.avatarUrl
                  const initials = peerName
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase() || '')
                    .join('')

                  const statusText =
                    rec.status === 'missed'
                      ? isOutgoing
                        ? 'No answer'
                        : 'Missed'
                      : rec.status === 'declined'
                        ? 'Declined'
                        : rec.status === 'busy'
                          ? 'Busy'
                          : rec.status === 'ringing' ||
                              rec.status === 'accepted' ||
                              rec.status === 'connected'
                            ? 'Ongoing'
                            : rec.durationSec && rec.durationSec > 0
                              ? formatCallDuration(rec.durationSec)
                              : isOutgoing
                                ? 'Outgoing'
                                : 'Incoming'

                  const handleQuickCall = (callType: CallMediaType) => {
                    void startCall(
                      {
                        id: peerId,
                        name: peerName,
                        role: peerRole,
                        subtitle: peerSubtitle,
                        roomId: directRoomId,
                        avatarUrl,
                      },
                      callType,
                    )
                  }

                  return (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between gap-2.5 px-3.5 py-3 transition-colors hover:bg-muted/50 min-h-[68px]"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (matchingRoom) {
                            setSelectedRoomId(matchingRoom.roomId)
                            setMobileShowChatPane(true)
                          } else {
                            setSelectedRoomId(directRoomId)
                            setMobileShowChatPane(true)
                          }
                        }}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-cyan/15 font-poppins text-xs font-bold text-cyan dark:border-[#262a33] dark:bg-[#1a1d24]">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={peerName}
                              className="size-full object-cover object-top"
                            />
                          ) : (
                            initials || 'IC'
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              'truncate text-sm font-semibold',
                              isMissedIncoming ? 'text-rose-600 dark:text-rose-400' : 'text-foreground',
                            )}
                          >
                            {peerName}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            {isMissedIncoming ? (
                              <PhoneMissed className="size-3.5 shrink-0 text-rose-500" />
                            ) : isOutgoing ? (
                              <PhoneOutgoing className="size-3.5 shrink-0 text-emerald-500" />
                            ) : (
                              <PhoneIncoming className="size-3.5 shrink-0 text-emerald-500" />
                            )}
                            <span className="truncate">
                              {rec.callType === 'video' ? 'Video' : 'Voice'} · {statusText} ·{' '}
                              <span className="tabular-nums">
                                {formatReceiptTimestamp(rec.startedAtMs)}
                              </span>
                            </span>
                          </div>
                        </div>
                      </button>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          disabled={Boolean(activeCall)}
                          onClick={() => handleQuickCall('voice')}
                          aria-label={`Voice call ${peerName}`}
                          title="Voice call"
                          className="flex size-10 items-center justify-center rounded-xl text-emerald-600 transition-colors hover:bg-emerald-500/12 disabled:opacity-40 dark:text-emerald-400"
                        >
                          <Phone className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(activeCall)}
                          onClick={() => handleQuickCall('video')}
                          aria-label={`Video call ${peerName}`}
                          title="Video call"
                          className="flex size-10 items-center justify-center rounded-xl text-emerald-600 transition-colors hover:bg-emerald-500/12 disabled:opacity-40 dark:text-emerald-400"
                        >
                          <Video className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  )
                })
              })()
            ) : (
              filteredRooms.map((room) => {
              const isSelected = room.roomId === activeRoom.roomId
              const roomMsgs = (messagesByRoom[room.roomId] ?? []).filter(
                (m) => !isMessageHiddenForMe(m),
              )
              const lastMsg = roomMsgs[roomMsgs.length - 1]
              const unreadCount = roomMsgs.filter(
                (m) => m.senderId !== actor.id && !m.readBy.includes(actor.id),
              ).length
              const roomMeta = roomsMeta[room.roomId]
              const roomTyping = getRoomTypingText(room.roomId)

              return (
                <button
                  key={room.roomId}
                  type="button"
                  onClick={() => {
                    unlockNotificationAudio()
                    setShowAttachMenu(false)
                    setSelectedMessageIds([])
                    setShowSelectionMoreMenu(false)
                    setInfoMessageId(null)
                    if (isRecordingVoice) cancelVoiceRecording()
                    setSelectedRoomId(room.roomId)
                    setMobileShowChatPane(true)
                    void sendChatActionToServer({
                      action: 'mark_read',
                      roomId: room.roomId,
                      sendReadReceipts: chatSettings.sendReadReceipts,
                    })
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors min-h-[68px]',
                    isSelected
                      ? 'bg-emerald-500/12 dark:bg-[#1a1d24]'
                      : 'hover:bg-muted/50',
                  )}
                >
                  {/* Avatar (Clean WhatsApp style — no green dot on avatar) */}
                  <div className="relative shrink-0">
                    <div
                      className={cn(
                        'flex size-11 items-center justify-center overflow-hidden rounded-2xl font-poppins text-xs font-bold shadow-xs border border-border dark:border-[#262a33]',
                        room.type === 'staff_group'
                          ? 'bg-amber-500/15 text-amber-600 dark:bg-[#1a1d24] dark:text-amber-300'
                          : room.type === 'batch_group'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:bg-[#1a1d24] dark:text-zinc-100'
                            : room.type === 'direct_usthad'
                              ? 'bg-cyan/15 text-cyan dark:bg-[#1a1d24] dark:text-cyan'
                              : 'bg-muted text-foreground dark:bg-[#1a1d24] dark:text-zinc-200',
                      )}
                    >
                      {room.avatarUrl ? (
                        <img
                          src={room.avatarUrl}
                          alt={room.title}
                          className="size-full object-cover object-top"
                        />
                      ) : room.type === 'batch_group' ? (
                        <Users className="size-4" aria-hidden="true" />
                      ) : room.type === 'staff_group' ? (
                        <Crown className="size-4" aria-hidden="true" />
                      ) : (
                        room.avatarText
                      )}
                    </div>
                  </div>

                  {/* Title, Last Message & Badges */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-xs font-bold text-foreground sm:text-[13px]">
                          {room.title}
                        </span>
                        {roomMeta?.onlyAdminsCanPost && (
                          <Lock
                            className="size-3 shrink-0 text-amber-500"
                            aria-label="Only Usthads can message"
                          />
                        )}
                      </div>
                      {lastMsg && (
                        <span className="shrink-0 font-poppins text-[10px] tabular-nums text-muted-foreground">
                          {formatSidebarDateOrTime(lastMsg.createdAtMs)}
                        </span>
                      )}
                    </div>

                    {room.subtitle ? (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {room.subtitle}
                      </p>
                    ) : null}

                    <div className="mt-1 flex items-center justify-between gap-2">
                      {roomTyping ? (
                        <p className="truncate text-[11px] font-semibold text-emerald-600 dark:text-zinc-300">
                          {roomTyping}
                        </p>
                      ) : lastMsg ? (
                        <p className="flex min-w-0 items-center truncate text-[11px] text-foreground/80">
                          {lastMsg.isDeleted ? (
                            <span className="truncate italic text-muted-foreground">
                              🚫{' '}
                              {lastMsg.deletedById === actor.id ||
                              (!lastMsg.deletedById && lastMsg.senderId === actor.id)
                                ? 'You deleted this message'
                                : 'This message was deleted'}
                            </span>
                          ) : (
                            <>
                              {lastMsg.senderId === actor.id &&
                                (() => {
                                  const lastReadByOthers =
                                    (lastMsg.readBy ?? []).some(
                                      (id) => id && id !== lastMsg.senderId,
                                    ) || (lastMsg.readBy?.length ?? 0) > 1
                                  const lastDeliveredToOthers =
                                    lastReadByOthers ||
                                    (lastMsg.deliveredTo ?? []).some(
                                      (id) => id && id !== lastMsg.senderId,
                                    ) ||
                                    (lastMsg.deliveredTo?.length ?? 0) > 1
                                  if (lastReadByOthers) {
                                    return (
                                      <CheckCheck
                                        className="mr-1 inline-block size-3.5 shrink-0 text-[#0095f6] dark:text-[#38bdf8] stroke-[2.5]"
                                        aria-label="Read"
                                      />
                                    )
                                  }
                                  if (lastDeliveredToOthers) {
                                    return (
                                      <CheckCheck
                                        className="mr-1 inline-block size-3.5 shrink-0 text-zinc-500 dark:text-zinc-300 stroke-[2.2]"
                                        aria-label="Delivered"
                                      />
                                    )
                                  }
                                  return (
                                    <Check
                                      className="mr-1 inline-block size-3.5 shrink-0 text-zinc-400 dark:text-zinc-500 stroke-[2.2]"
                                      aria-label="Sent"
                                    />
                                  )
                                })()}
                              <span className="font-semibold shrink-0 mr-1">
                                {lastMsg.senderId === actor.id
                                  ? 'You:'
                                  : `${lastMsg.senderName.split(' ').slice(0, 2).join(' ')}:`}
                              </span>
                              <span className="truncate">
                                {lastMsg.mediaType === 'voice'
                                  ? `🎤 ${formatVoiceDuration(lastMsg.mediaDurationSec || 4)}`
                                  : lastMsg.mediaType === 'pdf'
                                    ? `📄 ${lastMsg.mediaName || 'PDF Note'}`
                                    : lastMsg.mediaType === 'image'
                                      ? `📷 ${lastMsg.imageQuality === 'hd' ? 'HD ' : ''}Photo`
                                      : lastMsg.mediaType === 'call'
                                        ? `${lastMsg.callMeta?.callType === 'video' ? '📹' : '📞'} ${lastMsg.text || 'Call'}`
                                        : lastMsg.text}
                              </span>
                            </>
                          )}
                        </p>
                      ) : (
                        <p className="truncate text-[11px] italic text-muted-foreground">
                          Tap to start conversation...
                        </p>
                      )}

                      {unreadCount > 0 && (
                        <span className="flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1.5 font-poppins text-[10px] font-bold text-white tabular-nums dark:bg-zinc-200 dark:text-[#0a0b0e]">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
            )}
          </div>
        </div>

        {/* RIGHT PANE: ACTIVE WHATSAPP CONVERSATION WINDOW (OR MESSAGE INFO SCREEN) */}
        <div
          className={cn(
            'relative flex h-full min-w-0 flex-1 flex-col bg-background lg:bg-background/95',
            !mobileShowChatPane
              ? 'hidden lg:flex'
              : 'flex max-lg:fixed max-lg:inset-0 max-lg:z-[55] max-lg:w-full max-lg:pt-[var(--safe-top)] max-lg:pb-[var(--safe-bottom)]',
          )}
        >
          {/* Floating Action Toast */}
          {actionToast && (
            <div className="pointer-events-none absolute left-1/2 top-16 z-40 -translate-x-1/2 rounded-full border border-border bg-card/95 px-4 py-1.5 text-xs font-semibold text-foreground shadow-lg backdrop-blur-xs dark:border-[#343946] dark:bg-[#1a1d24] dark:text-zinc-100">
              {actionToast}
            </div>
          )}

          {infoMessage ? (
            /* WHATSAPP-STYLE MESSAGE INFO SCREEN (← Message info) */
            (() => {
              const isGroupRoom =
                activeRoom.type === 'batch_group' || activeRoom.type === 'staff_group'
              const readIds = (infoMessage.readBy ?? []).filter(
                (id) => id && id !== infoMessage.senderId,
              )
              const deliveredIds = (infoMessage.deliveredTo ?? []).filter(
                (id) => id && id !== infoMessage.senderId,
              )
              const infoReadByOthers = readIds.length > 0
              const infoDeliveredToOthers = infoReadByOthers || deliveredIds.length > 0

              // Compute expected recipients for group rooms
              const expectedRecipientIds = new Set<string>()
              if (activeRoom.type === 'staff_group') {
                for (const u of OFFICIAL_CLASS_USTHADS) {
                  if (u.id !== infoMessage.senderId) expectedRecipientIds.add(u.id)
                }
              } else if (activeRoom.type === 'batch_group' && activeRoom.batchName) {
                for (const st of students) {
                  if (st.className === activeRoom.batchName && st.id !== infoMessage.senderId) {
                    expectedRecipientIds.add(st.id)
                  }
                }
                for (const u of OFFICIAL_CLASS_USTHADS) {
                  if (
                    (u.className === activeRoom.batchName || u.id === ACADEMY_PRINCIPAL.usthadId) &&
                    u.id !== infoMessage.senderId
                  ) {
                    expectedRecipientIds.add(u.id)
                  }
                }
              } else if (activeRoom.peerId && activeRoom.peerId !== infoMessage.senderId) {
                expectedRecipientIds.add(activeRoom.peerId)
              }
              for (const id of [...readIds, ...deliveredIds]) {
                expectedRecipientIds.add(id)
              }

              const totalRecipients = expectedRecipientIds.size
              const readByList = Array.from(new Set(readIds))
                .map((id) => ({
                  profile: resolveActorDirectoryProfile(id),
                  ts: infoMessage.readAtMap?.[id],
                }))
                .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))

              const deliveredOnlyList = Array.from(new Set(deliveredIds))
                .filter((id) => !readIds.includes(id))
                .map((id) => ({
                  profile: resolveActorDirectoryProfile(id),
                  ts: infoMessage.deliveredAtMap?.[id],
                }))
                .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))

              const remainingToRead = Math.max(0, totalRecipients - readByList.length)
              const remainingToDeliver = Math.max(
                0,
                totalRecipients - new Set([...readIds, ...deliveredIds]).size,
              )

              // Direct chat single peer timestamps
              const directPeerId = activeRoom.peerId || readIds[0] || deliveredIds[0]
              const directIsRead = Boolean(
                directPeerId ? readIds.includes(directPeerId) : readIds.length > 0,
              )
              const directIsDelivered = Boolean(
                directIsRead ||
                  (directPeerId ? deliveredIds.includes(directPeerId) : deliveredIds.length > 0),
              )
              const directReadTs = directPeerId ? infoMessage.readAtMap?.[directPeerId] : undefined
              const directDeliveredTs = directPeerId
                ? infoMessage.deliveredAtMap?.[directPeerId] ?? directReadTs
                : undefined

              return (
                <div className="flex h-full flex-col bg-background dark:bg-[#0b1014]">
                  {/* Message Info Top Bar */}
                  <div className="flex items-center gap-3 border-b border-border bg-card/95 px-3 py-3 sm:px-4 dark:border-[#262a33] dark:bg-[#11171d]">
                    <button
                      type="button"
                      onClick={() => setInfoMessageId(null)}
                      aria-label="Back to chat"
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted dark:hover:bg-white/10"
                    >
                      <ArrowLeft className="size-5" aria-hidden="true" />
                    </button>
                    <h3 className="font-poppins text-base font-semibold text-foreground">
                      Message info
                    </h3>
                  </div>

                  {/* Scrollable Body: Bubble Preview + Receipts */}
                  <div className="flex-1 overflow-y-auto">
                    {/* Message Bubble Preview over subtle wallpaper */}
                    <div
                      className={cn(
                        'flex flex-col items-end border-b border-border/80 px-4 py-5 sm:px-6 dark:border-[#1f262e]',
                        chatSettings.chatWallpaper === 'pitch_dark'
                          ? 'bg-[#e8edf2] dark:bg-[#07080a]'
                          : chatSettings.chatWallpaper === 'soft_mint'
                            ? 'bg-[#e7f5ea] dark:bg-[#0c1412]'
                            : chatSettings.chatWallpaper === 'warm_slate'
                              ? 'bg-[#f2efe9] dark:bg-[#101216]'
                              : 'bg-muted/40 dark:bg-[#0b141a]',
                      )}
                    >
                      <div className="max-w-[90%] sm:max-w-[78%] rounded-2xl rounded-br-xs border border-[#bde6b4] bg-[#dcf8c6] px-3.5 py-2.5 text-[#081e21] shadow-xs dark:border-[#056150] dark:bg-[#005c4b] dark:text-[#e9edef]">
                        {infoMessage.isForwarded && (
                          <div className="mb-1 flex items-center gap-1 text-[11px] italic opacity-75">
                            <Forward className="size-3" aria-hidden="true" />
                            <span>Forwarded</span>
                          </div>
                        )}
                        {infoMessage.mediaType === 'image' && infoMessage.mediaUrl && (
                          <img
                            src={infoMessage.mediaUrl}
                            alt={infoMessage.mediaName || 'Photo'}
                            className="mb-1.5 max-h-56 w-full rounded-xl object-cover"
                          />
                        )}
                        {infoMessage.mediaType === 'pdf' && (
                          <div className="mb-1.5 flex items-center gap-2 rounded-xl bg-black/10 px-2.5 py-2 text-xs font-semibold">
                            <FileText className="size-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">
                              {infoMessage.mediaName || 'PDF Document'}
                            </span>
                          </div>
                        )}
                        {infoMessage.mediaType === 'voice' && (
                          <div className="mb-1 flex items-center gap-2 text-xs font-semibold">
                            <Mic className="size-4 shrink-0" aria-hidden="true" />
                            <span>
                              Voice message ({formatVoiceDuration(infoMessage.mediaDurationSec || 4)})
                            </span>
                          </div>
                        )}
                        {infoMessage.text && (
                          <p className="whitespace-pre-wrap break-words text-xs sm:text-sm leading-relaxed">
                            {infoMessage.text}
                          </p>
                        )}
                        <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px] opacity-85">
                          {isMessageStarredByMe(infoMessage) && (
                            <Star
                              className="size-3 fill-current opacity-85"
                              aria-label="Starred"
                            />
                          )}
                          <span className="font-poppins tabular-nums">
                            {formatChatTime(infoMessage.createdAtMs).toLowerCase()}
                          </span>
                          {infoReadByOthers ? (
                            <CheckCheck
                              className="size-4 text-[#0095f6] dark:text-[#53bdeb] stroke-[2.5]"
                              aria-label="Read"
                            />
                          ) : infoDeliveredToOthers ? (
                            <CheckCheck
                              className="size-4 text-zinc-500 dark:text-zinc-300 stroke-[2.2]"
                              aria-label="Delivered"
                            />
                          ) : (
                            <Check
                              className="size-3.5 text-zinc-500 dark:text-zinc-300 stroke-[2.2]"
                              aria-label="Sent"
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Receipts Section */}
                    {!isGroupRoom ? (
                      /* 1-on-1 Direct Chat Receipts (Matches WhatsApp Screenshot) */
                      <div className="divide-y divide-border/70 px-4 sm:px-6 dark:divide-[#1f262e]">
                        <div className="py-4">
                          <div className="flex items-center gap-2.5">
                            <CheckCheck
                              className="size-4.5 shrink-0 text-[#0095f6] dark:text-[#53bdeb] stroke-[2.5]"
                              aria-hidden="true"
                            />
                            <span className="text-sm font-medium text-foreground">Read</span>
                          </div>
                          <p className="mt-1 pl-7 text-xs text-muted-foreground">
                            {directIsRead
                              ? directReadTs
                                ? formatReceiptTimestamp(directReadTs)
                                : 'Read'
                              : '—'}
                          </p>
                        </div>

                        <div className="py-4">
                          <div className="flex items-center gap-2.5">
                            <CheckCheck
                              className="size-4.5 shrink-0 text-muted-foreground stroke-[2.2]"
                              aria-hidden="true"
                            />
                            <span className="text-sm font-medium text-foreground">Delivered</span>
                          </div>
                          <p className="mt-1 pl-7 text-xs text-muted-foreground">
                            {directIsDelivered
                              ? directDeliveredTs
                                ? formatReceiptTimestamp(directDeliveredTs)
                                : 'Delivered'
                              : '—'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Group Chat Receipts (Read by + Delivered to member breakdown) */
                      <div className="space-y-3 p-4 sm:p-5">
                        {/* Read By Card */}
                        <div className="overflow-hidden rounded-2xl border border-border bg-card dark:border-[#222831] dark:bg-[#11171d]">
                          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 dark:border-[#1f262e]">
                            <div className="flex items-center gap-2">
                              <CheckCheck
                                className="size-4.5 text-[#0095f6] dark:text-[#53bdeb] stroke-[2.5]"
                                aria-hidden="true"
                              />
                              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                                Read by
                              </span>
                            </div>
                            <span className="font-poppins text-xs font-semibold text-muted-foreground tabular-nums">
                              {readByList.length} / {totalRecipients}
                            </span>
                          </div>

                          {readByList.length === 0 ? (
                            <p className="px-4 py-3.5 text-xs text-muted-foreground">
                              No one has read this message yet.
                            </p>
                          ) : (
                            <div className="divide-y divide-border/50 dark:divide-[#1f262e]">
                              {readByList.map(({ profile, ts }) => (
                                <div
                                  key={profile.id}
                                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                                >
                                  <div className="flex min-w-0 items-center gap-2.5">
                                    {profile.avatarUrl ? (
                                      <img
                                        src={profile.avatarUrl}
                                        alt={profile.name}
                                        className="size-8 shrink-0 rounded-full border border-border object-cover object-top"
                                      />
                                    ) : (
                                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-poppins text-[11px] font-bold text-emerald-700 dark:bg-[#1f262e] dark:text-zinc-200">
                                        {profile.avatarText}
                                      </span>
                                    )}
                                    <div className="min-w-0">
                                      <p className="truncate text-xs font-semibold text-foreground">
                                        {profile.name}
                                      </p>
                                      <p className="truncate text-[10px] text-muted-foreground">
                                        {profile.subtitle}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                                    {ts ? formatReceiptTimestamp(ts) : 'Read'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {remainingToRead > 0 && (
                            <div className="border-t border-border/60 bg-muted/30 px-4 py-2 text-[11px] font-medium text-muted-foreground dark:border-[#1f262e] dark:bg-[#0d1217]">
                              {remainingToRead} remaining
                            </div>
                          )}
                        </div>

                        {/* Delivered To Card */}
                        <div className="overflow-hidden rounded-2xl border border-border bg-card dark:border-[#222831] dark:bg-[#11171d]">
                          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 dark:border-[#1f262e]">
                            <div className="flex items-center gap-2">
                              <CheckCheck
                                className="size-4.5 text-muted-foreground stroke-[2.2]"
                                aria-hidden="true"
                              />
                              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                                Delivered to
                              </span>
                            </div>
                            <span className="font-poppins text-xs font-semibold text-muted-foreground tabular-nums">
                              {deliveredOnlyList.length}
                            </span>
                          </div>

                          {deliveredOnlyList.length === 0 ? (
                            <p className="px-4 py-3.5 text-xs text-muted-foreground">
                              {remainingToDeliver === 0 && readByList.length > 0
                                ? 'Everyone who received this message has read it.'
                                : 'Waiting for delivery to remaining members.'}
                            </p>
                          ) : (
                            <div className="divide-y divide-border/50 dark:divide-[#1f262e]">
                              {deliveredOnlyList.map(({ profile, ts }) => (
                                <div
                                  key={profile.id}
                                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                                >
                                  <div className="flex min-w-0 items-center gap-2.5">
                                    {profile.avatarUrl ? (
                                      <img
                                        src={profile.avatarUrl}
                                        alt={profile.name}
                                        className="size-8 shrink-0 rounded-full border border-border object-cover object-top"
                                      />
                                    ) : (
                                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-poppins text-[11px] font-bold text-foreground dark:bg-[#1f262e] dark:text-zinc-200">
                                        {profile.avatarText}
                                      </span>
                                    )}
                                    <div className="min-w-0">
                                      <p className="truncate text-xs font-semibold text-foreground">
                                        {profile.name}
                                      </p>
                                      <p className="truncate text-[10px] text-muted-foreground">
                                        {profile.subtitle}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                                    {ts ? formatReceiptTimestamp(ts) : 'Delivered'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {remainingToDeliver > 0 && (
                            <div className="border-t border-border/60 bg-muted/30 px-4 py-2 text-[11px] font-medium text-muted-foreground dark:border-[#1f262e] dark:bg-[#0d1217]">
                              {remainingToDeliver} remaining
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()
          ) : (
            <>
              {/* Active Chat Header OR WhatsApp Contextual Multi-Message Selection Bar */}
              {selectedMessageIds.length > 0 ? (
                <div className="relative z-30 flex items-center justify-between gap-2 border-b border-border bg-emerald-700 px-2.5 py-2.5 text-white shadow-sm sm:px-4 sm:py-3 dark:border-[#262a33] dark:bg-[#11171d] dark:text-zinc-100">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMessageIds([])
                        setShowSelectionMoreMenu(false)
                      }}
                      aria-label="Exit message selection"
                      className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-white/15"
                    >
                      <ArrowLeft className="size-5" aria-hidden="true" />
                    </button>
                    <span className="font-poppins text-base font-bold tabular-nums">
                      {selectedMessageIds.length}
                    </span>
                  </div>

                  {/* WhatsApp Selection Actions: Reply, Star, Info, Delete, Forward, More (⋮) */}
                  <div className="flex items-center gap-0.5 sm:gap-1.5">
                    {singleSelectedMessage && !singleSelectedMessage.isDeleted && (
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTo({
                            messageId: singleSelectedMessage.id,
                            senderName: singleSelectedMessage.senderName,
                            previewText:
                              singleSelectedMessage.mediaType === 'voice'
                                ? `🎤 Voice Note (${formatVoiceDuration(singleSelectedMessage.mediaDurationSec || 4)})`
                                : singleSelectedMessage.text ||
                                  (singleSelectedMessage.mediaType === 'pdf'
                                    ? `📄 ${singleSelectedMessage.mediaName}`
                                    : '📷 Photo'),
                          })
                          setSelectedMessageIds([])
                          setShowSelectionMoreMenu(false)
                        }}
                        title="Reply"
                        aria-label="Reply to message"
                        className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-white/15"
                      >
                        <Reply className="size-5" aria-hidden="true" />
                      </button>
                    )}

                    {nonDeletedSelectedMessages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleToggleStarMessages(nonDeletedSelectedMessages)}
                        title={isAllSelectedStarred ? 'Unstar' : 'Star'}
                        aria-label={isAllSelectedStarred ? 'Unstar message' : 'Star message'}
                        className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-white/15"
                      >
                        <Star
                          className={cn(
                            'size-5',
                            isAllSelectedStarred && 'fill-amber-400 text-amber-400',
                          )}
                          aria-hidden="true"
                        />
                      </button>
                    )}

                    {canShowInfoAction && singleSelectedMessage && (
                      <button
                        type="button"
                        onClick={() => {
                          setInfoMessageId(singleSelectedMessage.id)
                          setSelectedMessageIds([])
                          setShowSelectionMoreMenu(false)
                        }}
                        title="Message info"
                        aria-label="Message info"
                        className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-white/15"
                      >
                        <Info className="size-5" aria-hidden="true" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowSelectionMoreMenu(false)
                        setDeleteModalMessages(selectedMessages)
                      }}
                      title="Delete"
                      aria-label="Delete selected messages"
                      className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-white/15"
                    >
                      <Trash2 className="size-5" aria-hidden="true" />
                    </button>

                    {nonDeletedSelectedMessages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowSelectionMoreMenu(false)
                          setForwardMessageIds(nonDeletedSelectedMessages.map((m) => m.id))
                          setForwardTargetRoomIds([])
                          setForwardSearchQuery('')
                          setForwardBatchFilter('ALL')
                        }}
                        title="Forward"
                        aria-label="Forward selected messages"
                        className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-white/15"
                      >
                        <Forward className="size-5" aria-hidden="true" />
                      </button>
                    )}

                    {nonDeletedSelectedMessages.length > 0 && (
                      <div ref={selectionMoreMenuRef} className="relative">
                        <button
                          type="button"
                          onClick={() => setShowSelectionMoreMenu((prev) => !prev)}
                          title="More options"
                          aria-label="More message options"
                          className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-white/15"
                        >
                          <MoreVertical className="size-5" aria-hidden="true" />
                        </button>

                        {showSelectionMoreMenu && (
                          <div className="absolute right-0 top-11 z-40 w-48 overflow-hidden rounded-2xl border border-border bg-card py-1.5 text-xs text-foreground shadow-2xl dark:border-[#262a33] dark:bg-[#181b22] dark:text-zinc-100">
                            <button
                              type="button"
                              onClick={() => void handleCopyMessages(nonDeletedSelectedMessages)}
                              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left font-medium transition-colors hover:bg-muted dark:hover:bg-white/10"
                            >
                              <Copy className="size-4 text-muted-foreground" aria-hidden="true" />
                              <span>Copy</span>
                            </button>

                            {singleSelectedMessage &&
                              !singleSelectedMessage.isDeleted &&
                              canPinActiveRoom && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleTogglePinMessage(singleSelectedMessage.id)
                                  }
                                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left font-medium transition-colors hover:bg-muted dark:hover:bg-white/10"
                                >
                                  <Pin
                                    className="size-4 text-muted-foreground"
                                    aria-hidden="true"
                                  />
                                  <span>
                                    {activeRoomMeta.pinnedMessageId === singleSelectedMessage.id
                                      ? 'Unpin'
                                      : 'Pin'}
                                  </span>
                                </button>
                              )}

                            <button
                              type="button"
                              onClick={() => void handleShareMessages(nonDeletedSelectedMessages)}
                              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left font-medium transition-colors hover:bg-muted dark:hover:bg-white/10"
                            >
                              <Share2
                                className="size-4 text-muted-foreground"
                                aria-hidden="true"
                              />
                              <span>Share</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAttachMenu(false)
                        setSelectedMessageIds([])
                        setShowSelectionMoreMenu(false)
                        if (isRecordingVoice) cancelVoiceRecording()
                        setMobileShowChatPane(false)
                      }}
                      aria-label="Back to chat list"
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background/80 text-foreground hover:bg-muted lg:hidden"
                    >
                      <ArrowLeft className="size-4" aria-hidden="true" />
                    </button>

                    <div className="relative shrink-0">
                      <div
                        className={cn(
                          'flex size-10 items-center justify-center overflow-hidden rounded-2xl font-poppins text-xs font-bold border border-border dark:border-[#262a33]',
                          activeRoom.type === 'staff_group'
                            ? 'bg-amber-500/15 text-amber-600 dark:bg-[#1a1d24] dark:text-amber-300'
                            : activeRoom.type === 'batch_group'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:bg-[#1a1d24] dark:text-zinc-100'
                              : 'bg-cyan/15 text-cyan dark:bg-[#1a1d24] dark:text-cyan',
                        )}
                      >
                        {activeRoom.avatarUrl ? (
                          <img
                            src={activeRoom.avatarUrl}
                            alt={activeRoom.title}
                            className="size-full object-cover object-top"
                          />
                        ) : activeRoom.type === 'batch_group' ? (
                          <Users className="size-4" aria-hidden="true" />
                        ) : activeRoom.type === 'staff_group' ? (
                          <Crown className="size-4" aria-hidden="true" />
                        ) : (
                          activeRoom.avatarText
                        )}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="truncate font-poppins text-sm font-bold text-foreground sm:text-base">
                          {activeRoom.title}
                        </h3>
                        {activeRoom.badgeLabel ? (
                          <span className="hidden rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline-block">
                            {activeRoom.badgeLabel}
                          </span>
                        ) : null}
                      </div>

                      {activeTypingBanner ? (
                        <p className="truncate text-[11px] font-semibold text-emerald-600 dark:text-zinc-300">
                          {activeTypingBanner}
                        </p>
                      ) : (() => {
                          const headerStatus = getOpenChatHeaderStatus(activeRoom)
                          if (headerStatus.isOnlineNow) {
                            return (
                              <p className="truncate text-[11px] font-medium text-emerald-600 dark:text-zinc-300">
                                online
                              </p>
                            )
                          }
                          if (headerStatus.text) {
                            return (
                              <p className="truncate text-[11px] text-muted-foreground">
                                {headerStatus.text}
                              </p>
                            )
                          }
                          return null
                        })()}
                    </div>
                  </div>

                  {/* Right Controls: 1-on-1 Voice/Video Call + Group Lock Toggle + Starred + Chat Settings */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    {(activeRoom.type === 'direct_usthad' || activeRoom.type === 'direct_student') &&
                      activeRoom.peerId && (
                        <>
                          <button
                            type="button"
                            disabled={Boolean(activeCall)}
                            onClick={() => {
                              setShowAttachMenu(false)
                              if (isRecordingVoice) cancelVoiceRecording()
                              void startCall(
                                {
                                  id: activeRoom.peerId!,
                                  name: activeRoom.title,
                                  role: activeRoom.peerRole || 'student',
                                  subtitle: activeRoom.subtitle,
                                  roomId: activeRoom.roomId,
                                  avatarUrl: activeRoom.avatarUrl,
                                },
                                'video',
                              )
                            }}
                            title={`Video call ${activeRoom.title}`}
                            aria-label={`Video call ${activeRoom.title}`}
                            className="flex size-10 items-center justify-center rounded-xl border border-border bg-background/80 text-emerald-600 transition-colors hover:bg-emerald-500/12 disabled:opacity-45 sm:size-9 dark:text-emerald-400"
                          >
                            <Video className="size-4.5 sm:size-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(activeCall)}
                            onClick={() => {
                              setShowAttachMenu(false)
                              if (isRecordingVoice) cancelVoiceRecording()
                              void startCall(
                                {
                                  id: activeRoom.peerId!,
                                  name: activeRoom.title,
                                  role: activeRoom.peerRole || 'student',
                                  subtitle: activeRoom.subtitle,
                                  roomId: activeRoom.roomId,
                                  avatarUrl: activeRoom.avatarUrl,
                                },
                                'voice',
                              )
                            }}
                            title={`Voice call ${activeRoom.title}`}
                            aria-label={`Voice call ${activeRoom.title}`}
                            className="flex size-10 items-center justify-center rounded-xl border border-border bg-background/80 text-emerald-600 transition-colors hover:bg-emerald-500/12 disabled:opacity-45 sm:size-9 dark:text-emerald-400"
                          >
                            <Phone className="size-4.5 sm:size-4" aria-hidden="true" />
                          </button>
                        </>
                      )}

                    {actor.isStaff && activeRoom.type === 'batch_group' && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachMenu(false)
                          setSelectedMessageIds([])
                          setShowSelectionMoreMenu(false)
                          if (isRecordingVoice) cancelVoiceRecording()
                          handleToggleGroupLock()
                        }}
                        title={
                          activeRoomMeta.onlyAdminsCanPost
                            ? 'Group is locked to Usthads only. Click to allow all students to message.'
                            : 'Click to restrict group so only Usthads & Principal can send messages.'
                        }
                        className={cn(
                          'inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0',
                          activeRoomMeta.onlyAdminsCanPost
                            ? 'border-border bg-amber-500/15 text-amber-600 dark:border-[#262a33] dark:bg-[#1a1d24] dark:text-amber-300'
                            : 'border-border bg-background/80 text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {activeRoomMeta.onlyAdminsCanPost ? (
                          <>
                            <Lock className="size-3.5" aria-hidden="true" />
                            <span>Only Usthads</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="size-3.5" aria-hidden="true" />
                            <span className="hidden sm:inline">All Can Send</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowAttachMenu(false)
                        setSelectedMessageIds([])
                        setShowSelectionMoreMenu(false)
                        setShowNewChatModal(false)
                        setShowSettingsModal(false)
                        if (isRecordingVoice) cancelVoiceRecording()
                        setShowStarredModal(true)
                      }}
                      title="Starred Messages"
                      aria-label="Open Starred Messages"
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background/80 text-muted-foreground transition-colors hover:bg-muted hover:text-amber-500 dark:border-[#262a33] dark:bg-[#1a1d24] dark:text-zinc-200 dark:hover:bg-[#222630]"
                    >
                      <Star className="size-4" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowAttachMenu(false)
                        setSelectedMessageIds([])
                        setShowSelectionMoreMenu(false)
                        setShowNewChatModal(false)
                        setShowStarredModal(false)
                        if (isRecordingVoice) cancelVoiceRecording()
                        setShowSettingsModal((prev) => !prev)
                      }}
                      title="Chat Settings"
                      aria-label="Open Chat Settings"
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background/80 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:border-[#262a33] dark:bg-[#1a1d24] dark:text-zinc-200 dark:hover:bg-[#222630]"
                    >
                      <Settings className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}

              {/* Pinned Message Banner */}
              {pinnedMessage && (
                <div className="flex items-center justify-between gap-2 border-b border-border bg-emerald-500/10 px-3.5 py-2 dark:border-[#262a33] dark:bg-[#14171d]">
                  <button
                    type="button"
                    onClick={() => scrollToMessage(pinnedMessage.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <Pin
                      className="size-3.5 shrink-0 text-emerald-600 dark:text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-muted-foreground">
                        Pinned • {pinnedMessage.senderName}
                      </p>
                      <p className="truncate text-xs text-foreground">
                        {pinnedMessage.mediaType === 'pdf'
                          ? `📄 ${pinnedMessage.mediaName} — ${pinnedMessage.text}`
                          : pinnedMessage.text || 'Media message'}
                      </p>
                    </div>
                  </button>
                  {canPinActiveRoom && (
                    <button
                      type="button"
                      onClick={() => handleTogglePinMessage(null)}
                      aria-label="Unpin message"
                      className="rounded-lg p-1 text-muted-foreground hover:bg-background/60 hover:text-foreground"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}

              {/* Scrollable Message Stream */}
              <div
                className={cn(
                  'flex-1 space-y-2 overflow-y-auto px-2 py-4 sm:px-4 transition-colors',
                  chatSettings.chatWallpaper === 'pitch_dark' &&
                    'bg-[#f1f5f9] dark:bg-[#07080a]',
                  chatSettings.chatWallpaper === 'soft_mint' &&
                    'bg-[#eef8f0] dark:bg-[#0c1110]',
                  chatSettings.chatWallpaper === 'warm_slate' &&
                    'bg-[#f5f3ef] dark:bg-[#101115]',
                )}
                onClick={() => {
                  if (selectedMessageIds.length > 0) {
                    setSelectedMessageIds([])
                    setShowSelectionMoreMenu(false)
                  }
                  setShowAttachMenu(false)
                }}
              >
                {/* End-to-End Campus Security Banner */}
                <div className="mx-auto max-w-md rounded-2xl border border-border/70 bg-card/70 px-3.5 py-2 text-center text-[11px] text-muted-foreground dark:border-[#262a33] dark:bg-[#121418]">
                  <ShieldCheck
                    className="mr-1 inline-block size-3.5 text-emerald-600 dark:text-muted-foreground"
                    aria-hidden="true"
                  />
                  Messages and files are private to ICS Academy.
                </div>

                {activeMessages.map((msg) => {
                  const isMine = msg.senderId === actor.id
                  const isPinned = activeRoomMeta.pinnedMessageId === msg.id
                  const isStarred = !msg.isDeleted && isMessageStarredByMe(msg)
                  const otherReadersCount = (msg.readBy ?? []).filter(
                    (id) => id && id !== msg.senderId,
                  ).length
                  const otherDeliveredCount = (msg.deliveredTo ?? []).filter(
                    (id) => id && id !== msg.senderId,
                  ).length
                  const isReadByOthers = otherReadersCount > 0 || (msg.readBy?.length ?? 0) > 1
                  const isDeliveredToOthers =
                    isReadByOthers || otherDeliveredCount > 0 || (msg.deliveredTo?.length ?? 0) > 1
                  const isSelected = selectedMessageIds.includes(msg.id)
                  const isSelectionActive = selectedMessageIds.length > 0
                  const showSingleReactionPill =
                    isSelected && selectedMessageIds.length === 1 && !msg.isDeleted
                  const isImageMessage =
                    !msg.isDeleted && msg.mediaType === 'image' && Boolean(msg.mediaUrl)
                  const isImageOnlyWithoutCaption = isImageMessage && !msg.text
                  const reactionEntries = Object.entries(msg.reactions || {}).filter(
                    ([, users]) => Array.isArray(users) && users.length > 0,
                  )

                  return (
                    <div
                      key={msg.id}
                      id={`chat-msg-${msg.id}`}
                      onClick={(e) => {
                        if (!isSelectionActive) return
                        e.stopPropagation()
                        toggleSelectMessage(msg.id)
                      }}
                      className={cn(
                        'group relative flex flex-col px-1.5 py-0.5 transition-all duration-150 rounded-xl',
                        isMine ? 'items-end' : 'items-start',
                        isSelected && 'bg-emerald-500/18 dark:bg-emerald-500/20',
                      )}
                    >
                      <div
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowAttachMenu(false)
                          if (longPressTriggeredRef.current) {
                            longPressTriggeredRef.current = false
                            return
                          }
                          toggleSelectMessage(msg.id)
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setShowAttachMenu(false)
                          if (!selectedMessageIds.includes(msg.id)) {
                            setSelectedMessageIds((prev) => [...prev, msg.id])
                          }
                        }}
                        onTouchStart={() => {
                          longPressTriggeredRef.current = false
                          if (longPressTimerRef.current) {
                            window.clearTimeout(longPressTimerRef.current)
                          }
                          longPressTimerRef.current = window.setTimeout(() => {
                            longPressTriggeredRef.current = true
                            setShowAttachMenu(false)
                            setSelectedMessageIds((prev) =>
                              prev.includes(msg.id) ? prev : [...prev, msg.id],
                            )
                          }, 380)
                        }}
                        onTouchEnd={() => {
                          if (longPressTimerRef.current) {
                            window.clearTimeout(longPressTimerRef.current)
                            longPressTimerRef.current = null
                          }
                        }}
                        onTouchMove={() => {
                          if (longPressTimerRef.current) {
                            window.clearTimeout(longPressTimerRef.current)
                            longPressTimerRef.current = null
                          }
                        }}
                        className={cn(
                          'relative max-w-[86%] sm:max-w-[74%] rounded-2xl shadow-xs transition-colors cursor-pointer select-none',
                          isImageMessage ? 'p-1 border-0' : 'px-3.5 py-2 pr-9 border',
                          isMine
                            ? 'rounded-br-xs border-[#bde6b4] bg-[#dcf8c6] text-[#081e21] dark:border-[#056150] dark:bg-[#005c4b] dark:text-[#e9edef]'
                            : 'rounded-bl-xs border-border bg-card text-foreground dark:border-[#262a33] dark:bg-[#121418] dark:text-[#f3f4f6]',
                          isSelected && 'ring-2 ring-emerald-500/75 dark:ring-emerald-400/70',
                        )}
                      >
                        {/* Touch-Friendly Selector Trigger in Top-Right Corner */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowAttachMenu(false)
                            toggleSelectMessage(msg.id)
                          }}
                          aria-label={isSelected ? 'Deselect message' : 'Select message'}
                          className={cn(
                            'absolute right-1.5 top-1.5 z-20 flex size-6 items-center justify-center rounded-full transition-colors',
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : isImageMessage
                                ? 'right-2 top-2 bg-black/55 text-white/95 backdrop-blur-[2px] hover:bg-black/75'
                                : 'text-foreground/70 hover:bg-black/10 dark:text-zinc-300 dark:hover:bg-white/15',
                          )}
                        >
                          {isSelected ? (
                            <Check className="size-3.5 stroke-[3]" aria-hidden="true" />
                          ) : (
                            <MoreVertical className="size-3.5" aria-hidden="true" />
                          )}
                        </button>

                        {/* Forwarded Label */}
                        {!msg.isDeleted && msg.isForwarded && (
                          <div
                            className={cn(
                              'mb-0.5 flex items-center gap-1 text-[10.5px] italic opacity-75',
                              isImageMessage && 'px-2 pt-1',
                            )}
                          >
                            <Forward className="size-3" aria-hidden="true" />
                            <span>Forwarded</span>
                          </div>
                        )}

                        {/* Sender Name Header (Name only) */}
                        {!isMine && (
                      <div
                        className={cn(
                          'mb-1 flex flex-wrap items-center gap-1.5 pr-7',
                          isImageMessage && 'px-2 pt-1',
                        )}
                      >
                        <span
                          className={cn(
                            'text-xs font-bold',
                            msg.senderRole === 'principal'
                              ? 'text-amber-600 dark:text-amber-400'
                              : msg.senderRole === 'usthad'
                                ? 'text-emerald-700 dark:text-zinc-200'
                                : 'text-cyan',
                          )}
                        >
                          {msg.senderName}
                        </span>
                      </div>
                    )}

                    {/* Deleted Message State */}
                    {msg.isDeleted ? (
                      <p className="py-1 pr-4 text-xs italic opacity-75">
                        🚫{' '}
                        {msg.deletedById === actor.id || (!msg.deletedById && isMine)
                          ? 'You deleted this message'
                          : 'This message was deleted'}
                      </p>
                    ) : (
                      <>
                        {/* Quoted Reply Box */}
                        {msg.replyTo && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              scrollToMessage(msg.replyTo!.messageId)
                            }}
                            className={cn(
                              'mb-1.5 flex w-full flex-col rounded-xl border-l-4 px-2.5 py-1.5 text-left text-[11px] transition-colors',
                              isMine
                                ? 'border-l-emerald-600 bg-black/[0.06] text-[#081e21] dark:border-l-zinc-400 dark:bg-[#0a0b0e]/70 dark:text-zinc-200'
                                : 'border-l-cyan bg-muted/70 text-foreground dark:bg-[#0a0b0e]/60',
                            )}
                          >
                            <span className="font-bold opacity-90">
                              {msg.replyTo.senderName}
                            </span>
                            <span className="truncate opacity-75">
                              {msg.replyTo.previewText}
                            </span>
                          </button>
                        )}

                        {/* Media Attachment: Clean WhatsApp Voice Note Waveform */}
                        {msg.mediaType === 'voice' && (
                          <div className="flex min-w-[220px] sm:min-w-[250px] items-center gap-2.5 py-1 pr-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleTogglePlayVoice(msg)
                              }}
                              aria-label={
                                playingMessageId === msg.id
                                  ? 'Pause voice message'
                                  : 'Play voice message'
                              }
                              className={cn(
                                'flex size-10 shrink-0 items-center justify-center rounded-full shadow-xs transition-transform active:scale-95',
                                isMine
                                  ? 'bg-emerald-600 text-white dark:bg-[#262a33] dark:text-zinc-100'
                                  : 'bg-emerald-600 text-white dark:bg-[#222630] dark:text-zinc-100',
                              )}
                            >
                              {playingMessageId === msg.id ? (
                                <Pause className="size-4" aria-hidden="true" />
                              ) : (
                                <Play className="ml-0.5 size-4" aria-hidden="true" />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex h-6 items-center gap-0.5">
                                {Array.from({ length: 26 }).map((_, barIdx) => {
                                  const barPct = (barIdx / 26) * 100
                                  const isActiveBar =
                                    playingMessageId === msg.id && playbackProgress >= barPct
                                  const heights = [
                                    35, 65, 50, 85, 45, 95, 60, 75, 40, 90, 55, 80, 65, 95, 50, 70,
                                    85, 45, 60, 90, 50, 70, 55, 40, 65, 50,
                                  ]
                                  return (
                                    <span
                                      key={barIdx}
                                      style={{ height: `${heights[barIdx % heights.length]}%` }}
                                      className={cn(
                                        'w-1 rounded-full transition-colors',
                                        isActiveBar
                                          ? 'bg-emerald-700 dark:bg-zinc-100'
                                          : isMine
                                            ? 'bg-emerald-900/35 dark:bg-zinc-400/45'
                                            : 'bg-foreground/30',
                                      )}
                                    />
                                  )
                                })}
                              </div>
                              <div className="mt-1 flex items-center justify-between gap-2 text-[10px] opacity-80">
                                <span className="font-poppins tabular-nums">
                                  {formatVoiceDuration(msg.mediaDurationSec || 4)}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleCyclePlaybackRate()
                                    }}
                                    className="rounded-full bg-black/10 px-1.5 py-0.2 font-poppins text-[10px] font-semibold dark:bg-white/10"
                                  >
                                    {playbackRate}x
                                  </button>
                                  {isStarred && (
                                    <Star
                                      className="size-3 fill-amber-400 text-amber-500 dark:text-amber-300"
                                      aria-label="Starred message"
                                    />
                                  )}
                                  {isPinned && (
                                    <Pin className="size-3 opacity-80" aria-label="Pinned message" />
                                  )}
                                  <span className="font-poppins tabular-nums">
                                    {formatChatTime(msg.createdAtMs)}
                                  </span>
                                  {isMine && (
                                    <span
                                      title={
                                        isReadByOthers
                                          ? `Seen / Read`
                                          : isDeliveredToOthers
                                            ? 'Delivered'
                                            : 'Sent'
                                      }
                                      className="inline-flex items-center"
                                    >
                                      {isReadByOthers ? (
                                        <CheckCheck
                                          className="size-4 text-[#0095f6] dark:text-[#38bdf8] stroke-[2.6]"
                                          aria-label="Read"
                                        />
                                      ) : isDeliveredToOthers ? (
                                        <CheckCheck
                                          className="size-4 text-zinc-500 dark:text-zinc-300 stroke-[2.2]"
                                          aria-label="Delivered"
                                        />
                                      ) : (
                                        <Check
                                          className="size-3.5 text-zinc-500/80 dark:text-zinc-400 stroke-[2.2]"
                                          aria-label="Sent"
                                        />
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Media Attachment: WhatsApp-Style In-Chat Voice/Video Call Card */}
                        {msg.mediaType === 'call' && (() => {
                          const cMeta = msg.callMeta
                          const callType: CallMediaType = cMeta?.callType === 'video' ? 'video' : 'voice'
                          const cStatus = cMeta?.callStatus || 'ended'
                          const isCallerMe = (cMeta?.callerId || msg.senderId) === actor.id
                          const isMissedOrFailed =
                            cStatus === 'missed' || cStatus === 'declined' || cStatus === 'busy'
                          const durLabel =
                            cStatus === 'missed'
                              ? isCallerMe
                                ? 'No answer'
                                : 'Missed'
                              : cStatus === 'declined'
                                ? 'Declined'
                                : cStatus === 'busy'
                                  ? 'Busy'
                                  : cMeta?.durationSec && cMeta.durationSec > 0
                                    ? formatCallDuration(cMeta.durationSec)
                                    : isCallerMe
                                      ? 'Outgoing'
                                      : 'Incoming'

                          return (
                            <div
                              className={cn(
                                'my-0.5 flex min-w-[215px] items-center justify-between gap-3 rounded-xl border border-border/70 p-2.5 dark:border-[#262a33]',
                                isMine
                                  ? 'bg-black/[0.05] dark:bg-[#0a0b0e]/60'
                                  : 'bg-muted/60 dark:bg-[#0a0b0e]/50',
                              )}
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                <div
                                  className={cn(
                                    'flex size-10 shrink-0 items-center justify-center rounded-full',
                                    isMissedOrFailed
                                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                                  )}
                                >
                                  {isMissedOrFailed ? (
                                    <PhoneMissed className="size-4.5" aria-hidden="true" />
                                  ) : callType === 'video' ? (
                                    <Video className="size-4.5" aria-hidden="true" />
                                  ) : isCallerMe ? (
                                    <PhoneOutgoing className="size-4.5" aria-hidden="true" />
                                  ) : (
                                    <PhoneIncoming className="size-4.5" aria-hidden="true" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-bold">
                                    {callType === 'video' ? 'Video call' : 'Voice call'}
                                  </p>
                                  <p
                                    className={cn(
                                      'text-[11px] font-medium tabular-nums',
                                      isMissedOrFailed
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : 'opacity-80',
                                    )}
                                  >
                                    {durLabel}
                                  </p>
                                </div>
                              </div>

                              {(activeRoom.type === 'direct_usthad' ||
                                activeRoom.type === 'direct_student') &&
                                activeRoom.peerId && (
                                  <button
                                    type="button"
                                    disabled={Boolean(activeCall)}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (isSelectionActive) {
                                        toggleSelectMessage(msg.id)
                                        return
                                      }
                                      void startCall(
                                        {
                                          id: activeRoom.peerId!,
                                          name: activeRoom.title,
                                          role: activeRoom.peerRole || 'student',
                                          subtitle: activeRoom.subtitle,
                                          roomId: activeRoom.roomId,
                                          avatarUrl: activeRoom.avatarUrl,
                                        },
                                        callType,
                                      )
                                    }}
                                    aria-label={`Call back ${activeRoom.title}`}
                                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-45 dark:border dark:border-[#262a33] dark:bg-[#222630] dark:text-emerald-300 dark:hover:bg-zinc-700"
                                  >
                                    {callType === 'video' ? (
                                      <Video className="size-3.5" aria-hidden="true" />
                                    ) : (
                                      <Phone className="size-3.5" aria-hidden="true" />
                                    )}
                                    <span>Call</span>
                                  </button>
                                )}
                            </div>
                          )
                        })()}

                        {/* Media Attachment: PDF Document Card */}
                        {msg.mediaType === 'pdf' && (
                          <div
                            className={cn(
                              'my-1 flex items-center justify-between gap-3 rounded-xl border border-border/70 p-2.5 dark:border-[#262a33]',
                              isMine
                                ? 'bg-black/[0.05] dark:bg-[#0a0b0e]/60'
                                : 'bg-muted/60 dark:bg-[#0a0b0e]/50',
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-600 dark:bg-[#1a1d24] dark:text-red-400">
                                <FileText className="size-4" aria-hidden="true" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-xs font-bold">
                                  {msg.mediaName || 'ICS_Study_Notes.pdf'}
                                </p>
                                <p className="text-[10px] opacity-75">
                                  {msg.mediaSizeLabel || 'PDF Document'}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (isSelectionActive) {
                                  toggleSelectMessage(msg.id)
                                  return
                                }
                                handleOpenOrDownloadPdf(msg)
                              }}
                              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-bold text-white transition-colors hover:bg-emerald-700 dark:border dark:border-[#262a33] dark:bg-[#222630] dark:text-zinc-100 dark:hover:bg-zinc-700"
                            >
                              <Download className="size-3.5" aria-hidden="true" />
                              <span>PDF</span>
                            </button>
                          </div>
                        )}

                        {/* Media Attachment: WhatsApp-Style Borderless Photo with Overlaid Timestamp & HD Badge */}
                        {msg.mediaType === 'image' && msg.mediaUrl && (
                          <div className="relative overflow-hidden rounded-xl border-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (isSelectionActive) {
                                  toggleSelectMessage(msg.id)
                                  return
                                }
                                setLightboxImage({
                                  messageId: msg.id,
                                  url: msg.mediaUrl!,
                                  name: msg.mediaName || 'Campus Photo',
                                  quality: msg.imageQuality,
                                  dimensions: msg.imageDimensions,
                                })
                              }}
                              className="block w-full text-left"
                            >
                              <img
                                src={msg.mediaUrl}
                                alt={msg.mediaName || 'Shared attachment'}
                                referrerPolicy="no-referrer"
                                className="block max-h-72 w-full rounded-xl border-0 object-cover"
                              />
                            </button>

                            {/* WhatsApp HD Badge on Bottom-Left of Photo */}
                            {msg.imageQuality === 'hd' && (
                              <span
                                title={
                                  msg.imageDimensions
                                    ? `HD Photo (${msg.imageDimensions})`
                                    : 'HD Quality Photo'
                                }
                                className="pointer-events-none absolute bottom-1.5 left-2 inline-flex items-center justify-center rounded border border-white/75 bg-black/55 px-1.5 py-0.5 font-poppins text-[9px] font-bold tracking-wider text-white backdrop-blur-[2px]"
                              >
                                HD
                              </span>
                            )}

                            {isImageOnlyWithoutCaption && (
                              <div className="pointer-events-none absolute bottom-1.5 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white backdrop-blur-[2px]">
                                {isStarred && (
                                  <Star
                                    className="size-2.5 fill-amber-300 text-amber-300"
                                    aria-label="Starred message"
                                  />
                                )}
                                {isPinned && (
                                  <Pin className="size-2.5 opacity-90" aria-label="Pinned message" />
                                )}
                                <span className="font-poppins tabular-nums drop-shadow-xs">
                                  {formatChatTime(msg.createdAtMs)}
                                </span>
                                {isMine && !msg.isDeleted && (
                                  <span className="inline-flex items-center">
                                    {isReadByOthers ? (
                                      <CheckCheck
                                        className="size-4 text-[#38bdf8] stroke-[2.6]"
                                        aria-label="Read"
                                      />
                                    ) : isDeliveredToOthers ? (
                                      <CheckCheck
                                        className="size-4 text-white/95 stroke-[2.2]"
                                        aria-label="Delivered"
                                      />
                                    ) : (
                                      <Check
                                        className="size-3.5 text-white/85 stroke-[2.2]"
                                        aria-label="Sent"
                                      />
                                    )}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Message Body Text (Never shown for voice notes or call log cards) */}
                        {msg.mediaType !== 'voice' && msg.mediaType !== 'call' && msg.text && (
                          <p
                            className={cn(
                              'whitespace-pre-wrap break-words pr-1 leading-relaxed',
                              isImageMessage && 'px-2.5 pt-1.5',
                              chatSettings.chatFontSize === 'small'
                                ? 'text-[11.5px] sm:text-xs'
                                : chatSettings.chatFontSize === 'large'
                                  ? 'text-sm sm:text-[15px]'
                                  : 'text-xs sm:text-[13.5px]',
                            )}
                          >
                            {msg.text}
                          </p>
                        )}
                      </>
                    )}

                    {/* Timestamp, Star, Pin & WhatsApp Double Tick for non-voice & non-captionless-image messages */}
                    {msg.mediaType !== 'voice' && !isImageOnlyWithoutCaption && (
                      <div
                        className={cn(
                          'mt-1 flex items-center justify-end gap-1 text-[10px] opacity-85',
                          isImageMessage && 'px-2 pb-0.5',
                        )}
                      >
                        {isStarred && (
                          <Star
                            className="size-3 fill-amber-400 text-amber-500 dark:text-amber-300"
                            aria-label="Starred message"
                          />
                        )}
                        {isPinned && (
                          <Pin className="size-3 opacity-80" aria-label="Pinned message" />
                        )}
                        <span className="font-poppins tabular-nums opacity-80">
                          {formatChatTime(msg.createdAtMs)}
                        </span>
                        {isMine && !msg.isDeleted && (
                          <span
                            title={
                              isReadByOthers
                                ? `Seen / Read`
                                : isDeliveredToOthers
                                  ? 'Delivered'
                                  : 'Sent'
                            }
                            className="inline-flex items-center"
                          >
                            {isReadByOthers ? (
                              <CheckCheck
                                className="size-4 text-[#0095f6] dark:text-[#53bdeb] stroke-[2.6]"
                                aria-label="Read"
                              />
                            ) : isDeliveredToOthers ? (
                              <CheckCheck
                                className="size-4 text-zinc-500 dark:text-zinc-300 stroke-[2.2]"
                                aria-label="Delivered"
                              />
                            ) : (
                              <Check
                                className="size-3.5 text-zinc-500/80 dark:text-zinc-300 stroke-[2.2]"
                                aria-label="Sent"
                              />
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quick Floating Emoji Reaction Bar (Shown when 1 non-deleted message is selected) */}
                  {showSingleReactionPill && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'z-20 mt-1.5 flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 shadow-lg dark:border-[#262a33] dark:bg-[#121418]',
                        isMine ? 'self-end' : 'self-start',
                      )}
                    >
                      {QUICK_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleToggleReaction(msg.id, emoji)}
                          className="rounded-full p-1 text-base transition-transform hover:scale-125 active:scale-95"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Existing Emoji Reactions Row */}
                  {reactionEntries.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {reactionEntries.map(([emoji, reactorIds]) => {
                        const iReacted = reactorIds.includes(actor.id)
                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleToggleReaction(msg.id, emoji)}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
                              iReacted
                                ? 'border-emerald-500/45 bg-emerald-500/15 text-foreground dark:border-[#343946] dark:bg-[#222630] dark:text-zinc-100'
                                : 'border-border bg-card/80 text-muted-foreground hover:text-foreground dark:border-[#262a33] dark:bg-[#121418]',
                            )}
                          >
                            <span>{emoji}</span>
                            <span className="font-poppins text-[10px] tabular-nums">
                              {reactorIds.length}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply Preview Banner or Pending Media Preview */}
          {(replyingTo || pendingAttachment) && (
            <div className="flex items-center justify-between gap-2 border-t border-border bg-card/95 px-3.5 py-2 dark:border-[#262a33] dark:bg-[#121418]">
              {replyingTo ? (
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-emerald-700 dark:text-zinc-300">
                    Replying to {replyingTo.senderName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {replyingTo.previewText}
                  </p>
                </div>
              ) : null}

              {pendingAttachment ? (
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {pendingAttachment.mediaType === 'image' ? (
                      <img
                        src={pendingAttachment.mediaUrl}
                        alt={pendingAttachment.mediaName}
                        referrerPolicy="no-referrer"
                        className="size-9 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground dark:border-[#262a33] dark:bg-[#1a1d24]">
                        <FileText className="size-4" aria-hidden="true" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-foreground">
                        {pendingAttachment.mediaName}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {pendingAttachment.mediaSizeLabel}
                        {pendingAttachment.imageDimensions
                          ? ` • ${pendingAttachment.imageDimensions}`
                          : ''}{' '}
                        • Ready to send
                      </p>
                    </div>
                  </div>

                  {pendingAttachment.mediaType === 'image' && (
                    <div className="flex shrink-0 items-center gap-1 rounded-xl border border-border bg-background/80 p-0.5 dark:border-[#262a33] dark:bg-[#0a0b0e]">
                      <button
                        type="button"
                        onClick={() => handleSelectPhotoQuality('standard')}
                        className={cn(
                          'rounded-lg px-2 py-1 text-[10px] font-bold transition-colors whitespace-nowrap',
                          pendingAttachment.imageQuality !== 'hd'
                            ? 'bg-emerald-600 text-white dark:bg-[#222630] dark:text-zinc-100'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        Standard
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectPhotoQuality('hd')}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition-colors whitespace-nowrap',
                          pendingAttachment.imageQuality === 'hd'
                            ? 'bg-emerald-600 text-white dark:bg-[#25d366] dark:text-[#0a0b0e]'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <span>HD</span>
                        {pendingAttachment.imageQuality === 'hd' && (
                          <Check className="size-3" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setReplyingTo(null)
                  setPendingAttachment(null)
                }}
                aria-label="Clear preview"
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Bottom Composer Bar OR Locked Group Banner */}
          {activeRoomMeta.onlyAdminsCanPost && !actor.isStaff ? (
            <div className="flex items-center justify-center gap-2 border-t border-border bg-card px-4 py-3.5 text-center text-xs font-semibold text-muted-foreground dark:border-[#262a33] dark:bg-[#121418]">
              <Lock className="size-4 shrink-0" aria-hidden="true" />
              <span>
                Only Usthads and Principal can send messages in this group
              </span>
            </div>
          ) : (
            <div className="relative border-t border-border bg-card/95 p-2.5 sm:px-4 sm:py-3 dark:border-[#262a33] dark:bg-[#121418]">
              {/* Hidden file inputs */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelected(e, 'image')}
                className="hidden"
              />
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => handleFileSelected(e, 'pdf')}
                className="hidden"
              />

              {/* Attachment Menu Popover */}
              {showAttachMenu && (
                <div
                  ref={attachMenuRef}
                  className="absolute bottom-16 left-2.5 sm:left-4 z-30 flex flex-col gap-1 rounded-2xl border border-border bg-card p-2 shadow-xl w-64 dark:border-[#262a33] dark:bg-[#121418]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false)
                      pdfInputRef.current?.click()
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-foreground hover:bg-muted"
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg bg-red-500/15 text-red-500">
                      <FileText className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p>Upload PDF Note / Kitab</p>
                      <p className="text-[10px] font-normal text-muted-foreground">
                        Share syllabus or study PDF
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false)
                      imageInputRef.current?.click()
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-foreground hover:bg-muted"
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg bg-cyan/15 text-cyan">
                      <ImageIcon className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p>Share Photo / Kitab Page</p>
                      <p className="text-[10px] font-normal text-muted-foreground">
                        JPG, PNG, or notebook photo
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false)
                      handleQuickShareSampleKitabPdf()
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-foreground hover:bg-muted"
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted text-foreground dark:border-[#262a33] dark:bg-[#1a1d24]">
                      <BookOpen className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p>Quick-Share Kitab Summary PDF</p>
                      <p className="text-[10px] font-normal text-muted-foreground">
                        Send instant sample Kitab PDF
                      </p>
                    </div>
                  </button>
                </div>
              )}

              {isRecordingVoice ? (
                <div className="flex items-center justify-between gap-2 sm:gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full bg-red-500 animate-pulse" />
                    <span className="truncate font-poppins text-xs font-bold tabular-nums text-red-500">
                      Recording • {formatVoiceDuration(recordingSeconds)}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={cancelVoiceRecording}
                      className="inline-flex h-9 items-center gap-1 rounded-xl border border-border bg-background px-2.5 sm:px-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      <span>Cancel</span>
                    </button>
                    <button
                      type="button"
                      onClick={finishAndSendVoiceRecording}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 dark:border dark:border-[#343946] dark:bg-[#222630] dark:text-zinc-100"
                    >
                      <Send className="size-3.5" aria-hidden="true" />
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleFormSubmit}
                  className="flex min-w-0 w-full items-center gap-1.5 sm:gap-2"
                >
                  <button
                    ref={attachButtonRef}
                    type="button"
                    onClick={() => {
                      setSelectedMessageIds([])
                      setShowSelectionMoreMenu(false)
                      setShowSettingsModal(false)
                      setShowNewChatModal(false)
                      setShowAttachMenu((prev) => !prev)
                    }}
                    aria-label="Attach PDF or Photo"
                    className={cn(
                      'flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-2xl border transition-colors',
                      showAttachMenu
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:border-[#343946] dark:bg-[#222630] dark:text-zinc-100'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground dark:border-[#262a33] dark:bg-[#0a0b0e]',
                    )}
                  >
                    <Paperclip className="size-4" aria-hidden="true" />
                  </button>

                  <input
                    type="text"
                    value={inputText}
                    onFocus={() => {
                      setShowAttachMenu(false)
                      setSelectedMessageIds([])
                      setShowSelectionMoreMenu(false)
                    }}
                    onClick={() => {
                      setShowAttachMenu(false)
                      setSelectedMessageIds([])
                      setShowSelectionMoreMenu(false)
                    }}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder={
                      pendingAttachment
                        ? 'Add a caption....'
                        : 'type a message....'
                    }
                    className="h-10 sm:h-11 min-w-0 flex-1 rounded-2xl border border-input bg-background px-3 sm:px-3.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-emerald-500 dark:focus:border-zinc-500 focus:outline-none sm:text-sm dark:border-[#262a33] dark:bg-[#0a0b0e]"
                  />

                  <button
                    type="button"
                    onClick={startVoiceRecording}
                    title="Record a Voice Message (Audio)"
                    aria-label="Record voice message"
                    className="flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground transition-colors hover:border-emerald-500 hover:text-emerald-600 dark:border-[#262a33] dark:bg-[#0a0b0e] dark:hover:border-zinc-500 dark:hover:text-foreground"
                  >
                    <Mic className="size-4" aria-hidden="true" />
                  </button>

                  <button
                    type="submit"
                    onClick={() => {
                      setShowAttachMenu(false)
                      setSelectedMessageIds([])
                      setShowSelectionMoreMenu(false)
                    }}
                    disabled={!inputText.trim() && !pendingAttachment}
                    aria-label="Send message"
                    className="flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm transition-all hover:bg-emerald-700 disabled:opacity-40 dark:border dark:border-[#343946] dark:bg-[#222630] dark:text-zinc-100 dark:hover:bg-[#2a2f3b]"
                  >
                    <Send className="size-4" aria-hidden="true" />
                  </button>
                </form>
              )}
            </div>
          )}
            </>
          )}
        </div>
      </div>

      {/* NEW CHAT DIRECTORY MODAL (Quickly Start Direct Chat with Any Usthad or Student Across All Classes) */}
      {showNewChatModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setShowNewChatModal(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl dark:border-[#262a33] dark:bg-[#121418]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4 dark:border-[#262a33]">
              <div>
                <h3 className="font-display text-base font-bold text-foreground">
                  Start Direct Chat (Usthads &amp; Students)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Select any Usthad or Student from any class to open a 1-to-1 chat
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="border-b border-border/70 px-4 py-2.5 dark:border-[#262a33]">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={newChatSearchQuery}
                  onChange={(e) => setNewChatSearchQuery(e.target.value)}
                  placeholder="Search any Usthad or Student by name or class..."
                  className="h-9 w-full rounded-xl border border-input bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none dark:border-[#262a33] dark:bg-[#0a0b0e]"
                />
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {(() => {
                const nq = newChatSearchQuery.trim().toLowerCase()
                const matchingUsthads = OFFICIAL_CLASS_USTHADS.filter(
                  (u) =>
                    u.id !== actor.id &&
                    (!nq ||
                      u.name.toLowerCase().includes(nq) ||
                      (u.designation || '').toLowerCase().includes(nq) ||
                      u.className.toLowerCase().includes(nq)),
                )
                const matchingStudents = students.filter(
                  (s) =>
                    s.id !== actor.id &&
                    (nq
                      ? s.name.toLowerCase().includes(nq) ||
                        s.className.toLowerCase().includes(nq) ||
                        s.admissionNo.toLowerCase().includes(nq)
                      : studentBatchFilter === 'ALL' || s.className === studentBatchFilter),
                )

                return (
                  <>
                    {matchingUsthads.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Teaching &amp; Class Usthads ({matchingUsthads.length})
                        </p>
                        <div className="grid gap-1.5">
                          {matchingUsthads.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setSelectedRoomId(makeDirectRoomId(actor.id, u.id))
                                setMobileShowChatPane(true)
                                setShowNewChatModal(false)
                                setNewChatSearchQuery('')
                              }}
                              className="flex items-center justify-between rounded-2xl border border-border bg-background/70 px-3.5 py-2.5 text-left transition-colors hover:bg-muted dark:border-[#262a33] dark:bg-[#0a0b0e]"
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                {u.avatarUrl ? (
                                  <img
                                    src={u.avatarUrl}
                                    alt={u.name}
                                    className="size-8 shrink-0 rounded-full border border-lime/40 object-cover object-top"
                                  />
                                ) : null}
                                <p className="truncate text-xs font-bold text-foreground">
                                  {u.name}
                                </p>
                              </div>
                              <span className="rounded-lg border border-border bg-muted px-2 py-1 text-[10px] font-bold text-foreground dark:border-[#262a33] dark:bg-[#1a1d24] dark:text-zinc-100">
                                Message
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Students ({matchingStudents.length})
                        </p>
                        <ThemeSelect
                          value={studentBatchFilter}
                          onChange={(e) => setStudentBatchFilter(e.target.value)}
                          className="h-7 rounded-lg border border-input bg-background px-2 text-[11px] font-semibold dark:border-[#262a33] dark:bg-[#0a0b0e]"
                        >
                          <option value={actor.className}>My Class ({actor.className})</option>
                          <option value="ALL">All Classes ({students.length})</option>
                          {ACADEMY_CLASSES.map((c) => (
                            <option key={c.id} value={c.className}>
                              Class {c.className}
                            </option>
                          ))}
                        </ThemeSelect>
                      </div>
                      <div className="grid gap-1.5">
                        {matchingStudents.map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => {
                              setSelectedRoomId(makeDirectRoomId(actor.id, st.id))
                              setMobileShowChatPane(true)
                              setShowNewChatModal(false)
                              setNewChatSearchQuery('')
                            }}
                            className="flex items-center justify-between rounded-2xl border border-border bg-background/70 px-3.5 py-2.5 text-left transition-colors hover:bg-muted dark:border-[#262a33] dark:bg-[#0a0b0e]"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              {st.avatarUrl ? (
                                <img
                                  src={st.avatarUrl}
                                  alt={st.name}
                                  className="size-8 shrink-0 rounded-full border border-lime/40 object-cover object-top"
                                />
                              ) : (
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-cyan/15 font-poppins text-[11px] font-bold text-cyan">
                                  {st.firstName.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-xs font-bold text-foreground">
                                  {st.name}
                                </p>
                                <p className="truncate text-[10px] text-muted-foreground">
                                  Class {st.className} • {st.admissionNo}
                                </p>
                              </div>
                            </div>
                            <span className="rounded-lg border border-border bg-muted px-2 py-1 text-[10px] font-bold text-foreground dark:border-[#262a33] dark:bg-[#1a1d24] dark:text-zinc-100">
                              Chat
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP-STYLE CHAT SETTINGS MODAL */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs"
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl dark:border-[#262a33] dark:bg-[#121418]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4 dark:border-[#262a33]">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:border-[#262a33] dark:bg-[#1a1d24] dark:text-zinc-100">
                  <Settings className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-poppins text-base font-bold text-foreground">
                    Chat Settings
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Privacy, display, font size &amp; chat history controls
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                aria-label="Close Chat Settings"
                className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            {/* Settings Content */}
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {/* 1. Privacy Settings */}
              <div className="space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  1. Privacy &amp; Presence
                </p>

                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border bg-background/70 p-3.5 transition-colors hover:bg-muted/40 dark:border-[#262a33] dark:bg-[#0a0b0e]">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">
                      Show Online &amp; Last Seen Status
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Display &ldquo;online&rdquo; in the chat header only while actively using the app
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={chatSettings.showOnlineStatus}
                    onChange={(e) => updateChatSetting('showOnlineStatus', e.target.checked)}
                    className="size-4 shrink-0 accent-emerald-600"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border bg-background/70 p-3.5 transition-colors hover:bg-muted/40 dark:border-[#262a33] dark:bg-[#0a0b0e]">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">
                      Read Receipts / Blue Ticks
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Show blue double ticks when messages are opened and read
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={chatSettings.sendReadReceipts}
                    onChange={(e) => updateChatSetting('sendReadReceipts', e.target.checked)}
                    className="size-4 shrink-0 accent-emerald-600"
                  />
                </label>
              </div>

              {/* 2. Chat Appearance & Font Size */}
              <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  2. Appearance &amp; Font
                </p>

                <div className="rounded-2xl border border-border bg-background/70 p-3.5 dark:border-[#262a33] dark:bg-[#0a0b0e]">
                  <p className="text-xs font-bold text-foreground">
                    Message Font Size
                  </p>
                  <div className="mt-2.5 grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'small', label: 'Small' },
                        { id: 'medium', label: 'Medium' },
                        { id: 'large', label: 'Large' },
                      ] as const
                    ).map((opt) => {
                      const active = chatSettings.chatFontSize === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updateChatSetting('chatFontSize', opt.id)}
                          className={cn(
                            'rounded-xl border px-2.5 py-2 text-xs font-semibold transition-colors',
                            active
                              ? 'border-emerald-600 bg-emerald-600 text-white dark:border-[#343946] dark:bg-[#222630] dark:text-zinc-100'
                              : 'border-border bg-card text-muted-foreground hover:text-foreground dark:border-[#262a33] dark:bg-[#14171d]',
                          )}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background/70 p-3.5 dark:border-[#262a33] dark:bg-[#0a0b0e]">
                  <p className="text-xs font-bold text-foreground">
                    Chat Background Theme
                  </p>
                  <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(
                      [
                        { id: 'default', label: 'Default Clean' },
                        { id: 'pitch_dark', label: 'Pitch Dark / Slate' },
                        { id: 'soft_mint', label: 'Soft Mint' },
                        { id: 'warm_slate', label: 'Warm Paper' },
                      ] as const
                    ).map((opt) => {
                      const active = chatSettings.chatWallpaper === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updateChatSetting('chatWallpaper', opt.id)}
                          className={cn(
                            'rounded-xl border px-2.5 py-2 text-[11px] font-semibold transition-colors',
                            active
                              ? 'border-emerald-600 bg-emerald-600 text-white dark:border-[#343946] dark:bg-[#222630] dark:text-zinc-100'
                              : 'border-border bg-card text-muted-foreground hover:text-foreground dark:border-[#262a33] dark:bg-[#14171d]',
                          )}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* 3. Keyboard & Sound Settings */}
              <div className="space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  3. Keyboard &amp; Sound
                </p>

                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border bg-background/70 p-3.5 transition-colors hover:bg-muted/40 dark:border-[#262a33] dark:bg-[#0a0b0e]">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">
                      Enter Key Sends Message
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Pressing Enter on the keyboard immediately sends the message
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={chatSettings.enterToSend}
                    onChange={(e) => updateChatSetting('enterToSend', e.target.checked)}
                    className="size-4 shrink-0 accent-emerald-600"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border bg-background/70 p-3.5 transition-colors hover:bg-muted/40 dark:border-[#262a33] dark:bg-[#0a0b0e]">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Volume2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground">
                        Message Sound Effects
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Play a subtle notification sound when sending messages
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={chatSettings.soundEffects}
                    onChange={(e) => updateChatSetting('soundEffects', e.target.checked)}
                    className="size-4 shrink-0 accent-emerald-600"
                  />
                </label>

                <div className="rounded-2xl border border-border bg-background/70 p-3.5 dark:border-[#262a33] dark:bg-[#0a0b0e]">
                  <p className="text-xs font-bold text-foreground">
                    Default Photo Upload Quality
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Choose default quality when sharing photos (you can also switch between Standard and HD on every photo)
                  </p>
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: 'standard', label: 'Standard quality' },
                        { id: 'hd', label: 'HD quality' },
                      ] as const
                    ).map((opt) => {
                      const active = chatSettings.defaultImageQuality === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updateChatSetting('defaultImageQuality', opt.id)}
                          className={cn(
                            'rounded-xl border px-3 py-2 text-xs font-semibold transition-colors',
                            active
                              ? 'border-emerald-600 bg-emerald-600 text-white dark:border-[#343946] dark:bg-[#222630] dark:text-zinc-100'
                              : 'border-border bg-card text-muted-foreground hover:text-foreground dark:border-[#262a33] dark:bg-[#14171d]',
                          )}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* 4. Chat Storage & Clear Controls */}
              <div className="space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  4. Chat History Management
                </p>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMessagesByRoom((prev) => ({
                        ...prev,
                        [activeRoom.roomId]: [],
                      }))
                      setSettingsToast(`Cleared messages in "${activeRoom.title}".`)
                      window.setTimeout(() => setSettingsToast(null), 3500)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted dark:border-[#262a33] dark:bg-[#0a0b0e]"
                  >
                    <Trash2 className="size-3.5 text-amber-500" aria-hidden="true" />
                    <span>Clear Current Chat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMessagesByRoom({})
                      try {
                        window.localStorage.removeItem(LOCAL_CHAT_MESSAGES_KEY)
                      } catch {
                        // Ignore
                      }
                      setSettingsToast('All local chat history has been cleared.')
                      window.setTimeout(() => setSettingsToast(null), 3500)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/20"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    <span>Clear All Chats</span>
                  </button>
                </div>

                {settingsToast && (
                  <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:border-[#343946] dark:bg-[#1a1d24] dark:text-zinc-200">
                    {settingsToast}
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end border-t border-border bg-background/60 px-5 py-3 dark:border-[#262a33] dark:bg-[#0a0b0e]">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700 dark:border dark:border-[#343946] dark:bg-[#222630] dark:text-zinc-100 dark:hover:bg-[#2a2f3b]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP-STYLE DELETE MESSAGE DIALOG (Single & Multi-Select) */}
      {deleteModalMessages.length > 0 && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs"
          onClick={() => setDeleteModalMessages([])}
        >
          <div
            className="w-full max-w-[320px] overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-2xl dark:border-[#262a33] dark:bg-[#181b22]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-foreground">
              {deleteModalMessages.length === 1
                ? 'Delete message?'
                : `Delete ${deleteModalMessages.length} messages?`}
            </h3>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {deleteModalMessages.every((m) => m.isDeleted)
                ? 'Remove deleted messages from your chat screen.'
                : 'You can delete selected messages for everyone in this chat or only for yourself.'}
            </p>

            <div className="mt-5 flex flex-col items-end gap-1">
              {deleteModalMessages.some((m) => !m.isDeleted) &&
                deleteModalMessages
                  .filter((m) => !m.isDeleted)
                  .every((m) => m.senderId === actor.id || actor.isStaff) && (
                  <button
                    type="button"
                    onClick={() =>
                      handleDeleteForEveryone(
                        deleteModalMessages.filter((m) => !m.isDeleted).map((m) => m.id),
                      )
                    }
                    className="w-full rounded-xl px-3.5 py-2.5 text-right text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-[#25d366]"
                  >
                    Delete for everyone
                  </button>
                )}

              <button
                type="button"
                onClick={() => handleDeleteForMe(deleteModalMessages.map((m) => m.id))}
                className="w-full rounded-xl px-3.5 py-2.5 text-right text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-[#25d366]"
              >
                Delete for me
              </button>

              <button
                type="button"
                onClick={() => setDeleteModalMessages([])}
                className="w-full rounded-xl px-3.5 py-2.5 text-right text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-[#25d366]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP-STYLE FORWARD TO MODAL (Single & Multi-Message, Multi-Recipient) */}
      {forwardMessageIds.length > 0 && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs"
          onClick={() => {
            setForwardMessageIds([])
            setForwardTargetRoomIds([])
          }}
        >
          <div
            className="flex max-h-[86vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl dark:border-[#262a33] dark:bg-[#121418]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4 dark:border-[#262a33]">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:bg-[#1a1d24] dark:text-[#25d366]">
                  <Forward className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-poppins text-base font-bold text-foreground">
                    Forward to...
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {forwardMessageIds.length === 1
                      ? 'Forwarding 1 message'
                      : `Forwarding ${forwardMessageIds.length} messages`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setForwardMessageIds([])
                  setForwardTargetRoomIds([])
                }}
                aria-label="Close forward dialog"
                className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col gap-2 border-b border-border/70 px-4 py-3 dark:border-[#262a33]">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={forwardSearchQuery}
                  onChange={(e) => setForwardSearchQuery(e.target.value)}
                  placeholder="Search groups, teachers, or students..."
                  className="h-9 w-full rounded-xl border border-input bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none dark:border-[#262a33] dark:bg-[#0a0b0e]"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Filter students:
                </span>
                <ThemeSelect
                  value={forwardBatchFilter}
                  onChange={(e) => setForwardBatchFilter(e.target.value)}
                  className="h-7 flex-1 rounded-lg border border-input bg-background px-2 text-[11px] font-semibold dark:border-[#262a33] dark:bg-[#0a0b0e]"
                >
                  <option value="ALL">All Classes &amp; Chats</option>
                  <option value={actor.className}>My Class ({actor.className})</option>
                  {ACADEMY_CLASSES.map((c) => (
                    <option key={c.id} value={c.className}>
                      Class {c.className}
                    </option>
                  ))}
                </ThemeSelect>
              </div>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto p-3">
              {allForwardRooms
                .filter((r) => {
                  const meta = roomsMeta[r.roomId]
                  if (meta?.onlyAdminsCanPost && !actor.isStaff) return false
                  const fq = forwardSearchQuery.trim().toLowerCase()
                  if (fq) {
                    return (
                      r.title.toLowerCase().includes(fq) ||
                      r.subtitle.toLowerCase().includes(fq) ||
                      (r.batchName || '').toLowerCase().includes(fq)
                    )
                  }
                  if (r.type === 'direct_student' && forwardBatchFilter !== 'ALL') {
                    return r.batchName === forwardBatchFilter
                  }
                  return true
                })
                .map((room) => {
                  const checked = forwardTargetRoomIds.includes(room.roomId)
                  return (
                    <button
                      key={room.roomId}
                      type="button"
                      onClick={() =>
                        setForwardTargetRoomIds((prev) =>
                          prev.includes(room.roomId)
                            ? prev.filter((id) => id !== room.roomId)
                            : [...prev, room.roomId],
                        )
                      }
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors',
                        checked
                          ? 'border-emerald-500/60 bg-emerald-500/12 dark:border-[#25d366]/60 dark:bg-[#25d366]/10'
                          : 'border-transparent hover:bg-muted/60 dark:hover:bg-white/5',
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        {room.avatarUrl ? (
                          <img
                            src={room.avatarUrl}
                            alt={room.title}
                            className="size-9 shrink-0 rounded-full border border-border object-cover object-top"
                          />
                        ) : (
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-poppins text-xs font-bold text-emerald-700 dark:bg-[#1a1d24] dark:text-zinc-200">
                            {room.type === 'batch_group' ? (
                              <Users className="size-4" aria-hidden="true" />
                            ) : room.type === 'staff_group' ? (
                              <Crown className="size-4" aria-hidden="true" />
                            ) : (
                              room.avatarText
                            )}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-foreground">
                            {room.title}
                          </p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {room.subtitle}
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                          checked
                            ? 'border-emerald-600 bg-emerald-600 text-white dark:border-[#25d366] dark:bg-[#25d366] dark:text-[#0a0b0e]'
                            : 'border-muted-foreground/40',
                        )}
                      >
                        {checked && <Check className="size-3 stroke-[3]" aria-hidden="true" />}
                      </span>
                    </button>
                  )
                })}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border bg-background/70 px-4 py-3 dark:border-[#262a33] dark:bg-[#0a0b0e]">
              <p className="min-w-0 truncate text-xs text-muted-foreground">
                {forwardTargetRoomIds.length === 0
                  ? 'Select one or more chats'
                  : allForwardRooms
                      .filter((r) => forwardTargetRoomIds.includes(r.roomId))
                      .map((r) => r.title)
                      .join(', ')}
              </p>
              <button
                type="button"
                disabled={forwardTargetRoomIds.length === 0}
                onClick={handleConfirmForwardMessages}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-40 dark:bg-[#25d366] dark:text-[#0a0b0e] dark:hover:bg-[#1fc75d]"
              >
                <Send className="size-3.5" aria-hidden="true" />
                <span>Forward ({forwardTargetRoomIds.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STARRED MESSAGES VIEWER MODAL */}
      {showStarredModal && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs"
          onClick={() => setShowStarredModal(false)}
        >
          <div
            className="flex max-h-[86vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl dark:border-[#262a33] dark:bg-[#121418]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4 dark:border-[#262a33]">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
                  <Star className="size-4 fill-amber-400" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-poppins text-base font-bold text-foreground">
                    Starred Messages
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {allStarredItems.length === 0
                      ? 'Tap and hold any message, then press ★ to save it here'
                      : `${allStarredItems.length} saved ${allStarredItems.length === 1 ? 'message' : 'messages'}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStarredModal(false)}
                aria-label="Close Starred Messages"
                className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
              {allStarredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Star className="size-10 text-muted-foreground/35" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold text-foreground">
                    No starred messages yet
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Select any message in a group or direct chat and tap the Star icon in the top bar to bookmark it for quick reference.
                  </p>
                </div>
              ) : (
                allStarredItems.map(({ msg, roomTitle, roomId }) => (
                  <div
                    key={`${roomId}:${msg.id}`}
                    className="rounded-2xl border border-border bg-background/70 p-3.5 transition-colors hover:bg-muted/40 dark:border-[#262a33] dark:bg-[#0a0b0e]"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate font-bold text-emerald-700 dark:text-emerald-400">
                        {msg.senderId === actor.id ? 'You' : msg.senderName} • {roomTitle}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">
                          {formatReceiptTimestamp(msg.createdAtMs)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleStarMessages([msg], roomId)}
                          title="Remove star"
                          aria-label="Unstar message"
                          className="rounded-lg p-1 text-amber-500 hover:bg-amber-500/15"
                        >
                          <Star className="size-3.5 fill-amber-400" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowStarredModal(false)
                        setSelectedRoomId(roomId)
                        setMobileShowChatPane(true)
                        window.setTimeout(() => scrollToMessage(msg.id), 250)
                      }}
                      className="block w-full text-left"
                    >
                      {msg.mediaType === 'image' && msg.mediaUrl && (
                        <img
                          src={msg.mediaUrl}
                          alt={msg.mediaName || 'Photo'}
                          className="mb-1.5 max-h-36 rounded-xl object-cover"
                        />
                      )}
                      {msg.mediaType === 'pdf' && (
                        <p className="text-xs font-semibold text-foreground">
                          📄 {msg.mediaName || 'PDF Document'}
                        </p>
                      )}
                      {msg.mediaType === 'voice' && (
                        <p className="text-xs font-semibold text-foreground">
                          🎤 Voice Note ({formatVoiceDuration(msg.mediaDurationSec || 4)})
                        </p>
                      )}
                      {msg.text && (
                        <p className="line-clamp-4 whitespace-pre-wrap break-words text-xs text-foreground">
                          {msg.text}
                        </p>
                      )}
                      <span className="mt-1.5 inline-block text-[10px] font-semibold text-emerald-600 dark:text-[#25d366]">
                        Jump to message →
                      </span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP-STYLE PHOTO PREVIEW & HD / STANDARD QUALITY SELECTOR MODAL */}
      {pendingAttachment && pendingAttachment.mediaType === 'image' && (
        <div
          className="fixed inset-0 z-[78] flex flex-col justify-between bg-[#0b1014] text-white pt-[max(var(--safe-top),2.75rem)] pb-[max(env(safe-area-inset-bottom,0px),0.75rem)] sm:pt-3"
          onClick={() => setShowPhotoQualitySheet(false)}
        >
          {/* Top Bar: Placed cleanly below phone status bar (clock/battery) */}
          <div
            className="z-20 flex shrink-0 items-center justify-between border-b border-white/10 bg-[#11171d] px-4 py-3 shadow-md sm:px-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setPendingAttachment(null)
                setShowPhotoQualitySheet(false)
              }}
              aria-label="Cancel photo upload"
              className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <X className="size-5" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-2">
              {/* Direct Standard / HD Segmented Selector + Sheet Trigger */}
              <div className="flex items-center rounded-full border border-white/15 bg-[#1b2229] p-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => handleSelectPhotoQuality('standard')}
                  className={cn(
                    'flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-all',
                    pendingAttachment.imageQuality !== 'hd'
                      ? 'bg-[#25d366] text-[#0a0b0e] shadow-xs'
                      : 'text-zinc-300 hover:text-white',
                  )}
                >
                  <span>Standard</span>
                  {pendingAttachment.imageQuality !== 'hd' && (
                    <Check className="size-3.5 stroke-[3]" aria-hidden="true" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPhotoQuality('hd')}
                  className={cn(
                    'flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-all',
                    pendingAttachment.imageQuality === 'hd'
                      ? 'bg-[#25d366] text-[#0a0b0e] shadow-xs'
                      : 'text-zinc-300 hover:text-white',
                  )}
                >
                  <span
                    className={cn(
                      'rounded border px-1 py-0.2 font-poppins text-[9px] font-extrabold leading-tight',
                      pendingAttachment.imageQuality === 'hd'
                        ? 'border-[#0a0b0e] text-[#0a0b0e]'
                        : 'border-current text-current',
                    )}
                  >
                    HD
                  </span>
                  <span>HD Quality</span>
                  {pendingAttachment.imageQuality === 'hd' && (
                    <Check className="size-3.5 stroke-[3]" aria-hidden="true" />
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowPhotoQualitySheet((prev) => !prev)}
                aria-label="Open photo quality details"
                className="hidden h-9 items-center rounded-full border border-white/20 bg-white/10 px-3 text-[11px] font-semibold text-zinc-200 transition-colors hover:bg-white/20 sm:inline-flex"
              >
                Details
              </button>
            </div>
          </div>

          {/* Center Photo Preview Area + Toast + WhatsApp Photo Quality Bottom Sheet */}
          <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-2">
            {photoQualityToast && (
              <div className="pointer-events-none absolute top-3 z-20 rounded-full border border-white/15 bg-black/85 px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
                {photoQualityToast}
              </div>
            )}

            <img
              src={pendingAttachment.mediaUrl}
              alt={pendingAttachment.mediaName}
              referrerPolicy="no-referrer"
              className="max-h-[58vh] max-w-full rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            <p className="mt-2.5 text-[11px] text-white/75 tabular-nums">
              {pendingAttachment.imageQuality === 'hd' ? 'HD quality' : 'Standard quality'} •{' '}
              {pendingAttachment.imageDimensions || '1280 × 960'} •{' '}
              {pendingAttachment.mediaSizeLabel.split('•')[0].trim()}
            </p>

            {/* WhatsApp "Photo quality" Selector Dialog / Sheet */}
            {showPhotoQualitySheet && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-3 z-30 w-full max-w-sm rounded-3xl border border-[#262a33] bg-[#181b22] p-5 text-white shadow-2xl"
              >
                <h4 className="text-sm font-bold text-white">Photo quality</h4>
                <p className="mt-1 text-xs text-zinc-400">
                  HD photos are clearer, while standard photos use less storage and are faster to send.
                </p>

                <div className="mt-4 flex flex-col gap-2">
                  {/* Option 1: Standard quality */}
                  <button
                    type="button"
                    onClick={() => handleSelectPhotoQuality('standard')}
                    className={cn(
                      'flex w-full items-center justify-between rounded-2xl border px-3.5 py-3 text-left transition-colors',
                      pendingAttachment.imageQuality !== 'hd'
                        ? 'border-[#25d366]/60 bg-[#25d366]/10'
                        : 'border-[#262a33] bg-[#121418] hover:bg-white/5',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'flex size-5 items-center justify-center rounded-full border-2',
                          pendingAttachment.imageQuality !== 'hd'
                            ? 'border-[#25d366]'
                            : 'border-zinc-500',
                        )}
                      >
                        {pendingAttachment.imageQuality !== 'hd' && (
                          <span className="size-2.5 rounded-full bg-[#25d366]" />
                        )}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-white">Standard quality</p>
                        <p className="text-[11px] text-zinc-400 tabular-nums">
                          {pendingAttachment.standardVariant?.dimensions || '1280 × 960'} •{' '}
                          {pendingAttachment.standardVariant?.sizeLabel || 'Fast send'}
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Option 2: HD quality */}
                  <button
                    type="button"
                    onClick={() => handleSelectPhotoQuality('hd')}
                    className={cn(
                      'flex w-full items-center justify-between rounded-2xl border px-3.5 py-3 text-left transition-colors',
                      pendingAttachment.imageQuality === 'hd'
                        ? 'border-[#25d366]/60 bg-[#25d366]/10'
                        : 'border-[#262a33] bg-[#121418] hover:bg-white/5',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'flex size-5 items-center justify-center rounded-full border-2',
                          pendingAttachment.imageQuality === 'hd'
                            ? 'border-[#25d366]'
                            : 'border-zinc-500',
                        )}
                      >
                        {pendingAttachment.imageQuality === 'hd' && (
                          <span className="size-2.5 rounded-full bg-[#25d366]" />
                        )}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-white">HD quality</p>
                          <span className="rounded border border-[#25d366] px-1 py-0.2 font-poppins text-[9px] font-bold text-[#25d366]">
                            HD
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 tabular-nums">
                          {pendingAttachment.hdVariant?.dimensions ||
                            pendingAttachment.imageDimensions ||
                            '2560 × 1920'}{' '}
                          • {pendingAttachment.hdVariant?.sizeLabel || 'High definition'}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Caption & Send Bar (WhatsApp Photo Composer) */}
          <form
            onSubmit={handleFormSubmit}
            onClick={(e) => e.stopPropagation()}
            className="mx-auto flex w-full max-w-2xl flex-col gap-2.5 px-4 pb-3 pt-2"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Add a caption..."
                className="h-11 flex-1 rounded-full border border-white/15 bg-[#1a1f26] px-4 text-xs text-white placeholder:text-zinc-400 focus:border-[#25d366] focus:outline-none sm:text-sm"
              />
              <button
                type="submit"
                aria-label="Send photo"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#25d366] text-[#0a0b0e] shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                <Send className="size-4.5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex items-center justify-between px-1 text-[11px] text-zinc-400">
              <span className="truncate">
                To: <strong className="text-zinc-200">{activeRoom.title}</strong>
              </span>
              <button
                type="button"
                onClick={() => setShowPhotoQualitySheet((prev) => !prev)}
                className="font-semibold text-[#25d366] hover:underline"
              >
                {pendingAttachment.imageQuality === 'hd'
                  ? 'Sending in HD quality (Change)'
                  : 'Sending in Standard quality (Switch to HD)'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PHOTO LIGHTBOX MODAL */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/90 px-4 pt-[max(var(--safe-top),2.75rem)] pb-[max(env(safe-area-inset-bottom,0px),1rem)]"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#262a33] bg-[#121418] p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5 text-xs text-white">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-semibold">{lightboxImage.name}</span>
                {lightboxImage.quality === 'hd' && (
                  <span className="rounded border border-white/80 bg-white/10 px-1.5 py-0.5 font-poppins text-[9px] font-bold tracking-wider text-white">
                    HD
                  </span>
                )}
                {lightboxImage.dimensions && (
                  <span className="text-[11px] text-zinc-400 tabular-nums">
                    ({lightboxImage.dimensions})
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {lightboxImage.messageId && (
                  <button
                    type="button"
                    onClick={() => {
                      const found = activeMessages.find((m) => m.id === lightboxImage.messageId)
                      if (found) {
                        setLightboxImage(null)
                        setDeleteModalMessages([found])
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/20 px-2.5 py-1.5 text-[11px] font-bold text-red-300 hover:bg-red-500/30"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    <span>Delete</span>
                  </button>
                )}
                <a
                  href={lightboxImage.url}
                  download={lightboxImage.name}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#343946] bg-[#222630] px-2.5 py-1.5 text-[11px] font-bold text-zinc-100"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  aria-label="Close photo viewer"
                  className="flex size-8 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white hover:bg-white/20"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-1">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.name}
                referrerPolicy="no-referrer"
                className="max-h-[72vh] w-auto rounded-xl object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
