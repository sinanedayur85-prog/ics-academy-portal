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
  { id: 'batch-14', className: '8th • Batch 14', fullLabel: 'Class 8th • Batch 14', batch: 'Batch 14' },
  { id: 'batch-13', className: '9th • Batch 13', fullLabel: 'Class 9th • Batch 13', batch: 'Batch 13' },
  { id: 'batch-12', className: '10th • Batch 12', fullLabel: 'Class 10th • Batch 12', batch: 'Batch 12' },
  { id: 'batch-11', className: 'HS 1 • Batch 11', fullLabel: 'Class HS 1 • Batch 11', batch: 'Batch 11' },
  { id: 'batch-10', className: 'HS 2A • Batch 10', fullLabel: 'Class HS 2A • Batch 10', batch: 'Batch 10' },
  { id: 'batch-01', className: 'HS 2B • Batch 1', fullLabel: 'Class HS 2B • Batch 1', batch: 'Batch 1' },
  { id: 'batch-09', className: 'BS 1 • Batch 09', fullLabel: 'Class BS 1 • Batch 09', batch: 'Batch 09' },
  { id: 'batch-08', className: 'BS 2 • Batch 08', fullLabel: 'Class BS 2 • Batch 08', batch: 'Batch 08' },
  { id: 'batch-07', className: 'BS 3 • Batch 07', fullLabel: 'Class BS 3 • Batch 07', batch: 'Batch 07' },
  { id: 'batch-06', className: 'BS 4 • Batch 06', fullLabel: 'Class BS 4 • Batch 06', batch: 'Batch 06' },
  { id: 'batch-05', className: 'BS 5 • Batch 05', fullLabel: 'Class BS 5 • Batch 05', batch: 'Batch 05' },
]

