import * as React from 'react'
import { jsPDF } from 'jspdf'
import { toCanvas } from 'html-to-image'
import type { Student } from '@/components/dashboard/data'
import { downloadBlobOnDevice, printPdfBlobOnDevice } from '@/lib/mobile-pdf'

export interface StudyNoteExportData {
  msgId: string
  prompt: string
  response: string
  personaTitle: string
}

export function isUrduText(text: string): boolean {
  if (!text) return false
  // If the text contains Malayalam script, it is not Urdu text
  if (/[\u0D00-\u0D7F]{2,}/.test(text)) return false
  // Match strictly Urdu-specific letters (ٹ پ چ ڈ ڑ ژ گ ں ھ ہ ۂ ۃ ے ۔) or common Urdu words
  return (
    /[\u0679\u067E\u0686\u0688\u0691\u0698\u06AF\u06BA\u06BE\u06C1\u06C2\u06C3\u06D2\u06D4]/.test(text) ||
    /(?:^|\s)(?:کیا|کیوں|کیسے|ہے|ہیں|میں|کو|سے|پر|اور|کا|کی|کے)(?:\s|$|[۔،؟!])/.test(text)
  )
}

export function isUrduLine(line: string): boolean {
  if (!line) return false
  if (/[\u0D00-\u0D7F]{2,}/.test(line)) return false
  return (
    /[\u0679\u067E\u0686\u0688\u0691\u0698\u06AF\u06BA\u06BE\u06C1\u06C2\u06C3\u06D2\u06D4]/.test(line) ||
    /(?:^|\s)(?:کیا|کیوں|کیسے|ہے|ہیں|میں|کو|سے|پر|اور|کا|کی|کے)(?:\s|$|[۔،؟!])/.test(line)
  )
}

export function detectInputLanguage<T extends 'ml' | 'en' | 'ar' | 'ur' | 'es' | 'de'>(
  text: string,
  fallbackLanguage: T,
  history?: { role: 'user' | 'model'; text: string }[],
): T {
  if (!text || !text.trim()) return fallbackLanguage
  const clean = text.trim()

  // 1. If the user writes any Malayalam characters, always respond in Malayalam ('ml')
  if (/[\u0D00-\u0D7F]/.test(clean)) {
    return 'ml' as T
  }

  // 2. If the user writes Urdu-specific script/words, respond in Urdu ('ur')
  if (isUrduText(clean)) {
    return 'ur' as T
  }

  // 3. Check Arabic vs Latin character counts (ignoring quoted Arabic passages and standalone Salam greetings)
  const stripped = clean
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(
      /(?:^|\s)(?:وعليكم\s+السلام|السلام\s+عليكم|سلام\s+عليكم|ورحمة\s+الله|وبركاته|بسم\s+الله\s+الرحمن\s+الرحيم)(?=\s|$|[،.؟!])/g,
      ' ',
    )
    .trim()
  const withoutQuotes = stripped
    .replace(/["“”«»'‘’][^"“”«»'‘’]{4,}["“”«»'‘’]/g, ' ')
    .trim()
  const targetForScriptCheck = withoutQuotes.length >= 4 ? withoutQuotes : stripped

  const arabicChars = (
    targetForScriptCheck.match(
      /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g,
    ) || []
  ).length
  const latinChars = (targetForScriptCheck.match(/[A-Za-z\u00C0-\u024F]/g) || []).length

  if (arabicChars > 0 && arabicChars > latinChars) {
    // If the student types an Arabic sentence/answer during an ongoing Malayalam/Urdu/English lesson
    // (e.g. answering an Arabic translation question asked by the Usthad in Malayalam),
    // preserve the ongoing conversation language rather than abruptly switching the explanation to Arabic.
    if (history && history.length > 0) {
      const recentTurns = history.slice(-4)
      for (let i = recentTurns.length - 1; i >= 0; i--) {
        const turnText = recentTurns[i]?.text || ''
        if (/[\u0D00-\u0D7F]{3,}/.test(turnText)) {
          return 'ml' as T
        }
        if (isUrduText(turnText)) {
          return 'ur' as T
        }
        const turnLatin = (turnText.match(/[A-Za-z\u00C0-\u024F]/g) || []).length
        const turnArabic = (
          turnText.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) ||
          []
        ).length
        if (turnLatin >= 12 && turnLatin > turnArabic * 2) {
          if (fallbackLanguage === 'es' || fallbackLanguage === 'de' || fallbackLanguage === 'en') {
            return fallbackLanguage
          }
          return 'en' as T
        }
      }
    }
    return 'ar' as T
  }

  // 4. If written in Latin script (English / Spanish / German / Manglish)
  const totalLatinChars = (stripped.match(/[A-Za-z\u00C0-\u024F]/g) || []).length
  if (totalLatinChars >= 2) {
    if (
      /\b(enthanu|enthokkeyanu|enthokke|parayamo|parayu|engane|enganeyanu|vishadeekarikamo|vishadeekarikkuka|artham|sharthukal|farzukal|sunnathukal|vivarikkuka|entha|manassilayilla|padippikkamo|chodyam|utharam)\b/i.test(
        clean,
      )
    ) {
      return 'ml' as T
    }
    if (
      /[¿¡ñÑáéíóúÁÉÍÓÚ]/.test(clean) ||
      /\b(qué|cómo|cuál|cuáles|explica|explicar|según|por\s+favor|hola|gracias|condiciones|diferencia)\b/i.test(
        clean,
      )
    ) {
      return 'es' as T
    }
    if (
      /[äöüßÄÖÜ]/.test(clean) ||
      /\b(erkläre|erklären|gemäß|was\s+ist|wie\s+sind|bitte|danke|bedingungen|unterschied)\b/i.test(
        clean,
      )
    ) {
      return 'de' as T
    }
    return 'en' as T
  }

  return fallbackLanguage
}

