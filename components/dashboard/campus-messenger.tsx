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
  ArrowUp,
  BarChart3,
  Bookmark,
  BookmarkPlus,
  Camera,
  Check,
  CheckCheck,
  Copy,
  Crown,
  Download,
  ExternalLink,
  FileText,
  Forward,
  Image as ImageIcon,
  Info,
  ListPlus,
  Lock,
  MapPin,
  MessageSquarePlus,
  MessageSquareText,
  Mic,
  MoreVertical,
  Navigation,
  Paperclip,
  Pause,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Pin,
  Play,
  Plus,
  PlusCircle,
  Reply,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Smile,
  Sparkles,
  SquarePen,
  Star,
  Trash2,
  Unlock,
  User,
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

export interface ChatLocationMeta {
  label: string
  address?: string
  latitude: number
  longitude: number
}

export interface ChatContactMeta {
  actorId: string
  name: string
  role: MessengerRole
  subtitle?: string
  avatarUrl?: string
}

export interface ChatPollOption {
  id: string
  text: string
}

export interface ChatPollMeta {
  question: string
  options: ChatPollOption[]
  allowMultiple: boolean
  votes: Record<string, string[]>
}

export interface ChatCustomList {
  id: string
  name: string
  roomIds: string[]
}

export interface ChatMessage {
  id: string
  roomId: string
  senderId: string
  senderName: string
  senderRole: MessengerRole
  senderBadge?: string
  text: string
  mediaType: 'none' | 'voice' | 'image' | 'pdf' | 'call' | 'location' | 'contact' | 'poll'
  callMeta?: ChatCallMeta
  locationMeta?: ChatLocationMeta
  contactMeta?: ChatContactMeta
  pollMeta?: ChatPollMeta
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
  searchName?: string
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
  if (msg.callMeta) {
    payload.callMeta = msg.callMeta
  }
  if (msg.locationMeta) {
    payload.locationMeta = {
      label: String(msg.locationMeta.label || 'Shared Location').slice(0, 140),
      ...(msg.locationMeta.address
        ? { address: String(msg.locationMeta.address).slice(0, 220) }
        : {}),
      latitude: Number(msg.locationMeta.latitude) || 0,
      longitude: Number(msg.locationMeta.longitude) || 0,
    }
  }
  if (msg.contactMeta) {
    payload.contactMeta = {
      actorId: String(msg.contactMeta.actorId || '').slice(0, 64),
      name: String(msg.contactMeta.name || 'Campus Member').slice(0, 120),
      role: msg.contactMeta.role,
      ...(msg.contactMeta.subtitle
        ? { subtitle: String(msg.contactMeta.subtitle).slice(0, 120) }
        : {}),
      ...(msg.contactMeta.avatarUrl
        ? { avatarUrl: String(msg.contactMeta.avatarUrl).slice(0, 500) }
        : {}),
    }
  }
  if (msg.pollMeta) {
    payload.pollMeta = {
      question: String(msg.pollMeta.question || '').slice(0, 240),
      options: msg.pollMeta.options.slice(0, 8).map((o) => ({
        id: String(o.id),
        text: String(o.text).slice(0, 120),
      })),
      allowMultiple: Boolean(msg.pollMeta.allowMultiple),
      votes: msg.pollMeta.votes || {},
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

function formatInstagramDateDivider(ms: number, nowMs: number = Date.now()): string {
  try {
    const diffDays = getIstDayNumber(nowMs) - getIstDayNumber(ms)
    if (diffDays <= 0) return 'TODAY'
    if (diffDays === 1) return 'YESTERDAY'
    const d = new Date(ms)
    const day = d.toLocaleDateString('en-IN', { timeZone: IST_TIME_ZONE, day: '2-digit' })
    const month = d
      .toLocaleDateString('en-IN', { timeZone: IST_TIME_ZONE, month: 'short' })
      .toUpperCase()
    const year = d.toLocaleDateString('en-IN', { timeZone: IST_TIME_ZONE, year: 'numeric' })
    return `${day}-${month}-${year}`
  } catch {
    return ''
  }
}

function formatInstagramRelativeTime(ms: number, nowMs: number = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((nowMs - ms) / 1000))
  if (diffSec < 60) return 'now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d`
  const diffWeek = Math.floor(diffDay / 7)
  return `${diffWeek}w`
}

function formatVoiceDurationPadded(sec: number): string {
  const safe = Math.max(0, Math.floor(sec))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const MUHAMMED_WORD_RE = /^m[ou]hamm?[ae]d\.?$/i
const INITIAL_TOKEN_RE = /^[A-Z]{1,3}\.?$/

/**
 * Messenger-only student name formatter:
 * Removes any occurrence of "Muhammed" / "Mohammed" / "Muhammad" and omits the first name word
 * while preserving the rest of the name and initials (e.g. "Muhammed Sinan. KP" -> "Sinan. KP",
 * "Ahmed Swalih. N" -> "Swalih. N", "Muhammed Jouhar Saheel. TK" -> "Jouhar Saheel. TK").
 * Never strips single-word names or reduces a name to only initials.
 * Usthads & Principal always retain their full official name.
 */
function formatMessengerStudentName(fullName: string): string {
  const cleaned = (fullName || '').trim().replace(/\s+/g, ' ')
  if (!cleaned) return 'Student'

  const tokens = cleaned.split(' ').filter(Boolean)
  if (tokens.length <= 1) return cleaned

  const firstIsMuhammed = MUHAMMED_WORD_RE.test(tokens[0].replace(/\.+$/, ''))
  let remaining = tokens.filter((t) => !MUHAMMED_WORD_RE.test(t.replace(/\.+$/, '')))
  if (remaining.length === 0) return cleaned

  const isRealNameWord = (token: string): boolean => {
    const core = token.replace(/^\.+|\.+$/g, '')
    if (!core) return false
    const beforeDot = core.split('.')[0] || ''
    if (beforeDot.length >= 3) return true
    if (INITIAL_TOKEN_RE.test(core)) return false
    return core.length >= 3
  }

  if (!firstIsMuhammed && remaining.length > 1) {
    const afterFirst = remaining.slice(1)
    if (afterFirst.some(isRealNameWord)) {
      remaining = afterFirst
    }
  }

  const formatted = remaining.join(' ').replace(/^\.+/, '').trim()
  return formatted || cleaned
}

function formatMessengerDisplayName(name: string, role?: MessengerRole): string {
  if (role === 'student') {
    return formatMessengerStudentName(name)
  }
  return name
}

function getMessengerAvatarText(displayName: string): string {
  const cleaned = (displayName || '').replace(/^Usthad\s+/i, '').trim()
  const words = cleaned.split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase()
  }
  return cleaned.slice(0, 2).toUpperCase() || 'IC'
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
    const messengerName = formatMessengerStudentName(studentMatch.name)
    return {
      id: studentMatch.id,
      name: messengerName,
      subtitle: `Class ${studentMatch.className} • ${studentMatch.admissionNo}`,
      avatarText: getMessengerAvatarText(messengerName),
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
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const pdfInputRef = useRef<HTMLInputElement | null>(null)
  const attachMenuRef = useRef<HTMLDivElement | null>(null)
  const attachButtonRef = useRef<HTMLButtonElement | null>(null)
  const chatMoreMenuRef = useRef<HTMLDivElement | null>(null)
  const chatMoreButtonRef = useRef<HTMLButtonElement | null>(null)
  const lastTypingSentMsRef = useRef<number>(0)

  // Chat Header 3-dots Menu (Clear chat, Add shortcut, Add to list, Starred messages)
  const [showChatMoreMenu, setShowChatMoreMenu] = useState(false)
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false)
  const [clearedRoomAtMs, setClearedRoomAtMs] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined' || !actor.id) return {}
    try {
      const raw = window.localStorage.getItem(`ics_messenger_cleared_rooms_v1_${actor.id}`)
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? sanitizeTimestampMap(parsed) : {}
    } catch {
      return {}
    }
  })
  const [shortcutRoomIds, setShortcutRoomIds] = useState<string[]>([])
  const [customLists, setCustomLists] = useState<ChatCustomList[]>([
    { id: 'favorites', name: 'Favorites', roomIds: [] },
    { id: 'important', name: 'Important', roomIds: [] },
  ])
  const [activeCustomListId, setActiveCustomListId] = useState<string | null>(null)
  const [showAddToListModal, setShowAddToListModal] = useState(false)
  const [newListName, setNewListName] = useState('')

  // Cross-device Firestore sync refs for /campusMessengerUserState/{actorId}
  const userStateDocExistsRef = useRef<boolean>(false)
  const userStateUpdatedAtMsRef = useRef<number>(0)
  const latestUserStateRef = useRef<{
    deletedMessageIds: string[]
    clearedRoomAtMs: Record<string, number>
    starredMessageIds: string[]
    shortcutRoomIds: string[]
    customLists: ChatCustomList[]
    chatSettings: ChatUserSettings
  }>({
    deletedMessageIds: deletedForMeIds,
    clearedRoomAtMs,
    starredMessageIds: localStarredIds,
    shortcutRoomIds,
    customLists,
    chatSettings,
  })

  useEffect(() => {
    latestUserStateRef.current = {
      deletedMessageIds: deletedForMeIds,
      clearedRoomAtMs,
      starredMessageIds: localStarredIds,
      shortcutRoomIds,
      customLists,
      chatSettings,
    }
  }, [deletedForMeIds, clearedRoomAtMs, localStarredIds, shortcutRoomIds, customLists, chatSettings])

  const syncUserStateToFirestore = useCallback(
    async (
      overrides?: Partial<{
        deletedMessageIds: string[]
        clearedRoomAtMs: Record<string, number>
        starredMessageIds: string[]
        shortcutRoomIds: string[]
        customLists: ChatCustomList[]
        chatSettings: ChatUserSettings
      }>,
    ) => {
      if (!actor.id) return
      const merged = {
        ...latestUserStateRef.current,
        ...(overrides ?? {}),
      }
      latestUserStateRef.current = merged
      const nowMs = Math.max(Date.now(), userStateUpdatedAtMsRef.current + 1)
      userStateUpdatedAtMsRef.current = nowMs

      const boundedDeleted = Array.from(new Set(merged.deletedMessageIds.map(String))).slice(-500)
      const boundedStarred = Array.from(new Set(merged.starredMessageIds.map(String))).slice(-300)
      const boundedShortcuts = Array.from(new Set(merged.shortcutRoomIds.map(String))).slice(0, 20)
      const boundedClearedEntries = Object.entries(merged.clearedRoomAtMs || {})
        .filter(([k, v]) => Boolean(k) && Number.isFinite(v) && v > 0)
        .slice(-150)
      const boundedCleared: Record<string, number> = {}
      for (const [k, v] of boundedClearedEntries) {
        boundedCleared[k] = Math.floor(v)
      }
      const boundedLists = (merged.customLists || []).slice(0, 15).map((list) => ({
        id: String(list.id).slice(0, 64),
        name: String(list.name).slice(0, 32),
        roomIds: Array.isArray(list.roomIds)
          ? Array.from(new Set(list.roomIds.map(String))).slice(0, 100)
          : [],
      }))
      const cleanSettings: ChatUserSettings = {
        showOnlineStatus: Boolean(merged.chatSettings.showOnlineStatus),
        sendReadReceipts: Boolean(merged.chatSettings.sendReadReceipts),
        enterToSend: Boolean(merged.chatSettings.enterToSend),
        soundEffects: Boolean(merged.chatSettings.soundEffects),
        chatFontSize: merged.chatSettings.chatFontSize || 'medium',
        chatWallpaper: merged.chatSettings.chatWallpaper || 'default',
        defaultImageQuality: merged.chatSettings.defaultImageQuality || 'standard',
      }

      const userStateDocRef = doc(db, 'campusMessengerUserState', sanitizeFirestoreDocId(actor.id))
      const updatePayload = {
        deletedMessageIds: boundedDeleted,
        clearedRoomAtMs: boundedCleared,
        starredMessageIds: boundedStarred,
        shortcutRoomIds: boundedShortcuts,
        customLists: boundedLists,
        chatSettings: cleanSettings,
        updatedAtMs: nowMs,
      }

      try {
        if (userStateDocExistsRef.current) {
          await updateDoc(userStateDocRef, updatePayload)
          return
        }
      } catch {
        // Fallback to create via setDoc below
      }

      try {
        await setDoc(userStateDocRef, {
          campusId: 'ics-academy',
          actorId: actor.id,
          ...updatePayload,
          createdAt: serverTimestamp(),
        })
        userStateDocExistsRef.current = true
      } catch {
        // Retry update if document was created concurrently by another device
        try {
          await updateDoc(userStateDocRef, updatePayload)
          userStateDocExistsRef.current = true
        } catch {
          // Ignore transient network errors; local cache remains intact
        }
      }
    },
    [actor.id],
  )

