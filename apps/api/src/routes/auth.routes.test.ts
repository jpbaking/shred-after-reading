import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import type { EmailSender } from '../services/auth.service.js'

class FakeEmailService implements EmailSender {
  sent: Array<{ to: string; subject: string; html: string }> = []
  failNextSend = false

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (this.failNextSend) {
      this.failNextSend = false
      throw new Error('SMTP connection refused')
    }
    this.sent.push({ to, subject, html })
  }

  lastTokenFor(email: string): string {
    const message = [...this.sent].reverse().find((m) => m.to === email)
    if (!message) {
      throw new Error(`No email sent to ${email}`)
    }
    const match = message.html.match(/[?&]token=([^"&<]+)/)
    if (!match) {
      throw new Error(`No token link in email to ${email}`)
    }
    return decodeURIComponent(match[1])
  }
}

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

const PASSWORD = 'correct-horse-battery'

describe('auth routes', () => {
  let emailService: FakeEmailService
  let app: ReturnType<typeof createApp>['app']

  beforeEach(() => {
    emailService = new FakeEmailService()
    app = createApp({ emailService, enableRequestLogging: false }).app
  })

  async function registerUser(email: string): Promise<void> {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: PASSWORD })
    expect(res.status).toBe(201)
  }

  async function registerAndVerify(email: string): Promise<void> {
    await registerUser(email)
    const token = emailService.lastTokenFor(email)
    const res = await request(app).get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
    expect(res.status).toBe(200)
  }

  describe('POST /api/auth/register', () => {
    it('registers a new user, stores a hashed password, and sends a verification email', async () => {
      const email = uniqueEmail('register-ok')
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: `  ${email.toUpperCase()}  `, password: PASSWORD, name: 'Reg User' })

      expect(res.status).toBe(201)
      expect(res.body.user.email).toBe(email)
      expect(res.body.emailSent).toBe(true)
      expect(res.body).not.toHaveProperty('token')
      expect(res.headers['set-cookie']).toBeUndefined()

      const user = await prisma.user.findUnique({ where: { email } })
      expect(user).not.toBeNull()
      expect(user?.emailVerified).toBeNull()
      expect(user?.passwordHash).not.toContain(PASSWORD)

      expect(emailService.sent).toHaveLength(1)
      expect(emailService.sent[0].to).toBe(email)

      // The raw token must never be stored; only its hash is persisted.
      const rawToken = emailService.lastTokenFor(email)
      const stored = await prisma.emailVerificationToken.findMany({
        where: { userId: user!.id },
      })
      expect(stored).toHaveLength(1)
      expect(stored[0].token).not.toBe(rawToken)
    })

    it('rejects a duplicate email with 409', async () => {
      const email = uniqueEmail('register-dup')
      await registerUser(email)

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email, password: PASSWORD })

      expect(res.status).toBe(409)
      expect(res.body.error).toMatch(/already exists/)
    })

    it('rejects an invalid email with 422', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: PASSWORD })

      expect(res.status).toBe(422)
      expect(res.body.error).toMatch(/email/i)
    })

    it('rejects a weak password with 422', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: uniqueEmail('register-weak'), password: 'short' })

      expect(res.status).toBe(422)
      expect(res.body.error).toMatch(/at least 8/)
    })

    it('still creates the account when the verification email fails to send', async () => {
      const email = uniqueEmail('register-mailfail')
      emailService.failNextSend = true

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email, password: PASSWORD })

      expect(res.status).toBe(201)
      expect(res.body.emailSent).toBe(false)

      const user = await prisma.user.findUnique({ where: { email } })
      expect(user).not.toBeNull()
    })
  })

  describe('GET /api/auth/verify-email', () => {
    it('verifies a user with a valid token exactly once', async () => {
      const email = uniqueEmail('verify-ok')
      await registerUser(email)
      const token = emailService.lastTokenFor(email)

      const res = await request(app).get(
        `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
      )

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ verified: true, email })

      const user = await prisma.user.findUnique({ where: { email } })
      expect(user?.emailVerified).not.toBeNull()
    })

    it('rejects a reused token with 409', async () => {
      const email = uniqueEmail('verify-reuse')
      await registerUser(email)
      const token = emailService.lastTokenFor(email)

      await request(app).get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      const res = await request(app).get(
        `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
      )

      expect(res.status).toBe(409)
      expect(res.body.error).toMatch(/already been used/)
    })

    it('rejects an expired token with 410', async () => {
      const email = uniqueEmail('verify-expired')
      await registerUser(email)
      const token = emailService.lastTokenFor(email)

      const user = await prisma.user.findUnique({ where: { email } })
      await prisma.emailVerificationToken.updateMany({
        where: { userId: user!.id },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      })

      const res = await request(app).get(
        `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
      )

      expect(res.status).toBe(410)
      expect(res.body.error).toMatch(/expired/)
    })

    it('rejects an unknown token with 400 and a missing token with 422', async () => {
      const unknown = await request(app).get('/api/auth/verify-email?token=no-such-token')
      expect(unknown.status).toBe(400)

      const missing = await request(app).get('/api/auth/verify-email')
      expect(missing.status).toBe(422)
    })
  })

  describe('POST /api/auth/login', () => {
    it('logs in a verified user and sets an HttpOnly session cookie', async () => {
      const email = uniqueEmail('login-ok')
      await registerAndVerify(email)

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password: PASSWORD })

      expect(res.status).toBe(200)
      expect(res.body.user.email).toBe(email)

      const cookies = res.headers['set-cookie'] as unknown as string[]
      const sessionCookie = cookies.find((c) => c.startsWith('session_token='))
      expect(sessionCookie).toBeDefined()
      expect(sessionCookie).toMatch(/HttpOnly/i)
      expect(sessionCookie).toMatch(/SameSite=Lax/i)

      // ~24h TTL without remember-me
      const expiresAt = new Date(res.body.expiresAt).getTime()
      const hours = (expiresAt - Date.now()) / (60 * 60 * 1000)
      expect(hours).toBeGreaterThan(23)
      expect(hours).toBeLessThan(25)

      // Session token is stored hashed, so the cookie value must not appear in the DB.
      const rawToken = decodeURIComponent(sessionCookie!.split(';')[0].split('=')[1])
      const session = await prisma.session.findUnique({ where: { token: rawToken } })
      expect(session).toBeNull()
    })

    it('extends the session to ~30 days with remember-me', async () => {
      const email = uniqueEmail('login-remember')
      await registerAndVerify(email)

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password: PASSWORD, rememberMe: true })

      expect(res.status).toBe(200)
      const expiresAt = new Date(res.body.expiresAt).getTime()
      const days = (expiresAt - Date.now()) / (24 * 60 * 60 * 1000)
      expect(days).toBeGreaterThan(29)
      expect(days).toBeLessThan(31)
    })

    it('rejects an unverified user with 403', async () => {
      const email = uniqueEmail('login-unverified')
      await registerUser(email)

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password: PASSWORD })

      expect(res.status).toBe(403)
      expect(res.body.error).toMatch(/verify your email/i)
    })

    it('rejects a banned user with 403', async () => {
      const email = uniqueEmail('login-banned')
      await registerAndVerify(email)
      await prisma.user.update({ where: { email }, data: { isBanned: true } })

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password: PASSWORD })

      expect(res.status).toBe(403)
      expect(res.body.error).toMatch(/banned/i)
    })

    it('rejects a bad password and an unknown email with the same 401', async () => {
      const email = uniqueEmail('login-badpass')
      await registerAndVerify(email)

      const badPassword = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrong-password-123' })
      expect(badPassword.status).toBe(401)
      expect(badPassword.body.error).toBe('Invalid credentials')

      const unknownEmail = await request(app)
        .post('/api/auth/login')
        .send({ email: uniqueEmail('login-unknown'), password: PASSWORD })
      expect(unknownEmail.status).toBe(401)
      expect(unknownEmail.body.error).toBe('Invalid credentials')
    })

    it('rejects an expired session on /me', async () => {
      const email = uniqueEmail('login-session-expired')
      await registerAndVerify(email)

      const login = await request(app)
        .post('/api/auth/login')
        .send({ email, password: PASSWORD })
      const cookie = (login.headers['set-cookie'] as unknown as string[])[0]

      const user = await prisma.user.findUnique({ where: { email } })
      await prisma.session.updateMany({
        where: { userId: user!.id },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      })

      const res = await request(app).get('/api/auth/me').set('Cookie', cookie)
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/auth/logout and GET /api/auth/me', () => {
    it('returns the current user only with a valid session', async () => {
      const email = uniqueEmail('me-ok')
      await registerAndVerify(email)

      const noSession = await request(app).get('/api/auth/me')
      expect(noSession.status).toBe(401)

      const login = await request(app)
        .post('/api/auth/login')
        .send({ email, password: PASSWORD })
      const cookie = (login.headers['set-cookie'] as unknown as string[])[0]

      const me = await request(app).get('/api/auth/me').set('Cookie', cookie)
      expect(me.status).toBe(200)
      expect(me.body.user.email).toBe(email)
    })

    it('logout invalidates the session server-side', async () => {
      const email = uniqueEmail('logout-ok')
      await registerAndVerify(email)

      const login = await request(app)
        .post('/api/auth/login')
        .send({ email, password: PASSWORD })
      const cookie = (login.headers['set-cookie'] as unknown as string[])[0]

      const logout = await request(app).post('/api/auth/logout').set('Cookie', cookie)
      expect(logout.status).toBe(200)

      // Replaying the old cookie must fail: the session row is gone.
      const me = await request(app).get('/api/auth/me').set('Cookie', cookie)
      expect(me.status).toBe(401)
    })
  })
})
