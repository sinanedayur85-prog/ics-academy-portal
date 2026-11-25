'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { ref as rtdbRef, set as rtdbSet } from 'firebase/database'
import {
  ChevronDown,
  Maximize2,
  Mic,
  MicOff,
  Phone,
  PhoneIncoming,
  PhoneOff,
  RefreshCw,
  ShieldCheck,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import {
  ACADEMY_PRINCIPAL,
  CLASS_USTHADS,
  OFFICIAL_CLASS_USTHADS,
  getCanonicalUsthadId,
  students,
} from '@/components/dashboard/data'
import {
  db,
  rtdb,
  sanitizeRtdbKey,
  handleFirestoreError,
  OperationType,
} from '@/src/lib/firebase'
import {
  parseNotificationHref,
  peekPendingNotificationHref,
  type ParsedNotificationTarget,
} from '@/lib/mobile-pdf'
import { cn } from '@/lib/utils'

function dispatchCallPushSignal(callPayload: {
  id: string
  roomId: string
  callType: CallMediaType
  callerId: string
  callerName: string
  callerSubtitle?: string
  calleeId: string
  action?: 'ring' | 'cancel'
}) {
  if (typeof window === 'undefined') return
  const isNativeOrLocal =
    Boolean((window as unknown as { ICSNativeBridge?: unknown }).ICSNativeBridge) ||
    window.location.protocol === 'capacitor:' ||
    window.location.hostname === 'localhost'
  const endpoints = isNativeOrLocal
    ? ['https://ics-academy-manhappatta.vercel.app/api/push/dispatch', '/api/push/dispatch']
    : ['/api/push/dispatch']
  const body = JSON.stringify({ call: callPayload })
  for (const url of endpoints) {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => {})
  }
}

export type CallMediaType = 'voice' | 'video'
export type CampusCallStatus =
  | 'ringing'
  | 'accepted'
  | 'connected'
  | 'declined'
  | 'missed'
  | 'ended'
  | 'busy'

export type CallActorRole = 'student' | 'usthad' | 'principal'

export interface CallActorInfo {
  id: string
  name: string
  role: CallActorRole
  subtitle?: string
  avatarUrl?: string
}

export interface CallPeerInfo {
  id: string
  name: string
  role: CallActorRole
  subtitle?: string
  roomId: string
  avatarUrl?: string
}

export interface CampusCallRecord {
  id: string
  campusId: 'ics-academy'
  roomId: string
  callType: CallMediaType
  callerId: string
  callerName: string
  callerRole: CallActorRole
  callerSubtitle?: string
  calleeId: string
  calleeName: string
  calleeRole: CallActorRole
  calleeSubtitle?: string
  status: CampusCallStatus
  offerSdp: string
  answerSdp?: string
  callerCandidates: string[]
  calleeCandidates: string[]
  startedAtMs: number
  connectedAtMs?: number
  endedAtMs?: number
  durationSec?: number
  updatedAtMs: number
}

interface ActiveCallSession {
  id: string
  roomId: string
  callType: CallMediaType
  direction: 'outgoing' | 'incoming'
  status: 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended'
  statusLabel: string
  peer: CallPeerInfo
  startedAtMs: number
  connectedAtMs?: number
}

interface CampusCallContextValue {
  actor: CallActorInfo
  activeCall: ActiveCallSession | null
  incomingCall: CampusCallRecord | null
  callHistory: CampusCallRecord[]
  unreadMissedCallsCount: number
  isCallMinimized: boolean
  callToast: string | null
  startCall: (peer: CallPeerInfo, callType: CallMediaType) => Promise<void>
  acceptIncomingCall: () => Promise<void>
  declineIncomingCall: () => Promise<void>
  endActiveCall: () => Promise<void>
  toggleMute: () => void
  toggleVideo: () => void
  flipCamera: () => Promise<void>
  setMinimized: (minimized: boolean) => void
  markMissedCallsSeen: () => void
  registerActiveCallActor: (nextActor: CallActorInfo) => void
  clearCallToast: () => void
}

const CampusCallContext = createContext<CampusCallContextValue | null>(null)

const LOCAL_CALL_HISTORY_KEY = 'ics_campus_call_history_v1'
const LOCAL_MISSED_SEEN_KEY = 'ics_campus_missed_calls_seen_v1'
const RING_TIMEOUT_MS = 45_000
const STALE_RING_WINDOW_MS = 55_000

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 6,
}

export function makeDirectCallRoomId(actorA: string, actorB: string): string {
  const sorted = [actorA, actorB].sort()
  return `direct__${sorted[0]}__${sorted[1]}`
}

export function formatCallDuration(sec?: number): string {
  const safe = Math.max(0, Math.floor(sec ?? 0))
  const hours = Math.floor(safe / 3600)
  const mins = Math.floor((safe % 3600) / 60)
  const rem = safe % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (hours > 0) return `${hours}:${pad(mins)}:${pad(rem)}`
  return `${pad(mins)}:${pad(rem)}`
}

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return 'IC'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

function resolveInitialActor(
  authRole: 'student' | 'class-leader' | 'usthad' | 'principal',
): CallActorInfo {
  if (typeof window === 'undefined') {
    return {
      id: students[0]?.id || 'std-001',
      name: students[0]?.name || 'Campus Member',
      role: 'student',
      subtitle: students[0]?.className || 'Student',
    }
  }

  if (authRole === 'principal') {
    return {
      id: getCanonicalUsthadId(ACADEMY_PRINCIPAL.usthadId || 'usthad-07'),
      name: ACADEMY_PRINCIPAL.name,
      role: 'principal',
      subtitle: 'Principal',
    }
  }

  if (authRole === 'usthad') {
    const rawId = window.localStorage.getItem('loggedInUsthadId') || 'usthad-01'
    const canonicalId = getCanonicalUsthadId(rawId)
    const found =
      CLASS_USTHADS.find((u) => getCanonicalUsthadId(u.id) === canonicalId) ||
      OFFICIAL_CLASS_USTHADS.find((u) => getCanonicalUsthadId(u.id) === canonicalId) ||
      CLASS_USTHADS[0]
    const isPrincipalDual = canonicalId === ACADEMY_PRINCIPAL.usthadId
    return {
      id: canonicalId,
      name: found?.name || 'Class Usthad',
      role: isPrincipalDual ? 'principal' : 'usthad',
      subtitle: found?.designation?.split('•')[0]?.trim() || found?.className || 'Usthad',
    }
  }

  const storedStudentId =
    window.localStorage.getItem('loggedInStudentId') ||
    window.localStorage.getItem('loggedInLeaderId') ||
    ''
  const activeStudent = students.find((s) => s.id === storedStudentId) || students[0]
  return {
    id: activeStudent.id,
    name: activeStudent.name,
    role: 'student',
    subtitle: activeStudent.className,
  }
}

