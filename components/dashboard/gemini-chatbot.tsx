'use client'

import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Bot,
  Camera,
  Check,
  Compass,
  Copy,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  ImagePlus,
  Languages,
  Loader2,
  MessageSquareText,
  Mic,
  MicOff,
  Paperclip,
  Printer,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react'
import {
  fetchAiChatReply,
  normalizeSpokenVoiceText,
  transcribeVoiceAudio,
  type ClientChatAttachment,
} from '@/lib/ai-chat-client'
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
  detectInputLanguage,
  isArabicText,
  isArabicLine,
  isUrduText,
  isUrduLine,
  type StudyNoteExportData,
} from '@/components/dashboard/study-note-pdf'
import { exportStudyNoteDirectDocx } from '@/components/dashboard/study-note-docx'

export type ChatRole = 'usthad' | 'academic' | 'language' | 'campus'
export type ChatLanguage = 'ml' | 'en' | 'ar' | 'ur' | 'es' | 'de'
export type ResponseLanguagePreference = 'auto' | ChatLanguage
export type ChatModelTier = 'flash' | 'flash-lite'

export interface ChatAttachmentItem {
  id: string
  name: string
  mimeType: string
  previewUrl: string
  base64Data: string
}

export interface ChatTurnMessage {
  id: string
  role: 'user' | 'model'
  text: string
  timestamp: number
  modelUsed?: string
  persona?: ChatRole
  attachments?: {
    name: string
    mimeType: string
    previewUrl: string
  }[]
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
    newChat: 'Clear Chat',
    turnSingular: 'turn',
    turnPlural: 'turns',
    activeRole: 'Active System Role:',
    maintainsMemory: 'Maintains multi-turn memory across your conversation.',
    voiceTyping: 'Voice Typing',
    voiceListening: 'Listening... Speak clearly',
    voiceStop: 'Stop Voice',
    voiceNotSupported:
      'Speech recognition is not supported in this browser. Please use Chrome, Safari, or Edge.',
  },
  ml: {
    tryAsking: 'Try asking:',
    placeholder: (personaTitle) => `Ask ${personaTitle}...`,
    send: 'Send',
    thinking: (personaTitle) => `${personaTitle} is thinking...`,
    analyzing: 'Preparing answer · Analyzing conversation history',
    selectPersona: 'Select Chatbot Persona',
    responseLang: 'Response Language:',
    newChat: 'Clear Chat',
    turnSingular: 'turn',
    turnPlural: 'turns',
    activeRole: 'Active System Role:',
    maintainsMemory: 'Maintains multi-turn memory across your conversation.',
    voiceTyping: 'Voice Typing',
    voiceListening: 'Listening... Speak clearly',
    voiceStop: 'Stop Voice',
    voiceNotSupported:
      'Speech recognition is not supported in this browser. Please use Chrome, Safari, or Edge.',
  },
  ar: {
    tryAsking: 'Try asking:',
    placeholder: (personaTitle) => `Ask ${personaTitle}...`,
    send: 'Send',
    thinking: (personaTitle) => `${personaTitle} is thinking...`,
    analyzing: 'Preparing answer · Analyzing conversation history',
    selectPersona: 'Select Chatbot Persona',
    responseLang: 'Response Language:',
    newChat: 'Clear Chat',
    turnSingular: 'turn',
    turnPlural: 'turns',
    activeRole: 'Active System Role:',
    maintainsMemory: 'Maintains multi-turn memory across your conversation.',
    voiceTyping: 'Voice Typing',
    voiceListening: 'Listening... Speak clearly',
    voiceStop: 'Stop Voice',
    voiceNotSupported:
      'Speech recognition is not supported in this browser. Please use Chrome, Safari, or Edge.',
  },
  ur: {
    tryAsking: 'Try asking:',
    placeholder: (personaTitle) => `Ask ${personaTitle}...`,
    send: 'Send',
    thinking: (personaTitle) => `${personaTitle} is thinking...`,
    analyzing: 'Preparing answer · Analyzing conversation history',
    selectPersona: 'Select Chatbot Persona',
    responseLang: 'Response Language:',
    newChat: 'Clear Chat',
    turnSingular: 'turn',
    turnPlural: 'turns',
    activeRole: 'Active System Role:',
    maintainsMemory: 'Maintains multi-turn memory across your conversation.',
    voiceTyping: 'Voice Typing',
    voiceListening: 'Listening... Speak clearly',
    voiceStop: 'Stop Voice',
    voiceNotSupported:
      'Speech recognition is not supported in this browser. Please use Chrome, Safari, or Edge.',
  },
  es: {
    tryAsking: 'Try asking:',
    placeholder: (personaTitle) => `Ask ${personaTitle}...`,
    send: 'Send',
    thinking: (personaTitle) => `${personaTitle} is thinking...`,
    analyzing: 'Preparing answer · Analyzing conversation history',
    selectPersona: 'Select Chatbot Persona',
    responseLang: 'Response Language:',
    newChat: 'Clear Chat',
    turnSingular: 'turn',
    turnPlural: 'turns',
    activeRole: 'Active System Role:',
    maintainsMemory: 'Maintains multi-turn memory across your conversation.',
    voiceTyping: 'Voice Typing',
    voiceListening: 'Listening... Speak clearly',
    voiceStop: 'Stop Voice',
    voiceNotSupported:
      'Speech recognition is not supported in this browser. Please use Chrome, Safari, or Edge.',
  },
  de: {
    tryAsking: 'Try asking:',
    placeholder: (personaTitle) => `Ask ${personaTitle}...`,
    send: 'Send',
    thinking: (personaTitle) => `${personaTitle} is thinking...`,
    analyzing: 'Preparing answer · Analyzing conversation history',
    selectPersona: 'Select Chatbot Persona',
    responseLang: 'Response Language:',
    newChat: 'Clear Chat',
    turnSingular: 'turn',
    turnPlural: 'turns',
    activeRole: 'Active System Role:',
    maintainsMemory: 'Maintains multi-turn memory across your conversation.',
    voiceTyping: 'Voice Typing',
    voiceListening: 'Listening... Speak clearly',
    voiceStop: 'Stop Voice',
    voiceNotSupported:
      'Speech recognition is not supported in this browser. Please use Chrome, Safari, or Edge.',
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
    label: 'Fast Mode',
    modelBadge: 'Fast Mode',
    description: 'Fast Instant Responses (~1.3s)',
    icon: Zap,
  },
  {
    id: 'flash',
    label: 'Deep Scholar',
    modelBadge: 'Deep Scholar',
    description: 'Deep Scholarly Tasks (Auto-fallback)',
    icon: Sparkles,
  },
]

const LEGACY_SHARED_CHAT_KEY = 'ics_gemini_chat_threads_v3'
const USER_CHAT_KEY_PREFIX = 'ics_gemini_chat_threads_v4_'

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
    /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+(?:[\s،؛؟«»ـ\-/:,.0-9\u0660-\u0669\u06F0-\u06F9]+[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)*[،؛؟.!]*|[\u0D00-\u0D7F\u200C\u200D]+(?:\s+[\u0D00-\u0D7F\u200C\u200D]+)*)/g
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
          className={cn(useUrdu ? 'font-urdu' : 'font-arabic', 'unicode-bidi-isolate')}
        >
          {part}
        </bdi>
      )
    }
    return <React.Fragment key={`${keyPrefix}-tx-${idx}`}>{part}</React.Fragment>
  })
}

