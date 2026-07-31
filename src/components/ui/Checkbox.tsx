import { cn } from '../../lib/utils'

interface CheckboxProps {
  checked: boolean
  /** Purely presentational — the parent row owns the click handler. */
  className?: string
}

/**
 * 16×16 custom checkbox (§8.3): unchecked is a 1.5px grey outline, checked is a
 * solid black square with a white tick. No blue, no native control styling.
 */
export function Checkbox({ checked, className }: CheckboxProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] transition-colors duration-150',
        checked ? 'bg-ink' : 'border-[1.5px] border-line-strong bg-canvas',
        className,
      )}
    >
      {checked && (
        <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3">
          <path
            d="M3.5 8.5l3 3 6-6.5"
            stroke="var(--color-canvas)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  )
}
