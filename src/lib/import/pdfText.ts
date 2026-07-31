/**
 * The only module in the project that touches pdfjs-dist.
 *
 * Everything downstream (timetableParser, calendarParser) consumes the plain
 * `PdfPage[]` shape defined here, which is why those parsers are pure functions
 * testable from a JSON fixture with no PDF library loaded at all — see
 * scripts/dump-pdf-pages.mjs and src/lib/import/__fixtures__.
 *
 * pdfjs is imported dynamically so the ~1 MB library is a separate chunk that
 * only the admin import screen pulls in. The worker is resolved through Vite's
 * `new URL(..., import.meta.url)` so it is bundled locally: no CDN, and the
 * offline demo posture holds.
 */

/**
 * One positioned run of text.
 *
 * Coordinates are in PDF points with a **top-left origin** — pdfjs reports y
 * from the bottom, which is inverted here so that "further down the page" means
 * "larger y" and the parsers can read like the table looks.
 */
export interface PdfItem {
  text: string
  x: number
  y: number
  w: number
  h: number
}

export interface PdfPage {
  width: number
  height: number
  items: PdfItem[]
}

/** Reads every page of a PDF into positioned text runs. */
export async function extractPages(file: File | ArrayBuffer): Promise<PdfPage[]> {
  const pdfjs = await import('pdfjs-dist')

  pdfjs.GlobalWorkerOptions.workerPort = new Worker(
    new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
    { type: 'module' },
  )

  const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data) })
  const doc = await loadingTask.promise

  const pages: PdfPage[] = []
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      const viewport = page.getViewport({ scale: 1 })
      const content = await page.getTextContent()

      const items: PdfItem[] = []
      for (const raw of content.items) {
        // pdfjs yields TextMarkedContent entries too; those carry no geometry.
        if (!('str' in raw)) continue
        const text = raw.str.replace(/\s+/g, ' ').trim()
        if (text === '') continue
        // transform is [a, b, c, d, e, f]: e is x, f is the *baseline* y from
        // the bottom of the page. Flip it and lift by the glyph height so y is
        // the top edge, measured downwards.
        const height = raw.height || Math.abs(raw.transform[3]) || 0
        items.push({
          text,
          x: raw.transform[4],
          y: viewport.height - raw.transform[5] - height,
          w: raw.width || 0,
          h: height,
        })
      }

      pages.push({ width: viewport.width, height: viewport.height, items })
      page.cleanup()
    }
  } finally {
    // In pdfjs 6 destroy() lives on the loading task, not the document.
    await loadingTask.destroy()
  }

  return pages
}

/** Flattens every page to plain text — used only to sniff which PDF this is. */
export function pageText(pages: PdfPage[]): string {
  return pages.map((p) => p.items.map((i) => i.text).join(' ')).join('\n')
}
