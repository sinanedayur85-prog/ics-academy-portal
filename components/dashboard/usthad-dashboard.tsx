'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
   serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage'
import {
  BookOpen,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  CloudUpload,
  FileText,
  Globe,
  GraduationCap,
  Library,
  Loader2,
  LogIn,
  LogOut,
  Megaphone,
  Minus,
  Pin,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { AppUpdateButton } from '@/components/app-update-manager'
import { BrandLogoMark, BrandWordmark } from '@/components/brand-wordmark'
import {
  CampusNotificationBar,
  CampusNotificationBell,
} from '@/components/campus-notifications'
import {
  ABSENT_REASONS,
  ALL_ACADEMY_CLASS_NAMES,
  ATTENDANCE_LEAVE_REASONS,
  BS_DEGREE_CLASS_NAMES,
  CLASS_USTHADS,
  HIGH_SCHOOL_CLASS_NAMES,
  MONTHS_META,
  formatTargetClassesBadge,
  getEffectiveStudentAttendance,
  getNoticeTargetClasses,
  leaveReasons,
  loadAttendanceOverrides,
  loadCustomNotices,
  notices as defaultNotices,
  publishCampusNotification,
  saveAttendanceOverrides,
  saveCustomNotices,
  students,
  type AttendanceOverrideMap,
  type ClassUsthad,
  type Notice,
  type OfficialHolidayMeta,
  type Student,
} from '@/components/dashboard/data'
import { ClassLeaderAttendanceCard } from '@/components/dashboard/class-leader-attendance-card'
import {
  CURATED_KITABS,
  addKitabIdToBookmarksStorage,
  deleteKitabPdfBlobLocally,
  notifyDigitalLibraryUpdated,
  saveKitabPdfBlobLocally,
  withCloudTimeout,
  type DigitalKitabItem,
  type KitabCategory,
} from '@/components/dashboard/digital-library'
import { ExamResultCard } from '@/components/dashboard/exam-result-card'
import type { SavedLeaveEntry } from '@/components/dashboard/leave-register'
import { Panel, fieldClassName } from '@/components/dashboard/panel'
import { ParentReportModal } from '@/components/dashboard/parent-report-modal'
import { UsthadSwitcher } from '@/components/dashboard/student-switcher'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  storage,
} from '@/src/lib/firebase'
import { cn } from '@/lib/utils'

const LOCAL_UPLOADS_STORAGE_KEY = 'ics_digital_library_uploads_v1'
const RADIUS = 48
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const usthadNavItems = [
  { label: 'Class Students', href: '#class-roster', icon: Users },
  { label: 'Attendance Status', href: '#usthad-attendance', icon: CalendarCheck },
  { label: 'Leave Register', href: '#usthad-leave', icon: ClipboardList },
  { label: 'Notice Board', href: '#usthad-notices', icon: Megaphone },
  { label: 'Digital Library PDF', href: '#usthad-kitabs', icon: Library },
  { label: 'University Portal', href: '#university-portal', icon: Globe },
]

const CATEGORY_LABELS: Record<KitabCategory, string> = {
  fiqh: 'Fiqh & Usul (الْفِقْهُ وَأُصُولُهُ)',
  hadith: 'Hadith Studies (الْحَدِيثُ الشَّرِيفُ)',
  tafsir: 'Tafsir & Ulum (التَّفْسِيرُ وَعُلُومُ الْقُرْآنِ)',
  aqeedah: 'Aqeedah & Tasawwuf (الْعَقِيدَةُ وَالتَّصَوُّفُ)',
  nahw: 'Nahw & Sarf (النَّحْوُ وَالصَّرْفُ)',
  history: "History & Da'wa (التَّارِيخُ وَالدَّعْوَةُ)",
}

function sanitizeId(raw: string) {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120) || `item_${Date.now()}`
}

function formatNowParts(): { dateString: string; timeString: string } {
  const d = new Date()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = String(d.getDate()).padStart(2, '0')
  const month = months[d.getMonth()]
  const year = d.getFullYear()
  const hours24 = d.getHours()
  const period = hours24 >= 12 ? 'PM' : 'AM'
  const hours12 = String(hours24 % 12 || 12).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return {
    dateString: `${day} ${month} ${year}`,
    timeString: `${hours12}:${minutes} ${period}`,
  }
}

