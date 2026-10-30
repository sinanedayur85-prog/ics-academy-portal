'use client'

import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Bot,
  Check,
  Compass,
  Copy,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Languages,
  Loader2,
  MessageSquareText,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Sparkles,
  User,
  X,
  Zap,
} from 'lucide-react'
import type { Student } from '@/components/dashboard/data'
import { Panel, fieldClassName } from '@/components/dashboard/panel'
import { Button } from '@/components/ui/button'
import {
  auth,
  db,
  handleFirestoreError,
  initAuth,
  OperationType,
} from '@/src/lib/firebase'
import { cn } from '@/lib/utils'
import {
  StudyNotePrintTemplate,
  exportStudyNoteDirectPdf,
  isArabicText,
  isArabicLine,
  type StudyNoteExportData,
} from '@/components/dashboard/study-note-pdf'
import { exportStudyNoteDirectDocx } from '@/components/dashboard/study-note-docx'

export type ChatRole = 'usthad' | 'academic' | 'language' | 'campus'
export type ChatLanguage = 'ml' | 'en' | 'ar'
export type ChatModelTier = 'flash' | 'flash-lite'

export interface ChatTurnMessage {
  id: string
  role: 'user' | 'model'
  text: string
  timestamp: number
  modelUsed?: string
  persona?: ChatRole
}