const RAW_CLASS_ROSTERS: {
  className: string
  entries: [admissionNo: string, name: string][]
}[] = [
  {
    className: '8th • Batch 14',
    entries: [
      ['ICS•2K26•14•01', 'Hassan'],
      ['ICS•2K26•14•02', 'Swalahudheen CK'],
      ['ICS•2K26•14•03', 'Muhammed Zafin'],
      ['ICS•2K26•14•04', 'Muhammed Ajwad'],
      ['ICS•2K26•14•05', 'Muhammed Jishan'],
      ['ICS•2K26•14•06', 'Muhammed Bishr. TP'],
      ['ICS•2K26•14•07', 'Muhammed Saneen'],
      ['ICS•2K26•14•08', 'Muhammed Jeelani'],
      ['ICS•2K26•14•09', 'Muhammed Swabeeh. K'],
      ['ICS•2K26•14•10', 'Muhammed Sawad'],
      ['ICS•2K26•14•11', 'Aiman. KM'],
      ['ICS•2K26•14•12', 'Muhammed Hisham. MK'],
      ['ICS•2K26•14•13', 'Rayid Rashid'],
      ['ICS•2K26•14•14', 'Ashmal Mustafa'],
      ['ICS•2K26•14•15', 'Ashmal Nasir'],
      ['ICS•2K26•14•16', 'Muhammed Ziyan'],
      ['ICS•2K26•14•17', 'Muhammed Thwalha K'],
      ['ICS•2K26•14•18', 'Muhammed Sabiq'],
      ['ICS•2K26•14•19', 'Muhammed Ashiq Ali'],
      ['ICS•2K26•14•20', 'Bishr Muhammed. CP'],
      ['ICS•2K26•14•21', 'Muhammed Sabeeh. CK'],
      ['ICS•2K26•14•22', 'Muhammed Razeen'],
      ['ICS•2K26•14•23', 'Sirajudheen Hadi'],
      ['ICS•2K26•14•24', 'Muhammed Bishr. E'],
      ['ICS•2K26•14•25', 'Muhammed Sinan. A'],
      ['ICS•2K26•14•26', 'Muhammed Shameem'],
    ],
  },
  {
    className: '9th • Batch 13',
    entries: [
      ['ICS•2K25•13•01', 'Muhammed Ziyad. K T'],
      ['ICS•2K25•13•02', 'Muhammed Mirshad'],
      ['ICS•2K25•13•03', 'Muhammed Hamdan'],
      ['ICS•2K25•13•04', 'Muhammed Shibil. TM'],
      ['ICS•2K25•13•05', 'Muhammed Saneeh. OK'],
      ['ICS•2K25•13•06', 'Muhammed Sabith'],
      ['ICS•2K25•13•07', 'Muhammed Raihan M'],
      ['ICS•2K25•13•08', 'Muhammed Jasir C P'],
      ['ICS•2K25•13•09', 'Muhammed Moonis'],
      ['ICS•2K25•13•10', 'Muhammed Shaheem.K'],
      ['ICS•2K25•13•11', 'Muhammed Sirajudheen.P'],
      ['ICS•2K25•13•12', 'Yaseen Mahsood. NT'],
      ['ICS•2K25•13•13', 'Muhammed Mubarak. AP'],
      ['ICS•2K25•13•14', 'Muhammed Shamveel. CP'],
      ['ICS•2K25•13•15', 'Shuhaib'],
      ['ICS•2K25•13•16', 'Muhammed Rilsh. KT'],
      ['ICS•2K25•13•17', 'Muhammed Shaheem. M'],
      ['ICS•2K25•13•18', 'Muhammed Adnan. E'],
      ['ICS•2K25•13•19', 'Abdul Hadi.K'],
      ['ICS•2K25•13•20', 'Muhammed Sahl. TH'],
      ['ICS•2K25•13•21', 'Muhammed Adil'],
      ['ICS•2K25•13•22', 'Saadudheen. K'],
      ['ICS•2K25•13•23', 'Safwan'],
      ['ICS•2K25•13•24', 'Muhammed Hashim. T'],
      ['ICS•2K25•13•25', "Muhammed Mis'hab"],
    ],
  },
  {
    className: '10th • Batch 12',
    entries: [
      ['ICS•2K24•12•01', 'Ahmed Shammas. K'],
      ['ICS•2K24•12•02', 'Muhammed Fathah. EK'],
      ['ICS•2K24•12•03', 'Muhammed Shammas. M'],
      ['ICS•2K24•12•04', 'Muhammed Sahl. P'],
      ['ICS•2K24•12•05', 'Faris Aboobacker. KK'],
      ['ICS•2K24•12•06', 'Muhammed Anshif Ali. P'],
      ['ICS•2K24•12•07', 'Muhammed Rashad. K'],
      ['ICS•2K24•12•08', 'Muhammed Nabhan. P'],
      ['ICS•2K24•12•09', 'Muhammed Nihal. PK'],
      ['ICS•2K24•12•10', 'Muhammed Shahid. AP'],
      ['ICS•2K24•12•11', 'Muhammed Rajl. K'],
      ['ICS•2K24•12•12', 'Ruwais Ahmed. MP'],
      ['ICS•2K24•12•13', 'Muhammed Saeed. V'],
      ['ICS•2K24•12•14', 'Shamnad. C'],
      ['ICS•2K24•12•15', 'Ahmed Yasir. PV'],
      ['ICS•2K24•12•16', 'Muhammed Sinan. KP'],
      ['ICS•2K24•12•17', 'Muhammed Dilshad. NP'],
      ['ICS•2K24•12•18', 'Muhammed Abdul Vajid. K'],
      ['ICS•2K24•12•19', 'Jan Fishan. KP'],
      ['ICS•2K24•12•20', 'Muhammed Swalih. EK'],
      ['ICS•2K24•12•21', 'Muhammed Razi. TK'],
      ['ICS•2K24•12•22', 'Fadi Hassan. KM'],
      ['ICS•2K24•12•23', 'Muhammed Faheem. M'],
      ['ICS•2K24•12•24', 'Muhammed Ashmil. MP'],
      ['ICS•2K24•12•25', 'Sayyid Jazeel. P'],
      ['ICS•2K24•12•26', 'Muhammed Nashmil. PK'],
      ['ICS•2K24•12•27', 'Muhammed Saleeth. K'],
      ['ICS•2K24•12•28', 'Hamid Saeed. P'],
    ],
  },
  {
    className: 'HS 1 • Batch 11',
    entries: [
      ['ICS•2K23•11•01', 'Ahmed Ziyad. K'],
      ['ICS•2K23•11•02', 'Ismaeel Faheem. MP'],
      ['ICS•2K23•11•03', 'Muhammed Aslam. NM'],
      ['ICS•2K23•11•04', 'Muhammed Farhan. V'],
      ['ICS•2K23•11•05', 'Muhammed Saeed. P'],
      ['ICS•2K23•11•06', 'Muhammed Sinan. P'],
      ['ICS•2K23•11•07', 'Muhammed Hibathullah. P'],
      ['ICS•2K23•11•08', 'Muhammed Shammas. P'],
      ['ICS•2K23•11•09', 'Sayyid Muhammed Mihdhar. KP'],
      ['ICS•2K23•11•10', 'Muhammed Shibil. P'],
      ['ICS•2K23•11•11', 'Muhammed Althaf. P'],
      ['ICS•2K23•11•12', 'Afnan Faris. M'],
      ['ICS•2K23•11•13', 'Muhammed Mubeen. T'],
      ['ICS•2K23•11•14', 'Muhammed Shamil. KK'],
      ['ICS•2K23•11•15', 'Muhammed Afham. P'],
      ['ICS•2K23•11•16', 'Muhammed Ihsan. TK'],
      ['ICS•2K23•11•17', 'Muhammed Minhaj. KM'],
      ['ICS•2K23•11•18', 'Muhammed Swabeeh. T'],
      ['ICS•2K23•11•19', 'Muhammed Bishal. P'],
      ['ICS•2K23•11•20', 'Muhammed Hashir'],
    ],
  },
  {
    className: 'HS 2A • Batch 10',
    entries: [
      ['ICS•2K22•10•01', 'Mihraz. VP'],
      ['ICS•2K22•10•02', 'Muhammed Sinan. P'],
      ['ICS•2K22•10•03', 'Muhammed Jawad. KT'],
      ['ICS•2K22•10•04', 'Ahmed Haseeb. K'],
      ['ICS•2K22•10•05', 'Muhammed Mashir. T'],
      ['ICS•2K22•10•06', 'Minhaj. AK'],
      ['ICS•2K22•10•07', 'Muhammed Sinan. K'],
      ['ICS•2K22•10•08', 'Ziyad. K'],
      ['ICS•2K22•10•09', 'Muhammed Shafi. V'],
      ['ICS•2K22•10•10', 'Ali Haider. TM'],
      ['ICS•2K22•10•11', 'Muhammed Shamil. P'],
      ['ICS•2K22•10•12', 'Muhammed Sajeed. C'],
      ['ICS•2K22•10•13', 'Muhammed Mubeen. V'],
      ['ICS•2K22•10•14', 'Muhammed Hafnas. M'],
      ['ICS•2K22•10•15', 'Muhammed Asim Aboobacker. NM'],
      ['ICS•2K22•10•16', 'Muhammed Midlaj. P'],
      ['ICS•2K22•10•17', 'Midlaj. AK'],
      ['ICS•2K22•10•18', 'Muhammed Jawad. CP'],
      ['ICS•2K22•10•19', 'Muhammed Sinan. K'],
      ['ICS•2K22•10•20', 'Muhammed Farhan. PC'],
      ['ICS•2K22•10•21', 'Arshad KK'],
      ['ICS•2K22•10•22', 'Muhammed Swalih'],
    ],
  },
  {
    className: 'HS 2B • Batch 1',
    entries: [
      ['ICS•2K25•01•01', 'Shahid. PK'],
      ['ICS•2K25•01•02', 'Shibil Yashid. K'],
      ['ICS•2K25•01•03', "Muhammed Sa'ad"],
      ['ICS•2K25•01•04', 'Jaseem. P'],
      ['ICS•2K25•01•05', 'Ahmed Arif Fawaz'],
    ],
  },
  {
    className: 'BS 1 • Batch 09',
    entries: [
      ['ICS•2K21•09•01', 'Muhammed Rabeeh. C'],
      ['ICS•2K21•09•02', "Muhammed Sa'ad. KM"],
      ['ICS•2K21•09•03', 'Saeed Ahmed. KM'],
      ['ICS•2K24•09•04', 'Muhammed Rafeeh. KA'],
      ['ICS•2K21•09•05', 'Muhammed Mulaffar. NM'],
      ['ICS•2K21•09•06', 'Muhammed Shamil. AP'],
      ['ICS•2K21•09•07', 'Muhammed Shiyas. TM'],
      ['ICS•2K21•09•08', 'Muhammed Sahl. E'],
      ['ICS•2K21•09•09', 'Muhammed Musthafa. T'],
      ['ICS•2K21•09•10', 'Nooh. P'],
      ['ICS•2K21•09•11', 'Muhammed Shammas. P'],
      ['ICS•2K21•09•12', 'Muhammed Muhsin. V'],
      ['ICS•2K21•09•13', 'Mueenudheen. PK'],
      ['ICS•2K21•09•14', 'Muhammed Faiz. P'],
      ['ICS•2K21•09•15', 'Muhammed Sinan. K'],
      ['ICS•2K21•09•16', 'Fazlul Haq. K'],
      ['ICS•2K24•09•17', 'Muhammed Haseeb. A'],
      ['ICS•2K21•09•18', 'Muhammed Faiz. K'],
      ['ICS•2K21•09•19', 'Bishrul Hafi. PP'],
      ['ICS•2K24•09•20', 'Muhammed Jazeel. T'],
      ['ICS•2K25•09•21', 'Muhammed Ashiq. A'],
      ['ICS•2K25•09•22', 'Ahmed Yaseen'],
    ],
  },
  {
    className: 'BS 2 • Batch 08',
    entries: [
      ['ICS•2K20•08•01', 'Muhammed Hibathullah. K'],
      ['ICS•2K23•08•02', 'Muhammed Muzammil. MK'],
      ['ICS•2K20•08•03', 'Muhammed Shabeeb. P'],
      ['ICS•2K20•08•04', 'Jabir Hussain. M'],
      ['ICS•2K20•08•05', 'Muhammed Uvais. AK'],
      ['ICS•2K20•08•06', 'Muhammed Mubashir. V'],
      ['ICS•2K23•08•07', 'Sayyid Fazlu Rahman. VP'],
    ],
  },
  {
    className: 'BS 3 • Batch 07',
    entries: [
      ['ICS•2K19•07•01', 'Muhammed Junaid. P'],
      ['ICS•2K19•07•02', 'Muhammed Saeed. M'],
      ['ICS•2K19•07•03', 'Muhammed Ajmal. PK'],
      ['ICS•2K19•07•04', 'Muhammed Hisan. K'],
      ['ICS•2K19•07•05', 'Muhammed Juraij. BP'],
      ['ICS•2K19•07•06', 'Muhammed Shahid. M'],
    ],
  },
  {
    className: 'BS 4 • Batch 06',
    entries: [
      ['ICS•2K22•06•01', 'Muhammed Sinan. NT'],
      ['ICS•2K18•06•02', 'Abdul Bais. V'],
      ['ICS•2K18•06•03', 'Muhammed Jawad. TP'],
      ['ICS•2K18•06•04', 'Muhammed Faiz. M'],
      ['ICS•2K18•06•05', 'Muhammed Saadullah. K'],
      ['ICS•2K18•06•06', 'Muhammed Midhlaj. V'],
      ['ICS•2K18•06•07', 'Muhammed Bishr. MK'],
      ['ICS•2K18•06•08', 'Muhammed Dilshad. K'],
      ['ICS•2K18•06•09', 'Muhammed Rafi. V'],
      ['ICS•2K18•06•10', 'Muhammed Shafaf. T'],
      ['ICS•2K18•06•11', 'Muhammed Rizwan. K'],
      ['ICS•2K18•06•12', 'Muhammed Nizam. TA'],
      ['ICS•2K18•06•13', 'Shahid Ahmed. P'],
      ['ICS•2K18•06•14', 'Muhammed Salman. TM'],
      ['ICS•2K18•06•15', 'Muhammed Sabith. PK'],
    ],
  },
  {
    className: 'BS 5 • Batch 05',
    entries: [
      ['ICS•2K17•05•01', 'Ahmed Swalih. N'],
      ['ICS•2K17•05•02', 'Muhammed Jalaludheen. MP'],
      ['ICS•2K17•05•03', 'Muhammed Jouhar Saheel. TK'],
      ['ICS•2K17•05•04', 'Muhammed Muslih. MV'],
      ['ICS•2K17•05•05', 'Muhammed Shabeer. CP'],
    ],
  },
]

