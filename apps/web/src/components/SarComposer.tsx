import { useState } from 'react'
import type { FormEvent } from 'react'
import { createSar, type ExpiryInput, type SarMetadata } from '../api'
import { SarContent } from './SarContent'

const EXPIRY_UNITS: ExpiryInput['unit'][] = ['minutes', 'hours', 'days', 'months', 'year']

interface SarComposerProps {
  onCreated: (sar: SarMetadata) => void
}

export function shareUrlFor(sarId: string): string {
  return `${window.location.origin}/sar/${sarId}`
}

export function SarComposer({ onCreated }: SarComposerProps) {
  const [content, setContent] = useState('')
  const [isMarkdown, setIsMarkdown] = useState(false)
  const [markdownView, setMarkdownView] = useState<'raw' | 'preview'>('raw')
  const [passwordEnabled, setPasswordEnabled] = useState(false)
  const [password, setPassword] = useState('')
  const [expiryAmount, setExpiryAmount] = useState('7')
  const [expiryUnit, setExpiryUnit] = useState<ExpiryInput['unit']>('days')
  const [expanded, setExpanded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [createdSar, setCreatedSar] = useState<SarMetadata | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    setCreatedSar(null)
    setCopied(false)
    try {
      const result = await createSar({
        content,
        isMarkdown,
        password: passwordEnabled && password ? password : undefined,
        expiry: { amount: parseInt(expiryAmount, 10), unit: expiryUnit },
      })
      setCreatedSar(result.sar)
      onCreated(result.sar)
      setContent('')
      setPassword('')
      setPasswordEnabled(false)
      setMarkdownView('raw')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create SAR')
    } finally {
      setSubmitting(false)
    }
  }

  const copyShareUrl = async () => {
    if (!createdSar) return
    await navigator.clipboard.writeText(shareUrlFor(createdSar.id))
    setCopied(true)
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Create a SAR">
      {isMarkdown && (
        <div className="tab-list composer-tab-list" role="tablist" aria-label="Markdown editor view">
          <button
            type="button"
            role="tab"
            aria-selected={markdownView === 'raw'}
            className={markdownView === 'raw' ? 'tab active' : 'tab'}
            onClick={() => setMarkdownView('raw')}
          >
            Raw
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={markdownView === 'preview'}
            className={markdownView === 'preview' ? 'tab active' : 'tab'}
            onClick={() => setMarkdownView('preview')}
          >
            Preview
          </button>
        </div>
      )}

      {!isMarkdown || markdownView === 'raw' ? (
        <div className="field">
          <label className="label" htmlFor="sar-content">
            Note
          </label>
          <textarea
            className="textarea"
            id="sar-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setExpanded(true)}
            rows={expanded ? 12 : 4}
            placeholder="Paste or write the text to share…"
            required
          />
          <div className="composer-note-meta">
            <label className="switch composer-inline-switch">
              <input
                type="checkbox"
                checked={isMarkdown}
                onChange={(e) => {
                  setIsMarkdown(e.target.checked)
                  setMarkdownView('raw')
                }}
              />
              <span className="switch-track" aria-hidden="true"></span>
              Markdown
            </label>
            <span className="field-hint composer-note-hint">UTF-8 text, up to 1 MiB.</span>
          </div>
        </div>
      ) : (
        <div className="field">
          <span className="label">Preview</span>
          <div className="tab-panel composer-preview-panel" data-testid="markdown-preview">
            <SarContent content={content} isMarkdown />
          </div>
          <div className="composer-note-meta">
            <label className="switch composer-inline-switch">
              <input
                type="checkbox"
                checked={isMarkdown}
                onChange={(e) => {
                  setIsMarkdown(e.target.checked)
                  setMarkdownView('raw')
                }}
              />
              <span className="switch-track" aria-hidden="true"></span>
              Markdown
            </label>
            <span className="field-hint composer-note-hint">
              Preview uses the same safe rendering as the shared note page.
            </span>
          </div>
        </div>
      )}

      <div className="composer-submit-stack">
        <div className="option-row composer-expiry-row">
          <span className="mono-label">Expires in</span>
          <input
            className="input"
            style={{ width: '96px' }}
            type="number"
            min={1}
            value={expiryAmount}
            onChange={(e) => setExpiryAmount(e.target.value)}
            aria-label="Expiry amount"
          />
          <select
            className="select"
            style={{ width: '128px' }}
            value={expiryUnit}
            onChange={(e) => setExpiryUnit(e.target.value as ExpiryInput['unit'])}
            aria-label="Expiry unit"
          >
            {EXPIRY_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>

          <label className="switch composer-password-toggle">
            <input
              type="checkbox"
              checked={passwordEnabled}
              onChange={(e) => {
                setPasswordEnabled(e.target.checked)
                if (!e.target.checked) {
                  setPassword('')
                }
              }}
            />
            <span className="switch-track" aria-hidden="true"></span>
            Password protect
          </label>
        </div>

        {passwordEnabled && (
          <div className="field composer-password-field">
            <label className="label" htmlFor="sar-password">
              Password
            </label>
            <input
              className="input"
              id="sar-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <span className="field-hint">Viewers must enter it to read the note.</span>
          </div>
        )}

        <button
          className="btn btn-primary composer-share-btn"
          type="submit"
          disabled={submitting || !(parseInt(expiryAmount, 10) > 0)}
        >
          {submitting ? 'Sharing…' : 'Share'}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          <span className="alert-title">Could not create the note</span>
          <span>{error}</span>
        </div>
      )}

      {createdSar && (
        <div className="result-block" data-testid="share-result">
          <span className="mono-label">Share link</span>
          <div className="result-row">
            <a className="result-link" href={shareUrlFor(createdSar.id)}>
              {shareUrlFor(createdSar.id)}
            </a>
            <button className="copy-btn" type="button" onClick={copyShareUrl}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </form>
  )
}
