'use client'

import {
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
  ACADEMY_CLASSES,
  CLASS_USTHADS,
  MONTHS_META,
  buildMonthMetaForId,
  findUsthadForTeacherName,
  getClassSemesterTimetableByClassName,
  getEffectiveStudentAttendance,
  getYearMonthsMeta,
  loadAttendanceOverrides,
  loadCustomNotices,
  loadPeriodAttendanceSubmissions,
  normalizeClassName,
  parseMonthId,
  students,
  type Student,
} from '@/components/dashboard/data'
import {
  attachSoraDigitsToJsPdf,
  loadVectorPdfAssets,
  registerOfficialVectorPdfFonts,
  shapeArabicLineForUthmanVector,
} from '@/components/dashboard/study-note-pdf'
import { downloadBlobOnDevice, printPdfBlobOnDevice } from '@/lib/mobile-pdf'
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase'

export type AcademicRecordKind =
  | 'unit_test'
  | 'test_submission'
  | 'holiday_log'
  | 'discipline_note'
  | 'zadul_khair'
  | 'monthly_syllabus'

export type AcademicRecordStatus =
  | 'active'
  | 'submitted'
  | 'graded'
  | 'pending'
  | 'verified'
  | 'advisory'
  | 'warning'
  | 'serious'
  | 'paid'
  | 'partial'
  | 'unpaid'
  | 'received'
  | 'not_recorded'
  | 'deleted'

export type UnitTestQuestionType = 'mcq' | 'objective'

export type UnitTestQuestion = {
  id: string
  type: UnitTestQuestionType
  prompt: string
  options?: string[]
  correctOptionIndex?: number
  expectedAnswer?: string
  marks: number
}

export type CampusAcademicRecord = {
  id: string
  campusId: 'ics-academy'
  recordKind: AcademicRecordKind
  className: string
  studentId?: string
  studentName?: string
  admissionNo?: string
  month?: string // e.g. '2026-11'
  title?: string
  subjectOrCategory?: string // Subject name for tests, or 'Academic Study' | 'SSF Da\'wa Activity' | 'Ziyarat Visit' for holiday logs, or testId reference for test_submission
  description?: string
  remarks?: string
  status: AcademicRecordStatus
  actorId: string
  actorName: string
  dateString?: string
  receiptNo?: string
  photoUrl?: string
  totalMarks?: number
  obtainedMarks?: number
  fixedAmount?: number
  paidAmount?: number
  acknowledged?: boolean
  questions?: UnitTestQuestion[]
  answers?: Record<string, string>
  questionMarks?: Record<string, number>
  isDeleted: boolean
  updatedAtMs: number
}

const STORAGE_KEY = 'ics_campus_academic_records_v1'
const SEEDED_VERSION_KEY = 'ics_campus_academic_records_seeded_v5_voluntary_zadul_khair'

export const HOLIDAY_ACTIVITY_CATEGORIES = [
  'Academic Study (Kitab / Revision)',
  "SSF Da'wa Activity",
  'Ziyarat & Spiritual Visit',
] as const

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }
  return window.btoa(binary)
}

function getUsthadForClass(className: string): { id: string; name: string } {
  const norm = normalizeClassName(className)
  const found = CLASS_USTHADS.find((u) => normalizeClassName(u.className) === norm)
  if (found) {
    return { id: found.id, name: found.name }
  }
  return { id: 'usthad-bs3', name: 'Class Usthad' }
}