function loadStudentLeaveEntriesFromStorage(studentId: string): SavedLeaveEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const safeId = sanitizeId(studentId)
    const raw = window.localStorage.getItem(`ics_leave_records_${safeId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedLeaveEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveStudentLeaveEntriesToStorage(studentId: string, entries: SavedLeaveEntry[]) {
  if (typeof window === 'undefined') return
  try {
    const safeId = sanitizeId(studentId)
    window.localStorage.setItem(`ics_leave_records_${safeId}`, JSON.stringify(entries))
  } catch {
    // Ignore storage quota errors
  }
}

export function UsthadDashboard() {
  const [usthad] = useState<ClassUsthad>(() => {
    if (typeof window !== 'undefined') {
      const savedId = window.localStorage.getItem('loggedInUsthadId')
      const matched = CLASS_USTHADS.find((u) => u.id === savedId)
      if (matched) return matched
    }
    return CLASS_USTHADS.find((u) => u.batchCode === '07') ?? CLASS_USTHADS[0]
  })

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [mobileTab, setMobileTab] = useState<
    'roster' | 'attendance' | 'leave' | 'notices' | 'library'
  >('roster')
  const [mobileLibrarySubTab, setMobileLibrarySubTab] = useState<'kitabs' | 'portal'>('kitabs')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setFirebaseUser(u))
    return () => unsub()
  }, [])

  useEffect(() => {
    const syncHash = () => {
      if (typeof window === 'undefined') return
      const hash = window.location.hash.replace('#', '')
      if (!hash) return
      if (hash === 'class-roster') setMobileTab('roster')
      else if (hash === 'usthad-attendance' || hash === 'class-attendance')
        setMobileTab('attendance')
      else if (hash === 'usthad-leave') setMobileTab('leave')
      else if (hash === 'usthad-notices') setMobileTab('notices')
      else if (hash === 'usthad-kitabs') {
        setMobileTab('library')
        setMobileLibrarySubTab('kitabs')
      } else if (hash === 'university-portal') {
        setMobileTab('library')
        setMobileLibrarySubTab('portal')
      }
    }
    syncHash()
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [])

  // Strictly filter students to ONLY the logged-in Class Usthad's assigned class
  const classStudents = useMemo(
    () => students.filter((s) => s.className === usthad.className),
    [usthad.className],
  )

  // Shared Attendance Overrides
  const [attendanceOverrides, setAttendanceOverrides] = useState<AttendanceOverrideMap>(() =>
    loadAttendanceOverrides(),
  )

  // Selected Student & Month for Attendance Editor
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    () => classStudents[0]?.id ?? students[0].id,
  )
  const [selectedMonthId, setSelectedMonthId] = useState<string>('2026-10')
  const [editPresent, setEditPresent] = useState<number>(22)
  const [editAbsent, setEditAbsent] = useState<number>(0)
  const [editLeave, setEditLeave] = useState<number>(1)
  const [editAbsentReason, setEditAbsentReason] = useState<string>(ABSENT_REASONS[0])
  const [editLeaveReason, setEditLeaveReason] = useState<string>(ATTENDANCE_LEAVE_REASONS[0])
  const [focusedReasonField, setFocusedReasonField] = useState<'absent' | 'leave' | null>(null)
  const [attendanceSavedToast, setAttendanceSavedToast] = useState<string | null>(null)
  const [pdfReportStudent, setPdfReportStudent] = useState<Student | null>(null)

  // Roster Search & Status Filter
  const [rosterSearch, setRosterSearch] = useState('')
  const [rosterFilter, setRosterFilter] = useState<'all' | 'academy' | 'leave'>('all')

  // Class Leave Entries Map (studentId -> entries[])
  const [classLeaveMap, setClassLeaveMap] = useState<Record<string, SavedLeaveEntry[]>>({})
  const [leaveStudentId, setLeaveStudentId] = useState<string>(
    () => classStudents[0]?.id ?? students[0].id,
  )
  const [leaveActionType, setLeaveActionType] = useState<'application' | 'return'>('application')
  const [leaveReason, setLeaveReason] = useState<string>(leaveReasons[0])
  const [leaveDetails, setLeaveDetails] = useState<string>('')
  const [leaveSavedToast, setLeaveSavedToast] = useState<string | null>(null)

  // Notice Board Publisher State
  const [customNotices, setCustomNotices] = useState<Notice[]>(() => loadCustomNotices())
  const [noticeTitle, setNoticeTitle] = useState('')
  const [noticeCategory, setNoticeCategory] = useState<Notice['category']>('Hostel')
  const [noticePinned, setNoticePinned] = useState(true)
  const [noticeBody, setNoticeBody] = useState('')
  const [noticeTargetScope, setNoticeTargetScope] = useState<
    'all' | 'my-class' | 'high-school' | 'bs-degree' | 'custom'
  >('all')
  const [noticeCustomBatches, setNoticeCustomBatches] = useState<string[]>(() => [
    usthad.className,
  ])
  const [isHolidayNotice, setIsHolidayNotice] = useState(false)
  const [holidayType, setHolidayType] = useState<OfficialHolidayMeta['holidayType']>(
    'monthly-second-saturday',
  )
  const [holidayMonthId, setHolidayMonthId] = useState('2026-11')
  const [holidayDepartureDate, setHolidayDepartureDate] = useState(
    'Friday, 13 Nov 2026 (2nd Saturday Eve)',
  )
  const [holidayDepartureTime, setHolidayDepartureTime] = useState(
    '12:45 PM (Afternoon — After Jumu’ah)',
  )
  const [holidayReturnDate, setHolidayReturnDate] = useState('Monday, 16 Nov 2026')
  const [holidayReturnTime, setHolidayReturnTime] = useState(
    '07:30 AM (Morning — Before Class)',
  )
  const [holidayDaysDeducted, setHolidayDaysDeducted] = useState('3')
  const [holidayAnnouncedBy, setHolidayAnnouncedBy] = useState('Principal & Class Usthad')
  const [noticeToast, setNoticeToast] = useState<string | null>(null)

  // Digital Library Kitab Uploader State
  const [localKitabUploads, setLocalKitabUploads] = useState<DigitalKitabItem[]>([])
  const [kitabTitle, setKitabTitle] = useState('')
  const [kitabArabicTitle, setKitabArabicTitle] = useState('')
  const [kitabAuthor, setKitabAuthor] = useState('')
  const [kitabCategory, setKitabCategory] = useState<KitabCategory>('fiqh')
  const [kitabPages, setKitabPages] = useState('180')
  const [kitabLanguage, setKitabLanguage] = useState('Arabic & Malayalam')
  const [kitabSummary, setKitabSummary] = useState('')
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null)
  const [uploadingKitab, setUploadingKitab] = useState(false)
  const [kitabStatusMsg, setKitabStatusMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refreshClassLeaves = useCallback(() => {
    const nextMap: Record<string, SavedLeaveEntry[]> = {}
    for (const st of classStudents) {
      const entries = loadStudentLeaveEntriesFromStorage(st.id)
      nextMap[st.id] = entries.sort((a, b) => b.createdAtMs - a.createdAtMs)
    }
    setClassLeaveMap(nextMap)
  }, [classStudents])

  useEffect(() => {
    refreshClassLeaves()
    try {
      const savedKitabs = window.localStorage.getItem(LOCAL_UPLOADS_STORAGE_KEY)
      if (savedKitabs) {
        const parsed = JSON.parse(savedKitabs) as DigitalKitabItem[]
        if (Array.isArray(parsed)) setLocalKitabUploads(parsed)
      }
    } catch {
      // Ignore storage errors
    }
  }, [refreshClassLeaves])

  const selectedStudent = useMemo(
    () => classStudents.find((s) => s.id === selectedStudentId) ?? classStudents[0],
    [classStudents, selectedStudentId],
  )

  const selectedStudentEffective = useMemo(
    () =>
      selectedStudent
        ? getEffectiveStudentAttendance(selectedStudent, attendanceOverrides, customNotices)
        : null,
    [selectedStudent, attendanceOverrides, customNotices],
  )

  const selectedMonthRecord = useMemo(
    () =>
      selectedStudentEffective?.monthlyAttendance.find((m) => m.id === selectedMonthId) ??
      selectedStudentEffective?.monthlyAttendance[0],
    [selectedStudentEffective, selectedMonthId],
  )

  // Keep the editor numeric inputs synced with the currently selected student & month
  useEffect(() => {
    if (selectedMonthRecord && selectedStudent) {
      setEditPresent(selectedMonthRecord.present)
      setEditAbsent(selectedMonthRecord.absent)
      setEditLeave(selectedMonthRecord.leave)
      const existingOverride = attendanceOverrides[`${selectedStudent.id}__${selectedMonthRecord.id}`]
      setEditAbsentReason(existingOverride?.absentReason ?? ABSENT_REASONS[0])
      setEditLeaveReason(existingOverride?.leaveReason ?? ATTENDANCE_LEAVE_REASONS[0])
      setFocusedReasonField(null)
    }
  }, [selectedMonthRecord, selectedStudent, attendanceOverrides])

  // Enrich class students with live effective attendance & leave status
  const enrichedClassStudents = useMemo(() => {
    return classStudents.map((st) => {
      const effective = getEffectiveStudentAttendance(st, attendanceOverrides, customNotices)
      const totalDays = effective.attendance.workingDays
      const overallRate =
        totalDays > 0 ? Math.round((effective.attendance.present / totalDays) * 1000) / 10 : 0
      const leaveEntries = classLeaveMap[st.id] ?? []
      const latestEntry = leaveEntries[0] ?? null
      const isOnLeave = latestEntry?.recordType === 'application'
      return {
        student: st,
        effective,
        overallRate,
        isOnLeave,
        activeLeaveEntry: isOnLeave ? latestEntry : null,
      }
    })
  }, [classStudents, attendanceOverrides, customNotices, classLeaveMap])

  const studentsCurrentlyOnLeave = useMemo(
    () => enrichedClassStudents.filter((item) => item.isOnLeave),
    [enrichedClassStudents],
  )

  const classAverageAttendance = useMemo(() => {
    if (enrichedClassStudents.length === 0) return 0
    const sum = enrichedClassStudents.reduce((acc, item) => acc + item.overallRate, 0)
    return Math.round((sum / enrichedClassStudents.length) * 10) / 10
  }, [enrichedClassStudents])

  const filteredRoster = useMemo(() => {
    const q = rosterSearch.trim().toLowerCase()
    return enrichedClassStudents.filter((item) => {
      if (rosterFilter === 'academy' && item.isOnLeave) return false
      if (rosterFilter === 'leave' && !item.isOnLeave) return false
      if (!q) return true
      return (
        item.student.name.toLowerCase().includes(q) ||
        item.student.admissionNo.toLowerCase().includes(q)
      )
    })
  }, [enrichedClassStudents, rosterFilter, rosterSearch])

  const allClassLeaveLogs = useMemo(() => {
    const all: SavedLeaveEntry[] = []
    for (const st of classStudents) {
      const entries = classLeaveMap[st.id] ?? []
      all.push(...entries)
    }
    return all.sort((a, b) => b.createdAtMs - a.createdAtMs)
  }, [classStudents, classLeaveMap])

  function handleSaveMonthAttendance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedStudent || !selectedMonthRecord) return

    const cleanAbsent = Math.max(0, Math.min(31, Number(editAbsent) || 0))
    const cleanLeave = Math.max(0, Math.min(31, Number(editLeave) || 0))
    const key = `${selectedStudent.id}__${selectedMonthRecord.id}`
    const nextOverrides: AttendanceOverrideMap = {
      ...attendanceOverrides,
      [key]: {
        present: Math.max(0, Math.min(31, Number(editPresent) || 0)),
        absent: cleanAbsent,
        leave: cleanLeave,
        ...(cleanAbsent > 0 ? { absentReason: editAbsentReason } : {}),
        ...(cleanLeave > 0 ? { leaveReason: editLeaveReason } : {}),
      },
    }
    setAttendanceOverrides(nextOverrides)
    saveAttendanceOverrides(nextOverrides)
    const reasonSummaryParts: string[] = []
    if (cleanAbsent > 0) reasonSummaryParts.push(`Absent: ${editAbsentReason}`)
    if (cleanLeave > 0) reasonSummaryParts.push(`Leave: ${editLeaveReason}`)
    setAttendanceSavedToast(
      `Updated ${selectedMonthRecord.month} ${selectedMonthRecord.year} attendance for ${selectedStudent.name}${reasonSummaryParts.length > 0 ? ` (${reasonSummaryParts.join(' · ')})` : ''}.`,
    )
    window.setTimeout(() => setAttendanceSavedToast(null), 4000)
  }

  function handleResetMonthAttendance() {
    if (!selectedStudent || !selectedMonthRecord) return
    const key = `${selectedStudent.id}__${selectedMonthRecord.id}`
    const nextOverrides = { ...attendanceOverrides }
    delete nextOverrides[key]
    setAttendanceOverrides(nextOverrides)
    saveAttendanceOverrides(nextOverrides)
    setAttendanceSavedToast(
      `Reset ${selectedMonthRecord.month} ${selectedMonthRecord.year} attendance to default for ${selectedStudent.name}.`,
    )
    window.setTimeout(() => setAttendanceSavedToast(null), 4000)
  }

  async function recordUsthadLeaveOrReturn(
    targetStudent: Student,
    recordType: 'application' | 'return',
    reasonText: string,
    detailsText: string,
  ) {
    const safeStudentId = sanitizeId(targetStudent.id)
    const activeUid = firebaseUser ? firebaseUser.uid : `portal_${safeStudentId}`
    const { dateString, timeString } = formatNowParts()
    const recordId = sanitizeId(`leave_${safeStudentId}_${Date.now()}`)

    const newEntry: SavedLeaveEntry = {
      id: recordId,
      uid: activeUid,
      studentId: safeStudentId,
      studentName: targetStudent.name,
      admissionNo: targetStudent.admissionNo,
      recordType,
      dateString,
      timeString,
      reason: recordType === 'return' ? 'Campus Return (Verified by Class Usthad)' : reasonText,
      details: detailsText,
      status: 'recorded',
      createdAtMs: Date.now(),
      syncedToCloud: true,
    }

    const existing = loadStudentLeaveEntriesFromStorage(targetStudent.id)
    const updated = [newEntry, ...existing]
    saveStudentLeaveEntriesToStorage(targetStudent.id, updated)
    refreshClassLeaves()

    publishCampusNotification({
      type: 'leave',
      title:
        recordType === 'return'
          ? `Campus Return Verified • ${targetStudent.name}`
          : `Leave Recorded • ${targetStudent.name}`,
      message:
        recordType === 'return'
          ? `${targetStudent.name} (${targetStudent.className}) returned to campus on ${dateString} at ${timeString}.`
          : `${targetStudent.name} (${targetStudent.className}) leave recorded: ${reasonText} (${dateString}).`,
      targetStudentId: targetStudent.id,
      targetClass: targetStudent.className,
      actorName: usthad.name,
      href: '#leave',
    })

    setLeaveSavedToast(
      recordType === 'return'
        ? `Marked ${targetStudent.name} as Returned to Academy.`
        : `Recorded leave for ${targetStudent.name} (${reasonText}).`,
    )
    window.setTimeout(() => setLeaveSavedToast(null), 4000)

    const path = `leaveRecords/${recordId}`
    try {
      await setDoc(doc(db, 'leaveRecords', recordId), {
        uid: activeUid,
        studentId: safeStudentId,
        studentName: newEntry.studentName.slice(0, 120),
        admissionNo: newEntry.admissionNo.slice(0, 40),
        recordType: newEntry.recordType,
        dateString: newEntry.dateString.slice(0, 40),
        timeString: newEntry.timeString.slice(0, 20),
        reason: newEntry.reason.slice(0, 120),
        details: newEntry.details.slice(0, 6000),
        status: newEntry.status,
        createdAt: serverTimestamp(),
      })
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, path)
      } catch {
        // Local storage already updated
      }
    }
  }

  function handleSubmitLeaveForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const st = classStudents.find((s) => s.id === leaveStudentId) ?? classStudents[0]
    if (!st) return
    void recordUsthadLeaveOrReturn(st, leaveActionType, leaveReason, leaveDetails.trim())
    setLeaveDetails('')
  }

  async function handleDeleteLeaveLog(entry: SavedLeaveEntry) {
    const existing = loadStudentLeaveEntriesFromStorage(entry.studentId)
    const updated = existing.filter((item) => item.id !== entry.id)
    saveStudentLeaveEntriesToStorage(entry.studentId, updated)
    refreshClassLeaves()

    if (entry.syncedToCloud) {
      const path = `leaveRecords/${entry.id}`
      try {
        await deleteDoc(doc(db, 'leaveRecords', entry.id))
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.DELETE, path)
        } catch {
          // Handled
        }
      }
    }
  }

  function getResolvedTargetClasses(): string[] | undefined {
    if (noticeTargetScope === 'all') return undefined
    if (noticeTargetScope === 'my-class') return [usthad.className]
    if (noticeTargetScope === 'high-school') return [...HIGH_SCHOOL_CLASS_NAMES]
    if (noticeTargetScope === 'bs-degree') return [...BS_DEGREE_CLASS_NAMES]
    return noticeCustomBatches.length > 0 ? [...noticeCustomBatches] : [usthad.className]
  }

  function toggleNoticeCustomBatch(batchName: string) {
    setNoticeCustomBatches((prev) =>
      prev.includes(batchName)
        ? prev.filter((b) => b !== batchName)
        : [...prev, batchName],
    )
  }

  function handlePublishNotice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanTitle = noticeTitle.trim()
    const cleanBody = noticeBody.trim()
    if (!cleanTitle || !cleanBody) return

    const todayIso = new Date().toISOString().slice(0, 10)
    const parsedDeduct = Math.max(0, Math.min(25, Number.parseInt(holidayDaysDeducted, 10) || 0))
    const resolvedTargets = getResolvedTargetClasses()
    const targetSummary = formatTargetClassesBadge(resolvedTargets)

    const newNotice: Notice = {
      id: `nt-usthad-${Date.now()}`,
      date: todayIso,
      category: noticeCategory,
      pinned: noticePinned,
      title: cleanTitle,
      body: cleanBody,
      ...(resolvedTargets ? { targetClasses: resolvedTargets } : {}),
      ...(isHolidayNotice
        ? {
            holidayMeta: {
              isOfficialHoliday: true,
              holidayType,
              monthId: holidayMonthId,
              departureDate: holidayDepartureDate.trim() || 'Friday (2nd Saturday Eve)',
              departureTime: holidayDepartureTime.trim() || '12:30 PM (Afternoon)',
              returnDate: holidayReturnDate.trim() || 'Monday Morning',
              returnTime: holidayReturnTime.trim() || '07:30 AM',
              holidayDaysDeducted: parsedDeduct,
              announcedBy: holidayAnnouncedBy.trim() || `${usthad.name} (Class Usthad)`,
              ...(resolvedTargets ? { targetClasses: resolvedTargets } : {}),
            },
          }
        : {}),
    }

    const updated = [newNotice, ...customNotices]
    setCustomNotices(updated)
    saveCustomNotices(updated)
    setNoticeTitle('')
    setNoticeBody('')
    setNoticeToast(
      isHolidayNotice
        ? `Published Official Holiday "${cleanTitle}" for ${targetSummary} — Working days for ${holidayMonthId} reduced by ${parsedDeduct} days for those batches.`
        : `Published notice "${cleanTitle}" for ${targetSummary}.`,
    )
    window.setTimeout(() => setNoticeToast(null), 5000)
  }

  function handleToggleNoticePin(noticeId: string) {
    const updated = customNotices.map((n) =>
      n.id === noticeId ? { ...n, pinned: !n.pinned } : n,
    )
    setCustomNotices(updated)
    saveCustomNotices(updated)
  }

  function handleDeleteCustomNotice(noticeId: string) {
    const updated = customNotices.filter((n) => n.id !== noticeId)
    setCustomNotices(updated)
    saveCustomNotices(updated)
  }

  async function handleUploadKitabPdf(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanTitle = kitabTitle.trim()
    const cleanAuthor = kitabAuthor.trim()
    const cleanSummary = kitabSummary.trim()
    if (!cleanTitle || !cleanAuthor || !cleanSummary) return

    setUploadingKitab(true)
    setKitabStatusMsg(null)

    const primaryStudentId = sanitizeId(classStudents[0]?.id ?? 'std-1')
    const activeUid = firebaseUser ? firebaseUser.uid : `portal_${primaryStudentId}`
    const slug =
      cleanTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48) || `kitab-${Date.now()}`

    const objectPath = `kitabs/${kitabCategory}/${slug}.pdf`
    const kitabId = sanitizeId(`kitab_${primaryStudentId}_${Date.now()}`)
    const parsedPages = Math.max(1, Math.min(5000, Number.parseInt(kitabPages, 10) || 180))
    const attachedFile = selectedPdfFile

    const newItem: DigitalKitabItem = {
      id: kitabId,
      uid: activeUid,
      studentId: primaryStudentId,
      title: cleanTitle,
      arabicTitle: kitabArabicTitle.trim(),
      author: cleanAuthor,
      category: kitabCategory,
      classBatch: usthad.fullClassLabel,
      language: kitabLanguage.trim() || 'Arabic & Malayalam',
      pages: parsedPages,
      storagePath: objectPath,
      pdfUrl: '',
      summary: cleanSummary,
      createdAtMs: Date.now(),
      isCustomUpload: true,
      syncedToCloud: Boolean(firebaseUser),
    }

    if (attachedFile) {
      void saveKitabPdfBlobLocally(kitabId, attachedFile)
    }

    setLocalKitabUploads((prev) => {
      const next = [newItem, ...prev]
      try {
        window.localStorage.setItem(LOCAL_UPLOADS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Ignore
      }
      return next
    })
    addKitabIdToBookmarksStorage(kitabId)
    notifyDigitalLibraryUpdated()

    setUploadingKitab(false)
    setKitabStatusMsg(`✅ "${newItem.title}" added to Digital Library!`)
    setKitabTitle('')
    setKitabArabicTitle('')
    setKitabAuthor('')
    setKitabSummary('')
    setSelectedPdfFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''

    if (!firebaseUser) return

    void (async () => {
      let downloadUrl = ''
      try {
        if (attachedFile) {
          const targetRef = storageRef(storage, objectPath)
          await withCloudTimeout(
            uploadBytes(targetRef, attachedFile, {
              contentType: 'application/pdf',
            }),
            3500,
          )
          downloadUrl = await withCloudTimeout(getDownloadURL(targetRef), 2500)
        }
      } catch {
        // Storage fallback
      }

      const firestorePath = `digitalKitabs/${kitabId}`
      try {
        await withCloudTimeout(
          setDoc(doc(db, 'digitalKitabs', kitabId), {
            uid: activeUid,
            studentId: primaryStudentId,
            title: newItem.title.slice(0, 160),
            arabicTitle: newItem.arabicTitle.slice(0, 160),
            author: newItem.author.slice(0, 120),
            category: newItem.category,
            classBatch: newItem.classBatch.slice(0, 40),
            language: newItem.language.slice(0, 40),
            pages: newItem.pages,
            storagePath: newItem.storagePath.slice(0, 240),
            pdfUrl: downloadUrl.slice(0, 1500),
            summary: newItem.summary.slice(0, 1200),
            createdAt: serverTimestamp(),
          }),
          3500,
        )
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        if (msg.includes('permission') || msg.includes('insufficient')) {
          try {
            handleFirestoreError(error, OperationType.CREATE, firestorePath)
          } catch {
            // Handled
          }
        }
      }
    })()
  }

  function handleDeleteUploadedKitab(kitabId: string) {
    void deleteKitabPdfBlobLocally(kitabId)
    setLocalKitabUploads((prev) => {
      const next = prev.filter((k) => k.id !== kitabId)
      try {
        window.localStorage.setItem(LOCAL_UPLOADS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Ignore
      }
      return next
    })
    notifyDigitalLibraryUpdated()
  }

  const allNoticesCombined = useMemo(
    () => [...customNotices, ...defaultNotices],
    [customNotices],
  )

  const monthTotal = selectedMonthRecord
    ? selectedMonthRecord.present + selectedMonthRecord.absent + selectedMonthRecord.leave
    : 0
  const monthRate =
    selectedMonthRecord && monthTotal > 0
      ? Math.round((selectedMonthRecord.present / monthTotal) * 1000) / 10
      : 0

  return (
    <div className="min-h-svh bg-background transition-colors duration-300 dark:bg-gradient-to-br dark:from-[#081E21] dark:to-[#040F11] max-lg:fixed max-lg:inset-0 max-lg:flex max-lg:flex-col max-lg:overflow-hidden lg:pl-64">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-background pt-[var(--safe-top)] transition-colors duration-300 lg:flex">
        <Link
          href="/"
          className="flex h-20 items-center gap-3 border-b border-border px-6"
          aria-label="ICS Academy Manhappatta home"
        >
          <BrandLogoMark className="h-10 w-auto" />
          <BrandWordmark
            gapClassName="gap-0"
            topClassName="text-lg font-bold text-foreground leading-none"
            bottomClassName="-mt-[2px] text-[10px] font-semibold text-lime leading-none"
          />
        </Link>

        <nav aria-label="Class Usthad Dashboard" className="flex flex-1 flex-col gap-1 p-4">
          <p className="px-3 pb-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Class Usthad Portal
          </p>
          {usthadNavItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground"
            >
              <item.icon className="size-4 transition-colors group-hover:text-lime" aria-hidden="true" />
              {item.label}
            </a>
          ))}
        </nav>

        <div className="border-t border-border p-4">
          <Link
            href="/"
            onClick={(event) => {
              event.preventDefault()
              window.localStorage.removeItem('isAuthenticated')
              window.localStorage.removeItem('authRole')
              window.localStorage.removeItem('loggedInUsthadId')
              window.dispatchEvent(new CustomEvent('ics-logout'))
            }}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Log out
          </Link>
        </div>
      </aside>

      {/* Top Sticky Header */}
      <header className="z-40 shrink-0 border-b border-border bg-background/95 pt-[var(--safe-top)] backdrop-blur-md transition-colors duration-300 lg:sticky lg:top-0">
        <div className="flex h-16 sm:h-20 items-center justify-between gap-2 px-3.5 sm:gap-4 sm:px-5 md:px-8">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2.5 sm:gap-3 lg:hidden"
            aria-label="ICS Academy Manhappatta home"
          >
            <BrandLogoMark className="h-9 sm:h-11 w-auto shrink-0" />
            <BrandWordmark
              gapClassName="gap-0"
              topClassName="text-base sm:text-lg font-bold text-foreground leading-none"
              bottomClassName="-mt-[2px] text-[9.5px] sm:text-[10px] font-semibold text-lime leading-none"
            />
          </Link>

          <div className="hidden lg:block">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Class Usthad Dashboard
            </p>
            <p className="text-sm font-medium text-foreground">
              {usthad.fullClassLabel} · Academic Year 2026–27
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <AppUpdateButton />
            <CampusNotificationBell classNameFilter={usthad.className} />
            <ThemeToggle className="text-foreground/85 hover:text-foreground dark:text-white/90 dark:hover:text-white" />
            <UsthadSwitcher usthad={usthad} />
          </div>
        </div>
      </header>

      <div className="max-lg:flex-1 max-lg:min-h-0 max-lg:w-full max-lg:overflow-y-auto max-lg:overflow-x-hidden max-lg:overscroll-y-contain">
        <CampusNotificationBar classNameFilter={usthad.className} />

        <main className="mx-auto flex max-w-7xl flex-col gap-5 px-3.5 py-5 sm:gap-6 sm:px-5 sm:py-7 md:px-8 md:py-10">
        {/* Usthad Welcome & Class Summary Header — Shown on Roster Tab on Phone/Tablet, Always Shown on Desktop */}
        <div
          className={cn(
            'flex flex-col justify-between gap-4 md:flex-row md:items-end',
            mobileTab !== 'roster' && 'hidden lg:flex',
          )}
        >
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-lime">
              Class Usthad Workspace · {usthad.fullClassLabel}
            </p>
            <h1 className="mt-1.5 flex flex-col font-display leading-tight text-foreground">
              <span className="text-xl font-normal text-muted-foreground md:text-2xl">
                 السَّلَامُ عَلَيْكُمْ,
              </span>
              <span className="mt-0.5 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                {usthad.name}
              </span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-xs text-muted-foreground sm:text-sm">
            <p>
              Assigned Class <span className="font-semibold text-foreground">{usthad.className}</span>
            </p>
            <span className="text-border" aria-hidden="true">•</span>
            <p>
              Staff ID <span className="font-mono font-medium tabular-nums text-foreground">{usthad.staffId}</span>
            </p>
          </div>
        </div>

        {/* 4-Column Class KPI Strip — Shown on Roster Tab on Phone/Tablet, Always Shown on Desktop */}
        <div
          className={cn(
            'grid grid-cols-2 gap-3 sm:grid-cols-4',
            mobileTab !== 'roster' && 'hidden lg:grid',
          )}
        >
          <div className="rounded-2xl border border-border bg-card/60 p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Students</p>
            <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-foreground md:text-3xl">
              {classStudents.length}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{usthad.fullClassLabel}</p>
          </div>

          <div className="rounded-2xl border border-border bg-card/60 p-4">
            <p className="text-xs font-medium text-muted-foreground">At Academy</p>
            <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-emerald-600 dark:text-lime md:text-3xl">
              {classStudents.length - studentsCurrentlyOnLeave.length}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Present on campus</p>
          </div>

          <div className="rounded-2xl border border-border bg-card/60 p-4">
            <p className="text-xs font-medium text-muted-foreground">Currently On Leave</p>
            <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-red-500 md:text-3xl">
              {studentsCurrentlyOnLeave.length}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Active leave outpass</p>
          </div>

          <div className="rounded-2xl border border-border bg-card/60 p-4">
            <p className="text-xs font-medium text-muted-foreground">Class Attendance</p>
            <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-cyan md:text-3xl">
              {classAverageAttendance}%
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Academic year average</p>
          </div>
        </div>

        {/* 1. CLASS STUDENT ROSTER & INDIVIDUAL DETAILS */}
        <div className={cn(mobileTab === 'roster' ? 'block' : 'hidden lg:block')}>
          <Panel
            id="class-roster"
            eyebrow={`${usthad.fullClassLabel} · Student Directory`}
            title="Class Students & Profiles"
            icon={Users}
          action={
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {filteredRoster.length} of {classStudents.length} students
            </span>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <label htmlFor="usthad-roster-search" className="sr-only">
                  Search student in {usthad.className} by name or admission number
                </label>
                <Search
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  id="usthad-roster-search"
                  type="search"
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  placeholder={`Search ${usthad.className} students by name or admission no...`}
                  className={cn(fieldClassName, 'pl-10 pr-9 [&::-webkit-search-cancel-button]:hidden')}
                />
                {rosterSearch ? (
                  <button
                    type="button"
                    onClick={() => setRosterSearch('')}
                    className="absolute top-1/2 right-2.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-4" aria-hidden="true" />
                    <span className="sr-only">Clear search</span>
                  </button>
                ) : null}
              </div>

              <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-background/60 p-1">
                {(
                  [
                    { id: 'all', label: `All (${classStudents.length})` },
                    {
                      id: 'academy',
                      label: `At Academy (${classStudents.length - studentsCurrentlyOnLeave.length})`,
                    },
                    { id: 'leave', label: `On Leave (${studentsCurrentlyOnLeave.length})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setRosterFilter(tab.id)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0',
                      rosterFilter === tab.id
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="-mx-5 overflow-x-auto px-5 md:-mx-6 md:px-6">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="py-3 pr-3">Admission No.</th>
                    <th scope="col" className="px-3 py-3">Student Name</th>
                    <th scope="col" className="px-3 py-3">Campus Status</th>
                    <th scope="col" className="px-3 py-3 text-right">Present / Absent / Leave</th>
                    <th scope="col" className="px-3 py-3 text-right">Overall %</th>
                    <th scope="col" className="py-3 pl-3 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {filteredRoster.map(({ student: st, effective, overallRate, isOnLeave, activeLeaveEntry }) => {
                    const isSelected = st.id === selectedStudent?.id
                    return (
                      <tr
                        key={st.id}
                        className={cn(
                          'transition-colors hover:bg-muted/40',
                          isSelected && 'bg-lime/5',
                        )}
                      >
                        <td className="py-3 pr-3 font-mono text-xs font-medium tabular-nums text-muted-foreground whitespace-nowrap">
                          {st.admissionNo}
                        </td>
                        <td className="px-3 py-3 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <GraduationCap className="size-4 shrink-0 text-lime" aria-hidden="true" />
                            <span>{st.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 text-xs font-semibold',
                              isOnLeave ? 'text-red-500' : 'text-emerald-600 dark:text-lime',
                            )}
                          >
                            {isOnLeave ? 'On Leave' : 'At Academy'}
                          </span>
                          {isOnLeave && activeLeaveEntry ? (
                            <p className="text-[11px] text-muted-foreground">
                              {activeLeaveEntry.reason} ({activeLeaveEntry.dateString})
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                          <span className="font-semibold text-emerald-600 dark:text-lime">
                            {effective.attendance.present}P
                          </span>
                          {' · '}
                          <span className="font-semibold text-destructive">
                            {effective.attendance.absent}A
                          </span>
                          {' · '}
                          <span className="font-semibold text-cyan">
                            {effective.attendance.leave}L
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-display text-sm font-semibold tabular-nums text-foreground whitespace-nowrap">
                          {overallRate}%
                        </td>
                        <td className="py-3 pl-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <a
                              href="#usthad-attendance"
                              onClick={() => {
                                setSelectedStudentId(st.id)
                                setMobileTab('attendance')
                              }}
                              className="inline-flex h-8 items-center rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:border-lime/40 hover:bg-muted whitespace-nowrap shrink-0"
                            >
                              Attendance
                            </a>
                            <a
                              href="#usthad-leave"
                              onClick={() => {
                                setLeaveStudentId(st.id)
                                setLeaveActionType(isOnLeave ? 'return' : 'application')
                                setMobileTab('leave')
                              }}
                              className="inline-flex h-8 items-center rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-cyan/40 hover:text-foreground whitespace-nowrap shrink-0"
                            >
                              {isOnLeave ? 'Mark Return' : 'Log Leave'}
                            </a>
                            <button
                              type="button"
                              onClick={() => setPdfReportStudent(st)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-cyan/40 bg-cyan/10 px-2.5 text-xs font-semibold text-cyan transition-colors hover:bg-cyan/20 whitespace-nowrap shrink-0"
                            >
                              <FileText className="size-3.5" aria-hidden="true" />
                              Parent PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>
        </div>

        {/* 2. ATTENDANCE STATUS & MONTHLY ATTENDANCE EDITOR */}
        <div
          className={cn(
            'flex flex-col gap-5 sm:gap-6',
            mobileTab === 'attendance' ? 'flex' : 'hidden lg:flex',
          )}
        >
        <Panel
          id="usthad-attendance"
          eyebrow={`${usthad.fullClassLabel} · Monthly Attendance Control`}
          title="Attendance Status & Update"
          icon={CalendarCheck}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <label htmlFor="usthad-att-student" className="sr-only">
                  Select student
                </label>
                <select
                  id="usthad-att-student"
                  value={selectedStudent?.id ?? ''}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="h-9 appearance-none rounded-xl border border-input bg-muted/60 pr-8 pl-3 text-xs font-semibold text-foreground outline-none hover:border-foreground/25 focus-visible:border-ring dark:[color-scheme:dark]"
                >
                  {classStudents.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.admissionNo})
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>

              <div className="relative">
                <label htmlFor="usthad-att-month" className="sr-only">
                  Select month
                </label>
                <select
                  id="usthad-att-month"
                  value={selectedMonthId}
                  onChange={(e) => setSelectedMonthId(e.target.value)}
                  className="h-9 appearance-none rounded-xl border border-input bg-muted/60 pr-8 pl-3 text-xs font-semibold text-foreground outline-none hover:border-foreground/25 focus-visible:border-ring dark:[color-scheme:dark]"
                >
                  {selectedStudentEffective?.monthlyAttendance.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.month} {m.year}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>

              {selectedStudent ? (
                <button
                  type="button"
                  onClick={() => setPdfReportStudent(selectedStudent)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-cyan/40 bg-cyan/15 px-3 text-xs font-semibold text-cyan transition-colors hover:bg-cyan/25 whitespace-nowrap shrink-0"
                >
                  <FileText className="size-3.5" aria-hidden="true" />
                  Parent PDF Report
                </button>
              ) : null}
            </div>
          }
        >
          {selectedStudent && selectedStudentEffective && selectedMonthRecord ? (
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Left Column: Selected Student Monthly Gauge + Editor Form */}
              <div className="flex flex-col gap-5 lg:col-span-7">
                <div className="flex flex-col items-center gap-5 rounded-xl border border-border bg-background/50 p-4 sm:flex-row">
                  <div className="relative size-28 shrink-0">
                    <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
                      <circle cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="10" className="stroke-muted" />
                      <circle
                        cx="60"
                        cy="60"
                        r={RADIUS}
                        fill="none"
                        strokeWidth="10"
                        strokeLinecap="round"
                        className="stroke-lime transition-[stroke-dashoffset] duration-500 ease-out"
                        strokeDasharray={CIRCUMFERENCE}
                        strokeDashoffset={CIRCUMFERENCE * (1 - monthRate / 100)}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="font-display text-2xl font-semibold leading-none tabular-nums text-foreground">
                        {monthRate}%
                      </span>
                      <span className="mt-1 text-[10px] font-medium text-muted-foreground">
                        {selectedMonthRecord.shortMonth} {selectedMonthRecord.year}
                      </span>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <p className="text-xs font-medium text-lime">
                      {selectedStudent.admissionNo} · {usthad.className}
                    </p>
                    <h3 className="mt-0.5 font-display text-lg font-semibold text-foreground">
                      {selectedStudent.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedMonthRecord.month} {selectedMonthRecord.year}:{' '}
                      <span className="font-semibold text-foreground">{selectedMonthRecord.present} Present</span>
                      {' · '}
                      <span className="font-semibold text-destructive">{selectedMonthRecord.absent} Absent</span>
                      {' · '}
                      <span className="font-semibold text-cyan">{selectedMonthRecord.leave} Leave</span>
                    </p>
                  </div>
                </div>

                {/* Monthly Attendance Update Form */}
                <form
                  onSubmit={handleSaveMonthAttendance}
                  className="flex flex-col gap-4 rounded-xl border border-border bg-background/60 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Update {selectedMonthRecord.month} {selectedMonthRecord.year} Attendance
                    </h4>
                    <button
                      type="button"
                      onClick={handleResetMonthAttendance}
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="size-3" aria-hidden="true" />
                      Reset Month
                    </button>
                  </div>

                  {/* Working Days vs Official Academy Holidays Excluded Banner */}
                  <div className="grid grid-cols-2 gap-3 rounded-xl border border-lime/30 bg-lime/[0.06] p-3 text-xs">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        Total Working Days ({selectedMonthRecord?.month})
                      </span>
                      <span className="mt-0.5 font-display text-base font-bold text-foreground tabular-nums">
                        {editPresent + editAbsent + editLeave} Working Days
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Present ({editPresent}d) + Absent ({editAbsent}d) + Personal Leave ({editLeave}d)
                      </span>
                    </div>
                    <div className="flex flex-col border-l border-border/70 pl-3">
                      <span className="text-[10px] font-bold tracking-wider text-emerald-700 uppercase dark:text-lime">
                        Official Academy Holidays (Excluded)
                      </span>
                      <span className="mt-0.5 font-display text-base font-bold text-emerald-700 tabular-nums dark:text-lime">
                        {Math.max(
                          0,
                          (selectedMonthRecord?.calendarDays ?? 30) -
                            (editPresent + editAbsent + editLeave),
                        )}{' '}
                        Days Excluded
                      </span>
                      <span className="truncate text-[10px] text-muted-foreground">
                        {selectedMonthRecord?.officialHolidayNote ??
                          '2nd Sat & Festival Leaves not counted in working days'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {/* Present Stepper */}
                    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card/60 p-3">
                      <Label htmlFor="edit-present" className="text-xs text-emerald-600 dark:text-lime">
                        Present Days
                      </Label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditPresent((v) => Math.max(0, v - 1))}
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-muted"
                          aria-label="Decrease present days"
                        >
                          <Minus className="size-3.5" aria-hidden="true" />
                        </button>
                        <input
                          id="edit-present"
                          type="number"
                          min={0}
                          max={31}
                          value={editPresent}
                          onChange={(e) => setEditPresent(Math.max(0, Number.parseInt(e.target.value, 10) || 0))}
                          className="h-9 w-full rounded-lg border border-input bg-background text-center font-mono text-sm font-semibold tabular-nums text-foreground"
                        />
                        <button
                          type="button"
                          onClick={() => setEditPresent((v) => Math.min(31, v + 1))}
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-muted"
                          aria-label="Increase present days"
                        >
                          <Plus className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {/* Absent Stepper */}
                    <div
                      onClick={() => setFocusedReasonField('absent')}
                      className={cn(
                        'flex cursor-pointer flex-col gap-1.5 rounded-xl border bg-card/60 p-3 transition-colors',
                        focusedReasonField === 'absent' || editAbsent > 0
                          ? 'border-red-500/40 bg-red-500/[0.04]'
                          : 'border-border',
                      )}
                    >
                      <Label htmlFor="edit-absent" className="text-xs text-destructive">
                        Absent Days
                      </Label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setFocusedReasonField('absent')
                            setEditAbsent((v) => Math.max(0, v - 1))
                          }}
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-muted"
                          aria-label="Decrease absent days"
                        >
                          <Minus className="size-3.5" aria-hidden="true" />
                        </button>
                        <input
                          id="edit-absent"
                          type="number"
                          min={0}
                          max={31}
                          value={editAbsent}
                          onFocus={() => setFocusedReasonField('absent')}
                          onChange={(e) => {
                            setFocusedReasonField('absent')
                            setEditAbsent(Math.max(0, Number.parseInt(e.target.value, 10) || 0))
                          }}
                          className="h-9 w-full rounded-lg border border-input bg-background text-center font-mono text-sm font-semibold tabular-nums text-foreground"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFocusedReasonField('absent')
                            setEditAbsent((v) => Math.min(31, v + 1))
                          }}
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-muted"
                          aria-label="Increase absent days"
                        >
                          <Plus className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {/* Leave Stepper */}
                    <div
                      onClick={() => setFocusedReasonField('leave')}
                      className={cn(
                        'flex cursor-pointer flex-col gap-1.5 rounded-xl border bg-card/60 p-3 transition-colors',
                        focusedReasonField === 'leave' || editLeave > 0
                          ? 'border-cyan/40 bg-cyan/[0.04]'
                          : 'border-border',
                      )}
                    >
                      <Label htmlFor="edit-leave" className="text-xs text-cyan">
                        Leave Days
                      </Label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setFocusedReasonField('leave')
                            setEditLeave((v) => Math.max(0, v - 1))
                          }}
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-muted"
                          aria-label="Decrease leave days"
                        >
                          <Minus className="size-3.5" aria-hidden="true" />
                        </button>
                        <input
                          id="edit-leave"
                          type="number"
                          min={0}
                          max={31}
                          value={editLeave}
                          onFocus={() => setFocusedReasonField('leave')}
                          onChange={(e) => {
                            setFocusedReasonField('leave')
                            setEditLeave(Math.max(0, Number.parseInt(e.target.value, 10) || 0))
                          }}
                          className="h-9 w-full rounded-lg border border-input bg-background text-center font-mono text-sm font-semibold tabular-nums text-foreground"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFocusedReasonField('leave')
                            setEditLeave((v) => Math.min(31, v + 1))
                          }}
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-muted"
                          aria-label="Increase leave days"
                        >
                          <Plus className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 4 Absent Reasons Selector when Absent is touched or > 0 */}
                  {(focusedReasonField === 'absent' || editAbsent > 0) && (
                    <div className="flex flex-col gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
                      <span className="text-[11px] font-semibold tracking-wider text-red-600 uppercase dark:text-red-400">
                        Select Absent Reason (4 Options):
                      </span>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {ABSENT_REASONS.map((reason) => {
                          const isSelected = editAbsentReason === reason
                          return (
                            <button
                              key={reason}
                              type="button"
                              onClick={() => setEditAbsentReason(reason)}
                              className={cn(
                                'flex items-center justify-start gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-all',
                                isSelected
                                  ? 'border-red-500 bg-red-500/20 font-semibold text-red-700 dark:border-red-400 dark:text-red-300'
                                  : 'border-border bg-background/80 text-muted-foreground hover:text-foreground',
                              )}
                            >
                              {isSelected ? (
                                <Check className="size-3.5 shrink-0" aria-hidden="true" />
                              ) : null}
                              <span>{reason}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* 4 Leave Reasons Selector when Leave is touched or > 0 */}
                  {(focusedReasonField === 'leave' || editLeave > 0) && (
                    <div className="flex flex-col gap-2 rounded-xl border border-cyan/30 bg-cyan/5 p-3">
                      <span className="text-[11px] font-semibold tracking-wider text-cyan uppercase">
                        Select Leave Reason (4 Options):
                      </span>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {ATTENDANCE_LEAVE_REASONS.map((reason) => {
                          const isSelected = editLeaveReason === reason
                          return (
                            <button
                              key={reason}
                              type="button"
                              onClick={() => setEditLeaveReason(reason)}
                              className={cn(
                                'flex items-center justify-start gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-all',
                                isSelected
                                  ? 'border-cyan bg-cyan/20 font-semibold text-cyan'
                                  : 'border-border bg-background/80 text-muted-foreground hover:text-foreground',
                              )}
                            >
                              {isSelected ? (
                                <Check className="size-3.5 shrink-0" aria-hidden="true" />
                              ) : null}
                              <span>{reason}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {attendanceSavedToast ? (
                    <p
                      role="status"
                      className="flex items-center gap-2 rounded-lg border border-lime/30 bg-lime/10 px-3 py-2 text-xs font-medium text-lime"
                    >
                      <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                      {attendanceSavedToast}
                    </p>
                  ) : null}

                  <div className="flex justify-end">
                    <Button type="submit" className="h-9 rounded-lg px-4 text-xs font-semibold">
                      <Check className="mr-1.5 size-3.5" aria-hidden="true" />
                      Save Attendance Update
                    </Button>
                  </div>
                </form>
              </div>

              {/* Right Column: All 12 Months Breakdown for Selected Student */}
              <div className="flex flex-col lg:col-span-5">
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {selectedStudent.firstName}&apos;s Monthly Breakdown (Jan – Dec)
                </p>
                <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto pr-1">
                  {selectedStudentEffective.monthlyAttendance.map((m) => {
                    const tot = m.present + m.absent + m.leave
                    const rt = tot > 0 ? Math.round((m.present / tot) * 1000) / 10 : 0
                    const isActive = m.id === selectedMonthId
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMonthId(m.id)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition-colors',
                          isActive
                            ? 'border-lime/50 bg-lime/10 text-foreground'
                            : 'border-border/60 bg-background/40 hover:bg-muted/50',
                        )}
                      >
                        <span className="font-semibold">
                          {m.month} {m.year}
                        </span>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          <span className="text-emerald-600 dark:text-lime">{m.present}P</span>
                          {' · '}
                          <span className="text-destructive">{m.absent}A</span>
                          {' · '}
                          <span className="text-cyan">{m.leave}L</span>
                          {' · '}
                          <span className="font-bold text-foreground">{rt}%</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </Panel>

        {/* 2B. PERIOD-BY-PERIOD CLASS ATTENDANCE SUBMISSION FOR USTHAD */}
        {classStudents[0] ? (
          <ClassLeaderAttendanceCard
            leader={classStudents[0]}
            leaderId={usthad.staffId}
            eyebrowLabel={`${usthad.fullClassLabel} · Period-by-Period Attendance`}
            submittedByNameOverride={usthad.shortName}
            highlightLeaderBadge={false}
          />
        ) : null}
        </div>

        {/* 3. LEAVE REGISTER & LIVE ON-LEAVE MONITOR */}
        <div className={cn(mobileTab === 'leave' ? 'block' : 'hidden lg:block')}>
        <Panel
          id="usthad-leave"
          eyebrow={`${usthad.fullClassLabel} · Campus Outpass & Return Registry`}
          title="Leave Register & Live On-Leave List"
          icon={ClipboardList}
          action={
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {studentsCurrentlyOnLeave.length} currently on leave
            </span>
          }
        >
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Live List of Students Currently On Leave + Recent Class Logs */}
            <div className="flex flex-col gap-5 lg:col-span-7">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Students Currently On Leave ({studentsCurrentlyOnLeave.length})
                </h3>
                {studentsCurrentlyOnLeave.length === 0 ? (
                  <div className="mt-2.5 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-800 dark:border-lime/30 dark:bg-lime/10 dark:text-lime">
                    <UserCheck className="size-4 shrink-0" aria-hidden="true" />
                    <span>
                      All {classStudents.length} students of {usthad.fullClassLabel} are currently present at the academy.
                    </span>
                  </div>
                ) : (
                  <ul className="mt-2.5 flex flex-col gap-2">
                    {studentsCurrentlyOnLeave.map(({ student: st, activeLeaveEntry }) => (
                      <li
                        key={st.id}
                        className="flex flex-col justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-3.5 sm:flex-row sm:items-center"
                      >
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {st.name}{' '}
                            <span className="font-mono text-xs font-normal text-muted-foreground">
                              ({st.admissionNo})
                            </span>
                          </p>
                          {activeLeaveEntry ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Reason: <span className="font-medium text-foreground">{activeLeaveEntry.reason}</span>
                              {' · '}Departed {activeLeaveEntry.dateString} at {activeLeaveEntry.timeString}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            void recordUsthadLeaveOrReturn(
                              st,
                              'return',
                              'Campus Return',
                              'Marked returned by Class Usthad',
                            )
                          }
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 whitespace-nowrap shrink-0"
                        >
                          <LogIn className="size-3.5" aria-hidden="true" />
                          Mark Returned
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Recent Leave & Return Logs Across Class */}
              <div className="border-t border-border pt-4">
                <div className="mb-2.5 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Class Leave & Return Log
                  </h3>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {allClassLeaveLogs.length} entries
                  </span>
                </div>

                {allClassLeaveLogs.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    No leave or return entries logged for {usthad.fullClassLabel} yet.
                  </p>
                ) : (
                  <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
                    {allClassLeaveLogs.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground">
                            {entry.studentName}{' '}
                            <span className="font-mono font-normal text-muted-foreground">
                              ({entry.admissionNo})
                            </span>
                          </p>
                          <p className="mt-0.5 text-muted-foreground">
                            <span
                              className={cn(
                                'font-semibold',
                                entry.recordType === 'application'
                                  ? 'text-red-500'
                                  : 'text-emerald-600 dark:text-lime',
                              )}
                            >
                              {entry.recordType === 'application' ? 'Leave Departure' : 'Campus Return'}
                            </span>
                            {' · '}
                            {entry.reason} · {entry.dateString} at {entry.timeString}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteLeaveLog(entry)}
                          aria-label="Delete leave record"
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Record Leave or Return Form for a Class Student */}
            <form
              onSubmit={handleSubmitLeaveForm}
              className="flex flex-col gap-4 rounded-xl border border-border bg-background/60 p-4 lg:col-span-5"
            >
              <h3 className="text-sm font-semibold text-foreground">
                Record Student Leave / Return
              </h3>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="usthad-leave-student" className="text-xs">
                  Student ({usthad.className})
                </Label>
                <select
                  id="usthad-leave-student"
                  value={leaveStudentId}
                  onChange={(e) => setLeaveStudentId(e.target.value)}
                  className={fieldClassName}
                >
                  {classStudents.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.admissionNo})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-background/60 p-1">
                <button
                  type="button"
                  onClick={() => setLeaveActionType('application')}
                  className={cn(
                    'flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors',
                    leaveActionType === 'application'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <LogOut className="size-3.5" aria-hidden="true" />
                  Grant Leave
                </button>
                <button
                  type="button"
                  onClick={() => setLeaveActionType('return')}
                  className={cn(
                    'flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors',
                    leaveActionType === 'return'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <LogIn className="size-3.5" aria-hidden="true" />
                  Record Return
                </button>
              </div>

              {leaveActionType === 'application' ? (
                <>
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs">
                      Select Leave Reason (4 Options)
                    </Label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {leaveReasons.map((r) => {
                        const isSelected = leaveReason === r
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setLeaveReason(r)}
                            className={cn(
                              'flex items-center justify-start gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-all',
                              isSelected
                                ? 'border-amber-500 bg-amber-500/20 font-semibold text-amber-800 dark:border-amber-400 dark:text-amber-200'
                                : 'border-border bg-background/80 text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {isSelected ? (
                              <Check className="size-3.5 shrink-0" aria-hidden="true" />
                            ) : null}
                            <span>{r}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="usthad-leave-details" className="text-xs">
                      Usthad Note / Details (Optional)
                    </Label>
                    <input
                      id="usthad-leave-details"
                      type="text"
                      value={leaveDetails}
                      onChange={(e) => setLeaveDetails(e.target.value)}
                      placeholder="e.g. Approved until Sunday evening"
                      className={fieldClassName}
                    />
                  </div>
                </>
              ) : null}

              {leaveSavedToast ? (
                <p
                  role="status"
                  className="flex items-center gap-2 rounded-lg border border-lime/30 bg-lime/10 px-3 py-2 text-xs font-medium text-lime"
                >
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                  {leaveSavedToast}
                </p>
              ) : null}

              <Button type="submit" className="mt-auto h-10 w-full rounded-lg text-xs font-semibold">
                {leaveActionType === 'application' ? 'Submit Leave Outpass' : 'Confirm Student Return'}
              </Button>
            </form>
          </div>
        </Panel>
        </div>

        {/* 4. NOTICE BOARD — PUBLISH & MANAGE ANNOUNCEMENTS */}
        <div className={cn(mobileTab === 'notices' ? 'block' : 'hidden lg:block')}>
        <Panel
          id="usthad-notices"
          eyebrow="Campus & Class Announcements"
          title="Notice Board Management"
          icon={Megaphone}
          action={
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {allNoticesCombined.length} active notices
            </span>
          }
        >
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Publish New Notice Form */}
            <form
              onSubmit={handlePublishNotice}
              className="flex flex-col gap-4 rounded-xl border border-border bg-background/60 p-4 lg:col-span-5"
            >
              <h3 className="text-sm font-semibold text-foreground">
                Publish New Notice
              </h3>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notice-title-input" className="text-xs">
                  Notice Title *
                </Label>
                <input
                  id="notice-title-input"
                  type="text"
                  required
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  placeholder="e.g. Special Fiqh Mudhakarah Session Tonight"
                  className={fieldClassName}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="notice-category-select" className="text-xs">
                    Category
                  </Label>
                  <select
                    id="notice-category-select"
                    value={noticeCategory}
                    onChange={(e) => setNoticeCategory(e.target.value as Notice['category'])}
                    className={fieldClassName}
                  >
                    <option value="Academic">Academic</option>
                    <option value="Exam">Exam</option>
                    <option value="Event">Event</option>
                    <option value="Hostel">Hostel</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-input bg-input/30 px-3 text-xs font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={noticePinned}
                      onChange={(e) => setNoticePinned(e.target.checked)}
                      className="size-4 accent-lime"
                    />
                    <span>Pin to top</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notice-body-input" className="text-xs">
                  Announcement Details *
                </Label>
                <textarea
                  id="notice-body-input"
                  rows={3}
                  required
                  value={noticeBody}
                  onChange={(e) => setNoticeBody(e.target.value)}
                  placeholder="Write the announcement details for students..."
                  className={cn(fieldClassName, 'h-auto min-h-24 resize-y py-2.5 leading-relaxed')}
                />
              </div>

              {/* Target Batches / Classes Selector */}
              <div className="flex flex-col gap-2.5 rounded-xl border border-cyan/30 bg-cyan/[0.05] p-3">
                <div className="flex flex-col gap-0.5">
                  <Label className="text-xs font-bold text-foreground">
                    Target Batches / Classes (ആർക്കാണ് ഈ അറിയിപ്പ് / ലീവ്?)
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Select whether this notice or holiday applies to all 11 batches or only selected batches.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {(
                    [
                      {
                        id: 'all',
                        label: 'All 11 Batches (എല്ലാ ബാച്ചുകൾക്കും)',
                      },
                      {
                        id: 'my-class',
                        label: `My Batch Only (${usthad.className})`,
                      },
                      {
                        id: 'high-school',
                        label: 'High School Batches (8th – HS 2)',
                      },
                      {
                        id: 'bs-degree',
                        label: 'BS Degree Batches (BS 1 – BS 5)',
                      },
                      {
                        id: 'custom',
                        label: 'Select Specific Batches (തിരഞ്ഞെടുത്ത ബാച്ചുകൾ)',
                      },
                    ] as const
                  ).map((opt) => {
                    const active = noticeTargetScope === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setNoticeTargetScope(opt.id)}
                        className={cn(
                          'flex items-center justify-start gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-semibold transition-all',
                          opt.id === 'custom' && 'sm:col-span-2',
                          active
                            ? 'border-cyan bg-cyan/20 text-foreground shadow-2xs'
                            : 'border-border bg-background/70 text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'flex size-3.5 shrink-0 items-center justify-center rounded-full border',
                            active ? 'border-cyan bg-cyan text-slate-950' : 'border-muted-foreground/50',
                          )}
                        >
                          {active ? <Check className="size-2.5 stroke-[3]" /> : null}
                        </span>
                        <span className="truncate">{opt.label}</span>
                      </button>
                    )
                  })}
                </div>

                {noticeTargetScope === 'custom' ? (
                  <div className="mt-1 flex flex-col gap-2 rounded-lg border border-border/70 bg-background/80 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-foreground">
                        Select Batches ({noticeCustomBatches.length} selected):
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setNoticeCustomBatches([...ALL_ACADEMY_CLASS_NAMES])}
                          className="text-[10px] font-semibold text-cyan hover:underline"
                        >
                          Select All
                        </button>
                        <span className="text-muted-foreground">·</span>
                        <button
                          type="button"
                          onClick={() => setNoticeCustomBatches([usthad.className])}
                          className="text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_ACADEMY_CLASS_NAMES.map((cls) => {
                        const checked = noticeCustomBatches.includes(cls)
                        return (
                          <button
                            key={cls}
                            type="button"
                            onClick={() => toggleNoticeCustomBatch(cls)}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-all',
                              checked
                                ? 'border-lime bg-lime/20 text-foreground'
                                : 'border-border bg-card text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {checked ? <Check className="size-3 text-lime" /> : null}
                            <span>{cls}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Official Academy Holiday Schedule & Working Days Deduction Toggle */}
              <div className="flex flex-col gap-3 rounded-xl border border-lime/30 bg-lime/[0.05] p-3">
                <label className="flex cursor-pointer items-center justify-between gap-2 text-xs font-semibold text-foreground">
                  <span>
                    Official Holiday / Working Days Adjustment Notice (2nd Sat or Festival)
                  </span>
                  <input
                    type="checkbox"
                    checked={isHolidayNotice}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setIsHolidayNotice(checked)
                      if (checked && !noticeTitle) {
                        setNoticeTitle(
                          'Official Monthly Second-Saturday Holiday — Departure & Return Schedule',
                        )
                        setNoticeBody(
                          'Official academy holiday is declared as per the schedule below. These official holidays are excluded from Academy Working Days and are not counted as student personal leave.',
                        )
                      }
                    }}
                    className="size-4 accent-lime"
                  />
                </label>

                {isHolidayNotice ? (
                  <div className="grid gap-2.5 border-t border-border/60 pt-2.5 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="holiday-type-select" className="text-[11px]">
                        Holiday Type
                      </Label>
                      <select
                        id="holiday-type-select"
                        value={holidayType}
                        onChange={(e) => {
                          const val = e.target.value as OfficialHolidayMeta['holidayType']
                          setHolidayType(val)
                          if (val === 'festival-celebration') {
                            setHolidayDaysDeducted('8')
                          } else {
                            setHolidayDaysDeducted('3')
                          }
                        }}
                        className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground dark:[color-scheme:dark]"
                      >
                        <option value="monthly-second-saturday">
                          Monthly 2nd Saturday Leave (Thu/Fri → Sun/Mon)
                        </option>
                        <option value="festival-celebration">
                          Festival / Celebration Leave (Eid / Perunnal 7–10d)
                        </option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="holiday-month-select" className="text-[11px]">
                          Target Month
                        </Label>
                        <select
                          id="holiday-month-select"
                          value={holidayMonthId}
                          onChange={(e) => setHolidayMonthId(e.target.value)}
                          className="h-9 rounded-lg border border-input bg-background px-2 text-xs text-foreground dark:[color-scheme:dark]"
                        >
                          {MONTHS_META.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.shortMonth} {m.year}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <Label htmlFor="holiday-days-deduct" className="text-[11px]">
                          Deduct Working Days
                        </Label>
                        <input
                          id="holiday-days-deduct"
                          type="number"
                          min={1}
                          max={25}
                          value={holidayDaysDeducted}
                          onChange={(e) => setHolidayDaysDeducted(e.target.value)}
                          className="h-9 rounded-lg border border-input bg-background px-2.5 font-mono text-xs font-bold text-lime tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label htmlFor="holiday-dep-date" className="text-[11px]">
                        Departure Date & Day
                      </Label>
                      <input
                        id="holiday-dep-date"
                        type="text"
                        value={holidayDepartureDate}
                        onChange={(e) => setHolidayDepartureDate(e.target.value)}
                        placeholder="e.g. Friday, 13 Nov 2026"
                        className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label htmlFor="holiday-dep-time" className="text-[11px]">
                        Departure Time
                      </Label>
                      <input
                        id="holiday-dep-time"
                        type="text"
                        value={holidayDepartureTime}
                        onChange={(e) => setHolidayDepartureTime(e.target.value)}
                        placeholder="e.g. 12:45 PM (After Jumu’ah) or 09:30 AM"
                        className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label htmlFor="holiday-ret-date" className="text-[11px]">
                        Return Date & Day
                      </Label>
                      <input
                        id="holiday-ret-date"
                        type="text"
                        value={holidayReturnDate}
                        onChange={(e) => setHolidayReturnDate(e.target.value)}
                        placeholder="e.g. Monday, 16 Nov 2026"
                        className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label htmlFor="holiday-ret-time" className="text-[11px]">
                        Return Time
                      </Label>
                      <input
                        id="holiday-ret-time"
                        type="text"
                        value={holidayReturnTime}
                        onChange={(e) => setHolidayReturnTime(e.target.value)}
                        placeholder="e.g. 07:30 AM (Before Period 1)"
                        className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground"
                      />
                    </div>

                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <Label htmlFor="holiday-announced-by" className="text-[11px]">
                        Announced By (Principal / Class Usthad)
                      </Label>
                      <input
                        id="holiday-announced-by"
                        type="text"
                        value={holidayAnnouncedBy}
                        onChange={(e) => setHolidayAnnouncedBy(e.target.value)}
                        placeholder="e.g. Principal • ICS Academy Manhappatta"
                        className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground"
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {noticeToast ? (
                <p
                  role="status"
                  className="flex items-center gap-2 rounded-lg border border-lime/30 bg-lime/10 px-3 py-2 text-xs font-medium text-lime"
                >
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                  {noticeToast}
                </p>
              ) : null}

              <Button type="submit" className="h-10 w-full rounded-lg text-xs font-semibold">
                <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
                {isHolidayNotice
                  ? 'Publish Official Holiday & Update Working Days'
                  : 'Publish to Notice Board'}
              </Button>
            </form>

            {/* Existing Notices List */}
            <div className="flex flex-col gap-2.5 lg:col-span-7">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Published Notices (Synced with Student Dashboard)
              </h3>
              <ul className="flex max-h-96 flex-col divide-y divide-border overflow-y-auto rounded-xl border border-border bg-background/40 px-4">
                {allNoticesCombined.map((item) => {
                  const isCustom =
                    item.id.startsWith('nt-usthad-') || item.id.startsWith('nt-principal-')
                  const itemTargets = getNoticeTargetClasses(item)
                  const itemTargetLabel = formatTargetClassesBadge(itemTargets)
                  return (
                    <li key={item.id} className="flex items-start justify-between gap-3 py-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-lime">{item.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums text-muted-foreground">{item.date}</span>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                              itemTargets.length > 0
                                ? 'border-cyan/40 bg-cyan/15 text-cyan'
                                : 'border-border bg-muted/50 text-muted-foreground',
                            )}
                          >
                            <Users className="size-2.5" aria-hidden="true" />
                            {itemTargetLabel}
                          </span>
                          {item.pinned ? (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 font-medium text-cyan">
                                <Pin className="size-3" aria-hidden="true" /> Pinned
                              </span>
                            </>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                      </div>

                      {isCustom ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleNoticePin(item.id)}
                            title={item.pinned ? 'Unpin notice' : 'Pin notice'}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Pin className="size-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomNotice(item.id)}
                            aria-label="Delete notice"
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </Panel>
        </div>

        {/* 5. DIGITAL LIBRARY — ADD KITAB PDF & UNIVERSITY PORTAL */}
        {mobileTab === 'library' ? (
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-border bg-card/85 p-1.5 shadow-xs lg:hidden">
            <button
              type="button"
              onClick={() => setMobileLibrarySubTab('kitabs')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all',
                mobileLibrarySubTab === 'kitabs'
                  ? 'bg-lime text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Library className="size-4" aria-hidden="true" />
              <span>Digital Kitabs</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileLibrarySubTab('portal')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all',
                mobileLibrarySubTab === 'portal'
                  ? 'bg-lime text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Globe className="size-4" aria-hidden="true" />
              <span>University Portal</span>
            </button>
          </div>
        ) : null}

        <div
          className={cn(
            mobileTab === 'library' && mobileLibrarySubTab === 'kitabs'
              ? 'block'
              : 'hidden lg:block',
          )}
        >
        <Panel
          id="usthad-kitabs"
          eyebrow="Firebase Storage · Kitab Repository Uploader"
          title="Digital Library — Add Kitab PDF"
          icon={Library}
          action={
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {CURATED_KITABS.length + localKitabUploads.length} Kitabs in library
            </span>
          }
        >
          <form onSubmit={handleUploadKitabPdf} className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="usthad-kitab-title" className="text-xs">
                  Kitab Title (English / Transliteration) *
                </Label>
                <input
                  id="usthad-kitab-title"
                  type="text"
                  required
                  value={kitabTitle}
                  onChange={(e) => setKitabTitle(e.target.value)}
                  placeholder="e.g. Minhaj al-Talibin"
                  className={fieldClassName}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="usthad-kitab-arabic" className="text-xs">
                  Arabic Title (العنوان بالعربية)
                </Label>
                <input
                  id="usthad-kitab-arabic"
                  type="text"
                  dir="rtl"
                  value={kitabArabicTitle}
                  onChange={(e) => setKitabArabicTitle(e.target.value)}
                  placeholder="منهاج الطالبين وعمدة المفتين"
                  className={cn(fieldClassName, 'font-arabic text-left')}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="usthad-kitab-author" className="text-xs">
                  Author (Scholar) *
                </Label>
                <input
                  id="usthad-kitab-author"
                  type="text"
                  required
                  value={kitabAuthor}
                  onChange={(e) => setKitabAuthor(e.target.value)}
                  placeholder="e.g. Imam Abu Zakariyya al-Nawawi"
                  className={fieldClassName}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="usthad-kitab-category" className="text-xs">
                  Subject Category
                </Label>
                <select
                  id="usthad-kitab-category"
                  value={kitabCategory}
                  onChange={(e) => setKitabCategory(e.target.value as KitabCategory)}
                  className={fieldClassName}
                >
                  <option value="fiqh">Fiqh & Usul (الْفِقْهُ وَأُصُولُهُ)</option>
                  <option value="hadith">Hadith Studies (الْحَدِيثُ الشَّرِيفُ)</option>
                  <option value="tafsir">Tafsir & Ulum (التَّفْسِيرُ وَعُلُومُ الْقُرْآنِ)</option>
                  <option value="aqeedah">Aqeedah & Tasawwuf (الْعَقِيدَةُ وَالتَّصَوُّفُ)</option>
                  <option value="nahw">Nahw & Sarf (النَّحْوُ وَالصَّرْفُ)</option>
                  <option value="history">History & Da&apos;wa (التَّارِيخُ وَالدَّعْوَةُ)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="usthad-kitab-pages" className="text-xs">
                  Pages
                </Label>
                <input
                  id="usthad-kitab-pages"
                  type="number"
                  min={1}
                  max={5000}
                  value={kitabPages}
                  onChange={(e) => setKitabPages(e.target.value)}
                  className={cn(fieldClassName, 'tabular-nums')}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="usthad-kitab-lang" className="text-xs">
                  Language
                </Label>
                <input
                  id="usthad-kitab-lang"
                  type="text"
                  value={kitabLanguage}
                  onChange={(e) => setKitabLanguage(e.target.value)}
                  className={fieldClassName}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="usthad-kitab-summary" className="text-xs">
                  Syllabus Description & Summary *
                </Label>
                <input
                  id="usthad-kitab-summary"
                  type="text"
                  required
                  value={kitabSummary}
                  onChange={(e) => setKitabSummary(e.target.value)}
                  placeholder="Brief note on the chapters covered in this PDF edition..."
                  className={fieldClassName}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="usthad-kitab-file" className="text-xs">
                  PDF File (Optional — generates formatted PDF if omitted)
                </Label>
                <input
                  ref={fileInputRef}
                  id="usthad-kitab-file"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => setSelectedPdfFile(e.target.files?.[0] ?? null)}
                  className="flex h-11 w-full items-center rounded-lg border border-input bg-input/30 px-3 py-2 text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-foreground"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {kitabStatusMsg ? (
                <p className="text-xs font-medium text-lime">{kitabStatusMsg}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Uploaded Kitabs are immediately searchable and downloadable in the Student Digital Library.
                </p>
              )}
              <Button
                type="submit"
                disabled={uploadingKitab}
                className="h-9 w-full rounded-lg px-4 text-xs font-semibold sm:w-auto"
              >
                {uploadingKitab ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
                    Uploading PDF...
                  </>
                ) : (
                  <>
                    <CloudUpload className="mr-1.5 size-3.5" aria-hidden="true" />
                    Upload & Index Kitab
                  </>
                )}
              </Button>
            </div>
          </form>

          {localKitabUploads.length > 0 ? (
            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recently Uploaded Kitab PDFs ({localKitabUploads.length})
              </p>
              <ul className="grid gap-2.5 sm:grid-cols-2">
                {localKitabUploads.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/50 p-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <FileText className="size-3.5 shrink-0 text-lime" aria-hidden="true" />
                        <span className="truncate font-semibold text-foreground">{item.title}</span>
                      </div>
                      <p className="mt-0.5 truncate text-muted-foreground">
                        {CATEGORY_LABELS[item.category]} · {item.author}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteUploadedKitab(item.id)}
                      aria-label={`Remove ${item.title}`}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
        </div>

        <div
          className={cn(
            mobileTab === 'library' && mobileLibrarySubTab === 'portal'
              ? 'block'
              : 'hidden lg:block',
          )}
        >
          <ExamResultCard />
        </div>
        </main>
      </div>

      {/* PHONE & TABLET BOTTOM NAVIGATION MENU BAR FOR CLASS USTHAD (Hidden on Desktop lg:) */}
      <nav
        aria-label="Usthad Mobile & Tablet Bottom Navigation"
        className="z-50 shrink-0 border-t border-border/85 bg-background/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid h-16 max-w-xl grid-cols-5 items-center px-1.5">
          {(
            [
              { id: 'roster', label: 'Students', icon: Users, badge: 0 },
              { id: 'attendance', label: 'Attendance', icon: CalendarCheck, badge: 0 },
              {
                id: 'leave',
                label: 'Leave',
                icon: ClipboardList,
                badge: studentsCurrentlyOnLeave.length,
              },
              { id: 'notices', label: 'Notices', icon: Megaphone, badge: 0 },
              { id: 'library', label: 'Library', icon: Library, badge: 0 },
            ] as const
          ).map((tab) => {
            const active = mobileTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setMobileTab(tab.id)
                  if (typeof window !== 'undefined') {
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }
                }}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 transition-colors',
                  active ? 'text-lime' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'relative flex h-7 w-12 items-center justify-center rounded-full transition-all',
                    active && 'bg-lime/15',
                  )}
                >
                  <tab.icon className="size-4" aria-hidden="true" />
                  {tab.badge > 0 ? (
                    <span className="absolute -top-1 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 font-mono text-[9.5px] font-bold text-white tabular-nums">
                      {tab.badge}
                    </span>
                  ) : null}
                </span>
                <span className="text-[10.5px] font-semibold leading-none">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <ParentReportModal
        student={pdfReportStudent}
        onClose={() => setPdfReportStudent(null)}
        preparedByRole="Class Usthad"
        preparedByName={usthad.name}
        preparedById={usthad.staffId}
      />
    </div>
  )
}
