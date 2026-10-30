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

export const students: Student[] = [
  {
    id: 'std-1',
    name: 'Muhammed Sinan Edayur',
    firstName: 'Muhammed Sinan',
    className: 'S3 Da’wa',
    admissionNo: 'ICS-2026-0142',
    attendance: {
      present: 261,
      absent: 8,
      leave: 15,
    },
    monthlyAttendance: [
      { id: '2026-01', month: 'January', shortMonth: 'Jan', year: 2026, present: 22, absent: 1, leave: 1 },
      { id: '2026-02', month: 'February', shortMonth: 'Feb', year: 2026, present: 20, absent: 1, leave: 1 },
      { id: '2026-03', month: 'March', shortMonth: 'Mar', year: 2026, present: 23, absent: 0, leave: 2 },
      { id: '2026-04', month: 'April', shortMonth: 'Apr', year: 2026, present: 21, absent: 1, leave: 1 },
      { id: '2026-05', month: 'May', shortMonth: 'May', year: 2026, present: 20, absent: 0, leave: 1 },
      { id: '2026-06', month: 'June', shortMonth: 'Jun', year: 2026, present: 21, absent: 2, leave: 1 },
      { id: '2026-07', month: 'July', shortMonth: 'Jul', year: 2026, present: 24, absent: 0, leave: 2 },
      { id: '2026-08', month: 'August', shortMonth: 'Aug', year: 2026, present: 23, absent: 1, leave: 1 },
      { id: '2026-09', month: 'September', shortMonth: 'Sep', year: 2026, present: 21, absent: 1, leave: 2 },
      { id: '2026-10', month: 'October', shortMonth: 'Oct', year: 2026, present: 22, absent: 0, leave: 1 },
      { id: '2026-11', month: 'November', shortMonth: 'Nov', year: 2026, present: 22, absent: 1, leave: 1 },
      { id: '2026-12', month: 'December', shortMonth: 'Dec', year: 2026, present: 22, absent: 0, leave: 1 },
    ],
  },
  {
    id: 'std-2',
    name: 'Ahmad Fawaz K.P.',
    firstName: 'Ahmad Fawaz',
    className: 'S2 Da’wa',
    admissionNo: 'ICS-2026-0189',
    attendance: {
      present: 267,
      absent: 5,
      leave: 12,
    },
    monthlyAttendance: [
      { id: '2026-01', month: 'January', shortMonth: 'Jan', year: 2026, present: 23, absent: 0, leave: 1 },
      { id: '2026-02', month: 'February', shortMonth: 'Feb', year: 2026, present: 21, absent: 0, leave: 1 },
      { id: '2026-03', month: 'March', shortMonth: 'Mar', year: 2026, present: 23, absent: 1, leave: 1 },
      { id: '2026-04', month: 'April', shortMonth: 'Apr', year: 2026, present: 22, absent: 0, leave: 1 },
      { id: '2026-05', month: 'May', shortMonth: 'May', year: 2026, present: 20, absent: 0, leave: 1 },
      { id: '2026-06', month: 'June', shortMonth: 'Jun', year: 2026, present: 22, absent: 0, leave: 2 },
      { id: '2026-07', month: 'July', shortMonth: 'Jul', year: 2026, present: 24, absent: 1, leave: 1 },
      { id: '2026-08', month: 'August', shortMonth: 'Aug', year: 2026, present: 23, absent: 0, leave: 2 },
      { id: '2026-09', month: 'September', shortMonth: 'Sep', year: 2026, present: 22, absent: 1, leave: 1 },
      { id: '2026-10', month: 'October', shortMonth: 'Oct', year: 2026, present: 23, absent: 0, leave: 0 },
      { id: '2026-11', month: 'November', shortMonth: 'Nov', year: 2026, present: 22, absent: 1, leave: 1 },
      { id: '2026-12', month: 'December', shortMonth: 'Dec', year: 2026, present: 22, absent: 1, leave: 0 },
    ],
  },
  {
    id: 'std-3',
    name: 'Zayd Abdullah M.',
    firstName: 'Zayd Abdullah',
    className: 'S1 Da’wa',
    admissionNo: 'ICS-2026-0214',
    attendance: {
      present: 252,
      absent: 12,
      leave: 20,
    },
    monthlyAttendance: [
      { id: '2026-01', month: 'January', shortMonth: 'Jan', year: 2026, present: 21, absent: 1, leave: 2 },
      { id: '2026-02', month: 'February', shortMonth: 'Feb', year: 2026, present: 19, absent: 1, leave: 2 },
      { id: '2026-03', month: 'March', shortMonth: 'Mar', year: 2026, present: 22, absent: 1, leave: 2 },
      { id: '2026-04', month: 'April', shortMonth: 'Apr', year: 2026, present: 21, absent: 1, leave: 1 },
      { id: '2026-05', month: 'May', shortMonth: 'May', year: 2026, present: 19, absent: 1, leave: 1 },
      { id: '2026-06', month: 'June', shortMonth: 'Jun', year: 2026, present: 20, absent: 2, leave: 2 },
      { id: '2026-07', month: 'July', shortMonth: 'Jul', year: 2026, present: 23, absent: 1, leave: 2 },
      { id: '2026-08', month: 'August', shortMonth: 'Aug', year: 2026, present: 22, absent: 1, leave: 2 },
      { id: '2026-09', month: 'September', shortMonth: 'Sep', year: 2026, present: 21, absent: 1, leave: 2 },
      { id: '2026-10', month: 'October', shortMonth: 'Oct', year: 2026, present: 20, absent: 1, leave: 2 },
      { id: '2026-11', month: 'November', shortMonth: 'Nov', year: 2026, present: 22, absent: 1, leave: 1 },
      { id: '2026-12', month: 'December', shortMonth: 'Dec', year: 2026, present: 22, absent: 0, leave: 1 },
    ],
  },
]

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
    body: 'Hall tickets and seating arrangements for S1–S4 Da’wa batches are now available at the academic office.',
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
    { subject: 'Hadith Studies', teacher: 'UsthadZubair Wafy' },
  ],
  [
    { subject: 'Usul al-Fiqh', teacher: 'Usthad Abdul Hakeem' },
    { subject: 'Hadith Studies', teacher: 'Usthad Zubair Wafy' },
    { subject: 'World History', teacher: 'Mr. Haris K.' },
    { subject: 'Arabic Grammar', teacher: 'Prof. Salman Hudawi' },
    { subject: 'Da’wa Practicum', teacher: 'Usthadajeeb Darimi' },
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
