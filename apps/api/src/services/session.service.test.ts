import { describe, it, expect } from 'vitest'
import { SessionService } from './session.service.js'
import { UserRepository } from '../repositories/user.repository.js'

describe('SessionService', () => {
  let sessionService: SessionService
  let userRepository: UserRepository

  beforeEach(() => {
    sessionService = new SessionService()
    userRepository = new UserRepository()
  })

  it('should find session by token', async () => {
    const user = await userRepository.create({
      email: `session-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token = `session-token-${Date.now()}-${Math.random()}`
    await sessionService.createSession({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const session = await sessionService.findSessionByToken(token)
    expect(session).not.toBeNull()
    expect(session?.userId).toBe(user.id)
  })

  it('should return null for non-existent session by token', async () => {
    const session = await sessionService.findSessionByToken('nonexistent-token')
    expect(session).toBeNull()
  })

  it('should find sessions by user id', async () => {
    const user = await userRepository.create({
      email: `session-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token1 = `session-token-1-${Date.now()}-${Math.random()}`
    const token2 = `session-token-2-${Date.now()}-${Math.random()}`
    await sessionService.createSession({
      userId: user.id,
      token: token1,
      expiresAt: new Date(Date.now() + 86400000),
    })
    await sessionService.createSession({
      userId: user.id,
      token: token2,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const sessions = await sessionService.findSessionByUserId(user.id)
    expect(sessions.length).toBe(2)
  })

  it('should create session', async () => {
    const user = await userRepository.create({
      email: `session-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token = `new-session-token-${Date.now()}-${Math.random()}`
    const created = await sessionService.createSession({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 86400000),
    })

    expect(created.id).toBeDefined()
    expect(created.userId).toBe(user.id)
    expect(created.token).toBe(token)
  })

  it('should update session', async () => {
    const user = await userRepository.create({
      email: `session-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token = `update-session-token-${Date.now()}-${Math.random()}`
    await sessionService.createSession({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const updated = await sessionService.updateSession(token, new Date(Date.now() + 172800000))
    expect(updated.expiresAt).toBeInstanceOf(Date)
  })

  it('should delete session', async () => {
    const user = await userRepository.create({
      email: `session-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token = `delete-session-token-${Date.now()}-${Math.random()}`
    const created = await sessionService.createSession({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const deleted = await sessionService.deleteSession(token)
    expect(deleted).toBeDefined()
    expect(deleted?.id).toBe(created.id)
  })

  it('should count sessions', async () => {
    const user = await userRepository.create({
      email: `session-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token1 = `count-session-1-${Date.now()}-${Math.random()}`
    const token2 = `count-session-2-${Date.now()}-${Math.random()}`
    await sessionService.createSession({
      userId: user.id,
      token: token1,
      expiresAt: new Date(Date.now() + 86400000),
    })
    await sessionService.createSession({
      userId: user.id,
      token: token2,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const count = await sessionService.countSessions()
    expect(count).toBeGreaterThanOrEqual(2)
  })
})
