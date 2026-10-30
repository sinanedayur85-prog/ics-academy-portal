import 'dotenv/config'
import express from 'express'
import { createServer as createHttpServer } from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import { createServer as createViteServer } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getAiClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  })
}

type StudyMode = 'kitab' | 'qa' | 'translation' | 'dawa'
type OutputLanguage = 'ml' | 'en' | 'ar'
type ChatRole = 'usthad' | 'academic' | 'language' | 'campus'
type ChatModelTier = 'flash' | 'flash-lite'

interface ClientChatTurn {
  role: 'user' | 'model'
  text: string
}

function buildSystemInstruction(mode: StudyMode, language: OutputLanguage, studentName?: string) {
  const languageLabel =
    language === 'ml'
      ? 'Malayalam (മലയാളം, with clear Arabic terms/quotes where appropriate)'
      : language === 'ar'
        ? 'Classical & Modern Standard Arabic (العربية الفصحى with clear vocalization where helpful)'
        : 'English (with transliterated and Arabic script terms where appropriate)'

  const modeDirectives: Record<StudyMode, string> = {
    kitab: `You are in "Kitab & Ibarat Explainer" mode for ICS Academy Manhappatta (Da'wa College).
When a student provides an Arabic passage (Ibarat) or topic from classical Islamic texts (such as Fathul Mueen, Mahalli, Tafsir Jalalayn, Riyad as-Salihin, Alfiyyah Ibn Malik, Qatr al-Nada, etc.):
1. Provide the full vocalized Arabic text (with Harakat / Tashkeel) if applicable.
2. Give a clear word-by-word or phrase-by-phrase meaning.
3. Explain the grammatical structure (Nahw / Sarf / I'rab) of key words concisely.
4. Provide a comprehensive scholarly commentary (Sharh) and practical Fiqh/academic takeaway.`,
    qa: `You are in "Islamic & Academic Subject Q&A" mode for ICS Academy Manhappatta (Da'wa College).
Provide accurate, well-structured scholarly answers covering Fiqh (especially Shafi'i jurisprudence alongside comparative context when asked), Hadith sciences, Tafsir, Aqeedah, Islamic History, or modern academic subjects (Humanities, Science, English, Commerce).
Structure your answer with clear headings, key concepts, authentic references, and a concise summary for exam preparation.`,
    translation: `You are in "Trilingual Scholarly Translator" mode (Arabic ↔ Malayalam ↔ English) for ICS Academy Manhappatta.
For the student's input text:
1. Provide a natural, accurate scholarly translation in the requested target language.
2. Include parallel versions in Malayalam, Arabic (with vocalization for key phrases), and English so the student can compare nuances.
3. List 3-5 important vocabulary terms (Mufradat) with their root letters and meanings.`,
    dawa: `You are in "Da'wa Speech & Article Outliner" mode for ICS Academy Manhappatta students.
Create an inspiring, well-researched speech or essay outline on the requested topic:
1. Compelling Title & Opening Hook (with an appropriate Quranic verse or Prophetic Hadith in Arabic script + meaning).
2. 3-4 Core Arguments / Thematic Points with historical or contemporary context.
3. Practical Moral & Social Application for modern youth and society.
4. Memorable Conclusion & Du'a.`,
  }

  return `You are the official AI Study & Kitab Research Assistant for ICS Academy (Da'wa College).
Student Name: ${studentName || "Da'wa College Scholar"}
Primary Output Language: ${languageLabel}

${modeDirectives[mode] || modeDirectives.kitab}

Formatting Rules:
- Use clean, readable sections with clear numbered or bulleted points.
- Whenever using Islamic greetings (such as Assalamu Alaikum or Wa Alaikum Assalam), ALWAYS write them in Arabic script (e.g., السَّلَامُ عَلَيْكُمْ or وَعَلَيْكُمُ السَّلَامُ) and NEVER transliterate them in Malayalam script ("അസ്സലാമു അലൈക്കും").
- When referring to the institution in Malayalam, say "ഐ.സി.എസ് അക്കാദമി" or "ഐ.സി.എസ് അക്കാദമിയുടെ" (never add "മഞ്ഞപ്പറ്റയുടെ").
- Whenever quoting Quranic verses, Hadith, or classical Kitab phrases, write the Arabic text accurately and provide its meaning in ${languageLabel}.
- Keep the tone respectful, scholarly, encouraging, and pedagogically clear.`
}

