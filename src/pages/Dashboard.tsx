import { useNavigate } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { EmptySchedule } from '../components/schedule/EmptySchedule'
import { GridSkeleton } from '../components/schedule/GridSkeleton'
import { OutOfTerm } from '../components/schedule/OutOfTerm'
import { PrintableSchedule } from '../components/schedule/PrintableSchedule'
import { WeekChanges } from '../components/schedule/WeekChanges'
import { WeeklyGrid } from '../components/schedule/WeeklyGrid'
import { UpcomingSidebar } from '../components/sidebar/UpcomingSidebar'
import { Button } from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { useSchedule } from '../hooks/useSchedule'
import { useWeek } from '../hooks/useWeek'
import { copy } from '../lib/copy'
import { occurrencesToEntries } from '../lib/occurrences'
import { printSchedule } from '../lib/print'

/** The core screen (§8.2): weekly grid plus today's upcoming lectures. */
export function Dashboard() {
  const { entries, loading, syncing } = useSchedule()
  const { session } = useAuth()
  const navigate = useNavigate()

  // This week resolved against the academic calendar and any one-off changes
  // (§22). In an ordinary week these are the plain entries.
  const { occurrences, changes, outOfTerm } = useWeek()
  const weekEntries = occurrencesToEntries(occurrences)

  return (
    <>
      {/* Swapped out wholesale when printing — see the @media print block. */}
      <div data-screen-shell className="min-h-dvh bg-canvas">
        <Header />

        <main className="mx-auto max-w-[1180px] px-5 py-8 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-ink">
              {copy.scheduleTitle}
            </h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={printSchedule}
                disabled={loading || entries.length === 0}
              >
                {copy.exportPdf}
              </Button>
              <Button
                variant="outline"
                loading={syncing}
                onClick={() => navigate('/edit-schedule')}
              >
                {syncing ? copy.syncing : copy.editSchedule}
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0">
              {loading ? (
                <GridSkeleton />
              ) : entries.length === 0 ? (
                <EmptySchedule />
              ) : outOfTerm ? (
                <OutOfTerm />
              ) : (
                <>
                  <WeekChanges changes={changes} />
                  <WeeklyGrid entries={weekEntries} />
                </>
              )}
            </div>

            <UpcomingSidebar occurrences={occurrences} />
          </div>
        </main>
      </div>

      <PrintableSchedule entries={entries} studentName={session?.user.full_name} />
    </>
  )
}
