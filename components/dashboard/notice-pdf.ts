'use client'

import {
  MONTHS_META,
  formatTargetClassesBadge,
  getNoticeTargetClasses,
  type Notice,
} from '@/components/dashboard/data'
import { downloadBlobOnDevice, printPdfBlobOnDevice } from '@/lib/mobile-pdf'

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sanitizeFileSlug(raw: string): string {
  const cleaned = String(raw || 'Notice')
    .replace(/[^\p{L}\p{N}\s_-]+/gu, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 48)
  return cleaned || 'Official_Notice'
}

function formatReadableNoticeDate(rawDate: string): string {
  const parsed = new Date(rawDate)
  if (Number.isNaN(parsed.getTime())) return rawDate || ''
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parsed)
}

function hasArabicText(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text)
}

function hasMalayalamText(text: string): boolean {
  return /[\u0D00-\u0D7F]/.test(text)
}

async function loadLogoDataUrl(): Promise<string> {
  try {
    const res = await fetch('/images/ics-mark-transparent.png')
    if (!res.ok) return ''
    const blob = await res.blob()
    return await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '')
      reader.onerror = () => resolve('')
      reader.readAsDataURL(blob)
    })
  } catch {
    return ''
  }
}

function buildOfficialNoticeInnerHtml(
  notice: Notice,
  issuerLabel: string,
  logoDataUrl: string,
): string {
  const targetBatches = getNoticeTargetClasses(notice)
  const targetLabel = formatTargetClassesBadge(targetBatches)
  const displayDate = formatReadableNoticeDate(notice.date)
  const hMeta = notice.holidayMeta
  const monthLabel = hMeta?.monthId
    ? MONTHS_META.find((m) => m.id === hMeta.monthId)?.month ?? hMeta.monthId
    : ''

  const titleIsArabic = hasArabicText(notice.title)
  const bodyIsArabic = hasArabicText(notice.body)
  const bodyIsMalayalam = hasMalayalamText(notice.body) || hasMalayalamText(notice.title)

  const bodyFontFamily = bodyIsArabic
    ? `'SoraDigits', 'KFGQPC Uthman Taha Naskh', 'Noto Serif Malayalam', 'Poppins', serif`
    : bodyIsMalayalam
      ? `'SoraDigits', 'Noto Serif Malayalam', 'Poppins', serif`
      : `'SoraDigits', 'Poppins', 'Noto Serif Malayalam', sans-serif`

  const titleFontFamily = titleIsArabic
    ? `'SoraDigits', 'KFGQPC Uthman Taha Naskh', 'Noto Serif Malayalam', serif`
    : bodyIsMalayalam
      ? `'SoraDigits', 'Noto Serif Malayalam', 'Sora', sans-serif`
      : `'Sora', 'Poppins', sans-serif`

  const paragraphsHtml = String(notice.body || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        `<p style="margin:0 0 14px 0;font-family:${bodyFontFamily};font-size:15.5px;line-height:1.9;color:#111827;text-align:${bodyIsArabic ? 'right' : 'left'};direction:${bodyIsArabic ? 'rtl' : 'ltr'};white-space:pre-wrap;">${escapeHtml(line)}</p>`,
    )
    .join('')

  const holidayScheduleHtml = hMeta?.isOfficialHoliday
    ? `
      <div style="margin-top:22px;border:1.5px solid #bae6fd;background:#f0f9ff;border-radius:14px;padding:18px 20px;">
        <div style="font-family:'SoraDigits','Poppins',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#0369a1;margin-bottom:12px;">
          ${hMeta.holidayType === 'monthly-second-saturday' ? 'Official 2nd Saturday Leave Schedule' : 'Official Festival / Batch Holiday Schedule'}
        </div>
        <table style="width:100%;border-collapse:collapse;font-family:'SoraDigits','Poppins',sans-serif;font-size:13px;">
          <tr>
            <td style="width:33.3%;vertical-align:top;padding-right:12px;">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Departure Date &amp; Time</div>
              <div style="margin-top:4px;font-weight:700;color:#0f172a;">${escapeHtml(hMeta.departureDate)}</div>
              <div style="margin-top:2px;font-weight:600;color:#0284c7;">${escapeHtml(hMeta.departureTime)}</div>
            </td>
            <td style="width:33.3%;vertical-align:top;padding:0 12px;border-left:1px solid #cbd5e1;">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Return to Campus</div>
              <div style="margin-top:4px;font-weight:700;color:#0f172a;">${escapeHtml(hMeta.returnDate)}</div>
              <div style="margin-top:2px;font-weight:600;color:#0284c7;">${escapeHtml(hMeta.returnTime)}</div>
            </td>
            <td style="width:33.3%;vertical-align:top;padding-left:12px;border-left:1px solid #cbd5e1;">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Working Days Impact</div>
              <div style="margin-top:4px;font-weight:700;color:#0369a1;">-${escapeHtml(String(hMeta.holidayDaysDeducted))} Days Excluded (${escapeHtml(monthLabel)})</div>
              <div style="margin-top:2px;font-size:11.5px;color:#475569;">Not counted as student leave</div>
            </td>
          </tr>
        </table>
      </div>
    `
    : ''

  const refNo = `ICS/NTC/${notice.date.replace(/-/g, '')}/${notice.id.slice(-4).toUpperCase()}`
  const issuedByName = hMeta?.announcedBy || issuerLabel || 'ICS Academy Administration'

  return `
    <div style="width:794px;min-height:1123px;box-sizing:border-box;background:#ffffff;color:#0f172a;padding:44px 50px 42px 50px;display:flex;flex-direction:column;justify-content:space-between;font-family:'SoraDigits','Poppins','Noto Serif Malayalam',sans-serif;">
      <div>
        <!-- Official ICS Academy Letterhead -->
        <div style="display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:3px solid #009245;padding-bottom:18px;">
          <div style="display:flex;align-items:center;gap:14px;">
            ${
              logoDataUrl
                ? `<img src="${logoDataUrl}" alt="ICS Academy" style="width:54px;height:54px;object-fit:contain;display:block;" />`
                : ''
            }
            <div>
              <div style="font-family:'El Messiri',serif;font-size:26px;font-weight:700;line-height:1.08;letter-spacing:0.02em;color:#0f172a;">
                ICS ACADEMY
              </div>
              <div style="font-family:'El Messiri',serif;font-size:12.5px;font-weight:700;letter-spacing:0.32em;color:#009245;margin-top:2px;">
                MANHAPPATTA
              </div>
              <div style="font-family:'SoraDigits','Poppins',sans-serif;font-size:11px;color:#475569;margin-top:3px;">
                Islamic Cultural &amp; Studies Academy • Official Campus Circular
              </div>
            </div>
          </div>
          <div style="text-align:right;font-family:'SoraDigits','Poppins',sans-serif;">
            <div style="display:inline-block;background:#0f172a;color:#ffffff;font-size:10.5px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;padding:5px 12px;border-radius:999px;">
              OFFICIAL NOTICE
            </div>
            <div style="margin-top:7px;font-size:11.5px;font-weight:600;color:#334155;">
              Date: ${escapeHtml(displayDate)}
            </div>
            <div style="margin-top:2px;font-size:10.5px;color:#64748b;">
              Ref: ${escapeHtml(refNo)}
            </div>
          </div>
        </div>

        <!-- Category & Audience Meta Strip -->
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px;padding:10px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:12px;">
          <div>
            <span style="color:#64748b;font-weight:600;">Category:</span>
            <span style="margin-left:6px;font-weight:700;color:#0077cc;">${escapeHtml(notice.category)}</span>
          </div>
          <div>
            <span style="color:#64748b;font-weight:600;">Audience:</span>
            <span style="margin-left:6px;font-weight:700;color:#0f172a;">${escapeHtml(targetLabel)}</span>
          </div>
        </div>

        <!-- Notice Title -->
        <div style="margin-top:30px;margin-bottom:22px;text-align:center;">
          <h1 style="margin:0;font-family:${titleFontFamily};font-size:23px;font-weight:700;line-height:1.45;color:#0f172a;direction:${titleIsArabic ? 'rtl' : 'ltr'};">
            ${escapeHtml(notice.title)}
          </h1>
          <div style="width:72px;height:3px;background:linear-gradient(90deg,#009245,#00afd9);border-radius:999px;margin:14px auto 0 auto;"></div>
        </div>

        <!-- Notice Body -->
        <div style="margin-top:18px;padding:24px 26px;border:1px solid #e2e8f0;border-radius:14px;background:#ffffff;">
          ${paragraphsHtml}
        </div>

        ${holidayScheduleHtml}
      </div>

      <!-- Official Signature & Footer -->
      <div style="margin-top:44px;padding-top:20px;border-top:1px solid #e2e8f0;">
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:24px;">
          <div style="font-size:11px;color:#64748b;line-height:1.6;">
            <div style="font-family:'El Messiri',serif;font-weight:700;color:#0f172a;">ICS ACADEMY MANHAPPATTA</div>
            <div>Official Digital Notice Board Copy</div>
          </div>
          <div style="text-align:right;min-width:210px;">
            <div style="border-top:1.5px solid #334155;padding-top:8px;font-size:12.5px;font-weight:700;color:#0f172a;">
              ${escapeHtml(issuedByName)}
            </div>
            <div style="font-size:10.5px;color:#64748b;margin-top:2px;">
              Authorized Signatory • ICS Academy
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}

async function generateOfficialNoticePdfBlob(
  notice: Notice,
  issuerLabel: string,
): Promise<{ blob: Blob; html: string; fileName: string }> {
  const logoDataUrl = await loadLogoDataUrl()
  const innerHtml = buildOfficialNoticeInnerHtml(notice, issuerLabel, logoDataUrl)
  const fileName = `ICS_Notice_${sanitizeFileSlug(notice.title)}_${notice.date || 'Official'}.pdf`

  // Wait for bundled local fonts (El Messiri, Poppins, Noto Serif Malayalam) before capturing
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready
    } catch {
      // Continue cleanly
    }
  }

  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-10000px'
  host.style.top = '0'
  host.style.width = '794px'
  host.style.background = '#ffffff'
  host.style.zIndex = '-1'
  host.innerHTML = innerHtml
  document.body.appendChild(host)

  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ])
    const targetEl = host.firstElementChild as HTMLElement
    const canvas = await html2canvas(targetEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 794,
    })

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    })

    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const imgData = canvas.toDataURL('image/jpeg', 0.94)
    const imgRatio = canvas.height / canvas.width
    const renderW = pageW
    const renderH = renderW * imgRatio

    if (renderH <= pageH + 1) {
      pdf.addImage(imgData, 'JPEG', 0, 0, renderW, Math.min(renderH, pageH))
    } else {
      // Multi-page slice for very long notices
      let remainingH = renderH
      let offsetY = 0
      let pageIndex = 0
      while (remainingH > 0) {
        if (pageIndex > 0) pdf.addPage()
        pdf.addImage(imgData, 'JPEG', 0, offsetY, renderW, renderH)
        remainingH -= pageH
        offsetY -= pageH
        pageIndex += 1
      }
    }

    const blob = pdf.output('blob')
    return { blob, html: innerHtml, fileName }
  } finally {
    host.remove()
  }
}

function printHtmlViaHiddenIframe(innerHtml: string, title: string): void {
  if (typeof document === 'undefined') return
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) {
    iframe.remove()
    return
  }

  doc.open()
  doc.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @font-face {
      font-family: 'El Messiri';
      src: url('/fonts/ElMessiri-Bold.ttf') format('truetype');
      font-weight: 400 700;
    }
    @font-face {
      font-family: 'Sora';
      src: url('/fonts/Sora-Regular.ttf') format('truetype');
      font-weight: 400;
    }
    @font-face {
      font-family: 'Sora';
      src: url('/fonts/Sora-SemiBold.ttf') format('truetype');
      font-weight: 600;
    }
    @font-face {
      font-family: 'Sora';
      src: url('/fonts/Sora-Bold.ttf') format('truetype');
      font-weight: 700;
    }
    @font-face {
      font-family: 'SoraDigits';
      src: url('/fonts/Sora-Regular.ttf') format('truetype');
      font-weight: 100 400;
      unicode-range: U+0030-0039;
    }
    @font-face {
      font-family: 'SoraDigits';
      src: url('/fonts/Sora-SemiBold.ttf') format('truetype');
      font-weight: 500 600;
      unicode-range: U+0030-0039;
    }
    @font-face {
      font-family: 'SoraDigits';
      src: url('/fonts/Sora-Bold.ttf') format('truetype');
      font-weight: 700 900;
      unicode-range: U+0030-0039;
    }
    @font-face {
      font-family: 'Poppins';
      src: url('/fonts/Poppins-Regular.ttf') format('truetype');
      font-weight: 400;
    }
    @font-face {
      font-family: 'Poppins';
      src: url('/fonts/Poppins-Bold.ttf') format('truetype');
      font-weight: 700;
    }
    @font-face {
      font-family: 'Noto Serif Malayalam';
      src: url('/fonts/NotoSerifMalayalam-Regular.ttf') format('truetype');
      font-weight: 400;
    }
    @font-face {
      font-family: 'Noto Serif Malayalam';
      src: url('/fonts/NotoSerifMalayalam-Bold.ttf') format('truetype');
      font-weight: 700;
    }
    @page { size: A4 portrait; margin: 0; }
    html, body { margin: 0; padding: 0; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body>
  ${innerHtml}
</body>
</html>`)
  doc.close()

  const trigger = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } finally {
      window.setTimeout(() => iframe.remove(), 1500)
    }
  }

  if (iframe.contentWindow?.document.fonts?.ready) {
    iframe.contentWindow.document.fonts.ready
      .then(() => window.setTimeout(trigger, 180))
      .catch(() => window.setTimeout(trigger, 250))
  } else {
    window.setTimeout(trigger, 300)
  }
}

export async function exportNoticeAsPdf(
  notice: Notice,
  issuerLabel = 'ICS Academy Administration',
): Promise<void> {
  const { blob, fileName } = await generateOfficialNoticePdfBlob(notice, issuerLabel)
  await downloadBlobOnDevice(blob, fileName, 'application/pdf')
}

export async function printOfficialNotice(
  notice: Notice,
  issuerLabel = 'ICS Academy Administration',
): Promise<void> {
  const { blob, html, fileName } = await generateOfficialNoticePdfBlob(notice, issuerLabel)
  await printPdfBlobOnDevice(blob, fileName, () => {
    printHtmlViaHiddenIframe(html, notice.title || 'ICS Academy Notice')
  })
}
