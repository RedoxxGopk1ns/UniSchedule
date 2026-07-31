import type { ReactNode, SelectHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
import { ChevronDown } from './icons'

interface Option {
  value: string
  label: string
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: ReactNode
  error?: string | null
  options: Option[]
  /** Optional leading placeholder rendered as a disabled first option. */
  placeholder?: string
}

/** Labelled native select, styled to match Input. */
export function Select({
  label,
  error,
  options,
  placeholder,
  className,
  id,
  ...rest
}: SelectProps) {
  const selectId = id ?? (typeof label === 'string' ? label : undefined)
  return (
    <label className="block" htmlFor={selectId}>
      {label && <span className="mb-1 block text-[13px] font-medium text-body">{label}</span>}
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            'w-full appearance-none rounded-input border bg-canvas px-3 py-2 pr-9 text-sm text-ink outline-none transition-colors focus:border-ink',
            error ? 'border-danger' : 'border-line-strong',
            className,
          )}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faded" />
      </div>
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  )
}
