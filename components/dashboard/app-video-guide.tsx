'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Ban,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  Library,
  Loader2,
  Lock,
  Megaphone,
  MessageCircle,
  Pause,
  Play,
  PlayCircle,
  RotateCcw,
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
  title: string
  action: string
  tone: 'lime' | 'cyan' | 'amber' | 'red'
  xPercent: number
  yPercent: number
}

interface GuideChapter {
  id: string
  chapterNumber: number
  badge: string
  title: string
  shortTitle: string
  purpose: string
  voiceScript: string
  icon: LucideIcon
  hotspots: GuideHotspot[]
}

const GUIDE_CHAPTERS_BY_ROLE: Record<GuideRole, GuideChapter[]> = {
  principal: [
    {
      id: 'principal-unheld',
      chapterNumber: 1,
      badge: '1. Live Monitor • Period Override',
      title: 'Unheld Periods & Substitute Usthad',
      shortTitle: 'Unheld Periods',
      purpose:
        'Record periods when a scheduled Usthad is away, lock attendance to prevent errors, or assign a substitute Usthad.',
      voiceScript:
        'First, Unheld Periods and Substitute Usthad Control. If a scheduled Usthad is unable to take a period, select the class, period, and reason. Tap Mark Class Not Held to record it and lock attendance automatically. If another Usthad covers the period, select the substitute Usthad and tap Assign Substitute to unlock attendance immediately.',
      icon: UserCog,
      hotspots: [
        {
          id: 'p1-h1',
          stepNumber: 1,
          buttonLabel: 'Class & Period',
          title: 'Select Class & Period',
          action:
            'Choose any of the 11 academy classes and the period you need to update.',
          tone: 'lime',
          xPercent: 20,
          yPercent: 32,
        },
        {
          id: 'p1-h2',
          stepNumber: 2,
          buttonLabel: 'Reason',
          title: 'Select Reason',
          action:
            'Choose whether the Usthad is on leave, in an official meeting, or away on duty.',
          tone: 'amber',
          xPercent: 52,
          yPercent: 32,
        },
        {
          id: 'p1-h3',
          stepNumber: 3,
          buttonLabel: 'Class Not Held',
          title: 'Mark Class Not Held',
          action:
            'Marks the period as not held and locks attendance to prevent accidental entries.',
          tone: 'red',
          xPercent: 34,
          yPercent: 72,
        },
        {
          id: 'p1-h4',
          stepNumber: 4,
          buttonLabel: 'Assign Substitute',
          title: 'Assign Substitute Usthad',
          action:
            'Assigns a covering Usthad to the period and unlocks attendance for that session.',
          tone: 'cyan',
          xPercent: 76,
          yPercent: 72,
        },
      ],
    },
    {
      id: 'principal-matrix',
      chapterNumber: 2,
      badge: '1. Live Monitor • All Classes',
      title: 'All-Class Attendance Overview',
      shortTitle: 'Class Matrix',
      purpose:
        'Monitor live period statuses and daily attendance across all 11 classes from one overview table.',
      voiceScript:
        'Second, the All-Class Attendance Overview. View every class from 8th Standard to BS 5 along with its Class Usthad, Class Leaders, student strength, and daily attendance rate. Period badges show green when submitted, red when not held, and blue when covered by a substitute. Tap Inspect to open and edit that class directly.',
      icon: Building2,
      hotspots: [
        {
          id: 'p2-h1',
          stepNumber: 1,
          buttonLabel: 'Usthad & Leaders',
          title: 'Class Usthad & Leaders',
          action:
            'View the assigned Class Usthad along with the Main and Assistant Class Leaders.',
          tone: 'lime',
          xPercent: 22,
          yPercent: 40,
        },
        {
          id: 'p2-h2',
          stepNumber: 2,
          buttonLabel: 'Students & Rate',
          title: 'Strength & Attendance Rate',
          action:
            'Track total enrolled students and live attendance percentage for each class.',
          tone: 'cyan',
          xPercent: 48,
          yPercent: 40,
        },
        {
          id: 'p2-h3',
          stepNumber: 3,
          buttonLabel: 'Period Badges',
          title: 'Live Period Status',
          action:
            'Green indicates submitted, red indicates not held, and blue indicates a substitute Usthad.',
          tone: 'amber',
          xPercent: 68,
          yPercent: 40,
        },
        {
          id: 'p2-h4',
          stepNumber: 4,
          buttonLabel: 'Inspect Class',
          title: 'Direct Class Control',
          action:
            'Open the selected class register below to review or edit period attendance.',
          tone: 'lime',
          xPercent: 86,
          yPercent: 40,
        },
      ],
    },
    {
      id: 'principal-directory',
      chapterNumber: 3,
      badge: '2. Directory • People & Timetable',
      title: 'Faculty, Leaders, Students & Timetable',
      shortTitle: 'Directory',
      purpose:
        'Manage Class Usthads, Class Leaders, student admissions, monthly attendance, timetables, and Parent PDF reports.',
      voiceScript:
        'Third, the Directory tab. Switch between Teachers, Class Leaders, Students, and Timetable using the top tabs. Update Class Usthad assignments, add or edit student records, adjust monthly attendance, and download signed Parent PDF reports with one tap.',
      icon: Users,
      hotspots: [
        {
          id: 'p3-h1',
          stepNumber: 1,
          buttonLabel: 'Directory Tabs',
          title: 'Switch Sections',
          action:
            'Move seamlessly between Teachers, Class Leaders, Students, and Timetable Editor.',
          tone: 'lime',
          xPercent: 32,
          yPercent: 22,
        },
        {
          id: 'p3-h2',
          stepNumber: 2,
          buttonLabel: 'Class Control',
          title: 'Manage Class & Periods',
          action:
            'Jump directly from any Usthad card into their class attendance register.',
          tone: 'lime',
          xPercent: 28,
          yPercent: 68,
        },
        {
          id: 'p3-h3',
          stepNumber: 3,
          buttonLabel: 'Usthad View',
          title: 'Switch Workspace',
          action:
            'Switch instantly to your own Class Usthad workspace whenever needed.',
          tone: 'cyan',
          xPercent: 56,
          yPercent: 68,
        },
        {
          id: 'p3-h4',
          stepNumber: 4,
          buttonLabel: 'Parent PDF',
          title: 'Official Parent Report',
          action:
            'Generate a stamped PDF report with attendance and leave history for parents.',
          tone: 'cyan',
          xPercent: 82,
          yPercent: 68,
        },
      ],
    },
    {
      id: 'principal-holidays',
      chapterNumber: 4,
      badge: '4. Notices • Holidays',
      title: 'Official Holidays & Notices',
      shortTitle: 'Notices',
      purpose:
        'Announce campus holidays and publish notices to all 11 classes or selected batches.',
      voiceScript:
        'Fourth, Official Holidays and Notices. Enable Official Holiday Mode when announcing a holiday so working days are adjusted automatically across student records. Choose target classes, enter the notice details, and tap Publish Notice to alert students and Usthads immediately.',
      icon: Megaphone,
      hotspots: [
        {
          id: 'p4-h1',
          stepNumber: 1,
          buttonLabel: 'Holiday Mode',
          title: 'Official Holiday Mode',
          action:
            'Automatically adjusts monthly working days across selected classes when enabled.',
          tone: 'lime',
          xPercent: 25,
          yPercent: 28,
        },
        {
          id: 'p4-h2',
          stepNumber: 2,
          buttonLabel: 'Title & Details',
          title: 'Notice Content',
          action:
            'Enter the announcement heading, category, and clear message body.',
          tone: 'cyan',
          xPercent: 50,
          yPercent: 50,
        },
        {
          id: 'p4-h3',
          stepNumber: 3,
          buttonLabel: 'Target Classes',
          title: 'Choose Recipients',
          action:
            'Send notices to all 11 classes, High School, BS Degree, or individual classes.',
          tone: 'amber',
          xPercent: 35,
          yPercent: 74,
        },
        {
          id: 'p4-h4',
          stepNumber: 4,
          buttonLabel: 'Publish Notice',
          title: 'Instant Broadcast',
          action:
            'Publishes immediately to notice boards and notification bells across the app.',
          tone: 'lime',
          xPercent: 80,
          yPercent: 78,
        },
      ],
    },
    {
      id: 'principal-messenger',
      chapterNumber: 5,
      badge: '3. Chat • Campus Messenger',
      title: 'Campus Messenger & Staff Room',
      shortTitle: 'Messenger',
      purpose:
        'Communicate in the Staff Room, class groups, or direct chats with PDFs, photos, and voice notes.',
      voiceScript:
        'Fifth, Campus Messenger. Access the Staff Room for Usthads and all 11 official class groups. Tap the lock icon to restrict posting in a class group to Usthads and the Principal. Share PDF notes, photos, and voice messages effortlessly.',
      icon: MessageCircle,
      hotspots: [
        {
          id: 'p5-h1',
          stepNumber: 1,
          buttonLabel: 'Staff & Class Groups',
          title: 'Official Channels',
          action:
            'Open the Staff Room or any class group directly from the chat sidebar.',
          tone: 'amber',
          xPercent: 24,
          yPercent: 36,
        },
        {
          id: 'p5-h2',
          stepNumber: 2,
          buttonLabel: 'Lock Group',
          title: 'Admin-Only Mode',
          action:
            'Lock a group so only Usthads and the Principal can post announcements.',
          tone: 'cyan',
          xPercent: 76,
          yPercent: 24,
        },
        {
          id: 'p5-h3',
          stepNumber: 3,
          buttonLabel: 'Attachments & Voice',
          title: 'PDFs, Photos & Voice',
          action:
            'Attach study PDFs or images and record voice notes directly inside any chat.',
          tone: 'lime',
          xPercent: 62,
          yPercent: 78,
        },
        {
          id: 'p5-h4',
          stepNumber: 4,
          buttonLabel: 'Chat Settings',
          title: 'Personal Preferences',
          action:
            'Configure online status, read receipts, text size, and chat wallpaper.',
          tone: 'lime',
          xPercent: 88,
          yPercent: 24,
        },
      ],
    },
    {
      id: 'principal-library',
      chapterNumber: 6,
      badge: '5. Library • Kitabs & Results',
      title: 'Library Catalogue, Digital Kitabs & Exam Results',
      shortTitle: 'Library',
      purpose:
        'Edit the campus library catalogue, upload Digital Kitab PDFs, view timetables, and open university exam portals.',
      voiceScript:
        'Sixth, the Library tab. Manage the campus library catalogue by adding, editing, or updating shelf details in real time for everyone. Upload Digital Kitab PDFs, inspect class timetables, and open the university exam portal from the four quick tabs.',
      icon: Library,
      hotspots: [
        {
          id: 'p6-h1',
          stepNumber: 1,
          buttonLabel: 'Library Catalogue',
          title: 'Edit Books & Kitabs',
          action:
            'Add new titles, edit details, assign shelves, or remove entries with live sync.',
          tone: 'lime',
          xPercent: 28,
          yPercent: 34,
        },
        {
          id: 'p6-h2',
          stepNumber: 2,
          buttonLabel: 'Digital Kitabs',
          title: 'Upload Kitab PDF',
          action:
            'Upload PDF kitabs with category tags so students can read and download them.',
          tone: 'cyan',
          xPercent: 72,
          yPercent: 34,
        },
        {
          id: 'p6-h3',
          stepNumber: 3,
          buttonLabel: 'Time Table',
          title: 'Class Timetables',
          action:
            'Inspect semester period schedules across all academy classes.',
          tone: 'lime',
          xPercent: 45,
          yPercent: 72,
        },
        {
          id: 'p6-h4',
          stepNumber: 4,
          buttonLabel: 'Exam Results',
          title: 'University Exam Portal',
          action:
            'Open official university and academy examination result links directly.',
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
      badge: '1. Students • Class Roster',
      title: 'Class Roster & Student Actions',
      shortTitle: 'Roster',
      purpose:
        'View all students in your assigned class, track campus presence, log leaves, and export Parent PDF reports.',
      voiceScript:
        'First, the Class Roster. View every student in your assigned class along with campus status and attendance percentage. Tap Attendance to edit monthly records, Log Leave to record departures, or Parent PDF to download a signed report.',
      icon: Users,
      hotspots: [
        {
          id: 'u1-h1',
          stepNumber: 1,
          buttonLabel: 'Class Summary',
          title: 'Daily Overview',
          action:
            'Check total students, count at academy, students on leave, and Class Leaders.',
          tone: 'lime',
          xPercent: 25,
          yPercent: 28,
        },
        {
          id: 'u1-h2',
          stepNumber: 2,
          buttonLabel: 'Attendance',
          title: 'Monthly Attendance',
          action:
            'Jump directly to a student’s monthly attendance record for quick updates.',
          tone: 'lime',
          xPercent: 45,
          yPercent: 68,
        },
        {
          id: 'u1-h3',
          stepNumber: 3,
          buttonLabel: 'Leave / Return',
          title: 'Log Leave & Return',
          action:
            'Record when a student leaves campus and verify their return.',
          tone: 'amber',
          xPercent: 68,
          yPercent: 68,
        },
        {
          id: 'u1-h4',
          stepNumber: 4,
          buttonLabel: 'Parent PDF',
          title: 'Download Report',
          action:
            'Export an official PDF attendance and leave report to share with parents.',
          tone: 'cyan',
          xPercent: 88,
          yPercent: 68,
        },
      ],
    },
    {
      id: 'usthad-period-attendance',
      chapterNumber: 2,
      badge: '2. Attendance • Periods',
      title: 'Period Attendance Control',
      shortTitle: 'Periods',
      purpose:
        'Mark Present, Absent, or Leave with reasons for each scheduled teaching period.',
      voiceScript:
        'Second, Period Attendance. Select your teaching period from the top bar, mark each student Present, Absent, or Leave, choose a reason where applicable, and tap Submit Attendance to sync live with the Principal monitor.',
      icon: UserCheck,
      hotspots: [
        {
          id: 'u2-h1',
          stepNumber: 1,
          buttonLabel: 'Period Tabs',
          title: 'Select Period',
          action:
            'Switch between scheduled periods and identify your assigned teaching slots.',
          tone: 'lime',
          xPercent: 25,
          yPercent: 28,
        },
        {
          id: 'u2-h2',
          stepNumber: 2,
          buttonLabel: 'Present / Absent / Leave',
          title: 'Mark Status',
          action:
            'Tap Present, Absent, or Leave beside each student in the register.',
          tone: 'cyan',
          xPercent: 52,
          yPercent: 58,
        },
        {
          id: 'u2-h3',
          stepNumber: 3,
          buttonLabel: 'Reason Selector',
          title: 'Add Reason',
          action:
            'Pick a standard reason whenever a student is marked Absent or on Leave.',
          tone: 'amber',
          xPercent: 72,
          yPercent: 58,
        },
        {
          id: 'u2-h4',
          stepNumber: 4,
          buttonLabel: 'Submit Attendance',
          title: 'Save Register',
          action:
            'Saves immediately to the Principal monitor and each student’s dashboard.',
          tone: 'lime',
          xPercent: 80,
          yPercent: 82,
        },
      ],
    },
    {
      id: 'usthad-monthly',
      chapterNumber: 3,
      badge: '2. Attendance • Monthly',
      title: 'Monthly Working Days & Attendance',
      shortTitle: 'Monthly',
      purpose:
        'Manage monthly working days and present counts across the June to May academic year.',
      voiceScript:
        'Third, the Monthly Attendance Editor. Choose a student and month between June and May, enter total working days and days present, and tap Save Monthly Attendance to update student dashboards and PDF reports.',
      icon: CalendarClock,
      hotspots: [
        {
          id: 'u3-h1',
          stepNumber: 1,
          buttonLabel: 'Student & Month',
          title: 'Select Student & Month',
          action:
            'Choose any student in your class and any month from June to May.',
          tone: 'lime',
          xPercent: 26,
          yPercent: 32,
        },
        {
          id: 'u3-h2',
          stepNumber: 2,
          buttonLabel: 'Working Days',
          title: 'Total Working Days',
          action:
            'Set the official number of class working days for that month.',
          tone: 'cyan',
          xPercent: 55,
          yPercent: 32,
        },
        {
          id: 'u3-h3',
          stepNumber: 3,
          buttonLabel: 'Days Present',
          title: 'Auto Percentage',
          action:
            'Absent days and attendance percentage calculate automatically as you type.',
          tone: 'amber',
          xPercent: 38,
          yPercent: 68,
        },
        {
          id: 'u3-h4',
          stepNumber: 4,
          buttonLabel: 'Save Monthly',
          title: 'Save Changes',
          action:
            'Updates the student’s attendance summary and Parent PDF immediately.',
          tone: 'lime',
          xPercent: 78,
          yPercent: 68,
        },
      ],
    },
    {
      id: 'usthad-leave',
      chapterNumber: 4,
      badge: '3. Leave • Register',
      title: 'Student Leave & Return Register',
      shortTitle: 'Leave',
      purpose:
        'Log student home-leave departures and verify campus returns with timestamps.',
      voiceScript:
        'Fourth, the Student Leave Register. Record a student’s departure date, expected return, and reason when they go on leave. When they return to campus, mark Campus Return to update their status back to At Academy.',
      icon: FileText,
      hotspots: [
        {
          id: 'u4-h1',
          stepNumber: 1,
          buttonLabel: 'Leave vs Return',
          title: 'Choose Entry Type',
          action:
            'Switch between recording a new leave and verifying a student’s return.',
          tone: 'lime',
          xPercent: 28,
          yPercent: 30,
        },
        {
          id: 'u4-h2',
          stepNumber: 2,
          buttonLabel: 'Date & Time',
          title: 'Departure & Return',
          action:
            'Record exact departure and return dates along with time of day.',
          tone: 'cyan',
          xPercent: 65,
          yPercent: 30,
        },
        {
          id: 'u4-h3',
          stepNumber: 3,
          buttonLabel: 'Reason & Days',
          title: 'Leave Details',
          action:
            'Enter the approved reason and total duration of the leave.',
          tone: 'amber',
          xPercent: 35,
          yPercent: 72,
        },
        {
          id: 'u4-h4',
          stepNumber: 4,
          buttonLabel: 'Save Log',
          title: 'Live Status Sync',
          action:
            'Updates the student’s status badge immediately across all views.',
          tone: 'lime',
          xPercent: 78,
          yPercent: 72,
        },
      ],
    },
    {
      id: 'usthad-notices',
      chapterNumber: 5,
      badge: '4. Notices • Announcements',
      title: 'Class Notice Board',
      shortTitle: 'Notices',
      purpose:
        'Publish class announcements, exam schedules, and holiday notices to students.',
      voiceScript:
        'Fifth, the Class Notice Board. Choose a category, enter a clear title and message, select your class or additional batches, and tap Publish Notice. You can pin or remove notices anytime.',
      icon: Megaphone,
      hotspots: [
        {
          id: 'u5-h1',
          stepNumber: 1,
          buttonLabel: 'Title & Category',
          title: 'Compose Notice',
          action:
            'Select Academic, Exam, Holiday, or General and enter your message.',
          tone: 'lime',
          xPercent: 28,
          yPercent: 34,
        },
        {
          id: 'u5-h2',
          stepNumber: 2,
          buttonLabel: 'Target Classes',
          title: 'Select Audience',
          action:
            'Publish to your assigned class or include additional classes.',
          tone: 'cyan',
          xPercent: 68,
          yPercent: 34,
        },
        {
          id: 'u5-h3',
          stepNumber: 3,
          buttonLabel: 'Publish Notice',
          title: 'Post Live',
          action:
            'Sends the notice straight to students’ dashboards and alert bells.',
          tone: 'lime',
          xPercent: 75,
          yPercent: 74,
        },
        {
          id: 'u5-h4',
          stepNumber: 4,
          buttonLabel: 'Manage Notices',
          title: 'Pin or Delete',
          action:
            'Pin important notices to the top or delete older announcements.',
          tone: 'red',
          xPercent: 30,
          yPercent: 74,
        },
      ],
    },
    {
      id: 'usthad-chat-library',
      chapterNumber: 6,
      badge: '5. Chat & Library',
      title: 'Campus Messenger & Digital Kitabs',
      shortTitle: 'Chat & Library',
      purpose:
        'Message class groups and upload Digital Kitab PDFs for students.',
      voiceScript:
        'Sixth, Campus Messenger and Digital Kitabs. Share notes, PDFs, and voice messages in your class group or Staff Room, and lock class groups whenever needed. In the Library tab, upload Digital Kitab PDFs for students.',
      icon: MessageCircle,
      hotspots: [
        {
          id: 'u6-h1',
          stepNumber: 1,
          buttonLabel: 'Class & Staff Chat',
          title: 'Official Groups',
          action:
            'Message your class group or coordinate with colleagues in the Staff Room.',
          tone: 'lime',
          xPercent: 25,
          yPercent: 34,
        },
        {
          id: 'u6-h2',
          stepNumber: 2,
          buttonLabel: 'Lock & Pin',
          title: 'Moderation Tools',
          action:
            'Lock group replies to Usthads only or pin key study instructions.',
          tone: 'amber',
          xPercent: 72,
          yPercent: 34,
        },
        {
          id: 'u6-h3',
          stepNumber: 3,
          buttonLabel: 'PDFs & Voice',
          title: 'Share Resources',
          action:
            'Send study PDFs, photos, and quick audio explanations directly in chat.',
          tone: 'cyan',
          xPercent: 35,
          yPercent: 74,
        },
        {
          id: 'u6-h4',
          stepNumber: 4,
          buttonLabel: 'Upload Kitab',
          title: 'Digital Library',
          action:
            'Upload PDF kitabs to make them available to all students instantly.',
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
      badge: '1. Class Leader Duty • Attendance',
      title: 'Submitting Period Attendance',
      shortTitle: 'Attendance',
      purpose:
        'Record and submit daily period-by-period attendance for your class.',
      voiceScript:
        'First, Period Attendance. Both the Main Leader and Assistant Leader share attendance duty. Select the active period, use Mark All Present if most students are in class, adjust any absent or leave statuses, and tap Submit Attendance to update the Principal and Class Usthad live.',
      icon: UserCheck,
      hotspots: [
        {
          id: 'cl1-h1',
          stepNumber: 1,
          buttonLabel: 'Select Period',
          title: 'Choose Active Period',
          action:
            'Tap the current period tab to open that session’s attendance sheet.',
          tone: 'lime',
          xPercent: 25,
          yPercent: 28,
        },
        {
          id: 'cl1-h2',
          stepNumber: 2,
          buttonLabel: 'Mark All Present',
          title: 'Quick Fill',
          action:
            'Mark every student present in one tap before adjusting exceptions.',
          tone: 'cyan',
          xPercent: 72,
          yPercent: 28,
        },
        {
          id: 'cl1-h3',
          stepNumber: 3,
          buttonLabel: 'Present / Absent / Leave',
          title: 'Individual Status',
          action:
            'Set Present, Absent, or Leave beside each classmate’s name.',
          tone: 'lime',
          xPercent: 35,
          yPercent: 68,
        },
        {
          id: 'cl1-h4',
          stepNumber: 4,
          buttonLabel: 'Submit Attendance',
          title: 'Live Sync',
          action:
            'Submits immediately to your Class Usthad and the Principal monitor.',
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
      title: 'Recording Absent & Leave Reasons',
      shortTitle: 'Reasons',
      purpose:
        'Attach clear reasons whenever a classmate is marked Absent or on Leave.',
      voiceScript:
        'Second, Absent and Leave Reasons. Whenever you mark a classmate Absent or on Leave, quick reason chips appear beneath their name. Select the matching reason before submitting so your Class Usthad has full clarity.',
      icon: CheckCircle2,
      hotspots: [
        {
          id: 'cl2-h1',
          stepNumber: 1,
          buttonLabel: 'Absent or Leave',
          title: 'Open Reason Chips',
          action:
            'Selecting Absent or Leave reveals quick reason buttons right below.',
          tone: 'red',
          xPercent: 32,
          yPercent: 34,
        },
        {
          id: 'cl2-h2',
          stepNumber: 2,
          buttonLabel: 'Select Reason',
          title: 'Pick Clear Reason',
          action:
            'Choose Sick, Approved Leave, Home Emergency, or Duty before saving.',
          tone: 'amber',
          xPercent: 68,
          yPercent: 68,
        },
      ],
    },
    {
      id: 'leader-unheld',
      chapterNumber: 3,
      badge: '3. Session Status',
      title: 'Unheld Class or Substitute Usthad',
      shortTitle: 'Session Status',
      purpose:
        'Report when a scheduled class was not held or when a substitute Usthad taught the period.',
      voiceScript:
        'Third, Session Status. If a period was not held, select Class Not Held, pick a reason, and confirm to alert the Principal. If another Usthad took the class, choose Substitute Usthad, select their name, and mark attendance as usual.',
      icon: Ban,
      hotspots: [
        {
          id: 'cl3-h1',
          stepNumber: 1,
          buttonLabel: 'Class Conducted',
          title: 'Regular Session',
          action:
            'Keep Class Conducted selected when the scheduled Usthad takes the period.',
          tone: 'lime',
          xPercent: 22,
          yPercent: 34,
        },
        {
          id: 'cl3-h2',
          stepNumber: 2,
          buttonLabel: 'Class Not Held',
          title: 'Report Unheld Period',
          action:
            'Notifies the Principal immediately and locks attendance for that slot.',
          tone: 'red',
          xPercent: 52,
          yPercent: 34,
        },
        {
          id: 'cl3-h3',
          stepNumber: 3,
          buttonLabel: 'Substitute Usthad',
          title: 'Record Substitute',
          action:
            'Select the covering Usthad’s name and submit period attendance normally.',
          tone: 'cyan',
          xPercent: 80,
          yPercent: 34,
        },
      ],
    },
    {
      id: 'leader-privacy',
      chapterNumber: 4,
      badge: '4. Privacy & Personal Profile',
      title: 'Student Privacy & Personal Records',
      shortTitle: 'Privacy',
      purpose:
        'Understand how classmate privacy is protected while accessing your own dashboard and credentials.',
      voiceScript:
        'Fourth, Privacy and Personal Records. In the class attendance sheet, only classmates’ names are shown—their private admission IDs and passwords remain hidden. Open your top-right profile menu to view your own private details.',
      icon: Lock,
      hotspots: [
        {
          id: 'cl4-h1',
          stepNumber: 1,
          buttonLabel: 'My Attendance vs Duty',
          title: 'Separate Views',
          action:
            'Track your own attendance alongside your Class Leader attendance register.',
          tone: 'lime',
          xPercent: 30,
          yPercent: 38,
        },
        {
          id: 'cl4-h2',
          stepNumber: 2,
          buttonLabel: 'Profile Menu',
          title: 'Private Credentials',
          action:
            'Tap your profile avatar at the top right to see your Admission ID and batch.',
          tone: 'cyan',
          xPercent: 78,
          yPercent: 38,
        },
      ],
    },
    {
      id: 'leader-chat-ai',
      chapterNumber: 5,
      badge: '5. Chat, AI & Library',
      title: 'Messenger, AI Study Chatbot & Library',
      shortTitle: 'Chat & AI',
      purpose:
        'Use Campus Messenger, the AI Study Chatbot, and the Digital Library for daily studies.',
      voiceScript:
        'Fifth, Campus Messenger, AI Study Chatbot, and Library. Coordinate in your class group, ask the AI Chatbot kitab or grammar questions in English, Arabic, or Malayalam, and read Digital Kitabs anytime.',
      icon: Sparkles,
      hotspots: [
        {
          id: 'cl5-h1',
          stepNumber: 1,
          buttonLabel: 'Campus Messenger',
          title: 'Class & Usthad Chat',
          action:
            'Exchange voice notes, photos, and PDF notes in your official class group.',
          tone: 'lime',
          xPercent: 28,
          yPercent: 50,
        },
        {
          id: 'cl5-h2',
          stepNumber: 2,
          buttonLabel: 'AI Study Chatbot',
          title: 'Kitab & Study Help',
          action:
            'Scan kitab pages or ask questions by text or voice and save Study Note PDFs.',
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
      badge: '1. Dashboard • Profile',
      title: 'Campus Status & Private Profile',
      shortTitle: 'Profile',
      purpose:
        'Check your live campus status badge and access your private Admission ID and batch details.',
      voiceScript:
        'First, your Student Dashboard and Private Profile. Tap your profile icon at the top right to view your Admission ID, class, and batch privately. Your header badge shows At Academy in green when on campus and On Leave when on approved leave.',
      icon: GraduationCap,
      hotspots: [
        {
          id: 's1-h1',
          stepNumber: 1,
          buttonLabel: 'Campus Badge',
          title: 'Live Presence Status',
          action:
            'Displays At Academy in green or On Leave in red based on Usthad logs.',
          tone: 'lime',
          xPercent: 24,
          yPercent: 32,
        },
        {
          id: 's1-h2',
          stepNumber: 2,
          buttonLabel: 'Profile Menu',
          title: 'Private Details',
          action:
            'View your Admission Number, password, and batch securely in one place.',
          tone: 'cyan',
          xPercent: 78,
          yPercent: 32,
        },
      ],
    },
    {
      id: 'student-notices',
      chapterNumber: 2,
      badge: '2. Notices • Alerts',
      title: 'Notice Board & Holiday Alerts',
      shortTitle: 'Notices',
      purpose:
        'Read official announcements, exam dates, and holiday notices from the Principal and Usthads.',
      voiceScript:
        'Second, the Notice Board. All official notices and holiday announcements from the Principal and your Class Usthad appear here and inside the top notification bell.',
      icon: Megaphone,
      hotspots: [
        {
          id: 's2-h1',
          stepNumber: 1,
          buttonLabel: 'Notice Feed',
          title: 'Official Updates',
          action:
            'Stay updated on exam schedules, holidays, and class announcements.',
          tone: 'lime',
          xPercent: 35,
          yPercent: 48,
        },
        {
          id: 's2-h2',
          stepNumber: 2,
          buttonLabel: 'Alert Bell',
          title: 'Notification Bell',
          action:
            'Tap the bell icon at the top to inspect unread campus notices.',
          tone: 'amber',
          xPercent: 76,
          yPercent: 28,
        },
      ],
    },
    {
      id: 'student-attendance',
      chapterNumber: 3,
      badge: '3. Attendance • Monthly & Daily',
      title: 'Monthly & Daily Period Attendance',
      shortTitle: 'Attendance',
      purpose:
        'Track your monthly attendance percentage and review daily period-by-period statuses.',
      voiceScript:
        'Third, Attendance Status. Pick any month between June and May to view total working days, days present, and your attendance percentage, along with today’s period-by-period attendance status.',
      icon: CalendarClock,
      hotspots: [
        {
          id: 's3-h1',
          stepNumber: 1,
          buttonLabel: 'Month Selector',
          title: 'Academic Year Months',
          action:
            'Switch between months from June to May to review monthly records.',
          tone: 'lime',
          xPercent: 72,
          yPercent: 28,
        },
        {
          id: 's3-h2',
          stepNumber: 2,
          buttonLabel: 'Attendance Ring',
          title: 'Overall Percentage',
          action:
            'See your live attendance percentage and working day breakdown.',
          tone: 'cyan',
          xPercent: 30,
          yPercent: 56,
        },
        {
          id: 's3-h3',
          stepNumber: 3,
          buttonLabel: 'Daily Periods',
          title: 'Period-by-Period Log',
          action:
            'Check your Present, Absent, or Leave mark for each daily period.',
          tone: 'amber',
          xPercent: 70,
          yPercent: 74,
        },
      ],
    },
    {
      id: 'student-leave',
      chapterNumber: 4,
      badge: '4. Leave • History',
      title: 'Leave Register & Return History',
      shortTitle: 'Leave',
      purpose:
        'View your leave balance and complete departure and campus return history.',
      voiceScript:
        'Fourth, the Leave Register. Review every home leave recorded by your Class Usthad along with departure dates, reasons, and verified campus return times.',
      icon: FileText,
      hotspots: [
        {
          id: 's4-h1',
          stepNumber: 1,
          buttonLabel: 'Leave Summary',
          title: 'Status & Total Days',
          action:
            'See your current campus status and total leave days taken this year.',
          tone: 'lime',
          xPercent: 30,
          yPercent: 45,
        },
        {
          id: 's4-h2',
          stepNumber: 2,
          buttonLabel: 'Leave History',
          title: 'Departure & Return Logs',
          action:
            'Inspect dates, times, reasons, and verified campus return records.',
          tone: 'cyan',
          xPercent: 72,
          yPercent: 60,
        },
      ],
    },
    {
      id: 'student-messenger',
      chapterNumber: 5,
      badge: '5. Chat • Campus Messenger',
      title: 'Campus Messenger',
      shortTitle: 'Messenger',
      purpose:
        'Chat in your official class group and with Usthads and classmates using text, PDFs, and voice notes.',
      voiceScript:
        'Fifth, Campus Messenger. Stay connected with your class group, Usthads, and classmates. Download study PDFs, listen to voice notes, and customise wallpaper and font size in Chat Settings.',
      icon: MessageCircle,
      hotspots: [
        {
          id: 's5-h1',
          stepNumber: 1,
          buttonLabel: 'Groups & Usthads',
          title: 'Quick Filters',
          action:
            'Filter conversations by All Chats, Class Groups, Usthads, or Students.',
          tone: 'lime',
          xPercent: 28,
          yPercent: 32,
        },
        {
          id: 's5-h2',
          stepNumber: 2,
          buttonLabel: 'Files & Voice',
          title: 'Media & Voice Notes',
          action:
            'Attach study PDFs or images and record voice messages cleanly.',
          tone: 'cyan',
          xPercent: 52,
          yPercent: 76,
        },
        {
          id: 's5-h3',
          stepNumber: 3,
          buttonLabel: 'Chat Settings',
          title: 'Customise Chat',
          action:
            'Adjust online visibility, read receipts, text size, and wallpaper.',
          tone: 'amber',
          xPercent: 86,
          yPercent: 26,
        },
      ],
    },
    {
      id: 'student-ai-library',
      chapterNumber: 6,
      badge: '6. AI, Library & Results',
      title: 'AI Study Chatbot, Library & Exam Results',
      shortTitle: 'AI & Library',
      purpose:
        'Study kitabs with the AI Chatbot, browse the Library & Digital Kitabs, check timetables, and open Exam Results.',
      voiceScript:
        'Sixth, the AI Study Chatbot and Library. Ask kitab or academic questions in English, Arabic, or Malayalam, upload photos of kitab pages for translation and grammar help, and save Study Note PDFs. Open the Library tab for books, Digital Kitabs, timetables, and exam results.',
      icon: Sparkles,
      hotspots: [
        {
          id: 's6-h1',
          stepNumber: 1,
          buttonLabel: 'Language & Role',
          title: 'Choose Mentor & Language',
          action:
            'Pick Usthad Kitab Mentor, Academic Tutor, or Language Coach in your preferred language.',
          tone: 'lime',
          xPercent: 26,
          yPercent: 28,
        },
        {
          id: 's6-h2',
          stepNumber: 2,
          buttonLabel: 'Photo & Voice',
          title: 'Scan Kitab Pages',
          action:
            'Upload a kitab page photo or speak into the mic for clear explanations.',
          tone: 'cyan',
          xPercent: 48,
          yPercent: 74,
        },
        {
          id: 's6-h3',
          stepNumber: 3,
          buttonLabel: 'Study Note PDF',
          title: 'Export Notes',
          action:
            'Download any AI explanation as a clean formatted Study Note PDF.',
          tone: 'amber',
          xPercent: 78,
          yPercent: 52,
        },
        {
          id: 's6-h4',
          stepNumber: 4,
          buttonLabel: 'Library & Results',
          title: 'Books, Kitabs & Portal',
          action:
            'Browse library books, read Digital Kitabs, view timetables, and check results.',
          tone: 'lime',
          xPercent: 80,
          yPercent: 76,
        },
      ],
    },
  ],
}

const ROLE_LABELS: Record<GuideRole, string> = {
  principal: 'Principal',
  usthad: 'Usthad',
  'class-leader': 'Class Leader',
  student: 'Student',
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

    let dataOffset = 44
    for (let i = 12; i < Math.min(bytes.length - 8, 200); i++) {
      if (
        bytes[i] === 0x64 &&
        bytes[i + 1] === 0x61 &&
        bytes[i + 2] === 0x74 &&
        bytes[i + 3] === 0x61
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
        <span>App Video Guide</span>
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
        text: chapter.voiceScript,
        language: 'en',
        voiceName: 'Orbit',
      })

      const nextChapter = roleChapters[targetIdx + 1]
      if (nextChapter) {
        void fetchTtsSpeechAudio({
          text: nextChapter.voiceScript,
          language: 'en',
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
          // Fall through to HTMLAudioElement
        }

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

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel()
          const utterance = new SpeechSynthesisUtterance(chapter.voiceScript)
          utterance.lang = 'en-IN'
          utterance.pitch = 0.92
          utterance.rate = 0.98
          const voices = window.speechSynthesis.getVoices()
          const indianVoice = voices.find((v) =>
            v.lang.toLowerCase().startsWith('en-in'),
          )
          if (indianVoice) {
            utterance.voice = indianVoice
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
        aria-label="ICS Academy Interactive App Guide"
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
                    Interactive Guide
                  </span>
                  {isPlaying && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                      Playing
                    </span>
                  )}
                </div>
                <h2 className="truncate font-display text-base font-bold text-foreground sm:text-lg">
                  ICS Academy — App Video Guide
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
                    <span>{ROLE_LABELS[r]}</span>
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
                    {ch.chapterNumber}. {ch.shortTitle}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Interactive Screen Simulator Frame */}
          <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-black via-[#0B1014] to-[#0B1014] p-4 text-white shadow-xl sm:p-5">
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
                    {currentChapter.title}
                  </h3>
                </div>
              </div>

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
                  <span>{isPlaying ? 'Pause' : 'Play Audio'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void startChapterNarration(activeRole, chapterIndex)}
                  title="Replay Voice"
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

            {/* Interactive Hotspots */}
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
                          <span>Active</span>
                        </span>
                      )}
                    </div>

                    <div className="mt-1">
                      <p className="text-sm font-bold text-white">
                        {spot.title}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-200">
                        {spot.action}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Progress Bar */}
            <div className="mt-4 flex flex-col gap-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  style={{ width: `${progressPercent}%` }}
                  className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] via-[#4F46E5] to-[#0095F6] transition-all duration-300"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span>
                  Now Showing:{' '}
                  <strong className="text-[#60B6FF]">
                    Step {currentHotspot.stepNumber} — {currentHotspot.title}
                  </strong>
                </span>
                <span>
                  Chapter {chapterIndex + 1} / {chapters.length}
                </span>
              </div>
            </div>
          </div>

          {/* Transcript & Purpose Card */}
          <div className="rounded-2xl bg-muted/45 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0077CC] dark:text-[#0095F6]">
                  Audio Transcript &amp; Summary
                </span>
                <h4 className="mt-0.5 text-base font-bold text-foreground">
                  {currentChapter.title}
                </h4>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-muted-foreground">
                <input
                  type="checkbox"
                  checked={autoAdvanceChapters}
                  onChange={(e) => setAutoAdvanceChapters(e.target.checked)}
                  className="size-4 accent-[#0095F6]"
                />
                <span>Auto-Play Next</span>
              </label>
            </div>

            <div className="mt-3 space-y-2.5 text-xs leading-relaxed sm:text-sm">
              <p className="rounded-2xl bg-[#0095F6]/10 p-3 font-medium text-foreground">
                <strong className="text-[#0077CC] dark:text-[#0095F6]">
                  Overview:{' '}
                </strong>
                {currentChapter.purpose}
              </p>

              <p className="rounded-2xl bg-card/80 p-3.5 leading-6 text-foreground/90">
                <strong className="text-[#7C3AED] dark:text-[#A78BFA]">
                  Narration:{' '}
                </strong>
                {currentChapter.voiceScript}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Navigation Footer */}
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
            <span>Previous</span>
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
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Volume2 className="size-4" aria-hidden="true" />
                  <span>Play</span>
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
                <span>Next</span>
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
                <span>Done</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
