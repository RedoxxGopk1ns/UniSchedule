import { useState } from 'react'
import { cn, initials } from '../../lib/utils'

interface AvatarProps {
  name: string
  src?: string | null
  size?: number
  className?: string
}

/** Circular profile picture, falling back to monogram initials on error. */
export function Avatar({ name, src, size = 28, className }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(src) && !failed

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-subtle text-body select-none',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {showImage ? (
        <img
          src={src!}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="font-medium">{initials(name)}</span>
      )}
    </span>
  )
}
