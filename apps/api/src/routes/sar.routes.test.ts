import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { hashPassword, hashToken, generateOpaqueToken } from '../security.js'
import type { EmailSender } from '../services/auth.service.js'

const nullEmailService: EmailSender = {
  async sendEmail() {
    /* no-op */
  },
}

interface TestActor {
  userId: string
  cookie: string
}

async function createActor(flags: {
  emailVerified?: boolean
  isBanned?: boolean
} = {}): Promise<TestActor> {
  const email = `sar-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hashPassword('irrelevant-password'),
      emailVerified: flags.emailVerified === false ? null : new Date(),
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
  return { userId: user.id, cookie: `session_token=${rawToken}` }
}

const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('SAR routes', () => {
  let app: Express
  let owner: TestActor

  beforeAll(async () => {
    app = createApp({ emailService: nullEmailService, enableRequestLogging: false }).app
    owner = await createActor()
  })

  async function createSar(
    actor: TestActor,
    body: Record<string, unknown> = {},
  ): Promise<{ id: string; passwordRequired: boolean; isMarkdown: boolean; expiresAt: string }> {
    const res = await request(app)
      .post('/api/sars')
      .set('Cookie', actor.cookie)
      .send({ content: 'default content', ...body })
    expect(res.status).toBe(201)
    return res.body.sar
  }

  describe('POST /api/sars', () => {
    it('creates a plain-text SAR with a UUIDv7 id and default expiry', async () => {
      const sar = await createSar(owner, { content: 'plain text note' })

      expect(sar.id).toMatch(UUID_V7_RE)
      expect(sar.passwordRequired).toBe(false)
      expect(sar.isMarkdown).toBe(false)

      // Default expiry from settings is 7 days.
      const days = (new Date(sar.expiresAt).getTime() - Date.now()) / 86_400_000
      expect(days).toBeGreaterThan(6.9)
      expect(days).toBeLessThan(7.1)
    })

    it('creates a Markdown SAR', async () => {
      const sar = await createSar(owner, { content: '# heading', isMarkdown: true })
      expect(sar.isMarkdown).toBe(true)
    })

    it('creates a password-protected SAR and stores only a hash', async () => {
      const sar = await createSar(owner, { content: 'secret', password: 'sar-pass-1' })
      expect(sar.passwordRequired).toBe(true)

      const row = await prisma.sar.findUnique({ where: { id: sar.id } })
      expect(row?.passwordHash).toBeTruthy()
      expect(row?.passwordHash).not.toContain('sar-pass-1')
    })

    it('honours an explicit expiry and clamps above the global limit', async () => {
      const sar = await createSar(owner, {
        content: 'x',
        expiry: { amount: 2, unit: 'hours' },
      })
      const hours = (new Date(sar.expiresAt).getTime() - Date.now()) / 3_600_000
      expect(hours).toBeGreaterThan(1.9)
      expect(hours).toBeLessThan(2.1)

      const clamped = await createSar(owner, {
        content: 'x',
        expiry: { amount: 2, unit: 'year' },
      })
      const days = (new Date(clamped.expiresAt).getTime() - Date.now()) / 86_400_000
      expect(days).toBeLessThan(366)
    })

    it('rejects oversize content with 413', async () => {
      // Body limit is above the SAR limit only in JSON overhead terms, so use
      // a string just over 1 MiB but under the JSON body cap is impossible —
      // instead lower the setting for this check.
      await prisma.appSettings.upsert({
        where: { key: 'max_sar_size_bytes' },
        update: { value: '64' },
        create: { key: 'max_sar_size_bytes', value: '64' },
      })
      try {
        const res = await request(app)
          .post('/api/sars')
          .set('Cookie', owner.cookie)
          .send({ content: 'y'.repeat(65) })
        expect(res.status).toBe(413)
      } finally {
        await prisma.appSettings.upsert({
          where: { key: 'max_sar_size_bytes' },
          update: { value: '1048576' },
          create: { key: 'max_sar_size_bytes', value: '1048576' },
        })
      }
    })

    it('rejects an invalid expiry with 422', async () => {
      const badUnit = await request(app)
        .post('/api/sars')
        .set('Cookie', owner.cookie)
        .send({ content: 'x', expiry: { amount: 1, unit: 'weeks' } })
      expect(badUnit.status).toBe(422)

      const badAmount = await request(app)
        .post('/api/sars')
        .set('Cookie', owner.cookie)
        .send({ content: 'x', expiry: { amount: 0, unit: 'days' } })
      expect(badAmount.status).toBe(422)
    })

    it('rejects unauthenticated, unverified, and banned users', async () => {
      const unauthenticated = await request(app).post('/api/sars').send({ content: 'x' })
      expect(unauthenticated.status).toBe(401)

      const unverified = await createActor({ emailVerified: false })
      const unverifiedRes = await request(app)
        .post('/api/sars')
        .set('Cookie', unverified.cookie)
        .send({ content: 'x' })
      expect(unverifiedRes.status).toBe(403)

      const banned = await createActor({ isBanned: true })
      const bannedRes = await request(app)
        .post('/api/sars')
        .set('Cookie', banned.cookie)
        .send({ content: 'x' })
      expect(bannedRes.status).toBe(403)
    })
  })

  describe('GET /api/sars', () => {
    it('lists only the owner’s active SARs', async () => {
      const lister = await createActor()
      const other = await createActor()

      const active = await createSar(lister, { content: 'active note' })
      const expired = await createSar(lister, { content: 'expired note' })
      const deleted = await createSar(lister, { content: 'deleted note' })
      await createSar(other, { content: 'someone else’s note' })

      await prisma.sar.update({
        where: { id: expired.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      })
      await request(app).delete(`/api/sars/${deleted.id}`).set('Cookie', lister.cookie).expect(200)

      const res = await request(app).get('/api/sars').set('Cookie', lister.cookie)
      expect(res.status).toBe(200)

      const ids = res.body.sars.map((s: { id: string }) => s.id)
      expect(ids).toEqual([active.id])
      expect(res.body.sars[0].contentPreview).toBe('active note')
      expect(res.body.sars[0]).not.toHaveProperty('content')
    })

    it('loads owned content without exposing it to other users', async () => {
      const detailOwner = await createActor()
      const intruder = await createActor()
      const sar = await createSar(detailOwner, {
        content: 'owner-only content',
        password: 'still-owner-visible',
      })

      const ownerRes = await request(app).get(`/api/sars/${sar.id}`).set('Cookie', detailOwner.cookie)
      expect(ownerRes.status).toBe(200)
      expect(ownerRes.body.sar.content).toBe('owner-only content')
      expect(ownerRes.body.sar.passwordRequired).toBe(true)

      const intruderRes = await request(app).get(`/api/sars/${sar.id}`).set('Cookie', intruder.cookie)
      expect(intruderRes.status).toBe(403)
    })
  })

  describe('public share APIs', () => {
    it('returns safe metadata for an active SAR', async () => {
      const sar = await createSar(owner, { content: 'public note' })
      const res = await request(app).get(`/api/public/sars/${sar.id}`)

      expect(res.status).toBe(200)
      expect(res.body.sar.id).toBe(sar.id)
      expect(res.body.sar.passwordRequired).toBe(false)
      expect(res.body.sar).not.toHaveProperty('content')
      expect(res.body.sar).not.toHaveProperty('passwordHash')
    })

    it('returns content without a password for an unprotected SAR', async () => {
      const sar = await createSar(owner, { content: 'open content' })
      const res = await request(app).post(`/api/public/sars/${sar.id}/content`).send({})

      expect(res.status).toBe(200)
      expect(res.body.sar.content).toBe('open content')
    })

    it('handles the password-protected flow: metadata, missing, wrong, correct', async () => {
      const sar = await createSar(owner, { content: 'locked', password: 'open-sesame' })

      const meta = await request(app).get(`/api/public/sars/${sar.id}`)
      expect(meta.status).toBe(200)
      expect(meta.body.sar.passwordRequired).toBe(true)

      const missing = await request(app).post(`/api/public/sars/${sar.id}/content`).send({})
      expect(missing.status).toBe(401)

      const wrong = await request(app)
        .post(`/api/public/sars/${sar.id}/content`)
        .send({ password: 'wrong' })
      expect(wrong.status).toBe(403)

      const correct = await request(app)
        .post(`/api/public/sars/${sar.id}/content`)
        .send({ password: 'open-sesame' })
      expect(correct.status).toBe(200)
      expect(correct.body.sar.content).toBe('locked')
    })

    it('returns 410 for expired and deleted SARs, 404 unknown, 422 malformed', async () => {
      const expired = await createSar(owner, { content: 'will expire' })
      await prisma.sar.update({
        where: { id: expired.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      })
      expect((await request(app).get(`/api/public/sars/${expired.id}`)).status).toBe(410)
      expect(
        (await request(app).post(`/api/public/sars/${expired.id}/content`).send({})).status,
      ).toBe(410)

      const deleted = await createSar(owner, { content: 'will be deleted' })
      await request(app).delete(`/api/sars/${deleted.id}`).set('Cookie', owner.cookie).expect(200)
      expect((await request(app).get(`/api/public/sars/${deleted.id}`)).status).toBe(410)

      const unknown = '01890000-0000-7000-8000-000000000000'
      expect((await request(app).get(`/api/public/sars/${unknown}`)).status).toBe(404)

      expect((await request(app).get('/api/public/sars/not-a-uuid')).status).toBe(422)
    })
  })

  describe('owner actions', () => {
    it('changes expiry, clamped to the global limit', async () => {
      const sar = await createSar(owner, { content: 'expiring' })

      const res = await request(app)
        .patch(`/api/sars/${sar.id}/expiry`)
        .set('Cookie', owner.cookie)
        .send({ expiry: { amount: 1, unit: 'hours' } })

      expect(res.status).toBe(200)
      const hours = (new Date(res.body.sar.expiresAt).getTime() - Date.now()) / 3_600_000
      expect(hours).toBeGreaterThan(0.9)
      expect(hours).toBeLessThan(1.1)
    })

    it('sets, uses, and removes a SAR password', async () => {
      const sar = await createSar(owner, { content: 'lock me later' })

      const set = await request(app)
        .put(`/api/sars/${sar.id}/password`)
        .set('Cookie', owner.cookie)
        .send({ password: 'later-pass' })
      expect(set.status).toBe(200)
      expect(set.body.sar.passwordRequired).toBe(true)

      const locked = await request(app).post(`/api/public/sars/${sar.id}/content`).send({})
      expect(locked.status).toBe(401)

      const removed = await request(app)
        .delete(`/api/sars/${sar.id}/password`)
        .set('Cookie', owner.cookie)
      expect(removed.status).toBe(200)
      expect(removed.body.sar.passwordRequired).toBe(false)

      const open = await request(app).post(`/api/public/sars/${sar.id}/content`).send({})
      expect(open.status).toBe(200)
    })

    it('soft-deletes: hidden publicly, row retained for admin retention', async () => {
      const sar = await createSar(owner, { content: 'shred me' })

      const del = await request(app).delete(`/api/sars/${sar.id}`).set('Cookie', owner.cookie)
      expect(del.status).toBe(200)

      expect((await request(app).get(`/api/public/sars/${sar.id}`)).status).toBe(410)

      const row = await prisma.sar.findUnique({ where: { id: sar.id } })
      expect(row).not.toBeNull()
      expect(row?.isShredded).toBe(true)
      expect(row?.shredDate).not.toBeNull()
    })

    it('blocks a non-owner from update, delete, and password actions with 403', async () => {
      const sar = await createSar(owner, { content: 'mine' })
      const intruder = await createActor()

      const expiry = await request(app)
        .patch(`/api/sars/${sar.id}/expiry`)
        .set('Cookie', intruder.cookie)
        .send({ expiry: { amount: 1, unit: 'days' } })
      expect(expiry.status).toBe(403)

      const password = await request(app)
        .put(`/api/sars/${sar.id}/password`)
        .set('Cookie', intruder.cookie)
        .send({ password: 'hijack' })
      expect(password.status).toBe(403)

      const del = await request(app).delete(`/api/sars/${sar.id}`).set('Cookie', intruder.cookie)
      expect(del.status).toBe(403)

      // Owner still has an untouched SAR.
      const row = await prisma.sar.findUnique({ where: { id: sar.id } })
      expect(row?.isShredded).toBe(false)
      expect(row?.passwordRequired).toBe(false)
    })
  })

  describe('cleanup', () => {
    it('purges only rows past the retention window and is idempotent', async () => {
      const { sarService } = createApp({
        emailService: nullEmailService,
        enableRequestLogging: false,
      })

      const active = await createSar(owner, { content: 'stays' })
      const recentlyExpired = await createSar(owner, { content: 'expired recently' })
      const longExpired = await createSar(owner, { content: 'expired long ago' })
      const longDeleted = await createSar(owner, { content: 'deleted long ago' })

      const now = Date.now()
      await prisma.sar.update({
        where: { id: recentlyExpired.id },
        data: { expiresAt: new Date(now - 86_400_000) },
      })
      await prisma.sar.update({
        where: { id: longExpired.id },
        data: { expiresAt: new Date(now - 40 * 86_400_000) },
      })
      await prisma.sar.update({
        where: { id: longDeleted.id },
        data: {
          isShredded: true,
          shredDate: new Date(now - 40 * 86_400_000),
        },
      })

      const purged = await sarService.purgeExpiredSars(30)
      expect(purged).toBeGreaterThanOrEqual(2)

      expect(await prisma.sar.findUnique({ where: { id: active.id } })).not.toBeNull()
      expect(await prisma.sar.findUnique({ where: { id: recentlyExpired.id } })).not.toBeNull()
      expect(await prisma.sar.findUnique({ where: { id: longExpired.id } })).toBeNull()
      expect(await prisma.sar.findUnique({ where: { id: longDeleted.id } })).toBeNull()

      // Second run touches nothing new from this set.
      await sarService.purgeExpiredSars(30)
      expect(await prisma.sar.findUnique({ where: { id: active.id } })).not.toBeNull()
      expect(await prisma.sar.findUnique({ where: { id: recentlyExpired.id } })).not.toBeNull()
    })
  })
})
