import { describe, it, expect } from 'vitest'
import { EmailVerificationTokenRepository } from './email-verification-token.repository.js'
import { UserRepository } from './user.repository.js'

describe('EmailVerificationTokenRepository', () => {
  let emailVerificationTokenRepository: EmailVerificationTokenRepository
  let userRepository: UserRepository

  beforeEach(() => {
    emailVerificationTokenRepository = new EmailVerificationTokenRepository()
    userRepository = new UserRepository()
  })

  it('should create an email verification token', async () => {
    const user = await userRepository.create({
      email: `email-token-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token = `verification-token-${Date.now()}-${Math.random()}`
    const email = `test-${Date.now()}-${Math.random()}@example.com`
    const result = await emailVerificationTokenRepository.createEmailVerificationToken({
      userId: user.id,
      token,
      email,
      expiresAt: new Date(Date.now() + 86400000),
    })

    expect(result.id).toBeDefined()
    expect(result.userId).toBe(user.id)
    expect(result.email).toBe(email)
    expect(result.token).toBe(token)
  })

  it('should find email verification token by token', async () => {
    const user = await userRepository.create({
      email: `email-token-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token = `find-token-${Date.now()}-${Math.random()}`
    const email = `find-email-${Date.now()}-${Math.random()}@example.com`
    await emailVerificationTokenRepository.createEmailVerificationToken({
      userId: user.id,
      token,
      email,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const found = await emailVerificationTokenRepository.findEmailVerificationTokenByToken({ token })
    expect(found).not.toBeNull()
    expect(found?.email).toBe(email)
  })

  it('should return null for non-existent token', async () => {
    const token = await emailVerificationTokenRepository.findEmailVerificationTokenByToken({ token: 'nonexistent-token' })
    expect(token).toBeNull()
  })

  it('should find email verification tokens by user id', async () => {
    const user = await userRepository.create({
      email: `email-token-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token1 = `find-user-token-1-${Date.now()}-${Math.random()}`
    const token2 = `find-user-token-2-${Date.now()}-${Math.random()}`
    const email1 = `find-email-1-${Date.now()}-${Math.random()}@example.com`
    const email2 = `find-email-2-${Date.now()}-${Math.random()}@example.com`
    await emailVerificationTokenRepository.createEmailVerificationToken({
      userId: user.id,
      token: token1,
      email: email1,
      expiresAt: new Date(Date.now() + 86400000),
    })
    await emailVerificationTokenRepository.createEmailVerificationToken({
      userId: user.id,
      token: token2,
      email: email2,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const tokens = await emailVerificationTokenRepository.findEmailVerificationTokenByUserId({ userId: user.id })
    expect(tokens.length).toBe(2)
  })

  it('should update email verification token', async () => {
    const user = await userRepository.create({
      email: `email-token-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token = `update-token-${Date.now()}-${Math.random()}`
    const email = `update-email-${Date.now()}-${Math.random()}@example.com`
    await emailVerificationTokenRepository.createEmailVerificationToken({
      userId: user.id,
      token,
      email,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const updated = await emailVerificationTokenRepository.updateEmailVerificationToken({ token, used: true })
    expect(updated.used).toBe(true)
  })

  it('should delete email verification token', async () => {
    const user = await userRepository.create({
      email: `email-token-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token = `delete-token-${Date.now()}-${Math.random()}`
    const email = `delete-email-${Date.now()}-${Math.random()}@example.com`
    const created = await emailVerificationTokenRepository.createEmailVerificationToken({
      userId: user.id,
      token,
      email,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const deleted = await emailVerificationTokenRepository.deleteEmailVerificationToken(token)
    expect(deleted).toBeDefined()
    expect(deleted?.id).toBe(created.id)
  })

  it('should count email verification tokens', async () => {
    const user = await userRepository.create({
      email: `email-token-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token1 = `count-token-1-${Date.now()}-${Math.random()}`
    const token2 = `count-token-2-${Date.now()}-${Math.random()}`
    const email1 = `count-email-1-${Date.now()}-${Math.random()}@example.com`
    const email2 = `count-email-2-${Date.now()}-${Math.random()}@example.com`
    await emailVerificationTokenRepository.createEmailVerificationToken({
      userId: user.id,
      token: token1,
      email: email1,
      expiresAt: new Date(Date.now() + 86400000),
    })
    await emailVerificationTokenRepository.createEmailVerificationToken({
      userId: user.id,
      token: token2,
      email: email2,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const count = await emailVerificationTokenRepository.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })
})
