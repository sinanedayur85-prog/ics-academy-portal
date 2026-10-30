export type MonthlyAttendance = {
  id: string
  month: string
  shortMonth: string
  year: number
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

const MONTHS_META = [
  { id: '2026-01', month: 'January', shortMonth: 'Jan', year: 2026, baseDays: 24 },
  { id: '2026-02', month: 'February', shortMonth: 'Feb', year: 2026, baseDays: 22 },
  { id: '2026-03', month: 'March', shortMonth: 'Mar', year: 2026, baseDays: 25 },
  { id: '2026-04', month: 'April', shortMonth: 'Apr', year: 2026, baseDays: 23 },
  { id: '2026-05', month: 'May', shortMonth: 'May', year: 2026, baseDays: 21 },
  { id: '2026-06', month: 'June', shortMonth: 'Jun', year: 2026, baseDays: 24 },
  { id: '2026-07', month: 'July', shortMonth: 'Jul', year: 2026, baseDays: 26 },
  { id: '2026-08', month: 'August', shortMonth: 'Aug', year: 2026, baseDays: 25 },
  { id: '2026-09', month: 'September', shortMonth: 'Sep', year: 2026, baseDays: 24 },
  { id: '2026-10', month: 'October', shortMonth: 'Oct', year: 2026, baseDays: 23 },
  { id: '2026-11', month: 'November', shortMonth: 'Nov', year: 2026, baseDays: 24 },
  { id: '2026-12', month: 'December', shortMonth: 'Dec', year: 2026, baseDays: 23 },
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
    const leave = (seedIndex + monthIdx * 2) % 3 === 0 ? 2 : 1
    const present = Math.max(18, m.baseDays - absent - leave)
    totalPresent += present
    totalAbsent += absent
    totalLeave += leave
    return {
      id: m.id,
      month: m.month,
      shortMonth: m.shortMonth,
      year: m.year,
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

export type Notice = {
  id: string
  date: string
  category: 'Exam' | 'Event' | 'Hostel' | 'Academic'
  pinned?: boolean
  title: string
  body: string
}

export const notices: Notice[] = [
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
    pinned: true,
    title: 'Annual Arabic & Urdu Literary Symposium — Registration Open',
    body: 'Submit individual and group entries through your respective Class Leaders before Friday, 5:00 PM.',
  },
  {
    id: 'nt-3',
    date: '2026-10-19',
    category: 'Hostel',
    title: 'Monthly Home Leave Outpass Window',
    body: 'Students applying for weekend home leave must log their departure in the digital Leave Register prior to warden sign-off.',
  },
  {
    id: 'nt-4',
    date: '2026-10-14',
    category: 'Academic',
    title: 'Research Methodology Seminar for Senior Batch',
    body: 'Mandatory session on classical source citation and dissertation formatting in the Main Auditorium at 2:30 PM.',
  },
]

export const leaveReasons: string[] = [
  'Medical Appointment',
  'Monthly Home Visit',
  'Family Function',
  'Academic Competition / Seminar',
  'Emergency Personal Leave',
  'Other',
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

export const periods = [
  { label: 'Period 1', time: '07:00 – 08:00' },
  { label: 'Period 2', time: '08:30 – 09:30' },
  { label: 'Period 3', time: '09:45 – 10:45' },
  { label: 'Period 4', time: '11:00 – 12:00' },
  { label: 'Period 5', time: '14:00 – 15:15' },
]

export const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Sat']

export type TimetableSlot = {
  subject: string
  teacher: string
}

const baseSchedule: TimetableSlot[][] = [
  [
    { subject: 'Fiqh (Shafi’i)', teacher: 'Usthad Abdul Hakeem' },
    { subject: 'Tafsir & Ulum', teacher: 'Usthad Ibrahim Faizy' },
    { subject: 'Arabic Literature', teacher: 'Prof. Salman Hudawi' },
    { subject: 'English & Comm.', teacher: 'Mr. Roshan Thomas' },
    { subject: 'Hadith Studies', teacher: 'Usthad Zubair Wafy' },
  ],
  [
    { subject: 'Usul al-Fiqh', teacher: 'Usthad Abdul Hakeem' },
    { subject: 'Hadith Studies', teacher: 'Usthad Zubair Wafy' },
    { subject: 'World History', teacher: 'Mr. Haris K.' },
    { subject: 'Arabic Grammar', teacher: 'Prof. Salman Hudawi' },
    { subject: 'Da’wa Practicum', teacher: 'Usthad Najeeb Darimi' },
  ],
  [
    { subject: 'Tafsir & Ulum', teacher: 'Usthad Ibrahim Faizy' },
    { subject: 'Fiqh (Shafi’i)', teacher: 'Usthad Abdul Hakeem' },
    { subject: 'English & Comm.', teacher: 'Mr. Roshan Thomas' },
    { subject: 'Logic (Mantiq)', teacher: 'Usthad Zubair Wafy' },
    { subject: 'Public Speaking', teacher: 'Prof. Salman Hudawi' },
  ],
  [
    { subject: 'Hadith Studies', teacher: 'Usthad Zubair Wafy' },
    { subject: 'Arabic Literature', teacher: 'Prof. Salman Hudawi' },
    { subject: 'Fiqh (Shafi’i)', teacher: 'Usthad Abdul Hakeem' },
    { subject: 'Islamic History', teacher: 'Usthad Najeeb Darimi' },
    { subject: 'Research Seminar', teacher: 'Usthad Ibrahim Faizy' },
  ],
  [
    { subject: 'Aqidah & Kalam', teacher: 'Usthad Ibrahim Faizy' },
    { subject: 'Usul al-Fiqh', teacher: 'Usthad Abdul Hakeem' },
    { subject: 'Urdu Language', teacher: 'Maulana Tariq Nadwi' },
    { subject: 'Computer & IT', teacher: 'Mr. Vivek Menon' },
    { subject: 'Library & Review', teacher: 'Faculty Mentor' },
  ],
]

export function getTimetable(student: Student): TimetableSlot[][] {
  if (student.id === 'std-1') return baseSchedule
  return baseSchedule.map((dayRow, idx) =>
    idx % 2 === 0 ? [...dayRow].reverse() : dayRow,
  )
}

export const EXAM_RESULTS_URL = 'https://jamiathulhind.com/index.php'