export const MONTHS_META = [
  {
    id: '2026-01',
    month: 'January',
    shortMonth: 'Jan',
    year: 2026,
    calendarDays: 31,
    officialHolidayDays: 7,
    officialHolidayNote: '2nd Sat Official Leave (Fri Morning – Mon Morning)',
    baseDays: 24,
  },
  {
    id: '2026-02',
    month: 'February',
    shortMonth: 'Feb',
    year: 2026,
    calendarDays: 28,
    officialHolidayDays: 6,
    officialHolidayNote: '2nd Sat Official Leave (Fri Noon – Mon Morning)',
    baseDays: 22,
  },
  {
    id: '2026-03',
    month: 'March',
    shortMonth: 'Mar',
    year: 2026,
    calendarDays: 31,
    officialHolidayDays: 11,
    officialHolidayNote: 'Eid-ul-Fitr Festival Vacation (10d) & Official Leave',
    baseDays: 20,
  },
  {
    id: '2026-04',
    month: 'April',
    shortMonth: 'Apr',
    year: 2026,
    calendarDays: 30,
    officialHolidayDays: 7,
    officialHolidayNote: '2nd Sat Official Leave (Fri Morning – Mon Morning)',
    baseDays: 23,
  },
  {
    id: '2026-05',
    month: 'May',
    shortMonth: 'May',
    year: 2026,
    calendarDays: 31,
    officialHolidayDays: 10,
    officialHolidayNote: 'Eid-ul-Adha (Bakrid) Vacation (7d) & 2nd Sat Leave',
    baseDays: 21,
  },
  {
    id: '2026-06',
    month: 'June',
    shortMonth: 'Jun',
    year: 2026,
    calendarDays: 30,
    officialHolidayDays: 6,
    officialHolidayNote: '2nd Sat Official Leave (Fri Afternoon – Mon Morning)',
    baseDays: 24,
  },
  {
    id: '2026-07',
    month: 'July',
    shortMonth: 'Jul',
    year: 2026,
    calendarDays: 31,
    officialHolidayDays: 6,
    officialHolidayNote: '2nd Sat Official Leave (Fri Morning – Sun Evening)',
    baseDays: 25,
  },
  {
    id: '2026-08',
    month: 'August',
    shortMonth: 'Aug',
    year: 2026,
    calendarDays: 31,
    officialHolidayDays: 7,
    officialHolidayNote: '2nd Sat Official Leave & Milad-un-Nabi Holiday',
    baseDays: 24,
  },
  {
    id: '2026-09',
    month: 'September',
    shortMonth: 'Sep',
    year: 2026,
    calendarDays: 30,
    officialHolidayDays: 6,
    officialHolidayNote: '2nd Sat Official Leave (Fri Noon – Mon Morning)',
    baseDays: 24,
  },
  {
    id: '2026-10',
    month: 'October',
    shortMonth: 'Oct',
    year: 2026,
    calendarDays: 31,
    officialHolidayDays: 8,
    officialHolidayNote: '2nd Sat Official Leave (Thu Evening – Mon Morning)',
    baseDays: 23,
  },
  {
    id: '2026-11',
    month: 'November',
    shortMonth: 'Nov',
    year: 2026,
    calendarDays: 30,
    officialHolidayDays: 6,
    officialHolidayNote: '2nd Sat Official Leave (Fri Morning – Mon Morning)',
    baseDays: 24,
  },
  {
    id: '2026-12',
    month: 'December',
    shortMonth: 'Dec',
    year: 2026,
    calendarDays: 31,
    officialHolidayDays: 8,
    officialHolidayNote: '2nd Sat Official Leave & Term Break',
    baseDays: 23,
  },
]

