'use client'

import { useEffect, useMemo, useState } from 'react'
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
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Check,
  Cloud,
  Copy,
  Globe2,
  Loader2,
  Mic2,
  Search,
  Send,
  Sparkles,
  Trash2,
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
  signInWithGoogle,
} from '@/src/lib/firebase'
import { cn } from '@/lib/utils'
import { fetchAiStudyAssistantReply } from '@/lib/ai-chat-client'
import { detectInputLanguage, isUrduText } from '@/components/dashboard/study-note-pdf'

export type StudyMode = 'kitab' | 'qa' | 'translation' | 'dawa'
export type OutputLanguage = 'ml' | 'en' | 'ar' | 'ur' | 'es' | 'de'
export type OutputLanguagePreference = 'auto' | OutputLanguage

export interface SavedStudyNote {
  id: string
  uid: string
  studentId: string
  mode: StudyMode
  language: OutputLanguage
  prompt: string
  response: string
  createdAtMs: number
  syncedToCloud: boolean
}

const MODES: {
  id: StudyMode
  label: string
  malayalamLabel: string
  icon: typeof BookOpen
  placeholder: string
  presets: { title: string; prompt: string }[]
}[] = [
  {
    id: 'kitab',
    label: 'Kitab & Ibarat',
    malayalamLabel: 'Kitab & Ibarat Analysis',
    icon: BookOpen,
    placeholder:
      'Paste an Arabic Ibarat or Kitab passage here (e.g., Fathul Mueen, Mahalli, Jalalayn, Alfiyyah)...',
    presets: [
      {
        title: 'Fathul Mueen — Conditions of Niyyah',
        prompt:
          'Explain the following Ibarat from Fathul Mueen with full Harakat (Tashkeel), word-by-word meaning, Nahw/Sarf breakdown, and Shafi\'i Fiqh commentary: "وَشُرِطَ لِفَرْضِ الصَّوْمِ تَبْيِيتُ النِّيَّةِ وَتَعْيِينُهُ"',
      },
      {
        title: 'Alfiyyah Ibn Malik — Definition of Kalam',
        prompt:
          'Analyze the classic Alfiyyah couplet with I\'rab and grammatical explanation: "كَلَامُنَا لَفْظٌ مُفِيدٌ كَاسْتَقِمْ وَاسْمٌ وَفِعْلٌ ثُمَّ حَرْفٌ الْكَلِمْ"',
      },
      {
        title: 'Tafsir al-Jalalayn — Surah Al-Asr',
        prompt:
          'Provide a scholarly Kitab explanation (Tafsir & I\'rab) of Surah Al-Asr ("وَالْعَصْرِ إِنَّ الْإِنسَانَ لَفِي خُسْرٍ") based on Tafsir al-Jalalayn.',
      },
    ],
  },
  {
    id: 'qa',
    label: 'Subject Q&A',
    malayalamLabel: 'Islamic & Academic Subjects',
    icon: Sparkles,
    placeholder:
      'Ask questions on Fiqh, Hadith, Tafsir, History, or academic subjects...',
    presets: [
      {
        title: 'Shafi\'i Fiqh — Jam\' & Qasr Conditions',
        prompt:
          'What are the key conditions for combining (Jam\') and shortening (Qasr) prayers for a traveler in the Shafi\'i school? Explain in clear exam-ready bullet points.',
      },
      {
        title: 'Usul al-Fiqh — Ijma\' & Qiyas',
        prompt:
          'Explain the definition and pillars (Arkan) of Ijma\' and Qiyas in Usul al-Fiqh with classical examples.',
      },
      {
        title: 'Islamic Scholarly Heritage of Kerala',
        prompt:
          'Analyze the role of the Makhdoom scholars and the Ponnani Dars system in the advancement of Islamic scholarship in Kerala.',
      },
    ],
  },
  {
    id: 'translation',
    label: 'Translator',
    malayalamLabel: 'Arabic · Malayalam · English',
    icon: Globe2,
    placeholder:
      'Enter Arabic, English, or Malayalam sentences to translate...',
    presets: [
      {
        title: 'Hadith Trilingual Translation',
        prompt:
          'Translate and explain key vocabulary (Mufradat) in Arabic and English: "مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ"',
      },
      {
        title: 'English → Classical Arabic (Fusha)',
        prompt:
          'Translate into formal Arabic (Fusha with Harakat) with grammatical and vocabulary notes: "Seeking knowledge and sharing it with society is the noble duty of every scholar."',
      },
    ],
  },
  {
    id: 'dawa',
    label: 'Da\'wa Speech',
    malayalamLabel: 'Speech & Essay Outlines',
    icon: Mic2,
    placeholder:
      'Enter a topic for a Da\'wa speech or article (includes Quran & Hadith references)...',
    presets: [
      {
        title: 'Moral Values in the Digital Age',
        prompt:
          'Prepare a 5-minute speech outline (with Quranic verses and Hadith) on the moral values youth should uphold in the digital era.',
      },
      {
        title: 'Reading & Scholarly Inquiry',
        prompt:
          'Prepare an essay outline on "Reading Completes the Scholar" for the Da\'wa College Literary Association.',
      },
    ],
  },
]

