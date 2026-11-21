'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  AlertTriangle,
  Award,
  Ban,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Crown,
  FileText,
  FileUp,
  GraduationCap,
  Library,
  Lock,
  LogOut,
  Megaphone,
  MessageCircle,
  Pin,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  UserCog,
  UserMinus,
  UserX,
  Users,
} from 'lucide-react'
import {
  User,
  onAuthStateChanged,
  signInAnonymously,
} from 'firebase/auth'
import {
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
import { AppUpdateButton } from '@/components/app-update-manager'
import { BrandLogoMark, BrandWordmark } from '@/components/brand-wordmark'
import { ThemeSelect } from '@/components/ui/theme-select'
import {
  CampusNotificationBar,
  CampusNotificationBell,
} from '@/components/campus-notifications'
import { UsthadAcademicHub } from '@/components/dashboard/campus-academic-hub'
import { CampusMessenger } from '@/components/dashboard/campus-messenger'
import { ClassLeaderAttendanceCard } from '@/components/dashboard/class-leader-attendance-card'
import {
  ABSENT_REASONS,
  ACADEMY_MANAGER,
  ACADEMY_PRINCIPAL,
  ALL_ACADEMY_CLASS_NAMES,
  ATTENDANCE_LEAVE_REASONS,
  BS_DEGREE_CLASS_NAMES,
  CLASS_LEADERS,
  CLASS_USTHADS,
  HIGH_SCHOOL_CLASS_NAMES,
  MONTHS_META,
  NOT_HELD_REASONS,
  OFFICIAL_CLASS_USTHADS,
  SHAIKHUNA_HAMZA_USTHAD,
  addStudentByPrincipal,
  assignClassLeadersByPrincipal,
  assignClassUsthadByPrincipal,
  ensureCleanLaunchStorage,
  formatTargetClassesBadge,
  getActiveSemester,
  getClassLeadersForClass,
  getClassSemesterTimetable,
  getClassSemesterTimetableByClassName,
  getDefaultClassTimetable,
  getEffectiveStudentAttendance,
  getNextSuggestedAdmissionNo,
  getNoticeTargetClasses,
  isNonTeachingTimetableSlot,
  leaveReasons,
  loadAcademyAdminConfig,
  loadAttendanceOverrides,
  loadCustomNotices,
  loadPeriodAttendanceSubmissions,
  publishCampusNotification,
  removeStudentByPrincipal,
  resetClassTimetableByPrincipal,
  restoreAllRemovedStudentsByPrincipal,
  saveAttendanceOverrides,
  saveClassTimetableByPrincipal,
  saveCustomNotices,
  savePeriodAttendanceSubmissions,
  saveUsthadProfileByPrincipal,
  setActiveSemesterByPrincipal,
  students,
  updateStudentByPrincipal,
  type AttendanceOverrideMap,
  type ClassSemesterTimetable,
  type ClassUsthad,
  type Notice,
  type OfficialHolidayMeta,
  type PeriodAttendanceSubmission,
  type Student,
} from '@/components/dashboard/data'
import {
  DigitalLibrary,
  addKitabIdToBookmarksStorage,
  buildKitabPdfBlob,
  deleteKitabPdfBlobLocally,
  notifyDigitalLibraryUpdated,
  saveKitabPdfBlobLocally,
  withCloudTimeout,
  type DigitalKitabItem,
  type KitabCategory,
} from '@/components/dashboard/digital-library'
import { getPdfBlobPageCount } from '@/components/dashboard/kitab-pdf-viewer'
import { ExamResultCard } from '@/components/dashboard/exam-result-card'
import { type SavedLeaveEntry } from '@/components/dashboard/leave-register'
import { LibraryBooks } from '@/components/dashboard/library-books'
import { NoticeBoard } from '@/components/dashboard/notice-board'
import { Panel } from '@/components/dashboard/panel'
import { ParentReportModal } from '@/components/dashboard/parent-report-modal'
import { PrincipalSwitcher, ProfileInitialsAvatar } from '@/components/dashboard/student-switcher'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  OperationType,
  auth,
  db,
  handleFirestoreError,
  storage,
} from '@/src/lib/firebase'
import { cn } from '@/lib/utils'

const LOCAL_UPLOADS_STORAGE_KEY = 'ics_digital_library_uploads_v1'

function sanitizeId(raw: string) {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120) || 'student'
}

function getTodayDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatNowParts() {
  const now = new Date()
  const dateString = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const timeString = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  return { dateString, timeString }
}

function loadStudentLeaveEntriesFromStorage(studentId: string): SavedLeaveEntry[] {
  if (typeof window === 'undefined') return []
  try {
    ensureCleanLaunchStorage()
    const raw = window.localStorage.getItem(`ics_leave_records_v2_${sanitizeId(studentId)}`)
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
    window.localStorage.setItem(
      `ics_leave_records_v2_${sanitizeId(studentId)}`,
      JSON.stringify(entries.slice(0, 50)),
    )
  } catch {
    // Ignore storage quota errors
  }
}

type ExecutiveTab = 'monitor' | 'people' | 'chat' | 'notices' | 'library'
type PeopleSubTab = 'usthads' | 'leaders' | 'students' | 'timetable'

