import { useEffect, useRef, useState } from 'react'
import {
  deleteAdminSar,
  getAdminSar,
  getAdminSettings,
  listAdminSars,
  listAdminUsers,
  logout,
  setAdminUserBan,
  type AdminSarDetail,
  type AdminSarStatus,
  type AdminSarSummary,
  type AdminSettingsSummary,
  type AdminUserSummary,
  type ApiUser,
  type ExpiryInput,
  updateAdminSettings,
  verifyAdminUser,
} from '../api'
import { SarContent } from '../components/SarContent'

const EXPIRY_UNITS: ExpiryInput['unit'][] = ['minutes', 'hours', 'days', 'months', 'year']

interface AdminPageProps {
  user: ApiUser
  onLoggedOut: () => void
}

function formatTimestamp(value: string | null): string {
  return value ? new Date(value).toLocaleString() : 'n/a'
}

export function AdminPage({ user, onLoggedOut }: AdminPageProps) {
  const [users, setUsers] = useState<AdminUserSummary[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [userError, setUserError] = useState('')
  const [userLoading, setUserLoading] = useState(true)
  const [userActionBusy, setUserActionBusy] = useState('')

  const [sars, setSars] = useState<AdminSarSummary[]>([])
  const [sarSearch, setSarSearch] = useState('')
  const [sarStatus, setSarStatus] = useState<AdminSarStatus>('all')
  const [sarError, setSarError] = useState('')
  const [sarLoading, setSarLoading] = useState(true)
  const [selectedSar, setSelectedSar] = useState<AdminSarDetail | null>(null)
  const [selectedSarBusy, setSelectedSarBusy] = useState(false)
  const [sarActionBusy, setSarActionBusy] = useState('')
  const [copiedShareId, setCopiedShareId] = useState('')

  const [settings, setSettings] = useState<AdminSettingsSummary | null>(null)
  const [settingsAmount, setSettingsAmount] = useState('365')
  const [settingsUnit, setSettingsUnit] = useState<ExpiryInput['unit']>('days')
  const [settingsError, setSettingsError] = useState('')
  const [settingsBusy, setSettingsBusy] = useState(false)
  const sarDialogRef = useRef<HTMLDialogElement>(null)

  async function refreshUsers(search: string = userSearch) {
    setUserLoading(true)
    try {
      const result = await listAdminUsers(search || undefined)
      setUsers(result.users)
      setUserError('')
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setUserLoading(false)
    }
  }

  async function refreshSars(search: string = sarSearch, status: AdminSarStatus = sarStatus) {
    setSarLoading(true)
    try {
      const result = await listAdminSars({
        search: search || undefined,
        status,
      })
      setSars(result.sars)
      setSarError('')
    } catch (err) {
      setSarError(err instanceof Error ? err.message : 'Failed to load SARs')
    } finally {
      setSarLoading(false)
    }
  }

  async function refreshSettings() {
    try {
      const result = await getAdminSettings()
      setSettings(result.settings)
      setSettingsAmount(String(result.settings.globalExpiryLimit.amount))
      setSettingsUnit(result.settings.globalExpiryLimit.unit)
      setSettingsError('')
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to load settings')
    }
  }

  useEffect(() => {
    void refreshUsers('')
    void refreshSars('', 'all')
    void refreshSettings()
  }, [])

  useEffect(() => {
    if (!copiedShareId) {
      return
    }

    const timeout = window.setTimeout(() => setCopiedShareId(''), 2500)
    return () => window.clearTimeout(timeout)
  }, [copiedShareId])

  useEffect(() => {
    const dialog = sarDialogRef.current
    if (!dialog || !selectedSar || dialog.open) {
      return
    }

    if (typeof dialog.showModal === 'function') {
      dialog.showModal()
    } else {
      dialog.setAttribute('open', '')
    }
  }, [selectedSar])

  const handleLogout = async () => {
    await logout()
    onLoggedOut()
  }

  const userTotals = users.reduce(
    (totals, entry) => {
      totals.totalUsers += 1
      totals.bannedUsers += entry.isBanned ? 1 : 0
      totals.unverifiedUsers += entry.emailVerified ? 0 : 1
      totals.totalSars += entry.sarStats.total
      return totals
    },
    { totalUsers: 0, bannedUsers: 0, unverifiedUsers: 0, totalSars: 0 },
  )

  const handleBanToggle = async (target: AdminUserSummary) => {
    setUserActionBusy(target.id)
    try {
      await setAdminUserBan(target.id, !target.isBanned)
      await refreshUsers()
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setUserActionBusy('')
    }
  }

  const handleVerify = async (target: AdminUserSummary) => {
    setUserActionBusy(target.id)
    try {
      await verifyAdminUser(target.id)
      await refreshUsers()
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Failed to verify user')
    } finally {
      setUserActionBusy('')
    }
  }

  const handleSelectSar = async (sarId: string) => {
    setSelectedSarBusy(true)
    setSelectedSar(null)
    try {
      const result = await getAdminSar(sarId)
      setSelectedSar(result.sar)
      setSarError('')
    } catch (err) {
      setSarError(err instanceof Error ? err.message : 'Failed to load SAR')
    } finally {
      setSelectedSarBusy(false)
    }
  }

  const handleDeleteSar = async (sarId: string) => {
    setSarActionBusy(sarId)
    try {
      await deleteAdminSar(sarId)
      if (selectedSar?.id === sarId) {
        await handleSelectSar(sarId)
      }
      await refreshSars()
    } catch (err) {
      setSarError(err instanceof Error ? err.message : 'Failed to delete SAR')
    } finally {
      setSarActionBusy('')
    }
  }

  const handleCopyShare = async (sharePath: string, sarId: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}${sharePath}`)
    setCopiedShareId(sarId)
  }

  const handleCloseSar = () => {
    const dialog = sarDialogRef.current
    if (dialog && typeof dialog.close === 'function') {
      dialog.close()
    } else {
      dialog?.removeAttribute('open')
    }
    setSelectedSar(null)
  }

  const handleSettingsSave = async () => {
    setSettingsBusy(true)
    try {
      const result = await updateAdminSettings({
        amount: parseInt(settingsAmount, 10),
        unit: settingsUnit,
      })
      setSettings(result.settings)
      setSettingsAmount(String(result.settings.globalExpiryLimit.amount))
      setSettingsUnit(result.settings.globalExpiryLimit.unit)
      setSettingsError('')
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to update settings')
    } finally {
      setSettingsBusy(false)
    }
  }

  return (
    <div className="app-shell admin-shell">
      <section className="app-hero admin-hero" aria-labelledby="page-title">
        <div className="app-hero-top">
          <a className="app-brand" href="/administration" aria-label="shred-after-reading admin home">
            <img src="/design/assets/logo-mark.svg" alt="" />
            <span className="app-wordmark">shred-after-reading-admin</span>
          </a>
          <p className="app-session">
            Signed in as {user.name || user.email}.{' '}
            <a className="btn btn-quiet btn-sm" href="/app">
              User
            </a>
            <button className="btn btn-quiet btn-sm" type="button" onClick={handleLogout}>
              Log out
            </button>
          </p>
        </div>
        <p className="app-kicker">Administration</p>
        <h1 className="app-title" id="page-title">
          Keep users, shared notes, and expiry policy in view.
        </h1>
      </section>

      <section className="action-card admin-card" aria-label="Admin overview">
        <span className="mono-label">Overview</span>
        <div className="grid-stats">
          <article className="item-card">
            <div>
              <span className="mono-label">Users</span>
              <div className="item-title">{userTotals.totalUsers}</div>
            </div>
          </article>
          <article className="item-card">
            <div>
              <span className="mono-label">Banned</span>
              <div className="item-title">{userTotals.bannedUsers}</div>
            </div>
          </article>
          <article className="item-card">
            <div>
              <span className="mono-label">Unverified</span>
              <div className="item-title">{userTotals.unverifiedUsers}</div>
            </div>
          </article>
          <article className="item-card">
            <div>
              <span className="mono-label">SARs tracked</span>
              <div className="item-title">{userTotals.totalSars}</div>
            </div>
          </article>
        </div>
      </section>

      <section className="action-card admin-card" aria-label="Global expiry setting">
        <span className="mono-label">Global expiry limit</span>
        <div className="option-row">
          <input
            className="input"
            style={{ width: '96px' }}
            type="number"
            min={1}
            value={settingsAmount}
            onChange={(event) => setSettingsAmount(event.target.value)}
            aria-label="Global expiry amount"
          />
          <select
            className="select"
            style={{ width: '128px' }}
            value={settingsUnit}
            onChange={(event) => setSettingsUnit(event.target.value as ExpiryInput['unit'])}
            aria-label="Global expiry unit"
          >
            {EXPIRY_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            disabled={settingsBusy || !(parseInt(settingsAmount, 10) > 0)}
            onClick={() => void handleSettingsSave()}
          >
            {settingsBusy ? 'Saving…' : 'Save limit'}
          </button>
        </div>
        {settings && (
          <p className="field-hint">
            Current limit: {settings.globalExpiryLimit.amount} {settings.globalExpiryLimit.unit}.
            Hard cap: {settings.hardCap.amount} {settings.hardCap.unit}.
          </p>
        )}
        {settingsError && (
          <div className="alert alert-danger" role="alert">
            <span className="alert-title">Could not update settings</span>
            <span>{settingsError}</span>
          </div>
        )}
      </section>

      <section className="action-card admin-card" aria-label="Users">
        <div className="option-row">
          <span className="mono-label">Users</span>
          <input
            className="input"
            style={{ width: '240px' }}
            type="search"
            value={userSearch}
            onChange={(event) => setUserSearch(event.target.value)}
            placeholder="Search email or name"
            aria-label="Search users"
          />
          <button className="btn btn-secondary btn-sm" type="button" onClick={() => void refreshUsers()}>
            Search
          </button>
        </div>
        {userError && (
          <div className="alert alert-danger" role="alert">
            <span className="alert-title">Could not load users</span>
            <span>{userError}</span>
          </div>
        )}
        {userLoading ? (
          <p>Loading users…</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>SAR stats</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <strong>{entry.name || entry.email}</strong>
                      <div className="item-sub">{entry.email}</div>
                    </td>
                    <td>
                      {entry.isAdmin && <span className="tag">admin</span>}{' '}
                      {entry.isBanned && <span className="tag">banned</span>}{' '}
                      {!entry.emailVerified && <span className="tag">unverified</span>}
                    </td>
                    <td>
                      {entry.sarStats.total} total, {entry.sarStats.active} active, {entry.sarStats.expired} expired,{' '}
                      {entry.sarStats.deleted} deleted
                    </td>
                    <td>
                      <button
                        className="btn btn-quiet btn-sm"
                        type="button"
                        disabled={userActionBusy === entry.id}
                        onClick={() => void handleBanToggle(entry)}
                      >
                        {entry.isBanned ? 'Unban' : 'Ban'}
                      </button>{' '}
                      {!entry.emailVerified && (
                        <button
                          className="btn btn-secondary btn-sm"
                          type="button"
                          disabled={userActionBusy === entry.id}
                          onClick={() => void handleVerify(entry)}
                        >
                          Verify
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="action-card admin-card" aria-label="SARs">
        <div className="option-row">
          <span className="mono-label">SARs</span>
          <input
            className="input"
            style={{ width: '240px' }}
            type="search"
            value={sarSearch}
            onChange={(event) => setSarSearch(event.target.value)}
            placeholder="Search ID, owner, or content"
            aria-label="Search SARs"
          />
          <select
            className="select"
            style={{ width: '128px' }}
            value={sarStatus}
            onChange={(event) => setSarStatus(event.target.value as AdminSarStatus)}
            aria-label="SAR status filter"
          >
            <option value="all">all</option>
            <option value="active">active</option>
            <option value="expired">expired</option>
            <option value="deleted">deleted</option>
          </select>
          <button className="btn btn-secondary btn-sm" type="button" onClick={() => void refreshSars()}>
            Filter
          </button>
        </div>
        {sarError && (
          <div className="alert alert-danger" role="alert">
            <span className="alert-title">Could not load SARs</span>
            <span>{sarError}</span>
          </div>
        )}
        {sarLoading ? (
          <p>Loading SARs…</p>
        ) : (
          <div className="table-wrap">
            <table className="table admin-sar-table">
              <thead>
                <tr>
                  <th>SAR</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sars.map((sar) => (
                  <tr key={sar.id}>
                    <td className="admin-sar-cell">
                      <button
                        className="admin-sar-trigger admin-sar-id"
                        type="button"
                        title={sar.id}
                        disabled={selectedSarBusy}
                        onClick={() => void handleSelectSar(sar.id)}
                      >
                        {sar.id}
                      </button>
                      <button
                        className="admin-sar-trigger admin-table-main"
                        type="button"
                        title={sar.contentPreview || sar.id}
                        disabled={selectedSarBusy}
                        onClick={() => void handleSelectSar(sar.id)}
                      >
                        {sar.contentPreview || sar.id}
                      </button>
                    </td>
                    <td className="admin-owner-cell">
                      <span className="admin-table-main" title={sar.owner.name || sar.owner.email}>
                        {sar.owner.name || sar.owner.email}
                      </span>
                      <div className="item-sub" title={sar.owner.email}>{sar.owner.email}</div>
                    </td>
                    <td className="admin-status-cell">
                      <span className="tag">{sar.status}</span>{' '}
                      {sar.passwordRequired && <span className="tag">password</span>}{' '}
                      {sar.isMarkdown && <span className="tag">markdown</span>}
                      <div className="item-sub">
                        expires {formatTimestamp(sar.expiresAt)}
                        {sar.deletedAt && (
                          <span className="admin-date-line">deleted {formatTimestamp(sar.deletedAt)}</span>
                        )}
                      </div>
                    </td>
                    <td className="admin-actions-cell">
                      <div className="admin-actions">
                        <button
                          className="btn btn-quiet btn-sm"
                          type="button"
                          onClick={() => void handleCopyShare(sar.sharePath, sar.id)}
                        >
                          {copiedShareId === sar.id ? 'Copied' : 'Copy'}
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          type="button"
                          disabled={sarActionBusy === sar.id || sar.status === 'deleted'}
                          onClick={() => void handleDeleteSar(sar.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedSarBusy && (
        <div className="alert alert-info admin-card" role="status">
          <span className="alert-title">Loading SAR</span>
          <span>Fetching note content…</span>
        </div>
      )}

      <dialog
        className="modal admin-sar-modal"
        ref={sarDialogRef}
        onCancel={(event) => {
          event.preventDefault()
          handleCloseSar()
        }}
        onClose={() => setSelectedSar(null)}
      >
        {selectedSar && (
          <div data-testid="admin-sar-detail">
            <div className="modal-head">
              <h2 className="modal-title">SAR content</h2>
              <button className="modal-close" type="button" onClick={handleCloseSar}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <div className="admin-modal-meta">
                <span className="mono-label">{selectedSar.id}</span>
                <span className="item-sub">
                  {selectedSar.owner.email} · {selectedSar.status}
                </span>
              </div>
              <SarContent content={selectedSar.content} isMarkdown={selectedSar.isMarkdown} />
            </div>
            <div className="modal-foot">
              <a
                className="btn btn-quiet btn-sm"
                href={selectedSar.sharePath}
                target="_blank"
                rel="noreferrer"
              >
                Open public page
              </a>
            </div>
          </div>
        )}
      </dialog>

      <footer className="app-foot admin-foot">
        Admin actions never expose stored SAR passwords. Expired and soft-deleted notes remain visible only during retention.
      </footer>
    </div>
  )
}
