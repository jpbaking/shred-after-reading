import { describe, it, expect } from 'vitest'
import { AppSettingsService } from './app-settings.service.js'
import { AppSettingsRepository } from '../repositories/app-settings.repository.js'

describe('AppSettingsService', () => {
  let appSettingsService: AppSettingsService
  let appSettingsRepository: AppSettingsRepository

  beforeEach(() => {
    appSettingsService = new AppSettingsService()
    appSettingsRepository = new AppSettingsRepository()
  })

  it('should get app setting by key', async () => {
    const key = `test-key-${Date.now()}-${Math.random()}`
    await appSettingsRepository.createAppSetting({
      key,
      value: 'test-value',
      description: 'Test description',
    })

    const setting = await appSettingsService.getAppSetting(key)
    expect(setting).not.toBeNull()
    expect(setting?.value).toBe('test-value')
  })

  it('should return null for non-existent setting', async () => {
    const setting = await appSettingsService.getAppSetting('nonexistent-key')
    expect(setting).toBeNull()
  })

  it('should update app setting', async () => {
    const key = `update-key-${Date.now()}-${Math.random()}`
    await appSettingsRepository.createAppSetting({
      key,
      value: 'old-value',
      description: 'Old description',
    })

    const updated = await appSettingsService.updateAppSetting(key, 'new-value', 'New description')

    expect(updated.value).toBe('new-value')
    expect(updated.description).toBe('New description')
  })

  it('should create app setting', async () => {
    const key = `create-key-${Date.now()}-${Math.random()}`
    const created = await appSettingsService.createAppSetting({
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

    const deleted = await appSettingsService.deleteAppSetting(key)
    expect(deleted).toBeUndefined()
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

    const count = await appSettingsService.countAppSettings()
    expect(count).toBeGreaterThanOrEqual(2)
  })
})