function buildStudentMonthlyAttendance(seedIndex: number): {
  monthlyAttendance: MonthlyAttendance[]
  attendance: { present: number; absent: number; leave: number }
} {
  let totalPresent = 0
  let totalAbsent = 0
  let totalLeave = 0

  const monthlyAttendance: MonthlyAttendance[] = MONTHS_META.map((m, monthIdx) => {
    const absent = (seedIndex + monthIdx) % 5 === 0 ? 1 : 0
    const leave = (seedIndex + monthIdx * 2) % 4 === 0 ? 1 : 0
    const present = Math.max(15, m.baseDays - absent - leave)
    const workingDays = present + absent + leave
    totalPresent += present
    totalAbsent += absent
    totalLeave += leave
    return {
      id: m.id,
      month: m.month,
      shortMonth: m.shortMonth,
      year: m.year,
      calendarDays: m.calendarDays,
      officialHolidayDays: m.officialHolidayDays,
      officialHolidayNote: m.officialHolidayNote,
      workingDays,
      present,
      absent,
      leave,
    }
  })

  return {
    monthlyAttendance,
    attendance: {
      present: totalPresent,
      absent: totalAbsent,
      leave: totalLeave,
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
  const cleaned = normalizeAdmissionKey(identifier)
  if (!cleaned) return undefined

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
  holidayType: 'monthly-second-saturday' | 'festival-celebration'
  monthId: string // e.g. '2026-11'
  departureDate: string // e.g. 'Friday, 13 Nov 2026'
  departureTime: string // e.g. '09:30 AM (Morning)' or '12:45 PM (After Jumu’ah)'
  returnDate: string // e.g. 'Monday, 16 Nov 2026'
  returnTime: string // e.g. '07:30 AM (Before Period 1)'
  holidayDaysDeducted: number
  announcedBy: string // e.g. 'Principal • ICS Academy' or Usthad name
}

export type Notice = {
  id: string
  date: string
  category: 'Exam' | 'Event' | 'Hostel' | 'Academic'
  pinned?: boolean
  title: string
  body: string
  holidayMeta?: OfficialHolidayMeta
}

export const notices: Notice[] = [
  {
    id: 'nt-holiday-monthly',
    date: '2026-10-30',
    category: 'Hostel',
    pinned: true,
    title: 'Official Second-Saturday Monthly Holiday — Departure & Return Schedule',
    body: 'Official monthly academy leave is scheduled around the Second Saturday. These official holidays are excluded from Academy Working Days and are NOT counted as student personal leaves.',
    holidayMeta: {
      isOfficialHoliday: true,
      holidayType: 'monthly-second-saturday',
      monthId: '2026-11',
      departureDate: 'Friday, 13 Nov 2026 (2nd Sat Eve)',
      departureTime: '12:45 PM (Afternoon — After Jumu’ah)',
      returnDate: 'Monday, 16 Nov 2026',
      returnTime: '07:00 AM (Morning — Before Class)',
      holidayDaysDeducted: 3,
      announcedBy: 'Principal & Academic Council',
    },
  },
  {
    id: 'nt-holiday-festival',
    date: '2026-10-28',
    category: 'Event',
    pinned: true,
    title: 'Festival & Special Celebration Vacation Policy (Excluded from Working Days)',
    body: 'During Eid (Perunnal) and special academy celebrations (7 to 10 days official vacation), the academy working days for that month are automatically reduced. Only leaves taken personally by students on actual working days are counted in the Student Leave tally.',
    holidayMeta: {
      isOfficialHoliday: true,
      holidayType: 'festival-celebration',
      monthId: '2026-03',
      departureDate: 'Thursday, 19 Mar 2026',
      departureTime: '09:30 AM (Morning)',
      returnDate: 'Sunday, 29 Mar 2026',
      returnTime: '06:00 PM (Evening)',
      holidayDaysDeducted: 10,
      announcedBy: 'Principal • ICS Academy Manhappatta',
    },
  },
  {
    id: 'nt-1',
    date: '2026-10-28',
    category: 'Exam',
    pinned: true,
    title: 'Jamia Hind Odd Semester Examination Schedule Published',
    body: 'Hall tickets and seating arrangements for all Da’wa batches (Batch 05 – Batch 14) are now available at the academic office.',
  },
  {
    id: 'nt-2',
    date: '2026-10-24',
    category: 'Event',
    title: 'Annual Arabic & Urdu Literary Symposium — Registration Open',
    body: 'Submit individual and group entries through your respective Class Leaders before Friday, 5:00 PM.',
  },
  {
    id: 'nt-4',
    date: '2026-10-14',
    category: 'Academic',
    title: 'Research Methodology Seminar for Senior Batch',
    body: 'Mandatory session on classical source citation and dissertation formatting in the Main Auditorium at 2:30 PM.',
  },
]

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
  '8th • Batch 14': {
    periods: [
      { label: 'Period 1', time: '07:15 – 08:05' },
      { label: 'Period 2', time: '08:30 – 09:20' },
      { label: 'Period 3', time: '09:30 – 10:20' },
      { label: 'Period 4', time: '10:35 – 11:25' },
      { label: 'Period 5', time: '14:00 – 15:00' },
    ],
    semester1: [
      { subject: 'Mizan & Sarf Foundation', teacher: 'Usthad Abdul Hakeem' },
      { subject: 'Fiqh (Mabadi al-Fiqh)', teacher: 'Usthad Zubair Wafy' },
      { subject: 'Arabic Muhadathah', teacher: 'Prof. Salman Hudawi' },
      { subject: 'English Foundation', teacher: 'Mr. Roshan Thomas' },
      { subject: 'Mathematics & Science', teacher: 'Mr. Vivek Menon' },
    ],
    semester2: [
      { subject: 'Ajnas & Sarf Practice', teacher: 'Usthad Abdul Hakeem' },
      { subject: 'Aqeedah (Aqeedat al-Awam)', teacher: 'Usthad Ibrahim Faizy' },
      { subject: 'Basic Nahw (Al-Ajurrumiyyah)', teacher: 'Prof. Salman Hudawi' },
      { subject: 'Seerah & Islamic History', teacher: 'Usthad Najeeb Darimi' },
      { subject: 'Social Studies & English', teacher: 'Mr. Haris K.' },
    ],
  },
  '9th • Batch 13': {
    periods: [
      { label: 'Period 1', time: '07:15 – 08:05' },
      { label: 'Period 2', time: '08:30 – 09:20' },
      { label: 'Period 3', time: '09:30 – 10:20' },
      { label: 'Period 4', time: '10:35 – 11:25' },
      { label: 'Period 5', time: '14:00 – 15:00' },
    ],
    semester1: [
      { subject: 'Zanjani (Ilm al-Sarf)', teacher: 'Usthad Abdul Hakeem' },
      { subject: 'Nahw Mir & Tarkib', teacher: 'Prof. Salman Hudawi' },
      { subject: 'Fiqh (Safinat al-Najah)', teacher: 'Usthad Zubair Wafy' },
      { subject: 'Hadith (Arba’in al-Nawawiyyah)', teacher: 'Usthad Ibrahim Faizy' },
      { subject: 'High School English & IT', teacher: 'Mr. Roshan Thomas' },
    ],
    semester2: [
      { subject: 'Mi’at Amil (Nahw)', teacher: 'Prof. Salman Hudawi' },
      { subject: 'Fiqh (Abi Shuja’)', teacher: 'Usthad Zubair Wafy' },
      { subject: 'Tasawwuf (Bidayat al-Hidayah)', teacher: 'Usthad Ibrahim Faizy' },
      { subject: 'Urdu Literature', teacher: 'Maulana Tariq Nadwi' },
      { subject: 'High School Social Science', teacher: 'Mr. Haris K.' },
    ],
  },
  '10th • Batch 12': {
    periods: [
      { label: 'Period 1', time: '07:00 – 08:00' },
      { label: 'Period 2', time: '08:30 – 09:25' },
      { label: 'Period 3', time: '09:35 – 10:30' },
      { label: 'Period 4', time: '10:45 – 11:45' },
      { label: 'Period 5', time: '14:00 – 15:10' },
    ],
    semester1: [
      { subject: 'Qatr al-Nada (Nahw)', teacher: 'Prof. Salman Hudawi' },
      { subject: 'Fiqh (Umdat al-Salik)', teacher: 'Usthad Abdul Hakeem' },
      { subject: 'Hadith (Riyad as-Salihin)', teacher: 'Usthad Zubair Wafy' },
      { subject: 'SSLC Core Subjects', teacher: 'Mr. Vivek Menon' },
      { subject: 'SSLC English & Lang.', teacher: 'Mr. Roshan Thomas' },
    ],
    semester2: [
      { subject: 'Sharh al-Jami / Nahw', teacher: 'Prof. Salman Hudawi' },
      { subject: 'Usul al-Fiqh (Al-Waraqat)', teacher: 'Usthad Abdul Hakeem' },
      { subject: 'Tafsir Selected Surahs', teacher: 'Usthad Ibrahim Faizy' },
      { subject: 'SSLC Exam Intensive', teacher: 'Mr. Vivek Menon' },
      { subject: 'SSLC Social Science', teacher: 'Mr. Haris K.' },
    ],
  },
  'HS 1 • Batch 11': {
    periods: [
      { label: 'Period 1', time: '07:00 – 08:00' },
      { label: 'Period 2', time: '08:30 – 09:30' },
      { label: 'Period 3', time: '09:45 – 10:45' },
      { label: 'Period 4', time: '11:00 – 12:00' },
      { label: 'Period 5', time: '14:00 – 15:15' },
    ],
    semester1: [
      { subject: 'Fath al-Mu’in (Ibadat)', teacher: 'Usthad Abdul Hakeem' },
      { subject: 'Alfiyyah Ibn Malik (Part 1)', teacher: 'Prof. Salman Hudawi' },
      { subject: 'Hadith (Bulugh al-Maram)', teacher: 'Usthad Zubair Wafy' },
      { subject: 'Plus One Humanities / Hist.', teacher: 'Mr. Haris K.' },
      { subject: 'Plus One English', teacher: 'Mr. Roshan Thomas' },
    ],
    semester2: [
      { subject: 'Fath al-Mu’in (Salah & Zakah)', teacher: 'Usthad Abdul Hakeem' },
      { subject: 'Alfiyyah Ibn Malik (Part 2)', teacher: 'Prof. Salman Hudawi' },
      { subject: 'Mantiq (Mirqat / Sullam)', teacher: 'Usthad Ibrahim Faizy' },
      { subject: 'Plus One Sociology & Pol.', teacher: 'Mr. Haris K.' },
      { subject: 'Arabic & Urdu Rhetoric', teacher: 'Maulana Tariq Nadwi' },
    ],
  },
  'HS 2A • Batch 10': {
    periods: [
      { label: 'Period 1', time: '07:00 – 08:00' },
      { label: 'Period 2', time: '08:30 – 09:30' },
      { label: 'Period 3', time: '09:45 – 10:45' },
      { label: 'Period 4', time: '11:00 – 12:00' },
      { label: 'Period 5', time: '14:00 – 15:15' },
    ],
    semester1: [
      { subject: 'Fath al-Mu’in (Mu’amalat)', teacher: 'Usthad Abdul Hakeem' },
      { subject: 'Tafsir al-Jalalayn (Part 1)', teacher: 'Usthad Ibrahim Faizy' },
      { subject: 'Alfiyyah Ibn Malik (Part 3)', teacher: 'Prof. Salman Hudawi' },
      { subject: 'Plus Two History & Econ.', teacher: 'Mr. Haris K.' },
      { subject: 'Plus Two English', teacher: 'Mr. Roshan Thomas' },
    ],
    semester2: [
      { subject: 'Fath al-Mu’in (Munakahat)', teacher: 'Usthad Abdul Hakeem' },
      { subject: 'Tafsir al-Jalalayn (Part 2)', teacher: 'Usthad Ibrahim Faizy' },
      { subject: 'Balaghah (Mukhtasar al-Ma’ani)', teacher: 'Prof. Salman Hudawi' },
      { subject: 'Plus Two Board Revision', teacher: 'Mr. Haris K.' },
      { subject: 'Da’wa & Elocution Lab', teacher: 'Usthad Najeeb Darimi' },
    ],
  },
  'HS 2B • Batch 1': {
    periods: [
      { label: 'Period 1', time: '07:00 – 08:00' },
      { label: 'Period 2', time: '08:30 – 09:30' },
      { label: 'Period 3', time: '09:45 – 10:45' },
      { label: 'Period 4', time: '11:00 – 12:00' },
      { label: 'Period 5', time: '14:00 – 15:15' },
    ],
    semester1: [
      { subject: 'Tafsir al-Jalalayn (Part 1)', teacher: 'Usthad Ibrahim Faizy' },
      { subject: 'Fath al-Mu’in (Mu’amalat)', teacher: 'Usthad Abdul Hakeem' },
      { subject: 'Hadith (Riyad as-Salihin)', teacher: 'Usthad Zubair Wafy' },
      { subject: 'Plus Two Commerce / Hist.', teacher: 'Mr. Haris K.' },
      { subject: 'Plus Two English', teacher: 'Mr. Roshan Thomas' },
    ],
    semester2: [
      { subject: 'Tafsir al-Jalalayn (Part 2)', teacher: 'Usthad Ibrahim Faizy' },
      { subject: 'Fath al-Mu’in (Munakahat)', teacher: 'Usthad Abdul Hakeem' },
      { subject: 'Usul al-Hadith (Nukhbat al-Fikar)', teacher: 'Usthad Zubair Wafy' },
      { subject: 'Plus Two Final Revision', teacher: 'Mr. Haris K.' },
      { subject: 'Arabic Composition', teacher: 'Prof. Salman Hudawi' },
    ],
  },
  'BS 1 • Batch 09': {
    periods: [
      { label: 'Period 1', time: '06:45 – 07:50' },
      { label: 'Period 2', time: '08:30 – 09:30' },
      { label: 'Period 3', time: '09:45 – 10:45' },
      { label: 'Period 4', time: '11:00 – 12:00' },
      { label: 'Period 5', time: '14:00 – 15:15' },
    ],
    semester1: [
      { subject: 'Mahalli (Kitab al-Taharah & Salah)', teacher: 'Usthad Abdul Hakeem' },
      { subject: 'Tafsir al-Jalalayn (Juz 1–10)', teacher: 'Usthad Ibrahim Faizy' },
      { subject: 'Mishkat al-Masabih (Vol 1)', teacher: 'Usthad Zubair Wafy' },
      { subject: 'BA Arabic / Islamic History', teacher: 'Prof. Salman Hudawi' },
      { subject: 'Academic English & Research', teacher: 'Mr. Roshan Thomas' },
    ],
    semester2: [
      { subject: 'Mahalli (Kitab al-Zakah & Sawm)', teacher: 'Usthad Abdul Hakeem' },
      { subject: 'Tafsir al-Jalalayn (Juz 11–20)', teacher: 'Usthad Ibrahim Faizy' },
      { subject: 'Usul al-Fiqh (Lub al-Usul)', teacher: 'Usthad Zubair Wafy' },
      { subject: 'BA Core Humanities', teacher: 'Mr. Haris K.' },
      { subject: 'Classical Balaghah', teacher: 'Prof. Salman Hudawi' },
    ],
  },
  'BS 2 • Batch 08': {
    periods: [
      { label: 'Period 1', time: '06:45 – 07:50' },
      { label: 'Period 2', time: '08:30 – 09:30' },
      { label: 'Period 3', time: '09:45 – 10:45' },
      { label: 'Period 4', time: '11:00 – 12:00' },
      { label: 'Period 5', time: '14:00 – 15:15' },
    ],
    semester1: [
      { subject: 'Mahalli (Kitab al-Buyu’)', teacher: 'Usthad Abdul Hakeem' },
      { subject: 'Mishkat al-Masabih (Vol 2)', teacher: 'Usthad Zubair Wafy' },
      { subject: 'Aqeedah (Sharh al-Aqaid)', teacher: 'Usthad Ibrahim Faizy' },
      { subject: 'BA Sociology & History', teacher: 'Mr. Haris K.' },
      { subject: 'Urdu Classical Prose', teacher: 'Maulana Tariq Nadwi' },
    ],
    semester2: [
      { subject: 'Mahalli (Kitab al-Fara’id)', teacher: 'Usthad Abdul Hakeem' },
      { subject: 'Tafsir al-Jalalayn (Juz 21–30)', teacher: 'Usthad Ibrahim Faizy' },
      { subject: 'Ilm al-Mantiq & Hikmah', teacher: 'Usthad Zubair Wafy' },
      { subject: 'BA Degree Paper II', teacher: 'Mr. Roshan Thomas' },
      { subject: 'Comparative Da’wa Studies', teacher: 'Usthad Najeeb Darimi' },
    ],
  },
  'BS 3 • Batch 07': {
    periods: [
      { label: 'Period 1', time: '06:45 – 07:50' },
      { label: 'Period 2', time: '08:30 – 09:30' },
      { label: 'Period 3', time: '09:45 – 10:45' },
      { label: 'Period 4', time: '11:00 – 12:00' },
      { label: 'Period 5', time: '14:00 – 15:15' },
    ],
    semester1: [
      { subject: 'Fiqh (Mahalli — Nikah & Talaq)', teacher: 'Usthad Abdul Hakeem' },
      { subject: 'Tafsir al-Baydawi & Ulum', teacher: 'Usthad Ibrahim Faizy' },
      { subject: 'Jam’ al-Jawami’ (Usul al-Fiqh)', teacher: 'Usthad Zubair Wafy' },
      { subject: 'Arabic Literature & Criticism', teacher: 'Prof. Salman Hudawi' },
      { subject: 'BA Final Year Seminar', teacher: 'Mr. Roshan Thomas' },
    ],
    semester2: [
      { subject: 'Fiqh (Mahalli — Jinayat & Qada)', teacher: 'Usthad Abdul Hakeem' },
      { subject: 'Sunan al-Tirmidhi (Selected)', teacher: 'Usthad Zubair Wafy' },
      { subject: 'Jam’ al-Jawami’ (Qiyas & Ijtihad)', teacher: 'Usthad Ibrahim Faizy' },
      { subject: 'Islamic Historiography', teacher: 'Usthad Najeeb Darimi' },
      { subject: 'BA Dissertation & Viva', teacher: 'Mr. Haris K.' },
    ],
  },
  'BS 4 • Batch 06': {
    periods: [
      { label: 'Period 1', time: '06:30 – 07:45' },
      { label: 'Period 2', time: '08:30 – 09:35' },
      { label: 'Period 3', time: '09:50 – 10:50' },
      { label: 'Period 4', time: '11:05 – 12:05' },
      { label: 'Period 5', time: '14:00 – 15:15' },
    ],
    semester1: [
      { subject: 'Tuhfat al-Muhtaj (Selected Bab)', teacher: 'Usthad Abdul Hakeem' },
      { subject: 'Sahih Muslim (Kitab al-Iman)', teacher: 'Usthad Zubair Wafy' },
      { subject: 'Tafsir al-Nasafi / Baydawi', teacher: 'Usthad Ibrahim Faizy' },
      { subject: 'Maqasid al-Shari’ah', teacher: 'Prof. Salman Hudawi' },
      { subject: 'Postgraduate Research Methods', teacher: 'Usthad Najeeb Darimi' },
    ],
    semester2: [
      { subject: 'Tuhfat al-Muhtaj (Mu’amalat)', teacher: 'Usthad Abdul Hakeem' },
      { subject: 'Sunan Abi Dawud (Ahkam)', teacher: 'Usthad Zubair Wafy' },
      { subject: 'Tasawwuf (Ihya’ Ulum al-Din)', teacher: 'Usthad Ibrahim Faizy' },
      { subject: 'Contemporary Fiqh Academy Papers', teacher: 'Prof. Salman Hudawi' },
      { subject: 'Translation & Publication Lab', teacher: 'Mr. Roshan Thomas' },
    ],
  },
  'BS 5 • Batch 05': {
    periods: [
      { label: 'Period 1', time: '06:30 – 07:45' },
      { label: 'Period 2', time: '08:30 – 09:35' },
      { label: 'Period 3', time: '09:50 – 10:50' },
      { label: 'Period 4', time: '11:05 – 12:05' },
      { label: 'Period 5', time: '14:00 – 15:15' },
    ],
    semester1: [
      { subject: 'Sahih al-Bukhari (Dawrah Part 1)', teacher: 'Usthad Ibrahim Faizy' },
      { subject: 'Tuhfat al-Muhtaj & Fatawa', teacher: 'Usthad Abdul Hakeem' },
      { subject: 'Jami’ al-Tirmidhi & Ilal', teacher: 'Usthad Zubair Wafy' },
      { subject: 'Comparative Religion & Da’wa', teacher: 'Usthad Najeeb Darimi' },
      { subject: 'Senior Thesis & Ifta’ Practicum', teacher: 'Prof. Salman Hudawi' },
    ],
    semester2: [
      { subject: 'Sahih al-Bukhari (Dawrah Part 2)', teacher: 'Usthad Ibrahim Faizy' },
      { subject: 'Qawa’id Fiqhiyyah (Al-Ashbah)', teacher: 'Usthad Abdul Hakeem' },
      { subject: 'Muwatta’ Imam Malik & Sunan', teacher: 'Usthad Zubair Wafy' },
      { subject: 'Global Da’wa Leadership', teacher: 'Usthad Najeeb Darimi' },
      { subject: 'Final Thesis Defense & Fatwa Lab', teacher: 'Prof. Salman Hudawi' },
    ],
  },
}

export function getClassSemesterTimetable(student: Student): ClassSemesterTimetable {
  return (
    CLASS_SEMESTER_SCHEDULES[student.className] ??
    CLASS_SEMESTER_SCHEDULES['BS 3 • Batch 07']
  )
}

export const EXAM_RESULTS_URL = 'https://jamiathulhind.com/index.php'

export type ClassUsthad = {
  id: string
  staffId: string
  name: string
  shortName: string
  designation: string
  className: string
  fullClassLabel: string
  batchCode: string
  specialization: string
}

export const CLASS_USTHADS: ClassUsthad[] = [
  {
    id: 'usthad-14',
    staffId: 'UST-14',
    name: 'Usthad Zubair Wafy',
    shortName: 'Usthad Zubair Wafy',
    designation: 'Class Usthad',
    className: '8th • Batch 14',
    fullClassLabel: 'Class 8th • Batch 14',
    batchCode: '14',
    specialization: 'Fiqh & Foundation Sarf',
  },
  {
    id: 'usthad-13',
    staffId: 'UST-13',
    name: 'Usthad Muhsin Hudawi',
    shortName: 'Usthad Muhsin Hudawi',
    designation: 'Class Usthad',
    className: '9th • Batch 13',
    fullClassLabel: 'Class 9th • Batch 13',
    batchCode: '13',
    specialization: 'Nahw & Classical Sarf',
  },
  {
    id: 'usthad-12',
    staffId: 'UST-12',
    name: 'Prof. Salman Hudawi',
    shortName: 'Prof. Salman Hudawi',
    designation: 'Class Usthad',
    className: '10th • Batch 12',
    fullClassLabel: 'Class 10th • Batch 12',
    batchCode: '12',
    specialization: 'Qatr al-Nada & Arabic Literature',
  },
  {
    id: 'usthad-11',
    staffId: 'UST-11',
    name: 'Usthad Najeeb Darimi',
    shortName: 'Usthad Najeeb Darimi',
    designation: 'Class Usthad',
    className: 'HS 1 • Batch 11',
    fullClassLabel: 'Class HS 1 • Batch 11',
    batchCode: '11',
    specialization: 'Alfiyyah & Hadith Studies',
  },
  {
    id: 'usthad-10',
    staffId: 'UST-10',
    name: 'Usthad Rashid Baqawi',
    shortName: 'Usthad Rashid Baqawi',
    designation: 'Class Usthad',
    className: 'HS 2A • Batch 10',
    fullClassLabel: 'Class HS 2A • Batch 10',
    batchCode: '10',
    specialization: 'Fath al-Mu’in & Balaghah',
  },
  {
    id: 'usthad-01',
    staffId: 'UST-01',
    name: 'Maulana Tariq Nadwi',
    shortName: 'Maulana Tariq Nadwi',
    designation: 'Class Usthad',
    className: 'HS 2B • Batch 1',
    fullClassLabel: 'Class HS 2B • Batch 1',
    batchCode: '01',
    specialization: 'Tafsir al-Jalalayn & Urdu',
  },
  {
    id: 'usthad-09',
    staffId: 'UST-09',
    name: 'UsthadShihabudheen Faizy',
    shortName: 'Usthad Shihabudheen Faizy',
    designation: 'Class Usthad',
    className: 'BS 1 • Batch 09',
    fullClassLabel: 'Class BS 1 • Batch 09',
    batchCode: '09',
    specialization: 'Mahalli & Mishkat al-Masabih',
  },
  {
    id: 'usthad-08',
    staffId: 'UST-08',
    name: 'Usthad Anas Wafy',
    shortName: 'Usthad Anas Wafy',
    designation: 'Class Usthad',
    className: 'BS 2 • Batch 08',
    fullClassLabel: 'Class BS 2 • Batch 08',
    batchCode: '08',
    specialization: 'Usul al-Fiqh & Mantiq',
  },
  {
    id: 'usthad-07',
    staffId: 'UST-07',
    name: 'Usthad Abdul Hakeem Faizy',
    shortName: 'Usthad Abdul Hakeem',
    designation: 'Class Usthad',
    className: 'BS 3 • Batch 07',
    fullClassLabel: 'Class BS 3 • Batch 07',
    batchCode: '07',
    specialization: 'Shafi’i Jurisprudence & Jam’ al-Jawami’',
  },
  {
    id: 'usthad-06',
    staffId: 'UST-06',
    name: 'Usthad Ibrahim Faizy',
    shortName: 'Usthad Ibrahim Faizy',
    designation: 'Class Usthad',
    className: 'BS 4 • Batch 06',
    fullClassLabel: 'Class BS 4 • Batch 06',
    batchCode: '06',
    specialization: 'Tuhfat al-Muhtaj & Tafsir al-Baydawi',
  },
  {
    id: 'usthad-05',
    staffId: 'UST-05',
    name: 'Shaykh Mahmood Musliyar',
    shortName: 'Shaykh Mahmood Musliyar',
    designation: 'Class Usthad',
    className: 'BS 5 • Batch 05',
    fullClassLabel: 'Class BS 5 • Batch 05',
    batchCode: '05',
    specialization: 'Sahih al-Bukhari & Fatwa Research',
  },
]

export function findUsthadByStaffId(identifier: string): ClassUsthad | undefined {
  const cleaned = normalizeAdmissionKey(identifier)
  if (!cleaned) return undefined

  // 1. Direct match on staffId (e.g. "UST-07", "UST07", "UST-14")
  const exact = CLASS_USTHADS.find((u) => normalizeAdmissionKey(u.staffId) === cleaned)
  if (exact) return exact

  // 2. Match TCH-XX or batch number (e.g. "TCH07", "BATCH07", "07", "7")
  const digits = cleaned.replace(/[^0-9]/g, '')
  if (digits) {
    const padded = digits.padStart(2, '0')
    const byBatch = CLASS_USTHADS.find((u) => u.batchCode === padded || u.batchCode === digits)
    if (byBatch) return byBatch
  }

  // 3. Support default placeholder "TCH-0217" -> defaults to BS 3 • Batch 07 Class Usthad
  if (cleaned === 'TCH0217' || cleaned === 'USTHAD' || cleaned === 'TEACHER') {
    return CLASS_USTHADS.find((u) => u.batchCode === '07') ?? CLASS_USTHADS[0]
  }

  return undefined
}

export const ATTENDANCE_OVERRIDES_STORAGE_KEY = 'ics_attendance_overrides_v1'
export const CUSTOM_NOTICES_STORAGE_KEY = 'ics_custom_notices_v1'

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
  try {
    window.localStorage.setItem(ATTENDANCE_OVERRIDES_STORAGE_KEY, JSON.stringify(map))
    window.dispatchEvent(new CustomEvent('ics-attendance-updated'))
  } catch {
    // Ignore storage errors
  }
}

