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
  BookMarked,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  CloudUpload,
  Coffee,
  Download,
  FileText,
  Globe,
  GraduationCap,
  Library,
  Loader2,
  LogIn,
  LogOut,
  Megaphone,
  MessageCircle,
  Minus,
  Pin,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trophy,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { DeleteActionMenu } from '@/components/ui/delete-action-menu'
import { ThemeSelect } from '@/components/ui/theme-select'
import { AppUpdateButton } from '@/components/app-update-manager'
import { BrandLogoMark, BrandWordmark } from '@/components/brand-wordmark'
import {
  CampusNotificationBar,
  CampusNotificationBell,
} from '@/components/campus-notifications'
import { UsthadAcademicHub } from '@/components/dashboard/campus-academic-hub'
import { CampusMessenger } from '@/components/dashboard/campus-messenger'
import {
  ABSENT_REASONS,
  ALL_ACADEMY_CLASS_NAMES,
  ATTENDANCE_LEAVE_REASONS,
  BS_DEGREE_CLASS_NAMES,
  CLASS_USTHADS,
  HIGH_SCHOOL_CLASS_NAMES,
  MONTHS_META,
  OFFICIAL_CLASS_USTHADS,
  doesUsthadMatchTeacherName,
  ensureCleanLaunchStorage,
  formatTargetClassesBadge,
  getActiveSemester,
  getClassSemesterTimetableByClassName,
  getEffectiveStudentAttendance,
  getNoticeTargetClasses,
  getUsthadScheduledPeriodsAcrossClasses,
  getUsthadTeachingClasses,
  isNonTeachingTimetableSlot,
  isUsthadAssignedClassUsthadOfBatch,
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
  DigitalLibrary,
  addKitabIdToBookmarksStorage,
  deleteKitabPdfBlobLocally,
  notifyDigitalLibraryUpdated,
  saveKitabPdfBlobLocally,
  withCloudTimeout,
  type DigitalKitabItem,
  type KitabCategory,
} from '@/components/dashboard/digital-library'
import { ExamResultCard } from '@/components/dashboard/exam-result-card'
import { LibraryBooks } from '@/components/dashboard/library-books'
import {
  DateSelectGroup,
  TimeSelectGroup,
  getCurrentDateTime,
  type DateValue,
  type SavedLeaveEntry,
  type Time12Value,
} from '@/components/dashboard/leave-register'
import { Panel, fieldClassName } from '@/components/dashboard/panel'
import { ParentReportModal } from '@/components/dashboard/parent-report-modal'
import { ProfileInitialsAvatar, UsthadSwitcher } from '@/components/dashboard/student-switcher'
import {
  exportClassTimetablePdf,
  exportUsthadPersonalTimetablePdf,
} from '@/components/dashboard/timetable-pdf'
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
  { label: 'Timetable', href: '#usthad-timetable', icon: CalendarDays },
  { label: 'Syllabus, Tests & Zadul Khair', href: '#academic-hub', icon: Trophy },
  { label: 'My Periods & Attendance', href: '#usthad-attendance', icon: CalendarCheck },
  { label: 'Leave Register', href: '#usthad-leave', icon: ClipboardList },
  { label: 'Campus Messenger', href: '#campus-chat', icon: MessageCircle },
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
    ensureCleanLaunchStorage()
    const safeId = sanitizeId(studentId)
    const raw = window.localStorage.getItem(`ics_leave_records_v2_${safeId}`)
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
    ensureCleanLaunchStorage()
    const safeId = sanitizeId(studentId)
    window.localStorage.setItem(`ics_leave_records_v2_${safeId}`, JSON.stringify(entries))
  } catch {
    // Ignore storage quota errors
  }
}

