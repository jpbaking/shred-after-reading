import { describe, it, expect } from 'vitest'
import { UserRepository } from './user.repository.js'

describe('UserRepository', () => {
  let userRepository: UserRepository

  beforeEach(() => {
    userRepository = new UserRepository()
  })

  it('should create a user', async () => {
    const email = `user-${Date.now()}-${Math.random()}@example.com`
    const result = await userRepository.create({
      email,
      passwordHash: 'hashed_password',
      name: 'Test User',
    })

    expect(result.id).toBeDefined()
    expect(result.email).toBe(email)
    expect(result.name).toBe('Test User')
  })

  it('should find user by email', async () => {
    const email = `find-${Date.now()}-${Math.random()}@example.com`
    await userRepository.create({
      email,
      passwordHash: 'hashed_password',
    })

    const user = await userRepository.findUserByEmail({ email })
    expect(user).not.toBeNull()
    expect(user?.email).toBe(email)
  })

  it('should return null for non-existent user by email', async () => {
    const user = await userRepository.findUserByEmail({ email: 'nonexistent@example.com' })
    expect(user).toBeNull()
  })

  it('should find user by id', async () => {
    const created = await userRepository.create({
      email: `find-id-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })

    const user = await userRepository.findUserById({ id: created.id })
    expect(user).not.toBeNull()
    expect(user?.email).toBe(created.email)
  })

  it('should update user by id', async () => {
    const created = await userRepository.create({
      email: `update-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })

    const updated = await userRepository.update(created.id, {
      name: 'Updated User',
    })

    expect(updated.name).toBe('Updated User')
  })

  it('should update user by email', async () => {
    const email = `update-email-${Date.now()}-${Math.random()}@example.com`
    await userRepository.create({
      email,
      passwordHash: 'hashed_password',
    })

    const updated = await userRepository.updateByEmail({
      email,
      name: 'Updated by Email',
    })

    expect(updated.name).toBe('Updated by Email')
  })

  it('should count users', async () => {
    const email1 = `count1-${Date.now()}-${Math.random()}@example.com`
    const email2 = `count2-${Date.now()}-${Math.random()}@example.com`
    await userRepository.create({
      email: email1,
      passwordHash: 'hashed_password',
    })
    await userRepository.create({
      email: email2,
      passwordHash: 'hashed_password',
    })

    const count = await userRepository.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  it('should find users with pagination', async () => {
    const emails = []
    for (let i = 0; i < 5; i++) {
      const email = `paginate${i}-${Date.now()}-${Math.random()}@example.com`
      emails.push(email)
      await userRepository.create({
        email,
        passwordHash: 'hashed_password',
      })
    }

    const users = await userRepository.findUsers({ take: 2, skip: 0 })
    expect(users.length).toBe(2)
  })
})