import { describe, it, expect } from 'vitest'
import { SarService } from './sar.service.js'
import { UserRepository } from '../repositories/user.repository.js'

describe('SarService', () => {
  let sarService: SarService
  let userRepository: UserRepository

  beforeEach(() => {
    sarService = new SarService()
    userRepository = new UserRepository()
  })

  it('should create a SAR', async () => {
    const user = await userRepository.create({
      email: `sar-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const created = await sarService.createSar({
      userId: user.id,
      title: 'Test SAR',
      content: 'Test content',
      passwordHash: 'hashed_password',
    })

    expect(created.id).toBeDefined()
    expect(created.title).toBe('Test SAR')
    expect(created.passwordRequired).toBe(false)
  })

  it('should find SAR by id', async () => {
    const user = await userRepository.create({
      email: `sar-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const created = await sarService.createSar({
      userId: user.id,
      title: 'Find SAR',
      content: 'Find content',
      passwordHash: 'hashed_password',
    })

    const found = await sarService.findSarById(created.id)
    expect(found).not.toBeNull()
    expect(found?.title).toBe('Find SAR')
    expect(found?.content).toBe('Find content')
  })

  it('should return null for non-existent SAR by id', async () => {
    const sar = await sarService.findSarById('nonexistent-sar-id')
    expect(sar).toBeNull()
  })

  it('should update SAR by id', async () => {
    const user = await userRepository.create({
      email: `sar-user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed_password',
    })
    const created = await sarService.createSar({
      userId: user.id,
      title: 'Update SAR',
      content: 'Update content',
      passwordHash: 'hashed_password',
    })

    const updated = await sarService.updateSar(created.id, {
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
    await sarService.createSar({
      userId: user.id,
      title: 'Count SAR 1',
      content: 'Count content 1',
      passwordHash: 'hashed_password',
    })
    await sarService.createSar({
      userId: user.id,
      title: 'Count SAR 2',
      content: 'Count content 2',
      passwordHash: 'hashed_password',
    })

    const count = await sarService.countSARs()
    expect(count).toBeGreaterThanOrEqual(2)
  })
})