  // WhatsApp Attachment Sheet Modals: Location, Contact, Poll
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [locLoading, setLocLoading] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)
  const [locLabel, setLocLabel] = useState('ICS Academy Manhappatta')
  const [locAddress, setLocAddress] = useState("Manhappatta, Da'wa College Campus, Kerala")
  const [locCoords, setLocCoords] = useState<{ lat: number; lng: number } | null>(null)

  const [showContactModal, setShowContactModal] = useState(false)
  const [contactSearchQuery, setContactSearchQuery] = useState('')

  const [showPollModal, setShowPollModal] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false)
  const [pollVotesViewerMsgId, setPollVotesViewerMsgId] = useState<string | null>(null)

  // Load local hydration cache + subscribe to real-time Firestore cross-device user state
  useEffect(() => {
    if (!actor.id) return
    userStateDocExistsRef.current = false
    userStateUpdatedAtMsRef.current = 0

    if (typeof window !== 'undefined') {
      try {
        const savedCleared = window.localStorage.getItem(
          `ics_messenger_cleared_rooms_v1_${actor.id}`,
        )
        setClearedRoomAtMs(savedCleared ? sanitizeTimestampMap(JSON.parse(savedCleared)) : {})
      } catch {
        setClearedRoomAtMs({})
      }
      try {
        const savedShortcuts = window.localStorage.getItem(`ics_messenger_shortcuts_v1_${actor.id}`)
        if (savedShortcuts) {
          const parsed = JSON.parse(savedShortcuts)
          if (Array.isArray(parsed)) setShortcutRoomIds(parsed.map(String))
        } else {
          setShortcutRoomIds([])
        }
      } catch {
        setShortcutRoomIds([])
      }
      try {
        const savedLists = window.localStorage.getItem(`ics_messenger_lists_v1_${actor.id}`)
        if (savedLists) {
          const parsed = JSON.parse(savedLists)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCustomLists(parsed as ChatCustomList[])
          } else {
            setCustomLists([
              { id: 'favorites', name: 'Favorites', roomIds: [] },
              { id: 'important', name: 'Important', roomIds: [] },
            ])
          }
        } else {
          setCustomLists([
            { id: 'favorites', name: 'Favorites', roomIds: [] },
            { id: 'important', name: 'Important', roomIds: [] },
          ])
        }
      } catch {
        // Ignore parse error
      }
    }

    const userStateDocRef = doc(db, 'campusMessengerUserState', sanitizeFirestoreDocId(actor.id))
    const unsubscribe = onSnapshot(
      userStateDocRef,
      (snap) => {
        if (!snap.exists()) {
          userStateDocExistsRef.current = false
          return
        }
        userStateDocExistsRef.current = true
        const data = snap.data() as Record<string, unknown>
        const remoteUpdatedAtMs = Number(data.updatedAtMs) || 0

        // Always merge deletions & clear-chat watermarks monotonically so deletes from App/Web never resurrect
        const remoteDeleted = Array.isArray(data.deletedMessageIds)
          ? data.deletedMessageIds.map(String)
          : []
        if (remoteDeleted.length > 0) {
          setDeletedForMeIds((prev) => {
            const mergedSet = new Set([...prev, ...remoteDeleted])
            if (mergedSet.size === prev.length) return prev
            return Array.from(mergedSet).slice(-500)
          })
        }

        const remoteCleared = sanitizeTimestampMap(data.clearedRoomAtMs)
        if (Object.keys(remoteCleared).length > 0) {
          setClearedRoomAtMs((prev) => {
            let changed = false
            const next = { ...prev }
            for (const [rId, ts] of Object.entries(remoteCleared)) {
              if (!next[rId] || ts > next[rId]) {
                next[rId] = ts
                changed = true
              }
            }
            return changed ? next : prev
          })
        }

        if (remoteUpdatedAtMs >= userStateUpdatedAtMsRef.current) {
          userStateUpdatedAtMsRef.current = remoteUpdatedAtMs

          if (Array.isArray(data.starredMessageIds)) {
            setLocalStarredIds(data.starredMessageIds.map(String).slice(-300))
          }
          if (Array.isArray(data.shortcutRoomIds)) {
            setShortcutRoomIds(data.shortcutRoomIds.map(String).slice(0, 20))
          }
          if (Array.isArray(data.customLists) && data.customLists.length > 0) {
            const parsedLists: ChatCustomList[] = data.customLists
              .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
              .map((item) => ({
                id: String(item.id || `list_${Date.now()}`),
                name: String(item.name || 'List').slice(0, 32),
                roomIds: Array.isArray(item.roomIds) ? item.roomIds.map(String) : [],
              }))
            if (parsedLists.length > 0) {
              setCustomLists(parsedLists)
            }
          }
          if (data.chatSettings && typeof data.chatSettings === 'object') {
            const s = data.chatSettings as Partial<ChatUserSettings>
            setChatSettings((prev) => ({
              showOnlineStatus:
                typeof s.showOnlineStatus === 'boolean' ? s.showOnlineStatus : prev.showOnlineStatus,
              sendReadReceipts:
                typeof s.sendReadReceipts === 'boolean' ? s.sendReadReceipts : prev.sendReadReceipts,
              enterToSend: typeof s.enterToSend === 'boolean' ? s.enterToSend : prev.enterToSend,
              soundEffects: typeof s.soundEffects === 'boolean' ? s.soundEffects : prev.soundEffects,
              chatFontSize:
                s.chatFontSize === 'small' || s.chatFontSize === 'medium' || s.chatFontSize === 'large'
                  ? s.chatFontSize
                  : prev.chatFontSize,
              chatWallpaper:
                s.chatWallpaper === 'default' ||
                s.chatWallpaper === 'pitch_dark' ||
                s.chatWallpaper === 'soft_mint' ||
                s.chatWallpaper === 'warm_slate'
                  ? s.chatWallpaper
                  : prev.chatWallpaper,
              defaultImageQuality:
                s.defaultImageQuality === 'hd' || s.defaultImageQuality === 'standard'
                  ? s.defaultImageQuality
                  : prev.defaultImageQuality,
            }))
          }
        }
      },
      () => {
        // Ignore transient offline snapshot errors
      },
    )

    return () => {
      unsubscribe()
    }
  }, [actor.id])

  useEffect(() => {
    if (typeof window === 'undefined' || !actor.id) return
    try {
      window.localStorage.setItem(
        `ics_messenger_cleared_rooms_v1_${actor.id}`,
        JSON.stringify(clearedRoomAtMs),
      )
    } catch {
      // Ignore quota error
    }
  }, [clearedRoomAtMs, actor.id])

  const persistShortcuts = useCallback(
    (next: string[]) => {
      setShortcutRoomIds(next)
      if (typeof window !== 'undefined' && actor.id) {
        try {
          window.localStorage.setItem(
            `ics_messenger_shortcuts_v1_${actor.id}`,
            JSON.stringify(next),
          )
        } catch {
          // Ignore quota error
        }
      }
      void syncUserStateToFirestore({ shortcutRoomIds: next })
    },
    [actor.id, syncUserStateToFirestore],
  )

  const persistCustomLists = useCallback(
    (next: ChatCustomList[]) => {
      setCustomLists(next)
      if (typeof window !== 'undefined' && actor.id) {
        try {
          window.localStorage.setItem(
            `ics_messenger_lists_v1_${actor.id}`,
            JSON.stringify(next),
          )
        } catch {
          // Ignore quota error
        }
      }
      void syncUserStateToFirestore({ customLists: next })
    },
    [actor.id, syncUserStateToFirestore],
  )

  // Automatically close Attachment Menu & Chat More Menu when tapping anywhere outside
  useEffect(() => {
    if (!showAttachMenu && !showChatMoreMenu) return
    const handleGlobalPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (
        showAttachMenu &&
        !attachMenuRef.current?.contains(target) &&
        !attachButtonRef.current?.contains(target)
      ) {
        setShowAttachMenu(false)
      }
      if (
        showChatMoreMenu &&
        !chatMoreMenuRef.current?.contains(target) &&
        !chatMoreButtonRef.current?.contains(target)
      ) {
        setShowChatMoreMenu(false)
      }
    }
    document.addEventListener('pointerdown', handleGlobalPointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', handleGlobalPointerDown, true)
    }
  }, [showAttachMenu, showChatMoreMenu])

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
      const displayName = formatMessengerStudentName(st.name)
      list.push({
        roomId: makeDirectRoomId(actor.id, st.id),
        type: 'direct_student',
        title: displayName,
        searchName: `${displayName} ${st.name}`,
        subtitle: st.className !== actor.className ? `Class ${st.className}` : '',
        badgeLabel: st.className !== actor.className ? st.className : '',
        batchName: st.className,
        peerId: st.id,
        peerRole: 'student',
        avatarText: getMessengerAvatarText(displayName),
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
      // Never show "This message was deleted" boxes for anyone — vanish completely
      if (msg.isDeleted) return true
      if (deletedForEveryoneMap[msg.id]) return true
      if (deletedForMeIds.includes(msg.id)) return true
      if (Array.isArray(msg.deletedFor) && msg.deletedFor.includes(actor.id)) return true
      const clearedAt = clearedRoomAtMs[msg.roomId]
      if (clearedAt && msg.createdAtMs <= clearedAt) return true
      return false
    },
    [deletedForEveryoneMap, deletedForMeIds, actor.id, clearedRoomAtMs],
  )

  const isMessageStarredByMe = useCallback(
    (msg: ChatMessage) => {
      if (isMessageHiddenForMe(msg)) return false
      if (Array.isArray(msg.starredBy) && msg.starredBy.includes(actor.id)) return true
      return localStarredIds.includes(msg.id)
    },
    [actor.id, localStarredIds, isMessageHiddenForMe],
  )

  const updateChatSetting = <K extends keyof ChatUserSettings>(
    key: K,
    value: ChatUserSettings[K],
  ) => {
    setChatSettings((prev) => {
      const next = { ...prev, [key]: value }
      void syncUserStateToFirestore({ chatSettings: next })
      return next
    })
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
                JSON.stringify(existing.reactions) !== JSON.stringify(mergedMsg.reactions) ||
                JSON.stringify(existing.pollMeta ?? null) !==
                  JSON.stringify(mergedMsg.pollMeta ?? null)
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
              locationMeta:
                raw.locationMeta && typeof raw.locationMeta === 'object'
                  ? {
                      label: String(
                        (raw.locationMeta as Record<string, unknown>).label || 'Shared Location',
                      ),
                      address:
                        typeof (raw.locationMeta as Record<string, unknown>).address === 'string'
                          ? String((raw.locationMeta as Record<string, unknown>).address)
                          : undefined,
                      latitude: Number((raw.locationMeta as Record<string, unknown>).latitude) || 0,
                      longitude:
                        Number((raw.locationMeta as Record<string, unknown>).longitude) || 0,
                    }
                  : undefined,
              contactMeta:
                raw.contactMeta && typeof raw.contactMeta === 'object'
                  ? {
                      actorId: String((raw.contactMeta as Record<string, unknown>).actorId || ''),
                      name: String(
                        (raw.contactMeta as Record<string, unknown>).name || 'Campus Member',
                      ),
                      role: ((raw.contactMeta as Record<string, unknown>).role === 'principal' ||
                      (raw.contactMeta as Record<string, unknown>).role === 'usthad'
                        ? (raw.contactMeta as Record<string, unknown>).role
                        : 'student') as MessengerRole,
                      subtitle:
                        typeof (raw.contactMeta as Record<string, unknown>).subtitle === 'string'
                          ? String((raw.contactMeta as Record<string, unknown>).subtitle)
                          : undefined,
                      avatarUrl:
                        typeof (raw.contactMeta as Record<string, unknown>).avatarUrl === 'string'
                          ? String((raw.contactMeta as Record<string, unknown>).avatarUrl)
                          : undefined,
                    }
                  : undefined,
              pollMeta:
                raw.pollMeta && typeof raw.pollMeta === 'object'
                  ? {
                      question: String((raw.pollMeta as Record<string, unknown>).question || ''),
                      options: Array.isArray((raw.pollMeta as Record<string, unknown>).options)
                        ? (
                            (raw.pollMeta as Record<string, unknown>).options as Array<{
                              id?: string
                              text?: string
                            }>
                          ).map((o, idx) => ({
                            id: String(o?.id || `opt_${idx}`),
                            text: String(o?.text || ''),
                          }))
                        : [],
                      allowMultiple: Boolean(
                        (raw.pollMeta as Record<string, unknown>).allowMultiple,
                      ),
                      votes:
                        (raw.pollMeta as Record<string, unknown>).votes &&
                        typeof (raw.pollMeta as Record<string, unknown>).votes === 'object'
                          ? ((raw.pollMeta as Record<string, unknown>).votes as Record<
                              string,
                              string[]
                            >)
                          : {},
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
    const activeList = activeCustomListId
      ? customLists.find((l) => l.id === activeCustomListId)
      : null
    return allRooms
      .filter((r) => {
        if (activeList) {
          if (!activeList.roomIds.includes(r.roomId)) return false
        } else {
          if (categoryFilter === 'groups' && r.type !== 'batch_group') return false
          if (categoryFilter === 'staff' && r.type !== 'staff_group') return false
          if (categoryFilter === 'usthads' && r.type !== 'direct_usthad') return false
          if (categoryFilter === 'students' && r.type !== 'direct_student') return false
        }
        if (!q) return true
        return (
          r.title.toLowerCase().includes(q) ||
          (r.searchName || '').toLowerCase().includes(q) ||
          r.subtitle.toLowerCase().includes(q) ||
          r.badgeLabel.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        // Keep Staff Room and User's own Batch Group at the top, then sort by latest visible message timestamp
        const aIsPrimary =
          a.roomId === STAFF_ROOM_ID || a.roomId === makeBatchRoomId(actor.className)
        const bIsPrimary =
          b.roomId === STAFF_ROOM_ID || b.roomId === makeBatchRoomId(actor.className)
        if (aIsPrimary && !bIsPrimary) return -1
        if (!aIsPrimary && bIsPrimary) return 1

        const aMsgs = (messagesByRoom[a.roomId] ?? []).filter((m) => !isMessageHiddenForMe(m))
        const bMsgs = (messagesByRoom[b.roomId] ?? []).filter((m) => !isMessageHiddenForMe(m))
        const aLast = aMsgs[aMsgs.length - 1]?.createdAtMs ?? 0
        const bLast = bMsgs[bMsgs.length - 1]?.createdAtMs ?? 0
        return bLast - aLast
      })
  }, [
    allRooms,
    categoryFilter,
    activeCustomListId,
    customLists,
    searchQuery,
    actor.className,
    messagesByRoom,
    isMessageHiddenForMe,
  ])

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
      const typerProfile = resolveActorDirectoryProfile(first.actorId)
      const typerDisplay = typerProfile?.name || first.actorName
      if (first.mode === 'recording') {
        return `${typerDisplay} is recording a voice note...`
      }
      return `${typerDisplay} is typing...`
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
      mediaType?: 'none' | 'voice' | 'image' | 'pdf' | 'location' | 'contact' | 'poll'
      mediaUrl?: string
      mediaName?: string
      mediaSizeLabel?: string
      mediaDurationSec?: number
      imageQuality?: 'standard' | 'hd'
      imageDimensions?: string
      locationMeta?: ChatLocationMeta
      contactMeta?: ChatContactMeta
      pollMeta?: ChatPollMeta
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
        locationMeta: params.locationMeta,
        contactMeta: params.contactMeta,
        pollMeta: params.pollMeta,
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
          ? `📄 Shared Document: ${newMsg.mediaName || 'Document'}`
          : newMsg.mediaType === 'voice'
            ? `🎤 Sent a Voice Note (${formatVoiceDuration(newMsg.mediaDurationSec || 4)})`
            : newMsg.mediaType === 'image'
              ? `📷 Shared ${newMsg.imageQuality === 'hd' ? 'HD ' : ''}Photo${newMsg.text ? `: ${newMsg.text.slice(0, 80)}` : ''}`
              : newMsg.mediaType === 'location'
                ? `📍 Shared Location: ${newMsg.locationMeta?.label || 'Location'}`
                : newMsg.mediaType === 'contact'
                  ? `👤 Shared Contact: ${newMsg.contactMeta?.name || 'Contact'}`
                  : newMsg.mediaType === 'poll'
                    ? `📊 Poll: ${newMsg.pollMeta?.question || 'Campus Poll'}`
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

  const handleClearCurrentChat = useCallback(() => {
    const roomId = activeRoom.roomId
    const roomMsgs = messagesByRoom[roomId] ?? []
    const clearNowMs = Date.now()
    const nextClearedMap = {
      ...clearedRoomAtMs,
      [roomId]: clearNowMs,
    }
    setClearedRoomAtMs(nextClearedMap)
    setMessagesByRoom((prev) => ({
      ...prev,
      [roomId]: (prev[roomId] ?? []).map((m) => {
        const cur = Array.isArray(m.deletedFor) ? m.deletedFor : []
        return cur.includes(actor.id) ? m : { ...m, deletedFor: [...cur, actor.id] }
      }),
    }))
    for (const m of roomMsgs) {
      if (!(m.deletedFor ?? []).includes(actor.id)) {
        updateDoc(doc(db, 'campusChatMessages', m.id), {
          deletedFor: arrayUnion(actor.id),
        }).catch(() => {})
      }
    }
    void syncUserStateToFirestore({ clearedRoomAtMs: nextClearedMap })
    void sendChatActionToServer({
      action: 'clear_chat_for_me',
      roomId,
    })
    setShowClearChatConfirm(false)
    showToast(`Cleared chat with "${activeRoom.title}"`)
  }, [
    activeRoom.roomId,
    activeRoom.title,
    actor.id,
    clearedRoomAtMs,
    messagesByRoom,
    sendChatActionToServer,
    showToast,
    syncUserStateToFirestore,
  ])

  const handleToggleShortcut = useCallback(
    (roomId: string, roomTitle: string) => {
      const exists = shortcutRoomIds.includes(roomId)
      const next = exists
        ? shortcutRoomIds.filter((id) => id !== roomId)
        : [roomId, ...shortcutRoomIds].slice(0, 12)
      persistShortcuts(next)
      showToast(
        exists ? `Removed "${roomTitle}" from shortcuts` : `Added "${roomTitle}" shortcut`,
      )
    },
    [persistShortcuts, shortcutRoomIds, showToast],
  )

  const handleToggleRoomInList = useCallback(
    (listId: string, roomId: string) => {
      const next = customLists.map((list) => {
        if (list.id !== listId) return list
        const has = list.roomIds.includes(roomId)
        return {
          ...list,
          roomIds: has ? list.roomIds.filter((id) => id !== roomId) : [...list.roomIds, roomId],
        }
      })
      persistCustomLists(next)
    },
    [customLists, persistCustomLists],
  )

  const handleCreateCustomList = useCallback(() => {
    const clean = newListName.trim().slice(0, 32)
    if (!clean) return
    const newId = `list_${Date.now()}`
    const next: ChatCustomList[] = [
      ...customLists,
      { id: newId, name: clean, roomIds: [activeRoom.roomId] },
    ]
    persistCustomLists(next)
    setNewListName('')
    showToast(`Added to "${clean}" list`)
  }, [activeRoom.roomId, customLists, newListName, persistCustomLists, showToast])

  const handleDetectCurrentLocation = useCallback(() => {
    setLocError(null)
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocError('GPS is not supported in this browser. You can share the campus location below.')
      return
    }
    setLocLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocLoading(false)
        const lat = Number(pos.coords.latitude.toFixed(6))
        const lng = Number(pos.coords.longitude.toFixed(6))
        setLocCoords({ lat, lng })
        setLocLabel('Current Location')
        setLocAddress(`${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E`)
      },
      () => {
        setLocLoading(false)
        setLocError(
          'Location permission denied or unavailable. You can still share ICS Academy Campus location below.',
        )
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  }, [])

  const handleSendLocationMessage = useCallback(
    (meta: ChatLocationMeta) => {
      dispatchMessage({
        text: `📍 ${meta.label}`,
        mediaType: 'location',
        locationMeta: meta,
      })
      setShowLocationModal(false)
    },
    [dispatchMessage],
  )

  const handleSendContactMessage = useCallback(
    (contact: ChatContactMeta) => {
      dispatchMessage({
        text: `👤 ${contact.name}`,
        mediaType: 'contact',
        contactMeta: contact,
      })
      setShowContactModal(false)
      setContactSearchQuery('')
    },
    [dispatchMessage],
  )

  const handleSendPollMessage = useCallback(() => {
    const q = pollQuestion.trim()
    const cleanOpts = pollOptions.map((o) => o.trim()).filter(Boolean)
    if (!q || cleanOpts.length < 2) return
    const pollMeta: ChatPollMeta = {
      question: q.slice(0, 240),
      options: cleanOpts.slice(0, 6).map((text, idx) => ({
        id: `opt_${idx + 1}`,
        text: text.slice(0, 120),
      })),
      allowMultiple: pollAllowMultiple,
      votes: {},
    }
    dispatchMessage({
      text: `📊 ${pollMeta.question}`,
      mediaType: 'poll',
      pollMeta,
    })
    setPollQuestion('')
    setPollOptions(['', ''])
    setPollAllowMultiple(false)
    setShowPollModal(false)
  }, [dispatchMessage, pollAllowMultiple, pollOptions, pollQuestion])

  const handleVotePoll = useCallback(
    (msg: ChatMessage, optionId: string) => {
      if (!msg.pollMeta) return
      const votes: Record<string, string[]> = { ...(msg.pollMeta.votes || {}) }
      const currentVoters = Array.isArray(votes[optionId]) ? [...votes[optionId]] : []
      const alreadyVoted = currentVoters.includes(actor.id)

      if (!msg.pollMeta.allowMultiple) {
        for (const key of Object.keys(votes)) {
          votes[key] = (votes[key] || []).filter((id) => id !== actor.id)
        }
      }
      if (alreadyVoted) {
        votes[optionId] = (votes[optionId] || []).filter((id) => id !== actor.id)
      } else {
        votes[optionId] = Array.from(new Set([...(votes[optionId] || []), actor.id]))
      }

      const nextPollMeta: ChatPollMeta = {
        ...msg.pollMeta,
        votes,
      }

      setMessagesByRoom((prev) => ({
        ...prev,
        [msg.roomId]: (prev[msg.roomId] ?? []).map((m) =>
          m.id === msg.id ? { ...m, pollMeta: nextPollMeta } : m,
        ),
      }))

      updateDoc(doc(db, 'campusChatMessages', msg.id), {
        pollMeta: nextPollMeta,
      }).catch(() => {})

      void sendChatActionToServer({
        action: 'vote_poll',
        roomId: msg.roomId,
        messageId: msg.id,
        optionId,
      })
    },
    [actor.id, sendChatActionToServer],
  )

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

    const nextStarredIds = shouldStar
      ? Array.from(new Set([...localStarredIds, ...targetIds])).slice(-300)
      : localStarredIds.filter((id) => !targetIds.includes(id))
    setLocalStarredIds(nextStarredIds)
    void syncUserStateToFirestore({ starredMessageIds: nextStarredIds })

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
      void updateDoc(doc(db, 'campusChatMessages', m.id), {
        starredBy: shouldStar ? arrayUnion(actor.id) : arrayRemove(actor.id),
      }).catch(() => {})
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
    const nextStarred = localStarredIds.filter((id) => !messageIds.includes(id))
    setLocalStarredIds(nextStarred)
    const nextDeleted = Array.from(new Set([...deletedForMeIds, ...messageIds])).slice(-500)
    setDeletedForMeIds(nextDeleted)
    void syncUserStateToFirestore({
      deletedMessageIds: nextDeleted,
      starredMessageIds: nextStarred,
    })
    for (const messageId of messageIds) {
      void updateDoc(doc(db, 'campusChatMessages', messageId), {
        isDeleted: true,
        deletedBy: actor.name.slice(0, 120),
        deletedById: actor.id,
        text: '',
        mediaType: 'none',
        mediaUrl: '',
        starredBy: [],
      }).catch(() => {})
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
    const nextDeleted = Array.from(new Set([...deletedForMeIds, ...messageIds])).slice(-500)
    const nextStarred = localStarredIds.filter((id) => !messageIds.includes(id))
    setDeletedForMeIds(nextDeleted)
    setLocalStarredIds(nextStarred)
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
    void syncUserStateToFirestore({
      deletedMessageIds: nextDeleted,
      starredMessageIds: nextStarred,
    })
    for (const messageId of messageIds) {
      void updateDoc(doc(db, 'campusChatMessages', messageId), {
        deletedFor: arrayUnion(actor.id),
      }).catch(() => {})
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
      const displayName = formatMessengerStudentName(st.name)
      list.push({
        roomId: makeDirectRoomId(actor.id, st.id),
        type: 'direct_student',
        title: displayName,
        searchName: `${displayName} ${st.name}`,
        subtitle: `Class ${st.className} • ${st.admissionNo}`,
        badgeLabel: st.className,
        batchName: st.className,
        peerId: st.id,
        peerRole: 'student',
        avatarText: getMessengerAvatarText(displayName),
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
      el.classList.add('ring-2', 'ring-[#0095F6]')
      window.setTimeout(() => {
        el.classList.remove('ring-2', 'ring-[#0095F6]')
      }, 1800)
    }
  }

  const activeTypingBanner = getRoomTypingText(activeRoom.roomId)

  return (
    <section
      id="campus-chat"
      aria-label="ICS Academy Campus Messenger"
      className={cn(
        'flex flex-col overflow-hidden bg-background transition-colors lg:rounded-3xl lg:bg-card lg:shadow-lg',
        mobileFullScreen
          ? 'h-full w-full flex-1 rounded-none border-0 shadow-none lg:h-[760px]'
          : 'h-[720px] sm:h-[760px]',
      )}
    >
      <div className="flex h-full min-h-0 flex-1 overflow-hidden">
        {/* LEFT PANE: INSTAGRAM DM INBOX ROSTER */}
        <div
          className={cn(
            'flex h-full w-full flex-col bg-white dark:bg-black lg:w-[310px] xl:w-[370px] lg:shrink-0 lg:border-r lg:border-border/50 dark:lg:border-white/[0.06]',
            mobileShowChatPane ? 'hidden lg:flex' : 'flex',
          )}
        >
          {/* Instagram Inbox Top Bar */}
          <div className="flex items-center justify-between gap-2 bg-white px-4 pb-2 pt-3.5 dark:bg-black">
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-poppins text-[19px] font-bold tracking-tight text-zinc-950 dark:text-white">
                {formatMessengerDisplayName(actor.name, actor.role)}
              </h2>
            </div>

            <div className="flex shrink-0 items-center gap-1">
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
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-zinc-800 transition-colors hover:bg-zinc-100 dark:text-white dark:hover:bg-white/10"
              >
                <Settings className="size-[21px]" aria-hidden="true" />
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
                title="New message"
                aria-label="Start a new chat"
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-zinc-800 transition-colors hover:bg-zinc-100 dark:text-white dark:hover:bg-white/10"
              >
                <SquarePen className="size-[21px]" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Search & Instagram Filter Pills */}
          <div className="flex flex-col gap-2.5 bg-white px-4 pb-2.5 pt-1 dark:bg-black">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="h-9 w-full rounded-xl border-0 bg-[#efefef] pl-10 pr-3 text-[13.5px] text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 dark:bg-[#262626] dark:text-white dark:placeholder:text-zinc-400"
              />
            </div>

            {(() => {
              const totalUnreadChatsCount = allRooms.reduce((acc, r) => {
                const rMsgs = (messagesByRoom[r.roomId] ?? []).filter(
                  (m) => !isMessageHiddenForMe(m),
                )
                const hasUnread = rMsgs.some(
                  (m) => m.senderId !== actor.id && !m.readBy.includes(actor.id),
                )
                return acc + (hasUnread ? 1 : 0)
              }, 0)

              return (
                <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                    const active = !activeCustomListId && categoryFilter === tab.id
                    const showMissedBadge = tab.id === 'calls' && unreadMissedCallsCount > 0
                    const showAllUnread = tab.id === 'all' && totalUnreadChatsCount > 0
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setActiveCustomListId(null)
                          setCategoryFilter(tab.id)
                          if (tab.id === 'calls') {
                            markMissedCallsSeen()
                          }
                        }}
                        className={cn(
                          'inline-flex h-8 items-center gap-1.5 rounded-xl px-3.5 text-[12.5px] font-semibold transition-colors whitespace-nowrap shrink-0',
                          active
                            ? 'bg-zinc-950 text-white dark:bg-white dark:text-black'
                            : 'bg-[#efefef] text-zinc-700 hover:bg-zinc-200 dark:bg-[#262626] dark:text-zinc-200 dark:hover:bg-[#323232]',
                        )}
                      >
                        {showAllUnread && (
                          <span className="size-1.5 rounded-full bg-[#4f5bd5]" aria-hidden="true" />
                        )}
                        {tab.id === 'calls' && <Phone className="size-3" aria-hidden="true" />}
                        <span>{tab.label}</span>
                        {showAllUnread && (
                          <span className="font-poppins text-[11.5px] opacity-80 tabular-nums">
                            {totalUnreadChatsCount}
                          </span>
                        )}
                        {showMissedBadge && (
                          <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 font-poppins text-[9px] font-bold text-white tabular-nums">
                            {unreadMissedCallsCount > 99 ? '99+' : unreadMissedCallsCount}
                          </span>
                        )}
                      </button>
                    )
                  })}

                  {/* User's Custom Chat Lists (created via "Add to list") */}
                  {customLists
                    .filter((l) => l.roomIds.length > 0)
                    .map((list) => {
                      const active = activeCustomListId === list.id
                      return (
                        <button
                          key={list.id}
                          type="button"
                          onClick={() => {
                            setCategoryFilter('all')
                            setActiveCustomListId(active ? null : list.id)
                          }}
                          className={cn(
                            'inline-flex h-8 items-center gap-1.5 rounded-xl px-3.5 text-[12.5px] font-semibold transition-colors whitespace-nowrap shrink-0',
                            active
                              ? 'bg-zinc-950 text-white dark:bg-white dark:text-black'
                              : 'bg-[#efefef] text-zinc-700 hover:bg-zinc-200 dark:bg-[#262626] dark:text-zinc-200 dark:hover:bg-[#323232]',
                          )}
                        >
                          <span>{list.name}</span>
                          <span className="text-[11px] opacity-75 tabular-nums">
                            {list.roomIds.length}
                          </span>
                        </button>
                      )
                    })}
                </div>
              )
            })()}

            {/* Quick-Access Pinned Chat Shortcuts Strip (Instagram Notes / Story Avatar Row) */}
            {shortcutRoomIds.length > 0 && categoryFilter !== 'calls' && (
              <div className="flex items-center gap-3 overflow-x-auto pt-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {shortcutRoomIds
                  .map((id) => allRooms.find((r) => r.roomId === id))
                  .filter((r): r is ChatRoomDescriptor => Boolean(r))
                  .map((sRoom) => (
                    <button
                      key={sRoom.roomId}
                      type="button"
                      onClick={() => {
                        setSelectedRoomId(sRoom.roomId)
                        setMobileShowChatPane(true)
                      }}
                      className="flex shrink-0 flex-col items-center gap-1.5 transition-opacity hover:opacity-85"
                    >
                      <div className="rounded-full bg-gradient-to-tr from-[#c026d3] via-[#7c3aed] to-[#4f46e5] p-[2px]">
                        <div className="flex size-12 items-center justify-center overflow-hidden rounded-full bg-white p-[2px] dark:bg-black">
                          <div className="flex size-full items-center justify-center overflow-hidden rounded-full bg-zinc-200 font-poppins text-xs font-bold text-zinc-800 dark:bg-[#262626] dark:text-zinc-100">
                            {sRoom.avatarUrl ? (
                              <img
                                src={sRoom.avatarUrl}
                                alt={sRoom.title}
                                className="size-full object-cover object-top"
                              />
                            ) : (
                              sRoom.avatarText
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="max-w-[58px] truncate text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                        {sRoom.title.split(' ')[0]}
                      </span>
                    </button>
                  ))}
              </div>
            )}

            {/* Class selector when viewing Students tab */}
            {!activeCustomListId && categoryFilter === 'students' && (
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  Class:
                </span>
                <ThemeSelect
                  value={studentBatchFilter}
                  onChange={(e) => setStudentBatchFilter(e.target.value)}
                  aria-label="Filter students"
                  className="h-8 flex-1 rounded-xl border-0 bg-[#efefef] px-2.5 text-xs font-semibold text-foreground dark:bg-[#262626] dark:text-zinc-100"
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

          {/* Scrollable Room List OR Dedicated Calls History List (Zero row dividers, Instagram airy list) */}
          <div className="flex-1 overflow-y-auto bg-white py-1 dark:bg-black">
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
                      <div className="flex size-13 items-center justify-center rounded-full bg-violet-500/12 text-violet-600 dark:bg-white/10 dark:text-zinc-200">
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
                  const rawPeerName = isOutgoing ? rec.calleeName : rec.callerName
                  const peerRole = isOutgoing ? rec.calleeRole : rec.callerRole
                  const peerName = formatMessengerDisplayName(rawPeerName, peerRole)
                  const peerSubtitle = isOutgoing ? rec.calleeSubtitle : rec.callerSubtitle
                  const isMissedIncoming =
                    !isOutgoing && (rec.status === 'missed' || rec.status === 'declined')
                  const directRoomId = rec.roomId || makeDirectCallRoomId(actor.id, peerId)
                  const matchingRoom = allRooms.find(
                    (r) => r.roomId === directRoomId || r.peerId === peerId,
                  )
                  const avatarUrl = matchingRoom?.avatarUrl
                  const initials = getMessengerAvatarText(peerName)

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
                      className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-100/80 dark:hover:bg-white/[0.06]"
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
                        className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
                      >
                        <div className="flex size-[52px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#efefef] font-poppins text-sm font-bold text-zinc-700 dark:bg-[#262626] dark:text-zinc-200">
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
                              'truncate text-[14.5px] font-semibold',
                              isMissedIncoming
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-zinc-950 dark:text-white',
                            )}
                          >
                            {peerName}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-zinc-500 dark:text-zinc-400">
                            {isMissedIncoming ? (
                              <PhoneMissed className="size-3.5 shrink-0 text-rose-500" />
                            ) : isOutgoing ? (
                              <PhoneOutgoing className="size-3.5 shrink-0 text-violet-500" />
                            ) : (
                              <PhoneIncoming className="size-3.5 shrink-0 text-emerald-500" />
                            )}
                            <span className="truncate">
                              {rec.callType === 'video' ? 'Video' : 'Voice'} · {statusText} ·{' '}
                              <span className="tabular-nums">
                                {formatInstagramRelativeTime(rec.startedAtMs)}
                              </span>
                            </span>
                          </div>
                        </div>
                      </button>

                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          disabled={Boolean(activeCall)}
                          onClick={() => handleQuickCall('voice')}
                          aria-label={`Voice call ${peerName}`}
                          title="Voice call"
                          className="flex size-9 items-center justify-center rounded-full text-zinc-800 transition-colors hover:bg-zinc-200/70 disabled:opacity-40 dark:text-white dark:hover:bg-white/10"
                        >
                          <Phone className="size-[19px]" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(activeCall)}
                          onClick={() => handleQuickCall('video')}
                          aria-label={`Video call ${peerName}`}
                          title="Video call"
                          className="flex size-9 items-center justify-center rounded-full text-zinc-800 transition-colors hover:bg-zinc-200/70 disabled:opacity-40 dark:text-white dark:hover:bg-white/10"
                        >
                          <Video className="size-[20px]" aria-hidden="true" />
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
                const peerPresence =
                  (room.type === 'direct_usthad' || room.type === 'direct_student') && room.peerId
                    ? getOpenChatHeaderStatus(room)
                    : null
                const isPeerOnline = Boolean(peerPresence?.isOnlineNow)

                const previewSnippet = lastMsg
                  ? lastMsg.mediaType === 'voice'
                    ? `Sent a voice message · ${formatVoiceDuration(lastMsg.mediaDurationSec || 4)}`
                    : lastMsg.mediaType === 'pdf'
                      ? `Sent a document · ${lastMsg.mediaName || 'PDF'}`
                      : lastMsg.mediaType === 'image'
                        ? `Sent ${lastMsg.imageQuality === 'hd' ? 'an HD ' : 'a '}photo`
                        : lastMsg.mediaType === 'call'
                          ? `${lastMsg.callMeta?.callType === 'video' ? 'Video' : 'Voice'} call`
                          : lastMsg.mediaType === 'location'
                            ? `Shared a location`
                            : lastMsg.mediaType === 'contact'
                              ? `Shared ${
                                  lastMsg.contactMeta
                                    ? formatMessengerDisplayName(
                                        lastMsg.contactMeta.name,
                                        lastMsg.contactMeta.role,
                                      )
                                    : 'a contact'
                                }`
                              : lastMsg.mediaType === 'poll'
                                ? `Poll: ${lastMsg.pollMeta?.question || 'Vote'}`
                                : lastMsg.text
                  : ''

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
                      'flex w-full items-center gap-3.5 px-4 py-2.5 text-left transition-colors',
                      isSelected
                        ? 'bg-zinc-100/90 dark:bg-white/[0.08]'
                        : 'hover:bg-zinc-100/60 dark:hover:bg-white/[0.05]',
                    )}
                  >
                    {/* Instagram Circular 52px Avatar + Optional Online Green Dot */}
                    <div className="relative shrink-0">
                      <div
                        className={cn(
                          'flex size-[52px] items-center justify-center overflow-hidden rounded-full font-poppins text-sm font-bold',
                          room.type === 'staff_group'
                            ? 'bg-amber-500/15 text-amber-600 dark:bg-[#1f1b14] dark:text-amber-300'
                            : room.type === 'batch_group'
                              ? 'bg-violet-500/15 text-violet-700 dark:bg-[#1e1b2e] dark:text-violet-200'
                              : room.type === 'direct_usthad'
                                ? 'bg-indigo-500/15 text-indigo-700 dark:bg-[#222228] dark:text-zinc-100'
                                : 'bg-[#efefef] text-zinc-700 dark:bg-[#262626] dark:text-zinc-200',
                        )}
                      >
                        {room.avatarUrl ? (
                          <img
                            src={room.avatarUrl}
                            alt={room.title}
                            className="size-full object-cover object-top"
                          />
                        ) : room.type === 'batch_group' ? (
                          <Users className="size-5" aria-hidden="true" />
                        ) : room.type === 'staff_group' ? (
                          <Crown className="size-5" aria-hidden="true" />
                        ) : (
                          room.avatarText
                        )}
                      </div>
                      {isPeerOnline && (
                        <span
                          className="absolute bottom-0.5 right-0.5 size-3.5 rounded-full bg-[#22c55e] ring-[2.5px] ring-white dark:ring-black"
                          aria-label="Active now"
                        />
                      )}
                    </div>

                    {/* Instagram 2-Line Title + Preview · Relative Time */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'truncate text-[14.5px] leading-snug',
                            unreadCount > 0
                              ? 'font-bold text-zinc-950 dark:text-white'
                              : 'font-medium text-zinc-900 dark:text-zinc-100',
                          )}
                        >
                          {room.title}
                        </span>
                        {roomMeta?.onlyAdminsCanPost && (
                          <Lock
                            className="size-3 shrink-0 text-amber-500"
                            aria-label="Only Usthads can message"
                          />
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center gap-1 text-[13px] leading-snug">
                        {roomTyping ? (
                          <p className="truncate font-medium text-violet-600 dark:text-violet-400">
                            {roomTyping}
                          </p>
                        ) : unreadCount > 1 && lastMsg ? (
                          <p className="flex min-w-0 items-center gap-1 font-semibold text-zinc-900 dark:text-white">
                            <span className="truncate">
                              {unreadCount >= 4 ? '4+ new messages' : `${unreadCount} new messages`}
                            </span>
                            <span className="shrink-0 font-normal text-zinc-500 dark:text-zinc-400">
                              · {formatInstagramRelativeTime(lastMsg.createdAtMs)}
                            </span>
                          </p>
                        ) : lastMsg ? (
                          <p
                            className={cn(
                              'flex min-w-0 items-center gap-1',
                              unreadCount > 0
                                ? 'font-semibold text-zinc-900 dark:text-white'
                                : 'text-zinc-500 dark:text-zinc-400',
                            )}
                          >
                            <span className="truncate">
                              {lastMsg.senderId === actor.id
                                ? `You: ${previewSnippet}`
                                : room.type === 'batch_group' || room.type === 'staff_group'
                                  ? `${formatMessengerDisplayName(lastMsg.senderName, lastMsg.senderRole).split(' ')[0]}: ${previewSnippet}`
                                  : previewSnippet}
                            </span>
                            <span className="shrink-0 font-normal text-zinc-400 dark:text-zinc-500">
                              · {formatInstagramRelativeTime(lastMsg.createdAtMs)}
                            </span>
                          </p>
                        ) : (
                          <p className="truncate text-zinc-500 dark:text-zinc-400">
                            {isPeerOnline
                              ? 'Active now'
                              : peerPresence?.text
                                ? peerPresence.text
                                : room.subtitle || 'Start a conversation'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Instagram Blue Unread Dot on Far Right */}
                    {unreadCount > 0 && (
                      <span
                        className="size-2.5 shrink-0 rounded-full bg-[#4f5bd5]"
                        aria-label={`${unreadCount} unread messages`}
                      />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* RIGHT PANE: ACTIVE WHATSAPP CONVERSATION WINDOW (OR MESSAGE INFO SCREEN) */}
        <div
          className={cn(
            'relative flex h-full min-w-0 flex-1 flex-col bg-background dark:bg-black lg:bg-background/95 lg:dark:bg-black',
            !mobileShowChatPane
              ? 'hidden lg:flex'
              : 'flex max-lg:fixed max-lg:inset-0 max-lg:z-[55] max-lg:w-full max-lg:pt-[var(--safe-top)] max-lg:pb-[var(--safe-bottom)]',
          )}
        >
          {/* Floating Action Toast */}
          {actionToast && (
            <div className="pointer-events-none absolute left-1/2 top-16 z-40 -translate-x-1/2 rounded-full bg-card/95 px-4 py-1.5 text-xs font-semibold text-foreground shadow-lg backdrop-blur-md dark:bg-[#0B1014] dark:text-[#F5F7FA]">
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
                <div className="flex h-full flex-col bg-background dark:bg-black">
                  {/* Message Info Top Bar */}
                  <div className="flex items-center gap-3 border-b border-border bg-card/95 px-3 py-3 sm:px-4 dark:border-white/10 dark:bg-black">
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
                        'flex flex-col items-end border-b border-border/80 px-4 py-5 sm:px-6 dark:border-white/10',
                        chatSettings.chatWallpaper === 'pitch_dark'
                          ? 'bg-[#e8edf2] dark:bg-black'
                          : chatSettings.chatWallpaper === 'soft_mint'
                            ? 'bg-[#e7f5ea] dark:bg-[#070d0a]'
                            : chatSettings.chatWallpaper === 'warm_slate'
                              ? 'bg-[#f2efe9] dark:bg-[#0c0d11]'
                              : 'bg-muted/40 dark:bg-black',
                      )}
                    >
                      <div className="max-w-[90%] sm:max-w-[78%] rounded-2xl rounded-br-xs bg-gradient-to-tr from-[#7C3AED] via-[#4F46E5] to-[#0095F6] px-3.5 py-2.5 text-white shadow-xs">
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
                      <div className="divide-y divide-border/50 px-4 sm:px-6 dark:divide-white/[0.06]">
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
                        <div className="overflow-hidden rounded-2xl bg-card dark:bg-[#0B1014]">
                          <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
                            <div className="flex items-center gap-2">
                              <CheckCheck
                                className="size-4.5 text-[#0095F6] stroke-[2.5]"
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
                            <div className="divide-y divide-border/40">
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
                                        className="size-8 shrink-0 rounded-full object-cover object-top"
                                      />
                                    ) : (
                                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0095F6]/15 font-poppins text-[11px] font-bold text-[#0077CC] dark:bg-[#141A1F] dark:text-[#0095F6]">
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
                            <div className="border-t border-border/40 bg-muted/40 px-4 py-2 text-[11px] font-medium text-muted-foreground dark:bg-[#141A1F]/60">
                              {remainingToRead} remaining
                            </div>
                          )}
                        </div>

                        {/* Delivered To Card */}
                        <div className="overflow-hidden rounded-2xl bg-card dark:bg-[#0B1014]">
                          <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
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
                            <div className="divide-y divide-border/40">
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
                                        className="size-8 shrink-0 rounded-full object-cover object-top"
                                      />
                                    ) : (
                                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-poppins text-[11px] font-bold text-foreground dark:bg-[#141A1F] dark:text-[#F5F7FA]">
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
                            <div className="border-t border-border/40 bg-muted/40 px-4 py-2 text-[11px] font-medium text-muted-foreground dark:bg-[#141A1F]/60">
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
              {/* Active Chat Header OR Clean Instagram Multi-Message Selection Bar */}
              {selectedMessageIds.length > 0 ? (
                <div className="relative z-30 flex items-center justify-between gap-2 border-b border-border/70 bg-white px-2.5 py-2.5 text-zinc-950 sm:px-4 sm:py-3 dark:border-white/10 dark:bg-black dark:text-white">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMessageIds([])
                        setShowSelectionMoreMenu(false)
                      }}
                      aria-label="Exit message selection"
                      className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-white/10"
                    >
                      <ArrowLeft className="size-5" aria-hidden="true" />
                    </button>
                    <span className="font-poppins text-base font-bold tabular-nums">
                      {selectedMessageIds.length}
                    </span>
                  </div>

                  {/* Selection Actions: Reply, Star, Info, Delete, Forward, More (⋮) */}
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
                        className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-white/10"
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
                        className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-white/10"
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
                        className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-white/10"
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
                      className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-rose-500/15 hover:text-rose-500"
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
                        className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-white/10"
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
                          className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-white/10"
                        >
                          <MoreVertical className="size-5" aria-hidden="true" />
                        </button>

                        {showSelectionMoreMenu && (
                          <div className="absolute right-0 top-11 z-40 w-48 overflow-hidden rounded-2xl bg-white py-1.5 text-xs text-foreground shadow-2xl dark:bg-[#0B1014] dark:text-[#F5F7FA]">
                            <button
                              type="button"
                              onClick={() => void handleCopyMessages(nonDeletedSelectedMessages)}
                              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-white/10"
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
                                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-white/10"
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
                              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-white/10"
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
                <div className="flex items-center justify-between gap-2 border-b border-border/50 bg-white px-2.5 py-2.5 sm:px-4 sm:py-3 dark:border-white/[0.08] dark:bg-black">
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
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-zinc-900 transition-colors hover:bg-zinc-100 lg:hidden dark:text-white dark:hover:bg-white/10"
                    >
                      <ArrowLeft className="size-5" aria-hidden="true" />
                    </button>

                    <div className="relative shrink-0">
                      <div
                        className={cn(
                          'flex size-9 items-center justify-center overflow-hidden rounded-full font-poppins text-xs font-bold',
                          activeRoom.type === 'staff_group'
                            ? 'bg-amber-500/15 text-amber-600 dark:bg-[#1f1b14] dark:text-amber-300'
                            : activeRoom.type === 'batch_group'
                              ? 'bg-violet-500/15 text-violet-700 dark:bg-[#1e1b2e] dark:text-violet-200'
                              : 'bg-[#efefef] text-zinc-800 dark:bg-[#262626] dark:text-zinc-100',
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
                        <h3 className="truncate font-poppins text-[15px] font-bold leading-tight text-zinc-950 dark:text-white">
                          {activeRoom.title}
                        </h3>
                      </div>

                      {activeTypingBanner ? (
                        <p className="truncate text-[11.5px] font-medium text-violet-600 dark:text-violet-400">
                          {activeTypingBanner}
                        </p>
                      ) : (() => {
                          const headerStatus = getOpenChatHeaderStatus(activeRoom)
                          if (headerStatus.isOnlineNow) {
                            return (
                              <p className="truncate text-[11.5px] font-medium text-emerald-600 dark:text-emerald-400">
                                Active now
                              </p>
                            )
                          }
                          if (headerStatus.text) {
                            return (
                              <p className="truncate text-[11.5px] text-zinc-500 dark:text-zinc-400">
                                {headerStatus.text}
                              </p>
                            )
                          }
                          return activeRoom.subtitle ? (
                            <p className="truncate text-[11.5px] text-zinc-500 dark:text-zinc-400">
                              {activeRoom.subtitle}
                            </p>
                          ) : null
                        })()}
                    </div>
                  </div>

                  {/* Right Controls — Clean Bare Instagram Icons (Phone, Video, Lock, More) */}
                  <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
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
                                'voice',
                              )
                            }}
                            title={`Voice call ${activeRoom.title}`}
                            aria-label={`Voice call ${activeRoom.title}`}
                            className="flex size-10 items-center justify-center rounded-full text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:text-white dark:hover:bg-white/10"
                          >
                            <Phone className="size-[20px]" aria-hidden="true" />
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
                                'video',
                              )
                            }}
                            title={`Video call ${activeRoom.title}`}
                            aria-label={`Video call ${activeRoom.title}`}
                            className="flex size-10 items-center justify-center rounded-full text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:text-white dark:hover:bg-white/10"
                          >
                            <Video className="size-[22px]" aria-hidden="true" />
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
                          'inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap shrink-0',
                          activeRoomMeta.onlyAdminsCanPost
                            ? 'bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300'
                            : 'bg-[#efefef] text-zinc-700 hover:bg-zinc-200 dark:bg-[#262626] dark:text-zinc-200',
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

                    <div className="relative">
                      <button
                        ref={chatMoreButtonRef}
                        type="button"
                        onClick={() => {
                          setShowAttachMenu(false)
                          setSelectedMessageIds([])
                          setShowSelectionMoreMenu(false)
                          setShowNewChatModal(false)
                          setShowSettingsModal(false)
                          if (isRecordingVoice) cancelVoiceRecording()
                          setShowChatMoreMenu((prev) => !prev)
                        }}
                        title="Chat Options"
                        aria-label="Chat options menu"
                        className="flex size-10 shrink-0 items-center justify-center rounded-full text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-white dark:hover:bg-white/10"
                      >
                        <MoreVertical className="size-[20px]" aria-hidden="true" />
                      </button>

                      {showChatMoreMenu && (
                        <div
                          ref={chatMoreMenuRef}
                          className="absolute right-0 top-11 z-40 w-52 overflow-hidden rounded-2xl bg-white py-1.5 text-sm text-foreground shadow-2xl dark:bg-[#0B1014]"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setShowChatMoreMenu(false)
                              setShowStarredModal(true)
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-white/10"
                          >
                            <Star className="size-4 text-amber-500" aria-hidden="true" />
                            <span>Starred messages</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowChatMoreMenu(false)
                              setShowClearChatConfirm(true)
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-white/10"
                          >
                            <Trash2 className="size-4 text-muted-foreground" aria-hidden="true" />
                            <span>Clear chat</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowChatMoreMenu(false)
                              handleToggleShortcut(activeRoom.roomId, activeRoom.title)
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-white/10"
                          >
                            <BookmarkPlus
                              className="size-4 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <span>
                              {shortcutRoomIds.includes(activeRoom.roomId)
                                ? 'Remove shortcut'
                                : 'Add shortcut'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowChatMoreMenu(false)
                              setShowAddToListModal(true)
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-white/10"
                          >
                            <ListPlus
                              className="size-4 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <span>Add to list</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Pinned Message Banner */}
              {pinnedMessage && (
                <div className="flex items-center justify-between gap-2 bg-[#0095F6]/[0.07] px-3.5 py-2 dark:bg-[#0B1014]">
                  <button
                    type="button"
                    onClick={() => scrollToMessage(pinnedMessage.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <Pin
                      className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                        Pinned • {formatMessengerDisplayName(pinnedMessage.senderName, pinnedMessage.senderRole)}
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

              {/* Scrollable Message Stream — Instagram DM Layout */}
              <div
                className={cn(
                  'flex-1 overflow-y-auto px-2.5 py-4 sm:px-5 transition-colors',
                  chatSettings.chatWallpaper === 'default' &&
                    'dark:bg-black',
                  chatSettings.chatWallpaper === 'pitch_dark' &&
                    'bg-white dark:bg-black',
                  chatSettings.chatWallpaper === 'soft_mint' &&
                    'bg-[#f2f9f4] dark:bg-[#070d0a]',
                  chatSettings.chatWallpaper === 'warm_slate' &&
                    'bg-[#f6f4f0] dark:bg-[#0c0d11]',
                )}
                onClick={() => {
                  if (selectedMessageIds.length > 0) {
                    setSelectedMessageIds([])
                    setShowSelectionMoreMenu(false)
                  }
                  setShowAttachMenu(false)
                }}
              >
                {/* Subtle Campus Privacy Note */}
                <div className="mx-auto mb-3 max-w-md rounded-full bg-muted/60 px-3.5 py-1.5 text-center text-[11px] text-muted-foreground dark:bg-[#0B1014]">
                  <ShieldCheck
                    className="mr-1 inline-block size-3.5 text-violet-600 dark:text-violet-400"
                    aria-hidden="true"
                  />
                  Messages and files are private to ICS Academy.
                </div>

                {activeMessages.map((msg, idx) => {
                  const prevMsg = idx > 0 ? activeMessages[idx - 1] : null
                  const nextMsg = idx < activeMessages.length - 1 ? activeMessages[idx + 1] : null

                  const msgDay = getIstDayNumber(msg.createdAtMs)
                  const prevDay = prevMsg ? getIstDayNumber(prevMsg.createdAtMs) : null
                  const nextDay = nextMsg ? getIstDayNumber(nextMsg.createdAtMs) : null
                  const showDateDivider = !prevMsg || msgDay !== prevDay

                  const GROUP_GAP_MS = 3 * 60 * 1000
                  const isSameSenderAsPrev =
                    Boolean(prevMsg) &&
                    !showDateDivider &&
                    prevMsg!.senderId === msg.senderId &&
                    Math.abs(msg.createdAtMs - prevMsg!.createdAtMs) <= GROUP_GAP_MS &&
                    !msg.replyTo &&
                    !prevMsg!.replyTo
                  const isSameSenderAsNext =
                    Boolean(nextMsg) &&
                    msgDay === nextDay &&
                    nextMsg!.senderId === msg.senderId &&
                    Math.abs(nextMsg!.createdAtMs - msg.createdAtMs) <= GROUP_GAP_MS &&
                    !nextMsg!.replyTo &&
                    !msg.replyTo

                  const isFirstInGroup = !isSameSenderAsPrev
                  const isLastInGroup = !isSameSenderAsNext
                  const isMine = msg.senderId === actor.id
                  const isGroupChat =
                    activeRoom.type === 'batch_group' || activeRoom.type === 'staff_group'
                  const isPinned = activeRoomMeta.pinnedMessageId === msg.id
                  const isStarred = isMessageStarredByMe(msg)

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
                    isSelected && selectedMessageIds.length === 1
                  const isImageMessage = msg.mediaType === 'image' && Boolean(msg.mediaUrl)
                  const isVoiceMessage = msg.mediaType === 'voice'
                  const isRichCardMessage =
                    msg.mediaType === 'call' ||
                    msg.mediaType === 'pdf' ||
                    msg.mediaType === 'location' ||
                    msg.mediaType === 'contact' ||
                    msg.mediaType === 'poll'
                  const reactionEntries = Object.entries(msg.reactions || {}).filter(
                    ([, users]) => Array.isArray(users) && users.length > 0,
                  )

                  const senderProfile = !isMine ? resolveActorDirectoryProfile(msg.senderId) : null
                  const formattedSenderName = formatMessengerDisplayName(
                    msg.senderName,
                    msg.senderRole,
                  )
                  const senderAvatarUrl =
                    senderProfile?.avatarUrl ||
                    (!isGroupChat && activeRoom.avatarUrl ? activeRoom.avatarUrl : undefined)
                  const senderAvatarText = getMessengerAvatarText(formattedSenderName)

                  // Instagram adaptive pill curves for solo / first / middle / last bubbles
                  const bubbleRadiusClass = isImageMessage
                    ? 'rounded-[20px]'
                    : isMine
                      ? isFirstInGroup && isLastInGroup
                        ? 'rounded-[22px]'
                        : isFirstInGroup
                          ? 'rounded-[22px] rounded-br-[5px]'
                          : isLastInGroup
                            ? 'rounded-[22px] rounded-tr-[5px]'
                            : 'rounded-[22px] rounded-r-[5px]'
                      : isFirstInGroup && isLastInGroup
                        ? 'rounded-[22px]'
                        : isFirstInGroup
                          ? 'rounded-[22px] rounded-bl-[5px]'
                          : isLastInGroup
                            ? 'rounded-[22px] rounded-tl-[5px]'
                            : 'rounded-[22px] rounded-l-[5px]'

                  const showBelowGroupMeta = isLastInGroup || isStarred || isPinned

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
                        'group relative flex flex-col transition-colors duration-150 rounded-2xl',
                        idx === 0 ? 'mt-0' : isFirstInGroup ? 'mt-3' : 'mt-[3px]',
                        isSelected && 'bg-violet-500/12 px-1.5 py-0.5 dark:bg-white/[0.11]',
                      )}
                    >
                      {/* Centered Instagram IST Date Divider */}
                      {showDateDivider && (
                        <div className="my-3 flex items-center justify-center">
                          <span className="font-poppins text-[11px] font-medium tracking-wider text-muted-foreground/80 dark:text-zinc-400">
                            {formatInstagramDateDivider(msg.createdAtMs)}
                          </span>
                        </div>
                      )}

                      {/* Incoming Group Sender Name (only above first message in a group chat cluster) */}
                      {!isMine && isGroupChat && isFirstInGroup && (
                        <div className="mb-1 pl-9 text-left">
                          <span
                            className={cn(
                              'text-[11px] font-semibold',
                              msg.senderRole === 'principal'
                                ? 'text-amber-600 dark:text-amber-400'
                                : msg.senderRole === 'usthad'
                                  ? 'text-violet-600 dark:text-violet-300'
                                  : 'text-muted-foreground dark:text-zinc-400',
                            )}
                          >
                            {formattedSenderName}
                          </span>
                        </div>
                      )}

                      {/* Instagram-Style Quoted Reply Above Bubble */}
                      {msg.replyTo && (
                        <div
                          className={cn(
                            'mb-1 flex flex-col',
                            isMine ? 'items-end' : 'items-start pl-9',
                          )}
                        >
                          <span className="mb-1 text-[10.5px] font-medium text-muted-foreground dark:text-zinc-400">
                            {isMine
                              ? `You replied to ${formatMessengerDisplayName(msg.replyTo.senderName)}`
                              : `Replied to ${formatMessengerDisplayName(msg.replyTo.senderName)}`}
                          </span>
                          <div
                            className={cn(
                              'flex max-w-[78%] items-stretch gap-2',
                              isMine ? 'flex-row-reverse' : 'flex-row',
                            )}
                          >
                            <span className="w-[3px] shrink-0 rounded-full bg-zinc-400/50 dark:bg-zinc-600" />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                scrollToMessage(msg.replyTo!.messageId)
                              }}
                              className={cn(
                                'truncate rounded-[18px] px-3 py-1.5 text-left text-xs transition-opacity hover:opacity-90',
                                isMine
                                  ? 'bg-[#efefef] text-zinc-700 dark:bg-[#1f1f24] dark:text-zinc-300'
                                  : 'bg-violet-600/15 text-violet-950 dark:bg-[#2a214a] dark:text-zinc-200',
                              )}
                            >
                              {msg.replyTo.previewText}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Main Bubble Row (Bottom-left avatar for incoming last-in-group) */}
                      <div
                        className={cn(
                          'flex items-end gap-2',
                          isMine ? 'justify-end' : 'justify-start',
                        )}
                      >
                        {!isMine && (
                          <div className="w-7 shrink-0">
                            {isLastInGroup ? (
                              <div className="flex size-7 items-center justify-center overflow-hidden rounded-full bg-muted font-poppins text-[10px] font-bold text-foreground dark:bg-[#141A1F] dark:text-zinc-200">
                                {senderAvatarUrl ? (
                                  <img
                                    src={senderAvatarUrl}
                                    alt={formattedSenderName}
                                    className="size-full object-cover object-top"
                                  />
                                ) : (
                                  senderAvatarText
                                )}
                              </div>
                            ) : null}
                          </div>
                        )}

                        <div
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowAttachMenu(false)
                            if (longPressTriggeredRef.current) {
                              longPressTriggeredRef.current = false
                              return
                            }
                            // Only single-tap to toggle selection when already in selection mode (after a long press)
                            if (isSelectionActive) {
                              toggleSelectMessage(msg.id)
                            }
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setShowAttachMenu(false)
                            if (!selectedMessageIds.includes(msg.id)) {
                              setSelectedMessageIds((prev) => [...prev, msg.id])
                            }
                          }}
                          onMouseDown={(e) => {
                            if (e.button !== 0 || isSelectionActive) return
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
                          onMouseUp={() => {
                            if (longPressTimerRef.current) {
                              window.clearTimeout(longPressTimerRef.current)
                              longPressTimerRef.current = null
                            }
                          }}
                          onMouseLeave={() => {
                            if (longPressTimerRef.current) {
                              window.clearTimeout(longPressTimerRef.current)
                              longPressTimerRef.current = null
                            }
                          }}
                          onTouchStart={() => {
                            if (isSelectionActive) return
                            longPressTriggeredRef.current = false
                            if (longPressTimerRef.current) {
                              window.clearTimeout(longPressTimerRef.current)
                            }
                            longPressTimerRef.current = window.setTimeout(() => {
                              longPressTriggeredRef.current = true
                              setShowAttachMenu(false)
                              try {
                                if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                                  navigator.vibrate(18)
                                }
                              } catch {
                                // Ignore vibration permission errors
                              }
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
                            'relative max-w-[82%] sm:max-w-[70%] select-none transition-opacity',
                            isSelectionActive ? 'cursor-pointer' : 'cursor-default',
                            bubbleRadiusClass,
                            isImageMessage
                              ? 'overflow-hidden p-0'
                              : isVoiceMessage
                                ? 'px-3.5 py-2.5'
                                : isRichCardMessage
                                  ? 'p-2'
                                  : 'px-4 py-2',
                            isImageMessage && !msg.text
                              ? 'bg-transparent'
                              : isMine
                                ? 'bg-gradient-to-br from-[#c026d3] via-[#7c3aed] to-[#4f46e5] text-white shadow-xs'
                                : 'bg-[#efefef] text-zinc-900 dark:bg-[#262626] dark:text-[#f5f5f5]',
                          )}
                        >

                          {/* Forwarded Label */}
                          {msg.isForwarded && (
                            <div
                              className={cn(
                                'mb-0.5 flex items-center gap-1 text-[10.5px] italic opacity-75',
                                isImageMessage && 'px-3 pt-2',
                              )}
                            >
                              <Forward className="size-3" aria-hidden="true" />
                              <span>Forwarded</span>
                            </div>
                          )}

                          {/* Media Attachment: Instagram-Style Voice Note Pill */}
                          {msg.mediaType === 'voice' && (
                            <div className="flex min-w-[210px] sm:min-w-[245px] items-center gap-2.5">
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
                                  'flex size-9 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95',
                                  isMine
                                    ? 'bg-white/20 text-white hover:bg-white/30'
                                    : 'bg-zinc-900/10 text-zinc-900 hover:bg-zinc-900/15 dark:bg-white/15 dark:text-white dark:hover:bg-white/25',
                                )}
                              >
                                {playingMessageId === msg.id ? (
                                  <Pause className="size-4 fill-current" aria-hidden="true" />
                                ) : (
                                  <Play className="ml-0.5 size-4 fill-current" aria-hidden="true" />
                                )}
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="flex h-7 items-center gap-[2.5px]">
                                  {Array.from({ length: 24 }).map((_, barIdx) => {
                                    const barPct = (barIdx / 24) * 100
                                    const isActiveBar =
                                      playingMessageId === msg.id && playbackProgress >= barPct
                                    const heights = [
                                      28, 62, 46, 86, 40, 96, 58, 76, 36, 90, 52, 82, 64, 94, 48,
                                      72, 84, 44, 60, 88, 50, 68, 54, 38,
                                    ]
                                    return (
                                      <span
                                        key={barIdx}
                                        style={{ height: `${heights[barIdx % heights.length]}%` }}
                                        className={cn(
                                          'w-[2.5px] rounded-full transition-colors',
                                          isActiveBar
                                            ? isMine
                                              ? 'bg-white'
                                              : 'bg-violet-600 dark:bg-white'
                                            : isMine
                                              ? 'bg-white/45'
                                              : 'bg-zinc-900/35 dark:bg-white/45',
                                        )}
                                      />
                                    )
                                  })}
                                </div>
                              </div>

                              <div className="flex shrink-0 flex-col items-end gap-0.5">
                                <span className="font-poppins text-[11px] font-medium tabular-nums opacity-90">
                                  {formatVoiceDuration(msg.mediaDurationSec || 4)}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleCyclePlaybackRate()
                                  }}
                                  className={cn(
                                    'rounded-full px-1.5 py-0.2 font-poppins text-[9.5px] font-semibold',
                                    isMine
                                      ? 'bg-white/20 text-white'
                                      : 'bg-black/10 text-foreground dark:bg-white/15 dark:text-zinc-200',
                                  )}
                                >
                                  {playbackRate}x
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Media Attachment: Voice/Video Call Card */}
                          {msg.mediaType === 'call' && (() => {
                            const cMeta = msg.callMeta
                            const callType: CallMediaType =
                              cMeta?.callType === 'video' ? 'video' : 'voice'
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
                                  'flex min-w-[215px] items-center justify-between gap-3 rounded-2xl p-2',
                                  isMine
                                    ? 'bg-black/15 text-white'
                                    : 'bg-white/70 dark:bg-black/30',
                                )}
                              >
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <div
                                    className={cn(
                                      'flex size-9 shrink-0 items-center justify-center rounded-full',
                                      isMissedOrFailed
                                        ? 'bg-rose-500/20 text-rose-400'
                                        : isMine
                                          ? 'bg-white/20 text-white'
                                          : 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
                                    )}
                                  >
                                    {isMissedOrFailed ? (
                                      <PhoneMissed className="size-4" aria-hidden="true" />
                                    ) : callType === 'video' ? (
                                      <Video className="size-4" aria-hidden="true" />
                                    ) : isCallerMe ? (
                                      <PhoneOutgoing className="size-4" aria-hidden="true" />
                                    ) : (
                                      <PhoneIncoming className="size-4" aria-hidden="true" />
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
                                          ? isMine
                                            ? 'text-rose-200'
                                            : 'text-rose-500 dark:text-rose-400'
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
                                      className={cn(
                                        'inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[11px] font-bold transition-colors disabled:opacity-45',
                                        isMine
                                          ? 'bg-white/20 text-white hover:bg-white/30'
                                          : 'bg-violet-600 text-white hover:bg-violet-700',
                                      )}
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
                                'flex min-w-[220px] items-center justify-between gap-3 rounded-2xl p-2',
                                isMine
                                  ? 'bg-black/15 text-white'
                                  : 'bg-white/75 dark:bg-black/30',
                              )}
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                <div
                                  className={cn(
                                    'flex size-9 shrink-0 items-center justify-center rounded-xl',
                                    isMine
                                      ? 'bg-white/20 text-white'
                                      : 'bg-red-500/15 text-red-600 dark:bg-red-500/20 dark:text-red-400',
                                  )}
                                >
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
                                className={cn(
                                  'inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[11px] font-bold transition-colors',
                                  isMine
                                    ? 'bg-white/20 text-white hover:bg-white/30'
                                    : 'bg-violet-600 text-white hover:bg-violet-700',
                                )}
                              >
                                <Download className="size-3.5" aria-hidden="true" />
                                <span>PDF</span>
                              </button>
                            </div>
                          )}

                          {/* Media Attachment: Borderless Instagram-Curved Photo with Preserved HD Badge */}
                          {msg.mediaType === 'image' && msg.mediaUrl && (
                            <div className="relative overflow-hidden rounded-[20px]">
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
                                  className="block max-h-80 w-full rounded-[20px] object-cover"
                                />
                              </button>

                              {/* Preserved HD Badge on Bottom-Left of Photo */}
                              {msg.imageQuality === 'hd' && (
                                <span
                                  title={
                                    msg.imageDimensions
                                      ? `HD Photo (${msg.imageDimensions})`
                                      : 'HD Quality Photo'
                                  }
                                  className="pointer-events-none absolute bottom-2 left-2.5 inline-flex items-center justify-center rounded-md border border-white/80 bg-black/60 px-1.5 py-0.5 font-poppins text-[9px] font-bold tracking-wider text-white backdrop-blur-[2px]"
                                >
                                  HD
                                </span>
                              )}
                            </div>
                          )}

                          {/* Media Attachment: Shared Location Card */}
                          {msg.mediaType === 'location' && msg.locationMeta && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className={cn(
                                'w-[240px] sm:w-[260px] overflow-hidden rounded-2xl',
                                isMine
                                  ? 'bg-black/20 text-white'
                                  : 'bg-white/80 dark:bg-black/35',
                              )}
                            >
                              <div className="relative flex h-24 items-center justify-center bg-[radial-gradient(circle_at_50%_45%,rgba(124,58,237,0.34),rgba(15,23,42,0.16)_72%)] dark:bg-[radial-gradient(circle_at_50%_45%,rgba(124,58,237,0.38),rgba(0,0,0,0.92)_75%)]">
                                <div className="flex size-11 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-900/40">
                                  <MapPin className="size-5" aria-hidden="true" />
                                </div>
                              </div>
                              <div className="p-2.5">
                                <p className="truncate text-xs font-bold">{msg.locationMeta.label}</p>
                                {msg.locationMeta.address && (
                                  <p className="mt-0.5 line-clamp-2 text-[11px] opacity-80">
                                    {msg.locationMeta.address}
                                  </p>
                                )}
                                <a
                                  href={`https://www.google.com/maps?q=${msg.locationMeta.latitude},${msg.locationMeta.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn(
                                    'mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
                                    isMine
                                      ? 'bg-white/20 text-white hover:bg-white/30'
                                      : 'bg-violet-600/15 text-violet-700 hover:bg-violet-600/25 dark:bg-violet-500/25 dark:text-violet-200',
                                  )}
                                >
                                  <ExternalLink className="size-3.5" aria-hidden="true" />
                                  <span>Open in Maps</span>
                                </a>
                              </div>
                            </div>
                          )}

                          {/* Media Attachment: Shared ICS Academy Contact Card */}
                          {msg.mediaType === 'contact' && msg.contactMeta && (() => {
                            const cm = msg.contactMeta
                            const formattedContactName = formatMessengerDisplayName(cm.name, cm.role)
                            const initials = getMessengerAvatarText(formattedContactName)
                            const directRoomId = makeDirectRoomId(actor.id, cm.actorId)
                            const isSelfContact = cm.actorId === actor.id
                            return (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className={cn(
                                  'w-[235px] sm:w-[255px] overflow-hidden rounded-2xl',
                                  isMine
                                    ? 'bg-black/20 text-white'
                                    : 'bg-white/80 dark:bg-black/35',
                                )}
                              >
                                <div className="flex items-center gap-2.5 p-2.5">
                                  <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-violet-500/20 font-poppins text-xs font-bold text-violet-300">
                                    {cm.avatarUrl ? (
                                      <img
                                        src={cm.avatarUrl}
                                        alt={formattedContactName}
                                        className="size-full object-cover object-top"
                                      />
                                    ) : (
                                      initials || 'IC'
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-bold">
                                      {formattedContactName}
                                    </p>
                                    <p className="truncate text-[10.5px] opacity-75">
                                      {cm.subtitle ||
                                        (cm.role === 'principal'
                                          ? 'Principal'
                                          : cm.role === 'usthad'
                                            ? 'Usthad'
                                            : 'Student')}
                                    </p>
                                  </div>
                                </div>
                                {!isSelfContact && cm.actorId && (
                                  <div
                                    className={cn(
                                      'grid grid-cols-2 divide-x border-t',
                                      isMine
                                        ? 'divide-white/15 border-white/15'
                                        : 'divide-border/70 border-border/70 dark:divide-white/10 dark:border-white/10',
                                    )}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedRoomId(directRoomId)
                                        setMobileShowChatPane(true)
                                      }}
                                      className={cn(
                                        'flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold transition-colors',
                                        isMine
                                          ? 'text-white hover:bg-white/10'
                                          : 'text-violet-700 hover:bg-violet-500/10 dark:text-violet-300',
                                      )}
                                    >
                                      <MessageSquareText className="size-3.5" aria-hidden="true" />
                                      <span>Message</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={Boolean(activeCall)}
                                      onClick={() => {
                                        void startCall(
                                          {
                                            id: cm.actorId,
                                            name: formattedContactName,
                                            role: cm.role,
                                            subtitle: cm.subtitle,
                                            roomId: directRoomId,
                                            avatarUrl: cm.avatarUrl,
                                          },
                                          'voice',
                                        )
                                      }}
                                      className={cn(
                                        'flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold transition-colors disabled:opacity-40',
                                        isMine
                                          ? 'text-white hover:bg-white/10'
                                          : 'text-violet-700 hover:bg-violet-500/10 dark:text-violet-300',
                                      )}
                                    >
                                      <Phone className="size-3.5" aria-hidden="true" />
                                      <span>Call</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })()}

                          {/* Media Attachment: Live Interactive Poll Card */}
                          {msg.mediaType === 'poll' && msg.pollMeta && (() => {
                            const pm = msg.pollMeta
                            const votesMap = pm.votes || {}
                            const allUniqueVoters = new Set<string>()
                            for (const voters of Object.values(votesMap)) {
                              if (Array.isArray(voters)) {
                                for (const v of voters) allUniqueVoters.add(v)
                              }
                            }
                            const totalVoters = allUniqueVoters.size

                            return (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className={cn(
                                  'w-[245px] sm:w-[275px] rounded-2xl p-3',
                                  isMine
                                    ? 'bg-black/20 text-white'
                                    : 'bg-white/80 dark:bg-black/35',
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-bold leading-snug sm:text-[13px]">
                                    {pm.question}
                                  </p>
                                  <BarChart3
                                    className={cn(
                                      'size-4 shrink-0',
                                      isMine
                                        ? 'text-white/90'
                                        : 'text-violet-600 dark:text-violet-400',
                                    )}
                                    aria-hidden="true"
                                  />
                                </div>
                                <p className="mt-0.5 text-[10px] opacity-75">
                                  {pm.allowMultiple ? 'Select one or more' : 'Select one'}
                                </p>

                                <div className="mt-2.5 flex flex-col gap-2">
                                  {pm.options.map((opt) => {
                                    const optVoters = Array.isArray(votesMap[opt.id])
                                      ? votesMap[opt.id]
                                      : []
                                    const votedByMe = optVoters.includes(actor.id)
                                    const pct =
                                      totalVoters > 0
                                        ? Math.round((optVoters.length / totalVoters) * 100)
                                        : 0
                                    return (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => handleVotePoll(msg, opt.id)}
                                        className="group w-full text-left"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="flex min-w-0 items-center gap-2">
                                            <span
                                              className={cn(
                                                'flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                                                votedByMe
                                                  ? isMine
                                                    ? 'border-white bg-white text-violet-700'
                                                    : 'border-violet-500 bg-violet-500 text-white'
                                                  : isMine
                                                    ? 'border-white/50 group-hover:border-white'
                                                    : 'border-foreground/35 group-hover:border-violet-500',
                                              )}
                                            >
                                              {votedByMe && (
                                                <Check
                                                  className="size-2.5 stroke-[3]"
                                                  aria-hidden="true"
                                                />
                                              )}
                                            </span>
                                            <span className="truncate text-xs font-medium">
                                              {opt.text}
                                            </span>
                                          </span>
                                          <span className="shrink-0 font-poppins text-[10.5px] font-semibold tabular-nums opacity-85">
                                            {optVoters.length}
                                          </span>
                                        </div>
                                        <div
                                          className={cn(
                                            'mt-1.5 h-1.5 w-full overflow-hidden rounded-full',
                                            isMine ? 'bg-white/20' : 'bg-foreground/12',
                                          )}
                                        >
                                          <div
                                            className={cn(
                                              'h-full rounded-full transition-all duration-300',
                                              isMine ? 'bg-white' : 'bg-violet-500',
                                            )}
                                            style={{ width: `${pct}%` }}
                                          />
                                        </div>
                                      </button>
                                    )
                                  })}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setPollVotesViewerMsgId(msg.id)}
                                  className={cn(
                                    'mt-2.5 w-full border-t pt-2 text-center text-[11px] font-semibold transition-colors',
                                    isMine
                                      ? 'border-white/15 text-white/95 hover:text-white'
                                      : 'border-border/60 text-violet-700 hover:text-violet-600 dark:border-white/10 dark:text-violet-300',
                                  )}
                                >
                                  View votes ({totalVoters})
                                </button>
                              </div>
                            )
                          })()}

                          {/* Message Body Text (Clean inside bubble — no clutter) */}
                          {msg.mediaType !== 'voice' &&
                            msg.mediaType !== 'call' &&
                            msg.mediaType !== 'location' &&
                            msg.mediaType !== 'contact' &&
                            msg.mediaType !== 'poll' &&
                            msg.text && (
                              <p
                                className={cn(
                                  'whitespace-pre-wrap break-words leading-snug',
                                  isImageMessage && 'px-3 py-2',
                                  chatSettings.chatFontSize === 'small'
                                    ? 'text-[12.5px] sm:text-[13px]'
                                    : chatSettings.chatFontSize === 'large'
                                      ? 'text-[15.5px] sm:text-base'
                                      : 'text-[14px] sm:text-[14.5px]',
                                )}
                              >
                                {msg.text}
                              </p>
                            )}
                        </div>
                      </div>

                      {/* Clean Below-Group IST Timestamp, Star/Pin & Read Ticks */}
                      {showBelowGroupMeta && (
                        <div
                          className={cn(
                            'mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/80 dark:text-zinc-500',
                            isMine ? 'justify-end pr-1' : 'justify-start pl-9',
                          )}
                        >
                          {isStarred && (
                            <Star
                              className="size-2.5 fill-amber-400 text-amber-500 dark:text-amber-400"
                              aria-label="Starred message"
                            />
                          )}
                          {isPinned && (
                            <Pin className="size-2.5 opacity-80" aria-label="Pinned message" />
                          )}
                          <span className="font-poppins tabular-nums">
                            {formatChatTime(msg.createdAtMs)}
                          </span>
                          {isMine && (
                            <span
                              title={
                                isReadByOthers
                                  ? 'Seen / Read'
                                  : isDeliveredToOthers
                                    ? 'Delivered'
                                    : 'Sent'
                              }
                              className="inline-flex items-center"
                            >
                              {isReadByOthers ? (
                                <CheckCheck
                                  className="size-3.5 text-[#38bdf8] stroke-[2.5]"
                                  aria-label="Read"
                                />
                              ) : isDeliveredToOthers ? (
                                <CheckCheck
                                  className="size-3.5 text-muted-foreground/80 dark:text-zinc-400 stroke-[2.2]"
                                  aria-label="Delivered"
                                />
                              ) : (
                                <Check
                                  className="size-3 text-muted-foreground/70 dark:text-zinc-500 stroke-[2.2]"
                                  aria-label="Sent"
                                />
                              )}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Quick Floating Emoji Reaction Bar (Shown when 1 message is selected) */}
                      {showSingleReactionPill && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            'z-20 mt-1.5 flex items-center gap-1 rounded-full bg-card px-2.5 py-1 shadow-xl dark:bg-[#0B1014]',
                            isMine ? 'self-end' : 'self-start ml-9',
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
                        <div
                          className={cn(
                            'mt-1 flex flex-wrap items-center gap-1',
                            isMine ? 'justify-end' : 'justify-start pl-9',
                          )}
                        >
                          {reactionEntries.map(([emoji, reactorIds]) => {
                            const iReacted = reactorIds.includes(actor.id)
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleToggleReaction(msg.id, emoji)}
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                                  iReacted
                                    ? 'bg-[#0095F6]/15 text-[#0077CC] dark:bg-[#0095F6]/20 dark:text-[#38BDF8]'
                                    : 'bg-card/90 text-muted-foreground hover:text-foreground dark:bg-[#0B1014]',
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

              {/* Reply Preview Banner or Pending Media Preview (Preserves HD / Standard Toggle) */}
              {(replyingTo || pendingAttachment) && (
                <div className="flex items-center justify-between gap-2 bg-card/95 px-3.5 py-2 dark:bg-black">
                  {replyingTo ? (
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-[#0077CC] dark:text-[#0095F6]">
                        Replying to {formatMessengerDisplayName(replyingTo.senderName)}
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
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground dark:bg-[#141A1F]">
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
                        <div className="flex shrink-0 items-center gap-1 rounded-full bg-muted p-0.5 dark:bg-[#141A1F]">
                          <button
                            type="button"
                            onClick={() => handleSelectPhotoQuality('standard')}
                            className={cn(
                              'rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors whitespace-nowrap',
                              pendingAttachment.imageQuality !== 'hd'
                                ? 'bg-[#0095F6] text-white'
                                : 'text-muted-foreground hover:text-foreground',
                            )}
                          >
                            Standard
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectPhotoQuality('hd')}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors whitespace-nowrap',
                              pendingAttachment.imageQuality === 'hd'
                                ? 'bg-gradient-to-tr from-[#7C3AED] via-[#4F46E5] to-[#0095F6] text-white'
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
                    className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              )}

              {/* Bottom Composer Bar OR Locked Group Banner — Instagram Pill Composer */}
              {activeRoomMeta.onlyAdminsCanPost && !actor.isStaff ? (
                <div className="flex items-center justify-center gap-2 bg-card px-4 py-3.5 text-center text-xs font-semibold text-muted-foreground dark:bg-black">
                  <Lock className="size-4 shrink-0" aria-hidden="true" />
                  <span>
                    Only Usthads and Principal can send messages in this group
                  </span>
                </div>
              ) : (
                <div className="relative bg-white px-2.5 pb-2.5 pt-1.5 sm:px-4 sm:pb-3 dark:bg-black">
                  {/* Hidden file inputs (Gallery, Camera, Document) */}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileSelected(e, 'image')}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleFileSelected(e, 'image')}
                    className="hidden"
                  />
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept="application/pdf,.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx"
                    onChange={(e) => handleFileSelected(e, 'pdf')}
                    className="hidden"
                  />

                  {/* Instagram Floating Action Popover Menu (Right-anchored above + button) */}
                  {showAttachMenu && (
                      <div
                        ref={attachMenuRef}
                        className="absolute bottom-16 right-3 z-30 w-56 overflow-hidden rounded-2xl bg-white py-1.5 shadow-2xl backdrop-blur-xl dark:bg-[#0B1014]"
                      >
                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachMenu(false)
                          pdfInputRef.current?.click()
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13.5px] font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-white dark:hover:bg-white/10"
                      >
                        <FileText className="size-[18px] text-violet-500 dark:text-zinc-200" aria-hidden="true" />
                        <span>Document</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachMenu(false)
                          setLocError(null)
                          setLocCoords(null)
                          setLocLabel('ICS Academy Manhappatta')
                          setLocAddress("Manhappatta, Da'wa College Campus, Kerala")
                          setShowLocationModal(true)
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13.5px] font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-white dark:hover:bg-white/10"
                      >
                        <MapPin className="size-[18px] text-emerald-500 dark:text-zinc-200" aria-hidden="true" />
                        <span>Location</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachMenu(false)
                          setContactSearchQuery('')
                          setShowContactModal(true)
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13.5px] font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-white dark:hover:bg-white/10"
                      >
                        <User className="size-[18px] text-sky-500 dark:text-zinc-200" aria-hidden="true" />
                        <span>Contact</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachMenu(false)
                          setPollQuestion('')
                          setPollOptions(['', ''])
                          setPollAllowMultiple(false)
                          setShowPollModal(true)
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13.5px] font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-white dark:hover:bg-white/10"
                      >
                        <BarChart3 className="size-[18px] text-amber-500 dark:text-zinc-200" aria-hidden="true" />
                        <span>Poll</span>
                      </button>

                      <div className="my-1 border-t border-border/60 dark:border-white/10" />

                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachMenu(false)
                          imageInputRef.current?.click()
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13.5px] font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-white dark:hover:bg-white/10"
                      >
                        <ImageIcon className="size-[18px] text-blue-500 dark:text-zinc-200" aria-hidden="true" />
                        <span>Gallery (HD)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachMenu(false)
                          cameraInputRef.current?.click()
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13.5px] font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-white dark:hover:bg-white/10"
                      >
                        <Camera className="size-[18px] text-rose-500 dark:text-zinc-200" aria-hidden="true" />
                        <span>Camera</span>
                      </button>
                    </div>
                  )}

                  {isRecordingVoice ? (
                    /* Instagram Full-Pill Indigo-Violet Live Waveform Voice Recorder */
                    <div className="flex items-center gap-2.5 rounded-full bg-gradient-to-r from-[#5851db] via-[#4f46e5] to-[#6366f1] px-1.5 py-1.5 text-white shadow-md">
                      <button
                        type="button"
                        onClick={cancelVoiceRecording}
                        aria-label="Discard voice recording"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[#4f46e5] shadow-xs transition-transform active:scale-95"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>

                      <div className="flex h-7 min-w-0 flex-1 items-center gap-[3px] overflow-hidden px-1">
                        {Array.from({ length: 28 }).map((_, barIdx) => {
                          const baseHeights = [
                            22, 34, 24, 52, 38, 72, 46, 86, 58, 92, 64, 78, 52, 88, 70, 44, 80,
                            62, 94, 56, 74, 48, 66, 40, 54, 32, 42, 26,
                          ]
                          const waveShift = (barIdx + recordingSeconds * 3) % baseHeights.length
                          const heightPct = baseHeights[waveShift]
                          return (
                            <span
                              key={barIdx}
                              style={{ height: `${Math.max(18, heightPct)}%` }}
                              className="w-[2.5px] shrink-0 rounded-full bg-white/90 transition-all duration-300"
                            />
                          )
                        })}
                      </div>

                      <span className="shrink-0 font-poppins text-xs font-semibold tabular-nums text-white/95">
                        {formatVoiceDurationPadded(recordingSeconds)}
                      </span>

                      <button
                        type="button"
                        onClick={finishAndSendVoiceRecording}
                        aria-label="Send voice message"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[#4f46e5] shadow-xs transition-transform hover:scale-105 active:scale-95"
                      >
                        <ArrowUp className="size-4 stroke-[2.6]" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    /* Instagram DM Pill Composer: Camera (Left) · Message... · Mic · Gallery · Saved · Plus (Right) */
                    <form
                      onSubmit={handleFormSubmit}
                      className="flex min-w-0 w-full items-center gap-1 rounded-full bg-[#efefef] p-1.5 transition-colors dark:bg-[#262626]"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachMenu(false)
                          setSelectedMessageIds([])
                          setShowSelectionMoreMenu(false)
                          cameraInputRef.current?.click()
                        }}
                        title="Open Camera"
                        aria-label="Take a photo with camera"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#4f46e5] text-white shadow-xs transition-transform active:scale-95 hover:opacity-95"
                      >
                        <Camera className="size-[18px]" aria-hidden="true" />
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
                            ? 'Add a caption...'
                            : 'Message...'
                        }
                        className="h-9 min-w-0 flex-1 bg-transparent px-2 text-[14px] text-zinc-950 placeholder:text-zinc-500 focus:outline-none dark:text-white dark:placeholder:text-zinc-400"
                      />

                      {inputText.trim().length > 0 || pendingAttachment ? (
                        <button
                          type="submit"
                          onClick={() => {
                            setShowAttachMenu(false)
                            setSelectedMessageIds([])
                            setShowSelectionMoreMenu(false)
                          }}
                          aria-label="Send message"
                          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#c026d3] via-[#7c3aed] to-[#4f46e5] px-4 text-xs font-bold text-white shadow-xs transition-opacity hover:opacity-95"
                        >
                          <Send className="size-3.5" aria-hidden="true" />
                          <span>Send</span>
                        </button>
                      ) : (
                        <div className="flex shrink-0 items-center gap-0.5 pr-0.5">
                          <button
                            type="button"
                            onClick={startVoiceRecording}
                            title="Record voice message"
                            aria-label="Record voice message"
                            className="flex size-9 items-center justify-center rounded-full text-zinc-800 transition-colors hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
                          >
                            <Mic className="size-[19px]" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowAttachMenu(false)
                              setSelectedMessageIds([])
                              setShowSelectionMoreMenu(false)
                              imageInputRef.current?.click()
                            }}
                            title="Photo Gallery (HD)"
                            aria-label="Choose photo from gallery"
                            className="flex size-9 items-center justify-center rounded-full text-zinc-800 transition-colors hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
                          >
                            <ImageIcon className="size-[19px]" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowAttachMenu(false)
                              setSelectedMessageIds([])
                              setShowSelectionMoreMenu(false)
                              setShowStarredModal(true)
                            }}
                            title="Saved / Starred Messages"
                            aria-label="Open saved messages"
                            className="flex size-9 items-center justify-center rounded-full text-zinc-800 transition-colors hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
                          >
                            <Bookmark className="size-[18px]" aria-hidden="true" />
                          </button>

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
                            title="More attachments (Document, Location, Contact, Poll)"
                            aria-label="Open attachment options"
                            className={cn(
                              'flex size-9 items-center justify-center rounded-full transition-colors',
                              showAttachMenu
                                ? 'bg-violet-600 text-white'
                                : 'text-zinc-800 hover:bg-black/5 dark:text-white dark:hover:bg-white/10',
                            )}
                          >
                            <PlusCircle className="size-[19px]" aria-hidden="true" />
                          </button>
                        </div>
                      )}
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
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
          onClick={() => setShowNewChatModal(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-card shadow-2xl dark:bg-[#0B1014]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
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
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-[#1C2329]"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="px-4 pb-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={newChatSearchQuery}
                  onChange={(e) => setNewChatSearchQuery(e.target.value)}
                  placeholder="Search any Usthad or Student by name or class..."
                  className="h-10 w-full rounded-full border-0 bg-muted pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none dark:bg-[#141A1F]"
                />
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-5">
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
                              className="flex items-center justify-between rounded-2xl bg-muted/60 px-3.5 py-2.5 text-left transition-colors hover:bg-muted dark:bg-[#141A1F] dark:hover:bg-[#1C2329]"
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                {u.avatarUrl ? (
                                  <img
                                    src={u.avatarUrl}
                                    alt={u.name}
                                    className="size-8 shrink-0 rounded-full object-cover object-top"
                                  />
                                ) : null}
                                <p className="truncate text-xs font-bold text-foreground">
                                  {u.name}
                                </p>
                              </div>
                              <span className="rounded-full bg-[#0095F6]/15 px-3 py-1 text-[10px] font-bold text-[#0077CC] dark:text-[#0095F6]">
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
                          className="h-8 rounded-full border-0 bg-muted px-3 text-[11px] font-semibold dark:bg-[#141A1F]"
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
                        {matchingStudents.map((st) => {
                          const messengerStudentName = formatMessengerStudentName(st.name)
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => {
                                setSelectedRoomId(makeDirectRoomId(actor.id, st.id))
                                setMobileShowChatPane(true)
                                setShowNewChatModal(false)
                                setNewChatSearchQuery('')
                              }}
                              className="flex items-center justify-between rounded-2xl bg-muted/60 px-3.5 py-2.5 text-left transition-colors hover:bg-muted dark:bg-[#141A1F] dark:hover:bg-[#1C2329]"
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                {st.avatarUrl ? (
                                  <img
                                    src={st.avatarUrl}
                                    alt={messengerStudentName}
                                    className="size-8 shrink-0 rounded-full object-cover object-top"
                                  />
                                ) : (
                                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0095F6]/15 font-poppins text-[11px] font-bold text-[#0077CC] dark:text-[#0095F6]">
                                    {getMessengerAvatarText(messengerStudentName)}
                                  </span>
                                )}
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-bold text-foreground">
                                    {messengerStudentName}
                                  </p>
                                  <p className="truncate text-[10px] text-muted-foreground">
                                    Class {st.className} • {st.admissionNo}
                                  </p>
                                </div>
                              </div>
                              <span className="rounded-full bg-[#0095F6]/15 px-3 py-1 text-[10px] font-bold text-[#0077CC] dark:text-[#0095F6]">
                                Chat
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* INSTAGRAM-STYLE CHAT SETTINGS MODAL */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-card shadow-2xl dark:bg-[#0B1014]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-[#0095F6]/15 text-[#0077CC] dark:text-[#0095F6]">
                  <Settings className="size-4.5" aria-hidden="true" />
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
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-[#1C2329]"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            {/* Settings Content */}
            <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-5 pt-2">
              {/* Saved / Starred Messages Quick Access */}
              <button
                type="button"
                onClick={() => {
                  setShowSettingsModal(false)
                  setShowStarredModal(true)
                }}
                className="flex w-full items-center justify-between gap-3 rounded-2xl bg-muted/60 p-3.5 text-left transition-colors hover:bg-muted dark:bg-[#141A1F] dark:hover:bg-[#1C2329]"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
                    <Star className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-foreground">Starred Messages</p>
                    <p className="text-[11px] text-muted-foreground">
                      {allStarredItems.length === 0
                        ? 'No saved messages yet'
                        : `${allStarredItems.length} saved ${allStarredItems.length === 1 ? 'message' : 'messages'} synced across devices`}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-[#0095F6]/15 px-3 py-1 text-[11px] font-semibold text-[#0077CC] dark:text-[#0095F6]">
                  View
                </span>
              </button>

              {/* 1. Privacy Settings */}
              <div className="space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  1. Privacy &amp; Presence
                </p>

                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-muted/60 p-3.5 transition-colors hover:bg-muted dark:bg-[#141A1F] dark:hover:bg-[#1C2329]">
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
                    className="size-4 shrink-0 accent-[#0095F6]"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-muted/60 p-3.5 transition-colors hover:bg-muted dark:bg-[#141A1F] dark:hover:bg-[#1C2329]">
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
                    className="size-4 shrink-0 accent-[#0095F6]"
                  />
                </label>
              </div>

              {/* 2. Chat Appearance & Font Size */}
              <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  2. Appearance &amp; Font
                </p>

                <div className="rounded-2xl bg-muted/60 p-3.5 dark:bg-[#141A1F]">
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
                            'rounded-full px-2.5 py-2 text-xs font-semibold transition-all active:scale-[0.98]',
                            active
                              ? 'bg-[#0095F6] text-white'
                              : 'bg-card text-muted-foreground hover:text-foreground dark:bg-[#0B1014] dark:hover:bg-[#1C2329]',
                          )}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded-2xl bg-muted/60 p-3.5 dark:bg-[#141A1F]">
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
                            'rounded-full px-2.5 py-2 text-[11px] font-semibold transition-all active:scale-[0.98]',
                            active
                              ? 'bg-[#0095F6] text-white'
                              : 'bg-card text-muted-foreground hover:text-foreground dark:bg-[#0B1014] dark:hover:bg-[#1C2329]',
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

                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-muted/60 p-3.5 transition-colors hover:bg-muted dark:bg-[#141A1F] dark:hover:bg-[#1C2329]">
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
                    className="size-4 shrink-0 accent-[#0095F6]"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-muted/60 p-3.5 transition-colors hover:bg-muted dark:bg-[#141A1F] dark:hover:bg-[#1C2329]">
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
                    className="size-4 shrink-0 accent-[#0095F6]"
                  />
                </label>

                <div className="rounded-2xl bg-muted/60 p-3.5 dark:bg-[#141A1F]">
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
                            'rounded-full px-3 py-2 text-xs font-semibold transition-all active:scale-[0.98]',
                            active
                              ? 'bg-[#0095F6] text-white'
                              : 'bg-card text-muted-foreground hover:text-foreground dark:bg-[#0B1014] dark:hover:bg-[#1C2329]',
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
                    className="inline-flex items-center gap-1.5 rounded-full bg-muted/80 px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted dark:bg-[#141A1F] dark:hover:bg-[#1C2329]"
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
                    className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-4 py-2 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/25"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    <span>Clear All Chats</span>
                  </button>
                </div>

                {settingsToast && (
                  <p className="rounded-2xl bg-[#0095F6]/15 px-3.5 py-2 text-xs font-semibold text-[#0077CC] dark:text-[#0095F6]">
                    {settingsToast}
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end bg-muted/40 px-5 py-3.5 dark:bg-black/40">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="rounded-full bg-[#0095F6] px-6 py-2 text-xs font-bold text-white transition-all hover:bg-[#0084DC] active:scale-[0.98]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSTAGRAM-STYLE DELETE MESSAGE DIALOG (Single & Multi-Select) */}
      {deleteModalMessages.length > 0 && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
          onClick={() => setDeleteModalMessages([])}
        >
          <div
            className="w-full max-w-[320px] overflow-hidden rounded-3xl bg-card p-5 shadow-2xl dark:bg-[#0B1014]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-foreground">
              {deleteModalMessages.length === 1
                ? 'Delete message?'
                : `Delete ${deleteModalMessages.length} messages?`}
            </h3>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {deleteModalMessages.every((m) => m.isDeleted)
                ? 'Remove deleted messages from your chat screen.'
                : 'You can delete selected messages for everyone in this chat or only for yourself.'}
            </p>

            <div className="mt-5 flex flex-col gap-1.5">
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
                    className="w-full rounded-full bg-red-500/12 px-4 py-2.5 text-center text-xs font-bold text-red-500 transition-colors hover:bg-red-500/20"
                  >
                    Delete for everyone
                  </button>
                )}

              <button
                type="button"
                onClick={() => handleDeleteForMe(deleteModalMessages.map((m) => m.id))}
                className="w-full rounded-full bg-muted/70 px-4 py-2.5 text-center text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/15 dark:bg-[#141A1F] dark:hover:bg-red-500/15"
              >
                Delete for me
              </button>

              <button
                type="button"
                onClick={() => setDeleteModalMessages([])}
                className="w-full rounded-full px-4 py-2.5 text-center text-xs font-semibold text-[#0077CC] transition-colors hover:bg-[#0095F6]/12 dark:text-[#0095F6]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSTAGRAM-STYLE FORWARD TO MODAL (Single & Multi-Message, Multi-Recipient) */}
      {forwardMessageIds.length > 0 && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
          onClick={() => {
            setForwardMessageIds([])
            setForwardTargetRoomIds([])
          }}
        >
          <div
            className="flex max-h-[86vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-card shadow-2xl dark:bg-[#0B1014]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-[#0095F6]/15 text-[#0077CC] dark:text-[#0095F6]">
                  <Forward className="size-4.5" aria-hidden="true" />
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
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-[#1C2329]"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col gap-2.5 px-4 pb-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={forwardSearchQuery}
                  onChange={(e) => setForwardSearchQuery(e.target.value)}
                  placeholder="Search groups, teachers, or students..."
                  className="h-10 w-full rounded-full border-0 bg-muted pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none dark:bg-[#141A1F]"
                />
              </div>

              <div className="flex items-center justify-between gap-2.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Filter students:
                </span>
                <ThemeSelect
                  value={forwardBatchFilter}
                  onChange={(e) => setForwardBatchFilter(e.target.value)}
                  className="h-8 flex-1 rounded-full border-0 bg-muted px-3 text-[11px] font-semibold dark:bg-[#141A1F]"
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

            <div className="flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
              {allForwardRooms
                .filter((r) => {
                  const meta = roomsMeta[r.roomId]
                  if (meta?.onlyAdminsCanPost && !actor.isStaff) return false
                  const fq = forwardSearchQuery.trim().toLowerCase()
                  if (fq) {
                    return (
                      r.title.toLowerCase().includes(fq) ||
                      (r.searchName || '').toLowerCase().includes(fq) ||
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
                        'flex w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-left transition-colors',
                        checked
                          ? 'bg-[#0095F6]/15'
                          : 'hover:bg-muted/70 dark:hover:bg-[#141A1F]',
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        {room.avatarUrl ? (
                          <img
                            src={room.avatarUrl}
                            alt={room.title}
                            className="size-9 shrink-0 rounded-full object-cover object-top"
                          />
                        ) : (
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted font-poppins text-xs font-bold text-foreground dark:bg-[#141A1F] dark:text-zinc-200">
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
                          'flex size-6 shrink-0 items-center justify-center rounded-full transition-colors',
                          checked
                            ? 'bg-[#0095F6] text-white'
                            : 'bg-muted dark:bg-[#1C2329]',
                        )}
                      >
                        {checked && <Check className="size-3.5 stroke-[3]" aria-hidden="true" />}
                      </span>
                    </button>
                  )
                })}
            </div>

            <div className="flex items-center justify-between gap-3 bg-muted/40 px-4 py-3.5 dark:bg-black/40">
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
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#0095F6] px-5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#0084DC] active:scale-[0.98] disabled:opacity-40"
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
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
          onClick={() => setShowStarredModal(false)}
        >
          <div
            className="flex max-h-[86vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-card shadow-2xl dark:bg-[#0B1014]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
                  <Star className="size-4.5 fill-amber-400" aria-hidden="true" />
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
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-[#1C2329]"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto px-4 pb-5 pt-2">
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
                    className="rounded-2xl bg-muted/60 p-3.5 transition-colors hover:bg-muted dark:bg-[#141A1F] dark:hover:bg-[#1C2329]"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate font-bold text-[#0077CC] dark:text-[#0095F6]">
                        {msg.senderId === actor.id
                          ? 'You'
                          : formatMessengerDisplayName(msg.senderName, msg.senderRole)}{' '}
                        • {roomTitle}
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
                          className="rounded-full p-1 text-amber-500 hover:bg-amber-500/15"
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
                      <span className="mt-1.5 inline-block text-[10px] font-semibold text-[#0077CC] dark:text-[#0095F6]">
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

      {/* INSTAGRAM-STYLE PHOTO PREVIEW & HD / STANDARD QUALITY SELECTOR MODAL */}
      {pendingAttachment && pendingAttachment.mediaType === 'image' && (
        <div
          className="fixed inset-0 z-[78] flex flex-col justify-between bg-black text-white pt-[max(var(--safe-top),2.75rem)] pb-[max(env(safe-area-inset-bottom,0px),0.75rem)] sm:pt-3"
          onClick={() => setShowPhotoQualitySheet(false)}
        >
          {/* Top Bar: Placed cleanly below phone status bar (clock/battery) */}
          <div
            className="z-20 flex shrink-0 items-center justify-between bg-black px-4 py-3 sm:px-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setPendingAttachment(null)
                setShowPhotoQualitySheet(false)
              }}
              aria-label="Cancel photo upload"
              className="flex size-10 items-center justify-center rounded-full bg-[#141A1F] text-white transition-colors hover:bg-[#1C2329]"
            >
              <X className="size-5" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-2">
              {/* Direct Standard / HD Segmented Selector + Sheet Trigger */}
              <div className="flex items-center rounded-full bg-[#141A1F] p-1">
                <button
                  type="button"
                  onClick={() => handleSelectPhotoQuality('standard')}
                  className={cn(
                    'flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-all',
                    pendingAttachment.imageQuality !== 'hd'
                      ? 'bg-[#0095F6] text-white'
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
                      ? 'bg-[#0095F6] text-white'
                      : 'text-zinc-300 hover:text-white',
                  )}
                >
                  <span
                    className={cn(
                      'rounded px-1 py-0.2 font-poppins text-[9px] font-extrabold leading-tight',
                      pendingAttachment.imageQuality === 'hd'
                        ? 'bg-white/20 text-white'
                        : 'bg-white/10 text-zinc-200',
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
                className="hidden h-9 items-center rounded-full bg-[#141A1F] px-3.5 text-[11px] font-semibold text-zinc-200 transition-colors hover:bg-[#1C2329] sm:inline-flex"
              >
                Details
              </button>
            </div>
          </div>

          {/* Center Photo Preview Area + Toast + Photo Quality Bottom Sheet */}
          <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-2">
            {photoQualityToast && (
              <div className="pointer-events-none absolute top-3 z-20 rounded-full bg-[#0B1014]/95 px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
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

            {/* Photo quality Selector Sheet */}
            {showPhotoQualitySheet && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-3 z-30 w-full max-w-sm rounded-3xl bg-[#0B1014] p-5 text-white shadow-2xl"
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
                      'flex w-full items-center justify-between rounded-2xl px-3.5 py-3 text-left transition-colors',
                      pendingAttachment.imageQuality !== 'hd'
                        ? 'bg-[#0095F6]/15'
                        : 'bg-[#141A1F] hover:bg-[#1C2329]',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'flex size-5 items-center justify-center rounded-full',
                          pendingAttachment.imageQuality !== 'hd'
                            ? 'bg-[#0095F6] text-white'
                            : 'bg-[#1C2329]',
                        )}
                      >
                        {pendingAttachment.imageQuality !== 'hd' && (
                          <Check className="size-3 stroke-[3]" aria-hidden="true" />
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
                      'flex w-full items-center justify-between rounded-2xl px-3.5 py-3 text-left transition-colors',
                      pendingAttachment.imageQuality === 'hd'
                        ? 'bg-[#0095F6]/15'
                        : 'bg-[#141A1F] hover:bg-[#1C2329]',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'flex size-5 items-center justify-center rounded-full',
                          pendingAttachment.imageQuality === 'hd'
                            ? 'bg-[#0095F6] text-white'
                            : 'bg-[#1C2329]',
                        )}
                      >
                        {pendingAttachment.imageQuality === 'hd' && (
                          <Check className="size-3 stroke-[3]" aria-hidden="true" />
                        )}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-white">HD quality</p>
                          <span className="rounded bg-[#0095F6]/20 px-1.5 py-0.5 font-poppins text-[9px] font-bold text-[#0095F6]">
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

          {/* Bottom Caption & Send Bar */}
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
                className="h-11 flex-1 rounded-full border-0 bg-[#141A1F] px-4 text-xs text-white placeholder:text-zinc-400 focus:outline-none sm:text-sm"
              />
              <button
                type="submit"
                aria-label="Send photo"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#7C3AED] via-[#4F46E5] to-[#0095F6] text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
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
                className="font-semibold text-[#0095F6] hover:underline"
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
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/92 px-4 pt-[max(var(--safe-top),2.75rem)] pb-[max(env(safe-area-inset-bottom,0px),1rem)]"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-[#0B1014] p-2.5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2 text-xs text-white">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-semibold">{lightboxImage.name}</span>
                {lightboxImage.quality === 'hd' && (
                  <span className="rounded-full bg-[#0095F6]/20 px-2 py-0.5 font-poppins text-[9px] font-bold tracking-wider text-[#0095F6]">
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
                    className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-3 py-1.5 text-[11px] font-bold text-red-300 transition-colors hover:bg-red-500/30"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    <span>Delete</span>
                  </button>
                )}
                <a
                  href={lightboxImage.url}
                  download={lightboxImage.name}
                  className="inline-flex items-center gap-1 rounded-full bg-[#0095F6] px-3.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#0084DC]"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  aria-label="Close photo viewer"
                  className="flex size-8 items-center justify-center rounded-full bg-[#141A1F] text-white transition-colors hover:bg-[#1C2329]"
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
                className="max-h-[72vh] w-auto rounded-2xl object-contain"
              />
            </div>
          </div>
        </div>
      )}
      {/* CLEAR CHAT CONFIRMATION MODAL */}
      {showClearChatConfirm && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
          onClick={() => setShowClearChatConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-card p-5 shadow-2xl dark:bg-[#0B1014]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-base font-bold text-foreground">
              Clear this chat?
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Messages in &ldquo;{activeRoom.title}&rdquo; will be cleared from your view. Other
              members will still keep their copy.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowClearChatConfirm(false)}
                className="rounded-full bg-muted/70 px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted dark:bg-[#141A1F] dark:hover:bg-[#1C2329]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearCurrentChat}
                className="rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-rose-700"
              >
                Clear chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD TO LIST MODAL */}
      {showAddToListModal && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
          onClick={() => setShowAddToListModal(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-3xl bg-card shadow-2xl dark:bg-[#0B1014]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <div>
                <h3 className="font-display text-base font-bold text-foreground">Add to list</h3>
                <p className="truncate text-xs text-muted-foreground">{activeRoom.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddToListModal(false)}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-[#1C2329]"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-64 space-y-1.5 overflow-y-auto px-4 py-2">
              {customLists.map((list) => {
                const included = list.roomIds.includes(activeRoom.roomId)
                return (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => handleToggleRoomInList(list.id, activeRoom.roomId)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left transition-colors',
                      included
                        ? 'bg-[#0095F6]/15'
                        : 'bg-muted/50 hover:bg-muted dark:bg-[#141A1F] dark:hover:bg-[#1C2329]',
                    )}
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{list.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {list.roomIds.length} {list.roomIds.length === 1 ? 'chat' : 'chats'}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'flex size-5 items-center justify-center rounded-full transition-colors',
                        included
                          ? 'bg-[#0095F6] text-white'
                          : 'bg-muted dark:bg-[#1C2329]',
                      )}
                    >
                      {included && <Check className="size-3.5 stroke-[3]" aria-hidden="true" />}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="bg-muted/40 p-4 dark:bg-black/40">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="Create new list (e.g. Study)..."
                  maxLength={32}
                  className="h-9 flex-1 rounded-full border-0 bg-muted px-3.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none dark:bg-[#141A1F]"
                />
                <button
                  type="button"
                  disabled={!newListName.trim()}
                  onClick={handleCreateCustomList}
                  className="inline-flex h-9 items-center gap-1 rounded-full bg-[#0095F6] px-4 text-xs font-bold text-white transition-colors hover:bg-[#0084DC] disabled:opacity-40"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEND LOCATION MODAL */}
      {showLocationModal && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
          onClick={() => setShowLocationModal(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-3xl bg-card shadow-2xl dark:bg-[#0B1014]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-full bg-[#0095F6]/15 text-[#0077CC] dark:text-[#0095F6]">
                  <MapPin className="size-4" aria-hidden="true" />
                </span>
                <h3 className="font-display text-base font-bold text-foreground">Share Location</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-[#1C2329]"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-3 px-5 pb-5 pt-2">
              <button
                type="button"
                disabled={locLoading}
                onClick={handleDetectCurrentLocation}
                className="flex w-full items-center gap-3 rounded-2xl bg-[#0095F6]/12 p-3 text-left transition-colors hover:bg-[#0095F6]/20"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0095F6] text-white">
                  <Navigation className="size-4.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground">
                    {locLoading ? 'Detecting GPS location...' : 'Detect my current GPS location'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {locCoords
                      ? `Locked: ${locCoords.lat.toFixed(5)}, ${locCoords.lng.toFixed(5)}`
                      : 'Tap to capture exact coordinates from your phone'}
                  </p>
                </div>
              </button>

              {locError && (
                <p className="rounded-2xl bg-amber-500/15 px-3.5 py-2 text-[11px] text-amber-600 dark:text-amber-300">
                  {locError}
                </p>
              )}

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-muted-foreground">
                  Place Name
                </label>
                <input
                  type="text"
                  value={locLabel}
                  onChange={(e) => setLocLabel(e.target.value)}
                  maxLength={120}
                  className="h-10 w-full rounded-xl border-0 bg-muted px-3.5 text-xs text-foreground focus:outline-none dark:bg-[#141A1F]"
                />
                <label className="block text-[11px] font-semibold text-muted-foreground">
                  Address / Note
                </label>
                <input
                  type="text"
                  value={locAddress}
                  onChange={(e) => setLocAddress(e.target.value)}
                  maxLength={180}
                  className="h-10 w-full rounded-xl border-0 bg-muted px-3.5 text-xs text-foreground focus:outline-none dark:bg-[#141A1F]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLocationModal(false)}
                  className="rounded-full bg-muted/70 px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted dark:bg-[#141A1F] dark:hover:bg-[#1C2329]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleSendLocationMessage({
                      label: locLabel.trim() || 'ICS Academy Manhappatta',
                      address: locAddress.trim() || undefined,
                      latitude: locCoords?.lat ?? 11.1495,
                      longitude: locCoords?.lng ?? 76.1225,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#0095F6] px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0084DC]"
                >
                  <Send className="size-3.5" aria-hidden="true" />
                  <span>Send Location</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SHARE CONTACT MODAL */}
      {showContactModal && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
          onClick={() => setShowContactModal(false)}
        >
          <div
            className="flex max-h-[82vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-card shadow-2xl dark:bg-[#0B1014]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-full bg-[#0095F6]/15 text-[#0077CC] dark:text-[#0095F6]">
                  <User className="size-4" aria-hidden="true" />
                </span>
                <h3 className="font-display text-base font-bold text-foreground">Share Contact</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-[#1C2329]"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="px-4 pb-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={contactSearchQuery}
                  onChange={(e) => setContactSearchQuery(e.target.value)}
                  placeholder="Search Usthads or students..."
                  className="h-10 w-full rounded-full border-0 bg-muted pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none dark:bg-[#141A1F]"
                />
              </div>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
              {allRooms
                .filter(
                  (r) =>
                    (r.type === 'direct_usthad' || r.type === 'direct_student') &&
                    Boolean(r.peerId) &&
                    (!contactSearchQuery.trim() ||
                      r.title.toLowerCase().includes(contactSearchQuery.trim().toLowerCase()) ||
                      (r.searchName || '')
                        .toLowerCase()
                        .includes(contactSearchQuery.trim().toLowerCase()) ||
                      r.subtitle.toLowerCase().includes(contactSearchQuery.trim().toLowerCase())),
                )
                .map((r) => (
                  <button
                    key={r.roomId}
                    type="button"
                    onClick={() =>
                      handleSendContactMessage({
                        actorId: r.peerId!,
                        name: r.title,
                        role: r.peerRole || 'student',
                        subtitle: r.subtitle,
                        avatarUrl: r.avatarUrl,
                      })
                    }
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-muted/70 dark:hover:bg-[#141A1F]"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0095F6]/15 font-poppins text-xs font-bold text-[#0077CC] dark:text-[#0095F6]">
                      {r.avatarUrl ? (
                        <img
                          src={r.avatarUrl}
                          alt={r.title}
                          className="size-full object-cover object-top"
                        />
                      ) : (
                        r.avatarText
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-foreground">{r.title}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{r.subtitle}</p>
                    </div>
                    <Send className="size-3.5 shrink-0 text-[#0095F6]" aria-hidden="true" />
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* CREATE POLL MODAL */}
      {showPollModal && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
          onClick={() => setShowPollModal(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-card shadow-2xl dark:bg-[#0B1014]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-full bg-[#0095F6]/15 text-[#0077CC] dark:text-[#0095F6]">
                  <BarChart3 className="size-4" aria-hidden="true" />
                </span>
                <h3 className="font-display text-base font-bold text-foreground">Create Poll</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPollModal(false)}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-[#1C2329]"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 space-y-3.5 overflow-y-auto px-5 pb-4 pt-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                  Question
                </label>
                <input
                  type="text"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="Ask a question..."
                  maxLength={220}
                  className="h-10 w-full rounded-xl border-0 bg-muted px-3.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none dark:bg-[#141A1F]"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-muted-foreground">
                  Options
                </label>
                {pollOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const next = [...pollOptions]
                        next[idx] = e.target.value
                        setPollOptions(next)
                      }}
                      placeholder={`Option ${idx + 1}`}
                      maxLength={100}
                      className="h-10 flex-1 rounded-xl border-0 bg-muted px-3.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none dark:bg-[#141A1F]"
                    />
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPollOptions((prev) => prev.filter((_, i) => i !== idx))
                        }
                        aria-label="Remove option"
                        className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-rose-500 dark:hover:bg-[#1C2329]"
                      >
                        <X className="size-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 6 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions((prev) => [...prev, ''])}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#0095F6]/15 px-3.5 py-1.5 text-[11px] font-semibold text-[#0077CC] transition-colors hover:bg-[#0095F6]/25 dark:text-[#0095F6]"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    <span>Add option</span>
                  </button>
                )}
              </div>

              <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-muted/60 px-3.5 py-3 dark:bg-[#141A1F]">
                <span className="text-xs font-medium text-foreground">Allow multiple answers</span>
                <input
                  type="checkbox"
                  checked={pollAllowMultiple}
                  onChange={(e) => setPollAllowMultiple(e.target.checked)}
                  className="size-4 accent-[#0095F6]"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 bg-muted/40 p-4 dark:bg-black/40">
              <button
                type="button"
                onClick={() => setShowPollModal(false)}
                className="rounded-full bg-muted/70 px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted dark:bg-[#141A1F] dark:hover:bg-[#1C2329]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  !pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2
                }
                onClick={handleSendPollMessage}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0095F6] px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0084DC] disabled:opacity-40"
              >
                <Send className="size-3.5" aria-hidden="true" />
                <span>Send Poll</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POLL VOTES VIEWER MODAL */}
      {pollVotesViewerMsgId && (() => {
        const pollMsg = activeMessages.find((m) => m.id === pollVotesViewerMsgId)
        if (!pollMsg?.pollMeta) return null
        const pm = pollMsg.pollMeta
        return (
          <div
            className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
            onClick={() => setPollVotesViewerMsgId(null)}
          >
            <div
              className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-card shadow-2xl dark:bg-[#0B1014]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 pb-3 pt-5">
                <div className="min-w-0 pr-2">
                  <h3 className="font-display text-base font-bold text-foreground">Poll votes</h3>
                  <p className="truncate text-xs text-muted-foreground">{pm.question}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPollVotesViewerMsgId(null)}
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-[#1C2329]"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-5 pt-2">
                {pm.options.map((opt) => {
                  const voters = Array.isArray(pm.votes?.[opt.id]) ? pm.votes[opt.id] : []
                  return (
                    <div key={opt.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-foreground">{opt.text}</p>
                        <span className="text-[11px] font-semibold text-[#0077CC] dark:text-[#0095F6] tabular-nums">
                          {voters.length} {voters.length === 1 ? 'vote' : 'votes'}
                        </span>
                      </div>
                      {voters.length === 0 ? (
                        <p className="text-[11px] italic text-muted-foreground">No votes yet</p>
                      ) : (
                        <div className="space-y-1">
                          {voters.map((voterId) => {
                            const profile = resolveActorDirectoryProfile(voterId)
                            return (
                              <div
                                key={voterId}
                                className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 dark:bg-[#141A1F]"
                              >
                                <span className="flex size-6 items-center justify-center rounded-full bg-[#0095F6]/15 text-[10px] font-bold text-[#0077CC] dark:text-[#0095F6]">
                                  {profile.avatarText}
                                </span>
                                <span className="truncate text-xs font-medium text-foreground">
                                  {voterId === actor.id ? `${profile.name} (You)` : profile.name}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}
    </section>
  )
}
