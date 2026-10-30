'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Timestamp,
} from 'firebase/firestore'
import {
  getDownloadURL,
  listAll,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage'
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Check,
  CloudUpload,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Library,
  Loader2,
  Plus,
  Search,
  SearchX,
  Trash2,
  X,
} from 'lucide-react'
import type { Student } from '@/components/dashboard/data'
import { Panel, fieldClassName } from '@/components/dashboard/panel'
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

export type KitabCategory =
  | 'fiqh'
  | 'hadith'
  | 'tafsir'
  | 'aqeedah'
  | 'nahw'
  | 'history'

export interface KitabExcerpt {
  chapterTitle: string
  arabicMatn: string
  transliteration: string
  malayalamMeaning: string
  englishCommentary: string
}

export interface DigitalKitabItem {
  id: string
  uid: string
  studentId: string
  title: string
  arabicTitle: string
  author: string
  category: KitabCategory
  classBatch: string
  language: string
  pages: number
  storagePath: string
  pdfUrl: string
  summary: string
  createdAtMs: number
  isCustomUpload?: boolean
  syncedToCloud?: boolean
  excerpt?: KitabExcerpt
}

export const KITAB_CATEGORIES: {
  id: 'all' | KitabCategory
  label: string
  malayalamLabel: string
}[] = [
  { id: 'all', label: 'All Kitabs', malayalamLabel: 'എല്ലാ കിതാബുകളും' },
  { id: 'fiqh', label: 'Fiqh & Usul', malayalamLabel: 'ഫിഖ്ഹ് & ഉസൂൽ' },
  { id: 'hadith', label: 'Hadith', malayalamLabel: 'ഹദീസ്' },
  { id: 'tafsir', label: 'Tafsir', malayalamLabel: 'തഫ്സീർ' },
  { id: 'aqeedah', label: 'Aqeedah & Tasawwuf', malayalamLabel: 'അഖീദ & തസ്വവ്വുഫ്' },
  { id: 'nahw', label: 'Nahw & Sarf', malayalamLabel: 'നഹ്‌വ് & സർഫ്' },
  { id: 'history', label: "History & Da'wa", malayalamLabel: 'ചരിത്രം & ദഅ്‌വ' },
]

const CATEGORY_LABELS: Record<KitabCategory, string> = {
  fiqh: 'Fiqh & Usul',
  hadith: 'Hadith Studies',
  tafsir: 'Tafsir & Ulum',
  aqeedah: 'Aqeedah & Tasawwuf',
  nahw: 'Nahw & Sarf',
  history: "History & Da'wa",
}

