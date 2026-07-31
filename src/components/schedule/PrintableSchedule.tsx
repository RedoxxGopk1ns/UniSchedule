import { DAYS, type ScheduleEntry } from '../../lib/data/types'
import { layoutWeek } from '../../lib/layout'
import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  hhmm,
  timeRange,
  toMinutes,
} from '../../lib/time'

/**
 * The print/PDF rendering of the weekly schedule.
 *
 * Deliberately *not* a reuse of `WeeklyGrid`. That component is built for a
 * screen — it collapses to a single day below 768px, carries a current-time
 * marker, opens popovers, and scrolls horizontally. Every one of those is wrong
 * on paper, and suppressing them with print overrides would leave both layouts
 * hostage to each other. The geometry is shared where it matters (`layoutWeek`),
 * the presentation is not.
 *
 * Sizing is in millimetres rather than pixels, because the output medium is a
 * physical page: at 10mm margins an A4 landscape sheet gives us 277 × 190mm.
 *
 * This renders `display: none` on screen; the `@media print` block in
 * globals.css is what reveals it.
 */

/** Height of one 30-minute slot on paper. */
const SLOT_MM = 6.4
const AXIS_MM = 14
const HEADER_MM = 8

interface PrintableScheduleProps {
  entries: ScheduleEntry[]
  /** Shown under the title, when known. */
  studentName?: string
  /** Fixed clock, for deterministic tests. Defaults to now. */
  now?: Date
}

/**
 * The exact span the student is taught, and nothing else: from the start of
 * their earliest lecture to the end of their latest one. Free hours *between*
 * those two points are kept — a gap between a 15:00 finish and a 17:00 start is
 * information, and collapsing it would misrepresent the day — but there is no
 * padding at either end. A student whose first class is at 15:00 gets a page
 * that begins at 15:00, not one that opens on an empty 14:00 row.
 *
 * Hours are floored at the start and ceilinged at the end so a lecture running
 * 12:30–17:30 is fully enclosed by a 12:00–18:00 window.
 */
function usedHourRange(entries: ScheduleEntry[]): [number, number] {
  // Unreachable in practice — the component renders an empty-state message
  // instead of a grid when there is nothing enrolled. Kept so the reduction
  // below can never hand back [Infinity, -Infinity] if that ever changes.
  if (entries.length === 0) return [8, 18]

  let min = Infinity
  let max = -Infinity
  for (const { lecture } of entries) {
    min = Math.min(min, toMinutes(lecture.start_time) / 60)
    max = Math.max(max, toMinutes(lecture.end_time) / 60)
  }

  // The clamps are defensive only: validation keeps lectures inside the grid,
  // but rows predating it must not be able to blow out the page geometry.
  return [
    Math.max(GRID_START_HOUR, Math.floor(min)),
    Math.min(GRID_END_HOUR, Math.ceil(max)),
  ]
}

export function PrintableSchedule({
  entries,
  studentName,
  now = new Date(),
}: PrintableScheduleProps) {
  const positioned = layoutWeek(entries, DAYS)
  const [startHour, endHour] = usedHourRange(entries)
  const slotCount = (endHour - startHour) * 2

  // `layoutWeek` measures from GRID_START_HOUR; the trimmed page starts later.
  const shift = (startHour - GRID_START_HOUR) * 2

  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i)

  const semester = entries[0]?.lecture.semester ?? ''

  // Weekly contact hours — a small thing, but the number a student actually
  // wants when they print this out and pin it up.
  const totalMinutes = entries.reduce(
    (sum, { lecture }) =>
      sum + (toMinutes(lecture.end_time) - toMinutes(lecture.start_time)),
    0,
  )
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10

  const sortedForList = [...entries].sort(
    (a, b) =>
      DAYS.indexOf(a.lecture.day_of_week) - DAYS.indexOf(b.lecture.day_of_week) ||
      toMinutes(a.lecture.start_time) - toMinutes(b.lecture.start_time),
  )

  return (
    <div data-print-root className="print-root">
      <header className="print-head">
        <div>
          <h1 className="print-title">My Schedule</h1>
          <p className="print-sub">
            {[studentName, semester].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="print-meta">
          <span className="print-brand">UniSchedule</span>
          <span>
            {entries.length} {entries.length === 1 ? 'lecture' : 'lectures'} ·{' '}
            {totalHours} h per week
          </span>
          <span>
            Generated{' '}
            {now.toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>
      </header>

      {entries.length === 0 ? (
        <p className="print-empty">No lectures in this schedule yet.</p>
      ) : (
        <>
          <div
            className="print-grid"
            style={{
              gridTemplateColumns: `${AXIS_MM}mm repeat(${DAYS.length}, minmax(0, 1fr))`,
            }}
          >
            {/* Column headers */}
            <div className="print-corner" style={{ height: `${HEADER_MM}mm` }} />
            {DAYS.map((day) => (
              <div
                key={day}
                className="print-dayhead"
                style={{ height: `${HEADER_MM}mm` }}
              >
                {day}
              </div>
            ))}

            {/* Time axis */}
            <div className="print-axis" style={{ height: `${slotCount * SLOT_MM}mm` }}>
              {hours.map((hour, i) => (
                <span
                  key={hour}
                  className="print-hour"
                  style={{ top: `${i * 2 * SLOT_MM}mm` }}
                >
                  {String(hour).padStart(2, '0')}:00
                </span>
              ))}
            </div>

            {/* Day columns */}
            {DAYS.map((day) => (
              <div
                key={day}
                className="print-col"
                style={{ height: `${slotCount * SLOT_MM}mm` }}
              >
                {Array.from({ length: slotCount }, (_, i) => (
                  <div
                    key={i}
                    className={i % 2 === 0 ? 'print-rule print-rule-hour' : 'print-rule'}
                    style={{ top: `${i * SLOT_MM}mm` }}
                  />
                ))}

                {(positioned[day] ?? []).map((item) => {
                  const widthPct = 100 / item.columns
                  const { lecture } = item.entry
                  // A 30-minute block has no room for the room line.
                  const roomy = item.height > 2 && item.columns === 1
                  return (
                    <div
                      key={item.entry.id}
                      className="print-block"
                      style={{
                        top: `${(item.top - shift) * SLOT_MM}mm`,
                        height: `${item.height * SLOT_MM - 0.8}mm`,
                        left: `calc(${item.column * widthPct}% + 0.5mm)`,
                        width: `calc(${widthPct}% - 1mm)`,
                        borderLeftColor: lecture.color_tag ?? '#111111',
                      }}
                    >
                      <span className="print-block-code">{lecture.course_code}</span>
                      <span className="print-block-time">
                        {timeRange(lecture.start_time, lecture.end_time)}
                      </span>
                      {roomy && lecture.room && (
                        <span className="print-block-room">{lecture.room}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          <table className="print-table">
            <caption className="print-caption">Course details</caption>
            <thead>
              <tr>
                <th>Code</th>
                <th>Course</th>
                <th>Day</th>
                <th>Time</th>
                <th>Professor</th>
                <th>Room</th>
              </tr>
            </thead>
            <tbody>
              {sortedForList.map(({ id, lecture }) => (
                <tr key={id}>
                  <td className="print-td-code">{lecture.course_code}</td>
                  <td>{lecture.course_name}</td>
                  <td>{lecture.day_of_week}</td>
                  <td className="print-td-time">
                    {hhmm(lecture.start_time)}–{hhmm(lecture.end_time)}
                  </td>
                  <td>{lecture.professor}</td>
                  <td>{lecture.room ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