export function renderPrintScriptRuns(text: string, keyPrefix: string): React.ReactNode {
  const scriptRegex =
    /([\u0D00-\u0D7F\u200C\u200D]+|[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)/g
  const parts = text.split(scriptRegex)
  if (parts.length <= 1) return text

  return parts.map((part, idx) => {
    if (!part) return null
    if (/[\u0D00-\u0D7F]/.test(part)) {
      return (
        <span
          key={`${keyPrefix}-ml-${idx}`}
          style={{ fontFamily: "'Noto Serif Malayalam', Georgia, serif" }}
        >
          {part}
        </span>
      )
    }
    if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(part)) {
      const partIsUrdu = isUrduText(part)
      return (
        <span
          key={`${keyPrefix}-ar-${idx}`}
          dir="rtl"
          style={{
            fontFamily: partIsUrdu
              ? "'Noto Nastaliq Urdu', 'Tajawal', serif"
              : "'Tajawal', 'Noto Sans Arabic', sans-serif",
            fontWeight: 600,
            display: 'inline-block',
            margin: '0 2px',
            fontSize: partIsUrdu ? '1.08em' : '1.08em',
            lineHeight: partIsUrdu ? 2.1 : undefined,
          }}
        >
          {part}
        </span>
      )
    }
    return <React.Fragment key={`${keyPrefix}-tx-${idx}`}>{part}</React.Fragment>
  })
}

