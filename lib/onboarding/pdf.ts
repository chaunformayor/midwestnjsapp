// Server-only PDF builders (pdfkit). Uses the standard PDF fonts, so nothing
// has to be bundled or downloaded at runtime.

import PDFDocument from 'pdfkit'
import type { Block, Run } from './agreements'
import type { SummarySection } from './questionnaire'

const NAVY = '#0D1B2A'
const GOLD = '#A88830'
const INK = '#1F2937'
const GREY = '#5B6776'
const LINE = '#D9D4C7'
const REG = 'Helvetica'
const BOLD = 'Helvetica-Bold'
const HEAD = 'Times-Bold'
const BODY_SIZE = 10
const MARGIN = { top: 68, bottom: 80, left: 64, right: 64 } // bottom leaves room for LibreSign's validation footer

type Doc = PDFKit.PDFDocument

function newDoc(title: string): Doc {
  return new PDFDocument({
    size: 'LETTER',
    margins: MARGIN,
    bufferPages: true,
    info: { Title: title, Author: 'Midwest Investor Services', Creator: 'midwestinvestorservices.com' },
  })
}

function finish(doc: Doc, label: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    const range = doc.bufferedPageRange()
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i)
      const y = 34
      doc.save()
      doc.font(REG).fontSize(7.5).fillColor(GREY)
      doc.text(`Midwest Investor Services · ${label}`, MARGIN.left, y, { lineBreak: false, width: 360 })
      doc.text(`Page ${i - range.start + 1} of ${range.count}`, doc.page.width - MARGIN.right - 120, y, { width: 120, align: 'right', lineBreak: false })
      doc.moveTo(MARGIN.left, y + 13).lineTo(doc.page.width - MARGIN.right, y + 13).lineWidth(0.5).strokeColor(LINE).stroke()
      doc.restore()
    }
    doc.end()
  })
}

const contentWidth = (doc: Doc) => doc.page.width - MARGIN.left - MARGIN.right
const bottom = (doc: Doc) => doc.page.height - MARGIN.bottom

function ensureSpace(doc: Doc, needed: number) {
  if (doc.y + needed > bottom(doc)) doc.addPage()
}

function runText(r: Run) {
  return r.t
}

function writeRuns(doc: Doc, runs: Run[], x: number, y: number, width: number, size = BODY_SIZE, color = INK) {
  const list = runs.length ? runs : [{ t: '' }]
  doc.fontSize(size).fillColor(color)
  list.forEach((r, i) => {
    doc.font(r.b ? BOLD : REG)
    const opts = { width, lineGap: 2.2, continued: i < list.length - 1 }
    if (i === 0) doc.text(runText(r), x, y, opts)
    else doc.text(runText(r), opts)
  })
}

function measureRuns(doc: Doc, runs: Run[], width: number, size = BODY_SIZE) {
  // Measure in bold to stay on the safe side when runs mix weights.
  doc.font(runs.some((r) => r.b) ? BOLD : REG).fontSize(size)
  return doc.heightOfString(runs.map(runText).join('') || ' ', { width, lineGap: 2.2 })
}

