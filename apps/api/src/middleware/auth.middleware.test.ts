import { describe, it, expect, beforeAll } from 'vitest'
import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { prisma } from '../db.js'
import { AuthService, type EmailSender } from '../services/auth.service.js'
import { hashPassword, hashToken, generateOpaqueToken } from '../security.js'
import { createAuthMiddleware } from './auth.middleware.js'

const nullEmailService: EmailSender = {
  async sendEmail() {
    /* no-op */
  },
}

interface TestUser {
  cookie: string
}

async function createUserWithSession(flags: {
  emailVerified?: boolean
  isAdmin?: boolean
  isBanned?: boolean
}): Promise<TestUser> {
  const email = `guard-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hashPassword('irrelevant-password'),
      emailVerified: flags.emailVerified === false ? null : new Date(),
      isAdmin: flags.isAdmin === true,
      isBanned: flags.isBanned === true,
    },
  })

  const rawToken = generateOpaqueToken()
  await prisma.session.create({
    data: {
      userId: user.id,
      token: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  })

  return { cookie: `session_token=${rawToken}` }
}

describe('auth guard middleware', () => {
  let app: express.Express

  beforeAll(() => {
    const authService = new AuthService(nullEmailService)
    const middleware = createAuthMiddleware(authService)

    app = express()
    app.use(cookieParser())
    app.use(middleware.attachUser)
    app.get('/protected', middleware.requireUser(), (_req, res) => {
      res.status(200).json({ ok: true })
    })
    app.get('/admin-only', middleware.requireAdmin, (_req, res) => {
      res.status(200).json({ ok: true })
    })
  })

  it('rejects unauthenticated requests with 401 on user and admin routes', async () => {
    expect((await request(app).get('/protected')).status).toBe(401)
    expect((await request(app).get('/admin-only')).status).toBe(401)
  })

  it('rejects a stale or forged session cookie with 401', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Cookie', 'session_token=forged-token-value')
    expect(res.status).toBe(401)
  })

  it('rejects unverified users with 403 on protected routes', async () => {
    const { cookie } = await createUserWithSession({ emailVerified: false })
    const res = await request(app).get('/protected').set('Cookie', cookie)
    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/verify your email/i)
  })

  it('rejects banned users with 403 even with a valid session', async () => {
    const { cookie } = await createUserWithSession({ isBanned: true })

    const user = await request(app).get('/protected').set('Cookie', cookie)
    expect(user.status).toBe(403)
    expect(user.body.error).toMatch(/banned/i)

    const admin = await request(app).get('/admin-only').set('Cookie', cookie)
    expect(admin.status).toBe(403)
    expect(admin.body.error).toMatch(/banned/i)
  })

  it('allows a normal verified user on user routes but rejects them on admin routes', async () => {
    const { cookie } = await createUserWithSession({})

    expect((await request(app).get('/protected').set('Cookie', cookie)).status).toBe(200)
    expect((await request(app).get('/admin-only').set('Cookie', cookie)).status).toBe(403)
  })

  it('allows an admin on both user and admin routes', async () => {
    const { cookie } = await createUserWithSession({ isAdmin: true })

    expect((await request(app).get('/protected').set('Cookie', cookie)).status).toBe(200)
    expect((await request(app).get('/admin-only').set('Cookie', cookie)).status).toBe(200)
  })
})
