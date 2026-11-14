export type MonthlyAttendance = {
  id: string
  month: string
  shortMonth: string
  year: number
  calendarDays: number
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
  attendance: {
    present: number
    absent: number
    leave: number
  }
  monthlyAttendance: MonthlyAttendance[]
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
      ['ICS2K261403', 'Muhammed Rifin'],
      ['ICS2K261404', 'Muhammed Ajwad'],
      ['ICS2K261405', 'Muhammed Jishan'],
      ['ICS2K261406', 'Muhammed Bishr TP'],
      ['ICS2K261407', 'Fuad Saneen'],
      ['ICS2K261408', 'Muhammed Jeelani'],
      ['ICS2K261409', 'Muhammed Swabeeh K'],
      ['ICS2K261410', 'Muhammed Savad'],
      ['ICS2K261411', 'Ayman KM'],
      ['ICS2K261412', 'Muhammed Hisham MK'],
      ['ICS2K261413', 'Rayid Rasheed'],
      ['ICS2K261414', 'Ashmil Musthafa'],
      ['ICS2K261415', 'Ashmil Nasar'],
      ['ICS2K261416', 'Swalahudeen CK'],
      ['ICS2K261417', 'Muhammed Zayyan'],
      ['ICS2K261418', 'Muhammed Twalha K'],
      ['ICS2K261419', 'Muhammed Sabiq'],
      ['ICS2K261420', 'Muhammed Ashiq Ali'],
      ['ICS2K261421', 'Bishr Muhammed CP'],
      ['ICS2K261422', 'Muhammed Swabeeh CK'],
      ['ICS2K261423', 'Muhammed Razeen'],
      ['ICS2K261424', 'Sirajuddeen Hadi'],
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

export const MONTHS_META = [
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

export type LibraryBook = {
  id: string
  title: string
  arabicTitle: string
  author: string
  category: 'Fiqh' | 'Hadith' | 'Tafsir' | 'Usul' | 'Tasawwuf' | 'Arabic & Nahw' | 'History'
  shelf: string
  callNo: string
  status: 'available' | 'issued' | 'reference'
  due?: string
}

export const libraryBooks: LibraryBook[] = [
  {
    id: 'burc-01',
    title: 'Fath al-Mu’in bi-Sharh Qurrat al-’Ayn',
    arabicTitle: 'فتح المعين بشرح قرة العين بمهمات الدين',
    author: 'Shaykh Zayn al-Din Ahmad al-Malaybari',
    category: 'Fiqh',
    shelf: 'Section F — Shelf F-01',
    callNo: 'BURC-FQ-0101',
    status: 'available',
  },
  {
    id: 'burc-02',
    title: 'Tuhfat al-Muhtaj bi-Sharh al-Minhaj (10 Vols)',
    arabicTitle: 'تحفة المحتاج في شرح المنهاج',
    author: 'Imam Shihab al-Din Ibn Hajar al-Haytami',
    category: 'Fiqh',
    shelf: 'Section F — Shelf F-03',
    callNo: 'BURC-FQ-0103',
    status: 'reference',
  },
  {
    id: 'burc-03',
    title: 'Nihayat al-Muhtaj ila Sharh al-Minhaj (8 Vols)',
    arabicTitle: 'نهاية المحتاج إلى شرح المنهاج',
    author: 'Imam Shams al-Din Muhammad al-Ramli',
    category: 'Fiqh',
    shelf: 'Section F — Shelf F-04',
    callNo: 'BURC-FQ-0104',
    status: 'available',
  },
  {
    id: 'burc-04',
    title: 'Al-Majmu’ Sharh al-Muhadhdhab (23 Vols)',
    arabicTitle: 'المجموع شرح المهذب',
    author: 'Imam Abu Zakariyya Yahya al-Nawawi',
    category: 'Fiqh',
    shelf: 'Section F — Shelf F-06',
    callNo: 'BURC-FQ-0106',
    status: 'reference',
  },
  {
    id: 'burc-05',
    title: 'Sahih al-Bukhari (Al-Jami’ al-Sahih)',
    arabicTitle: 'الجامع المسند الصحيح المختصر (صحيح البخاري)',
    author: 'Imam Muhammad ibn Isma’il al-Bukhari',
    category: 'Hadith',
    shelf: 'Section H — Shelf H-01',
    callNo: 'BURC-HD-0201',
    status: 'available',
  },
  {
    id: 'burc-06',
    title: 'Sahih Muslim bi-Sharh al-Nawawi (18 Vols)',
    arabicTitle: 'صحيح مسلم بشرح الإمام النووي',
    author: 'Imam Muslim ibn al-Hajjaj & Imam al-Nawawi',
    category: 'Hadith',
    shelf: 'Section H — Shelf H-02',
    callNo: 'BURC-HD-0202',
    status: 'issued',
    due: '2026-11-12',
  },
  {
    id: 'burc-07',
    title: 'Riyad as-Salihin min Kalam Sayyid al-Mursalin',
    arabicTitle: 'رياض الصالحين من كلام سيد المرسلين',
    author: 'Imam Yahya ibn Sharaf al-Nawawi',
    category: 'Hadith',
    shelf: 'Section H — Shelf H-04',
    callNo: 'BURC-HD-0204',
    status: 'available',
  },
  {
    id: 'burc-08',
    title: 'Subul al-Salam Sharh Bulugh al-Maram',
    arabicTitle: 'سبل السلام شرح بلوغ المرام من أدلة الأحكام',
    author: 'Imam Muhammad ibn Isma’il al-San’ani',
    category: 'Hadith',
    shelf: 'Section H — Shelf H-05',
    callNo: 'BURC-HD-0205',
    status: 'available',
  },
  {
    id: 'burc-09',
    title: 'Tafsir al-Qur’an al-’Azim (Tafsir Ibn Kathir)',
    arabicTitle: 'تفسير القرآن العظيم لابن كثير',
    author: 'Al-Hafiz Imad al-Din Ibn Kathir',
    category: 'Tafsir',
    shelf: 'Section T — Shelf T-01',
    callNo: 'BURC-TF-0301',
    status: 'reference',
  },
  {
    id: 'burc-10',
    title: 'Tafsir al-Jalalayn',
    arabicTitle: 'تفسير الجلالين',
    author: 'Jalal al-Din al-Mahalli & Jalal al-Din al-Suyuti',
    category: 'Tafsir',
    shelf: 'Section T — Shelf T-02',
    callNo: 'BURC-TF-0302',
    status: 'available',
  },
  {
    id: 'burc-11',
    title: 'Al-Itqan fi ’Ulum al-Qur’an',
    arabicTitle: 'الإتقان في علوم القرآن',
    author: 'Imam Jalal al-Din al-Suyuti',
    category: 'Tafsir',
    shelf: 'Section T — Shelf T-04',
    callNo: 'BURC-TF-0304',
    status: 'available',
  },
  {
    id: 'burc-12',
    title: 'Jam’ al-Jawami’ fi Usul al-Fiqh',
    arabicTitle: 'جمع الجوامع في أصول الفقه',
    author: 'Imam Taj al-Din Abd al-Wahhab al-Subki',
    category: 'Usul',
    shelf: 'Section U — Shelf U-01',
    callNo: 'BURC-US-0401',
    status: 'available',
  },
  {
    id: 'burc-13',
    title: 'Al-Risalah fi Usul al-Fiqh',
    arabicTitle: 'الرسالة في أصول الفقه',
    author: 'Imam Muhammad ibn Idris al-Shafi’i',
    category: 'Usul',
    shelf: 'Section U — Shelf U-02',
    callNo: 'BURC-US-0402',
    status: 'reference',
  },
  {
    id: 'burc-14',
    title: 'Ihya’ ’Ulum al-Din (Revival of Religious Sciences)',
    arabicTitle: 'إحياء علوم الدين',
    author: 'Hujjat al-Islam Imam Abu Hamid al-Ghazali',
    category: 'Tasawwuf',
    shelf: 'Section A — Shelf A-01',
    callNo: 'BURC-TS-0501',
    status: 'issued',
    due: '2026-11-05',
  },
  {
    id: 'burc-15',
    title: 'Sharh Ibn ’Aqil ’ala Alfiyyat Ibn Malik',
    arabicTitle: 'شرح ابن عقيل على ألفية ابن مالك',
    author: 'Baha’ al-Din Abdullah Ibn ’Aqil',
    category: 'Arabic & Nahw',
    shelf: 'Section N — Shelf N-02',
    callNo: 'BURC-AR-0602',
    status: 'available',
  },
  {
    id: 'burc-16',
    title: 'Al-Muqaddimah: An Introduction to History',
    arabicTitle: 'مقدمة ابن خلدون',
    author: 'Allamah Wali al-Din Abd al-Rahman Ibn Khaldun',
    category: 'History',
    shelf: 'Section C — Shelf C-01',
    callNo: 'BURC-HS-0701',
    status: 'available',
  },
]

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
export const CURRENT_SEMESTER: 1 | 2 = 1

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
      { label: 'Period 1', time: '06:45 – 07:50' },
      { label: 'Period 2', time: '08:30 – 09:30' },
      { label: 'Period 3', time: '09:45 – 10:45' },
      { label: 'Period 4', time: '11:00 – 12:00' },
      { label: 'Period 5', time: '14:00 – 15:15' },
    ],
    semester1: [
      { subject: 'Mahalli (Kitab al-Taharah & Salah)', teacher: 'Usthad Muhammed Musthafa Saqafi' },
      { subject: 'Tafsir al-Jalalayn (Juz 1–10)', teacher: 'Usthad Hafiz Fazlul Abid Naeemi' },
      { subject: 'Mishkat al-Masabih (Vol 1)', teacher: 'Usthad Muhammed Yasir Ahsani' },
      { subject: 'BA Arabic / Islamic History', teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'Academic English & Research', teacher: 'Usthad Favaz Saqafi' },
    ],
    semester2: [
      { subject: 'Mahalli (Kitab al-Zakah & Sawm)', teacher: 'Usthad Muhammed Musthafa Saqafi' },
      { subject: 'Tafsir al-Jalalayn (Juz 11–20)', teacher: 'Usthad Hafiz Fazlul Abid Naeemi' },
      { subject: 'Usul al-Fiqh (Lub al-Usul)', teacher: 'Usthad Muhammed Yasir Ahsani' },
      { subject: 'BA Core Humanities', teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'Classical Balaghah', teacher: 'Usthad Favaz Saqafi' },
    ],
  },
  'BS 2': {
    periods: [
      { label: 'Period 1', time: '06:45 – 07:50' },
      { label: 'Period 2', time: '08:30 – 09:30' },
      { label: 'Period 3', time: '09:45 – 10:45' },
      { label: 'Period 4', time: '11:00 – 12:00' },
      { label: 'Period 5', time: '14:00 – 15:15' },
    ],
    semester1: [
      { subject: 'Mahalli (Kitab al-Buyu’)', teacher: 'Usthad Hafiz Fazlul Abid Naeemi' },
      { subject: 'Mishkat al-Masabih (Vol 2)', teacher: 'Usthad Muhammed Yasir Ahsani' },
      { subject: 'Aqeedah (Sharh al-Aqaid)', teacher: 'Usthad Muhammed Musthafa Saqafi' },
      { subject: 'BA Sociology & History', teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'Classical Arabic Prose', teacher: 'Usthad Favaz Saqafi' },
    ],
    semester2: [
      { subject: 'Mahalli (Kitab al-Fara’id)', teacher: 'Usthad Hafiz Fazlul Abid Naeemi' },
      { subject: 'Tafsir al-Jalalayn (Juz 21–30)', teacher: 'Usthad Muhammed Musthafa Saqafi' },
      { subject: 'Ilm al-Mantiq & Hikmah', teacher: 'Usthad Muhammed Yasir Ahsani' },
      { subject: 'BA Degree Paper II', teacher: 'Usthad Midhlaj Ahsani' },
      { subject: 'Comparative Da’wa Studies', teacher: 'Usthad Favaz Saqafi' },
    ],
  },
  'BS 3': {
    periods: [
      { label: 'Period 1', time: '06:45 – 07:50' },
      { label: 'Period 2', time: '08:30 – 09:30' },
      { label: 'Period 3', time: '09:45 – 10:45' },
      { label: 'Period 4', time: '11:00 – 12:00' },
      { label: 'Period 5', time: '14:00 – 15:15' },
    ],
    semester1: [
      { subject: 'Fiqh (Mahalli — Nikah & Talaq)', teacher: 'Usthad Muhammed Yasir Ahsani' },
      { subject: 'Tafsir al-Baydawi & Ulum', teacher: 'Usthad Hafiz Fazlul Abid Naeemi' },
      { subject: 'Jam’ al-Jawami’ (Usul al-Fiqh)', teacher: 'Usthad Muhammed Musthafa Saqafi' },
      { subject: 'Arabic Literature & Criticism', teacher: 'Usthad Favaz Saqafi' },
      { subject: 'BA Final Year Seminar', teacher: 'Usthad Midhlaj Ahsani' },
    ],
    semester2: [
      { subject: 'Fiqh (Mahalli — Jinayat & Qada)', teacher: 'Usthad Muhammed Yasir Ahsani' },
      { subject: 'Sunan al-Tirmidhi (Selected)', teacher: 'Usthad Hafiz Fazlul Abid Naeemi' },
      { subject: 'Jam’ al-Jawami’ (Qiyas & Ijtihad)', teacher: 'Usthad Muhammed Musthafa Saqafi' },
      { subject: 'Islamic Historiography', teacher: 'Usthad Favaz Saqafi' },
      { subject: 'BA Dissertation & Viva', teacher: 'Usthad Midhlaj Ahsani' },
    ],
  },
  'BS 4': {
    periods: [
      { label: 'Period 1', time: '06:30 – 07:45' },
      { label: 'Period 2', time: '08:30 – 09:35' },
      { label: 'Period 3', time: '09:50 – 10:50' },
      { label: 'Period 4', time: '11:05 – 12:05' },
      { label: 'Period 5', time: '14:00 – 15:15' },
    ],
    semester1: [
      { subject: 'Tuhfat al-Muhtaj (Valiya Dars)', teacher: 'SHAIKHUNA HAMZA USTHAD' },
      { subject: 'Sahih Muslim (Kitab al-Iman)', teacher: 'Usthad Muhammed Yasir Ahsani' },
      { subject: 'Tafsir al-Nasafi / Baydawi', teacher: 'Usthad Hafiz Fazlul Abid Naeemi' },
      { subject: 'Maqasid al-Shari’ah', teacher: 'Usthad Muhammed Musthafa Saqafi' },
      { subject: 'Postgraduate Research Methods', teacher: 'Usthad Midhlaj Ahsani' },
    ],
    semester2: [
      { subject: 'Tuhfat al-Muhtaj (Mu’amalat — Valiya Dars)', teacher: 'SHAIKHUNA HAMZA USTHAD' },
      { subject: 'Sunan Abi Dawud (Ahkam)', teacher: 'Usthad Muhammed Yasir Ahsani' },
      { subject: 'Tasawwuf (Ihya’ Ulum al-Din)', teacher: 'Usthad Hafiz Fazlul Abid Naeemi' },
      { subject: 'Contemporary Fiqh Academy Papers', teacher: 'Usthad Muhammed Musthafa Saqafi' },
      { subject: 'Translation & Publication Lab', teacher: 'Usthad Midhlaj Ahsani' },
    ],
  },
  'BS 5': {
    periods: [
      { label: 'Period 1', time: '06:30 – 07:45' },
      { label: 'Period 2', time: '08:30 – 09:35' },
      { label: 'Period 3', time: '09:50 – 10:50' },
      { label: 'Period 4', time: '11:05 – 12:05' },
      { label: 'Period 5', time: '14:00 – 15:15' },
    ],
    semester1: [
      { subject: 'Sahih al-Bukhari (Valiya Dars Part 1)', teacher: 'SHAIKHUNA HAMZA USTHAD' },
      { subject: 'Tuhfat al-Muhtaj & Fatawa', teacher: 'SHAIKHUNA HAMZA USTHAD' },
      { subject: 'Jami’ al-Tirmidhi & Ilal', teacher: 'Usthad Muhammed Yasir Ahsani' },
      { subject: 'Comparative Religion & Da’wa', teacher: 'Usthad Hafiz Fazlul Abid Naeemi' },
      { subject: 'Senior Thesis & Ifta’ Practicum', teacher: 'Usthad Muhammed Musthafa Saqafi' },
    ],
    semester2: [
      { subject: 'Sahih al-Bukhari (Valiya Dars Part 2)', teacher: 'SHAIKHUNA HAMZA USTHAD' },
      { subject: 'Qawa’id Fiqhiyyah (Al-Ashbah)', teacher: 'SHAIKHUNA HAMZA USTHAD' },
      { subject: 'Muwatta’ Imam Malik & Sunan', teacher: 'Usthad Muhammed Yasir Ahsani' },
      { subject: 'Global Da’wa Leadership', teacher: 'Usthad Hafiz Fazlul Abid Naeemi' },
      { subject: 'Final Thesis Defense & Fatwa Lab', teacher: 'Usthad Muhammed Musthafa Saqafi' },
    ],
  },
}