const PERSONAS: {
  id: ChatRole
  title: string
  subTitle: string
  badge: string
  icon: typeof BookOpen
  description: string
  welcomeMessage: Record<ChatLanguage, string>
  starters: Record<ChatLanguage, { label: string; prompt: string }[]>
}[] = [
  {
    id: 'usthad',
    title: 'Usthad Kitab Mentor',
    subTitle: 'Kitab & Fiqh Scholar',
    badge: 'Kitab · Fiqh · Nahw',
    icon: BookOpen,
    description:
      'Multi-turn scholarly dialogue on Fathul Mueen, Mahalli, Tafsir Jalalayn, Alfiyyah, and Shafi\'i Fiqh.',
    welcomeMessage: {
      en: 'As-salāmu ʿalaykum! I am the Kitab & Fiqh Mentor for ICS Academy Da\'wa College. Ask any question regarding Fathul Mueen, Mahalli, Alfiyyah, Tafsir, Nahw, and Sarf.',
      ml: 'السَّلَامُ عَلَيْكُمْ! ഐ.സി.എസ് അക്കാദമി ദാഅ്വാ കോളേജിന്റെ കിതാബ് & ഫിഖ്ഹ് മെന്ററാണ് ഞാൻ. ഫത്ഹുൽ മുഈൻ, മഹല്ലി, അൽഫിയ്യ, തഫ്സീർ ജലാലൈൻ, നഹ്‌വ്, സർഫ് എന്നിവയെക്കുറിച്ചുള്ള ഏത് സംശയങ്ങളും ചോദിക്കാം.',
      ar: 'السَّلَامُ عَلَيْكُمْ! أنا المرشد العلمي لكتب الشريعة والفقه بكلية الدعوة في أكاديمية ICS. يمكنك طرح أي سؤال حول فتح المعين، والمحلي، وألفية ابن مالك، وتفسير الجلالين، وقواعد النحو والصرف.',
    },
    starters: {
      en: [
        {
          label: 'Fathul Mueen — Tayammum Conditions',
          prompt:
            'What are the core conditions for Tayammum according to the Shafi\'i Madhhab? Could you follow up with a short question to test my understanding?',
        },
        {
          label: 'Grammar & I\'rab Analysis',
          prompt:
            'Could you explain the I\'rab and Nahw grammatical rules for: "الْعِلْمُ نُورٌ يَقْذِفُهُ اللَّهُ فِي الْقَلْبِ" step-by-step?',
        },
        {
          label: 'Usul al-Fiqh — Aam & Khas',
          prompt:
            'Explain the difference between Aam (العام) and Khas (الخاص) in Usul al-Fiqh with examples.',
        },
      ],
      ml: [
        {
          label: 'ഫത്ഹുൽ മുഈൻ — തയമ്മുമിന്റെ ശർത്വുകൾ',
          prompt:
            'ശാഫിഈ മദ്ഹബിലെ ഫത്ഹുൽ മുഈൻ പ്രകാരം തയമ്മുമിന്റെ പ്രധാന ശർത്വുകൾ എന്തൊക്കെയാണ്? തുടർന്ന് എന്റെ ഗ്രാഹ്യം പരിശോധിക്കാൻ ഒരു ചെറിയ ചോദ്യം കൂടി ചോദിക്കാമോ?',
        },
        {
          label: 'ഇഅ്റാബ് & വ്യാകരണ വിശകലനം',
          prompt:
            '"الْعِلْمُ نُورٌ يَقْذِفُهُ اللَّهُ فِي الْقَلْبِ" എന്നതിന്റെ ഇഅ്റാബും നഹ്‌വിലെ നിയമങ്ങളും ഘട്ടം ഘട്ടമായി വിശദീകരിക്കാമോ?',
        },
        {
          label: 'ഉസൂലുൽ ഫിഖ്ഹ് — ആംമ് & ഖാസ്വ്',
          prompt:
            'ഉസൂലുൽ ഫിഖ്ഹിൽ ആംമ് (العام), ഖാസ്വ് (الخاص) എന്നിവ തമ്മിലുള്ള വ്യത്യാസം ഉദാഹരണ സഹിതം വിവരിക്കുക.',
        },
      ],
      ar: [
        {
          label: 'فتح المعين — شروط التيمم',
          prompt:
            'ما هي شروط التيمم المعتمدة في المذهب الشافعي وفق فتح المعين؟ وهل يمكنك طرح سؤال قصير لاختبار فهمي؟',
        },
        {
          label: 'إعراب وتحليل نحوي',
          prompt:
            'اشرح إعراب وقواعد النحو لجملة: "الْعِلْمُ نُورٌ يَقْذِفُهُ اللَّهُ فِي الْقَلْبِ" خطوة بخطوة.',
        },
        {
          label: 'أصول الفقه — العام والخاص',
          prompt:
            'ما هو الفرق بين العام والخاص في أصول الفقه مع ذكر أمثلة توضيحية؟',
        },
      ],
    },
  },
  {
    id: 'academic',
    title: 'Academic & Exam Tutor',
    subTitle: 'Academic & Exam Guide',
    badge: 'Exams · Degree · Plus Two',
    icon: GraduationCap,
    description:
      'Interactive revision, exam-ready notes, and Socratic tutoring across Humanities, History, English, and Islamic Studies.',
    welcomeMessage: {
      en: 'Welcome! I am your multi-turn academic tutor for exam preparations and degree coursework in Humanities, History, English, and Islamic Studies. Which subject would you like to revise today?',
      ml: 'സ്വാഗതം! ഹ്യുമാനിറ്റീസ്, ഇസ്‌ലാമിക് ഹിസ്റ്ററി, ഇംഗ്ലീഷ്, പരീക്ഷാ റിവിഷൻ എന്നിവയ്ക്കായുള്ള നിങ്ങളുടെ അക്കാദമിക് ട്യൂട്ടറാണ് ഞാൻ. ഇന്ന് ഏത് വിഷയമാണ് റിവൈസ് ചെയ്യേണ്ടത്?',
      ar: 'أهلاً بك! أنا مرشدك الأكاديمي للاستعداد للاختبارات ومناهج الإنسانيات، والتاريخ الإسلامي، واللغة الإنجليزية. أي مادة تود مراجعتها اليوم؟',
    },
    starters: {
      en: [
        {
          label: 'Islamic History — Abbasid Golden Age',
          prompt:
            'Provide key exam points on the intellectual advancements and Bayt al-Hikmah during the Abbasid Caliphate.',
        },
        {
          label: 'Interactive Revision Quiz',
          prompt:
            'Ask me 3 consecutive questions on the history of Islam in Kerala and evaluate my answers one by one.',
        },
        {
          label: 'Exam Study Schedule',
          prompt:
            'Could you create a balanced weekly study plan covering both Kitab syllabus and academic degree subjects?',
        },
      ],
      ml: [
        {
          label: 'ഇസ്‌ലാമിക ചരിത്രം — അബ്ബാസിയ്യ സുവർണ്ണകാലം',
          prompt:
            'അബ്ബാസി ഖിലാഫത്ത് കാലത്തെ വൈജ്ഞാനിക മുന്നേറ്റങ്ങളെക്കുറിച്ചും ബൈത്തുൽ ഹിക്മയെക്കുറിച്ചും പ്രധാന പരീക്ഷാ പോയിന്റുകൾ നൽകുക.',
        },
        {
          label: 'ഇന്ററാക്ടീവ് റിവിഷൻ ക്വിസ്',
          prompt:
            'കേരളത്തിലെ ഇസ്‌ലാമിക ചരിത്രത്തെക്കുറിച്ച് എന്നോട് തുടർച്ചയായി 3 ചോദ്യങ്ങൾ ചോദിച്ച് ഓരോ ഉത്തരവും വിലയിരുത്താമോ?',
        },
        {
          label: 'പരീക്ഷാ ടൈംടേബിൾ പ്ലാൻ',
          prompt:
            'കിതാബുകളും ഡിഗ്രി സിലബസും ഒന്നിച്ച് പഠിക്കാനുതകുന്ന ഒരു സന്തുലിത പ്രതിവാര പഠന ടൈംടേബിൾ തയാറാക്കി തരുമോ?',
        },
      ],
      ar: [
        {
          label: 'التاريخ الإسلامي — العصر العباسي',
          prompt:
            'اذكر أهم النقاط الامتحانية حول النهضة الفكرية وبيت الحكمة في عهد الخلافة العباسية.',
        },
        {
          label: 'اختبار مراجعة تفاعلي',
          prompt:
            'اطرح عليّ ثلاثة أسئلة متتالية حول تاريخ الإسلام في كيرلا وقوّم إجاباتي واحدة تلو الأخرى.',
        },
        {
          label: 'جدول المذاكرة للاختبارات',
          prompt:
            'اقترح جدولاً أسبوعياً متوازناً يجمع بين مراجعة كتب الشريعة والمناهج الأكاديمية الجامعية.',
        },
      ],
    },
  },
  {
    id: 'language',
    title: 'Trilingual Coach',
    subTitle: 'Arabic · English · Malayalam',
    badge: 'Arabic · English · Malayalam',
    icon: Languages,
    description:
      'Practice Arabic conversation (Muhadathah), academic English, and trilingual translation with grammar feedback.',
    welcomeMessage: {
      en: 'Ahlan wa Sahlan! Welcome! Let us practice Arabic conversation (المحادثة العربية), academic English, and trilingual translation. Which language would you like to start with?',
      ml: 'അഹ്‌ലൻ വ സഹ്‌ലൻ! സ്വാഗതം! അറബിക് മുഹാദസ (المحادثة العربية), അക്കാദമിക് ഇംഗ്ലീഷ്, ത്രിഭാഷാ പരിഭാഷ എന്നിവ നമുക്ക് ഇവിടെ പരിശീലിക്കാം. ഏത് ഭാഷയിലാണ് തുടങ്ങേണ്ടത്?',
      ar: 'أهلاً وسهلاً بك! دعنا نتدرب معاً على المحادثة العربية الفصحى، والإنجليزية الأكاديمية، والترجمة الثلاثية مع تصويب القواعد. بأي لغة تفضل أن نبدأ؟',
    },
    starters: {
      en: [
        {
          label: 'Arabic Dialogue (Muhadathah)',
          prompt:
            'Start a short Arabic conversation between a teacher and student in the Da\'wa College library, with English translations.',
        },
        {
          label: 'Arabic Root & Morphology (Sarf)',
          prompt:
            'Explain the root letters and morphological derivation (Sarf) for "استغفار" (Istighfar) and "تعلّم" (Ta\'allum).',
        },
        {
          label: 'Academic English Presentation',
          prompt:
            'Help me practice formal academic English for an inter-collegiate Da\'wa seminar presentation. Start by asking me about my topic.',
        },
      ],
      ml: [
        {
          label: 'അറബി സംഭാഷണം (മുഹാദസ)',
          prompt:
            'ദാഅ്വാ കോളേജ് ലൈബ്രറിയിൽ അധ്യാപകനും വിദ്യാർത്ഥിയും തമ്മിലുള്ള ഒരു ചെറിയ അറബി സംഭാഷണം മലയാളം അർത്ഥം സഹിതം തുടങ്ങാമോ?',
        },
        {
          label: 'അറബിക് സർഫ് & ഇശ്തിഖാഖ്',
          prompt:
            '"استغفار", "تعلّم" എന്നീ പദങ്ങളുടെ മൂല ധാതുവും (Root) സർഫിലെ രൂപീകരണവും വിവരിക്കാമോ?',
        },
        {
          label: 'അക്കാദമിക് ഇംഗ്ലീഷ് പരിശീലനം',
          prompt:
            'ദാഅ്വാ സെമിനാറിലെ പ്രസന്റേഷന് വേണ്ടിയുള്ള ഫോർമൽ അക്കാദമിക് ഇംഗ്ലീഷ് സംസാരിക്കാൻ എന്നെ സഹായിക്കാമോ? എന്റെ വിഷയം ചോദിച്ചു കൊണ്ട് തുടങ്ങൂ.',
        },
      ],
      ar: [
        {
          label: 'محادثة عربية تفاعلية',
          prompt:
            'ابدأ محادثة عربية قصيرة بين أستاذ وطالب في مكتبة كلية الدعوة، مع توجيهات لغوية وترجمة.',
        },
        {
          label: 'علم الصرف واشتقاق الكلمات',
          prompt:
            'اشرح الجذر اللغوي والاشتقاق الصرفي لكلمتي "استغفار" و"تعلّم".',
        },
        {
          label: 'تدريب المحادثة الإنجليزية الأكاديمية',
          prompt:
            'ساعدني في التدرب على الإنجليزية الأكاديمية الرسمية لعرض تقديمي في ندوة الكلية. ابدأ بسؤالي عن موضوعي.',
        },
      ],
    },
  },
  {
    id: 'campus',
    title: "Campus & Da'wa Advisor",
    subTitle: "Campus & Da'wa Guide",
    badge: "Da'wa · Speech · Library",
    icon: Compass,
    description:
      'Speech preparation, Friday Khutbah structuring, Kitab reading recommendations, and campus routines.',
    welcomeMessage: {
      en: 'As-salāmu ʿalaykum! I am here to assist you with Da\'wa speeches, Literary Association (Sahitya Samajam) essays, and digital library recommendations.',
      ml: 'السَّلَامُ عَلَيْكُمْ! ദാഅ്വാ പ്രസംഗങ്ങൾ, സാഹിത്യ സമാജം ഉപന്യാസങ്ങൾ, ഡിജിറ്റൽ ലൈബ്രറി കിതാബുകൾ എന്നിവയിൽ സഹായിക്കാൻ ഞാൻ സദാ സന്നദ്ധനാണ്.',
      ar: 'السَّلَامُ عَلَيْكُمْ! أنا هنا لمساعدتك في إعداد الخطب الدعوية، ومقالات النادي الأدبي، وتوصيات كتب المكتبة الرقمية.',
    },
    starters: {
      en: [
        {
          label: 'Speech Preparation — Time Management',
          prompt:
            'Provide an outline with Quranic verses and Hadith references for a speech on "Students and Time Management".',
        },
        {
          label: 'Must-Read Classical Kitabs',
          prompt:
            'Recommend 5 classical Kitabs that every Da\'wa student should read, along with their key insights.',
        },
      ],
      ml: [
        {
          label: 'പ്രസംഗ പരിശീലനം — സമയനിഷ്ഠ',
          prompt:
            '"വിദ്യാർത്ഥികളും സമയനിഷ്ഠയും" എന്ന വിഷയത്തിൽ ഖുർആൻ, ഹദീസ് ഉദ്ധരണികൾ ഉൾപ്പെടുത്തി ഒരു പ്രസംഗ രൂപരേഖ തയ്യാറാക്കുക.',
        },
        {
          label: 'വായിച്ചിരിക്കേണ്ട പ്രധാന കിതാബുകൾ',
          prompt:
            'ഒരു ദാഅ്വാ വിദ്യാർത്ഥി നിർബന്ധമായും വായിച്ചിരിക്കേണ്ട 5 ക്ലാസിക്കൽ കിതാബുകളും അവയുടെ പ്രത്യേകതകളും നിർദ്ദേശിക്കുക.',
        },
      ],
      ar: [
        {
          label: 'إعداد خطبة — إدارة الوقت',
          prompt:
            'ضع مخططاً لكلمة أو خطبة حول "الطلاب وإدارة الوقت" مع الاستشهاد بآيات قرآنية وأحاديث نبوية.',
        },
        {
          label: 'أهم الكتب الكلاسيكية الموصى بها',
          prompt:
            'اقترح 5 كتب كلاسيكية أساسية يجب على كل طالب دعوة قراءتها مع بيان أهم فوائدها ومزاياها.',
        },
      ],
    },
  },
]

