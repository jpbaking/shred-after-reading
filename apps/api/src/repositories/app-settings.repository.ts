import { prisma } from '../db.js'
import type { AppSettings, Prisma } from '@prisma/client'

export interface FindAppSettingsInput {
  where?: Prisma.AppSettingsWhereInput
  take?: number
  skip?: number
}

export interface GetAppSettingInput {
  key: string
}

export interface UpdateAppSettingInput {
  key: string
  value: string
  description?: string
}

export class AppSettingsRepository {
  async findAppSettings(input: FindAppSettingsInput): Promise<AppSettings[]> {
    return prisma.appSettings.findMany({
      where: input.where,
      take: input.take,
      skip: input.skip,
    })
  }

  async getAppSetting(input: GetAppSettingInput): Promise<AppSettings | null> {
    return prisma.appSettings.findUnique({
      where: { key: input.key },
    })
  }

  async updateAppSetting(input: UpdateAppSettingInput): Promise<AppSettings> {
    return prisma.appSettings.update({
      where: { key: input.key },
      data: {
        value: input.value,
        description: input.description,
      },
    })
  }

  async createAppSetting(data: { key: string; value: string; description?: string }): Promise<AppSettings> {
    return prisma.appSettings.create({
      data,
    })
  }

  async deleteAppSetting(key: string): Promise<AppSettings> {
    return prisma.appSettings.delete({
      where: { key },
    })
  }

  async count(): Promise<number> {
    return prisma.appSettings.count()
  }
}