export function loadCustomNotices(): Notice[] {
  if (typeof window === 'undefined') return []
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
  try {
    window.localStorage.setItem(CUSTOM_NOTICES_STORAGE_KEY, JSON.stringify(customList))
    window.dispatchEvent(new CustomEvent('ics-notices-updated'))
    window.dispatchEvent(new CustomEvent('ics-attendance-updated'))
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

  // Calculate any extra official holiday deductions announced on Notice Board per month
  const extraHolidayByMonth: Record<string, { days: number; notes: string[] }> = {}
  for (const nt of activeCustomNotices) {
    if (nt.holidayMeta?.isOfficialHoliday && nt.holidayMeta.monthId && nt.holidayMeta.holidayDaysDeducted > 0) {
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
    const key = `${student.id}__${m.id}`
    const override = overrides[key]
    const extraHoliday = extraHolidayByMonth[m.id]
    const extraDeducted = extraHoliday ? extraHoliday.days : 0

    let present = override ? Math.max(0, override.present) : m.present
    const absent = override ? Math.max(0, override.absent) : m.absent
    const leave = override ? Math.max(0, override.leave) : m.leave

    // If a new Official Holiday notice was posted for this month and no manual override was set after,
    // automatically reduce the working days (and present days accordingly so workingDays = present + absent + leave)
    if (extraDeducted > 0 && !override) {
      present = Math.max(5, present - extraDeducted)
    }

    const workingDays = present + absent + leave
    const officialHolidayDays = Math.min(
      m.calendarDays,
      Math.max(0, m.calendarDays - workingDays),
    )
    const officialHolidayNote = extraHoliday
      ? `${m.officialHolidayNote} • Notice: -${extraDeducted}d`
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
  const batchMapping: { className: string; batchCode: string }[] = [
    { className: '8th • Batch 14', batchCode: '14' },
    { className: '9th • Batch 13', batchCode: '13' },
    { className: '10th • Batch 12', batchCode: '12' },
    { className: 'HS 1 • Batch 11', batchCode: '11' },
    { className: 'HS 2A • Batch 10', batchCode: '10' },
    { className: 'HS 2B • Batch 1', batchCode: '01' },
    { className: 'BS 1 • Batch 09', batchCode: '09' },
    { className: 'BS 2 • Batch 08', batchCode: '08' },
    { className: 'BS 3 • Batch 07', batchCode: '07' },
    { className: 'BS 4 • Batch 06', batchCode: '06' },
    { className: 'BS 5 • Batch 05', batchCode: '05' },
  ]

  const leaders: ClassLeaderInfo[] = []
  for (const item of batchMapping) {
    const classRoster = students.filter((s) => s.className === item.className)
    const mainStudent = classRoster[0]
    const assistantStudent = classRoster[1] ?? classRoster[0]

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
  return CLASS_LEADERS.filter((item) => item.className === className)
}

export function getLeaderIdForClass(className: string, studentId?: string): string {
  if (studentId) {
    const byStudent = CLASS_LEADERS.find(
      (item) => item.className === className && item.studentId === studentId,
    )
    if (byStudent) return byStudent.leaderId
  }
  const found = CLASS_LEADERS.find((item) => item.className === className)
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

  // 3. Check if the user entered a Student Admission Number (e.g. ICS2K261401 or ICS2K261402)
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
    const fallbackLeaderId = getLeaderIdForClass(
      matchedByAdmission.className,
      matchedByAdmission.id,
    )
    return {
      student: matchedByAdmission,
      leaderId: fallbackLeaderId,
      roleTitle: 'Main Class Leader',
    }
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
}

export const PERIOD_ATTENDANCE_STORAGE_KEY = 'ics_period_attendance_v1'

export function loadPeriodAttendanceSubmissions(): Record<string, PeriodAttendanceSubmission> {
  if (typeof window === 'undefined') return {}
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
  try {
    window.localStorage.setItem(PERIOD_ATTENDANCE_STORAGE_KEY, JSON.stringify(map))
    window.dispatchEvent(new CustomEvent('ics-period-attendance-updated'))
  } catch {
    // Ignore storage errors
  }
}


