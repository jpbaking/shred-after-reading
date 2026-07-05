import { describe, it, expect } from 'vitest'
import { EmailVerificationTokenService } from './email-verification-token.service.js'
import { UserRepository } from '../repositories/user.repository.js'

describe('EmailVerificationTokenService', () => {
  let emailVerificationTokenService: EmailVerificationTokenService
  let userRepository: UserRepository

  beforeEach(() => {
    emailVerificationTokenService = new EmailVerificationTokenService()
    userRepository = new UserRepository()
  })

  it('should find email verification token by token', async () => {
    const user = await userRepository.create({
      email: `email-token-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token = `verification-token-${Date.now()}-${Math.random()}`
    const email = `test-${Date.now()}-${Math.random()}@example.com`
    await emailVerificationTokenService.createEmailVerificationToken({
      userId: user.id,
      token,
      email,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const found = await emailVerificationTokenService.findEmailVerificationTokenByToken(token)
    expect(found).not.toBeNull()
    expect(found?.email).toBe(email)
  })

  it('should return null for non-existent token', async () => {
    const token = await emailVerificationTokenService.findEmailVerificationTokenByToken('nonexistent-token')
    expect(token).toBeNull()
  })

  it('should find email verification tokens by user id', async () => {
    const user = await userRepository.create({
      email: `email-token-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token1 = `verification-token-1-${Date.now()}-${Math.random()}`
    const token2 = `verification-token-2-${Date.now()}-${Math.random()}`
    const email1 = `test1-${Date.now()}-${Math.random()}@example.com`
    const email2 = `test2-${Date.now()}-${Math.random()}@example.com`
    await emailVerificationTokenService.createEmailVerificationToken({
      userId: user.id,
      token: token1,
      email: email1,
      expiresAt: new Date(Date.now() + 86400000),
    })
    await emailVerificationTokenService.createEmailVerificationToken({
      userId: user.id,
      token: token2,
      email: email2,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const tokens = await emailVerificationTokenService.findEmailVerificationTokenByUserId(user.id)
    expect(tokens.length).toBe(2)
  })

  it('should create email verification token', async () => {
    const user = await userRepository.create({
      email: `email-token-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token = `new-verification-token-${Date.now()}-${Math.random()}`
    const email = `new-${Date.now()}-${Math.random()}@example.com`
    const created = await emailVerificationTokenService.createEmailVerificationToken({
      userId: user.id,
      token,
      email,
      expiresAt: new Date(Date.now() + 86400000),
    })

    expect(created.id).toBeDefined()
    expect(created.userId).toBe(user.id)
    expect(created.email).toBe(email)
  })

  it('should update email verification token', async () => {
    const user = await userRepository.create({
      email: `email-token-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token = `update-verification-token-${Date.now()}-${Math.random()}`
    const email = `update-${Date.now()}-${Math.random()}@example.com`
    await emailVerificationTokenService.createEmailVerificationToken({
      userId: user.id,
      token,
      email,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const updated = await emailVerificationTokenService.updateEmailVerificationToken(token, true)
    expect(updated.used).toBe(true)
  })

  it('should delete email verification token', async () => {
    const user = await userRepository.create({
      email: `email-token-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token = `delete-verification-token-${Date.now()}-${Math.random()}`
    const email = `delete-${Date.now()}-${Math.random()}@example.com`
    const created = await emailVerificationTokenService.createEmailVerificationToken({
      userId: user.id,
      token,
      email,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const deleted = await emailVerificationTokenService.deleteEmailVerificationToken(token)
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
    const email1 = `count1-${Date.now()}-${Math.random()}@example.com`
    const email2 = `count2-${Date.now()}-${Math.random()}@example.com`
    await emailVerificationTokenService.createEmailVerificationToken({
      userId: user.id,
      token: token1,
      email: email1,
      expiresAt: new Date(Date.now() + 86400000),
    })
    await emailVerificationTokenService.createEmailVerificationToken({
      userId: user.id,
      token: token2,
      email: email2,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const count = await emailVerificationTokenService.countEmailVerificationTokens()
    expect(count).toBeGreaterThanOrEqual(2)
  })
})
