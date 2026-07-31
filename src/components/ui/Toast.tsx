import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '../../lib/utils'

type ToastKind = 'success' | 'error' | 'warning'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const MAX_VISIBLE = 3
const AUTO_DISMISS_MS = 4000

/** Left stripe carries the status; there are no coloured fills (§20). */
const stripes: Record<ToastKind, string> = {
  success: 'border-l-ink',
  error: 'border-l-danger',
  warning: 'border-l-warn',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const toast = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      const id = nextId.current++
      // Oldest falls off the top once the stack is full.
      setItems((current) => [...current, { id, kind, message }].slice(-MAX_VISIBLE))
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
      )
    },
    [dismiss],
  )

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-100 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role={item.kind === 'error' ? 'alert' : 'status'}
            className={cn(
              'animate-toast-in pointer-events-auto flex items-start gap-3 rounded-card border border-line border-l-[3px] bg-canvas px-4 py-3.5 shadow-pop',
              stripes[item.kind],
            )}
          >
            <span className="flex-1 text-[13px] leading-5 text-ink">
              {item.message}
            </span>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss notification"
              className="-mr-1 rounded p-0.5 text-faded transition-colors hover:text-ink"
            >
              <svg viewBox="0 0 14 14" fill="none" className="h-3.5 w-3.5">
                <path
                  d="M3 3l8 8M11 3l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
