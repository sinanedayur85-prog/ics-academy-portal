'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  ShieldCheck,
  Smile,
  Sparkles,
  Trash2,
  Unlock,
  Users,
  X,
} from 'lucide-react'
import {
  ACADEMY_CLASSES,
  ACADEMY_PRINCIPAL,
  CLASS_USTHADS,
  OFFICIAL_CLASS_USTHADS,
  publishCampusNotification,
  students,
  type ClassUsthad,
  type PrincipalProfile,
  type Student,
} from '@/components/dashboard/data'
import { buildKitabPdfBlob, CURATED_KITABS } from '@/components/dashboard/digital-library'
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
  replyTo?: ChatReplyRef
  reactions: Record<string, string[]>
  readBy: string[]
  isDeleted?: boolean
  deletedBy?: string
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
  isStaffOnly?: boolean
}

const LOCAL_CHAT_MESSAGES_KEY = 'ics_campus_messenger_messages_v1'
const LOCAL_CHAT_META_KEY = 'ics_campus_messenger_meta_v1'
const QUICK_REACTIONS = ['👍', '❤️', '🤲', '📚', '✅', '🌟'] as const

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

export function makeDirectRoomId(idA: string, idB: string): string {
  const sorted = [idA.trim(), idB.trim()].sort()
  return `direct__${sorted[0]}__${sorted[1]}`
}

export function makeBatchRoomId(className: string): string {
  return `batch_group__${className}`
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
  const baseTime = 1793420000000
  const map: Record<string, ChatMessage[]> = {}

  // 1. Seed Staff Room Group (Exclusive for Principal & 9 Class Usthads)
  map[STAFF_ROOM_ID] = [
    {
      id: 'seed_staff_1',
      roomId: STAFF_ROOM_ID,
      senderId: ACADEMY_PRINCIPAL.usthadId,
      senderName: ACADEMY_PRINCIPAL.name,
      senderRole: 'principal',
      senderBadge: 'Principal • ADM-001',
      text: 'السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ\nപ്രിയപ്പെട്ട ഉസ്താദുമാരേ, നമ്മുടെ എല്ലാ ബാച്ചുകളിലെയും കിതാബ് പഠന പുരോഗതിയും അറ്റൻഡൻസ് വിവരങ്ങളും കൃത്യമായി വിലയിരുത്തണമെന്ന് ഓർമ്മിപ്പിക്കുന്നു. ക്ലാസ് ഗ്രൂപ്പുകളിൽ പ്രധാനപ്പെട്ട PDF നോട്ടുകൾ പിൻ (Pin) ചെയ്തു വെക്കാവുന്നതാണ്.',
      mediaType: 'none',
      reactions: { '🤲': ['usthad-08', 'usthad-01'], '✅': ['usthad-09', 'usthad-10'] },
      readBy: OFFICIAL_CLASS_USTHADS.map((u) => u.id),
      createdAt: new Date(baseTime - 7200000).toISOString(),
      createdAtMs: baseTime - 7200000,
    },
    {
      id: 'seed_staff_2',
      roomId: STAFF_ROOM_ID,
      senderId: 'usthad-08',
      senderName: 'Usthad Hafiz Fazlul Abid Naeemi',
      senderRole: 'usthad',
      senderBadge: 'Swadr & Class Usthad • UST-08',
      text: 'وَعَلَيْكُمُ السَّلَامُ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ\nഇൻശാ അല്ലാഹ്, വലിയ ബാച്ചുകളിലെയും മറ്റ് ക്ലാസുകളിലെയും പരീക്ഷാ സിലബസ് PDF നോട്ടുകൾ ഇന്ന് തന്നെ ഗ്രൂപ്പുകളിൽ പങ്കുവെക്കുന്നതാണ്.',
      mediaType: 'none',
      replyTo: {
        messageId: 'seed_staff_1',
        senderName: ACADEMY_PRINCIPAL.name,
        previewText: 'പ്രിയപ്പെട്ട ഉസ്താദുമാരേ, നമ്മുടെ എല്ലാ ബാച്ചുകളിലെയും കിതാബ് പഠന പുരോഗതിയും...',
      },
      reactions: { '👍': [ACADEMY_PRINCIPAL.usthadId, 'usthad-01'] },
      readBy: OFFICIAL_CLASS_USTHADS.map((u) => u.id),
      createdAt: new Date(baseTime - 5400000).toISOString(),
      createdAtMs: baseTime - 5400000,
    },
  ]

  // 2. Seed all 11 Class Batch Groups
  for (const cls of ACADEMY_CLASSES) {
    const rId = makeBatchRoomId(cls.className)
    const assignedUsthad =
      CLASS_USTHADS.find((u) => u.className === cls.className) ?? OFFICIAL_CLASS_USTHADS[0]
    const batchStudents = students.filter((s) => s.className === cls.className)
    const firstLeader = batchStudents[0]
    const sampleKitab = CURATED_KITABS[0]

    map[rId] = [
      {
        id: `seed_${cls.id}_1`,
        roomId: rId,
        senderId: assignedUsthad.id,
        senderName: assignedUsthad.name,
        senderRole:
          assignedUsthad.id === ACADEMY_PRINCIPAL.usthadId ? 'principal' : 'usthad',
        senderBadge: `${assignedUsthad.designation.split('•')[0].trim()} • ${assignedUsthad.staffId}`,
        text: `السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ\nപ്രിയ വിദ്യാർത്ഥികളേ, ${cls.fullLabel} ഔദ്യോഗിക ക്ലാസ് ഗ്രൂപ്പിലേക്ക് സ്വാഗതം. ക്ലാസ് നോട്ടുകൾ, വോയിസ് വിശദീകരണങ്ങൾ, പഠന സംശയങ്ങൾ എന്നിവ ഇവിടെ പങ്കുവെക്കാം.`,
        mediaType: 'none',
        reactions: {
          '🤲': batchStudents.slice(0, 4).map((s) => s.id),
          '❤️': batchStudents.slice(0, 2).map((s) => s.id),
        },
        readBy: [assignedUsthad.id, ...batchStudents.slice(0, 6).map((s) => s.id)],
        createdAt: new Date(baseTime - 10800000).toISOString(),
        createdAtMs: baseTime - 10800000,
      },
      {
        id: `seed_${cls.id}_2`,
        roomId: rId,
        senderId: assignedUsthad.id,
        senderName: assignedUsthad.name,
        senderRole:
          assignedUsthad.id === ACADEMY_PRINCIPAL.usthadId ? 'principal' : 'usthad',
        senderBadge: `${assignedUsthad.designation.split('•')[0].trim()} • ${assignedUsthad.staffId}`,
        text: `ഇന്നത്തെ ഫിഖ്ഹ് / കിതാബ് പഠനത്തിന് ആവശ്യമായ റഫറൻസ് നോട്ട് (PDF) ചുവടെ ചേർക്കുന്നു. എല്ലാവരും ഡൗൺലോഡ് ചെയ്ത് വായിക്കുക.`,
        mediaType: 'pdf',
        mediaName: `${sampleKitab.title.replace(/\s+/g, '_')}_Study_Notes.pdf`,
        mediaSizeLabel: '1.4 MB • PDF Note',
        reactions: { '📚': batchStudents.slice(0, 3).map((s) => s.id) },
        readBy: [assignedUsthad.id, ...batchStudents.slice(0, 5).map((s) => s.id)],
        createdAt: new Date(baseTime - 7200000).toISOString(),
        createdAtMs: baseTime - 7200000,
      },
      ...(firstLeader
        ? [
            {
              id: `seed_${cls.id}_3`,
              roomId: rId,
              senderId: firstLeader.id,
              senderName: firstLeader.name,
              senderRole: 'student' as const,
              senderBadge: `Student • ${firstLeader.admissionNo}`,
              text: 'وَعَلَيْكُمُ السَّلَامُ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ\nജസാക്കല്ലാഹു ഖൈറൻ ഉസ്താദ്, നോട്ട് ലഭിച്ചു. ഇൻശാ അല്ലാഹ് ഇന്ന് തന്നെ മുത്വാലഅ ചെയ്ത് തയ്യാറാകുന്നതാണ്.',
              mediaType: 'none' as const,
              replyTo: {
                messageId: `seed_${cls.id}_2`,
                senderName: assignedUsthad.name,
                previewText: 'ഇന്നത്തെ ഫിഖ്ഹ് / കിതാബ് പഠനത്തിന് ആവശ്യമായ റഫറൻസ് നോട്ട് (PDF)...',
              },
              reactions: { '👍': [assignedUsthad.id] },
              readBy: [assignedUsthad.id, firstLeader.id],
              createdAt: new Date(baseTime - 3600000).toISOString(),
              createdAtMs: baseTime - 3600000,
            },
          ]
        : []),
    ]
  }

  return map
}

