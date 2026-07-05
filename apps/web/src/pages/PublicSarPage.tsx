import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import {
  ApiError,
  getPublicSarContent,
  getPublicSarMetadata,
  type SarWithContent,
} from '../api'
import { SarContent } from '../components/SarContent'

type PageState =
  | { status: 'loading' }
  | { status: 'password-required' }
  | { status: 'ready'; sar: SarWithContent }
  | { status: 'gone'; message: string }
  | { status: 'error'; message: string }

export function PublicSarPage() {
  const { sarId = '' } = useParams()
  const [state, setState] = useState<PageState>({ status: 'loading' })
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const meta = await getPublicSarMetadata(sarId)
        if (cancelled) return
        if (meta.sar.passwordRequired) {
          setState({ status: 'password-required' })
          return
        }
        const result = await getPublicSarContent(sarId)
        if (!cancelled) setState({ status: 'ready', sar: result.sar })
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && (err.status === 404 || err.status === 410 || err.status === 422)) {
          setState({
            status: 'gone',
            message:
              err.status === 410
                ? 'This note has expired or was deleted. It is gone.'
                : 'There is no note at this link.',
          })
          return
        }
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Failed to load the note',
        })
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [sarId])

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault()
    setPasswordError('')
    setSubmitting(true)
    try {
      const result = await getPublicSarContent(sarId, password)
      setState({ status: 'ready', sar: result.sar })
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setPasswordError('Incorrect password.')
      } else if (err instanceof ApiError && err.status === 410) {
        setState({ status: 'gone', message: 'This note has expired or was deleted. It is gone.' })
      } else {
        setPasswordError(err instanceof Error ? err.message : 'Failed to load the note')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const copyContent = async () => {
    if (state.status !== 'ready') return
    await navigator.clipboard.writeText(state.sar.content)
    setCopied(true)
  }

  return (
    <div className="app-shell">
      <section className="app-hero" aria-labelledby="page-title">
        <a className="app-brand" href="/" aria-label="shred-after-reading — home">
          <img src="/design/assets/logo-mark.svg" alt="" />
          <span className="app-wordmark">shred-after-reading</span>
        </a>
        <p className="app-kicker">Shared note</p>
        <h1 className="app-title" id="page-title">
          Someone shared a note with you.
        </h1>
        <p className="app-tagline">
          Shared notes expire. Neither the sender nor the operator endorses or verifies this
          content.
        </p>
      </section>

      <section className="action-card" aria-label="Shared note">
        {state.status === 'loading' && <p>Loading…</p>}

        {state.status === 'password-required' && (
          <form onSubmit={submitPassword} aria-label="Unlock note" data-testid="password-prompt">
            <div className="field">
              <label className="label" htmlFor="sar-view-password">
                This note is password protected
              </label>
              <input
                className="input"
                id="sar-view-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <span className="field-hint">Ask the sender for the password.</span>
            </div>
            {passwordError && (
              <div className="alert alert-danger" role="alert">
                <span className="alert-title">Could not unlock</span>
                <span>{passwordError}</span>
              </div>
            )}
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Unlocking…' : 'Unlock'}
            </button>
          </form>
        )}

        {state.status === 'ready' && (
          <div data-testid="sar-view">
            <div className="result-row">
              <span className="mono-label">
                Expires {state.sar.expiresAt ? new Date(state.sar.expiresAt).toLocaleString() : 'never'}
              </span>
              <button className="copy-btn" type="button" onClick={copyContent}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <SarContent content={state.sar.content} isMarkdown={state.sar.isMarkdown} />
          </div>
        )}

        {state.status === 'gone' && (
          <div className="alert alert-info" data-testid="sar-gone">
            <span className="alert-title">Nothing here</span>
            <span>{state.message}</span>
          </div>
        )}

        {state.status === 'error' && (
          <div className="alert alert-danger" role="alert">
            <span className="alert-title">Something went wrong</span>
            <span>{state.message}</span>
          </div>
        )}
      </section>

      <footer className="app-foot">
        Notes expire and are shredded. Operators do not endorse shared content.
      </footer>
    </div>
  )
}
