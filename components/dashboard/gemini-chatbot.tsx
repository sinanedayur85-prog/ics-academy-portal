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
  isUrduText,
  isUrduLine,
  type StudyNoteExportData,
} from '@/components/dashboard/study-note-pdf'
import { exportStudyNoteDirectDocx } from '@/components/dashboard/study-note-docx'

export type ChatRole = 'usthad' | 'academic' | 'language' | 'campus'
export type ChatLanguage = 'ml' | 'en' | 'ar' | 'ur' | 'es' | 'de'
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
      "Multi-turn scholarly dialogue on Fathul Mueen, Mahalli, Tafsir Jalalayn, Alfiyyah, and Shafi'i Fiqh.",
    welcomeMessage: {
      en: "السَّلَامُ عَلَيْكُمْ!\nI am the Kitab & Fiqh Mentor for ICS Academy Da'wa College. Ask any question regarding Fathul Mueen, Mahalli, Alfiyyah, Tafsir, Nahw, and Sarf.",
      ml: 'السَّلَامُ عَلَيْكُمْ!\nഐ.സി.എസ് അക്കാദമി ദാഅ്വാ കോളേജിന്റെ കിതാബ് & ഫിഖ്ഹ് മെന്ററാണ് ഞാൻ. ഫത്ഹുൽ മുഈൻ, മഹല്ലി, അൽഫിയ്യ, തഫ്സീർ ജലാലൈൻ, നഹ്‌വ്, സർഫ് എന്നിവയെക്കുറിച്ചുള്ള ഏത് സംശയങ്ങളും ചോദിക്കാം.',
      ar: 'السَّلَامُ عَلَيْكُمْ! أنا المرشد العلمي لكتب الشريعة والفقه بكلية الدعوة في أكاديمية ICS. يمكنك طرح أي سؤال حول فتح المعين، والمحلي، وألفية ابن مالك، وتفسير الجلالين، وقواعد النحو والصرف.',
      ur: 'السَّلَامُ عَلَيْكُمْ! میں آئی سی ایس اکیڈمی دعوۃ کالج کا کتاب اور فقہ مینٹر ہوں۔ آپ فتح المعین، محلی، الفیہ ابن مالک، تفسیر جلالین، نحو اور صرف سے متعلق کوئی بھی علمی سوال پوچھ سکتے ہیں۔',
      es: "السَّلَامُ عَلَيْكُمْ!\nSoy el Mentor de Kitab y Fiqh del Da'wa College de ICS Academy. Puedes hacer cualquier consulta sobre Fathul Mueen, Mahalli, Alfiyyah, Tafsir, Nahw y Sarf.",
      de: "السَّلَامُ عَلَيْكُمْ!\nIch bin der Kitab- und Fiqh-Mentor des Da'wa College der ICS Academy. Stellen Sie gerne jede Frage zu Fathul Mueen, Mahalli, Alfiyyah, Tafsir, Nahw und Sarf.",
    },
    starters: {
      en: [
        {
          label: 'Fathul Mueen — Tayammum Conditions',
          prompt:
            "What are the core conditions for Tayammum according to the Shafi'i Madhhab? Could you follow up with a short question to test my understanding?",
        },
        {
          label: "Grammar & I'rab Analysis",
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
      ur: [
        {
          label: 'فتح المعین — تیمم کی شرائط',
          prompt:
            'فقہ شافعی کی کتاب فتح المعین کے مطابق تیمم کی بنیادی شرائط کیا ہیں؟ اور آخر میں میری فہم جانچنے کے لیے ایک مختصر سوال بھی پوچھیں۔',
        },
        {
          label: 'نحوی ترکیب اور اعراب',
          prompt:
            'جملہ "الْعِلْمُ نُورٌ يَقْذِفُهُ اللَّهُ فِي الْقَلْبِ" کی نحوی ترکیب اور اعراب مرحلہ وار واضح کریں۔',
        },
        {
          label: 'اصول الفقہ — عام اور خاص',
          prompt:
            'اصول الفقہ میں العام اور الخاص کے درمیان فرق مثالوں کے ساتھ واضح کریں۔',
        },
      ],
      es: [
        {
          label: 'Fathul Mueen — Condiciones del Tayammum',
          prompt:
            '¿Cuáles son las condiciones principales del Tayammum según la escuela Shafi\'i en Fathul Mueen? Añade una breve pregunta al final para evaluar mi comprensión.',
        },
        {
          label: 'Análisis Gramatical e I\'rab',
          prompt:
            'Explica paso a paso el I\'rab y las reglas de Nahw de la frase: "الْعِلْمُ نُورٌ يَقْذِفُهُ اللَّهُ فِي الْقَلْبِ".',
        },
        {
          label: 'Usul al-Fiqh — Aam y Khas',
          prompt:
            'Explica la diferencia entre Aam (العام) y Khas (الخاص) en Usul al-Fiqh con ejemplos claros.',
        },
      ],
      de: [
        {
          label: 'Fathul Mueen — Bedingungen für Tayammum',
          prompt:
            'Was sind die wichtigsten Bedingungen für Tayammum gemäß der Schafi\'i-Rechtsschule in Fathul Mueen? Stelle mir am Ende eine kurze Verständnisfrage.',
        },
        {
          label: 'Grammatik- & I\'rab-Analyse',
          prompt:
            'Erkläre Schritt für Schritt den I\'rab und die Nahw-Regeln für den Satz: "الْعِلْمُ نُورٌ يَقْذِفُهُ اللَّهُ فِي الْقَلْبِ".',
        },
        {
          label: 'Usul al-Fiqh — Aam & Khas',
          prompt:
            'Erkläre den Unterschied zwischen Aam (العام) und Khas (الخاص) in Usul al-Fiqh anhand von Beispielen.',
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
      ur: 'خوش آمدید! میں ہیومینٹیز، اسلامی تاریخ، انگریزی اور امتحانی تیاری کے لیے آپ کا اکیڈمک ٹیوٹر ہوں۔ آج آپ کون سا مضمون دہرانا چاہیں گے؟',
      es: '¡Bienvenido! Soy tu tutor académico para la preparación de exámenes y asignaturas de Humanidades, Historia Islámica e Inglés. ¿Qué tema te gustaría repasar hoy?',
      de: 'Willkommen! Ich bin Ihr akademischer Tutor für Prüfungsvorbereitungen sowie Geisteswissenschaften, Islamische Geschichte und Englisch. Welches Fach möchten Sie heute wiederholen?',
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
      ur: [
        {
          label: 'اسلامی تاریخ — عباسی دورِ زریں',
          prompt:
            'خلافتِ عباسیہ کے علمی و فکری ارتقاء اور بیت الحکمت کے بارے میں اہم امتحانی نکات بیان کریں۔',
        },
        {
          label: 'انٹرایکٹو امتحانی کوئز',
          prompt:
            'کیرالہ میں اسلام کی تاریخ سے متعلق مجھ سے یکے بعد دیگرے 3 سوالات پوچھیں اور میرے جوابات کا جائزہ لیں۔',
        },
        {
          label: 'ہفتہ وار تعلیمی ٹائم ٹیبل',
          prompt:
            'درسِ نظامی کی کتابوں اور یونیورسٹی ڈگری مضامین دونوں کی متوازن تیاری کے لیے ہفتہ وار اسٹڈی پلان بنا کر دیں۔',
        },
      ],
      es: [
        {
          label: 'Historia Islámica — Edad de Oro Abasí',
          prompt:
            'Proporciona los puntos clave para el examen sobre los avances intelectuales y la Casa de la Sabiduría (Bayt al-Hikmah) durante el Califato Abasí.',
        },
        {
          label: 'Cuestionario Interactivo de Repaso',
          prompt:
            'Hazme 3 preguntas consecutivas sobre la historia del Islam en Kerala y evalúa mis respuestas una por una.',
        },
        {
          label: 'Horario de Estudio para Exámenes',
          prompt:
            '¿Podrías crear un plan de estudio semanal equilibrado que combine el temario de Kitabs y las asignaturas universitarias?',
        },
      ],
      de: [
        {
          label: 'Islamische Geschichte — Blütezeit der Abbasiden',
          prompt:
            'Fasse die wichtigsten Prüfungspunkte zu den wissenschaftlichen Fortschritten und dem Haus der Weisheit (Bayt al-Hikmah) im Abbasiden-Kalifat zusammen.',
        },
        {
          label: 'Interaktives Wiederholungs-Quiz',
          prompt:
            'Stelle mir 3 aufeinanderfolgende Fragen zur Geschichte des Islam in Kerala und bewerte meine Antworten einzeln.',
        },
        {
          label: 'Wöchentlicher Lernplan',
          prompt:
            'Erstelle bitte einen ausgewogenen wöchentlichen Studienplan, der sowohl das Kitab-Curriculum als auch die Studienfächer abdeckt.',
        },
      ],
    },
  },
  {
    id: 'language',
    title: 'Multilingual Coach',
    subTitle: 'Arabic · English · Malayalam · Urdu · Spanish · German',
    badge: '6 Languages · Translation · Grammar',
    icon: Languages,
    description:
      'Practice Arabic conversation (Muhadathah), academic English, Malayalam, Urdu, Spanish, and German with grammar feedback.',
    welcomeMessage: {
      en: 'Ahlan wa Sahlan! Welcome! Let us practice Arabic conversation (المحادثة العربية), academic English, Malayalam, Urdu, Spanish, and German translation. Which language would you like to start with?',
      ml: 'അഹ്‌ലൻ വ സഹ്‌ലൻ! സ്വാഗതം! അറബിക് മുഹാദസ (المحادثة العربية), ഇംഗ്ലീഷ്, മലയാളം, ഉറുദു, സ്പാനിഷ്, ജർമ്മൻ ഭാഷാ പരിശീലനവും പരിഭാഷയും നമുക്ക് ഇവിടെ നടത്താം. ഏത് ഭാഷയിലാണ് തുടങ്ങേണ്ടത്?',
      ar: 'أهلاً وسهلاً بك! دعنا نتدرب معاً على المحادثة العربية الفصحى، والإنجليزية، والمالايالامية، والأردية، والإسبانية، والألمانية مع تصويب القواعد. بأي لغة تفضل أن نبدأ؟',
      ur: 'اہلاً و سہلاً! خوش آمدید! آئیں عربی محادثہ (المحادثة العربية)، اردو، انگریزی، ملیالم، ہسپانوی اور جرمن زبان کی مشق اور علمی ترجمہ کریں۔ آپ کس زبان سے آغاز کرنا پسند کریں گے؟',
      es: '¡Ahlan wa Sahlan! ¡Bienvenido! Practiquemos conversación árabe (المحادثة العربية), español, inglés académico, urdu, alemán y traducción. ¿Con qué idioma te gustaría comenzar?',
      de: 'Ahlan wa Sahlan! Willkommen! Lassen Sie uns arabische Konversation (المحادثة العربية), Deutsch, akademisches Englisch, Urdu, Spanisch und Übersetzungen üben. Mit welcher Sprache möchten Sie beginnen?',
    },
    starters: {
      en: [
        {
          label: 'Arabic Dialogue (Muhadathah)',
          prompt:
            "Start a short Arabic conversation between a teacher and student in the Da'wa College library, with English translations.",
        },
        {
          label: 'Arabic Root & Morphology (Sarf)',
          prompt:
            'Explain the root letters and morphological derivation (Sarf) for "استغفار" (Istighfar) and "تعلّم" (Ta\'allum).',
        },
        {
          label: 'Multilingual Scholarly Translation',
          prompt:
            'Translate the Hadith "طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ" into English, Urdu, Spanish, and German with key vocabulary notes.',
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
          label: 'ബഹുഭാഷാ വൈജ്ഞാനിക പരിഭാഷ',
          prompt:
            '"طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ" എന്ന ഹദീസ് മലയാളം, ഉറുദു, സ്പാനിഷ്, ജർമ്മൻ ഭാഷകളിലേക്ക് പദപരിചയത്തോടെ വിവർത്തനം ചെയ്യാമോ?',
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
          label: 'ترجمة علمية متعددة اللغات',
          prompt:
            'ترجم حديث "طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ" إلى الأردية والإسبانية والألمانية والإنجليزية مع شرح المفردات.',
        },
      ],
      ur: [
        {
          label: 'عربی بول چال (محادثہ)',
          prompt:
            'دعوۃ کالج کی لائبریری میں استاد اور طالب علم کے درمیان ایک مختصر عربی مکالمہ اردو ترجمے کے ساتھ شروع کریں۔',
        },
        {
          label: 'عربی مادہ اور علم الصرف',
          prompt:
            'الفاظ "استغفار" اور "تعلّم" کے حروفِ اصلیہ (مادہ) اور صرفی اشتقاق کی اردو میں وضاحت کریں۔',
        },
        {
          label: 'کثیر اللسانی علمی ترجمہ',
          prompt:
            'حدیث مبارکہ "طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ" کا اردو، انگریزی، ہسپانوی اور جرمن زبان میں ترجمہ اور الفاظ کی تشریح کریں۔',
        },
      ],
      es: [
        {
          label: 'Diálogo en Árabe (Muhadathah)',
          prompt:
            'Inicia una breve conversación en árabe entre un profesor y un estudiante en la biblioteca del Da\'wa College, con traducción al español.',
        },
        {
          label: 'Raíz Árabe y Morfología (Sarf)',
          prompt:
            'Explica en español las letras radicales y la derivación morfológica (Sarf) de las palabras "استغفار" y "تعلّم".',
        },
        {
          label: 'Práctica de Español para Da\'wa',
          prompt:
            'Ayúdame a practicar español académico para presentar una charla sobre ética islámica y convivencia. Incluye vocabulario clave árabe-español.',
        },
      ],
      de: [
        {
          label: 'Arabischer Dialog (Muhadathah)',
          prompt:
            'Beginne ein kurzes arabisches Gespräch zwischen einem Lehrer und einem Studenten in der Bibliothek des Da\'wa College mit deutscher Übersetzung.',
        },
        {
          label: 'Arabische Wurzel & Morphologie (Sarf)',
          prompt:
            'Erkläre auf Deutsch die Wurzelbuchstaben und die morphologische Ableitung (Sarf) der Wörter "استغفار" und "تعلّم".',
        },
        {
          label: 'Wissenschaftliches Deutsch für Da\'wa',
          prompt:
            'Hilf mir, akademisches Deutsch für einen Vortrag über islamische Bildungsgeschichte zu üben, inklusive wichtiger arabisch-deutscher Fachbegriffe.',
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
      en: "As-salāmu ʿalaykum! I am here to assist you with Da'wa speeches, Literary Association (Sahitya Samajam) essays, and digital library recommendations.",
      ml: 'السَّلَامُ عَلَيْكُمْ! ദാഅ്വാ പ്രസംഗങ്ങൾ, സാഹിത്യ സമാജം ഉപന്യാസങ്ങൾ, ഡിജിറ്റൽ ലൈബ്രറി കിതാബുകൾ എന്നിവയിൽ സഹായിക്കാൻ ഞാൻ സദാ സന്നദ്ധനാണ്.',
      ar: 'السَّلَامُ عَلَيْكُمْ! أنا هنا لمساعدتك في إعداد الخطب الدعوية، ومقالات النادي الأدبي، وتوصيات كتب المكتبة الرقمية.',
      ur: 'السَّلَامُ عَلَيْكُمْ! میں دعوتی تقاریر، بزمِ ادب کے مضامین اور ڈیجیٹل لائبریری کی کتابوں کے انتخاب میں آپ کی رہنمائی کے لیے حاضر ہوں۔',
      es: 'السَّلَامُ عَلَيْكُمْ! Estoy aquí para ayudarte con discursos de Da\'wa, ensayos de la asociación literaria y recomendaciones de Kitabs de la biblioteca.',
      de: 'السَّلَامُ عَلَيْكُمْ! Ich unterstütze Sie gerne bei Da\'wa-Vorträgen, Aufsätzen für den Literaturverein und Buchempfehlungen aus unserer Bibliothek.',
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
            "Recommend 5 classical Kitabs that every Da'wa student should read, along with their key insights.",
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
      ur: [
        {
          label: 'تقریر کی تیاری — وقت کی پابندی',
          prompt:
            '"طلبہ اور وقت کی قدر و منزلت" کے موضوع پر قرآنی آیات اور احادیث کے حوالوں کے ساتھ ایک جامع تقریری خاکہ تیار کریں۔',
        },
        {
          label: 'مطالعہ کے لیے اہم کلاسیکی کتب',
          prompt:
            'ہر طالبِ علمِ دین و دعوت کے لیے لازمی 5 کلاسیکی کتابیں اور ان کی اہم خصوصیات تجویز کریں۔',
        },
      ],
      es: [
        {
          label: 'Preparación de Discurso — Gestión del Tiempo',
          prompt:
            'Prepara un esquema de discurso sobre "Los Estudiantes y el Valor del Tiempo" con citas del Corán y Hadices en árabe y español.',
        },
        {
          label: 'Kitabs Clásicos Imprescindibles',
          prompt:
            'Recomienda 5 Kitabs clásicos que todo estudiante de Da\'wa debería leer y explica sus enseñanzas principales.',
        },
      ],
      de: [
        {
          label: 'Vortragsentwurf — Zeitmanagement',
          prompt:
            'Erstelle eine Gliederung für einen Vortrag zum Thema "Studierende und Zeitmanagement" mit Koranversen und Hadith-Belegen auf Arabisch und Deutsch.',
        },
        {
          label: 'Empfohlene klassische Kitabs',
          prompt:
            'Empfiehl 5 klassische Kitabs, die jeder Da\'wa-Student lesen sollte, und erläutere ihre wichtigsten Inhalte.',
        },
      ],
    },
  },
]

const LANGUAGES: { id: ChatLanguage; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'ar', label: 'العربية' },
  { id: 'ml', label: 'മലയാളം' },
  { id: 'ur', label: 'اردو' },
  { id: 'es', label: 'Español' },
  { id: 'de', label: 'Deutsch' },
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
    placeholder: (personaTitle) => `Ask ${personaTitle}...`,
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
    voiceNotSupported:
      'Speech recognition is not supported in this browser. Please use Chrome, Safari, or Edge.',
  },
  ml: {
    tryAsking: 'ചോദിച്ചു നോക്കൂ:',
    placeholder: (personaTitle) => `${personaTitle}-യോട് ചോദിക്കൂ...`,
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
    voiceNotSupported:
      'ഈ ബ്രൗസറിൽ സ്പീച്ച് റെക്കഗ്നിഷൻ ലഭ്യമല്ല. ദയവായി Google Chrome അല്ലെങ്കിൽ Microsoft Edge ഉപയോഗിക്കുക.',
  },
  ar: {
    tryAsking: 'جرّب السؤال:',
    placeholder: (personaTitle) => `اسأل ${personaTitle}...`,
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
    voiceNotSupported:
      'خاصية التعرف على الصوت غير مدعومة في هذا المتصفح. يُرجى استخدام متصفح Chrome أو Safari أو Edge.',
  },
  ur: {
    tryAsking: 'یہ سوال پوچھ کر دیکھیں:',
    placeholder: (personaTitle) => `${personaTitle} سے پوچھیں...`,
    send: 'ارسال کریں',
    thinking: (personaTitle) => `${personaTitle} جواب تیار کر رہا ہے...`,
    analyzing: 'علمی جواب تیار کیا جا رہا ہے · گفتگو کے سیاق و سباق کا جائزہ',
    selectPersona: 'چیٹ بوٹ رہنما منتخب کریں',
    responseLang: 'جواب کی زبان:',
    newChat: 'نئی گفتگو',
    turnSingular: 'سوال',
    turnPlural: 'سوالات',
    activeRole: 'فعال کردار:',
    maintainsMemory: 'پوری گفتگو کے تمام پچھلے سوالات اور سیاق و سباق کو یاد رکھتا ہے۔',
    voiceTyping: 'آواز سے لکھیں',
    voiceListening: 'اردو میں سنا جا رہا ہے... براہِ کرم واضح بولیں',
    voiceStop: 'آواز روکیں',
    voiceNotSupported:
      'اس براؤزر میں وائس ٹائپنگ دستیاب نہیں ہے۔ براہِ کرم Chrome، Safari یا Edge استعمال کریں۔',
  },
  es: {
    tryAsking: 'Prueba a preguntar:',
    placeholder: (personaTitle) => `Pregunta a ${personaTitle}...`,
    send: 'Enviar',
    thinking: (personaTitle) => `${personaTitle} está pensando...`,
    analyzing: 'Preparando respuesta académica · Analizando el historial de conversación',
    selectPersona: 'Seleccionar Mentor del Chatbot',
    responseLang: 'Idioma de respuesta:',
    newChat: 'Nuevo Chat',
    turnSingular: 'turno',
    turnPlural: 'turnos',
    activeRole: 'Rol activo del sistema:',
    maintainsMemory: 'Mantiene la memoria contextual durante toda la conversación.',
    voiceTyping: 'Dictado por voz',
    voiceListening: 'Escuchando en español... Habla con claridad',
    voiceStop: 'Detener voz',
    voiceNotSupported:
      'El reconocimiento de voz no es compatible con este navegador. Utiliza Chrome, Safari o Edge.',
  },
  de: {
    tryAsking: 'Beispielfragen:',
    placeholder: (personaTitle) => `Fragen Sie ${personaTitle}...`,
    send: 'Senden',
    thinking: (personaTitle) => `${personaTitle} denkt nach...`,
    analyzing: 'Antwort wird erstellt · Gesprächsverlauf wird analysiert',
    selectPersona: 'Chatbot-Mentor auswählen',
    responseLang: 'Antwortsprache:',
    newChat: 'Neuer Chat',
    turnSingular: 'Frage',
    turnPlural: 'Fragen',
    activeRole: 'Aktive Systemrolle:',
    maintainsMemory: 'Bewahrt den gesamten Gesprächskontext über mehrere Fragen hinweg.',
    voiceTyping: 'Spracheingabe',
    voiceListening: 'Hört auf Deutsch zu... Bitte deutlich sprechen',
    voiceStop: 'Stopp',
    voiceNotSupported:
      'Spracherkennung wird in diesem Browser nicht unterstützt. Bitte verwenden Sie Chrome, Safari oder Edge.',
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

function hasSalamGreeting(text: string): boolean {
  if (!text) return false
  return (
    /\b(salam|salaam|assalam|as-salam|as\s+salam|alsalam|al-salam|assalamu|assalaamu)\b/i.test(text) ||
    /السلام|سلام|السَّلَام|سَلَام/.test(text) ||
    /സലാം|അസ്സലാമു/.test(text)
  )
}

function normalizeEnglishChatText(text: string, userSaidSalam = false): string {
  if (!text) return text
  let out = text

  // 1. Convert any Latin/Malayalam transliterated Salam back into Arabic script
  out = out
    .replace(
      /^(\s*)(?:Wa\s+[ʿ'‘’`]?alaykumu\s+s-sal[aā]m(?:\s+wa\s+ra[hḥ]matull[aā]hi\s+wa\s+barak[aā]tuh)?|Wa\s+alaikum\s+assalam(?:\s+wa\s+rahmatullahi\s+wa\s+barakatuh)?)/im,
      (_, prefix: string) =>
        `${prefix}${userSaidSalam ? 'وَعَلَيْكُمُ السَّلَامُ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ' : 'السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ'}`,
    )
    .replace(
      /^(\s*)(?:As-sal[aā]mu\s+[ʿ'‘’`]?alaykum(?:\s+wa\s+ra[hḥ]matull[aā]hi\s+wa\s+barak[aā]tuh)?|Assalamu\s+alaikum(?:\s+wa\s+rahmatullahi\s+wa\s+barakatuh)?)/im,
      '$1السَّلَامُ عَلَيْكُمْ',
    )

  // 2. If the student did NOT say Salam in the previous turn, ensure opening greeting initiates Salam (السَّلَامُ عَلَيْكُمْ) instead of returning Salam (وَعَلَيْكُمُ السَّلَامُ)
  if (!userSaidSalam) {
    out = out
      .replace(
        /^(\s*)(?:وَعَلَيْكُمُ\s+السَّلَامُ\s+وَرَحْمَةُ\s+اللَّهِ\s+وَبَرَكَاتُهُ|وعليكم\s+السلام\s+ورحمة\s+الله\s+وبركاته)/m,
        '$1السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ',
      )
      .replace(/^(\s*)(?:وَعَلَيْكُمُ\s+السَّلَامُ|وعليكم\s+السلام)/m, '$1السَّلَامُ عَلَيْكُمْ')
  }

  // 3. In English messages, ensure 'ഐ.സി.എസ് അക്കാദമി' is rendered in English as 'ICS Academy'
  const englishLetters = (out.match(/[A-Za-z]/g) || []).length
  const malayalamLetters = (out.match(/[\u0D00-\u0D7F]/g) || []).length
  if (englishLetters >= 20 && englishLetters > malayalamLetters * 3 && !isArabicText(out)) {
    out = out
      .replace(/ഐ\.?\s*സി\.?\s*എസ്\.?\s*അക്കാദമിയുടെ/g, "ICS Academy's")
      .replace(/ഐ\.?\s*സി\.?\s*എസ്\.?\s*അക്കാദമിയിൽ/g, 'at ICS Academy')
      .replace(/ഐ\.?\s*സി\.?\s*എസ്\.?\s*അക്കാദമി/g, 'ICS Academy')
  }

  // 4. Whenever an Arabic Salam at the start of a line is followed on the SAME line by English or Malayalam words (e.g. ", my dear student Muhammed Junaid"), split them onto separate lines (\n) so the English/Malayalam salutation below starts cleanly from the LEFT side!
  out = out.replace(
    /^(\s*(?:وَعَلَيْكُمُ\s+السَّلَامُ(?:\s+وَرَحْمَةُ\s+اللَّهِ\s+وَبَرَكَاتُهُ)?|وعليكم\s+السلام(?:\s+ورحمة\s+الله\s+وبركاته)?|السَّلَامُ\s+عَلَيْكُمْ(?:\s+وَرَحْمَةُ\s+اللَّهِ\s+وَبَرَكَاتُهُ)?|السلام\s+عليكم(?:\s+ورحمة\s+الله\s+وبركاته)?)[!،,]?)\s*[,،!.-]*\s+([A-Za-z\u00C0-\u024F\u0D00-\u0D7F].*)$/m,
    (_, salamPart: string, restPart: string) => {
      const cleanSalam = salamPart.replace(/[,،]\s*$/, '')
      const capitalizedRest =
        /^[a-z]/.test(restPart) ? restPart.charAt(0).toUpperCase() + restPart.slice(1) : restPart
      return `${cleanSalam}\n${capitalizedRest}`
    },
  )

  return out
}

function renderScriptRuns(
  text: string,
  keyPrefix: string,
  preferUrduFont = false,
): React.ReactNode {
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
      const useUrdu = preferUrduFont || isUrduText(part)
      return (
        <bdi
          key={`${keyPrefix}-ar-${idx}`}
          dir="rtl"
          className={useUrdu ? 'font-urdu' : 'font-arabic'}
        >
          {part}
        </bdi>
      )
    }
    return <React.Fragment key={`${keyPrefix}-tx-${idx}`}>{part}</React.Fragment>
  })
}

function renderSlantedWords(content: string, keyPrefix: string, preferUrduFont = false) {
  const parts = content.split(/(\s+)/)
  return parts.map((part, idx) => {
    if (!part) return null
    if (/^\s+$/.test(part)) {
      return <span key={`${keyPrefix}-ws-${idx}`}>{part}</span>
    }
    return (
      <span key={`${keyPrefix}-w-${idx}`} className="inline-block -skew-x-10">
        {renderScriptRuns(part, `${keyPrefix}-sw-${idx}`, preferUrduFont)}
      </span>
    )
  })
}

function renderInlineMarkdown(
  line: string,
  keyPrefix: string,
  isUser: boolean,
  preferUrduFont = false,
) {
  const tokenRegex =
    /(\*\*\*[\s\S]+?\*\*\*|___[\s\S]+?___|\*\*[\s\S]+?\*\*|__[\s\S]+?__|\*[^\s*](?:[\s\S]*?[^\s*])?\*|_[^\s_](?:[\s\S]*?[^\s_])?_|\`[^\`]+\`)/g

  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        renderScriptRuns(
          line.slice(lastIndex, match.index),
          `${keyPrefix}-pre-${match.index}`,
          preferUrduFont,
        ),
      )
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
          <em className="not-italic">{renderSlantedWords(inner, k, preferUrduFont)}</em>
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
          {renderScriptRuns(inner, `${k}-b`, preferUrduFont)}
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
          {renderSlantedWords(inner, k, preferUrduFont)}
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
          {renderScriptRuns(inner, `${k}-c`, preferUrduFont)}
        </code>,
      )
    } else {
      nodes.push(renderScriptRuns(token, `${k}-raw`, preferUrduFont))
    }

    lastIndex = tokenRegex.lastIndex
  }

  if (lastIndex < line.length) {
    nodes.push(renderScriptRuns(line.slice(lastIndex), `${keyPrefix}-end`, preferUrduFont))
  }

  return nodes.length > 0 ? nodes : renderScriptRuns(line, `${keyPrefix}-full`, preferUrduFont)
}

function FormattedChatText({
  text,
  isUser,
  activeLanguage,
  userSaidSalam = false,
}: {
  text: string
  isUser: boolean
  activeLanguage?: ChatLanguage
  userSaidSalam?: boolean
}) {
  const normalizedText = isUser ? text : normalizeEnglishChatText(text, userSaidSalam)
  const lines = normalizedText.split('\n')
  const messageIsArabic = isArabicText(normalizedText)
  const messageIsUrdu = messageIsArabic && (activeLanguage === 'ur' || isUrduText(normalizedText))
  const rtlFontClass = messageIsUrdu ? 'font-urdu' : 'font-arabic'

  return (
    <div
      dir={messageIsArabic ? 'rtl' : 'ltr'}
      className={cn(
        'flex flex-col gap-1.5 break-words',
        messageIsArabic ? `${rtlFontClass} text-right` : 'font-poppins text-left',
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
          const isAr = isArabicLine(content)
          const isUr = isAr && (messageIsUrdu || isUrduLine(content))
          return (
            <div
              key={key}
              dir={isAr ? 'rtl' : 'ltr'}
              className={cn(
                'mt-1.5 font-bold [font-synthesis:weight]',
                level <= 2 ? 'text-base text-lime' : 'text-sm text-lime',
                isAr
                  ? `text-right ${isUr ? 'font-urdu' : 'font-arabic'}`
                  : 'text-left font-poppins',
              )}
            >
              {renderInlineMarkdown(content, key, isUser, isUr)}
            </div>
          )
        }

        const quoteMatch = /^>\s*(.+)$/.exec(line.trim())
        if (quoteMatch) {
          const isAr = isArabicLine(quoteMatch[1])
          const isUr = isAr && (messageIsUrdu || isUrduLine(quoteMatch[1]))
          return (
            <blockquote
              key={key}
              dir={isAr ? 'rtl' : 'ltr'}
              className={cn(
                'my-0.5 py-1.5 text-sm',
                isAr
                  ? `border-r-2 border-l-0 rounded-l-lg rounded-r-none pr-3 pl-2 text-right border-lime/70 bg-lime/10 ${isUr ? 'font-urdu' : 'font-arabic'}`
                  : 'rounded-r-lg border-l-2 border-lime/70 bg-lime/10 pl-3 pr-2 text-left font-poppins',
              )}
            >
              {renderInlineMarkdown(quoteMatch[1], key, isUser, isUr)}
            </blockquote>
          )
        }

        const bulletMatch = /^(\s*)([*\-•])\s+(.+)$/.exec(line)
        if (bulletMatch) {
          const isAr = isArabicLine(bulletMatch[3])
          const isUr = isAr && (messageIsUrdu || isUrduLine(bulletMatch[3]))
          return (
            <div
              key={key}
              dir={isAr ? 'rtl' : 'ltr'}
              className={cn(
                'flex items-start gap-2',
                isAr ? 'pr-1 text-right' : 'pl-1 text-left font-poppins',
              )}
            >
              <span
                className={cn(
                  'mt-1.5 size-1.5 shrink-0 rounded-full',
                  isUser ? 'bg-primary-foreground' : 'bg-lime',
                )}
                aria-hidden="true"
              />
              <div className={cn('min-w-0 flex-1', isAr ? (isUr ? 'font-urdu' : 'font-arabic') : 'font-poppins')}>
                {renderInlineMarkdown(bulletMatch[3], key, isUser, isUr)}
              </div>
            </div>
          )
        }

        const numberedMatch = /^(\s*)(\d+[.)])\s+(.+)$/.exec(line)
        if (numberedMatch) {
          const isAr = isArabicLine(numberedMatch[3])
          const isUr = isAr && (messageIsUrdu || isUrduLine(numberedMatch[3]))
          return (
            <div
              key={key}
              dir={isAr ? 'rtl' : 'ltr'}
              className={cn(
                'flex items-start gap-2',
                isAr ? 'pr-0.5 text-right' : 'pl-0.5 text-left font-poppins',
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
              <div className={cn('min-w-0 flex-1', isAr ? (isUr ? 'font-urdu' : 'font-arabic') : 'font-poppins')}>
                {renderInlineMarkdown(numberedMatch[3], key, isUser, isUr)}
              </div>
            </div>
          )
        }

        const isAr = isArabicLine(line)
        const isUr = isAr && (messageIsUrdu || isUrduLine(line))
        return (
          <div
            key={key}
            dir={isAr ? 'rtl' : 'ltr'}
            className={cn(
              'whitespace-pre-wrap',
              isAr ? `text-right ${isUr ? 'font-urdu' : 'font-arabic'}` : 'text-left font-poppins',
            )}
          >
            {renderInlineMarkdown(line, key, isUser, isUr)}
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Auto-resize textarea height smoothly like the Gemini app composer
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const nextHeight = Math.min(Math.max(el.scrollHeight, 40), 144)
    el.style.height = `${nextHeight}px`
  }, [input, language])

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

    // Automatically switch to Urdu ('ur') if the user asks a question in Urdu script
    const effectiveLanguage: ChatLanguage = isUrduText(textToSend) ? 'ur' : language
    if (effectiveLanguage !== language) {
      setLanguage(effectiveLanguage)
    }

    const userMsg: ChatTurnMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: Date.now(),
      persona: role,
    }

    const previousHistory = currentMessages
      .filter((m) => !m.id.startsWith('welcome-'))
      .map((m) => ({
        role: m.role,
        text: m.text,
      }))

    setThreads((prev) => ({
      ...prev,
      [role]: [...(prev[role] ?? []), userMsg],
    }))

    setSending(true)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 45000)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: textToSend.slice(0, 2000),
          history: previousHistory,
          role,
          language: effectiveLanguage,
          modelTier,
          studentName: student.name,
          studentClass: student.className,
        }),
      })

      clearTimeout(timeoutId)

      const contentType = res.headers.get('content-type') || ''
      let data: { reply?: string; modelUsed?: string; error?: string } | null = null

      if (contentType.includes('application/json')) {
        try {
          data = await res.json()
        } catch {
          data = null
        }
      }

      if (!res.ok) {
        const errorMsg =
          data?.error ||
          (res.status === 504 || res.status === 502
            ? 'AI സെർവറിൽ മറുപടി തയ്യാറാക്കാൻ സമയമെടുത്തതിനാൽ കണക്ഷൻ തടസ്സപ്പെട്ടു (Gateway Timeout). ദയവായി വീണ്ടും ശ്രമിക്കുക.'
            : res.status === 503
              ? 'AI സെർവറിൽ ഇപ്പോൾ തിരക്ക് കൂടുതലാണ് (503). ദയവായി ഏതാനും നിമിഷങ്ങൾക്ക് ശേഷം വീണ്ടും ശ്രമിക്കുക.'
              : `സെർവറിൽ നിന്ന് മറുപടി ലഭിക്കുന്നതിൽ തടസ്സം നേരിട്ടു (${res.status}). ദയവായി വീണ്ടും ശ്രമിക്കുക.`)
        throw new Error(errorMsg)
      }

      if (!data || typeof data.reply !== 'string') {
        throw new Error('AI സെർവറിൽ നിന്ന് സാധുവായ മറുപടി ലഭിച്ചില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.')
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
      let rawMsg =
        err instanceof Error
          ? err.name === 'AbortError'
            ? 'മറുപടി തയ്യാറാക്കാൻ അനുവദിച്ച സമയം കഴിഞ്ഞു (45s Timeout). ചോദ്യം ചെറുതാക്കി വീണ്ടും ശ്രമിക്കുക.'
            : err.message
          : 'Server busy. Could not get a response. Please try again.'

      if (
        rawMsg.includes('<!doctype') ||
        rawMsg.includes('Unexpected token') ||
        rawMsg.includes('is not valid JSON') ||
        rawMsg.includes('JSON.parse')
      ) {
        rawMsg =
          'AI സെർവറിൽ മറുപടി തയ്യാറാക്കാൻ സമയമെടുത്തതിനാൽ കണക്ഷൻ തടസ്സപ്പെട്ടു. ദയവായി വീണ്ടും ശ്രമിക്കുക.'
      }

      setErrorMessage(rawMsg)
    } finally {
      clearTimeout(timeoutId)
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
        if (msgs && msgs.length > 0 && msgs[0].id.startsWith('welcome-')) {
          const persona = PERSONAS.find((p) => p.id === r)
          if (persona) {
            updated[r] = [
              {
                ...msgs[0],
                text: persona.welcomeMessage[newLang],
              },
              ...msgs.slice(1),
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

    const micDeniedMessages: Record<ChatLanguage, string> = {
      ml: 'മൈക്രോഫോൺ അനുമതി നൽകിയിട്ടില്ല. ബ്രൗസർ സെറ്റിംഗ്സിൽ (അല്ലെങ്കിൽ അഡ്രസ് ബാറിലെ മൈക്ക് ഐക്കണിൽ) മൈക്ക് പെർമിഷൻ Allow ചെയ്യുക.',
      ar: 'لم يتم السماح بالوصول إلى الميكروفون. يُرجى تفعيل إذن الميكروفون في المتصفح.',
      ur: 'مائیکروفون کی اجازت نہیں دی گئی۔ براہِ کرم براؤزر سیٹنگز میں مائیکروفون کی اجازت (Allow) دیں۔',
      es: 'Se denegó el acceso al micrófono. Por favor, permite el uso del micrófono en la configuración del navegador.',
      de: 'Der Mikrofonzugriff wurde verweigert. Bitte erlauben Sie den Mikrofonzugriff in den Browsereinstellungen.',
      en: 'Microphone access was denied. Please allow microphone permissions in browser settings.',
    }

    // Explicitly request microphone access first so browser/iframe permission prompt triggers cleanly
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((track) => track.stop())
      } catch (permErr) {
        console.warn('Microphone permission error:', permErr)
        setErrorMessage(micDeniedMessages[language])
        setIsListening(false)
        return
      }
    }

    try {
      const recognition = new SpeechRecognitionClass()
      recognition.continuous = true
      recognition.interimResults = true
      const speechLangMap: Record<ChatLanguage, string> = {
        ml: 'ml-IN',
        ar: 'ar-SA',
        ur: 'ur-PK',
        es: 'es-ES',
        de: 'de-DE',
        en: 'en-IN',
      }
      recognition.lang = speechLangMap[language] || 'en-IN'

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
          setErrorMessage(micDeniedMessages[language])
        } else if (event.error === 'no-speech') {
          // Normal timeout if user was silent
        } else {
          setErrorMessage(
            language === 'ml'
              ? `വോയിസ് റെക്കഗ്നിഷൻ: ${event.error}`
              : language === 'ur'
                ? `وائس ٹائپنگ خرابی: ${event.error}`
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
  const isRtlLang = language === 'ar' || language === 'ur'

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
                    lang.id === 'ur' && 'font-urdu text-sm leading-none',
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
                language === 'ur' && 'font-urdu',
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
                  language === 'ur' && 'font-urdu normal-case text-sm',
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
                    language === 'ur' && 'font-urdu',
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
                  language === 'ur' && 'font-urdu text-sm',
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
                      lang.id === 'ur' && 'font-urdu text-sm leading-none',
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

            <div
              className={cn(
                'border-t border-border/60 pt-2.5 text-[11px] leading-relaxed text-muted-foreground',
                language === 'ur' && 'font-urdu text-xs',
              )}
            >
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
              const msgIsAr = isArabicText(msg.text)
              const msgIsUr = msgIsAr && (isUrduText(msg.text) || language === 'ur')
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
                      msgIsAr
                        ? msgIsUr
                          ? 'text-right font-urdu'
                          : 'text-right font-arabic'
                        : 'text-left font-poppins',
                      isUser
                        ? 'border-primary/30 bg-primary text-primary-foreground'
                        : 'border-border bg-card/90 text-foreground',
                    )}
                  >
                    <FormattedChatText
                      text={msg.text}
                      isUser={isUser}
                      activeLanguage={language}
                      userSaidSalam={
                        !isUser && idx > 0 && currentMessages[idx - 1]?.role === 'user'
                          ? hasSalamGreeting(currentMessages[idx - 1].text)
                          : false
                      }
                    />

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
                      language === 'ur' && 'font-urdu text-sm',
                    )}
                  >
                    {UI_TEXT[language].thinking(currentPersona.title)}
                  </span>
                  <span
                    className={cn(
                      language === 'ml' && 'font-malayalam',
                      language === 'ar' && 'font-arabic',
                      language === 'ur' && 'font-urdu text-sm',
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
            dir={isRtlLang ? 'rtl' : 'ltr'}
            className={cn(
              'border-t border-border/60 bg-background/30 px-4 py-2',
              isRtlLang && 'text-right',
            )}
          >
            <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <span
                className={cn(
                  'shrink-0 text-[11px] font-semibold text-muted-foreground',
                  language === 'ml' && 'font-malayalam',
                  language === 'ar' && 'font-arabic',
                  language === 'ur' && 'font-urdu text-xs',
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
                    'shrink-0 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-xs font-medium text-foreground/90 transition-colors hover:border-lime/50 hover:bg-lime/10 disabled:opacity-50',
                    language === 'ml' && 'font-malayalam',
                    language === 'ar' && 'font-arabic',
                    language === 'ur' && 'font-urdu text-sm',
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
              <span className={cn(language === 'ur' && 'font-urdu text-sm')}>{errorMessage}</span>
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
              dir={isRtlLang ? 'rtl' : 'ltr'}
              className="flex items-center justify-between gap-3 border-t border-cyan/35 bg-cyan/10 px-4 py-2 text-xs text-cyan"
            >
              <div className="flex items-center gap-2">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-cyan" />
                </span>
                <span
                  className={cn(
                    'font-medium animate-pulse',
                    language === 'ml' && 'font-malayalam',
                    language === 'ar' && 'font-arabic',
                    language === 'ur' && 'font-urdu text-sm',
                  )}
                >
                  {UI_TEXT[language].voiceListening}
                </span>
              </div>
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={cn(
                  'rounded-full border border-cyan/40 bg-cyan/15 px-2.5 py-0.5 text-[11px] font-semibold text-cyan transition-colors hover:bg-cyan hover:text-[#081e21]',
                  language === 'ml' && 'font-malayalam',
                  language === 'ar' && 'font-arabic',
                  language === 'ur' && 'font-urdu text-xs',
                )}
              >
                {UI_TEXT[language].voiceStop}
              </button>
            </div>
          ) : null}

          {/* Gemini-App Style Unified Message Input Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleSendMessage()
            }}
            className="border-t border-border/70 bg-background/40 p-3 sm:p-3.5"
          >
            <label htmlFor="gemini-chatbot-input" className="sr-only">
              Type your message to the Da&apos;wa College Gemini Chatbot
            </label>
            <div
              className={cn(
                'flex w-full items-end gap-2 rounded-[26px] border bg-card/95 pl-4 pr-2 py-1.5 shadow-sm transition-all duration-200 focus-within:bg-card',
                isListening
                  ? 'border-cyan/70 ring-2 ring-cyan/20'
                  : 'border-border/90 focus-within:border-lime/60 focus-within:ring-2 focus-within:ring-lime/15',
              )}
            >
              <textarea
                ref={textareaRef}
                id="gemini-chatbot-input"
                rows={1}
                maxLength={2000}
                value={input}
                dir={(input.trim().length > 0 ? isArabicText(input) : isRtlLang) ? 'rtl' : 'ltr'}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSendMessage()
                  }
                }}
                placeholder={UI_TEXT[language].placeholder(currentPersona.title)}
                className={cn(
                  'min-h-[40px] max-h-36 min-w-0 flex-1 w-full resize-none border-0 bg-transparent py-2 text-sm sm:text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-0 [scrollbar-width:thin]',
                  (input.trim().length > 0 ? isArabicText(input) : isRtlLang)
                    ? language === 'ur' || isUrduText(input)
                      ? 'text-right font-urdu leading-[2.1]'
                      : 'text-right font-arabic'
                    : /[\u0D00-\u0D7F]/.test(input) || (input.trim().length === 0 && language === 'ml')
                      ? 'text-left font-malayalam'
                      : 'text-left font-poppins',
                )}
              />

              {/* Compact Right Action Cluster (Voice + Send Icons like Gemini App) */}
              <div className="flex shrink-0 items-center gap-1 self-end pb-0.5">
                {/* Microphone Icon Button */}
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  disabled={sending}
                  title={isListening ? UI_TEXT[language].voiceStop : UI_TEXT[language].voiceTyping}
                  aria-label={isListening ? UI_TEXT[language].voiceStop : UI_TEXT[language].voiceTyping}
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan disabled:opacity-40',
                    isListening
                      ? 'bg-cyan text-[#081e21] shadow-md shadow-cyan/35 ring-2 ring-cyan/40 animate-pulse hover:bg-cyan/90'
                      : 'text-muted-foreground hover:bg-cyan/15 hover:text-cyan active:bg-cyan active:text-[#081e21]',
                  )}
                >
                  {isListening ? (
                    <MicOff className="size-4 text-[#081e21]" aria-hidden="true" />
                  ) : (
                    <Mic className="size-4" aria-hidden="true" />
                  )}
                </button>

                {/* Send Icon Button */}
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  title={UI_TEXT[language].send}
                  aria-label={UI_TEXT[language].send}
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime',
                    input.trim() && !sending
                      ? 'bg-lime text-primary-foreground shadow-xs hover:bg-lime/90 active:scale-95'
                      : 'bg-muted/60 text-muted-foreground/40 cursor-not-allowed',
                  )}
                >
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="size-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
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
                    isArabicText(activeExportNote.prompt) &&
                      (language === 'ur' || isUrduText(activeExportNote.prompt)
                        ? 'text-right font-urdu'
                        : 'text-right font-arabic'),
                  )}
                >
                  {activeExportNote.prompt}
                </p>
                <div className="mt-2 max-h-40 overflow-y-auto border-t border-border/60 pt-2 text-xs leading-relaxed text-muted-foreground">
                  <FormattedChatText
                    text={activeExportNote.response}
                    isUser={false}
                    activeLanguage={language}
                  />
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
