import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/utils'
import { Check, ChevronDown } from '../ui/icons'

interface FilterPillProps {
  label: string
  options: string[]
  values: string[]
  onChange: (values: string[]) => void
  /**
   * Plural noun for the "2 departments" trigger and the "All days" reset row.
   * Defaults to the label with an -s, which is wrong often enough — "Time of
   * day" — to be worth passing explicitly.
   */
  plural?: string
  /** Optional display text per option; the raw value is still what's stored. */
  renderOption?: (option: string) => string
  /** Collapses to a single choice — used by the year-of-study pill. */
  single?: boolean
}

/**
 * Dropdown trigger pill used for the catalogue filters (§8.3).
 *
 * Multi-select by default: options toggle and the menu stays open, so picking
 * "Tuesday and Thursday" is one interaction rather than two round trips through
 * the trigger. `single` restores the older select-and-close behaviour for
 * dimensions where more than one value is meaningless.
 */
export function FilterPill({
  label,
  options,
  values,
  onChange,
  plural,
  renderOption,
  single = false,
}: FilterPillProps) {
  const many = (plural ?? `${label}s`).toLowerCase()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const toggle = (option: string) => {
    if (single) {
      onChange(values[0] === option ? [] : [option])
      setOpen(false)
      return
    }
    onChange(
      values.includes(option)
        ? values.filter((v) => v !== option)
        : [...values, option],
    )
  }

  // One value reads better named than counted; several would not fit the pill.
  const triggerText =
    values.length === 0
      ? label
      : values.length === 1
        ? (renderOption?.(values[0]!) ?? values[0]!)
        : `${values.length} ${many}`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={values.length > 0 ? `${label}: ${values.join(', ')}` : label}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-pill border bg-canvas px-3 py-1.5 text-[13px] font-medium text-body transition-colors',
          open || values.length > 0
            ? 'border-ink'
            : 'border-line hover:border-line-strong',
        )}
      >
        {triggerText}
        <ChevronDown className="h-3 w-3 text-faded" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable={!single}
          aria-label={label}
          className="animate-pop-in absolute top-full left-0 z-70 mt-1.5 max-h-64 w-max min-w-[200px] overflow-y-auto rounded-card border border-line bg-canvas py-1 shadow-pop"
        >
          <button
            type="button"
            onClick={() => {
              onChange([])
              if (single) setOpen(false)
            }}
            disabled={values.length === 0}
            className={cn(
              'block w-full px-3 py-1.5 text-left text-[13px] transition-colors',
              values.length === 0
                ? 'cursor-default text-faded'
                : 'text-body hover:bg-surface',
            )}
          >
            All {many}
          </button>

          {options.map((option) => {
            const active = values.includes(option)
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => toggle(option)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-surface',
                  active ? 'font-medium text-ink' : 'text-body',
                )}
              >
                <Check
                  className={cn('h-3 w-3 shrink-0', active ? 'opacity-100' : 'opacity-0')}
                />
                {renderOption?.(option) ?? option}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
