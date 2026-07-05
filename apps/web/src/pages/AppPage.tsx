import { useCallback, useEffect, useState } from 'react'
import { listSars, logout, type ApiUser, type OwnedSar } from '../api'
import { SarComposer } from '../components/SarComposer'
import { SarList } from '../components/SarList'

interface AppPageProps {
  user: ApiUser
  onLoggedOut: () => void
}

export function AppPage({ user, onLoggedOut }: AppPageProps) {
  const [sars, setSars] = useState<OwnedSar[]>([])
  const [loadError, setLoadError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const result = await listSars()
      setSars(result.sars)
      setLoadError('')
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load notes')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleLogout = async () => {
    await logout()
    onLoggedOut()
  }

  return (
    <div className="app-shell">
      <section className="app-hero" aria-labelledby="page-title">
        <div className="app-hero-top">
          <a className="app-brand" href="/" aria-label="shred-after-reading — home">
            <img src="/design/assets/logo-mark.svg" alt="" />
            <span className="app-wordmark">shred-after-reading</span>
          </a>
          <p className="app-session">
            Signed in as {user.name || user.email}.{' '}
            {user.isAdmin && (
              <a className="btn btn-quiet btn-sm" href="/administration">
                Admin
              </a>
            )}
            <button className="btn btn-quiet btn-sm" type="button" onClick={handleLogout}>
              Log out
            </button>
          </p>
        </div>
        <p className="app-kicker">Self-destructing notes</p>
        <h1 className="app-title app-title-nowrap" id="page-title">
          Share text that shreds&nbsp;itself.
        </h1>
        <p className="app-tagline">Write a note, set an expiry, share one link. When it expires, it is gone.</p>
      </section>

      <section className="action-card" aria-label="Create a note">
        <SarComposer onCreated={() => void refresh()} />
      </section>

      <section className="action-card" aria-label="Your notes">
        <span className="mono-label">Your notes</span>
        {loadError && (
          <div className="alert alert-danger" role="alert">
            <span className="alert-title">Could not load notes</span>
            <span>{loadError}</span>
          </div>
        )}
        <SarList sars={sars} onChanged={() => void refresh()} />
      </section>

      <footer className="app-foot">
        Notes expire and are shredded. Operators do not endorse shared content.
      </footer>
    </div>
  )
}
