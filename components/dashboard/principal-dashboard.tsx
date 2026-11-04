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
import {
  CampusNotificationBar,
  CampusNotificationBell,
} from '@/components/campus-notifications'
import { ClassLeaderAttendanceCard } from '@/components/dashboard/class-leader-attendance-card'
import {
  ABSENT_REASONS,
  ACADEMY_PRINCIPAL,
  ALL_ACADEMY_CLASS_NAMES,
  ATTENDANCE_LEAVE_REASONS,
  BS_DEGREE_CLASS_NAMES,
  CLASS_LEADERS,
  CLASS_USTHADS,
  CURRENT_SEMESTER,
  HIGH_SCHOOL_CLASS_NAMES,
  NOT_HELD_REASONS,
  SHAIKHUNA_HAMZA_USTHAD,
  formatTargetClassesBadge,
  getClassLeadersForClass,
  getClassSemesterTimetable,
  getEffectiveStudentAttendance,
  getNoticeTargetClasses,
  leaveReasons,
  loadAttendanceOverrides,
  loadCustomNotices,
  loadPeriodAttendanceSubmissions,
  publishCampusNotification,
  saveAttendanceOverrides,
  saveCustomNotices,
  savePeriodAttendanceSubmissions,
  students,
  type AttendanceOverrideMap,
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
import { PrincipalSwitcher } from '@/components/dashboard/student-switcher'
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
    const raw = window.localStorage.getItem(`ics_leave_records_${sanitizeId(studentId)}`)
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
    window.localStorage.setItem(
      `ics_leave_records_${sanitizeId(studentId)}`,
      JSON.stringify(entries.slice(0, 50)),
    )
  } catch {
    // Ignore storage quota errors
  }
}

type ExecutiveTab = 'monitor' | 'people' | 'notices' | 'library'
type PeopleSubTab = 'usthads' | 'leaders' | 'students'