function buildInitialSeedMeta(): Record<string, ChatRoomMeta> {
  const meta: Record<string, ChatRoomMeta> = {}
  for (const cls of ACADEMY_CLASSES) {
    const rId = makeBatchRoomId(cls.className)
    meta[rId] = {
      roomId: rId,
      onlyAdminsCanPost: false,
      pinnedMessageId: `seed_${cls.id}_2`,
      updatedAtMs: 1793420000000,
    }
  }
  meta[STAFF_ROOM_ID] = {
    roomId: STAFF_ROOM_ID,
    onlyAdminsCanPost: false,
    pinnedMessageId: 'seed_staff_1',
    updatedAtMs: 1793420000000,
  }
  return meta
}

function loadLocalMessages(): Record<string, ChatMessage[]> {
  const seeded = buildInitialSeedMessages()
  if (typeof window === 'undefined') return seeded
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
}

export function CampusMessenger({
  role,
  student,
  usthad,
  principal = ACADEMY_PRINCIPAL,
  activeClassName,
  mobileFullScreen = false,
}: CampusMessengerProps) {
  // Resolve current actor identity
  const actor = useMemo(() => {
    if (role === 'principal') {
      return {
        id: principal.usthadId || 'usthad-07',
        name: principal.name,
        role: 'principal' as MessengerRole,
        badge: `Principal • ${principal.staffId}`,
        className: principal.assignedClassName || 'BS 3 • Batch 07',
        isStaff: true,
      }
    }
    if (role === 'usthad' && usthad) {
      const isPrincipalDual = usthad.id === ACADEMY_PRINCIPAL.usthadId
      return {
        id: usthad.id,
        name: usthad.name,
        role: (isPrincipalDual ? 'principal' : 'usthad') as MessengerRole,
        badge: `${usthad.designation.split('•')[0].trim()} • ${usthad.staffId}`,
        className: activeClassName || usthad.className,
        isStaff: true,
      }
    }
    const activeStudent = student ?? students[0]
    return {
      id: activeStudent.id,
      name: activeStudent.name,
      role: 'student' as MessengerRole,
      badge: `${activeStudent.className} • ${activeStudent.admissionNo}`,
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

  // Keep default room synced when student/usthad switches class
  useEffect(() => {
    setSelectedRoomId(makeBatchRoomId(actor.className))
    setStudentBatchFilter(actor.className)
  }, [actor.className, actor.id])

  // Composer state
  const [inputText, setInputText] = useState('')
  const [replyingTo, setReplyingTo] = useState<ChatReplyRef | null>(null)
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [pendingAttachment, setPendingAttachment] = useState<{
    mediaType: 'image' | 'pdf'
    mediaUrl: string
    mediaName: string
    mediaSizeLabel: string
  } | null>(null)
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null)

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
  const lastTypingSentMsRef = useRef<number>(0)

  // Build available rooms for this user
  const allRooms = useMemo<ChatRoomDescriptor[]>(() => {
    const list: ChatRoomDescriptor[] = []

    // 1. Staff Room (Strictly for Principal & Usthads only)
    if (actor.isStaff) {
      list.push({
        roomId: STAFF_ROOM_ID,
        type: 'staff_group',
        title: 'ICS Usthads & Principal Staff Room',
        subtitle: 'Official Faculty & Academic Council Group (9 Usthads)',
        badgeLabel: 'Staff Room',
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
        const assignedUsthad = CLASS_USTHADS.find((u) => u.className === cls.className)
        const count = students.filter((s) => s.className === cls.className).length
        list.push({
          roomId: makeBatchRoomId(cls.className),
          type: 'batch_group',
          title: `${cls.fullLabel} • Official Group`,
          subtitle: `${assignedUsthad?.name || 'Class Usthad'} • ${count} Students`,
          badgeLabel: cls.batch,
          batchName: cls.className,
          avatarText: cls.batch.replace('Batch ', 'B'),
        })
      }
    } else {
      // Student sees ONLY their own batch group
      const myCls =
        ACADEMY_CLASSES.find((c) => c.className === actor.className) ?? ACADEMY_CLASSES[0]
      const assignedUsthad = CLASS_USTHADS.find((u) => u.className === myCls.className)
      const count = students.filter((s) => s.className === myCls.className).length
      list.push({
        roomId: makeBatchRoomId(myCls.className),
        type: 'batch_group',
        title: `${myCls.fullLabel} • Class Group`,
        subtitle: `Class Usthad: ${assignedUsthad?.name || 'Usthad'} • ${count} Students`,
        badgeLabel: myCls.batch,
        batchName: myCls.className,
        avatarText: myCls.batch.replace('Batch ', 'B'),
      })
    }

    // 3. Direct Chats with all 9 Teaching & Class Usthads (Principal, Swadr & Class Usthads)
    for (const u of OFFICIAL_CLASS_USTHADS) {
      if (u.id === actor.id) continue
      const isMyClassUsthad = u.className === actor.className
      const isPrincipalUsthad = u.id === ACADEMY_PRINCIPAL.usthadId
      list.push({
        roomId: makeDirectRoomId(actor.id, u.id),
        type: 'direct_usthad',
        title: u.name,
        subtitle: isPrincipalUsthad
          ? `Principal & Class Usthad (${u.className})`
          : isMyClassUsthad
            ? `Your Class Usthad • ${u.className}`
            : `${u.designation.split('•')[0].trim()} • ${u.className}`,
        badgeLabel: isPrincipalUsthad
          ? 'Principal'
          : isMyClassUsthad
            ? 'Class Usthad'
            : 'Usthad',
        batchName: u.className,
        peerId: u.id,
        peerRole: isPrincipalUsthad ? 'principal' : 'usthad',
        avatarText: u.name
          .replace(/^Usthad\s+/i, '')
          .slice(0, 2)
          .toUpperCase(),
      })
    }

    // 4. Direct Chats with Students
    // Always include students who already have messages with this user + students in the active batch filter
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
        subtitle: `Student • ${st.className} (${st.admissionNo})`,
        badgeLabel: st.className.split('•')[0].trim(),
        batchName: st.className,
        peerId: st.id,
        peerRole: 'student',
        avatarText: st.firstName.slice(0, 2).toUpperCase(),
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

  // Real-Time Server Sync Helper
  const sendChatActionToServer = useCallback(
    async (payload: Record<string, unknown>) => {
      const bases = getOrderedChatSyncBases()
      for (const base of bases) {
        try {
          const res = await fetch(`${base}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              actorId: actor.id,
              actorName: actor.name,
              actorRole: actor.role,
              ...payload,
            }),
          })
          if (res.ok) {
            const data = (await res.json()) as {
              state?: {
                roomsMeta?: Record<string, ChatRoomMeta>
                messagesByRoom?: Record<string, ChatMessage[]>
                presenceMap?: Record<string, ChatPresenceEntry>
                typingMap?: Record<string, Record<string, ChatTypingEntry>>
              }
            }
            if (data.state) {
              if (data.state.presenceMap) setPresenceMap(data.state.presenceMap)
              if (data.state.typingMap) setTypingMap(data.state.typingMap)
            }
            return
          }
        } catch {
          // Try next endpoint
        }
      }
    },
    [actor.id, actor.name, actor.role],
  )

  const pullChatStateFromServer = useCallback(async () => {
    const bases = getOrderedChatSyncBases()
    for (const base of bases) {
      try {
        const res = await fetch(`${base}/state?t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
        })
        if (!res.ok) continue
        const data = (await res.json()) as {
          roomsMeta?: Record<string, ChatRoomMeta>
          messagesByRoom?: Record<string, ChatMessage[]>
          presenceMap?: Record<string, ChatPresenceEntry>
          typingMap?: Record<string, Record<string, ChatTypingEntry>>
        }

        if (data.presenceMap) setPresenceMap(data.presenceMap)
        if (data.typingMap) setTypingMap(data.typingMap)

        if (data.roomsMeta && Object.keys(data.roomsMeta).length > 0) {
          setRoomsMeta((prev) => ({ ...prev, ...data.roomsMeta }))
        }

        if (data.messagesByRoom && Object.keys(data.messagesByRoom).length > 0) {
          setMessagesByRoom((prev) => {
            let changed = false
            const next = { ...prev }
            for (const [rId, serverMsgs] of Object.entries(data.messagesByRoom!)) {
              if (!Array.isArray(serverMsgs) || serverMsgs.length === 0) continue
              const localList = next[rId] ?? []
              const byId = new Map<string, ChatMessage>()
              for (const m of localList) byId.set(m.id, m)
              for (const sm of serverMsgs) {
                const existing = byId.get(sm.id)
                if (
                  !existing ||
                  existing.isDeleted !== sm.isDeleted ||
                  JSON.stringify(existing.reactions) !== JSON.stringify(sm.reactions) ||
                  existing.readBy.length !== sm.readBy.length
                ) {
                  byId.set(sm.id, sm)
                  changed = true
                }
              }
              if (changed) {
                next[rId] = Array.from(byId.values()).sort(
                  (a, b) => a.createdAtMs - b.createdAtMs,
                )
              }
            }
            return changed ? next : prev
          })
        }
        return
      } catch {
        // Try next endpoint
      }
    }
  }, [])

  // Poll chat state & send presence heartbeat every 4 seconds
  useEffect(() => {
    void pullChatStateFromServer()
    void sendChatActionToServer({ action: 'heartbeat', roomId: selectedRoomId, typingMode: 'idle' })

    const interval = window.setInterval(() => {
      void pullChatStateFromServer()
      void sendChatActionToServer({
        action: 'heartbeat',
        roomId: selectedRoomId,
        typingMode: isRecordingVoice ? 'recording' : 'idle',
      })
    }, 4000)

    return () => window.clearInterval(interval)
  }, [pullChatStateFromServer, sendChatActionToServer, selectedRoomId, isRecordingVoice])

  // Active room descriptor & messages
  const activeRoom = useMemo<ChatRoomDescriptor>(() => {
    const found = allRooms.find((r) => r.roomId === selectedRoomId)
    if (found) return found
    return allRooms[0]
  }, [allRooms, selectedRoomId])

  const activeMessages = useMemo<ChatMessage[]>(() => {
    return messagesByRoom[activeRoom.roomId] ?? []
  }, [messagesByRoom, activeRoom.roomId])

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

  // Mark messages in active room as read by current actor
  useEffect(() => {
    const rId = activeRoom.roomId
    const list = messagesByRoom[rId] ?? []
    const hasUnread = list.some((m) => !m.readBy.includes(actor.id))
    if (!hasUnread) return

    setMessagesByRoom((prev) => {
      const currentList = prev[rId] ?? []
      return {
        ...prev,
        [rId]: currentList.map((m) =>
          m.readBy.includes(actor.id) ? m : { ...m, readBy: [...m.readBy, actor.id] },
        ),
      }
    })
    void sendChatActionToServer({ action: 'mark_read', roomId: rId })
  }, [activeRoom.roomId, actor.id, messagesByRoom, sendChatActionToServer])

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

  // Helper to check if a peer is online (active in last 2 minutes or Usthad/Principal active during campus hours)
  const isPeerOnline = useCallback(
    (peerId?: string, peerRole?: MessengerRole): boolean => {
      if (!peerId) return true
      const entry = presenceMap[peerId]
      if (entry && Date.now() - entry.lastSeenMs < 120000) return true
      if (peerRole === 'principal' || peerRole === 'usthad') return true
      return false
    },
    [presenceMap],
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
    }) => {
      if (activeRoomMeta.onlyAdminsCanPost && !actor.isStaff) return

      const now = Date.now()
      const newMsg: ChatMessage = {
        id: `msg_${now}_${Math.random().toString(36).slice(2, 7)}`,
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
        replyTo: replyingTo ?? undefined,
        reactions: {},
        readBy: [actor.id, ...(activeRoom.peerId ? [activeRoom.peerId] : [])],
        isDeleted: false,
        createdAt: new Date(now).toISOString(),
        createdAtMs: now,
      }

      setMessagesByRoom((prev) => ({
        ...prev,
        [activeRoom.roomId]: [...(prev[activeRoom.roomId] ?? []), newMsg],
      }))

      setInputText('')
      setReplyingTo(null)
      setPendingAttachment(null)
      setShowAttachMenu(false)

      void sendChatActionToServer({
        action: 'send_message',
        roomId: activeRoom.roomId,
        message: newMsg,
      })

      // If an Usthad or Principal posts an important message/PDF in a Batch Group, also notify that batch
      if (actor.isStaff && activeRoom.type === 'batch_group' && activeRoom.batchName) {
        const preview =
          newMsg.mediaType === 'pdf'
            ? `📄 Shared PDF Note: ${newMsg.mediaName || 'Document'}`
            : newMsg.mediaType === 'voice'
              ? `🎤 Sent a Voice Note (${formatVoiceDuration(newMsg.mediaDurationSec || 4)})`
              : newMsg.text.slice(0, 120)
        publishCampusNotification({
          type: 'notice',
          title: `Class Group Message • ${activeRoom.batchName}`,
          message: `${actor.name}: ${preview}`,
          targetClass: activeRoom.batchName,
          actorName: actor.name,
          href: '#campus-chat',
        })
      }
    },
    [activeRoom, activeRoomMeta.onlyAdminsCanPost, actor, replyingTo, sendChatActionToServer],
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
      })
      return
    }
    if (!inputText.trim()) return
    dispatchMessage({ text: inputText, mediaType: 'none' })
  }

  // Voice Note Recording Handlers
  const startVoiceRecording = async () => {
    if (activeRoomMeta.onlyAdminsCanPost && !actor.isStaff) return
    setIsRecordingVoice(true)
    setRecordingSeconds(0)
    recordedChunksRef.current = []

    void sendChatActionToServer({
      action: 'heartbeat',
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

  // File Attachment Handlers (PDF & Photo)
  const handleFileSelected = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'image' | 'pdf',
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    const sizeKb = Math.max(1, Math.round(file.size / 1024))
    const sizeLabel =
      sizeKb >= 1024
        ? `${(sizeKb / 1024).toFixed(1)} MB • ${type.toUpperCase()}`
        : `${sizeKb} KB • ${type.toUpperCase()}`

    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setPendingAttachment({
          mediaType: type,
          mediaUrl: reader.result,
          mediaName: file.name,
          mediaSizeLabel: sizeLabel,
        })
        setShowAttachMenu(false)
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleQuickShareSampleKitabPdf = () => {
    const kitab = CURATED_KITABS[0]
    const pdfBlob = buildKitabPdfBlob(kitab)
    const url = URL.createObjectURL(pdfBlob)
    dispatchMessage({
      text: `📚 ${kitab.title} (${kitab.arabicTitle}) — ക്ലാസ് പഠനത്തിനുള്ള സിലബസ് നോട്ട് (PDF).`,
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
    void sendChatActionToServer({
      action: 'toggle_pin',
      roomId: rId,
      pinnedMessageId: nextPin,
    })
  }

  const handleDeleteMessage = (messageId: string) => {
    const rId = activeRoom.roomId
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
    void sendChatActionToServer({
      action: 'delete_message',
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
        'flex flex-col overflow-hidden rounded-3xl border border-border bg-card/95 shadow-lg transition-colors',
        mobileFullScreen
          ? 'max-lg:h-full max-lg:flex-1 max-lg:rounded-none max-lg:border-0 lg:h-[760px]'
          : 'h-[720px] sm:h-[760px]',
      )}
    >
      <div className="flex h-full min-h-0 flex-1 overflow-hidden">
        {/* LEFT PANE: WHATSAPP CONVERSATION ROSTER */}
        <div
          className={cn(
            'flex h-full w-full flex-col border-r border-border bg-background/80 lg:w-[360px] xl:w-[390px] lg:shrink-0',
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
                    ICS Campus Messenger
                  </h2>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {actor.name} • {actor.isStaff ? 'Usthad / Admin Mode' : actor.className}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowNewChatModal(true)}
              title="Start a new chat with an Usthad or Student"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-500/25 dark:border-[#262a33] dark:bg-[#1a1d24] dark:text-zinc-100 dark:hover:bg-[#222630] shrink-0"
            >
              <MessageSquarePlus className="size-3.5" aria-hidden="true" />
              <span>New Chat</span>
            </button>
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
                placeholder="Search groups, Usthads, or students..."
                className="h-9 w-full rounded-xl border border-input bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-emerald-500 dark:focus:border-zinc-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(
                [
                  { id: 'all', label: 'All Chats' },
                  { id: 'groups', label: 'Class Groups' },
                  ...(actor.isStaff ? [{ id: 'staff', label: 'Staff Room' } as const] : []),
                  { id: 'usthads', label: 'Usthads (9)' },
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

            {/* Batch selector when viewing Students tab */}
            {categoryFilter === 'students' && (
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Filter Batch:
                </span>
                <select
                  value={studentBatchFilter}
                  onChange={(e) => setStudentBatchFilter(e.target.value)}
                  aria-label="Filter students by batch"
                  className="h-8 flex-1 rounded-lg border border-input bg-card px-2.5 text-xs font-semibold text-foreground"
                >
                  <option value={actor.className}>My Class ({actor.className})</option>
                  <option value="ALL">All 11 Batches ({students.length} Students)</option>
                  {ACADEMY_CLASSES.map((c) => (
                    <option key={c.id} value={c.className}>
                      {c.fullLabel}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Scrollable Room List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/50">
            {filteredRooms.map((room) => {
              const isSelected = room.roomId === activeRoom.roomId
              const roomMsgs = messagesByRoom[room.roomId] ?? []
              const lastMsg = roomMsgs[roomMsgs.length - 1]
              const unreadCount = roomMsgs.filter(
                (m) => m.senderId !== actor.id && !m.readBy.includes(actor.id),
              ).length
              const roomMeta = roomsMeta[room.roomId]
              const roomTyping = getRoomTypingText(room.roomId)
              const online =
                room.type === 'batch_group' || room.type === 'staff_group'
                  ? true
                  : isPeerOnline(room.peerId, room.peerRole)

              return (
                <button
                  key={room.roomId}
                  type="button"
                  onClick={() => {
                    setSelectedRoomId(room.roomId)
                    setMobileShowChatPane(true)
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors min-h-[68px]',
                    isSelected
                      ? 'bg-emerald-500/12 dark:bg-[#1a1d24]'
                      : 'hover:bg-muted/50',
                  )}
                >
                  {/* Avatar with Online Status */}
                  <div className="relative shrink-0">
                    <div
                      className={cn(
                        'flex size-11 items-center justify-center rounded-2xl font-display text-xs font-bold shadow-xs border border-border dark:border-[#262a33]',
                        room.type === 'staff_group'
                          ? 'bg-amber-500/15 text-amber-600 dark:bg-[#1a1d24] dark:text-amber-300'
                          : room.type === 'batch_group'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:bg-[#1a1d24] dark:text-zinc-100'
                            : room.type === 'direct_usthad'
                              ? 'bg-cyan/15 text-cyan dark:bg-[#1a1d24] dark:text-cyan'
                              : 'bg-muted text-foreground dark:bg-[#1a1d24] dark:text-zinc-200',
                      )}
                    >
                      {room.type === 'batch_group' ? (
                        <Users className="size-4" aria-hidden="true" />
                      ) : room.type === 'staff_group' ? (
                        <Crown className="size-4" aria-hidden="true" />
                      ) : (
                        room.avatarText
                      )}
                    </div>
                    {online && (
                      <span
                        title="Online"
                        className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background bg-emerald-500"
                      />
                    )}
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

                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {room.subtitle}
                    </p>

                    <div className="mt-1 flex items-center justify-between gap-2">
                      {roomTyping ? (
                        <p className="truncate text-[11px] font-semibold text-emerald-600 dark:text-zinc-300">
                          {roomTyping}
                        </p>
                      ) : lastMsg ? (
                        <p className="truncate text-[11px] text-foreground/80">
                          {lastMsg.isDeleted ? (
                            <span className="italic text-muted-foreground">
                              🚫 Message deleted
                            </span>
                          ) : (
                            <>
                              <span className="font-semibold">
                                {lastMsg.senderId === actor.id
                                  ? 'You: '
                                  : `${lastMsg.senderName.split(' ').slice(0, 2).join(' ')}: `}
                              </span>
                              {lastMsg.mediaType === 'voice'
                                ? `🎤 ${formatVoiceDuration(lastMsg.mediaDurationSec || 4)}`
                                : lastMsg.mediaType === 'pdf'
                                  ? `📄 ${lastMsg.mediaName || 'PDF Note'}`
                                  : lastMsg.mediaType === 'image'
                                    ? `📷 Photo`
                                    : lastMsg.text}
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
            'flex h-full min-w-0 flex-1 flex-col bg-background/95',
            !mobileShowChatPane ? 'hidden lg:flex' : 'flex',
          )}
        >
          {/* Active Chat Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                onClick={() => setMobileShowChatPane(false)}
                aria-label="Back to chat list"
                className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background/80 text-foreground hover:bg-muted lg:hidden"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
              </button>

              <div className="relative shrink-0">
                <div
                  className={cn(
                    'flex size-10 items-center justify-center rounded-2xl font-display text-xs font-bold border border-border dark:border-[#262a33]',
                    activeRoom.type === 'staff_group'
                      ? 'bg-amber-500/15 text-amber-600 dark:bg-[#1a1d24] dark:text-amber-300'
                      : activeRoom.type === 'batch_group'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:bg-[#1a1d24] dark:text-zinc-100'
                        : 'bg-cyan/15 text-cyan dark:bg-[#1a1d24] dark:text-cyan',
                  )}
                >
                  {activeRoom.type === 'batch_group' ? (
                    <Users className="size-4" aria-hidden="true" />
                  ) : activeRoom.type === 'staff_group' ? (
                    <Crown className="size-4" aria-hidden="true" />
                  ) : (
                    activeRoom.avatarText
                  )}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background bg-emerald-500" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="truncate font-display text-sm font-bold text-foreground sm:text-base">
                    {activeRoom.title}
                  </h3>
                  <span className="hidden rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline-block">
                    {activeRoom.badgeLabel}
                  </span>
                </div>

                {activeTypingBanner ? (
                  <p className="truncate text-[11px] font-semibold text-emerald-600 dark:text-zinc-300">
                    {activeTypingBanner}
                  </p>
                ) : (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {activeRoom.subtitle} •{' '}
                    <span className="font-medium text-emerald-600 dark:text-zinc-400">
                      Online
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* Right Controls: Usthad / Principal Group Lock Toggle */}
            <div className="flex shrink-0 items-center gap-1.5">
              {actor.isStaff && activeRoom.type === 'batch_group' && (
                <button
                  type="button"
                  onClick={handleToggleGroupLock}
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
            className="flex-1 space-y-2.5 overflow-y-auto px-3 py-4 sm:px-5"
            onClick={() => setActiveReactionMessageId(null)}
          >
            {/* End-to-End Campus Security Banner */}
            <div className="mx-auto max-w-md rounded-2xl border border-border/70 bg-card/70 px-3.5 py-2 text-center text-[11px] text-muted-foreground dark:border-[#262a33] dark:bg-[#121418]">
              <ShieldCheck
                className="mr-1 inline-block size-3.5 text-emerald-600 dark:text-muted-foreground"
                aria-hidden="true"
              />
              Official ICS Academy Manhappatta Campus Messenger. Share study notes, Kitab PDFs, and
              voice explanations respectfully.
            </div>

            {activeMessages.map((msg) => {
              const isMine = msg.senderId === actor.id
              const isPinned = activeRoomMeta.pinnedMessageId === msg.id
              const isReadByOthers = msg.readBy.length > 1
              const isSelectedMenuOpen = activeReactionMessageId === msg.id
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
                      if (!msg.isDeleted) {
                        setActiveReactionMessageId((prev) =>
                          prev === msg.id ? null : msg.id,
                        )
                      }
                    }}
                    className={cn(
                      'relative max-w-[86%] sm:max-w-[74%] rounded-2xl px-3.5 py-2 shadow-xs border transition-colors cursor-pointer',
                      isMine
                        ? 'rounded-br-xs border-[#bde6b4] bg-[#dcf8c6] text-[#081e21] dark:border-[#262a33] dark:bg-[#1a1d24] dark:text-[#f3f4f6]'
                        : 'rounded-bl-xs border-border bg-card text-foreground dark:border-[#262a33] dark:bg-[#121418] dark:text-[#f3f4f6]',
                      isSelectedMenuOpen && 'ring-1 ring-emerald-500/40 dark:ring-zinc-600',
                    )}
                  >
                    {/* Subtle WhatsApp Three-Dots (⋮) Trigger in Top-Right Corner */}
                    {!msg.isDeleted && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveReactionMessageId((prev) =>
                            prev === msg.id ? null : msg.id,
                          )
                        }}
                        aria-label="Message options"
                        className={cn(
                          'absolute right-1.5 top-1.5 z-10 flex size-6 items-center justify-center rounded-full transition-opacity',
                          isSelectedMenuOpen
                            ? 'opacity-100 bg-black/10 dark:bg-white/10'
                            : 'opacity-0 group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10',
                        )}
                      >
                        <MoreVertical className="size-3.5 opacity-75" aria-hidden="true" />
                      </button>
                    )}

                    {/* Sender Name & Role Header */}
                    {!isMine && (
                      <div className="mb-1 flex flex-wrap items-center gap-1.5 pr-5">
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
                        {msg.senderBadge && (
                          <span className="text-[10px] text-muted-foreground">
                            · {msg.senderBadge}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Deleted Message State */}
                    {msg.isDeleted ? (
                      <p className="py-1 text-xs italic opacity-75">
                        🚫 This message was deleted by {msg.deletedBy || 'Usthad'}
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

                        {/* Media Attachment: Clean WhatsApp Voice Note Waveform (No extra text or inner box!) */}
                        {msg.mediaType === 'voice' && (
                          <div
                            className="flex min-w-[220px] sm:min-w-[250px] items-center gap-2.5 py-1 pr-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleTogglePlayVoice(msg)}
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
                                    onClick={handleCyclePlaybackRate}
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
                                          ? `Read by ${msg.readBy.length - 1} member(s)`
                                          : 'Sent'
                                      }
                                      className="inline-flex items-center"
                                    >
                                      {isReadByOthers ? (
                                        <CheckCheck className="size-3.5 text-sky-500 dark:text-sky-400" aria-label="Read" />
                                      ) : (
                                        <Check className="size-3.5 opacity-70" aria-label="Sent" />
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
                            onClick={(e) => e.stopPropagation()}
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
                              onClick={() => handleOpenOrDownloadPdf(msg)}
                              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-bold text-white transition-colors hover:bg-emerald-700 dark:border dark:border-[#262a33] dark:bg-[#222630] dark:text-zinc-100 dark:hover:bg-zinc-700"
                            >
                              <Download className="size-3.5" aria-hidden="true" />
                              <span>PDF</span>
                            </button>
                          </div>
                        )}

                        {/* Media Attachment: Photo / Image Preview */}
                        {msg.mediaType === 'image' && msg.mediaUrl && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="my-1 overflow-hidden rounded-xl border border-border/60 dark:border-[#262a33]"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setLightboxImage({
                                  url: msg.mediaUrl!,
                                  name: msg.mediaName || 'Campus Photo',
                                })
                              }
                              className="block w-full text-left"
                            >
                              <img
                                src={msg.mediaUrl}
                                alt={msg.mediaName || 'Shared attachment'}
                                referrerPolicy="no-referrer"
                                className="max-h-64 w-full object-cover transition-transform hover:scale-[1.01]"
                              />
                            </button>
                          </div>
                        )}

                        {/* Message Body Text (Never shown for voice notes) */}
                        {msg.mediaType !== 'voice' && msg.text && (
                          <p className="whitespace-pre-wrap break-words pr-3 text-xs leading-relaxed sm:text-[13.5px]">
                            {msg.text}
                          </p>
                        )}
                      </>
                    )}

                    {/* Timestamp & WhatsApp Double Tick (✓✓) for non-voice messages */}
                    {msg.mediaType !== 'voice' && (
                      <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-75">
                        {isPinned && (
                          <Pin className="size-3 opacity-80" aria-label="Pinned message" />
                        )}
                        <span className="font-poppins tabular-nums">
                          {formatChatTime(msg.createdAtMs)}
                        </span>
                        {isMine && !msg.isDeleted && (
                          <span
                            title={
                              isReadByOthers
                                ? `Read by ${msg.readBy.length - 1} member(s)`
                                : 'Sent'
                            }
                            className="inline-flex items-center"
                          >
                            {isReadByOthers ? (
                              <CheckCheck className="size-3.5 text-sky-500 dark:text-sky-400" aria-label="Read" />
                            ) : (
                              <Check className="size-3.5 opacity-75" aria-label="Sent" />
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Modern WhatsApp Floating Reaction Bar + Three-Dots Context Menu (Shown ONLY when message is selected/tapped) */}
                  {isSelectedMenuOpen && !msg.isDeleted && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'z-20 mt-1.5 flex flex-col gap-1.5',
                        isMine ? 'items-end' : 'items-start',
                      )}
                    >
                      {/* Floating Emoji Reaction Pill */}
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

                      {/* WhatsApp-Style Action Dropdown Menu */}
                      <div className="flex min-w-[150px] flex-col overflow-hidden rounded-2xl border border-border bg-card py-1 text-xs shadow-xl dark:border-[#262a33] dark:bg-[#121418]">
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
                          className="flex items-center gap-2.5 px-3.5 py-2 text-left font-medium text-foreground transition-colors hover:bg-muted"
                        >
                          <Reply className="size-3.5 text-muted-foreground" aria-hidden="true" />
                          <span>Reply</span>
                        </button>

                        {actor.isStaff && (
                          <button
                            type="button"
                            onClick={() => {
                              handleTogglePinMessage(msg.id)
                              setActiveReactionMessageId(null)
                            }}
                            className="flex items-center gap-2.5 px-3.5 py-2 text-left font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            <Pin className="size-3.5 text-muted-foreground" aria-hidden="true" />
                            <span>{isPinned ? 'Unpin Message' : 'Pin Message'}</span>
                          </button>
                        )}

                        {(actor.isStaff || isMine) && (
                          <button
                            type="button"
                            onClick={() => {
                              handleDeleteMessage(msg.id)
                              setActiveReactionMessageId(null)
                            }}
                            className="flex items-center gap-2.5 px-3.5 py-2 text-left font-medium text-red-500 transition-colors hover:bg-red-500/10"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                            <span>Delete</span>
                          </button>
                        )}
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
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted text-foreground dark:border-[#262a33] dark:bg-[#1a1d24]">
                    {pendingAttachment.mediaType === 'pdf' ? (
                      <FileText className="size-4" aria-hidden="true" />
                    ) : (
                      <ImageIcon className="size-4" aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-foreground">
                      {pendingAttachment.mediaName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {pendingAttachment.mediaSizeLabel} • Ready to send
                    </p>
                  </div>
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
                ഈ ഗ്രൂപ്പിൽ ഉസ്താദുമാർക്ക് മാത്രമേ മെസ്സേജ് അയക്കാൻ അനുമതിയുള്ളൂ (Only Usthads can
                send messages)
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
                <div className="absolute bottom-16 left-3 z-30 flex flex-col gap-1 rounded-2xl border border-border bg-card p-2 shadow-xl w-64 dark:border-[#262a33] dark:bg-[#121418]">
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
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
                    onClick={() => imageInputRef.current?.click()}
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
                    onClick={handleQuickShareSampleKitabPdf}
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
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-3.5 py-2">
                  <div className="flex items-center gap-2.5">
                    <span className="size-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="font-poppins text-xs font-bold tabular-nums text-red-500">
                      Recording Voice • {formatVoiceDuration(recordingSeconds)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cancelVoiceRecording}
                      className="inline-flex h-9 items-center gap-1 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      <span>Cancel</span>
                    </button>
                    <button
                      type="button"
                      onClick={finishAndSendVoiceRecording}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white hover:bg-emerald-700 dark:border dark:border-[#343946] dark:bg-[#222630] dark:text-zinc-100"
                    >
                      <Send className="size-3.5" aria-hidden="true" />
                      <span>Send Audio</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAttachMenu((prev) => !prev)}
                    aria-label="Attach PDF or Photo"
                    className={cn(
                      'flex size-11 shrink-0 items-center justify-center rounded-2xl border transition-colors',
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
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder={
                      pendingAttachment
                        ? 'Add a caption for this attachment...'
                        : 'Type a message in Malayalam, English, or Arabic...'
                    }
                    className="h-11 flex-1 rounded-2xl border border-input bg-background px-3.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-emerald-500 dark:focus:border-zinc-500 focus:outline-none sm:text-sm dark:border-[#262a33] dark:bg-[#0a0b0e]"
                  />

                  <button
                    type="button"
                    onClick={startVoiceRecording}
                    title="Record a Voice Message (Audio)"
                    aria-label="Record voice message"
                    className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground transition-colors hover:border-emerald-500 hover:text-emerald-600 dark:border-[#262a33] dark:bg-[#0a0b0e] dark:hover:border-zinc-500 dark:hover:text-foreground"
                  >
                    <Mic className="size-4" aria-hidden="true" />
                  </button>

                  <button
                    type="submit"
                    disabled={!inputText.trim() && !pendingAttachment}
                    aria-label="Send message"
                    className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm transition-all hover:bg-emerald-700 disabled:opacity-40 dark:border dark:border-[#343946] dark:bg-[#222630] dark:text-zinc-100 dark:hover:bg-[#2a2f3b]"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
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
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-foreground">{u.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {u.className} • {u.staffId}
                        </p>
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
                    Students ({studentBatchFilter})
                  </p>
                  <select
                    value={studentBatchFilter}
                    onChange={(e) => setStudentBatchFilter(e.target.value)}
                    className="h-7 rounded-lg border border-input bg-background px-2 text-[11px] font-semibold dark:border-[#262a33] dark:bg-[#0a0b0e]"
                  >
                    <option value={actor.className}>My Batch ({actor.className})</option>
                    <option value="ALL">All Batches</option>
                    {ACADEMY_CLASSES.map((c) => (
                      <option key={c.id} value={c.className}>
                        {c.className}
                      </option>
                    ))}
                  </select>
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
                        className="flex items-center justify-between rounded-2xl border border-border bg-background/70 px-3.5 py-2 text-left transition-colors hover:bg-muted dark:border-[#262a33] dark:bg-[#0a0b0e]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-foreground">{st.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {st.className} • {st.admissionNo}
                          </p>
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

      {/* PHOTO LIGHTBOX MODAL */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl border border-[#262a33] bg-[#121418] p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 text-xs text-white">
              <span className="truncate font-semibold">{lightboxImage.name}</span>
              <div className="flex items-center gap-2">
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
