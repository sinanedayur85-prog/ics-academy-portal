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
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase'

export type MonthlyAttendance = {
  id: string
  month: string
  shortMonth: string
  year: number
  calendarDays: number
  openDays: number
  closedDays: number
  officialHolidayDays: number
  officialHolidayNote: string
  workingDays: number
  present: number
  absent: number
  leave: number
}

export type Student = {
  id: string
  name: string
  firstName: string
  className: string
  batch: string
  admissionNo: string
  avatarUrl?: string
  attendance: {
    present: number
    absent: number
    leave: number
  }
  monthlyAttendance: MonthlyAttendance[]
}

export const STUDENT_AVATAR_BY_ADMISSION_NO: Record<string, string> = {
  ICS2K220601: '/images/muhammed-sinan-nt.jpg',
}

export type AcademyClassInfo = {
  id: string
  className: string
  fullLabel: string
  batch: string
}

export const ACADEMY_CLASSES: AcademyClassInfo[] = [
  { id: 'batch-14', className: '8th', fullLabel: 'Class 8th', batch: 'Batch 14' },
  { id: 'batch-13', className: '9th', fullLabel: 'Class 9th', batch: 'Batch 13' },
  { id: 'batch-12', className: '10th', fullLabel: 'Class 10th', batch: 'Batch 12' },
  { id: 'batch-11', className: 'HS 1', fullLabel: 'Class HS 1', batch: 'Batch 11' },
  { id: 'batch-10', className: 'HS 2A', fullLabel: 'Class HS 2A', batch: 'Batch 10' },
  { id: 'batch-10b', className: 'HS 2B', fullLabel: 'Class HS 2B', batch: 'Batch 10' },
  { id: 'batch-09', className: 'BS 1', fullLabel: 'Class BS 1', batch: 'Batch 09' },
  { id: 'batch-08', className: 'BS 2', fullLabel: 'Class BS 2', batch: 'Batch 08' },
  { id: 'batch-07', className: 'BS 3', fullLabel: 'Class BS 3', batch: 'Batch 07' },
  { id: 'batch-06', className: 'BS 4', fullLabel: 'Class BS 4', batch: 'Batch 06' },
  { id: 'batch-05', className: 'BS 5', fullLabel: 'Class BS 5', batch: 'Batch 05' },
]

export function normalizeClassName(raw?: string): string {
  if (!raw) return ''
  if (raw === 'ALL') return 'ALL'
  return raw
    .split('•')[0]
    .replace(/^Class\s+/i, '')
    .trim()
}

const RAW_CLASS_ROSTERS: {
  className: string
  batch: string
  entries: [admissionNo: string, name: string][]
}[] = [
  {
    className: '8th',
    batch: 'Batch 14',
    entries: [
      ['ICS2K261401', 'Muhammed Hassan C'],
      ['ICS2K261402', 'Swalahudeen CK'],
      ['ICS2K261403', 'Muhammed Rifin K'],
      ['ICS2K261404', 'Muhammed Ajwad K'],
      ['ICS2K261405', 'Muhammed Jishan VV'],
      ['ICS2K261406', 'Muhammed Bishr TP'],
      ['ICS2K261407', 'Fuad Saneen M'],
      ['ICS2K261408', 'Muhammed Jeelani V'],
      ['ICS2K261409', 'Muhammed Swabeeh K'],
      ['ICS2K261410', 'Muhammed Savad M'],
      ['ICS2K261411', 'Ayman KM'],
      ['ICS2K261412', 'Muhammed Hisham MK'],
      ['ICS2K261413', 'Rayid Rasheed N'],
      ['ICS2K261414', 'Ashmil Musthafa T'],
      ['ICS2K261415', 'Ashmil Nasar T'],
      ['ICS2K261416', 'Swalahudeen P'],
      ['ICS2K261417', 'Muhammed Zayyan C'],
      ['ICS2K261418', 'Muhammed Twalha K'],
      ['ICS2K261419', 'Muhammed Sabiq K'],
      ['ICS2K261420', 'Muhammed Ashiq Ali M'],
      ['ICS2K261421', 'Bishr Muhammed CP'],
      ['ICS2K261422', 'Muhammed Swabeeh CK'],
      ['ICS2K261423', 'Muhammed Razeen MP'],
      ['ICS2K261424', 'Sirajuddeen Hadi C'],
      ['ICS2K261425', 'Muhammed Bishr E'],
      ['ICS2K261426', 'Muhammed Sinan A'],
    ],
  },
  {
    className: '9th',
    batch: 'Batch 13',
    entries: [
      ['ICS2K251301', 'Muhammed Ziyad. K T'],
      ['ICS2K251302', 'Muhammed Mirshad'],
      ['ICS2K251303', 'Muhammed Hamdan'],
      ['ICS2K251304', 'Muhammed Shibil. TM'],
      ['ICS2K251305', 'Muhammed Saneeh. OK'],
      ['ICS2K251306', 'Muhammed Sabith'],
      ['ICS2K251307', 'Muhammed Raihan M'],
      ['ICS2K251308', 'Muhammed Jasir C P'],
      ['ICS2K251309', 'Muhammed Moonis'],
      ['ICS2K251310', 'Muhammed Shaheem.K'],
      ['ICS2K251311', 'Muhammed Sirajudheen.P'],
      ['ICS2K251312', 'Yaseen Mahsood. NT'],
      ['ICS2K251313', 'Muhammed Mubarak. AP'],
      ['ICS2K251314', 'Muhammed Shamveel. CP'],
      ['ICS2K251315', 'Shuhaib'],
      ['ICS2K251316', 'Muhammed Rilsh. KT'],
      ['ICS2K251317', 'Muhammed Shaheem. M'],
      ['ICS2K251318', 'Muhammed Adnan. E'],
      ['ICS2K251319', 'Abdul Hadi.K'],
      ['ICS2K251320', 'Muhammed Sahl. TH'],
      ['ICS2K251321', 'Muhammed Adil'],
      ['ICS2K251322', 'Saadudheen. K'],
      ['ICS2K251323', 'Safwan'],
      ['ICS2K251324', 'Muhammed Hashim. T'],
      ['ICS2K251325', "Muhammed Mis'hab"],
    ],
  },
  {
    className: '10th',
    batch: 'Batch 12',
    entries: [
      ['ICS2K241201', 'Ahmed Shammas. K'],
      ['ICS2K241202', 'Muhammed Fathah. EK'],
      ['ICS2K241203', 'Muhammed Shammas. M'],
      ['ICS2K241204', 'Muhammed Sahl. P'],
      ['ICS2K241205', 'Faris Aboobacker. KK'],
      ['ICS2K241206', 'Muhammed Anshif Ali. P'],
      ['ICS2K241207', 'Muhammed Rashad. K'],
      ['ICS2K241208', 'Muhammed Nabhan. P'],
      ['ICS2K241209', 'Muhammed Nihal. PK'],
      ['ICS2K241210', 'Muhammed Shahid. AP'],
      ['ICS2K241211', 'Muhammed Rajl. K'],
      ['ICS2K241212', 'Ruwais Ahmed. MP'],
      ['ICS2K241213', 'Muhammed Saeed. V'],
      ['ICS2K241214', 'Shamnad. C'],
      ['ICS2K241215', 'Ahmed Yasir. PV'],
      ['ICS2K241216', 'Muhammed Sinan. KP'],
      ['ICS2K241217', 'Muhammed Dilshad. NP'],
      ['ICS2K241218', 'Muhammed Abdul Vajid. K'],
      ['ICS2K241219', 'Jan Fishan. KP'],
      ['ICS2K241220', 'Muhammed Swalih. EK'],
      ['ICS2K241221', 'Muhammed Razi. TK'],
      ['ICS2K241222', 'Fadi Hassan. KM'],
      ['ICS2K241223', 'Muhammed Faheem. M'],
      ['ICS2K241224', 'Muhammed Ashmil. MP'],
      ['ICS2K241225', 'Sayyid Jazeel. P'],
      ['ICS2K241226', 'Muhammed Nashmil. PK'],
      ['ICS2K241227', 'Muhammed Saleeth. K'],
      ['ICS2K241228', 'Hamid Saeed. P'],
    ],
  },
  {
    className: 'HS 1',
    batch: 'Batch 11',
    entries: [
      ['ICS2K231101', 'Ahmed Ziyad. K'],
      ['ICS2K231102', 'Ismaeel Faheem. MP'],
      ['ICS2K231103', 'Muhammed Aslam. NM'],
      ['ICS2K231104', 'Muhammed Farhan. V'],
      ['ICS2K231105', 'Muhammed Saeed. P'],
      ['ICS2K231106', 'Muhammed Sinan. P'],
      ['ICS2K231107', 'Muhammed Hibathullah. P'],
      ['ICS2K231108', 'Muhammed Shammas. P'],
      ['ICS2K231109', 'Sayyid Muhammed Mihdhar. KP'],
      ['ICS2K231110', 'Muhammed Shibil. P'],
      ['ICS2K231111', 'Muhammed Althaf. P'],
      ['ICS2K231112', 'Afnan Faris. M'],
      ['ICS2K231113', 'Muhammed Mubeen. T'],
      ['ICS2K231114', 'Muhammed Shamil. KK'],
      ['ICS2K231115', 'Muhammed Afham. P'],
      ['ICS2K231116', 'Muhammed Ihsan. TK'],
      ['ICS2K231117', 'Muhammed Minhaj. KM'],
      ['ICS2K231118', 'Muhammed Swabeeh. T'],
      ['ICS2K231119', 'Muhammed Bishal. P'],
      ['ICS2K231120', 'Muhammed Hashir'],
    ],
  },
  {
    className: 'HS 2A',
    batch: 'Batch 10',
    entries: [
      ['ICS2K221001', 'Mihraz. VP'],
      ['ICS2K221002', 'Muhammed Sinan. P'],
      ['ICS2K221003', 'Muhammed Jawad. KT'],
      ['ICS2K221004', 'Ahmed Haseeb. K'],
      ['ICS2K221005', 'Muhammed Mashir. T'],
      ['ICS2K221006', 'Minhaj. AK'],
      ['ICS2K221007', 'Muhammed Sinan. K'],
      ['ICS2K221008', 'Ziyad. K'],
      ['ICS2K221009', 'Muhammed Shafi. V'],
      ['ICS2K221010', 'Ali Haider. TM'],
      ['ICS2K221011', 'Muhammed Shamil. P'],
      ['ICS2K221012', 'Muhammed Sajeed. C'],
      ['ICS2K221013', 'Muhammed Mubeen. V'],
      ['ICS2K221014', 'Muhammed Hafnas. M'],
      ['ICS2K221015', 'Muhammed Asim Aboobacker. NM'],
      ['ICS2K221016', 'Muhammed Midlaj. P'],
      ['ICS2K221017', 'Midlaj. AK'],
      ['ICS2K221018', 'Muhammed Jawad. CP'],
      ['ICS2K221019', 'Muhammed Sinan. K'],
      ['ICS2K221020', 'Muhammed Farhan. PC'],
      ['ICS2K221021', 'Arshad KK'],
      ['ICS2K221022', 'Muhammed Swalih'],
    ],
  },
  {
    className: 'HS 2B',
    batch: 'Batch 10',
    entries: [
      ['ICS2K251001', 'Sahd. PK'],
      ['ICS2K251002', 'Shibil Yashid. K'],
      ['ICS2K251003', "Muhammed Sa'ad"],
      ['ICS2K251004', 'Jaseem. P'],
      ['ICS2K251005', 'Ahmed Arif Fawaz'],
    ],
  },
  {
    className: 'BS 1',
    batch: 'Batch 09',
    entries: [
      ['ICS2K210901', 'Muhammed Rabeeh. C'],
      ['ICS2K210902', "Muhammed Sa'ad. KM"],
      ['ICS2K210903', 'Saeed Ahmed. KM'],
      ['ICS2K240904', 'Muhammed Rafeeh. KA'],
      ['ICS2K210905', 'Muhammed Mulaffar. NM'],
      ['ICS2K210906', 'Muhammed Shamil. AP'],
      ['ICS2K210907', 'Muhammed Shiyas. TM'],
      ['ICS2K210908', 'Muhammed Sahl. E'],
      ['ICS2K210909', 'Muhammed Musthafa. T'],
      ['ICS2K210910', 'Nooh. P'],
      ['ICS2K210911', 'Muhammed Shammas. P'],
      ['ICS2K210912', 'Muhammed Muhsin. V'],
      ['ICS2K210913', 'Mueenudheen. PK'],
      ['ICS2K210914', 'Muhammed Faiz. P'],
      ['ICS2K210915', 'Muhammed Sinan. K'],
      ['ICS2K210916', 'Fazlul Haq. K'],
      ['ICS2K240917', 'Muhammed Haseeb. A'],
      ['ICS2K210918', 'Muhammed Faiz. K'],
      ['ICS2K210919', 'Bishrul Hafi. PP'],
      ['ICS2K240920', 'Muhammed Jazeel. T'],
      ['ICS2K250921', 'Muhammed Ashiq. A'],
      ['ICS2K250922', 'Ahmed Yaseen'],
    ],
  },
  {
    className: 'BS 2',
    batch: 'Batch 08',
    entries: [
      ['ICS2K200801', 'Muhammed Hibathullah. K'],
      ['ICS2K230802', 'Muhammed Muzammil. MK'],
      ['ICS2K200803', 'Muhammed Shabeeb. P'],
      ['ICS2K200804', 'Jabir Hussain. M'],
      ['ICS2K200805', 'Muhammed Uvais. AK'],
      ['ICS2K200806', 'Muhammed Mubashir. V'],
      ['ICS2K230807', 'Sayyid Fazlu Rahman. VP'],
    ],
  },
  {
    className: 'BS 3',
    batch: 'Batch 07',
    entries: [
      ['ICS2K190701', 'Muhammed Junaid. P'],
      ['ICS2K190702', 'Muhammed Saeed. M'],
      ['ICS2K190703', 'Muhammed Ajmal. PK'],
      ['ICS2K190704', 'Muhammed Hisan. K'],
      ['ICS2K190705', 'Muhammed Juraij. BP'],
      ['ICS2K190706', 'Muhammed Shahid. M'],
    ],
  },
  {
    className: 'BS 4',
    batch: 'Batch 06',
    entries: [
      ['ICS2K220601', 'Muhammed Sinan. NT'],
      ['ICS2K180602', 'Abdul Bais. V'],
      ['ICS2K180603', 'Muhammed Jawad. TP'],
      ['ICS2K180604', 'Muhammed Faiz. M'],
      ['ICS2K180605', 'Muhammed Saadullah. K'],
      ['ICS2K180606', 'Muhammed Midhlaj. V'],
      ['ICS2K180607', 'Muhammed Bishr. MK'],
      ['ICS2K180608', 'Muhammed Dilshad. K'],
      ['ICS2K180609', 'Muhammed Rafi. V'],
      ['ICS2K180610', 'Muhammed Shafaf. T'],
      ['ICS2K180611', 'Muhammed Rizwan. K'],
      ['ICS2K180612', 'Muhammed Nizam. TA'],
      ['ICS2K180613', 'Shahid Ahmed. P'],
      ['ICS2K180614', 'Muhammed Salman. TM'],
      ['ICS2K180615', 'Muhammed Sabith. PK'],
    ],
  },
  {
    className: 'BS 5',
    batch: 'Batch 05',
    entries: [
      ['ICS2K170501', 'Ahmed Swalih. N'],
      ['ICS2K170502', 'Muhammed Jalaludheen. MP'],
      ['ICS2K170503', 'Muhammed Jouhar Saheel. TK'],
      ['ICS2K170504', 'Muhammed Muslih. MV'],
      ['ICS2K170505', 'Muhammed Shabeer. MPT'],
    ],
  },
]

export const ALL_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export const ALL_MONTH_SHORT_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

export type MonthMeta = {
  id: string
  month: string
  shortMonth: string
  year: number
  calendarDays: number
  officialHolidayDays: number
  officialHolidayNote: string
  baseDays: number
}

export function getDaysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate()
}

export function toMonthId(year: number, monthNumber: number): string {
  const safeMonth = Math.max(1, Math.min(12, Math.floor(monthNumber)))
  return `${year}-${String(safeMonth).padStart(2, '0')}`
}

export function parseMonthId(monthId: string): { year: number; monthNumber: number } {
  const match = /^(\d{4})-(\d{1,2})$/.exec((monthId || '').trim())
  if (match) {
    const year = Number(match[1])
    const monthNumber = Math.max(1, Math.min(12, Number(match[2])))
    if (Number.isFinite(year) && year >= 2000 && year <= 2100) {
      return { year, monthNumber }
    }
  }
  const now = new Date()
  return { year: now.getFullYear(), monthNumber: now.getMonth() + 1 }
}

export function getAvailableYears(extraYears: number[] = []): number[] {
  const currentYear = new Date().getFullYear()
  const startYear = 2025
  const endYear = Math.max(2031, currentYear + 5)
  const set = new Set<number>()
  for (let y = startYear; y <= endYear; y++) {
    set.add(y)
  }
  for (const extra of extraYears) {
    if (Number.isFinite(extra) && extra >= 2020 && extra <= 2100) {
      set.add(Math.floor(extra))
    }
  }
  return Array.from(set).sort((a, b) => a - b)
}

export function buildMonthMetaForId(monthId: string): MonthMeta {
  const { year, monthNumber } = parseMonthId(monthId)
  const idx = monthNumber - 1
  return {
    id: toMonthId(year, monthNumber),
    month: ALL_MONTH_NAMES[idx],
    shortMonth: ALL_MONTH_SHORT_NAMES[idx],
    year,
    calendarDays: getDaysInMonth(year, idx),
    officialHolidayDays: 0,
    officialHolidayNote: 'No official holidays announced yet',
    baseDays: 0,
  }
}

export function getYearMonthsMeta(year: number): MonthMeta[] {
  return Array.from({ length: 12 }, (_, idx) => buildMonthMetaForId(toMonthId(year, idx + 1)))
}

export const MONTHS_META: MonthMeta[] = [
  {
    id: '2026-06',
    month: 'June',
    shortMonth: 'Jun',
    year: 2026,
    calendarDays: 30,
    officialHolidayDays: 0,
    officialHolidayNote: 'No official holidays announced yet',
    baseDays: 0,
  },
  {
    id: '2026-07',
    month: 'July',
    shortMonth: 'Jul',
    year: 2026,
    calendarDays: 31,
    officialHolidayDays: 0,
    officialHolidayNote: 'No official holidays announced yet',
    baseDays: 0,
  },
  {
    id: '2026-08',
    month: 'August',
    shortMonth: 'Aug',
    year: 2026,
    calendarDays: 31,
    officialHolidayDays: 0,
    officialHolidayNote: 'No official holidays announced yet',
    baseDays: 0,
  },
  {
    id: '2026-09',
    month: 'September',
    shortMonth: 'Sep',
    year: 2026,
    calendarDays: 30,
    officialHolidayDays: 0,
    officialHolidayNote: 'No official holidays announced yet',
    baseDays: 0,
  },
  {
    id: '2026-10',
    month: 'October',
    shortMonth: 'Oct',
    year: 2026,
    calendarDays: 31,
    officialHolidayDays: 0,
    officialHolidayNote: 'No official holidays announced yet',
    baseDays: 0,
  },
  {
    id: '2026-11',
    month: 'November',
    shortMonth: 'Nov',
    year: 2026,
    calendarDays: 30,
    officialHolidayDays: 0,
    officialHolidayNote: 'No official holidays announced yet',
    baseDays: 0,
  },
  {
    id: '2026-12',
    month: 'December',
    shortMonth: 'Dec',
    year: 2026,
    calendarDays: 31,
    officialHolidayDays: 0,
    officialHolidayNote: 'No official holidays announced yet',
    baseDays: 0,
  },
  {
    id: '2027-01',
    month: 'January',
    shortMonth: 'Jan',
    year: 2027,
    calendarDays: 31,
    officialHolidayDays: 0,
    officialHolidayNote: 'No official holidays announced yet',
    baseDays: 0,
  },
  {
    id: '2027-02',
    month: 'February',
    shortMonth: 'Feb',
    year: 2027,
    calendarDays: 28,
    officialHolidayDays: 0,
    officialHolidayNote: 'No official holidays announced yet',
    baseDays: 0,
  },
  {
    id: '2027-03',
    month: 'March',
    shortMonth: 'Mar',
    year: 2027,
    calendarDays: 31,
    officialHolidayDays: 0,
    officialHolidayNote: 'No official holidays announced yet',
    baseDays: 0,
  },
  {
    id: '2027-04',
    month: 'April',
    shortMonth: 'Apr',
    year: 2027,
    calendarDays: 30,
    officialHolidayDays: 0,
    officialHolidayNote: 'No official holidays announced yet',
    baseDays: 0,
  },
  {
    id: '2027-05',
    month: 'May',
    shortMonth: 'May',
    year: 2027,
    calendarDays: 31,
    officialHolidayDays: 0,
    officialHolidayNote: 'No official holidays announced yet',
    baseDays: 0,
  },
]

function buildStudentMonthlyAttendance(_seedIndex: number): {
  monthlyAttendance: MonthlyAttendance[]
  attendance: { present: number; absent: number; leave: number }
} {
  const monthlyAttendance: MonthlyAttendance[] = MONTHS_META.map((m) => ({
    id: m.id,
    month: m.month,
    shortMonth: m.shortMonth,
    year: m.year,
    calendarDays: m.calendarDays,
    openDays: m.calendarDays,
    closedDays: 0,
    officialHolidayDays: 0,
    officialHolidayNote: m.officialHolidayNote,
    workingDays: 0,
    present: 0,
    absent: 0,
    leave: 0,
  }))

  return {
    monthlyAttendance,
    attendance: {
      present: 0,
      absent: 0,
      leave: 0,
    },
  }
}

export const students: Student[] = (() => {
  const list: Student[] = []
  let counter = 1
  for (const group of RAW_CLASS_ROSTERS) {
    for (const [admissionNo, name] of group.entries) {
      const { monthlyAttendance, attendance } = buildStudentMonthlyAttendance(counter)
      list.push({
        id: `std-${counter}`,
        name,
        firstName: name,
        className: group.className,
        batch: group.batch,
        admissionNo,
        avatarUrl: STUDENT_AVATAR_BY_ADMISSION_NO[admissionNo],
        attendance,
        monthlyAttendance,
      })
      counter++
    }
  }
  return list
})()