const LANGUAGES: { id: OutputLanguage; label: string }[] = [
  { id: 'ml', label: 'മലയാളം' },
  { id: 'en', label: 'English' },
  { id: 'ar', label: 'العربية' },
  { id: 'ur', label: 'اردو' },
  { id: 'es', label: 'Español' },
  { id: 'de', label: 'Deutsch' },
]

const LOCAL_STORAGE_KEY = 'ics_saved_study_notes_v1'

const DEFAULT_SAMPLE_NOTES: SavedStudyNote[] = [
  {
    id: 'sample-kitab-101',
    uid: 'local',
    studentId: 'st-101',
    mode: 'kitab',
    language: 'en',
    prompt:
      'Explain the Ibarat from Alfiyyah Ibn Malik: "كَلَامُنَا لَفْظٌ مُفِيدٌ كَاسْتَقِمْ وَاسْمٌ وَفِعْلٌ ثُمَّ حَرْفٌ الْكَلِمْ"',
    response:
      '1. Vocalized Text (Ibarat):\nكَلَامُنَا لَفْظٌ مُفِيدٌ كَاسْتَقِمْ — وَاسْمٌ وَفِعْلٌ ثُمَّ حَرْفٌ الْكَلِمْ\n\n2. Word-by-Word Meaning:\n• كَلَامُنَا (Our speech in the terminology of Nahw)\n• لَفْظٌ مُفِيدٌ (is a beneficial utterance that conveys a complete meaning)\n• كَاسْتَقِمْ (like "Istaqim" — "Be steadfast!")\n• الْكَلِمْ (And words are of three types): اسْمٌ (Noun / Ism), فِعْلٌ (Verb / Fi\'l), ثُمَّ حَرْفٌ (and Particle / Harf).\n\n3. Grammatical Takeaway (Nahw):\nFor an expression to qualify as Kalam (كَلَام) in Arabic grammar, it must be both a vocalized utterance (لَفْظ) and convey a complete, self-sufficient benefit (إِفَادَة) to the listener.',
    createdAtMs: Date.now() - 3600_000 * 12,
    syncedToCloud: false,
  },
]

function sanitizeId(raw: string) {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120) || `note_${Date.now()}`
}