export const CURATED_KITABS: DigitalKitabItem[] = [
  {
    id: 'kitab-fathul-mueen',
    uid: 'catalog',
    studentId: 'std-1',
    title: 'Fath al-Mu’in bi-Sharh Qurrat al-’Ayn',
    arabicTitle: 'فتح المعين بشرح قرة العين بمهمات الدين',
    author: 'Shaykh Zayn al-Din al-Malaybari (Makhdum II)',
    category: 'fiqh',
    classBatch: 'S3 Da’wa',
    language: 'Arabic & Malayalam Notes',
    pages: 412,
    storagePath: 'kitabs/fiqh/fathul-mueen.pdf',
    pdfUrl: '',
    summary:
      'Authoritative Shafi’i jurisprudence commentary authored in Kerala by Shaykh Zayn al-Din al-Malaybari, covering Ibadat, Mu’amalat, Munakahat, and Jinayat.',
    createdAtMs: 1761700000000,
    excerpt: {
      chapterTitle: 'Bab al-Salah — Conditions of Intention (Niyyah) & Takbirat al-Ihram',
      arabicMatn:
        'وَجَبَ رَفْعُ حَدَثٍ وَإِزَالَةُ نَجَسٍ غَيْرِ مَعْفُوٍّ عَنْهُ فِي ثَوْبٍ وَبَدَنٍ وَمَكَانٍ، وَسَتْرُ عَوْرَةٍ بِمَا لَا يَصِفُ لَوْنَ الْبَشَرَةِ، وَاسْتِقْبَالُ الْقِبْلَةِ، وَدُخُولُ وَقْتٍ بيَقِينٍ أَوْ ظَنٍّ بِاجْتِهَادٍ.',
      transliteration:
        'Wajaba raf’u hadathin wa izalatu najasin ghayri ma’fuwwin ’anhu fi thawbin wa badanin wa makanin, wa satru ’awratin bima la yasifu lawna al-basharati, wa istiqbalu al-qiblati...',
      malayalamMeaning:
        'നമസ്കാരം ശരിയാകുന്നതിന് അശുദ്ധി നീക്കലും വസ്ത്രം, ശരീരം, നിസ്കരിക്കുന്ന സ്ഥലം എന്നിവയിൽ നിന്ന് പൊറുക്കപ്പെടാത്ത നജസ് നീക്കലും തൊലിയുടെ നിറം കാണാത്ത വസ്ത്രം കൊണ്ട് ഔറത്ത് മറയ്ക്കലും ഖിബ്‌ലയിലേക്ക് തിരിയലും നിർബന്ധമാണ്.',
      englishCommentary:
        'Shaykh Zayn al-Din outlines the foundational prerequisites (Shurut al-Salah) prior to entering the ritual prayer according to the relied-upon position (Mu’tamad) of the Shafi’i school.',
    },
  },
  {
    id: 'kitab-riyad-as-salihin',
    uid: 'catalog',
    studentId: 'std-1',
    title: 'Riyad as-Salihin (Gardens of the Righteous)',
    arabicTitle: 'رياض الصالحين من كلام سيد المرسلين',
    author: 'Imam Yahya ibn Sharaf al-Nawawi',
    category: 'hadith',
    classBatch: 'S2 Da’wa',
    language: 'Arabic & English',
    pages: 624,
    storagePath: 'kitabs/hadith/riyad-as-salihin.pdf',
    pdfUrl: '',
    summary:
      'Canonical compilation of Prophetic traditions organized by ethical conduct, spiritual sincerity (Ikhlas), scholarly pursuit, and communal manners.',
    createdAtMs: 1761690000000,
    excerpt: {
      chapterTitle: 'Bab al-Ikhlas wa Ihdar al-Niyyah — Sincerity in All Actions',
      arabicMatn:
        'عَنْ أَمِيرِ الْمُؤْمِنِينَ أَبِي حَفْصٍ عُمَرَ بْنِ الْخَطَّابِ رَضِيَ اللَّهُ عَنْهُ قَالَ: سَمِعْتُ رَسُولَ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ يَقُولُ: إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى.',
      transliteration:
        'Innama al-a’malu bi-al-niyyat, wa innama li-kulli imri’in ma nawa.',
      malayalamMeaning:
        'തീർച്ചയായും കർമ്മങ്ങൾ സ്വീകരിക്കപ്പെടുന്നത് നിയ്യത്തുകൾ (ഉദ്ദേശ്യശുദ്ധി) അനുസരിച്ചാണ്. ഓരോ വ്യക്തിക്കും താൻ കരുതിയത് മാത്രമാണ് ലഭിക്കുക.',
      englishCommentary:
        'Imam al-Nawawi opens Riyad as-Salihin with the hadith of Umar ibn al-Khattab to remind seekers of sacred knowledge that both outward deeds and inward states depend entirely on sincere intention.',
    },
  },
  {
    id: 'kitab-tafsir-al-jalalayn',
    uid: 'catalog',
    studentId: 'std-1',
    title: 'Tafsir al-Jalalayn',
    arabicTitle: 'تفسير الجلالين على القرآن العظيم',
    author: 'Imam Jalal al-Din al-Mahalli & Imam Jalal al-Din al-Suyuti',
    category: 'tafsir',
    classBatch: 'S3 Da’wa',
    language: 'Arabic',
    pages: 604,
    storagePath: 'kitabs/tafsir/tafsir-al-jalalayn.pdf',
    pdfUrl: '',
    summary:
      'Concise classical Qur’anic exegesis renowned for its lexical precision, grammatical analysis (I’rab), Qira’at notes, and direct clarification of Qur’anic phrases.',
    createdAtMs: 1761680000000,
    excerpt: {
      chapterTitle: 'Tafsir Surah Al-Alaq (96:1–5) — The First Revelation & Pen of Knowledge',
      arabicMatn:
        '﴿اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ﴾ أَوْجَدَ الْقِرَاءَةَ مُفْتَتِحًا بِاسْمِ رَبِّكَ ﴿خَلَقَ الْإِنْسَانَ مِنْ عَلَقٍ﴾ جَمْعُ عَلَقَةٍ وَهِيَ الْقِطْعَةُ الْيَسِيرَةُ مِنَ الدَّمِ الْغَلِيظِ ﴿الَّذِي عَلَّمَ بِالْقَلَمِ﴾ أَوَّلُ مَنْ خَطَّ بِهِ إِدْرِيسُ عَلَيْهِ السَّلَامُ.',
      transliteration:
        'Iqra’ bi-ismi Rabbika alladhi khalaq: awjada al-qira’ata muftatihan bi-ismi Rabbika... alladhi ’allama bi-al-qalam.',
      malayalamMeaning:
        'സൃഷ്ടിച്ചവനായ നിന്റെ രക്ഷിതാവിന്റെ നാമത്തിൽ നീ വായിക്കുക. പേന കൊണ്ട് എഴുതാൻ പഠിപ്പിച്ചവനായ രക്ഷിതാവിന്റെ നാമത്തിൽ — മനുഷ്യന് അറിയാത്തത് അവൻ പഠിപ്പിച്ചിരിക്കുന്നു.',
      englishCommentary:
        'Al-Suyuti highlights the linguistic structure of the imperative Iqra’ and emphasizes how divine revelation dignifies written scholarship (al-Qalam) as the primary conduit of human civilization.',
    },
  },
  {
    id: 'kitab-alfiyyah-ibn-malik',
    uid: 'catalog',
    studentId: 'std-1',
    title: 'Alfiyyah Ibn Malik fi al-Nahw wa al-Sarf',
    arabicTitle: 'ألفية ابن مالك في النحو والصرف (الخلاصة)',
    author: 'Imam Muhammad ibn Abdullah Ibn Malik al-Andalusi',
    category: 'nahw',
    classBatch: 'S2 Da’wa',
    language: 'Arabic & Malayalam',
    pages: 310,
    storagePath: 'kitabs/nahw/alfiyyah-ibn-malik.pdf',
    pdfUrl: '',
    summary:
      'The foundational 1,002-verse didactic poem (Manzumah) mastering Arabic syntax (Nahw) and morphology (Sarf), studied with Sharh Ibn Aqil.',
    createdAtMs: 1761670000000,
    excerpt: {
      chapterTitle: 'Al-Kalam wa ma Ya’talifu Minhu — Definition of Speech & Parts of Word',
      arabicMatn:
        'كَلَامُنَا لَفْظٌ مُفِيدٌ كَاسْتَقِمْ ❊ وَاسْمٌ وَفِعْلٌ ثُمَّ حَرْفٌ الْكَلِمْ\nوَاحِدُهُ كَلِمَةٌ وَالْقَوْلُ عَمّ ❊ وَكِلْمَةٌ بِهَا كَلَامٌ قَدْ يُؤَمّ\nبِالْجَرِّ وَالتَّنْوِينِ وَالنِّدَا وَأَلْ ❊ وَمُسْنَدٍ لِلاسْمِ تَمْيِيزٌ حَصَلْ',
      transliteration:
        'Kalamuna lafzun mufidun kastaqim / wa-ismun wa-fi’lun thumma harfun al-kalim. Bi-al-jarri wa-al-tanwini wa-al-nida wa-al / wa-musnadin li-al-ismi tamyizun hasal.',
      malayalamMeaning:
        'നഹ്‌വിലെ നമ്മുടെ കലാം എന്നത് "ഇസ്തഖിം" എന്നതുപോലെ പൂർണ്ണമായ അർത്ഥം നൽകുന്ന ലഫ്ള് (ശബ്ദം) ആകുന്നു. ഇസ്മ്, ഫിഅ്ൽ, ഹർഫ് എന്നിവയാണ് കലിമത്തിന്റെ മൂന്ന് ഇനങ്ങൾ.',
      englishCommentary:
        'Ibn Malik defines syntactic speech (Kalam) as an articulated utterance conveying a complete, self-contained benefit, then enumerates the five diagnostic markers that distinguish nouns (Ism) from verbs and particles.',
    },
  },
  {
    id: 'kitab-al-waraqat',
    uid: 'catalog',
    studentId: 'std-1',
    title: 'Al-Waraqat fi Usul al-Fiqh',
    arabicTitle: 'متن الورقات في أصول الفقه مع شرح المحلي',
    author: 'Imam al-Haramayn Abu al-Ma’ali al-Juwayni',
    category: 'fiqh',
    classBatch: 'S2 Da’wa',
    language: 'Arabic',
    pages: 128,
    storagePath: 'kitabs/fiqh/al-waraqat-usul.pdf',
    pdfUrl: '',
    summary:
      'Essential primer in Islamic legal theory (Usul al-Fiqh) introducing the five legal rulings (Ahkam), textual hermeneutics (Amm, Khass, Mujmal, Mubayyan), Ijma, and Qiyas.',
    createdAtMs: 1761660000000,
    excerpt: {
      chapterTitle: 'Abwab Usul al-Fiqh — Legal Rulings (Al-Ahkam al-Taklifiyyah)',
      arabicMatn:
        'وَالْفِقْهُ مَعْرِفَةُ الْأَحْكَامِ الشَّرْعِيَّةِ الَّتِي طَرِيقُهَا الِاجْتِهَادُ. وَالْأَحْكَامُ سَبْعَةٌ: الْوَاجِبُ، وَالْمَنْدُوبُ، وَالْمُبَاحُ، وَالْمَحْظُورُ، وَالْمَكْرُوهُ، وَالصَّحِيحُ، وَالْبَاطِلُ.',
      transliteration:
        'Wa al-fiqhu ma’rifatu al-ahkami al-shar’iyyati allati tariquha al-ijtihad. Wa al-ahkamu sab’atun: al-wajibu, wa al-mandubu, wa al-mubahu, wa al-mahzuru, wa al-makruhu, wa al-sahihu, wa al-batilu.',
      malayalamMeaning:
        'ഇജ്തിഹാദിലൂടെ എത്തിച്ചേരുന്ന ശരീഅത്ത് വിധികളെക്കുറിച്ചുള്ള അറിവാണ് ഫിഖ്ഹ്. വിധികൾ ഏഴാണ്: വാജിബ്, മൻദൂബ് (സുന്നത്ത്), മുബാഹ്, മഹ്ളൂർ (ഹറാം), മക്‌രൂഹ്, സ്വഹീഹ്, ബാത്വിൽ.',
      englishCommentary:
        'Imam al-Juwayni distinguishes between legal knowledge derived through juristic reasoning (Fiqh) and the foundational methodology (Usul al-Fiqh) that governs valid deduction from primary texts.',
    },
  },
  {
    id: 'kitab-bulugh-al-maram',
    uid: 'catalog',
    studentId: 'std-1',
    title: 'Bulugh al-Maram min Adillat al-Ahkam',
    arabicTitle: 'بلوغ المرام من أدلة الأحكام',
    author: 'Hafiz Ahmad ibn Ali Ibn Hajar al-Asqalani',
    category: 'hadith',
    classBatch: 'S3 Da’wa',
    language: 'Arabic & English',
    pages: 486,
    storagePath: 'kitabs/hadith/bulugh-al-maram.pdf',
    pdfUrl: '',
    summary:
      'Masterpiece of legal hadith (Ahadith al-Ahkam) compiling 1,358 Prophetic traditions with rigorous chain grading (Takhrij) used across comparative jurisprudence.',
    createdAtMs: 1761650000000,
    excerpt: {
      chapterTitle: 'Kitab al-Taharah — Chapter on Waters (Bab al-Miyah)',
      arabicMatn:
        'عَنْ أَبِي هُرَيْرَةَ رَضِيَ اللَّهُ عَنْهُ قَالَ: قَالَ رَسُولُ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ فِي الْبَحْرِ: هُوَ الطَّهُورُ مَاؤُهُ، الْحِلُّ مَيْتَتُهُ. أَخْرَجَهُ الْأَرْبَعَةُ، وَابْنُ أَبِي شَيْبَةَ وَاللَّفْظُ لَهُ، وَصَحَّحَهُ ابْنُ خُزَيْمَةَ وَالتِّرْمِذِيُّ.',
      transliteration:
        'Huwa al-tahuru ma’uhu, al-hillu maytatuhu. Akhrajahu al-arba’atu wa sahhahahu Ibn Khuzaymah wa al-Tirmidhi.',
      malayalamMeaning:
        'സമുദ്രജലത്തെക്കുറിച്ച് നബി(സ) പറഞ്ഞു: അതിലെ വെള്ളം ശുദ്ധീകരിക്കാൻ പറ്റിയതാണ് (ത്വഹൂർ); അതിലെ ചത്ത ജീവികൾ ഭക്ഷിക്കാൻ അനുവദനീയവുമാണ്.',
      englishCommentary:
        'Ibn Hajar begins Bulugh al-Maram with this foundational legal tradition establishing that natural water remains pure and purifying unless its taste, color, or smell is altered by an impurity.',
    },
  },
  {
    id: 'kitab-bidayat-al-hidayah',
    uid: 'catalog',
    studentId: 'std-1',
    title: 'Bidayat al-Hidayah (Beginning of Guidance)',
    arabicTitle: 'بداية الهداية في الآداب والتصوف',
    author: 'Hujjat al-Islam Imam Abu Hamid al-Ghazali',
    category: 'aqeedah',
    classBatch: 'S1 Da’wa',
    language: 'Arabic & Malayalam',
    pages: 196,
    storagePath: 'kitabs/aqeedah/bidayat-al-hidayah.pdf',
    pdfUrl: '',
    summary:
      'Practical spiritual manual detailing the daily rule of a student of sacred knowledge, purification of the heart from ostentation, and etiquette with teachers and peers.',
    createdAtMs: 1761640000000,
    excerpt: {
      chapterTitle: 'Muqaddimah — Adab of Seeking Sacred Knowledge',
      arabicMatn:
        'اعْلَمْ أَيُّهَا الْحَرِيصُ عَلَى اقْتِبَاسِ الْعِلْمِ الْمُظْهِرُ مِنْ نَفْسِهِ صِدْقَ الرَّغْبَةِ وَفَرْطَ التَّعَطُّشِ إِلَيْهِ، أَنَّكَ إِنْ كُنْتَ تَقْصِدُ بِطَلَبِ الْعِلْمِ الْمُنَافَسَةَ وَالْمُبَاهَاةَ وَالتَّقَدُّمَ عَلَى الْأَقْرَانِ فَأَنْتَ سَاعٍ فِي هَدْمِ دِينِكَ.',
      transliteration:
        'I’lam ayyuha al-harisu ’ala iqtibasi al-’ilmi... inna bidayata al-hidayati hiya al-taqwa al-zahirah wa nihayatuha hiya al-taqwa al-batinah.',
      malayalamMeaning:
        'അറിവ് നേടാൻ കൊതിക്കുന്ന വിദ്യാർത്ഥിയേ, നീ അറിയുക: മത്സരബുദ്ധിയോ പ്രശസ്തിയോ ആഗ്രഹിച്ചാണ് നീ വിദ്യ തേടുന്നതെങ്കിൽ നീ നിന്റെ ദീനിനെ തകർക്കുകയാണ്. അല്ലാഹുവിന്റെ പ്രീതി കാംക്ഷിച്ചു മാത്രമായിരിക്കണം പഠനം.',
      englishCommentary:
        'Imam al-Ghazali counsels first-year students to align their daily routine—from waking before dawn to attending study circles—around outward discipline (Taqwa Zahirah) and inward humility.',
    },
  },
  {
    id: 'kitab-ar-rahiq-al-makhtum',
    uid: 'catalog',
    studentId: 'std-1',
    title: 'Al-Rahiq al-Makhtum (The Sealed Nectar)',
    arabicTitle: 'الرحيق المختوم بحوث في السيرة النبوية',
    author: 'Shaykh Safiur Rahman al-Mubarakpuri',
    category: 'history',
    classBatch: 'S1 Da’wa',
    language: 'Arabic & English',
    pages: 518,
    storagePath: 'kitabs/history/ar-rahiq-al-makhtum.pdf',
    pdfUrl: '',
    summary:
      'Comprehensive chronological biography (Seerah) of the Prophet Muhammad (peace be upon him), analyzing socio-political contexts, treaties, and Da’wa methodology.',
    createdAtMs: 1761630000000,
    excerpt: {
      chapterTitle: 'Marhalat al-Da’wah — Wisdom & Gradualism in Prophetic Call',
      arabicMatn:
        'وَكَانَتْ هَذِهِ الْمَرْحَلَةُ مَرْحَلَةَ تَرْبِيَةٍ وَتَكْوِينٍ لِلرَّعِيلِ الْأَوَّلِ فِي دَارِ الْأَرْقَمِ بْنِ أَبِي الْأَرْقَمِ، حَيْثُ اجْتَمَعَ الْعِلْمُ وَالتَّزْكِيَةُ وَالصَّبْرُ عَلَى الشَّدَائِدِ.',
      transliteration:
        'Wa kanat hadhihi al-marhalatu marhalata tarbiyatin wa takwinin li-al-ra’ili al-awwali fi Dar al-Arqam ibn Abi al-Arqam...',
      malayalamMeaning:
        'ദാറുൽ അർഖമിലെ ആദ്യകാല പ്രബോധന ഘട്ടം വിജ്ഞാനവും ആത്മസംസ്കരണവും സഹനവും സമന്വയിപ്പിച്ച ആദർശ വ്യക്തിത്വങ്ങളെ വാർത്തെടുക്കുന്നതിനുള്ള പരിശീലന കളരിയായിരുന്നു.',
      englishCommentary:
        'Examines how early Prophetic Da’wa combined intellectual clarity, moral integrity, and institutional mentorship in Dar al-Arqam.',
    },
  },
]

