import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { generateSARId } from '../id.js'
import { generateOpaqueToken, hashPassword, hashToken } from '../security.js'
import type { EmailSender } from '../services/auth.service.js'
import {
  GLOBAL_EXPIRY_LIMIT_KEY,
  GLOBAL_EXPIRY_LIMIT_MINUTES_KEY,
} from '../services/expiry.service.js'

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
  isAdmin?: boolean
  isBanned?: boolean
  email?: string
  name?: string
} = {}): Promise<TestActor> {
  const email = flags.email ?? `admin-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
  const user = await prisma.user.create({
    data: {
      email,
      name: flags.name,
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
  return { userId: user.id, cookie: `session_token=${rawToken}` }
}

async function createSarRow(input: {
  userId: string
  content: string
  expiresAt?: Date | null
  isShredded?: boolean
}): Promise<void> {
  await prisma.sar.create({
    data: {
      id: generateSARId(),
      userId: input.userId,
      title: '',
      content: input.content,
      expiresAt: input.expiresAt ?? null,
      isShredded: input.isShredded === true,
      shredDate: input.isShredded === true ? new Date() : null,
    },
  })
}

describe('admin routes', () => {
  let app: Express
  let admin: TestActor
  let normalUser: TestActor

  beforeAll(async () => {
    app = createApp({ emailService: nullEmailService, enableRequestLogging: false }).app
    admin = await createActor({ isAdmin: true })
    normalUser = await createActor()
  })

  it('rejects unauthenticated and non-admin requests', async () => {
    expect((await request(app).get('/api/admin/users')).status).toBe(401)
    expect((await request(app).get('/api/admin/users').set('Cookie', normalUser.cookie)).status).toBe(403)
  })

  it('lists users with SAR counts and supports search', async () => {
    const searchableEmail = `person.searchable+${Date.now()}@example.com`
    const target = await createActor({
      email: searchableEmail,
      name: 'Searchable Person',
    })

    await createSarRow({
      userId: target.userId,
      content: 'active',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    await createSarRow({
      userId: target.userId,
      content: 'expired',
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
    })
    await createSarRow({
      userId: target.userId,
      content: 'deleted',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      isShredded: true,
    })

    const res = await request(app)
      .get('/api/admin/users?q=searchable')
      .set('Cookie', admin.cookie)

    expect(res.status).toBe(200)
    const found = res.body.users.find((user: { id: string }) => user.id === target.userId)
    expect(found).toBeTruthy()
    expect(found).toMatchObject({
      id: target.userId,
      email: searchableEmail,
      name: 'Searchable Person',
      emailVerified: true,
      isBanned: false,
      sarStats: {
        total: 3,
        active: 1,
        expired: 1,
        deleted: 1,
      },
    })
  })

  it('bans and unbans a user', async () => {
    const target = await createActor()

    const ban = await request(app)
      .patch(`/api/admin/users/${target.userId}/ban`)
      .set('Cookie', admin.cookie)
      .send({ banned: true })

    expect(ban.status).toBe(200)
    expect(ban.body.user.isBanned).toBe(true)
    expect((await prisma.user.findUnique({ where: { id: target.userId } }))?.isBanned).toBe(true)

    const unban = await request(app)
      .patch(`/api/admin/users/${target.userId}/ban`)
      .set('Cookie', admin.cookie)
      .send({ banned: false })

    expect(unban.status).toBe(200)
    expect(unban.body.user.isBanned).toBe(false)
    expect((await prisma.user.findUnique({ where: { id: target.userId } }))?.isBanned).toBe(false)
  })

  it('overrides email verification for an unverified user', async () => {
    const target = await createActor({ emailVerified: false })

    const res = await request(app)
      .post(`/api/admin/users/${target.userId}/verify`)
      .set('Cookie', admin.cookie)

    expect(res.status).toBe(200)
    expect(res.body.user.emailVerified).toBe(true)
    expect((await prisma.user.findUnique({ where: { id: target.userId } }))?.emailVerified).toBeTruthy()
  })

  it('lists, filters, loads, and deletes SARs for admins without exposing password hashes', async () => {
    const ownerEmail = `sar-owner+${Date.now()}@example.com`
    const owner = await createActor({
      email: ownerEmail,
      name: 'Owner Searchable',
    })
    const activeId = generateSARId()
    const expiredId = generateSARId()
    const deletedId = generateSARId()

    await prisma.sar.createMany({
      data: [
        {
          id: activeId,
          userId: owner.userId,
          title: '',
          content: 'alpha visible content',
          passwordHash: hashPassword('shielded'),
          passwordRequired: true,
          isMarkdown: true,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
        {
          id: expiredId,
          userId: owner.userId,
          title: '',
          content: 'beta expired content',
          expiresAt: new Date(Date.now() - 60 * 60 * 1000),
        },
        {
          id: deletedId,
          userId: owner.userId,
          title: '',
          content: 'gamma deleted content',
          isShredded: true,
          shredDate: new Date(),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      ],
    })

    const searchRes = await request(app)
      .get('/api/admin/sars?q=alpha&status=active')
      .set('Cookie', admin.cookie)

    expect(searchRes.status).toBe(200)
    expect(searchRes.body.sars).toHaveLength(1)
    expect(searchRes.body.sars[0]).toMatchObject({
      id: activeId,
      passwordRequired: true,
      isMarkdown: true,
      status: 'active',
      sharePath: `/sar/${activeId}`,
      owner: {
        id: owner.userId,
        email: ownerEmail,
        name: 'Owner Searchable',
      },
    })
    expect(searchRes.body.sars[0]).not.toHaveProperty('passwordHash')
    expect(searchRes.body.sars[0].contentPreview).toContain('alpha visible content')

    const expiredRes = await request(app)
      .get('/api/admin/sars?status=expired')
      .set('Cookie', admin.cookie)
    expect(expiredRes.status).toBe(200)
    expect(expiredRes.body.sars.some((sar: { id: string; status: string }) => sar.id === expiredId && sar.status === 'expired')).toBe(true)

    const deletedRes = await request(app)
      .get('/api/admin/sars?status=deleted')
      .set('Cookie', admin.cookie)
    expect(deletedRes.status).toBe(200)
    expect(deletedRes.body.sars.some((sar: { id: string; status: string }) => sar.id === deletedId && sar.status === 'deleted')).toBe(true)

    const detailRes = await request(app)
      .get(`/api/admin/sars/${activeId}`)
      .set('Cookie', admin.cookie)
    expect(detailRes.status).toBe(200)
    expect(detailRes.body.sar.content).toBe('alpha visible content')
    expect(detailRes.body.sar.passwordRequired).toBe(true)
    expect(detailRes.body.sar).not.toHaveProperty('passwordHash')

    const deleteRes = await request(app)
      .delete(`/api/admin/sars/${activeId}`)
      .set('Cookie', admin.cookie)
    expect(deleteRes.status).toBe(200)
    expect(deleteRes.body.sar.status).toBe('deleted')
    expect((await prisma.sar.findUnique({ where: { id: activeId } }))?.isShredded).toBe(true)
  })

  it('reads and updates the global expiry setting, rejects invalid values, and affects later SAR creation', async () => {
    const previousDays =
      (await prisma.appSettings.findUnique({ where: { key: GLOBAL_EXPIRY_LIMIT_KEY } }))?.value ?? '365'
    const previousMinutes =
      (
        await prisma.appSettings.findUnique({
          where: { key: GLOBAL_EXPIRY_LIMIT_MINUTES_KEY },
        })
      )?.value ?? String(365 * 24 * 60)

    try {
      const readRes = await request(app)
        .get('/api/admin/settings/expiry')
        .set('Cookie', admin.cookie)
      expect(readRes.status).toBe(200)
      expect(readRes.body.settings.hardCap).toEqual({ amount: 1, unit: 'year' })

      const invalidUnit = await request(app)
        .patch('/api/admin/settings/expiry')
        .set('Cookie', admin.cookie)
        .send({ expiry: { amount: 1, unit: 'weeks' } })
      expect(invalidUnit.status).toBe(422)

      const invalidDuration = await request(app)
        .patch('/api/admin/settings/expiry')
        .set('Cookie', admin.cookie)
        .send({ expiry: { amount: 0, unit: 'days' } })
      expect(invalidDuration.status).toBe(422)

      const aboveCap = await request(app)
        .patch('/api/admin/settings/expiry')
        .set('Cookie', admin.cookie)
        .send({ expiry: { amount: 2, unit: 'year' } })
      expect(aboveCap.status).toBe(422)

      const updateRes = await request(app)
        .patch('/api/admin/settings/expiry')
        .set('Cookie', admin.cookie)
        .send({ expiry: { amount: 1, unit: 'days' } })
      expect(updateRes.status).toBe(200)
      expect(updateRes.body.settings.globalExpiryLimit).toEqual({ amount: 1, unit: 'days' })

      const actor = await createActor()
      const createRes = await request(app)
        .post('/api/sars')
        .set('Cookie', actor.cookie)
        .send({
          content: 'clamped by admin setting',
          expiry: { amount: 2, unit: 'days' },
        })

      expect(createRes.status).toBe(201)
      const expiresInDays = (new Date(createRes.body.sar.expiresAt).getTime() - Date.now()) / 86_400_000
      expect(expiresInDays).toBeLessThan(1.1)
      expect(expiresInDays).toBeGreaterThan(0.9)
    } finally {
      await prisma.appSettings.upsert({
        where: { key: GLOBAL_EXPIRY_LIMIT_KEY },
        update: { value: previousDays },
        create: { key: GLOBAL_EXPIRY_LIMIT_KEY, value: previousDays },
      })
      await prisma.appSettings.upsert({
        where: { key: GLOBAL_EXPIRY_LIMIT_MINUTES_KEY },
        update: { value: previousMinutes },
        create: { key: GLOBAL_EXPIRY_LIMIT_MINUTES_KEY, value: previousMinutes },
      })
    }
  })
})
