import { useId, useRef, useState, type DragEvent } from 'react'
import { cn } from '../../lib/utils'
import { Button } from './Button'

interface FileDropProps {
  accept?: string
  label: string
  buttonLabel: string
  disabled?: boolean
  onFile: (file: File) => void
}

/**
 * A drop zone that is also a real file input.
 *
 * The visible control is a button, and the `<input type="file">` behind it is
 * hidden but focusable-by-proxy, so keyboard users get the same affordance as
 * anyone dragging a file in — drag and drop alone would be unreachable.
 */
export function FileDrop({
  accept,
  label,
  buttonLabel,
  disabled = false,
  onFile,
}: FileDropProps) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const id = useId()

  function take(files: FileList | null) {
    const file = files?.[0]
    if (file) onFile(file)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setOver(false)
    if (!disabled) take(e.dataTransfer.files)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn(
        'flex flex-col items-center gap-3 rounded-card border border-dashed px-6 py-10 text-center transition-colors',
        over ? 'border-ink bg-surface' : 'border-line-strong',
        disabled && 'opacity-60',
      )}
    >
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      <input
        ref={input}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          take(e.target.files)
          // Clearing lets the same file be chosen twice in a row, which happens
          // whenever an admin re-exports the PDF and imports it again.
          e.target.value = ''
        }}
      />
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        {buttonLabel}
      </Button>
    </div>
  )
}
