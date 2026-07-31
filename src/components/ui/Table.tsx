import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface Column<T> {
  /** Stable key for the column. */
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  /** Extra classes for both the header and body cells (e.g. text-right). */
  className?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  /** Shown in place of the body when there are no rows. */
  empty?: ReactNode
  /** Called when a row is clicked — makes the whole row a button. */
  onRowClick?: (row: T) => void
}

/**
 * Generic data table for the admin screens (no such primitive existed before).
 * Horizontally scrollable inside its own container so a wide table never makes
 * the page scroll sideways.
 */
export function Table<T>({ columns, rows, rowKey, empty, onRowClick }: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-panel border border-line">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-faint text-left">
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  'px-3 py-2.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted',
                  c.className,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-10 text-center text-sm text-muted">
                {empty ?? 'Nothing here yet.'}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-line-soft last:border-b-0',
                  onRowClick && 'cursor-pointer hover:bg-faint',
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-3 py-2.5 text-body', c.className)}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
