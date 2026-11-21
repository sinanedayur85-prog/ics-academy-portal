'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Ban,
  BookOpen,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crown,
  FileText,
  GraduationCap,
  Library,
  Loader2,
  Lock,
  Megaphone,
  MessageCircle,
  Mic,
  Pause,
  Play,
  PlayCircle,
  RotateCcw,
  Send,
  Sparkles,
  UserCheck,
  UserCog,
  Users,
  Volume2,
  VolumeX,
  X,
  type LucideIcon,
} from 'lucide-react'
import { fetchTtsSpeechAudio } from '@/lib/ai-chat-client'
import { cn } from '@/lib/utils'

export type GuideRole = 'principal' | 'usthad' | 'class-leader' | 'student'

interface GuideHotspot {
  id: string
  stepNumber: number
  buttonLabel: string
  malayalamTitle: string
  malayalamAction: string
  tone: 'lime' | 'cyan' | 'amber' | 'red'
  xPercent: number
  yPercent: number
}

interface GuideChapter {
  id: string
  chapterNumber: number
  badge: string
  titleEn: string
  titleMl: string
  purposeMl: string
  voiceScriptMl: string
  icon: LucideIcon
  hotspots: GuideHotspot[]
}

const GUIDE_CHAPTERS_BY_ROLE: Record<GuideRole, GuideChapter[]> = {
  principal: [
    {
      id: 'principal-unheld',
      chapterNumber: 1,
      badge: '1. Campus Live Monitor • Session Control',
      titleEn: 'Unheld Periods & Substitute Usthad Command Center',
      titleMl: 'നടക്കാത്ത പിരീഡുകളും പകരക്കാരായ ഉസ്താദുമാരെയും നിയന്ത്രിക്കുന്ന ഭാഗം',
      purposeMl:
        'ഏതെങ്കിലും ക്ലാസ്സിൽ നിശ്ചയിച്ച പിരീഡിൽ ഉസ്താദ് ലീവായതുകൊണ്ടോ മറ്റ് കാരണങ്ങളാലോ ക്ലാസ് എടുത്തില്ലെങ്കിൽ അത് രേഖപ്പെടുത്താനും, പകരം മറ്റൊരു ഉസ്താദിനെ ആ പിരീഡിലേക്ക് നിയമിക്കാനും ഈ ഭാഗം ഉപയോഗിക്കുന്നു.',
      voiceScriptMl:
        'ഒന്നാമതായി, അൺഹെൽഡ് പിരീഡ്സ് ആൻഡ് സബ്സ്റ്റിറ്റ്യൂട്ട് ഉസ്താദ് കമാൻഡ് സെന്റർ. ഏതെങ്കിലും ക്ലാസ്സിൽ നിശ്ചയിച്ച പിരീഡിൽ ഉസ്താദ് ക്ലാസ് എടുത്തില്ലെങ്കിൽ, ആദ്യം സെലക്ട് ക്ലാസ് എന്നതിൽ ക്ലാസ് തിരഞ്ഞെടുക്കുക. തുടർന്ന് സെലക്ട് പിരീഡ് എന്നതിൽ ഒന്ന് മുതൽ അഞ്ച് വരെയുള്ള പിരീഡും, റീസൺ എന്നതിൽ കാരണവും തിരഞ്ഞെടുക്കുക. ശേഷം ചുവന്ന നിറത്തിലുള്ള മാർക്ക് പിരീഡ് ആസ് ക്ലാസ് നോട്ട് ഹെൽഡ് എന്ന ബട്ടണിൽ തൊട്ടാൽ ആ പിരീഡിലെ കുട്ടികളുടെ ഹാജർ തനിയെ ലോക്ക് ആകും. ഇനി പകരം മറ്റൊരു ഉസ്താദിനെ ക്ലാസ് എടുക്കാൻ വിടുകയാണെങ്കിൽ, സബ്സ്റ്റിറ്റ്യൂട്ട് ഉസ്താദ് എന്നതിൽ ആ ഉസ്താദിന്റെ പേര് തിരഞ്ഞെടുത്ത് നീല ബട്ടണിൽ തൊട്ടാൽ ഹാജർ വീണ്ടും അൺലോക്ക് ആകും.',
      icon: UserCog,
      hotspots: [
        {
          id: 'p1-h1',
          stepNumber: 1,
          buttonLabel: 'Select Class & Period (1–5)',
          malayalamTitle: 'ക്ലാസ്സും പിരീഡും തിരഞ്ഞെടുക്കുക',
          malayalamAction:
            '11 ക്ലാസ്സുകളിൽ ഏത് ക്ലാസ്സിലാണോ, ഒന്ന് മുതൽ അഞ്ച് വരെയുള്ള ഏത് പിരീഡിലാണോ മാറ്റം വരുത്തേണ്ടത് അത് ഇവിടെ തൊട്ട് തിരഞ്ഞെടുക്കുക.',
          tone: 'lime',
          xPercent: 20,
          yPercent: 32,
        },
        {
          id: 'p1-h2',
          stepNumber: 2,
          buttonLabel: 'Reason (കാരണം)',
          malayalamTitle: 'ഉസ്താദ് വരാതിരുന്ന കാരണം',
          malayalamAction:
            'ഉസ്താദ് വ്യക്തിപരമായ ലീവിലാണോ അതോ ഔദ്യോഗിക മീറ്റിംഗിലാണോ എന്ന കാരണം ഈ ഡ്രോപ്പ്‌ഡൗണിൽ നിന്ന് തിരഞ്ഞെടുക്കുക.',
          tone: 'amber',
          xPercent: 52,
          yPercent: 32,
        },
        {
          id: 'p1-h3',
          stepNumber: 3,
          buttonLabel: 'Mark Period as Class Not Held',
          malayalamTitle: 'ക്ലാസ് നടന്നില്ല എന്ന് രേഖപ്പെടുത്തി ഹാജർ ലോക്ക് ചെയ്യുക',
          malayalamAction:
            'ഈ ചുവന്ന ബട്ടണിൽ തൊട്ടാൽ ആ പിരീഡിൽ ക്ലാസ് നടന്നില്ല എന്ന് രേഖപ്പെടുത്തുകയും, കുട്ടികൾക്ക് തെറ്റായി ഹാജർ ഇടാതിരിക്കാൻ ആ പിരീഡ് തനിയെ Lock ആവുകയും ചെയ്യും.',
          tone: 'red',
          xPercent: 34,
          yPercent: 72,
        },
        {
          id: 'p1-h4',
          stepNumber: 4,
          buttonLabel: 'Assign Substitute Usthad & Unlock',
          malayalamTitle: 'പകരം ഉസ്താദിനെ നിയമിച്ച് ഹാജർ അൺലോക്ക് ചെയ്യുക',
          malayalamAction:
            'പകരം മറ്റൊരു ഉസ്താദിനെ തിരഞ്ഞെടുത്ത് ഈ നീല ബട്ടണിൽ തൊട്ടാൽ ആ പിരീഡ് പുതിയ ഉസ്താദിന്റെ പേരിലേക്ക് മാറുകയും ഹാജർ ഇടാൻ അൺലോക്ക് ആവുകയും ചെയ്യും.',
          tone: 'cyan',
          xPercent: 76,
          yPercent: 72,
        },
      ],
    },
    {
      id: 'principal-matrix',
      chapterNumber: 2,
      badge: '1. Campus Live Monitor • 11-Class Matrix',
      titleEn: '11-Class Period Session & Attendance Overview',
      titleMl: '11 ക്ലാസ്സുകളുടെയും തത്സമയ നിരീക്ഷണ പട്ടിക',
      purposeMl:
        'സ്ഥാപനത്തിലെ 11 ക്ലാസ്സുകളിലും അന്നേ ദിവസം നടക്കുന്ന 5 പിരീഡുകളുടെയും അവസ്ഥയും ഹാജർ നിലയും പ്രിൻസിപ്പലിന് ഒറ്റനോട്ടത്തിൽ നിരീക്ഷിക്കാനുള്ള ലൈവ് ബോർഡാണിത്.',
      voiceScriptMl:
        'രണ്ടാമതായി, പതിനൊന്ന് ക്ലാസ്സുകളുടെയും തത്സമയ നിരീക്ഷണ പട്ടിക. എട്ടാം ക്ലാസ് മുതൽ ബി എസ് അഞ്ച് വരെയുള്ള പതിനൊന്ന് ക്ലാസ്സുകളിലെയും ക്ലാസ് ഉസ്താദുമാരുടെയും ക്ലാസ് ലീഡർമാരുടെയും പേരുകൾ ഇവിടെ കാണാം. ഓരോ ക്ലാസ്സിനും നേരെയുള്ള പി വൺ മുതൽ പി ഫൈവ് വരെയുള്ള വട്ടങ്ങൾ ആ ദിവസത്തെ അഞ്ച് പിരീഡുകളെ സൂചിപ്പിക്കുന്നു. ഹാജർ സമർപ്പിച്ച പിരീഡുകൾ പച്ച നിറത്തിലും, ക്ലാസ് നടക്കാത്തവ ചുവപ്പ് നിറത്തിലും, പകരം ഉസ്താദ് എടുത്തവ നീല നിറത്തിലും കാണിക്കും. ഇൻസ്പെക്ട് ആൻഡ് കൺട്രോൾ എന്ന ബട്ടണിൽ തൊട്ടാൽ ആ ക്ലാസ്സിലെ മുഴുവൻ കുട്ടികളുടെയും ഹാജർ പ്രിൻസിപ്പലിന് നേരിട്ട് നിയന്ത്രിക്കാം.',
      icon: Building2,
      hotspots: [
        {
          id: 'p2-h1',
          stepNumber: 1,
          buttonLabel: 'Class Usthad & Leaders',
          malayalamTitle: 'ക്ലാസ് ഉസ്താദും ലീഡർമാരും',
          malayalamAction:
            'ഓരോ ക്ലാസ്സിന്റെയും ചുമതലയുള്ള ഉസ്താദിന്റെ പേരും, ഹാജർ രേഖപ്പെടുത്തുന്ന രണ്ട് ക്ലാസ് ലീഡർമാരുടെ പേരുകളും ഇവിടെ കാണാം.',
          tone: 'lime',
          xPercent: 22,
          yPercent: 40,
        },
        {
          id: 'p2-h2',
          stepNumber: 2,
          buttonLabel: 'Students & Avg Rate (%)',
          malayalamTitle: 'കുട്ടികളുടെ എണ്ണവും ശരാശരി ഹാജരും',
          malayalamAction:
            'ആ ക്ലാസ്സിലെ ആകെ കുട്ടികളുടെ എണ്ണവും അന്നത്തെ ശരാശരി ഹാജർ ശതമാനവും തത്സമയം ഇവിടെ കാണാം.',
          tone: 'cyan',
          xPercent: 48,
          yPercent: 40,
        },
        {
          id: 'p2-h3',
          stepNumber: 3,
          buttonLabel: 'P1 • P2 • P3 • P4 • P5 Status',
          malayalamTitle: '5 പിരീഡുകളുടെ തത്സമയ നിറങ്ങൾ',
          malayalamAction:
            'പച്ച = ക്ലാസ് നടന്നു ഹാജർ ഇട്ടു, ചുവപ്പ് = ക്ലാസ് നടന്നില്ല, നീല = പകരം ഉസ്താദ് ക്ലാസ് എടുത്തു.',
          tone: 'amber',
          xPercent: 68,
          yPercent: 40,
        },
        {
          id: 'p2-h4',
          stepNumber: 4,
          buttonLabel: 'Inspect & Control',
          malayalamTitle: 'ക്ലാസ് നേരിട്ട് പരിശോധിക്കാനും തിരുത്താനും',
          malayalamAction:
            'ഈ ബട്ടണിൽ തൊട്ടാൽ ആ ക്ലാസ്സിലെ അന്നത്തെ 5 പിരീഡുകളുടെയും കുട്ടികളുടെയും ഹാജർ പട്ടിക താഴെ തുറന്നുവരും.',
          tone: 'lime',
          xPercent: 86,
          yPercent: 40,
        },
      ],
    },
    {
      id: 'principal-directory',
      chapterNumber: 3,
      badge: '2. Usthads, Leaders & Students Directory',
      titleEn: 'Leadership, 9 Class Usthads, 22 Leaders & All Students',
      titleMl: 'ഉസ്താദുമാർ, ക്ലാസ് ലീഡർമാർ, വിദ്യാർത്ഥികൾ എന്നിവരുടെ ഡയറക്ടറി',
      purposeMl:
        'ശൈഖുനാ ഹംസ ഉസ്താദ്, മാനേജർ ഉസ്താദ്, 9 ക്ലാസ് ഉസ്താദുമാർ, 22 ക്ലാസ് ലീഡർമാർ, മുഴുവൻ വിദ്യാർത്ഥികൾ എന്നിവരുടെ വിവരങ്ങളും മാസവരി ഹാജരും രക്ഷിതാക്കൾക്കുള്ള പി.ഡി.എഫ് റിപ്പോർട്ടും എടുക്കാനുള്ള ഭാഗം.',
      voiceScriptMl:
        'മൂന്നാമതായി, ഉസ്താദുമാർ, ലീഡർമാർ, വിദ്യാർത്ഥികൾ എന്നിവരുടെ ഡയറക്ടറി. ഇതിൽ മുകളിലുള്ള മൂന്ന് ബട്ടണുകൾ വഴി ഉസ്താദുമാരുടെ ലിസ്റ്റിലേക്കും, ഇരുപത്തിരണ്ട് ക്ലാസ് ലീഡർമാരുടെ പട്ടികയിലേക്കും, മുഴുവൻ വിദ്യാർത്ഥികളുടെയും ലിസ്റ്റിലേക്കും മാറാം. ഓരോ ഉസ്താദിന്റെയും കാർഡിലുള്ള കൺട്രോൾ ക്ലാസ് ആൻഡ് പിരീഡ്സ് എന്ന പച്ച ബട്ടണിൽ തൊട്ട് അവരുടെ ക്ലാസ് നിയന്ത്രിക്കാം. സ്റ്റുഡന്റ്സ് ടാബിൽ കയറി ഏതൊരു കുട്ടിയുടെയും മാസവരി ഹാജർ തിരുത്താനും, ലീവ് രജിസ്റ്റർ ചെയ്യാനും, പേരന്റ് പി ഡി എഫ് ബട്ടണിൽ തൊട്ട് രക്ഷിതാക്കൾക്ക് അയക്കാനുള്ള ഔദ്യോഗിക റിപ്പോർട്ട് ഡൗൺലോഡ് ചെയ്യാനും സാധിക്കും.',
      icon: Users,
      hotspots: [
        {
          id: 'p3-h1',
          stepNumber: 1,
          buttonLabel: '3 Directory Sub-Tabs',
          malayalamTitle: 'ഉസ്താദുമാർ / ലീഡർമാർ / വിദ്യാർത്ഥികൾ തിരഞ്ഞെടുക്കാം',
          malayalamAction:
            'മുകളിലെ ഈ മൂന്ന് ബട്ടണുകളിൽ തൊട്ട് ഉസ്താദുമാരുടെയും, 22 ലീഡർമാരുടെയും, മുഴുവൻ കുട്ടികളുടെയും പട്ടികയിലേക്ക് മാറാം.',
          tone: 'lime',
          xPercent: 32,
          yPercent: 22,
        },
        {
          id: 'p3-h2',
          stepNumber: 2,
          buttonLabel: 'Control Class & Periods',
          malayalamTitle: 'ഉസ്താദിന്റെ ക്ലാസ് നിയന്ത്രിക്കുക',
          malayalamAction:
            'ഓരോ ഉസ്താദിന്റെയും കാർഡിലെ പച്ച ബട്ടണിൽ തൊട്ടാൽ ആ ഉസ്താദിന്റെ ക്ലാസ്സിലെ പിരീഡുകളും ഹാജരും നേരിട്ട് നിയന്ത്രിക്കാം.',
          tone: 'lime',
          xPercent: 28,
          yPercent: 68,
        },
        {
          id: 'p3-h3',
          stepNumber: 3,
          buttonLabel: 'Usthad View (Switch Workspace)',
          malayalamTitle: 'സ്വന്തം ക്ലാസ് ഉസ്താദ് വ്യൂവിലേക്ക് മാറാൻ',
          malayalamAction:
            'പ്രിൻസിപ്പലിന്റെ സ്വന്തം ക്ലാസ്സായ BS 3-ന്റെ ക്ലാസ് ഉസ്താദ് ഡാഷ്‌ബോർഡിലേക്ക് ഒറ്റ ക്ലിക്കിൽ മാറാൻ ഈ ബട്ടൺ ഉപയോഗിക്കാം.',
          tone: 'cyan',
          xPercent: 56,
          yPercent: 68,
        },
        {
          id: 'p3-h4',
          stepNumber: 4,
          buttonLabel: 'Parent PDF Report',
          malayalamTitle: 'രക്ഷിതാക്കൾക്കുള്ള ഔദ്യോഗിക PDF റിപ്പോർട്ട്',
          malayalamAction:
            'ഏതൊരു വിദ്യാർത്ഥിയുടെയും ഹാജരും ലീവ് വിവരങ്ങളും അടങ്ങിയ സീലോടുകൂടിയ PDF റിപ്പോർട്ട് ഡൗൺലോഡ് ചെയ്യാം.',
          tone: 'cyan',
          xPercent: 82,
          yPercent: 68,
        },
      ],
    },
    {
      id: 'principal-holidays',
      chapterNumber: 4,
      badge: '4. Official Holidays & Notices',
      titleEn: 'Announce Official Holidays & Campus Notices',
      titleMl: 'ഔദ്യോഗിക അവധികളും ക്യാമ്പസ് അറിയിപ്പുകളും പ്രഖ്യാപിക്കുന്ന ഭാഗം',
      purposeMl:
        'മാസത്തിലെ രണ്ടാം ശനിയാഴ്ചയോ ആഘോഷ അവധികളോ ഔദ്യോഗികമായി പ്രഖ്യാപിക്കാനും, മുഴുവൻ ക്ലാസ്സുകൾക്കോ തിരഞ്ഞെടുത്ത ക്ലാസ്സുകൾക്കോ നോട്ടീസുകൾ അയക്കാനും ഉപയോഗിക്കുന്നു.',
      voiceScriptMl:
        'നാലാമതായി, ഒഫീഷ്യൽ ഹോളിഡേയ്സ് ആൻഡ് ക്യാമ്പസ് നോട്ടീസസ്. സ്ഥാപനത്തിൽ ഔദ്യോഗിക അവധി പ്രഖ്യാപിക്കുമ്പോൾ ഒഫീഷ്യൽ ഹോളിഡേ മോഡ് എന്ന ടിക് ബോക്സ് ഓൺ ചെയ്യുക. അപ്പോൾ ആ മാസത്തെ ആകെ അധ്യയന ദിവസങ്ങളിൽ നിന്ന് ആ അവധി ദിവസങ്ങൾ എല്ലാ കുട്ടികളുടെയും ഹാജർ പട്ടികയിൽ തനിയെ കുറയും. ടാർഗറ്റ് ക്ലാസ്സസ് എന്ന ഭാഗത്ത് മുഴുവൻ ക്ലാസ്സുകൾക്കോ, ഹൈസ്കൂളിന് മാത്രമായോ, ബി എസ് ക്ലാസ്സുകൾക്ക് മാത്രമായോ അറിയിപ്പ് തിരഞ്ഞെടുത്ത് പബ്ലിഷ് ഒഫീഷ്യൽ നോട്ടീസ് അമർത്താം.',
      icon: Megaphone,
      hotspots: [
        {
          id: 'p4-h1',
          stepNumber: 1,
          buttonLabel: 'Official Holiday Mode',
          malayalamTitle: 'ഔദ്യോഗിക അവധി മോഡ് ഓൺ ചെയ്യുക',
          malayalamAction:
            'ഇത് ടിക് ചെയ്താൽ അവധി ദിനങ്ങൾ ആ മാസത്തെ ആകെ Working Days-ൽ നിന്ന് എല്ലാ കുട്ടികൾക്കും സ്വയം കുറയും.',
          tone: 'lime',
          xPercent: 25,
          yPercent: 28,
        },
        {
          id: 'p4-h2',
          stepNumber: 2,
          buttonLabel: 'Notice Title & Details',
          malayalamTitle: 'അറിയിപ്പിന്റെ തലക്കെട്ടും വിവരങ്ങളും',
          malayalamAction:
            'അറിയിപ്പിന്റെ പേരും വിശദവിവരങ്ങളും കാറ്റഗറിയും ഇവിടെ ടൈപ്പ് ചെയ്യുക.',
          tone: 'cyan',
          xPercent: 50,
          yPercent: 50,
        },
        {
          id: 'p4-h3',
          stepNumber: 3,
          buttonLabel: 'Target Classes',
          malayalamTitle: 'ഏതൊക്കെ ക്ലാസ്സുകൾക്ക് കാണണം എന്ന് തിരഞ്ഞെടുക്കുക',
          malayalamAction:
            'All 11 Classes, High School, BS Degree, അല്ലെങ്കിൽ തിരഞ്ഞെടുത്ത ക്ലാസ്സുകൾക്ക് മാത്രമായി നോട്ടീസ് അയക്കാം.',
          tone: 'amber',
          xPercent: 35,
          yPercent: 74,
        },
        {
          id: 'p4-h4',
          stepNumber: 4,
          buttonLabel: 'Publish Official Notice',
          malayalamTitle: 'അറിയിപ്പ് പ്രസിദ്ധീകരിക്കുക',
          malayalamAction:
            'ഈ പച്ച ബട്ടണിൽ തൊട്ടാൽ ഉടൻ തന്നെ എല്ലാ വിദ്യാർത്ഥികളുടെയും ഉസ്താദുമാരുടെയും നോട്ടീസ് ബോർഡിലും ബെൽ ഐക്കണിലും അറിയിപ്പ് എത്തും.',
          tone: 'lime',
          xPercent: 80,
          yPercent: 78,
        },
      ],
    },
    {
      id: 'principal-messenger',
      chapterNumber: 5,
      badge: '3. Campus Messenger & Staff Room',
      titleEn: 'WhatsApp-Style Campus Messenger & Staff Room',
      titleMl: 'വാട്സാപ്പ് ശൈലിയിലുള്ള ക്യാമ്പസ് മെസ്സഞ്ചറും സ്റ്റാഫ് റൂമും',
      purposeMl:
        'ഉസ്താദുമാരുടെ ഔദ്യോഗിക സ്റ്റാഫ് റൂം ഗ്രൂപ്പിലും, 11 ക്ലാസ്സുകളുടെ ഗ്രൂപ്പുകളിലും, ഏതൊരു ഉസ്താദുമായും വിദ്യാർത്ഥിയുമായും നേരിട്ട് സന്ദേശങ്ങളും വോയ്‌സ് നോട്ടുകളും PDF ഫയലുകളും പങ്കുവെക്കാൻ ഉപയോഗിക്കുന്നു.',
      voiceScriptMl:
        'അഞ്ചാമതായി, വാട്സാപ്പ് ശൈലിയിലുള്ള ക്യാമ്പസ് മെസ്സഞ്ചർ. ഇതിൽ ഉസ്താദുമാർക്ക് മാത്രമുള്ള സ്റ്റാഫ് റൂം ഗ്രൂപ്പും, പതിനൊന്ന് ക്ലാസ്സുകളുടെ ഒഫീഷ്യൽ ഗ്രൂപ്പുകളും ലഭ്യമാണ്. ഏതെങ്കിലും ക്ലാസ് ഗ്രൂപ്പിൽ മുകളിലുള്ള പൂട്ടിന്റെ ചിഹ്നത്തിൽ തൊട്ടാൽ ഉസ്താദുമാർക്കും പ്രിൻസിപ്പലിനും മാത്രം മെസ്സേജ് അയക്കാൻ കഴിയുന്ന രീതിയിൽ ഗ്രൂപ്പ് ലോക്ക് ചെയ്യാം. വോയ്‌സ് മെസ്സേജുകളും പി ഡി എഫ് നോട്ടുകളും ഫോട്ടോകളും ഇതിലൂടെ അയക്കാം.',
      icon: MessageCircle,
      hotspots: [
        {
          id: 'p5-h1',
          stepNumber: 1,
          buttonLabel: 'Staff Room & Class Groups',
          malayalamTitle: 'സ്റ്റാഫ് റൂമും ക്ലാസ് ഗ്രൂപ്പുകളും',
          malayalamAction:
            '9 ഉസ്താദുമാരുടെയും പ്രിൻസിപ്പലിന്റെയും സ്റ്റാഫ് റൂമിലേക്കും 11 ക്ലാസ് ഗ്രൂപ്പുകളിലേക്കും ഇവിടെ തൊട്ട് പ്രവേശിക്കാം.',
          tone: 'amber',
          xPercent: 24,
          yPercent: 36,
        },
        {
          id: 'p5-h2',
          stepNumber: 2,
          buttonLabel: 'Lock Group (Admin Only)',
          malayalamTitle: 'ഗ്രൂപ്പ് ലോക്ക് ചെയ്യാം (Only Usthads Can Post)',
          malayalamAction:
            'ചാറ്റിന് മുകളിലെ പൂട്ടിന്റെ ഐക്കണിൽ തൊട്ടാൽ ഉസ്താദുമാർക്കും പ്രിൻസിപ്പലിനും മാത്രം മെസ്സേജ് അയക്കാൻ കഴിയുന്ന രീതിയിൽ ഗ്രൂപ്പ് ലോക്ക് ആകും.',
          tone: 'cyan',
          xPercent: 76,
          yPercent: 24,
        },
        {
          id: 'p5-h3',
          stepNumber: 3,
          buttonLabel: 'Attach PDF / Photo & Voice',
          malayalamTitle: 'PDF കിതാബുകളും വോയ്‌സ് മെസ്സേജും അയക്കാം',
          malayalamAction:
            'ക്ലിപ്പ് ഐക്കണിൽ തൊട്ട് PDF നോട്ടുകളും ഫോട്ടോകളും അയക്കാം; മൈക്ക് ഐക്കണിൽ തൊട്ട് ശബ്ദ സന്ദേശവും അയക്കാം.',
          tone: 'lime',
          xPercent: 62,
          yPercent: 78,
        },
        {
          id: 'p5-h4',
          stepNumber: 4,
          buttonLabel: 'Chat Settings (⚙️)',
          malayalamTitle: 'ചാറ്റ് സെറ്റിംഗ്സ്',
          malayalamAction:
            'ഓൺലൈൻ സ്റ്റാറ്റസ്, ബ്ലൂ ടിക്, അക്ഷരങ്ങളുടെ വലിപ്പം, ചാറ്റ് വാൾപേപ്പർ എന്നിവ ഇവിടെ ക്രമീകരിക്കാം.',
          tone: 'lime',
          xPercent: 88,
          yPercent: 24,
        },
      ],
    },
    {
      id: 'principal-library',
      chapterNumber: 6,
      badge: '5. Digital Library & Portal',
      titleEn: 'Digital Kitab Library & University Exam Portal',
      titleMl: 'ഡിജിറ്റൽ കിതാബ് ലൈബ്രറിയും പരീക്ഷാ റിസൾട്ട് പോർട്ടലും',
      purposeMl:
        'വിദ്യാർത്ഥികൾക്ക് പഠിക്കാനുള്ള കിതാബുകളുടെ PDF അപ്‌ലോഡ് ചെയ്യാനും, ലൈബ്രറിയിലെ കിതാബുകൾ പരിശോധിക്കാനും, യൂണിവേഴ്സിറ്റി പരീക്ഷാ റിസൾട്ട് പോർട്ടൽ കാണാനും ഉപയോഗിക്കുന്നു.',
      voiceScriptMl:
        'ആറാമതായി, ഡിജിറ്റൽ ലൈബ്രറി ആൻഡ് പോർട്ടൽ. ഇവിടെ പുതിയ കിതാബുകളുടെ പി ഡി എഫ് ഫയലുകൾ പേരും വിഷയവും നൽകി അപ്‌ലോഡ് ചെയ്യാൻ സാധിക്കും. പ്രിൻസിപ്പലോ ഉസ്താദുമാരോ അപ്‌ലോഡ് ചെയ്യുന്ന കിതാബുകൾ ഉടൻ തന്നെ എല്ലാ വിദ്യാർത്ഥികളുടെയും ഡിജിറ്റൽ ലൈബ്രറിയിൽ വായിക്കാനും ഡൗൺലോഡ് ചെയ്യാനും ലഭ്യമാകും.',
      icon: Library,
      hotspots: [
        {
          id: 'p6-h1',
          stepNumber: 1,
          buttonLabel: 'Kitab Title & Category',
          malayalamTitle: 'കിതാബിന്റെ പേരും വിഷയവും നൽകുക',
          malayalamAction:
            'അപ്‌ലോഡ് ചെയ്യുന്ന കിതാബിന്റെ പേര്, ഗ്രന്ഥകർത്താവ്, വിഭാഗം (Fiqh, Hadith, Tafsir, Nahw) എന്നിവ നൽകുക.',
          tone: 'lime',
          xPercent: 28,
          yPercent: 34,
        },
        {
          id: 'p6-h2',
          stepNumber: 2,
          buttonLabel: 'Attach PDF & Upload',
          malayalamTitle: 'PDF ഫയൽ തിരഞ്ഞെടുത്ത് അപ്‌ലോഡ് ചെയ്യുക',
          malayalamAction:
            'കിതാബിന്റെ PDF തിരഞ്ഞെടുത്ത് Upload ബട്ടണിൽ തൊട്ടാൽ എല്ലാ വിദ്യാർത്ഥികൾക്കും അത് ലൈബ്രറിയിൽ ലഭിക്കും.',
          tone: 'cyan',
          xPercent: 72,
          yPercent: 34,
        },
        {
          id: 'p6-h3',
          stepNumber: 3,
          buttonLabel: 'Read / Download Kitab PDF',
          malayalamTitle: 'കിതാബുകൾ വായിക്കാനും ഡൗൺലോഡ് ചെയ്യാനും',
          malayalamAction:
            'ലിസ്റ്റിലുള്ള ഏത് കിതാബും ആപ്പിനുള്ളിൽ തന്നെ വായിക്കാനും PDF ആയി ഡൗൺലോഡ് ചെയ്യാനും സാധിക്കും.',
          tone: 'lime',
          xPercent: 45,
          yPercent: 72,
        },
        {
          id: 'p6-h4',
          stepNumber: 4,
          buttonLabel: 'University Exam Portal',
          malayalamTitle: 'യൂണിവേഴ്സിറ്റി പരീക്ഷാ പോർട്ടൽ',
          malayalamAction:
            'ജാമിഅത്തുൽ ഹിന്ദ് / യൂണിവേഴ്സിറ്റി പരീക്ഷാ ഫലങ്ങളും ഔദ്യോഗിക പോർട്ടലും ഇവിടെ നിന്ന് തുറക്കാം.',
          tone: 'amber',
          xPercent: 80,
          yPercent: 72,
        },
      ],
    },
  ],

  usthad: [
    {
      id: 'usthad-roster',
      chapterNumber: 1,
      badge: '1. Class Roster & Student Control',
      titleEn: 'Assigned Class Roster & Quick Student Actions',
      titleMl: 'ക്ലാസ് ഉസ്താദിന്റെ ക്ലാസ് ലിസ്റ്റും വിദ്യാർത്ഥി നിയന്ത്രണവും',
      purposeMl:
        'ക്ലാസ് ഉസ്താദിന്റെ ചുമതലയിലുള്ള ക്ലാസ്സിലെ മുഴുവൻ വിദ്യാർത്ഥികളുടെയും വിവരങ്ങൾ കാണാനും, ഓരോ കുട്ടിയുടെയും ഹാജർ, ലീവ്, രക്ഷിതാക്കൾക്കുള്ള PDF റിപ്പോർട്ട് എന്നിവ എടുക്കാനും ഉപയോഗിക്കുന്നു.',
      voiceScriptMl:
        'ഒന്നാമതായി, ക്ലാസ് ഉസ്താദ് റോസ്റ്റർ. ലോഗിൻ ചെയ്യുമ്പോൾ തന്നെ ഉസ്താദിന്റെ ചുമതലയിലുള്ള ക്ലാസ്സിലെ മുഴുവൻ വിദ്യാർത്ഥികളുടെയും ലിസ്റ്റും, അന്ന് എത്ര പേർ ക്യാമ്പസിലുണ്ട്, എത്ര പേർ ലീവിലാണ് എന്ന കണക്കും കാണാം. ഓരോ വിദ്യാർത്ഥിയുടെയും പേരിന് നേരെയുള്ള അറ്റൻഡൻസ് ബട്ടണിൽ തൊട്ട് ഹാജർ തിരുത്താനും, ലോഗ് ലീവ് ബട്ടണിൽ തൊട്ട് ലീവ് രേഖപ്പെടുത്താനും, പേരന്റ് പി ഡി എഫ് ബട്ടണിൽ തൊട്ട് രക്ഷിതാക്കൾക്ക് അയക്കാനുള്ള റിപ്പോർട്ട് എടുക്കാനും സാധിക്കും.',
      icon: Users,
      hotspots: [
        {
          id: 'u1-h1',
          stepNumber: 1,
          buttonLabel: 'Class Summary Cards',
          malayalamTitle: 'ക്ലാസ്സിലെ അന്നത്തെ കണക്കുകൾ',
          malayalamAction:
            'ക്ലാസ്സിലെ ആകെ കുട്ടികൾ, ക്യാമ്പസിൽ ഉള്ളവർ (At Academy), ലീവിലുള്ളവർ (On Leave), ക്ലാസ് ലീഡർമാർ എന്നിവ മുകളിൽ കാണാം.',
          tone: 'lime',
          xPercent: 25,
          yPercent: 28,
        },
        {
          id: 'u1-h2',
          stepNumber: 2,
          buttonLabel: 'Attendance Button',
          malayalamTitle: 'കുട്ടിയുടെ മാസവരി ഹാജർ തിരുത്താൻ',
          malayalamAction:
            'കുട്ടിയുടെ പേരിന് നേരെയുള്ള Attendance ബട്ടണിൽ തൊട്ടാൽ ആ കുട്ടിയുടെ മാസവരി ഹാജർ എഡിറ്ററിലേക്ക് പോകും.',
          tone: 'lime',
          xPercent: 45,
          yPercent: 68,
        },
        {
          id: 'u1-h3',
          stepNumber: 3,
          buttonLabel: 'Log Leave / Mark Return',
          malayalamTitle: 'ലീവ് രേഖപ്പെടുത്താനും തിരിച്ചുവരവ് അടയാളപ്പെടുത്താനും',
          malayalamAction:
            'കുട്ടി വീട്ടിൽ പോകുമ്പോൾ Log Leave എന്നും, തിരികെ കോളേജിൽ എത്തുമ്പോൾ Mark Return എന്നും ഇവിടെ തൊട്ട് രേഖപ്പെടുത്താം.',
          tone: 'amber',
          xPercent: 68,
          yPercent: 68,
        },
        {
          id: 'u1-h4',
          stepNumber: 4,
          buttonLabel: 'Parent PDF',
          malayalamTitle: 'രക്ഷിതാക്കൾക്ക് അയക്കാനുള്ള PDF റിപ്പോർട്ട്',
          malayalamAction:
            'ഇതിൽ തൊട്ടാൽ കുട്ടിയുടെ ഹാജരും ലീവ് വിവരങ്ങളും ഉസ്താദിന്റെ ഒപ്പും അടങ്ങിയ ഔദ്യോഗിക PDF റിപ്പോർട്ട് ഡൗൺലോഡ് ചെയ്യാം.',
          tone: 'cyan',
          xPercent: 88,
          yPercent: 68,
        },
      ],
    },
    {
      id: 'usthad-period-attendance',
      chapterNumber: 2,
      badge: '2. Period Attendance (Periods 1–5)',
      titleEn: 'Period-by-Period Attendance & Session Control',
      titleMl: '5 പിരീഡുകളിലെ ഹാജരും ക്ലാസ് നിയന്ത്രണവും',
      purposeMl:
        'അന്നേ ദിവസത്തെ 5 പിരീഡുകളിലെയും കുട്ടികളുടെ ഹാജർ പരിശോധിക്കാനും, Present / Absent / Leave അടയാളപ്പെടുത്തി കാരണം ചേർക്കാനും ഉപയോഗിക്കുന്നു.',
      voiceScriptMl:
        'രണ്ടാമതായി, അഞ്ച് പിരീഡുകളിലെ ഹാജർ നിയന്ത്രണം. ഇതിൽ പിരീഡ് ഒന്ന് മുതൽ അഞ്ച് വരെയുള്ള ബട്ടണുകളിൽ തൊട്ട് ഏത് പിരീഡിലെയും ഹാജർ പരിശോധിക്കാം. ഏതെങ്കിലും കുട്ടി ആബ്സെന്റ് അല്ലെങ്കിൽ ലീവ് ആണെങ്കിൽ ആ ബട്ടണിൽ തൊടുമ്പോൾ താഴെ വരുന്ന നാല് കാരണങ്ങളിൽ ഒന്ന് തിരഞ്ഞെടുക്കാം. തുടർന്ന് സബ്മിറ്റ് പിരീഡ് അറ്റൻഡൻസ് അമർത്തിയാൽ ആ പിരീഡിലെ ഹാജർ സേവ് ആകും.',
      icon: UserCheck,
      hotspots: [
        {
          id: 'u2-h1',
          stepNumber: 1,
          buttonLabel: 'Period 1 to Period 5 Tabs',
          malayalamTitle: '1 മുതൽ 5 വരെയുള്ള പിരീഡ് തിരഞ്ഞെടുക്കുക',
          malayalamAction:
            'ഓരോ പിരീഡിന്റെയും സമയവും വിഷയവും ഉസ്താദിന്റെ പേരും ഇവിടെ തൊട്ട് തിരഞ്ഞെടുക്കാം.',
          tone: 'lime',
          xPercent: 25,
          yPercent: 28,
        },
        {
          id: 'u2-h2',
          stepNumber: 2,
          buttonLabel: 'Present / Absent / Leave',
          malayalamTitle: 'കുട്ടികളുടെ ഹാജർ രേഖപ്പെടുത്തുക',
          malayalamAction:
            'ഓരോ കുട്ടിയുടെയും നേരെ Present, Absent, അല്ലെങ്കിൽ Leave ബട്ടണിൽ തൊട്ട് ഹാജർ അടയാളപ്പെടുത്താം.',
          tone: 'cyan',
          xPercent: 52,
          yPercent: 58,
        },
        {
          id: 'u2-h3',
          stepNumber: 3,
          buttonLabel: 'Select Absent / Leave Reason',
          malayalamTitle: 'ഹാജരാകാതിരുന്നതിന്റെ കാരണം തിരഞ്ഞെടുക്കുക',
          malayalamAction:
            'Absent അല്ലെങ്കിൽ Leave തൊടുമ്പോൾ വരുന്ന 4 കാരണങ്ങളിൽ (Sick, Approved Leave മുതലായവ) ഉചിതമായത് തിരഞ്ഞെടുക്കാം.',
          tone: 'amber',
          xPercent: 72,
          yPercent: 58,
        },
        {
          id: 'u2-h4',
          stepNumber: 4,
          buttonLabel: 'Submit Period Attendance',
          malayalamTitle: 'പിരീഡ് ഹാജർ സേവ് ചെയ്യുക',
          malayalamAction:
            'താഴെയുള്ള പച്ച ബട്ടണിൽ തൊടുമ്പോൾ ആ പിരീഡിലെ ഹാജർ പ്രിൻസിപ്പൽ മോണിറ്ററിലും കുട്ടികളുടെ പ്രൊഫൈലിലും തത്സമയം അപ്ഡേറ്റ് ആകും.',
          tone: 'lime',
          xPercent: 80,
          yPercent: 82,
        },
      ],
    },
    {
      id: 'usthad-monthly',
      chapterNumber: 3,
      badge: '2. Monthly Attendance Editor (June–May)',
      titleEn: 'Academic Year Monthly Working Days & Attendance Editor',
      titleMl: 'ജൂൺ മുതൽ മെയ് വരെയുള്ള മാസവരി ഹാജർ എഡിറ്റർ',
      purposeMl:
        'ജൂൺ മുതൽ മെയ് വരെയുള്ള ഓരോ മാസത്തെയും ആകെ അധ്യയന ദിവസങ്ങളും (Working Days) ഓരോ കുട്ടിക്കും ലഭിച്ച ഹാജരും ക്രമീകരിക്കാൻ ഉപയോഗിക്കുന്നു.',
      voiceScriptMl:
        'മൂന്നാമതായി, മാസവരി ഹാജർ എഡിറ്റർ. നമ്മുടെ അക്കാദമിക് വർഷമായ ജൂൺ മുതൽ മെയ് വരെയുള്ള ഏത് മാസവും ഡ്രോപ്പ്‌ഡൗണിൽ നിന്ന് തിരഞ്ഞെടുക്കാം. ആ മാസത്തെ ആകെ അധ്യയന ദിവസങ്ങളും കുട്ടി ഹാജരായ ദിവസങ്ങളും ലീവായ ദിവസങ്ങളും ഇവിടെ നൽകി സേവ് മന്ത്ലി അറ്റൻഡൻസ് അമർത്തിയാൽ കുട്ടിയുടെ ഡാഷ്‌ബോർഡിൽ അത് ഉടൻ അപ്ഡേറ്റ് ആകും.',
      icon: CalendarClock,
      hotspots: [
        {
          id: 'u3-h1',
          stepNumber: 1,
          buttonLabel: 'Select Student & Month (June–May)',
          malayalamTitle: 'വിദ്യാർത്ഥിയെയും മാസവും തിരഞ്ഞെടുക്കുക',
          malayalamAction:
            'ജൂൺ 2026 മുതൽ മെയ് 2027 വരെയുള്ള ഏത് മാസവും തിരഞ്ഞെടുത്ത് ഹാജർ ചേർക്കാം.',
          tone: 'lime',
          xPercent: 26,
          yPercent: 32,
        },
        {
          id: 'u3-h2',
          stepNumber: 2,
          buttonLabel: 'Total Working Days',
          malayalamTitle: 'ആ മാസത്തെ ആകെ അധ്യയന ദിവസങ്ങൾ',
          malayalamAction:
            'ആ മാസത്തിൽ ക്ലാസ് നടന്ന ആകെ ദിവസങ്ങളുടെ എണ്ണം ഇവിടെ നൽകാം.',
          tone: 'cyan',
          xPercent: 55,
          yPercent: 32,
        },
        {
          id: 'u3-h3',
          stepNumber: 3,
          buttonLabel: 'Days Present & Days Absent',
          malayalamTitle: 'ഹാജരായ ദിവസങ്ങളും ലീവായ ദിവസങ്ങളും',
          malayalamAction:
            'കുട്ടി ഹാജരായ ദിവസങ്ങൾ നൽകുമ്പോൾ ബാക്കി ദിവസങ്ങളും ഹാജർ ശതമാനവും തനിയെ കണക്കാക്കും.',
          tone: 'amber',
          xPercent: 38,
          yPercent: 68,
        },
        {
          id: 'u3-h4',
          stepNumber: 4,
          buttonLabel: 'Save Monthly Attendance',
          malayalamTitle: 'മാസവരി ഹാജർ സേവ് ചെയ്യുക',
          malayalamAction:
            'ഇതിൽ തൊടുമ്പോൾ കുട്ടിയുടെ അറ്റൻഡൻസ് കാർഡിലും Parent PDF റിപ്പോർട്ടിലും ഈ കണക്ക് സേവ് ആകും.',
          tone: 'lime',
          xPercent: 78,
          yPercent: 68,
        },
      ],
    },
    {
      id: 'usthad-leave',
      chapterNumber: 4,
      badge: '3. Student Leave Register',
      titleEn: 'Leave Application & Campus Return Verification',
      titleMl: 'വിദ്യാർത്ഥികളുടെ ലീവ് രജിസ്റ്ററും ക്യാമ്പസ് തിരിച്ചുവരവും',
      purposeMl:
        'കുട്ടികൾ ലീവെടുത്ത് വീട്ടിൽ പോകുന്ന സമയവും തിരികെ കോളേജിൽ എത്തുന്ന സമയവും കൃത്യമായി രജിസ്റ്റർ ചെയ്യാൻ ഉപയോഗിക്കുന്നു.',
      voiceScriptMl:
        'നാലാമതായി, സ്റ്റുഡന്റ് ലീവ് രജിസ്റ്റർ. ഒരു വിദ്യാർത്ഥി ലീവെടുത്ത് വീട്ടിൽ പോകുമ്പോൾ ലീവ് ആപ്ലിക്കേഷൻ തിരഞ്ഞെടുത്ത് പോകുന്ന തീയതിയും സമയവും തിരികെ വരേണ്ട സമയവും രേഖപ്പെടുത്താം. കുട്ടി തിരികെ കോളേജിൽ എത്തുമ്പോൾ മാർക്ക് ക്യാമ്പസ് റിട്ടേൺ എന്ന ബട്ടണിൽ തൊട്ട് തിരിച്ചെത്തിയ സമയം രേഖപ്പെടുത്തിയാൽ കുട്ടിയുടെ സ്റ്റാറ്റസ് വീണ്ടും അറ്റ് അക്കാദമി എന്നായി മാറും.',
      icon: FileText,
      hotspots: [
        {
          id: 'u4-h1',
          stepNumber: 1,
          buttonLabel: 'Leave Application vs Return',
          malayalamTitle: 'ലീവ് നൽകാനോ തിരിച്ചുവരവ് രേഖപ്പെടുത്താനോ',
          malayalamAction:
            'കുട്ടി പോകുമ്പോൾ Leave Application എന്നും, തിരിച്ചെത്തുമ്പോൾ Campus Return എന്നും തിരഞ്ഞെടുക്കുക.',
          tone: 'lime',
          xPercent: 28,
          yPercent: 30,
        },
        {
          id: 'u4-h2',
          stepNumber: 2,
          buttonLabel: 'Departure & Return Date/Time',
          malayalamTitle: 'പോകുന്ന സമയവും തിരിച്ചെത്തേണ്ട സമയവും',
          malayalamAction:
            'തീയതിയും സമയവും രാവിലെ/ഉച്ചയ്ക്ക്/വൈകുന്നേരം എന്ന വിവരവും കൃത്യമായി നൽകാം.',
          tone: 'cyan',
          xPercent: 65,
          yPercent: 30,
        },
        {
          id: 'u4-h3',
          stepNumber: 3,
          buttonLabel: 'Leave Reason & Days',
          malayalamTitle: 'ലീവിന്റെ കാരണവും ദിവസങ്ങളുടെ എണ്ണവും',
          malayalamAction:
            'എത്ര ദിവസത്തേക്കാണ് ലീവ് എന്നും എന്ത് കാരണത്താലാണ് പോകുന്നതെന്നും രേഖപ്പെടുത്തുക.',
          tone: 'amber',
          xPercent: 35,
          yPercent: 72,
        },
        {
          id: 'u4-h4',
          stepNumber: 4,
          buttonLabel: 'Record Leave / Verify Return',
          malayalamTitle: 'ലീവ് രജിസ്റ്ററിൽ സേവ് ചെയ്യുക',
          malayalamAction:
            'സേവ് ചെയ്യുമ്പോൾ കുട്ടിയുടെ പ്രൊഫൈലിൽ On Leave അല്ലെങ്കിൽ At Academy എന്ന് തത്സമയം മാറും.',
          tone: 'lime',
          xPercent: 78,
          yPercent: 72,
        },
      ],
    },
    {
      id: 'usthad-notices',
      chapterNumber: 5,
      badge: '4. Class Notice Board',
      titleEn: 'Publish Class Announcements & Holiday Notices',
      titleMl: 'ക്ലാസ്സിലേക്കുള്ള അറിയിപ്പുകളും അവധി വിവരങ്ങളും ഇടുന്ന ഭാഗം',
      purposeMl:
        'ഉസ്താദിന്റെ ക്ലാസ്സിലെ വിദ്യാർത്ഥികൾക്ക് പരീക്ഷാ അറിയിപ്പുകളോ ക്ലാസ് നോട്ടീസുകളോ അവധി വിവരങ്ങളോ നൽകാൻ ഉപയോഗിക്കുന്നു.',
      voiceScriptMl:
        'അഞ്ചാമതായി, ക്ലാസ് നോട്ടീസ് ബോർഡ്. ഉസ്താദുമാർക്ക് തങ്ങളുടെ ക്ലാസ്സിലെ കുട്ടികൾക്കോ മറ്റ് ക്ലാസ്സുകൾക്കോ അറിയിപ്പുകൾ നൽകാൻ ഇവിടെ തലക്കെട്ടും വിവരങ്ങളും ടൈപ്പ് ചെയ്ത് പബ്ലിഷ് നോട്ടീസ് അമർത്താം. ഉസ്താദ് ആദ്യമായി അറിയിപ്പ് അപ്‌ലോഡ് ചെയ്യുമ്പോൾ മാത്രമേ കുട്ടികളുടെ നോട്ടീസ് ബോർഡിൽ അത് കാണുകയുള്ളൂ.',
      icon: Megaphone,
      hotspots: [
        {
          id: 'u5-h1',
          stepNumber: 1,
          buttonLabel: 'Notice Title & Category',
          malayalamTitle: 'അറിയിപ്പിന്റെ തലക്കെട്ടും വിഭാഗവും',
          malayalamAction:
            'Academic, Exam, Holiday, General എന്നീ വിഭാഗങ്ങളിൽ ഉചിതമായത് തിരഞ്ഞെടുത്ത് തലക്കെട്ട് നൽകുക.',
          tone: 'lime',
          xPercent: 28,
          yPercent: 34,
        },
        {
          id: 'u5-h2',
          stepNumber: 2,
          buttonLabel: 'Target Classes Selection',
          malayalamTitle: 'സ്വന്തം ക്ലാസ്സിനോ എല്ലാ ക്ലാസ്സുകൾക്കോ',
          malayalamAction:
            'ഉസ്താദിന്റെ സ്വന്തം ക്ലാസ്സിന് മാത്രമായോ അതോ മറ്റ് ക്ലാസ്സുകൾക്ക് കൂടിയോ അറിയിപ്പ് അയക്കാം.',
          tone: 'cyan',
          xPercent: 68,
          yPercent: 34,
        },
        {
          id: 'u5-h3',
          stepNumber: 3,
          buttonLabel: 'Publish Notice',
          malayalamTitle: 'നോട്ടീസ് പബ്ലിഷ് ചെയ്യുക',
          malayalamAction:
            'ഇതിൽ തൊടുമ്പോൾ കുട്ടികളുടെ ഡാഷ്‌ബോർഡിലെ Notice Board-ൽ അറിയിപ്പ് ഉടൻ പ്രത്യക്ഷപ്പെടും.',
          tone: 'lime',
          xPercent: 75,
          yPercent: 74,
        },
        {
          id: 'u5-h4',
          stepNumber: 4,
          buttonLabel: 'Delete / Manage Notices',
          malayalamTitle: 'പഴയ അറിയിപ്പുകൾ ഒഴിവാക്കാൻ',
          malayalamAction:
            'മുമ്പ് ഇട്ട അറിയിപ്പുകൾ ആവശ്യമില്ലെങ്കിൽ Delete ബട്ടൺ അമർത്തി എപ്പോൾ വേണമെങ്കിലും നീക്കം ചെയ്യാം.',
          tone: 'red',
          xPercent: 30,
          yPercent: 74,
        },
      ],
    },
    {
      id: 'usthad-chat-library',
      chapterNumber: 6,
      badge: '5. Campus Messenger & Digital Kitabs',
      titleEn: 'WhatsApp-Style Class Chat & Digital Kitab Upload',
      titleMl: 'ക്ലാസ് ഗ്രൂപ്പ് ചാറ്റും ഡിജിറ്റൽ കിതാബ് അപ്‌ലോഡും',
      purposeMl:
        'ക്ലാസ്സിലെ കുട്ടികളുമായും മറ്റ് ഉസ്താദുമാരുമായും ചാറ്റ് ചെയ്യാനും, പഠനത്തിനുള്ള കിതാബ് PDF-കൾ ഡിജിറ്റൽ ലൈബ്രറിയിലേക്ക് അപ്‌ലോഡ് ചെയ്യാനും ഉപയോഗിക്കുന്നു.',
      voiceScriptMl:
        'ആറാമതായി, ക്യാമ്പസ് മെസ്സഞ്ചറും ഡിജിറ്റൽ കിതാബ് ലൈബ്രറിയും. ചാറ്റ് ടാബിൽ കയറി ഉസ്താദിന്റെ ക്ലാസ് ഗ്രൂപ്പിലേക്ക് പഠന നോട്ടുകളും ശബ്ദ സന്ദേശങ്ങളും അയക്കാം. കൂടാതെ പൂട്ടിന്റെ ചിഹ്നത്തിൽ തൊട്ട് ഉസ്താദിന് മാത്രം മെസ്സേജ് അയക്കാൻ കഴിയുന്ന രീതിയിൽ ഗ്രൂപ്പ് ലോക്ക് ചെയ്യാം. ലൈബ്രറി ടാബിൽ കയറി കുട്ടികൾക്ക് പഠിക്കാനുള്ള കിതാബുകളുടെ പി ഡി എഫ് അപ്‌ലോഡ് ചെയ്യാനും സാധിക്കും.',
      icon: MessageCircle,
      hotspots: [
        {
          id: 'u6-h1',
          stepNumber: 1,
          buttonLabel: 'Class Official Group & Staff Room',
          malayalamTitle: 'ക്ലാസ് ഗ്രൂപ്പും ഉസ്താദുമാരുടെ സ്റ്റാഫ് റൂമും',
          malayalamAction:
            'സ്വന്തം ക്ലാസ് ഗ്രൂപ്പിലും 9 ഉസ്താദുമാരുടെ സ്റ്റാഫ് റൂമിലും സന്ദേശങ്ങൾ അയക്കാം.',
          tone: 'lime',
          xPercent: 25,
          yPercent: 34,
        },
        {
          id: 'u6-h2',
          stepNumber: 2,
          buttonLabel: 'Lock Group & Pin Message',
          malayalamTitle: 'ഗ്രൂപ്പ് ലോക്ക് ചെയ്യാനും പ്രധാന സന്ദേശം പിൻ ചെയ്യാനും',
          malayalamAction:
            'ഉസ്താദിന് ഗ്രൂപ്പ് ലോക്ക് ചെയ്യാനും പ്രധാന അറിയിപ്പുകൾ ചാറ്റിന് മുകളിൽ Pin ചെയ്യാനും സാധിക്കും.',
          tone: 'amber',
          xPercent: 72,
          yPercent: 34,
        },
        {
          id: 'u6-h3',
          stepNumber: 3,
          buttonLabel: 'Share PDF Notes & Voice',
          malayalamTitle: 'PDF നോട്ടുകളും വോയ്‌സ് ക്ലാസ്സുകളും അയക്കാം',
          malayalamAction:
            'ക്ലിപ്പ് ഐക്കണിലൂടെ PDF കിതാബുകളും മൈക്കിലൂടെ ശബ്ദ വിശദീകരണങ്ങളും കുട്ടികൾക്ക് അയക്കാം.',
          tone: 'cyan',
          xPercent: 35,
          yPercent: 74,
        },
        {
          id: 'u6-h4',
          stepNumber: 4,
          buttonLabel: 'Upload Kitab to Digital Library',
          malayalamTitle: 'ഡിജിറ്റൽ ലൈബ്രറിയിലേക്ക് കിതാബ് ചേർക്കുക',
          malayalamAction:
            'ലൈബ്രറി വിഭാഗത്തിൽ പുതിയ കിതാബ് PDF അപ്‌ലോഡ് ചെയ്താൽ എല്ലാ കുട്ടികൾക്കും അത് ലഭ്യമാകും.',
          tone: 'lime',
          xPercent: 78,
          yPercent: 74,
        },
      ],
    },
  ],

  'class-leader': [
    {
      id: 'leader-period-attendance',
      chapterNumber: 1,
      badge: '1. Class Leader Duty • Period Attendance',
      titleEn: 'Submitting Period Attendance (Periods 1 to 5)',
      titleMl: 'ക്ലാസ് ലീഡർ 5 പിരീഡുകളിലെയും ഹാജർ രേഖപ്പെടുത്തുന്ന വിധം',
      purposeMl:
        'ഓരോ ക്ലാസ്സിലെയും രണ്ട് ക്ലാസ് ലീഡർമാർക്കും അന്നേ ദിവസത്തെ 1 മുതൽ 5 വരെയുള്ള പിരീഡുകളിലെ കുട്ടികളുടെ ഹാജർ രേഖപ്പെടുത്തി സമർപ്പിക്കാൻ ഈ ഭാഗം ഉപയോഗിക്കുന്നു.',
      voiceScriptMl:
        'ഒന്നാമതായി, ക്ലാസ് ലീഡർ പിരീഡ് അറ്റൻഡൻസ്. ഓരോ ക്ലാസ്സിലെയും രണ്ട് ക്ലാസ് ലീഡർമാർക്കും തുല്യ അധികാരമാണുള്ളത്. അറ്റൻഡൻസ് ടാബിൽ കയറി പിരീഡ് ഒന്ന് മുതൽ അഞ്ച് വരെയുള്ളതിൽ ഇപ്പോൾ നടക്കുന്ന പിരീഡ് തിരഞ്ഞെടുക്കുക. എല്ലാവരും ഹാജരാണെങ്കിൽ മാർക്ക് ഓൾ പ്രസന്റ് അമർത്താം. തുടർന്ന് താഴെയുള്ള സബ്മിറ്റ് പിരീഡ് അറ്റൻഡൻസ് എന്ന ബട്ടണിൽ തൊടുമ്പോൾ ആ പിരീഡിലെ ഹാജർ പ്രിൻസിപ്പലിന്റെയും ക്ലാസ് ഉസ്താദിന്റെയും ഡാഷ്‌ബോർഡിലേക്ക് തത്സമയം എത്തും.',
      icon: UserCheck,
      hotspots: [
        {
          id: 'cl1-h1',
          stepNumber: 1,
          buttonLabel: 'Select Period (Period 1–5)',
          malayalamTitle: 'ഇപ്പോൾ നടക്കുന്ന പിരീഡ് തിരഞ്ഞെടുക്കുക',
          malayalamAction:
            'Period 1 മുതൽ Period 5 വരെയുള്ള ടാബുകളിൽ തൊട്ട് ഹാജർ ഇടേണ്ട പിരീഡ് തിരഞ്ഞെടുക്കുക.',
          tone: 'lime',
          xPercent: 25,
          yPercent: 28,
        },
        {
          id: 'cl1-h2',
          stepNumber: 2,
          buttonLabel: 'Mark All Present',
          malayalamTitle: 'എല്ലാവർക്കും ഒരുമിച്ച് Present നൽകാൻ',
          malayalamAction:
            'ക്ലാസ്സിലെ ഭൂരിഭാഗം കുട്ടികളും ഹാജരാണെങ്കിൽ ഒറ്റ ക്ലിക്കിൽ എല്ലാവരെയും Present ആക്കാൻ ഈ ബട്ടൺ തൊടുക.',
          tone: 'cyan',
          xPercent: 72,
          yPercent: 28,
        },
        {
          id: 'cl1-h3',
          stepNumber: 3,
          buttonLabel: 'Present / Absent / Leave',
          malayalamTitle: 'ഓരോ കുട്ടിയുടെയും ഹാജർ അടയാളപ്പെടുത്തുക',
          malayalamAction:
            'ഓരോ വിദ്യാർത്ഥിയുടെയും പേരിന് താഴെയുള്ള Present, Absent, Leave ബട്ടണുകളിൽ തൊട്ട് ഹാജർ ക്രമീകരിക്കാം.',
          tone: 'lime',
          xPercent: 35,
          yPercent: 68,
        },
        {
          id: 'cl1-h4',
          stepNumber: 4,
          buttonLabel: 'Submit Period Attendance',
          malayalamTitle: 'ഹാജർ സമർപ്പിക്കുക (Submit)',
          malayalamAction:
            'താഴെയുള്ള പച്ച ബട്ടൺ അമർത്തുമ്പോൾ ഹാജർ സേവ് ആവുകയും പ്രിൻസിപ്പൽ മോണിറ്ററിൽ പച്ച നിറത്തിൽ തെളിയുകയും ചെയ്യും.',
          tone: 'lime',
          xPercent: 78,
          yPercent: 74,
        },
      ],
    },
    {
      id: 'leader-reasons',
      chapterNumber: 2,
      badge: '2. Absent & Leave Reasons',
      titleEn: 'Selecting Absent or Leave Reasons for Students',
      titleMl: 'കുട്ടികൾ Absent അല്ലെങ്കിൽ Leave ആകുമ്പോൾ കാരണം രേഖപ്പെടുത്തുന്ന വിധം',
      purposeMl:
        'ഏതെങ്കിലും വിദ്യാർത്ഥി ക്ലാസ്സിൽ ഇല്ലാതിരിക്കുമ്പോൾ (Absent / Leave) അതിന്റെ കൃത്യമായ കാരണം ഉസ്താദിനും പ്രിൻസിപ്പലിനും മനസ്സിലാകാൻ രേഖപ്പെടുത്തുന്ന ഭാഗം.',
      voiceScriptMl:
        'രണ്ടാമതായി, ആബ്സെന്റ് അല്ലെങ്കിൽ ലീവ് കാരണം രേഖപ്പെടുത്തൽ. ഏതെങ്കിലും കുട്ടിയുടെ പേരിന് നേരെ ആബ്സെന്റ് അല്ലെങ്കിൽ ലീവ് ബട്ടണിൽ തൊടുമ്പോൾ അതിന് തൊട്ടുതാഴെ നാല് കാരണങ്ങൾ തുറന്നുവരും. അസുഖം മൂലമാണോ, അതോ അനുവാദത്തോടെയുള്ള ലീവാണോ എന്ന് അതിൽ തൊട്ട് തിരഞ്ഞെടുത്ത ശേഷം ഹാജർ സമർപ്പിക്കാം.',
      icon: CheckCircle2,
      hotspots: [
        {
          id: 'cl2-h1',
          stepNumber: 1,
          buttonLabel: 'Tap Absent or Leave',
          malayalamTitle: 'Absent അല്ലെങ്കിൽ Leave ബട്ടണിൽ തൊടുക',
          malayalamAction:
            'ഹാജരല്ലാത്ത കുട്ടിയുടെ നേരെ Absent അല്ലെങ്കിൽ Leave ബട്ടണിൽ തൊടുമ്പോൾ കാരണം തിരഞ്ഞെടുക്കാനുള്ള ബോക്സ് തുറക്കും.',
          tone: 'red',
          xPercent: 32,
          yPercent: 34,
        },
        {
          id: 'cl2-h2',
          stepNumber: 2,
          buttonLabel: '4 Reason Buttons',
          malayalamTitle: '4 കാരണങ്ങളിൽ ഉചിതമായത് തിരഞ്ഞെടുക്കുക',
          malayalamAction:
            'Sick / Medical, Approved Leave, Home Emergency മുതലായ കാരണങ്ങളിൽ ഒന്ന് തൊട്ട് തിരഞ്ഞെടുക്കുക.',
          tone: 'amber',
          xPercent: 68,
          yPercent: 68,
        },
      ],
    },
    {
      id: 'leader-unheld',
      chapterNumber: 3,
      badge: '3. Period Session Status',
      titleEn: 'Reporting Unheld Class or Substitute Usthad',
      titleMl: 'ഉസ്താദ് വരാത്ത പിരീഡ് രേഖപ്പെടുത്തുന്നതും പകരം ഉസ്താദിനെ ചേർക്കുന്നതും',
      purposeMl:
        'ഒരു പിരീഡിൽ നിശ്ചയിച്ച ഉസ്താദ് ക്ലാസ് എടുത്തില്ലെങ്കിലോ പകരം മറ്റൊരു ഉസ്താദ് ആണ് ക്ലാസ് എടുത്തതെങ്കിലോ പ്രിൻസിപ്പലിനെ അറിയിക്കാൻ ഉപയോഗിക്കുന്നു.',
      voiceScriptMl:
        'മൂന്നാമതായി, പിരീഡിൽ ഉസ്താദ് വന്നില്ലെങ്കിൽ എന്ത് ചെയ്യണം. മുകളിലുള്ള പിരീഡ് സെഷൻ സ്റ്റാറ്റസ് എന്ന ഭാഗത്ത് ക്ലാസ് നോട്ട് ഹെൽഡ് എന്നതിൽ തൊട്ട് കാരണം തിരഞ്ഞെടുത്ത് കൺഫേം ചെയ്താൽ ആ പിരീഡ് നടന്നില്ല എന്ന വിവരം ഉടൻ പ്രിൻസിപ്പലിന് ലഭിക്കും. ഇനി പകരം മറ്റൊരു ഉസ്താദാണ് ക്ലാസ്സിൽ വന്നതെങ്കിൽ സബ്സ്റ്റിറ്റ്യൂട്ട് ഉസ്താദ് എന്നതിൽ തൊട്ട് ആ ഉസ്താദിന്റെ പേര് തിരഞ്ഞെടുത്ത് സാധാരണ പോലെ ഹാജർ ഇടാം.',
      icon: Ban,
      hotspots: [
        {
          id: 'cl3-h1',
          stepNumber: 1,
          buttonLabel: 'Class Conducted',
          malayalamTitle: 'സാധാരണ പോലെ ക്ലാസ് നടക്കുമ്പോൾ',
          malayalamAction:
            'നിശ്ചയിച്ച ഉസ്താദ് തന്നെ ക്ലാസ് എടുക്കുമ്പോൾ Class Conducted എന്നതിൽ തന്നെയായിരിക്കും.',
          tone: 'lime',
          xPercent: 22,
          yPercent: 34,
        },
        {
          id: 'cl3-h2',
          stepNumber: 2,
          buttonLabel: 'Class Not Held',
          malayalamTitle: 'ഉസ്താദ് ക്ലാസ് എടുത്തില്ലെങ്കിൽ',
          malayalamAction:
            'ഇതിൽ തൊട്ട് Confirm Class Not Held അമർത്തിയാൽ പ്രിൻസിപ്പലിന് ഉടൻ അലേർട്ട് ലഭിക്കുകയും ഹാജർ ലോക്ക് ആവുകയും ചെയ്യും.',
          tone: 'red',
          xPercent: 52,
          yPercent: 34,
        },
        {
          id: 'cl3-h3',
          stepNumber: 3,
          buttonLabel: 'Substitute Usthad',
          malayalamTitle: 'പകരം മറ്റൊരു ഉസ്താദ് ക്ലാസ് എടുത്താൽ',
          malayalamAction:
            'ഇതിൽ തൊട്ട് പകരം വന്ന ഉസ്താദിന്റെ പേര് ഡ്രോപ്പ്‌ഡൗണിൽ നിന്ന് തിരഞ്ഞെടുത്ത് കുട്ടികളുടെ ഹാജർ രേഖപ്പെടുത്താം.',
          tone: 'cyan',
          xPercent: 80,
          yPercent: 34,
        },
      ],
    },
    {
      id: 'leader-privacy',
      chapterNumber: 4,
      badge: '4. Student Privacy & Personal Records',
      titleEn: 'Strict Student Privacy & Personal Dashboard',
      titleMl: 'വിദ്യാർത്ഥികളുടെ സ്വകാര്യതയും സ്വന്തം പ്രൊഫൈലും',
      purposeMl:
        'ക്ലാസ് ലീഡർക്ക് മറ്റ് വിദ്യാർത്ഥികളുടെ പേര് മാത്രമേ ഹാജർ ലിസ്റ്റിൽ കാണാൻ സാധിക്കൂ; അവരുടെ അഡ്മിഷൻ ഐഡിയോ പാസ്‌വേഡോ കാണാൻ കഴിയില്ല.',
      voiceScriptMl:
        'നാലാമതായി, സ്വന്തം ഹാജരും സ്വകാര്യതയും. ക്ലാസ് ലീഡർക്ക് ഹാജർ എടുക്കാൻ മറ്റ് കുട്ടികളുടെ പേരുകൾ മാത്രമേ കാണാൻ സാധിക്കൂ, മറ്റുള്ളവരുടെ അഡ്മിഷൻ ഐഡിയോ പാസ്‌വേഡോ ലീഡർക്ക് കാണാൻ കഴിയില്ല. മുകളിൽ വലതുവശത്തുള്ള പ്രൊഫൈൽ മെനുവിൽ തൊട്ടാൽ ലീഡർക്ക് സ്വന്തം അഡ്മിഷൻ ഐഡിയും പാസ്‌വേഡും ബാച്ച് നമ്പറും സ്വകാര്യമായി കാണാം.',
      icon: Lock,
      hotspots: [
        {
          id: 'cl4-h1',
          stepNumber: 1,
          buttonLabel: 'Personal Attendance vs Class Leader Duty',
          malayalamTitle: 'സ്വന്തം ഹാജരും ക്ലാസ് ഹാജരും',
          malayalamAction:
            'ഫോണിൽ Attendance ടാബിൽ കയറുമ്പോൾ My Attendance എന്നതിൽ സ്വന്തം ഹാജരും, Class Leader Duty എന്നതിൽ ക്ലാസ് ഹാജരും കാണാം.',
          tone: 'lime',
          xPercent: 30,
          yPercent: 38,
        },
        {
          id: 'cl4-h2',
          stepNumber: 2,
          buttonLabel: 'Private Profile Menu',
          malayalamTitle: 'സ്വന്തം ഐഡിയും പാസ്‌വേഡും കാണാൻ',
          malayalamAction:
            'മുകളിൽ വലതുവശത്തുള്ള പ്രൊഫൈൽ ബട്ടണിൽ തൊട്ടാൽ സ്വന്തം അഡ്മിഷൻ ഐഡിയും പാസ്‌വേഡും ബാച്ചും കാണാം.',
          tone: 'cyan',
          xPercent: 78,
          yPercent: 38,
        },
      ],
    },
    {
      id: 'leader-chat-ai',
      chapterNumber: 5,
      badge: '5. Campus Messenger & AI Study Chatbot',
      titleEn: 'Campus Messenger, AI Scholar Chatbot & Library',
      titleMl: 'ക്യാമ്പസ് മെസ്സഞ്ചർ, എ.ഐ ചാറ്റ്ബോട്ട്, ഡിജിറ്റൽ ലൈബ്രറി',
      purposeMl:
        'ക്ലാസ് ഗ്രൂപ്പിൽ ചാറ്റ് ചെയ്യാനും, കിതാബുകളിലെ സംശയങ്ങൾ മലയാളത്തിലും അറബിയിലും ചോദിച്ചു പഠിക്കാനും, ഡിജിറ്റൽ കിതാബുകൾ വായിക്കാനും ഉപയോഗിക്കുന്നു.',
      voiceScriptMl:
        'അഞ്ചാമതായി, ക്യാമ്പസ് മെസ്സഞ്ചറും ദഅ്‌വ കോളേജ് എ ഐ ചാറ്റ്ബോട്ടും. ചാറ്റ് ടാബിൽ കയറി ക്ലാസ് ഗ്രൂപ്പിലും ഉസ്താദുമാരുമായും സംസാരിക്കാം. ചാറ്റ്ബോട്ട് ടാബിൽ കയറി ഫത്ഹുൽ മുഈൻ, മഹല്ലി തുടങ്ങിയ കിതാബുകളിലെ ഇബാറത്തുകളുടെ ഫോട്ടോ അയച്ചോ ശബ്ദത്തിലൂടെ ചോദിച്ചോ മലയാളത്തിൽ വിശദീകരണം നേടാം.',
      icon: Sparkles,
      hotspots: [
        {
          id: 'cl5-h1',
          stepNumber: 1,
          buttonLabel: 'Campus Messenger',
          malayalamTitle: 'വാട്സാപ്പ് ശൈലിയിലുള്ള ക്യാമ്പസ് ചാറ്റ്',
          malayalamAction:
            'ക്ലാസ് ഗ്രൂപ്പിലും ഉസ്താദുമാരുമായും വോയ്‌സ് മെസ്സേജുകളും പഠന PDF നോട്ടുകളും പങ്കുവെക്കാം.',
          tone: 'lime',
          xPercent: 28,
          yPercent: 50,
        },
        {
          id: 'cl5-h2',
          stepNumber: 2,
          buttonLabel: "Da'wa College AI Chatbot",
          malayalamTitle: 'കിതാബുകൾ പഠിക്കാൻ എ.ഐ ഉസ്താദ് ചാറ്റ്ബോട്ട്',
          malayalamAction:
            'കിതാബ് പേജിന്റെ ഫോട്ടോ എടുത്തോ മൈക്കിലൂടെ സംസാരിച്ചോ മലയാളത്തിൽ അർത്ഥവും വ്യാകരണവും ചോദിച്ചു പഠിക്കാം.',
          tone: 'cyan',
          xPercent: 72,
          yPercent: 50,
        },
      ],
    },
  ],

  student: [
    {
      id: 'student-profile',
      chapterNumber: 1,
      badge: '1. Student Dashboard & Private Profile',
      titleEn: 'Welcome Header, Campus Status & Private Profile Menu',
      titleMl: 'വിദ്യാർത്ഥി ഡാഷ്‌ബോർഡും സ്വകാര്യ പ്രൊഫൈൽ മെനുവും',
      purposeMl:
        'വിദ്യാർത്ഥിയുടെ പേര്, ക്ലാസ്, അഡ്മിഷൻ നമ്പർ, ക്യാമ്പസിലുണ്ടോ അതോ ലീവിലാണോ എന്ന സ്റ്റാറ്റസ്, സ്വകാര്യ പാസ്‌വേഡ് എന്നിവ കാണാനുള്ള ഭാഗം.',
      voiceScriptMl:
        'ഒന്നാമതായി, സ്റ്റുഡന്റ് ഡാഷ്‌ബോർഡും പ്രൊഫൈൽ മെനുവും. ലോഗിൻ ചെയ്യുമ്പോൾ മുകളിൽ വലതുവശത്തുള്ള നിങ്ങളുടെ പേരിൽ തൊട്ടാൽ തുറന്നുവരുന്ന പ്രൊഫൈൽ മെനുവിൽ നിങ്ങളുടെ അഡ്മിഷൻ ഐഡിയും പാസ്‌വേഡും ബാച്ച് നമ്പറും കാണാം. ഈ വിവരങ്ങൾ നിങ്ങൾക്ക് മാത്രമേ കാണാൻ സാധിക്കൂ, മറ്റ് വിദ്യാർത്ഥികൾക്ക് കാണാൻ കഴിയില്ല. നിങ്ങൾ കോളേജിലുണ്ടെങ്കിൽ അറ്റ് അക്കാദമി എന്ന് പച്ച നിറത്തിലും, ലീവിലാണെങ്കിൽ ഓൺ ലീവ് എന്ന് ചുവപ്പ് നിറത്തിലും മുകളിൽ കാണിക്കും.',
      icon: GraduationCap,
      hotspots: [
        {
          id: 's1-h1',
          stepNumber: 1,
          buttonLabel: 'At Academy / On Leave Badge',
          malayalamTitle: 'നിലവിലെ ഹാജർ/ലീവ് സ്റ്റാറ്റസ്',
          malayalamAction:
            'കോളേജിലാണെങ്കിൽ പച്ച നിറത്തിൽ At Academy എന്നും, ലീവിലാണെങ്കിൽ ചുവപ്പ് നിറത്തിൽ On Leave എന്നും കാണിക്കും.',
          tone: 'lime',
          xPercent: 24,
          yPercent: 32,
        },
        {
          id: 's1-h2',
          stepNumber: 2,
          buttonLabel: 'Private Profile Button (Top Right)',
          malayalamTitle: 'സ്വകാര്യ പ്രൊഫൈൽ മെനു (ഐഡിയും പാസ്‌വേഡും)',
          malayalamAction:
            'മുകളിൽ വലതുവശത്തുള്ള പ്രൊഫൈൽ ബട്ടണിൽ തൊട്ടാൽ നിങ്ങളുടെ മാത്രം Admission ID, Password, Batch എന്നിവ കാണാം.',
          tone: 'cyan',
          xPercent: 78,
          yPercent: 32,
        },
      ],
    },
    {
      id: 'student-notices',
      chapterNumber: 2,
      badge: '2. Notice Board & Holiday Alerts',
      titleEn: 'Official Announcements & Holiday Schedule',
      titleMl: 'നോട്ടീസ് ബോർഡും ഔദ്യോഗിക അവധി അറിയിപ്പുകളും',
      purposeMl:
        'പ്രിൻസിപ്പലും ക്ലാസ് ഉസ്താദുമാരും അപ്‌ലോഡ് ചെയ്യുന്ന പരീക്ഷാ അറിയിപ്പുകളും അവധി വിവരങ്ങളും തത്സമയം കാണാനുള്ള ഭാഗം.',
      voiceScriptMl:
        'രണ്ടാമതായി, നോട്ടീസ് ബോർഡ്. പ്രിൻസിപ്പലോ ക്ലാസ് ഉസ്താദുമാരോ പുതിയ അറിയിപ്പുകളോ അവധി ദിനങ്ങളോ പ്രസിദ്ധീകരിക്കുമ്പോൾ മാത്രമേ ഇവിടെ കാണുകയുള്ളൂ. പുതിയ അറിയിപ്പ് വരുമ്പോൾ മുകളിലെ ബെൽ ഐക്കണിൽ നോട്ടിഫിക്കേഷൻ ലഭിക്കും.',
      icon: Megaphone,
      hotspots: [
        {
          id: 's2-h1',
          stepNumber: 1,
          buttonLabel: 'Notice Board Feed',
          malayalamTitle: 'ഉസ്താദുമാരുടെയും പ്രിൻസിപ്പലിന്റെയും അറിയിപ്പുകൾ',
          malayalamAction:
            'നിങ്ങളുടെ ക്ലാസ്സിലേക്കുള്ള പരീക്ഷാ ഷെഡ്യൂളുകളും അവധി അറിയിപ്പുകളും ഇവിടെ വായിക്കാം.',
          tone: 'lime',
          xPercent: 35,
          yPercent: 48,
        },
        {
          id: 's2-h2',
          stepNumber: 2,
          buttonLabel: 'Notification Bell (🔔)',
          malayalamTitle: 'പുതിയ അറിയിപ്പുകളുടെ ബെൽ ഐക്കൺ',
          malayalamAction:
            'മുകളിലെ ബെൽ ഐക്കണിൽ തൊട്ടാൽ പുതുതായി വന്ന എല്ലാ ക്യാമ്പസ് അറിയിപ്പുകളും ഒറ്റനോട്ടത്തിൽ കാണാം.',
          tone: 'amber',
          xPercent: 76,
          yPercent: 28,
        },
      ],
    },
    {
      id: 'student-attendance',
      chapterNumber: 3,
      badge: '3. Attendance Status (June–May)',
      titleEn: 'Monthly Working Days & Daily 5-Period Attendance',
      titleMl: 'ജൂൺ മുതൽ മെയ് വരെയുള്ള മാസവരി ഹാജരും 5 പിരീഡ് ഹാജരും',
      purposeMl:
        'ജൂൺ മുതൽ മെയ് വരെയുള്ള ഓരോ മാസത്തെയും സ്വന്തം ഹാജർ ശതമാനവും, ഓരോ ദിവസത്തെയും 5 പിരീഡുകളിലെ ഹാജർ നിലയും പരിശോധിക്കാൻ ഉപയോഗിക്കുന്നു.',
      voiceScriptMl:
        'മൂന്നാമതായി, അറ്റൻഡൻസ് സ്റ്റാറ്റസ്. ഇതിൽ ജൂൺ മുതൽ മെയ് വരെയുള്ള ഏത് മാസവും തിരഞ്ഞെടുത്ത് ആ മാസത്തെ ആകെ അധ്യയന ദിവസങ്ങളും നിങ്ങൾ ഹാജരായ ദിവസങ്ങളും ഹാജർ ശതമാനവും കാണാം. കൂടാതെ അന്നേ ദിവസത്തെ ഒന്ന് മുതൽ അഞ്ച് വരെയുള്ള പിരീഡുകളിൽ നിങ്ങളുടെ ഹാജർ നിലയും താഴെ കാണാൻ സാധിക്കും.',
      icon: CalendarClock,
      hotspots: [
        {
          id: 's3-h1',
          stepNumber: 1,
          buttonLabel: 'Month Selector (June 2026 – May 2027)',
          malayalamTitle: 'ജൂൺ മുതൽ മെയ് വരെയുള്ള മാസം തിരഞ്ഞെടുക്കുക',
          malayalamAction:
            'ഡ്രോപ്പ്‌ഡൗണിൽ തൊട്ട് ഏത് മാസത്തെയും Working Days-ഉം നിങ്ങളുടെ ഹാജരും പരിശോധിക്കാം.',
          tone: 'lime',
          xPercent: 72,
          yPercent: 28,
        },
        {
          id: 's3-h2',
          stepNumber: 2,
          buttonLabel: 'Attendance Percentage Ring',
          malayalamTitle: 'ഹാജർ ശതമാനവും ദിവസങ്ങളുടെ കണക്കും',
          malayalamAction:
            'നിങ്ങളുടെ ആകെ ഹാജർ ശതമാനവും ഹാജരായ/ലീവായ ദിവസങ്ങളുടെ എണ്ണവും ഇവിടെ കാണിക്കുന്നു.',
          tone: 'cyan',
          xPercent: 30,
          yPercent: 56,
        },
        {
          id: 's3-h3',
          stepNumber: 3,
          buttonLabel: 'Daily 5-Period Status (P1–P5)',
          malayalamTitle: 'അന്നത്തെ 5 പിരീഡുകളിലെ ഹാജർ',
          malayalamAction:
            'ക്ലാസ് ലീഡറോ ഉസ്താദോ ഓരോ പിരീഡിലും രേഖപ്പെടുത്തിയ നിങ്ങളുടെ ഹാജർ (Present / Absent / Leave) ഇവിടെ കാണാം.',
          tone: 'amber',
          xPercent: 70,
          yPercent: 74,
        },
      ],
    },
    {
      id: 'student-leave',
      chapterNumber: 4,
      badge: '4. Leave Register',
      titleEn: 'Student Leave Register & Campus Return History',
      titleMl: 'ലീവ് രജിസ്റ്ററും ക്യാമ്പസിൽ തിരിച്ചെത്തിയ വിവരങ്ങളും',
      purposeMl:
        'ഉസ്താദ് രേഖപ്പെടുത്തിയ നിങ്ങളുടെ ലീവ് കണക്കുകളും, വീട്ടിൽ പോയതും തിരികെ കോളേജിൽ എത്തിയതുമായ മുഴുവൻ ചരിത്രവും കാണാൻ ഉപയോഗിക്കുന്നു.',
      voiceScriptMl:
        'നാലാമതായി, ലീവ് രജിസ്റ്റർ. നിങ്ങൾ ലീവെടുത്ത് വീട്ടിൽ പോകുമ്പോഴും തിരികെ കോളേജിൽ എത്തുമ്പോഴും ക്ലാസ് ഉസ്താദ് രേഖപ്പെടുത്തുന്ന വിവരങ്ങൾ തീയതിയും സമയവും സഹിതം ഇവിടെ കാണാം.',
      icon: FileText,
      hotspots: [
        {
          id: 's4-h1',
          stepNumber: 1,
          buttonLabel: 'Current Status & Leave Count',
          malayalamTitle: 'നിലവിലെ ലീവ് സ്റ്റാറ്റസും ആകെ ലീവ് ദിവസങ്ങളും',
          malayalamAction:
            'നിങ്ങൾ ഇപ്പോൾ കോളേജിലാണോ ലീവിലാണോ എന്നതും ഈ അധ്യയന വർഷം എടുത്ത ആകെ ലീവുകളും ഇവിടെ കാണാം.',
          tone: 'lime',
          xPercent: 30,
          yPercent: 45,
        },
        {
          id: 's4-h2',
          stepNumber: 2,
          buttonLabel: 'Leave & Return Log History',
          malayalamTitle: 'ലീവിന്റെയും തിരിച്ചുവരവിന്റെയും പൂർണ്ണ വിവരങ്ങൾ',
          malayalamAction:
            'പോയ തീയതി, സമയം, കാരണം, തിരികെ കോളേജിൽ എത്തിയ സമയം എന്നിവ ഇവിടെ കാണിക്കുന്നു.',
          tone: 'cyan',
          xPercent: 72,
          yPercent: 60,
        },
      ],
    },
    {
      id: 'student-messenger',
      chapterNumber: 5,
      badge: '5. Campus Messenger',
      titleEn: 'Full-Screen WhatsApp-Style Campus Messenger',
      titleMl: 'വാട്സാപ്പ് ശൈലിയിലുള്ള ക്യാമ്പസ് മെസ്സഞ്ചർ',
      purposeMl:
        'നിങ്ങളുടെ ക്ലാസ് ഗ്രൂപ്പിലും ഉസ്താദുമാരുമായും സഹപാഠികളുമായും പഠന വിവരങ്ങളും PDF നോട്ടുകളും ശബ്ദ സന്ദേശങ്ങളും കൈമാറാൻ ഉപയോഗിക്കുന്നു.',
      voiceScriptMl:
        'അഞ്ചാമതായി, ക്യാമ്പസ് മെസ്സഞ്ചർ. വാട്സാപ്പ് പോലെ തന്നെ നിങ്ങളുടെ ക്ലാസ്സിന്റെ ഒഫീഷ്യൽ ഗ്രൂപ്പിലും ഉസ്താദുമാരുമായും സഹപാഠികളുമായും ചാറ്റ് ചെയ്യാം. ഉസ്താദുമാർ അയക്കുന്ന പഠന പി ഡി എഫുകൾ ഡൗൺലോഡ് ചെയ്യാനും, വോയ്‌സ് മെസ്സേജുകൾ കേൾക്കാനും, ചാറ്റ് സെറ്റിംഗ്സിൽ കയറി വാൾപേപ്പറും ഫോണ്ട് സൈസും മാറ്റാനും സാധിക്കും.',
      icon: MessageCircle,
      hotspots: [
        {
          id: 's5-h1',
          stepNumber: 1,
          buttonLabel: 'Class Group & Usthads Tabs',
          malayalamTitle: 'ക്ലാസ് ഗ്രൂപ്പും ഉസ്താദുമാരുമായുള്ള ചാറ്റും',
          malayalamAction:
            'All Chats, Class Groups, Usthads, Students എന്നീ ബട്ടണുകളിൽ തൊട്ട് ആരുമായും സംസാരിക്കാം.',
          tone: 'lime',
          xPercent: 28,
          yPercent: 32,
        },
        {
          id: 's5-h2',
          stepNumber: 2,
          buttonLabel: 'Attach PDF / Photo & Voice Note',
          malayalamTitle: 'PDF നോട്ടുകൾ, ഫോട്ടോകൾ, വോയ്‌സ് മെസ്സേജ്',
          malayalamAction:
            'താഴെയുള്ള ക്ലിപ്പ് ഐക്കണിൽ തൊട്ട് ഫയലുകൾ അയക്കാം, മൈക്ക് ഐക്കണിൽ തൊട്ട് വോയ്‌സ് മെസ്സേജ് റെക്കോർഡ് ചെയ്ത് അയക്കാം.',
          tone: 'cyan',
          xPercent: 52,
          yPercent: 76,
        },
        {
          id: 's5-h3',
          stepNumber: 3,
          buttonLabel: 'Chat Settings (⚙️)',
          malayalamTitle: 'ചാറ്റ് സെറ്റിംഗ്സ്',
          malayalamAction:
            'മുകളിലെ സെറ്റിംഗ്സ് ഐക്കണിൽ തൊട്ട് Online Status, Read Receipts, Font Size, Background Theme എന്നിവ മാറ്റാം.',
          tone: 'amber',
          xPercent: 86,
          yPercent: 26,
        },
      ],
    },
    {
      id: 'student-ai-library',
      chapterNumber: 6,
      badge: '6. AI Chatbot, Digital Library & Results',
      titleEn: "Da'wa College AI Chatbot, Digital Kitabs, Timetable & Exam Portal",
      titleMl: 'എ.ഐ പഠന ചാറ്റ്ബോട്ട്, ഡിജിറ്റൽ കിതാബ് ലൈബ്രറി, ടൈംടേബിൾ & റിസൾട്ട്',
      purposeMl:
        'കിതാബുകളിലെ ഇബാറത്തുകളും അക്കാദമിക് വിഷയങ്ങളും മലയാളത്തിലും അറബിയിലും ചോദിച്ചു പഠിക്കാനും, ഡിജിറ്റൽ കിതാബുകൾ വായിക്കാനും, ടൈംടേബിളും പരീക്ഷാ റിസൾട്ടും കാണാനും ഉപയോഗിക്കുന്നു.',
      voiceScriptMl:
        'ആറാമതായി, ദഅ്‌വ കോളേജ് എ ഐ ചാറ്റ്ബോട്ടും ഡിജിറ്റൽ ലൈബ്രറിയും. ചാറ്റ്ബോട്ടിൽ കയറി ഏത് കിതാബിലെയും സംശയങ്ങൾ മലയാളത്തിലോ അറബിയിലോ ഇംഗ്ലീഷിലോ ടൈപ്പ് ചെയ്തോ മൈക്കിലൂടെ സംസാരിച്ചോ ചോദിക്കാം. കിതാബ് പേജിന്റെ ഫോട്ടോ എടുത്ത് അയച്ചാൽ അതിന്റെ പദാനുപദ അർത്ഥവും നഹ്‌വ് സർഫ് വ്യാകരണവും വിശദീകരിച്ചു തരും. കൂടാതെ ലഭിക്കുന്ന മറുപടി സ്റ്റഡി നോട്ട് പി ഡി എഫ് ആയി ഡൗൺലോഡ് ചെയ്യാനും, ഡിജിറ്റൽ ലൈബ്രറിയിലെ കിതാബുകൾ വായിക്കാനും സാധിക്കും.',
      icon: Sparkles,
      hotspots: [
        {
          id: 's6-h1',
          stepNumber: 1,
          buttonLabel: 'Language & Study Role Switcher',
          malayalamTitle: 'മലയാളം / അറബി / ഇംഗ്ലീഷ് ഭാഷ തിരഞ്ഞെടുക്കാം',
          malayalamAction:
            'Usthad Kitab Mentor, Academic Tutor, Language Coach എന്നിവ തിരഞ്ഞെടുത്ത് ഏത് ഭാഷയിലും സംശയങ്ങൾ ചോദിക്കാം.',
          tone: 'lime',
          xPercent: 26,
          yPercent: 28,
        },
        {
          id: 's6-h2',
          stepNumber: 2,
          buttonLabel: 'Camera / Kitab Photo & Voice Mic',
          malayalamTitle: 'കിതാബ് പേജിന്റെ ഫോട്ടോ അയക്കാം, ശബ്ദത്തിൽ ചോദിക്കാം',
          malayalamAction:
            'ക്യാമറ ഐക്കണിൽ തൊട്ട് കിതാബ് പേജിന്റെ ഫോട്ടോ അയച്ചാൽ അതിന്റെ അർത്ഥവും ഇഅ്റാബും വിശദീകരിച്ചു തരും.',
          tone: 'cyan',
          xPercent: 48,
          yPercent: 74,
        },
        {
          id: 's6-h3',
          stepNumber: 3,
          buttonLabel: 'Save Study Note PDF',
          malayalamTitle: 'പഠനക്കുറിപ്പുകൾ PDF ആയി സൂക്ഷിക്കാം',
          malayalamAction:
            'ചാറ്റ്ബോട്ട് നൽകുന്ന ഉത്തരങ്ങൾക്ക് താഴെയുള്ള PDF ബട്ടണിൽ തൊട്ട് മനോഹരമായ സ്റ്റഡി നോട്ട് ഡൗൺലോഡ് ചെയ്യാം.',
          tone: 'amber',
          xPercent: 78,
          yPercent: 52,
        },
        {
          id: 's6-h4',
          stepNumber: 4,
          buttonLabel: 'Digital Kitabs, Timetable & Exam Portal',
          malayalamTitle: 'ഡിജിറ്റൽ ലൈബ്രറി, ടൈംടേബിൾ, പരീക്ഷാ റിസൾട്ട്',
          malayalamAction:
            'Library ടാബിൽ കയറി കിതാബ് PDF-കൾ വായിക്കാനും ക്ലാസ് ടൈംടേബിളും യൂണിവേഴ്സിറ്റി പരീക്ഷാ ഫലവും കാണാനും സാധിക്കും.',
          tone: 'lime',
          xPercent: 80,
          yPercent: 76,
        },
      ],
    },
  ],
}