export function PrincipalDashboard() {
  const principal = ACADEMY_PRINCIPAL

  const [activeTab, setActiveTab] = useState<ExecutiveTab>('monitor')
  const [peopleSubTab, setPeopleSubTab] = useState<PeopleSubTab>('usthads')
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString)

  // Selected class for deep inspection & period control (defaults to Principal's own assigned class)
  const [selectedClassName, setSelectedClassName] = useState<string>(
    () => principal.assignedClassName || CLASS_USTHADS[0]?.className || 'BS 3 • Batch 07',
  )

  // Quick Mark Not Held / Substitute form state
  const [quickClassName, setQuickClassName] = useState<string>(
    () => principal.assignedClassName || CLASS_USTHADS[0]?.className || 'BS 3 • Batch 07',
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
  const [selectedMonthId, setSelectedMonthId] = useState<string>('2026-10')
  const [editPresent, setEditPresent] = useState<number>(22)
  const [editAbsent, setEditAbsent] = useState<number>(0)
  const [editLeave, setEditLeave] = useState<number>(1)
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
  const [holidayAnnouncedBy, setHolidayAnnouncedBy] = useState(
    `${principal.name} (Principal • ADM-001)`,
  )
  const [noticeToast, setNoticeToast] = useState<string | null>(null)

  // Digital Library Uploader State
  const [localKitabUploads, setLocalKitabUploads] = useState<DigitalKitabItem[]>([])
  const [kitabTitle, setKitabTitle] = useState('')
  const [kitabArabicTitle, setKitabArabicTitle] = useState('')
  const [kitabAuthor, setKitabAuthor] = useState('')
  const [kitabCategory, setKitabCategory] = useState<KitabCategory>('fiqh')
  const [kitabBatchLabel, setKitabBatchLabel] = useState(
    CLASS_USTHADS[0]?.fullClassLabel ?? 'Class 8th • Batch 14',
  )
  const [kitabPages, setKitabPages] = useState('180')
  const [kitabLanguage, setKitabLanguage] = useState('Arabic & Malayalam')
  const [kitabSummary, setKitabSummary] = useState('')
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null)
  const [uploadingKitab, setUploadingKitab] = useState(false)
  const [kitabStatusMsg, setKitabStatusMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    window.addEventListener('storage', refreshAllCampusData)
    return () => {
      window.removeEventListener('ics-period-attendance-updated', refreshAllCampusData)
      window.removeEventListener('ics-attendance-updated', refreshAllCampusData)
      window.removeEventListener('ics-notices-updated', refreshAllCampusData)
      window.removeEventListener('storage', refreshAllCampusData)
    }
  }, [refreshAllCampusData])

  // Enrich all 181 students across all 11 batches
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
  }, [attendanceOverrides, customNotices, campusLeaveMap])

  // Selected class students & representative leader for ClassLeaderAttendanceCard
  const selectedClassUsthad = useMemo(
    () =>
      CLASS_USTHADS.find((u) => u.className === selectedClassName) ?? CLASS_USTHADS[0],
    [selectedClassName],
  )

  const selectedClassStudents = useMemo(
    () => students.filter((s) => s.className === selectedClassName),
    [selectedClassName],
  )

  const selectedClassRepresentativeStudent = useMemo(
    () => selectedClassStudents[0] ?? students[0],
    [selectedClassStudents],
  )

  // Selected student for Monthly Attendance Editor
  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) ?? selectedClassStudents[0] ?? students[0],
    [selectedStudentId, selectedClassStudents],
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
    return CLASS_USTHADS.map((usthad) => {
      const batchStudents = enrichedCampusStudents.filter(
        (item) => item.student.className === usthad.className,
      )
      const repStudent = batchStudents[0]?.student ?? students[0]
      const timetable = getClassSemesterTimetable(repStudent)
      const semesterSlots =
        CURRENT_SEMESTER === 1 ? timetable.semester1 : timetable.semester2
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
        const subKey = `${selectedDate}__${usthad.className}__${periodIndex}`
        const sub = periodSubmissions[subKey]
        const state: 'conducted' | 'not-held' | 'substituted' | 'pending' = sub
          ? (sub.sessionStatus ?? 'conducted')
          : 'pending'

        return {
          periodIndex,
          label: p.label,
          time: p.time,
          subject: slot.subject,
          regularTeacher: slot.teacher,
          submission: sub,
          state,
        }
      })

      const conductedCount = periodCells.filter((c) => c.state === 'conducted').length
      const notHeldCount = periodCells.filter((c) => c.state === 'not-held').length
      const substitutedCount = periodCells.filter((c) => c.state === 'substituted').length

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
        conductedCount,
        notHeldCount,
        substitutedCount,
      }
    })
  }, [enrichedCampusStudents, selectedDate, periodSubmissions])

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

    for (const row of classMatrixRows) {
      periodsConducted += row.conductedCount
      periodsNotHeld += row.notHeldCount
      periodsSubstituted += row.substitutedCount
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
      totalDailyPeriods: CLASS_USTHADS.length * 5,
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
        if (cell.state === 'not-held' || cell.state === 'substituted') {
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
        submittedByLeaderId: principal.staffId,
        submittedByName: principal.name,
        submittedAt: nowIso,
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
        CLASS_USTHADS.find((u) => u.id === quickSubstituteUsthadId) ??
        CLASS_USTHADS.find((u) => u.className !== targetRow.className) ??
        CLASS_USTHADS[0]

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
        submittedByLeaderId: principal.staffId,
        submittedByName: principal.name,
        submittedAt: nowIso,
        records: periodSubmissions[subKey]?.records && Object.keys(periodSubmissions[subKey].records).length > 0
          ? periodSubmissions[subKey].records
          : defaultRecords,
        reasons: periodSubmissions[subKey]?.reasons ?? {},
        sessionStatus: 'substituted',
        notHeldReason: quickNotHeldReason,
        markedNotHeldBy:
          periodSubmissions[subKey]?.markedNotHeldBy ?? `Principal • ${principal.shortName}`,
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
      CLASS_USTHADS.find((u) => u.id === usthadId) ??
      CLASS_USTHADS.find((u) => u.className !== className) ??
      CLASS_USTHADS[0]

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
      submittedByLeaderId: principal.staffId,
      submittedByName: principal.name,
      submittedAt: nowIso,
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
      submittedByLeaderId: principal.staffId,
      submittedByName: principal.name,
      submittedAt: nowIso,
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
    id: 'monitor' | 'people' | 'notices' | 'library'
    label: string
    shortLabel: string
    icon: typeof Building2
  }[] = [
    {
      id: 'monitor',
      label: 'Campus Live Monitor',
      shortLabel: '1. Campus Live Monitor (11 Classes & Unheld Periods)',
      icon: Building2,
    },
    {
      id: 'people',
      label: 'Usthads, Leaders & Students',
      shortLabel: '2. Usthads, Leaders & Students',
      icon: Users,
    },
    {
      id: 'notices',
      label: 'Official Holidays & Notices',
      shortLabel: '3. Official Holidays & Notices',
      icon: Megaphone,
    },
    {
      id: 'library',
      label: 'Digital Library & Portal',
      shortLabel: '4. Digital Library & Portal',
      icon: Library,
    },
  ]

  return (
    <div className="min-h-svh bg-background text-foreground transition-colors duration-300 dark:bg-gradient-to-br dark:from-[#081E21] dark:to-[#040F11] max-lg:fixed max-lg:inset-0 max-lg:flex max-lg:flex-col max-lg:overflow-hidden lg:pl-64">
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
                  'group flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-200',
                  isActive
                    ? 'bg-lime/15 font-semibold text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span className="flex items-center gap-3">
                  <item.icon
                    className={cn(
                      'size-4 transition-colors',
                      isActive ? 'text-lime' : 'group-hover:text-lime',
                    )}
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

        <div className="border-t border-border p-4">
          <Link
            href="/"
            onClick={(event) => {
              event.preventDefault()
              handleSignOut()
            }}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Log out
          </Link>
        </div>
      </aside>

      {/* Top Sticky Header (Matches Student & Usthad Header with Profile Switcher) */}
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
              Principal Dashboard
            </p>
            <p className="text-sm font-medium text-foreground">
              Academic Year 2026–27 · All 11 Classes
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <AppUpdateButton />
            <CampusNotificationBell />
            <ThemeToggle className="text-foreground/85 hover:text-foreground dark:text-white/90 dark:hover:text-white" />
            <PrincipalSwitcher principal={principal} />
          </div>
        </div>

        {/* Executive Section Switcher Bar (Desktop Only — Replaced by Bottom Navigation Bar on Phone/Tablet) */}
        <nav aria-label="Principal control sections" className="hidden border-t border-border lg:block">
          <ul className="flex gap-1.5 overflow-x-auto px-3 py-2 md:px-8 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {principalNavItems.map((item) => (
              <li key={item.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0',
                    activeTab === item.id
                      ? 'bg-lime text-background font-semibold shadow-sm'
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

      <div className="max-lg:flex-1 max-lg:min-h-0 max-lg:w-full max-lg:overflow-y-auto max-lg:overflow-x-hidden max-lg:overscroll-y-contain">
        <CampusNotificationBar />

        <main className="mx-auto flex max-w-7xl flex-col gap-5 px-3.5 py-5 sm:gap-6 sm:px-5 sm:py-7 md:px-8 md:py-10">
        {/* Executive Banner & 6 Live Campus Telemetry KPIs — Shown on Monitor Tab on Phone/Tablet, Always Shown on Desktop */}
        <section
          className={cn(
            'relative overflow-hidden rounded-2xl border border-border bg-card/65 p-5 sm:p-6',
            activeTab !== 'monitor' && 'hidden lg:block',
          )}
        >
          <div className="flex flex-col justify-between gap-4 border-b border-border/70 pb-5 lg:flex-row lg:items-center">
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-lime/40 bg-lime/15 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-lime uppercase">
                  <Award className="size-3.5" aria-hidden="true" />
                  Principal Executive Command Center
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-cyan/40 bg-cyan/15 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-cyan uppercase">
                  <GraduationCap className="size-3.5" aria-hidden="true" />
                  Class Usthad • {principal.assignedClassName} ({principal.usthadStaffId})
                </span>
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  Date: {selectedDate} • Semester {CURRENT_SEMESTER}
                </span>
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {principal.name}
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                {principal.designation} • Full administrative oversight of all 11 classes &amp; Class Usthad of {principal.assignedClassName}.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-8 items-center gap-2 rounded-xl border border-border bg-background/80 px-3">
                <CalendarClock className="size-3.5 text-lime" aria-hidden="true" />
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
                className="rounded-xl border border-cyan/50 bg-cyan text-xs font-bold text-slate-950 hover:bg-cyan/90"
              >
                <BookOpen className="mr-1.5 size-3.5" aria-hidden="true" />
                My Class Usthad Workspace ({principal.assignedClassName})
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPdfReportStudent(selectedStudent)}
                className="rounded-xl border-cyan/40 bg-cyan/10 text-xs font-semibold text-cyan hover:bg-cyan/20"
              >
                <FileText className="mr-1.5 size-3.5" aria-hidden="true" />
                Open Parent PDF Report
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setActiveTab('notices')
                  setIsHolidayNotice(true)
                }}
                className="rounded-xl text-xs font-semibold"
              >
                <CalendarClock className="mr-1.5 size-3.5" aria-hidden="true" />
                Announce Official Holiday
              </Button>
            </div>
          </div>

          {/* 6 High-Density Tabular KPI Strip */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-border bg-background/60 p-3.5">
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Campus Strength
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
                {campusMetrics.totalStudents}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                Across {campusMetrics.totalBatches} Batches (B14–B05)
              </p>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
              <p className="text-[11px] font-semibold tracking-wider text-emerald-700 uppercase dark:text-lime">
                Campus Attendance
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-emerald-700 tabular-nums dark:text-lime">
                {campusMetrics.avgRate}%
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                {campusMetrics.inCampusNow} Present in Campus
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
              <p className="text-[11px] font-semibold tracking-wider text-amber-700 uppercase dark:text-amber-300">
                Students on Leave
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-amber-700 tabular-nums dark:text-amber-300">
                {campusMetrics.onLeaveNow}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Active Leave Register
              </p>
            </div>

            <div className="rounded-xl border border-border bg-background/60 p-3.5">
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Periods Conducted
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
                {campusMetrics.periodsConducted}/{campusMetrics.totalDailyPeriods}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                On {selectedDate}
              </p>
            </div>

            <div
              className={cn(
                'rounded-xl border p-3.5',
                campusMetrics.periodsNotHeld > 0
                  ? 'border-red-500/50 bg-red-500/15'
                  : 'border-border bg-background/60',
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
                Classes Not Held
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
                Periods not taken by Usthad
              </p>
            </div>

            <div className="rounded-xl border border-cyan/30 bg-cyan/10 p-3.5">
              <p className="text-[11px] font-semibold tracking-wider text-cyan uppercase">
                Substituted Periods
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-cyan tabular-nums">
                {campusMetrics.periodsSubstituted}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Taken by Substitute Usthad
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
              eyebrow="Usthad Class Session Governance • Unheld Period Control"
              title="Unheld Periods & Substitute Usthad Command Center"
              icon={ShieldAlert}
              action={
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-600 dark:text-red-400 tabular-nums">
                  <Ban className="size-3.5" aria-hidden="true" />
                  {campusMetrics.periodsNotHeld} Unheld • {campusMetrics.periodsSubstituted} Substituted
                </span>
              }
            >
              <div className="flex flex-col gap-5">
                {/* Principal Quick Action Bar to Record Class Not Held or Assign Substitute */}
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="mb-3 flex flex-col gap-1">
                    <h3 className="text-xs font-bold tracking-wider text-foreground uppercase">
                      Quick Period Session Override
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Record if a regular Usthad did not take a period or assign a substitute Usthad. Student attendance is automatically locked for periods marked as Class Not Held.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="quick-class-select" className="text-xs">
                        Select Class / Batch
                      </Label>
                      <select
                        id="quick-class-select"
                        value={quickClassName}
                        onChange={(e) => setQuickClassName(e.target.value)}
                        className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {CLASS_USTHADS.map((u) => (
                          <option key={u.className} value={u.className}>
                            {u.className} ({u.shortName})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="quick-period-select" className="text-xs">
                        Select Period (1–5)
                      </Label>
                      <select
                        id="quick-period-select"
                        value={quickPeriodIndex}
                        onChange={(e) => setQuickPeriodIndex(Number(e.target.value))}
                        className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {[1, 2, 3, 4, 5].map((pIdx) => (
                          <option key={pIdx} value={pIdx}>
                            Period {pIdx}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="quick-reason-select" className="text-xs">
                        Reason
                      </Label>
                      <select
                        id="quick-reason-select"
                        value={quickNotHeldReason}
                        onChange={(e) => setQuickNotHeldReason(e.target.value)}
                        className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {NOT_HELD_REASONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="quick-sub-select" className="text-xs">
                        Substitute Usthad (Optional)
                      </Label>
                      <select
                        id="quick-sub-select"
                        value={quickSubstituteUsthadId}
                        onChange={(e) => setQuickSubstituteUsthadId(e.target.value)}
                        className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">-- Select Substitute Usthad --</option>
                        {CLASS_USTHADS.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.staffId})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
                    {sessionActionToast ? (
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-lime">
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
                        onClick={() => handlePrincipalQuickPeriodAction('not-held')}
                        className="rounded-xl bg-red-600 text-xs font-semibold text-white hover:bg-red-700"
                      >
                        <Ban className="mr-1.5 size-3.5" aria-hidden="true" />
                        Mark Period as Class Not Held (Lock Attendance)
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handlePrincipalQuickPeriodAction('substituted')}
                        className="rounded-xl border-cyan/50 bg-cyan/10 text-xs font-semibold text-cyan hover:bg-cyan/20"
                      >
                        <UserCog className="mr-1.5 size-3.5" aria-hidden="true" />
                        Assign Substitute Usthad & Unlock
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Live Feed of Unheld & Substituted Periods */}
                {unheldAndSubstitutedPeriods.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background/40 px-6 py-8 text-center">
                    <CheckCircle2 className="size-8 text-emerald-500 dark:text-lime" aria-hidden="true" />
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
                            'flex flex-col justify-between gap-3 rounded-2xl border p-4',
                            isNotHeld
                              ? 'border-red-500/40 bg-red-500/[0.06]'
                              : 'border-cyan/40 bg-cyan/[0.06]',
                          )}
                        >
                          <div className="flex flex-col gap-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="rounded-md bg-foreground/10 px-2 py-0.5 text-xs font-bold text-foreground">
                                  {row.className}
                                </span>
                                <span className="text-xs font-bold text-lime uppercase">
                                  {cell.label} ({cell.time})
                                </span>
                              </div>

                              {isNotHeld ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/20 px-2.5 py-0.5 text-[11px] font-bold text-red-600 dark:text-red-300">
                                  <Lock className="size-3" aria-hidden="true" />
                                  Class Not Held • Attendance Locked
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full border border-cyan/40 bg-cyan/20 px-2.5 py-0.5 text-[11px] font-bold text-cyan">
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

                            <div className="mt-1 rounded-xl border border-border/70 bg-background/70 p-2.5 text-xs">
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
                                <p className="mt-1 font-semibold text-cyan">
                                  Substitute Usthad: {cell.submission.substituteUsthad.usthadName} (Assigned by{' '}
                                  {cell.submission.substituteUsthad.assignedBy})
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                            <select
                              aria-label={`Assign substitute Usthad for ${row.className} ${cell.label}`}
                              value={defaultSubUsthadId}
                              onChange={(e) =>
                                setSubstituteSelectionMap((prev) => ({
                                  ...prev,
                                  [subKey]: e.target.value,
                                }))
                              }
                              className="h-9 flex-1 rounded-xl border border-input bg-background px-2.5 text-xs font-semibold text-foreground outline-none"
                            >
                              {CLASS_USTHADS.map((u) => (
                                <option key={u.id} value={u.id}>
                                  Sub: {u.name} ({u.staffId})
                                </option>
                              ))}
                            </select>

                            <div className="flex items-center gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() =>
                                  handleAssignSubstituteToUnheldPeriod(
                                    row.className,
                                    cell.periodIndex,
                                    defaultSubUsthadId,
                                  )
                                }
                                className="h-9 rounded-xl bg-cyan px-3 text-xs font-semibold text-slate-950 hover:bg-cyan/90 whitespace-nowrap"
                              >
                                <UserCog className="mr-1 size-3.5" aria-hidden="true" />
                                Assign Substitute
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleRestoreNormalPeriod(row.className, cell.periodIndex)
                                }
                                className="h-9 rounded-xl px-2.5 text-xs font-medium whitespace-nowrap"
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
              eyebrow={`All 11 Batches Live Matrix • ${selectedDate}`}
              title="11-Class Period Session & Attendance Overview"
              icon={Building2}
              action={
                <span className="text-xs font-medium text-muted-foreground">
                  Click any class row to inspect & control periods below
                </span>
              }
            >
              <div className="overflow-x-auto rounded-2xl border border-border bg-background/50">
                <table className="w-full min-w-[920px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                      <th className="px-3.5 py-3">Class & Batch</th>
                      <th className="px-3.5 py-3">Class Usthad</th>
                      <th className="px-3.5 py-3">Class Leaders (CL & ACL)</th>
                      <th className="px-3 py-3 text-right">Students</th>
                      <th className="px-3 py-3 text-right">Avg Rate</th>
                      <th className="px-3.5 py-3 text-center">
                        5 Periods Status ({selectedDate})
                      </th>
                      <th className="px-3.5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
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
                            'cursor-pointer transition-colors hover:bg-muted/30',
                            isSelected && 'bg-lime/[0.08]',
                          )}
                        >
                          <td className="px-3.5 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'size-2 rounded-full',
                                  row.notHeldCount > 0
                                    ? 'bg-red-500'
                                    : isSelected
                                      ? 'bg-lime'
                                      : 'bg-emerald-500',
                                )}
                              />
                              <div>
                                <p className="font-display text-sm font-bold text-foreground">
                                  {row.className}
                                </p>
                                <p className="text-[11px] text-muted-foreground tabular-nums">
                                  {row.inCampusCount} In Campus • {row.onLeaveCount} Leave
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-3.5 py-3">
                            <p className="font-semibold text-foreground">{row.usthad.name}</p>
                            <p className="text-[11px] text-lime tabular-nums">
                              {row.usthad.staffId} • {row.usthad.specialization.split('&')[0]}
                            </p>
                          </td>

                          <td className="px-3.5 py-3">
                            <div className="flex flex-col gap-0.5">
                              {row.leaders.map((cl) => (
                                <span
                                  key={cl.leaderId}
                                  className="text-[11px] text-muted-foreground"
                                >
                                  <strong className="text-cyan">{cl.leaderId}:</strong>{' '}
                                  {cl.studentName}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="px-3 py-3 text-right font-mono font-semibold text-foreground tabular-nums">
                            {row.totalStudents}
                          </td>

                          <td className="px-3 py-3 text-right font-mono font-bold text-emerald-600 tabular-nums dark:text-lime">
                            {row.avgAttendance}%
                          </td>

                          <td className="px-3.5 py-3">
                            <div className="flex items-center justify-center gap-1.5">
                              {row.periodCells.map((cell) => (
                                <span
                                  key={cell.periodIndex}
                                  title={`${cell.label}: ${cell.subject} (${cell.regularTeacher}) — ${cell.state.toUpperCase()}`}
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold tabular-nums',
                                    cell.state === 'conducted'
                                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-lime'
                                      : cell.state === 'not-held'
                                        ? 'border-red-500/50 bg-red-500/20 text-red-600 dark:text-red-400'
                                        : cell.state === 'substituted'
                                          ? 'border-cyan/50 bg-cyan/20 text-cyan'
                                          : 'border-border bg-background/80 text-muted-foreground',
                                  )}
                                >
                                  P{cell.periodIndex}
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
                              className="h-8 rounded-xl px-3 text-xs font-semibold whitespace-nowrap"
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
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-lime/40 bg-lime/10 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="rounded-lg bg-lime px-2.5 py-1 text-xs font-bold text-background uppercase">
                    Selected Class Control
                  </span>
                  <h2 className="font-display text-lg font-bold text-foreground">
                    {selectedClassName} — Usthad: {selectedClassUsthad.name} ({selectedClassUsthad.staffId})
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="switch-inspect-class" className="text-xs font-semibold">
                    Switch Class:
                  </Label>
                  <select
                    id="switch-inspect-class"
                    value={selectedClassName}
                    onChange={(e) => {
                      setSelectedClassName(e.target.value)
                      const firstSt = students.find((s) => s.className === e.target.value)
                      if (firstSt) setSelectedStudentId(firstSt.id)
                    }}
                    className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none"
                  >
                    {CLASS_USTHADS.map((u) => (
                      <option key={u.className} value={u.className}>
                        {u.className} ({u.shortName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <ClassLeaderAttendanceCard
                leader={selectedClassRepresentativeStudent}
                leaderId={principal.staffId}
                eyebrowLabel={`Principal Direct Period & Session Control • ${selectedClassName}`}
                submittedByNameOverride={`${principal.name} (Principal)`}
                highlightLeaderBadge={false}
                actorRoleLabel="Principal"
                controlledDate={selectedDate}
                onControlledDateChange={setSelectedDate}
              />
            </div>
          </div>
        )}

        {/* ==================== TAB 2: USTHADS, LEADERS & STUDENTS ==================== */}
        {activeTab === 'people' && (
          <div className="flex flex-col gap-6">
            {/* Sub-navigation between 11 Usthads, 22 Class Leaders, and 181 Students */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPeopleSubTab('usthads')}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition-all',
                    peopleSubTab === 'usthads'
                      ? 'border-lime bg-lime/20 text-lime'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground',
                  )}
                >
                  <GraduationCap className="size-4" aria-hidden="true" />
                  11 Class Usthads
                </button>

                <button
                  type="button"
                  onClick={() => setPeopleSubTab('leaders')}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition-all',
                    peopleSubTab === 'leaders'
                      ? 'border-cyan bg-cyan/20 text-cyan'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground',
                  )}
                >
                  <UserCheck className="size-4" aria-hidden="true" />
                  22 Class Leaders (CL & ACL)
                </button>

                <button
                  type="button"
                  onClick={() => setPeopleSubTab('students')}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition-all',
                    peopleSubTab === 'students'
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-600 dark:text-lime'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Users className="size-4" aria-hidden="true" />
                  {students.length} Students & Monthly Attendance / Leave Control
                </button>
              </div>

              <span className="text-xs text-muted-foreground">
                Full Administrative Authority • Principal ({principal.staffId})
              </span>
            </div>

            {/* SUB-TAB 1: SUPREME SCHOLAR (SHAIKHUNA HAMZA USTHAD) & 11 CLASS USTHADS */}
            {peopleSubTab === 'usthads' && (
              <div className="flex flex-col gap-6">
                {/* Supreme Scholar Highlight Card: Shaikhuna Manhappatta Hamza Usthad */}
                <div className="relative overflow-hidden rounded-2xl border-2 border-lime/50 bg-gradient-to-br from-lime/[0.14] via-card to-cyan/[0.10] p-5 sm:p-6 shadow-lg">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-lime/50 bg-lime px-3 py-0.5 text-[11px] font-extrabold tracking-wider text-slate-950 uppercase">
                          <Crown className="size-3.5" aria-hidden="true" />
                          {SHAIKHUNA_HAMZA_USTHAD.honorificTitle}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan/40 bg-cyan/15 px-3 py-0.5 text-xs font-bold text-cyan">
                          എല്ലാ ഉസ്താദുമാർക്കും മുകളിലുള്ള പ്രധാന ഉസ്താദ്
                        </span>
                      </div>

                      <div className="mt-1">
                        <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
                          {SHAIKHUNA_HAMZA_USTHAD.name}
                        </h2>
                        <p className="mt-0.5 text-sm font-semibold text-lime">
                          {SHAIKHUNA_HAMZA_USTHAD.malayalamName} • {SHAIKHUNA_HAMZA_USTHAD.designation}
                        </p>
                      </div>

                      <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
                        {SHAIKHUNA_HAMZA_USTHAD.description}
                      </p>

                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          VALIYA 2 Batches (വലിയ രണ്ട് ബാച്ചുകളിലെ ക്ലാസുകൾ):
                        </span>
                        {SHAIKHUNA_HAMZA_USTHAD.valiyaBatches.map((batchName) => (
                          <button
                            key={batchName}
                            type="button"
                            onClick={() => {
                              setSelectedClassName(batchName)
                              setActiveTab('monitor')
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-lime/40 bg-background/85 px-3 py-1.5 text-xs font-bold text-lime transition-colors hover:bg-lime hover:text-slate-950"
                          >
                            <BookOpen className="size-3.5" aria-hidden="true" />
                            {batchName} (Valiya Batch)
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 rounded-2xl border border-border/80 bg-background/75 p-4 text-xs lg:min-w-[260px]">
                      <p className="text-[11px] font-bold tracking-wider text-lime uppercase">
                        Senior Dars Specialization
                      </p>
                      <p className="font-semibold text-foreground">
                        {SHAIKHUNA_HAMZA_USTHAD.specialization}
                      </p>
                      <div className="h-px bg-border/70" />
                      <p className="text-[11px] text-muted-foreground">
                        Senior Kitabs: <strong className="text-foreground">Sahih al-Bukhari &amp; Tuhfat al-Muhtaj</strong>
                      </p>
                    </div>
                  </div>
                </div>

                <Panel
                  id="principal-usthads-panel"
                  eyebrow="Official Faculty & Class Usthad Roster (ICS Academy Manhappatta)"
                  title="Shaikhuna & All 10 Usthads (Manager, Principal, Swadr & Class Usthads)"
                  icon={GraduationCap}
                >
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {classMatrixRows.map((row) => {
                      const u = row.usthad
                      const roleBadgeTone =
                        u.institutionalRole === 'Supreme Scholar (Shaikhuna)'
                          ? 'border-lime bg-lime text-slate-950'
                          : u.institutionalRole === 'Principal'
                            ? 'border-cyan/50 bg-cyan/20 text-cyan'
                            : u.institutionalRole === 'Manager'
                              ? 'border-amber-500/50 bg-amber-500/20 text-amber-500'
                              : u.institutionalRole === 'Swadr'
                                ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-500 dark:text-lime'
                                : 'border-border bg-muted/60 text-muted-foreground'

                      return (
                        <div
                          key={u.id}
                          className={cn(
                            'flex flex-col justify-between gap-4 rounded-2xl border bg-background/60 p-4 transition-colors hover:border-lime/40',
                            u.isPrincipalRole
                              ? 'border-cyan/50 bg-cyan/[0.04]'
                              : u.institutionalRole === 'Supreme Scholar (Shaikhuna)'
                                ? 'border-lime/50 bg-lime/[0.05]'
                                : 'border-border',
                          )}
                        >
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="rounded-lg border border-lime/40 bg-lime/15 px-2.5 py-0.5 text-xs font-bold text-lime tabular-nums">
                                  {u.staffId}
                                </span>
                                {u.institutionalRole && (
                                  <span
                                    className={cn(
                                      'rounded-lg border px-2 py-0.5 text-[11px] font-bold',
                                      roleBadgeTone,
                                    )}
                                  >
                                    {u.institutionalRole}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-semibold text-cyan">
                                {u.className}
                              </span>
                            </div>

                            <div>
                              <h3 className="font-display text-lg font-bold text-foreground">
                                {u.name}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                {u.designation} • {u.fullClassLabel}
                              </p>
                            </div>

                            <p className="text-xs font-medium text-foreground/90">
                              Specialization: <span className="text-muted-foreground">{u.specialization}</span>
                            </p>

                            <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/70 bg-card/60 p-2.5 text-center text-xs">
                              <div>
                                <span className="block text-[10px] text-muted-foreground">Conducted</span>
                                <span className="font-mono font-bold text-emerald-600 dark:text-lime tabular-nums">
                                  {row.conductedCount}/5
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
                              Batch Code: B-{u.batchCode} • Staff ID: {u.staffId}
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
                                className="rounded-xl border-cyan/40 bg-cyan/10 text-xs font-semibold text-cyan hover:bg-cyan/20"
                              >
                                Usthad View
                              </Button>
                            )}
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
              </div>
            )}

            {/* SUB-TAB 2: 22 CLASS LEADERS */}
            {peopleSubTab === 'leaders' && (
              <Panel
                id="principal-leaders-panel"
                eyebrow="Main & Assistant Class Leaders (CL-14..05 & ACL-14..05)"
                title="All 22 Authorized Class Leaders"
                icon={UserCheck}
              >
                <div className="overflow-x-auto rounded-2xl border border-border bg-background/50">
                  <table className="w-full min-w-[780px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                        <th className="px-4 py-3">Leader ID</th>
                        <th className="px-4 py-3">Role Title</th>
                        <th className="px-4 py-3">Student Name</th>
                        <th className="px-4 py-3">Admission No.</th>
                        <th className="px-4 py-3">Class & Batch</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {CLASS_LEADERS.map((cl) => {
                        const studentObj =
                          students.find((s) => s.id === cl.studentId) ?? students[0]
                        return (
                          <tr key={cl.leaderId} className="hover:bg-muted/25">
                            <td className="px-4 py-3 font-mono font-bold text-cyan tabular-nums">
                              {cl.leaderId}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  'rounded-md px-2 py-0.5 text-[11px] font-semibold',
                                  cl.roleTitle === 'Main Class Leader'
                                    ? 'bg-lime/15 text-lime'
                                    : 'bg-cyan/15 text-cyan',
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
                                  onClick={() => setPdfReportStudent(studentObj)}
                                  className="h-8 rounded-xl border-cyan/40 bg-cyan/10 px-2.5 text-xs font-semibold text-cyan hover:bg-cyan/20"
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
            )}

            {/* SUB-TAB 3: 181 STUDENTS DIRECTORY, MONTHLY ATTENDANCE EDITOR & LEAVE CONTROL */}
            {peopleSubTab === 'students' && (
              <div className="flex flex-col gap-6">
                {/* Monthly Attendance Override Editor + Campus Leave Action side by side */}
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Monthly Attendance Editor */}
                  <Panel
                    id="principal-monthly-editor"
                    eyebrow="Principal Attendance Authority"
                    title="Student Monthly Attendance Override"
                    icon={CalendarCheck}
                  >
                    <form onSubmit={handleSaveMonthAttendance} className="flex flex-col gap-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-edit-student" className="text-xs">
                            Select Student (All {students.length} Students)
                          </Label>
                          <select
                            id="pr-edit-student"
                            value={selectedStudentId}
                            onChange={(e) => setSelectedStudentId(e.target.value)}
                            className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none"
                          >
                            {students.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.admissionNo} • {s.className})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-edit-month" className="text-xs">
                            Select Month (2026)
                          </Label>
                          <select
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
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-present-days" className="text-xs text-emerald-600 dark:text-lime">
                            Present Days
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
                            Absent Days
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
                            Personal Leave Days
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
                          <select
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
                          </select>
                        </div>
                      )}

                      {editLeave > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-leave-reason" className="text-xs text-amber-500">
                            Leave Reason
                          </Label>
                          <select
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
                          </select>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-3 pt-1">
                        {attendanceSavedToast ? (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-lime">
                            {attendanceSavedToast}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Updates Student & Parent Report immediately
                          </span>
                        )}
                        <Button type="submit" size="sm" className="rounded-xl text-xs font-semibold">
                          Save Monthly Attendance
                        </Button>
                      </div>
                    </form>
                  </Panel>

                  {/* Campus Leave Register Action */}
                  <Panel
                    id="principal-leave-control"
                    eyebrow="Campus Gate & Leave Movement Control"
                    title="Record Student Leave or Campus Return"
                    icon={ClipboardCheck}
                  >
                    <form onSubmit={handleSubmitLeaveForm} className="flex flex-col gap-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-leave-student" className="text-xs">
                            Select Student
                          </Label>
                          <select
                            id="pr-leave-student"
                            value={leaveStudentId}
                            onChange={(e) => setLeaveStudentId(e.target.value)}
                            className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none"
                          >
                            {students.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.admissionNo} • {s.className})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-leave-action" className="text-xs">
                            Movement Type
                          </Label>
                          <select
                            id="pr-leave-action"
                            value={leaveActionType}
                            onChange={(e) =>
                              setLeaveActionType(e.target.value as 'application' | 'return')
                            }
                            className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none"
                          >
                            <option value="application">Grant Leave Departure</option>
                            <option value="return">Verify Campus Return</option>
                          </select>
                        </div>
                      </div>

                      {leaveActionType === 'application' && (
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="pr-leave-reason-select" className="text-xs">
                            Leave Category
                          </Label>
                          <select
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
                          </select>
                        </div>
                      )}

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="pr-leave-notes" className="text-xs">
                          Principal Remarks / Gate Pass Note
                        </Label>
                        <Input
                          id="pr-leave-notes"
                          value={leaveDetails}
                          onChange={(e) => setLeaveDetails(e.target.value)}
                          placeholder="e.g. Sanctioned by Principal with parent phone confirmation..."
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
                            Currently {campusMetrics.onLeaveNow} students on leave across campus
                          </span>
                        )}
                        <Button type="submit" size="sm" className="rounded-xl text-xs font-semibold">
                          Record Leave / Return
                        </Button>
                      </div>
                    </form>
                  </Panel>
                </div>

                {/* All 181 Students Master Directory */}
                <Panel
                  id="principal-student-directory"
                  eyebrow={`Complete Institutional Roster (${students.length} Students)`}
                  title="Campus Student Directory & Parent Report Control"
                  icon={Users}
                  action={
                    <span className="text-xs font-semibold text-lime tabular-nums">
                      Showing {filteredDirectoryStudents.length} of {students.length} Students
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
                        <select
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
                        </select>

                        <select
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
                        </select>
                      </div>
                    </div>

                    <div className="max-h-[540px] overflow-y-auto rounded-2xl border border-border bg-background/50">
                      <table className="w-full min-w-[820px] border-collapse text-left text-xs">
                        <thead className="sticky top-0 z-10 border-b border-border bg-card">
                          <tr className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                            <th className="px-3.5 py-3">Student Name</th>
                            <th className="px-3.5 py-3">Admission No.</th>
                            <th className="px-3.5 py-3">Class & Batch</th>
                            <th className="px-3 py-3 text-right">Attendance</th>
                            <th className="px-3.5 py-3">Campus Status</th>
                            <th className="px-3.5 py-3 text-right">Principal Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filteredDirectoryStudents.map((item) => (
                            <tr key={item.student.id} className="hover:bg-muted/25">
                              <td className="px-3.5 py-2.5 font-semibold text-foreground">
                                {item.student.name}
                              </td>
                              <td className="px-3.5 py-2.5 font-mono text-muted-foreground tabular-nums">
                                {item.student.admissionNo}
                              </td>
                              <td className="px-3.5 py-2.5 text-foreground">
                                {item.student.className}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600 tabular-nums dark:text-lime">
                                {item.overallRate}%
                              </td>
                              <td className="px-3.5 py-2.5">
                                {item.isOnLeave ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-300">
                                    On Leave ({item.activeLeaveEntry?.reason})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-lime">
                                    In Academy
                                  </span>
                                )}
                              </td>
                              <td className="px-3.5 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedStudentId(item.student.id)
                                      setLeaveStudentId(item.student.id)
                                      window.scrollTo({ top: 240, behavior: 'smooth' })
                                    }}
                                    className="h-7 rounded-lg px-2.5 text-[11px] font-semibold"
                                  >
                                    Edit Attendance / Leave
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => setPdfReportStudent(item.student)}
                                    className="h-7 rounded-lg bg-cyan px-2.5 text-[11px] font-semibold text-slate-950 hover:bg-cyan/90"
                                  >
                                    <FileText className="mr-1 size-3" aria-hidden="true" />
                                    Parent PDF
                                  </Button>
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
          </div>
        )}

        {/* ==================== TAB 3: OFFICIAL HOLIDAYS & NOTICES ==================== */}
        {activeTab === 'notices' && (
          <div className="flex flex-col gap-6">
            <Panel
              id="principal-notice-publisher"
              eyebrow="Principal Official Broadcast & Holiday Declaration"
              title="Announce Official Holidays & Campus Notices"
              icon={Megaphone}
            >
              <form onSubmit={handlePublishNotice} className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-lime/30 bg-lime/10 p-3.5">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-foreground">
                      Declare Official Academy Holiday (Monthly 2nd Saturday / Festival Holiday)
                    </span>
                    <span className="text-xs text-muted-foreground">
                      When enabled, official holiday days are automatically deducted from the working days of all {students.length} students for the selected month.
                    </span>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-lime">
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
                      className="size-4 accent-lime"
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
                    <select
                      id="pr-notice-category"
                      value={noticeCategory}
                      onChange={(e) =>
                        setNoticeCategory(e.target.value as Notice['category'])
                      }
                      className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none"
                    >
                      <option value="Academic">Academic</option>
                      <option value="Hostel">Hostel</option>
                      <option value="Exam">Exam</option>
                      <option value="Event">Event</option>
                    </select>
                  </div>
                </div>

                {isHolidayNotice && (
                  <div className="grid gap-3 rounded-2xl border border-border bg-background/60 p-4 sm:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="pr-holiday-month" className="text-xs">
                        Target Month (2026)
                      </Label>
                      <select
                        id="pr-holiday-month"
                        value={holidayMonthId}
                        onChange={(e) => setHolidayMonthId(e.target.value)}
                        className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground"
                      >
                        <option value="2026-01">January 2026</option>
                        <option value="2026-02">February 2026</option>
                        <option value="2026-03">March 2026</option>
                        <option value="2026-04">April 2026</option>
                        <option value="2026-05">May 2026</option>
                        <option value="2026-06">June 2026</option>
                        <option value="2026-07">July 2026</option>
                        <option value="2026-08">August 2026</option>
                        <option value="2026-09">September 2026</option>
                        <option value="2026-10">October 2026</option>
                        <option value="2026-11">November 2026</option>
                        <option value="2026-12">December 2026</option>
                      </select>
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
                      <select
                        id="pr-holiday-type"
                        value={holidayType}
                        onChange={(e) =>
                          setHolidayType(
                            e.target.value as OfficialHolidayMeta['holidayType'],
                          )
                        }
                        className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground"
                      >
                        <option value="monthly-second-saturday">
                          Monthly 2nd Saturday Leave
                        </option>
                        <option value="festival-holiday">Festival / Special Holiday</option>
                        <option value="custom-holiday">Custom Official Holiday</option>
                      </select>
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
                    className="rounded-xl border border-input bg-background p-3 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                {/* Target Batches / Classes Selector */}
                <div className="flex flex-col gap-2.5 rounded-2xl border border-cyan/30 bg-cyan/[0.05] p-3.5">
                  <div className="flex flex-col gap-0.5">
                    <Label className="text-xs font-bold text-foreground">
                      Target Batches / Classes (ആർക്കാണ് ഈ അറിയിപ്പ് / ലീവ് ബാധകം?)
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Choose whether this notice or official holiday applies to all 11 batches or only selected batches (other batches will continue normal classes).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                    {(
                      [
                        {
                          id: 'all',
                          label: 'All 11 Batches (എല്ലാ ബാച്ചുകൾക്കും)',
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
                          label: 'Select Specific Batches (തിരഞ്ഞെടുത്തവ)',
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
                            'flex items-center justify-start gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-all',
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
                    <div className="mt-1 flex flex-col gap-2 rounded-xl border border-border/70 bg-background/80 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          Select Batches ({noticeCustomBatches.length} selected):
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setNoticeCustomBatches([...ALL_ACADEMY_CLASS_NAMES])}
                            className="text-[11px] font-semibold text-cyan hover:underline"
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
                                'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all',
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

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={noticePinned}
                      onChange={(e) => setNoticePinned(e.target.checked)}
                      className="size-4 accent-lime"
                    />
                    Pin to top of Campus Notice Board
                  </label>

                  <Button type="submit" className="rounded-full px-6 text-xs font-semibold">
                    <Megaphone className="mr-1.5 size-3.5" aria-hidden="true" />
                    Publish Official Notice
                  </Button>
                </div>

                {noticeToast && (
                  <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-600 dark:text-lime">
                    {noticeToast}
                  </p>
                )}
              </form>

              {customNotices.length > 0 && (
                <div className="mt-6 border-t border-border pt-4">
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
                          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/60 p-3 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">{n.title}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span>{n.category}</span>
                              <span>•</span>
                              <span>{n.date}</span>
                              <span>•</span>
                              <span className="font-semibold text-cyan">{nTargetBadge}</span>
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
              eyebrow="Principal Academic Resource Control"
              title="Upload New Kitab / Reference PDF to Digital Library"
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
                    <select
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
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pr-kitab-batch" className="text-xs">
                      Target Batch / Class
                    </Label>
                    <select
                      id="pr-kitab-batch"
                      value={kitabBatchLabel}
                      onChange={(e) => setKitabBatchLabel(e.target.value)}
                      className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground"
                    >
                      <option value="All Batches (B14–B05)">All Batches (B14–B05)</option>
                      {CLASS_USTHADS.map((u) => (
                        <option key={u.className} value={u.fullClassLabel}>
                          {u.fullClassLabel}
                        </option>
                      ))}
                    </select>
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
                    disabled={uploadingKitab}
                    className="rounded-full px-6 text-xs font-semibold"
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
        </main>
      </div>

      {/* PHONE & TABLET BOTTOM NAVIGATION MENU BAR FOR PRINCIPAL (Hidden on Desktop lg:) */}
      <nav
        aria-label="Principal Mobile & Tablet Bottom Navigation"
        className="z-50 shrink-0 border-t border-border/85 bg-background/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid h-16 max-w-xl grid-cols-4 items-center px-2">
          {(
            [
              {
                id: 'monitor',
                label: 'Monitor',
                icon: Building2,
                badge: campusMetrics.periodsNotHeld,
              },
              { id: 'people', label: 'Directory', icon: Users, badge: 0 },
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
                  'flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 transition-colors',
                  active ? 'text-lime' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'relative flex h-7 w-14 items-center justify-center rounded-full transition-all',
                    active && 'bg-lime/15',
                  )}
                >
                  <tab.icon className="size-4" aria-hidden="true" />
                  {tab.badge > 0 ? (
                    <span className="absolute -top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 font-mono text-[9.5px] font-bold text-white tabular-nums">
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
        initialDate={selectedDate}
        preparedByRole="Principal"
        preparedByName={principal.name}
        preparedById={principal.staffId}
      />
    </div>
  )
}