export function getClassSemesterTimetable(student: Student): ClassSemesterTimetable {
  const key = normalizeClassName(student.className)
  return (
    CLASS_SEMESTER_SCHEDULES[key] ??
    CLASS_SEMESTER_SCHEDULES['BS 3']
  )
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
 * SHAIKHUNA HAMZA USTHAD (ശൈഖുനാ മഞ്ഞപ്പറ്റ ഹംസ ഉസ്താദ്)
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
 * The 9 Official Teaching & Class Usthads of ICS Academy Manhappatta
 * (Excludes SHAIKHUNA HAMZA USTHAD and Manager Usthad Muhammed Naeem Saqafi,
 * as neither of them are Class Usthads or have Login IDs).
 */
export const OFFICIAL_CLASS_USTHADS: ClassUsthad[] = [
  {
    id: 'usthad-07',
    staffId: 'UST-07',
    name: 'Usthad Muhammed Yasir Ahsani',
    shortName: 'Usthad Muhammed Yasir Ahsani',
    designation: 'Principal',
    institutionalRole: 'Principal',
    isPrincipalRole: true,
    teachingBatches: ['BS 3'],
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
    designation: 'Class Usthad',
    institutionalRole: 'Class Usthad',
    teachingBatches: ['BS 1'],
    className: 'BS 1',
    fullClassLabel: 'Class BS 1',
    batch: 'Batch 09',
    batchCode: '09',
    specialization: 'Fath al-Mu’in & Hadith Studies',
  },
]

/**
 * Per-class Class Usthad mapping across the 11 classes (using ONLY the 9 Class Usthads;
 * neither SHAIKHUNA HAMZA USTHAD nor Manager Usthad Muhammed Naeem Saqafi is ever a Class Usthad).
 */
export const CLASS_USTHADS: ClassUsthad[] = [
  OFFICIAL_CLASS_USTHADS[6], // 8th (Batch 14) — Usthad Muhammed Hashim Saqafi (UST-14)
  OFFICIAL_CLASS_USTHADS[5], // 9th (Batch 13) — Usthad Midhlaj Ahsani (UST-13)
  OFFICIAL_CLASS_USTHADS[4], // 10th (Batch 12) — Usthad Favaz Saqafi (UST-12)
  OFFICIAL_CLASS_USTHADS[3], // HS 1 (Batch 11) — Usthad Muhammed Musthafa Saqafi (UST-11)
  {
    id: 'usthad-10',
    staffId: 'UST-10',
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
    id: 'usthad-10b',
    staffId: 'UST-10',
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
  OFFICIAL_CLASS_USTHADS[8], // BS 1 (Batch 09) — Usthad Asif Saqafi (UST-09)
  OFFICIAL_CLASS_USTHADS[7], // BS 2 (Batch 08) — Usthad Alavudheen Ahsani (UST-08)
  OFFICIAL_CLASS_USTHADS[0], // BS 3 (Batch 07) — Usthad Muhammed Yasir Ahsani (Principal, UST-07)
  OFFICIAL_CLASS_USTHADS[2], // BS 4 (Batch 06) — Usthad Razaq Saqafi (UST-06)
  OFFICIAL_CLASS_USTHADS[1], // BS 5 (Batch 05) — Usthad Hafiz Fazlul Abid Naeemi (Swadr, UST-05)
]

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

  // 1. Direct match on staffId across all 11 class assignments (e.g. "UST-05", "UST-06", "UST-07", "UST-14")
  const exactClassUsthad = CLASS_USTHADS.find(
    (u) => normalizeAdmissionKey(u.staffId) === cleaned,
  )
  if (exactClassUsthad) return exactClassUsthad

  const exactOfficial = OFFICIAL_CLASS_USTHADS.find(
    (u) => normalizeAdmissionKey(u.staffId) === cleaned,
  )
  if (exactOfficial) return exactOfficial

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
    window.localStorage.setItem(ATTENDANCE_OVERRIDES_STORAGE_KEY, JSON.stringify(map))
    window.dispatchEvent(new CustomEvent('ics-attendance-updated'))

    // Find changed student+month entry to emit a live notification
    let changedKey: string | null = null
    for (const k of Object.keys(map)) {
      const cur = map[k]
      const old = prev[k]
      if (
        !old ||
        old.present !== cur.present ||
        old.absent !== cur.absent ||
        old.leave !== cur.leave ||
        old.absentReason !== cur.absentReason ||
        old.leaveReason !== cur.leaveReason
      ) {
        changedKey = k
        break
      }
    }

    let notif: CampusNotification | undefined
    if (changedKey) {
      const [stId, mId] = changedKey.split('__')
      const st = students.find((s) => s.id === stId)
      const mMeta = MONTHS_META.find((m) => m.id === mId)
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

export function getEffectiveStudentAttendance(
  student: Student,
  overrides: AttendanceOverrideMap,
  customNoticesList?: Notice[],
): {
  monthlyAttendance: MonthlyAttendance[]
  attendance: {
    present: number
    absent: number
    leave: number
    workingDays: number
    officialHolidayDays: number
    calendarDays: number
  }
} {
  let presentTotal = 0
  let absentTotal = 0
  let leaveTotal = 0
  let workingDaysTotal = 0
  let officialHolidaysTotal = 0
  let calendarDaysTotal = 0

  const activeCustomNotices = customNoticesList ?? loadCustomNotices()
  const activePeriodSubmissions = loadPeriodAttendanceSubmissions()

  // Aggregate daily attendance from Period Attendance submissions per month (for months without a manual monthly override)
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

  // Calculate any official holiday deductions announced on Notice Board per month
  // ONLY if the notice applies to this student's class/batch!
  const extraHolidayByMonth: Record<string, { days: number; notes: string[] }> = {}
  for (const nt of activeCustomNotices) {
    if (!isNoticeVisibleForClass(nt, student.className)) {
      continue
    }
    if (
      nt.holidayMeta?.isOfficialHoliday &&
      nt.holidayMeta.monthId &&
      nt.holidayMeta.holidayDaysDeducted > 0
    ) {
      const mId = nt.holidayMeta.monthId
      if (!extraHolidayByMonth[mId]) {
        extraHolidayByMonth[mId] = { days: 0, notes: [] }
      }
      extraHolidayByMonth[mId].days += nt.holidayMeta.holidayDaysDeducted
      extraHolidayByMonth[mId].notes.push(
        `${nt.title} (${nt.holidayMeta.departureDate} ${nt.holidayMeta.departureTime} → ${nt.holidayMeta.returnDate} ${nt.holidayMeta.returnTime})`,
      )
    }
  }

  const monthlyAttendance = student.monthlyAttendance.map((m) => {
    const monthSuffix = m.id.slice(5)
    const altMonthId = m.id.startsWith('2027-') ? `2026-${monthSuffix}` : `2027-${monthSuffix}`
    const key = `${student.id}__${m.id}`
    const altKey = `${student.id}__${altMonthId}`
    const override = overrides[key] ?? overrides[altKey]
    const periodDerived = periodDaysByMonth[m.id] ?? periodDaysByMonth[altMonthId]
    const extraHoliday = extraHolidayByMonth[m.id] ?? extraHolidayByMonth[altMonthId]
    const extraDeducted = extraHoliday ? extraHoliday.days : 0

    const present = override
      ? Math.max(0, override.present)
      : periodDerived
        ? periodDerived.present
        : m.present
    const absent = override
      ? Math.max(0, override.absent)
      : periodDerived
        ? periodDerived.absent
        : m.absent
    const leave = override
      ? Math.max(0, override.leave)
      : periodDerived
        ? periodDerived.leave
        : m.leave

    const workingDays = present + absent + leave
    const officialHolidayDays = Math.min(
      m.calendarDays,
      Math.max(0, m.officialHolidayDays + extraDeducted),
    )
    const officialHolidayNote = extraHoliday
      ? extraHoliday.notes.join(' • ')
      : m.officialHolidayNote

    presentTotal += present
    absentTotal += absent
    leaveTotal += leave
    workingDaysTotal += workingDays
    officialHolidaysTotal += officialHolidayDays
    calendarDaysTotal += m.calendarDays

    return {
      ...m,
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
      mainAdmissionNo: 'ICS2K261407', // Fuad Saneen
      assistantAdmissionNo: 'ICS2K261410', // Muhammed Savad
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
  submittedAt: string // ISO string
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
  assignedBatch: string
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
  assignedBatch: 'Batch 07',
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

export function savePeriodAttendanceSubmissions(
  map: Record<string, PeriodAttendanceSubmission>,
): void {
  if (typeof window === 'undefined') return
  ensureCleanLaunchStorage()
  try {
    const prev = loadPeriodAttendanceSubmissions()
    window.localStorage.setItem(PERIOD_ATTENDANCE_STORAGE_KEY, JSON.stringify(map))
    window.dispatchEvent(new CustomEvent('ics-period-attendance-updated'))
    window.dispatchEvent(new CustomEvent('ics-attendance-updated'))

    let changedSub: PeriodAttendanceSubmission | null = null
    for (const k of Object.keys(map)) {
      const cur = map[k]
      const old = prev[k]
      if (!old || old.submittedAt !== cur.submittedAt || old.sessionStatus !== cur.sessionStatus) {
        changedSub = cur
        break
      }
    }

    let notif: CampusNotification | undefined
    if (changedSub) {
      const statusText =
        changedSub.sessionStatus === 'not-held'
          ? `Marked Not Held (${changedSub.notHeldReason || 'Usthad Leave'})`
          : changedSub.sessionStatus === 'substituted'
            ? `Substitute Assigned: ${changedSub.substituteUsthad?.usthadName || 'Usthad'}`
            : `Attendance Marked by ${changedSub.submittedByName}`

      notif = createAndStoreCampusNotification({
        type: 'period-attendance',
        title: `${changedSub.periodLabel} • ${changedSub.className}`,
        message: `${changedSub.subject}: ${statusText} (${changedSub.date})`,
        targetClass: changedSub.className,
        actorName: changedSub.submittedByName,
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

export type CampusNotificationType =
  | 'notice'
  | 'attendance'
  | 'period-attendance'
  | 'leave'

export type CampusNotification = {
  id: string
  type: CampusNotificationType
  title: string
  message: string
  category?: string
  targetClass?: string
  targetClasses?: string[]
  targetStudentId?: string
  actorName?: string
  href?: string
  createdAt: string
  createdAtMs: number
}

/**
 * Determines whether a notification should be shown to the given user context.
 * - When `studentId` is provided (Student / Class Leader session):
 *   1. Personal notifications (`type === 'attendance'` or `type === 'leave'`, or any notification with `targetStudentId`)
 *      are STRICTLY restricted to `notif.targetStudentId === studentId`. Another student's leave or attendance
 *      will NEVER be visible on this student's phone.
 *   2. Class/Batch-scoped notifications (`targetClasses` or `targetClass`) are only shown if the student's
 *      `classNameFilter` matches one of the target classes.
 *   3. General notices (`type === 'notice'` with no `targetClasses`/`targetClass`) are visible to everyone.
 */
export function isNotificationVisibleForStudent(
  notif: CampusNotification,
  studentId?: string,
  classNameFilter?: string,
): boolean {
  const normFilter = normalizeClassName(classNameFilter)
  const normTargetClass = normalizeClassName(notif.targetClass)
  const normTargetClasses = (notif.targetClasses ?? []).map((c) => normalizeClassName(c))

  if (studentId) {
    // 1. Any notification explicitly targeting a student ID must match this logged-in student
    if (notif.targetStudentId && notif.targetStudentId !== studentId) {
      return false
    }
    // 2. Personal attendance & leave notifications MUST have targetStudentId === studentId
    if (notif.type === 'attendance' || notif.type === 'leave') {
      return notif.targetStudentId === studentId
    }
    // 3. Multi-class target filtering (for class-specific notices/holidays)
    if (
      normTargetClasses.length > 0 &&
      !normTargetClasses.includes('ALL')
    ) {
      if (normFilter && !normTargetClasses.includes(normFilter)) {
        return false
      }
    }
    // 4. Single-class target filtering (for period-attendance or single-class notices)
    if (normTargetClass && normTargetClass !== 'ALL') {
      if (normFilter && normTargetClass !== normFilter) {
        return false
      }
    }
    return true
  }

  // Staff / Usthad / Principal view:
  if (normFilter && normFilter !== 'ALL') {
    if (
      normTargetClasses.length > 0 &&
      !normTargetClasses.includes('ALL') &&
      !normTargetClasses.includes(normFilter)
    ) {
      return false
    }
    if (
      normTargetClass &&
      normTargetClass !== 'ALL' &&
      normTargetClass !== normFilter
    ) {
      return false
    }
  }
  return true
}

function isNotificationRelevantForCurrentBrowserSession(notif: CampusNotification): boolean {
  if (typeof window === 'undefined') return true
  try {
    const role = window.localStorage.getItem('authRole') || 'student'
    if (role === 'principal') return true
    if (role === 'usthad') {
      const staffId = window.localStorage.getItem('usthadStaffId') || ''
      const usthad = findUsthadByStaffId(staffId)
      return isNotificationVisibleForStudent(notif, undefined, usthad?.className)
    }
    if (role === 'class-leader') {
      const leaderId = window.localStorage.getItem('classLeaderId') || ''
      const leaderMatch = findClassLeaderByIdentifier(leaderId)
      return isNotificationVisibleForStudent(
        notif,
        leaderMatch?.student.id,
        leaderMatch?.student.className,
      )
    }
    // Default: Student role
    const loggedInStudentId = window.localStorage.getItem('loggedInStudentId') || ''
    const st = students.find((s) => s.id === loggedInStudentId) ?? students[0]
    return isNotificationVisibleForStudent(notif, st?.id, st?.className)
  } catch {
    return true
  }
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
  actorName?: string
  href?: string
}): CampusNotification {
  const now = new Date()
  const notif: CampusNotification = {
    id: input.id || `notif_${now.getTime()}_${Math.random().toString(36).slice(2, 7)}`,
    type: input.type,
    title: input.title,
    message: input.message,
    category: input.category,
    targetClass: input.targetClass,
    targetClasses: input.targetClasses,
    targetStudentId: input.targetStudentId,
    actorName: input.actorName,
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
      if (isNotificationRelevantForCurrentBrowserSession(notif)) {
        window.dispatchEvent(
          new CustomEvent('ics-campus-notification', { detail: notif }),
        )
      }
    } catch {
      // Ignore storage errors
    }
  }

  return notif
}

export function publishCampusNotification(input: {
  type: CampusNotificationType
  title: string
  message: string
  category?: string
  targetClass?: string
  targetClasses?: string[]
  targetStudentId?: string
  actorName?: string
  href?: string
}): CampusNotification {
  const notif = createAndStoreCampusNotification(input)
  pushCampusSyncToServer({ notification: notif })
  return notif
}

export async function pushCampusSyncToServer(payload: {
  customNotices?: Notice[]
  attendanceOverrides?: AttendanceOverrideMap
  periodSubmissions?: Record<string, PeriodAttendanceSubmission>
  notification?: CampusNotification
}): Promise<void> {
  if (typeof window === 'undefined') return
  const bases = getOrderedSyncBases()
  for (const base of bases) {
    try {
      const res = await fetch(`${base}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) return
    } catch {
      // Try next endpoint
    }
  }
}

export async function pullCampusStateFromServer(): Promise<void> {
  if (typeof window === 'undefined') return
  const bases = getOrderedSyncBases()
  for (const base of bases) {
    try {
      const res = await fetch(`${base}/state?t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
      })
      if (!res.ok) continue
      const data = (await res.json()) as {
        customNotices?: Notice[] | null
        attendanceOverrides?: AttendanceOverrideMap | null
        periodSubmissions?: Record<string, PeriodAttendanceSubmission> | null
        notifications?: CampusNotification[]
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

      // 2. Merge attendance overrides
      if (data.attendanceOverrides && typeof data.attendanceOverrides === 'object') {
        const localOverrides = loadAttendanceOverrides()
        const mergedOverrides = { ...localOverrides, ...data.attendanceOverrides }
        if (JSON.stringify(mergedOverrides) !== JSON.stringify(localOverrides)) {
          window.localStorage.setItem(
            ATTENDANCE_OVERRIDES_STORAGE_KEY,
            JSON.stringify(mergedOverrides),
          )
          window.dispatchEvent(new CustomEvent('ics-attendance-updated'))
        }
      }

      // 3. Merge period attendance submissions
      if (data.periodSubmissions && typeof data.periodSubmissions === 'object') {
        const localSubs = loadPeriodAttendanceSubmissions()
        const mergedSubs = { ...localSubs, ...data.periodSubmissions }
        if (JSON.stringify(mergedSubs) !== JSON.stringify(localSubs)) {
          window.localStorage.setItem(
            PERIOD_ATTENDANCE_STORAGE_KEY,
            JSON.stringify(mergedSubs),
          )
          window.dispatchEvent(new CustomEvent('ics-period-attendance-updated'))
        }
      }

      // 4. Merge notifications and emit banner ONLY for brand-new notifications relevant to this logged-in user
      if (Array.isArray(data.notifications) && data.notifications.length > 0) {
        const localNotifs = loadCampusNotifications()
        const localIds = new Set(localNotifs.map((n) => n.id))
        const brandNew = data.notifications.filter((n) => !localIds.has(n.id))
        if (brandNew.length > 0) {
          const combined = [...brandNew, ...localNotifs]
            .sort((a, b) => b.createdAtMs - a.createdAtMs)
            .slice(0, 60)
          window.localStorage.setItem(
            CAMPUS_NOTIFICATIONS_STORAGE_KEY,
            JSON.stringify(combined),
          )
          const relevantNew = brandNew.find((n) =>
            isNotificationRelevantForCurrentBrowserSession(n),
          )
          if (relevantNew) {
            window.dispatchEvent(
              new CustomEvent('ics-campus-notification', {
                detail: relevantNew,
              }),
            )
          }
        }
      }
      return
    } catch {
      // Try next endpoint
    }
  }
}