const ROLE_LABELS: Record<GuideRole, { titleMl: string; titleEn: string }> = {
  principal: {
    titleMl: 'പ്രിൻസിപ്പൽ ഗൈഡ്',
    titleEn: 'Principal Guide',
  },
  usthad: {
    titleMl: 'ക്ലാസ് ഉസ്താദ് ഗൈഡ്',
    titleEn: 'Class Usthad Guide',
  },
  'class-leader': {
    titleMl: 'ക്ലാസ് ലീഡർ ഗൈഡ്',
    titleEn: 'Class Leader Guide',
  },
  student: {
    titleMl: 'വിദ്യാർത്ഥി ഗൈഡ്',
    titleEn: 'Student Guide',
  },
}

const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'

let sharedAudioCtx: AudioContext | null = null
let sharedUnlockedAudioEl: HTMLAudioElement | null = null
let isAudioElementUnlocked = false

export function unlockAndroidAudioOnGesture(): void {
  if (typeof window === 'undefined') return
  try {
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (AudioCtxClass) {
      if (!sharedAudioCtx) {
        sharedAudioCtx = new AudioCtxClass()
      }
      if (sharedAudioCtx.state === 'suspended') {
        void sharedAudioCtx.resume()
      }
      const silentBuf = sharedAudioCtx.createBuffer(1, 1, 22050)
      const src = sharedAudioCtx.createBufferSource()
      src.buffer = silentBuf
      src.connect(sharedAudioCtx.destination)
      src.start(0)
    }
  } catch {
    // Ignore AudioContext init error
  }

  try {
    if (!sharedUnlockedAudioEl) {
      sharedUnlockedAudioEl = new Audio()
      sharedUnlockedAudioEl.setAttribute('playsinline', 'true')
      sharedUnlockedAudioEl.preload = 'auto'
    }
    if (!isAudioElementUnlocked) {
      sharedUnlockedAudioEl.src = SILENT_WAV_DATA_URI
      sharedUnlockedAudioEl.volume = 0.01
      const p = sharedUnlockedAudioEl.play()
      if (p && typeof p.then === 'function') {
        p.then(() => {
          isAudioElementUnlocked = true
          if (sharedUnlockedAudioEl) {
            sharedUnlockedAudioEl.pause()
            sharedUnlockedAudioEl.volume = 1
          }
        }).catch(() => {
          // Ignore initial unlock rejection
        })
      }
    }
  } catch {
    // Ignore HTMLAudioElement init error
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  const cleaned = base64.replace(/^data:[^;]+;base64,/, '').trim()
  const binaryStr = window.atob(cleaned)
  const len = binaryStr.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  return bytes
}

function decodePcmWavManual(ctx: AudioContext, bytes: Uint8Array): AudioBuffer | null {
  try {
    if (bytes.length < 44) return null
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const numChannels = view.getUint16(22, true) || 1
    const sampleRate = view.getUint32(24, true) || 24000
    const bitsPerSample = view.getUint16(34, true) || 16
    if (bitsPerSample !== 16) return null

    // Find 'data' chunk offset
    let dataOffset = 44
    for (let i = 12; i < Math.min(bytes.length - 8, 200); i++) {
      if (
        bytes[i] === 0x64 && // 'd'
        bytes[i + 1] === 0x61 && // 'a'
        bytes[i + 2] === 0x74 && // 't'
        bytes[i + 3] === 0x61 // 'a'
      ) {
        dataOffset = i + 8
        break
      }
    }

    const pcmByteLength = bytes.length - dataOffset
    const totalSamples = Math.floor(pcmByteLength / (2 * numChannels))
    if (totalSamples <= 0) return null

    const audioBuffer = ctx.createBuffer(numChannels, totalSamples, sampleRate)
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch)
      for (let i = 0; i < totalSamples; i++) {
        const sampleOffset = dataOffset + (i * numChannels + ch) * 2
        const int16 = view.getInt16(sampleOffset, true)
        channelData[i] = int16 / 32768
      }
    }
    return audioBuffer
  } catch {
    return null
  }
}