export function normalizeAdmissionKey(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

export function findStudentByAdmissionNo(identifier: string): Student | undefined {
  const rawCleaned = normalizeAdmissionKey(identifier)
  if (!rawCleaned) return undefined

  // Support legacy HS 2B "01" batch code in IDs (e.g. ICS2K250101 -> ICS2K251001)
  const cleaned = rawCleaned
    .replace(/2K2501(\d{2})$/, '2K2510$1')
    .replace(/^2501(\d{2})$/, '2510$1')

  // 1. Exact alphanumeric match without dots (e.g., "ICS2K261401")
  const exactMatch = students.find((s) => normalizeAdmissionKey(s.admissionNo) === cleaned)
  if (exactMatch) return exactMatch

  // 2. Match without "ICS" prefix (e.g., "2K261401")
  const withoutIcs = students.find(
    (s) => normalizeAdmissionKey(s.admissionNo).replace(/^ICS/, '') === cleaned,
  )
  if (withoutIcs) return withoutIcs

  // 3. Match digits only (e.g., "2261401" or "261401")
  const digitsOnlyMatch = students.find((s) => {
    const allDigits = s.admissionNo.replace(/[^0-9]/g, '') // e.g. "2261401"
    const yearBatchRollDigits = allDigits.replace(/^2/, '') // e.g. "261401"
    return cleaned === allDigits || cleaned === yearBatchRollDigits
  })
  return digitsOnlyMatch
}

export type OfficialHolidayMeta = {
  isOfficialHoliday: boolean
  holidayType:
    | 'monthly-second-saturday'
    | 'festival-celebration'
    | 'festival-holiday'
    | 'custom-holiday'
  monthId: string // e.g. '2026-11'
  departureDate: string // e.g. 'Friday, 13 Nov 2026'
  departureTime: string // e.g. '09:30 AM (Morning)' or '12:45 PM (After Jumu’ah)'
  returnDate: string // e.g. 'Monday, 16 Nov 2026'
  returnTime: string // e.g. '07:30 AM (Before Period 1)'
  holidayDaysDeducted: number
  announcedBy: string // e.g. 'Principal • ICS Academy' or Usthad name
  /** Optional list of target className strings (e.g. ['BS 3 • Batch 07']). Empty or ['ALL'] means all 11 batches. */
  targetClasses?: string[]
}

export type Notice = {
  id: string
  date: string
  category: 'Exam' | 'Event' | 'Hostel' | 'Academic'
  pinned?: boolean
  title: string
  body: string
  holidayMeta?: OfficialHolidayMeta
  /** Optional list of target className strings. Empty/undefined or ['ALL'] means all 11 batches. */
  targetClasses?: string[]
}

export const ALL_ACADEMY_CLASS_NAMES: string[] = [
  '8th',
  '9th',
  '10th',
  'HS 1',
  'HS 2A',
  'HS 2B',
  'BS 1',
  'BS 2',
  'BS 3',
  'BS 4',
  'BS 5',
]

export const HIGH_SCHOOL_CLASS_NAMES: string[] = [
  '8th',
  '9th',
  '10th',
  'HS 1',
  'HS 2A',
  'HS 2B',
]

export const BS_DEGREE_CLASS_NAMES: string[] = [
  'BS 1',
  'BS 2',
  'BS 3',
  'BS 4',
  'BS 5',
]

export function getNoticeTargetClasses(notice: Notice): string[] {
  const raw = notice.targetClasses ?? notice.holidayMeta?.targetClasses
  if (!raw || !Array.isArray(raw) || raw.length === 0 || raw.includes('ALL')) {
    return []
  }
  return raw.map((c) => normalizeClassName(c))
}

export function isNoticeVisibleForClass(notice: Notice, studentClass?: string): boolean {
  if (!studentClass || studentClass === 'ALL') return true
  const targets = getNoticeTargetClasses(notice)
  if (targets.length === 0) return true
  return targets.includes(normalizeClassName(studentClass))
}

export function formatTargetClassesBadge(targetClasses?: string[]): string {
  const normalized = (targetClasses ?? []).map((c) => normalizeClassName(c)).filter(Boolean)
  if (
    normalized.length === 0 ||
    normalized.includes('ALL') ||
    normalized.length >= ALL_ACADEMY_CLASS_NAMES.length
  ) {
    return 'All 11 Classes'
  }
  if (normalized.length === 1) {
    return `Class ${normalized[0]} Only`
  }
  const isExactHighSchool =
    normalized.length === HIGH_SCHOOL_CLASS_NAMES.length &&
    HIGH_SCHOOL_CLASS_NAMES.every((c) => normalized.includes(c))
  if (isExactHighSchool) {
    return 'High School Classes (8th–HS 2)'
  }
  const isExactBsDegree =
    normalized.length === BS_DEGREE_CLASS_NAMES.length &&
    BS_DEGREE_CLASS_NAMES.every((c) => normalized.includes(c))
  if (isExactBsDegree) {
    return 'BS Degree Classes (BS 1–BS 5)'
  }
  return `${normalized.length} Classes (${normalized.join(', ')})`
}

export const notices: Notice[] = []

export const ABSENT_REASONS: string[] = [
  'Sick / Rest in Hostel',
  'Uninformed Absence',
  'Late to Class',
  'Special Duty / Office Call',
]

export const ATTENDANCE_LEAVE_REASONS: string[] = [
  'Medical / Hospital Visit',
  'Home Visit / Family Need',
  'Academic Program / Exam',
  'Official Outpass / Emergency',
]

export const leaveReasons: string[] = [
  'Medical / Hospital Visit',
  'Home Visit / Family Need',
  'Academic Program / Exam',
  'Official Outpass / Emergency',
]

export {
  libraryBooks,
  libraryKitabs,
  libraryGeneralBooks,
  KITAB_CATEGORIES,
  BOOK_CATEGORIES,
  KITABS_COUNT,
  BOOKS_COUNT,
  type LibraryBook,
  type LibraryItemType,
} from '@/components/dashboard/library-catalog-data'

export type PeriodTiming = {
  label: string
  time: string
}

export const periods: PeriodTiming[] = [
  { label: 'Period 1', time: '07:00 – 08:00' },
  { label: 'Period 2', time: '08:30 – 09:30' },
  { label: 'Period 3', time: '09:45 – 10:45' },
  { label: 'Period 4', time: '11:00 – 12:00' },
  { label: 'Period 5', time: '14:00 – 15:15' },
]

export type TimetableSlot = {
  subject: string
  teacher: string
}

export type ClassSemesterTimetable = {
  periods: PeriodTiming[]
  semester1: TimetableSlot[]
  semester2: TimetableSlot[]
}

/** Active semester configured by the Principal (1 or 2) */
export let CURRENT_SEMESTER: 1 | 2 = 2

export function getActiveSemester(): 1 | 2 {
  return CURRENT_SEMESTER
}

const CLASS_SEMESTER_SCHEDULES: Record<string, ClassSemesterTimetable> = {
  '8th': {
    periods: [
      { label: 'Period 1', time: '07:15 – 08:05' },
      { label: 'Period 2', time: '08:30 – 09:20' },
      { label: 'Period 3', time: '09:30 – 10:20' },
      { label: 'Period 4', time: '10:35 – 11:25' },
      { label: 'Period 5', time: '14:00 – 15:00' },
    ],
    semester1: [
      { subject: 'Mizan & Sarf Foundation', teacher: 'Usthad Asif Saqafi' },
      { subject: 'Fiqh (Mabadi al-Fiqh)', teacher: 'Usthad Alavudheen Ahsani' },
      { subject: 'Arabic Muhadathah', teacher: 'Usthad Razaq Saqafi' },
      { subject: 'English Foundation', teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'Mathematics & Science', teacher: 'Usthad Hashim Saqafi' },
    ],
    semester2: [
      { subject: 'Ajnas & Sarf Practice', teacher: 'Usthad Asif Saqafi' },
      { subject: 'Aqeedah (Aqeedat al-Awam)', teacher: 'Usthad Favaz Saqafi' },
      { subject: 'Basic Nahw (Al-Ajurrumiyyah)', teacher: 'Usthad Alavudheen Ahsani' },
      { subject: 'Seerah & Islamic History', teacher: 'Usthad Hashim Saqafi' },
      { subject: 'Social Studies & English', teacher: 'Usthad Midhlaj Ahsani' },
    ],
  },
  '9th': {
    periods: [
      { label: 'Period 1', time: '07:15 – 08:05' },
      { label: 'Period 2', time: '08:30 – 09:20' },
      { label: 'Period 3', time: '09:30 – 10:20' },
      { label: 'Period 4', time: '10:35 – 11:25' },
      { label: 'Period 5', time: '14:00 – 15:00' },
    ],
    semester1: [
      { subject: 'Zanjani (Ilm al-Sarf)', teacher: 'Usthad Alavudheen Ahsani' },
      { subject: 'Nahw Mir & Tarkib', teacher: 'Usthad Razaq Saqafi' },
      { subject: 'Fiqh (Safinat al-Najah)', teacher: 'Usthad Asif Saqafi' },
      { subject: 'Hadith (Arba’in al-Nawawiyyah)', teacher: 'Usthad Hashim Saqafi' },
      { subject: 'High School English & IT', teacher: 'Usthad Midhlaj Ahsani' },
    ],
    semester2: [
      { subject: 'Mi’at Amil (Nahw)', teacher: 'Usthad Alavudheen Ahsani' },
      { subject: 'Fiqh (Abi Shuja’)', teacher: 'Usthad Asif Saqafi' },
      { subject: 'Tasawwuf (Bidayat al-Hidayah)', teacher: 'Usthad Favaz Saqafi' },
      { subject: 'Arabic & Urdu Literature', teacher: 'Usthad Razaq Saqafi' },
      { subject: 'High School Social Science', teacher: 'Usthad Hashim Saqafi' },
    ],
  },
  '10th': {
    periods: [
      { label: 'Period 1', time: '07:00 – 08:00' },
      { label: 'Period 2', time: '08:30 – 09:25' },
      { label: 'Period 3', time: '09:35 – 10:30' },
      { label: 'Period 4', time: '10:45 – 11:45' },
      { label: 'Period 5', time: '14:00 – 15:10' },
    ],
    semester1: [
      { subject: 'Qatr al-Nada (Nahw)', teacher: 'Usthad Razaq Saqafi' },
      { subject: 'Fiqh (Umdat al-Salik)', teacher: 'Usthad Hashim Saqafi' },
      { subject: 'Hadith (Riyad as-Salihin)', teacher: 'Usthad Alavudheen Ahsani' },
      { subject: 'SSLC Core Subjects', teacher: 'Usthad Asif Saqafi' },
      { subject: 'SSLC English & Lang.', teacher: 'Usthad Midhlaj Ahsani' },
    ],
    semester2: [
      { subject: 'Sharh al-Jami / Nahw', teacher: 'Usthad Razaq Saqafi' },
      { subject: 'Usul al-Fiqh (Al-Waraqat)', teacher: 'Usthad Favaz Saqafi' },
      { subject: 'Tafsir Selected Surahs', teacher: 'Usthad Muhammed Musthafa Saqafi' },
      { subject: 'SSLC Exam Intensive', teacher: 'Usthad Asif Saqafi' },
      { subject: 'SSLC Social Science', teacher: 'Usthad Alavudheen Ahsani' },
    ],
  },
  'HS 1': {
    periods: [
      { label: 'Period 1', time: '07:00 – 08:00' },
      { label: 'Period 2', time: '08:30 – 09:30' },
      { label: 'Period 3', time: '09:45 – 10:45' },
      { label: 'Period 4', time: '11:00 – 12:00' },
      { label: 'Period 5', time: '14:00 – 15:15' },
    ],
    semester1: [
      { subject: 'Fath al-Mu’in (Ibadat)', teacher: 'Usthad Hashim Saqafi' },
      { subject: 'Alfiyyah Ibn Malik (Part 1)', teacher: 'Usthad Favaz Saqafi' },
      { subject: 'Hadith (Bulugh al-Maram)', teacher: 'Usthad Razaq Saqafi' },
      { subject: 'Plus One Humanities / Hist.', teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'Plus One English & Da’wa', teacher: 'Usthad Alavudheen Ahsani' },
    ],
    semester2: [
      { subject: 'Fath al-Mu’in (Salah & Zakah)', teacher: 'Usthad Hashim Saqafi' },
      { subject: 'Alfiyyah Ibn Malik (Part 2)', teacher: 'Usthad Favaz Saqafi' },
      { subject: 'Mantiq (Mirqat / Sullam)', teacher: 'Usthad Muhammed Musthafa Saqafi' },
      { subject: 'Plus One Sociology & Pol.', teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'Arabic Rhetoric', teacher: 'Usthad Razaq Saqafi' },
    ],
  },
  'HS 2A': {
    periods: [
      { label: 'Period 1', time: '07:00 – 08:00' },
      { label: 'Period 2', time: '08:30 – 09:30' },
      { label: 'Period 3', time: '09:45 – 10:45' },
      { label: 'Period 4', time: '11:00 – 12:00' },
      { label: 'Period 5', time: '14:00 – 15:15' },
    ],
    semester1: [
      { subject: 'Fath al-Mu’in (Mu’amalat)', teacher: 'Usthad Favaz Saqafi' },
      { subject: 'Tafsir al-Jalalayn (Part 1)', teacher: 'Usthad Muhammed Musthafa Saqafi' },
      { subject: 'Alfiyyah Ibn Malik (Part 3)', teacher: 'Usthad Hashim Saqafi' },
      { subject: 'Plus Two History & Econ.', teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'Plus Two English & Research', teacher: 'Usthad Razaq Saqafi' },
    ],
    semester2: [
      { subject: 'Fath al-Mu’in (Munakahat)', teacher: 'Usthad Favaz Saqafi' },
      { subject: 'Tafsir al-Jalalayn (Part 2)', teacher: 'Usthad Muhammed Musthafa Saqafi' },
      { subject: 'Balaghah (Mukhtasar al-Ma’ani)', teacher: 'Usthad Hafiz Fazlul Abid Naeemi' },
      { subject: 'Plus Two Board Revision', teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'Da’wa & Elocution Lab', teacher: 'Usthad Hashim Saqafi' },
    ],
  },
  'HS 2B': {
    periods: [
      { label: 'Period 1', time: '07:00 – 08:00' },
      { label: 'Period 2', time: '08:30 – 09:30' },
      { label: 'Period 3', time: '09:45 – 10:45' },
      { label: 'Period 4', time: '11:00 – 12:00' },
      { label: 'Period 5', time: '14:00 – 15:15' },
    ],
    semester1: [
      { subject: 'Tafsir al-Jalalayn (Part 1)', teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'Fath al-Mu’in (Mu’amalat)', teacher: 'Usthad Favaz Saqafi' },
      { subject: 'Hadith (Riyad as-Salihin)', teacher: 'Usthad Muhammed Musthafa Saqafi' },
      { subject: 'Plus Two Commerce / Hist.', teacher: 'Usthad Hashim Saqafi' },
      { subject: 'Plus Two English', teacher: 'Usthad Alavudheen Ahsani' },
    ],
    semester2: [
      { subject: 'Tafsir al-Jalalayn (Part 2)', teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'Fath al-Mu’in (Munakahat)', teacher: 'Usthad Favaz Saqafi' },
      { subject: 'Usul al-Hadith (Nukhbat al-Fikar)', teacher: 'Usthad Muhammed Yasir Ahsani' },
      { subject: 'Plus Two Final Revision', teacher: 'Usthad Hashim Saqafi' },
      { subject: 'Arabic Composition', teacher: 'Usthad Razaq Saqafi' },
    ],
  },
  'BS 1': {
    periods: [
      { label: 'Period 1', time: '6:30 AM – 7:15 AM' },
      { label: 'Period 2', time: '7:15 AM – 8:00 AM' },
      { label: 'Period 3', time: '8:00 AM – 8:45 AM' },
      { label: 'Period 4', time: '9:15 AM – 10:00 AM' },
      { label: 'Period 5', time: '10:00 AM – 10:45 AM' },
      { label: 'Period 6', time: '11:00 AM – 11:45 AM' },
      { label: 'Period 7', time: '11:45 AM – 12:30 PM' },
    ],
    semester1: [
      { subject: 'Mishkathul Maswabeeh', teacher: 'Usthad Musthafa Saqafi' },
      { subject: "Insha'u", teacher: 'Usthad Yasir Ahsani' },
      { subject: 'Fathhul Mueen', teacher: 'Usthad Hafiz Fazl Naeemi' },
      { subject: 'Alfiya Ibn Malik', teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'No One', teacher: 'No One' },
      { subject: 'Jouharathu Thouheed', teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'Refreshment', teacher: 'Refreshment' },
    ],
    semester2: [
      { subject: 'Mishkathul Maswabeeh', teacher: 'Usthad Musthafa Saqafi' },
      { subject: "Insha'u", teacher: 'Usthad Yasir Ahsani' },
      { subject: 'Fathhul Mueen', teacher: 'Usthad Hafiz Fazl Naeemi' },
      { subject: 'Alfiya Ibn Malik', teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'No One', teacher: 'No One' },
      { subject: 'Jouharathu Thouheed', teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'Refreshment', teacher: 'Refreshment' },
    ],
  },
  'BS 2': {
    periods: [
      { label: 'Period 1', time: '6:30 AM – 7:15 AM' },
      { label: 'Period 2', time: '7:15 AM – 8:00 AM' },
      { label: 'Period 3', time: '8:00 AM – 8:45 AM' },
      { label: 'Period 4', time: '9:15 AM – 10:00 AM' },
      { label: 'Period 5', time: '10:00 AM – 10:45 AM' },
      { label: 'Period 6', time: '11:00 AM – 11:45 AM' },
      { label: 'Period 7', time: '11:45 AM – 12:30 PM' },
      { label: 'Period 8', time: '1:15 PM – 2:00 PM' },
    ],
    semester1: [
      { subject: "Jam'ul Javamiu", teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'Mishkathul Maswabeeh', teacher: 'Usthad Abdu Razaq Saqafi' },
      { subject: 'Fathhul Mueen', teacher: 'Usthad Yasir Ahsani' },
      { subject: 'Thafseerul Jalalain', teacher: 'Usthad Yasir Ahsani' },
      { subject: 'Mukhthasarul Maani', teacher: 'Usthad Musthafa Saqafi' },
      { subject: 'Alfiya Ibn Malik', teacher: 'Usthad Abdu Razaq Saqafi' },
      { subject: 'Thuhfathul Ikhvan', teacher: 'Usthad Abdul Haseeb Saqafi' },
      { subject: 'Sharahu Thahdeeb', teacher: 'Usthad Hafiz Fazl Naeemi' },
    ],
    semester2: [
      { subject: "Jam'ul Javamiu", teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'Mishkathul Maswabeeh', teacher: 'Usthad Abdu Razaq Saqafi' },
      { subject: 'Fathhul Mueen', teacher: 'Usthad Yasir Ahsani' },
      { subject: 'Thafseerul Jalalain', teacher: 'Usthad Yasir Ahsani' },
      { subject: 'Mukhthasarul Maani', teacher: 'Usthad Musthafa Saqafi' },
      { subject: 'Alfiya Ibn Malik', teacher: 'Usthad Abdu Razaq Saqafi' },
      { subject: 'Thuhfathul Ikhvan', teacher: 'Usthad Abdul Haseeb Saqafi' },
      { subject: 'Sharahu Thahdeeb', teacher: 'Usthad Hafiz Fazl Naeemi' },
    ],
  },
  'BS 3': {
    periods: [
      { label: 'Period 1', time: '6:30 AM – 7:15 AM' },
      { label: 'Period 2', time: '7:15 AM – 8:00 AM' },
      { label: 'Period 3', time: '8:00 AM – 8:45 AM' },
      { label: 'Period 4', time: '9:15 AM – 10:00 AM' },
      { label: 'Period 5', time: '10:00 AM – 10:45 AM' },
      { label: 'Period 6', time: '11:00 AM – 11:45 AM' },
      { label: 'Period 7', time: '11:45 AM – 12:30 PM' },
      { label: 'Period 8', time: '1:15 PM – 2:00 PM' },
    ],
    semester1: [
      { subject: "Jam'ul Javamiu", teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'Mishkathul Maswabeeh', teacher: 'Usthad Abdu Razaq Saqafi' },
      { subject: 'Al Mahalli', teacher: 'Usthad Musthafa Saqafi' },
      { subject: 'Thafseerul Jalalain', teacher: 'Usthad Hafiz Fazl Naeemi' },
      { subject: 'Mukhthasarul Maani', teacher: 'Usthad Musthafa Saqafi' },
      { subject: 'Fathhul Mueen', teacher: 'Usthad Yasir Ahsani' },
      { subject: 'Thuhfathul Ikhvan', teacher: 'Usthad Abdul Haseeb Saqafi' },
      { subject: 'Refreshment', teacher: 'Refreshment' },
    ],
    semester2: [
      { subject: "Jam'ul Javamiu", teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'Mishkathul Maswabeeh', teacher: 'Usthad Abdu Razaq Saqafi' },
      { subject: 'Al Mahalli', teacher: 'Usthad Musthafa Saqafi' },
      { subject: 'Thafseerul Jalalain', teacher: 'Usthad Hafiz Fazl Naeemi' },
      { subject: 'Mukhthasarul Maani', teacher: 'Usthad Musthafa Saqafi' },
      { subject: 'Fathhul Mueen', teacher: 'Usthad Yasir Ahsani' },
      { subject: 'Thuhfathul Ikhvan', teacher: 'Usthad Abdul Haseeb Saqafi' },
      { subject: 'Refreshment', teacher: 'Refreshment' },
    ],
  },
  'BS 4': {
    periods: [
      { label: 'Period 1', time: '6:30 AM – 7:15 AM' },
      { label: 'Period 2', time: '7:15 AM – 8:00 AM' },
      { label: 'Period 3', time: '8:00 AM – 8:45 AM' },
      { label: 'Period 4', time: '9:15 AM – 10:00 AM' },
      { label: 'Period 5', time: '10:00 AM – 10:45 AM' },
      { label: 'Period 6', time: '11:00 AM – 11:45 AM' },
      { label: 'Period 7', time: '11:45 AM – 12:30 PM' },
      { label: 'Period 8', time: '3:15 PM – 4:00 PM' },
    ],
    semester1: [
      { subject: 'Al Bahs', teacher: 'Usthad Abdul Haseeb Saqafi' },
      { subject: 'Mishkathul Maswabeeh', teacher: 'Usthad Musthafa Saqafi' },
      { subject: 'Al Mahalli', teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'Thafseerul Jalalain', teacher: 'Usthad Hafiz Fazl Naeemi' },
      { subject: 'Al Khilafathul Amaviyyah', teacher: 'Usthad Abdu Razaq Saqafi' },
      { subject: "Jam'ul Javamiu", teacher: 'Usthad Shaikhuna' },
      { subject: 'Refreshment', teacher: 'Refreshment' },
      { subject: 'Minhajusswageer', teacher: 'Usthad Yasir Ahsani' },
    ],
    semester2: [
      { subject: 'Al Bahs', teacher: 'Usthad Abdul Haseeb Saqafi' },
      { subject: 'Mishkathul Maswabeeh', teacher: 'Usthad Musthafa Saqafi' },
      { subject: 'Al Mahalli', teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'Thafseerul Jalalain', teacher: 'Usthad Hafiz Fazl Naeemi' },
      { subject: 'Al Khilafathul Amaviyyah', teacher: 'Usthad Abdu Razaq Saqafi' },
      { subject: "Jam'ul Javamiu", teacher: 'Usthad Shaikhuna' },
      { subject: 'Refreshment', teacher: 'Refreshment' },
      { subject: 'Minhajusswageer', teacher: 'Usthad Yasir Ahsani' },
    ],
  },
  'BS 5': {
    periods: [
      { label: 'Period 1', time: '6:30 AM – 7:15 AM' },
      { label: 'Period 2', time: '7:15 AM – 8:00 AM' },
      { label: 'Period 3', time: '8:00 AM – 8:45 AM' },
      { label: 'Period 4', time: '9:15 AM – 10:00 AM' },
      { label: 'Period 5', time: '10:00 AM – 10:45 AM' },
      { label: 'Period 6', time: '11:00 AM – 11:45 AM' },
      { label: 'Period 7', time: '11:45 AM – 12:30 PM' },
      { label: 'Period 8', time: '1:30 PM – 2:15 PM' },
      { label: 'Period 9', time: '2:30 PM – 3:15 PM' },
      { label: 'Period 10', time: '3:15 PM – 4:00 PM' },
    ],
    semester1: [
      { subject: 'Al Bukhari', teacher: 'Usthad Shaikhuna' },
      { subject: 'No One', teacher: 'No One' },
      { subject: "Jam'ul Javamiu", teacher: 'Usthad Abdu Razaq Saqafi' },
      { subject: 'Sharahul Aqaid', teacher: 'Usthad Shaikhuna' },
      { subject: 'Mulla Hasan', teacher: 'Usthad Hafiz Fazl Naeemi' },
      { subject: 'Refreshment', teacher: 'Refreshment' },
      { subject: 'Al Mahalli', teacher: 'Usthad Musthafa Saqafi' },
      { subject: 'Al Mahalli', teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'Thafseerul Baillavi', teacher: 'Usthad Shaikhuna' },
      { subject: "Jam'ul Javamiu", teacher: 'Usthad Musthafa Saqafi' },
    ],
    semester2: [
      { subject: 'Al Bukhari', teacher: 'Usthad Shaikhuna' },
      { subject: 'No One', teacher: 'No One' },
      { subject: "Jam'ul Javamiu", teacher: 'Usthad Abdu Razaq Saqafi' },
      { subject: 'Sharahul Aqaid', teacher: 'Usthad Shaikhuna' },
      { subject: 'Mulla Hasan', teacher: 'Usthad Hafiz Fazl Naeemi' },
      { subject: 'Refreshment', teacher: 'Refreshment' },
      { subject: 'Al Mahalli', teacher: 'Usthad Musthafa Saqafi' },
      { subject: 'Al Mahalli', teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'Thafseerul Baillavi', teacher: 'Usthad Shaikhuna' },
      { subject: "Jam'ul Javamiu", teacher: 'Usthad Musthafa Saqafi' },
    ],
  },
}

export function getClassSemesterTimetableByClassName(className: string): ClassSemesterTimetable {
  const key = normalizeClassName(className)
  return (
    CLASS_SEMESTER_SCHEDULES[key] ??
    CLASS_SEMESTER_SCHEDULES['BS 3']
  )
}

export function getClassSemesterTimetable(student: Student): ClassSemesterTimetable {
  return getClassSemesterTimetableByClassName(student.className)
}

export const EXAM_RESULTS_URL = 'https://jamiathulhind.com/index.php'

export type SupremeScholarProfile = {
  id: string
  name: string
  malayalamName: string
  honorificTitle: string
  designation: string
  valiyaBatches: string[]
  specialization: string
  description: string
  isClassUsthad: false
  hasLoginId: false
}

/**
 * Supreme Scholar & Patron above all Usthads at ICS Academy Manhappatta:
 * SHAIKHUNA HAMZA USTHAD (Shaikhuna Manhappatta Hamza Usthad)
 * - Never a Class Usthad and does NOT require a Login ID.
 * - Teaches classes in the two senior ("VALIYA") batches: BS 5 • Batch 05 & BS 4 • Batch 06 (appears in Timetables).
 */
export const SHAIKHUNA_HAMZA_USTHAD: SupremeScholarProfile = {
  id: 'shaikhuna-hamza-usthad',
  name: 'Shaikhuna Manhappatta Hamza Usthad',
  malayalamName: 'Shaikhuna Manhappatta Hamza Usthad',
  honorificTitle: 'SHAIKHUNA HAMZA USTHAD',
  designation: 'Supreme Scholar & Chief Mudarris',
  valiyaBatches: ['BS 5', 'BS 4'],
  specialization: 'Sahih al-Bukhari, Tuhfat al-Muhtaj & Senior Valiya Dars',
  description:
    'Supreme Scholar and Chief Mudarris above all Usthads. Teaches senior classes in the two senior classes (BS 5 & BS 4).',
  isClassUsthad: false,
  hasLoginId: false,
}

export type InstitutionManagerProfile = {
  id: string
  name: string
  designation: string
  roleSummary: string
  isClassUsthad: false
  takesClasses: false
  hasLoginId: false
}

/**
 * Institution Manager at ICS Academy Manhappatta:
 * Usthad Muhammed Naeem Saqafi (Manager)
 * - Runs and manages the institution.
 * - Never a Class Usthad, does NOT take classes in any batch, and does NOT require a Login ID.
 */
export const ACADEMY_MANAGER: InstitutionManagerProfile = {
  id: 'manager-naeem-saqafi',
  name: 'Usthad Muhammed Naeem Saqafi',
  designation: 'Manager • ICS Academy & Da’wa College Manhappatta',
  roleSummary:
    'Institution Manager overseeing administration and operations at ICS Academy & Da’wa College Manhappatta.',
  isClassUsthad: false,
  takesClasses: false,
  hasLoginId: false,
}

export type ClassUsthad = {
  id: string
  staffId: string
  name: string
  shortName: string
  avatarUrl?: string
  designation: string
  institutionalRole?: 'Principal' | 'Swadr' | 'Class Usthad'
  isPrincipalRole?: boolean
  teachingBatches?: string[]
  className: string
  fullClassLabel: string
  batch: string
  batchCode: string
  specialization: string
}

/**
 * The 10 Official Teaching & Class Usthads of ICS Academy Manhappatta
 * (Excludes SHAIKHUNA HAMZA USTHAD and Manager Usthad Muhammed Naeem Saqafi,
 * as neither of them are Class Usthads or have Login IDs).
 */
export const OFFICIAL_CLASS_USTHADS: ClassUsthad[] = [
  {
    id: 'usthad-07',
    staffId: 'UST-07',
    name: 'Usthad Muhammed Yasir Ahsani',
    shortName: 'Usthad Muhammed Yasir Ahsani',
    avatarUrl: '/images/yasir-usthad.jpg',
    designation: 'Principal & Class Usthad',
    institutionalRole: 'Principal',
    isPrincipalRole: true,
    teachingBatches: ['BS 3', 'BS 1'],
    className: 'BS 3',
    fullClassLabel: 'Class BS 3',
    batch: 'Batch 07',
    batchCode: '07',
    specialization: 'Principal • Shafi’i Jurisprudence & Jam’ al-Jawami’',
  },
  {
    id: 'usthad-05',
    staffId: 'UST-05',
    name: 'Usthad Hafiz Fazlul Abid Naeemi',
    shortName: 'Usthad Hafiz Fazlul Abid Naeemi',
    designation: 'Swadr & Class Usthad',
    institutionalRole: 'Swadr',
    teachingBatches: ['BS 5'],
    className: 'BS 5',
    fullClassLabel: 'Class BS 5',
    batch: 'Batch 05',
    batchCode: '05',
    specialization: 'Swadr • Qur’an Hifz, Tafsir & Usul al-Fiqh',
  },
  {
    id: 'usthad-06',
    staffId: 'UST-06',
    name: 'Usthad Razaq Saqafi',
    shortName: 'Usthad Razaq Saqafi',
    designation: 'Class Usthad',
    institutionalRole: 'Class Usthad',
    teachingBatches: ['BS 4', 'HS 2A', 'HS 2B'],
    className: 'BS 4',
    fullClassLabel: 'Class BS 4',
    batch: 'Batch 06',
    batchCode: '06',
    specialization: 'Qatr al-Nada, Tafsir & Arabic Literature',
  },
  {
    id: 'usthad-11',
    staffId: 'UST-11',
    name: 'Usthad Muhammed Musthafa Saqafi',
    shortName: 'Usthad Muhammed Musthafa Saqafi',
    designation: 'Class Usthad',
    institutionalRole: 'Class Usthad',
    teachingBatches: ['HS 1'],
    className: 'HS 1',
    fullClassLabel: 'Class HS 1',
    batch: 'Batch 11',
    batchCode: '11',
    specialization: 'Mahalli & Mishkat al-Masabih',
  },
  {
    id: 'usthad-12',
    staffId: 'UST-12',
    name: 'Usthad Favaz Saqafi',
    shortName: 'Usthad Favaz Saqafi',
    designation: 'Class Usthad',
    institutionalRole: 'Class Usthad',
    teachingBatches: ['10th'],
    className: '10th',
    fullClassLabel: 'Class 10th',
    batch: 'Batch 12',
    batchCode: '12',
    specialization: 'Alfiyyah Ibn Malik & Balaghah',
  },
  {
    id: 'usthad-13',
    staffId: 'UST-13',
    name: 'Usthad Midhlaj Ahsani',
    shortName: 'Usthad Midhlaj Ahsani',
    designation: 'Class Usthad',
    institutionalRole: 'Class Usthad',
    teachingBatches: ['9th'],
    className: '9th',
    fullClassLabel: 'Class 9th',
    batch: 'Batch 13',
    batchCode: '13',
    specialization: 'Tafsir al-Jalalayn & Islamic History',
  },
  {
    id: 'usthad-14',
    staffId: 'UST-14',
    name: 'Usthad Muhammed Hashim Saqafi',
    shortName: 'Usthad Muhammed Hashim Saqafi',
    designation: 'Class Usthad',
    institutionalRole: 'Class Usthad',
    teachingBatches: ['8th'],
    className: '8th',
    fullClassLabel: 'Class 8th',
    batch: 'Batch 14',
    batchCode: '14',
    specialization: 'Fiqh & Foundation Sarf',
  },
  {
    id: 'usthad-08',
    staffId: 'UST-08',
    name: 'Usthad Alavudheen Ahsani',
    shortName: 'Usthad Alavudheen Ahsani',
    designation: 'Class Usthad',
    institutionalRole: 'Class Usthad',
    teachingBatches: ['BS 2'],
    className: 'BS 2',
    fullClassLabel: 'Class BS 2',
    batch: 'Batch 08',
    batchCode: '08',
    specialization: 'Nahw & Classical Sarf',
  },
  {
    id: 'usthad-09',
    staffId: 'UST-09',
    name: 'Usthad Asif Saqafi',
    shortName: 'Usthad Asif Saqafi',
    designation: 'Teaching Usthad',
    institutionalRole: 'Class Usthad',
    teachingBatches: [],
    className: '10th',
    fullClassLabel: 'Teaching Usthad',
    batch: 'High School',
    batchCode: '09',
    specialization: 'Fath al-Mu’in & Hadith Studies',
  },
  {
    id: 'usthad-15',
    staffId: 'UST-15',
    name: 'Usthad Abdul Haseeb Saqafi',
    shortName: 'Usthad Abdul Haseeb Saqafi',
    designation: 'Teaching Usthad',
    institutionalRole: 'Class Usthad',
    teachingBatches: [],
    className: 'BS 4',
    fullClassLabel: 'Teaching Usthad',
    batch: 'BS Degree',
    batchCode: '15',
    specialization: 'Al Bahs & Thuhfathul Ikhvan',
  },
]

/**
 * Per-class Class Usthad mapping across the 11 classes (using ONLY the Official Class Usthads;
 * neither SHAIKHUNA HAMZA USTHAD nor Manager Usthad Muhammed Naeem Saqafi is ever a Class Usthad).
 */
export const CLASS_USTHADS: ClassUsthad[] = [
  OFFICIAL_CLASS_USTHADS[6], // 8th (Batch 14) — Usthad Muhammed Hashim Saqafi (UST-14) ONLY
  OFFICIAL_CLASS_USTHADS[5], // 9th (Batch 13) — Usthad Midhlaj Ahsani (UST-13)
  OFFICIAL_CLASS_USTHADS[4], // 10th (Batch 12) — Usthad Favaz Saqafi (UST-12)
  OFFICIAL_CLASS_USTHADS[3], // HS 1 (Batch 11) — Usthad Muhammed Musthafa Saqafi (UST-11)
  {
    id: 'usthad-06-hs2a',
    staffId: 'UST-06',
    name: 'Usthad Razaq Saqafi',
    shortName: 'Usthad Razaq Saqafi',
    designation: 'Class Usthad',
    institutionalRole: 'Class Usthad',
    teachingBatches: ['HS 2A', 'HS 2B', 'BS 4'],
    className: 'HS 2A',
    fullClassLabel: 'Class HS 2A',
    batch: 'Batch 10',
    batchCode: '10',
    specialization: 'Qatr al-Nada, Tafsir & Arabic Literature',
  },
  {
    id: 'usthad-06-hs2b',
    staffId: 'UST-06',
    name: 'Usthad Razaq Saqafi',
    shortName: 'Usthad Razaq Saqafi',
    designation: 'Class Usthad',
    institutionalRole: 'Class Usthad',
    teachingBatches: ['HS 2B', 'HS 2A', 'BS 4'],
    className: 'HS 2B',
    fullClassLabel: 'Class HS 2B',
    batch: 'Batch 10',
    batchCode: '10',
    specialization: 'Qatr al-Nada, Tafsir & Arabic Literature',
  },
  {
    id: 'usthad-07-bs1',
    staffId: 'UST-07',
    name: 'Usthad Muhammed Yasir Ahsani',
    shortName: 'Usthad Muhammed Yasir Ahsani',
    avatarUrl: '/images/yasir-usthad.jpg',
    designation: 'Principal & Class Usthad',
    institutionalRole: 'Principal',
    isPrincipalRole: true,
    teachingBatches: ['BS 3', 'BS 1'],
    className: 'BS 1',
    fullClassLabel: 'Class BS 1',
    batch: 'Batch 09',
    batchCode: '09',
    specialization: 'Principal • Shafi’i Jurisprudence & Jam’ al-Jawami’',
  }, // BS 1 (Batch 09) — Usthad Muhammed Yasir Ahsani (Principal & Class Usthad, UST-07)
  OFFICIAL_CLASS_USTHADS[7], // BS 2 (Batch 08) — Usthad Alavudheen Ahsani (UST-08)
  OFFICIAL_CLASS_USTHADS[0], // BS 3 (Batch 07) — Usthad Muhammed Yasir Ahsani (Principal & Class Usthad, UST-07)
  OFFICIAL_CLASS_USTHADS[2], // BS 4 (Batch 06) — Usthad Razaq Saqafi (UST-06)
  OFFICIAL_CLASS_USTHADS[1], // BS 5 (Batch 05) — Usthad Hafiz Fazlul Abid Naeemi (Swadr, UST-05)
]

export type UsthadScheduledPeriodSlot = {
  className: string
  periodIndex: number
  periodLabel: string
  time: string
  subject: string
  teacher: string
}

export function isNonTeachingTimetableSlot(
  slot?: { subject?: string; teacher?: string } | null,
): boolean {
  if (!slot) return false
  const subj = String(slot.subject || '').trim().toLowerCase()
  const teach = String(slot.teacher || '').trim().toLowerCase()
  const nonTeachingKeywords = ['refreshment', 'no one', 'break', 'free period']
  return nonTeachingKeywords.some(
    (kw) => subj === kw || teach === kw || subj.startsWith(`${kw} `) || teach.startsWith(`${kw} `),
  )
}

export function parseTimetableStartMinutes(timeRange: string): number {
  const startPart = String(timeRange || '').split(/[–—-]|to/i)[0]?.trim() || ''
  const match = startPart.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?/i)
  if (!match) return 9999
  let hour = Number.parseInt(match[1], 10)
  const minute = Number.parseInt(match[2], 10) || 0
  const mer = (match[3] || '').toLowerCase()
  if (mer === 'pm' && hour < 12) hour += 12
  else if (mer === 'am' && hour === 12) hour = 0
  return hour * 60 + minute
}

