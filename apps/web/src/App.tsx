import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthLanding } from './components/AuthLanding'
import { VerifyEmailResult } from './components/VerifyEmailResult'
import { AppPage } from './pages/AppPage'
import { AdminPage } from './pages/AdminPage'
import { PublicSarPage } from './pages/PublicSarPage'
import { getMe, login, logout, type ApiUser } from './api'

function AdminAccess({
  onAuthenticated,
}: {
  onAuthenticated: (user: ApiUser) => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const result = await login({ email, password, rememberMe })
      onAuthenticated(result.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="app-shell">
      <section className="app-hero" aria-labelledby="page-title">
        <a className="app-brand" href="/administration" aria-label="shred-after-reading admin home">
          <img src="/design/assets/logo-mark.svg" alt="" />
          <span className="app-wordmark">shred-after-reading-admin</span>
        </a>
        <p className="app-kicker">Administration</p>
        <h1 className="app-title" id="page-title">
          Sign in with an administrator account.
        </h1>
      </section>
      <section className="action-card" aria-label="Admin log in">
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="label" htmlFor="admin-email">
              Email
            </label>
            <input
              className="input"
              id="admin-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="admin-password">
              Password
            </label>
            <input
              className="input"
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />{' '}
              Remember me
            </label>
          </div>
          {error && (
            <div className="alert alert-danger" role="alert">
              <span className="alert-title">Could not log in</span>
              <span>{error}</span>
            </div>
          )}
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in to admin'}
          </button>
        </form>
      </section>
      <footer className="app-foot">Admin sign-in required.</footer>
    </div>
  )
}

function AdminForbidden({
  user,
  onLoggedOut,
}: {
  user: ApiUser
  onLoggedOut: () => void
}) {
  const [busy, setBusy] = useState(false)

  const handleLogout = async () => {
    setBusy(true)
    await logout()
    onLoggedOut()
  }

  return (
    <div className="app-shell">
      <section className="app-hero" aria-labelledby="page-title">
        <a className="app-brand" href="/administration" aria-label="shred-after-reading admin home">
          <img src="/design/assets/logo-mark.svg" alt="" />
          <span className="app-wordmark">shred-after-reading-admin</span>
        </a>
        <p className="app-kicker">Administration</p>
        <h1 className="app-title" id="page-title">
          This area is restricted to administrator accounts.
        </h1>
        <p className="app-tagline">Signed in as {user.name || user.email}.</p>
      </section>
      <section className="action-card">
        <div className="alert alert-danger" role="alert">
          <span className="alert-title">Admin access required</span>
          <span>Use an account bootstrapped as admin by the operator.</span>
        </div>
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={handleLogout}>
          {busy ? 'Logging out…' : 'Log out'}
        </button>
      </section>
      <footer className="app-foot">Admin access required.</footer>
    </div>
  )
}

function LandingRoute({
  user,
  onAuthenticated,
}: {
  user: ApiUser | null
  onAuthenticated: (user: ApiUser) => void
}) {
  const navigate = useNavigate()

  if (user) {
    return <Navigate to="/app" replace />
  }

  return (
    <AuthLanding
      onAuthenticated={(authedUser) => {
        onAuthenticated(authedUser)
        navigate('/app')
      }}
    />
  )
}

function AdminRoute({
  user,
  onAuthenticated,
  onLoggedOut,
}: {
  user: ApiUser | null
  onAuthenticated: (user: ApiUser) => void
  onLoggedOut: () => void
}) {
  if (!user) {
    return <AdminAccess onAuthenticated={onAuthenticated} />
  }

  if (!user.isAdmin) {
    return <AdminForbidden user={user} onLoggedOut={onLoggedOut} />
  }

  return <AdminPage user={user} onLoggedOut={onLoggedOut} />
}

function App() {
  const [user, setUser] = useState<ApiUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMe()
      .then(setUser)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <p className="app-foot">Loading…</p>
  }

  return (
    <Routes>
      <Route path="/" element={<LandingRoute user={user} onAuthenticated={setUser} />} />
      <Route path="/verify-email" element={<VerifyEmailResult />} />
      <Route path="/sar/:sarId" element={<PublicSarPage />} />
      <Route
        path="/administration"
        element={
          <AdminRoute
            user={user}
            onAuthenticated={setUser}
            onLoggedOut={() => setUser(null)}
          />
        }
      />
      <Route
        path="/app"
        element={
          user ? <AppPage user={user} onLoggedOut={() => setUser(null)} /> : <Navigate to="/" replace />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