export function AppVideoGuideTriggerButton({
  defaultRole,
  onBeforeOpen,
}: {
  defaultRole: GuideRole
  onBeforeOpen?: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => {
          unlockAndroidAudioOnGesture()
          onBeforeOpen?.()
          setOpen(true)
        }}
        className="mb-2 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#7C3AED] via-[#4F46E5] to-[#0095F6] px-4 text-xs font-semibold text-white transition-all duration-200 outline-none hover:brightness-110 active:scale-[0.98]"
      >
        <PlayCircle className="size-4 shrink-0" aria-hidden="true" />
        <span>App Video Guide (മലയാളം ശബ്ദ സഹായി)</span>
      </button>

      {open && (
        <AppVideoGuideModal
          initialRole={defaultRole}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

export function AppVideoGuideModal({
  initialRole,
  onClose,
}: {
  initialRole: GuideRole
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [activeRole, setActiveRole] = useState<GuideRole>(initialRole)
  const [chapterIndex, setChapterIndex] = useState(0)
  const [activeHotspotIndex, setActiveHotspotIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoadingAudio, setIsLoadingAudio] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [autoAdvanceChapters, setAutoAdvanceChapters] = useState(true)
  const [progressPercent, setProgressPercent] = useState(0)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const webAudioSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const webAudioTimerRef = useRef<number | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const hotspotTimerRef = useRef<number | null>(null)
  const playSessionRef = useRef(0)

  const chapters = useMemo(
    () => GUIDE_CHAPTERS_BY_ROLE[activeRole] ?? GUIDE_CHAPTERS_BY_ROLE.student,
    [activeRole],
  )
  const currentChapter = chapters[chapterIndex] ?? chapters[0]
  const currentHotspot =
    currentChapter.hotspots[activeHotspotIndex] ?? currentChapter.hotspots[0]

  const stopAllAudioAndTimers = useCallback(() => {
    playSessionRef.current += 1
    if (hotspotTimerRef.current) {
      window.clearInterval(hotspotTimerRef.current)
      hotspotTimerRef.current = null
    }
    if (webAudioTimerRef.current) {
      window.clearInterval(webAudioTimerRef.current)
      webAudioTimerRef.current = null
    }
    if (webAudioSourceRef.current) {
      try {
        webAudioSourceRef.current.onended = null
        webAudioSourceRef.current.stop()
        webAudioSourceRef.current.disconnect()
      } catch {
        // Ignore already stopped source
      }
      webAudioSourceRef.current = null
    }
    if (audioRef.current) {
      try {
        audioRef.current.onended = null
        audioRef.current.onerror = null
        audioRef.current.ontimeupdate = null
        audioRef.current.pause()
      } catch {
        // Ignore pause error
      }
      audioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
      } catch {
        // Ignore speechSynthesis cancel error
      }
    }
    setIsPlaying(false)
    setIsLoadingAudio(false)
  }, [])

  const startChapterNarration = useCallback(
    async (targetRole: GuideRole, targetIdx: number) => {
      stopAllAudioAndTimers()
      const sessionId = playSessionRef.current
      const roleChapters =
        GUIDE_CHAPTERS_BY_ROLE[targetRole] ?? GUIDE_CHAPTERS_BY_ROLE.student
      const chapter = roleChapters[targetIdx]
      if (!chapter) return

      setActiveHotspotIndex(0)
      setProgressPercent(5)
      setIsPlaying(true)

      // Start animated pointer stepping through hotspots on the screen simulator
      const totalHotspots = chapter.hotspots.length
      let stepCounter = 0
      hotspotTimerRef.current = window.setInterval(() => {
        stepCounter += 1
        setActiveHotspotIndex(stepCounter % totalHotspots)
        setProgressPercent((prev) => Math.min(95, prev + 18))
      }, 4200)

      if (isMuted) {
        return
      }

      setIsLoadingAudio(true)
      const ttsData = await fetchTtsSpeechAudio({
        text: chapter.voiceScriptMl,
        language: 'ml',
        voiceName: 'Orbit',
      })

      // Pre-warm the next chapter's Orbit audio in background so next chapter plays with zero delay
      const nextChapter = roleChapters[targetIdx + 1]
      if (nextChapter) {
        void fetchTtsSpeechAudio({
          text: nextChapter.voiceScriptMl,
          language: 'ml',
          voiceName: 'Orbit',
        })
      }

      if (sessionId !== playSessionRef.current) return
      setIsLoadingAudio(false)

      const handleChapterFinished = () => {
        if (sessionId !== playSessionRef.current) return
        if (hotspotTimerRef.current) {
          window.clearInterval(hotspotTimerRef.current)
          hotspotTimerRef.current = null
        }
        if (webAudioTimerRef.current) {
          window.clearInterval(webAudioTimerRef.current)
          webAudioTimerRef.current = null
        }
        setProgressPercent(100)
        setIsPlaying(false)
        if (autoAdvanceChapters && targetIdx + 1 < roleChapters.length) {
          window.setTimeout(() => {
            if (sessionId !== playSessionRef.current) return
            setChapterIndex(targetIdx + 1)
            void startChapterNarration(targetRole, targetIdx + 1)
          }, 900)
        }
      }

      if (ttsData?.audioBase64) {
        const bytes = base64ToUint8Array(ttsData.audioBase64)
        const isRawFallback = ttsData.voiceUsed === 'fallback-raw'

        // Engine 1: Web Audio API (100% immune to Android WebView async fetch autoplay blocks)
        try {
          const AudioCtxClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext
          if (AudioCtxClass) {
            if (!sharedAudioCtx) {
              sharedAudioCtx = new AudioCtxClass()
            }
            if (sharedAudioCtx.state === 'suspended') {
              await sharedAudioCtx.resume()
            }
            let decodedBuffer: AudioBuffer | null = null
            try {
              const copyBuf = bytes.buffer.slice(
                bytes.byteOffset,
                bytes.byteOffset + bytes.byteLength,
              )
              decodedBuffer = await sharedAudioCtx.decodeAudioData(copyBuf)
            } catch {
              decodedBuffer = decodePcmWavManual(sharedAudioCtx, bytes)
            }

            if (decodedBuffer && sessionId === playSessionRef.current) {
              const source = sharedAudioCtx.createBufferSource()
              source.buffer = decodedBuffer
              if (isRawFallback && source.detune) {
                source.detune.value = -360
              }
              source.connect(sharedAudioCtx.destination)
              webAudioSourceRef.current = source

              const durationSec = Math.max(0.5, decodedBuffer.duration)
              const startTime = sharedAudioCtx.currentTime
              webAudioTimerRef.current = window.setInterval(() => {
                if (!sharedAudioCtx || sessionId !== playSessionRef.current) return
                const elapsed = Math.max(0, sharedAudioCtx.currentTime - startTime)
                const pct = Math.min(100, Math.round((elapsed / durationSec) * 100))
                setProgressPercent(pct)
                const hotspotIdx = Math.min(
                  totalHotspots - 1,
                  Math.floor((elapsed / durationSec) * totalHotspots),
                )
                setActiveHotspotIndex(hotspotIdx)
              }, 200)

              source.onended = handleChapterFinished
              source.start(0)
              return
            }
          }
        } catch {
          // Fall through to Engine 2 (pre-unlocked HTMLAudioElement with Blob URL)
        }

        // Engine 2: Pre-unlocked HTMLAudioElement with Blob Object URL
        try {
          const blob = new Blob([bytes], { type: ttsData.mimeType || 'audio/mpeg' })
          const blobUrl = URL.createObjectURL(blob)
          objectUrlRef.current = blobUrl

          const audio = sharedUnlockedAudioEl ?? new Audio()
          audio.setAttribute('playsinline', 'true')
          audio.volume = 1
          audio.src = blobUrl
          if (isRawFallback) {
            ;(audio as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean }).preservesPitch = false
            ;(audio as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean }).webkitPreservesPitch = false
            audio.playbackRate = 0.84
          } else {
            audio.playbackRate = 1.0
          }
          audioRef.current = audio
          audio.ontimeupdate = () => {
            if (audio.duration && Number.isFinite(audio.duration)) {
              const pct = Math.min(
                100,
                Math.round((audio.currentTime / audio.duration) * 100),
              )
              setProgressPercent(pct)
              const hotspotIdx = Math.min(
                totalHotspots - 1,
                Math.floor((audio.currentTime / audio.duration) * totalHotspots),
              )
              setActiveHotspotIndex(hotspotIdx)
            }
          }
          audio.onended = handleChapterFinished
          audio.onerror = handleChapterFinished
          await audio.play()
          return
        } catch {
          // Fall through to browser speechSynthesis
        }
      }

      // Engine 3: Browser Web Speech API (`ml-IN`) with Male Voice Pitch
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel()
          const utterance = new SpeechSynthesisUtterance(chapter.voiceScriptMl)
          utterance.lang = 'ml-IN'
          utterance.pitch = 0.78
          utterance.rate = 0.96
          const voices = window.speechSynthesis.getVoices()
          const mlMaleVoice = voices.find(
            (v) =>
              v.lang.toLowerCase().startsWith('ml') &&
              /male|midhun|rishi|prabhat|madhur/i.test(v.name),
          )
          if (mlMaleVoice) {
            utterance.voice = mlMaleVoice
          }
          utterance.onend = handleChapterFinished
          utterance.onerror = handleChapterFinished
          window.speechSynthesis.speak(utterance)
          return
        } catch {
          // Ignore speech error
        }
      }
    },
    [autoAdvanceChapters, isMuted, stopAllAudioAndTimers],
  )

  useEffect(() => {
    setMounted(true)
    unlockAndroidAudioOnGesture()
    // Auto-start chapter 1 playback when modal opens
    const timer = window.setTimeout(() => {
      void startChapterNarration(initialRole, 0)
    }, 100)
    return () => {
      window.clearTimeout(timer)
      stopAllAudioAndTimers()
    }
  }, [initialRole, startChapterNarration, stopAllAudioAndTimers])

  if (!mounted || typeof document === 'undefined') return null

  const Icon = currentChapter.icon

  return createPortal(
    <div
      onPointerDown={() => unlockAndroidAudioOnGesture()}
      onTouchStart={() => unlockAndroidAudioOnGesture()}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-2.5 sm:p-4 backdrop-blur-sm animate-in fade-in-0 duration-200"
      onClick={() => {
        stopAllAudioAndTimers()
        onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ICS Academy Interactive Malayalam Video Guide"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-popover text-foreground shadow-2xl"
      >
        {/* Top Modal Header + Role Switcher */}
        <div className="flex flex-col gap-3 border-b border-border/40 bg-popover px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7C3AED] via-[#4F46E5] to-[#0095F6] text-white">
                <PlayCircle className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#0077CC] dark:text-[#0095F6]">
                    Interactive Video &amp; Audio Guide
                  </span>
                  {isPlaying && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                      ശബ്ദത്തോടെ പ്ലേ ചെയ്യുന്നു
                    </span>
                  )}
                </div>
                <h2 className="truncate font-display text-base font-bold text-foreground sm:text-lg">
                  ICS Academy — ആപ്പ് എങ്ങനെ ഉപയോഗിക്കാം (മലയാളം ശബ്ദ സഹായി)
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                stopAllAudioAndTimers()
                onClose()
              }}
              aria-label="Close Video Guide"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted/75 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          {/* 4 Role Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(['principal', 'usthad', 'class-leader', 'student'] as const).map(
              (r) => {
                const isSelected = activeRole === r
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setActiveRole(r)
                      setChapterIndex(0)
                      void startChapterNarration(r, 0)
                    }}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-all active:scale-[0.98]',
                      isSelected
                        ? 'bg-[#0095F6] text-white shadow-xs'
                        : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <span>{ROLE_LABELS[r].titleMl}</span>
                    <span className="text-[10px] opacity-80">
                      ({ROLE_LABELS[r].titleEn})
                    </span>
                  </button>
                )
              },
            )}
          </div>
        </div>

        {/* Scrollable Video Player & Step-by-Step Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {/* Chapter Pill Selector Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chapters.map((ch, idx) => {
              const active = idx === chapterIndex
              const ChIcon = ch.icon
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    setChapterIndex(idx)
                    void startChapterNarration(activeRole, idx)
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-all active:scale-[0.98]',
                    active
                      ? 'bg-[#0095F6]/15 text-[#0077CC] dark:text-[#0095F6]'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <ChIcon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    ഭാഗം {ch.chapterNumber}: {ch.titleMl.slice(0, 28)}
                    {ch.titleMl.length > 28 ? '…' : ''}
                  </span>
                </button>
              )
            })}
          </div>

          {/* VIDEO SCREEN SIMULATOR ("സ്ക്രീനിൽ ഓരോന്നും തൊട്ട് കാണിക്കുന്ന വീഡിയോ ഫ്രെയിം") */}
          <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-black via-[#0B1014] to-[#0B1014] p-4 text-white shadow-xl sm:p-5">
            {/* Top Simulated App Bar & Audio Waveform */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-xl bg-[#0095F6]/20 text-[#0095F6]">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#0095F6]">
                    {currentChapter.badge}
                  </p>
                  <h3 className="text-sm font-bold text-white sm:text-base">
                    {currentChapter.titleEn}
                  </h3>
                </div>
              </div>

              {/* Audio Visualizer & Controls inside Video Frame */}
              <div className="flex items-center gap-2">
                {isPlaying && (
                  <div
                    aria-hidden="true"
                    className="hidden sm:flex h-6 items-center gap-0.5 rounded-full bg-[#0095F6]/15 px-2.5"
                  >
                    {[40, 85, 55, 95, 60, 80, 45, 90, 65, 50].map((h, i) => (
                      <span
                        key={i}
                        style={{ height: `${h}%` }}
                        className="w-1 rounded-full bg-[#0095F6] animate-pulse"
                      />
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (isPlaying) {
                      stopAllAudioAndTimers()
                    } else {
                      void startChapterNarration(activeRole, chapterIndex)
                    }
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#0095F6] px-3.5 text-xs font-bold text-white transition-transform hover:bg-[#0077CC] active:scale-95"
                >
                  {isLoadingAudio ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : isPlaying ? (
                    <Pause className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Play className="size-3.5" aria-hidden="true" />
                  )}
                  <span>{isPlaying ? 'Pause' : 'Play മലയാളം ശബ്ദം'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void startChapterNarration(activeRole, chapterIndex)}
                  title="Replay Malayalam Voice"
                  className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const nextMuted = !isMuted
                    setIsMuted(nextMuted)
                    if (nextMuted && audioRef.current) {
                      audioRef.current.pause()
                    }
                  }}
                  title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                  className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  {isMuted ? (
                    <VolumeX className="size-3.5 text-red-400" aria-hidden="true" />
                  ) : (
                    <Volume2 className="size-3.5 text-[#0095F6]" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* Interactive Simulated Screen Buttons with Animated Touch Pointer */}
            <div className="grid gap-3 sm:grid-cols-2">
              {currentChapter.hotspots.map((spot, idx) => {
                const isFocused = idx === activeHotspotIndex
                const toneClasses =
                  spot.tone === 'red'
                    ? isFocused
                      ? 'bg-red-500/25 shadow-md'
                      : 'bg-white/[0.05] hover:bg-white/[0.09]'
                    : spot.tone === 'cyan'
                      ? isFocused
                        ? 'bg-[#4F46E5]/25 shadow-md'
                        : 'bg-white/[0.05] hover:bg-white/[0.09]'
                      : spot.tone === 'amber'
                        ? isFocused
                          ? 'bg-amber-500/22 shadow-md'
                          : 'bg-white/[0.05] hover:bg-white/[0.09]'
                        : isFocused
                          ? 'bg-[#0095F6]/22 shadow-md'
                          : 'bg-white/[0.05] hover:bg-white/[0.09]'

                return (
                  <button
                    key={spot.id}
                    type="button"
                    onClick={() => setActiveHotspotIndex(idx)}
                    className={cn(
                      'relative flex flex-col justify-between gap-2 rounded-2xl p-3.5 text-left transition-all duration-200 outline-none active:scale-[0.99]',
                      toneClasses,
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-white',
                          spot.tone === 'red'
                            ? 'bg-red-500'
                            : spot.tone === 'cyan'
                              ? 'bg-[#4F46E5]'
                              : spot.tone === 'amber'
                                ? 'bg-amber-500'
                                : 'bg-[#0095F6]',
                        )}
                      >
                        <span>Step {spot.stepNumber}:</span>
                        <span>{spot.buttonLabel}</span>
                      </span>

                      {isFocused && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold text-[#60B6FF] animate-bounce">
                          <span>👆 ഇവിടെ തൊടുക</span>
                        </span>
                      )}
                    </div>

                    <div className="mt-1">
                      <p className="text-sm font-bold text-white">
                        {spot.malayalamTitle}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-200">
                        {spot.malayalamAction}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Video Progress Bar */}
            <div className="mt-4 flex flex-col gap-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  style={{ width: `${progressPercent}%` }}
                  className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] via-[#4F46E5] to-[#0095F6] transition-all duration-300"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span>
                  ഇപ്പോൾ കാണിക്കുന്നത്:{' '}
                  <strong className="text-[#60B6FF]">
                    Step {currentHotspot.stepNumber} — {currentHotspot.malayalamTitle}
                  </strong>
                </span>
                <span>
                  അധ്യായം {chapterIndex + 1} / {chapters.length}
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Malayalam Explanation Card (Subtitles / Full Voice Transcript) */}
          <div className="rounded-2xl bg-muted/45 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0077CC] dark:text-[#0095F6]">
                  മലയാളം വിശദീകരണം (Audio Transcript &amp; Purpose)
                </span>
                <h4 className="mt-0.5 text-base font-bold text-foreground">
                  {currentChapter.titleMl}
                </h4>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-muted-foreground">
                <input
                  type="checkbox"
                  checked={autoAdvanceChapters}
                  onChange={(e) => setAutoAdvanceChapters(e.target.checked)}
                  className="size-4 accent-[#0095F6]"
                />
                <span>അടുത്ത അധ്യായം തനിയെ പ്ലേ ചെയ്യുക (Auto-Play)</span>
              </label>
            </div>

            <div className="mt-3 space-y-2.5 text-xs leading-relaxed sm:text-sm">
              <p className="rounded-2xl bg-[#0095F6]/10 p-3 font-medium text-foreground">
                <strong className="text-[#0077CC] dark:text-[#0095F6]">
                  എന്തിനാണ് ഈ ഭാഗം ഉപയോഗിക്കുന്നത്?{' '}
                </strong>
                {currentChapter.purposeMl}
              </p>

              <p className="rounded-2xl bg-card/80 p-3.5 leading-7 text-foreground/90">
                <strong className="text-[#7C3AED] dark:text-[#A78BFA]">🔊 ശബ്ദ വിവരണം: </strong>
                {currentChapter.voiceScriptMl}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Navigation Footer (Previous / Play-Pause / Next Chapter) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 bg-popover px-4 py-3.5 sm:px-6">
          <button
            type="button"
            disabled={chapterIndex === 0}
            onClick={() => {
              const prevIdx = Math.max(0, chapterIndex - 1)
              setChapterIndex(prevIdx)
              void startChapterNarration(activeRole, prevIdx)
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-muted/75 px-4 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span>മുമ്പത്തെ ഭാഗം (Prev)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (isPlaying) {
                  stopAllAudioAndTimers()
                } else {
                  void startChapterNarration(activeRole, chapterIndex)
                }
              }}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-r from-[#7C3AED] via-[#4F46E5] to-[#0095F6] px-4 text-xs font-bold text-white shadow-sm transition-transform active:scale-95"
            >
              {isPlaying ? (
                <>
                  <Pause className="size-4" aria-hidden="true" />
                  <span>നിർത്തുക (Pause)</span>
                </>
              ) : (
                <>
                  <Volume2 className="size-4" aria-hidden="true" />
                  <span>മലയാളത്തിൽ കേൾക്കുക (Play)</span>
                </>
              )}
            </button>

            {chapterIndex + 1 < chapters.length ? (
              <button
                type="button"
                onClick={() => {
                  const nextIdx = Math.min(chapters.length - 1, chapterIndex + 1)
                  setChapterIndex(nextIdx)
                  void startChapterNarration(activeRole, nextIdx)
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#0095F6]/15 px-4 text-xs font-bold text-[#0077CC] dark:text-[#0095F6] transition-colors hover:bg-[#0095F6] hover:text-white"
              >
                <span>അടുത്ത ഭാഗം (Next)</span>
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  stopAllAudioAndTimers()
                  onClose()
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#0095F6] px-4 text-xs font-bold text-white hover:bg-[#0077CC]"
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                <span>പൂർത്തിയായി (Done)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