function buildInitialSeededAcademicRecords(): CampusAcademicRecord[] {
  const records: CampusAcademicRecord[] = []
  const baseTs = 1763200000000 // Nov 2026 baseline timestamp
  let seq = 1

  for (const cls of ACADEMY_CLASSES) {
    const className = cls.className
    const usthad = getUsthadForClass(className)
    const classStudents = students.filter(
      (s) => normalizeClassName(s.className) === normalizeClassName(className),
    )
    const testId = `test_seed_${className.replace(/\s+/g, '_').toLowerCase()}_2026_11`
    const isBs = className.startsWith('BS')
    const subjectName = isBs ? 'Fiqh & Usul al-Fiqh' : 'Fiqh & Nahw Essentials'

    const questions: UnitTestQuestion[] = [
      {
        id: 'q1',
        type: 'mcq',
        prompt: isBs
          ? 'According to Fath al-Mu’in, which of the following is an essential condition (Shart) for the validity of Salah?'
          : 'Which vowel mark (I’rab) is the primary sign of Raf’ (رفع) in singular nouns?',
        options: isBs
          ? [
              'Entering of the prescribed prayer time (Dukhul al-Waqt)',
              'Reciting Surah al-Ikhlas in the first Rak’ah',
              'Performing Qunut in Witr outside Ramadan',
              'Sitting for Istirahah after every Sujud',
            ]
          : ['Dammah (ضمة)', 'Fathah (فتحة)', 'Kasrah (كسرة)', 'Sukun (سكون)'],
        correctOptionIndex: 0,
        marks: 5,
      },
      {
        id: 'q2',
        type: 'mcq',
        prompt: isBs
          ? 'How many obligatory integrals (Arkan) of Wudu are established in the Shafi’i school?'
          : 'How many obligatory pillars (Fard) are there in Wudu according to Shafi’i Fiqh?',
        options: ['Six (6) Arkan', 'Four (4) Arkan', 'Five (5) Arkan', 'Seven (7) Arkan'],
        correctOptionIndex: 0,
        marks: 5,
      },
      {
        id: 'q3',
        type: 'objective',
        prompt: isBs
          ? 'Define "Niyyah" (Intention) in Fiqh and state the exact point at which it must be present during Wudu.'
          : 'Write the definition of Kalimah (الكلمة) in Arabic Grammar and list its three main categories.',
        expectedAnswer: isBs
          ? 'Qasd al-shay’ muqtarinan bi-fi’lihi; must be present when washing the first part of the face.'
          : 'Ism, Fi’l, and Harf.',
        marks: 10,
      },
    ]

    // 1. Seed Monthly / Unit Test for this class
    records.push({
      id: testId,
      campusId: 'ics-academy',
      recordKind: 'unit_test',
      className,
      month: '2026-11',
      title: 'November Monthly Unit Test — I',
      subjectOrCategory: subjectName,
      description:
        'Monthly evaluation covering core Kitab chapters taught in the first two weeks of November 2026. Answer both Multiple-Choice and Objective questions carefully.',
      status: 'active',
      actorId: usthad.id,
      actorName: usthad.name,
      dateString: '14 Nov 2026',
      totalMarks: 20,
      questions,
      isDeleted: false,
      updatedAtMs: baseTs + seq++,
    })

    // 2. Seed Graded Submissions for top 3 students in each class so Star of the Month is live immediately
    const topThree = classStudents.slice(0, 3)
    const sampleScores = [
      { q1: 5, q2: 5, q3: 9, total: 19, remark: 'Excellent precision in Fiqh definitions. Masha Allah!' },
      { q1: 5, q2: 5, q3: 8, total: 18, remark: 'Very strong performance and clear explanation.' },
      { q1: 5, q2: 0, q3: 9, total: 14, remark: 'Good objective answer; review MCQ #2.' },
    ]

    topThree.forEach((stu, idx) => {
      const sc = sampleScores[idx] || sampleScores[0]
      records.push({
        id: `sub_${testId}_${stu.id}`,
        campusId: 'ics-academy',
        recordKind: 'test_submission',
        className,
        studentId: stu.id,
        studentName: stu.name,
        admissionNo: stu.admissionNo,
        month: '2026-11',
        title: 'November Monthly Unit Test — I',
        subjectOrCategory: testId,
        description: subjectName,
        remarks: sc.remark,
        status: 'graded',
        actorId: stu.id,
        actorName: stu.name,
        dateString: '15 Nov 2026',
        totalMarks: 20,
        obtainedMarks: sc.total,
        answers: {
          q1: '0',
          q2: idx === 2 ? '1' : '0',
          q3: isBs
            ? 'Niyyah is the resolve of the heart accompanied by the act (Qasd al-shay muqtarinan bi-fi’lihi), made while washing the first part of the face in Wudu.'
            : 'Kalimah is a single meaningful word divided into Ism (Noun), Fi’l (Verb), and Harf (Particle).',
        },
        questionMarks: {
          q1: sc.q1,
          q2: sc.q2,
          q3: sc.q3,
        },
        isDeleted: false,
        updatedAtMs: baseTs + seq++,
      })
    })

    // 3. Seed Holiday Academic / SSF Da'wa / Ziyarat log for first two students of each class
    if (classStudents[0]) {
      const stu = classStudents[0]
      records.push({
        id: `hol_seed_${stu.id}_1`,
        campusId: 'ics-academy',
        recordKind: 'holiday_log',
        className,
        studentId: stu.id,
        studentName: stu.name,
        admissionNo: stu.admissionNo,
        month: '2026-11',
        title: "SSF Unit Da'wa Circle & Maqbara Ziyarat",
        subjectOrCategory: "SSF Da'wa Activity",
        description:
          'Participated in the local SSF unit weekend Da’wa gathering, delivered a 10-minute reminder on Adab of Seeking Knowledge, and performed Ziyarat at the local Jumu’ah Masjid Maqbara.',
        remarks: 'Verified and appreciated by Class Usthad. Barakallahu Feekum.',
        status: 'verified',
        actorId: stu.id,
        actorName: stu.name,
        dateString: '14 Nov 2026',
        isDeleted: false,
        updatedAtMs: baseTs + seq++,
      })
    }

    if (classStudents[1]) {
      const stu = classStudents[1]
      records.push({
        id: `hol_seed_${stu.id}_2`,
        campusId: 'ics-academy',
        recordKind: 'holiday_log',
        className,
        studentId: stu.id,
        studentName: stu.name,
        admissionNo: stu.admissionNo,
        month: '2026-11',
        title: 'Holiday Mutala’ah & Kitab Revision Notes',
        subjectOrCategory: 'Academic Study (Kitab / Revision)',
        description:
          'Completed full revision of this month’s Fiqh and Nahw chapters at home and prepared handwritten summary notes for upcoming class discussions.',
        status: 'pending',
        actorId: stu.id,
        actorName: stu.name,
        dateString: '15 Nov 2026',
        isDeleted: false,
        updatedAtMs: baseTs + seq++,
      })
    }

    // 4. Seed Zadul Khair (زاد الخير) Voluntary Household Contribution records across prior & current months
    const sampleOctAmounts = [300, 500, 250, 400, 200]
    const sampleNovAmounts = [500, 250, 300, 200, 0]
    classStudents.slice(0, 5).forEach((stu, idx) => {
      const octAmt = sampleOctAmounts[idx] ?? 250
      if (octAmt > 0) {
        records.push({
          id: `zk_2026-10_${stu.id}`,
          campusId: 'ics-academy',
          recordKind: 'zadul_khair',
          className,
          studentId: stu.id,
          studentName: stu.name,
          admissionNo: stu.admissionNo,
          month: '2026-10',
          title: 'Zadul Khair (زاد الخير) Voluntary Household Contribution',
          subjectOrCategory: 'October 2026',
          remarks: 'Received voluntary household Zadul Khair contribution with heartfelt gratitude.',
          status: 'received',
          actorId: usthad.id,
          actorName: usthad.name,
          dateString: '16 Oct 2026',
          receiptNo: `ZK-2610-${stu.admissionNo.slice(-4)}`,
          paidAmount: octAmt,
          isDeleted: false,
          updatedAtMs: baseTs + seq++,
        })
      }

      const novAmt = sampleNovAmounts[idx] ?? 0
      const novStatus: AcademicRecordStatus = novAmt > 0 ? 'received' : 'not_recorded'
      records.push({
        id: `zk_2026-11_${stu.id}`,
        campusId: 'ics-academy',
        recordKind: 'zadul_khair',
        className,
        studentId: stu.id,
        studentName: stu.name,
        admissionNo: stu.admissionNo,
        month: '2026-11',
        title: 'Zadul Khair (زاد الخير) Voluntary Household Contribution',
        subjectOrCategory: 'November 2026',
        remarks:
          novAmt > 0
            ? 'Received voluntary household Zadul Khair contribution with heartfelt gratitude.'
            : '',
        status: novStatus,
        actorId: usthad.id,
        actorName: usthad.name,
        dateString: novAmt > 0 ? '15 Nov 2026' : '',
        receiptNo: novAmt > 0 ? `ZK-2611-${stu.admissionNo.slice(-4)}` : '',
        paidAmount: novAmt,
        isDeleted: false,
        updatedAtMs: baseTs + seq++,
      })
    })

    // 5. Seed Jamiathul Hind Monthly Syllabus & Kitab Page Tracker records for each timetable period
    const semTimetable = getClassSemesterTimetableByClassName(className)
    const sampleChapterRanges = [
      {
        fromChapter: 'Ch. 1: Shurut al-Salah',
        toChapter: 'Ch. 4: Salat al-Jama’ah',
      },
      {
        fromChapter: 'Ch. 1: Al-I’rab wa al-Bina',
        toChapter: 'Ch. 3: Al-Ma’rifah wa al-Nakirah',
      },
      {
        fromChapter: 'Kitab al-Ilm: Hadith 1',
        toChapter: 'Bab Fadl al-Ilm: Hadith 35',
      },
      {
        fromChapter: 'Surah Yasin: Ayah 1',
        toChapter: 'Surah Yasin: Ayah 40',
      },
      {
        fromChapter: 'Ch. 1: Al-Ahkam al-Taklifiyyah',
        toChapter: 'Ch. 3: Al-Amm wa al-Khass',
      },
    ]
    const samplePageTargets = [
      { total: 30, completed: 22 },
      { total: 24, completed: 18 },
      { total: 28, completed: 28 },
      { total: 20, completed: 12 },
      { total: 26, completed: 19 },
    ]
    const classLeaderStu = classStudents[0]
    semTimetable.semester1.forEach((slot, pIdx) => {
      const periodMeta = semTimetable.periods[pIdx]
      const periodLabel = periodMeta?.label || `Period ${pIdx + 1}`
      const assignedTeacher = findUsthadForTeacherName(slot.teacher)
      const pages = samplePageTargets[pIdx % samplePageTargets.length]
      const chapterRange = sampleChapterRanges[pIdx % sampleChapterRanges.length]
      const formattedChapterRange =
        `${chapterRange.fromChapter} to ${chapterRange.toChapter}`.slice(0, 120)
      const isComplete = pages.completed >= pages.total && pages.total > 0
      const cleanBatchSlug = className.replace(/\s+/g, '_').toLowerCase()
      records.push({
        id: `syl_2026-11_${cleanBatchSlug}_p${pIdx + 1}`,
        campusId: 'ics-academy',
        recordKind: 'monthly_syllabus',
        className,
        studentId: assignedTeacher?.id || usthad.id,
        studentName: slot.teacher,
        admissionNo: periodLabel,
        month: '2026-11',
        title: slot.subject,
        subjectOrCategory: formattedChapterRange,
        answers: {
          fromChapter: chapterRange.fromChapter,
          toChapter: chapterRange.toChapter,
        },
        description: `Jamiathul Hind Monthly Syllabus target for Class ${className} (${slot.subject}).`,
        remarks: isComplete
          ? 'Monthly Jamiathul Hind target pages completed on schedule.'
          : 'Monthly Kitab pages in progress as per Jamiathul Hind circular.',
        status: isComplete ? 'verified' : 'active',
        actorId: classLeaderStu?.id || usthad.id,
        actorName: classLeaderStu ? `${classLeaderStu.name} (Class Leader)` : usthad.name,
        dateString: '16 Nov 2026',
        totalMarks: pages.total,
        obtainedMarks: pages.completed,
        isDeleted: false,
        updatedAtMs: baseTs + seq++,
      })
    })
  }

  return records
}

function normalizeAcademicRecord(
  rec: CampusAcademicRecord,
  defaultSeed?: CampusAcademicRecord,
): CampusAcademicRecord {
  if (rec.recordKind === 'monthly_syllabus') {
    const hasChapterRange =
      rec.answers &&
      typeof rec.answers.fromChapter === 'string' &&
      rec.answers.fromChapter.trim().length > 0 &&
      typeof rec.answers.toChapter === 'string' &&
      rec.answers.toChapter.trim().length > 0
    if (!hasChapterRange && defaultSeed?.answers?.fromChapter && defaultSeed?.answers?.toChapter) {
      return {
        ...rec,
        subjectOrCategory: defaultSeed.subjectOrCategory,
        answers: {
          fromChapter: defaultSeed.answers.fromChapter,
          toChapter: defaultSeed.answers.toChapter,
        },
      }
    }
    return rec
  }
  if (rec.recordKind !== 'zadul_khair') return rec

  const safePaid = Math.max(0, Math.round(Number(rec.paidAmount ?? 0) || 0))
  const voluntaryStatus: AcademicRecordStatus = safePaid > 0 ? 'received' : 'not_recorded'
  let cleanedRemarks = rec.remarks || ''
  if (
    cleanedRemarks === 'Received full monthly household contribution with gratitude.' ||
    cleanedRemarks === 'Full monthly Zadul Khair contribution received.' ||
    cleanedRemarks === 'Partial contribution received; balance pending.' ||
    cleanedRemarks === 'Partial contribution recorded.'
  ) {
    cleanedRemarks =
      safePaid > 0
        ? 'Received voluntary household Zadul Khair contribution with heartfelt gratitude.'
        : ''
  } else if (
    cleanedRemarks.startsWith('Monthly household collection pending') ||
    cleanedRemarks === 'Pending monthly contribution.'
  ) {
    cleanedRemarks = ''
  }

  return {
    ...rec,
    paidAmount: safePaid,
    status: voluntaryStatus,
    remarks: cleanedRemarks,
  }
}

