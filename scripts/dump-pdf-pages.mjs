/**
 * Dumps the positioned text of a PDF to the `PdfPage[]` JSON that
 * src/lib/import/pdfText.ts produces in the browser.
 *
 * The point is testing: with a fixture on disk, timetableParser and
 * calendarParser can be exercised against the university's real page geometry
 * without pdfjs being loaded in the test environment at all.
 *
 * Run with:
 *   node scripts/dump-pdf-pages.mjs <input.pdf> <output.json>
 *
 * Regenerate both fixtures:
 *   npm run import:fixtures
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [, , input, output] = process.argv
if (!input || !output) {
  console.error('Usage: node scripts/dump-pdf-pages.mjs <input.pdf> <output.json>')
  process.exit(1)
}

// The legacy build is the one that runs under Node without a DOM.
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

const { readFileSync } = await import('node:fs')
const data = new Uint8Array(readFileSync(resolve(input)))
const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true })
const doc = await loadingTask.promise

const pages = []
for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n)
  const viewport = page.getViewport({ scale: 1 })
  const content = await page.getTextContent()

  const items = []
  for (const raw of content.items) {
    if (!('str' in raw)) continue
    const text = raw.str.replace(/\s+/g, ' ').trim()
    if (text === '') continue
    const height = raw.height || Math.abs(raw.transform[3]) || 0
    items.push({
      text,
      // Rounded: the fixtures are read by humans in diffs, and a tenth of a
      // point never changes a clustering decision.
      x: round(raw.transform[4]),
      y: round(viewport.height - raw.transform[5] - height),
      w: round(raw.width || 0),
      h: round(height),
    })
  }

  pages.push({ width: round(viewport.width), height: round(viewport.height), items })
  page.cleanup()
}
// In pdfjs 6 destroy() lives on the loading task, not the document.
await loadingTask.destroy()

function round(n) {
  return Math.round(n * 100) / 100
}

writeFileSync(resolve(output), `${JSON.stringify(pages, null, 2)}\n`, 'utf8')
const total = pages.reduce((sum, p) => sum + p.items.length, 0)
console.log(`Wrote ${pages.length} page(s), ${total} text runs to ${output}`)
