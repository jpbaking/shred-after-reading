import { useEffect, useState } from 'react'
import { verifyEmail } from '../api'

type VerifyState =
  | { status: 'verifying' }
  | { status: 'verified'; email: string }
  | { status: 'failed'; message: string }

export function VerifyEmailResult() {
  const [state, setState] = useState<VerifyState>({ status: 'verifying' })

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) {
      setState({ status: 'failed', message: 'The verification link is missing its token.' })
      return
    }

    verifyEmail(token)
      .then((result) => setState({ status: 'verified', email: result.email }))
      .catch((err) =>
        setState({
          status: 'failed',
          message: err instanceof Error ? err.message : 'Verification failed',
        }),
      )
  }, [])

  return (
    <div className="app-shell">
      <section className="app-hero" aria-labelledby="page-title">
        <a className="app-brand" href="/" aria-label="shred-after-reading — home">
          <img src="/design/assets/logo-mark.svg" alt="" />
          <span className="app-wordmark">shred-after-reading</span>
        </a>
        <p className="app-kicker">Email verification</p>
        <h1 className="app-title" id="page-title">
          Verifying your email.
        </h1>
      </section>

      <section className="action-card" aria-label="Verification result">
        {state.status === 'verifying' && <p>Checking your verification link…</p>}

        {state.status === 'verified' && (
          <div data-testid="verify-success">
            <div className="alert alert-success">
              <span className="alert-title">Email verified</span>
              <span>{state.email} is now verified. You can log in.</span>
            </div>
            <a className="btn btn-primary" href="/">
              Go to log in
            </a>
          </div>
        )}

        {state.status === 'failed' && (
          <div data-testid="verify-failed">
            <div className="alert alert-danger" role="alert">
              <span className="alert-title">Verification failed</span>
              <span>{state.message}</span>
            </div>
            <a className="btn btn-secondary" href="/">
              Back to the start
            </a>
          </div>
        )}
      </section>

      <footer className="app-foot">
        Notes expire and are shredded. Operators do not endorse shared content.
      </footer>
    </div>
  )
}