export function loadCampusAcademicRecords(): CampusAcademicRecord[] {
  if (typeof window === 'undefined') return buildInitialSeededAcademicRecords()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const seeded = window.localStorage.getItem(SEEDED_VERSION_KEY)
    const defaults = buildInitialSeededAcademicRecords()
    if (!raw || !seeded) {
      if (raw) {
        try {
          const prev = JSON.parse(raw) as CampusAcademicRecord[]
          if (Array.isArray(prev)) {
            const byId = new Map<string, CampusAcademicRecord>()
            for (const d of defaults) byId.set(d.id, d)
            for (const p of prev) {
              if (p && typeof p.id === 'string') {
                byId.set(p.id, normalizeAcademicRecord(p, byId.get(p.id)))
              }
            }
            const upgraded = Array.from(byId.values())
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(upgraded))
            window.localStorage.setItem(SEEDED_VERSION_KEY, '1')
            return upgraded
              .filter((r) => !r.isDeleted && r.status !== 'deleted')
              .sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0))
          }
        } catch {
          // Fallback to defaults below
        }
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults))
      window.localStorage.setItem(SEEDED_VERSION_KEY, '1')
      return defaults
    }
    const parsed = JSON.parse(raw) as CampusAcademicRecord[]
    if (!Array.isArray(parsed)) return defaults

    const byId = new Map<string, CampusAcademicRecord>()
    for (const d of defaults) {
      byId.set(d.id, d)
    }
    for (const p of parsed) {
      if (p && typeof p.id === 'string') {
        const existing = byId.get(p.id)
        const normalized = normalizeAcademicRecord(p, existing)
        if (!existing || (normalized.updatedAtMs || 0) >= (existing.updatedAtMs || 0)) {
          byId.set(normalized.id, normalized)
        }
      }
    }
    return Array.from(byId.values())
      .filter((r) => !r.isDeleted && r.status !== 'deleted')
      .sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0))
  } catch {
    return buildInitialSeededAcademicRecords()
  }
}

export function saveCampusAcademicRecordsLocally(records: CampusAcademicRecord[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
    window.localStorage.setItem(SEEDED_VERSION_KEY, '1')
    window.dispatchEvent(new CustomEvent('ics-academic-records-updated'))
  } catch {
    // Ignore storage quota errors
  }
}

function sanitizeRecordForFirestore(record: CampusAcademicRecord): Record<string, unknown> {
  const validActorId = /^(st[d]?|usthad|principal)-[a-zA-Z0-9_-]+$/.test(record.actorId)
    ? record.actorId
    : `usthad-${record.actorId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'staff'}`

  const clean: Record<string, unknown> = {
    id: String(record.id).slice(0, 140),
    campusId: 'ics-academy',
    recordKind: record.recordKind,
    className: String(record.className || 'BS 3').slice(0, 40),
    status: record.status,
    actorId: validActorId,
    actorName: String(record.actorName || 'Campus Member').slice(0, 120),
    isDeleted: Boolean(record.isDeleted),
    updatedAtMs:
      typeof record.updatedAtMs === 'number' && record.updatedAtMs > 0
        ? Math.floor(record.updatedAtMs)
        : Date.now(),
  }

  if (typeof record.studentId === 'string') clean.studentId = record.studentId.slice(0, 80)
  if (typeof record.studentName === 'string') clean.studentName = record.studentName.slice(0, 120)
  if (typeof record.admissionNo === 'string') clean.admissionNo = record.admissionNo.slice(0, 40)
  if (typeof record.month === 'string') clean.month = record.month.slice(0, 30)
  if (typeof record.title === 'string') clean.title = record.title.slice(0, 240)
  if (typeof record.subjectOrCategory === 'string') {
    clean.subjectOrCategory = record.subjectOrCategory.slice(0, 120)
  }
  if (typeof record.description === 'string') clean.description = record.description.slice(0, 4000)
  if (typeof record.remarks === 'string') clean.remarks = record.remarks.slice(0, 2000)
  if (typeof record.dateString === 'string') clean.dateString = record.dateString.slice(0, 60)
  if (typeof record.receiptNo === 'string') clean.receiptNo = record.receiptNo.slice(0, 60)
  if (typeof record.photoUrl === 'string' && record.photoUrl.length <= 700000) {
    clean.photoUrl = record.photoUrl
  }
  if (typeof record.totalMarks === 'number' && Number.isFinite(record.totalMarks)) {
    clean.totalMarks = Math.max(0, Math.min(1000, Math.round(record.totalMarks)))
  }
  if (typeof record.obtainedMarks === 'number' && Number.isFinite(record.obtainedMarks)) {
    clean.obtainedMarks = Math.max(0, Math.min(1000, Math.round(record.obtainedMarks)))
  }
  if (typeof record.fixedAmount === 'number' && Number.isFinite(record.fixedAmount)) {
    clean.fixedAmount = Math.max(0, Math.min(1000000, Math.round(record.fixedAmount)))
  }
  if (typeof record.paidAmount === 'number' && Number.isFinite(record.paidAmount)) {
    clean.paidAmount = Math.max(0, Math.min(1000000, Math.round(record.paidAmount)))
  }
  if (typeof record.acknowledged === 'boolean') {
    clean.acknowledged = record.acknowledged
  }
  if (Array.isArray(record.questions)) {
    clean.questions = record.questions.slice(0, 50).map((q) => {
      const qObj: Record<string, unknown> = {
        id: String(q.id),
        type: q.type === 'objective' ? 'objective' : 'mcq',
        prompt: String(q.prompt || '').slice(0, 1000),
        marks: Math.max(1, Math.min(100, Math.round(Number(q.marks) || 1))),
      }
      if (Array.isArray(q.options)) {
        qObj.options = q.options.map((o) => String(o).slice(0, 300))
      }
      if (typeof q.correctOptionIndex === 'number') {
        qObj.correctOptionIndex = q.correctOptionIndex
      }
      if (typeof q.expectedAnswer === 'string') {
        qObj.expectedAnswer = q.expectedAnswer.slice(0, 1000)
      }
      return qObj
    })
  }
  if (record.answers && typeof record.answers === 'object') {
    const ansMap: Record<string, string> = {}
    for (const [k, v] of Object.entries(record.answers).slice(0, 50)) {
      ansMap[k] = String(v ?? '').slice(0, 2000)
    }
    clean.answers = ansMap
  }
  if (record.questionMarks && typeof record.questionMarks === 'object') {
    const qmMap: Record<string, number> = {}
    for (const [k, v] of Object.entries(record.questionMarks).slice(0, 50)) {
      const num = Number(v)
      if (Number.isFinite(num)) {
        qmMap[k] = Math.max(0, Math.min(100, Math.round(num)))
      }
    }
    clean.questionMarks = qmMap
  }

  return clean
}

export async function upsertCampusAcademicRecord(record: CampusAcademicRecord): Promise<void> {
  const stamped: CampusAcademicRecord = {
    ...record,
    campusId: 'ics-academy',
    updatedAtMs: Date.now(),
  }

  // 1. Update local storage immediately for zero-latency UI response
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      const list: CampusAcademicRecord[] = raw ? JSON.parse(raw) : buildInitialSeededAcademicRecords()
      const byId = new Map<string, CampusAcademicRecord>()
      for (const item of list) {
        if (item && item.id) byId.set(item.id, item)
      }
      byId.set(stamped.id, stamped)
      saveCampusAcademicRecordsLocally(Array.from(byId.values()))
    } catch {
      // Ignore local save error
    }
  }

  // 2. Sync to Firestore `/campusAcademicRecords/{id}`
  // Try updateDoc first so `createdAt` immutability rule is preserved on existing records; fallback to setDoc with createdAt: serverTimestamp()
  const docRef = doc(db, 'campusAcademicRecords', stamped.id)
  const payload = sanitizeRecordForFirestore(stamped)
  try {
    await updateDoc(docRef, payload)
  } catch {
    try {
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp(),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('permission') || msg.includes('insufficient')) {
        try {
          handleFirestoreError(err, OperationType.WRITE, `campusAcademicRecords/${stamped.id}`)
        } catch {
          // Handled
        }
      }
    }
  }
}

// Module-level shared listener so tab switches & multiple Academic Hub views never attach duplicate Firestore listeners
let sharedAcademicRefCount = 0
let sharedAcademicUnsub: (() => void) | null = null
const sharedAcademicCallbacks = new Set<(records: CampusAcademicRecord[]) => void>()

function emitSharedAcademicRecords() {
  const latest = loadCampusAcademicRecords()
  for (const cb of sharedAcademicCallbacks) {
    try {
      cb(latest)
    } catch {
      // Ignore subscriber error
    }
  }
}

