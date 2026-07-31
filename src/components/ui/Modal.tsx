import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  labelledBy: string
  children: ReactNode
  className?: string
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Overlay dialog with the §15 accessibility contract: focus moves in on open,
 * Tab is trapped inside, Escape closes, and focus returns to the trigger.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  children,
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    restoreTo.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    // Not `first?.focus() ?? panel?.focus()`: focus() returns undefined, so the
    // right-hand side always ran and the panel stole focus back off the control
    // that had just received it.
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    if (first) first.focus()
    else panel?.focus()

    // The page behind a modal must not scroll.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel) return

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusable.length === 0) return

      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      restoreTo.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-90 flex items-center justify-center overflow-y-auto p-4"
      style={{ backgroundColor: 'rgb(0 0 0 / 0.32)', backdropFilter: 'blur(2px)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={cn(
          'my-auto w-full max-w-[560px] rounded-modal bg-canvas shadow-modal outline-none',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