function normalizeUsthadNameToken(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/\b(usthad|ustad|muhammed|mohammed|hafiz|shaikhuna|shakhuna|manhappatta)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractPersonalUsthadTokens(raw: string): string[] {
  return String(raw || '')
    .toLowerCase()
    .replace(
      /\b(usthad|ustad|muhammed|mohammed|hafiz|shaikhuna|shakhuna|manhappatta|abdu|abdul|saqafi|ahsani|naeemi|hudawi|faizy)\b/g,
      ' ',
    )
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 3)
}

export function doesUsthadMatchTeacherName(
  usthad: Pick<ClassUsthad, 'id' | 'staffId' | 'name' | 'shortName'>,
  teacherName: string,
): boolean {
  if (!usthad || !teacherName) return false
  const rawLower = String(teacherName).trim().toLowerCase()
  if (
    !rawLower ||
    rawLower === 'no one' ||
    rawLower === 'refreshment' ||
    rawLower === 'break' ||
    rawLower === '—' ||
    rawLower.includes('shaikhuna') ||
    rawLower.includes('shakhuna')
  ) {
    return false
  }

  const tNorm = normalizeUsthadNameToken(teacherName)
  const uNorm = normalizeUsthadNameToken(usthad.name || usthad.shortName)
  if (!tNorm || !uNorm) return false
  if (tNorm === uNorm) return true
  if (tNorm.includes(uNorm) || uNorm.includes(tNorm)) return true

  const tTokens = extractPersonalUsthadTokens(teacherName)
  const uTokens = extractPersonalUsthadTokens(usthad.name || usthad.shortName)
  if (tTokens.length === 0 || uTokens.length === 0) return false

  return tTokens.some((tTok) =>
    uTokens.some(
      (uTok) =>
        tTok === uTok ||
        (Math.min(tTok.length, uTok.length) >= 4 &&
          (tTok.startsWith(uTok) || uTok.startsWith(tTok))),
    ),
  )
}

export function findUsthadForTeacherName(teacherName: string): ClassUsthad | undefined {
  if (!teacherName) return undefined
  return OFFICIAL_CLASS_USTHADS.find((u) => doesUsthadMatchTeacherName(u, teacherName))
}

export function getUsthadScheduledPeriodsAcrossClasses(
  usthad: Pick<ClassUsthad, 'id' | 'staffId' | 'name' | 'shortName'>,
  semester: 1 | 2 = CURRENT_SEMESTER,
): UsthadScheduledPeriodSlot[] {
  const result: UsthadScheduledPeriodSlot[] = []
  const allClassKeys = Object.keys(CLASS_SEMESTER_SCHEDULES)
  for (const className of allClassKeys) {
    const schedule = CLASS_SEMESTER_SCHEDULES[className]
    if (!schedule) continue
    const slots = semester === 1 ? schedule.semester1 : schedule.semester2
    schedule.periods.forEach((p, idx) => {
      const slot = slots[idx]
      if (!slot || isNonTeachingTimetableSlot(slot)) return
      if (doesUsthadMatchTeacherName(usthad, slot.teacher)) {
        result.push({
          className,
          periodIndex: idx + 1,
          periodLabel: p.label,
          time: p.time,
          subject: slot.subject,
          teacher: slot.teacher,
        })
      }
    })
  }
  return result.sort((a, b) => {
    const diff = parseTimetableStartMinutes(a.time) - parseTimetableStartMinutes(b.time)
    if (diff !== 0) return diff
    return a.className.localeCompare(b.className)
  })
}

export function getUsthadTeachingClasses(
  usthad: ClassUsthad,
  semester: 1 | 2 = CURRENT_SEMESTER,
): string[] {
  const seen = new Set<string>()
  const addClass = (c?: string) => {
    if (!c) return
    const norm = normalizeClassName(c)
    if (CLASS_SEMESTER_SCHEDULES[norm]) {
      seen.add(norm)
    }
  }
  if (usthad.teachingBatches && usthad.teachingBatches.length > 0) {
    usthad.teachingBatches.forEach(addClass)
  }
  addClass(usthad.className)
  const scheduled = getUsthadScheduledPeriodsAcrossClasses(usthad, semester)
  scheduled.forEach((slot) => addClass(slot.className))
  return Array.from(seen)
}

export function getAssignedClassesForUsthad(
  usthad: Pick<ClassUsthad, 'id' | 'staffId' | 'name'>,
): string[] {
  if (!usthad) return []
  const targetStaffKey = normalizeAdmissionKey(usthad.staffId)
  const assignedSet = new Set<string>()
  for (const cu of CLASS_USTHADS) {
    if (!cu.staffId || cu.id.startsWith('unassigned-')) continue
    const cuStaffKey = normalizeAdmissionKey(cu.staffId)
    if (
      cu.id === usthad.id ||
      (targetStaffKey && cuStaffKey && targetStaffKey === cuStaffKey)
    ) {
      assignedSet.add(normalizeClassName(cu.className))
    }
  }
  return ALL_ACADEMY_CLASS_NAMES.filter((cls) => assignedSet.has(cls))
}

export function isUsthadAssignedClassUsthadOfBatch(
  usthad: Pick<ClassUsthad, 'id' | 'staffId' | 'name' | 'shortName'>,
  className: string,
): boolean {
  if (!usthad || !className) return false
  const norm = normalizeClassName(className)
  const classUsthadEntry = CLASS_USTHADS.find((c) => normalizeClassName(c.className) === norm)
  if (
    !classUsthadEntry ||
    !classUsthadEntry.staffId ||
    classUsthadEntry.id.startsWith('unassigned-')
  ) {
    return false
  }
  const uStaff = normalizeAdmissionKey(usthad.staffId)
  const cStaff = normalizeAdmissionKey(classUsthadEntry.staffId)
  if (uStaff && cStaff && uStaff === cStaff) return true
  return doesUsthadMatchTeacherName(usthad, classUsthadEntry.name)
}