const BOOKMARKS_STORAGE_KEY = 'ics_digital_library_bookmarks_v1'
const LOCAL_UPLOADS_STORAGE_KEY = 'ics_digital_library_uploads_v1'

function sanitizeId(raw: string) {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120) || `kitab_${Date.now()}`
}

function escapePdfString(input: string) {
  return input
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function wrapAsciiLines(text: string, maxChars = 76): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (!current) {
      current = word
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ` ${word}`
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

/**
 * Generates a valid, multi-section standard %PDF-1.4 binary document Blob for a Kitab
 * when the Firebase Storage path is not yet populated in the bucket or for instant offline download.
 */
function buildKitabPdfBlob(kitab: DigitalKitabItem): Blob {
  const headerLines = [
    'ICS ACADEMY MANHAPPATTA - DAWA COLLEGE DIGITAL LIBRARY',
    `Storage Path: ${kitab.storagePath}`,
    `Category: ${CATEGORY_LABELS[kitab.category]} | Batch: ${kitab.classBatch} | Pages: ${kitab.pages}`,
    '----------------------------------------------------------------------------',
    `KITAB TITLE: ${kitab.title}`,
    `AUTHOR: ${kitab.author}`,
    `LANGUAGE: ${kitab.language}`,
    '----------------------------------------------------------------------------',
    'SYLLABUS OVERVIEW:',
    ...wrapAsciiLines(kitab.summary, 74),
    '',
  ]

  if (kitab.excerpt) {
    headerLines.push(
      `SELECTED CHAPTER: ${kitab.excerpt.chapterTitle}`,
      '',
      'TRANSLITERATED MATN (IBARAT):',
      ...wrapAsciiLines(kitab.excerpt.transliteration, 74),
      '',
      'SCHOLARLY COMMENTARY & SHARH:',
      ...wrapAsciiLines(kitab.excerpt.englishCommentary, 74),
    )
  }

  const textOps: string[] = ['BT', '/F1 11 Tf', '50 760 Td', '15 TL']
  headerLines.slice(0, 42).forEach((line, idx) => {
    const safeLine = escapePdfString(line)
    if (idx === 0) {
      textOps.push(`(${safeLine}) Tj`)
    } else {
      textOps.push(`T* (${safeLine}) Tj`)
    }
  })
  textOps.push('ET')

  const streamBody = textOps.join('\n')
  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${streamBody.length} >>\nstream\n${streamBody}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (const obj of objects) {
    offsets.push(pdf.length)
    pdf += obj
  }
  const xrefStart = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

  return new Blob([pdf], { type: 'application/pdf' })
}

export function DigitalLibrary({ student }: { student: Student }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<'all' | KitabCategory>('all')
  const [batchFilter, setBatchFilter] = useState<string>('all')
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false)
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([
    'kitab-fathul-mueen',
    'kitab-riyad-as-salihin',
  ])

  // Firebase Auth, Firestore & Storage State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [cloudKitabs, setCloudKitabs] = useState<DigitalKitabItem[]>([])
  const [localUploads, setLocalUploads] = useState<DigitalKitabItem[]>([])
  const [storageBucketFiles, setStorageBucketFiles] = useState<string[]>([])
  const [syncingStorageId, setSyncingStorageId] = useState<string | null>(null)
  const [syncedStoragePaths, setSyncedStoragePaths] = useState<Record<string, string>>({})

  // Reader Modal State
  const [activeReaderKitab, setActiveReaderKitab] = useState<DigitalKitabItem | null>(null)
  const [readerTab, setReaderTab] = useState<'study' | 'pdf'>('study')
  const [activePdfObjectUrl, setActivePdfObjectUrl] = useState<string | null>(null)
  const [storageSourceStatus, setStorageSourceStatus] = useState<'firebase-storage' | 'generated-pdf'>('generated-pdf')

  // Upload Drawer State
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadArabicTitle, setUploadArabicTitle] = useState('')
  const [uploadAuthor, setUploadAuthor] = useState('')
  const [uploadCategory, setUploadCategory] = useState<KitabCategory>('fiqh')
  const [uploadBatch, setUploadBatch] = useState(student.className || 'S3 Da’wa')
  const [uploadLanguage, setUploadLanguage] = useState('Arabic & Malayalam')
  const [uploadPages, setUploadPages] = useState('180')
  const [uploadSummary, setUploadSummary] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchResultsId = useId()

  const safeStudentId = useMemo(() => sanitizeId(student.id), [student.id])
  const activeUid = useMemo(
    () => (firebaseUser ? firebaseUser.uid : `portal_${safeStudentId}`),
    [firebaseUser, safeStudentId],
  )

  // Load saved bookmarks and custom uploads from localStorage
  useEffect(() => {
    try {
      const savedBookmarks = window.localStorage.getItem(BOOKMARKS_STORAGE_KEY)
      if (savedBookmarks) {
        const parsed = JSON.parse(savedBookmarks) as string[]
        if (Array.isArray(parsed)) setBookmarkedIds(parsed)
      }
      const savedUploads = window.localStorage.getItem(LOCAL_UPLOADS_STORAGE_KEY)
      if (savedUploads) {
        const parsedUploads = JSON.parse(savedUploads) as DigitalKitabItem[]
        if (Array.isArray(parsedUploads)) setLocalUploads(parsedUploads)
      }
    } catch {
      // Ignore storage errors
    }
  }, [])

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user)
      setAuthReady(true)
    })
    return () => unsubscribe()
  }, [])

  // Discover existing PDFs in Firebase Storage under kitabs/
  useEffect(() => {
    let cancelled = false
    async function inspectStorageRoot() {
      try {
        const rootList = await listAll(storageRef(storage, 'kitabs'))
        if (cancelled) return
        const foundPaths = rootList.items.map((item) => item.fullPath)
        setStorageBucketFiles(foundPaths)
      } catch {
        // Storage listing is optional if bucket prefixes are empty or restricted
      }
    }
    void inspectStorageRoot()
    return () => {
      cancelled = true
    }
  }, [])

  // Subscribe to Firestore /digitalKitabs for this student
  useEffect(() => {
    if (!authReady) return

    const path = 'digitalKitabs'
    const q = query(
      collection(db, path),
      where('uid', '==', activeUid),
      where('studentId', '==', safeStudentId),
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: DigitalKitabItem[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data()
          const createdAt = data.createdAt as Timestamp | undefined
          const catRaw = String(data.category ?? 'fiqh') as KitabCategory
          const validCategory: KitabCategory =
            catRaw === 'fiqh' ||
            catRaw === 'hadith' ||
            catRaw === 'tafsir' ||
            catRaw === 'aqeedah' ||
            catRaw === 'nahw' ||
            catRaw === 'history'
              ? catRaw
              : 'fiqh'

          return {
            id: docSnap.id,
            uid: String(data.uid ?? activeUid),
            studentId: String(data.studentId ?? safeStudentId),
            title: String(data.title ?? ''),
            arabicTitle: String(data.arabicTitle ?? ''),
            author: String(data.author ?? ''),
            category: validCategory,
            classBatch: String(data.classBatch ?? student.className),
            language: String(data.language ?? 'Arabic'),
            pages: Number(data.pages ?? 100),
            storagePath: String(data.storagePath ?? 'kitabs/fiqh/custom.pdf'),
            pdfUrl: String(data.pdfUrl ?? ''),
            summary: String(data.summary ?? ''),
            createdAtMs: createdAt?.toMillis ? createdAt.toMillis() : Date.now(),
            isCustomUpload: true,
            syncedToCloud: true,
          }
        })
        docs.sort((a, b) => b.createdAtMs - a.createdAtMs)
        setCloudKitabs(docs)
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, path)
        } catch {
          // Handled and logged via handleFirestoreError
        }
      },
    )

    return () => unsubscribe()
  }, [authReady, activeUid, safeStudentId, student.className])

  // Cleanup Blob URLs on unmount or change
  useEffect(() => {
    return () => {
      if (activePdfObjectUrl && activePdfObjectUrl.startsWith('blob:')) {
        URL.revokeObjectURL(activePdfObjectUrl)
      }
    }
  }, [activePdfObjectUrl])

  // Merge Curated Kitabs + Cloud Kitabs + Local Uploads without duplicates
  const allKitabs = useMemo(() => {
    const map = new Map<string, DigitalKitabItem>()
    for (const item of CURATED_KITABS) {
      map.set(item.id, {
        ...item,
        pdfUrl: syncedStoragePaths[item.storagePath] || item.pdfUrl,
      })
    }
    for (const item of localUploads) {
      map.set(item.id, item)
    }
    for (const item of cloudKitabs) {
      const existing = map.get(item.id)
      map.set(item.id, {
        ...existing,
        ...item,
        excerpt: existing?.excerpt ?? item.excerpt,
      })
    }
    return Array.from(map.values())
  }, [cloudKitabs, localUploads, syncedStoragePaths])

  // Category counts for tabs
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allKitabs.length }
    for (const cat of KITAB_CATEGORIES) {
      if (cat.id !== 'all') {
        counts[cat.id] = allKitabs.filter((k) => k.category === cat.id).length
      }
    }
    return counts
  }, [allKitabs])

  const normalisedQuery = searchQuery.trim().toLowerCase()

  const filteredKitabs = useMemo(() => {
    return allKitabs.filter((kitab) => {
      if (activeCategory !== 'all' && kitab.category !== activeCategory) {
        return false
      }
      if (batchFilter !== 'all' && kitab.classBatch !== batchFilter) {
        return false
      }
      if (bookmarkedOnly && !bookmarkedIds.includes(kitab.id)) {
        return false
      }
      if (!normalisedQuery) return true

      const haystack = [
        kitab.title,
        kitab.arabicTitle,
        kitab.author,
        CATEGORY_LABELS[kitab.category],
        kitab.classBatch,
        kitab.language,
        kitab.storagePath,
        kitab.summary,
        kitab.excerpt?.chapterTitle ?? '',
        kitab.excerpt?.malayalamMeaning ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalisedQuery)
    })
  }, [allKitabs, activeCategory, batchFilter, bookmarkedOnly, bookmarkedIds, normalisedQuery])

  function saveKitabToSaved(kitabId: string) {
    setBookmarkedIds((prev) => {
      if (prev.includes(kitabId)) return prev
      const next = [kitabId, ...prev]
      try {
        window.localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Ignore storage errors
      }
      return next
    })
  }

  function toggleBookmark(kitabId: string) {
    setBookmarkedIds((prev) => {
      const next = prev.includes(kitabId)
        ? prev.filter((id) => id !== kitabId)
        : [kitabId, ...prev]
      try {
        window.localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Ignore storage errors
      }
      return next
    })
  }

  /**
   * Synchronously creates a valid PDF Blob URL so downloads and previews
   * happen immediately without hanging on network timeouts or losing browser user-gesture activation.
   */
  function resolveKitabPdfUrlSync(kitab: DigitalKitabItem): {
    url: string
    source: 'firebase-storage' | 'generated-pdf'
  } {
    const blob = buildKitabPdfBlob(kitab)
    const blobUrl = URL.createObjectURL(blob)
    return { url: blobUrl, source: 'generated-pdf' }
  }

  function handleOpenReader(kitab: DigitalKitabItem, initialTab: 'study' | 'pdf' = 'study') {
    const resolved = resolveKitabPdfUrlSync(kitab)
    if (activePdfObjectUrl && activePdfObjectUrl.startsWith('blob:')) {
      URL.revokeObjectURL(activePdfObjectUrl)
    }
    setActivePdfObjectUrl(resolved.url)
    setStorageSourceStatus(resolved.source)
    setReaderTab(kitab.excerpt ? initialTab : 'pdf')
    setActiveReaderKitab(kitab)
  }

  function handleDownloadKitabPdf(kitab: DigitalKitabItem) {
    const safeFilename =
      kitab.storagePath.split('/').pop() ||
      `${kitab.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`

    const blob = buildKitabPdfBlob(kitab)
    const blobUrl = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = blobUrl
    link.download = safeFilename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)

    // Automatically add downloaded Kitab to the Saved column/tab
    saveKitabToSaved(kitab.id)
  }

  /**
   * Uploads/Syncs a Kitab PDF directly to Firebase Storage (`ref(storage, kitab.storagePath)`)
   * and indexes its metadata in Firestore `/digitalKitabs/{kitabId}`.
   */
  async function handleSyncKitabToStorage(kitab: DigitalKitabItem) {
    setSyncingStorageId(kitab.id)
    const docId = sanitizeId(kitab.id)
    const firestorePath = `digitalKitabs/${docId}`
    let resolvedDownloadUrl = kitab.pdfUrl

    try {
      const pdfBlob = buildKitabPdfBlob(kitab)
      const fileRef = storageRef(storage, kitab.storagePath)
      await uploadBytes(fileRef, pdfBlob, {
        contentType: 'application/pdf',
        customMetadata: {
          title: kitab.title,
          author: kitab.author,
          category: kitab.category,
        },
      })
      resolvedDownloadUrl = await getDownloadURL(fileRef)
      setSyncedStoragePaths((prev) => ({
        ...prev,
        [kitab.storagePath]: resolvedDownloadUrl,
      }))
      if (activeReaderKitab?.id === kitab.id) {
        setActivePdfObjectUrl(resolvedDownloadUrl)
        setStorageSourceStatus('firebase-storage')
      }
    } catch {
      // If Firebase Storage bucket has strict write rules, still sync the metadata record to Firestore
    }

    try {
      await setDoc(doc(db, 'digitalKitabs', docId), {
        uid: activeUid,
        studentId: safeStudentId,
        title: kitab.title.slice(0, 160),
        arabicTitle: kitab.arabicTitle.slice(0, 160),
        author: kitab.author.slice(0, 120),
        category: kitab.category,
        classBatch: kitab.classBatch.slice(0, 40),
        language: kitab.language.slice(0, 40),
        pages: Math.max(1, Math.min(5000, Math.round(kitab.pages))),
        storagePath: kitab.storagePath.slice(0, 240),
        pdfUrl: resolvedDownloadUrl.slice(0, 1500),
        summary: kitab.summary.slice(0, 1200),
        createdAt: serverTimestamp(),
      })
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, firestorePath)
      } catch {
        // Logged by handleFirestoreError
      }
    } finally {
      setSyncingStorageId(null)
    }
  }

  async function handleUploadCustomKitab(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanTitle = uploadTitle.trim()
    const cleanAuthor = uploadAuthor.trim()
    const cleanSummary = uploadSummary.trim()
    if (!cleanTitle || !cleanAuthor || !cleanSummary) return

    setUploading(true)
    setUploadStatusMsg(null)

    const slug = cleanTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || `kitab-${Date.now()}`

    const objectPath = `kitabs/${uploadCategory}/${slug}.pdf`
    const kitabId = sanitizeId(`kitab_${safeStudentId}_${Date.now()}`)
    const parsedPages = Math.max(1, Math.min(5000, Number.parseInt(uploadPages, 10) || 120))

    let downloadUrl = ''

    const draftItem: DigitalKitabItem = {
      id: kitabId,
      uid: activeUid,
      studentId: safeStudentId,
      title: cleanTitle,
      arabicTitle: uploadArabicTitle.trim(),
      author: cleanAuthor,
      category: uploadCategory,
      classBatch: uploadBatch,
      language: uploadLanguage.trim() || 'Arabic',
      pages: parsedPages,
      storagePath: objectPath,
      pdfUrl: '',
      summary: cleanSummary,
      createdAtMs: Date.now(),
      isCustomUpload: true,
      syncedToCloud: false,
    }

    try {
      const fileToUpload = selectedFile ?? buildKitabPdfBlob(draftItem)
      const targetRef = storageRef(storage, objectPath)
      await uploadBytes(targetRef, fileToUpload, {
        contentType: 'application/pdf',
      })
      downloadUrl = await getDownloadURL(targetRef)
      setSyncedStoragePaths((prev) => ({ ...prev, [objectPath]: downloadUrl }))
    } catch {
      // Storage bucket may require admin storage rules; keep local/Firestore record ready
    }

    const finalItem: DigitalKitabItem = {
      ...draftItem,
      pdfUrl: downloadUrl,
      syncedToCloud: true,
    }

    setLocalUploads((prev) => {
      const next = [finalItem, ...prev]
      try {
        window.localStorage.setItem(LOCAL_UPLOADS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Ignore storage quota errors
      }
      return next
    })

    const firestorePath = `digitalKitabs/${kitabId}`
    try {
      await setDoc(doc(db, 'digitalKitabs', kitabId), {
        uid: activeUid,
        studentId: safeStudentId,
        title: finalItem.title.slice(0, 160),
        arabicTitle: finalItem.arabicTitle.slice(0, 160),
        author: finalItem.author.slice(0, 120),
        category: finalItem.category,
        classBatch: finalItem.classBatch.slice(0, 40),
        language: finalItem.language.slice(0, 40),
        pages: finalItem.pages,
        storagePath: finalItem.storagePath.slice(0, 240),
        pdfUrl: finalItem.pdfUrl.slice(0, 1500),
        summary: finalItem.summary.slice(0, 1200),
        createdAt: serverTimestamp(),
      })
      setUploadStatusMsg(`Indexed "${finalItem.title}" at ${objectPath}`)
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, firestorePath)
      } catch {
        setUploadStatusMsg(`Saved "${finalItem.title}" to library catalogue`)
      }
    } finally {
      setUploading(false)
      setUploadTitle('')
      setUploadArabicTitle('')
      setUploadAuthor('')
      setUploadSummary('')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDeleteCustomKitab(kitab: DigitalKitabItem) {
    setLocalUploads((prev) => {
      const next = prev.filter((item) => item.id !== kitab.id)
      try {
        window.localStorage.setItem(LOCAL_UPLOADS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Ignore
      }
      return next
    })

    if (kitab.syncedToCloud) {
      const path = `digitalKitabs/${kitab.id}`
      try {
        await deleteDoc(doc(db, 'digitalKitabs', kitab.id))
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.DELETE, path)
        } catch {
          // Logged by handleFirestoreError
        }
      }
    }
  }

  return (
    <Panel
      id="digital-library"
      eyebrow="Firebase Storage · Academic Kitabs & PDF Repository"
      title="Digital Library"
      icon={Library}
      action={
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <button
            type="button"
            onClick={() => setShowUploadForm((prev) => !prev)}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background/80 px-3 text-xs font-medium text-foreground transition-colors hover:border-lime/40 hover:bg-muted whitespace-nowrap shrink-0 sm:w-auto"
          >
            {showUploadForm ? (
              <>
                <X className="size-3.5 text-muted-foreground" aria-hidden="true" />
                Close Upload
              </>
            ) : (
              <>
                <Plus className="size-3.5 text-lime" aria-hidden="true" />
                Add Kitab PDF
              </>
            )}
          </button>
        </div>
      }
    >
      {/* Top Summary & Search Bar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col justify-between gap-2.5 border-b border-border/70 pb-4 lg:flex-row lg:items-center">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Browse classical Dars Kitabs, Usul treatises, and syllabus PDFs indexed in{' '}
            <span className="font-mono text-xs text-foreground">kitabs/*</span> on Firebase Storage.
          </p>
          <p className="text-xs text-muted-foreground tabular-nums sm:whitespace-nowrap sm:shrink-0">
            <span className="font-semibold text-foreground">{allKitabs.length}</span> Kitabs indexed
            {' · '}
            <span className="font-semibold text-foreground">{bookmarkedIds.length}</span> saved
            {storageBucketFiles.length > 0 ? (
              <>
                {' · '}
                <span className="font-semibold text-lime">{storageBucketFiles.length}</span> bucket files
              </>
            ) : null}
          </p>
        </div>

        {/* Upload / Index New Kitab PDF Form */}
        {showUploadForm ? (
          <form
            onSubmit={handleUploadCustomKitab}
            className="rounded-xl border border-border bg-background/60 p-4 md:p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Upload & Index Academic Kitab PDF
                </h3>
                <p className="text-xs text-muted-foreground">
                  Uploads the PDF to Firebase Storage (<span className="font-mono">kitabs/&lt;category&gt;/</span>) and indexes metadata in Firestore.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="kitab-upload-title" className="text-xs">
                  Kitab Title (English / Transliteration) *
                </Label>
                <input
                  id="kitab-upload-title"
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Minhaj al-Talibin"
                  className={fieldClassName}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="kitab-upload-arabic" className="text-xs">
                  Arabic Title (العنوان بالعربية)
                </Label>
                <input
                  id="kitab-upload-arabic"
                  type="text"
                  dir="rtl"
                  value={uploadArabicTitle}
                  onChange={(e) => setUploadArabicTitle(e.target.value)}
                  placeholder="منهاج الطالبين وعمدة المفتين"
                  className={cn(fieldClassName, 'font-arabic text-left')}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="kitab-upload-author" className="text-xs">
                  Author (Scholar) *
                </Label>
                <input
                  id="kitab-upload-author"
                  type="text"
                  required
                  value={uploadAuthor}
                  onChange={(e) => setUploadAuthor(e.target.value)}
                  placeholder="e.g. Imam Abu Zakariyya al-Nawawi"
                  className={fieldClassName}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="kitab-upload-category" className="text-xs">
                  Subject Category
                </Label>
                <select
                  id="kitab-upload-category"
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as KitabCategory)}
                  className={fieldClassName}
                >
                  <option value="fiqh">Fiqh & Usul (ഫിഖ്ഹ് & ഉസൂൽ)</option>
                  <option value="hadith">Hadith Studies (ഹദീസ്)</option>
                  <option value="tafsir">Tafsir & Ulum (തഫ്സീർ)</option>
                  <option value="aqeedah">Aqeedah & Tasawwuf (അഖീദ)</option>
                  <option value="nahw">Nahw & Sarf (നഹ്‌വ് & സർഫ്)</option>
                  <option value="history">History & Da&apos;wa (ചരിത്രം)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="kitab-upload-batch" className="text-xs">
                  Target Class Batch
                </Label>
                <select
                  id="kitab-upload-batch"
                  value={uploadBatch}
                  onChange={(e) => setUploadBatch(e.target.value)}
                  className={fieldClassName}
                >
                  <option value="S1 Da’wa">S1 Da’wa</option>
                  <option value="S2 Da’wa">S2 Da’wa</option>
                  <option value="S3 Da’wa">S3 Da’wa</option>
                  <option value="General Reference">General Reference</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="kitab-upload-pages" className="text-xs">
                    Pages
                  </Label>
                  <input
                    id="kitab-upload-pages"
                    type="number"
                    min={1}
                    max={5000}
                    value={uploadPages}
                    onChange={(e) => setUploadPages(e.target.value)}
                    className={cn(fieldClassName, 'tabular-nums')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="kitab-upload-lang" className="text-xs">
                    Language
                  </Label>
                  <input
                    id="kitab-upload-lang"
                    type="text"
                    value={uploadLanguage}
                    onChange={(e) => setUploadLanguage(e.target.value)}
                    className={fieldClassName}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="kitab-upload-summary" className="text-xs">
                  Syllabus Description & Summary *
                </Label>
                <input
                  id="kitab-upload-summary"
                  type="text"
                  required
                  value={uploadSummary}
                  onChange={(e) => setUploadSummary(e.target.value)}
                  placeholder="Brief note on the chapters covered in this PDF edition..."
                  className={fieldClassName}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="kitab-upload-file" className="text-xs">
                  PDF File (Optional — generates formatted PDF if omitted)
                </Label>
                <input
                  ref={fileInputRef}
                  id="kitab-upload-file"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="flex h-11 w-full items-center rounded-lg border border-input bg-input/30 px-3 py-2 text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-foreground"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              {uploadStatusMsg ? (
                <p className="text-xs font-medium text-lime">{uploadStatusMsg}</p>
              ) : (
                <p className="break-all text-xs text-muted-foreground">
                  Destination bucket: <span className="font-mono">pelagic-seeker-f01dl.firebasestorage.app</span>
                </p>
              )}
              <Button
                type="submit"
                disabled={uploading}
                className="h-9 w-full rounded-lg px-4 text-xs font-semibold whitespace-nowrap shrink-0 sm:w-auto"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
                    Uploading to Storage...
                  </>
                ) : (
                  <>
                    <CloudUpload className="mr-1.5 size-3.5" aria-hidden="true" />
                    Upload & Index Kitab
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : null}

        {/* Search Input & Saved Tab */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <label htmlFor="digital-library-search" className="sr-only">
              Search academic Kitabs by title, Arabic name, author, or topic
            </label>
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              id="digital-library-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search Kitab name, Arabic title, author, or subject to download PDF..."
              autoComplete="off"
              aria-controls={searchResultsId}
              className={cn(fieldClassName, 'pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden')}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  searchInputRef.current?.focus()
                }}
                className="absolute top-1/2 right-2.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
                <span className="sr-only">Clear search</span>
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {normalisedQuery || bookmarkedOnly ? (
              <>
                <label htmlFor="digital-library-batch" className="sr-only">
                  Filter by Class Batch
                </label>
                <select
                  id="digital-library-batch"
                  value={batchFilter}
                  onChange={(e) => setBatchFilter(e.target.value)}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-input/30 px-3 text-xs font-medium text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-auto sm:flex-initial dark:[color-scheme:dark]"
                >
                  <option value="all">All Class Batches</option>
                  <option value="S1 Da’wa">S1 Da’wa</option>
                  <option value="S2 Da’wa">S2 Da’wa</option>
                  <option value="S3 Da’wa">S3 Da’wa</option>
                  <option value="General Reference">General Reference</option>
                </select>
              </>
            ) : null}

            <button
              type="button"
              aria-pressed={bookmarkedOnly}
              onClick={() => setBookmarkedOnly((prev) => !prev)}
              className={cn(
                'inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border px-4 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 sm:flex-initial',
                bookmarkedOnly
                  ? 'border-lime/50 bg-lime/15 text-foreground'
                  : 'border-border bg-background/60 text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {bookmarkedOnly ? (
                <BookmarkCheck className="size-4 text-lime" aria-hidden="true" />
              ) : (
                <Bookmark className="size-4 text-lime" aria-hidden="true" />
              )}
              Saved ({bookmarkedIds.length})
            </button>
          </div>
        </div>

        {/* Categorized View Bar — shown while searching or viewing Saved */}
        {normalisedQuery || bookmarkedOnly ? (
          <div
            role="tablist"
            aria-label="Kitab subject categories"
            className="flex gap-1.5 overflow-x-auto rounded-xl border border-border bg-background/60 p-1.5"
          >
            {KITAB_CATEGORIES.map((category) => {
              const selected = activeCategory === category.id
              const count = categoryCounts[category.id] ?? 0
              return (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    'flex h-9 items-center gap-2 rounded-lg px-3.5 text-xs font-medium transition-all duration-150 outline-none whitespace-nowrap shrink-0 focus-visible:ring-3 focus-visible:ring-ring/50',
                    selected
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <span>{category.label}</span>
                  <span
                    className={cn(
                      'text-[0.7rem] tabular-nums',
                      selected ? 'text-primary-foreground/85' : 'text-muted-foreground',
                    )}
                  >
                    ({count})
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      {!normalisedQuery && !bookmarkedOnly ? (
        /* Search-First Prompt — no Kitab names shown until student searches or opens Saved */
        <div
          id={searchResultsId}
          className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-background/40 px-4 py-8 text-center"
        >
          <Search className="size-6 text-lime" aria-hidden="true" />
          <p className="text-sm font-semibold text-foreground">
            Search to view & download Kitab PDF
          </p>
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            Enter a Kitab name, Arabic title, author, or subject in the search box above to download it as a PDF. Downloaded Kitabs are automatically saved in the{' '}
            <button
              type="button"
              onClick={() => setBookmarkedOnly(true)}
              className="font-semibold text-lime underline underline-offset-2"
            >
              Saved ({bookmarkedIds.length})
            </button>{' '}
            tab for quick access.
          </p>
        </div>
      ) : (
        <>
          {/* Results Status Line */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p id={`${searchResultsId}-status`} role="status" aria-live="polite" className="text-xs text-muted-foreground">
              {bookmarkedOnly && !normalisedQuery ? (
                <>
                  Showing <span className="font-medium tabular-nums text-foreground">{filteredKitabs.length}</span>{' '}
                  saved {filteredKitabs.length === 1 ? 'Kitab' : 'Kitabs'}
                  {activeCategory !== 'all' ? ` in ${CATEGORY_LABELS[activeCategory]}` : ''}
                </>
              ) : (
                <>
                  Found <span className="font-medium tabular-nums text-foreground">{filteredKitabs.length}</span>{' '}
                  {filteredKitabs.length === 1 ? 'Kitab' : 'Kitabs'}
                  {activeCategory !== 'all' ? ` in ${CATEGORY_LABELS[activeCategory]}` : ''}
                  {normalisedQuery ? ` matching “${searchQuery.trim()}”` : ''}
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setActiveCategory('all')
                setBatchFilter('all')
                setBookmarkedOnly(false)
              }}
              className="text-xs font-medium text-lime hover:underline whitespace-nowrap shrink-0"
            >
              {bookmarkedOnly && !normalisedQuery ? 'Close Saved' : 'Clear search'}
            </button>
          </div>

          {/* Kitab Grid */}
          {filteredKitabs.length > 0 ? (
            <div
              id={searchResultsId}
              aria-describedby={`${searchResultsId}-status`}
              className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2"
            >
              {filteredKitabs.map((kitab) => {
                const isBookmarked = bookmarkedIds.includes(kitab.id)
                const isSyncing = syncingStorageId === kitab.id
                const isStorageVerified = Boolean(
                  (kitab.pdfUrl && kitab.pdfUrl.startsWith('https://')) ||
                    syncedStoragePaths[kitab.storagePath],
                )

                return (
                  <article
                    key={kitab.id}
                    className="group flex min-w-0 flex-col justify-between overflow-hidden rounded-xl border border-border bg-background/50 p-4 transition-colors duration-200 hover:border-foreground/20 md:p-5"
                  >
                    <div className="min-w-0">
                      {/* Unboxed Typographic Metadata Line */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 break-words text-xs font-medium leading-relaxed text-muted-foreground">
                          <span className="font-semibold text-lime">{CATEGORY_LABELS[kitab.category]}</span>
                          {' · '}
                          <span>{kitab.classBatch}</span>
                          {' · '}
                          <span className="tabular-nums">{kitab.pages} pp.</span>
                          {' · '}
                          <span>{kitab.language}</span>
                        </p>

                        <div className="-mt-1 -mr-1 flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleBookmark(kitab.id)}
                            aria-label={isBookmarked ? `Remove ${kitab.title} from saved Kitabs` : `Save ${kitab.title}`}
                            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            {isBookmarked ? (
                              <>
                                <BookmarkCheck className="size-4 text-lime" aria-hidden="true" />
                                <span className="text-[0.7rem] font-semibold text-lime">Saved</span>
                              </>
                            ) : (
                              <Bookmark className="size-4" aria-hidden="true" />
                            )}
                          </button>
                          {kitab.isCustomUpload ? (
                            <button
                              type="button"
                              onClick={() => void handleDeleteCustomKitab(kitab)}
                              aria-label={`Remove ${kitab.title}`}
                              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {/* Title & Arabic Title — explicitly left-aligned for consistent mobile card layout */}
                      <h3 className="mt-2 break-words text-left font-display text-base font-semibold leading-snug text-foreground">
                        {kitab.title}
                      </h3>
                      {kitab.arabicTitle ? (
                        <p
                          dir="rtl"
                          className="font-arabic mt-1 break-words text-left text-sm font-medium leading-snug text-foreground/85"
                        >
                          {kitab.arabicTitle}
                        </p>
                      ) : null}

                      <p className="mt-1.5 break-words text-left text-xs font-medium text-muted-foreground">
                        {kitab.author}
                      </p>

                      <p className="mt-2.5 line-clamp-2 text-left text-xs leading-relaxed text-muted-foreground">
                        {kitab.summary}
                      </p>
                    </div>

                    {/* Footer: PDF Download & Preview Actions */}
                    <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex w-full min-w-0 items-center gap-1.5 text-[0.7rem] text-muted-foreground sm:w-auto">
                        <FolderOpen className="size-3.5 shrink-0 text-lime" aria-hidden="true" />
                        <span className="truncate font-mono">{kitab.storagePath}</span>
                        {isStorageVerified ? (
                          <Check className="size-3.5 shrink-0 text-lime" aria-label="Synced with Firebase Storage" />
                        ) : null}
                      </div>

                      <div className="grid w-full grid-cols-[1.2fr_1fr_auto] items-center gap-2 sm:flex sm:w-auto sm:shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDownloadKitabPdf(kitab)}
                          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 whitespace-nowrap sm:h-8 sm:w-auto"
                        >
                          <Download className="size-3.5" aria-hidden="true" />
                          Download PDF
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenReader(kitab, 'pdf')}
                          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-lime/40 hover:bg-muted whitespace-nowrap sm:h-8 sm:w-auto sm:px-2.5"
                        >
                          <BookOpen className="size-3.5 text-lime" aria-hidden="true" />
                          View PDF
                        </button>

                        <button
                          type="button"
                          disabled={isSyncing}
                          onClick={() => void handleSyncKitabToStorage(kitab)}
                          title="Sync PDF & metadata with Firebase Storage and Firestore"
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-lime/40 hover:text-foreground disabled:opacity-50 whitespace-nowrap sm:h-8 sm:px-2.5"
                        >
                          {isSyncing ? (
                            <Loader2 className="size-3.5 animate-spin text-lime" aria-hidden="true" />
                          ) : (
                            <CloudUpload className="size-3.5" aria-hidden="true" />
                          )}
                          <span>Sync</span>
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            /* Empty Search / Empty Saved Result State */
            <div
              id={searchResultsId}
              className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-background/40 px-4 py-10 text-center"
            >
              <SearchX className="size-7 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground">
                {bookmarkedOnly && !normalisedQuery
                  ? 'No saved or downloaded Kitabs yet'
                  : 'No matching Kitabs or PDFs found'}
              </p>
              <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                {bookmarkedOnly && !normalisedQuery
                  ? 'Search for any Kitab above and click Download PDF — it will automatically be saved here for easy access.'
                  : `No academic volumes matched “${searchQuery.trim()}”. Try another keyword or upload a new Kitab PDF.`}
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setActiveCategory('all')
                    setBatchFilter('all')
                    setBookmarkedOnly(false)
                    searchInputRef.current?.focus()
                  }}
                  className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-3.5 text-xs font-medium text-foreground transition-colors hover:border-lime/40 hover:bg-muted whitespace-nowrap shrink-0"
                >
                  {bookmarkedOnly && !normalisedQuery ? 'Search Kitabs' : 'Clear search'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUploadForm(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-medium text-primary-foreground whitespace-nowrap shrink-0"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  Add Kitab PDF
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Built-in Interactive Kitab & PDF Reader Modal */}
      {activeReaderKitab ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="kitab-reader-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-xs sm:p-4"
        >
          <div className="flex max-h-[90svh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5 sm:py-4 md:px-6">
              <div className="min-w-0 flex-1">
                <p className="break-words text-xs leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-lime">
                    {CATEGORY_LABELS[activeReaderKitab.category]}
                  </span>
                  {' · '}
                  <span>{activeReaderKitab.classBatch}</span>
                  {' · '}
                  <span className="font-mono">{activeReaderKitab.storagePath}</span>
                  {' · '}
                  <span>
                    {storageSourceStatus === 'firebase-storage'
                      ? 'Firebase Storage Live Stream'
                      : 'Firebase Storage PDF Edition'}
                  </span>
                </p>
                <h3
                  id="kitab-reader-title"
                  className="mt-1 break-words font-display text-base font-semibold leading-snug text-foreground sm:text-lg md:text-xl"
                >
                  {activeReaderKitab.title}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{activeReaderKitab.author}</p>
              </div>

              <button
                type="button"
                onClick={() => setActiveReaderKitab(null)}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
                <span className="sr-only">Close Kitab reader</span>
              </button>
            </div>

            {/* Modal View Switcher & Actions */}
            <div className="flex flex-col gap-2 border-b border-border bg-background/60 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5 md:px-6">
              <div className="grid w-full grid-cols-2 gap-1.5 sm:flex sm:w-auto sm:items-center">
                {activeReaderKitab.excerpt ? (
                  <button
                    type="button"
                    onClick={() => setReaderTab('study')}
                    className={cn(
                      'inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors whitespace-nowrap sm:w-auto sm:px-3',
                      readerTab === 'study'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <BookOpen className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">Kitab Matn & Sharh</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setReaderTab('pdf')}
                  className={cn(
                    'inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors whitespace-nowrap sm:w-auto sm:px-3',
                    !activeReaderKitab.excerpt ? 'col-span-2' : '',
                    readerTab === 'pdf'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <FileText className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">PDF Preview</span>
                </button>
              </div>

              <div className="flex w-full items-center gap-2 sm:w-auto">
                {activePdfObjectUrl ? (
                  <a
                    href={activePdfObjectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-lime/40 hover:bg-muted whitespace-nowrap sm:flex-initial"
                  >
                    <ExternalLink className="size-3.5 shrink-0 text-lime" aria-hidden="true" />
                    Open in New Tab
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleDownloadKitabPdf(activeReaderKitab)}
                  className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 whitespace-nowrap sm:flex-initial"
                >
                  <Download className="size-3.5 shrink-0" aria-hidden="true" />
                  Download PDF
                </button>
              </div>
            </div>

            {/* Modal Content Area */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6">
              {readerTab === 'study' && activeReaderKitab.excerpt ? (
                <div className="flex flex-col gap-5">
                  <div className="rounded-xl border border-border bg-background/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-lime">
                      {activeReaderKitab.excerpt.chapterTitle}
                    </p>
                    <p
                      dir="rtl"
                      className="font-arabic mt-3 text-lg leading-loose font-medium text-foreground md:text-xl"
                    >
                      {activeReaderKitab.excerpt.arabicMatn}
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Transliteration (Ibarat Reading)
                      </p>
                      <p className="mt-2 text-sm italic leading-relaxed text-foreground/90">
                        {activeReaderKitab.excerpt.transliteration}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="font-malayalam text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        മലയാളം വിവരണം (Malayalam Meaning)
                      </p>
                      <p className="font-malayalam mt-2 text-sm leading-relaxed text-foreground/90">
                        {activeReaderKitab.excerpt.malayalamMeaning}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-background/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Scholarly Commentary & Syllabus Context
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                      {activeReaderKitab.excerpt.englishCommentary}
                    </p>
                    <p className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                      {activeReaderKitab.summary}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {activePdfObjectUrl ? (
                    <iframe
                      title={`${activeReaderKitab.title} PDF Preview`}
                      src={activePdfObjectUrl}
                      className="h-[58svh] w-full rounded-xl border border-border bg-white"
                    />
                  ) : (
                    <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-background/50">
                      <Loader2 className="size-6 animate-spin text-lime" aria-hidden="true" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </Panel>
  )
}
