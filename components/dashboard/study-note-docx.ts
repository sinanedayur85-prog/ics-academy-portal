import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  UnderlineType,
} from 'docx'

export interface StudyNoteDocxData {
  title: string
  prompt: string
  response: string
  studentName?: string
  studentClass?: string
  personaTitle?: string
}

function isArabicText(text: string): boolean {
  if (!text) return false
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text)
}

function parseFormattedLines(rawText: string): Paragraph[] {
  const paragraphs: Paragraph[] = []
  const lines = rawText.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim()
    if (!line) {
      // Empty line spacer
      paragraphs.push(
        new Paragraph({
          spacing: { before: 120, after: 120 },
          children: [new TextRun({ text: '' })],
        }),
      )
      continue
    }

    const isArabic = isArabicText(line)

    // Heading 1 (# Heading or ### Heading)
    if (line.startsWith('#')) {
      const headingText = line.replace(/^#+\s*/, '')
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
          alignment: isArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
          bidirectional: isArabic,
          children: [
            new TextRun({
              text: headingText,
              bold: true,
              size: 28, // 14pt
              color: '1E3A8A', // Deep primary blue
              font: isArabic ? 'Traditional Arabic' : 'Noto Sans Malayalam',
              rightToLeft: isArabic,
            }),
          ],
        }),
      )
      continue
    }

    // Numbered list item: e.g. "1. ..." or "1) ..."
    const numberedMatch = line.match(/^(\d+[\.\)])\s*(.*)$/)
    if (numberedMatch) {
      const numPrefix = numberedMatch[1]
      const body = numberedMatch[2]
      paragraphs.push(
        new Paragraph({
          spacing: { before: 80, after: 80 },
          alignment: isArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
          bidirectional: isArabic,
          children: isArabic
            ? [
                ...parseInlineBold(body, true),
                new TextRun({
                  text: ` ${numPrefix}`,
                  bold: true,
                  size: 22,
                  color: '047857',
                  font: 'Traditional Arabic',
                  rightToLeft: true,
                }),
              ]
            : [
                new TextRun({
                  text: `${numPrefix} `,
                  bold: true,
                  size: 22,
                  color: '047857',
                  font: 'Noto Sans Malayalam',
                }),
                ...parseInlineBold(body, false),
              ],
        }),
      )
      continue
    }

    // Bullet points: e.g. "- ..." or "* ..."
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const bulletBody = line.slice(2).trim()
      if (isArabic) {
        paragraphs.push(
          new Paragraph({
            spacing: { before: 60, after: 60 },
            alignment: AlignmentType.RIGHT,
            bidirectional: true,
            children: [
              ...parseInlineBold(bulletBody, true),
              new TextRun({
                text: ' •',
                bold: true,
                size: 22,
                color: '047857',
                font: 'Traditional Arabic',
                rightToLeft: true,
              }),
            ],
          }),
        )
      } else {
        paragraphs.push(
          new Paragraph({
            spacing: { before: 60, after: 60 },
            bullet: { level: 0 },
            alignment: AlignmentType.LEFT,
            bidirectional: false,
            children: parseInlineBold(bulletBody, false),
          }),
        )
      }
      continue
    }

    // Regular paragraph
    paragraphs.push(
      new Paragraph({
        spacing: { before: 80, after: 120, line: 320 }, // 1.33x line spacing
        alignment: isArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
        bidirectional: isArabic,
        children: parseInlineBold(line, isArabic),
      }),
    )
  }

  return paragraphs
}

function parseInlineBold(text: string, isArabic: boolean): TextRun[] {
  const runs: TextRun[] = []
  // Matches **bold** patterns
  const parts = text.split(/(\*\*[^*]+\*\*)/g)

  for (const part of parts) {
    if (!part) continue
    if (part.startsWith('**') && part.endsWith('**')) {
      const inner = part.slice(2, -2)
      runs.push(
        new TextRun({
          text: inner,
          bold: true,
          size: 22, // 11pt
          color: '0F172A',
          font: isArabic ? 'Traditional Arabic' : 'Noto Sans Malayalam',
          rightToLeft: isArabic,
        }),
      )
    } else {
      runs.push(
        new TextRun({
          text: part,
          size: 22, // 11pt
          color: '334155',
          font: isArabic ? 'Traditional Arabic' : 'Noto Sans Malayalam',
          rightToLeft: isArabic,
        }),
      )
    }
  }

  return runs
}