function ensureSharedAcademicListener() {
  if (sharedAcademicUnsub || typeof window === 'undefined') return
  try {
    const q = query(
      collection(db, 'campusAcademicRecords'),
      where('updatedAtMs', '>', 0),
      orderBy('updatedAtMs', 'desc'),
      limit(60),
    )

    sharedAcademicUnsub = onSnapshot(
      q,
      (snapshot) => {
        try {
          const rawLocal = window.localStorage.getItem(STORAGE_KEY)
          const currentList: CampusAcademicRecord[] = rawLocal
            ? JSON.parse(rawLocal)
            : buildInitialSeededAcademicRecords()
          const byId = new Map<string, CampusAcademicRecord>()
          for (const item of buildInitialSeededAcademicRecords()) {
            byId.set(item.id, item)
          }
          for (const item of currentList) {
            if (item && item.id) byId.set(item.id, item)
          }

          let changed = false
          snapshot.forEach((docSnap) => {
            const d = docSnap.data() as Record<string, unknown>
            if (!d || typeof d.id !== 'string' || typeof d.recordKind !== 'string') return
            const incoming: CampusAcademicRecord = {
              id: d.id,
              campusId: 'ics-academy',
              recordKind: d.recordKind as AcademicRecordKind,
              className: String(d.className || ''),
              studentId: typeof d.studentId === 'string' ? d.studentId : undefined,
              studentName: typeof d.studentName === 'string' ? d.studentName : undefined,
              admissionNo: typeof d.admissionNo === 'string' ? d.admissionNo : undefined,
              month: typeof d.month === 'string' ? d.month : undefined,
              title: typeof d.title === 'string' ? d.title : undefined,
              subjectOrCategory:
                typeof d.subjectOrCategory === 'string' ? d.subjectOrCategory : undefined,
              description: typeof d.description === 'string' ? d.description : undefined,
              remarks: typeof d.remarks === 'string' ? d.remarks : undefined,
              status: (d.status as AcademicRecordStatus) || 'active',
              actorId: String(d.actorId || ''),
              actorName: String(d.actorName || ''),
              dateString: typeof d.dateString === 'string' ? d.dateString : undefined,
              receiptNo: typeof d.receiptNo === 'string' ? d.receiptNo : undefined,
              photoUrl: typeof d.photoUrl === 'string' ? d.photoUrl : undefined,
              totalMarks: typeof d.totalMarks === 'number' ? d.totalMarks : undefined,
              obtainedMarks: typeof d.obtainedMarks === 'number' ? d.obtainedMarks : undefined,
              fixedAmount: typeof d.fixedAmount === 'number' ? d.fixedAmount : undefined,
              paidAmount: typeof d.paidAmount === 'number' ? d.paidAmount : undefined,
              acknowledged: typeof d.acknowledged === 'boolean' ? d.acknowledged : undefined,
              questions: Array.isArray(d.questions)
                ? (d.questions as UnitTestQuestion[])
                : undefined,
              answers:
                d.answers && typeof d.answers === 'object'
                  ? (d.answers as Record<string, string>)
                  : undefined,
              questionMarks:
                d.questionMarks && typeof d.questionMarks === 'object'
                  ? (d.questionMarks as Record<string, number>)
                  : undefined,
              isDeleted: Boolean(d.isDeleted),
              updatedAtMs: typeof d.updatedAtMs === 'number' ? d.updatedAtMs : Date.now(),
            }

            const existing = byId.get(incoming.id)
            if (!existing || incoming.updatedAtMs >= (existing.updatedAtMs || 0)) {
              byId.set(incoming.id, incoming)
              changed = true
            }
          })

          if (changed) {
            const merged = Array.from(byId.values())
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
            window.localStorage.setItem(SEEDED_VERSION_KEY, '1')
          }
          emitSharedAcademicRecords()
        } catch {
          // Ignore snapshot parse error
        }
      },
      (error) => {
        const msg = error instanceof Error ? error.message : String(error)
        if (msg.includes('permission') || msg.includes('insufficient')) {
          try {
            handleFirestoreError(error, OperationType.LIST, 'campusAcademicRecords')
          } catch {
            // Handled
          }
        }
      },
    )
  } catch {
    // Ignore listener attach error
  }
}

export function subscribeCampusAcademicRecords(
  onUpdate: (records: CampusAcademicRecord[]) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}

  const handleLocal = () => {
    onUpdate(loadCampusAcademicRecords())
  }

  sharedAcademicCallbacks.add(onUpdate)
  sharedAcademicRefCount += 1
  window.addEventListener('ics-academic-records-updated', handleLocal)
  ensureSharedAcademicListener()

  return () => {
    window.removeEventListener('ics-academic-records-updated', handleLocal)
    sharedAcademicCallbacks.delete(onUpdate)
    sharedAcademicRefCount = Math.max(0, sharedAcademicRefCount - 1)
    if (sharedAcademicRefCount === 0 && sharedAcademicUnsub) {
      try {
        sharedAcademicUnsub()
      } catch {
        // Ignore
      }
      sharedAcademicUnsub = null
    }
  }
}

export type StarStudentRanking = {
  student: Student
  testPercentage: number
  testsCount: number
  totalObtainedMarks: number
  totalMaxMarks: number
  attendancePercentage: number
  compositeScore: number
  rank: number
}

export type ClassStarOfTheMonthSummary = {
  className: string
  monthId: string
  monthLabel: string
  winner: StarStudentRanking | null
  runnersUp: StarStudentRanking[]
  allRankings: StarStudentRanking[]
}

/**
 * Automatically calculates Star of the Month for a given class and month (`2026-11` etc.)
 * Formula approved by user:
 *   70% weight on Monthly/Unit Test Score % + 30% weight on Monthly Attendance %
 */
export function calculateClassStarOfTheMonth(
  className: string,
  monthId: string,
  allRecords: CampusAcademicRecord[],
): ClassStarOfTheMonthSummary {
  const normClass = normalizeClassName(className)
  const monthMeta = buildMonthMetaForId(monthId)
  const monthLabel = `${monthMeta.month} ${monthMeta.year}`

  const classStudents = students.filter((s) => normalizeClassName(s.className) === normClass)
  const overrides = loadAttendanceOverrides()
  const notices = loadCustomNotices()
  const periodSubs = loadPeriodAttendanceSubmissions()

  // Graded test submissions for this class & month
  const gradedSubmissions = allRecords.filter(
    (r) =>
      r.recordKind === 'test_submission' &&
      !r.isDeleted &&
      r.status === 'graded' &&
      normalizeClassName(r.className) === normClass &&
      (!r.month || r.month === monthId),
  )

  const rankings: StarStudentRanking[] = classStudents.map((stu) => {
    const stuSubs = gradedSubmissions.filter((sub) => sub.studentId === stu.id)
    let totalObtained = 0
    let totalMax = 0
    for (const sub of stuSubs) {
      totalObtained += Number(sub.obtainedMarks || 0)
      totalMax += Number(sub.totalMarks || 20)
    }

    const testPercentage =
      totalMax > 0 ? Math.min(100, Math.round((totalObtained / totalMax) * 1000) / 10) : 0

    // Effective attendance for the selected month
    const effective = getEffectiveStudentAttendance(stu, overrides, notices)
    const monthRow = effective.monthlyAttendance.find((m) => m.id === monthId)
    let attendancePercentage = 96 // baseline high attendance when month has just started
    if (monthRow && monthRow.workingDays > 0) {
      attendancePercentage = Math.min(
        100,
        Math.round((monthRow.present / monthRow.workingDays) * 1000) / 10,
      )
    } else if (effective.attendance.present + effective.attendance.absent > 0) {
      const totalTracked =
        effective.attendance.present + effective.attendance.absent + effective.attendance.leave
      attendancePercentage = Math.min(
        100,
        Math.round((effective.attendance.present / Math.max(1, totalTracked)) * 1000) / 10,
      )
    }

    const compositeScore =
      stuSubs.length > 0
        ? Math.round((testPercentage * 0.7 + attendancePercentage * 0.3) * 10) / 10
        : Math.round(attendancePercentage * 0.3 * 10) / 10

    return {
      student: stu,
      testPercentage,
      testsCount: stuSubs.length,
      totalObtainedMarks: totalObtained,
      totalMaxMarks: totalMax,
      attendancePercentage,
      compositeScore,
      rank: 1,
    }
  })

  rankings.sort((a, b) => {
    if (b.testsCount > 0 && a.testsCount === 0) return 1
    if (a.testsCount > 0 && b.testsCount === 0) return -1
    if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore
    if (b.testPercentage !== a.testPercentage) return b.testPercentage - a.testPercentage
    return b.attendancePercentage - a.attendancePercentage
  })

  rankings.forEach((item, idx) => {
    item.rank = idx + 1
  })

  const activeParticipants = rankings.filter((r) => r.testsCount > 0)
  const winner = activeParticipants[0] || rankings[0] || null
  const runnersUp = (activeParticipants.length > 1 ? activeParticipants : rankings).slice(1, 4)

  return {
    className: normClass,
    monthId,
    monthLabel,
    winner,
    runnersUp,
    allRankings: rankings,
  }
}

export async function compressImageFileToDataUrl(
  file: File,
  maxDimension = 960,
  quality = 0.72,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context unavailable'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(dataUrl)
      }
      img.onerror = () => reject(new Error('Could not decode image'))
      img.src = String(reader.result)
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

