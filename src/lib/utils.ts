import clsx, { type ClassValue } from 'clsx'

/** Class name joiner. Thin alias so components import one thing. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}

/** Initials for the avatar fallback: 'Alex Papadopoulos' -> 'AP'. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}
