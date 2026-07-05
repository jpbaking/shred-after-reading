import { describe, it, expect } from 'vitest'
import { SessionRepository } from './session.repository.js'
import { UserRepository } from './user.repository.js'

describe('SessionRepository', () => {
  let sessionRepository: SessionRepository
  let userRepository: UserRepository

  beforeEach(() => {
    sessionRepository = new SessionRepository()
    userRepository = new UserRepository()
  })

  it('should create a session', async () => {
    const user = await userRepository.create({
      email: `session-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token = `session-token-${Date.now()}-${Math.random()}`
    const result = await sessionRepository.createSession({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 86400000),
    })

    expect(result.id).toBeDefined()
    expect(result.userId).toBe(user.id)
    expect(result.token).toBe(token)
  })

  it('should find session by token', async () => {
    const user = await userRepository.create({
      email: `session-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token = `find-token-${Date.now()}-${Math.random()}`
    await sessionRepository.createSession({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const session = await sessionRepository.findSessionByToken({ token })
    expect(session).not.toBeNull()
    expect(session?.userId).toBe(user.id)
  })

  it('should return null for non-existent session by token', async () => {
    const session = await sessionRepository.findSessionByToken({ token: 'nonexistent-token' })
    expect(session).toBeNull()
  })

  it('should find sessions by user id', async () => {
    const user = await userRepository.create({
      email: `session-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token1 = `find-user-session-1-${Date.now()}-${Math.random()}`
    const token2 = `find-user-session-2-${Date.now()}-${Math.random()}`
    await sessionRepository.createSession({
      userId: user.id,
      token: token1,
      expiresAt: new Date(Date.now() + 86400000),
    })
    await sessionRepository.createSession({
      userId: user.id,
      token: token2,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const sessions = await sessionRepository.findSessionByUserId({ userId: user.id })
    expect(sessions.length).toBe(2)
  })

  it('should update session', async () => {
    const user = await userRepository.create({
      email: `session-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token = `update-session-token-${Date.now()}-${Math.random()}`
    await sessionRepository.createSession({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const updated = await sessionRepository.updateSession({
      token,
      expiresAt: new Date(Date.now() + 172800000),
    })

    expect(updated.expiresAt).toBeInstanceOf(Date)
  })

  it('should delete session', async () => {
    const user = await userRepository.create({
      email: `session-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token = `delete-session-token-${Date.now()}-${Math.random()}`
    const created = await sessionRepository.createSession({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const deleted = await sessionRepository.deleteSession(token)
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
    await sessionRepository.createSession({
      userId: user.id,
      token: token1,
      expiresAt: new Date(Date.now() + 86400000),
    })
    await sessionRepository.createSession({
      userId: user.id,
      token: token2,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const count = await sessionRepository.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })
})