const LANGUAGES: { id: ChatLanguage; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'ar', label: 'العربية' },
  { id: 'ml', label: 'മലയാളം' },
]

const UI_TEXT: Record<
  ChatLanguage,
  {
    tryAsking: string
    placeholder: (personaTitle: string) => string
    send: string
    thinking: (personaTitle: string) => string
    analyzing: string
    selectPersona: string
    responseLang: string
    newChat: string
    turnSingular: string
    turnPlural: string
    activeRole: string
    maintainsMemory: string
    voiceTyping: string
    voiceListening: string
    voiceStop: string
    voiceNotSupported: string
  }
> = {
  en: {
    tryAsking: 'Try asking:',
    placeholder: (personaTitle) =>
      `Ask ${personaTitle}... (Press Enter to send, Shift+Enter for new line)`,
    send: 'Send',
    thinking: (personaTitle) => `${personaTitle} is thinking...`,
    analyzing: 'Preparing answer · Analyzing conversation history',
    selectPersona: 'Select Chatbot Persona',
    responseLang: 'Response Language:',
    newChat: 'New Chat',
    turnSingular: 'turn',
    turnPlural: 'turns',
    activeRole: 'Active System Role:',
    maintainsMemory: 'Maintains multi-turn memory across your conversation.',
    voiceTyping: 'Voice Typing',
    voiceListening: 'Listening in English... Speak clearly',
    voiceStop: 'Stop Voice',
    voiceNotSupported: 'Speech recognition is not supported in this browser. Please use Chrome, Safari, or Edge.',
  },
  ml: {
    tryAsking: 'ചോദിച്ചു നോക്കൂ:',
    placeholder: (personaTitle) =>
      `${personaTitle}-യോട് ചോദിക്കൂ... (അയക്കാൻ Enter, പുതിയ വരിക്ക് Shift+Enter)`,
    send: 'അയക്കുക',
    thinking: (personaTitle) => `${personaTitle} ചിന്തിക്കുന്നു...`,
    analyzing: 'മറുപടി തയ്യാറാക്കുന്നു · സംഭാഷണ ചരിത്രം വിശകലനം ചെയ്യുന്നു',
    selectPersona: 'അസിസ്റ്റന്റിനെ തിരഞ്ഞെടുക്കുക',
    responseLang: 'മറുപടി ഭാഷ:',
    newChat: 'പുതിയ സംഭാഷണം',
    turnSingular: 'ചോദ്യം',
    turnPlural: 'ചോദ്യങ്ങൾ',
    activeRole: 'നിലവിലെ റോൾ:',
    maintainsMemory: 'സംഭാഷണത്തിലെ മുൻ ചോദ്യോത്തരങ്ങൾ ഓർത്തു വെച്ച് മറുപടി നൽകുന്നു.',
    voiceTyping: 'വോയിസ് ടൈപ്പിംഗ്',
    voiceListening: 'കേൾക്കുന്നു... നിങ്ങളുടെ ചോദ്യം മലയാളത്തിൽ വ്യക്തമായി സംസാരിക്കൂ',
    voiceStop: 'വോയിസ് നിർത്തുക',
    voiceNotSupported: 'ഈ ബ്രൗസറിൽ സ്പീച്ച് റെക്കഗ്നിഷൻ ലഭ്യമല്ല. ദയവായി Google Chrome അല്ലെങ്കിൽ Microsoft Edge ഉപയോഗിക്കുക.',
  },
  ar: {
    tryAsking: 'جرّب السؤال:',
    placeholder: (personaTitle) =>
      `اسأل ${personaTitle}... (اضغط Enter للإرسال، وShift+Enter لسطر جديد)`,
    send: 'إرسال',
    thinking: (personaTitle) => `${personaTitle} يفكر...`,
    analyzing: 'جارٍ إعداد الإجابة · تحليل سياق المحادثة',
    selectPersona: 'اختر شخصية المساعد',
    responseLang: 'لغة الإجابة:',
    newChat: 'محادثة جديدة',
    turnSingular: 'جولة',
    turnPlural: 'جولات',
    activeRole: 'الدور النشط:',
    maintainsMemory: 'يحفظ سياق المحادثة كاملة عبر جميع الرسائل.',
    voiceTyping: 'الإملاء الصوتي',
    voiceListening: 'جارٍ الاستماع... تكلّم بوضوح باللغة العربية',
    voiceStop: 'إيقاف الصوت',
    voiceNotSupported: 'خاصية التعرف على الصوت غير مدعومة في هذا المتصفح. يُرجى استخدام متصفح Chrome أو Safari أو Edge.',
  },
}

const MODEL_TIERS: {
  id: ChatModelTier
  label: string
  modelBadge: string
  description: string
  icon: typeof Sparkles
}[] = [
  {
    id: 'flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    modelBadge: 'gemini-3.1-flash-lite',
    description: 'Fast Instant Responses (~1.3s)',
    icon: Zap,
  },
  {
    id: 'flash',
    label: 'Gemini 3.8 Flash',
    modelBadge: 'gemini-3.8-flash',
    description: 'Deep Scholarly Tasks (Auto-fallback)',
    icon: Sparkles,
  },
]

const CHAT_STORAGE_KEY = 'ics_gemini_chat_threads_v2'

function sanitizeId(raw: string) {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120) || `chat_${Date.now()}`
}

