import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'outline' | 'ghost'
type Shape = 'pill' | 'rounded'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  shape?: Shape
  loading?: boolean
  children: ReactNode
}

/**
 * The only button in the app.
 *
 * `primary` is the filled black pill from §8.1 — black is the sole accent
 * colour in the entire product (§20 forbids blue, purple, and gradients).
 */
const variants: Record<Variant, string> = {
  primary:
    'bg-ink text-white hover:bg-ink-hover disabled:opacity-50 disabled:hover:bg-ink',
  outline:
    'bg-canvas text-body border border-line-strong hover:border-ink hover:text-ink hover:shadow-btn-hover disabled:opacity-50 disabled:hover:border-line-strong disabled:hover:shadow-none',
  ghost: 'text-muted hover:text-ink',
}

export function Button({
  variant = 'primary',
  shape = 'rounded',
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap px-4 py-2 text-sm font-medium transition-all duration-150',
        'disabled:cursor-not-allowed',
        shape === 'pill' ? 'rounded-pill' : 'rounded-btn',
        variants[variant],
        loading && 'opacity-70',
        className,
      )}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}
