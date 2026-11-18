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
  findUsthadForTeacherName,
  getClassSemesterTimetableByClassName,
  getEffectiveStudentAttendance,
  loadAttendanceOverrides,
  loadCustomNotices,
  loadPeriodAttendanceSubmissions,
  normalizeClassName,
  students,
  type Student,
} from '@/components/dashboard/data'
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
const SEEDED_VERSION_KEY = 'ics_campus_academic_records_seeded_v4_chapter_range'

export const ZADUL_KHAIR_DEFAULT_FIXED_AMOUNT = 600

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

    // 4. Seed Zadul Khair (زاد الخير) Monthly Household Contribution records for the first 5 students per class
    classStudents.slice(0, 5).forEach((stu, idx) => {
      const status: AcademicRecordStatus = idx < 3 ? 'paid' : idx === 3 ? 'partial' : 'unpaid'
      const paidAmount =
        status === 'paid'
          ? ZADUL_KHAIR_DEFAULT_FIXED_AMOUNT
          : status === 'partial'
            ? 300
            : 0
      records.push({
        id: `zk_2026-11_${stu.id}`,
        campusId: 'ics-academy',
        recordKind: 'zadul_khair',
        className,
        studentId: stu.id,
        studentName: stu.name,
        admissionNo: stu.admissionNo,
        month: '2026-11',
        title: 'Zadul Khair (زاد الخير) Monthly Household Contribution',
        subjectOrCategory: 'November 2026',
        remarks:
          status === 'paid'
            ? 'Received full monthly household contribution with gratitude.'
            : status === 'partial'
              ? 'Partial contribution received; balance pending.'
              : 'Monthly household collection pending for November 2026.',
        status,
        actorId: usthad.id,
        actorName: usthad.name,
        dateString: '15 Nov 2026',
        receiptNo: `ZK-2611-${stu.admissionNo.slice(-4)}`,
        fixedAmount: ZADUL_KHAIR_DEFAULT_FIXED_AMOUNT,
        paidAmount,
        isDeleted: false,
        updatedAtMs: baseTs + seq++,
      })
    })

    // 5. Seed Jamiathul Hind (ജാമിഅതുൽ ഹിന്ദ്) Monthly Syllabus & Kitab Page Tracker records for each timetable period
    const semTimetable = getClassSemesterTimetableByClassName(className)
    const sampleChapterRanges = [
      {
        fromChapter: 'ബാബു ശുറൂത്തി സ്വലാത്ത് (Ch. 1: Shurut al-Salah)',
        toChapter: 'ബാബു സ്വലാത്തുൽ ജമാഅത്ത് (Ch. 4: Salat al-Jama’ah)',
      },
      {
        fromChapter: 'ബാബുൽ ഇഅ്റാബി വൽ ബിനാഅ് (Ch. 1: Al-I’rab wa al-Bina)',
        toChapter: 'ബാബുൽ മഅ്രിഫത്തി വൻ നകിറ (Ch. 3: Al-Ma’rifah wa al-Nakirah)',
      },
      {
        fromChapter: 'കിതാബുൽ ഇൽമ് — ഹദീസ് 1 (Kitab al-Ilm: Hadith 1)',
        toChapter: 'ബാബു ഫള്ലുൽ ഇൽമ് — ഹദീസ് 35 (Hadith 35)',
      },
      {
        fromChapter: 'സൂറത്തു യാസീൻ — ആയത്ത് 1 (Surah Yasin: Ayah 1)',
        toChapter: 'സൂറത്തു യാസീൻ — ആയത്ത് 40 (Surah Yasin: Ayah 40)',
      },
      {
        fromChapter: 'അൽ അഹ്കാമുള്ളാഹി (Ch. 1: Al-Ahkam al-Taklifiyyah)',
        toChapter: 'അൽ ആം വൽ ഖാസ്വ് (Ch. 3: Al-Amm wa al-Khass)',
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
        `${chapterRange.fromChapter} മുതൽ ${chapterRange.toChapter} വരെ`.slice(0, 120)
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

function normalizeLegacyZadulKhairAmount(
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
  if (rec.fixedAmount === 500 || rec.fixedAmount === undefined) {
    const wasPaid500 = rec.status === 'paid' && (rec.paidAmount === 500 || rec.paidAmount === undefined)
    return {
      ...rec,
      fixedAmount: ZADUL_KHAIR_DEFAULT_FIXED_AMOUNT,
      paidAmount: wasPaid500 ? ZADUL_KHAIR_DEFAULT_FIXED_AMOUNT : rec.paidAmount,
    }
  }
  return rec
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
                byId.set(p.id, normalizeLegacyZadulKhairAmount(p, byId.get(p.id)))
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
        const normalized = normalizeLegacyZadulKhairAmount(p, existing)
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

export function subscribeCampusAcademicRecords(
  onUpdate: (records: CampusAcademicRecord[]) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}

  const handleLocal = () => {
    onUpdate(loadCampusAcademicRecords())
  }

  window.addEventListener('ics-academic-records-updated', handleLocal)

  let unsubFirestore = () => {}
  try {
    const q = query(
      collection(db, 'campusAcademicRecords'),
      where('updatedAtMs', '>', 0),
      orderBy('updatedAtMs', 'desc'),
      limit(350),
    )

    unsubFirestore = onSnapshot(
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
          onUpdate(loadCampusAcademicRecords())
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

  return () => {
    window.removeEventListener('ics-academic-records-updated', handleLocal)
    try {
      unsubFirestore()
    } catch {
      // Ignore
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
  const monthMeta = MONTHS_META.find((m) => m.id === monthId) || MONTHS_META[0]
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
  logoDataUrl: string | null
}> {
  let fontFamily: 'Poppins' | 'helvetica' = 'helvetica'
  let hasElMessiri = false
  let logoDataUrl: string | null = null

  try {
    const [regRes, semiRes, boldRes, elMessiriRes] = await Promise.all([
      fetch('/fonts/Poppins-Regular.ttf'),
      fetch('/fonts/Poppins-SemiBold.ttf'),
      fetch('/fonts/Poppins-Bold.ttf'),
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

  return { fontFamily, hasElMessiri, logoDataUrl }
}

/**
 * Generates and downloads/prints an Official ICS Academy Manhappatta
 * Zadul Khair (زاد الخير) Individual Student Receipt & Household Ledger Statement PDF.
 */
export async function exportStudentZadulKhairReceiptPdf(params: {
  student: Student
  record: CampusAcademicRecord
  historyRecords: CampusAcademicRecord[]
  mode: 'download' | 'print'
}): Promise<void> {
  const { student, record, historyRecords, mode } = params
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

  const pageWidth = 210
  const margin = 12
  const contentWidth = pageWidth - margin * 2
  let y = 10

  // 1. Dark Emerald-Teal Official Institutional Banner (#081E21)
  const headerH = 29
  pdf.setFillColor(8, 30, 33)
  pdf.roundedRect(margin, y, contentWidth, headerH, 3.5, 3.5, 'F')

  if (logoDataUrl) {
    pdf.setFillColor(255, 255, 255)
    pdf.roundedRect(margin + 4.5, y + 4.2, 16.5, 20.6, 2.5, 2.5, 'F')
    const markH = 17.5
    const markW = markH * (381 / 512)
    const markX = margin + 4.5 + (16.5 - markW) / 2
    const markY = y + 4.2 + (20.6 - markH) / 2
    pdf.addImage(logoDataUrl, 'PNG', markX, markY, markW, markH)
  }

  const textStartX = logoDataUrl ? margin + 24.5 : margin + 6
  setFont('bold')
  pdf.setFontSize(7.5)
  pdf.setTextColor(163, 230, 53) // #a3e635 lime
  pdf.text('ZADUL KHAIR MONTHLY HOUSEHOLD CONTRIBUTION RECEIPT', textStartX, y + 7.2)

  setBrandFont()
  pdf.setFontSize(13.5)
  pdf.setTextColor(255, 255, 255)
  pdf.text('ICS ACADEMY MANHAPPATTA', textStartX, y + 13.8)

  setFont('semibold')
  pdf.setFontSize(8.2)
  pdf.setTextColor(203, 213, 225)
  pdf.text('Islamic Cultural Society • Manhappatta, Kerala', textStartX, y + 18.8)

  setFont('normal')
  pdf.setFontSize(7.2)
  pdf.setTextColor(148, 163, 184)
  pdf.text(
    'Academic Year 2026-27  |  Official Household Contribution & Receipt Statement',
    textStartX,
    y + 23.8,
  )

  // Right receipt badge
  const badgeW = 48
  const badgeH = 17
  const badgeX = pageWidth - margin - badgeW - 4.5
  const badgeY = y + 6
  pdf.setFillColor(13, 46, 50)
  pdf.setDrawColor(163, 230, 53)
  pdf.setLineWidth(0.3)
  pdf.roundedRect(badgeX, badgeY, badgeW, badgeH, 2.2, 2.2, 'FD')

  setFont('bold')
  pdf.setFontSize(6.5)
  pdf.setTextColor(163, 230, 53)
  pdf.text('RECEIPT NO.', badgeX + badgeW / 2, badgeY + 5.2, { align: 'center' })

  setFont('bold')
  pdf.setFontSize(9)
  pdf.setTextColor(255, 255, 255)
  const receiptCode = record.receiptNo || `ZK-${record.month || '2026-11'}-${student.admissionNo.slice(-4)}`
  pdf.text(receiptCode, badgeX + badgeW / 2, badgeY + 10.5, { align: 'center' })

  setFont('normal')
  pdf.setFontSize(6.5)
  pdf.setTextColor(203, 213, 225)
  pdf.text(record.dateString || 'Nov 2026', badgeX + badgeW / 2, badgeY + 14.8, {
    align: 'center',
  })

  y += headerH + 6

  // 2. Student & Household Identity Card
  const idCardH = 26
  pdf.setFillColor(248, 250, 252)
  pdf.setDrawColor(203, 213, 225)
  pdf.setLineWidth(0.35)
  pdf.roundedRect(margin, y, contentWidth, idCardH, 2.8, 2.8, 'FD')

  setFont('bold')
  pdf.setFontSize(7)
  pdf.setTextColor(100, 116, 139)
  pdf.text('STUDENT & HOUSEHOLD DETAILS', margin + 5, y + 6)

  setFont('bold')
  pdf.setFontSize(12)
  pdf.setTextColor(15, 23, 42)
  pdf.text(student.name, margin + 5, y + 13)

  setFont('semibold')
  pdf.setFontSize(8.5)
  pdf.setTextColor(51, 65, 85)
  pdf.text(
    `Admission No: ${student.admissionNo}   •   Class: ${student.className} (${student.batch})`,
    margin + 5,
    y + 19,
  )

  setFont('normal')
  pdf.setFontSize(7.5)
  pdf.setTextColor(100, 116, 139)
  pdf.text(
    `Recorded By: ${record.actorName || 'Class Usthad'}   •   Collection Month: ${record.subjectOrCategory || record.month || 'November 2026'}`,
    margin + 5,
    y + 23.5,
  )

  y += idCardH + 6

  // 3. Current Month Financial Summary KPI Strip (3 Boxes)
  const fixedAmt = Number(record.fixedAmount ?? ZADUL_KHAIR_DEFAULT_FIXED_AMOUNT)
  const paidAmt = Number(record.paidAmount ?? 0)
  const balanceAmt = Math.max(0, fixedAmt - paidAmt)
  const kpiGap = 4
  const kpiW = (contentWidth - kpiGap * 2) / 3
  const kpiH = 22

  const kpis = [
    {
      label: 'FIXED MONTHLY CONTRIBUTION',
      val: `INR ${fixedAmt.toLocaleString('en-IN')}`,
      sub: 'Standard Household Quota',
      bg: [241, 245, 249] as [number, number, number],
      border: [203, 213, 225] as [number, number, number],
      color: [15, 23, 42] as [number, number, number],
    },
    {
      label: 'AMOUNT RECEIVED (PAID)',
      val: `INR ${paidAmt.toLocaleString('en-IN')}`,
      sub:
        record.status === 'paid'
          ? 'Status: PAID IN FULL'
          : record.status === 'partial'
            ? 'Status: PARTIALLY PAID'
            : 'Status: UNPAID / PENDING',
      bg:
        record.status === 'paid'
          ? ([236, 253, 245] as [number, number, number])
          : record.status === 'partial'
            ? ([254, 243, 199] as [number, number, number])
            : ([254, 242, 242] as [number, number, number]),
      border:
        record.status === 'paid'
          ? ([16, 185, 129] as [number, number, number])
          : record.status === 'partial'
            ? ([245, 158, 11] as [number, number, number])
            : ([239, 68, 68] as [number, number, number]),
      color:
        record.status === 'paid'
          ? ([4, 120, 87] as [number, number, number])
          : record.status === 'partial'
            ? ([180, 83, 9] as [number, number, number])
            : ([185, 28, 28] as [number, number, number]),
    },
    {
      label: 'BALANCE PENDING',
      val: `INR ${balanceAmt.toLocaleString('en-IN')}`,
      sub: balanceAmt === 0 ? 'No Dues Remaining' : 'Remaining for Month',
      bg: [248, 250, 252] as [number, number, number],
      border: [203, 213, 225] as [number, number, number],
      color: balanceAmt === 0 ? ([4, 120, 87] as [number, number, number]) : ([185, 28, 28] as [number, number, number]),
    },
  ]

  kpis.forEach((box, idx) => {
    const bx = margin + idx * (kpiW + kpiGap)
    pdf.setFillColor(...box.bg)
    pdf.setDrawColor(...box.border)
    pdf.setLineWidth(0.35)
    pdf.roundedRect(bx, y, kpiW, kpiH, 2.5, 2.5, 'FD')

    setFont('bold')
    pdf.setFontSize(6.5)
    pdf.setTextColor(100, 116, 139)
    pdf.text(box.label, bx + 4, y + 5.8)

    setFont('bold')
    pdf.setFontSize(12.5)
    pdf.setTextColor(...box.color)
    pdf.text(box.val, bx + 4, y + 13.5)

    setFont('semibold')
    pdf.setFontSize(7)
    pdf.setTextColor(71, 85, 105)
    pdf.text(box.sub, bx + 4, y + 18.8)
  })

  y += kpiH + 6

  // 4. Usthad Remarks Box
  const remarkH = 18
  pdf.setFillColor(255, 255, 255)
  pdf.setDrawColor(203, 213, 225)
  pdf.roundedRect(margin, y, contentWidth, remarkH, 2.5, 2.5, 'FD')
  setFont('bold')
  pdf.setFontSize(7)
  pdf.setTextColor(8, 30, 33)
  pdf.text('USTHAD / OFFICE ACKNOWLEDGEMENT NOTE', margin + 4.5, y + 5.5)

  setFont('normal')
  pdf.setFontSize(8)
  pdf.setTextColor(51, 65, 85)
  const noteText =
    record.remarks ||
    'Jazakallahu Khairan for supporting ICS Academy Manhappatta through the monthly Zadul Khair household contribution.'
  pdf.text(pdf.splitTextToSize(noteText, contentWidth - 9).slice(0, 2), margin + 4.5, y + 11.2)

  y += remarkH + 7

  // 5. Complete Academic Year Household Ledger Table for this Student
  setFont('bold')
  pdf.setFontSize(9)
  pdf.setTextColor(8, 30, 33)
  pdf.text('STUDENT ZADUL KHAIR LEDGER HISTORY (2026–27)', margin, y)
  y += 3.5

  const colX = [margin, margin + 38, margin + 74, margin + 108, margin + 142, margin + 168]
  pdf.setFillColor(8, 30, 33)
  pdf.roundedRect(margin, y, contentWidth, 8, 1.5, 1.5, 'F')
  setFont('bold')
  pdf.setFontSize(7)
  pdf.setTextColor(255, 255, 255)
  pdf.text('MONTH', colX[0] + 3, y + 5.3)
  pdf.text('RECEIPT NO.', colX[1] + 2, y + 5.3)
  pdf.text('DATE', colX[2] + 2, y + 5.3)
  pdf.text('FIXED (INR)', colX[3] + 2, y + 5.3)
  pdf.text('PAID (INR)', colX[4] + 2, y + 5.3)
  pdf.text('STATUS', colX[5] + 2, y + 5.3)
  y += 8

  const rows = historyRecords.length > 0 ? historyRecords : [record]
  let totalFixedSum = 0
  let totalPaidSum = 0

  rows.slice(0, 12).forEach((r, idx) => {
    const rFixed = Number(r.fixedAmount ?? ZADUL_KHAIR_DEFAULT_FIXED_AMOUNT)
    const rPaid = Number(r.paidAmount ?? 0)
    totalFixedSum += rFixed
    totalPaidSum += rPaid

    if (idx % 2 === 0) {
      pdf.setFillColor(248, 250, 252)
    } else {
      pdf.setFillColor(255, 255, 255)
    }
    pdf.setDrawColor(226, 232, 240)
    pdf.rect(margin, y, contentWidth, 7.5, 'FD')

    const mMeta = MONTHS_META.find((m) => m.id === r.month)
    const monthTitle = mMeta ? `${mMeta.month} ${mMeta.year}` : r.subjectOrCategory || r.month || 'Nov 2026'

    setFont('semibold')
    pdf.setFontSize(7.5)
    pdf.setTextColor(15, 23, 42)
    pdf.text(monthTitle, colX[0] + 3, y + 5)

    setFont('normal')
    pdf.setTextColor(71, 85, 105)
    pdf.text(r.receiptNo || `ZK-${r.month || '2611'}`, colX[1] + 2, y + 5)
    pdf.text(r.dateString || '-', colX[2] + 2, y + 5)
    pdf.text(rFixed.toLocaleString('en-IN'), colX[3] + 2, y + 5)

    setFont('bold')
    pdf.setTextColor(15, 23, 42)
    pdf.text(rPaid.toLocaleString('en-IN'), colX[4] + 2, y + 5)

    const stLabel =
      r.status === 'paid' ? 'PAID' : r.status === 'partial' ? 'PARTIAL' : 'UNPAID'
    if (r.status === 'paid') pdf.setTextColor(4, 120, 87)
    else if (r.status === 'partial') pdf.setTextColor(180, 83, 9)
    else pdf.setTextColor(185, 28, 28)
    pdf.text(stLabel, colX[5] + 2, y + 5)

    y += 7.5
  })

  // Total Footer Row
  pdf.setFillColor(236, 253, 245)
  pdf.setDrawColor(16, 185, 129)
  pdf.rect(margin, y, contentWidth, 8, 'FD')
  setFont('bold')
  pdf.setFontSize(8)
  pdf.setTextColor(8, 30, 33)
  pdf.text('TOTAL CUMULATIVE CONTRIBUTION', colX[0] + 3, y + 5.3)
  pdf.text(`INR ${totalFixedSum.toLocaleString('en-IN')}`, colX[3] + 2, y + 5.3)
  pdf.text(`INR ${totalPaidSum.toLocaleString('en-IN')}`, colX[4] + 2, y + 5.3)

  // Signature & Verification Footer at bottom of page
  const footerY = 266
  pdf.setDrawColor(203, 213, 225)
  pdf.line(margin, footerY, pageWidth - margin, footerY)

  setFont('semibold')
  pdf.setFontSize(7.5)
  pdf.setTextColor(51, 65, 85)
  pdf.text(`Verified By: ${record.actorName || 'Class Usthad'}`, margin, footerY + 6)
  pdf.text('Principal Seal & Signature: _______________________', pageWidth - margin, footerY + 6, {
    align: 'right',
  })

  setBrandFont()
  pdf.setFontSize(7.2)
  pdf.setTextColor(71, 85, 105)
  pdf.text(
    'ICS ACADEMY MANHAPPATTA • OFFICIAL DIGITAL PORTAL • VALID ZADUL KHAIR RECEIPT',
    pageWidth / 2,
    footerY + 13,
    { align: 'center' },
  )

  const blob = pdf.output('blob')
  const safeName = student.name.replace(/[^a-zA-Z0-9_-]/g, '_')
  const fileName = `ICS_Zadul_Khair_Receipt_${student.admissionNo}_${safeName}.pdf`

  if (mode === 'print') {
    await printPdfBlobOnDevice(blob, fileName)
  } else {
    await downloadBlobOnDevice(blob, fileName, 'application/pdf')
  }
}

/**
 * Generates and downloads/prints the Full Class Monthly Zadul Khair (زاد الخير) Statement PDF for Usthads & Principal.
 */
export async function exportClassZadulKhairReportPdf(params: {
  className: string
  monthId: string
  rows: Array<{
    student: Student
    fixedAmount: number
    paidAmount: number
    status: AcademicRecordStatus
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

  const mMeta = MONTHS_META.find((m) => m.id === monthId)
  const monthLabel = mMeta ? `${mMeta.month} ${mMeta.year}` : monthId

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
  pdf.text('ZADUL KHAIR CLASS MONTHLY COLLECTION STATEMENT', textStartX, y + 7)

  setBrandFont()
  pdf.setFontSize(13.5)
  pdf.setTextColor(255, 255, 255)
  pdf.text('ICS ACADEMY MANHAPPATTA', textStartX, y + 13.5)

  setFont('semibold')
  pdf.setFontSize(8.2)
  pdf.setTextColor(203, 213, 225)
  pdf.text(
    `Class ${className}  •  Collection Period: ${monthLabel}`,
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

  // 2. Class Summary Metrics Strip
  const totalFixed = rows.reduce((acc, r) => acc + r.fixedAmount, 0)
  const totalCollected = rows.reduce((acc, r) => acc + r.paidAmount, 0)
  const totalPending = Math.max(0, totalFixed - totalCollected)
  const paidCount = rows.filter((r) => r.status === 'paid').length

  const kpiGap = 3.5
  const kpiW = (contentWidth - kpiGap * 3) / 4
  const kpiH = 18
  const kpiItems = [
    { label: 'CLASS STRENGTH', val: `${rows.length} Students`, sub: `${paidCount} Paid in Full` },
    { label: 'EXPECTED TARGET', val: `INR ${totalFixed.toLocaleString('en-IN')}`, sub: monthLabel },
    { label: 'TOTAL COLLECTED', val: `INR ${totalCollected.toLocaleString('en-IN')}`, sub: `${totalFixed > 0 ? Math.round((totalCollected / totalFixed) * 100) : 0}% Achieved` },
    { label: 'BALANCE PENDING', val: `INR ${totalPending.toLocaleString('en-IN')}`, sub: `${rows.length - paidCount} Households Pending` },
  ]

  kpiItems.forEach((k, i) => {
    const bx = margin + i * (kpiW + kpiGap)
    pdf.setFillColor(248, 250, 252)
    pdf.setDrawColor(203, 213, 225)
    pdf.roundedRect(bx, y, kpiW, kpiH, 2.2, 2.2, 'FD')

    setFont('bold')
    pdf.setFontSize(6)
    pdf.setTextColor(100, 116, 139)
    pdf.text(k.label, bx + 3, y + 5)

    setFont('bold')
    pdf.setFontSize(10)
    pdf.setTextColor(8, 30, 33)
    pdf.text(k.val, bx + 3, y + 11.2)

    setFont('normal')
    pdf.setFontSize(6.5)
    pdf.setTextColor(71, 85, 105)
    pdf.text(k.sub, bx + 3, y + 15.6)
  })

  y += kpiH + 5

  // 3. Roster Table Header
  const drawTableHeader = (topY: number) => {
    pdf.setFillColor(8, 30, 33)
    pdf.roundedRect(margin, topY, contentWidth, 7.5, 1.2, 1.2, 'F')
    setFont('bold')
    pdf.setFontSize(6.8)
    pdf.setTextColor(255, 255, 255)
    pdf.text('#', margin + 2.5, topY + 5)
    pdf.text('ADMISSION NO.', margin + 10, topY + 5)
    pdf.text('STUDENT NAME', margin + 40, topY + 5)
    pdf.text('RECEIPT NO.', margin + 102, topY + 5)
    pdf.text('FIXED', margin + 132, topY + 5)
    pdf.text('PAID', margin + 152, topY + 5)
    pdf.text('STATUS', margin + 170, topY + 5)
    return topY + 7.5
  }

  y = drawTableHeader(y)

  rows.forEach((row, index) => {
    if (y > 268) {
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
    pdf.setFontSize(7)
    pdf.setTextColor(71, 85, 105)
    pdf.text(String(index + 1), margin + 2.5, y + 4.5)
    pdf.text(row.student.admissionNo, margin + 10, y + 4.5)

    setFont('semibold')
    pdf.setTextColor(15, 23, 42)
    pdf.text(row.student.name.slice(0, 32), margin + 40, y + 4.5)

    setFont('normal')
    pdf.setTextColor(71, 85, 105)
    pdf.text(row.receiptNo || '-', margin + 102, y + 4.5)
    pdf.text(String(row.fixedAmount), margin + 132, y + 4.5)

    setFont('bold')
    pdf.setTextColor(15, 23, 42)
    pdf.text(String(row.paidAmount), margin + 152, y + 4.5)

    const statusText =
      row.status === 'paid' ? 'PAID' : row.status === 'partial' ? 'PARTIAL' : 'UNPAID'
    if (row.status === 'paid') pdf.setTextColor(4, 120, 87)
    else if (row.status === 'partial') pdf.setTextColor(180, 83, 9)
    else pdf.setTextColor(185, 28, 28)
    pdf.text(statusText, margin + 170, y + 4.5)

    y += rowH
  })

  // Footer
  const footerY = Math.min(282, y + 8)
  setBrandFont()
  pdf.setFontSize(7.5)
  pdf.setTextColor(71, 85, 105)
  pdf.text(
    `ICS ACADEMY MANHAPPATTA • OFFICIAL CLASS STATEMENT • ${new Date().toLocaleDateString('en-IN')}`,
    pageWidth / 2,
    footerY,
    { align: 'center' },
  )

  const blob = pdf.output('blob')
  const safeClass = className.replace(/\s+/g, '_')
  const fileName = `ICS_Zadul_Khair_Class_${safeClass}_${monthId}.pdf`

  if (mode === 'print') {
    await printPdfBlobOnDevice(blob, fileName)
  } else {
    await downloadBlobOnDevice(blob, fileName, 'application/pdf')
  }
}