export function PrincipalDashboard() {
  const principal = ACADEMY_PRINCIPAL

  const [activeTab, setActiveTab] = useState<ExecutiveTab>('monitor')
  const [peopleSubTab, setPeopleSubTab] = useState<PeopleSubTab>('usthads')
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString)
  const [configVersion, setConfigVersion] = useState<number>(0)

  // Selected class for deep inspection & period control (defaults to Principal's own assigned class)
  const [selectedClassName, setSelectedClassName] = useState<string>(
    () => principal.assignedClassName || CLASS_USTHADS[0]?.className || 'BS 3',
  )

  // Quick Mark Not Held / Substitute form state
  const [quickClassName, setQuickClassName] = useState<string>(
    () => principal.assignedClassName || CLASS_USTHADS[0]?.className || 'BS 3',
  )
  const [quickPeriodIndex, setQuickPeriodIndex] = useState<number>(1)
  const [quickNotHeldReason, setQuickNotHeldReason] = useState<string>(NOT_HELD_REASONS[0])
  const [quickSubstituteUsthadId, setQuickSubstituteUsthadId] = useState<string>('')
  const [sessionActionToast, setSessionActionToast] = useState<string | null>(null)

  // Substitute Usthad selection per unheld submission key
  const [substituteSelectionMap, setSubstituteSelectionMap] = useState<Record<string, string>>({})

  // Firebase Auth User
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)

  // Shared Data State
  const [periodSubmissions, setPeriodSubmissions] = useState<
    Record<string, PeriodAttendanceSubmission>
  >({})
  const [attendanceOverrides, setAttendanceOverrides] = useState<AttendanceOverrideMap>({})
  const [customNotices, setCustomNotices] = useState<Notice[]>([])
  const [campusLeaveMap, setCampusLeaveMap] = useState<Record<string, SavedLeaveEntry[]>>({})

  // Student Directory Filters & Leave / Monthly Attendance Editor
  const [directoryClassFilter, setDirectoryClassFilter] = useState<string>('ALL')
  const [directoryStatusFilter, setDirectoryStatusFilter] = useState<'all' | 'academy' | 'leave'>('all')
  const [directorySearch, setDirectorySearch] = useState<string>('')

  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => students[0]?.id ?? 'std-1')
  const [selectedMonthId, setSelectedMonthId] = useState<string>('2026-06')
  const [editPresent, setEditPresent] = useState<number>(0)
  const [editAbsent, setEditAbsent] = useState<number>(0)
  const [editLeave, setEditLeave] = useState<number>(0)
  const [editAbsentReason, setEditAbsentReason] = useState<string>(ABSENT_REASONS[0])
  const [editLeaveReason, setEditLeaveReason] = useState<string>(ATTENDANCE_LEAVE_REASONS[0])
  const [attendanceSavedToast, setAttendanceSavedToast] = useState<string | null>(null)

  // Leave Action Form (Campus-wide)
  const [leaveStudentId, setLeaveStudentId] = useState<string>(() => students[0]?.id ?? 'std-1')
  const [leaveActionType, setLeaveActionType] = useState<'application' | 'return'>('application')
  const [leaveReason, setLeaveReason] = useState<string>(leaveReasons[0])
  const [leaveDetails, setLeaveDetails] = useState<string>('')
  const [leaveSavedToast, setLeaveSavedToast] = useState<string | null>(null)

  // Parent Report Modal State
  const [pdfReportStudent, setPdfReportStudent] = useState<Student | null>(null)

  // Official Holiday & Notice Publisher State
  const [noticeTitle, setNoticeTitle] = useState('')
  const [noticeCategory, setNoticeCategory] = useState<Notice['category']>('Academic')
  const [noticePinned, setNoticePinned] = useState(true)
  const [noticeBody, setNoticeBody] = useState('')
  const [noticeTargetScope, setNoticeTargetScope] = useState<
    'all' | 'high-school' | 'bs-degree' | 'custom'
  >('all')
  const [noticeCustomBatches, setNoticeCustomBatches] = useState<string[]>(() => [
    ALL_ACADEMY_CLASS_NAMES[0],
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
  const [holidayAnnouncedBy, setHolidayAnnouncedBy] = useState(
    `${principal.name} • Principal`,
  )
  const [noticeToast, setNoticeToast] = useState<string | null>(null)

  // Digital Library Uploader State
  const [localKitabUploads, setLocalKitabUploads] = useState<DigitalKitabItem[]>([])
  const [kitabTitle, setKitabTitle] = useState('')
  const [kitabArabicTitle, setKitabArabicTitle] = useState('')
  const [kitabAuthor, setKitabAuthor] = useState('')
  const [kitabCategory, setKitabCategory] = useState<KitabCategory>('fiqh')
  const [kitabBatchLabel, setKitabBatchLabel] = useState(
    CLASS_USTHADS[0]?.fullClassLabel ?? 'Class 8th',
  )
  const [kitabPages, setKitabPages] = useState('180')
  const [kitabLanguage, setKitabLanguage] = useState('Arabic & Malayalam')
  const [kitabSummary, setKitabSummary] = useState('')
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null)
  const [uploadingKitab, setUploadingKitab] = useState(false)
  const [kitabStatusMsg, setKitabStatusMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ==================== PRINCIPAL ADMIN MANAGEMENT STATES ====================
  // 1. Student Add / Edit / Remove State
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null)
  const [studentFormClass, setStudentFormClass] = useState<string>('8th')
  const [studentFormName, setStudentFormName] = useState<string>('')
  const [studentFormAdmissionNo, setStudentFormAdmissionNo] = useState<string>(() =>
    getNextSuggestedAdmissionNo('8th'),
  )
  const [confirmRemoveStudentId, setConfirmRemoveStudentId] = useState<string | null>(null)
  const [studentAdminToast, setStudentAdminToast] = useState<string | null>(null)

  // 2. Class Usthad Assignment & Usthad Profile Editor State
  const [assignUsthadClass, setAssignUsthadClass] = useState<string>('BS 3')
  const [assignUsthadStaffId, setAssignUsthadStaffId] = useState<string>(() => {
    const found = CLASS_USTHADS.find((u) => u.className === 'BS 3')
    return found?.staffId ?? 'UST-07'
  })
  const [usthadAssignToast, setUsthadAssignToast] = useState<string | null>(null)

  const [editingUsthadId, setEditingUsthadId] = useState<string>(() => OFFICIAL_CLASS_USTHADS[0]?.id ?? 'usthad-07')
  const [usthadFormName, setUsthadFormName] = useState<string>(() => OFFICIAL_CLASS_USTHADS[0]?.name ?? '')
  const [usthadFormStaffId, setUsthadFormStaffId] = useState<string>(() => OFFICIAL_CLASS_USTHADS[0]?.staffId ?? 'UST-07')
  const [usthadFormDesignation, setUsthadFormDesignation] = useState<string>(() => OFFICIAL_CLASS_USTHADS[0]?.designation ?? 'Class Usthad')
  const [usthadFormSpec, setUsthadFormSpec] = useState<string>(() => OFFICIAL_CLASS_USTHADS[0]?.specialization ?? '')
  const [usthadProfileToast, setUsthadProfileToast] = useState<string | null>(null)

  // 3. Class Leader Assignment State
  const [leaderEditClass, setLeaderEditClass] = useState<string>('8th')
  const [leaderMainStudentId, setLeaderMainStudentId] = useState<string>(() => {
    const leaders = getClassLeadersForClass('8th')
    return leaders[0]?.studentId ?? students[0]?.id ?? 'std-1'
  })
  const [leaderAssistantStudentId, setLeaderAssistantStudentId] = useState<string>(() => {
    const leaders = getClassLeadersForClass('8th')
    return leaders[1]?.studentId ?? leaders[0]?.studentId ?? students[1]?.id ?? 'std-2'
  })
  const [leaderAdminToast, setLeaderAdminToast] = useState<string | null>(null)

  // 4. Timetable & Subjects Editor State
  const [ttEditClass, setTtEditClass] = useState<string>('BS 3')
  const [ttEditSemesterTab, setTtEditSemesterTab] = useState<1 | 2>(() => getActiveSemester())
  const [ttDraft, setTtDraft] = useState<ClassSemesterTimetable>(() =>
    JSON.parse(JSON.stringify(getClassSemesterTimetableByClassName('BS 3'))),
  )
  const [ttAdminToast, setTtAdminToast] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setFirebaseUser(user)
      } else {
        signInAnonymously(auth).catch(() => {
          // Fallback to local state
        })
      }
    })
    return () => unsubscribe()
  }, [])

  const refreshAllCampusData = useCallback(() => {
    setPeriodSubmissions(loadPeriodAttendanceSubmissions())
    setAttendanceOverrides(loadAttendanceOverrides())
    setCustomNotices(loadCustomNotices())
    setConfigVersion((v) => v + 1)

    const nextLeaveMap: Record<string, SavedLeaveEntry[]> = {}
    for (const st of students) {
      const entries = loadStudentLeaveEntriesFromStorage(st.id)
      nextLeaveMap[st.id] = entries.sort((a, b) => b.createdAtMs - a.createdAtMs)
    }
    setCampusLeaveMap(nextLeaveMap)

    try {
      const savedKitabs = window.localStorage.getItem(LOCAL_UPLOADS_STORAGE_KEY)
      if (savedKitabs) {
        const parsed = JSON.parse(savedKitabs) as DigitalKitabItem[]
        if (Array.isArray(parsed)) setLocalKitabUploads(parsed)
      }
    } catch {
      // Ignore storage errors
    }
  }, [])

  useEffect(() => {
    refreshAllCampusData()
    window.addEventListener('ics-period-attendance-updated', refreshAllCampusData)
    window.addEventListener('ics-attendance-updated', refreshAllCampusData)
    window.addEventListener('ics-notices-updated', refreshAllCampusData)
    window.addEventListener('ics-academy-config-updated', refreshAllCampusData)
    window.addEventListener('storage', refreshAllCampusData)
    return () => {
      window.removeEventListener('ics-period-attendance-updated', refreshAllCampusData)
      window.removeEventListener('ics-attendance-updated', refreshAllCampusData)
      window.removeEventListener('ics-notices-updated', refreshAllCampusData)
      window.removeEventListener('ics-academy-config-updated', refreshAllCampusData)
      window.removeEventListener('storage', refreshAllCampusData)
    }
  }, [refreshAllCampusData])

  // Sync Class Leader form selectors when leaderEditClass changes
  useEffect(() => {
    const clsLeaders = getClassLeadersForClass(leaderEditClass)
    const clsStudents = students.filter((s) => s.className === leaderEditClass)
    setLeaderMainStudentId(clsLeaders[0]?.studentId ?? clsStudents[0]?.id ?? '')
    setLeaderAssistantStudentId(
      clsLeaders[1]?.studentId ?? clsStudents[1]?.id ?? clsStudents[0]?.id ?? '',
    )
  }, [leaderEditClass, configVersion])

  // Sync Class Usthad selector when assignUsthadClass changes
  useEffect(() => {
    const cu = CLASS_USTHADS.find((u) => u.className === assignUsthadClass)
    if (cu) setAssignUsthadStaffId(cu.staffId)
  }, [assignUsthadClass, configVersion])

  // Sync Usthad Profile Editor fields when editingUsthadId changes
  useEffect(() => {
    if (editingUsthadId === 'NEW') {
      setUsthadFormName('')
      setUsthadFormStaffId(`UST-${String(OFFICIAL_CLASS_USTHADS.length + 15).padStart(2, '0')}`)
      setUsthadFormDesignation('Class Usthad')
      setUsthadFormSpec('')
      return
    }
    const found = OFFICIAL_CLASS_USTHADS.find((u) => u.id === editingUsthadId)
    if (found) {
      setUsthadFormName(found.name)
      setUsthadFormStaffId(found.staffId)
      setUsthadFormDesignation(found.designation)
      setUsthadFormSpec(found.specialization)
    }
  }, [editingUsthadId, configVersion])

  // Sync Timetable draft when ttEditClass changes
  useEffect(() => {
    setTtDraft(
      JSON.parse(JSON.stringify(getClassSemesterTimetableByClassName(ttEditClass))),
    )
  }, [ttEditClass, configVersion])

  // Enrich all students across all 11 batches
  const enrichedCampusStudents = useMemo(() => {
    return students.map((st) => {
      const effective = getEffectiveStudentAttendance(st, attendanceOverrides, customNotices)
      const totalDays = effective.attendance.workingDays
      const overallRate =
        totalDays > 0 ? Math.round((effective.attendance.present / totalDays) * 1000) / 10 : 0
      const leaveEntries = campusLeaveMap[st.id] ?? []
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
  }, [attendanceOverrides, customNotices, campusLeaveMap, configVersion])

  // Selected class students & representative leader for ClassLeaderAttendanceCard
  const selectedClassUsthad = useMemo(
    () =>
      CLASS_USTHADS.find((u) => u.className === selectedClassName) ?? CLASS_USTHADS[0],
    [selectedClassName, configVersion],
  )

  const selectedClassStudents = useMemo(
    () => students.filter((s) => s.className === selectedClassName),
    [selectedClassName, configVersion],
  )

  const selectedClassRepresentativeStudent = useMemo(
    () => selectedClassStudents[0] ?? students[0],
    [selectedClassStudents, configVersion],
  )

  // Selected student for Monthly Attendance Editor
  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) ?? selectedClassStudents[0] ?? students[0],
    [selectedStudentId, selectedClassStudents, configVersion],
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

  useEffect(() => {
    if (selectedMonthRecord && selectedStudent) {
      setEditPresent(selectedMonthRecord.present)
      setEditAbsent(selectedMonthRecord.absent)
      setEditLeave(selectedMonthRecord.leave)
      const existingOverride =
        attendanceOverrides[`${selectedStudent.id}__${selectedMonthRecord.id}`]
      setEditAbsentReason(existingOverride?.absentReason ?? ABSENT_REASONS[0])
      setEditLeaveReason(existingOverride?.leaveReason ?? ATTENDANCE_LEAVE_REASONS[0])
    }
  }, [selectedMonthRecord, selectedStudent, attendanceOverrides])

  // Build 11-Class Matrix for `selectedDate`
  const classMatrixRows = useMemo(() => {
    const activeSemester = getActiveSemester()
    return CLASS_USTHADS.map((usthad) => {
      const batchStudents = enrichedCampusStudents.filter(
        (item) => item.student.className === usthad.className,
      )
      const repStudent = batchStudents[0]?.student ?? students[0]
      const timetable = getClassSemesterTimetable(repStudent)
      const semesterSlots =
        activeSemester === 1 ? timetable.semester1 : timetable.semester2
      const leaders = getClassLeadersForClass(usthad.className)

      const avgAttendance =
        batchStudents.length > 0
          ? Math.round(
              (batchStudents.reduce((acc, s) => acc + s.overallRate, 0) /
                batchStudents.length) *
                10,
            ) / 10
          : 0

      const onLeaveCount = batchStudents.filter((s) => s.isOnLeave).length
      const inCampusCount = batchStudents.length - onLeaveCount

      const periodCells = timetable.periods.map((p, idx) => {
        const periodIndex = idx + 1
        const slot = semesterSlots[idx] ?? {
          subject: 'General Study',
          teacher: usthad.shortName,
        }
        const isNonTeaching = isNonTeachingTimetableSlot(slot)
        const subKey = `${selectedDate}__${usthad.className}__${periodIndex}`
        const sub = !isNonTeaching ? periodSubmissions[subKey] : undefined
        const state: 'conducted' | 'not-held' | 'substituted' | 'pending' | 'break' =
          isNonTeaching
            ? 'break'
            : sub
              ? (sub.sessionStatus ?? 'conducted')
              : 'pending'

        return {
          periodIndex,
          label: p.label,
          time: p.time,
          subject: slot.subject,
          regularTeacher: slot.teacher,
          isNonTeaching,
          submission: sub,
          state,
        }
      })

      const conductedCount = periodCells.filter((c) => c.state === 'conducted').length
      const notHeldCount = periodCells.filter((c) => c.state === 'not-held').length
      const substitutedCount = periodCells.filter((c) => c.state === 'substituted').length
      const teachingPeriodsCount = periodCells.filter((c) => !c.isNonTeaching).length

      return {
        usthad,
        className: usthad.className,
        fullClassLabel: usthad.fullClassLabel,
        leaders,
        totalStudents: batchStudents.length,
        inCampusCount,
        onLeaveCount,
        avgAttendance,
        periodCells,
        teachingPeriodsCount,
        conductedCount,
        notHeldCount,
        substitutedCount,
      }
    })
  }, [enrichedCampusStudents, selectedDate, periodSubmissions, configVersion])

  // Campus-Wide Telemetry KPIs
  const campusMetrics = useMemo(() => {
    const totalStudents = enrichedCampusStudents.length
    const onLeaveNow = enrichedCampusStudents.filter((s) => s.isOnLeave).length
    const avgRate =
      totalStudents > 0
        ? Math.round(
            (enrichedCampusStudents.reduce((acc, s) => acc + s.overallRate, 0) /
              totalStudents) *
              10,
          ) / 10
        : 0

    let periodsConducted = 0
    let periodsNotHeld = 0
    let periodsSubstituted = 0
    let totalDailyPeriods = 0

    for (const row of classMatrixRows) {
      periodsConducted += row.conductedCount
      periodsNotHeld += row.notHeldCount
      periodsSubstituted += row.substitutedCount
      totalDailyPeriods += row.teachingPeriodsCount
    }

    return {
      totalBatches: CLASS_USTHADS.length,
      totalStudents,
      inCampusNow: totalStudents - onLeaveNow,
      onLeaveNow,
      avgRate,
      periodsConducted,
      periodsNotHeld,
      periodsSubstituted,
      totalDailyPeriods,
    }
  }, [enrichedCampusStudents, classMatrixRows])

  // All Unheld & Substituted Periods across the campus on `selectedDate`
  const unheldAndSubstitutedPeriods = useMemo(() => {
    const items: {
      row: (typeof classMatrixRows)[number]
      cell: (typeof classMatrixRows)[number]['periodCells'][number]
    }[] = []
    for (const row of classMatrixRows) {
      for (const cell of row.periodCells) {
        if (!cell.isNonTeaching && (cell.state === 'not-held' || cell.state === 'substituted')) {
          items.push({ row, cell })
        }
      }
    }
    return items
  }, [classMatrixRows])

  // Filtered students for Campus Directory
  const filteredDirectoryStudents = useMemo(() => {
    const q = directorySearch.trim().toLowerCase()
    return enrichedCampusStudents.filter((item) => {
      if (directoryClassFilter !== 'ALL' && item.student.className !== directoryClassFilter) {
        return false
      }
      if (directoryStatusFilter === 'academy' && item.isOnLeave) return false
      if (directoryStatusFilter === 'leave' && !item.isOnLeave) return false
      if (!q) return true
      return (
        item.student.name.toLowerCase().includes(q) ||
        item.student.admissionNo.toLowerCase().includes(q) ||
        item.student.className.toLowerCase().includes(q)
      )
    })
  }, [
    enrichedCampusStudents,
    directoryClassFilter,
    directoryStatusFilter,
    directorySearch,
  ])

  // Dirty-state checks for Principal Save buttons (prevent duplicate saves & sounds)
  const quickOverrideStatus = useMemo(() => {
    const subKey = `${selectedDate}__${quickClassName}__${quickPeriodIndex}`
    const existing = periodSubmissions[subKey]
    const isNotHeldUnchanged =
      existing?.sessionStatus === 'not-held' &&
      (existing.notHeldReason ?? NOT_HELD_REASONS[0]) === quickNotHeldReason
    const resolvedSubUsthad =
      OFFICIAL_CLASS_USTHADS.find((u) => u.id === quickSubstituteUsthadId) ??
      OFFICIAL_CLASS_USTHADS.find((u) => u.className !== quickClassName) ??
      OFFICIAL_CLASS_USTHADS[0]
    const isSubstitutedUnchanged =
      existing?.sessionStatus === 'substituted' &&
      existing.substituteUsthad?.usthadId === resolvedSubUsthad?.id &&
      (existing.notHeldReason ?? NOT_HELD_REASONS[0]) === quickNotHeldReason
    return { isNotHeldUnchanged, isSubstitutedUnchanged }
  }, [
    selectedDate,
    quickClassName,
    quickPeriodIndex,
    quickNotHeldReason,
    quickSubstituteUsthadId,
    periodSubmissions,
    configVersion,
  ])

  const isClassUsthadChanged = useMemo(() => {
    const currentSlot = CLASS_USTHADS.find((u) => u.className === assignUsthadClass)
    if (!currentSlot) return true
    return currentSlot.staffId.toUpperCase() !== assignUsthadStaffId.trim().toUpperCase()
  }, [assignUsthadClass, assignUsthadStaffId, configVersion])

  const isUsthadProfileChanged = useMemo(() => {
    const cleanName = usthadFormName.trim()
    const cleanStaff = usthadFormStaffId.trim().toUpperCase()
    const cleanDesig = usthadFormDesignation.trim() || 'Class Usthad'
    const cleanSpec = usthadFormSpec.trim() || 'Islamic & Academic Studies'
    if (!cleanName || !cleanStaff) return false
    if (editingUsthadId === 'NEW') return true
    const current = OFFICIAL_CLASS_USTHADS.find((u) => u.id === editingUsthadId)
    if (!current) return true
    return (
      current.name !== cleanName ||
      current.staffId.toUpperCase() !== cleanStaff ||
      current.designation !== cleanDesig ||
      current.specialization !== cleanSpec
    )
  }, [
    editingUsthadId,
    usthadFormName,
    usthadFormStaffId,
    usthadFormDesignation,
    usthadFormSpec,
    configVersion,
  ])

  const isClassLeadersChanged = useMemo(() => {
    if (!leaderMainStudentId || !leaderAssistantStudentId) return false
    const currentLeaders = getClassLeadersForClass(leaderEditClass)
    return (
      currentLeaders[0]?.studentId !== leaderMainStudentId ||
      currentLeaders[1]?.studentId !== leaderAssistantStudentId
    )
  }, [leaderEditClass, leaderMainStudentId, leaderAssistantStudentId, configVersion])

  const isStudentFormValidAndChanged = useMemo(() => {
    const cleanName = studentFormName.trim()
    const cleanAdm = studentFormAdmissionNo.trim().toUpperCase()
    if (!cleanName || !cleanAdm) return false
    if (!editingStudentId) return true
    const existing = students.find((s) => s.id === editingStudentId)
    if (!existing) return true
    return (
      existing.name !== cleanName ||
      existing.admissionNo.toUpperCase() !== cleanAdm ||
      existing.className !== studentFormClass
    )
  }, [
    editingStudentId,
    studentFormName,
    studentFormAdmissionNo,
    studentFormClass,
    configVersion,
  ])

  const isPrincipalMonthAttendanceDirty = useMemo(() => {
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

  const isPrincipalLeaveActionDuplicate = useMemo(() => {
    const targetItem = enrichedCampusStudents.find(
      (item) => item.student.id === leaveStudentId,
    )
    if (!targetItem) return true
    if (leaveActionType === 'return') {
      return !targetItem.isOnLeave
    }
    if (targetItem.isOnLeave && targetItem.activeLeaveEntry) {
      const expectedReason = `${leaveReason} (Approved by Principal)`
      if (
        targetItem.activeLeaveEntry.reason === expectedReason &&
        (targetItem.activeLeaveEntry.details || '') === leaveDetails.trim()
      ) {
        return true
      }
    }
    return false
  }, [enrichedCampusStudents, leaveStudentId, leaveActionType, leaveReason, leaveDetails])

  const isTimetableDirty = useMemo(() => {
    const saved = getClassSemesterTimetableByClassName(ttEditClass)
    return JSON.stringify(ttDraft) !== JSON.stringify(saved)
  }, [ttDraft, ttEditClass, configVersion])

  const isTimetableAtDefault = useMemo(() => {
    const def = getDefaultClassTimetable(ttEditClass)
    return JSON.stringify(ttDraft) === JSON.stringify(def)
  }, [ttDraft, ttEditClass])

  // Quick Mark Period as Not Held or Substituted from Principal Command Bar
  function handlePrincipalQuickPeriodAction(mode: 'not-held' | 'substituted' | 'conducted') {
    const targetRow =
      classMatrixRows.find((r) => r.className === quickClassName) ?? classMatrixRows[0]
    if (!targetRow) return
    const targetCell =
      targetRow.periodCells.find((p) => p.periodIndex === quickPeriodIndex) ??
      targetRow.periodCells[0]
    if (!targetCell) return

    const subKey = `${selectedDate}__${targetRow.className}__${targetCell.periodIndex}`
    const existing = periodSubmissions[subKey]
    const nowIso = new Date().toISOString()
    const batchStudents = students.filter((s) => s.className === targetRow.className)

    if (mode === 'not-held') {
      const newSub: PeriodAttendanceSubmission = {
        key: subKey,
        date: selectedDate,
        className: targetRow.className,
        periodIndex: targetCell.periodIndex,
        periodLabel: targetCell.label,
        periodTime: targetCell.time,
        subject: targetCell.subject,
        teacher: targetCell.regularTeacher,
        submittedByLeaderId: existing?.submittedByLeaderId ?? principal.staffId,
        submittedByName: existing?.submittedByName ?? principal.name,
        submittedByRole: existing?.submittedByRole ?? 'Principal',
        submittedAt: existing?.submittedAt ?? nowIso,
        ...(existing
          ? {
              lastEditedByName: principal.name,
              lastEditedByRole: 'Principal',
              lastEditedById: principal.staffId,
              lastEditedAt: nowIso,
              editCount: (existing.editCount ?? 0) + 1,
            }
          : { editCount: 0 }),
        records: {},
        reasons: {},
        sessionStatus: 'not-held',
        notHeldReason: quickNotHeldReason,
        markedNotHeldBy: `Principal • ${principal.shortName}`,
      }
      const nextMap = { ...periodSubmissions, [subKey]: newSub }
      setPeriodSubmissions(nextMap)
      savePeriodAttendanceSubmissions(nextMap)
      setSessionActionToast(
        `${targetRow.className} • ${targetCell.label} (${targetCell.subject}) marked as "Class Not Held". Student attendance is locked.`,
      )
      window.setTimeout(() => setSessionActionToast(null), 5000)
      return
    }

    if (mode === 'substituted') {
      const subUsthad =
        OFFICIAL_CLASS_USTHADS.find((u) => u.id === quickSubstituteUsthadId) ??
        OFFICIAL_CLASS_USTHADS.find((u) => u.className !== targetRow.className) ??
        OFFICIAL_CLASS_USTHADS[0]

      const defaultRecords: Record<string, 'present' | 'absent' | 'leave'> = {}
      for (const st of batchStudents) {
        const leaveEntries = campusLeaveMap[st.id] ?? []
        const isLeave = leaveEntries[0]?.recordType === 'application'
        defaultRecords[st.id] = isLeave ? 'leave' : 'present'
      }

      const newSub: PeriodAttendanceSubmission = {
        key: subKey,
        date: selectedDate,
        className: targetRow.className,
        periodIndex: targetCell.periodIndex,
        periodLabel: targetCell.label,
        periodTime: targetCell.time,
        subject: targetCell.subject,
        teacher: `${subUsthad.shortName} (Substitute for ${targetCell.regularTeacher})`,
        submittedByLeaderId: existing?.submittedByLeaderId ?? principal.staffId,
        submittedByName: existing?.submittedByName ?? principal.name,
        submittedByRole: existing?.submittedByRole ?? 'Principal',
        submittedAt: existing?.submittedAt ?? nowIso,
        ...(existing
          ? {
              lastEditedByName: principal.name,
              lastEditedByRole: 'Principal',
              lastEditedById: principal.staffId,
              lastEditedAt: nowIso,
              editCount: (existing.editCount ?? 0) + 1,
            }
          : { editCount: 0 }),
        records:
          existing?.records && Object.keys(existing.records).length > 0
            ? existing.records
            : defaultRecords,
        reasons: existing?.reasons ?? {},
        sessionStatus: 'substituted',
        notHeldReason: quickNotHeldReason,
        markedNotHeldBy:
          existing?.markedNotHeldBy ?? `Principal • ${principal.shortName}`,
        substituteUsthad: {
          usthadId: subUsthad.id,
          usthadName: subUsthad.name,
          assignedBy: `Principal (${principal.shortName})`,
          assignedAt: nowIso,
        },
      }
      const nextMap = { ...periodSubmissions, [subKey]: newSub }
      setPeriodSubmissions(nextMap)
      savePeriodAttendanceSubmissions(nextMap)
      setSessionActionToast(
        `Assigned ${subUsthad.name} as Substitute Usthad for ${targetRow.className} • ${targetCell.label}. Attendance unlocked.`,
      )
      window.setTimeout(() => setSessionActionToast(null), 5000)
      return
    }
  }

  function handleAssignSubstituteToUnheldPeriod(
    className: string,
    periodIndex: number,
    usthadId: string,
  ) {
    const targetRow = classMatrixRows.find((r) => r.className === className)
    const targetCell = targetRow?.periodCells.find((c) => c.periodIndex === periodIndex)
    if (!targetRow || !targetCell) return

    const subKey = `${selectedDate}__${className}__${periodIndex}`
    const existing = periodSubmissions[subKey]
    const subUsthad =
      OFFICIAL_CLASS_USTHADS.find((u) => u.id === usthadId) ??
      OFFICIAL_CLASS_USTHADS.find((u) => u.className !== className) ??
      OFFICIAL_CLASS_USTHADS[0]

    const batchStudents = students.filter((s) => s.className === className)
    const defaultRecords: Record<string, 'present' | 'absent' | 'leave'> = {}
    for (const st of batchStudents) {
      const leaveEntries = campusLeaveMap[st.id] ?? []
      const isLeave = leaveEntries[0]?.recordType === 'application'
      defaultRecords[st.id] = isLeave ? 'leave' : 'present'
    }

    const nowIso = new Date().toISOString()
    const updatedSub: PeriodAttendanceSubmission = {
      key: subKey,
      date: selectedDate,
      className,
      periodIndex,
      periodLabel: targetCell.label,
      periodTime: targetCell.time,
      subject: targetCell.subject,
      teacher: `${subUsthad.shortName} (Substitute for ${targetCell.regularTeacher})`,
      submittedByLeaderId: existing?.submittedByLeaderId ?? principal.staffId,
      submittedByName: existing?.submittedByName ?? principal.name,
      submittedByRole: existing?.submittedByRole ?? 'Principal',
      submittedAt: existing?.submittedAt ?? nowIso,
      ...(existing
        ? {
            lastEditedByName: principal.name,
            lastEditedByRole: 'Principal',
            lastEditedById: principal.staffId,
            lastEditedAt: nowIso,
            editCount: (existing.editCount ?? 0) + 1,
          }
        : { editCount: 0 }),
      records:
        existing?.records && Object.keys(existing.records).length > 0
          ? existing.records
          : defaultRecords,
      reasons: existing?.reasons ?? {},
      sessionStatus: 'substituted',
      notHeldReason: existing?.notHeldReason ?? NOT_HELD_REASONS[0],
      markedNotHeldBy: existing?.markedNotHeldBy ?? `Principal • ${principal.shortName}`,
      substituteUsthad: {
        usthadId: subUsthad.id,
        usthadName: subUsthad.name,
        assignedBy: `Principal (${principal.shortName})`,
        assignedAt: nowIso,
      },
    }

    const nextMap = { ...periodSubmissions, [subKey]: updatedSub }
    setPeriodSubmissions(nextMap)
    savePeriodAttendanceSubmissions(nextMap)
    setSessionActionToast(
      `Assigned ${subUsthad.name} as Substitute Usthad for ${className} • ${targetCell.label}. Student attendance unlocked.`,
    )
    window.setTimeout(() => setSessionActionToast(null), 5000)
  }

  function handleRestoreNormalPeriod(className: string, periodIndex: number) {
    const targetRow = classMatrixRows.find((r) => r.className === className)
    const targetCell = targetRow?.periodCells.find((c) => c.periodIndex === periodIndex)
    if (!targetRow || !targetCell) return

    const subKey = `${selectedDate}__${className}__${periodIndex}`
    const existing = periodSubmissions[subKey]
    const batchStudents = students.filter((s) => s.className === className)
    const defaultRecords: Record<string, 'present' | 'absent' | 'leave'> = {}
    for (const st of batchStudents) {
      const leaveEntries = campusLeaveMap[st.id] ?? []
      const isLeave = leaveEntries[0]?.recordType === 'application'
      defaultRecords[st.id] = isLeave ? 'leave' : 'present'
    }

    const nowIso = new Date().toISOString()
    const updatedSub: PeriodAttendanceSubmission = {
      key: subKey,
      date: selectedDate,
      className,
      periodIndex,
      periodLabel: targetCell.label,
      periodTime: targetCell.time,
      subject: targetCell.subject,
      teacher: targetCell.regularTeacher,
      submittedByLeaderId: existing?.submittedByLeaderId ?? principal.staffId,
      submittedByName: existing?.submittedByName ?? principal.name,
      submittedByRole: existing?.submittedByRole ?? 'Principal',
      submittedAt: existing?.submittedAt ?? nowIso,
      ...(existing
        ? {
            lastEditedByName: principal.name,
            lastEditedByRole: 'Principal',
            lastEditedById: principal.staffId,
            lastEditedAt: nowIso,
            editCount: (existing.editCount ?? 0) + 1,
          }
        : { editCount: 0 }),
      records: defaultRecords,
      reasons: {},
      sessionStatus: 'conducted',
    }

    const nextMap = { ...periodSubmissions, [subKey]: updatedSub }
    setPeriodSubmissions(nextMap)
    savePeriodAttendanceSubmissions(nextMap)
    setSessionActionToast(
      `${className} • ${targetCell.label} restored to normal status (Conducted).`,
    )
    window.setTimeout(() => setSessionActionToast(null), 4000)
  }

  function handleSaveMonthAttendance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedStudent || !selectedMonthRecord || !isPrincipalMonthAttendanceDirty) return

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
    setAttendanceSavedToast(
      `Updated ${selectedMonthRecord.month} ${selectedMonthRecord.year} attendance for ${selectedStudent.name} (${selectedStudent.className}).`,
    )
    window.setTimeout(() => setAttendanceSavedToast(null), 4000)
  }

  async function recordPrincipalLeaveOrReturn(
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
      reason:
        recordType === 'return'
          ? 'Campus Return (Verified by Principal)'
          : `${reasonText} (Approved by Principal)`,
      details: detailsText,
      status: 'recorded',
      createdAtMs: Date.now(),
      syncedToCloud: true,
    }

    const existing = loadStudentLeaveEntriesFromStorage(targetStudent.id)
    const updated = [newEntry, ...existing]
    saveStudentLeaveEntriesToStorage(targetStudent.id, updated)
    refreshAllCampusData()

    publishCampusNotification({
      type: 'leave',
      title:
        recordType === 'return'
          ? `Campus Return Verified • ${targetStudent.name}`
          : `Leave Approved by Principal • ${targetStudent.name}`,
      message:
        recordType === 'return'
          ? `${targetStudent.name} (${targetStudent.className}) returned to campus on ${dateString} at ${timeString}.`
          : `${targetStudent.name} (${targetStudent.className}) leave recorded by Principal: ${reasonText} (${dateString}).`,
      targetStudentId: targetStudent.id,
      targetClass: targetStudent.className,
      actorName: principal.name,
      href: '#leave',
    })

    setLeaveSavedToast(
      recordType === 'return'
        ? `Recorded campus return for ${targetStudent.name} (${targetStudent.className}).`
        : `Recorded leave for ${targetStudent.name} (${targetStudent.className}) (${reasonText}).`,
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
    if (isPrincipalLeaveActionDuplicate) return
    const st = students.find((s) => s.id === leaveStudentId) ?? students[0]
    if (!st) return
    void recordPrincipalLeaveOrReturn(st, leaveActionType, leaveReason, leaveDetails.trim())
    setLeaveDetails('')
  }

  function getResolvedTargetClasses(): string[] | undefined {
    if (noticeTargetScope === 'all') return undefined
    if (noticeTargetScope === 'high-school') return [...HIGH_SCHOOL_CLASS_NAMES]
    if (noticeTargetScope === 'bs-degree') return [...BS_DEGREE_CLASS_NAMES]
    return noticeCustomBatches.length > 0
      ? [...noticeCustomBatches]
      : [ALL_ACADEMY_CLASS_NAMES[0]]
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
    const parsedDeduct = Math.max(
      0,
      Math.min(25, Number.parseInt(holidayDaysDeducted, 10) || 0),
    )
    const resolvedTargets = getResolvedTargetClasses()
    const targetSummary = formatTargetClassesBadge(resolvedTargets)

    const newNotice: Notice = {
      id: `nt-principal-${Date.now()}`,
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
              departureTime: holidayDepartureTime.trim() || '12:45 PM (Afternoon)',
              returnDate: holidayReturnDate.trim() || 'Monday Morning',
              returnTime: holidayReturnTime.trim() || '07:30 AM',
              holidayDaysDeducted: parsedDeduct,
              announcedBy:
                holidayAnnouncedBy.trim() || `${principal.name} (Principal • ADM-001)`,
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
        ? `Published official holiday notice "${cleanTitle}" for ${targetSummary} — deducted ${parsedDeduct} days from ${holidayMonthId} working days for those batches.`
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

    const primaryStudentId = sanitizeId(students[0]?.id ?? 'std-1')
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
      classBatch: kitabBatchLabel,
      language: kitabLanguage.trim() || 'Arabic & Malayalam',
      pages: parsedPages,
      storagePath: objectPath,
      pdfUrl: '',
      summary: cleanSummary,
      createdAtMs: Date.now(),
      isCustomUpload: true,
      syncedToCloud: Boolean(firebaseUser),
    }

    const pdfBlobToStore = attachedFile ?? buildKitabPdfBlob(newItem)
    void saveKitabPdfBlobLocally(kitabId, pdfBlobToStore)

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
    if (firebaseUser) {
      void withCloudTimeout(deleteDoc(doc(db, 'digitalKitabs', kitabId)), 3000).catch(() => {})
    }
  }

  function handleSignOut() {
    window.localStorage.removeItem('isAuthenticated')
    window.localStorage.removeItem('authRole')
    window.dispatchEvent(new Event('ics-logout'))
  }

  const principalNavItems: {
    id: 'monitor' | 'people' | 'chat' | 'notices' | 'library'
    label: string
    shortLabel: string
    icon: typeof Building2
  }[] = [
    {
      id: 'monitor',
      label: 'Monitor',
      shortLabel: 'Monitor',
      icon: Building2,
    },
    {
      id: 'people',
      label: 'Directory',
      shortLabel: 'Directory',
      icon: Users,
    },
    {
      id: 'chat',
      label: 'Chat',
      shortLabel: 'Chat',
      icon: MessageCircle,
    },
    {
      id: 'notices',
      label: 'Notices',
      shortLabel: 'Notices',
      icon: Megaphone,
    },
    {
      id: 'library',
      label: 'Library',
      shortLabel: 'Library',
      icon: Library,
    },
  ]

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
            topClassName="translate-y-[1px] text-lg font-bold text-foreground leading-none"
            bottomClassName="text-[10px] font-semibold text-[#0077CC] dark:text-[#0095F6] leading-none"
          />
        </Link>

        <nav aria-label="Principal Dashboard" className="flex flex-1 flex-col gap-1 p-4">
          <p className="px-3 pb-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Principal Command
          </p>
          {principalNavItems.map((item) => {
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'group flex items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 text-left text-sm transition-all duration-150 active:scale-[0.98]',
                  isActive
                    ? 'bg-[#0095F6]/15 font-semibold text-foreground dark:bg-[#141A1F]'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span className="flex items-center gap-3">
                  <item.icon
                    className={cn(
                      'size-4.5 transition-colors',
                      isActive ? 'text-[#0077CC] dark:text-[#0095F6]' : 'group-hover:text-[#0095F6]',
                    )}
                    strokeWidth={isActive ? 2.3 : 1.85}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </span>
                {item.id === 'monitor' && campusMetrics.periodsNotHeld > 0 && (
                  <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-red-500">
                    {campusMetrics.periodsNotHeld}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="p-4">
          <Link
            href="/"
            onClick={(event) => {
              event.preventDefault()
              handleSignOut()
            }}
            className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-red-500/12 hover:text-red-500"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Log out
          </Link>
        </div>
      </aside>

      {/* Top Sticky Header (Matches Student & Usthad Header with Profile Switcher) */}
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
              topClassName="translate-y-[1px] text-[15px] sm:text-lg font-bold text-foreground leading-none"
              bottomClassName="text-[8.5px] sm:text-[10px] font-semibold text-[#0077CC] dark:text-[#0095F6] leading-none"
            />
          </Link>

          <div className="hidden lg:block">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Principal Dashboard
            </p>
            <p className="text-sm font-medium text-foreground">
              Academic Year 2026–27 · All 11 Classes
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <AppUpdateButton />
            <ThemeToggle className="text-foreground/85 hover:text-foreground dark:text-white/90 dark:hover:text-white" />
            <PrincipalSwitcher principal={principal} />
          </div>
        </div>

        {/* Executive Section Switcher Bar (Desktop Only — Replaced by Bottom Navigation Bar on Phone/Tablet) */}
        <nav aria-label="Principal control sections" className="hidden border-t border-border/40 lg:block">
          <ul className="flex gap-1.5 overflow-x-auto px-3 py-2 md:px-8 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {principalNavItems.map((item) => (
              <li key={item.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all whitespace-nowrap shrink-0 active:scale-95',
                    activeTab === item.id
                      ? 'bg-[#0095F6] text-white font-semibold'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <item.icon className="size-3.5" aria-hidden="true" />
                  <span>{item.shortLabel}</span>
                  {item.id === 'monitor' && campusMetrics.periodsNotHeld > 0 && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                        activeTab === 'monitor'
                          ? 'bg-red-600 text-white'
                          : 'bg-red-500/20 text-red-500',
                      )}
                    >
                      {campusMetrics.periodsNotHeld} Not Held
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div
        className={cn(
          'max-lg:flex-1 max-lg:min-h-0 max-lg:w-full',
          activeTab === 'chat'
            ? 'max-lg:flex max-lg:flex-col max-lg:overflow-hidden'
            : 'max-lg:overflow-y-auto max-lg:overflow-x-hidden max-lg:overscroll-y-contain',
        )}
      >
        <CampusNotificationBar />

        <main
          className={cn(
            'mx-auto flex max-w-7xl flex-col lg:gap-6 lg:px-8 lg:py-10',
            activeTab === 'chat'
              ? 'max-lg:flex-1 max-lg:min-h-0 max-lg:w-full max-lg:max-w-none max-lg:gap-0 max-lg:p-0 max-lg:overflow-hidden'
              : 'gap-5 px-3.5 py-5 sm:gap-6 sm:px-5 sm:py-7 md:px-8 md:py-10',
          )}
        >
        {/* Executive Banner & 6 Live Campus Telemetry KPIs — Shown on Monitor Tab on Phone/Tablet, Always Shown on Desktop */}
        <section
          className={cn(
            'relative overflow-hidden rounded-2xl bg-card p-5 sm:p-6',
            activeTab === 'chat'
              ? 'hidden'
              : activeTab !== 'monitor' && 'hidden lg:block',
          )}
        >
          <div className="flex flex-col justify-between gap-4 border-b border-border/40 pb-5 lg:flex-row lg:items-center">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0095F6]/15 px-3 py-0.5 text-[11px] font-bold tracking-wider text-[#0077CC] uppercase dark:text-[#0095F6]">
                  <Award className="size-3.5" aria-hidden="true" />
                  Principal
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 px-3 py-0.5 text-[11px] font-bold tracking-wider text-indigo-600 uppercase dark:text-indigo-400">
                  <GraduationCap className="size-3.5" aria-hidden="true" />
                  {principal.assignedClassesLabel} ({principal.usthadStaffId})
                </span>
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  {selectedDate}
                </span>
              </div>
              <div className="flex items-center gap-3.5">
                {principal.avatarUrl && (
                  <ProfileInitialsAvatar
                    name={principal.name}
                    avatarUrl={principal.avatarUrl}
                    className="size-14 sm:size-16 shadow-md"
                  />
                )}
                <div>
                  <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {principal.name}
                  </h1>
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    ICS Academy Manhappatta
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-9 items-center gap-2 rounded-full bg-muted/70 px-3.5">
                <CalendarClock className="size-3.5 text-[#0095F6]" aria-hidden="true" />
                <label htmlFor="principal-global-date" className="sr-only">
                  Monitor Date
                </label>
                <input
                  id="principal-global-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value || getTodayDateString())}
                  className="bg-transparent text-xs font-semibold text-foreground tabular-nums outline-none"
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('ics-switch-role', {
                      detail: { role: 'usthad', usthadId: principal.usthadId },
                    }),
                  )
                }}
                className="rounded-full bg-[#0095F6] px-3.5 text-xs font-semibold text-white hover:bg-[#0077CC]"
              >
                <BookOpen className="mr-1.5 size-3.5" aria-hidden="true" />
                My Classes ({principal.assignedClassesLabel})
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setActiveTab('notices')
                  setIsHolidayNotice(true)
                }}
                className="rounded-full text-xs font-semibold"
              >
                <CalendarClock className="mr-1.5 size-3.5" aria-hidden="true" />
                Holiday
              </Button>
            </div>
          </div>

          {/* 6 High-Density Tabular KPI Strip */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-2xl bg-muted/45 p-3.5">
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Students
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
                {campusMetrics.totalStudents}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                {campusMetrics.totalBatches} Classes
              </p>
            </div>

            <div className="rounded-2xl bg-emerald-500/12 p-3.5">
              <p className="text-[11px] font-semibold tracking-wider text-emerald-700 uppercase dark:text-emerald-400">
                Attendance
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
                {campusMetrics.avgRate}%
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                {campusMetrics.inCampusNow} Present
              </p>
            </div>

            <div className="rounded-2xl bg-amber-500/12 p-3.5">
              <p className="text-[11px] font-semibold tracking-wider text-amber-700 uppercase dark:text-amber-300">
                On Leave
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-amber-700 tabular-nums dark:text-amber-300">
                {campusMetrics.onLeaveNow}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Leave List
              </p>
            </div>

            <div className="rounded-2xl bg-muted/45 p-3.5">
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Periods
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
                {campusMetrics.periodsConducted}/{campusMetrics.totalDailyPeriods}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                {selectedDate}
              </p>
            </div>

            <div
              className={cn(
                'rounded-2xl p-3.5',
                campusMetrics.periodsNotHeld > 0
                  ? 'bg-red-500/15'
                  : 'bg-muted/45',
              )}
            >
              <p
                className={cn(
                  'text-[11px] font-semibold tracking-wider uppercase',
                  campusMetrics.periodsNotHeld > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-muted-foreground',
                )}
              >
                Not Held
              </p>
              <p
                className={cn(
                  'mt-1 font-display text-2xl font-bold tabular-nums',
                  campusMetrics.periodsNotHeld > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-foreground',
                )}
              >
                {campusMetrics.periodsNotHeld}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Missed
              </p>
            </div>

            <div className="rounded-2xl bg-[#0095F6]/12 p-3.5">
              <p className="text-[11px] font-semibold tracking-wider text-[#0077CC] uppercase dark:text-[#0095F6]">
                Substituted
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-[#0077CC] tabular-nums dark:text-[#0095F6]">
                {campusMetrics.periodsSubstituted}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Covered
              </p>
            </div>
          </div>
        </section>

        {/* ==================== TAB 1: CAMPUS LIVE MONITOR ==================== */}
        {activeTab === 'monitor' && (
          <div className="flex flex-col gap-6">
            {/* A. Unheld Periods & Substitute Usthad Control Center */}
            <Panel
              id="unheld-periods-monitor"
              eyebrow="Periods"
              title="Unheld Periods"
              icon={ShieldAlert}
              action={
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-600 dark:text-red-400 tabular-nums">
                  <Ban className="size-3.5" aria-hidden="true" />
                  {campusMetrics.periodsNotHeld} Unheld · {campusMetrics.periodsSubstituted} Sub
                </span>
              }
            >
              <div className="flex flex-col gap-5">
                {/* Principal Quick Action Bar to Record Class Not Held or Assign Substitute */}
                <div className="rounded-2xl bg-muted/45 p-4">
                  <div className="mb-3 flex flex-col gap-1">
                    <h3 className="text-xs font-bold tracking-wider text-foreground uppercase">
                      Period Override
                    </h3>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="quick-class-select" className="text-xs">
                        Select Class
                      </Label>
                      <ThemeSelect
                        id="quick-class-select"
                        value={quickClassName}
                        onChange={(e) => setQuickClassName(e.target.value)}
                        className="h-10 rounded-xl bg-popover px-3 text-xs font-semibold text-foreground outline-none"
                      >
                        {CLASS_USTHADS.map((u) => (
                          <option key={u.className} value={u.className}>
                            {u.className} ({u.shortName})
                          </option>
                        ))}
                      </ThemeSelect>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="quick-period-select" className="text-xs">
                        Select Period (1–{getClassSemesterTimetableByClassName(quickClassName).periods.length})
                      </Label>
                      <ThemeSelect
                        id="quick-period-select"
                        value={quickPeriodIndex}
                        onChange={(e) => setQuickPeriodIndex(Number(e.target.value))}
                        className="h-10 rounded-xl bg-popover px-3 text-xs font-semibold text-foreground outline-none"
                      >
                        {getClassSemesterTimetableByClassName(quickClassName).periods.map(
                          (pObj, idx) => {
                            const pIdx = idx + 1
                            return (
                              <option key={pIdx} value={pIdx}>
                                {pObj.label} ({pObj.time})
                              </option>
                            )
                          },
                        )}
                      </ThemeSelect>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="quick-reason-select" className="text-xs">
                        Reason
                      </Label>
                      <ThemeSelect
                        id="quick-reason-select"
                        value={quickNotHeldReason}
                        onChange={(e) => setQuickNotHeldReason(e.target.value)}
                        className="h-10 rounded-xl bg-popover px-3 text-xs font-semibold text-foreground outline-none"
                      >
                        {NOT_HELD_REASONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </ThemeSelect>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="quick-sub-select" className="text-xs">
                        Substitute Usthad (Optional)
                      </Label>
                      <ThemeSelect
                        id="quick-sub-select"
                        value={quickSubstituteUsthadId}
                        onChange={(e) => setQuickSubstituteUsthadId(e.target.value)}
                        className="h-10 rounded-xl bg-popover px-3 text-xs font-semibold text-foreground outline-none"
                      >
                        <option value="">-- Select Substitute Usthad --</option>
                        {OFFICIAL_CLASS_USTHADS.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.staffId})
                          </option>
                        ))}
                      </ThemeSelect>
                    </div>
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
                    {sessionActionToast ? (
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <Check className="size-4 shrink-0" aria-hidden="true" />
                        {sessionActionToast}
                      </p>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Selected Date: <strong className="text-foreground tabular-nums">{selectedDate}</strong>
                      </span>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={quickOverrideStatus.isNotHeldUnchanged}
                        onClick={() => handlePrincipalQuickPeriodAction('not-held')}
                        className="rounded-full bg-red-600 px-3.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        <Ban className="mr-1.5 size-3.5" aria-hidden="true" />
                        {quickOverrideStatus.isNotHeldUnchanged
                          ? 'Already Marked Not Held ✓'
                          : 'Mark Period as Class Not Held (Lock Attendance)'}
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        disabled={quickOverrideStatus.isSubstitutedUnchanged}
                        onClick={() => handlePrincipalQuickPeriodAction('substituted')}
                        className="rounded-full bg-[#0095F6]/15 px-3.5 text-xs font-semibold text-[#0077CC] hover:bg-[#0095F6] hover:text-white dark:text-[#0095F6] dark:hover:text-white disabled:opacity-50"
                      >
                        <UserCog className="mr-1.5 size-3.5" aria-hidden="true" />
                        {quickOverrideStatus.isSubstitutedUnchanged
                          ? 'Substitute Already Assigned ✓'
                          : 'Assign Substitute Usthad & Unlock'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Live Feed of Unheld & Substituted Periods */}
                {unheldAndSubstitutedPeriods.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-muted/40 px-6 py-8 text-center">
                    <CheckCircle2 className="size-8 text-emerald-500 dark:text-emerald-400" aria-hidden="true" />
                    <p className="text-sm font-semibold text-foreground">
                      No unheld periods (Class Not Held) reported for {selectedDate}.
                    </p>
                    <p className="max-w-xl text-xs text-muted-foreground">
                      If a regular Usthad does not take a class, the Class Leader, Usthad, or Principal can record it; the period will appear here in real time so a Substitute Usthad can be assigned.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {unheldAndSubstitutedPeriods.map(({ row, cell }) => {
                      const subKey = `${selectedDate}__${row.className}__${cell.periodIndex}`
                      const isNotHeld = cell.state === 'not-held'
                      const defaultSubUsthadId =
                        substituteSelectionMap[subKey] ||
                        cell.submission?.substituteUsthad?.usthadId ||
                        (CLASS_USTHADS.find((u) => u.className !== row.className)?.id ??
                          CLASS_USTHADS[0].id)

                      return (
                        <div
                          key={subKey}
                          className={cn(
                            'flex flex-col justify-between gap-3 rounded-2xl p-4',
                            isNotHeld ? 'bg-red-500/10' : 'bg-[#0095F6]/10',
                          )}
                        >
                          <div className="flex flex-col gap-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="rounded-full bg-foreground/10 px-2.5 py-0.5 text-xs font-bold text-foreground">
                                  {row.className}
                                </span>
                                <span className="text-xs font-bold text-[#0077CC] uppercase dark:text-[#0095F6]">
                                  {cell.label} ({cell.time})
                                </span>
                              </div>

                              {isNotHeld ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-0.5 text-[11px] font-bold text-red-600 dark:text-red-300">
                                  <Lock className="size-3" aria-hidden="true" />
                                  Class Not Held • Attendance Locked
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#0095F6]/20 px-2.5 py-0.5 text-[11px] font-bold text-[#0077CC] dark:text-[#0095F6]">
                                  <UserCog className="size-3" aria-hidden="true" />
                                  Substitute Usthad Assigned
                                </span>
                              )}
                            </div>

                            <h4 className="font-display text-base font-bold text-foreground">
                              {cell.subject}
                            </h4>

                            <p className="text-xs text-muted-foreground">
                              Regular Usthad: <strong className="text-foreground">{cell.regularTeacher}</strong> (
                              {row.usthad.name})
                            </p>

                            <div className="mt-1 rounded-xl bg-popover/90 p-2.5 text-xs">
                              <p className="font-semibold text-red-600 dark:text-red-400">
                                Reason: {cell.submission?.notHeldReason ?? NOT_HELD_REASONS[0]}
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                Reported by:{' '}
                                {cell.submission?.markedNotHeldBy ??
                                  cell.submission?.submittedByName ??
                                  'Class Leader / Usthad'}
                              </p>
                              {cell.submission?.substituteUsthad && (
                                <p className="mt-1 font-semibold text-[#0077CC] dark:text-[#0095F6]">
                                  Substitute Usthad: {cell.submission.substituteUsthad.usthadName} (Assigned by{' '}
                                  {cell.submission.substituteUsthad.assignedBy})
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 border-t border-border/35 pt-3 sm:flex-row sm:items-center sm:justify-between">
                            <ThemeSelect
                              aria-label={`Assign substitute Usthad for ${row.className} ${cell.label}`}
                              value={defaultSubUsthadId}
                              onChange={(e) =>
                                setSubstituteSelectionMap((prev) => ({
                                  ...prev,
                                  [subKey]: e.target.value,
                                }))
                              }
                              className="h-9 flex-1 rounded-xl bg-popover px-2.5 text-xs font-semibold text-foreground outline-none"
                            >
                              {OFFICIAL_CLASS_USTHADS.map((u) => (
                                <option key={u.id} value={u.id}>
                                  Sub: {u.name} ({u.staffId})
                                </option>
                              ))}
                            </ThemeSelect>

                            <div className="flex items-center gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                disabled={
                                  cell.state === 'substituted' &&
                                  cell.submission?.substituteUsthad?.usthadId === defaultSubUsthadId
                                }
                                onClick={() =>
                                  handleAssignSubstituteToUnheldPeriod(
                                    row.className,
                                    cell.periodIndex,
                                    defaultSubUsthadId,
                                  )
                                }
                                className="h-9 rounded-full bg-[#0095F6] px-3.5 text-xs font-semibold text-white hover:bg-[#0077CC] disabled:opacity-50 whitespace-nowrap"
                              >
                                <UserCog className="mr-1 size-3.5" aria-hidden="true" />
                                {cell.state === 'substituted' &&
                                cell.submission?.substituteUsthad?.usthadId === defaultSubUsthadId
                                  ? 'Assigned ✓'
                                  : 'Assign Substitute'}
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleRestoreNormalPeriod(row.className, cell.periodIndex)
                                }
                                className="h-9 rounded-full px-3 text-xs font-medium whitespace-nowrap"
                              >
                                Restore
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </Panel>

            {/* B. 11-Class Live Period & Attendance Matrix */}
            <Panel
              id="campus-class-matrix"
              eyebrow="Classes"
              title="All Classes"
              icon={Building2}
            >
              <div className="overflow-x-auto rounded-2xl bg-muted/40">
                <table className="w-full min-w-[920px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/50 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase whitespace-nowrap">
                      <th className="px-3.5 py-3 whitespace-nowrap">Class</th>
                      <th className="px-3.5 py-3 whitespace-nowrap">Class Usthad</th>
                      <th className="px-3.5 py-3 whitespace-nowrap">Class Leaders (CL & ACL)</th>
                      <th className="px-3 py-3 text-right whitespace-nowrap">Students</th>
                      <th className="px-3 py-3 text-right whitespace-nowrap">Avg Rate</th>
                      <th className="px-3.5 py-3 text-center whitespace-nowrap">
                        Periods Status ({selectedDate})
                      </th>
                      <th className="px-3.5 py-3 text-right whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/35">
                    {classMatrixRows.map((row) => {
                      const isSelected = row.className === selectedClassName
                      return (
                        <tr
                          key={row.className}
                          onClick={() => {
                            setSelectedClassName(row.className)
                            const firstSt = students.find((s) => s.className === row.className)
                            if (firstSt) setSelectedStudentId(firstSt.id)
                          }}
                          className={cn(
                            'cursor-pointer transition-colors hover:bg-muted/40',
                            isSelected && 'bg-[#0095F6]/[0.09]',
                          )}
                        >
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'size-2 shrink-0 rounded-full',
                                  row.notHeldCount > 0
                                    ? 'bg-red-500'
                                    : isSelected
                                      ? 'bg-[#0095F6]'
                                      : 'bg-emerald-500',
                                )}
                              />
                              <div>
                                <p className="font-display text-sm font-bold text-foreground whitespace-nowrap">
                                  {row.className}
                                </p>
                                <p className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                                  {row.inCampusCount} In Campus • {row.onLeaveCount} Leave
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <p className="font-semibold text-foreground whitespace-nowrap">{row.usthad.name}</p>
                            <p className="text-[11px] text-[#0077CC] dark:text-[#0095F6] tabular-nums whitespace-nowrap">
                              {row.usthad.staffId} • {row.usthad.specialization.split('&')[0]}
                            </p>
                          </td>

                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              {row.leaders.map((cl) => (
                                <span
                                  key={cl.leaderId}
                                  className="text-[11px] text-muted-foreground whitespace-nowrap"
                                >
                                  <strong className="text-[#0077CC] dark:text-[#0095F6]">{cl.leaderId}:</strong>{' '}
                                  {cl.studentName}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="px-3 py-3 text-right font-mono font-semibold text-foreground tabular-nums">
                            {row.totalStudents}
                          </td>

                          <td className="px-3 py-3 text-right font-mono font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                            {row.avgAttendance}%
                          </td>

                          <td className="px-3.5 py-3">
                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                              {row.periodCells.map((cell) => (
                                <span
                                  key={cell.periodIndex}
                                  title={`${cell.label}: ${cell.subject} (${cell.regularTeacher}) — ${cell.state.toUpperCase()}`}
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tabular-nums',
                                    cell.state === 'break'
                                      ? 'bg-muted/60 text-muted-foreground/80'
                                      : cell.state === 'conducted'
                                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                        : cell.state === 'not-held'
                                          ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                                          : cell.state === 'substituted'
                                            ? 'bg-[#0095F6]/20 text-[#0077CC] dark:text-[#0095F6]'
                                            : 'bg-popover text-muted-foreground',
                                  )}
                                >
                                  P{cell.periodIndex}
                                  {cell.state === 'break' &&
                                    (cell.subject.toLowerCase().includes('refreshment')
                                      ? ' Break'
                                      : ' Free')}
                                  {cell.state === 'conducted' && ' ✓'}
                                  {cell.state === 'not-held' && ' ✕'}
                                  {cell.state === 'substituted' && ' ⇄'}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="px-3.5 py-3 text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant={isSelected ? 'default' : 'outline'}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedClassName(row.className)
                                const firstSt = students.find((s) => s.className === row.className)
                                if (firstSt) setSelectedStudentId(firstSt.id)
                              }}
                              className="h-8 rounded-full px-3 text-xs font-semibold whitespace-nowrap"
                            >
                              {isSelected ? 'Inspecting Class' : 'Inspect & Control'}
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>

            {/* C. Deep Class Period Session & Student Attendance Control for Selected Class */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0095F6]/12 px-4 py-3.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="rounded-full bg-[#0095F6] px-3 py-1 text-xs font-bold text-white uppercase">
                    Selected Class Control
                  </span>
                  <h2 className="font-display text-lg font-bold text-foreground">
                    {selectedClassName} — Usthad: {selectedClassUsthad.name} ({selectedClassUsthad.staffId})
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor="switch-inspect-class" className="text-xs font-semibold">
                    Switch Class:
                  </Label>
                  <ThemeSelect
                    id="switch-inspect-class"
                    value={selectedClassName}
                    onChange={(e) => {
                      setSelectedClassName(e.target.value)
                      const firstSt = students.find((s) => s.className === e.target.value)
                      if (firstSt) setSelectedStudentId(firstSt.id)
                    }}
                    className="h-9 rounded-full bg-popover px-3.5 text-xs font-semibold text-foreground outline-none"
                  >
                    {CLASS_USTHADS.map((u) => (
                      <option key={u.className} value={u.className}>
                        {u.className} ({u.shortName})
                      </option>
                    ))}
                  </ThemeSelect>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setTtEditClass(selectedClassName)
                      setPeopleSubTab('timetable')
                      setActiveTab('people')
                    }}
                    className="h-9 rounded-full bg-[#0095F6]/15 px-3.5 text-xs font-semibold text-[#0077CC] hover:bg-[#0095F6] hover:text-white dark:text-[#0095F6] dark:hover:text-white"
                  >
                    <CalendarClock className="mr-1.5 size-3.5" aria-hidden="true" />
                    Edit Timetable
                  </Button>
                </div>
              </div>

              <ClassLeaderAttendanceCard
                leader={selectedClassRepresentativeStudent}
                leaderId={principal.staffId}
                eyebrowLabel={selectedClassName}
                submittedByNameOverride={`${principal.name} (Principal)`}
                highlightLeaderBadge={false}
                actorRoleLabel="Principal"
                controlledDate={selectedDate}
                onControlledDateChange={setSelectedDate}
              />
            </div>
          </div>
        )}

        {/* ==================== TAB 2: USTHADS, LEADERS, STUDENTS & TIMETABLES ==================== */}
        {activeTab === 'people' && (
          <div className="flex flex-col gap-6">
            {/* Sub-navigation between Teachers, Class Leaders, Students, and Timetable */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPeopleSubTab('usthads')}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-[0.98]',
                    peopleSubTab === 'usthads'
                      ? 'bg-[#0095F6] text-white'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <GraduationCap className="size-4" aria-hidden="true" />
                  Teachers ({OFFICIAL_CLASS_USTHADS.length})
                </button>

                <button
                  type="button"
                  onClick={() => setPeopleSubTab('leaders')}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-[0.98]',
                    peopleSubTab === 'leaders'
                      ? 'bg-[#0095F6] text-white'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <UserCheck className="size-4" aria-hidden="true" />
                  Class Leaders ({CLASS_LEADERS.length})
                </button>

                <button
                  type="button"
                  onClick={() => setPeopleSubTab('students')}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-[0.98]',
                    peopleSubTab === 'students'
                      ? 'bg-[#0095F6] text-white'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Users className="size-4" aria-hidden="true" />
                  Students ({students.length})
                </button>

                <button
                  type="button"
                  onClick={() => setPeopleSubTab('timetable')}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-[0.98]',
                    peopleSubTab === 'timetable'
                      ? 'bg-[#0095F6] text-white'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <CalendarClock className="size-4" aria-hidden="true" />
                  Timetable &amp; Subjects
                </button>
              </div>
            </div>

            {/* SUB-TAB 1: SUPREME SCHOLAR, MANAGER & 9 OFFICIAL CLASS USTHADS */}
            {peopleSubTab === 'usthads' && (
              <div className="flex flex-col gap-6">
                {/* Top Row: Supreme Scholar (SHAIKHUNA HAMZA USTHAD) & Institution Manager (Usthad Muhammed Naeem Saqafi) */}
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* 1. Supreme Scholar Card: SHAIKHUNA HAMZA USTHAD */}
                  <div className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0095F6]/15 via-card to-[#4F46E5]/10 p-5">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0095F6] px-3 py-0.5 text-[11px] font-extrabold tracking-wider text-white uppercase">
                          <Crown className="size-3.5" aria-hidden="true" />
                          {SHAIKHUNA_HAMZA_USTHAD.honorificTitle}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-popover px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          No Login ID • Not a Class Usthad
                        </span>
                      </div>

                      <div className="mt-1">
                        <h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">
                          {SHAIKHUNA_HAMZA_USTHAD.name}
                        </h2>
                        <p className="mt-0.5 text-xs font-semibold text-[#0077CC] dark:text-[#0095F6] sm:text-sm">
                          {SHAIKHUNA_HAMZA_USTHAD.malayalamName} • {SHAIKHUNA_HAMZA_USTHAD.designation}
                        </p>
                      </div>

                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {SHAIKHUNA_HAMZA_USTHAD.description}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2.5 border-t border-border/35 pt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          Senior Classes:
                        </span>
                        {SHAIKHUNA_HAMZA_USTHAD.valiyaBatches.map((batchName) => (
                          <button
                            key={batchName}
                            type="button"
                            onClick={() => {
                              setSelectedClassName(batchName)
                              setActiveTab('monitor')
                            }}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#0095F6]/15 px-3 py-1 text-xs font-bold text-[#0077CC] transition-all hover:bg-[#0095F6] hover:text-white active:scale-[0.98] dark:text-[#0095F6] dark:hover:text-white"
                          >
                            <BookOpen className="size-3.5" aria-hidden="true" />
                            {batchName}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Timetable Dars Only: <strong className="text-foreground">{SHAIKHUNA_HAMZA_USTHAD.specialization}</strong>
                      </p>
                    </div>
                  </div>

                  {/* 2. Institution Manager Card: Usthad Muhammed Naeem Saqafi (Manager) */}
                  <div className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/14 via-card to-card p-5">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-0.5 text-[11px] font-extrabold tracking-wider text-white uppercase">
                          <Building2 className="size-3.5" aria-hidden="true" />
                          Institution Manager (മാനേജർ)
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-popover px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          No Login ID • No Classes / Not a Class Usthad
                        </span>
                      </div>

                      <div className="mt-1">
                        <h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">
                          {ACADEMY_MANAGER.name} (Manager)
                        </h2>
                        <p className="mt-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400 sm:text-sm">
                          {ACADEMY_MANAGER.designation}
                        </p>
                      </div>

                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {ACADEMY_MANAGER.roleSummary}
                      </p>
                    </div>

                    <div className="flex flex-col gap-1.5 rounded-2xl bg-popover/85 p-3 text-xs">
                      <p className="font-semibold text-foreground">
                        Role: Overall Institutional Governance &amp; Administration
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        ഒരിക്കലും ക്ലാസ് ഉസ്താദ് ആവാറില്ല • ഒരാളുടെയും ക്ലാസ്സിൽ ഉണ്ടാവാറില്ല • ലോഗിൻ ഐഡി ആവശ്യമില്ല.
                      </p>
                    </div>
                  </div>
                </div>

                {/* The 9 Official Class Usthads Panel */}
                <Panel
                  id="principal-usthads-panel"
                  eyebrow="Faculty"
                  title="Class Usthads"
                  icon={GraduationCap}
                >
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {OFFICIAL_CLASS_USTHADS.map((u) => {
                      const row =
                        classMatrixRows.find((r) => r.className === u.className) ??
                        classMatrixRows[0]
                      const roleBadgeTone =
                        u.institutionalRole === 'Principal'
                          ? 'bg-[#0095F6]/20 text-[#0077CC] dark:text-[#0095F6]'
                          : u.institutionalRole === 'Swadr'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                            : 'bg-muted/70 text-muted-foreground'

                      return (
                        <div
                          key={u.id}
                          className={cn(
                            'flex flex-col justify-between gap-4 rounded-2xl p-4 transition-colors',
                            u.isPrincipalRole ? 'bg-[#0095F6]/[0.09]' : 'bg-muted/40 hover:bg-muted/60',
                          )}
                        >
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="rounded-full bg-[#0095F6]/15 px-2.5 py-0.5 text-xs font-bold text-[#0077CC] dark:text-[#0095F6] tabular-nums">
                                  {u.staffId}
                                </span>
                                {u.institutionalRole && (
                                  <span
                                    className={cn(
                                      'rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                                      roleBadgeTone,
                                    )}
                                  >
                                    {u.institutionalRole}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-semibold text-[#0077CC] dark:text-[#0095F6]">
                                {u.teachingBatches && u.teachingBatches.length > 1
                                  ? u.teachingBatches.join(' & ')
                                  : u.className}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <ProfileInitialsAvatar
                                name={u.name}
                                avatarUrl={u.avatarUrl}
                                className="size-11 text-xs shadow-xs"
                              />
                              <div className="min-w-0">
                                <h3 className="truncate font-display text-lg font-bold text-foreground">
                                  {u.name}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                  {u.designation} •{' '}
                                  {u.teachingBatches && u.teachingBatches.length > 1
                                    ? `Class ${u.teachingBatches.join(' & ')}`
                                    : u.fullClassLabel}
                                </p>
                              </div>
                            </div>

                            <p className="text-xs font-medium text-foreground/90">
                              Specialization: <span className="text-muted-foreground">{u.specialization}</span>
                            </p>

                            <div className="grid grid-cols-3 gap-2 rounded-xl bg-popover/85 p-2.5 text-center text-xs">
                              <div>
                                <span className="block text-[10px] text-muted-foreground">Conducted</span>
                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                  {row.conductedCount}/{row.teachingPeriodsCount}
                                </span>
                              </div>
                              <div>
                                <span className="block text-[10px] text-muted-foreground">Not Held</span>
                                <span
                                  className={cn(
                                    'font-mono font-bold tabular-nums',
                                    row.notHeldCount > 0
                                      ? 'text-red-600 dark:text-red-400'
                                      : 'text-foreground',
                                  )}
                                >
                                  {row.notHeldCount}
                                </span>
                              </div>
                              <div>
                                <span className="block text-[10px] text-muted-foreground">Class Rate</span>
                                <span className="font-mono font-bold text-cyan tabular-nums">
                                  {row.avgAttendance}%
                                </span>
                              </div>
                            </div>

                            <div className="text-[11px] text-muted-foreground tabular-nums">
                              Staff ID: {u.staffId} •{' '}
                              {u.designation === 'Teaching Usthad' && u.teachingBatches
                                ? `Teaching Batches: ${u.teachingBatches.join(', ')}`
                                : `Assigned Class: ${
                                    u.teachingBatches && u.teachingBatches.length > 1
                                      ? u.teachingBatches.join(' & ')
                                      : u.className
                                  }`}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                setSelectedClassName(u.className)
                                setActiveTab('monitor')
                              }}
                              className="flex-1 rounded-xl text-xs font-semibold"
                            >
                              Control Class &amp; Periods
                            </Button>
                            {u.isPrincipalRole && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  window.dispatchEvent(
                                    new CustomEvent('ics-switch-role', {
                                      detail: { role: 'usthad', usthadId: u.id },
                                    }),
                                  )
                                }}
                                className="rounded-full bg-[#0095F6]/12 text-xs font-semibold text-[#0077CC] hover:bg-[#0095F6]/20 dark:text-[#0095F6]"
                              >
                                Usthad View
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingUsthadId(u.id)
                                const el = document.getElementById('principal-usthad-manager')
                                el?.scrollIntoView({ behavior: 'smooth' })
                              }}
                              className="rounded-xl text-xs font-semibold"
                            >
                              Edit Usthad
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setDirectoryClassFilter(u.className)
                                setPeopleSubTab('students')
                              }}
                              className="rounded-xl text-xs font-semibold"
                            >
                              Students ({row.totalStudents})
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Panel>

                {/* Principal Class Usthad Assignment & Usthad Profile Editor */}
                <div id="principal-usthad-manager" className="grid gap-6 lg:grid-cols-2">
                  {/* 1. Assign Class Usthad to Any Class */}
                  <Panel
                    id="principal-assign-usthad-panel"
                    eyebrow="Class Charge"
                    title="Change Class Usthad (ക്ലാസ് ഉസ്താദിനെ മാറ്റാൻ)"
                    icon={UserCog}
                  >
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (!isClassUsthadChanged) return
                        assignClassUsthadByPrincipal(assignUsthadClass, assignUsthadStaffId)
                        refreshAllCampusData()
                        setUsthadAssignToast(
                          `Class ${assignUsthadClass} Usthad updated successfully!`,
                        )
                        setTimeout(() => setUsthadAssignToast(null), 4000)
                      }}
                      className="flex flex-col gap-4"
                    >
                      <p className="text-xs text-muted-foreground">
                        ഏത് ക്ലാസിന്റെയും ചുമതലയുള്ള ക്ലാസ് ഉസ്താദിനെ ഇവിടെനിന്ന് മാറ്റാവുന്നതാണ്. ഒന്നിലധികം ക്ലാസുകളുടെ ചുമതല ഒരേ ഉസ്താദിന് നൽകാനും സാധിക്കും.
                      </p>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-assign-usthad-class" className="text-xs">
                            Select Class (ക്ലാസ് തിരഞ്ഞെടുക്കുക)
                          </Label>
                          <ThemeSelect
                            id="pr-assign-usthad-class"
                            value={assignUsthadClass}
                            onChange={(e) => setAssignUsthadClass(e.target.value)}
                            className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none"
                          >
                            {ALL_ACADEMY_CLASS_NAMES.map((cls) => {
                              const currentCu = CLASS_USTHADS.find((u) => u.className === cls)
                              return (
                                <option key={cls} value={cls}>
                                  Class {cls} (Current: {currentCu?.shortName ?? 'Usthad'})
                                </option>
                              )
                            })}
                          </ThemeSelect>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-assign-usthad-staff" className="text-xs">
                            Select Class Usthad (ഉസ്താദിനെ തിരഞ്ഞെടുക്കുക)
                          </Label>
                          <ThemeSelect
                            id="pr-assign-usthad-staff"
                            value={assignUsthadStaffId}
                            onChange={(e) => setAssignUsthadStaffId(e.target.value)}
                            className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none"
                          >
                            {OFFICIAL_CLASS_USTHADS.map((u) => (
                              <option key={u.id} value={u.staffId}>
                                {u.name} ({u.staffId})
                              </option>
                            ))}
                          </ThemeSelect>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        {usthadAssignToast ? (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-lime">
                            {usthadAssignToast}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Updates Class Usthad across all dashboards
                          </span>
                        )}
                        <Button
                          type="submit"
                          size="sm"
                          disabled={!isClassUsthadChanged}
                          className="rounded-xl text-xs font-semibold disabled:opacity-50"
                        >
                          {isClassUsthadChanged ? 'Save Class Usthad' : 'Saved (No Changes)'}
                        </Button>
                      </div>
                    </form>
                  </Panel>

                  {/* 2. Edit Usthad Details or Add New Usthad */}
                  <Panel
                    id="principal-edit-usthad-panel"
                    eyebrow="Faculty Profile"
                    title="Edit / Add Usthad (ഉസ്താദിന്റെ വിവരങ്ങൾ / പുതിയ ഉസ്താദ്)"
                    icon={GraduationCap}
                  >
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (!isUsthadProfileChanged) return
                        saveUsthadProfileByPrincipal({
                          usthadId: editingUsthadId === 'NEW' ? undefined : editingUsthadId,
                          name: usthadFormName,
                          staffId: usthadFormStaffId,
                          designation: usthadFormDesignation,
                          specialization: usthadFormSpec,
                        })
                        refreshAllCampusData()
                        setUsthadProfileToast(
                          editingUsthadId === 'NEW'
                            ? `Added ${usthadFormName.trim()} (${usthadFormStaffId.trim()})!`
                            : `Updated ${usthadFormName.trim()} profile!`,
                        )
                        setTimeout(() => setUsthadProfileToast(null), 4000)
                      }}
                      className="flex flex-col gap-3.5"
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-edit-usthad-select" className="text-xs">
                            Select Usthad or Add New
                          </Label>
                          <ThemeSelect
                            id="pr-edit-usthad-select"
                            value={editingUsthadId}
                            onChange={(e) => setEditingUsthadId(e.target.value)}
                            className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none"
                          >
                            {OFFICIAL_CLASS_USTHADS.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.staffId})
                              </option>
                            ))}
                            <option value="NEW">+ Add New Usthad (പുതിയ ഉസ്താദിനെ ചേർക്കാൻ)</option>
                          </ThemeSelect>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-usthad-staff-id" className="text-xs">
                            Staff Login ID
                          </Label>
                          <Input
                            id="pr-usthad-staff-id"
                            required
                            value={usthadFormStaffId}
                            onChange={(e) => setUsthadFormStaffId(e.target.value)}
                            placeholder="e.g. UST-15"
                            className="h-10 rounded-xl font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-usthad-name" className="text-xs">
                            Usthad Full Name
                          </Label>
                          <Input
                            id="pr-usthad-name"
                            required
                            value={usthadFormName}
                            onChange={(e) => setUsthadFormName(e.target.value)}
                            placeholder="e.g. Usthad Muhammed..."
                            className="h-10 rounded-xl text-xs"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-usthad-designation" className="text-xs">
                            Designation
                          </Label>
                          <Input
                            id="pr-usthad-designation"
                            value={usthadFormDesignation}
                            onChange={(e) => setUsthadFormDesignation(e.target.value)}
                            placeholder="Class Usthad"
                            className="h-10 rounded-xl text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="pr-usthad-spec" className="text-xs">
                          Specialization / Subjects Taught
                        </Label>
                        <Input
                          id="pr-usthad-spec"
                          value={usthadFormSpec}
                          onChange={(e) => setUsthadFormSpec(e.target.value)}
                          placeholder="e.g. Fath al-Mu’in, Nahw & Tafsir"
                          className="h-10 rounded-xl text-xs"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        {usthadProfileToast ? (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-lime">
                            {usthadProfileToast}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {editingUsthadId === 'NEW' ? 'Creates new Staff Login ID' : 'Updates Usthad profile'}
                          </span>
                        )}
                        <Button
                          type="submit"
                          size="sm"
                          disabled={!isUsthadProfileChanged}
                          className="rounded-xl text-xs font-semibold disabled:opacity-50"
                        >
                          {editingUsthadId === 'NEW'
                            ? 'Add Usthad'
                            : isUsthadProfileChanged
                              ? 'Save Usthad Profile'
                              : 'Saved (No Changes)'}
                        </Button>
                      </div>
                    </form>
                  </Panel>
                </div>
              </div>
            )}

            {/* SUB-TAB 2: 22 CLASS LEADERS */}
            {peopleSubTab === 'leaders' && (
              <div className="flex flex-col gap-6">
                {/* Principal Class Leader Assignment Panel */}
                <Panel
                  id="principal-leader-editor"
                  eyebrow="Assign Leaders"
                  title="Change Class Leaders (ക്ലാസ് ലീഡർമാരെ മാറ്റാൻ)"
                  icon={UserCheck}
                >
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (!isClassLeadersChanged) return
                      assignClassLeadersByPrincipal({
                        className: leaderEditClass,
                        mainStudentId: leaderMainStudentId,
                        assistantStudentId: leaderAssistantStudentId,
                      })
                      refreshAllCampusData()
                      setLeaderAdminToast(
                        `Class ${leaderEditClass} Main & Assistant Leaders updated!`,
                      )
                      setTimeout(() => setLeaderAdminToast(null), 4000)
                    }}
                    className="flex flex-col gap-4"
                  >
                    <p className="text-xs text-muted-foreground">
                      ഏത് ക്ലാസിലെയും മെയിൻ ക്ലാസ് ലീഡറെയും (Main Class Leader) അസിസ്റ്റന്റ് ക്ലാസ് ലീഡറെയും (Assistant Class Leader) ആ ക്ലാസിലെ കുട്ടികളിൽ നിന്ന് തിരഞ്ഞെടുത്ത് മാറ്റാവുന്നതാണ്.
                    </p>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="pr-leader-class" className="text-xs">
                          Select Class (ക്ലാസ്)
                        </Label>
                        <ThemeSelect
                          id="pr-leader-class"
                          value={leaderEditClass}
                          onChange={(e) => setLeaderEditClass(e.target.value)}
                          className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none"
                        >
                          {ALL_ACADEMY_CLASS_NAMES.map((cls) => (
                            <option key={cls} value={cls}>
                              Class {cls}
                            </option>
                          ))}
                        </ThemeSelect>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="pr-leader-main" className="text-xs text-lime">
                          Main Class Leader (മെയിൻ ലീഡർ)
                        </Label>
                        <ThemeSelect
                          id="pr-leader-main"
                          value={leaderMainStudentId}
                          onChange={(e) => setLeaderMainStudentId(e.target.value)}
                          className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none"
                        >
                          {students
                            .filter((s) => s.className === leaderEditClass)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.admissionNo})
                              </option>
                            ))}
                        </ThemeSelect>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="pr-leader-assistant" className="text-xs text-cyan">
                          Assistant Class Leader (അസിസ്റ്റന്റ് ലീഡർ)
                        </Label>
                        <ThemeSelect
                          id="pr-leader-assistant"
                          value={leaderAssistantStudentId}
                          onChange={(e) => setLeaderAssistantStudentId(e.target.value)}
                          className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none"
                        >
                          {students
                            .filter((s) => s.className === leaderEditClass)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.admissionNo})
                              </option>
                            ))}
                        </ThemeSelect>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      {leaderAdminToast ? (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-lime">
                          {leaderAdminToast}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Selected students immediately get Class Leader login &amp; attendance permissions
                        </span>
                      )}
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!isClassLeadersChanged}
                        className="rounded-xl text-xs font-semibold disabled:opacity-50"
                      >
                        {isClassLeadersChanged ? 'Save Class Leaders' : 'Saved (No Changes)'}
                      </Button>
                    </div>
                  </form>
                </Panel>

                <Panel
                  id="principal-leaders-panel"
                  eyebrow="Leaders"
                  title="Class Leaders Directory"
                  icon={UserCheck}
                >
                  <div className="overflow-x-auto rounded-2xl bg-muted/35">
                    <table className="w-full min-w-[780px] border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-border/40 bg-muted/50 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                          <th className="px-4 py-3">Leader ID</th>
                          <th className="px-4 py-3">Role Title</th>
                          <th className="px-4 py-3">Student Name</th>
                          <th className="px-4 py-3">Admission No.</th>
                          <th className="px-4 py-3">Class</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {CLASS_LEADERS.map((cl) => {
                          const studentObj =
                            students.find((s) => s.id === cl.studentId) ?? students[0]
                          return (
                            <tr key={cl.leaderId} className="hover:bg-muted/30">
                              <td className="px-4 py-3 font-mono font-bold text-[#0077CC] tabular-nums dark:text-[#0095F6]">
                                {cl.leaderId}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={cn(
                                    'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                                    cl.roleTitle === 'Main Class Leader'
                                      ? 'bg-[#0095F6]/15 text-[#0077CC] dark:text-[#0095F6]'
                                      : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
                                  )}
                                >
                                  {cl.roleTitle}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-semibold text-foreground">
                                {cl.studentName}
                              </td>
                              <td className="px-4 py-3 font-mono text-muted-foreground tabular-nums">
                                {cl.admissionNo}
                              </td>
                              <td className="px-4 py-3 font-medium text-foreground">
                                {cl.className}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setLeaderEditClass(cl.className)
                                      const el = document.getElementById('principal-leader-editor')
                                      el?.scrollIntoView({ behavior: 'smooth' })
                                    }}
                                    className="h-8 rounded-full px-3 text-xs font-semibold"
                                  >
                                    Change Leader
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setPdfReportStudent(studentObj)}
                                    className="h-8 rounded-full bg-[#0095F6]/12 px-3 text-xs font-semibold text-[#0077CC] hover:bg-[#0095F6]/20 dark:text-[#0095F6]"
                                  >
                                    <FileText className="mr-1 size-3.5" aria-hidden="true" />
                                    Parent PDF
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedClassName(cl.className)
                                      setActiveTab('monitor')
                                    }}
                                    className="h-8 rounded-xl px-3 text-xs font-semibold"
                                  >
                                    Inspect Class
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>
            )}

            {/* SUB-TAB 3: STUDENTS DIRECTORY, ADD/REMOVE STUDENTS, MONTHLY ATTENDANCE EDITOR & LEAVE CONTROL */}
            {peopleSubTab === 'students' && (
              <div className="flex flex-col gap-6">
                {/* Principal Add / Edit / Remove Student Panel */}
                <Panel
                  id="principal-student-admission-editor"
                  eyebrow="Admissions & Roster"
                  title={
                    editingStudentId
                      ? 'Edit Student Details (കുട്ടിയുടെ വിവരങ്ങൾ തിരുത്താൻ)'
                      : 'Add New Student to Academy (പുതിയ കുട്ടിയെ ചേർക്കാൻ)'
                  }
                  icon={Plus}
                  action={
                    (loadAcademyAdminConfig().removedStudentIds?.length ?? 0) > 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          restoreAllRemovedStudentsByPrincipal()
                          refreshAllCampusData()
                          setStudentAdminToast('Restored all previously removed students!')
                          setTimeout(() => setStudentAdminToast(null), 4000)
                        }}
                        className="h-8 rounded-xl border-amber-500/40 bg-amber-500/10 px-3 text-xs font-semibold text-amber-500 hover:bg-amber-500/20"
                      >
                        <RotateCcw className="mr-1.5 size-3.5" aria-hidden="true" />
                        Restore Removed ({loadAcademyAdminConfig().removedStudentIds?.length ?? 0})
                      </Button>
                    ) : undefined
                  }
                >
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (!isStudentFormValidAndChanged) return
                      if (editingStudentId) {
                        updateStudentByPrincipal(editingStudentId, {
                          name: studentFormName,
                          admissionNo: studentFormAdmissionNo,
                          className: studentFormClass,
                        })
                        setStudentAdminToast(
                          `Updated ${studentFormName.trim()} (${studentFormAdmissionNo.trim()} • Class ${studentFormClass})!`,
                        )
                        setEditingStudentId(null)
                      } else {
                        const created = addStudentByPrincipal({
                          name: studentFormName,
                          admissionNo: studentFormAdmissionNo,
                          className: studentFormClass,
                        })
                        setStudentAdminToast(
                          `Added ${created.name} (${created.admissionNo}) to Class ${created.className}!`,
                        )
                      }
                      refreshAllCampusData()
                      setStudentFormName('')
                      setStudentFormAdmissionNo(getNextSuggestedAdmissionNo(studentFormClass))
                      setTimeout(() => setStudentAdminToast(null), 4000)
                    }}
                    className="flex flex-col gap-4"
                  >
                    <p className="text-xs text-muted-foreground">
                      ഏത് ക്ലാസിലേക്കും പുതിയ കുട്ടികളെ ചേർക്കാനും, നിലവിലുള്ളവരുടെ പേര്, അഡ്മിഷൻ നമ്പർ, ക്ലാസ് എന്നിവ മാറ്റാനും, താഴെയുള്ള ലിസ്റ്റിൽ നിന്ന് കുട്ടികളെ ഒഴിവാക്കാനും (Remove) സാധിക്കും.
                    </p>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="pr-st-form-class" className="text-xs">
                          Select Class (ക്ലാസ്)
                        </Label>
                        <ThemeSelect
                          id="pr-st-form-class"
                          value={studentFormClass}
                          onChange={(e) => {
                            const nextCls = e.target.value
                            setStudentFormClass(nextCls)
                            if (!editingStudentId) {
                              setStudentFormAdmissionNo(getNextSuggestedAdmissionNo(nextCls))
                            }
                          }}
                          className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none"
                        >
                          {ALL_ACADEMY_CLASS_NAMES.map((cls) => (
                            <option key={cls} value={cls}>
                              Class {cls}
                            </option>
                          ))}
                        </ThemeSelect>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="pr-st-form-name" className="text-xs">
                          Student Full Name (കുട്ടിയുടെ പേര്)
                        </Label>
                        <Input
                          id="pr-st-form-name"
                          required
                          value={studentFormName}
                          onChange={(e) => setStudentFormName(e.target.value)}
                          placeholder="e.g. Muhammed Ameen. K"
                          className="h-10 rounded-xl text-xs"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="pr-st-form-adm" className="text-xs">
                          Admission Number (അഡ്മിഷൻ നമ്പർ)
                        </Label>
                        <div className="flex items-center gap-1.5">
                          <Input
                            id="pr-st-form-adm"
                            required
                            value={studentFormAdmissionNo}
                            onChange={(e) => setStudentFormAdmissionNo(e.target.value)}
                            placeholder="e.g. ICS2K261427"
                            className="h-10 rounded-xl font-mono text-xs uppercase"
                          />
                          {!editingStudentId && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setStudentFormAdmissionNo(
                                  getNextSuggestedAdmissionNo(studentFormClass),
                                )
                              }
                              className="h-10 shrink-0 rounded-xl px-2.5 text-[11px] font-semibold"
                            >
                              Auto ID
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      {studentAdminToast ? (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-lime">
                          {studentAdminToast}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          New students can immediately log in using their Admission Number
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        {editingStudentId && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingStudentId(null)
                              setStudentFormName('')
                              setStudentFormAdmissionNo(
                                getNextSuggestedAdmissionNo(studentFormClass),
                              )
                            }}
                            className="rounded-xl text-xs font-semibold"
                          >
                            Cancel Edit
                          </Button>
                        )}
                        <Button
                          type="submit"
                          size="sm"
                          disabled={!isStudentFormValidAndChanged}
                          className="rounded-xl text-xs font-semibold disabled:opacity-50"
                        >
                          <Plus className="mr-1 size-3.5" aria-hidden="true" />
                          {editingStudentId
                            ? isStudentFormValidAndChanged
                              ? 'Save Student Changes'
                              : 'Saved (No Changes)'
                            : 'Add Student to Class'}
                        </Button>
                      </div>
                    </div>
                  </form>
                </Panel>
                {/* Monthly Attendance Override Editor + Campus Leave Action side by side */}
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Monthly Attendance Editor */}
                  <Panel
                    id="principal-monthly-editor"
                    eyebrow="Attendance"
                    title="Monthly Attendance"
                    icon={CalendarCheck}
                  >
                    <form onSubmit={handleSaveMonthAttendance} className="flex flex-col gap-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-edit-student" className="text-xs">
                            Select Student
                          </Label>
                          <ThemeSelect
                            id="pr-edit-student"
                            value={selectedStudentId}
                            onChange={(e) => setSelectedStudentId(e.target.value)}
                            className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none"
                          >
                            {students.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.admissionNo} · {s.className})
                              </option>
                            ))}
                          </ThemeSelect>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-edit-month" className="text-xs">
                            Select Month
                          </Label>
                          <ThemeSelect
                            id="pr-edit-month"
                            value={selectedMonthId}
                            onChange={(e) => setSelectedMonthId(e.target.value)}
                            className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none"
                          >
                            {selectedStudentEffective?.monthlyAttendance.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.month} {m.year} ({m.workingDays} Working Days)
                              </option>
                            ))}
                          </ThemeSelect>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-present-days" className="text-xs text-emerald-600 dark:text-lime">
                            Present
                          </Label>
                          <Input
                            id="pr-present-days"
                            type="number"
                            min={0}
                            max={31}
                            value={editPresent}
                            onChange={(e) => setEditPresent(Number(e.target.value))}
                            className="h-10 rounded-xl font-mono tabular-nums"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-absent-days" className="text-xs text-red-500">
                            Absent
                          </Label>
                          <Input
                            id="pr-absent-days"
                            type="number"
                            min={0}
                            max={31}
                            value={editAbsent}
                            onChange={(e) => setEditAbsent(Number(e.target.value))}
                            className="h-10 rounded-xl font-mono tabular-nums"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-leave-days" className="text-xs text-amber-500">
                            Leave
                          </Label>
                          <Input
                            id="pr-leave-days"
                            type="number"
                            min={0}
                            max={31}
                            value={editLeave}
                            onChange={(e) => setEditLeave(Number(e.target.value))}
                            className="h-10 rounded-xl font-mono tabular-nums"
                          />
                        </div>
                      </div>

                      {editAbsent > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-absent-reason" className="text-xs text-red-500">
                            Absent Reason
                          </Label>
                          <ThemeSelect
                            id="pr-absent-reason"
                            value={editAbsentReason}
                            onChange={(e) => setEditAbsentReason(e.target.value)}
                            className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-medium text-foreground"
                          >
                            {ABSENT_REASONS.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </ThemeSelect>
                        </div>
                      )}

                      {editLeave > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-leave-reason" className="text-xs text-amber-500">
                            Leave Reason
                          </Label>
                          <ThemeSelect
                            id="pr-leave-reason"
                            value={editLeaveReason}
                            onChange={(e) => setEditLeaveReason(e.target.value)}
                            className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-medium text-foreground"
                          >
                            {ATTENDANCE_LEAVE_REASONS.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </ThemeSelect>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-3 pt-1">
                        {attendanceSavedToast ? (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-lime">
                            {attendanceSavedToast}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {isPrincipalMonthAttendanceDirty ? 'Unsaved changes' : 'All changes saved'}
                          </span>
                        )}
                        <Button
                          type="submit"
                          size="sm"
                          disabled={!isPrincipalMonthAttendanceDirty}
                          className="rounded-xl text-xs font-semibold disabled:opacity-50"
                        >
                          {isPrincipalMonthAttendanceDirty ? 'Save' : 'Saved ✓'}
                        </Button>
                      </div>
                    </form>
                  </Panel>

                  {/* Campus Leave Register Action */}
                  <Panel
                    id="principal-leave-control"
                    eyebrow="Leave"
                    title="Student Leave"
                    icon={ClipboardCheck}
                  >
                    <form onSubmit={handleSubmitLeaveForm} className="flex flex-col gap-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-leave-student" className="text-xs">
                            Select Student
                          </Label>
                          <ThemeSelect
                            id="pr-leave-student"
                            value={leaveStudentId}
                            onChange={(e) => setLeaveStudentId(e.target.value)}
                            className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none"
                          >
                            {students.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.admissionNo} · {s.className})
                              </option>
                            ))}
                          </ThemeSelect>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-leave-action" className="text-xs">
                            Action
                          </Label>
                          <ThemeSelect
                            id="pr-leave-action"
                            value={leaveActionType}
                            onChange={(e) =>
                              setLeaveActionType(e.target.value as 'application' | 'return')
                            }
                            className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none"
                          >
                            <option value="application">Grant Leave</option>
                            <option value="return">Mark Returned</option>
                          </ThemeSelect>
                        </div>
                      </div>

                      {leaveActionType === 'application' && (
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-leave-reason-select" className="text-xs">
                            Reason
                          </Label>
                          <ThemeSelect
                            id="pr-leave-reason-select"
                            value={leaveReason}
                            onChange={(e) => setLeaveReason(e.target.value)}
                            className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none"
                          >
                            {leaveReasons.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </ThemeSelect>
                        </div>
                      )}

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="pr-leave-notes" className="text-xs">
                          Note
                        </Label>
                        <Input
                          id="pr-leave-notes"
                          value={leaveDetails}
                          onChange={(e) => setLeaveDetails(e.target.value)}
                          placeholder="Optional note..."
                          className="h-10 rounded-xl text-xs"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        {leaveSavedToast ? (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-lime">
                            {leaveSavedToast}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {campusMetrics.onLeaveNow} on leave
                          </span>
                        )}
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isPrincipalLeaveActionDuplicate}
                          className="rounded-xl text-xs font-semibold disabled:opacity-50"
                        >
                          {isPrincipalLeaveActionDuplicate ? 'Already Recorded ✓' : 'Save Leave'}
                        </Button>
                      </div>
                    </form>
                  </Panel>
                </div>

                {/* All 181 Students Master Directory */}
                <Panel
                  id="principal-student-directory"
                  eyebrow="Students"
                  title="Student Directory"
                  icon={Users}
                  action={
                    <span className="text-xs font-semibold text-lime tabular-nums">
                      {filteredDirectoryStudents.length} / {students.length}
                    </span>
                  }
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div className="relative flex-1 sm:max-w-xs">
                        <Search
                          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <Input
                          type="search"
                          value={directorySearch}
                          onChange={(e) => setDirectorySearch(e.target.value)}
                          placeholder="Search name, admission no, or batch..."
                          className="h-10 rounded-xl pl-10 text-xs"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <ThemeSelect
                          aria-label="Filter by Class"
                          value={directoryClassFilter}
                          onChange={(e) => setDirectoryClassFilter(e.target.value)}
                          className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none"
                        >
                          <option value="ALL">All 11 Classes ({students.length} Students)</option>
                          {CLASS_USTHADS.map((u) => (
                            <option key={u.className} value={u.className}>
                              {u.className}
                            </option>
                          ))}
                        </ThemeSelect>

                        <ThemeSelect
                          aria-label="Filter by Campus Status"
                          value={directoryStatusFilter}
                          onChange={(e) =>
                            setDirectoryStatusFilter(
                              e.target.value as 'all' | 'academy' | 'leave',
                            )
                          }
                          className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none"
                        >
                          <option value="all">All Status</option>
                          <option value="academy">Present in Academy</option>
                          <option value="leave">Currently on Leave</option>
                        </ThemeSelect>
                      </div>
                    </div>

                    <div className="max-h-[540px] overflow-y-auto rounded-2xl border border-border bg-background/50">
                      <table className="w-full min-w-[820px] border-collapse text-left text-xs">
                        <thead className="sticky top-0 z-10 border-b border-border bg-card">
                          <tr className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase whitespace-nowrap">
                            <th className="px-3.5 py-3 whitespace-nowrap">Student Name</th>
                            <th className="px-3.5 py-3 whitespace-nowrap">Admission No.</th>
                            <th className="px-3.5 py-3 whitespace-nowrap">Class</th>
                            <th className="px-3 py-3 text-right whitespace-nowrap">Attendance</th>
                            <th className="px-3.5 py-3 whitespace-nowrap">Campus Status</th>
                            <th className="px-3.5 py-3 text-right whitespace-nowrap">Principal Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filteredDirectoryStudents.map((item) => (
                            <tr key={item.student.id} className="hover:bg-muted/25">
                              <td className="px-3.5 py-2.5 font-semibold text-foreground whitespace-nowrap">
                                {item.student.name}
                              </td>
                              <td className="px-3.5 py-2.5 font-mono text-muted-foreground tabular-nums whitespace-nowrap">
                                {item.student.admissionNo}
                              </td>
                              <td className="px-3.5 py-2.5 text-foreground whitespace-nowrap">
                                {item.student.className}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600 tabular-nums dark:text-lime whitespace-nowrap">
                                {item.overallRate}%
                              </td>
                              <td className="px-3.5 py-2.5 whitespace-nowrap">
                                {item.isOnLeave ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-300 whitespace-nowrap">
                                    On Leave ({item.activeLeaveEntry?.reason})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-lime whitespace-nowrap">
                                    In Academy
                                  </span>
                                )}
                              </td>
                              <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingStudentId(item.student.id)
                                      setStudentFormClass(item.student.className)
                                      setStudentFormName(item.student.name)
                                      setStudentFormAdmissionNo(item.student.admissionNo)
                                      const el = document.getElementById(
                                        'principal-student-admission-editor',
                                      )
                                      el?.scrollIntoView({ behavior: 'smooth' })
                                    }}
                                    className="h-7 rounded-lg px-2 text-[11px] font-semibold"
                                  >
                                    Edit Info
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedStudentId(item.student.id)
                                      setLeaveStudentId(item.student.id)
                                      const el = document.getElementById('principal-monthly-editor')
                                      el?.scrollIntoView({ behavior: 'smooth' })
                                    }}
                                    className="h-7 rounded-lg px-2.5 text-[11px] font-semibold"
                                  >
                                    Attendance / Leave
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => setPdfReportStudent(item.student)}
                                    className="h-7 rounded-full bg-[#0095F6] px-3 text-[11px] font-semibold text-white hover:bg-[#0077CC]"
                                  >
                                    <FileText className="mr-1 size-3" aria-hidden="true" />
                                    Parent PDF
                                  </Button>
                                  {confirmRemoveStudentId === item.student.id ? (
                                    <div className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          removeStudentByPrincipal(item.student.id)
                                          setConfirmRemoveStudentId(null)
                                          refreshAllCampusData()
                                          setStudentAdminToast(
                                            `Removed ${item.student.name} (${item.student.admissionNo}) from roster.`,
                                          )
                                          setTimeout(() => setStudentAdminToast(null), 4000)
                                        }}
                                        className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-red-700"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmRemoveStudentId(null)}
                                        className="px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setConfirmRemoveStudentId(item.student.id)}
                                      className="h-7 rounded-full px-2 text-[11px] font-semibold text-red-500 hover:bg-red-500/10 hover:text-red-600"
                                      title="Remove Student"
                                    >
                                      <Trash2 className="size-3.5" aria-hidden="true" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Panel>
              </div>
            )}

            {/* SUB-TAB 4: TIMETABLE & SUBJECTS EDITOR */}
            {peopleSubTab === 'timetable' && (
              <div className="flex flex-col gap-6">
                <Panel
                  id="principal-timetable-editor"
                  eyebrow="Schedule & Syllabus"
                  title="Edit Class Timetable & Subjects (ടൈംടേബിളും വിഷയങ്ങളും പുതുക്കാൻ)"
                  icon={CalendarClock}
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Active Academy Semester:
                      </span>
                      <div className="inline-flex rounded-full bg-muted/70 p-0.5">
                        {([1, 2] as const).map((sem) => {
                          const isCurrent = getActiveSemester() === sem
                          return (
                            <button
                              key={sem}
                              type="button"
                              disabled={isCurrent}
                              onClick={() => {
                                if (isCurrent) return
                                setActiveSemesterByPrincipal(sem)
                                setTtEditSemesterTab(sem)
                                refreshAllCampusData()
                                setTtAdminToast(`Switched active Academy schedule to Semester ${sem}!`)
                                setTimeout(() => setTtAdminToast(null), 4000)
                              }}
                              className={cn(
                                'rounded-full px-3 py-1 text-xs font-bold transition-all',
                                isCurrent
                                  ? 'bg-[#0095F6] text-white cursor-default'
                                  : 'text-muted-foreground hover:text-foreground',
                              )}
                            >
                              Semester {sem}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  }
                >
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (!isTimetableDirty) return
                      saveClassTimetableByPrincipal(ttEditClass, ttDraft)
                      refreshAllCampusData()
                      setTtAdminToast(
                        `Saved Class ${ttEditClass} timetable & subjects across all portals!`,
                      )
                      setTimeout(() => setTtAdminToast(null), 4000)
                    }}
                    className="flex flex-col gap-4"
                  >
                    <p className="text-xs text-muted-foreground">
                      ഏത് ക്ലാസിലെയും പീരീഡുകളുടെ എണ്ണവും (5 മുതൽ 12 പീരീഡ് വരെ), സമയവും (Period Time), വിഷയങ്ങളും കിതാബുകളും (Subjects / Kitabs), പഠിപ്പിക്കുന്ന ഉസ്താദുമാരുടെ പേരുകളും ഇവിടെനിന്ന് മാറ്റാവുന്നതാണ്. പുതിയ പീരീഡുകൾ ചേർത്താൽ അവ തനിയെ ഹാജർ ഇടുന്നിടത്തും ടൈംടേബിളിലും വരുന്നതാണ്.
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/45 p-3.5">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="pr-tt-class" className="text-xs font-bold">
                            Select Class:
                          </Label>
                          <ThemeSelect
                            id="pr-tt-class"
                            value={ttEditClass}
                            onChange={(e) => setTtEditClass(e.target.value)}
                            className="h-9 rounded-full bg-popover px-3.5 text-xs font-semibold text-foreground outline-none"
                          >
                            {ALL_ACADEMY_CLASS_NAMES.map((cls) => (
                              <option key={cls} value={cls}>
                                Class {cls} ({getClassSemesterTimetableByClassName(cls).periods.length} Periods)
                              </option>
                            ))}
                          </ThemeSelect>
                        </div>

                        <div className="inline-flex rounded-full bg-popover p-1">
                          {([1, 2] as const).map((semTab) => (
                            <button
                              key={semTab}
                              type="button"
                              onClick={() => setTtEditSemesterTab(semTab)}
                              className={cn(
                                'rounded-full px-3 py-1 text-xs font-semibold transition-all',
                                ttEditSemesterTab === semTab
                                  ? 'bg-[#0095F6] text-white'
                                  : 'text-muted-foreground hover:text-foreground',
                              )}
                            >
                              Edit Semester {semTab} Subjects
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={ttDraft.periods.length >= 12}
                          onClick={() => {
                            const nextNum = ttDraft.periods.length + 1
                            if (nextNum > 12) return
                            const defaultUsthad =
                              CLASS_USTHADS.find((u) => u.className === ttEditClass)?.name ??
                              OFFICIAL_CLASS_USTHADS[0]?.name ??
                              'Class Usthad'
                            setTtDraft({
                              periods: [
                                ...ttDraft.periods,
                                { label: `Period ${nextNum}`, time: '15:30 – 16:30' },
                              ],
                              semester1: [
                                ...ttDraft.semester1,
                                { subject: `Period ${nextNum} Subject`, teacher: defaultUsthad },
                              ],
                              semester2: [
                                ...ttDraft.semester2,
                                { subject: `Period ${nextNum} Subject`, teacher: defaultUsthad },
                              ],
                            })
                          }}
                          className="h-8 rounded-full bg-[#0095F6]/15 px-3 text-xs font-semibold text-[#0077CC] hover:bg-[#0095F6] hover:text-white dark:text-[#0095F6] dark:hover:text-white"
                        >
                          <Plus className="mr-1 size-3.5" aria-hidden="true" />
                          Add Period ({ttDraft.periods.length}/12)
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isTimetableAtDefault}
                          onClick={() => {
                            if (isTimetableAtDefault) return
                            const resetTt = resetClassTimetableByPrincipal(ttEditClass)
                            setTtDraft(resetTt)
                            refreshAllCampusData()
                            setTtAdminToast(`Reset Class ${ttEditClass} timetable to default!`)
                            setTimeout(() => setTtAdminToast(null), 4000)
                          }}
                          className="h-8 rounded-full text-xs font-semibold disabled:opacity-50"
                        >
                          <RotateCcw className="mr-1.5 size-3.5" aria-hidden="true" />
                          Reset Class Default
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      {ttDraft.periods.map((period, idx) => {
                        const semKey = ttEditSemesterTab === 1 ? 'semester1' : 'semester2'
                        const slot = ttDraft[semKey][idx] ?? { subject: '', teacher: '' }
                        return (
                          <div
                            key={`${idx}-${period.label}`}
                            className="grid gap-3 rounded-2xl bg-muted/40 p-3.5 sm:grid-cols-12 sm:items-end"
                          >
                            <div className="flex flex-col gap-1 sm:col-span-3">
                              <Label className="text-[11px] font-bold text-[#0077CC] uppercase dark:text-[#0095F6]">
                                {period.label} Timing
                              </Label>
                              <Input
                                value={period.time}
                                onChange={(e) => {
                                  const nextPeriods = ttDraft.periods.map((p, pIdx) =>
                                    pIdx === idx ? { ...p, time: e.target.value } : p,
                                  )
                                  setTtDraft({ ...ttDraft, periods: nextPeriods })
                                }}
                                placeholder="07:00 – 08:00"
                                className="h-9 rounded-xl font-mono text-xs"
                              />
                            </div>

                            <div className="flex flex-col gap-1 sm:col-span-4">
                              <Label className="text-[11px] font-semibold text-foreground">
                                Semester {ttEditSemesterTab} Subject / Kitab
                              </Label>
                              <Input
                                required
                                value={slot.subject}
                                onChange={(e) => {
                                  const nextSlots = ttDraft[semKey].map((s, sIdx) =>
                                    sIdx === idx ? { ...s, subject: e.target.value } : s,
                                  )
                                  setTtDraft({ ...ttDraft, [semKey]: nextSlots })
                                }}
                                placeholder="e.g. Fath al-Mu’in / Tafsir al-Jalalayn"
                                className="h-9 rounded-xl text-xs font-semibold"
                              />
                            </div>

                            <div className="flex flex-col gap-1 sm:col-span-5">
                              <Label className="text-[11px] font-semibold text-cyan">
                                Teaching Usthad
                              </Label>
                              <div className="flex items-center gap-1.5">
                                <Input
                                  required
                                  value={slot.teacher}
                                  onChange={(e) => {
                                    const nextSlots = ttDraft[semKey].map((s, sIdx) =>
                                      sIdx === idx ? { ...s, teacher: e.target.value } : s,
                                    )
                                    setTtDraft({ ...ttDraft, [semKey]: nextSlots })
                                  }}
                                  placeholder="Usthad Name"
                                  className="h-9 rounded-xl text-xs"
                                />
                                <ThemeSelect
                                  aria-label={`Select Usthad for ${period.label}`}
                                  value=""
                                  onChange={(e) => {
                                    if (!e.target.value) return
                                    const nextSlots = ttDraft[semKey].map((s, sIdx) =>
                                      sIdx === idx ? { ...s, teacher: e.target.value } : s,
                                    )
                                    setTtDraft({ ...ttDraft, [semKey]: nextSlots })
                                  }}
                                  className="h-9 w-24 shrink-0 rounded-xl border border-input bg-card px-2 text-[11px] font-semibold text-muted-foreground outline-none"
                                >
                                  <option value="">Pick...</option>
                                  <option value="SHAIKHUNA HAMZA USTHAD">
                                    SHAIKHUNA HAMZA USTHAD
                                  </option>
                                  {OFFICIAL_CLASS_USTHADS.map((u) => (
                                    <option key={u.id} value={u.name}>
                                      {u.shortName}
                                    </option>
                                  ))}
                                </ThemeSelect>
                                {ttDraft.periods.length > 1 && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      const nextPeriods = ttDraft.periods
                                        .filter((_, pIdx) => pIdx !== idx)
                                        .map((p, newIdx) => ({
                                          ...p,
                                          label: `Period ${newIdx + 1}`,
                                        }))
                                      const nextSem1 = ttDraft.semester1.filter(
                                        (_, sIdx) => sIdx !== idx,
                                      )
                                      const nextSem2 = ttDraft.semester2.filter(
                                        (_, sIdx) => sIdx !== idx,
                                      )
                                      setTtDraft({
                                        periods: nextPeriods,
                                        semester1: nextSem1,
                                        semester2: nextSem2,
                                      })
                                    }}
                                    title={`Remove ${period.label}`}
                                    className="h-9 shrink-0 rounded-xl px-2.5 text-red-500 hover:bg-red-500/10 hover:text-red-600"
                                  >
                                    <Trash2 className="size-3.5" aria-hidden="true" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      {ttAdminToast ? (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-lime">
                          {ttAdminToast}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Total {ttDraft.periods.length} Periods • Changes apply immediately to Student, Class Leader &amp; Usthad portals
                        </span>
                      )}
                      <Button
                        type="submit"
                        disabled={!isTimetableDirty}
                        className="rounded-xl px-6 text-xs font-semibold disabled:opacity-50"
                      >
                        {isTimetableDirty
                          ? `Save Class ${ttEditClass} Timetable (${ttDraft.periods.length} Periods)`
                          : `Class ${ttEditClass} Timetable Saved ✓`}
                      </Button>
                    </div>
                  </form>
                </Panel>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 3: OFFICIAL HOLIDAYS & NOTICES ==================== */}
        {activeTab === 'notices' && (
          <div className="flex flex-col gap-6">
            <Panel
              id="principal-notice-publisher"
              eyebrow="Notices"
              title="New Notice"
              icon={Megaphone}
            >
              <form onSubmit={handlePublishNotice} className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0095F6]/10 p-3.5">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-foreground">
                      Declare Official Academy Holiday (Monthly 2nd Saturday / Festival Holiday)
                    </span>
                    <span className="text-xs text-muted-foreground">
                      When enabled, official holiday days are automatically deducted from the working days of all {students.length} students for the selected month.
                    </span>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-[#0077CC] dark:text-[#0095F6]">
                    <input
                      type="checkbox"
                      checked={isHolidayNotice}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setIsHolidayNotice(checked)
                        if (checked && !noticeTitle) {
                          setNoticeTitle(
                            'Official Monthly 2nd Saturday Holiday — Departure & Return Schedule',
                          )
                          setNoticeBody(
                            'In observance of the monthly Second Saturday holiday at ICS Academy Manhappatta, students may depart for home on Friday at 12:45 PM after Jumu\'ah prayers and must return to campus before 07:30 AM on Monday.',
                          )
                        }
                      }}
                      className="size-4 accent-[#0095F6]"
                    />
                    Official Holiday Mode
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="pr-notice-title" className="text-xs">
                      Notice / Holiday Title
                    </Label>
                    <Input
                      id="pr-notice-title"
                      required
                      value={noticeTitle}
                      onChange={(e) => setNoticeTitle(e.target.value)}
                      placeholder="e.g. Official Monthly 2nd Saturday Holiday Announcement..."
                      className="h-10 rounded-xl text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pr-notice-category" className="text-xs">
                      Category
                    </Label>
                    <ThemeSelect
                      id="pr-notice-category"
                      value={noticeCategory}
                      onChange={(e) =>
                        setNoticeCategory(e.target.value as Notice['category'])
                      }
                      className="h-10 rounded-xl bg-popover px-3 text-xs font-semibold text-foreground outline-none"
                    >
                      <option value="Academic">Academic</option>
                      <option value="Hostel">Hostel</option>
                      <option value="Exam">Exam</option>
                      <option value="Event">Event</option>
                    </ThemeSelect>
                  </div>
                </div>

                {isHolidayNotice && (
                  <div className="grid gap-3 rounded-2xl bg-muted/45 p-4 sm:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="pr-holiday-month" className="text-xs">
                        Target Month (June – May)
                      </Label>
                      <ThemeSelect
                        id="pr-holiday-month"
                        value={holidayMonthId}
                        onChange={(e) => setHolidayMonthId(e.target.value)}
                        className="h-9 rounded-xl bg-popover px-3 text-xs font-semibold text-foreground outline-none"
                      >
                        {MONTHS_META.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.month} {m.year}
                          </option>
                        ))}
                      </ThemeSelect>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="pr-holiday-deduct" className="text-xs">
                        Holiday Days Excluded from Working Days
                      </Label>
                      <Input
                        id="pr-holiday-deduct"
                        type="number"
                        min={1}
                        max={20}
                        value={holidayDaysDeducted}
                        onChange={(e) => setHolidayDaysDeducted(e.target.value)}
                        className="h-9 rounded-xl font-mono text-xs tabular-nums"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="pr-holiday-type" className="text-xs">
                        Holiday Classification
                      </Label>
                      <ThemeSelect
                        id="pr-holiday-type"
                        value={holidayType}
                        onChange={(e) =>
                          setHolidayType(
                            e.target.value as OfficialHolidayMeta['holidayType'],
                          )
                        }
                        className="h-9 rounded-xl bg-popover px-3 text-xs font-semibold text-foreground outline-none"
                      >
                        <option value="monthly-second-saturday">
                          Monthly 2nd Saturday Leave
                        </option>
                        <option value="festival-holiday">Festival / Special Holiday</option>
                        <option value="custom-holiday">Custom Official Holiday</option>
                      </ThemeSelect>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="pr-dep-date" className="text-xs">
                        Departure Date
                      </Label>
                      <Input
                        id="pr-dep-date"
                        value={holidayDepartureDate}
                        onChange={(e) => setHolidayDepartureDate(e.target.value)}
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="pr-dep-time" className="text-xs">
                        Departure Time
                      </Label>
                      <Input
                        id="pr-dep-time"
                        value={holidayDepartureTime}
                        onChange={(e) => setHolidayDepartureTime(e.target.value)}
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="pr-ret-date" className="text-xs">
                        Return Date & Time
                      </Label>
                      <Input
                        id="pr-ret-date"
                        value={`${holidayReturnDate} • ${holidayReturnTime}`}
                        onChange={(e) => setHolidayReturnDate(e.target.value)}
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pr-notice-body" className="text-xs">
                    Announcement Details
                  </Label>
                  <textarea
                    id="pr-notice-body"
                    required
                    rows={3}
                    value={noticeBody}
                    onChange={(e) => setNoticeBody(e.target.value)}
                    placeholder="Write official principal announcement for all students, leaders, and usthads..."
                    className="rounded-xl bg-popover p-3 text-xs text-foreground outline-none"
                  />
                </div>

                {/* Target Classes Selector */}
                <div className="flex flex-col gap-2.5 rounded-2xl bg-[#0095F6]/[0.08] p-3.5">
                  <div className="flex flex-col gap-0.5">
                    <Label className="text-xs font-bold text-foreground">
                      Target Classes
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Choose whether this notice or official holiday applies to all 11 classes or only selected classes.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                    {(
                      [
                        {
                          id: 'all',
                          label: 'All 11 Classes',
                        },
                        {
                          id: 'high-school',
                          label: 'High School (8th – HS 2)',
                        },
                        {
                          id: 'bs-degree',
                          label: 'BS Degree (BS 1 – BS 5)',
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
                            'flex items-center justify-start gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all active:scale-[0.98]',
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
                    <div className="mt-1 flex flex-col gap-2 rounded-xl bg-popover p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          Select Classes ({noticeCustomBatches.length} selected):
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setNoticeCustomBatches([...ALL_ACADEMY_CLASS_NAMES])}
                            className="text-[11px] font-semibold text-[#0077CC] hover:underline dark:text-[#0095F6]"
                          >
                            Select All 11
                          </button>
                          <span className="text-muted-foreground">·</span>
                          <button
                            type="button"
                            onClick={() => setNoticeCustomBatches([ALL_ACADEMY_CLASS_NAMES[0]])}
                            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
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
                                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all active:scale-[0.97]',
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

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={noticePinned}
                      onChange={(e) => setNoticePinned(e.target.checked)}
                      className="size-4 accent-[#0095F6]"
                    />
                    Pin to top of Campus Notice Board
                  </label>

                  <Button
                    type="submit"
                    disabled={!noticeTitle.trim() || !noticeBody.trim()}
                    className="rounded-full px-6 text-xs font-semibold disabled:opacity-50"
                  >
                    <Megaphone className="mr-1.5 size-3.5" aria-hidden="true" />
                    Publish Official Notice
                  </Button>
                </div>

                {noticeToast && (
                  <p className="rounded-xl bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {noticeToast}
                  </p>
                )}
              </form>

              {customNotices.length > 0 && (
                <div className="mt-6 border-t border-border/40 pt-4">
                  <h4 className="mb-2.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    Manage Published Custom Notices ({customNotices.length})
                  </h4>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {customNotices.map((n) => {
                      const nTargets = getNoticeTargetClasses(n)
                      const nTargetBadge = formatTargetClassesBadge(nTargets)
                      return (
                        <div
                          key={n.id}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-muted/45 p-3 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">{n.title}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span>{n.category}</span>
                              <span>•</span>
                              <span>{n.date}</span>
                              <span>•</span>
                              <span className="font-semibold text-[#0077CC] dark:text-[#0095F6]">{nTargetBadge}</span>
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleNoticePin(n.id)}
                              className="h-7 rounded-lg px-2 text-[11px]"
                            >
                              <Pin className="mr-1 size-3" aria-hidden="true" />
                              {n.pinned ? 'Unpin' : 'Pin'}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteCustomNotice(n.id)}
                              className="h-7 rounded-lg px-2 text-[11px] text-red-500 hover:text-red-600"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </Panel>

            <NoticeBoard />
          </div>
        )}

        {/* ==================== TAB 4: DIGITAL LIBRARY & UNIVERSITY PORTAL ==================== */}
        {activeTab === 'library' && (
          <div className="flex flex-col gap-6">
            <Panel
              id="principal-kitab-uploader"
              eyebrow="Library"
              title="Upload Kitab"
              icon={FileUp}
            >
              <form onSubmit={handleUploadKitabPdf} className="flex flex-col gap-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pr-kitab-title" className="text-xs">
                      Kitab Title
                    </Label>
                    <Input
                      id="pr-kitab-title"
                      required
                      value={kitabTitle}
                      onChange={(e) => setKitabTitle(e.target.value)}
                      placeholder="e.g. Fathul Mueen Sharh Qurrathul Ain"
                      className="h-10 rounded-xl text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pr-kitab-arabic" className="text-xs">
                      Arabic Title (Optional)
                    </Label>
                    <Input
                      id="pr-kitab-arabic"
                      value={kitabArabicTitle}
                      onChange={(e) => setKitabArabicTitle(e.target.value)}
                      placeholder="فتح المعين بشرح قرة العين"
                      className="h-10 rounded-xl text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pr-kitab-author" className="text-xs">
                      Author / Scholar
                    </Label>
                    <Input
                      id="pr-kitab-author"
                      required
                      value={kitabAuthor}
                      onChange={(e) => setKitabAuthor(e.target.value)}
                      placeholder="e.g. Sheikh Zainudheen Makhdoom II"
                      className="h-10 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pr-kitab-cat" className="text-xs">
                      Subject Category
                    </Label>
                    <ThemeSelect
                      id="pr-kitab-cat"
                      value={kitabCategory}
                      onChange={(e) => setKitabCategory(e.target.value as KitabCategory)}
                      className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground"
                    >
                      <option value="fiqh">Fiqh & Usul (الْفِقْهُ وَأُصُولُهُ)</option>
                      <option value="hadith">Hadith Studies (الْحَدِيثُ الشَّرِيفُ)</option>
                      <option value="tafsir">Tafsir & Ulum (التَّفْسِيرُ وَعُلُومُ الْقُرْآنِ)</option>
                      <option value="aqeedah">Aqeedah & Tasawwuf (الْعَقِيدَةُ وَالتَّصَوُّفُ)</option>
                      <option value="nahw">Nahw & Sarf (النَّحْوُ وَالصَّرْفُ)</option>
                      <option value="history">History & Da&apos;wa (التَّارِيخُ وَالدَّعْوَةُ)</option>
                    </ThemeSelect>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pr-kitab-batch" className="text-xs">
                      Target Class
                    </Label>
                    <ThemeSelect
                      id="pr-kitab-batch"
                      value={kitabBatchLabel}
                      onChange={(e) => setKitabBatchLabel(e.target.value)}
                      className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground"
                    >
                      <option value="All Classes">All Classes</option>
                      {CLASS_USTHADS.map((u) => (
                        <option key={u.className} value={u.fullClassLabel}>
                          {u.fullClassLabel}
                        </option>
                      ))}
                    </ThemeSelect>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pr-kitab-pages" className="text-xs">
                      Pages
                    </Label>
                    <Input
                      id="pr-kitab-pages"
                      type="number"
                      value={kitabPages}
                      onChange={(e) => setKitabPages(e.target.value)}
                      className="h-10 rounded-xl font-mono text-xs tabular-nums"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pr-kitab-file" className="text-xs">
                      Attach PDF File (Optional)
                    </Label>
                    <Input
                      ref={fileInputRef}
                      id="pr-kitab-file"
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null
                        setSelectedPdfFile(file)
                        if (file) {
                          void getPdfBlobPageCount(file).then((count) => {
                            if (count) setKitabPages(String(count))
                          })
                        }
                      }}
                      className="h-10 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pr-kitab-summary" className="text-xs">
                    Kitab Description & Study Notes
                  </Label>
                  <Input
                    id="pr-kitab-summary"
                    required
                    value={kitabSummary}
                    onChange={(e) => setKitabSummary(e.target.value)}
                    placeholder="Brief syllabus overview and chapters covered..."
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  {kitabStatusMsg ? (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-lime">
                      {kitabStatusMsg}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Instantly available in Student, Class Leader & Usthad Digital Libraries
                    </span>
                  )}
                  <Button
                    type="submit"
                    disabled={
                      uploadingKitab ||
                      !kitabTitle.trim() ||
                      !kitabAuthor.trim() ||
                      !kitabSummary.trim()
                    }
                    className="rounded-full px-6 text-xs font-semibold disabled:opacity-50"
                  >
                    <Upload className="mr-1.5 size-3.5" aria-hidden="true" />
                    {uploadingKitab ? 'Uploading Kitab...' : 'Add Kitab to Digital Library'}
                  </Button>
                </div>
              </form>

              {localKitabUploads.length > 0 && (
                <div className="mt-5 border-t border-border pt-4">
                  <h4 className="mb-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    Uploaded Custom Kitabs ({localKitabUploads.length})
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {localKitabUploads.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background/60 p-2.5 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{item.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {item.author} • {item.classBatch}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteUploadedKitab(item.id)}
                          className="h-7 rounded-lg px-2 text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>

            <ExamResultCard />

            <DigitalLibrary student={selectedClassRepresentativeStudent} />

            <LibraryBooks />
          </div>
        )}

        {/* MONTHLY TESTS, STAR OF THE MONTH, HOLIDAY & SSF DA'WA LOGS, PRIVATE CONDUCT & ZADUL KHAIR PDF HUB (PRINCIPAL VIEW) */}
        {activeTab === 'monitor' && (
          <UsthadAcademicHub
            actorId={`principal-${principal.usthadId || 'principal'}`}
            actorName={principal.name}
            role="principal"
            activeClassName={selectedClassName}
          />
        )}

        {/* TAB 3: WHATSAPP-STYLE CAMPUS MESSENGER & STAFF ROOM (Kept mounted for live delivery & presence sync) */}
        <div
          className={cn(
            activeTab === 'chat'
              ? 'max-lg:flex max-lg:flex-1 max-lg:min-h-0 max-lg:w-full max-lg:flex-col max-lg:overflow-hidden animate-in fade-in-0 duration-300'
              : 'hidden',
          )}
        >
          <CampusMessenger
            role="principal"
            principal={principal}
            activeClassName={selectedClassName}
            mobileFullScreen
            isMessengerVisible={activeTab === 'chat'}
          />
        </div>
        </main>
      </div>

      {/* PHONE & TABLET INSTAGRAM-STYLE BOTTOM NAVIGATION MENU BAR FOR PRINCIPAL (Hidden on Desktop lg:) */}
      <nav
        aria-label="Principal Mobile & Tablet Bottom Navigation"
        className="z-50 shrink-0 border-t border-border/50 bg-background/95 pb-[var(--safe-bottom)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid h-[60px] max-w-xl grid-cols-5 items-center px-1.5">
          {(
            [
              {
                id: 'monitor',
                label: 'Monitor',
                icon: Building2,
                badge: campusMetrics.periodsNotHeld,
              },
              { id: 'people', label: 'Directory', icon: Users, badge: 0 },
              { id: 'chat', label: 'Chat', icon: MessageCircle, badge: 0 },
              { id: 'notices', label: 'Notices', icon: Megaphone, badge: 0 },
              { id: 'library', label: 'Library', icon: Library, badge: 0 },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id)
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
                    'relative flex h-8 w-12 items-center justify-center rounded-full transition-all duration-150',
                    active && 'bg-foreground/10 dark:bg-white/12',
                  )}
                >
                  <tab.icon
                    className="size-[20px]"
                    strokeWidth={active ? 2.4 : 1.75}
                    aria-hidden="true"
                  />
                  {tab.badge > 0 ? (
                    <span className="absolute -top-0.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 font-mono text-[9.5px] font-bold text-white tabular-nums">
                      {tab.badge}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    'text-[10.5px] leading-none',
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
        initialDate={selectedDate}
        preparedByRole="Principal"
        preparedByName={principal.name}
        preparedById={principal.staffId}
      />
    </div>
  )
}