export function findUsthadByStaffId(identifier: string): ClassUsthad | undefined {
  const cleaned = normalizeAdmissionKey(identifier)
  if (!cleaned) return undefined

  // Explicitly block Manager (Naeem Usthad) and Shaikhuna Hamza Usthad from Class Usthad login,
  // as neither is a Class Usthad and neither has a login ID.
  if (
    cleaned.includes('NAEEM') ||
    cleaned === 'MANAGER' ||
    cleaned.includes('SHAIKHUNA') ||
    cleaned.includes('HAMZA')
  ) {
    return undefined
  }

  // 1. Direct match on staffId across official Usthads & class assignments (e.g. "UST-05", "UST-06", "UST-07", "UST-14")
  const exactOfficial = OFFICIAL_CLASS_USTHADS.find(
    (u) => normalizeAdmissionKey(u.staffId) === cleaned,
  )
  if (exactOfficial) return exactOfficial

  const exactClassUsthad = CLASS_USTHADS.find(
    (u) => normalizeAdmissionKey(u.staffId) === cleaned,
  )
  if (exactClassUsthad) return exactClassUsthad

  // 2. Support Principal ID / Name logging in as Class Usthad (since Principal is also a Class Usthad)
  if (
    cleaned === 'ADM001' ||
    cleaned === 'ADM1' ||
    cleaned === 'PRINCIPAL' ||
    cleaned === 'PRICIPAL' ||
    cleaned.includes('YASIR')
  ) {
    return OFFICIAL_CLASS_USTHADS.find((u) => u.isPrincipalRole)
  }

  // 3. Support matching by Class Usthad name or Swadr title
  if (
    cleaned.includes('ABID') ||
    cleaned.includes('FAZL') ||
    cleaned.includes('NAEEMI') ||
    cleaned === 'SWADR' ||
    cleaned === 'SADR'
  ) {
    return OFFICIAL_CLASS_USTHADS.find((u) => u.institutionalRole === 'Swadr')
  }
  const byName = OFFICIAL_CLASS_USTHADS.find((u) =>
    normalizeAdmissionKey(u.name).includes(cleaned),
  )
  if (byName && cleaned.length >= 4) return byName

  // 4. Match TCH-XX or batch number (e.g. "TCH07", "BATCH07", "07", "7")
  const digits = cleaned.replace(/[^0-9]/g, '')
  if (digits) {
    const padded = digits.padStart(2, '0')
    const byBatch =
      CLASS_USTHADS.find((u) => u.batchCode === padded || u.batchCode === digits) ??
      OFFICIAL_CLASS_USTHADS.find((u) => u.batchCode === padded || u.batchCode === digits)
    if (byBatch) return byBatch
  }

  // 5. Support default placeholder "TCH-0217" -> defaults to Principal/Class Usthad (BS 3 • Batch 07)
  if (cleaned === 'TCH0217' || cleaned === 'USTHAD' || cleaned === 'TEACHER') {
    return OFFICIAL_CLASS_USTHADS[0]
  }

  return undefined
}

export function getCanonicalUsthadId(rawId?: string): string {
  const cleaned = (rawId ?? '').trim()
  if (!cleaned) return ''
  if (cleaned === 'usthad-10' || cleaned === 'usthad-10b') {
    return 'usthad-06'
  }
  if (cleaned === 'usthad-07-bs1' || cleaned.startsWith('usthad-07-')) {
    return 'usthad-07'
  }
  const directOfficial = OFFICIAL_CLASS_USTHADS.find((u) => u.id === cleaned)
  if (directOfficial) return directOfficial.id
  const prefixOfficial = OFFICIAL_CLASS_USTHADS.find((u) =>
    cleaned.startsWith(`${u.id}-`),
  )
  if (prefixOfficial) return prefixOfficial.id
  const classSlot = CLASS_USTHADS.find((u) => u.id === cleaned)
  if (classSlot) {
    const matchedOfficial = OFFICIAL_CLASS_USTHADS.find(
      (u) =>
        normalizeAdmissionKey(u.staffId) === normalizeAdmissionKey(classSlot.staffId) ||
        u.name === classSlot.name,
    )
    if (matchedOfficial) return matchedOfficial.id
  }
  return cleaned
}

export const OFFICIAL_LAUNCH_TIMESTAMP_MS = 1793980600000
const OFFICIAL_LAUNCH_RESET_FLAG = 'ics_official_launch_clean_v1'

export function ensureCleanLaunchStorage(): void {
  if (typeof window === 'undefined') return
  try {
    if (window.localStorage.getItem(OFFICIAL_LAUNCH_RESET_FLAG) === 'true') return
    const keysToRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (!k) continue
      if (
        k.startsWith('ics_attendance_overrides') ||
        k.startsWith('ics_custom_notices') ||
        k.startsWith('ics_period_attendance') ||
        k.startsWith('ics_campus_notifications') ||
        k.startsWith('ics_campus_messenger') ||
        k.startsWith('ics_leave_records') ||
        k.startsWith('ics_leave_register') ||
        k.startsWith('ics_read_notification_ids') ||
        k.startsWith('ics_last_toasted_notif_id')
      ) {
        keysToRemove.push(k)
      }
    }
    for (const k of keysToRemove) {
      window.localStorage.removeItem(k)
    }
    window.localStorage.setItem(OFFICIAL_LAUNCH_RESET_FLAG, 'true')
  } catch {
    // Ignore storage errors
  }
}

export const ATTENDANCE_OVERRIDES_STORAGE_KEY = 'ics_attendance_overrides_v2'
export const CUSTOM_NOTICES_STORAGE_KEY = 'ics_custom_notices_v2'

export type MonthlyAttendanceOverride = {
  present: number
  absent: number
  leave: number
  workingDaysOverride?: number
  absentReason?: string
  leaveReason?: string
}

/** Keyed by `${studentId}__${monthId}` */
export type AttendanceOverrideMap = Record<string, MonthlyAttendanceOverride>

