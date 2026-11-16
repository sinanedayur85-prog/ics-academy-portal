'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
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
  Crown,
  Download,
  FileText,
  Image as ImageIcon,
  Lock,
  MessageSquarePlus,
  MessageSquareText,
  Mic,
  MoreVertical,
  Paperclip,
  Pause,
  Pin,
  Play,
  Reply,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smile,
  Sparkles,
  Trash2,
  Unlock,
  Users,
  Volume2,
  X,
} from 'lucide-react'
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
import { unlockNotificationAudio } from '@/lib/mobile-pdf'
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase'
import { cn } from '@/lib/utils'

export type MessengerRole = 'student' | 'usthad' | 'principal'

export interface ChatReplyRef {
  messageId: string
  senderName: string
  previewText: string
}

export interface ChatMessage {
  id: string
  roomId: string
  senderId: string
  senderName: string
  senderRole: MessengerRole
  senderBadge?: string
  text: string
  mediaType: 'none' | 'voice' | 'image' | 'pdf'
  mediaUrl?: string
  mediaName?: string
  mediaSizeLabel?: string
  mediaDurationSec?: number
  imageQuality?: 'standard' | 'hd'
  imageDimensions?: string
  replyTo?: ChatReplyRef
  reactions: Record<string, string[]>
  deliveredTo?: string[]
  readBy: string[]
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
    readBy:
      Array.isArray(msg.readBy) && msg.readBy.length > 0
        ? msg.readBy.slice(0, 300)
        : [msg.senderId],
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

function formatChatTime(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return 'Just now'
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

  // Filter tabs & search
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | 'groups' | 'usthads' | 'students' | 'staff'
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
    setDeleteModalMessage(null)
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(`ics_chat_deleted_for_me_${actor.id}`)
        setDeletedForMeIds(raw ? (JSON.parse(raw) as string[]) : [])
      } catch {
        setDeletedForMeIds([])
      }
    }
  }, [actor.className, actor.id])

  // Composer & Message Action Modal state
  const [inputText, setInputText] = useState('')
  const [replyingTo, setReplyingTo] = useState<ChatReplyRef | null>(null)
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null)
  const [deleteModalMessage, setDeleteModalMessage] = useState<ChatMessage | null>(null)
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

    // 4. Direct Chats with Students (Show only name)
    const targetStudents = students.filter((s) => {
      if (s.id === actor.id) return false
      const dId = makeDirectRoomId(actor.id, s.id)
      const hasHistory = (messagesByRoom[dId]?.length ?? 0) > 0
      if (hasHistory) return true
      if (studentBatchFilter === 'ALL') return true
      return s.className === studentBatchFilter
    })

    for (const st of targetStudents) {
      list.push({
        roomId: makeDirectRoomId(actor.id, st.id),
        type: 'direct_student',
        title: st.name,
        subtitle: '',
        badgeLabel: '',
        batchName: st.className,
        peerId: st.id,
        peerRole: 'student',
        avatarText: st.firstName.slice(0, 2).toUpperCase(),
        avatarUrl: st.avatarUrl,
      })
    }

    return list
  }, [actor.id, actor.className, actor.isStaff, messagesByRoom, studentBatchFilter])

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

  const isMessageHiddenForMe = useCallback(
    (msg: ChatMessage) => {
      if (deletedForMeIds.includes(msg.id)) return true
      if (Array.isArray(msg.deletedFor) && msg.deletedFor.includes(actor.id)) return true
      return false
    },
    [deletedForMeIds, actor.id],
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

              // Monotonically union readBy & deliveredTo across local and server states
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

              // Merge reactions across endpoints
              const mergedReactions: Record<string, string[]> = {
                ...(existing?.reactions ?? {}),
                ...(sm.reactions ?? {}),
              }

              const mergedMsg: ChatMessage = shouldBeDeleted
                ? {
                    ...sm,
                    deliveredTo: mergedDeliveredTo,
                    readBy: mergedReadBy,
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
                    readBy: mergedReadBy,
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
              readBy: Array.isArray(raw.readBy)
                ? raw.readBy.map(String)
                : [String(raw.senderId || '')],
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

            // Immediately acknowledge delivery in Firestore if this room belongs to the current user
            const isMyRoom =
              (msg.roomId.startsWith('direct__') &&
                msg.roomId.split('__').includes(actor.id)) ||
              (msg.roomId === STAFF_ROOM_ID && actor.isStaff) ||
              (msg.roomId.startsWith('batch_group__') &&
                (actor.isStaff || msg.roomId === makeBatchRoomId(actor.className)))

            if (
              isMyRoom &&
              !msg.isDeleted &&
              msg.senderId !== actor.id &&
              !(msg.deliveredTo ?? []).includes(actor.id)
            ) {
              const delivKey = `d:${msg.id}:${actor.id}`
              if (!sentReceiptKeysRef.current.has(delivKey)) {
                sentReceiptKeysRef.current.add(delivKey)
                void updateDoc(doc(db, 'campusChatMessages', msg.id), {
                  deliveredTo: arrayUnion(actor.id),
                }).catch(() => {
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
          (chatSettings.sendReadReceipts && !m.readBy.includes(actor.id))),
    )
    if (toUpdate.length === 0) return

    setMessagesByRoom((prev) => {
      const currentList = prev[rId] ?? []
      return {
        ...prev,
        [rId]: currentList.map((m) => {
          const nextDelivered = Array.from(new Set([...(m.deliveredTo ?? [m.senderId]), actor.id]))
          const nextRead = chatSettings.sendReadReceipts
            ? Array.from(new Set([...m.readBy, actor.id]))
            : m.readBy
          return {
            ...m,
            deliveredTo: nextDelivered,
            readBy: nextRead,
          }
        }),
      }
    })

    for (const m of toUpdate) {
      if (!firestoreMessageIdsRef.current.has(m.id)) continue
      const receiptKey = `${chatSettings.sendReadReceipts ? 'r' : 'd'}:${m.id}:${actor.id}`
      if (sentReceiptKeysRef.current.has(receiptKey)) continue
      sentReceiptKeysRef.current.add(receiptKey)
      void updateDoc(doc(db, 'campusChatMessages', m.id), {
        deliveredTo: arrayUnion(actor.id),
        ...(chatSettings.sendReadReceipts ? { readBy: arrayUnion(actor.id) } : {}),
      }).catch(() => {
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
          text: `last seen today at ${formatChatTime(entry.lastSeenMs)}`,
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
        readBy: [actor.id],
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
    setActiveReactionMessageId(null)
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
    setActiveReactionMessageId(null)
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

  const handleTogglePinMessage = (messageId: string | null) => {
    if (!actor.isStaff) return
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
    void syncRoomMetaToFirestore(rId, activeRoomMeta.onlyAdminsCanPost, nextPin)
    void sendChatActionToServer({
      action: 'toggle_pin',
      roomId: rId,
      pinnedMessageId: nextPin,
    })
  }

  const handleDeleteForEveryone = (messageId: string) => {
    const rId = activeRoom.roomId
    setDeletedForEveryoneMap((prev) => ({
      ...prev,
      [messageId]: { deletedBy: actor.name, deletedById: actor.id },
    }))
    setMessagesByRoom((prev) => {
      const list = prev[rId] ?? []
      return {
        ...prev,
        [rId]: list.map((m) =>
          m.id === messageId
            ? {
                ...m,
                isDeleted: true,
                deletedBy: actor.name,
                deletedById: actor.id,
                text: '',
                mediaType: 'none',
                mediaUrl: undefined,
              }
            : m,
        ),
      }
    })
    if (activeRoomMeta.pinnedMessageId === messageId) {
      handleTogglePinMessage(null)
    }
    setDeleteModalMessage(null)
    setActiveReactionMessageId(null)
    setLightboxImage(null)
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

  const handleDeleteForMe = (messageId: string) => {
    const rId = activeRoom.roomId
    setDeletedForMeIds((prev) => (prev.includes(messageId) ? prev : [...prev, messageId]))
    setMessagesByRoom((prev) => {
      const list = prev[rId] ?? []
      return {
        ...prev,
        [rId]: list.map((m) =>
          m.id === messageId
            ? {
                ...m,
                deletedFor: Array.from(new Set([...(m.deletedFor ?? []), actor.id])),
              }
            : m,
        ),
      }
    })
    setDeleteModalMessage(null)
    setActiveReactionMessageId(null)
    setLightboxImage(null)
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
                  setActiveReactionMessageId(null)
                  setShowSettingsModal(false)
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
                  setActiveReactionMessageId(null)
                  setShowNewChatModal(false)
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
                ] as const
              ).map((tab) => {
                const active = categoryFilter === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCategoryFilter(tab.id)}
                    className={cn(
                      'rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 border',
                      active
                        ? 'border-emerald-600 bg-emerald-600 text-white dark:border-[#343946] dark:bg-[#222630] dark:text-zinc-100'
                        : 'border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* Class selector when viewing Students tab (Staff only) */}
            {categoryFilter === 'students' && actor.isStaff && (
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Filter:
                </span>
                <ThemeSelect
                  value={studentBatchFilter}
                  onChange={(e) => setStudentBatchFilter(e.target.value)}
                  aria-label="Filter students"
                  className="h-8 flex-1 rounded-lg border border-input bg-card px-2.5 text-xs font-semibold text-foreground"
                >
                  <option value={actor.className}>My Class</option>
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

          {/* Scrollable Room List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/50">
            {filteredRooms.map((room) => {
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
                    setActiveReactionMessageId(null)
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
                          {formatChatTime(lastMsg.createdAtMs)}
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
            })}
          </div>
        </div>

        {/* RIGHT PANE: ACTIVE WHATSAPP CONVERSATION WINDOW */}
        <div
          className={cn(
            'flex h-full min-w-0 flex-1 flex-col bg-background lg:bg-background/95',
            !mobileShowChatPane
              ? 'hidden lg:flex'
              : 'flex max-lg:fixed max-lg:inset-0 max-lg:z-[55] max-lg:h-dvh max-lg:w-screen max-lg:pt-[var(--safe-top)] max-lg:pb-[env(safe-area-inset-bottom,0px)]',
          )}
        >
          {/* Active Chat Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowAttachMenu(false)
                  setActiveReactionMessageId(null)
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

            {/* Right Controls: Usthad / Principal Group Lock Toggle + Chat Settings */}
            <div className="flex shrink-0 items-center gap-1.5">
              {actor.isStaff && activeRoom.type === 'batch_group' && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAttachMenu(false)
                    setActiveReactionMessageId(null)
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
                  setActiveReactionMessageId(null)
                  setShowNewChatModal(false)
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

          {/* Pinned Message Banner (If Pinned by Usthad/Principal) */}
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
                    Pinned by Usthad • {pinnedMessage.senderName}
                  </p>
                  <p className="truncate text-xs text-foreground">
                    {pinnedMessage.mediaType === 'pdf'
                      ? `📄 ${pinnedMessage.mediaName} — ${pinnedMessage.text}`
                      : pinnedMessage.text}
                  </p>
                </div>
              </button>
              {actor.isStaff && (
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
              'flex-1 space-y-2.5 overflow-y-auto px-3 py-4 sm:px-5 transition-colors',
              chatSettings.chatWallpaper === 'pitch_dark' &&
                'bg-[#f1f5f9] dark:bg-[#07080a]',
              chatSettings.chatWallpaper === 'soft_mint' &&
                'bg-[#eef8f0] dark:bg-[#0c1110]',
              chatSettings.chatWallpaper === 'warm_slate' &&
                'bg-[#f5f3ef] dark:bg-[#101115]',
            )}
            onClick={() => {
              setActiveReactionMessageId(null)
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
              const otherReadersCount = (msg.readBy ?? []).filter(
                (id) => id && id !== msg.senderId,
              ).length
              const otherDeliveredCount = (msg.deliveredTo ?? []).filter(
                (id) => id && id !== msg.senderId,
              ).length
              const isReadByOthers = otherReadersCount > 0 || (msg.readBy?.length ?? 0) > 1
              const isDeliveredToOthers =
                isReadByOthers || otherDeliveredCount > 0 || (msg.deliveredTo?.length ?? 0) > 1
              const isSelectedMenuOpen = activeReactionMessageId === msg.id
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
                  className={cn(
                    'group relative flex flex-col transition-all duration-200 rounded-2xl',
                    isMine ? 'items-end' : 'items-start',
                  )}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowAttachMenu(false)
                      setActiveReactionMessageId((prev) =>
                        prev === msg.id ? null : msg.id,
                      )
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setShowAttachMenu(false)
                      setActiveReactionMessageId(msg.id)
                      setDeleteModalMessage(msg)
                    }}
                    onTouchStart={() => {
                      if (longPressTimerRef.current) {
                        window.clearTimeout(longPressTimerRef.current)
                      }
                      longPressTimerRef.current = window.setTimeout(() => {
                        setActiveReactionMessageId(msg.id)
                        setDeleteModalMessage(msg)
                      }, 420)
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
                        ? 'rounded-br-xs border-[#bde6b4] bg-[#dcf8c6] text-[#081e21] dark:border-[#262a33] dark:bg-[#1a1d24] dark:text-[#f3f4f6]'
                        : 'rounded-bl-xs border-border bg-card text-foreground dark:border-[#262a33] dark:bg-[#121418] dark:text-[#f3f4f6]',
                      isSelectedMenuOpen && 'ring-2 ring-emerald-500/60 dark:ring-zinc-500',
                    )}
                  >
                    {/* Always-Visible Touch-Friendly Three-Dots Options Button in Top-Right Corner (Works on iPad, iPhone, Android & Desktop) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowAttachMenu(false)
                        setActiveReactionMessageId((prev) =>
                          prev === msg.id ? null : msg.id,
                        )
                      }}
                      aria-label="Message options"
                      className={cn(
                        'absolute right-1.5 top-1.5 z-20 flex size-6 items-center justify-center rounded-full transition-colors',
                        isSelectedMenuOpen
                          ? 'bg-black/20 text-white dark:bg-white/20'
                          : isImageMessage
                            ? 'right-2 top-2 bg-black/55 text-white/95 backdrop-blur-[2px] hover:bg-black/75'
                            : 'text-foreground/70 hover:bg-black/10 dark:text-zinc-300 dark:hover:bg-white/15',
                      )}
                    >
                      <MoreVertical className="size-3.5" aria-hidden="true" />
                    </button>

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

                        {/* Message Body Text (Never shown for voice notes) */}
                        {msg.mediaType !== 'voice' && msg.text && (
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

                    {/* Timestamp & WhatsApp Double Tick (✓ / ✓✓ Grey / ✓✓ Blue) for non-voice & non-captionless-image messages */}
                    {msg.mediaType !== 'voice' && !isImageOnlyWithoutCaption && (
                      <div
                        className={cn(
                          'mt-1 flex items-center justify-end gap-1 text-[10px] opacity-85',
                          isImageMessage && 'px-2 pb-0.5',
                        )}
                      >
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
                    )}
                  </div>

                  {/* Modern WhatsApp Floating Reaction Bar + Three-Dots Context Menu (Shown when message is selected/tapped) */}
                  {isSelectedMenuOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'z-20 mt-1.5 flex flex-col gap-1.5',
                        isMine ? 'items-end' : 'items-start',
                      )}
                    >
                      {/* Floating Emoji Reaction Pill (only for non-deleted messages) */}
                      {!msg.isDeleted && (
                        <div className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 shadow-lg dark:border-[#262a33] dark:bg-[#121418]">
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

                      {/* WhatsApp-Style Action Dropdown Menu */}
                      <div className="flex min-w-[180px] flex-col overflow-hidden rounded-2xl border border-border bg-card py-1 text-xs shadow-xl dark:border-[#262a33] dark:bg-[#121418]">
                        {!msg.isDeleted && (
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingTo({
                                messageId: msg.id,
                                senderName: msg.senderName,
                                previewText:
                                  msg.mediaType === 'voice'
                                    ? `🎤 Voice Note (${formatVoiceDuration(msg.mediaDurationSec || 4)})`
                                    : msg.text ||
                                      (msg.mediaType === 'pdf'
                                        ? `📄 ${msg.mediaName}`
                                        : '📷 Photo'),
                              })
                              setActiveReactionMessageId(null)
                            }}
                            className="flex items-center gap-2.5 px-3.5 py-2.5 text-left font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            <Reply className="size-3.5 text-muted-foreground" aria-hidden="true" />
                            <span>Reply</span>
                          </button>
                        )}

                        {actor.isStaff && !msg.isDeleted && (
                          <button
                            type="button"
                            onClick={() => {
                              handleTogglePinMessage(msg.id)
                              setActiveReactionMessageId(null)
                            }}
                            className="flex items-center gap-2.5 px-3.5 py-2.5 text-left font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            <Pin className="size-3.5 text-muted-foreground" aria-hidden="true" />
                            <span>{isPinned ? 'Unpin Message' : 'Pin Message'}</span>
                          </button>
                        )}

                        {!msg.isDeleted && (
                          <button
                            type="button"
                            onClick={() => handleDeleteForEveryone(msg.id)}
                            className="flex items-center gap-2.5 px-3.5 py-2.5 text-left font-semibold text-red-500 transition-colors hover:bg-red-500/10"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                            <span>Delete for everyone</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteForMe(msg.id)}
                          className="flex items-center gap-2.5 px-3.5 py-2.5 text-left font-semibold text-red-500 transition-colors hover:bg-red-500/10"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                          <span>Delete for me</span>
                        </button>
                      </div>
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
                      setActiveReactionMessageId(null)
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
                      setActiveReactionMessageId(null)
                    }}
                    onClick={() => {
                      setShowAttachMenu(false)
                      setActiveReactionMessageId(null)
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
                      setActiveReactionMessageId(null)
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
        </div>
      </div>

      {/* NEW CHAT DIRECTORY MODAL (Quickly Start Direct Chat with Any Usthad or Student) */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl dark:border-[#262a33] dark:bg-[#121418]">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 dark:border-[#262a33]">
              <div>
                <h3 className="font-display text-base font-bold text-foreground">
                  Start Direct Chat (Usthads & Students)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Select any Usthad or Student to open a 1-to-1 conversation
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

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Teaching & Class Usthads (9)
                </p>
                <div className="grid gap-1.5">
                  {OFFICIAL_CLASS_USTHADS.filter((u) => u.id !== actor.id).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setSelectedRoomId(makeDirectRoomId(actor.id, u.id))
                        setMobileShowChatPane(true)
                        setShowNewChatModal(false)
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
                        <p className="truncate text-xs font-bold text-foreground">{u.name}</p>
                      </div>
                      <span className="rounded-lg border border-border bg-muted px-2 py-1 text-[10px] font-bold text-foreground dark:border-[#262a33] dark:bg-[#1a1d24] dark:text-zinc-100">
                        Message
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Students
                  </p>
                  {actor.isStaff && (
                    <ThemeSelect
                      value={studentBatchFilter}
                      onChange={(e) => setStudentBatchFilter(e.target.value)}
                      className="h-7 rounded-lg border border-input bg-background px-2 text-[11px] font-semibold dark:border-[#262a33] dark:bg-[#0a0b0e]"
                    >
                      <option value={actor.className}>My Class</option>
                      <option value="ALL">All Classes</option>
                      {ACADEMY_CLASSES.map((c) => (
                        <option key={c.id} value={c.className}>
                          Class {c.className}
                        </option>
                      ))}
                    </ThemeSelect>
                  )}
                </div>
                <div className="grid gap-1.5">
                  {students
                    .filter(
                      (s) =>
                        s.id !== actor.id &&
                        (studentBatchFilter === 'ALL' || s.className === studentBatchFilter),
                    )
                    .slice(0, 40)
                    .map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          setSelectedRoomId(makeDirectRoomId(actor.id, st.id))
                          setMobileShowChatPane(true)
                          setShowNewChatModal(false)
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
                          ) : null}
                          <p className="truncate text-xs font-bold text-foreground">{st.name}</p>
                        </div>
                        <span className="rounded-lg border border-border bg-muted px-2 py-1 text-[10px] font-bold text-foreground dark:border-[#262a33] dark:bg-[#1a1d24] dark:text-zinc-100">
                          Chat
                        </span>
                      </button>
                    ))}
                </div>
              </div>
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

      {/* WHATSAPP-STYLE DELETE MESSAGE DIALOG ("Delete for everyone" & "Delete for me") */}
      {deleteModalMessage && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs"
          onClick={() => setDeleteModalMessage(null)}
        >
          <div
            className="w-full max-w-[320px] overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-2xl dark:border-[#262a33] dark:bg-[#181b22]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-foreground">
              Delete message?
            </h3>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {deleteModalMessage.isDeleted
                ? 'Remove this deleted message from your chat screen.'
                : 'You can delete this message for everyone in this chat or only for yourself.'}
            </p>

            <div className="mt-5 flex flex-col items-end gap-1">
              {!deleteModalMessage.isDeleted && (
                <button
                  type="button"
                  onClick={() => handleDeleteForEveryone(deleteModalMessage.id)}
                  className="w-full rounded-xl px-3.5 py-2.5 text-right text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-[#25d366]"
                >
                  Delete for everyone
                </button>
              )}

              <button
                type="button"
                onClick={() => handleDeleteForMe(deleteModalMessage.id)}
                className="w-full rounded-xl px-3.5 py-2.5 text-right text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-[#25d366]"
              >
                Delete for me
              </button>

              <button
                type="button"
                onClick={() => setDeleteModalMessage(null)}
                className="w-full rounded-xl px-3.5 py-2.5 text-right text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-[#25d366]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP-STYLE PHOTO PREVIEW & HD / STANDARD QUALITY SELECTOR MODAL */}
      {pendingAttachment && pendingAttachment.mediaType === 'image' && (
        <div
          className="fixed inset-0 z-[78] flex flex-col justify-between bg-[#0b1014]/95 text-white backdrop-blur-xs"
          onClick={() => setShowPhotoQualitySheet(false)}
        >
          {/* Top Bar: Close Button + WhatsApp HD Quality Button */}
          <div
            className="flex items-center justify-between px-4 py-3.5 sm:px-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setPendingAttachment(null)
                setShowPhotoQualitySheet(false)
              }}
              aria-label="Cancel photo upload"
              className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <X className="size-5" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-2.5">
              {/* WhatsApp HD Toggle Button */}
              <button
                type="button"
                onClick={() => setShowPhotoQualitySheet((prev) => !prev)}
                aria-label="Select photo quality (Standard or HD)"
                className={cn(
                  'relative flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold tracking-wider transition-all',
                  pendingAttachment.imageQuality === 'hd'
                    ? 'border-[#25d366] bg-[#25d366]/20 text-white shadow-sm'
                    : 'border-white/30 bg-white/10 text-white/90 hover:bg-white/20',
                )}
              >
                <span className="rounded border border-current px-1 py-0.2 font-poppins text-[10px] font-extrabold leading-tight">
                  HD
                </span>
                <span className="text-xs font-semibold">
                  {pendingAttachment.imageQuality === 'hd' ? 'HD Quality' : 'Standard'}
                </span>
                {pendingAttachment.imageQuality === 'hd' && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-[#25d366] text-[#0a0b0e]">
                    <Check className="size-2.5 stroke-[3]" aria-hidden="true" />
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Center Photo Preview Area + Toast + WhatsApp Photo Quality Bottom Sheet */}
          <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-2">
            {photoQualityToast && (
              <div className="pointer-events-none absolute top-3 z-20 rounded-full border border-white/15 bg-black/80 px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
                {photoQualityToast}
              </div>
            )}

            <img
              src={pendingAttachment.mediaUrl}
              alt={pendingAttachment.mediaName}
              referrerPolicy="no-referrer"
              className="max-h-[62vh] max-w-full rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            <p className="mt-2.5 text-[11px] text-white/70 tabular-nums">
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
            className="mx-auto flex w-full max-w-2xl flex-col gap-2.5 px-4 pb-5 pt-2"
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
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl border border-[#262a33] bg-[#121418] p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 text-xs text-white">
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
              <div className="flex items-center gap-2">
                {lightboxImage.messageId && (
                  <button
                    type="button"
                    onClick={() => {
                      const found = activeMessages.find((m) => m.id === lightboxImage.messageId)
                      if (found) {
                        setLightboxImage(null)
                        setDeleteModalMessage(found)
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/20 px-2.5 py-1 text-[11px] font-bold text-red-300 hover:bg-red-500/30"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    <span>Delete</span>
                  </button>
                )}
                <a
                  href={lightboxImage.url}
                  download={lightboxImage.name}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#343946] bg-[#222630] px-2.5 py-1 text-[11px] font-bold text-zinc-100"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  className="rounded-lg p-1 text-white/80 hover:bg-white/10"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.name}
              referrerPolicy="no-referrer"
              className="max-h-[78vh] w-auto rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </section>
  )
}
