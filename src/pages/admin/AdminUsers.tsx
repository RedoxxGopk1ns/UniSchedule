import { useEffect, useState } from 'react'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Pill } from '../../components/ui/Pill'
import { Spinner } from '../../components/ui/Spinner'
import { Table, type Column } from '../../components/ui/Table'
import { useToast } from '../../components/ui/Toast'
import { getProvider } from '../../lib/data/provider'
import type { AdminUser, AdminUserDetail } from '../../lib/data/types'
import { copy } from '../../lib/copy'

function CalendarBadge({ user }: { user: AdminUser }) {
  if (!user.calendar.connected) {
    return <span className="text-muted">{copy.adminCalendarNotConnected}</span>
  }
  if (!user.calendar.has_refresh_token) {
    return <span className="text-warn">{copy.adminCalendarNoRefresh}</span>
  }
  return <span className="text-ink">{copy.adminCalendarConnected}</span>
}

export function AdminUsers() {
  const { toast } = useToast()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AdminUserDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setUsers(await getProvider().admin.listUsers())
    } catch (e) {
      toast(e instanceof Error ? e.message : copy.adminError, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function openUser(u: AdminUser) {
    setLoadingDetail(true)
    try {
      setSelected(await getProvider().admin.getUser(u.id))
    } catch (e) {
      toast(e instanceof Error ? e.message : copy.adminError, 'error')
    } finally {
      setLoadingDetail(false)
    }
  }

  const columns: Column<AdminUser>[] = [
    {
      key: 'name',
      header: 'User',
      render: (u) => (
        <span className="inline-flex items-center gap-2">
          <Avatar name={u.full_name ?? u.email ?? '?'} src={u.avatar_url} size={26} />
          <span className="min-w-0">
            <span className="block truncate text-ink">{u.full_name ?? '—'}</span>
            <span className="block truncate text-xs text-faded">{u.email}</span>
          </span>
        </span>
      ),
    },
    { key: 'year', header: 'Year', render: (u) => u.study_year ?? '—', className: 'text-center' },
    { key: 'cal', header: 'Calendar', render: (u) => <CalendarBadge user={u} /> },
    { key: 'enr', header: 'Enrolled', render: (u) => u.enrolled_count, className: 'text-center' },
    {
      key: 'role',
      header: 'Role',
      render: (u) => (u.role === 'admin' ? <Pill>Admin</Pill> : <span className="text-muted">—</span>),
    },
  ]

  return (
    <div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Spinner /> Loading…
        </div>
      ) : (
        <Table columns={columns} rows={users} rowKey={(u) => u.id} onRowClick={openUser} />
      )}

      {(selected || loadingDetail) && (
        <UserDetailModal
          user={selected}
          loading={loadingDetail}
          onClose={() => setSelected(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}

function UserDetailModal({
  user,
  loading,
  onClose,
  onChanged,
}: {
  user: AdminUserDetail | null
  loading: boolean
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function act(fn: () => Promise<void>, ok: string) {
    setBusy(true)
    try {
      await fn()
      toast(ok, 'success')
      await onChanged()
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : copy.adminError, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy="user-detail-title" className="max-w-[560px]">
      {loading || !user ? (
        <div className="flex items-center gap-2 px-5 py-8 text-sm text-muted">
          <Spinner /> Loading…
        </div>
      ) : confirmDelete ? (
        <div className="px-5 py-5">
          <h2 id="user-detail-title" className="text-[17px] font-semibold text-ink">
            {copy.adminDeleteUserTitle}
          </h2>
          <p className="mt-2 text-sm text-body">
            {copy.adminDeleteUserBody(user.full_name ?? user.email ?? 'This user')}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              {copy.adminCancel}
            </Button>
            <Button
              className="bg-danger text-white hover:bg-danger"
              loading={busy}
              onClick={() =>
                act(() => getProvider().admin.deleteUser(user.id), copy.adminUserDeleted)
              }
            >
              {copy.adminDeleteUser}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 border-b border-line px-5 py-4">
            <Avatar name={user.full_name ?? user.email ?? '?'} src={user.avatar_url} size={40} />
            <div className="min-w-0">
              <h2 id="user-detail-title" className="truncate text-[17px] font-semibold text-ink">
                {user.full_name ?? '—'}
              </h2>
              <p className="truncate text-sm text-faded">{user.email}</p>
            </div>
            {user.role === 'admin' && <Pill className="ml-auto">Admin</Pill>}
          </div>

          <div className="max-h-[60vh] space-y-5 overflow-y-auto px-5 py-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted">Year of study</dt>
                <dd className="text-ink">{user.study_year ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted">Google Calendar</dt>
                <dd className="text-ink">
                  <CalendarBadge user={user} />
                </dd>
              </div>
              <div>
                <dt className="text-muted">Passed courses</dt>
                <dd className="text-ink">{user.passed_count}</dd>
              </div>
              <div>
                <dt className="text-muted">Signed up</dt>
                <dd className="text-ink">{new Date(user.created_at).toLocaleDateString()}</dd>
              </div>
            </dl>

            <div>
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">
                {copy.adminUserSchedule} ({user.schedule.length})
              </h3>
              {user.schedule.length === 0 ? (
                <p className="mt-2 text-sm text-muted">{copy.statNoData}</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {user.schedule.map((e) => (
                    <li key={e.id} className="flex justify-between gap-3">
                      <span className="truncate text-ink">
                        <span className="font-medium">{e.lecture.course_code}</span>{' '}
                        {e.lecture.course_name}
                      </span>
                      <span className="shrink-0 text-faded">
                        {e.lecture.day_of_week.slice(0, 3)} {e.lecture.start_time.slice(0, 5)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">
            <Button
              variant="outline"
              loading={busy}
              onClick={() =>
                act(
                  () =>
                    getProvider().admin.setUserRole(
                      user.id,
                      user.role === 'admin' ? null : 'admin',
                    ),
                  copy.adminRoleUpdated,
                )
              }
            >
              {user.role === 'admin' ? copy.adminRevokeAdmin : copy.adminGrantAdmin}
            </Button>
            <Button
              variant="outline"
              loading={busy}
              disabled={!user.calendar.connected}
              onClick={() =>
                act(() => getProvider().admin.revokeUserTokens(user.id), copy.adminTokensRevoked)
              }
            >
              {copy.adminRevokeTokens}
            </Button>
            <Button
              className="bg-danger text-white hover:bg-danger"
              onClick={() => setConfirmDelete(true)}
            >
              {copy.adminDeleteUser}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