async function loadOfficialPdfFontsAndLogo(pdf: {
  addFileToVFS: (name: string, data: string) => void
  addFont: (postScriptName: string, id: string, fontStyle: string) => void
}): Promise<{
  fontFamily: 'Poppins' | 'helvetica'
  hasElMessiri: boolean
  hasSora: boolean
  logoDataUrl: string | null
}> {
  let fontFamily: 'Poppins' | 'helvetica' = 'helvetica'
  let hasElMessiri = false
  let hasSora = false
  let logoDataUrl: string | null = null

  try {
    const [regRes, semiRes, boldRes, soraRegRes, soraSemiRes, soraBoldRes, elMessiriRes] =
      await Promise.all([
        fetch('/fonts/Poppins-Regular.ttf'),
        fetch('/fonts/Poppins-SemiBold.ttf'),
        fetch('/fonts/Poppins-Bold.ttf'),
        fetch('/fonts/Sora-Regular.ttf').catch(() => null),
        fetch('/fonts/Sora-SemiBold.ttf').catch(() => null),
        fetch('/fonts/Sora-Bold.ttf').catch(() => null),
        fetch('/fonts/ElMessiri-Bold.ttf').catch(() => null),
      ])
    if (regRes.ok && semiRes.ok && boldRes.ok) {
      const [regBuf, semiBuf, boldBuf] = await Promise.all([
        regRes.arrayBuffer(),
        semiRes.arrayBuffer(),
        boldRes.arrayBuffer(),
      ])
      pdf.addFileToVFS('Poppins-Regular.ttf', arrayBufferToBase64(regBuf))
      pdf.addFont('Poppins-Regular.ttf', 'Poppins', 'normal')
      pdf.addFileToVFS('Poppins-SemiBold.ttf', arrayBufferToBase64(semiBuf))
      pdf.addFont('Poppins-SemiBold.ttf', 'Poppins', 'semibold')
      pdf.addFileToVFS('Poppins-Bold.ttf', arrayBufferToBase64(boldBuf))
      pdf.addFont('Poppins-Bold.ttf', 'Poppins', 'bold')
      fontFamily = 'Poppins'
    }
    if (soraRegRes?.ok && soraSemiRes?.ok && soraBoldRes?.ok) {
      const [sRegBuf, sSemiBuf, sBoldBuf] = await Promise.all([
        soraRegRes.arrayBuffer(),
        soraSemiRes.arrayBuffer(),
        soraBoldRes.arrayBuffer(),
      ])
      pdf.addFileToVFS('Sora-Regular.ttf', arrayBufferToBase64(sRegBuf))
      pdf.addFont('Sora-Regular.ttf', 'Sora', 'normal')
      pdf.addFileToVFS('Sora-SemiBold.ttf', arrayBufferToBase64(sSemiBuf))
      pdf.addFont('Sora-SemiBold.ttf', 'Sora', 'semibold')
      pdf.addFileToVFS('Sora-Bold.ttf', arrayBufferToBase64(sBoldBuf))
      pdf.addFont('Sora-Bold.ttf', 'Sora', 'bold')
      attachSoraDigitsToJsPdf(pdf as never)
      hasSora = true
    }
    if (elMessiriRes && elMessiriRes.ok) {
      const elMessiriBuf = await elMessiriRes.arrayBuffer()
      pdf.addFileToVFS('ElMessiri-Bold.ttf', arrayBufferToBase64(elMessiriBuf))
      pdf.addFont('ElMessiri-Bold.ttf', 'ElMessiri', 'bold')
      hasElMessiri = true
    }
  } catch {
    fontFamily = 'helvetica'
  }

  try {
    const logoRes = await fetch('/images/ics-mark-transparent.png')
    if (logoRes.ok) {
      const logoBuf = await logoRes.arrayBuffer()
      logoDataUrl = `data:image/png;base64,${arrayBufferToBase64(logoBuf)}`
    }
  } catch {
    logoDataUrl = null
  }

  return { fontFamily, hasElMessiri, hasSora, logoDataUrl }
}

export type ZadulKhairMonthlyLedgerRow = {
  monthId: string
  monthLabel: string
  shortMonthLabel: string
  record: CampusAcademicRecord | null
  amount: number
  isRecorded: boolean
  statusLabel: 'Received' | 'Not Recorded'
  receiptNo: string
  dateString: string
  remarks: string
  actorName: string
  isSelectedMonth: boolean
}

export type StudentZadulKhairSummary = {
  selectedMonth: string
  selectedMonthLabel: string
  previousContribution: number
  currentMonthlyContribution: number
  totalContribution: number
  fullAcademicYearTotal: number
  recordedMonthsCount: number
  currentMonthRecord: CampusAcademicRecord | null
  monthlyRows: ZadulKhairMonthlyLedgerRow[]
}

const ACADEMIC_MONTH_ORDER = new Map<string, number>(
  MONTHS_META.map((m, index) => [m.id, index]),
)

export function getAcademicMonthOrderIndex(monthId: string): number {
  const known = ACADEMIC_MONTH_ORDER.get(monthId)
  if (known !== undefined) return known
  return 999
}

/**
 * Computes voluntary Zadul Khair cumulative metrics and the full chronological 2026-27
 * monthly ledger for a single student:
 * - previousContribution: sum of all contributions strictly prior to `selectedMonth`
 * - currentMonthlyContribution: voluntary contribution recorded for `selectedMonth`
 * - totalContribution: previousContribution + currentMonthlyContribution
 */
export function computeStudentZadulKhairSummary(
  studentId: string,
  selectedMonth: string,
  allRecords: CampusAcademicRecord[],
): StudentZadulKhairSummary {
  const byMonth = new Map<string, CampusAcademicRecord>()
  for (const r of allRecords) {
    if (
      r.recordKind !== 'zadul_khair' ||
      r.isDeleted ||
      r.status === 'deleted' ||
      r.studentId !== studentId ||
      !r.month
    ) {
      continue
    }
    const existing = byMonth.get(r.month)
    if (!existing || (r.updatedAtMs || 0) >= (existing.updatedAtMs || 0)) {
      byMonth.set(r.month, r)
    }
  }

  const parsedSelected = parseMonthId(selectedMonth)
  const yearMonths = getYearMonthsMeta(parsedSelected.year)
  const yearMonthIds = new Set(yearMonths.map((m) => m.id))

  let previousContribution = 0
  let currentMonthlyContribution = 0
  let fullAcademicYearTotal = 0
  let recordedMonthsCount = 0

  const monthlyRows: ZadulKhairMonthlyLedgerRow[] = yearMonths.map((m) => {
    const rec = byMonth.get(m.id) || null
    const amount = Math.max(0, Math.round(Number(rec?.paidAmount ?? 0) || 0))
    const isRecorded = amount > 0
    if (isRecorded) {
      recordedMonthsCount += 1
      fullAcademicYearTotal += amount
    }
    if (m.id < selectedMonth) {
      previousContribution += amount
    } else if (m.id === selectedMonth) {
      currentMonthlyContribution = amount
    }
    return {
      monthId: m.id,
      monthLabel: `${m.month} ${m.year}`,
      shortMonthLabel: `${m.shortMonth} ${m.year}`,
      record: rec,
      amount,
      isRecorded,
      statusLabel: isRecorded ? 'Received' : 'Not Recorded',
      receiptNo: isRecorded ? rec?.receiptNo || `ZK-${m.id.replace('-', '')}` : '—',
      dateString: isRecorded ? rec?.dateString || '—' : '—',
      remarks: rec?.remarks || '',
      actorName: rec?.actorName || '',
      isSelectedMonth: m.id === selectedMonth,
    }
  })

  // Include any records from earlier/other years safely
  for (const [mId, rec] of byMonth.entries()) {
    if (yearMonthIds.has(mId)) continue
    const amount = Math.max(0, Math.round(Number(rec.paidAmount ?? 0) || 0))
    if (amount > 0) {
      fullAcademicYearTotal += amount
      if (mId < selectedMonth) {
        previousContribution += amount
      } else if (mId === selectedMonth) {
        currentMonthlyContribution = amount
      }
    }
  }

  const selectedMeta = buildMonthMetaForId(selectedMonth)
  const selectedMonthLabel = `${selectedMeta.month} ${selectedMeta.year}`

  return {
    selectedMonth,
    selectedMonthLabel,
    previousContribution,
    currentMonthlyContribution,
    totalContribution: previousContribution + currentMonthlyContribution,
    fullAcademicYearTotal,
    recordedMonthsCount,
    currentMonthRecord: byMonth.get(selectedMonth) || null,
    monthlyRows,
  }
}

const ZADUL_KHAIR_ARABIC_DUA = 'بارك الله في أموالكم وأهليكم، وزادكم من فضله، آمين'

async function renderPdfArrayBufferToJpgBlob(pdfBytes: ArrayBuffer): Promise<Blob> {
  const [pdfjsLib, workerMod] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerMod.default
  }

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) })
  const pdfDoc = await loadingTask.promise
  try {
    const page = await pdfDoc.getPage(1)
    const viewport = page.getViewport({ scale: 2.6 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Unable to initialize canvas for JPG export.')

    // Crisp pure white paper background for JPEG
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    }).promise

    const jpgBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to encode JPG image.'))),
        'image/jpeg',
        0.95,
      )
    })

    canvas.width = 0
    canvas.height = 0
    return jpgBlob
  } finally {
    await loadingTask.destroy()
  }
}

