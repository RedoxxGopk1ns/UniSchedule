import type { CSSProperties } from 'react'
import { cn } from '../../lib/utils'

/**
 * Shimmer placeholder (§13). The animation is defined in globals.css and
 * cycles #F3F4F6 → #E5E7EB → #F3F4F6 over 1.5s.
 */
export function Skeleton({
  className,
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={cn('animate-shimmer rounded-input bg-subtle', className)}
    />
  )
}
