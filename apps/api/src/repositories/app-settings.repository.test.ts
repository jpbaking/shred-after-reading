import { describe, it, expect } from 'vitest'
import { AppSettingsRepository } from './app-settings.repository.js'

describe('AppSettingsRepository', () => {
  let appSettingsRepository: AppSettingsRepository

  beforeEach(() => {
    appSettingsRepository = new AppSettingsRepository()
  })

  it('should get app setting by key', async () => {
    const key = `get-key-${Date.now()}-${Math.random()}`
    await appSettingsRepository.createAppSetting({
      key,
      value: 'get-value',
      description: 'Get description',
    })

    const setting = await appSettingsRepository.getAppSetting({ key })
    expect(setting).not.toBeNull()
    expect(setting?.value).toBe('get-value')
  })

  it('should return null for non-existent setting', async () => {
    const setting = await appSettingsRepository.getAppSetting({ key: 'nonexistent-key' })
    expect(setting).toBeNull()
  })

  it('should update app setting', async () => {
    const key = `update-key-${Date.now()}-${Math.random()}`
    await appSettingsRepository.createAppSetting({
      key,
      value: 'old-value',
      description: 'Old description',
    })

    const updated = await appSettingsRepository.updateAppSetting({
      key,
      value: 'new-value',
      description: 'New description',
    })

    expect(updated.value).toBe('new-value')
    expect(updated.description).toBe('New description')
  })

  it('should create app setting', async () => {
    const key = `create-key-${Date.now()}-${Math.random()}`
    const created = await appSettingsRepository.createAppSetting({
      key,
      value: 'create-value',
      description: 'Create description',
    })

    expect(created.key).toBe(key)
    expect(created.value).toBe('create-value')
    expect(created.description).toBe('Create description')
  })

  it('should delete app setting', async () => {
    const key = `delete-key-${Date.now()}-${Math.random()}`
    await appSettingsRepository.createAppSetting({
      key,
      value: 'delete-value',
      description: 'Delete description',
    })

    const deleted = await appSettingsRepository.deleteAppSetting(key)
    expect(deleted.key).toBe(key)
  })

  it('should find all app settings', async () => {
    const key1 = `find-all-key-1-${Date.now()}-${Math.random()}`
    const key2 = `find-all-key-2-${Date.now()}-${Math.random()}`
    await appSettingsRepository.createAppSetting({
      key: key1,
      value: 'find-all-value-1',
      description: 'Find all description 1',
    })
    await appSettingsRepository.createAppSetting({
      key: key2,
      value: 'find-all-value-2',
      description: 'Find all description 2',
    })

    const settings = await appSettingsRepository.findAppSettings({
      where: { key: { in: [key1, key2] } },
    })
    expect(settings.length).toBe(2)
  })

  it('should count app settings', async () => {
    const key1 = `count-key-1-${Date.now()}-${Math.random()}`
    const key2 = `count-key-2-${Date.now()}-${Math.random()}`
    await appSettingsRepository.createAppSetting({
      key: key1,
      value: 'count-value-1',
      description: 'Count description 1',
    })
    await appSettingsRepository.createAppSetting({
      key: key2,
      value: 'count-value-2',
      description: 'Count description 2',
    })

    const count = await appSettingsRepository.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })
})
