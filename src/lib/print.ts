/**
 * Opens the browser's print dialog, where "Save as PDF" is the destination on
 * every current desktop browser.
 *
 * This is deliberately not a client-side PDF library. The schedule is a grid of
 * positioned boxes and text — exactly what the browser's own print pipeline
 * renders best, as selectable vector text at the printer's resolution. A
 * canvas-to-image approach would ship ~300kB to produce a blurrier, unsearchable
 * page, and hand-plotting the grid in PDF coordinates would fork the layout.
 *
 * The temporary document.title is what Chrome and Safari pre-fill as the
 * filename, so the saved file is 'UniSchedule — My Schedule.pdf' rather than
 * whatever the tab happened to be called.
 */
export function printSchedule(): void {
  if (typeof window === 'undefined' || typeof window.print !== 'function') return

  const previousTitle = document.title
  document.title = 'UniSchedule — My Schedule'

  const restore = () => {
    document.title = previousTitle
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)

  try {
    window.print()
  } finally {
    // Safari never fires `afterprint`; this covers it without racing the
    // dialog, which is modal in the browsers that do fire the event.
    setTimeout(restore, 1000)
  }
}