export function loadAttendanceOverrides(): AttendanceOverrideMap {
  if (typeof window === 'undefined') return {}
  ensureCleanLaunchStorage()
  try {
    const raw = window.localStorage.getItem(ATTENDANCE_OVERRIDES_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as AttendanceOverrideMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveAttendanceOverrides(map: AttendanceOverrideMap): void {
  if (typeof window === 'undefined') return
  ensureCleanLaunchStorage()
  try {
    const prev = loadAttendanceOverrides()

    // Find changed or removed student+month entry
    let changedKey: string | null = null
    for (const k of Object.keys(map)) {
      const cur = map[k]
      const old = prev[k]
      if (
        !old ||
        old.present !== cur.present ||
        old.absent !== cur.absent ||
        old.leave !== cur.leave ||
        (old.absentReason ?? '') !== (cur.absentReason ?? '') ||
        (old.leaveReason ?? '') !== (cur.leaveReason ?? '')
      ) {
        changedKey = k
        break
      }
    }

    const removedKey = Object.keys(prev).find((k) => !(k in map)) ?? null
    if (!changedKey && !removedKey) {
      return
    }

    window.localStorage.setItem(ATTENDANCE_OVERRIDES_STORAGE_KEY, JSON.stringify(map))
    window.dispatchEvent(new CustomEvent('ics-attendance-updated'))

    let notif: CampusNotification | undefined
    if (changedKey) {
      const [stId, mId] = changedKey.split('__')
      const st = students.find((s) => s.id === stId)
      const mMeta = MONTHS_META.find((m) => m.id === mId) ?? (mId ? buildMonthMetaForId(mId) : undefined)
      const entry = map[changedKey]
      if (st && entry) {
        const monthText = mMeta ? `${mMeta.shortMonth} ${mMeta.year}` : mId
        notif = createAndStoreCampusNotification({
          type: 'attendance',
          title: `Attendance Updated • ${st.name}`,
          message: `${monthText} (${st.className}): Present ${entry.present}d, Absent ${entry.absent}d, Leave ${entry.leave}d.`,
          targetStudentId: st.id,
          targetClass: st.className,
          href: '#attendance',
        })
      }
    }

    pushCampusSyncToServer({
      attendanceOverrides: map,
      ...(notif ? { notification: notif } : {}),
    })
  } catch {
    // Ignore storage errors
  }
}

export function loadCustomNotices(): Notice[] {
  if (typeof window === 'undefined') return []
  ensureCleanLaunchStorage()
  try {
    const raw = window.localStorage.getItem(CUSTOM_NOTICES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Notice[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveCustomNotices(customList: Notice[]): void {
  if (typeof window === 'undefined') return
  ensureCleanLaunchStorage()
  try {
    const prev = loadCustomNotices()
    const prevIds = new Set(prev.map((n) => n.id))
    window.localStorage.setItem(CUSTOM_NOTICES_STORAGE_KEY, JSON.stringify(customList))
    window.dispatchEvent(new CustomEvent('ics-notices-updated'))
    window.dispatchEvent(new CustomEvent('ics-attendance-updated'))

    const newlyAdded = customList.find((n) => !prevIds.has(n.id))
    let notif: CampusNotification | undefined
    if (newlyAdded) {
      const isHoliday = Boolean(newlyAdded.holidayMeta?.isOfficialHoliday)
      const targets = getNoticeTargetClasses(newlyAdded)
      const badgeLabel = formatTargetClassesBadge(targets)
      const scopeSuffix = targets.length > 0 ? ` [${badgeLabel}]` : ''
      notif = createAndStoreCampusNotification({
        type: 'notice',
        title: isHoliday
          ? `Official Holiday${scopeSuffix}: ${newlyAdded.title}`
          : `Announcement${scopeSuffix}: ${newlyAdded.title}`,
        message: newlyAdded.body,
        category: newlyAdded.category,
        targetClass: targets.length === 1 ? targets[0] : undefined,
        targetClasses: targets.length > 0 ? targets : undefined,
        actorName: newlyAdded.holidayMeta?.announcedBy || 'Usthad / Principal',
        href: '#notices',
      })
    }

    pushCampusSyncToServer({
      customNotices: customList,
      ...(notif ? { notification: notif } : {}),
    })
  } catch {
    // Ignore storage errors
  }
}

const MONTH_LOOKUP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

function parseHolidayDateString(raw?: string): { year: number; month: number; day: number } | null {
  if (!raw) return null
  const text = raw.trim()
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  if (iso) {
    return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }
  }
  const dmy = /(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})/.exec(text)
  if (dmy) {
    const m = MONTH_LOOKUP[dmy[2].toLowerCase()]
    if (m) return { year: Number(dmy[3]), month: m, day: Number(dmy[1]) }
  }
  const mdy = /([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/.exec(text)
  if (mdy) {
    const m = MONTH_LOOKUP[mdy[1].toLowerCase()]
    if (m) return { year: Number(mdy[3]), month: m, day: Number(mdy[2]) }
  }
  return null
}

function parseHolidayTimeToMinutes(raw: string | undefined, fallbackMinutes: number): number {
  if (!raw) return fallbackMinutes
  const ampm = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(raw)
  if (ampm) {
    let hour = Number(ampm[1])
    const min = Number(ampm[2])
    const meridiem = ampm[3].toUpperCase()
    if (meridiem === 'PM' && hour < 12) hour += 12
    if (meridiem === 'AM' && hour === 12) hour = 0
    return hour * 60 + min
  }
  const hhmm = /(\d{1,2}):(\d{2})/.exec(raw)
  if (hhmm) {
    return Number(hhmm[1]) * 60 + Number(hhmm[2])
  }
  return fallbackMinutes
}

function istDateTimeToUtcMs(year: number, month: number, day: number, totalMinutes: number): number {
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  return Date.UTC(year, month - 1, day, hours, mins, 0, 0) - IST_OFFSET_MS
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export type ParsedOfficialHolidayWindow = {
  departureMs: number
  returnMs: number
  departureDayKey: string
  returnDayKey: string
}

export function parseOfficialHolidayWindow(
  meta?: OfficialHolidayMeta,
): ParsedOfficialHolidayWindow | null {
  if (!meta?.isOfficialHoliday) return null
  const depDate = parseHolidayDateString(meta.departureDate)
  const retDate = parseHolidayDateString(meta.returnDate)
  if (!depDate || !retDate) return null

  const depMins = parseHolidayTimeToMinutes(meta.departureTime, 12 * 60)
  const retMins = parseHolidayTimeToMinutes(meta.returnTime, 18 * 60)

  const departureMs = istDateTimeToUtcMs(depDate.year, depDate.month, depDate.day, depMins)
  const returnMs = istDateTimeToUtcMs(retDate.year, retDate.month, retDate.day, retMins)

  if (!Number.isFinite(departureMs) || !Number.isFinite(returnMs) || returnMs < departureMs) {
    return null
  }

  return {
    departureMs,
    returnMs,
    departureDayKey: formatDateKey(depDate.year, depDate.month, depDate.day),
    returnDayKey: formatDateKey(retDate.year, retDate.month, retDate.day),
  }
}

/**
 * Returns every full closed calendar day strictly between departureDate and returnDate.
 * Departure day and return day remain Open Days (students are at campus part of those days).
 */
export function getFullClosedDateKeysForNotice(meta?: OfficialHolidayMeta): string[] {
  if (!meta?.isOfficialHoliday) return []
  const dep = parseHolidayDateString(meta.departureDate)
  const ret = parseHolidayDateString(meta.returnDate)
  if (!dep || !ret) return []

  const startUtc = Date.UTC(dep.year, dep.month - 1, dep.day)
  const endUtc = Date.UTC(ret.year, ret.month - 1, ret.day)
  if (endUtc <= startUtc) return []

  const keys: string[] = []
  const oneDayMs = 24 * 60 * 60 * 1000
  const maxSpan = 120
  let cursor = startUtc + oneDayMs
  let count = 0
  while (cursor < endUtc && count < maxSpan) {
    const d = new Date(cursor)
    keys.push(formatDateKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()))
    cursor += oneDayMs
    count++
  }
  return keys
}

export type AcademyClosureStatus = {
  isClosed: boolean
  activeNotices: Notice[]
  primaryNotice: Notice | null
  affectedClasses: string[]
  isAllClasses: boolean
  returnLabel: string
}

export function getActiveAcademyClosure(
  customNoticesList?: Notice[],
  className?: string,
  nowMs: number = Date.now(),
): AcademyClosureStatus {
  const noticesSource = customNoticesList ?? loadCustomNotices()
  const activeNotices: Notice[] = []

  for (const nt of noticesSource) {
    if (!nt.holidayMeta?.isOfficialHoliday) continue
    if (className && !isNoticeVisibleForClass(nt, className)) continue
    const win = parseOfficialHolidayWindow(nt.holidayMeta)
    if (!win) continue
    if (nowMs >= win.departureMs && nowMs <= win.returnMs) {
      activeNotices.push(nt)
    }
  }

  if (activeNotices.length === 0) {
    return {
      isClosed: false,
      activeNotices: [],
      primaryNotice: null,
      affectedClasses: [],
      isAllClasses: false,
      returnLabel: '',
    }
  }

  let isAllClasses = false
  const classSet = new Set<string>()
  for (const nt of activeNotices) {
    const targets = getNoticeTargetClasses(nt)
    if (targets.length === 0) {
      isAllClasses = true
    } else {
      for (const cls of targets) classSet.add(cls)
    }
  }

  const primaryNotice = activeNotices[0]
  const meta = primaryNotice.holidayMeta
  const returnLabel = meta ? `${meta.returnDate} • ${meta.returnTime}` : ''

  return {
    isClosed: true,
    activeNotices,
    primaryNotice,
    affectedClasses: isAllClasses ? ALL_ACADEMY_CLASS_NAMES : Array.from(classSet),
    isAllClasses,
    returnLabel,
  }
}

function buildHolidayAnalyticsForClass(
  activeCustomNotices: Notice[],
  className: string,
): {
  closedDateKeysByMonth: Record<string, Set<string>>
  fallbackClosedDaysByMonth: Record<string, number>
  notesByMonth: Record<string, string[]>
} {
  const closedDateKeysByMonth: Record<string, Set<string>> = {}
  const fallbackClosedDaysByMonth: Record<string, number> = {}
  const notesByMonth: Record<string, string[]> = {}

  for (const nt of activeCustomNotices) {
    if (!nt.holidayMeta?.isOfficialHoliday) continue
    if (!isNoticeVisibleForClass(nt, className)) continue
    const meta = nt.holidayMeta
    const noteLine = `${nt.title} (${meta.departureDate} ${meta.departureTime} → ${meta.returnDate} ${meta.returnTime})`
    const fullKeys = getFullClosedDateKeysForNotice(meta)

    if (fullKeys.length > 0) {
      const touchedMonths = new Set<string>()
      for (const dateKey of fullKeys) {
        const mId = dateKey.slice(0, 7)
        if (!closedDateKeysByMonth[mId]) {
          closedDateKeysByMonth[mId] = new Set<string>()
        }
        closedDateKeysByMonth[mId].add(dateKey)
        touchedMonths.add(mId)
      }
      for (const mId of touchedMonths) {
        if (!notesByMonth[mId]) notesByMonth[mId] = []
        notesByMonth[mId].push(noteLine)
      }
    } else {
      const parsedWin = parseOfficialHolidayWindow(meta)
      const fallbackMonthId = parsedWin?.departureDayKey.slice(0, 7) || meta.monthId
      if (fallbackMonthId) {
        if (!parsedWin && meta.holidayDaysDeducted > 0) {
          fallbackClosedDaysByMonth[fallbackMonthId] =
            (fallbackClosedDaysByMonth[fallbackMonthId] ?? 0) + meta.holidayDaysDeducted
        }
        if (!notesByMonth[fallbackMonthId]) notesByMonth[fallbackMonthId] = []
        notesByMonth[fallbackMonthId].push(noteLine)
      }
    }
  }

  return { closedDateKeysByMonth, fallbackClosedDaysByMonth, notesByMonth }
}

function buildPeriodDaysByMonthForStudent(
  student: Student,
  activePeriodSubmissions: Record<string, PeriodAttendanceSubmission>,
): Record<string, { present: number; absent: number; leave: number }> {
  const periodDaysByMonth: Record<string, { present: number; absent: number; leave: number }> = {}
  const dateStatusesByMonth: Record<string, Record<string, PeriodAttendanceStatus[]>> = {}

  for (const sub of Object.values(activePeriodSubmissions)) {
    if (normalizeClassName(sub.className) !== normalizeClassName(student.className)) continue
    if (sub.sessionStatus === 'not-held') continue
    const stStatus = sub.records?.[student.id]
    if (!stStatus) continue
    const monthId = sub.date.slice(0, 7)
    if (!dateStatusesByMonth[monthId]) {
      dateStatusesByMonth[monthId] = {}
    }
    if (!dateStatusesByMonth[monthId][sub.date]) {
      dateStatusesByMonth[monthId][sub.date] = []
    }
    dateStatusesByMonth[monthId][sub.date].push(stStatus)
  }

  for (const [mId, datesMap] of Object.entries(dateStatusesByMonth)) {
    let pDays = 0
    let aDays = 0
    let lDays = 0
    for (const statuses of Object.values(datesMap)) {
      if (statuses.includes('leave')) {
        lDays += 1
      } else if (statuses.includes('absent')) {
        aDays += 1
      } else if (statuses.includes('present')) {
        pDays += 1
      }
    }
    periodDaysByMonth[mId] = { present: pDays, absent: aDays, leave: lDays }
  }

  return periodDaysByMonth
}

export function getEffectiveMonthAttendanceForId(
  student: Student,
  monthId: string,
  overrides: AttendanceOverrideMap,
  customNoticesList?: Notice[],
): MonthlyAttendance {
  const activeCustomNotices = customNoticesList ?? loadCustomNotices()
  const activePeriodSubmissions = loadPeriodAttendanceSubmissions()
  const periodDaysByMonth = buildPeriodDaysByMonthForStudent(student, activePeriodSubmissions)
  const { closedDateKeysByMonth, fallbackClosedDaysByMonth, notesByMonth } =
    buildHolidayAnalyticsForClass(activeCustomNotices, student.className)

  const baseMeta = buildMonthMetaForId(monthId)
  const key = `${student.id}__${baseMeta.id}`
  const override = overrides[key]
  const periodDerived = periodDaysByMonth[baseMeta.id]

  const present = override
    ? Math.max(0, override.present)
    : periodDerived
      ? periodDerived.present
      : 0
  const absent = override
    ? Math.max(0, override.absent)
    : periodDerived
      ? periodDerived.absent
      : 0
  const leave = override
    ? Math.max(0, override.leave)
    : periodDerived
      ? periodDerived.leave
      : 0

  const workingDays = present + absent + leave
  const parsedClosedCount = closedDateKeysByMonth[baseMeta.id]?.size ?? 0
  const fallbackClosedCount = fallbackClosedDaysByMonth[baseMeta.id] ?? 0
  const closedDays = Math.min(baseMeta.calendarDays, Math.max(0, parsedClosedCount + fallbackClosedCount))
  const openDays = Math.max(0, baseMeta.calendarDays - closedDays)
  const officialHolidayDays = closedDays
  const notes = notesByMonth[baseMeta.id]
  const officialHolidayNote =
    notes && notes.length > 0 ? notes.join(' • ') : baseMeta.officialHolidayNote

  return {
    id: baseMeta.id,
    month: baseMeta.month,
    shortMonth: baseMeta.shortMonth,
    year: baseMeta.year,
    calendarDays: baseMeta.calendarDays,
    openDays,
    closedDays,
    officialHolidayDays,
    officialHolidayNote,
    workingDays,
    present,
    absent,
    leave,
  }
}

export function getEffectiveStudentAttendance(
  student: Student,
  overrides: AttendanceOverrideMap,
  customNoticesList?: Notice[],
  targetYear?: number,
): {
  monthlyAttendance: MonthlyAttendance[]
  attendance: {
    present: number
    absent: number
    leave: number
    workingDays: number
    openDays: number
    closedDays: number
    officialHolidayDays: number
    calendarDays: number
  }
} {
  let presentTotal = 0
  let absentTotal = 0
  let leaveTotal = 0
  let workingDaysTotal = 0
  let openDaysTotal = 0
  let closedDaysTotal = 0
  let officialHolidaysTotal = 0
  let calendarDaysTotal = 0

  const activeCustomNotices = customNoticesList ?? loadCustomNotices()
  const activePeriodSubmissions = loadPeriodAttendanceSubmissions()
  const periodDaysByMonth = buildPeriodDaysByMonthForStudent(student, activePeriodSubmissions)
  const { closedDateKeysByMonth, fallbackClosedDaysByMonth, notesByMonth } =
    buildHolidayAnalyticsForClass(activeCustomNotices, student.className)

  const baseMonths: MonthMeta[] =
    typeof targetYear === 'number'
      ? getYearMonthsMeta(targetYear)
      : student.monthlyAttendance.map((m) => ({
          id: m.id,
          month: m.month,
          shortMonth: m.shortMonth,
          year: m.year,
          calendarDays: m.calendarDays,
          officialHolidayDays: m.officialHolidayDays,
          officialHolidayNote: m.officialHolidayNote,
          baseDays: 0,
        }))

  const monthlyAttendance: MonthlyAttendance[] = baseMonths.map((m) => {
    const key = `${student.id}__${m.id}`
    const override = overrides[key]
    const periodDerived = periodDaysByMonth[m.id]

    const present = override
      ? Math.max(0, override.present)
      : periodDerived
        ? periodDerived.present
        : 0
    const absent = override
      ? Math.max(0, override.absent)
      : periodDerived
        ? periodDerived.absent
        : 0
    const leave = override
      ? Math.max(0, override.leave)
      : periodDerived
        ? periodDerived.leave
        : 0

    const workingDays = present + absent + leave
    const parsedClosedCount = closedDateKeysByMonth[m.id]?.size ?? 0
    const fallbackClosedCount = fallbackClosedDaysByMonth[m.id] ?? 0
    const closedDays = Math.min(m.calendarDays, Math.max(0, parsedClosedCount + fallbackClosedCount))
    const openDays = Math.max(0, m.calendarDays - closedDays)
    const officialHolidayDays = closedDays
    const notes = notesByMonth[m.id]
    const officialHolidayNote =
      notes && notes.length > 0 ? notes.join(' • ') : m.officialHolidayNote

    presentTotal += present
    absentTotal += absent
    leaveTotal += leave
    workingDaysTotal += workingDays
    openDaysTotal += openDays
    closedDaysTotal += closedDays
    officialHolidaysTotal += officialHolidayDays
    calendarDaysTotal += m.calendarDays

    return {
      id: m.id,
      month: m.month,
      shortMonth: m.shortMonth,
      year: m.year,
      calendarDays: m.calendarDays,
      openDays,
      closedDays,
      officialHolidayDays,
      officialHolidayNote,
      workingDays,
      present,
      absent,
      leave,
    }
  })

  return {
    monthlyAttendance,
    attendance: {
      present: presentTotal,
      absent: absentTotal,
      leave: leaveTotal,
      workingDays: workingDaysTotal,
      openDays: openDaysTotal,
      closedDays: closedDaysTotal,
      officialHolidayDays: officialHolidaysTotal,
      calendarDays: calendarDaysTotal,
    },
  }
}

export type ClassLeaderInfo = {
  leaderId: string
  roleTitle: 'Main Class Leader' | 'Assistant Class Leader'
  className: string
  batchCode: string
  studentId: string
  admissionNo: string
  studentName: string
}

/**
 * Each class has TWO Class Leaders with identical role & permissions:
 * 1. Main Class Leader (CL-XX) — Roll #01 of the class
 * 2. Assistant Class Leader (ACL-XX) — Roll #02 of the class
 */
export const CLASS_LEADERS: ClassLeaderInfo[] = (() => {
  const batchMapping: {
    className: string
    batchCode: string
    mainAdmissionNo?: string
    assistantAdmissionNo?: string
  }[] = [
    {
      className: '8th',
      batchCode: '14',
      mainAdmissionNo: 'ICS2K261407', // Fuad Saneen M
      assistantAdmissionNo: 'ICS2K261410', // Muhammed Savad M
    },
    {
      className: '9th',
      batchCode: '13',
      mainAdmissionNo: 'ICS2K251317', // Muhammed Shaheem. M
      assistantAdmissionNo: 'ICS2K251305', // Muhammed Saneeh. OK
    },
    {
      className: '10th',
      batchCode: '12',
      mainAdmissionNo: 'ICS2K241202', // Muhammed Fathah. EK
      assistantAdmissionNo: 'ICS2K241214', // Shamnad. C
    },
    {
      className: 'HS 1',
      batchCode: '11',
      mainAdmissionNo: 'ICS2K231102', // Ismaeel Faheem. MP
      assistantAdmissionNo: 'ICS2K231119', // Muhammed Bishal. P
    },
    {
      className: 'HS 2A',
      batchCode: '10',
      mainAdmissionNo: 'ICS2K221011', // Muhammed Shamil. P
      assistantAdmissionNo: 'ICS2K221013', // Muhammed Mubeen. V
    },
    {
      className: 'HS 2B',
      batchCode: '10',
      mainAdmissionNo: 'ICS2K251001', // Sahd. PK
      assistantAdmissionNo: 'ICS2K251005', // Ahmed Arif Fawaz
    },
    {
      className: 'BS 1',
      batchCode: '09',
      mainAdmissionNo: 'ICS2K210901', // Muhammed Rabeeh. C
      assistantAdmissionNo: 'ICS2K210902', // Muhammed Sa'ad. KM
    },
    {
      className: 'BS 2',
      batchCode: '08',
      mainAdmissionNo: 'ICS2K200801', // Muhammed Hibathullah. K
      assistantAdmissionNo: 'ICS2K230802', // Muhammed Muzammil. MK
    },
    {
      className: 'BS 3',
      batchCode: '07',
      mainAdmissionNo: 'ICS2K190706', // Muhammed Shahid. M
      assistantAdmissionNo: 'ICS2K190701', // Muhammed Junaid. P
    },
    {
      className: 'BS 4',
      batchCode: '06',
      mainAdmissionNo: 'ICS2K180609', // Muhammed Rafi. V
      assistantAdmissionNo: 'ICS2K180602', // Abdul Bais. V
    },
    {
      className: 'BS 5',
      batchCode: '05',
      mainAdmissionNo: 'ICS2K170505', // Muhammed Shabeer. MPT
      assistantAdmissionNo: 'ICS2K170504', // Muhammed Muslih. MV
    },
  ]

  const leaders: ClassLeaderInfo[] = []
  for (const item of batchMapping) {
    const classRoster = students.filter((s) => s.className === item.className)
    const mainStudent =
      (item.mainAdmissionNo
        ? classRoster.find((s) => s.admissionNo === item.mainAdmissionNo)
        : undefined) ?? classRoster[0]
    const assistantStudent =
      (item.assistantAdmissionNo
        ? classRoster.find((s) => s.admissionNo === item.assistantAdmissionNo)
        : undefined) ??
      classRoster[1] ??
      classRoster[0]

    if (mainStudent) {
      leaders.push({
        leaderId: `CL-${item.batchCode}`,
        roleTitle: 'Main Class Leader',
        className: item.className,
        batchCode: item.batchCode,
        studentId: mainStudent.id,
        admissionNo: mainStudent.admissionNo,
        studentName: mainStudent.name,
      })
    }
    if (assistantStudent) {
      leaders.push({
        leaderId: `ACL-${item.batchCode}`,
        roleTitle: 'Assistant Class Leader',
        className: item.className,
        batchCode: item.batchCode,
        studentId: assistantStudent.id,
        admissionNo: assistantStudent.admissionNo,
        studentName: assistantStudent.name,
      })
    }
  }
  return leaders
})()

export function getClassLeadersForClass(className: string): ClassLeaderInfo[] {
  const norm = normalizeClassName(className)
  return CLASS_LEADERS.filter((item) => normalizeClassName(item.className) === norm)
}

export function getLeaderIdForClass(className: string, studentId?: string): string {
  const norm = normalizeClassName(className)
  if (studentId) {
    const byStudent = CLASS_LEADERS.find(
      (item) => normalizeClassName(item.className) === norm && item.studentId === studentId,
    )
    if (byStudent) return byStudent.leaderId
  }
  const found = CLASS_LEADERS.find((item) => normalizeClassName(item.className) === norm)
  return found?.leaderId ?? 'CL-14'
}

export function getLeaderInfoForStudent(student: Student): ClassLeaderInfo {
  const exact = CLASS_LEADERS.find((item) => item.studentId === student.id)
  if (exact) return exact
  const classMain = CLASS_LEADERS.find((item) => item.className === student.className)
  return (
    classMain ?? {
      leaderId: 'CL-14',
      roleTitle: 'Main Class Leader',
      className: student.className,
      batchCode: '14',
      studentId: student.id,
      admissionNo: student.admissionNo,
      studentName: student.name,
    }
  )
}

export function findClassLeaderByIdentifier(
  identifier: string,
): { student: Student; leaderId: string; roleTitle: 'Main Class Leader' | 'Assistant Class Leader' } | undefined {
  const cleaned = normalizeAdmissionKey(identifier)
  if (!cleaned) return undefined

  // 1. Direct match on Leader ID (e.g. CL-14, ACL-14, CL14, ACL14, CL-07, ACL-07)
  const directLeader = CLASS_LEADERS.find(
    (item) => normalizeAdmissionKey(item.leaderId) === cleaned,
  )
  if (directLeader) {
    const student =
      students.find((s) => s.id === directLeader.studentId) ??
      students.find((s) => s.className === directLeader.className) ??
      students[0]
    return {
      student,
      leaderId: directLeader.leaderId,
      roleTitle: directLeader.roleTitle,
    }
  }

  // 2. Support CL-14-A / CL14A / CL-14-2 format for Assistant Class Leader
  if (cleaned.startsWith('ACL') || cleaned.endsWith('A') || cleaned.endsWith('2')) {
    const digits = cleaned.replace(/[^0-9]/g, '').slice(0, 2)
    if (digits) {
      const padded = digits.padStart(2, '0')
      const assistant = CLASS_LEADERS.find(
        (item) =>
          item.roleTitle === 'Assistant Class Leader' &&
          (item.batchCode === padded || item.batchCode === digits),
      )
      if (assistant && (cleaned.startsWith('ACL') || cleaned.startsWith('CL'))) {
        const student =
          students.find((s) => s.id === assistant.studentId) ??
          students[1] ??
          students[0]
        return {
          student,
          leaderId: assistant.leaderId,
          roleTitle: assistant.roleTitle,
        }
      }
    }
  }

  // 3. Check if the user entered an authorized Class Leader's Student Admission Number
  const matchedByAdmission = findStudentByAdmissionNo(identifier)
  if (matchedByAdmission) {
    const matchingLeader = CLASS_LEADERS.find(
      (item) => item.studentId === matchedByAdmission.id,
    )
    if (matchingLeader) {
      return {
        student: matchedByAdmission,
        leaderId: matchingLeader.leaderId,
        roleTitle: matchingLeader.roleTitle,
      }
    }
    return undefined
  }

  // 4. Support legacy placeholder "CL-8B-03" or "LEADER" / "ASSISTANT"
  if (cleaned === 'CL8B03' || cleaned === 'LEADER' || cleaned === 'CLASSLEADER') {
    const fallback = CLASS_LEADERS[0]
    const student =
      students.find((s) => s.id === fallback.studentId) ?? students[0]
    return {
      student,
      leaderId: fallback.leaderId,
      roleTitle: fallback.roleTitle,
    }
  }
  if (cleaned === 'ACLEADER' || cleaned === 'ASSISTANTLEADER') {
    const fallback = CLASS_LEADERS[1] ?? CLASS_LEADERS[0]
    const student =
      students.find((s) => s.id === fallback.studentId) ?? students[1] ?? students[0]
    return {
      student,
      leaderId: fallback.leaderId,
      roleTitle: fallback.roleTitle,
    }
  }

  // 5. Match by batch digits in CL-XX or ACL-XX (e.g. CL-7 -> 07, ACL-7 -> 07)
  if (cleaned.startsWith('CL') || cleaned.startsWith('ACL')) {
    const isAssistant = cleaned.startsWith('ACL')
    const digits = cleaned.replace(/[^0-9]/g, '')
    if (digits) {
      const padded = digits.padStart(2, '0')
      const byBatch = CLASS_LEADERS.find(
        (item) =>
          (item.batchCode === padded || item.batchCode === digits) &&
          item.roleTitle ===
            (isAssistant ? 'Assistant Class Leader' : 'Main Class Leader'),
      )
      if (byBatch) {
        const student =
          students.find((s) => s.id === byBatch.studentId) ??
          students.find((s) => s.className === byBatch.className) ??
          students[0]
        return {
          student,
          leaderId: byBatch.leaderId,
          roleTitle: byBatch.roleTitle,
        }
      }
    }
  }

  return undefined
}

export type PeriodAttendanceStatus = 'present' | 'absent' | 'leave'

export type PeriodSessionStatus = 'conducted' | 'not-held' | 'substituted'

export const NOT_HELD_REASONS = [
  'Usthad on Personal / Medical Leave',
  'Official Academy / Jamiathul Hind Duty',
  'Combined Session / Special Lecture',
  'Internal Exam / Study Revision Hour',
] as const

export type SubstituteUsthadAssignment = {
  usthadId: string
  usthadName: string
  assignedBy: string
  assignedAt: string
}

export type PeriodAttendanceSubmission = {
  key: string // `${date}__${className}__${periodIndex}`
  date: string // YYYY-MM-DD
  className: string
  periodIndex: number // 1-based period number
  periodLabel: string
  periodTime: string
  subject: string
  teacher: string
  submittedByLeaderId: string
  submittedByName: string
  submittedByRole?: 'Class Leader' | 'Class Usthad' | 'Principal'
  submittedAt: string // ISO string
  lastEditedByName?: string
  lastEditedByRole?: 'Class Leader' | 'Class Usthad' | 'Principal'
  lastEditedById?: string
  lastEditedAt?: string // ISO string
  editCount?: number
  records: Record<string, PeriodAttendanceStatus> // studentId -> status
  reasons?: Record<string, string> // studentId -> selected reason for absent or leave
  sessionStatus?: PeriodSessionStatus // 'conducted' | 'not-held' | 'substituted'
  notHeldReason?: string // why the regular usthad did not take the class
  markedNotHeldBy?: string // role & name of who marked the period not held
  substituteUsthad?: SubstituteUsthadAssignment
}

export type PrincipalProfile = {
  id: string
  staffId: string
  usthadId: string
  usthadStaffId: string
  assignedClassName: string
  assignedClasses: string[]
  assignedClassesLabel: string
  assignedBatch: string
  avatarUrl?: string
  name: string
  shortName: string
  designation: string
  qualification: string
  email: string
  phone: string
}

export const ACADEMY_PRINCIPAL: PrincipalProfile = {
  id: 'principal-1',
  staffId: 'ADM-001',
  usthadId: 'usthad-07',
  usthadStaffId: 'UST-07',
  assignedClassName: 'BS 3',
  assignedClasses: ['BS 3', 'BS 1'],
  assignedClassesLabel: 'BS 3 & BS 1',
  assignedBatch: 'Batch 07 & Batch 09',
  avatarUrl: '/images/yasir-usthad.jpg',
  name: 'Usthad Muhammed Yasir Ahsani',
  shortName: 'Usthad Muhammed Yasir Ahsani',
  designation: "Principal • ICS Academy & Da'wa College Manhappatta",
  qualification: 'Ahsani Scholar in Islamic Jurisprudence & Educational Leadership (Jamiathul Hind)',
  email: 'principal@icsacademy.edu.in',
  phone: '+91 94470 00101',
}

export function findPrincipalByIdentifier(identifier: string): PrincipalProfile | undefined {
  const cleaned = normalizeAdmissionKey(identifier)
  if (!cleaned) return undefined
  if (
    cleaned === 'ADM001' ||
    cleaned === 'ADM1' ||
    cleaned === 'PRINCIPAL' ||
    cleaned === 'PRICIPAL' ||
    cleaned === 'ICSADMIN' ||
    cleaned === 'ADMIN' ||
    cleaned === 'PRN001' ||
    cleaned === 'UST07' ||
    cleaned.includes('YASIR') ||
    cleaned.startsWith('ADM') ||
    cleaned.startsWith('PRN')
  ) {
    return ACADEMY_PRINCIPAL
  }
  return undefined
}

export const PERIOD_ATTENDANCE_STORAGE_KEY = 'ics_period_attendance_v2'
export const DELETED_PERIOD_KEYS_STORAGE_KEY = 'ics_deleted_period_keys_v2'

export function loadDeletedPeriodKeys(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(DELETED_PERIOD_KEYS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, number>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveDeletedPeriodKeys(map: Record<string, number>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DELETED_PERIOD_KEYS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore storage errors
  }
}

export function loadPeriodAttendanceSubmissions(): Record<string, PeriodAttendanceSubmission> {
  if (typeof window === 'undefined') return {}
  ensureCleanLaunchStorage()
  try {
    const raw = window.localStorage.getItem(PERIOD_ATTENDANCE_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, PeriodAttendanceSubmission>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function isPeriodSubmissionDataIdentical(
  a?: PeriodAttendanceSubmission,
  b?: PeriodAttendanceSubmission,
): boolean {
  if (!a || !b) return false
  if ((a.sessionStatus ?? 'conducted') !== (b.sessionStatus ?? 'conducted')) return false
  if ((a.notHeldReason ?? '') !== (b.notHeldReason ?? '')) return false
  if ((a.substituteUsthad?.usthadId ?? '') !== (b.substituteUsthad?.usthadId ?? '')) return false
  if (JSON.stringify(a.records ?? {}) !== JSON.stringify(b.records ?? {})) return false
  if (JSON.stringify(a.reasons ?? {}) !== JSON.stringify(b.reasons ?? {})) return false
  return true
}

export function savePeriodAttendanceSubmissions(
  map: Record<string, PeriodAttendanceSubmission>,
): void {
  if (typeof window === 'undefined') return
  ensureCleanLaunchStorage()
  try {
    const prev = loadPeriodAttendanceSubmissions()

    let changedSub: PeriodAttendanceSubmission | null = null
    let isUpdate = false
    for (const k of Object.keys(map)) {
      const cur = map[k]
      const old = prev[k]
      if (!old || !isPeriodSubmissionDataIdentical(old, cur)) {
        changedSub = cur
        isUpdate = Boolean(old)
        break
      }
    }

    if (!changedSub) {
      return
    }

    const deletedMap = loadDeletedPeriodKeys()
    let deletedMapChanged = false
    for (const k of Object.keys(map)) {
      if (k in deletedMap) {
        delete deletedMap[k]
        deletedMapChanged = true
      }
    }
    if (deletedMapChanged) {
      saveDeletedPeriodKeys(deletedMap)
    }

    window.localStorage.setItem(PERIOD_ATTENDANCE_STORAGE_KEY, JSON.stringify(map))
    window.dispatchEvent(new CustomEvent('ics-period-attendance-updated'))
    window.dispatchEvent(new CustomEvent('ics-attendance-updated'))

    let notif: CampusNotification | undefined
    if (changedSub) {
      const actorDisplay = changedSub.lastEditedByName || changedSub.submittedByName
      const statusText =
        changedSub.sessionStatus === 'not-held'
          ? `Marked Not Held (${changedSub.notHeldReason || 'Usthad Leave'})`
          : changedSub.sessionStatus === 'substituted'
            ? `Substitute Assigned: ${changedSub.substituteUsthad?.usthadName || 'Usthad'}`
            : isUpdate
              ? `Attendance Corrected by ${actorDisplay}${changedSub.lastEditedByRole ? ` (${changedSub.lastEditedByRole})` : ''}`
              : `Attendance Marked by ${changedSub.submittedByName}`

      notif = createAndStoreCampusNotification({
        type: 'period-attendance',
        title: `${changedSub.periodLabel} • ${changedSub.className}`,
        message: `${changedSub.subject}: ${statusText} (${changedSub.date})`,
        targetClass: changedSub.className,
        actorName: actorDisplay,
        href: '#attendance',
      })
    }

    pushCampusSyncToServer({
      periodSubmissions: map,
      ...(notif ? { notification: notif } : {}),
    })
  } catch {
    // Ignore storage errors
  }
}

export function deletePeriodAttendanceSubmission(
  key: string,
  actorInfo?: { name: string; role: string },
): Record<string, PeriodAttendanceSubmission> {
  if (typeof window === 'undefined') return {}
  ensureCleanLaunchStorage()
  try {
    const currentMap = loadPeriodAttendanceSubmissions()
    const targetSub = currentMap[key]
    const nextMap = { ...currentMap }
    delete nextMap[key]

    const deletedAtMs = Date.now()
    const deletedMap = loadDeletedPeriodKeys()
    deletedMap[key] = deletedAtMs
    saveDeletedPeriodKeys(deletedMap)

    window.localStorage.setItem(PERIOD_ATTENDANCE_STORAGE_KEY, JSON.stringify(nextMap))
    window.dispatchEvent(new CustomEvent('ics-period-attendance-updated'))
    window.dispatchEvent(new CustomEvent('ics-attendance-updated'))

    let notif: CampusNotification | undefined
    if (targetSub) {
      const actorText = actorInfo
        ? `${actorInfo.name} (${actorInfo.role})`
        : targetSub.submittedByName
      notif = createAndStoreCampusNotification({
        type: 'period-attendance',
        title: `${targetSub.periodLabel} Reset • ${targetSub.className}`,
        message: `${targetSub.subject} (${targetSub.date}) attendance submission was cleared by ${actorText}.`,
        targetClass: targetSub.className,
        actorName: actorInfo?.name || targetSub.submittedByName,
        href: '#attendance',
      })
    }

    pushCampusSyncToServer({
      deletedPeriodKey: key,
      deletedAtMs,
      ...(notif ? { notification: notif } : {}),
    })
    return nextMap
  } catch {
    return loadPeriodAttendanceSubmissions()
  }
}

export type CampusNotificationType =
  | 'notice'
  | 'attendance'
  | 'period-attendance'
  | 'leave'
  | 'chat'

export type CampusNotification = {
  id: string
  type: CampusNotificationType
  title: string
  message: string
  category?: string
  targetClass?: string
  targetClasses?: string[]
  targetStudentId?: string
  targetRecipientId?: string
  targetStaffOnly?: boolean
  actorId?: string
  actorName?: string
  actorAvatarUrl?: string
  href?: string
  createdAt: string
  createdAtMs: number
}

export const DEVICE_BOUND_IDENTITY_STORAGE_KEY = 'ics_device_bound_identity_v1'

export type DeviceBoundIdentity = {
  role: 'student' | 'class-leader' | 'usthad' | 'principal'
  actorId: string
  actorName: string
  className: string
  assignedClasses: string[]
  isStaff: boolean
  isPrincipal: boolean
  boundAtMs: number
}

export function bindDeviceNotificationIdentity(
  identity: Omit<DeviceBoundIdentity, 'boundAtMs'>,
  options?: { forceOverwritePrimaryOwner?: boolean },
): void {
  if (typeof window === 'undefined' || !identity.actorId) return
  try {
    const canonicalActorId = identity.actorId.startsWith('usthad-')
      ? getCanonicalUsthadId(identity.actorId)
      : identity.actorId
    const normalizedIdentity = {
      ...identity,
      actorId: canonicalActorId,
    }
    const existing = loadDeviceBoundIdentity()
    // If this phone already has a Primary Owner and a different person (e.g. a friend) logs in,
    // DO NOT overwrite the phone's Primary Owner unless forceOverwritePrimaryOwner is explicitly true!
    if (
      existing &&
      existing.actorId &&
      getCanonicalUsthadId(existing.actorId) !== canonicalActorId &&
      !options?.forceOverwritePrimaryOwner
    ) {
      return
    }
    const payload: DeviceBoundIdentity = {
      ...normalizedIdentity,
      boundAtMs: Date.now(),
    }
    window.localStorage.setItem(DEVICE_BOUND_IDENTITY_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore storage errors
  }
}

export function getPrimaryDeviceOwnerIdentity(): DeviceBoundIdentity | null {
  return loadDeviceBoundIdentity()
}

function loadDeviceBoundIdentity(): DeviceBoundIdentity | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(DEVICE_BOUND_IDENTITY_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DeviceBoundIdentity
    if (parsed && typeof parsed === 'object' && parsed.actorId) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function getCurrentSessionIdentity(): {
  isAuthenticated: boolean
  hasDeviceIdentity: boolean
  role: 'student' | 'class-leader' | 'usthad' | 'principal'
  actorId: string
  actorName: string
  className: string
  assignedClasses: string[]
  isStaff: boolean
  isPrincipal: boolean
} {
  if (typeof window === 'undefined') {
    return {
      isAuthenticated: false,
      hasDeviceIdentity: false,
      role: 'student',
      actorId: '',
      actorName: '',
      className: '',
      assignedClasses: [],
      isStaff: false,
      isPrincipal: false,
    }
  }
  try {
    const isAuthenticated = window.localStorage.getItem('isAuthenticated') === 'true'
    if (!isAuthenticated) {
      // Fall back to the remembered Primary Phone Owner Identity on this phone so notifications
      // strictly targeted to the phone owner's ID/class continue to arrive even while logged out!
      const bound = loadDeviceBoundIdentity()
      if (bound) {
        return {
          isAuthenticated: false,
          hasDeviceIdentity: true,
          role: bound.role,
          actorId: bound.actorId.startsWith('usthad-')
            ? getCanonicalUsthadId(bound.actorId)
            : bound.actorId,
          actorName: bound.actorName,
          className: bound.className,
          assignedClasses: Array.isArray(bound.assignedClasses) ? bound.assignedClasses : [],
          isStaff: Boolean(bound.isStaff),
          isPrincipal: Boolean(bound.isPrincipal),
        }
      }
      return {
        isAuthenticated: false,
        hasDeviceIdentity: false,
        role: 'student',
        actorId: '',
        actorName: '',
        className: '',
        assignedClasses: [],
        isStaff: false,
        isPrincipal: false,
      }
    }

    const rawRole = window.localStorage.getItem('authRole') || 'student'
    if (rawRole === 'principal') {
      const identity = {
        role: 'principal' as const,
        actorId: getCanonicalUsthadId(ACADEMY_PRINCIPAL.usthadId || 'usthad-07'),
        actorName: ACADEMY_PRINCIPAL.name,
        className: ACADEMY_PRINCIPAL.assignedClassName || 'BS 3',
        assignedClasses: ACADEMY_PRINCIPAL.assignedClasses || ['BS 3', 'BS 1'],
        isStaff: true,
        isPrincipal: true,
      }
      bindDeviceNotificationIdentity(identity)
      return {
        isAuthenticated: true,
        hasDeviceIdentity: true,
        ...identity,
      }
    }
    if (rawRole === 'usthad') {
      const savedUsthadId = window.localStorage.getItem('loggedInUsthadId') || ''
      const canonicalSavedId = getCanonicalUsthadId(savedUsthadId)
      const staffId = window.localStorage.getItem('usthadStaffId') || ''
      const usthad =
        OFFICIAL_CLASS_USTHADS.find((u) => u.id === canonicalSavedId) ??
        OFFICIAL_CLASS_USTHADS.find((u) => u.id === savedUsthadId) ??
        CLASS_USTHADS.find((u) => u.id === savedUsthadId) ??
        findUsthadByStaffId(staffId)
      const canonicalActorId = getCanonicalUsthadId(usthad?.id)
      const isPrin = canonicalActorId === getCanonicalUsthadId(ACADEMY_PRINCIPAL.usthadId)
      const identity = {
        role: 'usthad' as const,
        actorId: canonicalActorId,
        actorName: usthad?.name || '',
        className: usthad?.className || '',
        assignedClasses: isPrin
          ? ACADEMY_PRINCIPAL.assignedClasses || ['BS 3', 'BS 1']
          : usthad?.teachingBatches && usthad.teachingBatches.length > 0
            ? [...usthad.teachingBatches]
            : usthad?.className
              ? [usthad.className]
              : [],
        isStaff: true,
        isPrincipal: isPrin,
      }
      if (identity.actorId) bindDeviceNotificationIdentity(identity)
      return {
        isAuthenticated: true,
        hasDeviceIdentity: Boolean(identity.actorId),
        ...identity,
      }
    }
    if (rawRole === 'class-leader') {
      const leaderId =
        window.localStorage.getItem('loggedInLeaderId') ||
        window.localStorage.getItem('classLeaderId') ||
        ''
      const savedStudentId = window.localStorage.getItem('loggedInStudentId') || ''
      const leaderMatch =
        findClassLeaderByIdentifier(leaderId) ??
        (savedStudentId
          ? (() => {
              const st = students.find((s) => s.id === savedStudentId)
              return st ? { student: st, leaderId: 'CL', roleTitle: 'Main Class Leader' as const } : undefined
            })()
          : undefined)
      const identity = {
        role: 'class-leader' as const,
        actorId: leaderMatch?.student.id || '',
        actorName: leaderMatch?.student.name || '',
        className: leaderMatch?.student.className || '',
        assignedClasses: leaderMatch?.student.className ? [leaderMatch.student.className] : [],
        isStaff: false,
        isPrincipal: false,
      }
      if (identity.actorId) bindDeviceNotificationIdentity(identity)
      return {
        isAuthenticated: true,
        hasDeviceIdentity: Boolean(identity.actorId),
        ...identity,
      }
    }
    const loggedInStudentId = window.localStorage.getItem('loggedInStudentId') || ''
    const st = students.find((s) => s.id === loggedInStudentId)
    const identity = {
      role: 'student' as const,
      actorId: st?.id || '',
      actorName: st?.name || '',
      className: st?.className || '',
      assignedClasses: st?.className ? [st.className] : [],
      isStaff: false,
      isPrincipal: false,
    }
    if (identity.actorId) bindDeviceNotificationIdentity(identity)
    return {
      isAuthenticated: Boolean(st),
      hasDeviceIdentity: Boolean(st),
      ...identity,
    }
  } catch {
    return {
      isAuthenticated: false,
      hasDeviceIdentity: false,
      role: 'student',
      actorId: '',
      actorName: '',
      className: '',
      assignedClasses: [],
      isStaff: false,
      isPrincipal: false,
    }
  }
}

/**
 * Determines whether a notification should be shown to the current user/device session.
 * Strict Rules:
 * 0. Device Identity Gate: If the phone has neither an active login nor a remembered device ID (`!session.hasDeviceIdentity`), NO notification is shown.
 * 1. Self-Exclusion: The sender (`notif.actorId` or `notif.actorName`) NEVER receives their own notification.
 * 2. Direct Recipient (`notif.targetRecipientId`): Strictly shown ONLY to the user whose `actorId === notif.targetRecipientId`.
 * 3. Staff Room (`notif.targetStaffOnly`): Strictly shown ONLY to Usthads and Principal (excluding sender).
 * 4. Group Chat (`notif.type === 'chat'` with `targetClass`): Strictly shown ONLY to students of that class and the assigned Class Usthad (excluding sender).
 * 5. Personal Student Records (`attendance` / `leave` / `targetStudentId`): Strictly shown ONLY to that student or their Class Usthad / Principal (excluding sender).
 * 6. Class Notices (`targetClass` / `targetClasses`): Shown ONLY to members of those target classes (and Principal for official notices, excluding sender).
 */
export function isNotificationVisibleForStudent(
  notif: CampusNotification,
  studentId?: string,
  classNameFilter?: string,
): boolean {
  const session = getCurrentSessionIdentity()
  if (!session.hasDeviceIdentity && !studentId) {
    return false
  }
  const myActorId = studentId || session.actorId
  const myActorName = session.actorName
  const normFilter = normalizeClassName(classNameFilter || session.className)
  const normAssignedClasses = session.assignedClasses.map((c) => normalizeClassName(c))
  const normTargetClass = normalizeClassName(notif.targetClass)
  const normTargetClasses = (notif.targetClasses ?? []).map((c) => normalizeClassName(c))

  // 1. Self-Exclusion: Never notify the person who sent/created this notification
  if (notif.actorId && myActorId && notif.actorId === myActorId) {
    return false
  }
  if (
    !notif.actorId &&
    notif.actorName &&
    myActorName &&
    notif.actorName.trim().toLowerCase() === myActorName.trim().toLowerCase()
  ) {
    return false
  }

  // 2. Direct 1-on-1 Chat or Specific Recipient Targeting
  if (notif.targetRecipientId) {
    return Boolean(myActorId && notif.targetRecipientId === myActorId)
  }

  // 3. Staff Room Group Targeting (Usthads & Principal only)
  if (notif.targetStaffOnly) {
    if (studentId || !session.isStaff) return false
    return true
  }

  // 4. Batch Group Chat Targeting (Strictly members of that class + assigned Class Usthad)
  if (notif.type === 'chat') {
    if (normTargetClass && normTargetClass !== 'ALL') {
      if (studentId || !session.isStaff) {
        return normFilter === normTargetClass
      }
      return (
        normFilter === normTargetClass ||
        normAssignedClasses.includes(normTargetClass)
      )
    }
    return false
  }

  // 5. Student / Class Leader session rules
  if (studentId || !session.isStaff) {
    const effectiveStudentId = studentId || session.actorId
    if (notif.targetStudentId && notif.targetStudentId !== effectiveStudentId) {
      return false
    }
    if (notif.type === 'attendance' || notif.type === 'leave') {
      return Boolean(effectiveStudentId && notif.targetStudentId === effectiveStudentId)
    }
    if (
      normTargetClasses.length > 0 &&
      !normTargetClasses.includes('ALL')
    ) {
      if (normFilter && !normTargetClasses.includes(normFilter)) {
        return false
      }
    }
    if (normTargetClass && normTargetClass !== 'ALL') {
      if (normFilter && normTargetClass !== normFilter) {
        return false
      }
    }
    return true
  }

  // 6. Staff (Usthad / Principal) session rules for Notices, Attendance & Leave
  if (!session.isPrincipal) {
    if (
      normTargetClasses.length > 0 &&
      !normTargetClasses.includes('ALL')
    ) {
      const matchesAny =
        (normFilter && normTargetClasses.includes(normFilter)) ||
        normAssignedClasses.some((c) => normTargetClasses.includes(c))
      if (!matchesAny) return false
    }
    if (normTargetClass && normTargetClass !== 'ALL') {
      const matchesSingle =
        normFilter === normTargetClass ||
        normAssignedClasses.includes(normTargetClass)
      if (!matchesSingle) return false
    }
  }

  return true
}

function isNotificationRelevantForCurrentBrowserSession(notif: CampusNotification): boolean {
  if (typeof window === 'undefined') return false
  const session = getCurrentSessionIdentity()
  if (session.role === 'student' || session.role === 'class-leader') {
    return isNotificationVisibleForStudent(notif, session.actorId, session.className)
  }
  return isNotificationVisibleForStudent(notif, undefined, session.className)
}

export const CAMPUS_NOTIFICATIONS_STORAGE_KEY = 'ics_campus_notifications_v2'

const CLOUD_SYNC_ENDPOINTS = [
  '/api/campus',
  'https://ais-pre-rhfqjrwneaewkmnanoof2j-896319436298.asia-east1.run.app/api/campus',
  'https://ais-dev-rhfqjrwneaewkmnanoof2j-896319436298.asia-east1.run.app/api/campus',
]

function getOrderedSyncBases(): string[] {
  if (typeof window === 'undefined') return ['/api/campus']
  const isCapacitorOrLocal =
    Boolean((window as unknown as { ICSNativeBridge?: unknown }).ICSNativeBridge) ||
    window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && /Android/i.test(navigator.userAgent))

  if (isCapacitorOrLocal) {
    return [
      'https://ais-pre-rhfqjrwneaewkmnanoof2j-896319436298.asia-east1.run.app/api/campus',
      'https://ais-dev-rhfqjrwneaewkmnanoof2j-896319436298.asia-east1.run.app/api/campus',
      '/api/campus',
    ]
  }
  return CLOUD_SYNC_ENDPOINTS
}

export function loadCampusNotifications(): CampusNotification[] {
  if (typeof window === 'undefined') return []
  ensureCleanLaunchStorage()
  try {
    const raw = window.localStorage.getItem(CAMPUS_NOTIFICATIONS_STORAGE_KEY)
    if (!raw) return getInitialSeedNotifications()
    const parsed = JSON.parse(raw) as CampusNotification[]
    return Array.isArray(parsed)
      ? parsed
      : getInitialSeedNotifications()
  } catch {
    return getInitialSeedNotifications()
  }
}

function getInitialSeedNotifications(): CampusNotification[] {
  return []
}

export function createAndStoreCampusNotification(input: {
  id?: string
  type: CampusNotificationType
  title: string
  message: string
  category?: string
  targetClass?: string
  targetClasses?: string[]
  targetStudentId?: string
  targetRecipientId?: string
  targetStaffOnly?: boolean
  actorId?: string
  actorName?: string
  actorAvatarUrl?: string
  href?: string
}): CampusNotification {
  const now = new Date()
  const session = getCurrentSessionIdentity()
  const rawAvatar = typeof input.actorAvatarUrl === 'string' ? input.actorAvatarUrl.trim() : ''
  const safeShortAvatar =
    rawAvatar &&
    rawAvatar.length <= 240 &&
    (rawAvatar.startsWith('/images/') ||
      rawAvatar.startsWith('/icons/') ||
      rawAvatar.startsWith('https://'))
      ? rawAvatar
      : undefined
  const notif: CampusNotification = {
    id: input.id || `notif_${now.getTime()}_${Math.random().toString(36).slice(2, 7)}`,
    type: input.type,
    title: input.title,
    message: input.message,
    category: input.category,
    targetClass: input.targetClass,
    targetClasses: input.targetClasses,
    targetStudentId: input.targetStudentId,
    targetRecipientId: input.targetRecipientId,
    targetStaffOnly: input.targetStaffOnly,
    actorId: input.actorId || session.actorId || undefined,
    actorName: input.actorName || session.actorName || undefined,
    actorAvatarUrl: safeShortAvatar,
    href: input.href || '#notices',
    createdAt: now.toISOString(),
    createdAtMs: now.getTime(),
  }

  if (typeof window !== 'undefined') {
    try {
      const existing = loadCampusNotifications()
      if (!existing.some((n) => n.id === notif.id)) {
        const updated = [notif, ...existing].slice(0, 60)
        window.localStorage.setItem(
          CAMPUS_NOTIFICATIONS_STORAGE_KEY,
          JSON.stringify(updated),
        )
      }
      // Note: Do NOT trigger a pop-up/sound notification on the sender's own browser when creating it.
    } catch {
      // Ignore storage errors
    }
  }

  return notif
}

export function publishCampusNotification(input: {
  id?: string
  type: CampusNotificationType
  title: string
  message: string
  category?: string
  targetClass?: string
  targetClasses?: string[]
  targetStudentId?: string
  targetRecipientId?: string
  targetStaffOnly?: boolean
  actorId?: string
  actorName?: string
  actorAvatarUrl?: string
  href?: string
}): CampusNotification {
  const notif = createAndStoreCampusNotification(input)
  void pushCampusSyncToServer({ notification: notif })
  return notif
}

export type CustomStudentEntry = {
  id: string
  name: string
  admissionNo: string
  className: string
  batch: string
  avatarUrl?: string
}

export type UsthadProfileOverride = {
  id: string
  staffId: string
  name: string
  shortName: string
  designation: string
  institutionalRole?: 'Principal' | 'Swadr' | 'Class Usthad'
  isPrincipalRole?: boolean
  specialization: string
  avatarUrl?: string
  className: string
  batch: string
  batchCode: string
}

export type AcademyAdminConfig = {
  updatedAtMs: number
  activeSemester?: 1 | 2
  addedStudents?: CustomStudentEntry[]
  editedStudents?: Record<
    string,
    {
      name?: string
      admissionNo?: string
      className?: string
      batch?: string
      avatarUrl?: string
    }
  >
  removedStudentIds?: string[]
  addedUsthads?: UsthadProfileOverride[]
  editedUsthads?: Record<
    string,
    {
      name?: string
      staffId?: string
      designation?: string
      specialization?: string
      avatarUrl?: string
    }
  >
  /** Maps className (e.g. 'BS 3', '8th') -> Usthad staffId (e.g. 'UST-07') */
  classUsthadAssignments?: Record<string, string>
  /** Maps `${className}__Main Class Leader` or `${className}__Assistant Class Leader` -> studentId */
  classLeaderAssignments?: Record<string, string>
  /** Maps className -> ClassSemesterTimetable */
  timetableOverrides?: Record<string, ClassSemesterTimetable>
  bsTimetableVersion?: number
  semesterSyncVersion?: number
}

export const ACADEMY_ADMIN_CONFIG_STORAGE_KEY = 'ics_academy_admin_config_v1'

const BASE_STUDENTS_SNAPSHOT: Student[] = students.map((s) => ({
  ...s,
  attendance: { ...s.attendance },
  monthlyAttendance: s.monthlyAttendance.map((m) => ({ ...m })),
}))

const BASE_OFFICIAL_USTHADS_SNAPSHOT: ClassUsthad[] = OFFICIAL_CLASS_USTHADS.map((u) => ({
  ...u,
  teachingBatches: u.teachingBatches ? [...u.teachingBatches] : undefined,
}))

const BASE_CLASS_USTHADS_SNAPSHOT: ClassUsthad[] = CLASS_USTHADS.map((u) => ({
  ...u,
  teachingBatches: u.teachingBatches ? [...u.teachingBatches] : undefined,
}))

const BASE_CLASS_LEADERS_SNAPSHOT: ClassLeaderInfo[] = CLASS_LEADERS.map((l) => ({
  ...l,
}))

const BASE_TIMETABLES_SNAPSHOT: Record<string, ClassSemesterTimetable> = JSON.parse(
  JSON.stringify(CLASS_SEMESTER_SCHEDULES),
) as Record<string, ClassSemesterTimetable>

const CLASS_BATCH_META_BY_NAME: Record<string, { batch: string; batchCode: string }> = {
  '8th': { batch: 'Batch 14', batchCode: '14' },
  '9th': { batch: 'Batch 13', batchCode: '13' },
  '10th': { batch: 'Batch 12', batchCode: '12' },
  'HS 1': { batch: 'Batch 11', batchCode: '11' },
  'HS 2A': { batch: 'Batch 10', batchCode: '10' },
  'HS 2B': { batch: 'Batch 10', batchCode: '10' },
  'BS 1': { batch: 'Batch 09', batchCode: '09' },
  'BS 2': { batch: 'Batch 08', batchCode: '08' },
  'BS 3': { batch: 'Batch 07', batchCode: '07' },
  'BS 4': { batch: 'Batch 06', batchCode: '06' },
  'BS 5': { batch: 'Batch 05', batchCode: '05' },
}

export function getBatchLabelForClass(className: string): string {
  const norm = normalizeClassName(className)
  return CLASS_BATCH_META_BY_NAME[norm]?.batch ?? 'Batch 07'
}

export function getBatchCodeForClass(className: string): string {
  const norm = normalizeClassName(className)
  return CLASS_BATCH_META_BY_NAME[norm]?.batchCode ?? '07'
}

export function getNextSuggestedAdmissionNo(className: string): string {
  const norm = normalizeClassName(className)
  const classStudents = students.filter((s) => normalizeClassName(s.className) === norm)
  const batchCode = getBatchCodeForClass(norm)
  if (classStudents.length === 0) {
    return `ICS2K26${batchCode}01`
  }
  const lastStudent = classStudents[classStudents.length - 1]
  const match = lastStudent.admissionNo.match(/^(ICS2K\d{2}\d{2})(\d{2,3})$/i)
  if (match) {
    const prefix = match[1].toUpperCase()
    const nextRoll = String(Number(match[2]) + 1).padStart(2, '0')
    return `${prefix}${nextRoll}`
  }
  const nextRoll = String(classStudents.length + 1).padStart(2, '0')
  return `ICS2K26${batchCode}${nextRoll}`
}

export function getDefaultClassTimetable(className: string): ClassSemesterTimetable {
  const norm = normalizeClassName(className)
  const snap = BASE_TIMETABLES_SNAPSHOT[norm] ?? BASE_TIMETABLES_SNAPSHOT['BS 3']
  return JSON.parse(JSON.stringify(snap)) as ClassSemesterTimetable
}

export function loadAcademyAdminConfig(): AcademyAdminConfig {
  if (typeof window === 'undefined') return { updatedAtMs: 0 }
  try {
    const raw = window.localStorage.getItem(ACADEMY_ADMIN_CONFIG_STORAGE_KEY)
    if (!raw) return { updatedAtMs: 0 }
    const parsed = JSON.parse(raw) as AcademyAdminConfig
    return parsed && typeof parsed === 'object' ? parsed : { updatedAtMs: 0 }
  } catch {
    return { updatedAtMs: 0 }
  }
}

const SYNCED_PROFILE_PHOTOS: Record<string, string> = {}

export function getCanonicalProfilePhotoActorId(actorId: string): string {
  const clean = (actorId || '').trim()
  if (!clean) return ''
  if (clean === ACADEMY_PRINCIPAL.id || clean === ACADEMY_PRINCIPAL.usthadId) {
    return ACADEMY_PRINCIPAL.usthadId
  }
  const baseUsthadMatch = clean.match(/^(usthad-\d{2})(?:-.+)?$/i)
  if (baseUsthadMatch) {
    return baseUsthadMatch[1].toLowerCase()
  }
  return clean
}

export function getSyncedProfilePhoto(actorId: string): string | undefined {
  const canonical = getCanonicalProfilePhotoActorId(actorId)
  if (!canonical) return undefined
  return SYNCED_PROFILE_PHOTOS[canonical] || SYNCED_PROFILE_PHOTOS[actorId]
}

export function applySyncedProfilePhotos(photoMap: Record<string, string>): void {
  for (const key of Object.keys(SYNCED_PROFILE_PHOTOS)) {
    delete SYNCED_PROFILE_PHOTOS[key]
  }
  for (const [rawId, rawUrl] of Object.entries(photoMap)) {
    const canonical = getCanonicalProfilePhotoActorId(rawId)
    const cleanUrl = typeof rawUrl === 'string' ? rawUrl.trim() : ''
    if (canonical && cleanUrl) {
      SYNCED_PROFILE_PHOTOS[canonical] = cleanUrl
    }
  }

  for (const st of students) {
    const synced = SYNCED_PROFILE_PHOTOS[st.id]
    if (synced) {
      st.avatarUrl = synced
    }
  }

  for (const u of OFFICIAL_CLASS_USTHADS) {
    const synced = SYNCED_PROFILE_PHOTOS[getCanonicalProfilePhotoActorId(u.id)]
    if (synced) {
      u.avatarUrl = synced
    }
  }

  for (const cu of CLASS_USTHADS) {
    const synced = SYNCED_PROFILE_PHOTOS[getCanonicalProfilePhotoActorId(cu.id)]
    if (synced) {
      cu.avatarUrl = synced
    }
  }

  const principalPhoto =
    SYNCED_PROFILE_PHOTOS[ACADEMY_PRINCIPAL.usthadId] ||
    SYNCED_PROFILE_PHOTOS[ACADEMY_PRINCIPAL.id]
  if (principalPhoto) {
    ACADEMY_PRINCIPAL.avatarUrl = principalPhoto
  }
}

export function applyAcademyAdminConfig(config: AcademyAdminConfig): void {
  // 1. Active Semester (Semester 2 is current default; migrate legacy configs automatically)
  const hasModernSemesterSync = (config.semesterSyncVersion ?? 0) >= 2
  CURRENT_SEMESTER =
    config.activeSemester === 1 && hasModernSemesterSync ? 1 : 2

  // 2. Rebuild Students array in-place
  const removedSet = new Set(config.removedStudentIds ?? [])
  const editedMap = config.editedStudents ?? {}
  const nextStudents: Student[] = []

  for (const baseSt of BASE_STUDENTS_SNAPSHOT) {
    if (removedSet.has(baseSt.id)) continue
    const edit = editedMap[baseSt.id]
    const updatedClassName = edit?.className ? normalizeClassName(edit.className) : baseSt.className
    const updatedAdmissionNo = edit?.admissionNo?.trim() || baseSt.admissionNo
    const updatedName = edit?.name?.trim() || baseSt.name
    nextStudents.push({
      ...baseSt,
      name: updatedName,
      firstName: updatedName,
      admissionNo: updatedAdmissionNo,
      className: updatedClassName,
      batch: edit?.batch?.trim() || getBatchLabelForClass(updatedClassName),
      avatarUrl:
        SYNCED_PROFILE_PHOTOS[baseSt.id] ||
        edit?.avatarUrl ||
        STUDENT_AVATAR_BY_ADMISSION_NO[updatedAdmissionNo] ||
        baseSt.avatarUrl,
      attendance: { ...baseSt.attendance },
      monthlyAttendance: baseSt.monthlyAttendance.map((m) => ({ ...m })),
    })
  }

  let customCounter = BASE_STUDENTS_SNAPSHOT.length + 1
  for (const added of config.addedStudents ?? []) {
    if (!added || !added.id || removedSet.has(added.id)) continue
    const edit = editedMap[added.id]
    const finalClassName = normalizeClassName(edit?.className || added.className || '8th')
    const finalName = (edit?.name || added.name || 'Student').trim()
    const finalAdmissionNo = (edit?.admissionNo || added.admissionNo || `ICS2K261499`).trim()
    const { monthlyAttendance, attendance } = buildStudentMonthlyAttendance(customCounter++)
    nextStudents.push({
      id: added.id,
      name: finalName,
      firstName: finalName,
      className: finalClassName,
      batch: edit?.batch || added.batch || getBatchLabelForClass(finalClassName),
      admissionNo: finalAdmissionNo,
      avatarUrl:
        SYNCED_PROFILE_PHOTOS[added.id] ||
        edit?.avatarUrl ||
        added.avatarUrl ||
        STUDENT_AVATAR_BY_ADMISSION_NO[finalAdmissionNo],
      attendance,
      monthlyAttendance,
    })
  }

  students.splice(0, students.length, ...nextStudents)

  // 3. Rebuild OFFICIAL_CLASS_USTHADS and CLASS_USTHADS in-place
  const usthadEdits = config.editedUsthads ?? {}
  const basePlusAddedUsthads: ClassUsthad[] = [
    ...BASE_OFFICIAL_USTHADS_SNAPSHOT.map((u) => {
      const uEdit = usthadEdits[u.id]
      const updatedName = uEdit?.name?.trim() || u.name
      const canonicalUsthadId = getCanonicalProfilePhotoActorId(u.id)
      return {
        ...u,
        name: updatedName,
        shortName: updatedName,
        staffId: uEdit?.staffId?.trim() || u.staffId,
        designation: uEdit?.designation?.trim() || u.designation,
        specialization: uEdit?.specialization?.trim() || u.specialization,
        avatarUrl:
          SYNCED_PROFILE_PHOTOS[canonicalUsthadId] ||
          uEdit?.avatarUrl ||
          u.avatarUrl,
        teachingBatches: u.teachingBatches ? [...u.teachingBatches] : [u.className],
      }
    }),
    ...(config.addedUsthads ?? []).map((u) => {
      const uEdit = usthadEdits[u.id]
      const updatedName = (uEdit?.name || u.name).trim()
      const canonicalUsthadId = getCanonicalProfilePhotoActorId(u.id)
      return {
        ...u,
        name: updatedName,
        shortName: updatedName,
        staffId: (uEdit?.staffId || u.staffId).trim(),
        designation: (uEdit?.designation || u.designation || 'Class Usthad').trim(),
        specialization: (uEdit?.specialization || u.specialization || 'Islamic & Academic Studies').trim(),
        avatarUrl:
          SYNCED_PROFILE_PHOTOS[canonicalUsthadId] ||
          uEdit?.avatarUrl ||
          u.avatarUrl,
        fullClassLabel: `Class ${u.className}`,
        teachingBatches: [u.className],
      }
    }),
  ]

  const principalSyncedAvatar =
    SYNCED_PROFILE_PHOTOS[ACADEMY_PRINCIPAL.usthadId] ||
    SYNCED_PROFILE_PHOTOS[ACADEMY_PRINCIPAL.id] ||
    usthadEdits[ACADEMY_PRINCIPAL.usthadId]?.avatarUrl
  if (principalSyncedAvatar) {
    ACADEMY_PRINCIPAL.avatarUrl = principalSyncedAvatar
  }

  const classAssignments = config.classUsthadAssignments ?? {}
  const nextClassUsthads: ClassUsthad[] = BASE_CLASS_USTHADS_SNAPSHOT.map((baseSlot) => {
    const clsName = baseSlot.className
    const assignedKey = classAssignments[clsName]

    if (assignedKey === '__UNASSIGNED__') {
      return {
        ...baseSlot,
        id: `unassigned-${clsName.toLowerCase().replace(/\s+/g, '')}`,
        staffId: '',
        name: 'Unassigned',
        shortName: 'Unassigned',
        designation: 'Unassigned',
        teachingBatches: [],
        className: clsName,
        fullClassLabel: `Class ${clsName}`,
        batch: getBatchLabelForClass(clsName),
        batchCode: getBatchCodeForClass(clsName),
      }
    }

    const matchedUsthad = assignedKey
      ? basePlusAddedUsthads.find(
          (u) =>
            u.id === assignedKey ||
            normalizeAdmissionKey(u.staffId) === normalizeAdmissionKey(assignedKey),
        )
      : basePlusAddedUsthads.find(
          (u) =>
            u.id === baseSlot.id ||
            normalizeAdmissionKey(u.staffId) === normalizeAdmissionKey(baseSlot.staffId) ||
            u.name === baseSlot.name,
        )

    if (!matchedUsthad) {
      return { ...baseSlot }
    }

    return {
      ...matchedUsthad,
      id:
        clsName === matchedUsthad.className
          ? matchedUsthad.id
          : `${matchedUsthad.id}-${clsName.toLowerCase().replace(/\s+/g, '')}`,
      className: clsName,
      fullClassLabel: `Class ${clsName}`,
      batch: getBatchLabelForClass(clsName),
      batchCode: getBatchCodeForClass(clsName),
    }
  })

  // Update teachingBatches on each official usthad strictly from their assigned classes
  for (const offUsthad of basePlusAddedUsthads) {
    const offStaffKey = normalizeAdmissionKey(offUsthad.staffId)
    const assignedClassesForUsthad = nextClassUsthads
      .filter(
        (cu) =>
          Boolean(cu.staffId) &&
          !cu.id.startsWith('unassigned-') &&
          normalizeAdmissionKey(cu.staffId) === offStaffKey,
      )
      .map((cu) => cu.className)

    offUsthad.teachingBatches = assignedClassesForUsthad
    if (assignedClassesForUsthad.length > 0) {
      offUsthad.className = assignedClassesForUsthad[0]
      offUsthad.fullClassLabel = `Class ${assignedClassesForUsthad.join(' & ')}`
      offUsthad.batch = getBatchLabelForClass(assignedClassesForUsthad[0])
      offUsthad.batchCode = getBatchCodeForClass(assignedClassesForUsthad[0])
    } else {
      offUsthad.fullClassLabel = 'Teaching Usthad'
    }
  }

  for (const cu of nextClassUsthads) {
    if (!cu.staffId || cu.id.startsWith('unassigned-')) continue
    const matchingOff = basePlusAddedUsthads.find(
      (u) => normalizeAdmissionKey(u.staffId) === normalizeAdmissionKey(cu.staffId),
    )
    if (matchingOff?.teachingBatches) {
      cu.teachingBatches = [...matchingOff.teachingBatches]
    }
  }

  OFFICIAL_CLASS_USTHADS.splice(0, OFFICIAL_CLASS_USTHADS.length, ...basePlusAddedUsthads)
  CLASS_USTHADS.splice(0, CLASS_USTHADS.length, ...nextClassUsthads)

  // 4. Rebuild CLASS_LEADERS in-place
  const leaderOverrides = config.classLeaderAssignments ?? {}
  const nextLeaders: ClassLeaderInfo[] = BASE_CLASS_LEADERS_SNAPSHOT.map((baseLeader) => {
    const overrideKey = `${baseLeader.className}__${baseLeader.roleTitle}`
    const overrideStudentId = leaderOverrides[overrideKey]
    const classRoster = students.filter(
      (s) => normalizeClassName(s.className) === normalizeClassName(baseLeader.className),
    )
    const targetStudent =
      (overrideStudentId
        ? classRoster.find((s) => s.id === overrideStudentId) ??
          students.find((s) => s.id === overrideStudentId)
        : undefined) ??
      classRoster.find((s) => s.id === baseLeader.studentId) ??
      classRoster.find((s) => s.admissionNo === baseLeader.admissionNo) ??
      (baseLeader.roleTitle === 'Main Class Leader'
        ? classRoster[0]
        : classRoster[1] ?? classRoster[0])

    if (!targetStudent) return { ...baseLeader }

    return {
      ...baseLeader,
      studentId: targetStudent.id,
      admissionNo: targetStudent.admissionNo,
      studentName: targetStudent.name,
    }
  })

  CLASS_LEADERS.splice(0, CLASS_LEADERS.length, ...nextLeaders)

  // 5. Rebuild CLASS_SEMESTER_SCHEDULES in-place
  const ttOverrides = config.timetableOverrides ?? {}
  const isLegacyBsVersion = (config.bsTimetableVersion ?? 0) < 2
  const bsDegreeClasses = new Set(['BS 1', 'BS 2', 'BS 3', 'BS 4', 'BS 5'])
  for (const clsName of Object.keys(BASE_TIMETABLES_SNAPSHOT)) {
    const customTt =
      isLegacyBsVersion && bsDegreeClasses.has(clsName) ? undefined : ttOverrides[clsName]
    if (
      customTt &&
      Array.isArray(customTt.periods) &&
      Array.isArray(customTt.semester1) &&
      Array.isArray(customTt.semester2)
    ) {
      CLASS_SEMESTER_SCHEDULES[clsName] = JSON.parse(
        JSON.stringify(customTt),
      ) as ClassSemesterTimetable
    } else {
      CLASS_SEMESTER_SCHEDULES[clsName] = JSON.parse(
        JSON.stringify(BASE_TIMETABLES_SNAPSHOT[clsName]),
      ) as ClassSemesterTimetable
    }
  }
}

export function saveAcademyAdminConfig(
  nextConfig: AcademyAdminConfig,
  notificationInput?: {
    title: string
    message: string
    targetClass?: string
  },
): AcademyAdminConfig {
  const stamped: AcademyAdminConfig = {
    ...nextConfig,
    updatedAtMs: Date.now(),
  }
  applyAcademyAdminConfig(stamped)

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(ACADEMY_ADMIN_CONFIG_STORAGE_KEY, JSON.stringify(stamped))
      window.dispatchEvent(new CustomEvent('ics-academy-config-updated'))
      window.dispatchEvent(new CustomEvent('ics-attendance-updated'))
      window.dispatchEvent(new CustomEvent('ics-period-attendance-updated'))

      let notif: CampusNotification | undefined
      if (notificationInput) {
        notif = createAndStoreCampusNotification({
          type: 'notice',
          title: notificationInput.title,
          message: notificationInput.message,
          category: 'Academic',
          targetClass: notificationInput.targetClass,
          actorName: `${ACADEMY_PRINCIPAL.name} (Principal)`,
          href: '#timetable',
        })
      }

      void pushCampusSyncToServer({
        academyAdminConfig: stamped,
        ...(notif ? { notification: notif } : {}),
      })
    } catch {
      // Ignore storage errors
    }
  }

  return stamped
}

export function addStudentByPrincipal(input: {
  name: string
  admissionNo: string
  className: string
}): Student {
  const current = loadAcademyAdminConfig()
  const cleanName = input.name.trim()
  const cleanAdmission = input.admissionNo.trim().toUpperCase()
  const cleanClass = normalizeClassName(input.className) || '8th'
  const newId = `std-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const entry: CustomStudentEntry = {
    id: newId,
    name: cleanName,
    admissionNo: cleanAdmission,
    className: cleanClass,
    batch: getBatchLabelForClass(cleanClass),
  }
  const nextAdded = [...(current.addedStudents ?? []), entry]
  saveAcademyAdminConfig(
    {
      ...current,
      addedStudents: nextAdded,
    },
    {
      title: `New Student Enrolled • Class ${cleanClass}`,
      message: `${cleanName} (${cleanAdmission}) has been added to Class ${cleanClass}.`,
      targetClass: cleanClass,
    },
  )
  return students.find((s) => s.id === newId) ?? students[students.length - 1]
}

export function updateStudentByPrincipal(
  studentId: string,
  updates: {
    name: string
    admissionNo: string
    className: string
  },
): void {
  const current = loadAcademyAdminConfig()
  const cleanName = updates.name.trim()
  const cleanAdmission = updates.admissionNo.trim().toUpperCase()
  const cleanClass = normalizeClassName(updates.className) || '8th'
  const existingSt = students.find((s) => s.id === studentId)
  if (
    existingSt &&
    existingSt.name === cleanName &&
    existingSt.admissionNo.toUpperCase() === cleanAdmission &&
    normalizeClassName(existingSt.className) === cleanClass
  ) {
    return
  }
  const nextEdited = {
    ...(current.editedStudents ?? {}),
    [studentId]: {
      ...(current.editedStudents?.[studentId] ?? {}),
      name: cleanName,
      admissionNo: cleanAdmission,
      className: cleanClass,
      batch: getBatchLabelForClass(cleanClass),
    },
  }
  saveAcademyAdminConfig({
    ...current,
    editedStudents: nextEdited,
  })
}

export function updateStudentProfilePhoto(studentId: string, avatarUrl: string): boolean {
  const cleanAvatar = typeof avatarUrl === 'string' ? avatarUrl.trim() : ''
  // Mandatory profile photo policy: never allow clearing or saving an empty photo
  if (
    !studentId ||
    !cleanAvatar ||
    (!cleanAvatar.startsWith('data:image/') &&
      !cleanAvatar.startsWith('/') &&
      !cleanAvatar.startsWith('https://') &&
      !cleanAvatar.startsWith('http://'))
  ) {
    return false
  }
  SYNCED_PROFILE_PHOTOS[studentId] = cleanAvatar
  const current = loadAcademyAdminConfig()
  const existingEdit = current.editedStudents?.[studentId] ?? {}
  const nextEdited = {
    ...(current.editedStudents ?? {}),
    [studentId]: {
      ...existingEdit,
      avatarUrl: cleanAvatar,
    },
  }
  saveAcademyAdminConfig({
    ...current,
    editedStudents: nextEdited,
  })
  return true
}

export function updateUsthadProfilePhoto(actorId: string, avatarUrl: string): boolean {
  const canonical = getCanonicalProfilePhotoActorId(actorId)
  const cleanAvatar = typeof avatarUrl === 'string' ? avatarUrl.trim() : ''
  if (
    !canonical ||
    !cleanAvatar ||
    (!cleanAvatar.startsWith('data:image/') &&
      !cleanAvatar.startsWith('/') &&
      !cleanAvatar.startsWith('https://') &&
      !cleanAvatar.startsWith('http://'))
  ) {
    return false
  }
  SYNCED_PROFILE_PHOTOS[canonical] = cleanAvatar
  const current = loadAcademyAdminConfig()
  const existingEdit = current.editedUsthads?.[canonical] ?? {}
  const nextEditedUsthads = {
    ...(current.editedUsthads ?? {}),
    [canonical]: {
      ...existingEdit,
      avatarUrl: cleanAvatar,
    },
  }
  saveAcademyAdminConfig({
    ...current,
    editedUsthads: nextEditedUsthads,
  })
  return true
}

export function removeStudentByPrincipal(studentId: string): void {
  const current = loadAcademyAdminConfig()
  const removed = new Set(current.removedStudentIds ?? [])
  if (removed.has(studentId)) return
  removed.add(studentId)
  saveAcademyAdminConfig({
    ...current,
    removedStudentIds: Array.from(removed),
  })
}

export function restoreAllRemovedStudentsByPrincipal(): void {
  const current = loadAcademyAdminConfig()
  if (!current.removedStudentIds || current.removedStudentIds.length === 0) return
  saveAcademyAdminConfig({
    ...current,
    removedStudentIds: [],
  })
}

export function assignClassUsthadByPrincipal(className: string, usthadIdOrStaffId: string): void {
  const current = loadAcademyAdminConfig()
  const normClass = normalizeClassName(className)
  const currentSlot = CLASS_USTHADS.find((u) => normalizeClassName(u.className) === normClass)
  if (
    currentSlot &&
    (currentSlot.id === usthadIdOrStaffId ||
      normalizeAdmissionKey(currentSlot.staffId) === normalizeAdmissionKey(usthadIdOrStaffId))
  ) {
    return
  }
  const nextAssignments = {
    ...(current.classUsthadAssignments ?? {}),
    [normClass]: usthadIdOrStaffId,
  }
  const targetUsthad = OFFICIAL_CLASS_USTHADS.find(
    (u) =>
      u.id === usthadIdOrStaffId ||
      normalizeAdmissionKey(u.staffId) === normalizeAdmissionKey(usthadIdOrStaffId),
  )
  saveAcademyAdminConfig(
    {
      ...current,
      classUsthadAssignments: nextAssignments,
    },
    targetUsthad
      ? {
          title: `Class Usthad Updated • Class ${normClass}`,
          message: `${targetUsthad.name} (${targetUsthad.staffId}) is now assigned as Class Usthad for Class ${normClass}.`,
          targetClass: normClass,
        }
      : undefined,
  )
}

export function saveUsthadProfileByPrincipal(input: {
  usthadId?: string
  name: string
  staffId: string
  designation: string
  specialization: string
  assignedClassName?: string
  assignedClassNames?: string[]
}): void {
  const current = loadAcademyAdminConfig()
  const cleanName = input.name.trim()
  const cleanStaffId = input.staffId.trim().toUpperCase()
  const cleanDesignation = input.designation.trim() || 'Class Usthad'
  const cleanSpec = input.specialization.trim() || 'Islamic & Academic Studies'

  const hasExplicitMultiClasses = Array.isArray(input.assignedClassNames)
  const normalizedTargetClasses = hasExplicitMultiClasses
    ? Array.from(
        new Set(
          (input.assignedClassNames ?? [])
            .map((c) => normalizeClassName(c))
            .filter((c) => ALL_ACADEMY_CLASS_NAMES.includes(c)),
        ),
      )
    : input.assignedClassName
      ? [normalizeClassName(input.assignedClassName)]
      : null

  if (input.usthadId) {
    const existingUsthad = OFFICIAL_CLASS_USTHADS.find((u) => u.id === input.usthadId)
    const prevAssignedClasses = existingUsthad ? getAssignedClassesForUsthad(existingUsthad) : []
    const classesChanged =
      normalizedTargetClasses !== null &&
      (normalizedTargetClasses.length !== prevAssignedClasses.length ||
        normalizedTargetClasses.some((c) => !prevAssignedClasses.includes(c)))

    if (
      existingUsthad &&
      existingUsthad.name === cleanName &&
      existingUsthad.staffId.toUpperCase() === cleanStaffId &&
      existingUsthad.designation === cleanDesignation &&
      existingUsthad.specialization === cleanSpec &&
      !classesChanged
    ) {
      return
    }

    const nextEdited = {
      ...(current.editedUsthads ?? {}),
      [input.usthadId]: {
        name: cleanName,
        staffId: cleanStaffId,
        designation: cleanDesignation,
        specialization: cleanSpec,
      },
    }

    const nextAssignments = { ...(current.classUsthadAssignments ?? {}) }
    const oldStaffKey = existingUsthad ? normalizeAdmissionKey(existingUsthad.staffId) : ''

    // If staffId changed, migrate any existing class assignments pointing to old staffId
    if (oldStaffKey && oldStaffKey !== normalizeAdmissionKey(cleanStaffId)) {
      for (const cls of Object.keys(nextAssignments)) {
        if (
          nextAssignments[cls] === input.usthadId ||
          normalizeAdmissionKey(nextAssignments[cls]) === oldStaffKey
        ) {
          nextAssignments[cls] = cleanStaffId
        }
      }
    }

    if (normalizedTargetClasses !== null) {
      const selectedSet = new Set(normalizedTargetClasses)
      for (const prevCls of prevAssignedClasses) {
        if (!selectedSet.has(prevCls)) {
          nextAssignments[prevCls] = '__UNASSIGNED__'
        }
      }
      for (const nextCls of normalizedTargetClasses) {
        nextAssignments[nextCls] = cleanStaffId
      }
    }

    saveAcademyAdminConfig(
      {
        ...current,
        editedUsthads: nextEdited,
        classUsthadAssignments: nextAssignments,
      },
      classesChanged
        ? {
            title: `Class Usthad Updated • ${cleanName}`,
            message:
              normalizedTargetClasses && normalizedTargetClasses.length > 0
                ? `${cleanName} (${cleanStaffId}) is now Class Usthad for ${normalizedTargetClasses.join(', ')}.`
                : `${cleanName} (${cleanStaffId}) is now updated as Teaching Usthad (no assigned class).`,
          }
        : undefined,
    )
  } else {
    const initialClasses = normalizedTargetClasses ?? []
    const targetCls = initialClasses[0] || normalizeClassName(input.assignedClassName || '8th')
    const newId = `usthad-custom-${Date.now()}`
    const newUsthad: UsthadProfileOverride = {
      id: newId,
      staffId: cleanStaffId,
      name: cleanName,
      shortName: cleanName,
      designation:
        input.designation.trim() ||
        (initialClasses.length > 0 ? 'Class Usthad' : 'Teaching Usthad'),
      institutionalRole: 'Class Usthad',
      specialization: cleanSpec,
      className: targetCls,
      batch: getBatchLabelForClass(targetCls),
      batchCode: getBatchCodeForClass(targetCls),
    }
    const nextAdded = [...(current.addedUsthads ?? []), newUsthad]
    const nextAssignments = { ...(current.classUsthadAssignments ?? {}) }
    for (const cls of initialClasses) {
      nextAssignments[cls] = cleanStaffId
    }
    saveAcademyAdminConfig(
      {
        ...current,
        addedUsthads: nextAdded,
        classUsthadAssignments: nextAssignments,
      },
      {
        title: `New Usthad Added • ${cleanName}`,
        message:
          initialClasses.length > 0
            ? `${cleanName} (${cleanStaffId}) added as Class Usthad for ${initialClasses.join(', ')}.`
            : `${cleanName} (${cleanStaffId}) added to Academy Faculty.`,
      },
    )
  }
}

export function assignClassLeadersByPrincipal(input: {
  className: string
  mainStudentId: string
  assistantStudentId: string
}): void {
  const current = loadAcademyAdminConfig()
  const normClass = normalizeClassName(input.className)
  const currentLeaders = getClassLeadersForClass(normClass)
  if (
    currentLeaders[0]?.studentId === input.mainStudentId &&
    currentLeaders[1]?.studentId === input.assistantStudentId
  ) {
    return
  }
  const nextLeaders = {
    ...(current.classLeaderAssignments ?? {}),
    [`${normClass}__Main Class Leader`]: input.mainStudentId,
    [`${normClass}__Assistant Class Leader`]: input.assistantStudentId,
  }
  const mainSt = students.find((s) => s.id === input.mainStudentId)
  const asstSt = students.find((s) => s.id === input.assistantStudentId)
  saveAcademyAdminConfig(
    {
      ...current,
      classLeaderAssignments: nextLeaders,
    },
    {
      title: `Class Leaders Updated • Class ${normClass}`,
      message: `Main Leader: ${mainSt?.name || 'Updated'} • Assistant Leader: ${asstSt?.name || 'Updated'}.`,
      targetClass: normClass,
    },
  )
}

export function saveClassTimetableByPrincipal(
  className: string,
  timetable: ClassSemesterTimetable,
  activeSemester?: 1 | 2,
): void {
  const current = loadAcademyAdminConfig()
  const normClass = normalizeClassName(className)
  const existingTt = getClassSemesterTimetableByClassName(normClass)
  if (
    JSON.stringify(existingTt) === JSON.stringify(timetable) &&
    (!activeSemester || activeSemester === getActiveSemester())
  ) {
    return
  }
  const nextTimetables = {
    ...(current.timetableOverrides ?? {}),
    [normClass]: JSON.parse(JSON.stringify(timetable)) as ClassSemesterTimetable,
  }
  saveAcademyAdminConfig(
    {
      ...current,
      ...(activeSemester ? { activeSemester } : {}),
      bsTimetableVersion: 2,
      timetableOverrides: nextTimetables,
    },
    {
      title: `Timetable Updated • Class ${normClass}`,
      message: `Class ${normClass} subjects and period schedule have been updated by the Principal.`,
      targetClass: normClass,
    },
  )
}

export function resetClassTimetableByPrincipal(className: string): ClassSemesterTimetable {
  const current = loadAcademyAdminConfig()
  const normClass = normalizeClassName(className)
  const nextTimetables = { ...(current.timetableOverrides ?? {}) }
  delete nextTimetables[normClass]
  saveAcademyAdminConfig({
    ...current,
    timetableOverrides: nextTimetables,
  })
  return getDefaultClassTimetable(normClass)
}

export function setActiveSemesterByPrincipal(semester: 1 | 2): void {
  if (getActiveSemester() === semester) return
  const current = loadAcademyAdminConfig()
  saveAcademyAdminConfig(
    {
      ...current,
      activeSemester: semester,
      semesterSyncVersion: 2,
    },
    {
      title: `Academic Schedule Switched to Semester ${semester}`,
      message: `All 11 classes are now following the Semester ${semester} timetable.`,
    },
  )
}

// Initialize stored Principal configuration immediately in browser
if (typeof window !== 'undefined') {
  try {
    const initialConfig = loadAcademyAdminConfig()
    if (initialConfig.updatedAtMs > 0) {
      applyAcademyAdminConfig(initialConfig)
    }
  } catch {
    // Ignore init errors
  }
}

const DELIVERED_NOTIF_IDS_BY_ACTOR_PREFIX = 'ics_delivered_notifs_v3_'

function loadDeliveredNotifIdsForActor(actorId: string): Set<string> {
  if (typeof window === 'undefined' || !actorId) return new Set()
  try {
    const raw = window.localStorage.getItem(`${DELIVERED_NOTIF_IDS_BY_ACTOR_PREFIX}${actorId}`)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function saveDeliveredNotifIdsForActor(actorId: string, ids: Set<string>): void {
  if (typeof window === 'undefined' || !actorId) return
  try {
    window.localStorage.setItem(
      `${DELIVERED_NOTIF_IDS_BY_ACTOR_PREFIX}${actorId}`,
      JSON.stringify(Array.from(ids).slice(-150)),
    )
  } catch {
    // Ignore storage errors
  }
}

function isValidPortalActorIdForFirestore(id?: string): id is string {
  if (!id || typeof id !== 'string') return false
  return /^(st[d]?|usthad|principal)-[a-zA-Z0-9_\-]+$/.test(id)
}

export async function writeNotificationToFirestore(
  notif: CampusNotification,
): Promise<void> {
  if (typeof window === 'undefined' || !notif?.id) return
  const cleanId = notif.id.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128)
  if (!cleanId) return
  const payload: Record<string, unknown> = {
    id: cleanId,
    campusId: 'ics-academy',
    type: notif.type,
    title: (notif.title || 'ICS Academy Notification').slice(0, 240),
    message: (notif.message || 'Update').slice(0, 1500),
    href: (notif.href || '#notices').slice(0, 120),
    createdAt: serverTimestamp(),
    createdAtMs:
      typeof notif.createdAtMs === 'number' && notif.createdAtMs > 0
        ? Math.floor(notif.createdAtMs)
        : Date.now(),
  }
  if (notif.category) payload.category = String(notif.category).slice(0, 40)
  if (notif.targetClass) payload.targetClass = String(notif.targetClass).slice(0, 40)
  if (Array.isArray(notif.targetClasses) && notif.targetClasses.length > 0) {
    payload.targetClasses = notif.targetClasses
      .slice(0, 20)
      .map((c) => String(c).slice(0, 40))
  }
  if (isValidPortalActorIdForFirestore(notif.targetStudentId)) {
    payload.targetStudentId = notif.targetStudentId
  }
  if (isValidPortalActorIdForFirestore(notif.targetRecipientId)) {
    payload.targetRecipientId = notif.targetRecipientId
  }
  if (typeof notif.targetStaffOnly === 'boolean') {
    payload.targetStaffOnly = notif.targetStaffOnly
  }
  const canonicalActor = notif.actorId?.startsWith('usthad-')
    ? getCanonicalUsthadId(notif.actorId)
    : notif.actorId
  if (isValidPortalActorIdForFirestore(canonicalActor)) {
    payload.actorId = canonicalActor
  }
  if (notif.actorName) {
    payload.actorName = String(notif.actorName).slice(0, 120)
  }

  const firestorePath = `campusNotifications/${cleanId}`
  try {
    await setDoc(doc(db, 'campusNotifications', cleanId), payload)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('permission') || msg.includes('insufficient')) {
      try {
        handleFirestoreError(error, OperationType.CREATE, firestorePath)
      } catch {
        // Logged cleanly by handleFirestoreError
      }
    }
  }
}

export async function pushCampusSyncToServer(payload: {
  customNotices?: Notice[]
  attendanceOverrides?: AttendanceOverrideMap
  periodSubmissions?: Record<string, PeriodAttendanceSubmission>
  deletedPeriodKey?: string
  deletedAtMs?: number
  academyAdminConfig?: AcademyAdminConfig
  notification?: CampusNotification
}): Promise<void> {
  if (typeof window === 'undefined') return
  if (payload.notification) {
    void writeNotificationToFirestore(payload.notification)
    const dispatchUrls = Array.from(
      new Set([
        '/api/push/dispatch',
        ...(window.location.origin !== 'https://ics-academy-manhappatta.vercel.app'
          ? ['https://ics-academy-manhappatta.vercel.app/api/push/dispatch']
          : []),
      ]),
    )
    for (const url of dispatchUrls) {
      void fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification: payload.notification }),
      }).catch(() => {})
    }
  }
  const bases = Array.from(new Set(getOrderedSyncBases()))
  await Promise.allSettled(
    bases.map((base) =>
      fetch(`${base}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    ),
  )
}

export async function pullCampusStateFromServer(): Promise<void> {
  if (typeof window === 'undefined') return
  const bases = Array.from(new Set(getOrderedSyncBases()))
  const session = getCurrentSessionIdentity()
  const queryParams = new URLSearchParams({
    t: String(Date.now()),
  })
  if (session.hasDeviceIdentity && session.actorId) {
    queryParams.set('actorId', session.actorId)
    if (session.className) queryParams.set('className', session.className)
    queryParams.set('isStaff', String(Boolean(session.isStaff)))
  }

  const results = await Promise.allSettled(
    bases.map(async (base) => {
      const res = await fetch(`${base}/state?${queryParams.toString()}`, {
        method: 'GET',
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Not OK')
      return (await res.json()) as {
        updatedAtMs?: number
        customNotices?: Notice[] | null
        attendanceOverrides?: AttendanceOverrideMap | null
        periodSubmissions?: Record<string, PeriodAttendanceSubmission> | null
        deletedPeriodKeys?: Record<string, number> | null
        academyAdminConfig?: AcademyAdminConfig | null
        notifications?: CampusNotification[]
      }
    }),
  )

  const validStates = results
    .filter((r): r is PromiseFulfilledResult<{
      updatedAtMs?: number
      customNotices?: Notice[] | null
      attendanceOverrides?: AttendanceOverrideMap | null
      periodSubmissions?: Record<string, PeriodAttendanceSubmission> | null
      deletedPeriodKeys?: Record<string, number> | null
      academyAdminConfig?: AcademyAdminConfig | null
      notifications?: CampusNotification[]
    }> => r.status === 'fulfilled' && Boolean(r.value))
    .map((r) => r.value)

  if (validStates.length === 0) return

  // Sort by updatedAtMs descending so primary/newest state is processed first while notifications merge across all
  validStates.sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0))
  const data = validStates[0]

  try {
    // 0. Merge Principal Academy Admin Config (Students, Usthads, Leaders, Timetables)
    for (const st of validStates) {
      if (
        st.academyAdminConfig &&
        typeof st.academyAdminConfig === 'object' &&
        typeof st.academyAdminConfig.updatedAtMs === 'number'
      ) {
        const localConfig = loadAcademyAdminConfig()
        if (st.academyAdminConfig.updatedAtMs > (localConfig.updatedAtMs || 0)) {
          window.localStorage.setItem(
            ACADEMY_ADMIN_CONFIG_STORAGE_KEY,
            JSON.stringify(st.academyAdminConfig),
          )
          applyAcademyAdminConfig(st.academyAdminConfig)
          window.dispatchEvent(new CustomEvent('ics-academy-config-updated'))
          window.dispatchEvent(new CustomEvent('ics-attendance-updated'))
          window.dispatchEvent(new CustomEvent('ics-period-attendance-updated'))
        }
      }
    }

    // 1. Merge custom notices
    if (Array.isArray(data.customNotices) && data.customNotices.length > 0) {
      const localNotices = loadCustomNotices()
      const localIds = new Set(localNotices.map((n) => n.id))
      const hasNewNotice = data.customNotices.some((n) => !localIds.has(n.id))
      if (hasNewNotice || data.customNotices.length !== localNotices.length) {
        window.localStorage.setItem(
          CUSTOM_NOTICES_STORAGE_KEY,
          JSON.stringify(data.customNotices),
        )
        window.dispatchEvent(new CustomEvent('ics-notices-updated'))
        window.dispatchEvent(new CustomEvent('ics-attendance-updated'))
      }
    }

    // 2. Merge attendance overrides across all reachable endpoints
    const localOverrides = loadAttendanceOverrides()
    let mergedOverrides = { ...localOverrides }
    for (const st of [...validStates].reverse()) {
      if (st.attendanceOverrides && typeof st.attendanceOverrides === 'object') {
        mergedOverrides = { ...mergedOverrides, ...st.attendanceOverrides }
      }
    }
    if (JSON.stringify(mergedOverrides) !== JSON.stringify(localOverrides)) {
      window.localStorage.setItem(
        ATTENDANCE_OVERRIDES_STORAGE_KEY,
        JSON.stringify(mergedOverrides),
      )
      window.dispatchEvent(new CustomEvent('ics-attendance-updated'))
    }

    // 3. Merge period attendance submissions & respect deleted keys
    const localDeleted = loadDeletedPeriodKeys()
    const mergedDeleted: Record<string, number> = { ...localDeleted }
    for (const st of validStates) {
      const serverDeleted =
        st.deletedPeriodKeys && typeof st.deletedPeriodKeys === 'object'
          ? st.deletedPeriodKeys
          : {}
      for (const [k, ts] of Object.entries(serverDeleted)) {
        if (!mergedDeleted[k] || ts > mergedDeleted[k]) {
          mergedDeleted[k] = ts
        }
      }
    }
    if (JSON.stringify(mergedDeleted) !== JSON.stringify(localDeleted)) {
      saveDeletedPeriodKeys(mergedDeleted)
    }

    const localSubs = loadPeriodAttendanceSubmissions()
    const mergedSubs: Record<string, PeriodAttendanceSubmission> = { ...localSubs }
    for (const st of validStates) {
      if (st.periodSubmissions && typeof st.periodSubmissions === 'object') {
        for (const [k, serverSub] of Object.entries(st.periodSubmissions)) {
          const localSub = mergedSubs[k]
          if (!localSub) {
            mergedSubs[k] = serverSub
          } else {
            const serverTouchMs = new Date(
              serverSub.lastEditedAt || serverSub.submittedAt || 0,
            ).getTime()
            const localTouchMs = new Date(
              localSub.lastEditedAt || localSub.submittedAt || 0,
            ).getTime()
            if (serverTouchMs >= localTouchMs) {
              mergedSubs[k] = serverSub
            }
          }
        }
      }
    }

    for (const [delKey, delTs] of Object.entries(mergedDeleted)) {
      const existing = mergedSubs[delKey]
      if (existing) {
        const subTouchMs = new Date(
          existing.lastEditedAt || existing.submittedAt || 0,
        ).getTime()
        if (delTs >= subTouchMs) {
          delete mergedSubs[delKey]
        }
      }
    }

    if (JSON.stringify(mergedSubs) !== JSON.stringify(localSubs)) {
      window.localStorage.setItem(
        PERIOD_ATTENDANCE_STORAGE_KEY,
        JSON.stringify(mergedSubs),
      )
      window.dispatchEvent(new CustomEvent('ics-period-attendance-updated'))
      window.dispatchEvent(new CustomEvent('ics-attendance-updated'))
    }

    // 4. Merge notifications across all endpoints and emit banner for any notification not yet delivered to this actorId
    const localNotifs = loadCampusNotifications()
    const byId = new Map<string, CampusNotification>()
    for (const n of localNotifs) {
      if (n && n.id) byId.set(n.id, n)
    }
    let hasNewStored = false
    for (const st of validStates) {
      if (Array.isArray(st.notifications)) {
        for (const sn of st.notifications) {
          if (sn && sn.id && !byId.has(sn.id)) {
            byId.set(sn.id, sn)
            hasNewStored = true
          }
        }
      }
    }

    const combined = Array.from(byId.values())
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .slice(0, 80)

    if (hasNewStored || combined.length !== localNotifs.length) {
      window.localStorage.setItem(
        CAMPUS_NOTIFICATIONS_STORAGE_KEY,
        JSON.stringify(combined),
      )
    }

    if (session.hasDeviceIdentity && session.actorId && combined.length > 0) {
      const deliveredSet = loadDeliveredNotifIdsForActor(session.actorId)
      const nowMs = Date.now()
      const maxAgeMs = 12 * 60 * 60 * 1000 // 12 hours
      let setModified = false
      let notifToFire: CampusNotification | null = null

      for (const n of combined) {
        if (deliveredSet.has(n.id)) continue
        if (nowMs - (n.createdAtMs || 0) > maxAgeMs) {
          deliveredSet.add(n.id)
          setModified = true
          continue
        }
        if (isNotificationRelevantForCurrentBrowserSession(n)) {
          deliveredSet.add(n.id)
          setModified = true
          if (!notifToFire) {
            notifToFire = n
          }
        }
      }

      if (setModified) {
        saveDeliveredNotifIdsForActor(session.actorId, deliveredSet)
      }

      if (notifToFire) {
        window.dispatchEvent(
          new CustomEvent('ics-campus-notification', {
            detail: notifToFire,
          }),
        )
      }
    }
  } catch {
    // Ignore merge errors
  }
}

function isRoomTargetedToCurrentSession(
  roomId: string,
  session: ReturnType<typeof getCurrentSessionIdentity>,
): boolean {
  if (!roomId || !session.hasDeviceIdentity || !session.actorId) return false
  if (roomId.startsWith('direct__')) {
    return roomId.split('__').includes(session.actorId)
  }
  if (roomId === 'staff_group__usthads') {
    return Boolean(session.isStaff)
  }
  if (roomId.startsWith('batch_group__')) {
    const batch = roomId.slice('batch_group__'.length)
    if (session.isStaff) {
      return (
        normalizeClassName(session.className) === normalizeClassName(batch) ||
        session.assignedClasses.some((c) => normalizeClassName(c) === normalizeClassName(batch)) ||
        Boolean(session.isPrincipal)
      )
    }
    return normalizeClassName(session.className) === normalizeClassName(batch)
  }
  return false
}

/**
 * Real-time Firestore listener (<200ms) across ais-dev, ais-pre, vercel.app, Android APK, and iOS PWA:
 * 1. Receives incoming campusNotifications immediately and triggers popup + phone notification sound.
 * 2. Listens to incoming campusChatMessages on any screen (even outside Messenger) to immediately write
 *    Firestore `deliveredTo` receipts (turning sender's grey ✓ into Double Grey Tick ✓✓) and emit chat notification if missed.
 */
export function subscribeRealtimeCampusNotificationsAndDelivery(
  overrideStudentId?: string,
  overrideClassName?: string,
): () => void {
  if (typeof window === 'undefined') return () => {}

  const unsubscribes: Array<() => void> = []

  try {
    const notifQuery = query(
      collection(db, 'campusNotifications'),
      where('createdAtMs', '>', 0),
      orderBy('createdAtMs', 'desc'),
      limit(25),
    )

    const unsubNotif = onSnapshot(
      notifQuery,
      (snapshot) => {
        try {
          const session = getCurrentSessionIdentity()
          const localNotifs = loadCampusNotifications()
          const byId = new Map<string, CampusNotification>()
          for (const n of localNotifs) {
            if (n && n.id) byId.set(n.id, n)
          }

          let addedNewToStore = false
          const incomingNotifs: CampusNotification[] = []
          snapshot.forEach((docSnap) => {
            const raw = docSnap.data() as Record<string, unknown>
            if (!raw || typeof raw.id !== 'string' || typeof raw.title !== 'string') return
            const item: CampusNotification = {
              id: raw.id,
              type: (raw.type as CampusNotificationType) || 'notice',
              title: String(raw.title),
              message: String(raw.message || ''),
              category: typeof raw.category === 'string' ? raw.category : undefined,
              targetClass: typeof raw.targetClass === 'string' ? raw.targetClass : undefined,
              targetClasses: Array.isArray(raw.targetClasses)
                ? raw.targetClasses.map(String)
                : undefined,
              targetStudentId:
                typeof raw.targetStudentId === 'string' ? raw.targetStudentId : undefined,
              targetRecipientId:
                typeof raw.targetRecipientId === 'string' ? raw.targetRecipientId : undefined,
              targetStaffOnly:
                typeof raw.targetStaffOnly === 'boolean' ? raw.targetStaffOnly : undefined,
              actorId: typeof raw.actorId === 'string' ? raw.actorId : undefined,
              actorName: typeof raw.actorName === 'string' ? raw.actorName : undefined,
              href: typeof raw.href === 'string' ? raw.href : '#notices',
              createdAt:
                typeof raw.createdAtMs === 'number'
                  ? new Date(raw.createdAtMs).toISOString()
                  : new Date().toISOString(),
              createdAtMs: typeof raw.createdAtMs === 'number' ? raw.createdAtMs : Date.now(),
            }
            incomingNotifs.push(item)
            if (!byId.has(item.id)) {
              byId.set(item.id, item)
              addedNewToStore = true
            }
          })

          const combined = Array.from(byId.values())
            .sort((a, b) => b.createdAtMs - a.createdAtMs)
            .slice(0, 80)

          if (addedNewToStore) {
            window.localStorage.setItem(
              CAMPUS_NOTIFICATIONS_STORAGE_KEY,
              JSON.stringify(combined),
            )
            window.dispatchEvent(new CustomEvent('ics-notices-updated'))
          }

          const effectiveActorId = overrideStudentId || session.actorId
          if ((session.hasDeviceIdentity || overrideStudentId) && effectiveActorId) {
            const deliveredSet = loadDeliveredNotifIdsForActor(effectiveActorId)
            const nowMs = Date.now()
            const maxAgeMs = 12 * 60 * 60 * 1000
            let modified = false
            const toFire: CampusNotification[] = []

            for (const n of incomingNotifs.sort((a, b) => a.createdAtMs - b.createdAtMs)) {
              if (deliveredSet.has(n.id)) continue
              if (nowMs - (n.createdAtMs || 0) > maxAgeMs) {
                deliveredSet.add(n.id)
                modified = true
                continue
              }
              if (isNotificationVisibleForStudent(n, overrideStudentId, overrideClassName)) {
                deliveredSet.add(n.id)
                modified = true
                toFire.push(n)
              }
            }

            if (modified) {
              saveDeliveredNotifIdsForActor(effectiveActorId, deliveredSet)
            }

            const newestRelevant = toFire[toFire.length - 1]
            if (newestRelevant) {
              window.dispatchEvent(
                new CustomEvent('ics-campus-notification', {
                  detail: newestRelevant,
                }),
              )
            }
          }
        } catch {
          // Ignore snapshot merge errors
        }
      },
      (error) => {
        const msg = error instanceof Error ? error.message : String(error)
        if (msg.includes('permission') || msg.includes('insufficient')) {
          try {
            handleFirestoreError(error, OperationType.LIST, 'campusNotifications')
          } catch {
            // Logged cleanly
          }
        }
      },
    )
    unsubscribes.push(unsubNotif)
  } catch {
    // Ignore listener attach errors
  }

  // Note: Chat notifications are already pushed via campusNotifications + /api/campus/sync Web Push,
  // and live chat messages are subscribed inside CampusMessenger only when chat is open — avoiding
  // an 80-doc duplicate campusChatMessages Firestore read on every page boot.

  return () => {
    for (const unsub of unsubscribes) {
      try {
        unsub()
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}





