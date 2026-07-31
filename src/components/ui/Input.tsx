import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
  /** Shown in danger colour under the field when set. */
  error?: string | null
}

/**
 * Labelled text input for the admin forms. The app had no generic input before
 * (only the bespoke SearchBar), so this is the shared primitive — styled on the
 * existing tokens, black focus border, no new accent colour.
 */
export function Input({ label, error, className, id, ...rest }: InputProps) {
  const inputId = id ?? (typeof label === 'string' ? label : undefined)
  return (
    <label className="block" htmlFor={inputId}>
      {label && <span className="mb-1 block text-[13px] font-medium text-body">{label}</span>}
      <input
        id={inputId}
        className={cn(
          'w-full rounded-input border bg-canvas px-3 py-2 text-sm text-ink outline-none transition-colors',
          'placeholder:text-faded focus:border-ink',
          error ? 'border-danger' : 'border-line-strong hover:border-line-strong',
          className,
        )}
        {...rest}
      />
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  )
}
