import { AppSettingsRepository } from '../repositories/app-settings.repository.js'

export interface AppSetting {
  key: string
  value: string | null
  description: string | null
}

export class AppSettingsService {
  private appSettingsRepository: AppSettingsRepository

  constructor() {
    this.appSettingsRepository = new AppSettingsRepository()
  }

  async findAppSettings(): Promise<AppSetting[]> {
    const settings = await this.appSettingsRepository.findAppSettings({})
    return settings.map((setting) => ({
      key: setting.key,
      value: setting.value,
      description: setting.description,
    }))
  }

  async getAppSetting(key: string): Promise<AppSetting | null> {
    const setting = await this.appSettingsRepository.getAppSetting({ key })
    if (!setting) return null
    return {
      key: setting.key,
      value: setting.value,
      description: setting.description,
    }
  }

  async updateAppSetting(key: string, value: string, description?: string): Promise<AppSetting> {
    const setting = await this.appSettingsRepository.updateAppSetting({
      key,
      value,
      description,
    })
    return {
      key: setting.key,
      value: setting.value,
      description: setting.description,
    }
  }

  async createAppSetting(data: { key: string; value: string; description?: string }): Promise<AppSetting> {
    const setting = await this.appSettingsRepository.createAppSetting(data)
    return {
      key: setting.key,
      value: setting.value,
      description: setting.description,
    }
  }

  async deleteAppSetting(key: string): Promise<void> {
    await this.appSettingsRepository.deleteAppSetting(key)
  }

  async countAppSettings(): Promise<number> {
    return this.appSettingsRepository.count()
  }
}