function buildChatbotSystemInstruction(
  role: ChatRole,
  language: OutputLanguage,
  studentName?: string,
  studentClass?: string,
): string {
  const languageDirective =
    language === 'ml'
      ? 'Respond primarily in natural, scholarly Malayalam (മലയാളം), including accurate vocalized Arabic script for Quranic verses, Hadith, Islamic greetings (always write السَّلَامُ عَلَيْكُمْ / وَعَلَيْكُمُ السَّلَامُ in Arabic script, never in Malayalam script), and Kitab terms.'
      : language === 'ar'
        ? 'Respond primarily in clear Classical/Modern Standard Arabic (العربية الفصحى) with helpful vocalization (Tashkeel) and brief Malayalam/English clarifications where helpful.'
        : 'Respond primarily in clear academic English, weaving in accurate Arabic script and Malayalam terms where helpful.'

  const rolePersonas: Record<ChatRole, string> = {
    usthad: `Role: Usthad Kitab & Fiqh Mentor (കിതാബ് & ഫിഖ്ഹ് ഗുരു) at ICS Academy (Da'wa College).
You engage in multi-turn scholarly dialogue on classical Kitabs (Fathul Mueen, Mahalli, Tafsir Jalalayn, Riyad as-Salihin, Alfiyyah Ibn Malik), Usul al-Fiqh, Nahw/Sarf, and Shafi'i jurisprudence.
Break down complex Ibarats step by step, remember earlier questions in the conversation, and ask thoughtful follow-up reflection questions to deepen the student's mastery.`,
    academic: `Role: Academic & Exam Tutor (പരീക്ഷാ & അക്കാദമിക് ഗൈഡ്) at ICS Academy.
You help Da'wa College students master integrated Islamic and modern academic subjects (Humanities, Commerce, History, English, Sociology, Islamic History).
Provide structured exam-ready points, memory aids, timelines, and multi-turn revision quizzes based on the ongoing conversation.`,
    language: `Role: Trilingual Arabic-Malayalam-English Coach (ത്രിഭാഷാ പരിശീലകൻ) at ICS Academy.
You coach students in Arabic conversation (Muhadathah), academic English writing, and Malayalam-Arabic-English translation.
Correct grammar gently, highlight root letters (Maddah) and vocabulary (Mufradat), and encourage the student to reply in the target language.`,
    campus: `Role: Campus & Da'wa Advisor (ക്യാമ്പസ് & ദഅ്‌വ സഹായി) at ICS Academy.
You guide students on Da'wa speech preparation (Khutbah/elocution), essay writing, study timetables, Digital Library Kitab recommendations, and holistic spiritual-academic routines.`,
  }

  return `You are the official Multi-Turn Gemini Chatbot for ICS Academy (Da'wa College).
Student: ${studentName || "Da'wa College Scholar"}${studentClass ? ` (Class ${studentClass})` : ''}
${rolePersonas[role] || rolePersonas.usthad}

Language Instruction:
- ${languageDirective}
- CRITICAL RULE: Never write "അസ്സലാമു അലൈക്കും" or "വഅലൈക്കുമുസ്സലാം" in Malayalam letters. Always write Islamic greetings in Arabic script: "السَّلَامُ عَلَيْكُمْ" or "وَعَلَيْكُمُ السَّلَامُ".
- CRITICAL RULE: In Malayalam, refer to the academy simply as "ഐ.സി.എസ് അക്കാദമി" or "ഐ.സി.എസ് അക്കാദമിയുടെ" (do not say "ഐ.സി.എസ് അക്കാദമി മഞ്ഞപ്പറ്റയുടെ").

Conversation Guidelines:
- Maintain continuity with previous messages in the thread.
- Keep answers clear, well-structured with bullet points or numbered steps when appropriate, and supportive.`
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`TIMEOUT: ${label} exceeded ${timeoutMs}ms`))
    }, timeoutMs)

    promise
      .then((val) => {
        clearTimeout(timer)
        resolve(val)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

function isTransientOrTimeoutError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    msg.includes('TIMEOUT:') ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('overloaded') ||
    msg.includes('fetch failed')
  )
}

async function generateWithFallback(
  contents: string,
  systemInstruction: string,
): Promise<string> {
  const models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'] as const
  let lastError: unknown = null

  for (const modelName of models) {
    try {
      const ai = getAiClient()
      const response = await withTimeout(
        ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            ...(modelName === 'gemini-3.8-flash'
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          },
        }),
        modelName === 'gemini-3.8-flash' ? 6000 : 12000,
        modelName,
      )
      if (response.text) {
        return response.text
      }
    } catch (err) {
      lastError = err
      if (isTransientOrTimeoutError(err)) {
        console.warn(`Model ${modelName} slow/busy, falling back to next available model...`)
        continue
      }
      throw err
    }
  }

  throw lastError ?? new Error('All study assistant models are currently busy.')
}

