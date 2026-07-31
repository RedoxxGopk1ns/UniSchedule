/**
 * Inline SVG icon set. Hand-rolled rather than pulled from a library: the app
 * needs eight icons, and a dependency would cost more bundle than it saves
 * (§16 budgets 150KB of initial JS).
 *
 * All icons inherit `currentColor` and default to 1.5px strokes to match the
 * hairline weight of the rest of the UI.
 */
type IconProps = { className?: string }

const base = 'shrink-0'

export function LogoMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`${base} ${className ?? ''}`}>
      <rect
        x="2.25"
        y="3.25"
        width="15.5"
        height="14.5"
        rx="3.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M2.5 7.5h15" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6.5 2v3M13.5 2v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect x="5.75" y="10" width="4.5" height="2" rx="1" fill="currentColor" />
      <rect x="5.75" y="13.5" width="7.5" height="2" rx="1" fill="currentColor" />
    </svg>
  )
}

export function GoogleMark({ className }: IconProps) {
  // Google's brand colours are permitted here — this is their mark, not app UI.
  return (
    <svg viewBox="0 0 18 18" className={`${base} ${className ?? ''}`}>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  )
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 14 14" fill="none" className={`${base} ${className ?? ''}`}>
      <circle cx="6.25" cy="6.25" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9.75 9.75L12.5 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ChevronDown({ className }: IconProps) {
  return (
    <svg viewBox="0 0 12 12" fill="none" className={`${base} ${className ?? ''}`}>
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Tick mark — same path as the Checkbox control, so the shapes match. */
export function Check({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={`${base} ${className ?? ''}`}>
      <path
        d="M3.5 8.5l3 3 6-6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 14 14" fill="none" className={`${base} ${className ?? ''}`}>
      <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M7 4.25V7l1.85 1.85"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function PinIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 14 14" fill="none" className={`${base} ${className ?? ''}`}>
      <path
        d="M7 12.25s4.25-3.6 4.25-6.5a4.25 4.25 0 1 0-8.5 0c0 2.9 4.25 6.5 4.25 6.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="5.75" r="1.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

export function CalendarOutline({ className }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={`${base} ${className ?? ''}`}>
      <rect
        x="5"
        y="8"
        width="30"
        height="27"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M5 16h30" stroke="currentColor" strokeWidth="2" />
      <path
        d="M13 5v6M27 5v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function WarningTriangle({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={`${base} ${className ?? ''}`}>
      <path
        d="M8 2.25L14.75 13.75H1.25L8 2.25z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M8 6.5v3.25"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="8" cy="11.75" r="0.85" fill="currentColor" />
    </svg>
  )
}

export function ArrowUpRight({ className }: IconProps) {
  return (
    <svg viewBox="0 0 12 12" fill="none" className={`${base} ${className ?? ''}`}>
      <path
        d="M3.5 8.5L8.5 3.5M4.5 3.5h4v4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 18 18" fill="none" className={`${base} ${className ?? ''}`}>
      <path
        d="M2.5 5h13M2.5 9h13M2.5 13h13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 18 18" fill="none" className={`${base} ${className ?? ''}`}>
      <path
        d="M4 4l10 10M14 4L4 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