/**
 * Generates and downloads/prints an Official ICS Academy Manhappatta
 * Zadul Khair (زاد الخير) Individual Student Voluntary Household Contribution Receipt & Monthly Ledger (PDF or JPG).
 */
export async function exportStudentZadulKhairReceiptPdf(params: {
  student: Student
  selectedMonth: string
  record: CampusAcademicRecord
  historyRecords: CampusAcademicRecord[]
  mode: 'download' | 'jpg' | 'print'
}): Promise<void> {
  const { student, selectedMonth, record, historyRecords, mode } = params
  const summary = computeStudentZadulKhairSummary(student.id, selectedMonth, historyRecords)

  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  let fontFamily: 'Poppins' | 'helvetica' = 'helvetica'
  let hasElMessiri = false
  let hasUthmanVector = false
  let logoDataUrl: string | null = null

  try {
    const vectorAssets = await loadVectorPdfAssets()
    registerOfficialVectorPdfFonts(pdf, vectorAssets)
    fontFamily = 'Poppins'
    hasElMessiri = true
    hasUthmanVector = true
    logoDataUrl = vectorAssets.logoDataUrl
  } catch {
    const fallbackAssets = await loadOfficialPdfFontsAndLogo(pdf)
    fontFamily = fallbackAssets.fontFamily
    hasElMessiri = fallbackAssets.hasElMessiri
    logoDataUrl = fallbackAssets.logoDataUrl
  }

  const setFont = (style: 'normal' | 'semibold' | 'bold') => {
    if (fontFamily === 'Poppins') {
      pdf.setFont('Poppins', style)
    } else {
      pdf.setFont('helvetica', style === 'normal' ? 'normal' : 'bold')
    }
  }
  const setBrandFont = () => {
    if (hasElMessiri) {
      pdf.setFont('ElMessiri', 'bold')
    } else {
      setFont('bold')
    }
  }

  const pageWidth = 210
  const margin = 12
  const contentWidth = pageWidth - margin * 2
  let y = 10

  // 1. Dark Emerald-Teal Official Institutional Banner (#081E21)
  const headerH = 27
  pdf.setFillColor(8, 30, 33)
  pdf.roundedRect(margin, y, contentWidth, headerH, 3.5, 3.5, 'F')

  if (logoDataUrl) {
    pdf.setFillColor(255, 255, 255)
    pdf.roundedRect(margin + 4.5, y + 3.6, 15.8, 19.8, 2.4, 2.4, 'F')
    const markH = 16.8
    const markW = markH * (381 / 512)
    const markX = margin + 4.5 + (15.8 - markW) / 2
    const markY = y + 3.6 + (19.8 - markH) / 2
    pdf.addImage(logoDataUrl, 'PNG', markX, markY, markW, markH)
  }

  const textStartX = logoDataUrl ? margin + 24 : margin + 6
  setFont('bold')
  pdf.setFontSize(7.3)
  pdf.setTextColor(163, 230, 53) // #a3e635 lime
  pdf.text('ZADUL KHAIR VOLUNTARY HOUSEHOLD CONTRIBUTION RECEIPT', textStartX, y + 6.8)

  setBrandFont()
  pdf.setFontSize(13.2)
  pdf.setTextColor(255, 255, 255)
  pdf.text('ICS ACADEMY MANHAPPATTA', textStartX, y + 13.2)

  setFont('semibold')
  pdf.setFontSize(8)
  pdf.setTextColor(203, 213, 225)
  pdf.text('Islamic Cultural Society • Manhappatta, Kerala', textStartX, y + 18)

  setFont('normal')
  pdf.setFontSize(7)
  pdf.setTextColor(148, 163, 184)
  pdf.text(
    'Academic Year 2026-27  |  Official Voluntary Charity & Household Ledger Statement',
    textStartX,
    y + 22.8,
  )

  // Right receipt badge
  const badgeW = 48
  const badgeH = 16.5
  const badgeX = pageWidth - margin - badgeW - 4.5
  const badgeY = y + 5.2
  pdf.setFillColor(13, 46, 50)
  pdf.setDrawColor(163, 230, 53)
  pdf.setLineWidth(0.3)
  pdf.roundedRect(badgeX, badgeY, badgeW, badgeH, 2.2, 2.2, 'FD')

  setFont('bold')
  pdf.setFontSize(6.2)
  pdf.setTextColor(163, 230, 53)
  pdf.text('RECEIPT NO.', badgeX + badgeW / 2, badgeY + 4.8, { align: 'center' })

  setFont('bold')
  pdf.setFontSize(8.8)
  pdf.setTextColor(255, 255, 255)
  const receiptCode =
    summary.currentMonthlyContribution > 0
      ? record.receiptNo || `ZK-${selectedMonth.replace('-', '')}-${student.admissionNo.slice(-4)}`
      : `STMT-${selectedMonth.replace('-', '')}`
  pdf.text(receiptCode, badgeX + badgeW / 2, badgeY + 10.1, { align: 'center' })

  setFont('normal')
  pdf.setFontSize(6.3)
  pdf.setTextColor(203, 213, 225)
  pdf.text(
    summary.currentMonthlyContribution > 0
      ? record.dateString || summary.selectedMonthLabel
      : summary.selectedMonthLabel,
    badgeX + badgeW / 2,
    badgeY + 14.3,
    { align: 'center' },
  )

  y += headerH + 5

  // 2. Student & Household Identity Card
  const idCardH = 24
  pdf.setFillColor(248, 250, 252)
  pdf.setDrawColor(203, 213, 225)
  pdf.setLineWidth(0.35)
  pdf.roundedRect(margin, y, contentWidth, idCardH, 2.8, 2.8, 'FD')

  setFont('bold')
  pdf.setFontSize(6.8)
  pdf.setTextColor(100, 116, 139)
  pdf.text('STUDENT & HOUSEHOLD DETAILS', margin + 5, y + 5.6)

  setFont('bold')
  pdf.setFontSize(11.8)
  pdf.setTextColor(15, 23, 42)
  pdf.text(student.name, margin + 5, y + 12.2)

  setFont('semibold')
  pdf.setFontSize(8.2)
  pdf.setTextColor(51, 65, 85)
  pdf.text(
    `Admission No: ${student.admissionNo}   •   Class: ${student.className} (${student.batch})`,
    margin + 5,
    y + 17.6,
  )

  setFont('normal')
  pdf.setFontSize(7.3)
  pdf.setTextColor(100, 116, 139)
  const recordedByDisplay =
    summary.currentMonthRecord?.actorName || record.actorName || 'Class Usthad / Leader'
  pdf.text(
    `Recorded By: ${recordedByDisplay}   •   Statement Month: ${summary.selectedMonthLabel}`,
    margin + 5,
    y + 22,
  )

  y += idCardH + 5

  // 3. Voluntary Contribution Summary KPI Strip (Exact 3 Shapes: PREVIOUS / CURRENT MONTHLY / TOTAL)
  const kpiGap = 4
  const kpiW = (contentWidth - kpiGap * 2) / 3
  const kpiH = 21.5
  const isCurrentRecorded = summary.currentMonthlyContribution > 0

  const kpis = [
    {
      label: 'PREVIOUS CONTRIBUTION',
      val: `INR ${summary.previousContribution.toLocaleString('en-IN')}`,
      sub: 'Prior Months Cumulative',
      bg: [248, 250, 252] as [number, number, number],
      border: [203, 213, 225] as [number, number, number],
      labelColor: [100, 116, 139] as [number, number, number],
      valColor: [15, 23, 42] as [number, number, number],
      subColor: [71, 85, 105] as [number, number, number],
    },
    {
      label: 'CURRENT MONTHLY CONTRIBUTION',
      val: `INR ${summary.currentMonthlyContribution.toLocaleString('en-IN')}`,
      sub: `${summary.selectedMonthLabel} • ${isCurrentRecorded ? 'Received' : 'Not Recorded'}`,
      bg: isCurrentRecorded
        ? ([236, 253, 245] as [number, number, number])
        : ([248, 250, 252] as [number, number, number]),
      border: isCurrentRecorded
        ? ([16, 185, 129] as [number, number, number])
        : ([203, 213, 225] as [number, number, number]),
      labelColor: isCurrentRecorded
        ? ([4, 120, 87] as [number, number, number])
        : ([100, 116, 139] as [number, number, number]),
      valColor: isCurrentRecorded
        ? ([4, 120, 87] as [number, number, number])
        : ([51, 65, 85] as [number, number, number]),
      subColor: [71, 85, 105] as [number, number, number],
    },
    {
      label: 'TOTAL CONTRIBUTION',
      val: `INR ${summary.totalContribution.toLocaleString('en-IN')}`,
      sub: 'Previous + Current Total',
      bg: [240, 253, 244] as [number, number, number],
      border: [8, 30, 33] as [number, number, number],
      labelColor: [8, 30, 33] as [number, number, number],
      valColor: [8, 30, 33] as [number, number, number],
      subColor: [51, 65, 85] as [number, number, number],
    },
  ]

  kpis.forEach((box, idx) => {
    const bx = margin + idx * (kpiW + kpiGap)
    pdf.setFillColor(...box.bg)
    pdf.setDrawColor(...box.border)
    pdf.setLineWidth(idx === 2 ? 0.45 : 0.35)
    pdf.roundedRect(bx, y, kpiW, kpiH, 2.5, 2.5, 'FD')

    setFont('bold')
    pdf.setFontSize(6.1)
    pdf.setTextColor(...box.labelColor)
    pdf.text(box.label, bx + 3.8, y + 5.6)

    setFont('bold')
    pdf.setFontSize(12.2)
    pdf.setTextColor(...box.valColor)
    pdf.text(box.val, bx + 3.8, y + 13.2)

    setFont('semibold')
    pdf.setFontSize(6.7)
    pdf.setTextColor(...box.subColor)
    pdf.text(box.sub, bx + 3.8, y + 18.4)
  })

  y += kpiH + 7

  // 4. Complete Academic Year Monthly Contribution Ledger Table (All 12 Months)
  setFont('bold')
  pdf.setFontSize(8.8)
  pdf.setTextColor(8, 30, 33)
  pdf.text('STUDENT ZADUL KHAIR MONTHLY CONTRIBUTION LEDGER (2026–27)', margin, y)
  y += 3.5

  const colX = [margin, margin + 44, margin + 88, margin + 124, margin + 158]
  pdf.setFillColor(8, 30, 33)
  pdf.roundedRect(margin, y, contentWidth, 7.5, 1.5, 1.5, 'F')
  setFont('bold')
  pdf.setFontSize(6.8)
  pdf.setTextColor(255, 255, 255)
  pdf.text('MONTH', colX[0] + 3, y + 5)
  pdf.text('RECEIPT NO.', colX[1] + 2, y + 5)
  pdf.text('DATE', colX[2] + 2, y + 5)
  pdf.text('CONTRIBUTION (INR)', colX[3] + 2, y + 5)
  pdf.text('STATUS', colX[4] + 2, y + 5)
  y += 7.5

  const rowH = 8.4
  summary.monthlyRows.forEach((row, idx) => {
    if (row.isSelectedMonth) {
      pdf.setFillColor(236, 253, 245)
    } else if (idx % 2 === 0) {
      pdf.setFillColor(248, 250, 252)
    } else {
      pdf.setFillColor(255, 255, 255)
    }
    pdf.setDrawColor(226, 232, 240)
    pdf.setLineWidth(0.25)
    pdf.rect(margin, y, contentWidth, rowH, 'FD')

    setFont(row.isSelectedMonth ? 'bold' : 'semibold')
    pdf.setFontSize(7.4)
    pdf.setTextColor(15, 23, 42)
    pdf.text(row.monthLabel, colX[0] + 3, y + 5.1)

    setFont('normal')
    pdf.setFontSize(7.2)
    pdf.setTextColor(71, 85, 105)
    pdf.text(row.receiptNo, colX[1] + 2, y + 5.1)
    pdf.text(row.dateString, colX[2] + 2, y + 5.1)

    if (row.isRecorded) {
      setFont('bold')
      pdf.setTextColor(15, 23, 42)
      pdf.text(`INR ${row.amount.toLocaleString('en-IN')}`, colX[3] + 2, y + 5.1)

      setFont('bold')
      pdf.setTextColor(4, 120, 87)
      pdf.text('RECEIVED', colX[4] + 2, y + 5.1)
    } else {
      setFont('normal')
      pdf.setTextColor(148, 163, 184)
      pdf.text('—', colX[3] + 2, y + 5.1)

      setFont('semibold')
      pdf.setTextColor(100, 116, 139)
      pdf.text('NOT RECORDED', colX[4] + 2, y + 5.1)
    }

    y += rowH
  })

  // Total Footer Row
  pdf.setFillColor(236, 253, 245)
  pdf.setDrawColor(16, 185, 129)
  pdf.setLineWidth(0.35)
  pdf.rect(margin, y, contentWidth, 8.2, 'FD')
  setFont('bold')
  pdf.setFontSize(8)
  pdf.setTextColor(8, 30, 33)
  pdf.text('TOTAL CONTRIBUTION (2026–27)', colX[0] + 3, y + 5.4)
  pdf.text(`INR ${summary.fullAcademicYearTotal.toLocaleString('en-IN')}`, colX[3] + 2, y + 5.4)
  setFont('semibold')
  pdf.setFontSize(7.2)
  pdf.setTextColor(4, 120, 87)
  pdf.text(
    `${summary.recordedMonthsCount} ${summary.recordedMonthsCount === 1 ? 'Month' : 'Months'}`,
    colX[4] + 2,
    y + 5.4,
  )
  y += 8.2

  // 5. Pure Black 100% Vector Arabic Blessing Dua + Ameen (No Box / No Green Fill)
  const footerY = 266
  if (hasUthmanVector) {
    const shapedDua = shapeArabicLineForUthmanVector(ZADUL_KHAIR_ARABIC_DUA, false)
    const duaY = Math.round(((y + footerY) / 2 + 1.5) * 10) / 10
    pdf.setFont('UthmanTN1', 'bold')
    pdf.setFontSize(17.5)
    pdf.setTextColor(0, 0, 0)
    pdf.text(shapedDua, pageWidth / 2, duaY, { align: 'center' })
  }

  // Signature & Verification Footer at bottom of page
  pdf.setDrawColor(203, 213, 225)
  pdf.setLineWidth(0.3)
  pdf.line(margin, footerY, pageWidth - margin, footerY)

  setFont('semibold')
  pdf.setFontSize(7.5)
  pdf.setTextColor(51, 65, 85)
  pdf.text(`Recorded / Verified By: ${recordedByDisplay}`, margin, footerY + 6)
  pdf.text('Principal Seal & Signature: _______________________', pageWidth - margin, footerY + 6, {
    align: 'right',
  })

  {
    const fBrand = 'ICS ACADEMY MANHAPPATTA'
    const fSuffix = ' • OFFICIAL DIGITAL PORTAL • VOLUNTARY ZADUL KHAIR RECEIPT'
    setBrandFont()
    pdf.setFontSize(7.2)
    const fBrandW = pdf.getTextWidth(fBrand)
    setFont('semibold')
    pdf.setFontSize(6.8)
    const fSuffixW = pdf.getTextWidth(fSuffix)
    const fStartX = pageWidth / 2 - (fBrandW + fSuffixW) / 2
    pdf.setTextColor(71, 85, 105)
    setBrandFont()
    pdf.setFontSize(7.2)
    pdf.text(fBrand, fStartX, footerY + 13)
    setFont('semibold')
    pdf.setFontSize(6.8)
    pdf.text(fSuffix, fStartX + fBrandW, footerY + 13)
  }

  const safeName = student.name.replace(/[^a-zA-Z0-9_-]/g, '_')
  const baseFileName = `ICS_Zadul_Khair_Receipt_${student.admissionNo}_${safeName}`

  if (mode === 'jpg') {
    const pdfArrayBuffer = pdf.output('arraybuffer')
    const jpgBlob = await renderPdfArrayBufferToJpgBlob(pdfArrayBuffer)
    await downloadBlobOnDevice(jpgBlob, `${baseFileName}.jpg`, 'image/jpeg')
  } else if (mode === 'print') {
    const blob = pdf.output('blob')
    await printPdfBlobOnDevice(blob, `${baseFileName}.pdf`)
  } else {
    const blob = pdf.output('blob')
    await downloadBlobOnDevice(blob, `${baseFileName}.pdf`, 'application/pdf')
  }
}