export function renderPrintInlineMarkdown(line: string, keyPrefix: string) {
  const tokenRegex =
    /(\*\*\*[\s\S]+?\*\*\*|___[\s\S]+?___|\*\*[\s\S]+?\*\*|__[\s\S]+?__|\*[^\s*](?:[\s\S]*?[^\s*])?\*|_[^\s_](?:[\s\S]*?[^\s_])?_|\`[^\`]+\`)/g

  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        renderPrintScriptRuns(line.slice(lastIndex, match.index), `${keyPrefix}-pre-${match.index}`),
      )
    }

    const token = match[0]
    const k = `${keyPrefix}-t-${match.index}`

    if ((token.startsWith('***') && token.endsWith('***')) || (token.startsWith('___') && token.endsWith('___'))) {
      const inner = token.slice(3, -3)
      nodes.push(
        <strong key={k} style={{ fontWeight: 700, color: '#0f172a' }}>
          <em style={{ fontStyle: 'italic' }}>{renderPrintScriptRuns(inner, k)}</em>
        </strong>,
      )
    } else if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__'))) {
      const inner = token.slice(2, -2)
      nodes.push(
        <strong key={k} style={{ fontWeight: 700, color: '#081e21' }}>
          {renderPrintScriptRuns(inner, `${k}-b`)}
        </strong>,
      )
    } else if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
      const inner = token.slice(1, -1)
      nodes.push(
        <em key={k} style={{ fontStyle: 'italic', color: '#334155' }}>
          {renderPrintScriptRuns(inner, k)}
        </em>,
      )
    } else if (token.startsWith('`') && token.endsWith('`')) {
      const inner = token.slice(1, -1)
      nodes.push(
        <code
          key={k}
          style={{
            borderRadius: '4px',
            backgroundColor: '#f1f5f9',
            padding: '2px 6px',
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#334155',
          }}
        >
          {renderPrintScriptRuns(inner, `${k}-c`)}
        </code>,
      )
    } else {
      nodes.push(renderPrintScriptRuns(token, `${k}-raw`))
    }

    lastIndex = tokenRegex.lastIndex
  }

  if (lastIndex < line.length) {
    nodes.push(renderPrintScriptRuns(line.slice(lastIndex), `${keyPrefix}-end`))
  }

  return nodes.length > 0 ? nodes : renderPrintScriptRuns(line, `${keyPrefix}-full`)
}

export function isArabicText(text: string): boolean {
  if (!text) return false
  if (/[\u0D00-\u0D7F]{2,}/.test(text)) return false
  const stripped = text.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
  const arabicChars = (
    stripped.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []
  ).length
  const ltrChars = (stripped.match(/[A-Za-z\u00C0-\u024F\u0D00-\u0D7F]/g) || []).length
  return arabicChars > 0 && arabicChars > ltrChars
}

export function isArabicLine(line: string): boolean {
  if (!line) return false
  if (/[\u0D00-\u0D7F]{2,}/.test(line)) return false
  const stripped = line.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
  const arabicChars = (
    stripped.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []
  ).length
  const ltrChars = (stripped.match(/[A-Za-z\u00C0-\u024F\u0D00-\u0D7F]/g) || []).length
  if (ltrChars >= 4 && arabicChars <= ltrChars * 1.5) {
    return false
  }
  return arabicChars > 0 && arabicChars > ltrChars
}

export function StudyNotePrintBody({ text }: { text: string }) {
  const lines = text.split('\n')
  const noteIsArabic = isArabicText(text)
  const noteIsUrdu = isUrduText(text) && noteIsArabic

  return (
    <div
      dir={noteIsArabic ? 'rtl' : 'ltr'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        textAlign: noteIsArabic ? 'right' : 'left',
        fontFamily: noteIsUrdu
          ? "'Noto Nastaliq Urdu', 'Tajawal', serif"
          : "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {lines.map((rawLine, idx) => {
        const line = rawLine.trimEnd()
        const key = `print-line-${idx}`

        if (!line.trim()) {
          return <div key={key} style={{ height: '5px' }} />
        }

        if (/^---+$|^\*\*\*+$/.test(line.trim())) {
          return (
            <hr
              key={key}
              style={{
                margin: '8px 0',
                border: 'none',
                borderTop: '1px solid #e2e8f0',
              }}
            />
          )
        }

        const headingMatch = /^(#{1,4})\s+(.+)$/.exec(line.trim())
        if (headingMatch) {
          const level = headingMatch[1].length
          const content = headingMatch[2]
          const isAr = isArabicLine(content)
          const isUr = isAr && (isUrduLine(content) || noteIsUrdu)
          const isMl = /[\u0D00-\u0D7F]/.test(content)
          return (
            <div
              key={key}
              dir={isAr ? 'rtl' : 'ltr'}
              style={{
                marginTop: '8px',
                fontWeight: 700,
                color: level <= 2 ? '#064e3b' : '#047857',
                fontSize: level <= 2 ? '15px' : '13.5px',
                borderBottom: level <= 2 ? '1px solid #d1fae5' : 'none',
                paddingBottom: level <= 2 ? '3px' : '0px',
                textAlign: isAr ? 'right' : 'left',
                direction: isAr ? 'rtl' : 'ltr',
                lineHeight: isUr ? 2.1 : undefined,
                fontFamily: isUr
                  ? "'Noto Nastaliq Urdu', 'Tajawal', serif"
                  : isAr
                    ? "'Tajawal', 'Noto Sans Arabic', sans-serif"
                    : isMl
                      ? "'Noto Serif Malayalam', 'Poppins', sans-serif"
                      : "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              {renderPrintInlineMarkdown(content, key)}
            </div>
          )
        }

        const quoteMatch = /^>\s*(.+)$/.exec(line.trim())
        if (quoteMatch) {
          const isAr = isArabicLine(quoteMatch[1])
          const isUr = isAr && (isUrduLine(quoteMatch[1]) || noteIsUrdu)
          const isMl = /[\u0D00-\u0D7F]/.test(quoteMatch[1])
          return (
            <blockquote
              key={key}
              dir={isAr ? 'rtl' : 'ltr'}
              style={{
                margin: '5px 0',
                borderRadius: isAr ? '8px 0 0 8px' : '0 8px 8px 0',
                borderRight: isAr ? '4px solid #059669' : 'none',
                borderLeft: isAr ? 'none' : '4px solid #059669',
                backgroundColor: '#ecfdf5',
                padding: '6px 12px',
                fontSize: '11.5px',
                fontStyle: isUr ? 'normal' : 'italic',
                lineHeight: isUr ? 2.1 : 1.6,
                color: '#334155',
                textAlign: isAr ? 'right' : 'left',
                direction: isAr ? 'rtl' : 'ltr',
                fontFamily: isUr
                  ? "'Noto Nastaliq Urdu', 'Tajawal', serif"
                  : isAr
                    ? "'Tajawal', 'Noto Sans Arabic', sans-serif"
                    : isMl
                      ? "'Noto Serif Malayalam', 'Poppins', sans-serif"
                      : "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              {renderPrintInlineMarkdown(quoteMatch[1], key)}
            </blockquote>
          )
        }

        const bulletMatch = /^(\s*)([*\-•])\s+(.+)$/.exec(line)
        if (bulletMatch) {
          const isAr = isArabicLine(bulletMatch[3])
          const isUr = isAr && (isUrduLine(bulletMatch[3]) || noteIsUrdu)
          return (
            <div
              key={key}
              dir={isAr ? 'rtl' : 'ltr'}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                paddingRight: isAr ? '4px' : '0px',
                paddingLeft: isAr ? '0px' : '4px',
                textAlign: isAr ? 'right' : 'left',
                direction: isAr ? 'rtl' : 'ltr',
              }}
            >
              <span
                style={{
                  marginTop: '7px',
                  width: '5px',
                  height: '5px',
                  flexShrink: 0,
                  borderRadius: '9999px',
                  backgroundColor: '#047857',
                  display: 'inline-block',
                }}
              />
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  lineHeight: isUr ? 2.1 : 1.6,
                  fontFamily: isUr
                    ? "'Noto Nastaliq Urdu', 'Tajawal', serif"
                    : isAr
                      ? "'Tajawal', 'Noto Sans Arabic', sans-serif"
                      : "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
                }}
              >
                {renderPrintInlineMarkdown(bulletMatch[3], key)}
              </div>
            </div>
          )
        }

        const numberedMatch = /^(\s*)(\d+[.)])\s+(.+)$/.exec(line)
        if (numberedMatch) {
          const isAr = isArabicLine(numberedMatch[3])
          const isUr = isAr && (isUrduLine(numberedMatch[3]) || noteIsUrdu)
          return (
            <div
              key={key}
              dir={isAr ? 'rtl' : 'ltr'}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                paddingRight: isAr ? '2px' : '0px',
                paddingLeft: isAr ? '0px' : '2px',
                textAlign: isAr ? 'right' : 'left',
                direction: isAr ? 'rtl' : 'ltr',
              }}
            >
              <span
                style={{
                  marginTop: '1px',
                  flexShrink: 0,
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: '#065f46',
                }}
              >
                {numberedMatch[2]}
              </span>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  lineHeight: isUr ? 2.1 : 1.6,
                  fontFamily: isUr
                    ? "'Noto Nastaliq Urdu', 'Tajawal', serif"
                    : isAr
                      ? "'Tajawal', 'Noto Sans Arabic', sans-serif"
                      : "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
                }}
              >
                {renderPrintInlineMarkdown(numberedMatch[3], key)}
              </div>
            </div>
          )
        }

        const isAr = isArabicLine(line)
        const isUr = isAr && (isUrduLine(line) || noteIsUrdu)
        return (
          <div
            key={key}
            dir={isAr ? 'rtl' : 'ltr'}
            style={{
              whiteSpace: 'pre-wrap',
              lineHeight: isUr ? 2.1 : 1.6,
              textAlign: isAr ? 'right' : 'left',
              direction: isAr ? 'rtl' : 'ltr',
              fontFamily: isUr
                ? "'Noto Nastaliq Urdu', 'Tajawal', serif"
                : isAr
                  ? "'Tajawal', 'Noto Sans Arabic', sans-serif"
                  : "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >
            {renderPrintInlineMarkdown(line, key)}
          </div>
        )
      })}
    </div>
  )
}

export function StudyNotePrintTemplate({
  note,
  student,
  containerRef,
}: {
  note: StudyNoteExportData | null
  student: Student
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  if (!note) return null

  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '794px',
        height: '0px',
        overflow: 'hidden',
        zIndex: -99999,
        opacity: 0,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      <div ref={containerRef} style={{ width: '794px', backgroundColor: '#ffffff' }}>
        {/* Main Content Section (Printed with 20mm margins on all sides) */}
        <div
          id="ics-study-note-content"
          style={{
            width: '794px',
            backgroundColor: '#ffffff',
            color: '#081e21',
            padding: '0px',
            boxSizing: 'border-box',
            fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          {/* Top Emerald & Cyan Accent Stripe */}
          <div
            style={{
              height: '6px',
              width: '100%',
              borderRadius: '9999px',
              background: 'linear-gradient(90deg, #081e21 0%, #8cc63f 50%, #00aeef 100%)',
            }}
          />

          {/* Header Section */}
          <div
            style={{
              marginTop: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '2px solid #e2e8f0',
              paddingBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <img
                src="/images/ics-mark-transparent.png"
                alt="ICS Academy"
                style={{ width: '56px', height: '56px', objectFit: 'contain' }}
                crossOrigin="anonymous"
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h1
                  style={{
                    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
                    fontSize: '19px',
                    fontWeight: 700,
                    color: '#081e21',
                    margin: 0,
                    lineHeight: 1.25,
                  }}
                >
                  ICS ACADEMY MANHAPPATTA
                </h1>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#064e3b',
                    marginTop: '2px',
                  }}
                >
                  DA'WA COLLEGE · UNIFIED DIGITAL CAMPUS
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#64748b',
                    marginTop: '1px',
                  }}
                >
                  BAHRUL ULOOM ISLAMIC RESEARCH CENTRE
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                textAlign: 'right',
              }}
            >
              <span
                style={{
                  borderRadius: '5px',
                  backgroundColor: '#d1fae5',
                  padding: '3px 10px',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#065f46',
                }}
              >
                Study Note
              </span>
              <span
                style={{
                  marginTop: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#334155',
                }}
              >
                {dateStr}
              </span>
              <span
                style={{
                  fontSize: '9.5px',
                  fontFamily: 'monospace',
                  color: '#94a3b8',
                  marginTop: '1px',
                }}
              >
                REF: ICS-NOTE-{note.msgId.slice(-6)}
              </span>
            </div>
          </div>

          {/* Student & Mentor Details Card */}
          <div
            style={{
              marginTop: '14px',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              padding: '12px 14px',
              fontSize: '11.5px',
            }}
          >
            <div>
              <span
                style={{
                  display: 'block',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#64748b',
                }}
              >
                Student
              </span>
              <span
                style={{
                  display: 'block',
                  marginTop: '2px',
                  fontWeight: 600,
                  color: '#0f172a',
                }}
              >
                {student.name}
              </span>
            </div>
            <div>
              <span
                style={{
                  display: 'block',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#64748b',
                }}
              >
                Class
              </span>
              <span
                style={{
                  display: 'block',
                  marginTop: '2px',
                  fontWeight: 600,
                  color: '#0f172a',
                }}
              >
                {student.className}
              </span>
            </div>
            <div>
              <span
                style={{
                  display: 'block',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#64748b',
                }}
              >
                Mentor / Domain
              </span>
              <span
                style={{
                  display: 'block',
                  marginTop: '2px',
                  fontWeight: 600,
                  color: '#0f172a',
                }}
              >
                {note.personaTitle}
              </span>
            </div>
          </div>

          {/* Question / Prompt Box */}
          {note.prompt ? (
            <div
              dir={isArabicText(note.prompt) ? 'rtl' : 'ltr'}
              style={{
                marginTop: '14px',
                borderRadius: '10px',
                border: '1px solid #a7f3d0',
                backgroundColor: '#ecfdf5',
                padding: '12px 14px',
                textAlign: isArabicText(note.prompt) ? 'right' : 'left',
              }}
            >
              <div
                style={{
                  fontSize: '9.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#065f46',
                }}
              >
                Topic / Question
              </div>
              <div
                style={{
                  marginTop: '3px',
                  fontSize: '13px',
                  fontWeight: 600,
                  lineHeight: isUrduText(note.prompt) ? 2.1 : 1.55,
                  color: '#0f172a',
                  fontFamily: isUrduText(note.prompt)
                    ? "'Noto Nastaliq Urdu', 'Tajawal', serif"
                    : isArabicText(note.prompt)
                      ? "'Tajawal', 'Noto Sans Arabic', sans-serif"
                      : "'Noto Serif Malayalam', 'Tajawal', sans-serif",
                }}
              >
                {renderPrintScriptRuns(note.prompt, 'print-prompt')}
              </div>
            </div>
          ) : null}

          {/* Study Note Content */}
          <div
            style={{ marginTop: '16px' }}
            dir={isArabicText(note.response) ? 'rtl' : 'ltr'}
          >
            <div
              style={{
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '6px',
                textAlign: isArabicText(note.response) ? 'right' : 'left',
              }}
            >
              <h2
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#081e21',
                  margin: 0,
                  lineHeight: isUrduText(note.response) ? 2.1 : undefined,
                  fontFamily: isUrduText(note.response)
                    ? "'Noto Nastaliq Urdu', 'Tajawal', serif"
                    : isArabicText(note.response)
                      ? "'Tajawal', 'Noto Sans Arabic', sans-serif"
                      : undefined,
                }}
              >
                {isUrduText(note.response)
                  ? 'تشریح اور تعلیمی نوٹ'
                  : isArabicText(note.response)
                    ? 'الشرح والمذكرة الدراسية'
                    : 'Study Note & Explanation'}
              </h2>
            </div>

            <div
              style={{
                marginTop: '12px',
                fontSize: '13px',
                lineHeight: 1.65,
                color: '#1e293b',
                fontFamily: isArabicText(note.response)
                  ? "'Tajawal', 'Noto Sans Arabic', sans-serif"
                  : "'Noto Serif Malayalam', 'Tajawal', sans-serif",
              }}
            >
              <StudyNotePrintBody text={note.response} />
            </div>
          </div>
        </div>

        {/* Dedicated Official Footer Section (Anchored to the footer of every page with equal 20mm margin) */}
        <div
          id="ics-study-note-footer"
          style={{
            width: '794px',
            backgroundColor: '#ffffff',
            color: '#081e21',
            boxSizing: 'border-box',
            paddingTop: '6px',
            paddingBottom: '2px',
          }}
        >
          {/* Subtle Top Divider */}
          <div
            style={{
              height: '1px',
              width: '100%',
              backgroundColor: '#e2e8f0',
              marginBottom: '8px',
            }}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#334155',
                  lineHeight: 1.3,
                }}
              >
                ICS Academy Manhappatta · Unified Digital Campus Learning Resource
              </span>
              <span
                style={{
                  fontSize: '9.5px',
                  color: '#94a3b8',
                  marginTop: '1px',
                }}
              >
                Bahrul Uloom Islamic Research Centre · Official Academic Record
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 700,
                  color: '#065f46',
                  backgroundColor: '#d1fae5',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Study Note
              </span>
              <span
                style={{
                  fontSize: '9.5px',
                  color: '#64748b',
                  fontFamily: 'monospace',
                }}
              >
                REF: ICS-NOTE-{note.msgId.slice(-6)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Scans upward from the nominal page slice boundary to locate a clean, empty white
 * pixel row between text paragraphs or list items, guaranteeing lines are never severed in half.
 */
function findCleanSlicePoint(
  canvas: HTMLCanvasElement,
  startY: number,
  maxSliceHeight: number,
): number {
  if (startY + maxSliceHeight >= canvas.height) {
    return canvas.height - startY
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return maxSliceHeight

  const targetEnd = startY + maxSliceHeight
  // Lookback up to 18% of page height or 160px
  const maxLookback = Math.min(160, Math.floor(maxSliceHeight * 0.18))
  const minScanY = Math.max(startY + 40, targetEnd - maxLookback)
  const scanHeight = targetEnd - minScanY

  const sampleStart = Math.floor(canvas.width * 0.05)
  const sampleEnd = Math.floor(canvas.width * 0.95)
  const sampleWidth = sampleEnd - sampleStart

  try {
    const imgData = ctx.getImageData(sampleStart, minScanY, sampleWidth, scanHeight)
    const data = imgData.data

    for (let r = scanHeight - 1; r >= 0; r--) {
      let isRowWhite = true
      const rowOffset = r * sampleWidth * 4

      // Sample every 4th pixel for high performance
      for (let c = 0; c < sampleWidth; c += 4) {
        const idx = rowOffset + c * 4
        const red = data[idx]
        const green = data[idx + 1]
        const blue = data[idx + 2]
        if (red < 248 || green < 248 || blue < 248) {
          isRowWhite = false
          break
        }
      }

      if (isRowWhite) {
        return minScanY + r - startY
      }
    }
  } catch {
    // Fallback to maxSliceHeight if image data access fails
  }

  return maxSliceHeight
}

export async function exportStudyNoteDirectPdf({
  element,
  fileName,
  action = 'download',
}: {
  element: HTMLElement
  fileName: string
  action?: 'download' | 'print'
}): Promise<void> {
  // 1. Ensure web fonts are completely loaded
  if (typeof document !== 'undefined' && document.fonts && typeof document.fonts.ready !== 'undefined') {
    try {
      await document.fonts.ready
    } catch {
      // Ignore font readiness errors and proceed
    }
  }

  // 2. Allow browser layout & font rasterization to settle
  await new Promise((resolve) => setTimeout(resolve, 150))

  // Locate the dedicated content and footer elements
  const contentEl =
    (element.querySelector('#ics-study-note-content') as HTMLElement | null) ?? element
  const footerEl = element.querySelector('#ics-study-note-footer') as HTMLElement | null

  const targetWidth = 794
  const targetContentHeight = Math.max(contentEl.scrollHeight || 1000, 1000)

  // 3. Render content element to canvas via html-to-image
  const contentCanvas = await toCanvas(contentEl, {
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    width: targetWidth,
    height: targetContentHeight,
    style: {
      position: 'static',
      transform: 'none',
      left: '0px',
      top: '0px',
      margin: '0px',
      display: 'block',
      visibility: 'visible',
      opacity: '1',
    },
  })

  // 4. Render footer element to a clean high-resolution canvas
  let footerCanvas: HTMLCanvasElement | null = null
  let footerImgData: string | null = null
  let footerRenderHeight = 11 // mm

  if (footerEl) {
    try {
      footerCanvas = await toCanvas(footerEl, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: targetWidth,
        height: footerEl.scrollHeight || 60,
        style: {
          position: 'static',
          transform: 'none',
          left: '0px',
          top: '0px',
          margin: '0px',
          display: 'block',
          visibility: 'visible',
          opacity: '1',
        },
      })
      footerImgData = footerCanvas.toDataURL('image/png')
      // Maintain exact aspect ratio for footer
      footerRenderHeight = (footerCanvas.height / footerCanvas.width) * 170
    } catch {
      // If footer canvas generation has an issue, fallback to vector line
    }
  }

  // 5. Initialize jsPDF A4 in portrait mode
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  // Page geometry specifications (Matching equal ~20mm margins on all 4 sides)
  const pageWidth = 210 // mm
  const pageHeight = 297 // mm
  const marginX = 20 // 20mm left & right margins
  const marginTopPage1 = 20 // 20mm top margin on page 1
  const marginTopPageNext = 22 // 22mm top margin on continuation pages (with running head)
  const printWidth = pageWidth - marginX * 2 // 170mm printable width
  const footerY = 265 // mm (Footer sits from y=265 to y=276)
  const marginBottom = pageHeight - (footerY + footerRenderHeight) // ~21mm bottom margin!

  const pxPerMm = contentCanvas.width / printWidth

  // Pre-calculate smart page slices so we know total pages in advance
  interface PageSlice {
    sY: number
    sliceHeight: number
    contentTopY: number
    maxAvailableHeight: number
  }

  const slices: PageSlice[] = []
  let sY = 0
  let pageIdx = 0

  while (sY < contentCanvas.height) {
    const isFirstPage = pageIdx === 0
    const topY = isFirstPage ? marginTopPage1 : marginTopPageNext
    const maxAvailableHeight = footerY - 2 - topY // leave 2mm breathing space above footer
    const maxPxHeight = Math.floor(maxAvailableHeight * pxPerMm)

    const sliceHeight = findCleanSlicePoint(contentCanvas, sY, maxPxHeight)
    slices.push({
      sY,
      sliceHeight,
      contentTopY: topY,
      maxAvailableHeight,
    })

    sY += sliceHeight
    pageIdx++
  }

  const totalPages = slices.length

  // 6. Render each page with balanced margins, content slice, and anchored official footer
  for (let i = 0; i < slices.length; i++) {
    const { sY: sliceStartY, sliceHeight, contentTopY } = slices[i]
    const pageNum = i + 1

    if (i > 0) {
      pdf.addPage()

      // Running top header for continuation pages
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7.5)
      pdf.setTextColor(100, 116, 139) // slate-500
      pdf.text('ICS ACADEMY MANHAPPATTA  ·  STUDY NOTE (CONTINUED)', marginX, 15)

      pdf.setDrawColor(226, 232, 240) // slate-200
      pdf.setLineWidth(0.25)
      pdf.line(marginX, 17, marginX + printWidth, 17)
    }

    // Slice content onto a per-page canvas
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = contentCanvas.width
    pageCanvas.height = sliceHeight
    const pCtx = pageCanvas.getContext('2d')

    if (pCtx) {
      pCtx.fillStyle = '#ffffff'
      pCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
      pCtx.drawImage(
        contentCanvas,
        0,
        sliceStartY,
        contentCanvas.width,
        sliceHeight,
        0,
        0,
        contentCanvas.width,
        sliceHeight,
      )

      const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95)
      const renderHeight = sliceHeight / pxPerMm
      pdf.addImage(pageImgData, 'JPEG', marginX, contentTopY, printWidth, renderHeight, undefined, 'FAST')
    }

    // Anchored Official Footer with Malayalam letterhead
    if (footerImgData) {
      pdf.addImage(
        footerImgData,
        'PNG',
        marginX,
        footerY,
        printWidth,
        footerRenderHeight,
        undefined,
        'FAST',
      )
    } else {
      // Fallback line if canvas wasn't available
      pdf.setDrawColor(226, 232, 240)
      pdf.setLineWidth(0.3)
      pdf.line(marginX, footerY, marginX + printWidth, footerY)
    }

    // Clean Page Counter on the bottom right (e.g., "Page 1 of 2")
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(148, 163, 184) // slate-400
    pdf.text(
      `Page ${pageNum} of ${totalPages}`,
      marginX + printWidth,
      footerY + footerRenderHeight + 3.5,
      { align: 'right' },
    )
  }

  const safeFilename =
    (fileName.trim() || 'ics-academy-study-note')
      .toLowerCase()
      .replace(/[^a-z0-9\u0D00-\u0D7F\u0600-\u06FF]+/gi, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70) || 'ics-academy-study-note'

  const pdfBlob = pdf.output('blob')
  if (action === 'print') {
    await printPdfBlobOnDevice(pdfBlob, `${safeFilename}.pdf`)
  } else {
    await downloadBlobOnDevice(pdfBlob, `${safeFilename}.pdf`, 'application/pdf')
  }
}