function escapePdfString(input: string) {
  return input
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function wrapAsciiLines(text: string, maxChars = 74): string[] {
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

function buildStudyNoteDirectPdf(params: {
  title: string
  prompt: string
  response: string
  studentName: string
  studentClass: string
  personaTitle: string
}): Blob {
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const headerLines = [
    'ICS ACADEMY - DAWA COLLEGE STUDY NOTE',
    `Student: ${params.studentName || 'Student'}${params.studentClass ? ` | Class: ${params.studentClass}` : ''} | Date: ${dateStr}`,
    `Mentor: ${params.personaTitle}`,
    '----------------------------------------------------------------------------',
    `TITLE: ${params.title}`,
    '----------------------------------------------------------------------------',
    ...(params.prompt ? ['QUESTION / TOPIC:', ...wrapAsciiLines(params.prompt, 74), ''] : []),
    'STUDY NOTE / EXPLANATION:',
    ...wrapAsciiLines(params.response, 74),
  ]

  const textOps: string[] = ['BT', '/F1 11 Tf', '50 760 Td', '15 TL']
  headerLines.slice(0, 44).forEach((line, idx) => {
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

function renderScriptRuns(text: string, keyPrefix: string): React.ReactNode {
  const scriptRegex =
    /([\u0D00-\u0D7F\u200C\u200D]+|[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)/g
  const parts = text.split(scriptRegex)
  if (parts.length <= 1) return text

  return parts.map((part, idx) => {
    if (!part) return null
    if (/[\u0D00-\u0D7F]/.test(part)) {
      return (
        <span key={`${keyPrefix}-ml-${idx}`} className="font-malayalam">
          {part}
        </span>
      )
    }
    if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(part)) {
      return (
        <span key={`${keyPrefix}-ar-${idx}`} className="font-arabic">
          {part}
        </span>
      )
    }
    return <React.Fragment key={`${keyPrefix}-tx-${idx}`}>{part}</React.Fragment>
  })
}

function renderSlantedWords(content: string, keyPrefix: string) {
  const parts = content.split(/(\s+)/)
  return parts.map((part, idx) => {
    if (!part) return null
    if (/^\s+$/.test(part)) {
      return <span key={`${keyPrefix}-ws-${idx}`}>{part}</span>
    }
    return (
      <span key={`${keyPrefix}-w-${idx}`} className="inline-block -skew-x-10">
        {renderScriptRuns(part, `${keyPrefix}-sw-${idx}`)}
      </span>
    )
  })
}

function renderInlineMarkdown(line: string, keyPrefix: string, isUser: boolean) {
  const tokenRegex =
    /(\*\*\*[\s\S]+?\*\*\*|___[\s\S]+?___|\*\*[\s\S]+?\*\*|__[\s\S]+?__|\*[^\s*](?:[\s\S]*?[^\s*])?\*|_[^\s_](?:[\s\S]*?[^\s_])?_|\`[^\`]+\`)/g

  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(renderScriptRuns(line.slice(lastIndex, match.index), `${keyPrefix}-pre-${match.index}`))
    }

    const token = match[0]
    const k = `${keyPrefix}-t-${match.index}`

    if ((token.startsWith('***') && token.endsWith('***')) || (token.startsWith('___') && token.endsWith('___'))) {
      const inner = token.slice(3, -3)
      nodes.push(
        <strong
          key={k}
          className={cn(
            'font-bold [font-synthesis:weight_style]',
            isUser ? 'text-primary-foreground' : 'text-foreground',
          )}
        >
          <em className="not-italic">{renderSlantedWords(inner, k)}</em>
        </strong>,
      )
    } else if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__'))) {
      const inner = token.slice(2, -2)
      nodes.push(
        <strong
          key={k}
          className={cn(
            'font-bold [font-synthesis:weight]',
            isUser ? 'text-primary-foreground' : 'text-foreground',
          )}
        >
          {renderScriptRuns(inner, `${k}-b`)}
        </strong>,
      )
    } else if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
      const inner = token.slice(1, -1)
      nodes.push(
        <em
          key={k}
          className={cn(
            'not-italic [font-synthesis:style]',
            isUser ? 'text-primary-foreground/95' : 'text-lime/95',
          )}
        >
          {renderSlantedWords(inner, k)}
        </em>,
      )
    } else if (token.startsWith('`') && token.endsWith('`')) {
      const inner = token.slice(1, -1)
      nodes.push(
        <code
          key={k}
          className={cn(
            'rounded px-1.5 py-0.5 font-mono text-xs',
            isUser ? 'bg-primary-foreground/15 text-primary-foreground' : 'bg-muted text-lime',
          )}
        >
          {renderScriptRuns(inner, `${k}-c`)}
        </code>,
      )
    } else {
      nodes.push(renderScriptRuns(token, `${k}-raw`))
    }

    lastIndex = tokenRegex.lastIndex
  }

  if (lastIndex < line.length) {
    nodes.push(renderScriptRuns(line.slice(lastIndex), `${keyPrefix}-end`))
  }

  return nodes.length > 0 ? nodes : renderScriptRuns(line, `${keyPrefix}-full`)
}

function FormattedChatText({ text, isUser }: { text: string; isUser: boolean }) {
  const lines = text.split('\n')
  const messageIsArabic = isArabicText(text)

  return (
    <div
      dir={messageIsArabic ? 'rtl' : 'ltr'}
      className={cn(
        'flex flex-col gap-1.5 break-words',
        messageIsArabic ? 'font-arabic text-right' : 'font-malayalam text-left',
      )}
    >
      {lines.map((rawLine, idx) => {
        const line = rawLine.trimEnd()
        const key = `line-${idx}`

        if (!line.trim()) {
          return <div key={key} className="h-1.5" aria-hidden="true" />
        }

        if (/^---+$|^\*\*\*+$/.test(line.trim())) {
          return <hr key={key} className="my-1.5 border-border/60" />
        }

        const headingMatch = /^(#{1,4})\s+(.+)$/.exec(line.trim())
        if (headingMatch) {
          const level = headingMatch[1].length
          const content = headingMatch[2]
          const isAr = isArabicLine(content) || messageIsArabic
          return (
            <div
              key={key}
              dir={isAr ? 'rtl' : 'ltr'}
              className={cn(
                'mt-1.5 font-bold [font-synthesis:weight]',
                level <= 2 ? 'text-base text-lime' : 'text-sm text-lime',
                isAr ? 'text-right font-arabic' : 'text-left font-malayalam',
              )}
            >
              {renderInlineMarkdown(content, key, isUser)}
            </div>
          )
        }

        const quoteMatch = /^>\s*(.+)$/.exec(line.trim())
        if (quoteMatch) {
          const isAr = isArabicLine(quoteMatch[1]) || messageIsArabic
          return (
            <blockquote
              key={key}
              dir={isAr ? 'rtl' : 'ltr'}
              className={cn(
                'my-0.5 py-1.5 text-sm',
                isAr
                  ? 'border-r-2 border-l-0 rounded-l-lg rounded-r-none pr-3 pl-2 text-right border-lime/70 bg-lime/10 font-arabic'
                  : 'rounded-r-lg border-l-2 border-lime/70 bg-lime/10 pl-3 pr-2 text-left',
              )}
            >
              {renderInlineMarkdown(quoteMatch[1], key, isUser)}
            </blockquote>
          )
        }

        const bulletMatch = /^(\s*)([*\-•])\s+(.+)$/.exec(line)
        if (bulletMatch) {
          const isAr = isArabicLine(bulletMatch[3]) || messageIsArabic
          return (
            <div
              key={key}
              dir={isAr ? 'rtl' : 'ltr'}
              className={cn(
                'flex items-start gap-2',
                isAr ? 'pr-1 text-right' : 'pl-1 text-left',
              )}
            >
              <span
                className={cn(
                  'mt-1.5 size-1.5 shrink-0 rounded-full',
                  isUser ? 'bg-primary-foreground' : 'bg-lime',
                )}
                aria-hidden="true"
              />
              <div className={cn('min-w-0 flex-1', isAr && 'font-arabic')}>
                {renderInlineMarkdown(bulletMatch[3], key, isUser)}
              </div>
            </div>
          )
        }

        const numberedMatch = /^(\s*)(\d+[.)])\s+(.+)$/.exec(line)
        if (numberedMatch) {
          const isAr = isArabicLine(numberedMatch[3]) || messageIsArabic
          return (
            <div
              key={key}
              dir={isAr ? 'rtl' : 'ltr'}
              className={cn(
                'flex items-start gap-2',
                isAr ? 'pr-0.5 text-right' : 'pl-0.5 text-left',
              )}
            >
              <span
                className={cn(
                  'shrink-0 font-mono text-xs font-bold mt-0.5',
                  isUser ? 'text-primary-foreground' : 'text-lime',
                )}
              >
                {numberedMatch[2]}
              </span>
              <div className={cn('min-w-0 flex-1', isAr && 'font-arabic')}>
                {renderInlineMarkdown(numberedMatch[3], key, isUser)}
              </div>
            </div>
          )
        }

        const isAr = isArabicLine(line) || messageIsArabic
        return (
          <div
            key={key}
            dir={isAr ? 'rtl' : 'ltr'}
            className={cn('whitespace-pre-wrap', isAr ? 'text-right font-arabic' : 'text-left')}
          >
            {renderInlineMarkdown(line, key, isUser)}
          </div>
        )
      })}
    </div>
  )
}

function buildDefaultThreads(lang: ChatLanguage = 'en'): Record<ChatRole, ChatTurnMessage[]> {
  const now = Date.now()
  return {
    usthad: [
      {
        id: 'welcome-usthad',
        role: 'model',
        text: PERSONAS[0].welcomeMessage[lang],
        timestamp: now,
        modelUsed: 'gemini-3.1-flash-lite',
        persona: 'usthad',
      },
    ],
    academic: [
      {
        id: 'welcome-academic',
        role: 'model',
        text: PERSONAS[1].welcomeMessage[lang],
        timestamp: now,
        modelUsed: 'gemini-3.1-flash-lite',
        persona: 'academic',
      },
    ],
    language: [
      {
        id: 'welcome-language',
        role: 'model',
        text: PERSONAS[2].welcomeMessage[lang],
        timestamp: now,
        modelUsed: 'gemini-3.1-flash-lite',
        persona: 'language',
      },
    ],
    campus: [
      {
        id: 'welcome-campus',
        role: 'model',
        text: PERSONAS[3].welcomeMessage[lang],
        timestamp: now,
        modelUsed: 'gemini-3.1-flash-lite',
        persona: 'campus',
      },
    ],
  }
}

export function GeminiChatbot({ student }: { student: Student }) {
  const [role, setRole] = useState<ChatRole>('usthad')
  const [language, setLanguage] = useState<ChatLanguage>('en')
  const [modelTier, setModelTier] = useState<ChatModelTier>('flash-lite')
  const [threads, setThreads] = useState<Record<ChatRole, ChatTurnMessage[]>>(() => buildDefaultThreads('en'))
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)

  // Voice Input (Speech-to-Text) State
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const speechBaseTextRef = useRef<string>('')

  // Direct DOCX & PDF Export State when "Save Note" is clicked
  const [activeExportNote, setActiveExportNote] = useState<StudyNoteExportData | null>(null)
  const [docTitleInput, setDocTitleInput] = useState('')
  const [isGeneratingDirectPdf, setIsGeneratingDirectPdf] = useState(false)
  const [directPdfSuccess, setDirectPdfSuccess] = useState(false)
  const [isGeneratingDirectDocx, setIsGeneratingDirectDocx] = useState(false)
  const [directDocxSuccess, setDirectDocxSuccess] = useState(false)
  const [exportDocsError, setExportDocsError] = useState<string | null>(null)

  const threadContainerRef = useRef<HTMLDivElement | null>(null)
  const printTemplateRef = useRef<HTMLDivElement | null>(null)

  // Clean up voice recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // Ignore
        }
      }
    }
  }, [])

  const currentPersona = useMemo(
    () => PERSONAS.find((p) => p.id === role) ?? PERSONAS[0],
    [role],
  )

  const currentMessages = useMemo(() => threads[role] ?? [], [threads, role])

  const safeStudentId = useMemo(() => sanitizeId(student.id), [student.id])
  const activeUid = useMemo(
    () => (firebaseUser ? firebaseUser.uid : `portal_${safeStudentId}`),
    [firebaseUser, safeStudentId],
  )

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setFirebaseUser(user)
      },
      () => {
        setFirebaseUser(auth.currentUser)
      },
    )
    return () => unsubscribe()
  }, [])

  // Load saved threads from localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHAT_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Record<ChatRole, ChatTurnMessage[]>>
        if (parsed && typeof parsed === 'object') {
          setThreads((prev) => ({
            usthad: Array.isArray(parsed.usthad) && parsed.usthad.length > 0 ? parsed.usthad : prev.usthad,
            academic:
              Array.isArray(parsed.academic) && parsed.academic.length > 0 ? parsed.academic : prev.academic,
            language:
              Array.isArray(parsed.language) && parsed.language.length > 0 ? parsed.language : prev.language,
            campus: Array.isArray(parsed.campus) && parsed.campus.length > 0 ? parsed.campus : prev.campus,
          }))
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, [])

  // Persist threads on update
  useEffect(() => {
    try {
      window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(threads))
    } catch {
      // Ignore quota errors
    }
  }, [threads])

  // Scroll thread container to bottom when messages change
  useEffect(() => {
    const el = threadContainerRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [currentMessages, sending])

  async function handleSendMessage(customText?: string) {
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // Ignore
      }
      setIsListening(false)
    }

    const textToSend = (customText ?? input).trim()
    if (!textToSend || sending) return

    if (!customText) {
      setInput('')
    }

    setErrorMessage(null)

    const userMsg: ChatTurnMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: Date.now(),
      persona: role,
    }

    const previousHistory = currentMessages.map((m) => ({
      role: m.role,
      text: m.text,
    }))

    setThreads((prev) => ({
      ...prev,
      [role]: [...(prev[role] ?? []), userMsg],
    }))

    setSending(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend.slice(0, 2000),
          history: previousHistory,
          role,
          language,
          modelTier,
          studentName: student.name,
          studentClass: student.className,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get response from Gemini chatbot.')
      }

      const botMsg: ChatTurnMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: String(data.reply ?? ''),
        timestamp: Date.now(),
        modelUsed: String(data.modelUsed ?? (modelTier === 'flash-lite' ? 'gemini-3.1-flash-lite' : 'gemini-3.8-flash')),
        persona: role,
      }

      setThreads((prev) => ({
        ...prev,
        [role]: [...(prev[role] ?? []), botMsg],
      }))
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Server busy. Could not get a response. Please try again.',
      )
    } finally {
      setSending(false)
    }
  }

  function handleResetThread() {
    const defaultForRole = buildDefaultThreads(language)[role]
    setThreads((prev) => ({
      ...prev,
      [role]: defaultForRole,
    }))
    setErrorMessage(null)
  }

  function handleSelectLanguage(newLang: ChatLanguage) {
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // Ignore
      }
      setIsListening(false)
    }
    setLanguage(newLang)
    setThreads((prev) => {
      const updated = { ...prev }
      ;(Object.keys(updated) as ChatRole[]).forEach((r) => {
        const msgs = updated[r]
        if (msgs && msgs.length === 1 && msgs[0].id.startsWith('welcome-')) {
          const persona = PERSONAS.find((p) => p.id === r)
          if (persona) {
            updated[r] = [
              {
                ...msgs[0],
                text: persona.welcomeMessage[newLang],
              },
            ]
          }
        }
      })
      return updated
    })
  }

  async function toggleVoiceInput() {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // Ignore
        }
      }
      setIsListening(false)
      return
    }

    if (typeof window === 'undefined') return

    const SpeechRecognitionClass =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition

    if (!SpeechRecognitionClass) {
      setErrorMessage(UI_TEXT[language].voiceNotSupported)
      return
    }

    // Explicitly request microphone access first so browser/iframe permission prompt triggers cleanly
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((track) => track.stop())
      } catch (permErr) {
        console.warn('Microphone permission error:', permErr)
        setErrorMessage(
          language === 'ml'
            ? 'മൈക്രോഫോൺ അനുമതി നൽകിയിട്ടില്ല. ബ്രൗസർ സെറ്റിംഗ്സിൽ (അല്ലെങ്കിൽ അഡ്രസ് ബാറിലെ മൈക്ക് ഐക്കണിൽ) മൈക്ക് പെർമിഷൻ Allow ചെയ്യുക.'
            : language === 'ar'
              ? 'لم يتم السماح بالوصول إلى الميكروفون. يُرجى تفعيل إذن الميكروفون في المتصفح.'
              : 'Microphone access was denied. Please allow microphone permissions in browser settings.',
        )
        setIsListening(false)
        return
      }
    }

    try {
      const recognition = new SpeechRecognitionClass()
      recognition.continuous = true
      recognition.interimResults = true
      // Language code for Web Speech recognition:
      // Malayalam: ml-IN, Arabic: ar-SA, English: en-IN (or en-US)
      recognition.lang = language === 'ml' ? 'ml-IN' : language === 'ar' ? 'ar-SA' : 'en-IN'

      speechBaseTextRef.current = input.trim()

      recognition.onstart = () => {
        setIsListening(true)
        setErrorMessage(null)
      }

      recognition.onresult = (event: any) => {
        let transcript = ''
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript
        }
        const base = speechBaseTextRef.current
        const cleanSpeech = transcript.trim()
        if (cleanSpeech) {
          setInput(base ? `${base} ${cleanSpeech}` : cleanSpeech)
        }
      }

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error)
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setErrorMessage(
            language === 'ml'
              ? 'മൈക്രോഫോൺ അനുമതി നൽകിയിട്ടില്ല. ബ്രൗസർ സെറ്റിംഗ്സിൽ മൈക്ക് പെർമിഷൻ Allow ചെയ്യുക.'
              : language === 'ar'
                ? 'لم يتم السماح بالوصول إلى الميكروفون. يُرجى تفعيل إذن الميكروفون في المتصفح.'
                : 'Microphone access was denied. Please allow microphone permissions in browser settings.',
          )
        } else if (event.error === 'no-speech') {
          // Normal timeout if user was silent
        } else {
          setErrorMessage(
            language === 'ml'
              ? `വോയിസ് റെക്കഗ്നിഷൻ: ${event.error}`
              : `Voice typing error: ${event.error}`,
          )
        }
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognition.start()
      recognitionRef.current = recognition
    } catch (err) {
      console.error('Failed to start speech recognition:', err)
      setIsListening(false)
      setErrorMessage(
        err instanceof Error ? err.message : 'Could not start voice recognition.',
      )
    }
  }

  function handleCopyMessage(msg: ChatTurnMessage) {
    void navigator.clipboard.writeText(msg.text)
    setCopiedId(msg.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function handleSaveTurnToNotebook(modelMsg: ChatTurnMessage, index: number) {
    // Find the preceding user message if available
    let promptText = `${currentPersona.title} — Study Note`
    for (let i = index - 1; i >= 0; i--) {
      if (currentMessages[i]?.role === 'user') {
        promptText = currentMessages[i].text
        break
      }
    }

    const cleanPrompt = promptText.trim().slice(0, 2000)
    const cleanResponse = modelMsg.text.trim().slice(0, 15000)
    if (!cleanPrompt || !cleanResponse) return

    const defaultDocTitle = `ICS Academy Study Note — ${cleanPrompt.slice(0, 48)}`
    setDocTitleInput(defaultDocTitle)
    setExportDocsError(null)
    setActiveExportNote({
      msgId: modelMsg.id,
      prompt: cleanPrompt,
      response: cleanResponse,
      personaTitle: currentPersona.title,
    })

    setSavedId(modelMsg.id)
    setTimeout(() => setSavedId(null), 3000)

    const noteId = sanitizeId(`note_${safeStudentId}_${Date.now()}`)
    const mappedMode =
      role === 'usthad'
        ? 'kitab'
        : role === 'academic'
          ? 'qa'
          : role === 'language'
            ? 'translation'
            : 'dawa'

    const path = `studyNotes/${noteId}`
    try {
      await setDoc(doc(db, 'studyNotes', noteId), {
        uid: activeUid,
        studentId: safeStudentId,
        mode: mappedMode,
        language,
        prompt: cleanPrompt,
        response: cleanResponse,
        createdAt: serverTimestamp(),
      })
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, path)
      } catch {
        // Logged by handleFirestoreError
      }
    }
  }

  async function handleDirectPdfDownload() {
    if (!activeExportNote || isGeneratingDirectPdf) return
    const el = printTemplateRef.current
    if (!el) {
      setExportDocsError('PDF print template not found. Please try again shortly.')
      return
    }

    setIsGeneratingDirectPdf(true)
    setDirectPdfSuccess(false)
    setExportDocsError(null)

    try {
      await exportStudyNoteDirectPdf({
        element: el,
        fileName: docTitleInput.trim() || 'ics-academy-study-note',
      })
      setDirectPdfSuccess(true)
      window.setTimeout(() => setDirectPdfSuccess(false), 5000)
    } catch (err) {
      console.error('PDF export failed:', err)
      setExportDocsError(
        err instanceof Error
          ? `PDF generation failed: ${err.message}`
          : 'An unexpected error occurred while generating PDF.',
      )
    } finally {
      setIsGeneratingDirectPdf(false)
    }
  }

  async function handleDirectDocxDownload() {
    if (!activeExportNote || isGeneratingDirectDocx) return
    setIsGeneratingDirectDocx(true)
    setDirectDocxSuccess(false)
    setExportDocsError(null)

    try {
      await exportStudyNoteDirectDocx({
        title: docTitleInput.trim() || 'ics-academy-study-note',
        prompt: activeExportNote.prompt,
        response: activeExportNote.response,
        studentName: student.name,
        studentClass: student.className,
        personaTitle: activeExportNote.personaTitle,
      })
      setDirectDocxSuccess(true)
      window.setTimeout(() => setDirectDocxSuccess(false), 5000)
    } catch (err) {
      console.error('DOCX export failed:', err)
      setExportDocsError(
        err instanceof Error
          ? `DOCX export failed: ${err.message}`
          : 'An unexpected error occurred while generating DOCX file.',
      )
    } finally {
      setIsGeneratingDirectDocx(false)
    }
  }

  const turnCount = Math.max(0, currentMessages.filter((m) => m.role === 'user').length)

  return (
    <Panel
      id="gemini-chatbot"
      eyebrow="Multi-Turn Conversational AI"
      title="Da'wa College Chatbot"
      icon={MessageSquareText}
      className="border-lime/30"
      action={
        <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
          {/* Top Language Switcher */}
          <div
            role="group"
            aria-label="Select chat language"
            className="inline-flex max-w-full flex-wrap rounded-xl border border-border bg-background/70 p-1"
          >
            {LANGUAGES.map((lang) => {
              const active = language === lang.id
              return (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => handleSelectLanguage(lang.id)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap',
                    lang.id === 'ml' && 'font-malayalam',
                    lang.id === 'ar' && 'font-arabic',
                    active
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {lang.label}
                </button>
              )
            })}
          </div>

          <div
            role="group"
            aria-label="Select Gemini model tier"
            className="hidden sm:inline-flex max-w-full flex-wrap rounded-xl border border-border bg-background/70 p-1"
          >
            {MODEL_TIERS.map((tier) => {
              const active = modelTier === tier.id
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setModelTier(tier.id)}
                  title={`${tier.label} (${tier.description})`}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap',
                    active
                      ? 'bg-lime text-primary-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <tier.icon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>{tier.label}</span>
                </button>
              )
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetThread}
            disabled={sending || currentMessages.length <= 1}
            className="h-8 gap-1.5 rounded-lg px-2.5 text-xs whitespace-nowrap shrink-0"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            <span
              className={cn(
                language === 'ml' && 'font-malayalam',
                language === 'ar' && 'font-arabic',
              )}
            >
              {UI_TEXT[language].newChat}
            </span>
          </Button>
        </div>
      }
    >
      <div className="grid min-w-0 gap-6 lg:grid-cols-12">
        {/* Left Sidebar: Chatbot Roles (System Instructions) & Language Controls */}
        <div className="flex min-w-0 flex-col justify-between gap-4 lg:col-span-4">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <p
                className={cn(
                  'text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                  language === 'ml' && 'font-malayalam normal-case',
                  language === 'ar' && 'font-arabic normal-case',
                )}
              >
                {UI_TEXT[language].selectPersona}
              </p>
              <span className="font-mono text-xs text-lime tabular-nums shrink-0">
                {turnCount}{' '}
                <span
                  className={cn(
                    language === 'ml' && 'font-malayalam',
                    language === 'ar' && 'font-arabic',
                  )}
                >
                  {turnCount === 1 ? UI_TEXT[language].turnSingular : UI_TEXT[language].turnPlural}
                </span>
              </span>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {PERSONAS.map((persona) => {
                const active = role === persona.id
                const msgCount = Math.max(
                  0,
                  (threads[persona.id] ?? []).filter((m) => m.role === 'user').length,
                )
                return (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => {
                      setRole(persona.id)
                      setErrorMessage(null)
                    }}
                    className={cn(
                      'flex min-w-0 flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-all duration-200',
                      active
                        ? 'border-lime/60 bg-lime/10 shadow-xs'
                        : 'border-border bg-background/50 hover:border-lime/30 hover:bg-muted/50',
                    )}
                  >
                    <div className="flex w-full min-w-0 items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-foreground">
                        <persona.icon
                          className={cn('size-4 shrink-0', active ? 'text-lime' : 'text-muted-foreground')}
                          aria-hidden="true"
                        />
                        <span className="truncate">{persona.title}</span>
                      </span>
                      {msgCount > 0 ? (
                        <span className="shrink-0 rounded-md bg-lime/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-lime">
                          {msgCount}
                        </span>
                      ) : null}
                    </div>
                    <p className="w-full break-words text-xs font-medium text-lime/90">{persona.subTitle}</p>
                    <p className="line-clamp-2 w-full break-words text-[11px] leading-relaxed text-muted-foreground">
                      {persona.description}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Language & Active System Instruction Summary */}
          <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-background/50 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={cn(
                  'text-xs font-medium text-muted-foreground',
                  language === 'ml' && 'font-malayalam',
                  language === 'ar' && 'font-arabic',
                )}
              >
                {UI_TEXT[language].responseLang}
              </span>
              <div
                role="group"
                aria-label="Chatbot output language"
                className="inline-flex max-w-full flex-wrap rounded-lg border border-border bg-background p-0.5"
              >
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => handleSelectLanguage(lang.id)}
                    className={cn(
                      'rounded-md px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap',
                      lang.id === 'ml' && 'font-malayalam',
                      lang.id === 'ar' && 'font-arabic',
                      language === lang.id
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-border/60 pt-2.5 text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">
                {UI_TEXT[language].activeRole}{' '}
              </span>
              {currentPersona.title} ({currentPersona.badge}) · {UI_TEXT[language].maintainsMemory}
            </div>
          </div>
        </div>

        {/* Right Column: Scrollable Conversation Thread & Composer */}
        <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-background/60 lg:col-span-8">
          {/* Thread Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-lime/15 text-lime">
                <currentPersona.icon className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="break-words text-sm font-semibold text-foreground">
                  {currentPersona.title}{' '}
                  <span className="font-normal text-muted-foreground">
                    · {currentPersona.subTitle}
                  </span>
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Multi-turn thread · Context preserved across messages
                </p>
              </div>
            </div>

            <span className="font-mono text-[11px] text-lime">
              {modelTier === 'flash-lite' ? 'gemini-3.1-flash-lite' : 'gemini-3.8-flash'}
            </span>
          </div>

          {/* Scrollable Messages Container */}
          <div
            ref={threadContainerRef}
            className="flex h-[420px] flex-col gap-4 overflow-y-auto p-4 md:p-5"
            aria-live="polite"
          >
            {currentMessages.map((msg, idx) => {
              const isUser = msg.role === 'user'
              const msgIsAr = isArabicText(msg.text) || (language === 'ar' && !isUser)
              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex gap-3',
                    isUser ? 'flex-row-reverse' : 'flex-row',
                  )}
                >
                  <div
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-xl border',
                      isUser
                        ? 'border-primary/40 bg-primary text-primary-foreground'
                        : 'border-lime/30 bg-lime/15 text-lime',
                    )}
                    aria-hidden="true"
                  >
                    {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
                  </div>

                  <div
                    dir={msgIsAr ? 'rtl' : 'ltr'}
                    className={cn(
                      'flex max-w-[85%] flex-col gap-2 rounded-2xl border px-4 py-3 text-sm leading-relaxed',
                      msgIsAr && 'text-right font-arabic',
                      isUser
                        ? 'border-primary/30 bg-primary text-primary-foreground'
                        : 'border-border bg-card/90 text-foreground',
                    )}
                  >
                    <FormattedChatText text={msg.text} isUser={isUser} />

                    <div
                      dir="ltr"
                      className={cn(
                        'mt-1 flex flex-wrap items-center justify-between gap-3 border-t pt-2 text-[10px]',
                        isUser
                          ? 'border-primary-foreground/15 text-primary-foreground/75'
                          : 'border-border/60 text-muted-foreground',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono tabular-nums">
                          {new Date(msg.timestamp).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {!isUser && msg.modelUsed ? (
                          <span className="font-mono text-lime">{msg.modelUsed}</span>
                        ) : null}
                      </div>

                      {!isUser ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg)}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="size-3 text-lime" aria-hidden="true" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="size-3" aria-hidden="true" />
                                Copy
                              </>
                            )}
                          </button>

                          {msg.id && !msg.id.startsWith('welcome-') ? (
                            <button
                              type="button"
                              onClick={() => void handleSaveTurnToNotebook(msg, idx)}
                              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-lime transition-colors hover:bg-lime/15"
                            >
                              {savedId === msg.id ? (
                                <>
                                  <BookmarkCheck className="size-3" aria-hidden="true" />
                                  Saved · DOCX / PDF
                                </>
                              ) : (
                                <>
                                  <Download className="size-3" aria-hidden="true" />
                                  Download (DOCX / PDF)
                                </>
                              )}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}

            {sending ? (
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-lime/30 bg-lime/15 text-lime">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card/80 px-4 py-3 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      'font-medium text-foreground',
                      language === 'ml' && 'font-malayalam',
                      language === 'ar' && 'font-arabic',
                    )}
                  >
                    {UI_TEXT[language].thinking(currentPersona.title)}
                  </span>
                  <span
                    className={cn(
                      language === 'ml' && 'font-malayalam',
                      language === 'ar' && 'font-arabic',
                    )}
                  >
                    {UI_TEXT[language].analyzing}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Starter Prompts Bar */}
          <div
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            className={cn(
              'border-t border-border/70 bg-background/40 px-4 py-2.5',
              language === 'ar' && 'text-right',
            )}
          >
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
              <span
                className={cn(
                  'shrink-0 text-[11px] font-semibold text-muted-foreground',
                  language === 'ml' && 'font-malayalam',
                  language === 'ar' && 'font-arabic',
                )}
              >
                {UI_TEXT[language].tryAsking}
              </span>
              {(currentPersona.starters[language] ?? currentPersona.starters.en).map((starter) => (
                <button
                  key={starter.label}
                  type="button"
                  disabled={sending}
                  onClick={() => void handleSendMessage(starter.prompt)}
                  className={cn(
                    'shrink-0 rounded-lg border border-border bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground/90 transition-colors hover:border-lime/50 hover:bg-lime/10 disabled:opacity-50',
                    language === 'ml' && 'font-malayalam',
                    language === 'ar' && 'font-arabic',
                  )}
                >
                  {starter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error Banner if any */}
          {errorMessage ? (
            <div
              role="alert"
              className="mx-4 mt-2 flex items-center justify-between gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2 text-xs text-destructive"
            >
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="font-sans font-semibold underline whitespace-nowrap shrink-0"
              >
                Dismiss
              </button>
            </div>
          ) : null}

          {/* Active Voice Listening Banner */}
          {isListening ? (
            <div
              role="status"
              aria-live="polite"
              dir={language === 'ar' ? 'rtl' : 'ltr'}
              className="flex items-center justify-between gap-3 border-t border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-600 dark:text-red-400"
            >
              <div className="flex items-center gap-2">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
                </span>
                <span
                  className={cn(
                    'font-medium animate-pulse',
                    language === 'ml' && 'font-malayalam',
                    language === 'ar' && 'font-arabic',
                  )}
                >
                  {UI_TEXT[language].voiceListening}
                </span>
              </div>
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={cn(
                  'rounded-lg border border-red-500/30 bg-background/80 px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted',
                  language === 'ml' && 'font-malayalam',
                  language === 'ar' && 'font-arabic',
                )}
              >
                {UI_TEXT[language].voiceStop}
              </button>
            </div>
          ) : null}

          {/* Message Input Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleSendMessage()
            }}
            className="flex items-end gap-2 border-t border-border p-3 md:p-4"
          >
            <label htmlFor="gemini-chatbot-input" className="sr-only">
              Type your message to the Da&apos;wa College Gemini Chatbot
            </label>
            <textarea
              id="gemini-chatbot-input"
              rows={2}
              maxLength={2000}
              value={input}
              dir={language === 'ar' || isArabicText(input) ? 'rtl' : 'ltr'}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSendMessage()
                }
              }}
              placeholder={UI_TEXT[language].placeholder(currentPersona.title)}
              className={cn(
                fieldClassName,
                'h-auto min-h-[52px] max-h-32 flex-1 resize-y py-2.5 text-sm leading-relaxed',
                language === 'ml' && 'font-malayalam',
                language === 'ar' && 'font-arabic',
                (language === 'ar' || isArabicText(input)) && 'text-right font-arabic',
              )}
            />

            {/* Microphone Button (Voice-to-Text) */}
            <Button
              type="button"
              variant={isListening ? 'destructive' : 'outline'}
              onClick={toggleVoiceInput}
              disabled={sending}
              title={isListening ? UI_TEXT[language].voiceStop : UI_TEXT[language].voiceTyping}
              aria-label={isListening ? UI_TEXT[language].voiceStop : UI_TEXT[language].voiceTyping}
              className={cn(
                'h-[52px] gap-1.5 rounded-xl px-3 sm:px-3.5 font-semibold whitespace-nowrap shrink-0 transition-all duration-300',
                isListening
                  ? 'border-red-500 bg-red-600 text-white shadow-md shadow-red-500/25 animate-pulse hover:bg-red-700'
                  : 'hover:border-lime/50 hover:bg-lime/10 hover:text-lime',
              )}
            >
              {isListening ? (
                <MicOff className="size-4 animate-bounce text-white" aria-hidden="true" />
              ) : (
                <Mic className="size-4" aria-hidden="true" />
              )}
              <span
                className={cn(
                  'hidden md:inline text-xs',
                  language === 'ml' && 'font-malayalam',
                  language === 'ar' && 'font-arabic',
                )}
              >
                {isListening ? UI_TEXT[language].voiceStop : UI_TEXT[language].voiceTyping}
              </span>
            </Button>

            <Button
              type="submit"
              disabled={sending || !input.trim()}
              className="h-[52px] gap-2 rounded-xl px-4 sm:px-5 font-semibold whitespace-nowrap shrink-0"
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
              <span
                className={cn(
                  language === 'ml' && 'font-malayalam',
                  language === 'ar' && 'font-arabic',
                )}
              >
                {UI_TEXT[language].send}
              </span>
            </Button>
          </form>
        </div>
      </div>

      {/* Save Note -> Direct DOCX & PDF Download Modal */}
      {activeExportNote ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="study-note-export-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-xs sm:p-4"
        >
          <div className="flex max-h-[92svh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-lime">
                  ICS Academy · Study Note Export
                </p>
                <h3
                  id="study-note-export-title"
                  className="mt-1 text-base font-semibold text-foreground sm:text-lg"
                >
                  Export Study Note (DOCX / PDF)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveExportNote(null)}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
                <span className="sr-only">Close modal</span>
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="study-note-file-title" className="text-xs font-medium text-muted-foreground">
                  File Title / Document Name
                </label>
                <input
                  id="study-note-file-title"
                  type="text"
                  value={docTitleInput}
                  onChange={(e) => setDocTitleInput(e.target.value)}
                  className={cn(fieldClassName, 'text-sm')}
                />
              </div>

              {/* Direct 1-Click Download Options (No Login Needed) */}
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-xs font-semibold text-foreground">
                  ⚡ Instant Direct Downloads (No Sign-in Required):
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Download the complete study note immediately in DOCX or PDF format for offline study or editing.
                </p>

                <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* DOCX Download Card */}
                  <div className="flex flex-col justify-between rounded-xl border border-sky-500/30 bg-sky-500/10 p-3.5 transition-colors hover:border-sky-500/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-sky-400" aria-hidden="true" />
                        <span className="font-semibold text-xs text-foreground">DOCX (Word &amp; Google Docs)</span>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        Standard editable .docx document. Open in Microsoft Word, WPS Office, or upload directly to <strong>Google Docs</strong>.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isGeneratingDirectDocx}
                      onClick={() => void handleDirectDocxDownload()}
                      className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-sky-500 disabled:opacity-60"
                    >
                      {isGeneratingDirectDocx ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                          <span>Generating DOCX...</span>
                        </>
                      ) : (
                        <>
                          <Download className="size-3.5" aria-hidden="true" />
                          <span>Download DOCX File</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* PDF Download Card */}
                  <div className="flex flex-col justify-between rounded-xl border border-lime/30 bg-lime/10 p-3.5 transition-colors hover:border-lime/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <BookOpen className="size-4 text-lime" aria-hidden="true" />
                        <span className="font-semibold text-xs text-foreground">PDF (Printable Document)</span>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        High-fidelity document formatted with balanced 20mm margins, running headers, and page counters.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isGeneratingDirectPdf}
                      onClick={() => void handleDirectPdfDownload()}
                      className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {isGeneratingDirectPdf ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                          <span>Generating PDF...</span>
                        </>
                      ) : (
                        <>
                          <Download className="size-3.5" aria-hidden="true" />
                          <span>Download PDF</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Student Guide on opening in Google Docs */}
              <div className="rounded-xl border border-border bg-background/80 p-3.5 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <span>💡</span>
                  <span>How to open and edit this file in Google Docs:</span>
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed">
                  <li>Click the blue <strong>&lsquo;Download DOCX File&rsquo;</strong> button above to save the file.</li>
                  <li>Open <strong>drive.google.com</strong> (Google Drive) in your web browser.</li>
                  <li>Click <strong>&lsquo;+ New&rsquo; ➔ &lsquo;File upload&rsquo;</strong> and select the downloaded .docx file.</li>
                  <li>Double-click the uploaded document to open and edit seamlessly in <strong>Google Docs</strong>!</li>
                </ol>
              </div>

              {/* Note Preview */}
              <div
                dir={isArabicText(activeExportNote.prompt) || isArabicText(activeExportNote.response) ? 'rtl' : 'ltr'}
                className="rounded-xl border border-border bg-background/60 p-3.5"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-lime">
                  Note Preview
                </p>
                <p
                  className={cn(
                    'mt-1.5 text-xs font-semibold text-foreground',
                    isArabicText(activeExportNote.prompt) && 'text-right font-arabic',
                  )}
                >
                  {activeExportNote.prompt}
                </p>
                <div className="mt-2 max-h-40 overflow-y-auto border-t border-border/60 pt-2 text-xs leading-relaxed text-muted-foreground">
                  <FormattedChatText text={activeExportNote.response} isUser={false} />
                </div>
              </div>

              {exportDocsError ? (
                <div
                  role="alert"
                  className="rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive"
                >
                  {exportDocsError}
                </div>
              ) : null}

              {directDocxSuccess ? (
                <div className="flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/15 p-3.5 text-xs font-semibold text-sky-400">
                  <Check className="size-4 shrink-0" aria-hidden="true" />
                  <span>
                    Study note downloaded as DOCX (Word &amp; Google Docs format) successfully!
                  </span>
                </div>
              ) : null}

              {directPdfSuccess ? (
                <div className="flex items-center gap-2 rounded-xl border border-lime/40 bg-lime/15 p-3.5 text-xs font-semibold text-lime">
                  <Check className="size-4 shrink-0" aria-hidden="true" />
                  <span>
                    Study note downloaded as high-quality PDF successfully!
                  </span>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/60 px-5 py-3.5">
              <button
                type="button"
                onClick={() => setActiveExportNote(null)}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-background px-4 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isGeneratingDirectDocx}
                  onClick={() => void handleDirectDocxDownload()}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3.5 text-xs font-semibold text-sky-400 transition-colors hover:bg-sky-500/20 disabled:opacity-50"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  <span>DOCX</span>
                </button>
                <button
                  type="button"
                  disabled={isGeneratingDirectPdf}
                  onClick={() => void handleDirectPdfDownload()}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-lime/30 bg-lime/10 px-3.5 text-xs font-semibold text-lime transition-colors hover:bg-lime/20 disabled:opacity-50"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  <span>PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Off-screen high-fidelity template for direct Malayalam and Arabic PDF rendering */}
      <StudyNotePrintTemplate
        note={activeExportNote}
        student={student}
        containerRef={printTemplateRef}
      />
    </Panel>
  )
}