export function AiStudyAssistant({ student }: { student: Student }) {
  const [mode, setMode] = useState<StudyMode>('kitab')
  const [language, setLanguage] = useState<OutputLanguage>('en')
  const [languagePreference, setLanguagePreference] =
    useState<OutputLanguagePreference>('auto')
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState<string>(DEFAULT_SAMPLE_NOTES[0].response)
  const [lastPrompt, setLastPrompt] = useState<string>(DEFAULT_SAMPLE_NOTES[0].prompt)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  // Firebase Auth & Cloud Notebook State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [cloudNotes, setCloudNotes] = useState<SavedStudyNote[]>([])
  const [localNotes, setLocalNotes] = useState<SavedStudyNote[]>(DEFAULT_SAMPLE_NOTES)
  const [searchQuery, setSearchQuery] = useState('')
  const [modeFilter, setModeFilter] = useState<'all' | StudyMode>('all')
  const [cloudConnected, setCloudConnected] = useState(true)

  const safeStudentId = useMemo(() => sanitizeId(student.id), [student.id])
  const userNotesStorageKey = useMemo(
    () => `${LOCAL_STORAGE_KEY}_${safeStudentId}`,
    [safeStudentId],
  )
  const activeUid = useMemo(
    () => (firebaseUser ? firebaseUser.uid : `portal_${safeStudentId}`),
    [firebaseUser, safeStudentId],
  )

  const currentModeConfig = useMemo(
    () => MODES.find((m) => m.id === mode) ?? MODES[0],
    [mode],
  )

  // Load local fallback notes per student on mount / student switch
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(userNotesStorageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as SavedStudyNote[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLocalNotes(parsed)
          return
        }
      }
      setLocalNotes(DEFAULT_SAMPLE_NOTES)
    } catch {
      setLocalNotes(DEFAULT_SAMPLE_NOTES)
    }
  }, [userNotesStorageKey])

  // Subscribe to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user)
      setAuthReady(true)
    })
    return () => unsubscribe()
  }, [])

  // Subscribe to Firestore /studyNotes for the active student session
  useEffect(() => {
    if (!authReady) return

    const path = 'studyNotes'
    const q = query(
      collection(db, path),
      where('uid', '==', activeUid),
      where('studentId', '==', safeStudentId),
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCloudConnected(true)
        const items: SavedStudyNote[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data()
          const createdAt = data.createdAt as Timestamp | undefined
          return {
            id: docSnap.id,
            uid: String(data.uid ?? activeUid),
            studentId: String(data.studentId ?? safeStudentId),
            mode: (['kitab', 'qa', 'translation', 'dawa'].includes(data.mode)
              ? data.mode
              : 'kitab') as StudyMode,
            language: (['ml', 'en', 'ar', 'ur', 'es', 'de'].includes(data.language)
              ? data.language
              : 'ml') as OutputLanguage,
            prompt: String(data.prompt ?? ''),
            response: String(data.response ?? ''),
            createdAtMs: createdAt?.toMillis ? createdAt.toMillis() : Date.now(),
            syncedToCloud: true,
          }
        })
        items.sort((a, b) => b.createdAtMs - a.createdAtMs)
        setCloudNotes(items)
      },
      (error) => {
        setCloudConnected(false)
        try {
          handleFirestoreError(error, OperationType.LIST, path)
        } catch {
          // Handled and logged by handleFirestoreError
        }
      },
    )

    return () => unsubscribe()
  }, [authReady, activeUid, safeStudentId])

  const allNotes = useMemo(() => {
    const combined = [
      ...cloudNotes,
      ...localNotes.filter((ln) => !cloudNotes.some((cn) => cn.prompt === ln.prompt)),
    ]

    return combined.filter((note) => {
      if (modeFilter !== 'all' && note.mode !== modeFilter) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        note.prompt.toLowerCase().includes(q) || note.response.toLowerCase().includes(q)
      )
    })
  }, [cloudNotes, localNotes, modeFilter, searchQuery])

  async function handleAskAssistant(customPrompt?: string) {
    const activePrompt = (customPrompt ?? (prompt || lastPrompt)).trim()
    if (!activePrompt || loading) return

    setLastPrompt(activePrompt)
    setPrompt('')

    const isAutoLanguage = languagePreference === 'auto'
    const effectiveLanguage: OutputLanguage = isAutoLanguage
      ? detectInputLanguage(activePrompt, language)
      : languagePreference
    if (effectiveLanguage !== language) {
      setLanguage(effectiveLanguage)
    }

    setLoading(true)
    setErrorMessage(null)
    setJustSaved(false)

    try {
      const data = await fetchAiStudyAssistantReply({
        prompt: activePrompt.slice(0, 2000),
        mode,
        language: effectiveLanguage,
        languageMode: isAutoLanguage ? 'auto' : 'explicit',
        studentName: student.name,
      })

      setResponse(data.response)
    } catch (err) {
      const rawMsg =
        err instanceof Error
          ? err.message
          : 'Could not retrieve a response right now. Please try again.'
      setErrorMessage(rawMsg)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveNote() {
    const cleanPrompt = (lastPrompt || prompt).trim().slice(0, 2000)
    const cleanResponse = response.trim().slice(0, 15000)
    if (!cleanPrompt || !cleanResponse) return

    const noteId = sanitizeId(`note_${safeStudentId}_${Date.now()}`)

    const newLocalNote: SavedStudyNote = {
      id: noteId,
      uid: activeUid,
      studentId: safeStudentId,
      mode,
      language,
      prompt: cleanPrompt,
      response: cleanResponse,
      createdAtMs: Date.now(),
      syncedToCloud: true,
    }

    const updatedLocal = [newLocalNote, ...localNotes.filter((n) => n.id !== noteId)]
    setLocalNotes(updatedLocal)
    try {
      window.localStorage.setItem(userNotesStorageKey, JSON.stringify(updatedLocal))
    } catch {
      // Ignore localStorage quota issues
    }

    const path = `studyNotes/${noteId}`
    try {
      await setDoc(doc(db, 'studyNotes', noteId), {
        uid: activeUid,
        studentId: safeStudentId,
        mode,
        language,
        prompt: cleanPrompt,
        response: cleanResponse,
        createdAt: serverTimestamp(),
      })
      setCloudConnected(true)
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, path)
      } catch {
        // Logged by handleFirestoreError; local note remains saved
      }
    }

    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 3000)
  }

  async function handleDeleteNote(note: SavedStudyNote) {
    const nextLocal = localNotes.filter((n) => n.id !== note.id)
    setLocalNotes(nextLocal)
    try {
      window.localStorage.setItem(userNotesStorageKey, JSON.stringify(nextLocal))
    } catch {
      // Ignore localStorage errors
    }

    if (note.syncedToCloud && note.id !== 'sample-kitab-101') {
      const path = `studyNotes/${note.id}`
      try {
        await deleteDoc(doc(db, 'studyNotes', note.id))
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.DELETE, path)
        } catch {
          // Logged by handleFirestoreError
        }
      }
    }
  }

  async function handleConnectCloud() {
    try {
      await signInWithGoogle()
    } catch {
      // In preview iframes where Google popup may be blocked or restricted,
      // fallback seamlessly to the active portal student Firestore session.
      setCloudConnected(true)
    }
  }

  function handleCopyResponse() {
    if (!response) return
    void navigator.clipboard.writeText(response)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Panel
      id="ai-assistant"
      eyebrow={`Da'wa College Digital Scholar · ${student.name}`}
      title="AI Study & Kitab Research Assistant"
      icon={BookOpen}
      className="border-lime/25"
      action={
        <div className="flex items-center gap-2">
          {cloudConnected ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-lime">
              <Cloud className="size-3.5" aria-hidden="true" />
              {firebaseUser?.email
                ? `Cloud Synced (${firebaseUser.email.split('@')[0]})`
                : `Firebase Cloud Synced (${student.admissionNo})`}
            </span>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleConnectCloud()}
              className="h-8 gap-1.5 rounded-lg border-lime/30 bg-lime/10 px-3 text-xs font-semibold text-lime hover:bg-lime hover:text-primary-foreground whitespace-nowrap shrink-0"
            >
              <Cloud className="size-3.5" aria-hidden="true" />
              Reconnect Cloud
            </Button>
          )}
        </div>
      }
    >

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Zone 1: Interactive AI Research & Kitab Stage (3 columns on large screens) */}
        <div className="flex flex-col gap-5 lg:col-span-3">
          {/* 4 Study Mode Tabs */}
          <div
            role="tablist"
            aria-label="Study research modes"
            className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-background/60 p-1.5 sm:grid-cols-4"
          >
            {MODES.map((m) => {
              const active = mode === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    'flex flex-col items-start justify-center rounded-lg px-3 py-2 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-lime',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
                    <m.icon className="size-3.5 shrink-0" aria-hidden="true" />
                    {m.label}
                  </span>
                  <span
                    className={cn(
                      'mt-0.5 truncate text-[10px] w-full',
                      active ? 'text-primary-foreground/85' : 'text-muted-foreground/80',
                    )}
                  >
                    {m.malayalamLabel}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Language Selection & Quick Presets */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="ai-output-language" className="text-xs text-muted-foreground whitespace-nowrap">
                Output Language:
              </Label>
              <div
                id="ai-output-language"
                role="group"
                aria-label="Output language"
                className="inline-flex flex-wrap rounded-lg border border-border bg-background/60 p-0.5"
              >
                <button
                  type="button"
                  onClick={() => setLanguagePreference('auto')}
                  title="Reply in the language you ask"
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0',
                    languagePreference === 'auto'
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
                    onClick={() => {
                      const nextPref: OutputLanguagePreference =
                        languagePreference === lang.id ? 'auto' : lang.id
                      setLanguagePreference(nextPref)
                      setLanguage(lang.id)
                    }}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0',
                      languagePreference === lang.id
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {prompt.length} / 2000 chars
            </span>
          </div>

          {/* Curated Da'wa College Quick Prompts */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Quick Study Topics:
            </span>
            <div className="flex flex-wrap gap-2">
              {currentModeConfig.presets.map((preset) => (
                <button
                  key={preset.title}
                  type="button"
                  onClick={() => void handleAskAssistant(preset.prompt)}
                  disabled={loading}
                  className="rounded-lg border border-border bg-background/70 px-3 py-1.5 text-left text-xs font-medium text-foreground/90 transition-colors hover:border-lime/50 hover:bg-lime/10 hover:text-foreground disabled:opacity-50"
                >
                  {preset.title}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleAskAssistant()
            }}
            className="flex flex-col gap-3"
          >
            <Label htmlFor="kitab-prompt-input" className="sr-only">
              Study question or Kitab passage
            </Label>
            <textarea
              id="kitab-prompt-input"
              rows={4}
              maxLength={2000}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={currentModeConfig.placeholder}
              className={cn(
                fieldClassName,
                'h-auto min-h-28 resize-y py-3 text-sm leading-relaxed',
              )}
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPrompt('')}
                disabled={!prompt || loading}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                Clear input
              </button>

              <Button
                type="submit"
                disabled={loading || !prompt.trim()}
                className="h-10 gap-2 rounded-full px-6 font-semibold whitespace-nowrap shrink-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Analyzing Kitab...
                  </>
                ) : (
                  <>
                    <Send className="size-4" aria-hidden="true" />
                    Ask Study Assistant
                  </>
                )}
              </Button>
            </div>
          </form>

          {errorMessage ? (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive"
            >
              <span>{errorMessage}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleAskAssistant()}
                disabled={loading || !prompt.trim()}
                className="h-7 rounded-lg border-destructive/40 px-3 text-xs text-destructive hover:bg-destructive/20 whitespace-nowrap shrink-0"
              >
                Retry
              </Button>
            </div>
          ) : null}

          {/* Scholarly Response Output Box */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-lime">
                  Scholarly Explanation & Study Notes
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {lastPrompt || 'Select a topic or ask a question above'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyResponse}
                  disabled={!response || loading}
                  className="h-8 gap-1.5 rounded-lg px-2.5 text-xs whitespace-nowrap shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5 text-lime" aria-hidden="true" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" aria-hidden="true" />
                      Copy
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleSaveNote()}
                  disabled={!response || loading}
                  className="h-8 gap-1.5 rounded-lg px-3 text-xs font-semibold whitespace-nowrap shrink-0"
                >
                  {justSaved ? (
                    <>
                      <BookmarkCheck className="size-3.5" aria-hidden="true" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Bookmark className="size-3.5" aria-hidden="true" />
                      Save to Notebook
                    </>
                  )}
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col gap-2.5 py-6">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto pr-1 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {response}
              </div>
            )}
          </div>
        </div>

        {/* Zone 2: Saved Cloud Notebook & Reference Deck (2 columns on large screens) */}
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-background/40 p-4 md:p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-semibold text-foreground">
                Saved Study Notebook
              </h3>
              <p className="text-xs text-muted-foreground">
                {cloudConnected
                  ? 'Synced live with Firebase Cloud Firestore'
                  : 'Saved in session · Reconnecting to Cloud Firestore'}
              </p>
            </div>
            <span className="font-mono text-xs font-semibold tabular-nums text-lime">
              {allNotes.length} {allNotes.length === 1 ? 'note' : 'notes'}
            </span>
          </div>

          {/* Search & Mode Filter */}
          <div className="flex flex-col gap-2.5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search saved Kitab notes..."
                aria-label="Search saved study notes"
                className={cn(fieldClassName, 'h-9 pl-8 text-xs')}
              />
            </div>

            <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-background/60 p-1">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'kitab', label: 'Kitab' },
                  { id: 'qa', label: 'Q&A' },
                  { id: 'translation', label: 'Translate' },
                  { id: 'dawa', label: "Da'wa" },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setModeFilter(item.id)}
                  className={cn(
                    'flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0',
                    modeFilter === item.id
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes List */}
          {allNotes.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <Bookmark className="size-6 text-muted-foreground/60" aria-hidden="true" />
              <p className="mt-2 text-xs font-medium text-foreground">
                No saved study notes match your filter
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ask a question on the left and click &ldquo;Save to Notebook&rdquo; to store your research.
              </p>
            </div>
          ) : (
            <ul className="flex max-h-[460px] flex-col gap-3 overflow-y-auto pr-1">
              {allNotes.map((note) => (
                <li
                  key={note.id}
                  className="group flex flex-col gap-2 rounded-xl border border-border bg-card/80 p-3.5 transition-colors hover:border-lime/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="font-semibold uppercase text-lime">
                        {note.mode}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{note.language.toUpperCase()}</span>
                      <span aria-hidden="true">·</span>
                      <span>{note.syncedToCloud ? 'Cloud' : 'Local'}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleDeleteNote(note)}
                      aria-label="Delete saved note"
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <p className="line-clamp-2 text-xs font-semibold text-foreground">
                    {note.prompt}
                  </p>
                  <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                    {note.response}
                  </p>

                  <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-2">
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {new Date(note.createdAtMs).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMode(note.mode)
                        setLanguage(note.language)
                        setPrompt(note.prompt)
                        setLastPrompt(note.prompt)
                        setResponse(note.response)
                      }}
                      className="text-xs font-semibold text-lime transition-colors hover:underline whitespace-nowrap shrink-0"
                    >
                      Open in Reader →
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  )
}