export function UsthadDashboard() {
  const [baseUsthad] = useState<ClassUsthad>(() => {
    if (typeof window !== 'undefined') {
      const savedId = window.localStorage.getItem('loggedInUsthadId')
      const matched =
        OFFICIAL_CLASS_USTHADS.find((u) => u.id === savedId) ??
        CLASS_USTHADS.find((u) => u.id === savedId)
      if (matched) return matched
    }
    return CLASS_USTHADS.find((u) => u.batchCode === '07') ?? CLASS_USTHADS[0]
  })

  const [configVersion, setConfigVersion] = useState(0)
  const [activeClassName, setActiveClassName] = useState<string>(() => baseUsthad.className)

  useEffect(() => {
    const syncConfig = () => setConfigVersion((v) => v + 1)
    window.addEventListener('ics-academy-config-updated', syncConfig)
    window.addEventListener('storage', syncConfig)
    return () => {
      window.removeEventListener('ics-academy-config-updated', syncConfig)
      window.removeEventListener('storage', syncConfig)
    }
  }, [])

  const liveBaseUsthad = useMemo<ClassUsthad>(() => {
    void configVersion
    return (
      OFFICIAL_CLASS_USTHADS.find((u) => u.id === baseUsthad.id) ??
      CLASS_USTHADS.find((u) => u.id === baseUsthad.id) ??
      baseUsthad
    )
  }, [baseUsthad, configVersion])

  const activeSemester = getActiveSemester()

  const allScheduledPeriods = useMemo(
    () => getUsthadScheduledPeriodsAcrossClasses(liveBaseUsthad, activeSemester),
    [liveBaseUsthad, activeSemester, configVersion],
  )

  const allTeachingClasses = useMemo(
    () => getUsthadTeachingClasses(liveBaseUsthad, activeSemester),
    [liveBaseUsthad, activeSemester, configVersion],
  )

  const activeClassTimetable = useMemo(
    () => getClassSemesterTimetableByClassName(activeClassName),
    [activeClassName, configVersion],
  )

  const isAssignedClassUsthadForActiveClass = useMemo(
    () => isUsthadAssignedClassUsthadOfBatch(liveBaseUsthad, activeClassName),
    [liveBaseUsthad, activeClassName, configVersion],
  )

  const [selectedAttendancePeriodIndex, setSelectedAttendancePeriodIndex] = useState<number>(() => {
    const initialSlots = getUsthadScheduledPeriodsAcrossClasses(baseUsthad, getActiveSemester())
    const matchInOwnClass = initialSlots.find((s) => s.className === baseUsthad.className)
    return matchInOwnClass?.periodIndex ?? initialSlots[0]?.periodIndex ?? 1
  })

  const usthad = useMemo<ClassUsthad>(() => {
    void configVersion
    const classMatch = CLASS_USTHADS.find((u) => u.className === activeClassName)
    if (
      classMatch &&
      ((liveBaseUsthad.staffId && classMatch.staffId === liveBaseUsthad.staffId) ||
        classMatch.name === liveBaseUsthad.name)
    ) {
      return {
        ...classMatch,
        id: liveBaseUsthad.id,
        avatarUrl: liveBaseUsthad.avatarUrl ?? classMatch.avatarUrl,
        teachingBatches: liveBaseUsthad.teachingBatches ?? classMatch.teachingBatches,
      }
    }
    return {
      ...liveBaseUsthad,
      className: activeClassName,
      fullClassLabel: `Class ${activeClassName}`,
    }
  }, [liveBaseUsthad, activeClassName, configVersion])

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [mobileTab, setMobileTab] = useState<
    'roster' | 'attendance' | 'leave' | 'chat' | 'notices' | 'library'
  >('roster')
  const [mobileRosterSubTab, setMobileRosterSubTab] = useState<'students' | 'academic-hub'>(
    'students',
  )
  const [librarySubTab, setLibrarySubTab] = useState<
    'library' | 'digital-library' | 'timetable' | 'exam-results'
  >('library')
  const [timetablePdfBusy, setTimetablePdfBusy] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setFirebaseUser(u))
    return () => unsub()
  }, [])

  useEffect(() => {
    const syncHash = () => {
      if (typeof window === 'undefined') return
      const hash = window.location.hash.replace('#', '')
      if (!hash) return
      if (hash === 'class-roster') {
        setMobileTab('roster')
        setMobileRosterSubTab('students')
      } else if (hash === 'usthad-timetable') {
        setMobileTab('library')
        setLibrarySubTab('timetable')
      } else if (hash === 'academic-hub') {
        setMobileTab('roster')
        setMobileRosterSubTab('academic-hub')
      } else if (hash === 'usthad-attendance' || hash === 'class-attendance')
        setMobileTab('attendance')
      else if (hash === 'usthad-leave') setMobileTab('leave')
      else if (hash === 'campus-chat') setMobileTab('chat')
      else if (hash === 'usthad-notices') setMobileTab('notices')
      else if (hash === 'usthad-library') {
        setMobileTab('library')
        setLibrarySubTab('library')
      } else if (hash === 'usthad-kitabs') {
        setMobileTab('library')
        setLibrarySubTab('digital-library')
      } else if (hash === 'university-portal') {
        setMobileTab('library')
        setLibrarySubTab('exam-results')
      }
    }
    syncHash()
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [])

  async function handleUsthadTimetableExport(
    scope: 'personal' | 'class',
    mode: 'download' | 'print',
  ) {
    const busyKey = `${scope}_${mode}`
    setTimetablePdfBusy(busyKey)
    try {
      if (scope === 'personal') {
        await exportUsthadPersonalTimetablePdf({
          usthad: baseUsthad,
          semester: activeSemester,
          mode,
        })
      } else {
        await exportClassTimetablePdf({
          className: activeClassName,
          semester: activeSemester,
          preparedByName: baseUsthad.name,
          preparedByRole: isAssignedClassUsthadForActiveClass ? 'Class Usthad' : 'Usthad',
          highlightUsthad: baseUsthad,
          mode,
        })
      }
    } finally {
      setTimetablePdfBusy(null)
    }
  }

  // Strictly filter students to the logged-in Class Usthad's active assigned class
  const classStudents = useMemo(
    () => students.filter((s) => s.className === activeClassName),
    [activeClassName],
  )

  // Shared Attendance Overrides
  const [attendanceOverrides, setAttendanceOverrides] = useState<AttendanceOverrideMap>(() =>
    loadAttendanceOverrides(),
  )

  // Selected Student & Month for Attendance Editor
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    () => classStudents[0]?.id ?? students[0].id,
  )
  const [selectedMonthId, setSelectedMonthId] = useState<string>('2026-06')
  const [editPresent, setEditPresent] = useState<number>(0)
  const [editAbsent, setEditAbsent] = useState<number>(0)
  const [editLeave, setEditLeave] = useState<number>(0)
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
  const [leaveDate, setLeaveDate] = useState<DateValue>(() => getCurrentDateTime().date)
  const [leaveTime, setLeaveTime] = useState<Time12Value>(() => getCurrentDateTime().time)
  const [isManualLeaveDateTime, setIsManualLeaveDateTime] = useState(false)
  const [leaveReason, setLeaveReason] = useState<string>(leaveReasons[0])
  const [leaveDetails, setLeaveDetails] = useState<string>('')
  const [leaveSavedToast, setLeaveSavedToast] = useState<string | null>(null)

  const syncUsthadLeaveDateTime = useCallback(() => {
    const { date, time } = getCurrentDateTime()
    setLeaveDate((prev) =>
      prev.day === date.day && prev.month === date.month && prev.year === date.year ? prev : date,
    )
    setLeaveTime((prev) =>
      prev.hour === time.hour && prev.minute === time.minute && prev.period === time.period
        ? prev
        : time,
    )
  }, [])

  function resetUsthadLeaveDateTimeToLive() {
    setIsManualLeaveDateTime(false)
    const { date, time } = getCurrentDateTime()
    setLeaveDate(date)
    setLeaveTime(time)
  }

  useEffect(() => {
    if (isManualLeaveDateTime) return
    syncUsthadLeaveDateTime()
    const timer = window.setInterval(syncUsthadLeaveDateTime, 1000)
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncUsthadLeaveDateTime()
      }
    }
    window.addEventListener('focus', handleVisibilityOrFocus)
    document.addEventListener('visibilitychange', handleVisibilityOrFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', handleVisibilityOrFocus)
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
    }
  }, [isManualLeaveDateTime, syncUsthadLeaveDateTime])

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
  const [holidayMonthId, setHolidayMonthId] = useState('2026-06')
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
  const [holidayAnnouncedBy, setHolidayAnnouncedBy] = useState('Principal')
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

  const isUsthadMonthAttendanceDirty = useMemo(() => {
    if (!selectedStudent || !selectedMonthRecord) return false
    const cleanP = Math.max(0, Math.min(31, Number(editPresent) || 0))
    const cleanA = Math.max(0, Math.min(31, Number(editAbsent) || 0))
    const cleanL = Math.max(0, Math.min(31, Number(editLeave) || 0))
    const existingOv = attendanceOverrides[`${selectedStudent.id}__${selectedMonthRecord.id}`]
    const savedAbsReason = existingOv?.absentReason ?? ABSENT_REASONS[0]
    const savedLvReason = existingOv?.leaveReason ?? ATTENDANCE_LEAVE_REASONS[0]
    if (cleanP !== selectedMonthRecord.present) return true
    if (cleanA !== selectedMonthRecord.absent) return true
    if (cleanL !== selectedMonthRecord.leave) return true
    if (cleanA > 0 && editAbsentReason !== savedAbsReason) return true
    if (cleanL > 0 && editLeaveReason !== savedLvReason) return true
    return false
  }, [
    selectedStudent,
    selectedMonthRecord,
    editPresent,
    editAbsent,
    editLeave,
    editAbsentReason,
    editLeaveReason,
    attendanceOverrides,
  ])

  const hasCurrentMonthOverride = useMemo(() => {
    if (!selectedStudent || !selectedMonthRecord) return false
    return Boolean(attendanceOverrides[`${selectedStudent.id}__${selectedMonthRecord.id}`])
  }, [selectedStudent, selectedMonthRecord, attendanceOverrides])

  const isUsthadLeaveActionDuplicate = useMemo(() => {
    const targetItem = enrichedClassStudents.find(
      (item) => item.student.id === leaveStudentId,
    )
    if (!targetItem) return true
    if (leaveActionType === 'return') {
      return !targetItem.isOnLeave
    }
    if (targetItem.isOnLeave && targetItem.activeLeaveEntry) {
      if (
        targetItem.activeLeaveEntry.reason === leaveReason &&
        (targetItem.activeLeaveEntry.details || '') === leaveDetails.trim()
      ) {
        return true
      }
    }
    return false
  }, [enrichedClassStudents, leaveStudentId, leaveActionType, leaveReason, leaveDetails])

  function handleSaveMonthAttendance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedStudent || !selectedMonthRecord || !isUsthadMonthAttendanceDirty) return

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
    if (!hasCurrentMonthOverride && !isUsthadMonthAttendanceDirty) return
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
    overrideDateTime?: { dateString: string; timeString: string },
  ) {
    const safeStudentId = sanitizeId(targetStudent.id)
    const activeUid = firebaseUser ? firebaseUser.uid : `portal_${safeStudentId}`
    const { dateString, timeString } = overrideDateTime ?? formatNowParts()
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
          : `${targetStudent.name} (${targetStudent.className}) leave recorded: ${reasonText} (${dateString} at ${timeString}).`,
      targetStudentId: targetStudent.id,
      targetClass: targetStudent.className,
      actorName: usthad.name,
      href: '#leave',
    })

    setLeaveSavedToast(
      recordType === 'return'
        ? `Marked ${targetStudent.name} as Returned (${dateString} at ${timeString}).`
        : `Recorded leave for ${targetStudent.name} (${dateString} at ${timeString}).`,
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
    if (isUsthadLeaveActionDuplicate) return
    const st = classStudents.find((s) => s.id === leaveStudentId) ?? classStudents[0]
    if (!st) return
    const dateString = `${leaveDate.day} ${leaveDate.month} ${leaveDate.year}`
    const timeString = `${leaveTime.hour}:${leaveTime.minute} ${leaveTime.period}`
    void recordUsthadLeaveOrReturn(st, leaveActionType, leaveReason, leaveDetails.trim(), {
      dateString,
      timeString,
    })
    setLeaveDetails('')
    resetUsthadLeaveDateTimeToLive()
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
    <div className="lg:min-h-svh bg-background text-foreground transition-colors duration-300 max-lg:fixed max-lg:inset-0 max-lg:flex max-lg:flex-col max-lg:overflow-hidden lg:pl-64">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border/50 bg-background pt-[var(--safe-top)] transition-colors duration-300 lg:flex">
        <Link
          href="/"
          className="flex h-20 items-center gap-3 px-6"
          aria-label="ICS Academy Manhappatta home"
        >
          <BrandLogoMark className="h-10 w-auto" />
          <BrandWordmark
            className="pt-[2px]"
            gapClassName="gap-[1px]"
            topClassName="translate-y-[1px] text-lg font-bold text-[#009245] dark:text-[#89C53F] leading-none"
            bottomClassName="text-[10px] font-semibold text-[#0077CC] dark:text-[#0095F6] leading-none"
          />
        </Link>

        <nav aria-label="Usthad Dashboard" className="flex flex-1 flex-col gap-1 p-4">
          <p className="px-3 pb-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Usthad Portal
          </p>
          {usthadNavItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-[0.98]"
            >
              <item.icon className="size-4.5 transition-colors group-hover:text-[#0095F6]" strokeWidth={1.85} aria-hidden="true" />
              {item.label}
            </a>
          ))}
        </nav>

        <div className="p-4">
          <Link
            href="/"
            onClick={(event) => {
              event.preventDefault()
              window.localStorage.removeItem('isAuthenticated')
              window.localStorage.removeItem('authRole')
              window.localStorage.removeItem('loggedInUsthadId')
              window.dispatchEvent(new CustomEvent('ics-logout'))
            }}
            className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-red-500/12 hover:text-red-500"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Log out
          </Link>
        </div>
      </aside>

      {/* Top Sticky Header */}
      <header className="z-40 shrink-0 border-b border-border/50 bg-background/95 pt-[var(--safe-top)] backdrop-blur-md transition-colors duration-300 lg:sticky lg:top-0">
        <div className="flex h-16 sm:h-20 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-5 md:px-8">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 sm:gap-3 lg:hidden"
            aria-label="ICS Academy Manhappatta home"
          >
            <BrandLogoMark className="h-8 sm:h-10 w-auto shrink-0" />
            <BrandWordmark
              className="pt-[2px]"
              gapClassName="gap-[1px]"
              topClassName="translate-y-[1px] text-[15px] sm:text-lg font-bold text-[#009245] dark:text-[#89C53F] leading-none"
              bottomClassName="text-[8.5px] sm:text-[10px] font-semibold text-[#0077CC] dark:text-[#0095F6] leading-none"
            />
          </Link>

          <div className="hidden lg:block">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Usthad Dashboard
            </p>
            <p className="text-sm font-medium text-foreground">
              {usthad.fullClassLabel} ·{' '}
              {isAssignedClassUsthadForActiveClass
                ? 'Class Usthad & Period Attendance'
                : 'Subject Usthad (My Scheduled Periods)'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <AppUpdateButton />
            <ThemeToggle className="text-foreground/85 hover:text-foreground dark:text-white/90 dark:hover:text-white" />
            <UsthadSwitcher usthad={usthad} />
          </div>
        </div>
      </header>

      <div
        className={cn(
          'max-lg:flex-1 max-lg:min-h-0 max-lg:w-full',
          mobileTab === 'chat'
            ? 'max-lg:flex max-lg:flex-col max-lg:overflow-hidden'
            : 'max-lg:overflow-y-auto max-lg:overflow-x-hidden max-lg:overscroll-y-contain',
        )}
      >
        <CampusNotificationBar classNameFilter={usthad.className} />

        <main
          className={cn(
            'mx-auto flex max-w-7xl flex-col lg:gap-6 lg:px-8 lg:py-10',
            mobileTab === 'chat'
              ? 'max-lg:flex-1 max-lg:min-h-0 max-lg:w-full max-lg:max-w-none max-lg:gap-0 max-lg:p-0 max-lg:overflow-hidden'
              : 'gap-5 px-3.5 py-5 sm:gap-6 sm:px-5 sm:py-7 md:px-8 md:py-10',
          )}
        >
        {/* Usthad Welcome & Class Summary Header — Shown on Roster Tab on Phone/Tablet, Always Shown on Desktop */}
        <div
          className={cn(
            'flex flex-col justify-between gap-4 md:flex-row md:items-end',
            mobileTab !== 'roster' && 'hidden lg:flex',
          )}
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#0077CC] dark:text-[#0095F6]">
                Usthad ·{' '}
                {isAssignedClassUsthadForActiveClass
                  ? `Class Usthad (${activeClassName})`
                  : `Subject Usthad (${activeClassName})`}
              </p>
              {usthad.isPrincipalRole && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#0095F6]/15 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-[#0077CC] dark:text-[#38BDF8] uppercase">
                  Principal
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-3.5">
              {usthad.avatarUrl && (
                <ProfileInitialsAvatar
                  name={usthad.name}
                  avatarUrl={usthad.avatarUrl}
                  className="size-14 sm:size-16"
                />
              )}
              <h1 className="flex flex-col font-display leading-tight text-foreground">
                <span className="text-xl font-normal text-muted-foreground md:text-2xl">
                   السَّلَامُ عَلَيْكُمْ,
                </span>
                <span className="mt-0.5 text-2xl font-semibold tracking-tight whitespace-nowrap text-foreground sm:text-3xl md:text-4xl">
                  {usthad.name}
                </span>
              </h1>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2.5 md:items-end">
            {usthad.isPrincipalRole && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('ics-switch-role', {
                      detail: { role: 'principal', usthadId: usthad.id },
                    }),
                  )
                }}
                className="rounded-full bg-[#0095F6] px-4 text-xs font-bold text-white hover:bg-[#0084DC]"
              >
                Switch to Principal Command Center (All 11 Classes)
              </Button>
            )}

            {allTeachingClasses.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-card p-1.5">
                <span className="px-2 text-[11px] font-bold text-[#0077CC] uppercase dark:text-[#0095F6]">
                  My Classes ({allTeachingClasses.length}):
                </span>
                {allTeachingClasses.map((batch) => {
                  const isOwnClass = isUsthadAssignedClassUsthadOfBatch(baseUsthad, batch)
                  return (
                    <button
                      key={batch}
                      type="button"
                      onClick={() => {
                        setActiveClassName(batch)
                        const mySlotInBatch = allScheduledPeriods.find(
                          (s) => s.className === batch,
                        )
                        if (mySlotInBatch) {
                          setSelectedAttendancePeriodIndex(mySlotInBatch.periodIndex)
                        }
                        const firstSt = students.find((s) => s.className === batch)
                        if (firstSt) {
                          setSelectedStudentId(firstSt.id)
                          setLeaveStudentId(firstSt.id)
                        }
                      }}
                      className={cn(
                        'rounded-xl px-2.5 py-1 text-xs font-semibold transition-all active:scale-95',
                        activeClassName === batch
                          ? 'bg-[#0095F6] text-white'
                          : 'bg-muted/70 text-foreground hover:bg-muted',
                      )}
                      title={
                        isOwnClass
                          ? `Class ${batch} (Your Assigned Class)`
                          : `Class ${batch} (Scheduled Teaching Periods)`
                      }
                    >
                      {batch}
                      {isOwnClass ? ' ★' : ''}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-xs text-muted-foreground sm:text-sm">
              <p>
                Class <span className="font-semibold text-foreground">{activeClassName}</span>
              </p>
              <p>
                ID <span className="font-mono font-medium tabular-nums text-foreground">{usthad.staffId}</span>
              </p>
            </div>
          </div>
        </div>

        {/* 4-Column Class KPI Strip — Shown on Roster Tab on Phone/Tablet, Always Shown on Desktop */}
        <div
          className={cn(
            'grid grid-cols-2 gap-3 sm:grid-cols-4',
            mobileTab !== 'roster' && 'hidden lg:grid',
          )}
        >
          <div className="rounded-2xl bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Students</p>
            <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-foreground md:text-3xl">
              {classStudents.length}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{usthad.fullClassLabel}</p>
          </div>

          <div className="rounded-2xl bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Present</p>
            <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-emerald-600 dark:text-lime md:text-3xl">
              {classStudents.length - studentsCurrentlyOnLeave.length}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">In Campus</p>
          </div>

          <div className="rounded-2xl bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">On Leave</p>
            <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-red-500 md:text-3xl">
              {studentsCurrentlyOnLeave.length}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Leave List</p>
          </div>

          <div className="rounded-2xl bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Attendance</p>
            <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-[#0077CC] dark:text-[#0095F6] md:text-3xl">
              {classAverageAttendance}%
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Average</p>
          </div>
        </div>

        {/* Mobile Sub-Switcher on Students Tab: Class Roster vs Tests & Hub */}
        {mobileTab === 'roster' ? (
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-card p-1.5 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileRosterSubTab('students')}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all active:scale-[0.98]',
                mobileRosterSubTab === 'students'
                  ? 'bg-[#0095F6] text-white shadow-xs'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              <Users className="size-3.5 shrink-0" aria-hidden="true" />
              <span>Students ({classStudents.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileRosterSubTab('academic-hub')}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all active:scale-[0.98]',
                mobileRosterSubTab === 'academic-hub'
                  ? 'bg-[#0095F6] text-white shadow-xs'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              <Trophy className="size-3.5 shrink-0" aria-hidden="true" />
              <span>Tests &amp; Hub</span>
            </button>
          </div>
        ) : null}

        {/* 1. CLASS STUDENT ROSTER & INDIVIDUAL DETAILS */}
        <div
          className={cn(
            mobileTab === 'roster' && mobileRosterSubTab === 'students'
              ? 'block'
              : 'hidden lg:block',
          )}
        >
          <Panel
            id="class-roster"
            eyebrow={usthad.fullClassLabel}
            title="Students"
            icon={Users}
          action={
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {filteredRoster.length} / {classStudents.length}
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

              <div className="inline-flex items-center gap-1 rounded-full bg-muted/60 p-1">
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
                      'rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98] whitespace-nowrap shrink-0',
                      rosterFilter === tab.id
                        ? 'bg-[#0095F6] text-white shadow-xs'
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
                  <tr className="border-b border-border/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    <th scope="col" className="py-3 pr-3 whitespace-nowrap">Admission No.</th>
                    <th scope="col" className="px-3 py-3 whitespace-nowrap">Student Name</th>
                    <th scope="col" className="px-3 py-3 whitespace-nowrap">Campus Status</th>
                    <th scope="col" className="px-3 py-3 text-right whitespace-nowrap">Present / Absent / Leave</th>
                    <th scope="col" className="px-3 py-3 text-right whitespace-nowrap">Overall %</th>
                    <th scope="col" className="py-3 pl-3 text-right whitespace-nowrap">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/35">
                  {filteredRoster.map(({ student: st, effective, overallRate, isOnLeave, activeLeaveEntry }) => {
                    const isSelected = st.id === selectedStudent?.id
                    return (
                      <tr
                        key={st.id}
                        className={cn(
                          'transition-colors hover:bg-muted/40',
                          isSelected && 'bg-[#0095F6]/[0.07]',
                        )}
                      >
                        <td className="py-3 pr-3 font-mono text-xs font-medium tabular-nums text-muted-foreground whitespace-nowrap">
                          {st.admissionNo}
                        </td>
                        <td className="px-3 py-3 font-medium text-foreground whitespace-nowrap">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <GraduationCap className="size-4 shrink-0 text-[#0095F6]" aria-hidden="true" />
                            <span className="whitespace-nowrap">{st.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 text-xs font-semibold',
                              isOnLeave ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400',
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
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {effective.attendance.present}P
                          </span>
                          {' · '}
                          <span className="font-semibold text-destructive">
                            {effective.attendance.absent}A
                          </span>
                          {' · '}
                          <span className="font-semibold text-[#0077CC] dark:text-[#0095F6]">
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
                              className="inline-flex h-8 items-center rounded-full bg-muted/70 px-3 text-xs font-medium text-foreground transition-all hover:bg-muted active:scale-[0.98] whitespace-nowrap shrink-0"
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
                              className="inline-flex h-8 items-center rounded-full bg-muted/60 px-3 text-xs font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-[0.98] whitespace-nowrap shrink-0"
                            >
                              {isOnLeave ? 'Mark Return' : 'Log Leave'}
                            </a>
                            <button
                              type="button"
                              onClick={() => setPdfReportStudent(st)}
                              className="inline-flex h-8 items-center gap-1 rounded-full bg-[#0095F6]/15 px-3 text-xs font-semibold text-[#0077CC] transition-all hover:bg-[#0095F6]/25 active:scale-[0.98] dark:text-[#0095F6] whitespace-nowrap shrink-0"
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
          eyebrow={usthad.fullClassLabel}
          title="Attendance"
          icon={CalendarCheck}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <label htmlFor="usthad-att-student" className="sr-only">
                  Select student
                </label>
                <ThemeSelect
                  id="usthad-att-student"
                  value={selectedStudent?.id ?? ''}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="h-9 rounded-full bg-muted/70 px-3.5 text-xs font-semibold text-foreground outline-none hover:bg-muted"
                >
                  {classStudents.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.admissionNo})
                    </option>
                  ))}
                </ThemeSelect>
              </div>

              <div className="relative">
                <label htmlFor="usthad-att-month" className="sr-only">
                  Select month
                </label>
                <ThemeSelect
                  id="usthad-att-month"
                  value={selectedMonthId}
                  onChange={(e) => setSelectedMonthId(e.target.value)}
                  className="h-9 rounded-full bg-muted/70 px-3.5 text-xs font-semibold text-foreground outline-none hover:bg-muted"
                >
                  {selectedStudentEffective?.monthlyAttendance.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.month} {m.year}
                    </option>
                  ))}
                </ThemeSelect>
              </div>

              {selectedStudent ? (
                <button
                  type="button"
                  onClick={() => setPdfReportStudent(selectedStudent)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#0095F6] px-3.5 text-xs font-semibold text-white transition-all hover:bg-[#0077CC] active:scale-[0.98] whitespace-nowrap shrink-0"
                >
                  <FileText className="size-3.5" aria-hidden="true" />
                  Parent PDF Report
                </button>
              ) : null}
            </div>
          }
        >
          {selectedStudent && selectedStudentEffective && selectedMonthRecord ? (
            <div className="grid gap-6 xl:grid-cols-12">
              {/* Left Column: Selected Student Monthly Gauge + Editor Form */}
              <div className="flex flex-col gap-5 xl:col-span-7">
                <div className="flex flex-col items-center gap-5 rounded-2xl bg-muted/50 p-4 sm:flex-row">
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
                        className="stroke-[#0095F6] transition-[stroke-dashoffset] duration-500 ease-out"
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
                    <p className="text-xs font-medium text-[#0077CC] dark:text-[#0095F6]">
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
                      <span className="font-semibold text-[#0077CC] dark:text-[#0095F6]">{selectedMonthRecord.leave} Leave</span>
                    </p>
                  </div>
                </div>

                {/* Monthly Attendance Update Form */}
                <form
                  onSubmit={handleSaveMonthAttendance}
                  className="flex flex-col gap-4 rounded-2xl bg-muted/45 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Update {selectedMonthRecord.month} {selectedMonthRecord.year} Attendance
                    </h4>
                    <button
                      type="button"
                      disabled={!hasCurrentMonthOverride && !isUsthadMonthAttendanceDirty}
                      onClick={handleResetMonthAttendance}
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-45"
                    >
                      <RotateCcw className="size-3" aria-hidden="true" />
                      Reset Month
                    </button>
                  </div>

                  {/* Working Days vs Official Academy Holidays Excluded Banner */}
                  <div className="grid grid-cols-2 gap-3 rounded-2xl bg-[#0095F6]/10 p-3.5 text-xs">
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
                    <div className="flex flex-col border-l border-border/40 pl-3">
                      <span className="text-[10px] font-bold tracking-wider text-[#0077CC] uppercase dark:text-[#0095F6]">
                        Official Academy Holidays (Excluded)
                      </span>
                      <span className="mt-0.5 font-display text-base font-bold text-[#0077CC] tabular-nums dark:text-[#0095F6]">
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
                    <div className="flex flex-col gap-1.5 rounded-2xl bg-card p-3">
                      <Label htmlFor="edit-present" className="text-xs text-emerald-600 dark:text-lime">
                        Present Days
                      </Label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditPresent((v) => Math.max(0, v - 1))}
                          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground transition-colors hover:bg-muted/80"
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
                          className="h-9 w-full rounded-xl border-0 bg-muted text-center font-mono text-sm font-semibold tabular-nums text-foreground focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setEditPresent((v) => Math.min(31, v + 1))}
                          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground transition-colors hover:bg-muted/80"
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
                        'flex cursor-pointer flex-col gap-1.5 rounded-2xl p-3 transition-colors',
                        focusedReasonField === 'absent' || editAbsent > 0
                          ? 'bg-red-500/12'
                          : 'bg-card',
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
                          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground transition-colors hover:bg-muted/80"
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
                          className="h-9 w-full rounded-xl border-0 bg-muted text-center font-mono text-sm font-semibold tabular-nums text-foreground focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFocusedReasonField('absent')
                            setEditAbsent((v) => Math.min(31, v + 1))
                          }}
                          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground transition-colors hover:bg-muted/80"
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
                        'flex cursor-pointer flex-col gap-1.5 rounded-2xl p-3 transition-colors',
                        focusedReasonField === 'leave' || editLeave > 0
                          ? 'bg-[#0095F6]/12'
                          : 'bg-muted/45',
                      )}
                    >
                      <Label htmlFor="edit-leave" className="text-xs text-[#0077CC] dark:text-[#0095F6]">
                        Leave Days
                      </Label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setFocusedReasonField('leave')
                            setEditLeave((v) => Math.max(0, v - 1))
                          }}
                          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-popover text-foreground hover:bg-muted"
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
                          className="h-9 w-full rounded-xl border-0 bg-popover text-center font-mono text-sm font-semibold tabular-nums text-foreground outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFocusedReasonField('leave')
                            setEditLeave((v) => Math.min(31, v + 1))
                          }}
                          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-popover text-foreground hover:bg-muted"
                          aria-label="Increase leave days"
                        >
                          <Plus className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 4 Absent Reasons Selector when Absent is touched or > 0 */}
                  {(focusedReasonField === 'absent' || editAbsent > 0) && (
                    <div className="flex flex-col gap-2 rounded-2xl bg-red-500/10 p-3">
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
                                'flex items-center justify-start gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition-all active:scale-[0.98]',
                                isSelected
                                  ? 'bg-red-500/20 font-semibold text-red-700 dark:text-red-300'
                                  : 'bg-card text-muted-foreground hover:text-foreground',
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
                    <div className="flex flex-col gap-2 rounded-2xl bg-[#0095F6]/10 p-3">
                      <span className="text-[11px] font-semibold tracking-wider text-[#0077CC] uppercase dark:text-[#0095F6]">
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
                                'flex items-center justify-start gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition-all active:scale-[0.98]',
                                isSelected
                                  ? 'bg-[#0095F6] font-semibold text-white'
                                  : 'bg-card text-muted-foreground hover:text-foreground',
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
                      className="flex items-center gap-2 rounded-2xl bg-emerald-500/12 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                    >
                      <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                      {attendanceSavedToast}
                    </p>
                  ) : null}

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={!isUsthadMonthAttendanceDirty}
                      className="h-9 rounded-full px-4 text-xs font-semibold disabled:opacity-50"
                    >
                      <Check className="mr-1.5 size-3.5" aria-hidden="true" />
                      {isUsthadMonthAttendanceDirty ? 'Save Attendance Update' : 'Attendance Saved ✓'}
                    </Button>
                  </div>
                </form>
              </div>

              {/* Right Column: All 12 Months Breakdown for Selected Student */}
              <div className="flex flex-col xl:col-span-5">
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {selectedStudent.firstName}&apos;s Monthly Breakdown (June – May)
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
                          'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-all active:scale-[0.98]',
                          isActive
                            ? 'bg-[#0095F6]/15 text-foreground'
                            : 'bg-muted/40 hover:bg-muted/70',
                        )}
                      >
                        <span className="font-semibold">
                          {m.month} {m.year}
                        </span>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          <span className="text-emerald-600 dark:text-emerald-400">{m.present}P</span>
                          {' · '}
                          <span className="text-destructive">{m.absent}A</span>
                          {' · '}
                          <span className="text-[#0077CC] dark:text-[#0095F6]">{m.leave}L</span>
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

        {/* 2B. MY SCHEDULED TEACHING PERIODS ACROSS ALL CLASSES + PERIOD-SPECIFIC ATTENDANCE CONTROL */}
        {allScheduledPeriods.length > 0 && (
          <div className="rounded-2xl bg-[#0095F6]/10 p-4 sm:p-5">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <p className="text-[11px] font-bold tracking-wider text-[#0077CC] uppercase dark:text-[#0095F6]">
                  My Periods
                </p>
                <h3 className="mt-0.5 font-display text-base font-bold text-foreground sm:text-lg">
                  Teaching Periods ({allScheduledPeriods.length})
                </h3>
              </div>
            </div>

            <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {allScheduledPeriods.map((slot) => {
                const isSelectedSlot =
                  activeClassName === slot.className &&
                  selectedAttendancePeriodIndex === slot.periodIndex
                return (
                  <button
                    key={`${slot.className}_p${slot.periodIndex}`}
                    type="button"
                    onClick={() => {
                      setActiveClassName(slot.className)
                      setSelectedAttendancePeriodIndex(slot.periodIndex)
                      const firstSt = students.find((s) => s.className === slot.className)
                      if (firstSt) {
                        setSelectedStudentId(firstSt.id)
                        setLeaveStudentId(firstSt.id)
                      }
                    }}
                    className={cn(
                      'flex flex-col items-start justify-between gap-1.5 rounded-2xl p-3.5 text-left transition-all active:scale-[0.98]',
                      isSelectedSlot
                        ? 'bg-[#0095F6] text-white shadow-sm'
                        : 'bg-card text-foreground hover:bg-muted/70',
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase',
                          isSelectedSlot
                            ? 'bg-white/20 text-white'
                            : 'bg-[#0095F6]/15 text-[#0077CC] dark:text-[#0095F6]',
                        )}
                      >
                        Class {slot.className} · {slot.periodLabel}
                      </span>
                      <span
                        className={cn(
                          'font-mono text-[10px] font-semibold tabular-nums',
                          isSelectedSlot ? 'text-white/85' : 'text-muted-foreground',
                        )}
                      >
                        {slot.time}
                      </span>
                    </div>
                    <p className="line-clamp-1 text-xs font-bold">{slot.subject}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {classStudents[0] ? (
          <ClassLeaderAttendanceCard
            leader={classStudents[0]}
            leaderId={usthad.staffId}
            eyebrowLabel={`${usthad.fullClassLabel} · Period Attendance`}
            submittedByNameOverride={usthad.shortName}
            highlightLeaderBadge={false}
            actorRoleLabel="Usthad"
            restrictedUsthad={baseUsthad}
            controlledPeriodIndex={selectedAttendancePeriodIndex}
            onControlledPeriodIndexChange={setSelectedAttendancePeriodIndex}
          />
        ) : null}
        </div>

        {/* 3. LEAVE REGISTER & LIVE ON-LEAVE MONITOR */}
        <div className={cn(mobileTab === 'leave' ? 'block' : 'hidden lg:block')}>
        <Panel
          id="usthad-leave"
          eyebrow={usthad.fullClassLabel}
          title="Leave"
          icon={ClipboardList}
          action={
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {studentsCurrentlyOnLeave.length} on leave
            </span>
          }
        >
          <div className="grid gap-6 xl:grid-cols-12">
            {/* Live List of Students Currently On Leave + Recent Class Logs */}
            <div className="flex flex-col gap-5 xl:col-span-7">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  On Leave ({studentsCurrentlyOnLeave.length})
                </h3>
                {studentsCurrentlyOnLeave.length === 0 ? (
                  <div className="mt-2.5 flex items-center gap-2.5 rounded-2xl bg-emerald-500/12 p-4 text-xs text-emerald-700 dark:text-emerald-400">
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
                        className="flex flex-col justify-between gap-3 rounded-2xl bg-red-500/10 p-3.5 sm:flex-row sm:items-center"
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
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-[#0095F6] px-3.5 text-xs font-semibold text-white transition-all hover:bg-[#0077CC] active:scale-[0.98] whitespace-nowrap shrink-0"
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
              <div className="border-t border-border/40 pt-4">
                <div className="mb-2.5 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Class Leave & Return Log
                  </h3>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {allClassLeaveLogs.length} entries
                  </span>
                </div>

                {allClassLeaveLogs.length === 0 ? (
                  <p className="rounded-2xl bg-muted/40 p-4 text-center text-xs text-muted-foreground">
                    No leave or return entries logged for {usthad.fullClassLabel} yet.
                  </p>
                ) : (
                  <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
                    {allClassLeaveLogs.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-muted/45 px-3.5 py-2.5 text-xs"
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
                                  : 'text-emerald-600 dark:text-emerald-400',
                              )}
                            >
                              {entry.recordType === 'application' ? 'Leave Departure' : 'Campus Return'}
                            </span>
                            {' · '}
                            {entry.reason} · {entry.dateString} at {entry.timeString}
                          </p>
                        </div>
                        <DeleteActionMenu
                          ariaLabel="Options for leave record"
                          onConfirmDelete={() => void handleDeleteLeaveLog(entry)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Record Leave or Return Form for a Class Student */}
            <form
              onSubmit={handleSubmitLeaveForm}
              className="flex flex-col gap-4 rounded-2xl bg-muted/40 p-4 xl:col-span-5"
            >
              <h3 className="text-sm font-semibold text-foreground">
                Record Student Leave / Return
              </h3>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="usthad-leave-student" className="text-xs">
                  Student ({usthad.className})
                </Label>
                <ThemeSelect
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
                </ThemeSelect>
              </div>

              <div className="grid grid-cols-2 gap-1.5 rounded-full bg-popover p-1">
                <button
                  type="button"
                  onClick={() => setLeaveActionType('application')}
                  className={cn(
                    'flex h-9 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-all active:scale-[0.98]',
                    leaveActionType === 'application'
                      ? 'bg-[#0095F6] text-white'
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
                    'flex h-9 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-all active:scale-[0.98]',
                    leaveActionType === 'return'
                      ? 'bg-[#0095F6] text-white'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <LogIn className="size-3.5" aria-hidden="true" />
                  Record Return
                </button>
              </div>

              <div className="grid gap-3">
                <DateSelectGroup
                  idPrefix="usthad-leave-date"
                  label={leaveActionType === 'application' ? 'Departure date' : 'Return date'}
                  value={leaveDate}
                  onChange={(nextDate) => {
                    setIsManualLeaveDateTime(true)
                    setLeaveDate(nextDate)
                  }}
                />
                <TimeSelectGroup
                  idPrefix="usthad-leave-time"
                  label={leaveActionType === 'application' ? 'Departure time' : 'Return time'}
                  value={leaveTime}
                  isManual={isManualLeaveDateTime}
                  onResetToLive={resetUsthadLeaveDateTimeToLive}
                  onChange={(nextTime) => {
                    setIsManualLeaveDateTime(true)
                    setLeaveTime(nextTime)
                  }}
                />
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
                              'flex items-center justify-start gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition-all active:scale-[0.98]',
                              isSelected
                                ? 'bg-amber-500/20 font-semibold text-amber-800 dark:text-amber-300'
                                : 'bg-popover text-muted-foreground hover:text-foreground',
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
                  className="flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                >
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                  {leaveSavedToast}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={isUsthadLeaveActionDuplicate}
                className="mt-auto h-10 w-full rounded-full text-xs font-semibold disabled:opacity-50"
              >
                {isUsthadLeaveActionDuplicate
                  ? leaveActionType === 'return'
                    ? 'Already At Academy ✓'
                    : 'Leave Already Recorded ✓'
                  : leaveActionType === 'application'
                    ? 'Submit Leave Outpass'
                    : 'Confirm Student Return'}
              </Button>
            </form>
          </div>
        </Panel>
        </div>

        {/* 4. NOTICE BOARD — PUBLISH & MANAGE ANNOUNCEMENTS */}
        <div className={cn(mobileTab === 'notices' ? 'block' : 'hidden lg:block')}>
        <Panel
          id="usthad-notices"
          eyebrow="Notices"
          title="Notice Board"
          icon={Megaphone}
          action={
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {allNoticesCombined.length} notices
            </span>
          }
        >
          <div className="grid gap-6 xl:grid-cols-12">
            {/* Publish New Notice Form */}
            <form
              onSubmit={handlePublishNotice}
              className="flex flex-col gap-4 rounded-2xl bg-muted/40 p-4 xl:col-span-5"
            >
              <h3 className="text-sm font-semibold text-foreground">
                New Notice
              </h3>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notice-title-input" className="text-xs">
                  Title *
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
                  <ThemeSelect
                    id="notice-category-select"
                    value={noticeCategory}
                    onChange={(e) => setNoticeCategory(e.target.value as Notice['category'])}
                    className={fieldClassName}
                  >
                    <option value="Academic">Academic</option>
                    <option value="Exam">Exam</option>
                    <option value="Event">Event</option>
                    <option value="Hostel">Hostel</option>
                  </ThemeSelect>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-popover px-3 text-xs font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={noticePinned}
                      onChange={(e) => setNoticePinned(e.target.checked)}
                      className="size-4 accent-[#0095F6]"
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

              {/* Target Classes Selector */}
              <div className="flex flex-col gap-2.5 rounded-2xl bg-[#0095F6]/[0.08] p-3">
                <div className="flex flex-col gap-0.5">
                  <Label className="text-xs font-bold text-foreground">
                    Target Classes
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Select whether this notice or holiday applies to all 11 classes or only selected classes.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {(
                    [
                      {
                        id: 'all',
                        label: 'All 11 Classes',
                      },
                      {
                        id: 'my-class',
                        label: `My Class Only (${usthad.className})`,
                      },
                      {
                        id: 'high-school',
                        label: 'High School Classes (8th – HS 2)',
                      },
                      {
                        id: 'bs-degree',
                        label: 'BS Degree Classes (BS 1 – BS 5)',
                      },
                      {
                        id: 'custom',
                        label: 'Select Specific Classes',
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
                          'flex items-center justify-start gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition-all active:scale-[0.98]',
                          opt.id === 'custom' && 'sm:col-span-2',
                          active
                            ? 'bg-[#0095F6]/20 text-foreground'
                            : 'bg-popover text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'flex size-4 shrink-0 items-center justify-center rounded-full',
                            active ? 'bg-[#0095F6] text-white' : 'bg-muted text-transparent',
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
                  <div className="mt-1 flex flex-col gap-2 rounded-xl bg-popover p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-foreground">
                        Select Classes ({noticeCustomBatches.length} selected):
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setNoticeCustomBatches([...ALL_ACADEMY_CLASS_NAMES])}
                          className="text-[10px] font-semibold text-[#0077CC] hover:underline dark:text-[#0095F6]"
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
                              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-[0.97]',
                              checked
                                ? 'bg-[#0095F6] text-white'
                                : 'bg-muted/70 text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {checked ? <Check className="size-3" /> : null}
                            <span>{cls}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Official Academy Holiday Schedule & Working Days Deduction Toggle */}
              <div className="flex flex-col gap-3 rounded-2xl bg-[#0095F6]/[0.08] p-3">
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
                    className="size-4 accent-[#0095F6]"
                  />
                </label>

                {isHolidayNotice ? (
                  <div className="grid gap-2.5 border-t border-border/40 pt-2.5 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="holiday-type-select" className="text-[11px]">
                        Holiday Type
                      </Label>
                      <ThemeSelect
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
                        className="h-9 rounded-xl bg-popover px-2.5 text-xs text-foreground outline-none"
                      >
                        <option value="monthly-second-saturday">
                          Monthly 2nd Saturday Leave (Thu/Fri → Sun/Mon)
                        </option>
                        <option value="festival-celebration">
                          Festival / Celebration Leave (Eid / Perunnal 7–10d)
                        </option>
                      </ThemeSelect>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="holiday-month-select" className="text-[11px]">
                          Target Month
                        </Label>
                        <ThemeSelect
                          id="holiday-month-select"
                          value={holidayMonthId}
                          onChange={(e) => setHolidayMonthId(e.target.value)}
                          className="h-9 rounded-xl bg-popover px-2 text-xs text-foreground outline-none"
                        >
                          {MONTHS_META.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.shortMonth} {m.year}
                            </option>
                          ))}
                        </ThemeSelect>
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
                          className="h-9 rounded-xl bg-popover px-2.5 font-mono text-xs font-bold text-[#0077CC] dark:text-[#0095F6] tabular-nums outline-none"
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
                        className="h-9 rounded-xl bg-popover px-2.5 text-xs text-foreground outline-none"
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
                        className="h-9 rounded-xl bg-popover px-2.5 text-xs text-foreground outline-none"
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
                        className="h-9 rounded-xl bg-popover px-2.5 text-xs text-foreground outline-none"
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
                        className="h-9 rounded-xl bg-popover px-2.5 text-xs text-foreground outline-none"
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
                        className="h-9 rounded-xl bg-popover px-2.5 text-xs text-foreground outline-none"
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {noticeToast ? (
                <p
                  role="status"
                  className="flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                >
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                  {noticeToast}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={!noticeTitle.trim() || !noticeBody.trim()}
                className="h-10 w-full rounded-full text-xs font-semibold disabled:opacity-50"
              >
                <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
                {isHolidayNotice
                  ? 'Publish Official Holiday & Update Working Days'
                  : 'Publish to Notice Board'}
              </Button>
            </form>

            {/* Existing Notices List */}
            <div className="flex flex-col gap-2.5 xl:col-span-7">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Published Notices (Synced with Student Dashboard)
              </h3>
              {allNoticesCombined.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl bg-muted/40 px-4 py-10 text-center">
                  <Megaphone className="size-6 text-[#0095F6]" aria-hidden="true" />
                  <p className="mt-2 text-xs font-semibold text-foreground">
                    No Announcements Published Yet
                  </p>
                  <p className="mt-1 max-w-sm text-[11px] text-muted-foreground">
                    Publish an announcement or official holiday schedule on the left to display it on the Student Notice Board.
                  </p>
                </div>
              ) : (
                <ul className="flex max-h-96 flex-col divide-y divide-border/35 overflow-y-auto rounded-2xl bg-muted/40 px-4">
                  {allNoticesCombined.map((item) => {
                    const isCustom =
                      item.id.startsWith('nt-usthad-') || item.id.startsWith('nt-principal-')
                    const itemTargets = getNoticeTargetClasses(item)
                    const itemTargetLabel = formatTargetClassesBadge(itemTargets)
                    return (
                      <li key={item.id} className="flex items-start justify-between gap-3 py-3.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-semibold text-[#0077CC] dark:text-[#0095F6]">{item.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums text-muted-foreground">{item.date}</span>
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold',
                                itemTargets.length > 0
                                  ? 'bg-[#0095F6]/15 text-[#0077CC] dark:text-[#0095F6]'
                                  : 'bg-muted/70 text-muted-foreground',
                              )}
                            >
                              <Users className="size-2.5" aria-hidden="true" />
                              {itemTargetLabel}
                            </span>
                            {item.pinned ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1 font-medium text-[#0077CC] dark:text-[#0095F6]">
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
                              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <Pin className="size-3.5" aria-hidden="true" />
                            </button>
                            <DeleteActionMenu
                              ariaLabel={`Options for ${item.title}`}
                              onConfirmDelete={() => handleDeleteCustomNotice(item.id)}
                            />
                          </div>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </Panel>
        </div>

        {/* 5. LIBRARY HUB — 4 TOP ICONS MATCHING PRINCIPAL & STUDENT LAYOUT (Library, Digital Kitabs, Time Table, Exam Results) */}
        <div
          id="usthad-library-hub"
          className={cn(
            'flex flex-col gap-5',
            mobileTab === 'library' ? 'flex' : 'hidden lg:flex',
          )}
        >
          {/* 4-Interface Switcher matching Principal & Student Library Layout */}
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-card p-1.5 sm:grid-cols-4">
            {(
              [
                { id: 'library', label: 'Library', icon: BookMarked },
                { id: 'digital-library', label: 'Digital Kitabs', icon: Library },
                { id: 'timetable', label: 'Time Table', icon: CalendarDays },
                { id: 'exam-results', label: 'Exam Results', icon: Globe },
              ] as const
            ).map((sub) => {
              const active = librarySubTab === sub.id
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setLibrarySubTab(sub.id)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-xs font-semibold transition-all active:scale-[0.98]',
                    active
                      ? 'bg-[#0095F6] text-white'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <sub.icon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{sub.label}</span>
                </button>
              )
            })}
          </div>

          {librarySubTab === 'library' && (
            <div id="usthad-library">
              <LibraryBooks />
            </div>
          )}

          {librarySubTab === 'digital-library' && (
            <div className="flex flex-col gap-5">
              <Panel
                id="usthad-kitabs"
                eyebrow="Library"
                title="Upload Kitab"
                icon={Library}
                action={
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {CURATED_KITABS.length + localKitabUploads.length} Kitabs
                  </span>
                }
              >
                <form onSubmit={handleUploadKitabPdf} className="flex flex-col gap-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="usthad-kitab-title" className="text-xs">
                        Kitab Title *
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
                        Arabic Title
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
                        Author *
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
                      <ThemeSelect
                        id="usthad-kitab-category"
                        value={kitabCategory}
                        onChange={(e) => setKitabCategory(e.target.value as KitabCategory)}
                        className={fieldClassName}
                      >
                        <option value="fiqh">Fiqh &amp; Usul (الْفِقْهُ وَأُصُولُهُ)</option>
                        <option value="hadith">Hadith Studies (الْحَدِيثُ الشَّرِيفُ)</option>
                        <option value="tafsir">Tafsir &amp; Ulum (التَّفْسِيرُ وَعُلُومُ الْقُرْآنِ)</option>
                        <option value="aqeedah">Aqeedah &amp; Tasawwuf (الْعَقِيدَةُ وَالتَّصَوُّفُ)</option>
                        <option value="nahw">Nahw &amp; Sarf (النَّحْوُ وَالصَّرْفُ)</option>
                        <option value="history">History &amp; Da&apos;wa (التَّارِيخُ وَالدَّعْوَةُ)</option>
                      </ThemeSelect>
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
                        Syllabus Description &amp; Summary *
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
                      disabled={
                        uploadingKitab ||
                        !kitabTitle.trim() ||
                        !kitabAuthor.trim() ||
                        !kitabSummary.trim()
                      }
                      className="h-9 w-full rounded-lg px-4 text-xs font-semibold sm:w-auto disabled:opacity-50"
                    >
                      {uploadingKitab ? (
                        <>
                          <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
                          Uploading PDF...
                        </>
                      ) : (
                        <>
                          <CloudUpload className="mr-1.5 size-3.5" aria-hidden="true" />
                          Upload &amp; Index Kitab
                        </>
                      )}
                    </Button>
                  </div>
                </form>

                {localKitabUploads.length > 0 ? (
                  <div className="mt-5 border-t border-border/40 pt-4">
                    <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Recently Uploaded Kitab PDFs ({localKitabUploads.length})
                    </p>
                    <ul className="grid gap-2.5 sm:grid-cols-2">
                      {localKitabUploads.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-muted/50 p-3 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <FileText className="size-3.5 shrink-0 text-[#0095F6]" aria-hidden="true" />
                              <span className="truncate font-semibold text-foreground">{item.title}</span>
                            </div>
                            <p className="mt-0.5 truncate text-muted-foreground">
                              {CATEGORY_LABELS[item.category]} · {item.author}
                            </p>
                          </div>
                          <DeleteActionMenu
                            ariaLabel={`Options for ${item.title}`}
                            onConfirmDelete={() => handleDeleteUploadedKitab(item.id)}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </Panel>

              <DigitalLibrary student={classStudents[0] ?? students[0]} />
            </div>
          )}

          {librarySubTab === 'timetable' && (
            <Panel
              id="usthad-timetable"
              eyebrow={`Semester ${activeSemester}`}
              title="Time Table"
              icon={CalendarDays}
              action={
                <span className="inline-flex items-center rounded-full bg-[#0095F6]/15 px-3 py-1 text-xs font-semibold text-[#0077CC] dark:text-[#0095F6] tabular-nums">
                  {allScheduledPeriods.length} Periods
                </span>
              }
            >
              <div className="flex flex-col gap-6">
                {/* Personal Chronological Schedule Across All Classes */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-sm font-bold text-foreground sm:text-base">
                      My Schedule
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        disabled={timetablePdfBusy !== null}
                        onClick={() => void handleUsthadTimetableExport('personal', 'download')}
                        className="h-8 rounded-full bg-[#0095F6] px-3 text-xs font-semibold text-white hover:bg-[#0077CC]"
                      >
                        <Download className="mr-1.5 size-3.5" aria-hidden="true" />
                        {timetablePdfBusy === 'personal_download' ? 'Generating...' : 'Download PDF'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={timetablePdfBusy !== null}
                        onClick={() => void handleUsthadTimetableExport('personal', 'print')}
                        className="h-8 rounded-full px-3 text-xs font-semibold"
                      >
                        <Printer className="mr-1.5 size-3.5" aria-hidden="true" />
                        {timetablePdfBusy === 'personal_print' ? 'Preparing...' : 'Print'}
                      </Button>
                    </div>
                  </div>

                  {allScheduledPeriods.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {allScheduledPeriods.map((slot) => {
                        const isActive =
                          activeClassName === slot.className &&
                          selectedAttendancePeriodIndex === slot.periodIndex
                        return (
                          <div
                            key={`tt_${slot.className}_p${slot.periodIndex}`}
                            className={cn(
                              'flex flex-col justify-between gap-2.5 rounded-2xl p-3.5 transition-all',
                              isActive
                                ? 'bg-[#0095F6]/15'
                                : 'bg-muted/45 hover:bg-muted/65',
                            )}
                          >
                            <div className="flex items-center justify-between gap-2 border-b border-border/35 pb-2">
                              <span className="rounded-full bg-[#0095F6]/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#0077CC] uppercase dark:text-[#0095F6]">
                                {slot.className} · {slot.periodLabel}
                              </span>
                              <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                                {slot.time}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{slot.subject}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {slot.teacher}
                              </p>
                            </div>
                            <a
                              href="#usthad-attendance"
                              onClick={() => {
                                setActiveClassName(slot.className)
                                setSelectedAttendancePeriodIndex(slot.periodIndex)
                                const firstSt = students.find((s) => s.className === slot.className)
                                if (firstSt) {
                                  setSelectedStudentId(firstSt.id)
                                  setLeaveStudentId(firstSt.id)
                                }
                                setMobileTab('attendance')
                              }}
                              className="inline-flex h-8 w-full items-center justify-center rounded-full bg-[#0095F6]/15 px-3 text-xs font-semibold text-[#0077CC] transition-all hover:bg-[#0095F6] hover:text-white active:scale-[0.98] dark:text-[#0095F6] dark:hover:text-white"
                            >
                              Mark Attendance
                            </a>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="rounded-2xl bg-muted/40 p-4 text-xs text-muted-foreground">
                      No periods scheduled this semester.
                    </p>
                  )}
                </div>

                {/* Active Class Full Timetable */}
                <div className="space-y-3 border-t border-border/40 pt-5">
                  <div className="flex flex-col gap-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-display text-sm font-bold text-foreground sm:text-base">
                        Class {activeClassName} Schedule
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={timetablePdfBusy !== null}
                          onClick={() => void handleUsthadTimetableExport('class', 'download')}
                          className="h-8 rounded-full px-3 text-xs font-semibold"
                        >
                          <Download className="mr-1.5 size-3.5" aria-hidden="true" />
                          {timetablePdfBusy === 'class_download'
                            ? '...'
                            : `${activeClassName} PDF`}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={timetablePdfBusy !== null}
                          onClick={() => void handleUsthadTimetableExport('class', 'print')}
                          className="h-8 rounded-full px-3 text-xs font-semibold"
                        >
                          <Printer className="mr-1.5 size-3.5" aria-hidden="true" />
                          {timetablePdfBusy === 'class_print' ? '...' : 'Print'}
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {ALL_ACADEMY_CLASS_NAMES.map((clsName) => (
                        <button
                          key={`tt_cls_${clsName}`}
                          type="button"
                          onClick={() => {
                            setActiveClassName(clsName)
                            const firstSt = students.find((s) => s.className === clsName)
                            if (firstSt) {
                              setSelectedStudentId(firstSt.id)
                              setLeaveStudentId(firstSt.id)
                            }
                          }}
                          className={cn(
                            'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-[0.97]',
                            activeClassName === clsName
                              ? 'bg-[#0095F6] text-white'
                              : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          {clsName}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                    {activeClassTimetable.periods.map((period, idx) => {
                      const semSlots =
                        activeSemester === 1
                          ? activeClassTimetable.semester1
                          : activeClassTimetable.semester2
                      const slot = semSlots[idx]
                      if (!slot) return null
                      const isNonTeaching = isNonTeachingTimetableSlot(slot)
                      const isMine =
                        !isNonTeaching && doesUsthadMatchTeacherName(baseUsthad, slot.teacher)
                      return (
                        <div
                          key={`full_${activeClassName}_p${idx + 1}`}
                          className={cn(
                            'flex flex-col justify-between rounded-2xl p-3.5 transition-colors',
                            isNonTeaching
                              ? 'bg-muted/25 text-muted-foreground'
                              : isMine
                                ? 'bg-[#0095F6]/12'
                                : 'bg-muted/45',
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-border/35 pb-1.5">
                            <span
                              className={cn(
                                'text-xs font-bold uppercase',
                                isMine
                                  ? 'text-[#0077CC] dark:text-[#0095F6]'
                                  : isNonTeaching
                                    ? 'text-muted-foreground'
                                    : 'text-foreground',
                              )}
                            >
                              {period.label}
                            </span>
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {period.time}
                            </span>
                          </div>
                          <div className="mt-2 space-y-1">
                            <p className="text-sm font-semibold text-foreground">{slot.subject}</p>
                            <p className="text-xs text-muted-foreground">
                              {isNonTeaching ? (
                                <span className="inline-flex items-center gap-1">
                                  <Coffee className="size-3" aria-hidden="true" />
                                  {slot.subject}
                                </span>
                              ) : (
                                slot.teacher
                              )}
                            </p>
                            {isMine && (
                              <span className="inline-flex items-center rounded-full bg-[#0095F6]/15 px-2 py-0.5 text-[10px] font-bold text-[#0077CC] dark:text-[#0095F6]">
                                • My Period
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </Panel>
          )}

          {librarySubTab === 'exam-results' && <ExamResultCard />}
        </div>

        {/* MONTHLY TESTS, STAR OF THE MONTH, JAMIATHUL HIND SYLLABUS, HOLIDAY & SSF DA'WA LOGS, PRIVATE CONDUCT & ZADUL KHAIR PDF HUB */}
        <div
          className={cn(
            mobileTab === 'roster' && mobileRosterSubTab === 'academic-hub'
              ? 'block'
              : 'hidden lg:block',
          )}
        >
          <UsthadAcademicHub
            actorId={baseUsthad.id}
            actorName={baseUsthad.name}
            role="usthad"
            activeClassName={activeClassName}
            usthad={baseUsthad}
          />
        </div>

        {/* WHATSAPP-STYLE CAMPUS MESSENGER FOR USTHAD (Class Group, Staff Room & Direct Chats) */}
        <div
          className={cn(
            mobileTab === 'chat'
              ? 'max-lg:flex max-lg:flex-1 max-lg:min-h-0 max-lg:w-full max-lg:flex-col max-lg:overflow-hidden block'
              : 'hidden lg:block',
          )}
        >
          <CampusMessenger
            role="usthad"
            usthad={usthad}
            activeClassName={activeClassName}
            mobileFullScreen
            mobileTabActive={mobileTab === 'chat'}
          />
        </div>
        </main>
      </div>

      {/* PHONE & TABLET INSTAGRAM-STYLE BOTTOM NAVIGATION MENU BAR FOR CLASS USTHAD (Hidden on Desktop lg:) */}
      <nav
        aria-label="Usthad Mobile & Tablet Bottom Navigation"
        className="z-50 shrink-0 border-t border-border/50 bg-background/95 pb-[var(--safe-bottom)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid h-[60px] max-w-xl grid-cols-6 items-center px-1">
          {(
            [
              { id: 'roster', label: 'Students', icon: Users, badge: 0 },
              { id: 'attendance', label: 'Attend', icon: CalendarCheck, badge: 0 },
              {
                id: 'leave',
                label: 'Leave',
                icon: ClipboardList,
                badge: studentsCurrentlyOnLeave.length,
              },
              { id: 'chat', label: 'Chat', icon: MessageCircle, badge: 0 },
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
                  'flex flex-col items-center justify-center gap-1 py-1 transition-all duration-150 active:scale-95',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'relative flex h-8 w-11 items-center justify-center rounded-full transition-all duration-150',
                    active && 'bg-foreground/10 dark:bg-white/12',
                  )}
                >
                  <tab.icon
                    className="size-[20px]"
                    strokeWidth={active ? 2.4 : 1.75}
                    aria-hidden="true"
                  />
                  {tab.badge > 0 ? (
                    <span className="absolute -top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 font-mono text-[9.5px] font-bold text-white tabular-nums">
                      {tab.badge}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    'text-[10px] leading-none',
                    active ? 'font-bold text-foreground' : 'font-medium',
                  )}
                >
                  {tab.label}
                </span>
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
