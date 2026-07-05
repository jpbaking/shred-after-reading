import { describe, it, expect } from 'vitest'
import { UserService } from './user.service.js'

describe('UserService', () => {
  let userService: UserService

  beforeEach(() => {
    userService = new UserService()
  })

  it('should create a user', async () => {
    const email = `create-${Date.now()}-${Math.random()}@example.com`
    const created = await userService.createUser({
      email,
      passwordHash: 'hashed_password',
      name: 'Test User',
    })

    expect(created.id).toBeDefined()
    expect(created.email).toBe(email)
    expect(created.name).toBe('Test User')
  })

  it('should find user by email', async () => {
    const email = `find-${Date.now()}-${Math.random()}@example.com`
    await userService.createUser({
      email,
      passwordHash: 'hashed_password',
    })

    const user = await userService.findUserByEmail(email)
    expect(user).not.toBeNull()
    expect(user?.email).toBe(email)
  })

  it('should return null for non-existent user by email', async () => {
    const user = await userService.findUserByEmail('nonexistent@example.com')
    expect(user).toBeNull()
  })

  it('should find user by id', async () => {
    const created = await userService.createUser({
      email: `find-id-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })

    const user = await userService.findUserById(created.id)
    expect(user).not.toBeNull()
    expect(user?.email).toBe(created.email)
  })

  it('should update user by id', async () => {
    const created = await userService.createUser({
      email: `update-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })

    const updated = await userService.updateUser(created.id, {
      name: 'Updated User',
    })

    expect(updated.name).toBe('Updated User')
  })

  it('should count users', async () => {
    const email1 = `count1-${Date.now()}-${Math.random()}@example.com`
    const email2 = `count2-${Date.now()}-${Math.random()}@example.com`
    await userService.createUser({
      email: email1,
      passwordHash: 'hashed_password',
    })
    await userService.createUser({
      email: email2,
      passwordHash: 'hashed_password',
    })

    // Count should be at least 2 (could be more if there are existing users)
    const count = await userService.countUsers()
    expect(count).toBeGreaterThanOrEqual(2)
  })
})