function renderSlantedWords(content: string, keyPrefix: string, preferUrduFont = false) {
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(content)) {
    return renderScriptRuns(content, `${keyPrefix}-sw-rtl`, preferUrduFont)
  }
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
  rawLine: string,
  keyPrefix: string,
  isUser: boolean,
  preferUrduFont = false,
) {
  // Merge adjacent bold/italic Arabic words so they stay in a single RTL phrase run
  const line = rawLine
    .replace(
      /\*\*([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s،؛؟]+)\*\*\s+\*\*([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s،؛؟]+)\*\*/g,
      '**$1 $2**',
    )
    .replace(
      /\*([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s،؛؟]+)\*\s+\*([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s،؛؟]+)\*/g,
      '*$1 $2*',
    )
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

export function GeminiChatbot({
  student,
  mobileFullScreen = false,
}: {
  student: Student
  mobileFullScreen?: boolean
}) {
  const [role, setRole] = useState<ChatRole>('usthad')
  const [language, setLanguage] = useState<ChatLanguage>('en')
  const [responseLanguagePreference, setResponseLanguagePreference] =
    useState<ResponseLanguagePreference>('auto')
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
  const [isTranscribingVoice, setIsTranscribingVoice] = useState(false)
  const [voiceLevel, setVoiceLevel] = useState(0)
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const silenceTimerRef = useRef<number | null>(null)
  const liveChunkTimerRef = useRef<number | null>(null)
  const isChunkTranscribingRef = useRef<boolean>(false)
  const speechGotTranscriptRef = useRef<boolean>(false)
  const stopVoiceCaptureRef = useRef<(() => void) | null>(null)
  const speechBaseTextRef = useRef<string>('')
  const voiceSessionIdRef = useRef<number>(0)
  const voiceNormalizeTimerRef = useRef<number | null>(null)
  const voiceNormalizeReqIdRef = useRef<number>(0)
  const lastNormalizedInputRef = useRef<string>('')
  const lastSentTextRef = useRef<string>('')
  const lastSentAtRef = useRef<number>(0)
  const responseLangPrefRef = useRef<ResponseLanguagePreference>(responseLanguagePreference)
  responseLangPrefRef.current = responseLanguagePreference

  // Multimodal Study Attachments (Photos of Kitabs, textbooks, notes, PDFs)
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachmentItem[]>([])
  const [isProcessingAttachment, setIsProcessingAttachment] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null)
  const studyImageInputRef = useRef<HTMLInputElement | null>(null)

  // Live In-App Camera Viewfinder State
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)

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

  // Real-time spoken script normalizer so Auto mode immediately displays the exact language spoken
  function scheduleLiveSpokenScriptUpdate(
    rawSpoken: string,
    immediate = false,
    sessionId = voiceSessionIdRef.current,
  ) {
    if (sessionId !== voiceSessionIdRef.current) return
    const cleanSpoken = rawSpoken.trim()
    if (!cleanSpoken) return

    const base = speechBaseTextRef.current
    setInput(base ? `${base} ${cleanSpoken}` : cleanSpoken)
    setErrorMessage(null)

    if (voiceNormalizeTimerRef.current) {
      window.clearTimeout(voiceNormalizeTimerRef.current)
      voiceNormalizeTimerRef.current = null
    }

    const activePref = responseLangPrefRef.current
    const runNormalization = async () => {
      if (sessionId !== voiceSessionIdRef.current) return
      if (cleanSpoken === lastNormalizedInputRef.current) return
      const reqId = ++voiceNormalizeReqIdRef.current
      try {
        const normalized = await normalizeSpokenVoiceText({
          rawTranscript: cleanSpoken,
          language: activePref === 'auto' ? 'auto' : activePref,
        })
        if (
          sessionId === voiceSessionIdRef.current &&
          reqId === voiceNormalizeReqIdRef.current &&
          normalized.trim()
        ) {
          lastNormalizedInputRef.current = cleanSpoken
          const currentBase = speechBaseTextRef.current
          setInput(currentBase ? `${currentBase} ${normalized.trim()}` : normalized.trim())
        }
      } catch {
        // Keep the live transcript already in the input box
      }
    }

    if (immediate) {
      void runNormalization()
    } else {
      voiceNormalizeTimerRef.current = window.setTimeout(() => {
        void runNormalization()
      }, 420)
    }
  }

  // Listen for native Android voice recognition results if triggered via ICSNativeBridge
  useEffect(() => {
    const onNativeVoiceResult = (e: Event) => {
      const customEv = e as CustomEvent<{ text?: string; error?: string }>
      setIsListening(false)
      setErrorMessage(null)
      const spoken = String(customEv.detail?.text ?? '').trim()
      if (spoken) {
        scheduleLiveSpokenScriptUpdate(spoken, true, voiceSessionIdRef.current)
      }
    }
    window.addEventListener('ics-native-voice-result', onNativeVoiceResult)
    return () => window.removeEventListener('ics-native-voice-result', onNativeVoiceResult)
  }, [])

  // Auto-resize textarea height smoothly like the Gemini app composer
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const nextHeight = Math.min(Math.max(el.scrollHeight, 40), 144)
    el.style.height = `${nextHeight}px`
  }, [input, language])

  // Clean up voice recognition, audio streams, and camera streams on unmount
  useEffect(() => {
    return () => {
      if (voiceNormalizeTimerRef.current) {
        window.clearTimeout(voiceNormalizeTimerRef.current)
      }
      if (liveChunkTimerRef.current) {
        window.clearInterval(liveChunkTimerRef.current)
      }
      if (stopVoiceCaptureRef.current) {
        stopVoiceCaptureRef.current()
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // Ignore
        }
      }
      if (cameraStreamRef.current) {
        try {
          cameraStreamRef.current.getTracks().forEach((t) => t.stop())
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

  const currentMessages = useMemo(
    () =>
      (threads[role] ?? []).filter(
        (m) =>
          m &&
          ((typeof m.text === 'string' && m.text.trim().length > 0) ||
            (Array.isArray(m.attachments) && m.attachments.length > 0)),
      ),
    [threads, role],
  )

  const safeStudentId = useMemo(() => sanitizeId(student.id), [student.id])
  const userChatStorageKey = useMemo(() => {
    const uniqueKey = sanitizeId(`${student.id}_${student.admissionNo || ''}`)
    return `${USER_CHAT_KEY_PREFIX}${uniqueKey}`
  }, [student.id, student.admissionNo])

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

  // Load saved threads strictly isolated per logged-in student ID (and purge old shared global storage key)
  useEffect(() => {
    const cleanMismatchedTurns = (arr: ChatTurnMessage[] | undefined, fallback: ChatTurnMessage[]) => {
      if (!Array.isArray(arr) || arr.length === 0) return fallback
      const filtered = arr.filter((msg, idx) => {
        if (!msg || typeof msg.text !== 'string' || !msg.text.trim()) return false
        if (msg.role === 'model' && !msg.id.startsWith('welcome-') && isUrduText(msg.text)) {
          const prevUser = arr[idx - 1]
          if (!prevUser || /[\u0D00-\u0D7F]/.test(prevUser.text) || !isUrduText(prevUser.text)) {
            return false
          }
        }
        return true
      })
      return filtered.length > 0 ? filtered : fallback
    }

    try {
      // Remove legacy shared chat key so no user ever sees another user's messages
      window.localStorage.removeItem(LEGACY_SHARED_CHAT_KEY)

      const defaults = buildDefaultThreads(language)
      const raw = window.localStorage.getItem(userChatStorageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Record<ChatRole, ChatTurnMessage[]>>
        if (parsed && typeof parsed === 'object') {
          setThreads({
            usthad: cleanMismatchedTurns(parsed.usthad, defaults.usthad),
            academic: cleanMismatchedTurns(parsed.academic, defaults.academic),
            language: cleanMismatchedTurns(parsed.language, defaults.language),
            campus: cleanMismatchedTurns(parsed.campus, defaults.campus),
          })
          return
        }
      }
      setThreads(defaults)
    } catch {
      setThreads(buildDefaultThreads(language))
    }
  }, [userChatStorageKey])

  // Persist threads under the current user's isolated key
  useEffect(() => {
    try {
      window.localStorage.setItem(userChatStorageKey, JSON.stringify(threads))
    } catch {
      // Ignore quota errors
    }
  }, [threads, userChatStorageKey])

  // Scroll thread container cleanly when messages change
  useEffect(() => {
    const el = threadContainerRef.current
    if (!el) return
    if (currentMessages.length <= 1 && !sending) {
      el.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [currentMessages, sending])

  async function compressAndReadStudyFile(file: File): Promise<ChatAttachmentItem> {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (isPdf) {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const res = typeof reader.result === 'string' ? reader.result : ''
          const comma = res.indexOf(',')
          resolve(comma >= 0 ? res.slice(comma + 1) : res)
        }
        reader.onerror = () => reject(new Error('Could not read PDF file'))
        reader.readAsDataURL(file)
      })
      return {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name || 'Study Document.pdf',
        mimeType: 'application/pdf',
        previewUrl: '',
        base64Data,
      }
    }

    // Compress image on canvas to max 1500px so high-res phone photos upload in <1 second
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () =>
        resolve(typeof reader.result === 'string' ? reader.result : '')
      reader.onerror = () => reject(new Error('Could not read image file'))
      reader.readAsDataURL(file)
    })

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Invalid image format'))
      image.src = dataUrl
    })

    const maxDim = 1500
    let targetW = img.naturalWidth || img.width || 800
    let targetH = img.naturalHeight || img.height || 800
    if (targetW > maxDim || targetH > maxDim) {
      const ratio = Math.min(maxDim / targetW, maxDim / targetH)
      targetW = Math.max(1, Math.round(targetW * ratio))
      targetH = Math.max(1, Math.round(targetH * ratio))
    }

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, targetW, targetH)
      ctx.drawImage(img, 0, 0, targetW, targetH)
    }

    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.84)
    const commaIdx = compressedDataUrl.indexOf(',')
    const base64Data = commaIdx >= 0 ? compressedDataUrl.slice(commaIdx + 1) : compressedDataUrl

    // Create a smaller 420px thumbnail for chat bubble history storage
    const thumbMax = 420
    let thumbW = targetW
    let thumbH = targetH
    if (thumbW > thumbMax || thumbH > thumbMax) {
      const r = Math.min(thumbMax / thumbW, thumbMax / thumbH)
      thumbW = Math.max(1, Math.round(thumbW * r))
      thumbH = Math.max(1, Math.round(thumbH * r))
    }
    const thumbCanvas = document.createElement('canvas')
    thumbCanvas.width = thumbW
    thumbCanvas.height = thumbH
    const thumbCtx = thumbCanvas.getContext('2d')
    if (thumbCtx) {
      thumbCtx.drawImage(canvas, 0, 0, thumbW, thumbH)
    }
    const previewUrl = thumbCanvas.toDataURL('image/jpeg', 0.72)

    return {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name || 'Kitab-Page.jpg',
      mimeType: 'image/jpeg',
      previewUrl,
      base64Data,
    }
  }

  async function processSelectedStudyFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList)
    if (files.length === 0) return

    setErrorMessage(null)
    setIsProcessingAttachment(true)
    try {
      const remainingSlots = Math.max(0, 3 - pendingAttachments.length)
      if (remainingSlots === 0) {
        setErrorMessage('You can attach up to 3 study images or documents per message.')
        return
      }
      const selected = files.slice(0, remainingSlots)
      const processed: ChatAttachmentItem[] = []
      for (const file of selected) {
        const isAllowed =
          file.type.startsWith('image/') ||
          file.type === 'application/pdf' ||
          /\.(jpg|jpeg|png|webp|heic|pdf)$/i.test(file.name)
        if (!isAllowed) {
          setErrorMessage('Please attach an image (JPG, PNG, WEBP) or PDF study document.')
          continue
        }
        if (file.size > 18 * 1024 * 1024) {
          setErrorMessage('File is too large. Please select an image or PDF under 18 MB.')
          continue
        }
        const item = await compressAndReadStudyFile(file)
        processed.push(item)
      }
      if (processed.length > 0) {
        setPendingAttachments((prev) => [...prev, ...processed].slice(0, 3))
      }
    } catch (err) {
      console.warn('Attachment processing failed:', err)
      setErrorMessage('Could not load the selected image. Please try another photo.')
    } finally {
      setIsProcessingAttachment(false)
    }
  }

  function handleRemovePendingAttachment(id: string) {
    setPendingAttachments((prev) => prev.filter((item) => item.id !== id))
  }

  function handlePasteIntoComposer(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items
    if (!items) return
    const imageFiles: File[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === 'file' && (item.type.startsWith('image/') || item.type === 'application/pdf')) {
        const file = item.getAsFile()
        if (file) imageFiles.push(file)
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault()
      void processSelectedStudyFiles(imageFiles)
    }
  }

  function cancelAllVoiceActivity(resetBuffers = true) {
    voiceSessionIdRef.current += 1
    voiceNormalizeReqIdRef.current += 1

    if (voiceNormalizeTimerRef.current) {
      window.clearTimeout(voiceNormalizeTimerRef.current)
      voiceNormalizeTimerRef.current = null
    }

    if (resetBuffers) {
      speechBaseTextRef.current = ''
      lastNormalizedInputRef.current = ''
      speechGotTranscriptRef.current = false
    }

    audioChunksRef.current = []
    isChunkTranscribingRef.current = false
    stopVoiceCaptureRef.current = null

    if (recognitionRef.current) {
      const rec = recognitionRef.current
      recognitionRef.current = null
      try {
        rec.onstart = null
        rec.onresult = null
        rec.onerror = null
        rec.onend = null
        if (typeof rec.abort === 'function') {
          rec.abort()
        } else if (typeof rec.stop === 'function') {
          rec.stop()
        }
      } catch {
        // Ignore
      }
    }

    if (mediaRecorderRef.current) {
      const recorder = mediaRecorderRef.current
      mediaRecorderRef.current = null
      try {
        recorder.ondataavailable = null
        recorder.onstop = null
        if (recorder.state !== 'inactive') {
          recorder.stop()
        }
      } catch {
        // Ignore
      }
    }

    cleanupAudioResources()
    setIsListening(false)
    setIsTranscribingVoice(false)
  }

  async function handleSendMessage(customText?: string) {
    const attachmentsToSend = [...pendingAttachments]
    const currentDomValue = textareaRef.current?.value ?? ''
    const rawTypedText = (customText ?? (input || currentDomValue)).trim()

    if (!rawTypedText && attachmentsToSend.length === 0) return
    if (sending) return

    // Immediately cancel all active or in-flight voice recognition, audio transcription, and script normalization
    // so no trailing callback can ever write the old voice-typed text back into the input box after Send.
    cancelAllVoiceActivity(true)

    lastSentTextRef.current = rawTypedText
    lastSentAtRef.current = Date.now()
    setInput('')

    if (textareaRef.current) {
      textareaRef.current.value = ''
      textareaRef.current.style.height = '40px'
    }

    const previousHistory = currentMessages
      .filter((m) => !m.id.startsWith('welcome-') && m.text.trim().length > 0)
      .map((m) => ({
        role: m.role,
        text: m.text,
      }))

    const isAutoLanguage = responseLanguagePreference === 'auto'
    const effectiveLanguage: ChatLanguage = isAutoLanguage
      ? detectInputLanguage(rawTypedText, 'en', previousHistory)
      : responseLanguagePreference

    // Default scholarly prompt when a student sends a photo without typing a question
    const defaultImagePrompt =
      effectiveLanguage === 'ml'
        ? 'ഈ ചിത്രത്തിലെ പാഠഭാഗം വായിച്ച് മലയാളത്തിലേക്ക് വിവർത്തനം ചെയ്യുകയും പ്രധാന ആശയങ്ങൾ വിശദീകരിക്കുകയും ചെയ്യുക.'
        : 'Please read the text in this study image, translate it clearly into Malayalam and English, and explain the key scholarly points.'

    const textToSend = rawTypedText || defaultImagePrompt

    setPendingAttachments([])
    setErrorMessage(null)

    // In Auto mode, keep the UI language in English ('en') so starter chips, placeholders, and error banners never flip to Arabic/RTL
    if (!isAutoLanguage && effectiveLanguage !== language) {
      setLanguage(effectiveLanguage)
    } else if (isAutoLanguage && language !== 'en') {
      setLanguage('en')
    }

    const userMsg: ChatTurnMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: Date.now(),
      persona: role,
      ...(attachmentsToSend.length > 0
        ? {
            attachments: attachmentsToSend.map((att) => ({
              name: att.name,
              mimeType: att.mimeType,
              previewUrl: att.previewUrl,
            })),
          }
        : {}),
    }

    setThreads((prev) => ({
      ...prev,
      [role]: [...(prev[role] ?? []), userMsg],
    }))

    setSending(true)

    try {
      const apiAttachments: ClientChatAttachment[] = attachmentsToSend.map((att) => ({
        mimeType: att.mimeType,
        data: att.base64Data,
        name: att.name,
      }))

      const data = await fetchAiChatReply({
        message: textToSend.slice(0, 2000),
        history: previousHistory,
        role,
        language: effectiveLanguage,
        languageMode: isAutoLanguage ? 'auto' : 'explicit',
        modelTier,
        studentName: student.name,
        studentClass: student.className,
        ...(apiAttachments.length > 0 ? { attachments: apiAttachments } : {}),
      })

      const botMsg: ChatTurnMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: String(data.reply ?? '').trim(),
        timestamp: Date.now(),
        modelUsed: String(
          data.modelUsed ??
            (modelTier === 'flash-lite' ? 'gemini-3.1-flash-lite' : 'gemini-3.8-flash'),
        ),
        persona: role,
      }

      setThreads((prev) => ({
        ...prev,
        [role]: [...(prev[role] ?? []), botMsg],
      }))
    } catch (err) {
      const rawMsg =
        err instanceof Error
          ? err.message
          : 'Could not receive a response right now. Please try again.'
      setErrorMessage(rawMsg)
    } finally {
      setSending(false)
    }
  }

  function handleResetThread() {
    cancelAllVoiceActivity(true)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.value = ''
      textareaRef.current.style.height = '40px'
    }
    const defaultForRole = buildDefaultThreads(language)[role]
    setThreads((prev) => {
      const updated = {
        ...prev,
        [role]: defaultForRole,
      }
      try {
        window.localStorage.setItem(userChatStorageKey, JSON.stringify(updated))
      } catch {
        // Ignore storage errors
      }
      return updated
    })
    setPendingAttachments([])
    setErrorMessage(null)
  }

  function handleSelectLanguage(newPref: ResponseLanguagePreference) {
    if (isListening || isTranscribingVoice) {
      cancelAllVoiceActivity(false)
    }

    // Clicking the currently active explicit language toggles back to 'auto'
    const resolvedPref: ResponseLanguagePreference =
      newPref !== 'auto' && responseLanguagePreference === newPref ? 'auto' : newPref

    setResponseLanguagePreference(resolvedPref)

    if (resolvedPref === 'auto') {
      setLanguage('en')
    } else {
      setLanguage(resolvedPref)
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
                  text: persona.welcomeMessage[resolvedPref],
                },
                ...msgs.slice(1),
              ]
            }
          }
        })
        return updated
      })
    }
  }

  function cleanupAudioResources() {
    setVoiceLevel(0)
    if (liveChunkTimerRef.current) {
      window.clearInterval(liveChunkTimerRef.current)
      liveChunkTimerRef.current = null
    }
    if (silenceTimerRef.current) {
      window.clearInterval(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    if (audioContextRef.current) {
      try {
        void audioContextRef.current.close()
      } catch {
        // Ignore
      }
      audioContextRef.current = null
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      } catch {
        // Ignore
      }
      mediaStreamRef.current = null
    }
  }

  async function transcribeAudioBlob(
    blob: Blob,
    mimeHint: string,
    isLiveRolling = false,
    sessionId = voiceSessionIdRef.current,
  ) {
    if (sessionId !== voiceSessionIdRef.current) return
    if (!blob || blob.size < 300) return
    if (isLiveRolling && isChunkTranscribingRef.current) return

    if (isLiveRolling) {
      isChunkTranscribingRef.current = true
    } else {
      setIsTranscribingVoice(true)
    }
    setErrorMessage(null)

    try {
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const res = typeof reader.result === 'string' ? reader.result : ''
          const commaIdx = res.indexOf(',')
          resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res)
        }
        reader.onerror = () => reject(new Error('Failed to read recorded audio'))
        reader.readAsDataURL(blob)
      })

      if (!base64Audio || sessionId !== voiceSessionIdRef.current) return

      const activePref = responseLangPrefRef.current
      const rawResult = await transcribeVoiceAudio({
        audioBase64: base64Audio,
        mimeType: (mimeHint || blob.type || 'audio/webm').split(';')[0] || 'audio/webm',
        language: activePref === 'auto' ? 'auto' : activePref,
      })

      if (sessionId !== voiceSessionIdRef.current) return

      const cleanText = String(
        typeof rawResult === 'string'
          ? rawResult
          : (rawResult as { text?: string })?.text ?? '',
      ).trim()

      if (cleanText && cleanText !== '__SILENT__') {
        speechGotTranscriptRef.current = true
        const base = speechBaseTextRef.current
        setInput(base ? `${base} ${cleanText}` : cleanText)
        setErrorMessage(null)
      }
    } catch (err) {
      console.warn('Voice transcription note:', err)
    } finally {
      if (isLiveRolling) {
        isChunkTranscribingRef.current = false
      } else if (sessionId === voiceSessionIdRef.current) {
        setIsTranscribingVoice(false)
      }
    }
  }

  function closeLiveCameraModal() {
    if (cameraStreamRef.current) {
      try {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop())
      } catch {
        // Ignore
      }
      cameraStreamRef.current = null
    }
    setIsCameraModalOpen(false)
    setCameraError(null)
  }

  async function openLiveCameraModal() {
    if (pendingAttachments.length >= 3) {
      setErrorMessage('You can attach up to 3 study images per message.')
      return
    }
    setErrorMessage(null)
    setCameraError(null)
    setIsCameraModalOpen(true)

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setCameraError('Live camera is not supported in this browser. Please use the Photo (+) button to select an image.')
      return
    }

    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 }, height: { ideal: 1200 } },
          audio: false,
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      }
      cameraStreamRef.current = stream
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream
        void cameraVideoRef.current.play().catch(() => {})
      }
    } catch (err: any) {
      const errName = String(err?.name || '')
      if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setCameraError('No camera hardware found on this device. Use the Photo (+) button to attach an image file.')
      } else {
        setCameraError('Camera permission is blocked in this window. Please allow Camera access or use the Photo (+) button.')
      }
    }
  }

  function handleCapturePhotoFromVideo() {
    const video = cameraVideoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) return

    const maxDim = 1500
    let targetW = video.videoWidth
    let targetH = video.videoHeight
    if (targetW > maxDim || targetH > maxDim) {
      const ratio = Math.min(maxDim / targetW, maxDim / targetH)
      targetW = Math.max(1, Math.round(targetW * ratio))
      targetH = Math.max(1, Math.round(targetH * ratio))
    }

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0, targetW, targetH)
    }

    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.86)
    const commaIdx = compressedDataUrl.indexOf(',')
    const base64Data = commaIdx >= 0 ? compressedDataUrl.slice(commaIdx + 1) : compressedDataUrl

    const thumbCanvas = document.createElement('canvas')
    const r = Math.min(420 / targetW, 420 / targetH, 1)
    thumbCanvas.width = Math.max(1, Math.round(targetW * r))
    thumbCanvas.height = Math.max(1, Math.round(targetH * r))
    const tCtx = thumbCanvas.getContext('2d')
    if (tCtx) {
      tCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height)
    }
    const previewUrl = thumbCanvas.toDataURL('image/jpeg', 0.75)

    const newItem: ChatAttachmentItem = {
      id: `att-${Date.now()}`,
      name: `Kitab-Capture-${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.jpg`,
      mimeType: 'image/jpeg',
      previewUrl,
      base64Data,
    }

    setPendingAttachments((prev) => [...prev, newItem].slice(0, 3))
    closeLiveCameraModal()
  }

  async function startMediaRecorderVoiceCapture(
    sessionId = voiceSessionIdRef.current,
  ): Promise<boolean> {
    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function' ||
      typeof window.MediaRecorder === 'undefined'
    ) {
      return false
    }

    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      if (sessionId !== voiceSessionIdRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return false
      }
      mediaStreamRef.current = stream

      const preferredMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/aac',
      ]
      let chosenMimeType = ''
      for (const candidate of preferredMimeTypes) {
        if (
          typeof MediaRecorder.isTypeSupported === 'function' &&
          MediaRecorder.isTypeSupported(candidate)
        ) {
          chosenMimeType = candidate
          break
        }
      }

      const recorder = chosenMimeType
        ? new MediaRecorder(stream, { mimeType: chosenMimeType })
        : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (ev: BlobEvent) => {
        if (sessionId !== voiceSessionIdRef.current) return
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data)
        }
      }

      const stopVoiceCapture = () => {
        stopVoiceCaptureRef.current = null
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state !== 'inactive'
        ) {
          try {
            mediaRecorderRef.current.stop()
          } catch {
            cleanupAudioResources()
            setIsListening(false)
          }
        } else {
          cleanupAudioResources()
          setIsListening(false)
        }
      }

      stopVoiceCaptureRef.current = stopVoiceCapture

      recorder.onstop = async () => {
        const recordedMime = recorder.mimeType || chosenMimeType || 'audio/webm'
        const chunks = [...audioChunksRef.current]
        audioChunksRef.current = []
        cleanupAudioResources()
        setIsListening(false)

        if (sessionId !== voiceSessionIdRef.current || chunks.length === 0) return
        const blob = new Blob(chunks, { type: recordedMime })
        await transcribeAudioBlob(blob, recordedMime, false, sessionId)
      }

      try {
        recorder.start(250)
      } catch {
        recorder.start()
      }
      setIsListening(true)
      setErrorMessage(null)

      // Stream live rolling audio snapshots every 1.6s so words appear live in the input box while speaking
      const recordedMimeForLive = recorder.mimeType || chosenMimeType || 'audio/webm'
      liveChunkTimerRef.current = window.setInterval(() => {
        if (
          sessionId === voiceSessionIdRef.current &&
          audioChunksRef.current.length > 0 &&
          !isChunkTranscribingRef.current
        ) {
          const liveBlob = new Blob([...audioChunksRef.current], {
            type: recordedMimeForLive,
          })
          if (liveBlob.size > 800) {
            void transcribeAudioBlob(liveBlob, recordedMimeForLive, true, sessionId)
          }
        }
      }, 1600)

      // Live audio level meter + smart silence detection
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        if (AudioCtx) {
          const audioCtx = new AudioCtx()
          audioContextRef.current = audioCtx
          if (audioCtx.state === 'suspended') {
            void audioCtx.resume().catch(() => {})
          }
          const source = audioCtx.createMediaStreamSource(stream)
          const analyser = audioCtx.createAnalyser()
          analyser.fftSize = 512
          source.connect(analyser)
          const dataArray = new Uint8Array(analyser.frequencyBinCount)
          let hasDetectedSpeech = false
          let sustainedSpeechFrames = 0
          let silenceStartMs = 0
          const startedAtMs = Date.now()

          silenceTimerRef.current = window.setInterval(() => {
            analyser.getByteTimeDomainData(dataArray)
            let sumSquares = 0
            for (let i = 0; i < dataArray.length; i++) {
              const normalized = (dataArray[i] - 128) / 128
              sumSquares += normalized * normalized
            }
            const rms = Math.sqrt(sumSquares / dataArray.length)
            const now = Date.now()
            const elapsedMs = now - startedAtMs

            setVoiceLevel(Math.min(100, Math.round(rms * 420)))

            if (elapsedMs > 700) {
              if (rms > 0.015) {
                sustainedSpeechFrames += 1
                if (sustainedSpeechFrames >= 2) {
                  hasDetectedSpeech = true
                }
                silenceStartMs = 0
              } else if (hasDetectedSpeech) {
                if (!silenceStartMs) {
                  silenceStartMs = now
                } else if (now - silenceStartMs > 2200) {
                  stopVoiceCapture()
                }
              }
            }

            if (elapsedMs > 45000) {
              stopVoiceCapture()
            }
          }, 150)
        }
      } catch {
        // Silence detection is optional; manual Done button remains available
      }

      return true
    } catch {
      cleanupAudioResources()
      return false
    }
  }

  async function toggleVoiceInput() {
    if (isListening) {
      if (stopVoiceCaptureRef.current) {
        stopVoiceCaptureRef.current()
      } else {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop()
          } catch {
            // Ignore
          }
        }
        cleanupAudioResources()
        setIsListening(false)
      }
      return
    }

    if (typeof window === 'undefined' || isTranscribingVoice) return

    const currentSessionId = ++voiceSessionIdRef.current
    setErrorMessage(null)
    speechBaseTextRef.current = input.trim()
    speechGotTranscriptRef.current = false
    lastNormalizedInputRef.current = ''
    audioChunksRef.current = []

    const nativeBridge = (
      window as unknown as {
        ICSNativeBridge?: {
          requestMicrophonePermission?: () => void
          startVoiceInput?: (lang: string) => boolean
        }
      }
    ).ICSNativeBridge

    try {
      nativeBridge?.requestMicrophonePermission?.()
    } catch {
      // Ignore
    }

    const speechLangMap: Record<ChatLanguage, string> = {
      ml: 'ml-IN',
      ar: 'ar-SA',
      ur: 'ur-PK',
      es: 'es-ES',
      de: 'de-DE',
      en: 'en-IN',
    }

    const activeSpeechLang: ChatLanguage =
      responseLanguagePreference === 'auto' ? 'ml' : responseLanguagePreference
    const targetBcp47 = speechLangMap[activeSpeechLang] || 'ml-IN'

    // 1. Primary Engine for BOTH Auto & Explicit modes: Real-Time Web Speech API
    // Streams words into the input box immediately ("അപ്പപ്പോൾ തന്നെ") as the user speaks,
    // and in Auto mode runs live script normalization so Malayalam, English, Arabic, Urdu, Spanish, or German
    // appears in its native script in real time ready to click Send.
    const SpeechRecognitionClass =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .webkitSpeechRecognition

    if (SpeechRecognitionClass) {
      try {
        const recognition = new SpeechRecognitionClass()
        recognition.continuous = false
        recognition.interimResults = true
        recognition.lang = targetBcp47

        recognition.onstart = () => {
          if (currentSessionId !== voiceSessionIdRef.current) return
          setIsListening(true)
          setErrorMessage(null)
        }

        recognition.onresult = (event: any) => {
          if (currentSessionId !== voiceSessionIdRef.current) return
          let transcript = ''
          let hasFinal = false
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript
            if (event.results[i].isFinal) {
              hasFinal = true
            }
          }
          const cleanSpeech = transcript.trim()
          if (cleanSpeech) {
            speechGotTranscriptRef.current = true
            if (responseLangPrefRef.current === 'auto') {
              scheduleLiveSpokenScriptUpdate(cleanSpeech, hasFinal, currentSessionId)
            } else {
              const base = speechBaseTextRef.current
              setInput(base ? `${base} ${cleanSpeech}` : cleanSpeech)
            }
          }
        }

        recognition.onerror = async (event: any) => {
          if (currentSessionId !== voiceSessionIdRef.current) return
          const errCode = String(event?.error || '')
          setIsListening(false)
          if (
            !speechGotTranscriptRef.current &&
            (errCode === 'not-allowed' ||
              errCode === 'service-not-allowed' ||
              errCode === 'network' ||
              errCode === 'language-not-supported' ||
              errCode === 'audio-capture')
          ) {
            // Silently fall back to live MediaRecorder or Android Native Bridge without showing any red error banner
            const startedRecorder = await startMediaRecorderVoiceCapture(currentSessionId)
            if (!startedRecorder && nativeBridge && typeof nativeBridge.startVoiceInput === 'function') {
              try {
                if (nativeBridge.startVoiceInput(targetBcp47)) {
                  setIsListening(true)
                }
              } catch {
                // Ignore
              }
            }
          }
        }

        recognition.onend = () => {
          if (currentSessionId === voiceSessionIdRef.current) {
            setIsListening(false)
          }
        }

        recognition.start()
        recognitionRef.current = recognition
        return
      } catch {
        setIsListening(false)
      }
    }

    // 2. Fallback Engine: Live MediaRecorder with rolling 1.6s audio transcription
    const startedRecorder = await startMediaRecorderVoiceCapture(currentSessionId)
    if (startedRecorder) {
      return
    }

    // 3. Final Fallback for older Android WebViews: Native RecognizerIntent Bridge
    try {
      if (nativeBridge && typeof nativeBridge.startVoiceInput === 'function') {
        const started = nativeBridge.startVoiceInput(targetBcp47)
        if (started) {
          setIsListening(true)
          return
        }
      }
    } catch {
      // Ignore
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

  async function handleDirectPdfDownload(action: 'download' | 'print' = 'download') {
    if (!activeExportNote || isGeneratingDirectPdf) return
    const el = printTemplateRef.current

    setIsGeneratingDirectPdf(true)
    setDirectPdfSuccess(false)
    setExportDocsError(null)

    try {
      await exportStudyNoteDirectPdf({
        element: el,
        fileName: docTitleInput.trim() || 'ics-academy-study-note',
        action,
        note: activeExportNote,
        student,
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
  const isRtlLang = false
  const activeStarterLang: ChatLanguage =
    responseLanguagePreference === 'auto' ? 'en' : responseLanguagePreference

  return (
    <Panel
      id="gemini-chatbot"
      eyebrow="Da'wa College · AI Scholar"
      title="Da'wa College Chatbot"
      icon={MessageSquareText}
      className={cn(
        'border-lime/30',
        mobileFullScreen &&
          'max-lg:flex max-lg:flex-1 max-lg:min-h-0 max-lg:flex-col max-lg:overflow-hidden rounded-none border-0 bg-transparent p-0 sm:p-0 md:p-0 [&>header]:hidden lg:rounded-2xl lg:border lg:border-lime/30 lg:bg-card lg:p-6 lg:[&>header]:flex',
      )}
      action={
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {/* Top Language Switcher */}
          <div
            role="group"
            aria-label="Select chat response language"
            className="inline-flex max-w-full flex-wrap rounded-xl border border-border bg-background/70 p-1"
          >
            <button
              type="button"
              onClick={() => handleSelectLanguage('auto')}
              title="Reply in the language you ask"
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap',
                responseLanguagePreference === 'auto'
                  ? 'bg-lime text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Auto
            </button>
            {LANGUAGES.map((lang) => {
              const active = responseLanguagePreference === lang.id
              return (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => handleSelectLanguage(lang.id)}
                  title={`Reply in ${lang.label}`}
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
            aria-label="Select response speed tier"
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
      <div
        className={cn(
          'grid min-w-0 gap-6 lg:grid-cols-12',
          mobileFullScreen &&
            'max-lg:flex max-lg:flex-1 max-lg:min-h-0 max-lg:flex-col max-lg:overflow-hidden gap-0 lg:grid lg:gap-6',
        )}
      >
        {/* Left Sidebar: Chatbot Roles (System Instructions) & Language Controls */}
        <div
          className={cn(
            'flex min-w-0 flex-col justify-between gap-4 lg:col-span-4',
            mobileFullScreen && 'hidden lg:flex',
          )}
        >
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
                <button
                  type="button"
                  onClick={() => handleSelectLanguage('auto')}
                  className={cn(
                    'rounded-md px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap',
                    responseLanguagePreference === 'auto'
                      ? 'bg-lime text-primary-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Auto
                </button>
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
                      responseLanguagePreference === lang.id
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
              <p className="w-full text-[11px] text-lime/90">
                {responseLanguagePreference === 'auto'
                  ? '✓ Auto Mode: Replies automatically in the language you ask.'
                  : `✓ Selected Response Language (${LANGUAGES.find((l) => l.id === responseLanguagePreference)?.label}): Replies will be in this language regardless of question language.`}
              </p>
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
        <div
          className={cn(
            'flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-background/60 lg:col-span-8',
            mobileFullScreen &&
              'max-lg:flex-1 max-lg:min-h-0 max-lg:h-full rounded-none border-0 bg-background/95 lg:h-auto lg:rounded-2xl lg:border lg:border-border lg:bg-background/60',
          )}
        >
          {/* Mobile & Tablet Clean Fixed Header: Mentor Title, Role Tabs & Language Bar (Never Scrolls) */}
          {mobileFullScreen ? (
            <div className="flex shrink-0 flex-col gap-2 border-b border-border/80 bg-card/90 px-3.5 py-2.5 backdrop-blur-md lg:hidden">
              {/* Row 1: Full Mentor Title & Subtitle + Clear Button */}
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-lime/25 bg-lime/15 text-lime">
                    <currentPersona.icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-xs font-bold text-foreground sm:text-sm">
                      {currentPersona.title}
                    </h2>
                    <p className="truncate text-[11px] font-medium text-lime/90">
                      {currentPersona.subTitle}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetThread}
                  disabled={sending || currentMessages.length <= 1}
                  title="New Chat / Clear History"
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-border bg-background/90 px-2.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-40"
                >
                  <RotateCcw className="size-3" aria-hidden="true" />
                  <span>Clear</span>
                </button>
              </div>

              {/* Row 2: Horizontal Scrollable Mentor Role Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
                        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
                        active
                          ? 'border-lime/60 bg-lime/15 text-foreground shadow-xs'
                          : 'border-border/80 bg-background/60 text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <persona.icon
                        className={cn('size-3.5 shrink-0', active ? 'text-lime' : 'text-muted-foreground')}
                        aria-hidden="true"
                      />
                      <span>{persona.title}</span>
                      {msgCount > 0 ? (
                        <span className="rounded-full bg-lime/20 px-1.5 py-0.2 font-mono text-[9.5px] font-bold text-lime">
                          {msgCount}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>

              {/* Row 3: Clean Horizontal Scrollable Language Selector */}
              <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Reply:
                </span>
                <div
                  role="group"
                  aria-label="Select chat language"
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-border/80 bg-background/80 p-0.5"
                >
                  <button
                    type="button"
                    onClick={() => handleSelectLanguage('auto')}
                    className={cn(
                      'rounded-md px-2 py-0.5 text-[10.5px] font-semibold transition-colors whitespace-nowrap',
                      responseLanguagePreference === 'auto'
                        ? 'bg-lime text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Auto
                  </button>
                  {LANGUAGES.map((lang) => {
                    const active = responseLanguagePreference === lang.id
                    return (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => handleSelectLanguage(lang.id)}
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[10.5px] font-medium transition-colors whitespace-nowrap',
                          lang.id === 'ml' && 'font-malayalam',
                          lang.id === 'ar' && 'font-arabic',
                          lang.id === 'ur' && 'font-urdu text-xs leading-none',
                          active
                            ? 'bg-primary text-primary-foreground font-semibold'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {lang.id === 'en' ? 'EN' : lang.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {/* Thread Header (Desktop & Non-Fullscreen) */}
          <div
            className={cn(
              'flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3.5 py-3 sm:px-4',
              mobileFullScreen && 'hidden lg:flex',
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-lime/15 text-lime">
                <currentPersona.icon className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="break-words text-xs font-semibold text-foreground sm:text-sm">
                  {currentPersona.title}{' '}
                  <span className="font-normal text-muted-foreground">
                    · {currentPersona.subTitle}
                  </span>
                </h3>
                <p className="truncate text-[11px] text-muted-foreground">
                  Private chat for {student.firstName} ({student.admissionNo})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleResetThread}
                disabled={sending || currentMessages.length <= 1}
                title="Clear your chat history"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card/90 px-2.5 text-xs font-semibold text-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive disabled:opacity-45"
              >
                <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Clear Chat</span>
              </button>
            </div>
          </div>

          {/* Scrollable Messages Container — ONLY THIS BOX SCROLLS */}
          <div
            ref={threadContainerRef}
            className={cn(
              'relative flex flex-col gap-3.5 overflow-y-auto overscroll-y-contain p-3.5 sm:p-4 md:p-5',
              mobileFullScreen
                ? 'min-h-0 flex-1 lg:h-[430px] lg:flex-none'
                : 'h-[390px] sm:h-[430px]',
            )}
            aria-live="polite"
          >
            {mobileFullScreen && turnCount === 0 ? (
              <div className="flex flex-col gap-1 rounded-2xl border border-lime/25 bg-gradient-to-br from-lime/10 via-cyan/5 to-transparent px-3.5 py-3 lg:hidden">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-lime">
                  Da&apos;wa College · {currentPersona.badge}
                </p>
                <h3 className="font-display text-base font-bold tracking-tight text-foreground sm:text-lg">
                  Assalamu Alaikum, <span className="text-lime">{student.firstName}</span>
                </h3>
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                  {currentPersona.description}
                </p>
              </div>
            ) : null}

            {currentMessages.map((msg, idx) => {
              const isUser = msg.role === 'user'
              const msgIsAr = isArabicText(msg.text)
              const msgIsUr = msgIsAr && isUrduText(msg.text)
              return (
                <div
                  key={msg.id}
                  data-chat-turn={msg.role}
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
                    {msg.attachments && msg.attachments.length > 0 ? (
                      <div className="mb-1 flex flex-wrap gap-2" dir="ltr">
                        {msg.attachments.map((att, attIdx) =>
                          att.previewUrl ? (
                            <button
                              key={`${msg.id}-att-${attIdx}`}
                              type="button"
                              onClick={() =>
                                setLightboxImage({
                                  url: att.previewUrl,
                                  name: att.name || 'Study Image',
                                })
                              }
                              className="group relative overflow-hidden rounded-xl border border-white/20 bg-black/20 shadow-xs transition-transform hover:scale-[1.02]"
                            >
                              <img
                                src={att.previewUrl}
                                alt={att.name || 'Attached study page'}
                                className="max-h-44 w-auto max-w-[220px] object-cover"
                              />
                              <span className="absolute inset-x-0 bottom-0 truncate bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white">
                                {att.name}
                              </span>
                            </button>
                          ) : (
                            <div
                              key={`${msg.id}-att-${attIdx}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-black/15 px-2.5 py-1.5 text-xs font-medium"
                            >
                              <FileText className="size-3.5 shrink-0" aria-hidden="true" />
                              <span className="max-w-[180px] truncate">{att.name}</span>
                            </div>
                          ),
                        )}
                      </div>
                    ) : null}

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

          {/* Pinned Bottom Composer Area (Starter Prompts + Attachments + Voice Banner + Input/Mic Bar — Never Scrolls) */}
          <div className="shrink-0 bg-card/90 backdrop-blur-md">
            {/* Starter Prompts Bar (Hidden when photos are attached so Quick Study Actions take focus) */}
            {pendingAttachments.length === 0 ? (
              <div
                dir="ltr"
                className="border-t border-border/60 bg-background/30 px-3.5 py-1.5 text-left"
              >
                <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                    {UI_TEXT.en.tryAsking}
                  </span>
                  {(currentPersona.starters[activeStarterLang] ?? currentPersona.starters.en).map(
                    (starter) => (
                      <button
                        key={starter.label}
                        type="button"
                        disabled={sending}
                        onClick={() => void handleSendMessage(starter.prompt)}
                        className={cn(
                          'shrink-0 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-xs font-medium text-foreground/90 transition-colors hover:border-lime/50 hover:bg-lime/10 disabled:opacity-50',
                          activeStarterLang === 'ml' && 'font-malayalam',
                          activeStarterLang === 'ar' && 'font-arabic',
                          activeStarterLang === 'ur' && 'font-urdu text-sm',
                        )}
                      >
                        {starter.label}
                      </button>
                    ),
                  )}
                </div>
              </div>
            ) : null}

            {/* Pending Multimodal Study Attachments Tray + 1-Tap Study Action Chips */}
            {pendingAttachments.length > 0 || isProcessingAttachment ? (
              <div
                dir="ltr"
                className="flex flex-col gap-2 border-t border-lime/30 bg-lime/5 px-3.5 py-2.5 text-left"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  {pendingAttachments.map((att) => (
                    <div
                      key={att.id}
                      className="group relative flex items-center gap-2 rounded-xl border border-lime/40 bg-card/95 p-1.5 pr-7 shadow-xs"
                    >
                      {att.previewUrl ? (
                        <img
                          src={att.previewUrl}
                          alt={att.name}
                          className="size-11 rounded-lg object-cover border border-border/60"
                        />
                      ) : (
                        <div className="flex size-11 items-center justify-center rounded-lg bg-lime/15 text-lime">
                          <FileText className="size-5" aria-hidden="true" />
                        </div>
                      )}
                      <div className="min-w-0 max-w-[130px]">
                        <p className="truncate text-[11px] font-semibold text-foreground">
                          {att.name}
                        </p>
                        <p className="text-[10px] text-lime">Ready for analysis</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemovePendingAttachment(att.id)}
                        aria-label={`Remove ${att.name}`}
                        className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-background/90 text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
                      >
                        <X className="size-3" aria-hidden="true" />
                      </button>
                    </div>
                  ))}

                  {isProcessingAttachment ? (
                    <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/80 px-3 py-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin text-lime" aria-hidden="true" />
                      <span>Preparing image...</span>
                    </div>
                  ) : null}
                </div>

                {/* Quick 1-Tap Multimodal Study Actions */}
                <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <span className="shrink-0 text-[10.5px] font-semibold text-lime">
                    Quick Action:
                  </span>
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() =>
                      void handleSendMessage(
                        responseLanguagePreference === 'ml'
                          ? 'ഈ ചിത്രത്തിലെ ഭാഗം വായിച്ച് മലയാളത്തിലേക്കും ഇംഗ്ലീഷിലേക്കും കൃത്യമായി വിവർത്തനം ചെയ്യുക. പ്രധാന പദങ്ങളുടെ അർത്ഥവും നൽകുക.'
                          : 'Transcribe the text in this image and translate it clearly into Malayalam and English with key vocabulary meanings.',
                      )
                    }
                    className="shrink-0 rounded-full border border-lime/40 bg-lime/15 px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-lime hover:text-primary-foreground"
                  >
                    Translate Page (മലയാളം / EN)
                  </button>
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() =>
                      void handleSendMessage(
                        responseLanguagePreference === 'ml'
                          ? 'ഈ കിതാബ് ഇബാറത്ത് പൂർണ്ണ ഹറകത്തുകളോടെ എഴുതി, ഓരോ പദത്തിന്റെയും അർത്ഥവും നഹ്‌വ്/സർഫ് ഇഅ്റാബും ഫിഖ്ഹീ വിധിയും മലയാളത്തിൽ വിശദീകരിക്കുക.'
                          : "Read the Kitab Ibarat in this image, provide full vocalized Arabic text, word-by-word meaning, Nahw/Sarf I'rab analysis, and scholarly commentary.",
                      )
                    }
                    className="shrink-0 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-lime/50 hover:bg-lime/10"
                  >
                    Explain Kitab &amp; I&apos;rab
                  </button>
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() =>
                      void handleSendMessage(
                        responseLanguagePreference === 'ml'
                          ? 'ഈ ചിത്രത്തിലെ പാഠഭാഗം വായിച്ച് പരീക്ഷയ്ക്ക് പഠിക്കാൻ എളുപ്പമുള്ള പ്രധാന പോയിന്റുകളായി (Study Notes) ചുരുക്കി തയ്യാറാക്കുക.'
                          : 'Extract the text from this page and organize it into structured, exam-ready study notes with key takeaways.',
                      )
                    }
                    className="shrink-0 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-lime/50 hover:bg-lime/10"
                  >
                    Summarize Study Notes
                  </button>
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() =>
                      void handleSendMessage(
                        responseLanguagePreference === 'ml'
                          ? 'ഈ ചിത്രത്തിലുള്ള ചോദ്യങ്ങൾ വായിച്ച് ഓരോന്നിനും കൃത്യവും ലളിതവുമായ ഉത്തരങ്ങൾ തയ്യാറാക്കുക.'
                          : 'Read the academic or exam questions shown in this image and provide clear, step-by-step scholarly answers.',
                      )
                    }
                    className="shrink-0 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-lime/50 hover:bg-lime/10"
                  >
                    Solve Questions
                  </button>
                </div>
              </div>
            ) : null}

            {/* Error Banner if any */}
            {errorMessage ? (
              <div
                role="alert"
                dir="ltr"
                className="mx-3.5 mt-2 flex items-center justify-between gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2 text-left text-xs text-destructive"
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

            {/* Active Voice Listening / Transcribing Banner with Live Audio Meter */}
            {isListening || isTranscribingVoice ? (
              <div
                role="status"
                aria-live="polite"
                dir="ltr"
                className="flex items-center justify-between gap-3 border-t border-cyan/35 bg-cyan/10 px-3.5 py-2 text-left text-xs text-cyan"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  {isTranscribingVoice ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-cyan" aria-hidden="true" />
                  ) : (
                    <span className="relative flex size-2.5 shrink-0">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan opacity-75" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-cyan" />
                    </span>
                  )}
                  <span className="truncate font-medium">
                    {isTranscribingVoice
                      ? 'Transcribing your voice...'
                      : responseLanguagePreference === 'auto'
                        ? 'Listening (Auto: മലയാളം · العربية · English · اردو)... Tap Done ✓ when finished'
                        : 'Listening... Speak now (tap Done ✓ when finished)'}
                  </span>
                  {isListening ? (
                    <div
                      aria-hidden="true"
                      className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-cyan/20 sm:block"
                    >
                      <div
                        className="h-full rounded-full bg-cyan transition-all duration-100"
                        style={{ width: `${Math.max(12, voiceLevel)}%` }}
                      />
                    </div>
                  ) : null}
                </div>
                {isListening ? (
                  <button
                    type="button"
                    onClick={() => void toggleVoiceInput()}
                    className="shrink-0 rounded-full bg-cyan px-3 py-0.5 text-[11px] font-bold text-[#081e21] shadow-xs transition-colors hover:bg-cyan/90"
                  >
                    Done ✓
                  </button>
                ) : null}
              </div>
            ) : null}

            {/* Unified Multimodal Message Input Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleSendMessage()
              }}
              className="border-t border-border/70 bg-background/40 p-2 sm:p-3"
            >
              <label htmlFor="gemini-chatbot-input" className="sr-only">
                Type your message to the Da&apos;wa College Chatbot
              </label>

              {/* Hidden file input ONLY for Photo/PDF Attachment (+) button */}
              <input
                ref={studyImageInputRef}
                id="chatbot-study-image-input"
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    void processSelectedStudyFiles(e.target.files)
                  }
                  e.target.value = ''
                }}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
              />

              <div
                dir="ltr"
                className={cn(
                  'flex w-full items-end gap-1.5 rounded-[26px] border bg-card/95 pl-2 pr-2 py-1.5 shadow-sm transition-all duration-200 focus-within:bg-card sm:gap-2 sm:pl-2.5',
                  isListening || isTranscribingVoice
                    ? 'border-cyan/70 ring-2 ring-cyan/20'
                    : pendingAttachments.length > 0
                      ? 'border-lime/70 ring-2 ring-lime/15'
                      : 'border-border/90 focus-within:border-lime/60 focus-within:ring-2 focus-within:ring-lime/15',
                )}
              >
                {/* Left Multimodal Attachment Cluster (Photo/PDF + Live Camera like Gemini App) */}
                <div className="flex shrink-0 items-center gap-0.5 self-end pb-0.5">
                  <button
                    type="button"
                    disabled={sending || pendingAttachments.length >= 3}
                    onClick={() => studyImageInputRef.current?.click()}
                    title="Attach Kitab photo, textbook page, or PDF to translate/explain"
                    aria-label="Attach photo or PDF"
                    className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-lime/15 hover:text-lime disabled:opacity-40"
                  >
                    <ImagePlus className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={sending || pendingAttachments.length >= 3}
                    onClick={() => void openLiveCameraModal()}
                    title="Open live camera to snap a photo of a Kitab or textbook page"
                    aria-label="Open live camera"
                    className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-lime/15 hover:text-lime disabled:opacity-40"
                  >
                    <Camera className="size-4" aria-hidden="true" />
                  </button>
                </div>

                <textarea
                  ref={textareaRef}
                  id="gemini-chatbot-input"
                  rows={1}
                  maxLength={2000}
                  value={input}
                  dir={input.trim().length > 0 && isArabicText(input) ? 'rtl' : 'ltr'}
                  onChange={(e) => {
                    const nextVal = e.target.value
                    // Guard against mobile keyboard (Gboard) voice IME re-committing the already-sent buffer right after tapping Send
                    if (
                      lastSentAtRef.current > 0 &&
                      Date.now() - lastSentAtRef.current < 500 &&
                      lastSentTextRef.current &&
                      nextVal.trim() === lastSentTextRef.current
                    ) {
                      e.target.value = ''
                      setInput('')
                      return
                    }
                    if (!isListening) {
                      voiceNormalizeReqIdRef.current += 1
                      if (voiceNormalizeTimerRef.current) {
                        window.clearTimeout(voiceNormalizeTimerRef.current)
                        voiceNormalizeTimerRef.current = null
                      }
                      speechBaseTextRef.current = nextVal.trim()
                    }
                    setInput(nextVal)
                  }}
                  onPaste={handlePasteIntoComposer}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void handleSendMessage()
                    }
                  }}
                  placeholder={
                    pendingAttachments.length > 0
                      ? 'Ask to translate, explain Ibarat, or tap Send...'
                      : UI_TEXT.en.placeholder(currentPersona.title)
                  }
                  className={cn(
                    'min-h-[40px] max-h-36 min-w-0 flex-1 w-full resize-none border-0 bg-transparent py-2 text-sm sm:text-[15px] leading-relaxed text-foreground placeholder:text-left placeholder:font-poppins placeholder:text-muted-foreground/70 focus:outline-none focus:ring-0 [scrollbar-width:thin]',
                    input.trim().length > 0 && isArabicText(input)
                      ? isUrduText(input)
                        ? 'text-right font-urdu leading-[2.1]'
                        : 'text-right font-arabic'
                      : /[\u0D00-\u0D7F]/.test(input)
                        ? 'text-left font-malayalam'
                        : 'text-left font-poppins',
                  )}
                />

                {/* Compact Right Action Cluster (Live Voice Button + Send Button — NEVER opens a file picker) */}
                <div className="flex shrink-0 items-center gap-1 self-end pb-0.5">
                  <button
                    type="button"
                    onClick={() => void toggleVoiceInput()}
                    disabled={sending || isTranscribingVoice}
                    title={isListening ? UI_TEXT.en.voiceStop : UI_TEXT.en.voiceTyping}
                    aria-label={isListening ? UI_TEXT.en.voiceStop : UI_TEXT.en.voiceTyping}
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan disabled:opacity-40',
                      isListening
                        ? 'bg-cyan text-[#081e21] shadow-md shadow-cyan/35 ring-2 ring-cyan/40 animate-pulse hover:bg-cyan/90'
                        : isTranscribingVoice
                          ? 'bg-cyan/20 text-cyan'
                          : 'text-muted-foreground hover:bg-cyan/15 hover:text-cyan active:bg-cyan active:text-[#081e21]',
                    )}
                  >
                    {isTranscribingVoice ? (
                      <Loader2 className="size-4 animate-spin text-cyan" aria-hidden="true" />
                    ) : isListening ? (
                      <MicOff className="size-4 text-[#081e21]" aria-hidden="true" />
                    ) : (
                      <Mic className="size-4" aria-hidden="true" />
                    )}
                  </button>

                  {/* Send Icon Button */}
                  <button
                    type="submit"
                    disabled={sending || (!input.trim() && pendingAttachments.length === 0)}
                    title={UI_TEXT[language].send}
                    aria-label={UI_TEXT[language].send}
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime',
                      (input.trim() || pendingAttachments.length > 0) && !sending
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
      </div>

      {/* In-App Live Camera Viewfinder Modal for Snapping Kitab / Study Pages */}
      {isCameraModalOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-[115] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xs"
            >
              <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Camera className="size-4 text-lime" aria-hidden="true" />
                    <span className="text-sm font-semibold text-foreground">
                      Capture Kitab / Study Page
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={closeLiveCameraModal}
                    className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="flex flex-col items-center justify-center bg-black/90 p-3">
                  {cameraError ? (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                        {cameraError}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          closeLiveCameraModal()
                          studyImageInputRef.current?.click()
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-lime px-4 py-2 text-xs font-semibold text-primary-foreground"
                      >
                        <ImagePlus className="size-4" aria-hidden="true" />
                        <span>Select Image from Device Instead</span>
                      </button>
                    </div>
                  ) : (
                    <video
                      ref={cameraVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="max-h-[60dvh] w-full rounded-xl object-contain"
                    />
                  )}
                </div>

                {!cameraError ? (
                  <div className="flex items-center justify-between border-t border-border bg-card px-4 py-3">
                    <button
                      type="button"
                      onClick={closeLiveCameraModal}
                      className="rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCapturePhotoFromVideo}
                      className="inline-flex items-center gap-2 rounded-xl bg-lime px-5 py-2 text-xs font-bold text-primary-foreground shadow-sm transition-transform active:scale-95"
                    >
                      <Camera className="size-4" aria-hidden="true" />
                      <span>Capture Page Photo</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* Lightbox Modal for Viewing Attached Study Photos */}
      {lightboxImage && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              onClick={() => setLightboxImage(null)}
              className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xs"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="relative flex max-h-[90dvh] max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <span className="truncate text-xs font-semibold text-foreground">
                    {lightboxImage.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLightboxImage(null)}
                    className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="overflow-auto p-3">
                  <img
                    src={lightboxImage.url}
                    alt={lightboxImage.name}
                    className="max-h-[78dvh] w-auto rounded-lg object-contain mx-auto"
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* Save Note -> Direct DOCX & PDF Download Modal */}
      {activeExportNote && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="study-note-export-title"
              className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-3 pt-[max(0.75rem,var(--safe-top))] backdrop-blur-xs sm:p-4"
            >
              <div className="my-auto flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-lime">
                  ICS Academy · Study Note Export
                </p>
                <h3
                  id="study-note-export-title"
                  className="mt-1 text-base font-semibold text-foreground sm:text-lg"
                >
                  Export Study Note (DOCX / Vector PDF)
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
                  ⚡ Instant Official Downloads (No Sign-in Required):
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Download the complete study note in official ICS Academy Vector PDF or editable DOCX format.
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
                        <span className="font-semibold text-xs text-foreground">Official Vector PDF</span>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        Crisp vector A4 document with official ICS Academy header, embedded Poppins fonts, student details card, and multi-script support.
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
                          <span>Generating Vector PDF...</span>
                        </>
                      ) : (
                        <>
                          <Download className="size-3.5" aria-hidden="true" />
                          <span>Download Vector PDF</span>
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

              <div className="flex flex-wrap items-center gap-2">
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
                  onClick={() => void handleDirectPdfDownload('print')}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  <Printer className="size-3.5" aria-hidden="true" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  disabled={isGeneratingDirectPdf}
                  onClick={() => void handleDirectPdfDownload('download')}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-lime/30 bg-lime/10 px-3.5 text-xs font-semibold text-lime transition-colors hover:bg-lime/20 disabled:opacity-50"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  <span>PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
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