function loadCachedCallHistory(actorId: string): CampusCallRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(`${LOCAL_CALL_HISTORY_KEY}_${actorId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveCachedCallHistory(actorId: string, records: CampusCallRecord[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      `${LOCAL_CALL_HISTORY_KEY}_${actorId}`,
      JSON.stringify(records.slice(0, 80)),
    )
  } catch {
    // Ignore quota errors
  }
}

function loadMissedSeenAt(actorId: string): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(`${LOCAL_MISSED_SEEN_KEY}_${actorId}`)
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

// Synthesized Web Audio ringtone / ringback / connect / end tones (no external MP3 files required)
class CallAudioEngine {
  private ctx: AudioContext | null = null
  private loopTimer: number | null = null

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return null
      if (!this.ctx || this.ctx.state === 'closed') {
        this.ctx = new AudioCtx()
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {})
      }
      return this.ctx
    } catch {
      return null
    }
  }

  private playTone(
    freq1: number,
    freq2: number | null,
    durationSec: number,
    volume = 0.08,
    delaySec = 0,
  ) {
    const ctx = this.ensureContext()
    if (!ctx) return
    try {
      const start = ctx.currentTime + delaySec
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec)
      gain.connect(ctx.destination)

      const osc1 = ctx.createOscillator()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(freq1, start)
      osc1.connect(gain)
      osc1.start(start)
      osc1.stop(start + durationSec + 0.02)

      if (freq2) {
        const osc2 = ctx.createOscillator()
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(freq2, start)
        osc2.connect(gain)
        osc2.start(start)
        osc2.stop(start + durationSec + 0.02)
      }
    } catch {
      // Ignore Web Audio autoplay blocks
    }
  }

  startIncomingRingtone() {
    this.stopLoops()
    const pulse = () => {
      // Pleasant warm two-note chime cadence
      this.playTone(587.33, 880, 0.24, 0.1, 0)
      this.playTone(659.25, 987.77, 0.28, 0.1, 0.28)
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate([260, 140, 260])
        } catch {
          // Ignore vibration failure
        }
      }
    }
    pulse()
    this.loopTimer = window.setInterval(pulse, 2200)
  }

  startRingback() {
    this.stopLoops()
    const pulse = () => {
      this.playTone(440, 480, 0.85, 0.055, 0)
    }
    pulse()
    this.loopTimer = window.setInterval(pulse, 2600)
  }

  playConnectChime() {
    this.stopLoops()
    this.playTone(523.25, null, 0.12, 0.08, 0)
    this.playTone(783.99, null, 0.18, 0.08, 0.11)
  }

  playEndChime() {
    this.stopLoops()
    this.playTone(440, null, 0.14, 0.07, 0)
    this.playTone(329.63, null, 0.22, 0.07, 0.13)
  }

  stopLoops() {
    if (this.loopTimer !== null) {
      window.clearInterval(this.loopTimer)
      this.loopTimer = null
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(0)
      } catch {
        // Ignore
      }
    }
  }
}

function parseFirestoreCallDoc(id: string, raw: Record<string, unknown>): CampusCallRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const callerId = String(raw.callerId || '')
  const calleeId = String(raw.calleeId || '')
  if (!callerId || !calleeId) return null
  return {
    id: String(raw.id || id),
    campusId: 'ics-academy',
    roomId: String(raw.roomId || makeDirectCallRoomId(callerId, calleeId)),
    callType: raw.callType === 'video' ? 'video' : 'voice',
    callerId,
    callerName: String(raw.callerName || 'Member'),
    callerRole:
      raw.callerRole === 'principal' || raw.callerRole === 'usthad' ? raw.callerRole : 'student',
    callerSubtitle: raw.callerSubtitle ? String(raw.callerSubtitle) : undefined,
    calleeId,
    calleeName: String(raw.calleeName || 'Member'),
    calleeRole:
      raw.calleeRole === 'principal' || raw.calleeRole === 'usthad' ? raw.calleeRole : 'student',
    calleeSubtitle: raw.calleeSubtitle ? String(raw.calleeSubtitle) : undefined,
    status: (
      ['ringing', 'accepted', 'connected', 'declined', 'missed', 'ended', 'busy'].includes(
        String(raw.status),
      )
        ? String(raw.status)
        : 'ended'
    ) as CampusCallStatus,
    offerSdp: String(raw.offerSdp || ''),
    answerSdp: raw.answerSdp ? String(raw.answerSdp) : undefined,
    callerCandidates: Array.isArray(raw.callerCandidates)
      ? raw.callerCandidates.map(String)
      : [],
    calleeCandidates: Array.isArray(raw.calleeCandidates)
      ? raw.calleeCandidates.map(String)
      : [],
    startedAtMs: Number(raw.startedAtMs) || Date.now(),
    connectedAtMs: typeof raw.connectedAtMs === 'number' ? raw.connectedAtMs : undefined,
    endedAtMs: typeof raw.endedAtMs === 'number' ? raw.endedAtMs : undefined,
    durationSec: typeof raw.durationSec === 'number' ? raw.durationSec : undefined,
    updatedAtMs: Number(raw.updatedAtMs) || Number(raw.startedAtMs) || Date.now(),
  }
}

export function CampusCallProvider({
  authRole,
  children,
}: {
  authRole: 'student' | 'class-leader' | 'usthad' | 'principal'
  children: React.ReactNode
}) {
  const [actor, setActor] = useState<CallActorInfo>(() => resolveInitialActor(authRole))
  const [activeCall, setActiveCall] = useState<ActiveCallSession | null>(null)
  const [incomingCall, setIncomingCall] = useState<CampusCallRecord | null>(null)
  const [callHistory, setCallHistory] = useState<CampusCallRecord[]>(() =>
    loadCachedCallHistory(resolveInitialActor(authRole).id),
  )
  const [missedSeenAt, setMissedSeenAt] = useState<number>(() =>
    loadMissedSeenAt(resolveInitialActor(authRole).id),
  )
  const [isCallMinimized, setIsCallMinimized] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [callToast, setCallToast] = useState<string | null>(null)
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false)

  // Refs for WebRTC media & signaling lifecycle
  const actorRef = useRef(actor)
  actorRef.current = actor
  const activeCallRef = useRef<ActiveCallSession | null>(null)
  activeCallRef.current = activeCall
  const incomingCallRef = useRef<CampusCallRecord | null>(null)
  incomingCallRef.current = incomingCall

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioEngineRef = useRef<CallAudioEngine | null>(null)

  const appliedCandidatesRef = useRef<Set<string>>(new Set())
  const pendingRemoteCandidatesRef = useRef<string[]>([])
  const remoteDescSetRef = useRef(false)
  const localIceCountRef = useRef(0)
  const handledCallIdsRef = useRef<Set<string>>(new Set())
  const postedLogCallIdsRef = useRef<Set<string>>(new Set())
  const activeCallUnsubRef = useRef<(() => void) | null>(null)
  const ringTimeoutRef = useRef<number | null>(null)
  const toastTimeoutRef = useRef<number | null>(null)
  const activeCallRecordRef = useRef<CampusCallRecord | null>(null)

  // Separate merged maps for Firestore callee + caller + server records
  const recordsMapRef = useRef<Record<string, CampusCallRecord>>({})

  if (!audioEngineRef.current && typeof window !== 'undefined') {
    audioEngineRef.current = new CallAudioEngine()
  }

  const showToast = useCallback((msg: string) => {
    setCallToast(msg)
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = window.setTimeout(() => {
      setCallToast(null)
    }, 3800)
  }, [])

  const clearCallToast = useCallback(() => {
    setCallToast(null)
  }, [])

  // Sync actor whenever authRole changes
  useEffect(() => {
    const resolved = resolveInitialActor(authRole)
    setActor((prev) => {
      if (prev.id === resolved.id && prev.role === resolved.role && prev.name === resolved.name) {
        return prev
      }
      return resolved
    })
  }, [authRole])

  // Load cached history & missed seen timestamp whenever actor.id changes
  useEffect(() => {
    const cached = loadCachedCallHistory(actor.id)
    recordsMapRef.current = {}
    for (const r of cached) {
      recordsMapRef.current[r.id] = r
    }
    setCallHistory(cached)
    setMissedSeenAt(loadMissedSeenAt(actor.id))
  }, [actor.id])

  const registerActiveCallActor = useCallback((nextActor: CallActorInfo) => {
    if (!nextActor?.id) return
    setActor((prev) => {
      if (
        prev.id === nextActor.id &&
        prev.name === nextActor.name &&
        prev.role === nextActor.role &&
        prev.subtitle === nextActor.subtitle &&
        prev.avatarUrl === nextActor.avatarUrl
      ) {
        return prev
      }
      return nextActor
    })
  }, [])

  const attachStreamsToMediaElements = useCallback(() => {
    if (localVideoRef.current && localStreamRef.current) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current
      }
      localVideoRef.current.play().catch(() => {})
    }
    if (remoteVideoRef.current && remoteStreamRef.current) {
      if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current
      }
      remoteVideoRef.current.play().catch(() => {})
    }
    if (remoteAudioRef.current && remoteStreamRef.current) {
      if (remoteAudioRef.current.srcObject !== remoteStreamRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current
      }
      remoteAudioRef.current.muted = !isSpeakerOn
      remoteAudioRef.current.play().catch(() => {})
    }
  }, [isSpeakerOn])

  // Re-attach streams whenever layout toggles between fullscreen & minimized or remote video becomes available
  useEffect(() => {
    if (!activeCall) return
    const timer = window.setTimeout(attachStreamsToMediaElements, 60)
    return () => window.clearTimeout(timer)
  }, [activeCall, isCallMinimized, hasRemoteVideo, isVideoEnabled, attachStreamsToMediaElements])

  // Live call duration timer
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'connected') {
      setElapsedSec(0)
      return
    }
    const baseMs = activeCall.connectedAtMs || Date.now()
    const tick = () => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - baseMs) / 1000)))
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [activeCall])

  const cleanupMediaAndPc = useCallback(() => {
    audioEngineRef.current?.stopLoops()

    if (ringTimeoutRef.current !== null) {
      window.clearTimeout(ringTimeoutRef.current)
      ringTimeoutRef.current = null
    }
    if (activeCallUnsubRef.current) {
      activeCallUnsubRef.current()
      activeCallUnsubRef.current = null
    }
    if (pcRef.current) {
      try {
        pcRef.current.onicecandidate = null
        pcRef.current.ontrack = null
        pcRef.current.onconnectionstatechange = null
        pcRef.current.oniceconnectionstatechange = null
        pcRef.current.close()
      } catch {
        // Ignore close errors
      }
      pcRef.current = null
    }
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        try {
          track.stop()
        } catch {
          // Ignore
        }
      }
      localStreamRef.current = null
    }
    if (remoteStreamRef.current) {
      for (const track of remoteStreamRef.current.getTracks()) {
        try {
          track.stop()
        } catch {
          // Ignore
        }
      }
      remoteStreamRef.current = null
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null

    appliedCandidatesRef.current.clear()
    pendingRemoteCandidatesRef.current = []
    remoteDescSetRef.current = false
    localIceCountRef.current = 0
    activeCallRecordRef.current = null
    setHasRemoteVideo(false)
    setIsMuted(false)
    setIsVideoEnabled(true)
    setIsCallMinimized(false)
    setElapsedSec(0)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupMediaAndPc()
    }
  }, [cleanupMediaAndPc])

  // Post a deterministic in-chat Call Card message into the 1-on-1 direct room
  const postCallCardMessage = useCallback(
    async (record: {
      id: string
      roomId: string
      callType: CallMediaType
      callStatus: CampusCallStatus
      durationSec: number
      callerId: string
      callerName: string
      callerRole: CallActorRole
      calleeId: string
    }) => {
      if (postedLogCallIdsRef.current.has(record.id)) return
      postedLogCallIdsRef.current.add(record.id)

      const now = Date.now()
      const msgId = `msg_call_${record.id}`
      const typeLabel = record.callType === 'video' ? 'Video call' : 'Voice call'
      const textLabel =
        record.callStatus === 'missed'
          ? `Missed ${typeLabel.toLowerCase()}`
          : record.callStatus === 'declined'
            ? `${typeLabel} declined`
            : record.callStatus === 'busy'
              ? `${typeLabel} — Busy`
              : record.durationSec > 0
                ? `${typeLabel} · ${formatCallDuration(record.durationSec)}`
                : typeLabel

      const callMeta = {
        callId: record.id,
        callType: record.callType,
        callStatus: record.callStatus,
        durationSec: Math.max(0, Math.round(record.durationSec)),
        callerId: record.callerId,
        calleeId: record.calleeId,
      }

      // 1. Write to Firebase Realtime Database campusChatMessages (deterministic ID prevents duplicates)
      const callerKey = sanitizeRtdbKey(record.callerId)
      const rtdbPayload = {
        id: msgId,
        campusId: 'ics-academy',
        roomId: record.roomId,
        senderId: record.callerId,
        senderName: record.callerName.slice(0, 120),
        senderRole: record.callerRole,
        text: textLabel,
        mediaType: 'call',
        callMeta,
        reactions: {},
        deliveredToMap: { [callerKey]: true },
        deliveredAtMap: { [callerKey]: now },
        readByMap: { [callerKey]: true },
        readAtMap: { [callerKey]: now },
        isDeleted: false,
        createdAtMs: now,
      }

      rtdbSet(rtdbRef(rtdb, `campusChatMessages/${sanitizeRtdbKey(msgId)}`), rtdbPayload).catch(
        () => {
          // Ignore if already created by the other peer
        },
      )

      // 2. Dual-sync to Express server
      fetch('/api/campus/chat/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_message',
          roomId: record.roomId,
          actorId: record.callerId,
          actorName: record.callerName,
          actorRole: record.callerRole,
          message: {
            id: msgId,
            roomId: record.roomId,
            senderId: record.callerId,
            senderName: record.callerName,
            senderRole: record.callerRole,
            text: textLabel,
            mediaType: 'call',
            callMeta,
            reactions: {},
            deliveredTo: [record.callerId],
            deliveredAtMap: { [record.callerId]: now },
            readBy: [record.callerId],
            readAtMap: { [record.callerId]: now },
            createdAt: new Date(now).toISOString(),
            createdAtMs: now,
          },
        }),
      }).catch(() => {})
    },
    [],
  )

  const syncTerminalStatus = useCallback(
    async (
      callId: string,
      status: 'declined' | 'missed' | 'ended' | 'busy',
      durationSec: number,
    ) => {
      const now = Date.now()
      const safeDur = Math.max(0, Math.min(86400, Math.round(durationSec)))
      handledCallIdsRef.current.add(callId)

      updateDoc(doc(db, 'campusCalls', callId), {
        status,
        endedAtMs: now,
        durationSec: safeDur,
        updatedAtMs: now,
      }).catch(() => {
        // Ignore if already in a terminal state
      })

      fetch('/api/campus/call/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: status === 'declined' ? 'decline' : status === 'ended' ? 'end' : status,
          callId,
          actorId: actorRef.current.id,
          durationSec: safeDur,
        }),
      }).catch(() => {})
    },
    [],
  )

  const flushRemoteCandidates = useCallback(async (candidates: string[]) => {
    const pc = pcRef.current
    if (!pc || !Array.isArray(candidates)) return
    for (const raw of candidates) {
      if (!raw || appliedCandidatesRef.current.has(raw)) continue
      if (!remoteDescSetRef.current) {
        if (!pendingRemoteCandidatesRef.current.includes(raw)) {
          pendingRemoteCandidatesRef.current.push(raw)
        }
        continue
      }
      appliedCandidatesRef.current.add(raw)
      try {
        const parsed = JSON.parse(raw) as RTCIceCandidateInit
        await pc.addIceCandidate(new RTCIceCandidate(parsed))
      } catch {
        // Ignore invalid/late ICE candidates
      }
    }
  }, [])

  const applyPendingRemoteCandidates = useCallback(async () => {
    if (!remoteDescSetRef.current || pendingRemoteCandidatesRef.current.length === 0) return
    const queued = [...pendingRemoteCandidatesRef.current]
    pendingRemoteCandidatesRef.current = []
    await flushRemoteCandidates(queued)
  }, [flushRemoteCandidates])

  const handleCallRecordUpdate = useCallback(
    async (record: CampusCallRecord) => {
      const current = activeCallRef.current
      if (!current || current.id !== record.id) return
      activeCallRecordRef.current = record

      // Caller receives answerSdp
      if (
        current.direction === 'outgoing' &&
        record.answerSdp &&
        !remoteDescSetRef.current &&
        pcRef.current
      ) {
        try {
          const answerInit = JSON.parse(record.answerSdp) as RTCSessionDescriptionInit
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answerInit))
          remoteDescSetRef.current = true
          await applyPendingRemoteCandidates()

          if (ringTimeoutRef.current !== null) {
            window.clearTimeout(ringTimeoutRef.current)
            ringTimeoutRef.current = null
          }
          audioEngineRef.current?.playConnectChime()
          const connAt = record.connectedAtMs || Date.now()
          setActiveCall((prev) =>
            prev && prev.id === record.id
              ? {
                  ...prev,
                  status: 'connected',
                  statusLabel: 'Connected',
                  connectedAtMs: prev.connectedAtMs || connAt,
                }
              : prev,
          )
        } catch {
          // Ignore duplicate remote description errors
        }
      }

      // Apply remote ICE candidates
      const remoteCands =
        current.direction === 'outgoing' ? record.calleeCandidates : record.callerCandidates
      if (remoteCands.length > 0) {
        void flushRemoteCandidates(remoteCands)
      }

      // Handle remote termination
      if (
        record.status === 'declined' ||
        record.status === 'missed' ||
        record.status === 'ended' ||
        record.status === 'busy'
      ) {
        handledCallIdsRef.current.add(record.id)
        audioEngineRef.current?.playEndChime()
        const dur =
          typeof record.durationSec === 'number'
            ? record.durationSec
            : current.connectedAtMs
              ? Math.max(0, Math.round((Date.now() - current.connectedAtMs) / 1000))
              : 0

        if (current.direction === 'outgoing') {
          void postCallCardMessage({
            id: record.id,
            roomId: record.roomId,
            callType: record.callType,
            callStatus: record.status,
            durationSec: dur,
            callerId: record.callerId,
            callerName: record.callerName,
            callerRole: record.callerRole,
            calleeId: record.calleeId,
          })
        }

        const endLabel =
          record.status === 'declined'
            ? `${current.peer.name} declined the call`
            : record.status === 'busy'
              ? `${current.peer.name} is on another call`
              : record.status === 'missed'
                ? 'No answer'
                : 'Call ended'
        showToast(endLabel)
        cleanupMediaAndPc()
        setActiveCall(null)
      }
    },
    [applyPendingRemoteCandidates, cleanupMediaAndPc, flushRemoteCandidates, postCallCardMessage, showToast],
  )

  const handleCallRecordUpdateRef = useRef(handleCallRecordUpdate)
  handleCallRecordUpdateRef.current = handleCallRecordUpdate

  // Merge incoming records from Firestore / Server into sorted callHistory + detect incoming rings
  const mergeCallRecords = useCallback(
    (incomingList: CampusCallRecord[]) => {
      const me = actorRef.current.id
      if (!me) return
      let changed = false
      const now = Date.now()

      for (const rec of incomingList) {
        if (rec.callerId !== me && rec.calleeId !== me) continue
        const prev = recordsMapRef.current[rec.id]
        if (!prev || rec.updatedAtMs >= prev.updatedAtMs || rec.status !== prev.status) {
          recordsMapRef.current[rec.id] = rec
          changed = true
        }

        // Feed active call session if matching
        if (activeCallRef.current && activeCallRef.current.id === rec.id) {
          void handleCallRecordUpdateRef.current(rec)
        }

        // Update or clear currently ringing incomingCall
        if (incomingCallRef.current && incomingCallRef.current.id === rec.id) {
          if (rec.status !== 'ringing') {
            audioEngineRef.current?.stopLoops()
            setIncomingCall(null)
            if (rec.status === 'missed') {
              showToast(`Missed ${rec.callType} call from ${rec.callerName}`)
            }
          } else {
            setIncomingCall(rec)
          }
          continue
        }

        // Detect brand new incoming call for this actor
        if (
          rec.calleeId === me &&
          rec.status === 'ringing' &&
          now - rec.startedAtMs < STALE_RING_WINDOW_MS &&
          !handledCallIdsRef.current.has(rec.id)
        ) {
          // If already on another call, immediately signal busy
          if (activeCallRef.current || incomingCallRef.current) {
            if (
              activeCallRef.current?.id !== rec.id &&
              incomingCallRef.current?.id !== rec.id
            ) {
              void syncTerminalStatus(rec.id, 'busy', 0)
            }
          } else {
            setIncomingCall(rec)
            audioEngineRef.current?.startIncomingRingtone()
            // Desktop/PWA notification if app tab is in background
            if (
              typeof document !== 'undefined' &&
              document.visibilityState === 'hidden' &&
              typeof Notification !== 'undefined' &&
              Notification.permission === 'granted'
            ) {
              try {
                new Notification(
                  `Incoming ${rec.callType === 'video' ? 'Video' : 'Voice'} Call`,
                  {
                    body: `${rec.callerName} is calling you on ICS Academy Messenger`,
                    tag: `ics_call_${rec.id}`,
                  },
                )
              } catch {
                // Ignore Notification errors
              }
            }
          }
        }
      }

      if (changed) {
        const sorted = Object.values(recordsMapRef.current)
          .sort((a, b) => b.startedAtMs - a.startedAtMs)
          .slice(0, 80)
        setCallHistory(sorted)
        saveCachedCallHistory(me, sorted)
      }
    },
    [showToast, syncTerminalStatus],
  )

  // Global Firestore listeners (callee + caller) + Express server fallback polling
  useEffect(() => {
    if (!actor.id) return

    const calleeQuery = query(
      collection(db, 'campusCalls'),
      where('campusId', '==', 'ics-academy'),
      where('calleeId', '==', actor.id),
      limit(10),
    )
    const callerQuery = query(
      collection(db, 'campusCalls'),
      where('campusId', '==', 'ics-academy'),
      where('callerId', '==', actor.id),
      limit(10),
    )

    const unsubCallee = onSnapshot(
      calleeQuery,
      (snap) => {
        const batch: CampusCallRecord[] = []
        snap.forEach((docSnap) => {
          const parsed = parseFirestoreCallDoc(
            docSnap.id,
            docSnap.data() as Record<string, unknown>,
          )
          if (parsed) batch.push(parsed)
        })
        if (batch.length > 0) mergeCallRecords(batch)
      },
      (err) => {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('permission') || msg.includes('insufficient')) {
          try {
            handleFirestoreError(err, OperationType.LIST, 'campusCalls')
          } catch {
            // Graceful degradation to server fallback
          }
        }
      },
    )

    const unsubCaller = onSnapshot(
      callerQuery,
      (snap) => {
        const batch: CampusCallRecord[] = []
        snap.forEach((docSnap) => {
          const parsed = parseFirestoreCallDoc(
            docSnap.id,
            docSnap.data() as Record<string, unknown>,
          )
          if (parsed) batch.push(parsed)
        })
        if (batch.length > 0) mergeCallRecords(batch)
      },
      (err) => {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('permission') || msg.includes('insufficient')) {
          try {
            handleFirestoreError(err, OperationType.LIST, 'campusCalls')
          } catch {
            // Graceful degradation to server fallback
          }
        }
      },
    )

    let cancelled = false
    const pollServer = async () => {
      if (cancelled) return
      try {
        const activeId = activeCallRef.current?.id
        const url = activeId
          ? `/api/campus/call/state?actorId=${encodeURIComponent(actor.id)}&callId=${encodeURIComponent(activeId)}`
          : `/api/campus/call/state?actorId=${encodeURIComponent(actor.id)}`
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { calls?: CampusCallRecord[] }
        if (Array.isArray(data.calls) && data.calls.length > 0) {
          mergeCallRecords(data.calls)
        }
      } catch {
        // Ignore transient network errors
      }
    }

    void pollServer()
    const pollMs = activeCall || incomingCall ? 1100 : 2800
    const pollTimer = window.setInterval(pollServer, pollMs)

    return () => {
      cancelled = true
      unsubCallee()
      unsubCaller()
      window.clearInterval(pollTimer)
    }
  }, [actor.id, activeCall, incomingCall, mergeCallRecords])

  // Auto-dismiss incoming call UI if it times out locally (safety net if caller disconnects)
  useEffect(() => {
    if (!incomingCall) return
    const remaining = Math.max(2000, RING_TIMEOUT_MS + 3000 - (Date.now() - incomingCall.startedAtMs))
    const timer = window.setTimeout(() => {
      if (incomingCallRef.current?.id === incomingCall.id) {
        audioEngineRef.current?.stopLoops()
        setIncomingCall(null)
      }
    }, remaining)
    return () => window.clearTimeout(timer)
  }, [incomingCall])

  const acquireUserMedia = useCallback(
    async (
      requestedType: CallMediaType,
      facing: 'user' | 'environment' = 'user',
    ): Promise<{ stream: MediaStream; effectiveType: CallMediaType }> => {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        throw new Error('Microphone & camera calling requires HTTPS or localhost in this browser.')
      }

      if (requestedType === 'video') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: {
              facingMode: { ideal: facing },
              width: { ideal: 960 },
              height: { ideal: 720 },
            },
          })
          return { stream, effectiveType: 'video' }
        } catch {
          // Graceful fallback to voice-only if camera is unavailable
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          })
          showToast('Camera unavailable — continuing as Voice Call')
          return { stream: audioStream, effectiveType: 'voice' }
        }
      }

      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
      return { stream: audioStream, effectiveType: 'voice' }
    },
    [showToast],
  )

  const createPeerConnection = useCallback(
    (callId: string, side: 'caller' | 'callee', localStream: MediaStream) => {
      const pc = new RTCPeerConnection(RTC_CONFIG)
      pcRef.current = pc

      const remoteStream = new MediaStream()
      remoteStreamRef.current = remoteStream

      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream)
      }

      pc.ontrack = (event) => {
        const incomingTracks =
          event.streams && event.streams[0]
            ? event.streams[0].getTracks()
            : [event.track]
        for (const t of incomingTracks) {
          if (!remoteStream.getTracks().some((ex) => ex.id === t.id)) {
            remoteStream.addTrack(t)
          }
          if (t.kind === 'video') {
            setHasRemoteVideo(true)
          }
        }
        attachStreamsToMediaElements()
      }

      pc.onicecandidate = (event) => {
        if (!event.candidate || localIceCountRef.current >= 55) return
        localIceCountRef.current += 1
        const candStr = JSON.stringify(event.candidate.toJSON())
        const now = Date.now()
        const field = side === 'caller' ? 'callerCandidates' : 'calleeCandidates'

        updateDoc(doc(db, 'campusCalls', callId), {
          [field]: arrayUnion(candStr),
          updatedAtMs: now,
        }).catch(() => {})

        fetch('/api/campus/call/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_ice',
            callId,
            actorId: actorRef.current.id,
            candidateSide: side,
            candidate: candStr,
          }),
        }).catch(() => {})
      }

      const handleStateChange = () => {
        const state = pc.connectionState || pc.iceConnectionState
        if (state === 'connected' || state === 'completed') {
          const now = Date.now()
          setActiveCall((prev) =>
            prev && prev.id === callId
              ? {
                  ...prev,
                  status: 'connected',
                  statusLabel: 'Connected',
                  connectedAtMs: prev.connectedAtMs || now,
                }
              : prev,
          )
          updateDoc(doc(db, 'campusCalls', callId), {
            status: 'connected',
            connectedAtMs: now,
            updatedAtMs: now,
          }).catch(() => {})
          fetch('/api/campus/call/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'connected',
              callId,
              actorId: actorRef.current.id,
            }),
          }).catch(() => {})
        }
      }

      pc.onconnectionstatechange = handleStateChange
      pc.oniceconnectionstatechange = handleStateChange

      return pc
    },
    [attachStreamsToMediaElements],
  )

  // OUTGOING CALL
  const startCall = useCallback(
    async (peer: CallPeerInfo, requestedType: CallMediaType) => {
      const me = actorRef.current
      if (!peer.id || peer.id === me.id) {
        showToast('Cannot place a call to yourself.')
        return
      }
      if (activeCallRef.current || incomingCallRef.current) {
        showToast('You are already in a call.')
        return
      }

      let acquired: { stream: MediaStream; effectiveType: CallMediaType }
      try {
        acquired = await acquireUserMedia(requestedType, 'user')
      } catch (err) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : 'Please allow microphone permission to place a call.'
        showToast(message)
        return
      }

      const { stream, effectiveType } = acquired
      localStreamRef.current = stream
      setFacingMode('user')
      setIsMuted(false)
      setIsVideoEnabled(effectiveType === 'video')
      setIsCallMinimized(false)

      const now = Date.now()
      const callId = `call_${now}_${Math.random().toString(36).slice(2, 8)}`
      const roomId = peer.roomId || makeDirectCallRoomId(me.id, peer.id)

      const session: ActiveCallSession = {
        id: callId,
        roomId,
        callType: effectiveType,
        direction: 'outgoing',
        status: 'ringing',
        statusLabel: 'Ringing...',
        peer: { ...peer, roomId },
        startedAtMs: now,
      }
      setActiveCall(session)

      try {
        const pc = createPeerConnection(callId, 'caller', stream)
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: effectiveType === 'video',
        })
        await pc.setLocalDescription(offer)

        const offerSdpStr = JSON.stringify(offer)
        const callRecordBase: CampusCallRecord = {
          id: callId,
          campusId: 'ics-academy',
          roomId,
          callType: effectiveType,
          callerId: me.id,
          callerName: me.name.slice(0, 120),
          callerRole: me.role,
          callerSubtitle: (me.subtitle || '').slice(0, 120),
          calleeId: peer.id,
          calleeName: peer.name.slice(0, 120),
          calleeRole: peer.role,
          calleeSubtitle: (peer.subtitle || '').slice(0, 120),
          status: 'ringing',
          offerSdp: offerSdpStr,
          callerCandidates: [],
          calleeCandidates: [],
          startedAtMs: now,
          updatedAtMs: now,
        }
        activeCallRecordRef.current = callRecordBase

        // Write to Firestore
        await setDoc(doc(db, 'campusCalls', callId), {
          ...callRecordBase,
          createdAt: serverTimestamp(),
        }).catch((err) => {
          try {
            handleFirestoreError(err, OperationType.CREATE, `campusCalls/${callId}`)
          } catch {
            // Fall back cleanly to Express signaling
          }
        })

        // Dual-sync to Express server + instant Vercel FCM push for closed Android APKs
        fetch('/api/campus/call/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'initiate',
            callId,
            actorId: me.id,
            call: callRecordBase,
          }),
        }).catch(() => {})

        dispatchCallPushSignal({
          id: callId,
          roomId,
          callType: callRecordBase.callType,
          callerId: me.id,
          callerName: me.name,
          callerSubtitle: callRecordBase.callerSubtitle || '',
          calleeId: callRecordBase.calleeId,
          action: 'ring',
        })

        // Subscribe directly to this call doc for fastest SDP/ICE delivery
        activeCallUnsubRef.current = onSnapshot(
          doc(db, 'campusCalls', callId),
          (snap) => {
            if (!snap.exists()) return
            const parsed = parseFirestoreCallDoc(snap.id, snap.data() as Record<string, unknown>)
            if (parsed) {
              void handleCallRecordUpdateRef.current(parsed)
            }
          },
          () => {},
        )

        audioEngineRef.current?.startRingback()
        attachStreamsToMediaElements()

        // 45-second no-answer timeout
        ringTimeoutRef.current = window.setTimeout(() => {
          const cur = activeCallRef.current
          if (!cur || cur.id !== callId || cur.status === 'connected') return
          void syncTerminalStatus(callId, 'missed', 0)
          dispatchCallPushSignal({
            id: callId,
            roomId,
            callType: effectiveType,
            callerId: me.id,
            callerName: me.name,
            calleeId: peer.id,
            action: 'cancel',
          })
          void postCallCardMessage({
            id: callId,
            roomId,
            callType: effectiveType,
            callStatus: 'missed',
            durationSec: 0,
            callerId: me.id,
            callerName: me.name,
            callerRole: me.role,
            calleeId: peer.id,
          })
          audioEngineRef.current?.playEndChime()
          showToast(`No answer from ${peer.name}`)
          cleanupMediaAndPc()
          setActiveCall(null)
        }, RING_TIMEOUT_MS)
      } catch (err) {
        cleanupMediaAndPc()
        setActiveCall(null)
        showToast(err instanceof Error ? err.message : 'Unable to start call.')
      }
    },
    [
      acquireUserMedia,
      attachStreamsToMediaElements,
      cleanupMediaAndPc,
      createPeerConnection,
      postCallCardMessage,
      showToast,
      syncTerminalStatus,
    ],
  )

  // ACCEPT INCOMING CALL
  const acceptIncomingCall = useCallback(async () => {
    const incoming = incomingCallRef.current
    if (!incoming) return

    audioEngineRef.current?.stopLoops()
    handledCallIdsRef.current.add(incoming.id)
    setIncomingCall(null)

    let acquired: { stream: MediaStream; effectiveType: CallMediaType }
    try {
      acquired = await acquireUserMedia(incoming.callType, 'user')
    } catch (err) {
      await syncTerminalStatus(incoming.id, 'declined', 0)
      showToast(
        err instanceof Error
          ? err.message
          : 'Microphone access is required to answer the call.',
      )
      return
    }

    const { stream, effectiveType } = acquired
    localStreamRef.current = stream
    setFacingMode('user')
    setIsMuted(false)
    setIsVideoEnabled(effectiveType === 'video')
    setIsCallMinimized(false)

    const now = Date.now()
    const session: ActiveCallSession = {
      id: incoming.id,
      roomId: incoming.roomId,
      callType: incoming.callType,
      direction: 'incoming',
      status: 'connecting',
      statusLabel: 'Connecting...',
      peer: {
        id: incoming.callerId,
        name: incoming.callerName,
        role: incoming.callerRole,
        subtitle: incoming.callerSubtitle,
        roomId: incoming.roomId,
      },
      startedAtMs: incoming.startedAtMs,
      connectedAtMs: now,
    }
    activeCallRecordRef.current = incoming
    setActiveCall(session)

    try {
      const pc = createPeerConnection(incoming.id, 'callee', stream)
      if (incoming.offerSdp) {
        const offerInit = JSON.parse(incoming.offerSdp) as RTCSessionDescriptionInit
        await pc.setRemoteDescription(new RTCSessionDescription(offerInit))
        remoteDescSetRef.current = true
      }

      if (incoming.callerCandidates.length > 0) {
        await flushRemoteCandidates(incoming.callerCandidates)
      }

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      const answerSdpStr = JSON.stringify(answer)

      await updateDoc(doc(db, 'campusCalls', incoming.id), {
        status: 'accepted',
        answerSdp: answerSdpStr,
        connectedAtMs: now,
        updatedAtMs: now,
      }).catch(() => {})

      fetch('/api/campus/call/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'answer',
          callId: incoming.id,
          actorId: actorRef.current.id,
          answerSdp: answerSdpStr,
        }),
      }).catch(() => {})

      activeCallUnsubRef.current = onSnapshot(
        doc(db, 'campusCalls', incoming.id),
        (snap) => {
          if (!snap.exists()) return
          const parsed = parseFirestoreCallDoc(snap.id, snap.data() as Record<string, unknown>)
          if (parsed) {
            void handleCallRecordUpdateRef.current(parsed)
          }
        },
        () => {},
      )

      audioEngineRef.current?.playConnectChime()
      setActiveCall((prev) =>
        prev && prev.id === incoming.id
          ? { ...prev, status: 'connected', statusLabel: 'Connected', connectedAtMs: now }
          : prev,
      )
      attachStreamsToMediaElements()
    } catch (err) {
      await syncTerminalStatus(incoming.id, 'ended', 0)
      cleanupMediaAndPc()
      setActiveCall(null)
      showToast(err instanceof Error ? err.message : 'Failed to connect call.')
    }
  }, [
    acquireUserMedia,
    attachStreamsToMediaElements,
    cleanupMediaAndPc,
    createPeerConnection,
    flushRemoteCandidates,
    showToast,
    syncTerminalStatus,
  ])

  // DECLINE INCOMING CALL
  const declineIncomingCall = useCallback(async () => {
    const incoming = incomingCallRef.current
    if (!incoming) return
    audioEngineRef.current?.playEndChime()
    setIncomingCall(null)
    await syncTerminalStatus(incoming.id, 'declined', 0)
    void postCallCardMessage({
      id: incoming.id,
      roomId: incoming.roomId,
      callType: incoming.callType,
      callStatus: 'declined',
      durationSec: 0,
      callerId: incoming.callerId,
      callerName: incoming.callerName,
      callerRole: incoming.callerRole,
      calleeId: incoming.calleeId,
    })
  }, [postCallCardMessage, syncTerminalStatus])

  // END ACTIVE CALL
  const endActiveCall = useCallback(async () => {
    const current = activeCallRef.current
    if (!current) return
    const record = activeCallRecordRef.current
    const me = actorRef.current

    const wasConnected = current.status === 'connected' && Boolean(current.connectedAtMs)
    const durationSec = wasConnected
      ? Math.max(1, Math.round((Date.now() - (current.connectedAtMs || Date.now())) / 1000))
      : 0
    const finalStatus: 'ended' | 'missed' =
      current.direction === 'outgoing' && !wasConnected ? 'missed' : 'ended'

    audioEngineRef.current?.playEndChime()
    cleanupMediaAndPc()
    setActiveCall(null)

    await syncTerminalStatus(current.id, finalStatus, durationSec)
    if (current.direction === 'outgoing' && !wasConnected) {
      dispatchCallPushSignal({
        id: current.id,
        roomId: current.roomId,
        callType: current.callType,
        callerId: me.id,
        callerName: me.name,
        calleeId: current.peer.id,
        action: 'cancel',
      })
    }

    const callerId =
      record?.callerId || (current.direction === 'outgoing' ? me.id : current.peer.id)
    const callerName =
      record?.callerName || (current.direction === 'outgoing' ? me.name : current.peer.name)
    const callerRole =
      record?.callerRole || (current.direction === 'outgoing' ? me.role : current.peer.role)
    const calleeId =
      record?.calleeId || (current.direction === 'outgoing' ? current.peer.id : me.id)

    void postCallCardMessage({
      id: current.id,
      roomId: current.roomId,
      callType: current.callType,
      callStatus: finalStatus,
      durationSec,
      callerId,
      callerName,
      callerRole,
      calleeId,
    })
  }, [cleanupMediaAndPc, postCallCardMessage, syncTerminalStatus])

  const pendingNativeCallActionRef = useRef<{ callId: string; action: 'accept' | 'decline' } | null>(null)
  const acceptIncomingCallRef = useRef(acceptIncomingCall)
  acceptIncomingCallRef.current = acceptIncomingCall

  // Handle native Android full-screen IncomingCallActivity Accept/Decline or call notification taps
  useEffect(() => {
    if (typeof window === 'undefined' || !actor.id) return

    const handleCallDeepLink = (rawHref?: string | null) => {
      const parsed = parseNotificationHref(rawHref)
      if (!parsed?.callId) return
      const targetCallId = parsed.callId
      const targetAction = parsed.callAction

      if (targetAction === 'accept') {
        pendingNativeCallActionRef.current = { callId: targetCallId, action: 'accept' }
      } else if (targetAction === 'decline') {
        pendingNativeCallActionRef.current = null
        handledCallIdsRef.current.add(targetCallId)
        setIncomingCall((prev) => (prev?.id === targetCallId ? null : prev))
        void syncTerminalStatus(targetCallId, 'declined', 0)
        return
      }

      if (incomingCallRef.current?.id === targetCallId && targetAction === 'accept') {
        pendingNativeCallActionRef.current = null
        void acceptIncomingCallRef.current()
        return
      }

      // Immediately fetch the exact call doc from Firestore so cold-start Accept answers in <300ms
      void getDoc(doc(db, 'campusCalls', targetCallId))
        .then((snap) => {
          if (!snap.exists()) return
          const rec = parseFirestoreCallDoc(snap.id, snap.data() as Record<string, unknown>)
          if (rec) {
            mergeCallRecords([rec])
          }
        })
        .catch(() => {})
    }

    handleCallDeepLink(window.location.hash)
    handleCallDeepLink(peekPendingNotificationHref())

    const onNotifNav = (e: Event) => {
      const custom = e as CustomEvent<ParsedNotificationTarget>
      if (custom.detail?.href) handleCallDeepLink(custom.detail.href)
    }
    const onNativeOpen = (e: Event) => {
      const custom = e as CustomEvent<{ href?: string }>
      if (custom.detail?.href) handleCallDeepLink(custom.detail.href)
    }
    const onHash = () => handleCallDeepLink(window.location.hash)

    window.addEventListener('ics-notification-navigate', onNotifNav)
    window.addEventListener('ics-notification-open', onNativeOpen)
    window.addEventListener('hashchange', onHash)
    return () => {
      window.removeEventListener('ics-notification-navigate', onNotifNav)
      window.removeEventListener('ics-notification-open', onNativeOpen)
      window.removeEventListener('hashchange', onHash)
    }
  }, [actor.id, mergeCallRecords, syncTerminalStatus])

  // Auto-answer immediately when the targeted ringing call loads after native Accept tap
  useEffect(() => {
    if (!incomingCall) return
    const pending = pendingNativeCallActionRef.current
    if (pending && pending.callId === incomingCall.id && pending.action === 'accept') {
      pendingNativeCallActionRef.current = null
      void acceptIncomingCallRef.current()
    }
  }, [incomingCall])

  // Phone-style repeating vibration while in-app full-screen incoming call screen is ringing
  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
    if (!incomingCall || activeCall) {
      try {
        navigator.vibrate(0)
      } catch {
        // Ignore
      }
      return
    }
    const vibratePulse = () => {
      try {
        navigator.vibrate([450, 350, 450])
      } catch {
        // Ignore
      }
    }
    vibratePulse()
    const timer = window.setInterval(vibratePulse, 2000)
    return () => {
      window.clearInterval(timer)
      try {
        navigator.vibrate(0)
      } catch {
        // Ignore
      }
    }
  }, [incomingCall, activeCall])

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    setIsMuted((prev) => {
      const next = !prev
      for (const track of stream.getAudioTracks()) {
        track.enabled = !next
      }
      return next
    })
  }, [])

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const tracks = stream.getVideoTracks()
    if (tracks.length === 0) {
      showToast('No camera track active on this call.')
      return
    }
    setIsVideoEnabled((prev) => {
      const next = !prev
      for (const track of tracks) {
        track.enabled = next
      }
      return next
    })
  }, [showToast])

  const flipCamera = useCallback(async () => {
    const current = activeCallRef.current
    const stream = localStreamRef.current
    const pc = pcRef.current
    if (!current || current.callType !== 'video' || !stream || !pc) return

    const nextFacing = facingMode === 'user' ? 'environment' : 'user'
    try {
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: nextFacing },
          width: { ideal: 960 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      const newTrack = newVideoStream.getVideoTracks()[0]
      if (!newTrack) return

      const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
      if (sender) {
        await sender.replaceTrack(newTrack)
      }

      for (const oldTrack of stream.getVideoTracks()) {
        stream.removeTrack(oldTrack)
        oldTrack.stop()
      }
      stream.addTrack(newTrack)
      setFacingMode(nextFacing)
      setIsVideoEnabled(true)
      attachStreamsToMediaElements()
    } catch {
      showToast('Alternate camera is not available on this device.')
    }
  }, [attachStreamsToMediaElements, facingMode, showToast])

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn((prev) => {
      const next = !prev
      if (remoteAudioRef.current) {
        remoteAudioRef.current.muted = !next
      }
      return next
    })
  }, [])

  const markMissedCallsSeen = useCallback(() => {
    const now = Date.now()
    setMissedSeenAt(now)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(`${LOCAL_MISSED_SEEN_KEY}_${actorRef.current.id}`, String(now))
      } catch {
        // Ignore
      }
    }
  }, [])

  const unreadMissedCallsCount = useMemo(() => {
    return callHistory.filter(
      (c) =>
        c.calleeId === actor.id &&
        (c.status === 'missed' || c.status === 'declined') &&
        c.startedAtMs > missedSeenAt,
    ).length
  }, [actor.id, callHistory, missedSeenAt])

  const contextValue = useMemo<CampusCallContextValue>(
    () => ({
      actor,
      activeCall,
      incomingCall,
      callHistory,
      unreadMissedCallsCount,
      isCallMinimized,
      callToast,
      startCall,
      acceptIncomingCall,
      declineIncomingCall,
      endActiveCall,
      toggleMute,
      toggleVideo,
      flipCamera,
      setMinimized: setIsCallMinimized,
      markMissedCallsSeen,
      registerActiveCallActor,
      clearCallToast,
    }),
    [
      actor,
      activeCall,
      incomingCall,
      callHistory,
      unreadMissedCallsCount,
      isCallMinimized,
      callToast,
      startCall,
      acceptIncomingCall,
      declineIncomingCall,
      endActiveCall,
      toggleMute,
      toggleVideo,
      flipCamera,
      markMissedCallsSeen,
      registerActiveCallActor,
      clearCallToast,
    ],
  )

  return (
    <CampusCallContext.Provider value={contextValue}>
      {children}

      {/* Persistent hidden remote audio element so audio keeps playing even when minimized */}
      {activeCall && (
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" aria-hidden="true" />
      )}

      {/* Subtle transient call toast (camera fallback, busy, declined, no answer) */}
      {callToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 top-[calc(var(--safe-top)+0.75rem)] z-[95] mx-auto flex max-w-sm items-center justify-between gap-2.5 rounded-2xl bg-[#0B1014]/95 px-4 py-2.5 text-xs font-medium text-white shadow-2xl backdrop-blur-xl"
        >
          <span className="flex items-center gap-2">
            <Phone className="size-3.5 shrink-0 text-[#0095F6]" />
            <span>{callToast}</span>
          </span>
          <button
            type="button"
            onClick={clearCallToast}
            aria-label="Dismiss call notice"
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* 1. COMPACT MINIMIZED FLOATING CALL BAR (44px compact chrome, persists across all tabs) */}
      {activeCall && isCallMinimized && (
        <div className="fixed inset-x-3 top-[calc(var(--safe-top)+0.5rem)] z-[85] mx-auto max-w-md">
          <div className="flex h-11 items-center justify-between gap-2 rounded-full bg-[#0B1014]/95 px-2.5 text-white shadow-xl shadow-black/50 backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setIsCallMinimized(false)}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            >
              <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0095F6]/20 text-[#0095F6]">
                {activeCall.callType === 'video' ? (
                  <Video className="size-3.5" />
                ) : (
                  <Phone className="size-3.5" />
                )}
                <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[#0095F6] animate-pulse" />
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                {activeCall.peer.name}
              </span>
              <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-[#0095F6]">
                {activeCall.status === 'connected'
                  ? formatCallDuration(elapsedSec)
                  : activeCall.statusLabel}
              </span>
            </button>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                className={cn(
                  'flex size-8 items-center justify-center rounded-full transition-colors',
                  isMuted ? 'bg-white text-slate-900' : 'bg-[#141A1F] text-white hover:bg-[#1C2329]',
                )}
              >
                {isMuted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setIsCallMinimized(false)}
                aria-label="Expand call screen"
                className="flex size-8 items-center justify-center rounded-full bg-[#141A1F] text-white transition-colors hover:bg-[#1C2329]"
              >
                <Maximize2 className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void endActiveCall()}
                aria-label="End call"
                className="flex size-8 items-center justify-center rounded-full bg-rose-600 text-white transition-colors hover:bg-rose-500"
              >
                <PhoneOff className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. ACTIVE VOICE / VIDEO CALL FULL-SCREEN STAGE */}
      {activeCall && !isCallMinimized && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${activeCall.callType === 'video' ? 'Video' : 'Voice'} call with ${activeCall.peer.name}`}
          className="fixed inset-0 z-[88] flex h-[100dvh] w-full flex-col overflow-hidden bg-black text-white"
        >
          {/* Video Background Layer */}
          {activeCall.callType === 'video' ? (
            <div className="absolute inset-0 bg-black">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={cn(
                  'h-full w-full object-cover transition-opacity duration-300',
                  hasRemoteVideo ? 'opacity-100' : 'opacity-0',
                )}
              />
              {!hasRemoteVideo && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgba(0,149,246,0.18),rgba(0,0,0,0.98)_65%)] px-6 text-center">
                  <div className="relative flex size-28 items-center justify-center rounded-full bg-[#0095F6]/20 text-3xl font-bold text-white shadow-2xl">
                    {getInitials(activeCall.peer.name)}
                    {activeCall.status !== 'connected' && (
                      <span className="pointer-events-none absolute -inset-3 rounded-full bg-[#0095F6]/15 animate-ping" />
                    )}
                  </div>
                  <h2 className="mt-5 text-2xl font-bold tracking-tight text-white">
                    {activeCall.peer.name}
                  </h2>
                  {activeCall.peer.subtitle && (
                    <p className="mt-1 text-sm text-white/65">{activeCall.peer.subtitle}</p>
                  )}
                  <p className="mt-2 font-mono text-sm font-semibold tabular-nums text-[#0095F6]">
                    {activeCall.status === 'connected'
                      ? formatCallDuration(elapsedSec)
                      : activeCall.statusLabel}
                  </p>
                </div>
              )}
              {/* Top & bottom readability scrims */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 via-black/30 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

              {/* Local Self-View PiP */}
              <div
                className={cn(
                  'absolute right-4 top-[calc(var(--safe-top)+4.75rem)] z-20 h-36 w-24 overflow-hidden rounded-2xl bg-[#0B1014] shadow-2xl sm:h-48 sm:w-36',
                  !isVideoEnabled && 'flex items-center justify-center',
                )}
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className={cn(
                    'h-full w-full object-cover',
                    facingMode === 'user' && '-scale-x-100',
                    !isVideoEnabled && 'hidden',
                  )}
                />
                {!isVideoEnabled && (
                  <div className="flex flex-col items-center gap-1 text-white/70">
                    <VideoOff className="size-5" />
                    <span className="text-[10px] font-medium">Camera off</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Voice Call Ambient Canvas */
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(0,149,246,0.18),rgba(0,0,0,1)_68%)]" />
          )}

          {/* Top Bar */}
          <div className="relative z-10 flex items-center justify-between px-4 pt-[calc(var(--safe-top)+0.75rem)] pb-3">
            <button
              type="button"
              onClick={() => setIsCallMinimized(true)}
              aria-label="Minimize call"
              className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20"
            >
              <ChevronDown className="size-5" />
            </button>

            <div className="flex flex-col items-center text-center">
              <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-[#0095F6]">
                <ShieldCheck className="size-3.5" />
                ICS Academy · {activeCall.callType === 'video' ? 'Video Call' : 'Voice Call'}
              </span>
              {activeCall.callType === 'video' && hasRemoteVideo && (
                <div className="mt-0.5 flex items-center gap-2 text-xs text-white/85">
                  <span className="max-w-[160px] truncate font-semibold">
                    {activeCall.peer.name}
                  </span>
                  <span className="text-white/40">·</span>
                  <span className="font-mono tabular-nums text-[#0095F6]">
                    {activeCall.status === 'connected'
                      ? formatCallDuration(elapsedSec)
                      : activeCall.statusLabel}
                  </span>
                </div>
              )}
            </div>

            {activeCall.callType === 'video' ? (
              <button
                type="button"
                onClick={() => void flipCamera()}
                aria-label="Flip camera"
                className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20"
              >
                <RefreshCw className="size-4.5" />
              </button>
            ) : (
              <div className="size-11" aria-hidden="true" />
            )}
          </div>

          {/* Center Stage (Voice Call Focal Avatar & Timer) */}
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
            {activeCall.callType === 'voice' && (
              <>
                <div className="relative flex size-32 items-center justify-center rounded-full bg-[#0095F6]/20 text-4xl font-bold tracking-tight text-white shadow-2xl">
                  {getInitials(activeCall.peer.name)}
                  {activeCall.status !== 'connected' ? (
                    <span className="pointer-events-none absolute -inset-3 rounded-full bg-[#0095F6]/15 animate-ping" />
                  ) : (
                    <span className="pointer-events-none absolute -inset-2 rounded-full bg-[#0095F6]/12 animate-pulse" />
                  )}
                </div>
                <h2 className="mt-6 max-w-xs truncate text-2xl font-bold tracking-tight text-white">
                  {activeCall.peer.name}
                </h2>
                {activeCall.peer.subtitle && (
                  <p className="mt-1 text-sm text-white/65">{activeCall.peer.subtitle}</p>
                )}
                <p className="mt-3 font-mono text-base font-semibold tabular-nums text-[#0095F6]">
                  {activeCall.status === 'connected'
                    ? formatCallDuration(elapsedSec)
                    : activeCall.statusLabel}
                </p>
                {isMuted && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-300">
                    <MicOff className="size-3.5" />
                    Microphone muted
                  </p>
                )}
              </>
            )}
          </div>

          {/* Bottom Control Dock (Thumb-Zone Ergonomics) */}
          <div className="relative z-10 px-4 pb-[calc(var(--safe-bottom)+1.5rem)] pt-3">
            <div className="mx-auto flex max-w-md items-center justify-around rounded-3xl bg-[#0B1014]/92 px-3 py-3.5 shadow-2xl backdrop-blur-xl">
              <button
                type="button"
                onClick={toggleSpeaker}
                aria-label={isSpeakerOn ? 'Mute speaker' : 'Unmute speaker'}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    'flex size-12 items-center justify-center rounded-full transition-colors',
                    isSpeakerOn
                      ? 'bg-[#141A1F] text-white hover:bg-[#1C2329]'
                      : 'bg-white text-slate-900',
                  )}
                >
                  {isSpeakerOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
                </span>
                <span className="text-[11px] font-medium text-white/80">
                  {isSpeakerOn ? 'Speaker' : 'Muted'}
                </span>
              </button>

              {activeCall.callType === 'video' && (
                <button
                  type="button"
                  onClick={toggleVideo}
                  aria-label={isVideoEnabled ? 'Turn camera off' : 'Turn camera on'}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span
                    className={cn(
                      'flex size-12 items-center justify-center rounded-full transition-colors',
                      isVideoEnabled
                        ? 'bg-[#141A1F] text-white hover:bg-[#1C2329]'
                        : 'bg-white text-slate-900',
                    )}
                  >
                    {isVideoEnabled ? <Video className="size-5" /> : <VideoOff className="size-5" />}
                  </span>
                  <span className="text-[11px] font-medium text-white/80">
                    {isVideoEnabled ? 'Video' : 'Cam Off'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    'flex size-12 items-center justify-center rounded-full transition-colors',
                    isMuted
                      ? 'bg-white text-slate-900'
                      : 'bg-[#141A1F] text-white hover:bg-[#1C2329]',
                  )}
                >
                  {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                </span>
                <span className="text-[11px] font-medium text-white/80">
                  {isMuted ? 'Unmute' : 'Mute'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => void endActiveCall()}
                aria-label="End call"
                className="flex flex-col items-center gap-1.5"
              >
                <span className="flex size-14 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-900/50 transition-transform active:scale-95 hover:bg-rose-500">
                  <PhoneOff className="size-6" />
                </span>
                <span className="text-[11px] font-semibold text-rose-300">End</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. GLOBAL FULL-SCREEN INCOMING CALL OVERLAY (Rings across every screen like a real phone call) */}
      {incomingCall && !activeCall && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label={`Incoming ${incomingCall.callType} call from ${incomingCall.callerName}`}
          className="fixed inset-0 z-[9999] flex h-[100dvh] w-full flex-col justify-between overflow-hidden bg-[#06090D] px-6 pt-[calc(var(--safe-top)+2rem)] pb-[calc(var(--safe-bottom)+2.75rem)] text-white"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(16,185,129,0.22),transparent_65%)]" />

          {/* Top label */}
          <div className="relative z-10 flex flex-col items-center text-center">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-400">
              {incomingCall.callType === 'video' ? (
                <Video className="size-4" />
              ) : (
                <PhoneIncoming className="size-4" />
              )}
              ICS Academy · Incoming {incomingCall.callType === 'video' ? 'Video' : 'Voice'} Call
            </span>
          </div>

          {/* Caller focal identity */}
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="relative flex size-36 items-center justify-center rounded-full border-2 border-emerald-400/50 bg-emerald-500/20 text-4xl font-bold text-white shadow-2xl shadow-emerald-950/60">
              {getInitials(incomingCall.callerName)}
              <span className="pointer-events-none absolute -inset-4 rounded-full border border-emerald-400/30 animate-ping" />
              <span className="pointer-events-none absolute -inset-8 rounded-full bg-emerald-500/10 animate-pulse" />
            </div>
            <h2 className="mt-8 max-w-xs truncate text-3xl font-bold tracking-tight text-white">
              {incomingCall.callerName}
            </h2>
            <p className="mt-1.5 text-sm text-white/75">
              {incomingCall.callerSubtitle ||
                (incomingCall.callerRole === 'principal'
                  ? 'Principal'
                  : incomingCall.callerRole === 'usthad'
                    ? 'Class Usthad'
                    : 'Student')}
            </p>
            <p className="mt-3 text-sm font-medium tracking-wide text-emerald-400 animate-pulse">
              Ringing...
            </p>
          </div>

          {/* Bottom Accept / Decline native phone-style thumb controls */}
          <div className="relative z-10 mx-auto flex w-full max-w-xs items-center justify-between px-4">
            <button
              type="button"
              onClick={() => void declineIncomingCall()}
              className="flex flex-col items-center gap-3"
            >
              <span className="flex size-[72px] items-center justify-center rounded-full bg-rose-600 text-white shadow-2xl shadow-rose-950/70 transition-transform active:scale-95 hover:bg-rose-500">
                <PhoneOff className="size-8" />
              </span>
              <span className="text-sm font-semibold text-white/90">Decline</span>
            </button>

            <button
              type="button"
              onClick={() => void acceptIncomingCall()}
              className="flex flex-col items-center gap-3"
            >
              <span className="flex size-[72px] items-center justify-center rounded-full bg-emerald-500 text-white shadow-2xl shadow-emerald-950/70 transition-transform active:scale-95 hover:bg-emerald-400 animate-bounce">
                {incomingCall.callType === 'video' ? (
                  <Video className="size-8" />
                ) : (
                  <Phone className="size-8" />
                )}
              </span>
              <span className="text-sm font-semibold text-white/90">Accept</span>
            </button>
          </div>
        </div>
      )}
    </CampusCallContext.Provider>
  )
}

export function useCampusCall(): CampusCallContextValue {
  const ctx = useContext(CampusCallContext)
  if (!ctx) {
    throw new Error('useCampusCall must be used inside CampusCallProvider')
  }
  return ctx
}
