import { cn } from '../../lib/utils'
import { Check } from '../ui/icons'

interface TogglePillProps {
  label: string
  active: boolean
  onChange: (active: boolean) => void
  disabled?: boolean
}

/**
 * On/off filter pill (§8.3) — the boolean sibling of FilterPill. Uses
 * aria-pressed rather than a checkbox role: it is a toggle button, and screen
 * readers should announce it as one.
 */
export function TogglePill({ label, active, onChange, disabled }: TogglePillProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={() => onChange(!active)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[13px] font-medium transition-colors',
        active
          ? 'border-ink bg-ink text-white'
          : 'border-line bg-canvas text-body hover:border-line-strong',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      {active && <Check className="h-3 w-3 shrink-0" />}
      {label}
    </button>
  )
}
