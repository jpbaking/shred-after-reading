import { describe, it, expect } from 'vitest'
import { SarRepository } from './sar.repository.js'
import { UserRepository } from './user.repository.js'

describe('SarRepository', () => {
  let sarRepository: SarRepository
  let userRepository: UserRepository

  beforeEach(() => {
    sarRepository = new SarRepository()
    userRepository = new UserRepository()
  })

  it('should create a SAR', async () => {
    const user = await userRepository.create({
      email: `sar-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const result = await sarRepository.create({
      userId: user.id,
      title: 'Test SAR',
      content: 'Test content',
      passwordHash: 'hashed_password',
      passwordRequired: false,
    })

    expect(result.id).toBeDefined()
    expect(result.userId).toBe(user.id)
    expect(result.title).toBe('Test SAR')
    expect(result.content).toBe('Test content')
    expect(result.passwordRequired).toBe(false)
  })

  it('should find SAR by id', async () => {
    const user = await userRepository.create({
      email: `sar-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const created = await sarRepository.create({
      userId: user.id,
      title: 'Find SAR',
      content: 'Find content',
      passwordHash: 'hashed_password',
      passwordRequired: false,
    })

    const found = await sarRepository.findSarById({ id: created.id })
    expect(found).not.toBeNull()
    expect(found?.title).toBe('Find SAR')
    expect(found?.content).toBe('Find content')
  })

  it('should return null for non-existent SAR by id', async () => {
    const sar = await sarRepository.findSarById({ id: 'nonexistent-sar-id' })
    expect(sar).toBeNull()
  })

  it('should update SAR by id', async () => {
    const user = await userRepository.create({
      email: `sar-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const created = await sarRepository.create({
      userId: user.id,
      title: 'Update SAR',
      content: 'Update content',
      passwordHash: 'hashed_password',
      passwordRequired: false,
    })

    const updated = await sarRepository.update(created.id, {
      title: 'Updated SAR',
      content: 'Updated content',
    })

    expect(updated.title).toBe('Updated SAR')
    expect(updated.isShredded).toBe(false)
  })

  it('should count SARs', async () => {
    const user = await userRepository.create({
      email: `sar-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    await sarRepository.create({
      userId: user.id,
      title: 'Count SAR 1',
      content: 'Count content 1',
      passwordHash: 'hashed_password',
      passwordRequired: false,
    })
    await sarRepository.create({
      userId: user.id,
      title: 'Count SAR 2',
      content: 'Count content 2',
      passwordHash: 'hashed_password',
      passwordRequired: false,
    })

    const count = await sarRepository.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  it('should find SARs by user id', async () => {
    const user = await userRepository.create({
      email: `sar-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const token1 = `find-user-sar-1-${Date.now()}-${Math.random()}`
    const token2 = `find-user-sar-2-${Date.now()}-${Math.random()}`
    await sarRepository.create({
      userId: user.id,
      title: 'Find user SAR 1',
      content: 'Find user content 1',
      passwordHash: token1,
      passwordRequired: false,
    })
    await sarRepository.create({
      userId: user.id,
      title: 'Find user SAR 2',
      content: 'Find user content 2',
      passwordHash: token2,
      passwordRequired: false,
    })

    const sars = await sarRepository.findSARByUserId({ userId: user.id })
    expect(sars.length).toBe(2)
  })
})
