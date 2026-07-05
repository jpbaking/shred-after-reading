import { useState } from 'react'
import type { FormEvent } from 'react'
import { login, register, type ApiUser } from '../api'

interface AuthLandingProps {
  onAuthenticated: (user: ApiUser) => void
}

type Mode = 'login' | 'register' | 'verification-sent'

export function AuthLanding({ onAuthenticated }: AuthLandingProps) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [verificationEmailSent, setVerificationEmailSent] = useState(true)

  const switchMode = (next: Mode) => {
    setMode(next)
    setError('')
  }

  const handleLogin = async (event: FormEvent) => {
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

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const result = await register({ email, password, name: name || undefined })
      setRegisteredEmail(result.user.email)
      setVerificationEmailSent(result.emailSent)
      setMode('verification-sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="app-shell auth-shell">
      <section className="app-hero" aria-labelledby="page-title">
        <a className="app-brand" href="/" aria-label="shred-after-reading — home">
          <img src="/design/assets/logo-mark.svg" alt="" />
          <span className="app-wordmark">shred-after-reading</span>
        </a>
        <p className="app-kicker">Self-destructing notes</p>
        <h1 className="app-title auth-title" id="page-title">
          Share text that <span>shreds&nbsp;itself.</span>
        </h1>
        <p className="app-tagline">Write a note, set an expiry, share one link. When it expires, it is gone.</p>
      </section>

      <section className="action-card" aria-label="Sign in or create an account">
        {mode === 'verification-sent' ? (
          <div data-testid="verification-sent">
            {verificationEmailSent ? (
              <div className="alert alert-success">
                <span className="alert-title">Check your email</span>
                <span>
                  We sent a verification link to {registeredEmail}. Open it to activate your
                  account, then log in.
                </span>
              </div>
            ) : (
              <div className="alert alert-danger">
                <span className="alert-title">Email could not be sent</span>
                <span>
                  Your account was created, but the verification email to {registeredEmail} could
                  not be sent. Contact the operator or try again later.
                </span>
              </div>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => switchMode('login')}>
              Back to log in
            </button>
          </div>
        ) : (
          <>
            <div className="tab-list" role="tablist">
              <button
                type="button"
                className={mode === 'login' ? 'tab active' : 'tab'}
                onClick={() => switchMode('login')}
              >
                Log in
              </button>
              <button
                type="button"
                className={mode === 'register' ? 'tab active' : 'tab'}
                onClick={() => switchMode('register')}
              >
                Register
              </button>
            </div>

            {mode === 'login' ? (
              <form onSubmit={handleLogin} aria-label="Log in">
                <div className="field">
                  <label className="label" htmlFor="login-email">
                    Email
                  </label>
                  <input
                    className="input"
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="login-password">
                    Password
                  </label>
                  <input
                    className="input"
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />{' '}
                    Remember me for 30 days
                  </label>
                </div>
                {error && (
                  <div className="alert alert-danger" role="alert">
                    <span className="alert-title">Could not log in</span>
                    <span>{error}</span>
                  </div>
                )}
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? 'Logging in…' : 'Log in'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} aria-label="Register">
                <div className="field">
                  <label className="label" htmlFor="register-email">
                    Email
                  </label>
                  <input
                    className="input"
                    id="register-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="register-name">
                    Name
                  </label>
                  <input
                    className="input"
                    id="register-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <span className="field-hint">Optional.</span>
                </div>
                <div className="field">
                  <label className="label" htmlFor="register-password">
                    Password
                  </label>
                  <input
                    className="input"
                    id="register-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <span className="field-hint">At least 8 characters.</span>
                </div>
                {error && (
                  <div className="alert alert-danger" role="alert">
                    <span className="alert-title">Could not register</span>
                    <span>{error}</span>
                  </div>
                )}
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? 'Creating account…' : 'Create account'}
                </button>
              </form>
            )}
          </>
        )}
      </section>

      <footer className="app-foot">
        Notes expire and are shredded. Operators do not endorse shared content.
      </footer>
    </div>
  )
}
