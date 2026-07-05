import { Fragment, useEffect, useRef, useState } from 'react'
import {
  changeSarExpiry,
  deleteSar,
  getOwnedSar,
  removeSarPassword,
  setSarPassword,
  type ExpiryInput,
  type OwnedSar,
  type SarWithContent,
} from '../api'
import { SarContent } from './SarContent'
import { shareUrlFor } from './SarComposer'

const EXPIRY_UNITS: ExpiryInput['unit'][] = ['minutes', 'hours', 'days', 'months', 'year']

interface SarListProps {
  sars: OwnedSar[]
  onChanged: () => void
}

type OpenAction = { sarId: string; kind: 'expiry' | 'password' } | null
type ShareNotice = { sarId: string; url: string } | null

export function SarList({ sars, onChanged }: SarListProps) {
  const [openAction, setOpenAction] = useState<OpenAction>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [shareNotice, setShareNotice] = useState<ShareNotice>(null)
  const [selectedSar, setSelectedSar] = useState<SarWithContent | null>(null)
  const [selectedSarBusy, setSelectedSarBusy] = useState(false)
  const [expiryAmount, setExpiryAmount] = useState('7')
  const [expiryUnit, setExpiryUnit] = useState<ExpiryInput['unit']>('days')
  const [newPassword, setNewPassword] = useState('')
  const sarDialogRef = useRef<HTMLDialogElement>(null)
  const actionDialogRef = useRef<HTMLDialogElement>(null)
  const shareDialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = actionDialogRef.current
    if (!dialog || !openAction || dialog.open) {
      return
    }

    if (typeof dialog.showModal === 'function') {
      dialog.showModal()
    } else {
      dialog.setAttribute('open', '')
    }
  }, [openAction])

  useEffect(() => {
    const dialog = shareDialogRef.current
    if (!dialog || !shareNotice || dialog.open) {
      return
    }

    if (typeof dialog.showModal === 'function') {
      dialog.showModal()
    } else {
      dialog.setAttribute('open', '')
    }

    const timeout = window.setTimeout(() => closeShareNotice(), 3000)
    return () => window.clearTimeout(timeout)
  }, [shareNotice])

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

  const activeActionSar = openAction ? sars.find((sar) => sar.id === openAction.sarId) : null

  const closeAction = () => {
    const dialog = actionDialogRef.current
    if (dialog && typeof dialog.close === 'function') {
      dialog.close()
    } else {
      dialog?.removeAttribute('open')
    }
    setOpenAction(null)
    setNewPassword('')
  }

  function closeShareNotice() {
    const dialog = shareDialogRef.current
    if (dialog && typeof dialog.close === 'function') {
      dialog.close()
    } else {
      dialog?.removeAttribute('open')
    }
    setShareNotice(null)
  }

  const run = async (action: () => Promise<unknown>) => {
    setError('')
    setBusy(true)
    try {
      await action()
      closeAction()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const copyShare = async (sarId: string) => {
    const url = shareUrlFor(sarId)
    try {
      await navigator.clipboard.writeText(url)
      setShareNotice({ sarId, url })
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy share link')
    }
  }

  const openSar = async (sarId: string) => {
    setError('')
    setSelectedSarBusy(true)
    setSelectedSar(null)
    try {
      const result = await getOwnedSar(sarId)
      setSelectedSar(result.sar)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load note')
    } finally {
      setSelectedSarBusy(false)
    }
  }

  const closeSar = () => {
    const dialog = sarDialogRef.current
    if (dialog && typeof dialog.close === 'function') {
      dialog.close()
    } else {
      dialog?.removeAttribute('open')
    }
    setSelectedSar(null)
  }

  if (sars.length === 0) {
    return <p data-testid="sar-list-empty">No active notes. Create one above.</p>
  }

  return (
    <div data-testid="sar-list">
      {error && (
        <div className="alert alert-danger" role="alert">
          <span className="alert-title">Action failed</span>
          <span>{error}</span>
        </div>
      )}

      {selectedSarBusy && (
        <div className="alert alert-info" role="status">
          <span className="alert-title">Loading note</span>
          <span>Fetching note content…</span>
        </div>
      )}

      <div className="table-wrap">
        <table className="table admin-sar-table user-sar-table">
          <thead>
            <tr>
              <th>SAR</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sars.map((sar, index) => {
              const rowTone = index % 2 === 1 ? ' is-striped' : ''

              return (
              <Fragment key={sar.id}>
                <tr className={`user-sar-data-row${rowTone}`} data-testid={`sar-item-${sar.id}`}>
                  <td className="admin-sar-cell">
                    <button
                      className="admin-sar-trigger admin-sar-id"
                      type="button"
                      title={sar.id}
                      disabled={selectedSarBusy}
                      onClick={() => void openSar(sar.id)}
                    >
                      {sar.id}
                    </button>
                    <button
                      className="admin-sar-trigger admin-table-main"
                      type="button"
                      title={sar.contentPreview || 'Untitled note'}
                      disabled={selectedSarBusy}
                      onClick={() => void openSar(sar.id)}
                    >
                      {sar.contentPreview || 'Untitled note'}
                    </button>
                  </td>
                  <td className="admin-status-cell">
                    <span className="tag">active</span>{' '}
                    {sar.passwordRequired && <span className="tag">password</span>}{' '}
                    {sar.isMarkdown && <span className="tag">markdown</span>}
                    <div className="item-sub">
                      expires {sar.expiresAt ? new Date(sar.expiresAt).toLocaleString() : 'never'}
                    </div>
                  </td>
                  <td className="admin-actions-cell">
                    <div className="admin-actions user-sar-actions">
                      <button
                        className="btn btn-danger btn-sm"
                        type="button"
                        disabled={busy}
                        onClick={() => run(() => deleteSar(sar.id))}
                      >
                        Delete
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        type="button"
                        onClick={() => {
                          setOpenAction({ sarId: sar.id, kind: 'expiry' })
                          setError('')
                        }}
                      >
                        Expiry
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        type="button"
                        onClick={() => {
                          setOpenAction({ sarId: sar.id, kind: 'password' })
                          setError('')
                        }}
                      >
                        Password
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        type="button"
                        onClick={() => void copyShare(sar.id)}
                      >
                        Share
                      </button>
                    </div>
                  </td>
                </tr>
              </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <dialog
        className="modal user-action-modal"
        ref={shareDialogRef}
        onCancel={(event) => {
          event.preventDefault()
          closeShareNotice()
        }}
        onClose={() => setShareNotice(null)}
      >
        {shareNotice && (
          <div>
            <div className="modal-head">
              <h2 className="modal-title">Share link copied</h2>
              <button className="modal-close" type="button" onClick={closeShareNotice}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <p>The share link is on your clipboard.</p>
              <p className="item-sub">{shareNotice.url}</p>
            </div>
          </div>
        )}
      </dialog>

      <dialog
        className="modal user-action-modal"
        ref={actionDialogRef}
        onCancel={(event) => {
          event.preventDefault()
          closeAction()
        }}
        onClose={() => {
          setOpenAction(null)
          setNewPassword('')
        }}
      >
        {activeActionSar && openAction && (
          <div>
            <div className="modal-head">
              <h2 className="modal-title">
                {openAction.kind === 'expiry' ? 'Change expiry' : 'Password'}
              </h2>
              <button className="modal-close" type="button" onClick={closeAction}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <div className="admin-modal-meta">
                <span className="mono-label">{activeActionSar.id}</span>
                <span className="item-sub">{activeActionSar.contentPreview || 'Untitled note'}</span>
              </div>

              {openAction.kind === 'expiry' && (
                <form
                  className="option-row"
                  data-testid="expiry-editor"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void run(() =>
                      changeSarExpiry(activeActionSar.id, {
                        amount: parseInt(expiryAmount, 10),
                        unit: expiryUnit,
                      }),
                    )
                  }}
                >
                  <span className="mono-label">New expiry</span>
                  <input
                    className="input"
                    style={{ width: '96px' }}
                    type="number"
                    min={1}
                    value={expiryAmount}
                    onChange={(e) => setExpiryAmount(e.target.value)}
                    aria-label="New expiry amount"
                  />
                  <select
                    className="select"
                    style={{ width: '128px' }}
                    value={expiryUnit}
                    onChange={(e) => setExpiryUnit(e.target.value as ExpiryInput['unit'])}
                    aria-label="New expiry unit"
                  >
                    {EXPIRY_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-primary btn-sm"
                    type="submit"
                    disabled={busy || !(parseInt(expiryAmount, 10) > 0)}
                  >
                    Save expiry
                  </button>
                </form>
              )}

              {openAction.kind === 'password' && (
                <form
                  className="option-row"
                  data-testid="password-editor"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void run(() => setSarPassword(activeActionSar.id, newPassword))
                  }}
                >
                  <input
                    className="input"
                    style={{ width: '220px' }}
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    aria-label="New SAR password"
                    autoComplete="new-password"
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    type="submit"
                    disabled={busy || newPassword.length === 0}
                  >
                    Save password
                  </button>
                  {activeActionSar.passwordRequired && (
                    <button
                      className="btn btn-danger btn-sm"
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => removeSarPassword(activeActionSar.id))}
                    >
                      Remove password
                    </button>
                  )}
                </form>
              )}
            </div>
          </div>
        )}
      </dialog>

      <dialog
        className="modal admin-sar-modal"
        ref={sarDialogRef}
        onCancel={(event) => {
          event.preventDefault()
          closeSar()
        }}
        onClose={() => setSelectedSar(null)}
      >
        {selectedSar && (
          <div data-testid="owned-sar-detail">
            <div className="modal-head">
              <h2 className="modal-title">Note content</h2>
              <button className="modal-close" type="button" onClick={closeSar}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <div className="admin-modal-meta">
                <span className="mono-label">{selectedSar.id}</span>
                <span className="item-sub">
                  {selectedSar.isMarkdown ? 'Markdown' : 'Plain text'}
                  {' · expires '}
                  {selectedSar.expiresAt ? new Date(selectedSar.expiresAt).toLocaleString() : 'never'}
                </span>
              </div>
              <SarContent content={selectedSar.content} isMarkdown={selectedSar.isMarkdown} />
            </div>
            <div className="modal-foot">
              <a
                className="btn btn-quiet btn-sm"
                href={shareUrlFor(selectedSar.id)}
                target="_blank"
                rel="noreferrer"
              >
                Open public page
              </a>
            </div>
          </div>
        )}
      </dialog>
    </div>
  )
}
