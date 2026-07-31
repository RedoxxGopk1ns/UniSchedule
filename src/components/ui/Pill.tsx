import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

/** Neutral tag pill — semester label, course codes, countdown, hero tag. */
export function Pill({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill bg-subtle px-2.5 py-1 text-xs font-medium text-body',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** 'Spring 2026' in the authenticated header (§8.2). */
export function SemesterPill({ semester }: { semester: string }) {
  return <Pill className="text-[13px]">{semester}</Pill>
}