async function sendMultiTurnChatWithFallback(
  message: string,
  history: ClientChatTurn[],
  systemInstruction: string,
  preferredTier: ChatModelTier,
): Promise<{ reply: string; modelUsed: string }> {
  const modelOrder =
    preferredTier === 'flash-lite'
      ? (['gemini-3.1-flash-lite', 'gemini-3.8-flash'] as const)
      : (['gemini-3.8-flash', 'gemini-3.1-flash-lite'] as const)

  const formattedHistory = history
    .filter((turn) => turn && typeof turn.text === 'string' && turn.text.trim().length > 0)
    .slice(-24)
    .map((turn) => ({
      role: turn.role === 'model' ? ('model' as const) : ('user' as const),
      parts: [{ text: turn.text.trim().slice(0, 4000) }],
    }))

  let lastError: unknown = null

  for (const modelName of modelOrder) {
    try {
      const ai = getAiClient()
      const chat = ai.chats.create({
        model: modelName,
        history: formattedHistory,
        config: {
          systemInstruction,
          ...(modelName === 'gemini-3.8-flash'
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
        },
      })

      const response = await withTimeout(
        chat.sendMessage({ message }),
        modelName === 'gemini-3.8-flash' ? 6000 : 12000,
        modelName,
      )

      if (response.text) {
        return {
          reply: response.text,
          modelUsed: modelName,
        }
      }
    } catch (err) {
      lastError = err
      if (isTransientOrTimeoutError(err)) {
        console.warn(`Chat model ${modelName} slow/busy, falling back immediately...`)
        continue
      }
      throw err
    }
  }

  throw lastError ?? new Error('All Gemini chat models are currently busy.')
}

async function startServer() {
  const app = express()
  const httpServer = createHttpServer(app)
  const PORT = Number(process.env.PORT) || 3000

  app.use(express.json({ limit: '1mb' }))

  app.post('/api/ai/study-assistant', async (req, res) => {
    try {
      const { prompt, mode = 'kitab', language = 'ml', studentName } = req.body ?? {}

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        res.status(400).json({ error: 'Please enter a question or Kitab passage to analyze.' })
        return
      }

      const trimmedPrompt = prompt.trim().slice(0, 2000)
      const validMode: StudyMode = ['kitab', 'qa', 'translation', 'dawa'].includes(mode)
        ? mode
        : 'kitab'
      const validLanguage: OutputLanguage = ['ml', 'en', 'ar'].includes(language) ? language : 'ml'

      const text = await generateWithFallback(
        trimmedPrompt,
        buildSystemInstruction(validMode, validLanguage, studentName),
      )

      res.json({
        response: text,
        mode: validMode,
        language: validLanguage,
      })
    } catch (error) {
      console.error('Gemini study assistant error:', error)
      if (isTransientOrTimeoutError(error)) {
        res.status(503).json({
          error:
            'AI സെർവറിൽ ഇപ്പോൾ തിരക്ക് കൂടുതലാണ് (High Demand - 503). ദയവായി ഏതാനും നിമിഷങ്ങൾക്ക് ശേഷം വീണ്ടും ശ്രമിക്കുക.',
        })
        return
      }
      const message =
        error instanceof Error ? error.message : 'Failed to generate scholarly response.'
      res.status(500).json({ error: message })
    }
  })

  app.post('/api/ai/chat', async (req, res) => {
    try {
      const {
        message,
        history = [],
        role = 'usthad',
        language = 'ml',
        modelTier = 'flash-lite',
        studentName,
        studentClass,
      } = req.body ?? {}

      if (!message || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ error: 'Please enter a message to send to the chatbot.' })
        return
      }

      const cleanMessage = message.trim().slice(0, 2000)
      const validRole: ChatRole = ['usthad', 'academic', 'language', 'campus'].includes(role)
        ? role
        : 'usthad'
      const validLanguage: OutputLanguage = ['ml', 'en', 'ar'].includes(language) ? language : 'ml'
      const validTier: ChatModelTier = modelTier === 'flash' ? 'flash' : 'flash-lite'
      const safeHistory: ClientChatTurn[] = Array.isArray(history) ? history : []

      const systemInstruction = buildChatbotSystemInstruction(
        validRole,
        validLanguage,
        studentName,
        studentClass,
      )

      const { reply, modelUsed } = await sendMultiTurnChatWithFallback(
        cleanMessage,
        safeHistory,
        systemInstruction,
        validTier,
      )

      res.json({
        reply,
        modelUsed,
        role: validRole,
        language: validLanguage,
      })
    } catch (error) {
      console.error('Gemini multi-turn chat error:', error)
      if (isTransientOrTimeoutError(error)) {
        res.status(503).json({
          error:
            'AI സെർവറിൽ ഇപ്പോൾ തിരക്ക് കൂടുതലാണ് (High Demand - 503). ദയവായി ഏതാനും നിമിഷങ്ങൾക്ക് ശേഷം വീണ്ടും ശ്രമിക്കുക.',
        })
        return
      }
      const errMessage =
        error instanceof Error ? error.message : 'Failed to receive reply from Gemini chatbot.'
      res.status(500).json({ error: errMessage })
    }
  })

  app.post('/api/workspace/export-note-pdf', async (req, res) => {
    try {
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing Google Workspace authorization token.' })
        return
      }

      const {
        title = 'ICS Academy Study Note',
        prompt = '',
        response = '',
        studentName = '',
        studentClass = '',
        personaTitle = "Da'wa College Chatbot",
      } = req.body ?? {}

      if (!response || typeof response !== 'string' || !response.trim()) {
        res.status(400).json({ error: 'Note content is required to create a Google Doc.' })
        return
      }

      const safeTitle = String(title).trim().slice(0, 120) || 'ICS Academy Study Note'

      // 1. Create a new Google Docs document
      const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: safeTitle }),
      })

      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}))
        const errMsg =
          (errData as { error?: { message?: string } })?.error?.message ||
          `Google Docs creation failed (${createRes.status})`
        res.status(createRes.status).json({ error: errMsg })
        return
      }

      const createdDoc = (await createRes.json()) as { documentId: string; title: string }
      const documentId = createdDoc.documentId

      // 2. Insert formatted study note content into the Google Doc via batchUpdate
      const dateStr = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })

      const headerBlock = `ICS ACADEMY — DA'WA COLLEGE STUDY NOTE\n`
      const metaBlock = `Student: ${studentName || 'Student'}${studentClass ? ` | Class: ${studentClass}` : ''} | Date: ${dateStr}\nMentor: ${personaTitle}\n------------------------------------------------------------\n\n`
      const questionBlock = prompt ? `Question / Topic:\n${String(prompt).trim()}\n\n` : ''
      const answerBlock = `Study Note:\n${String(response).trim()}\n`
      const fullBodyText = `${headerBlock}${metaBlock}${questionBlock}${answerBlock}`

      const updateRes = await fetch(
        `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                insertText: {
                  location: { index: 1 },
                  text: fullBodyText,
                },
              },
            ],
          }),
        },
      )

      if (!updateRes.ok) {
        const errData = await updateRes.json().catch(() => ({}))
        const errMsg =
          (errData as { error?: { message?: string } })?.error?.message ||
          `Failed to populate Google Doc (${updateRes.status})`
        res.status(updateRes.status).json({ error: errMsg })
        return
      }

      // 3. Export the Google Doc as a PDF via Google Drive API
      const exportRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(documentId)}/export?mimeType=application/pdf`,
        {
          method: 'GET',
          headers: {
            Authorization: authHeader,
          },
        },
      )

      if (!exportRes.ok) {
        const errText = await exportRes.text().catch(() => '')
        res.status(exportRes.status).json({
          error: `Google Drive PDF export failed (${exportRes.status}): ${errText.slice(0, 200)}`,
          documentId,
          docUrl: `https://docs.google.com/document/d/${documentId}/edit`,
        })
        return
      }

      const pdfBuffer = Buffer.from(await exportRes.arrayBuffer())
      res.json({
        documentId,
        title: safeTitle,
        docUrl: `https://docs.google.com/document/d/${documentId}/edit`,
        pdfBase64: pdfBuffer.toString('base64'),
      })
    } catch (error) {
      console.error('Google Docs PDF export error:', error)
      const message =
        error instanceof Error ? error.message : 'Failed to export study note via Google Docs.'
      res.status(500).json({ error: message })
    }
  })

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distPath = path.join(__dirname, 'dist')
    app.use(express.static(distPath))
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'))
    })
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`ICS Academy server running on http://localhost:${PORT}`)
  })
}

void startServer()