function renderBlocks(doc: Doc, blocks: Block[]) {
  const W = contentWidth(doc)
  const X = MARGIN.left
  for (const bl of blocks) {
    if (bl.k === 'break') {
      doc.addPage()
      continue
    }
    if (bl.k === 'title') {
      ensureSpace(doc, 80)
      doc.font(BOLD).fontSize(8).fillColor(GOLD).text('MIDWEST INVESTOR SERVICES', X, doc.y, { characterSpacing: 1.2 })
      doc.moveDown(0.35)
      doc.font(HEAD).fontSize(19).fillColor(NAVY).text(bl.text, X, doc.y, { width: W })
      doc.moveDown(0.6)
      continue
    }
    if (bl.k === 'h') {
      ensureSpace(doc, 96) // keep a heading with the start of its section
      doc.moveDown(0.5)
      doc.font(BOLD).fontSize(10.5).fillColor(NAVY).text(bl.text, X, doc.y, { width: W })
      doc.moveDown(0.25)
      continue
    }
    if (bl.k === 'p') {
      ensureSpace(doc, Math.min(measureRuns(doc, bl.runs, W), 40))
      writeRuns(doc, bl.runs, X, doc.y, W)
      doc.moveDown(0.45)
      continue
    }
    if (bl.k === 'ol' || bl.k === 'ul') {
      const indent = 18
      bl.items.forEach((item, i) => {
        const h = measureRuns(doc, item, W - indent)
        ensureSpace(doc, Math.min(h, 40))
        const y = doc.y
        doc.font(REG).fontSize(BODY_SIZE).fillColor(INK)
        doc.text(bl.k === 'ol' ? `${i + 1}.` : '•', X + 2, y, { width: indent - 4, lineBreak: false })
        writeRuns(doc, item, X + indent, y, W - indent)
        doc.moveDown(0.2)
      })
      doc.moveDown(0.3)
      continue
    }
    if (bl.k === 'table') {
      const widths = (bl.widths ?? bl.head.map(() => 1 / bl.head.length)).map((f) => f * W)
      const pad = 5
      const drawHead = () => {
        const y = doc.y
        let x = X
        doc.font(BOLD).fontSize(7.5).fillColor(GREY)
        bl.head.forEach((h, i) => {
          doc.text(h.toUpperCase(), x + pad, y + pad, { width: widths[i] - pad * 2, characterSpacing: 0.6, lineBreak: false })
          x += widths[i]
        })
        doc.y = y + 18
        doc.moveTo(X, doc.y).lineTo(X + W, doc.y).lineWidth(0.6).strokeColor(LINE).stroke()
      }
      ensureSpace(doc, 50)
      drawHead()
      for (const row of bl.rows) {
        const hs = row.map((cell, i) => measureRuns(doc, cell, widths[i] - pad * 2, 9.5))
        const rh = Math.max(...hs) + pad * 2
        if (doc.y + rh > bottom(doc)) {
          doc.addPage()
          drawHead()
        }
        const y = doc.y
        let x = X
        row.forEach((cell, i) => {
          writeRuns(doc, cell, x + pad, y + pad, widths[i] - pad * 2, 9.5)
          x += widths[i]
        })
        doc.y = y + rh
        doc.moveTo(X, doc.y).lineTo(X + W, doc.y).lineWidth(0.4).strokeColor(LINE).stroke()
      }
      doc.x = X
      doc.moveDown(0.7)
      continue
    }
  }
}

/** The Engagement Agreement and NDA in one PDF, ready for LibreSign. */
export async function agreementsPdf(engagement: Block[], nda: Block[]): Promise<Buffer> {
  const doc = newDoc('Engagement Agreement and NDA')
  renderBlocks(doc, [...engagement, { k: 'break' }, ...nda])
  return finish(doc, 'Engagement Agreement and NDA')
}

/** A readable copy of the client's questionnaire answers. */
export async function questionnairePdf(meta: { client: string; engagement: string; submitted: string }, sections: SummarySection[]): Promise<Buffer> {
  const doc = newDoc(`Intake Questionnaire — ${meta.client}`)
  const W = contentWidth(doc)
  const X = MARGIN.left
  doc.font(BOLD).fontSize(8).fillColor(GOLD).text('MIDWEST INVESTOR SERVICES', X, doc.y, { characterSpacing: 1.2 })
  doc.moveDown(0.35)
  doc.font(HEAD).fontSize(19).fillColor(NAVY).text('Client Intake Questionnaire', X, doc.y, { width: W })
  doc.moveDown(0.4)
  doc.font(REG).fontSize(10).fillColor(GREY).text(`${meta.client} · ${meta.engagement} · Submitted ${meta.submitted}`, X, doc.y, { width: W })
  doc.moveDown(0.9)

  const lw = W * 0.42
  const vw = W - lw - 12
  for (const s of sections) {
    ensureSpace(doc, 60)
    doc.font(BOLD).fontSize(11).fillColor(NAVY).text(s.title, X, doc.y, { width: W })
    doc.moveDown(0.3)
    doc.moveTo(X, doc.y).lineTo(X + W, doc.y).lineWidth(0.6).strokeColor(LINE).stroke()
    doc.moveDown(0.4)
    if (!s.rows.length) {
      doc.font(REG).fontSize(9.5).fillColor(GREY).text('No answers in this part.', X, doc.y, { width: W })
      doc.moveDown(0.8)
      continue
    }
    for (const [label, value] of s.rows) {
      doc.font(REG).fontSize(9)
      const hl = doc.heightOfString(label, { width: lw, lineGap: 1.5 })
      doc.font(REG).fontSize(9.5)
      const hv = doc.heightOfString(value, { width: vw, lineGap: 1.5 })
      const h = Math.max(hl, hv)
      if (doc.y + h > bottom(doc)) doc.addPage()
      const y = doc.y
      doc.font(REG).fontSize(9).fillColor(GREY).text(label, X, y, { width: lw, lineGap: 1.5 })
      doc.font(REG).fontSize(9.5).fillColor(INK).text(value, X + lw + 12, y, { width: vw, lineGap: 1.5 })
      doc.y = y + h + 6
    }
    doc.x = X
    doc.moveDown(0.6)
  }
  return finish(doc, `Intake Questionnaire · ${meta.client}`)
}
