import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

// ─── Markdown download ────────────────────────────────────────────────────────

export function downloadMarkdown({ prompt, synthesisText, sources = [] }) {
  const sourcesBlock = sources.length
    ? '\n\n## Sources\n\n' + sources.map((s, i) => `${i + 1}. [${s.title || s.url}](${s.url})`).join('\n')
    : ''

  const content = `# ${prompt}\n\n${synthesisText || ''}${sourcesBlock}\n`
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = slugify(prompt) + '.md'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── PDF download ─────────────────────────────────────────────────────────────
//
// Strategy:
//  1. Clone the target DOM node into an off-screen container.
//  2. Force every element to white/light colours (text dark, bg white).
//  3. html2canvas screenshots the clone at 2× scale.
//  4. jsPDF packs the canvas into A4 pages, prepending a Zenith header on p.1.

export async function downloadVisualPDF({ element, prompt, sources = [] }) {
  // ── 1. Build an off-screen light-mode clone ────────────────────────────────
  const MARGIN_MM   = 12          // page margins in mm
  const A4_W_MM     = 210
  const A4_H_MM     = 297
  const CONTENT_W_MM = A4_W_MM - MARGIN_MM * 2   // 186 mm
  const HEADER_H_MM = 22                          // space reserved for Zenith header

  // Wrapper that forces light colours regardless of MUI theme
  const wrapper = document.createElement('div')
  wrapper.style.cssText = [
    'position:absolute',
    'left:-99999px',
    'top:0',
    `width:${element.offsetWidth}px`,
    'background:#ffffff',
    'color:#111111',
    'padding:0',
    'margin:0',
    'border:none',
  ].join(';')

  // Deep clone — preserves rendered SVG / canvas children
  const clone = element.cloneNode(true)

  // Force light colours on every descendant
  forceLightMode(clone)

  wrapper.appendChild(clone)
  document.body.appendChild(wrapper)

  try {
    // ── 2. Capture ───────────────────────────────────────────────────────────
    const canvas = await html2canvas(wrapper, {
      scale:           2,
      backgroundColor: '#ffffff',
      useCORS:         true,
      allowTaint:      true,
      logging:         false,
      removeContainer: false,
    })

    // ── 3. Build PDF ─────────────────────────────────────────────────────────
    const pdf        = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
    const pageW      = pdf.internal.pageSize.getWidth()   // 210
    const pageH      = pdf.internal.pageSize.getHeight()  // 297
    const contentW   = pageW - MARGIN_MM * 2              // 186
    const date       = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })

    // ── 4. Draw Zenith header on page 1 ──────────────────────────────────────
    drawHeader(pdf, { pageW, marginMm: MARGIN_MM, date })

    // ── 5. Slice canvas into A4 pages ─────────────────────────────────────────
    // Scale: how many pixels = 1 mm on the PDF
    const pxPerMm     = canvas.width / contentW          // pixels per mm
    const firstPageH  = (pageH - MARGIN_MM - HEADER_H_MM) * pxPerMm   // px available on page 1
    const fullPageH   = (pageH - MARGIN_MM * 2) * pxPerMm             // px available on subsequent pages

    let srcY = 0
    let page = 1

    while (srcY < canvas.height) {
      const availPx    = page === 1 ? firstPageH : fullPageH
      const sliceH     = Math.min(availPx, canvas.height - srcY)
      const destY_mm   = page === 1 ? MARGIN_MM + HEADER_H_MM : MARGIN_MM
      const sliceH_mm  = sliceH / pxPerMm

      // Slice the canvas
      const slice = sliceCanvas(canvas, srcY, sliceH)
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG',
        MARGIN_MM, destY_mm, contentW, sliceH_mm)

      srcY += sliceH
      if (srcY < canvas.height) {
        pdf.addPage()
        page++
      }
    }

    pdf.save(slugify(prompt) + '.pdf')

  } finally {
    document.body.removeChild(wrapper)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text) {
  return (text || 'zenith')
    .slice(0, 50)
    .replace(/[^a-z0-9\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase() || 'zenith'
}

// Recursively force white background + dark text on a DOM subtree
function forceLightMode(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return

  const el = node
  const cs = window.getComputedStyle(el)

  // Background: if dark, override with white
  const bg = cs.backgroundColor
  if (bg && isDark(bg)) {
    el.style.backgroundColor = '#ffffff'
    el.style.background = '#ffffff'
  }

  // Text: if light-coloured, override with near-black
  const color = cs.color
  if (color && isLight(color)) {
    el.style.color = '#111111'
  }

  // Border: lighten very dark borders
  const border = cs.borderColor
  if (border && isDark(border)) {
    el.style.borderColor = '#e0e0e0'
  }

  for (const child of el.children) {
    forceLightMode(child)
  }
}

// Parse rgb(r,g,b) / rgba(r,g,b,a) → luminance
function parseLum(cssColor) {
  const m = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return null
  const r = +m[1], g = +m[2], b = +m[3]
  // Perceived luminance
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function isDark(cssColor)  {
  const lum = parseLum(cssColor)
  return lum !== null && lum < 80
}

function isLight(cssColor) {
  const lum = parseLum(cssColor)
  return lum !== null && lum > 180
}

// Draw the Zenith branded header at the top of the page
function drawHeader(pdf, { pageW, marginMm, date }) {
  // Gradient-blue square logo mark (jsPDF doesn't support gradients; use solid blue)
  pdf.setFillColor(24, 71, 214)       // #1847D6
  pdf.roundedRect(marginMm, marginMm, 8, 8, 1.5, 1.5, 'F')

  // "Z" in white inside the box
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.text('Z', marginMm + 2.5, marginMm + 5.8)

  // "Zenith" wordmark
  pdf.setTextColor(17, 17, 17)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.text('Zenith', marginMm + 10.5, marginMm + 6.2)

  // Date (right-aligned)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(150, 150, 150)
  pdf.text(date, pageW - marginMm, marginMm + 6.2, { align: 'right' })

  // Thin separator line
  pdf.setDrawColor(224, 224, 224)
  pdf.setLineWidth(0.3)
  pdf.line(marginMm, marginMm + 11, pageW - marginMm, marginMm + 11)
}

// Slice a tall canvas vertically: srcY is the pixel row to start from, height is px to capture
function sliceCanvas(src, srcY, height) {
  const dest = document.createElement('canvas')
  dest.width  = src.width
  dest.height = Math.ceil(height)
  const ctx = dest.getContext('2d')
  ctx.drawImage(src, 0, srcY, src.width, height, 0, 0, src.width, height)
  return dest
}