/**
 * Generates and downloads/prints the Full Class Voluntary Monthly Zadul Khair (زاد الخير)
 * Statement PDF for Class Leaders, Usthads & Principal.
 */
export async function exportClassZadulKhairReportPdf(params: {
  className: string
  monthId: string
  rows: Array<{
    student: Student
    previousAmount: number
    currentAmount: number
    totalAmount: number
    isRecorded: boolean
    receiptNo: string
    dateString: string
    remarks: string
  }>
  preparedByName: string
  preparedByRole: string
  mode: 'download' | 'print'
}): Promise<void> {
  const { className, monthId, rows, preparedByName, preparedByRole, mode } = params
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  const { fontFamily, hasElMessiri, logoDataUrl } = await loadOfficialPdfFontsAndLogo(pdf)
  const setFont = (style: 'normal' | 'semibold' | 'bold') => {
    if (fontFamily === 'Poppins') {
      pdf.setFont('Poppins', style)
    } else {
      pdf.setFont('helvetica', style === 'normal' ? 'normal' : 'bold')
    }
  }
  const setBrandFont = () => {
    if (hasElMessiri) {
      pdf.setFont('ElMessiri', 'bold')
    } else {
      setFont('bold')
    }
  }

  const mMeta = buildMonthMetaForId(monthId)
  const monthLabel = `${mMeta.month} ${mMeta.year}`

  const pageWidth = 210
  const margin = 12
  const contentWidth = pageWidth - margin * 2
  let y = 10

  // 1. Official Dark Emerald-Teal Header Banner
  const headerH = 28
  pdf.setFillColor(8, 30, 33)
  pdf.roundedRect(margin, y, contentWidth, headerH, 3.5, 3.5, 'F')

  if (logoDataUrl) {
    pdf.setFillColor(255, 255, 255)
    pdf.roundedRect(margin + 4.5, y + 3.8, 16, 20.4, 2.5, 2.5, 'F')
    const markH = 17.2
    const markW = markH * (381 / 512)
    const markX = margin + 4.5 + (16 - markW) / 2
    const markY = y + 3.8 + (20.4 - markH) / 2
    pdf.addImage(logoDataUrl, 'PNG', markX, markY, markW, markH)
  }

  const textStartX = logoDataUrl ? margin + 24 : margin + 6
  setFont('bold')
  pdf.setFontSize(7.5)
  pdf.setTextColor(163, 230, 53)
  pdf.text('ZADUL KHAIR VOLUNTARY CLASS CONTRIBUTION STATEMENT', textStartX, y + 7)

  setBrandFont()
  pdf.setFontSize(13.5)
  pdf.setTextColor(255, 255, 255)
  pdf.text('ICS ACADEMY MANHAPPATTA', textStartX, y + 13.5)

  setFont('semibold')
  pdf.setFontSize(8.2)
  pdf.setTextColor(203, 213, 225)
  pdf.text(
    `Class ${className}  •  Statement Period: ${monthLabel}`,
    textStartX,
    y + 18.5,
  )

  setFont('normal')
  pdf.setFontSize(7.2)
  pdf.setTextColor(148, 163, 184)
  pdf.text(
    `Prepared by: ${preparedByName} (${preparedByRole})`,
    textStartX,
    y + 23.5,
  )

  y += headerH + 5

  // 2. Class Voluntary Contribution Summary Strip (4 KPI Cards)
  const classPreviousTotal = rows.reduce((acc, r) => acc + r.previousAmount, 0)
  const classCurrentTotal = rows.reduce((acc, r) => acc + r.currentAmount, 0)
  const classGrandTotal = rows.reduce((acc, r) => acc + r.totalAmount, 0)
  const recordedCount = rows.filter((r) => r.isRecorded).length

  const kpiGap = 3.5
  const kpiW = (contentWidth - kpiGap * 3) / 4
  const kpiH = 18.5
  const kpiItems = [
    {
      label: 'CLASS STRENGTH',
      val: `${rows.length} Students`,
      sub: `${recordedCount} Recorded (${monthLabel})`,
    },
    {
      label: 'PREVIOUS CONTRIBUTION',
      val: `INR ${classPreviousTotal.toLocaleString('en-IN')}`,
      sub: 'Prior Months Total',
    },
    {
      label: 'CURRENT MONTH',
      val: `INR ${classCurrentTotal.toLocaleString('en-IN')}`,
      sub: monthLabel,
    },
    {
      label: 'TOTAL CONTRIBUTION',
      val: `INR ${classGrandTotal.toLocaleString('en-IN')}`,
      sub: 'Previous + Current',
    },
  ]

  kpiItems.forEach((k, i) => {
    const bx = margin + i * (kpiW + kpiGap)
    pdf.setFillColor(i === 3 ? 236 : 248, i === 3 ? 253 : 250, i === 3 ? 245 : 252)
    pdf.setDrawColor(i === 3 ? 16 : 203, i === 3 ? 185 : 213, i === 3 ? 129 : 225)
    pdf.roundedRect(bx, y, kpiW, kpiH, 2.2, 2.2, 'FD')

    setFont('bold')
    pdf.setFontSize(5.8)
    pdf.setTextColor(100, 116, 139)
    pdf.text(k.label, bx + 2.8, y + 5)

    setFont('bold')
    pdf.setFontSize(9.6)
    pdf.setTextColor(8, 30, 33)
    pdf.text(k.val, bx + 2.8, y + 11.4)

    setFont('normal')
    pdf.setFontSize(6.3)
    pdf.setTextColor(71, 85, 105)
    pdf.text(k.sub, bx + 2.8, y + 15.8)
  })

  y += kpiH + 5

  // 3. Roster Table Header
  const drawTableHeader = (topY: number) => {
    pdf.setFillColor(8, 30, 33)
    pdf.roundedRect(margin, topY, contentWidth, 7.5, 1.2, 1.2, 'F')
    setFont('bold')
    pdf.setFontSize(6.4)
    pdf.setTextColor(255, 255, 255)
    pdf.text('#', margin + 2, topY + 5)
    pdf.text('ADMISSION NO.', margin + 8.5, topY + 5)
    pdf.text('STUDENT NAME', margin + 35, topY + 5)
    pdf.text('RECEIPT NO.', margin + 86, topY + 5)
    pdf.text('PREVIOUS', margin + 115, topY + 5)
    pdf.text('CURRENT', margin + 134, topY + 5)
    pdf.text('TOTAL', margin + 151, topY + 5)
    pdf.text('STATUS', margin + 166, topY + 5)
    return topY + 7.5
  }

  y = drawTableHeader(y)

  rows.forEach((row, index) => {
    if (y > 264) {
      pdf.addPage()
      y = 14
      y = drawTableHeader(y)
    }
    const rowH = 6.6
    if (index % 2 === 0) {
      pdf.setFillColor(248, 250, 252)
    } else {
      pdf.setFillColor(255, 255, 255)
    }
    pdf.setDrawColor(226, 232, 240)
    pdf.rect(margin, y, contentWidth, rowH, 'FD')

    setFont('normal')
    pdf.setFontSize(6.8)
    pdf.setTextColor(71, 85, 105)
    pdf.text(String(index + 1), margin + 2, y + 4.5)
    pdf.text(row.student.admissionNo, margin + 8.5, y + 4.5)

    setFont('semibold')
    pdf.setTextColor(15, 23, 42)
    pdf.text(row.student.name.slice(0, 26), margin + 35, y + 4.5)

    setFont('normal')
    pdf.setTextColor(71, 85, 105)
    pdf.text(row.isRecorded ? row.receiptNo || '-' : '—', margin + 86, y + 4.5)
    pdf.text(row.previousAmount.toLocaleString('en-IN'), margin + 115, y + 4.5)

    setFont('bold')
    pdf.setTextColor(row.isRecorded ? 4 : 148, row.isRecorded ? 120 : 163, row.isRecorded ? 87 : 184)
    pdf.text(row.isRecorded ? row.currentAmount.toLocaleString('en-IN') : '—', margin + 134, y + 4.5)

    setFont('bold')
    pdf.setTextColor(15, 23, 42)
    pdf.text(row.totalAmount.toLocaleString('en-IN'), margin + 151, y + 4.5)

    if (row.isRecorded) {
      setFont('bold')
      pdf.setTextColor(4, 120, 87)
      pdf.text('RECEIVED', margin + 166, y + 4.5)
    } else {
      setFont('normal')
      pdf.setTextColor(100, 116, 139)
      pdf.text('NOT RECORDED', margin + 166, y + 4.5)
    }

    y += rowH
  })

  // Class Summary Footer Row
  if (y > 268) {
    pdf.addPage()
    y = 14
  }
  pdf.setFillColor(236, 253, 245)
  pdf.setDrawColor(16, 185, 129)
  pdf.rect(margin, y, contentWidth, 7.6, 'FD')
  setFont('bold')
  pdf.setFontSize(7.2)
  pdf.setTextColor(8, 30, 33)
  pdf.text(`CLASS ${className} TOTAL`, margin + 8.5, y + 5)
  pdf.text(classPreviousTotal.toLocaleString('en-IN'), margin + 115, y + 5)
  pdf.text(classCurrentTotal.toLocaleString('en-IN'), margin + 134, y + 5)
  pdf.text(classGrandTotal.toLocaleString('en-IN'), margin + 151, y + 5)
  pdf.setTextColor(4, 120, 87)
  pdf.text(`${recordedCount}/${rows.length}`, margin + 166, y + 5)
  y += 7.6

  // Footer
  const footerY = Math.min(282, y + 8)
  {
    const fBrand = 'ICS ACADEMY MANHAPPATTA'
    const fSuffix = ` • OFFICIAL VOLUNTARY CLASS STATEMENT • ${new Date().toLocaleDateString('en-IN')}`
    setBrandFont()
    pdf.setFontSize(7.5)
    const fBrandW = pdf.getTextWidth(fBrand)
    setFont('semibold')
    pdf.setFontSize(7.0)
    const fSuffixW = pdf.getTextWidth(fSuffix)
    const fStartX = pageWidth / 2 - (fBrandW + fSuffixW) / 2
    pdf.setTextColor(71, 85, 105)
    setBrandFont()
    pdf.setFontSize(7.5)
    pdf.text(fBrand, fStartX, footerY)
    setFont('semibold')
    pdf.setFontSize(7.0)
    pdf.text(fSuffix, fStartX + fBrandW, footerY)
  }

  const blob = pdf.output('blob')
  const safeClass = className.replace(/\s+/g, '_')
  const fileName = `ICS_Zadul_Khair_Class_${safeClass}_${monthId}.pdf`

  if (mode === 'print') {
    await printPdfBlobOnDevice(blob, fileName)
  } else {
    await downloadBlobOnDevice(blob, fileName, 'application/pdf')
  }
}