export async function exportStudyNoteDirectDocx(data: StudyNoteDocxData): Promise<void> {
  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  const bodyParagraphs = parseFormattedLines(data.response)

  const doc = new Document({
    creator: 'ICS Academy Manhappatta',
    title: data.title,
    description: 'Unified Digital Campus Study Note',
    styles: {
      default: {
        document: {
          run: {
            font: 'Noto Sans Malayalam',
            size: 22,
            color: '1E293B',
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch (approx 25.4mm)
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                border: {
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: 6,
                    color: 'CBD5E1',
                    space: 4,
                  },
                },
                children: [
                  new TextRun({
                    text: 'ICS ACADEMY MANHAPPATTA · STUDY RESOURCE',
                    size: 16,
                    color: '64748B',
                    bold: true,
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                border: {
                  top: {
                    style: BorderStyle.SINGLE,
                    size: 6,
                    color: 'CBD5E1',
                    space: 4,
                  },
                },
                children: [
                  new TextRun({
                    text: 'ICS Academy Manhappatta · Unified Digital Campus  |  Page ',
                    size: 16,
                    color: '64748B',
                    font: 'Arial',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    bold: true,
                    color: '047857',
                  }),
                  new TextRun({
                    text: ' of ',
                    size: 16,
                    color: '64748B',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    bold: true,
                    color: '047857',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // Academy Brand Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 80 },
            children: [
              new TextRun({
                text: 'ICS ACADEMY MANHAPPATTA',
                bold: true,
                size: 32, // 16pt
                color: '065F46', // Emerald 800
                font: 'Arial',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 200 },
            children: [
              new TextRun({
                text: "DA'WA COLLEGE · UNIFIED DIGITAL CAMPUS STUDY RESOURCE",
                bold: true,
                size: 20,
                color: '047857',
                font: 'Arial',
              }),
            ],
          }),

          // Metadata Table or Box
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({
                text: `Student: `,
                bold: true,
                size: 20,
                color: '475569',
              }),
              new TextRun({
                text: `${data.studentName || 'Student'} `,
                bold: true,
                size: 20,
                color: '0F172A',
              }),
              new TextRun({
                text: ` | Class: `,
                bold: true,
                size: 20,
                color: '475569',
              }),
              new TextRun({
                text: `${data.studentClass || 'General'} `,
                size: 20,
                color: '0F172A',
              }),
              new TextRun({
                text: ` | Date: `,
                bold: true,
                size: 20,
                color: '475569',
              }),
              new TextRun({
                text: `${todayFormatted}`,
                size: 20,
                color: '0F172A',
              }),
            ],
          }),

          // Topic / Question Box
          new Paragraph({
            spacing: { before: 160, after: 80 },
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 12,
                color: '10B981',
                space: 6,
              },
            },
            children: [
              new TextRun({
                text: 'TOPIC / QUESTION:',
                bold: true,
                size: 22,
                color: '065F46',
                underline: { type: UnderlineType.SINGLE },
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 80, after: 240 },
            alignment: isArabicText(data.prompt) ? AlignmentType.RIGHT : AlignmentType.LEFT,
            bidirectional: isArabicText(data.prompt),
            children: [
              new TextRun({
                text: data.prompt,
                bold: true,
                size: 24, // 12pt
                color: '0F172A',
                font: isArabicText(data.prompt) ? 'Traditional Arabic' : 'Noto Sans Malayalam',
                rightToLeft: isArabicText(data.prompt),
              }),
            ],
          }),

          // Content Heading
          new Paragraph({
            spacing: { before: 120, after: 120 },
            children: [
              new TextRun({
                text: 'STUDY NOTE / EXPLANATION:',
                bold: true,
                size: 22,
                color: '1E3A8A', // Deep Blue
              }),
            ],
          }),

          // Insert all parsed body paragraphs
          ...bodyParagraphs,
        ],
      },
    ],
  })

  // Generate blob and trigger browser download
  const blob = await Packer.toBlob(doc)
  const safeFilename =
    data.title
      .toLowerCase()
      .replace(/[^a-z0-9\u0D00-\u0D7F\u0600-\u06FF]+/gi, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'ics-academy-study-note'

  const blobUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = `${safeFilename}.docx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
}
