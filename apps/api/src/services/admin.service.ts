import { UserRepository } from '../repositories/user.repository.js'
import { SarRepository } from '../repositories/sar.repository.js'
import { AppSettingsService } from './app-settings.service.js'
import {
  ExpiryService,
  GLOBAL_EXPIRY_LIMIT_KEY,
  GLOBAL_EXPIRY_LIMIT_MINUTES_KEY,
  parseExpiryRequest,
} from './expiry.service.js'
import { expiryToMinutes, type ExpiryRequest } from '../expiry.js'
import type { Prisma, User } from '@prisma/client'

export interface AdminUserSummary {
  id: string
  email: string
  name: string | null
  emailVerified: boolean
  isAdmin: boolean
  isBanned: boolean
  createdAt: Date
  sarStats: {
    total: number
    active: number
    expired: number
    deleted: number
  }
}

export interface AdminSarSummary {
  id: string
  owner: {
    id: string
    email: string
    name: string | null
  }
  sharePath: string
  passwordRequired: boolean
  isMarkdown: boolean
  createdAt: Date
  expiresAt: Date | null
  deletedAt: Date | null
  status: 'active' | 'expired' | 'deleted'
  contentPreview: string
}

export interface AdminSarDetail extends AdminSarSummary {
  content: string
}

export interface AdminSettingsSummary {
  globalExpiryLimit: ExpiryRequest
  hardCap: ExpiryRequest
}

export class AdminError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'AdminError'
    this.status = status
  }
}

type UserWithSarRows = Prisma.UserGetPayload<{
  include: {
    sar: {
      select: {
        id: true
        isShredded: true
        expiresAt: true
      }
    }
  }
}>

type SarWithOwner = Prisma.SarGetPayload<{
  include: {
    user: {
      select: {
        id: true
        email: true
        name: true
      }
    }
  }
}>

const CONTENT_PREVIEW_LENGTH = 160
const GLOBAL_EXPIRY_HARD_CAP: ExpiryRequest = { amount: 1, unit: 'year' }

function toUserSummary(user: UserWithSarRows, now: Date): AdminUserSummary {
  const total = user.sar.length
  let active = 0
  let expired = 0
  let deleted = 0

  for (const sar of user.sar) {
    if (sar.isShredded) {
      deleted += 1
      continue
    }
    if (sar.expiresAt !== null && sar.expiresAt <= now) {
      expired += 1
      continue
    }
    active += 1
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified !== null,
    isAdmin: user.isAdmin,
    isBanned: user.isBanned,
    createdAt: user.createdAt,
    sarStats: {
      total,
      active,
      expired,
      deleted,
    },
  }
}

function classifySarStatus(
  sar: Pick<SarWithOwner, 'isShredded' | 'expiresAt'>,
  now: Date,
): 'active' | 'expired' | 'deleted' {
  if (sar.isShredded) {
    return 'deleted'
  }
  if (sar.expiresAt !== null && sar.expiresAt <= now) {
    return 'expired'
  }
  return 'active'
}

function toSarSummary(sar: SarWithOwner, now: Date): AdminSarSummary {
  return {
    id: sar.id,
    owner: {
      id: sar.user.id,
      email: sar.user.email,
      name: sar.user.name,
    },
    sharePath: `/sar/${sar.id}`,
    passwordRequired: sar.passwordRequired,
    isMarkdown: sar.isMarkdown,
    createdAt: sar.createdAt,
    expiresAt: sar.expiresAt,
    deletedAt: sar.shredDate,
    status: classifySarStatus(sar, now),
    contentPreview: sar.content.slice(0, CONTENT_PREVIEW_LENGTH),
  }
}

function simplifyExpiry(minutes: number): ExpiryRequest {
  const yearMinutes = 365 * 24 * 60
  const monthMinutes = 30 * 24 * 60
  const dayMinutes = 24 * 60

  if (minutes % yearMinutes === 0) {
    return { amount: minutes / yearMinutes, unit: 'year' }
  }
  if (minutes % monthMinutes === 0) {
    return { amount: minutes / monthMinutes, unit: 'months' }
  }
  if (minutes % dayMinutes === 0) {
    return { amount: minutes / dayMinutes, unit: 'days' }
  }
  if (minutes % 60 === 0) {
    return { amount: minutes / 60, unit: 'hours' }
  }
  return { amount: minutes, unit: 'minutes' }
}

export class AdminService {
  private userRepository: UserRepository
  private sarRepository: SarRepository
  private appSettingsService: AppSettingsService
  private expiryService: ExpiryService

  constructor() {
    this.userRepository = new UserRepository()
    this.sarRepository = new SarRepository()
    this.appSettingsService = new AppSettingsService()
    this.expiryService = new ExpiryService()
  }

  async listUsers(search?: string): Promise<AdminUserSummary[]> {
    const query = search?.trim()
    const users = await this.userRepository.findUsers({
      where:
        query && query.length > 0
          ? {
              OR: [
                { email: { contains: query, mode: 'insensitive' } },
                { name: { contains: query, mode: 'insensitive' } },
              ],
            }
          : undefined,
      include: {
        sar: {
          select: {
            id: true,
            isShredded: true,
            expiresAt: true,
          },
        },
      },
      take: 100,
    })

    const now = new Date()
    return users.map((user) => toUserSummary(user, now))
  }

  async setUserBanState(userId: string, banned: boolean): Promise<AdminUserSummary> {
    const user = await this.requireUser(userId)
    const updated = await this.userRepository.update(user.id, { isBanned: banned })
    return this.loadSummary(updated.id)
  }

  async markUserVerified(userId: string): Promise<AdminUserSummary> {
    const user = await this.requireUser(userId)
    await this.userRepository.update(user.id, { emailVerified: user.emailVerified ?? new Date() })
    return this.loadSummary(user.id)
  }

  async listSars(input: {
    search?: string
    status?: string
  }): Promise<AdminSarSummary[]> {
    const query = input.search?.trim()
    const status = input.status ?? 'all'
    const now = new Date()
    const filters: Prisma.SarWhereInput[] = []

    if (status === 'active') {
      filters.push({
        isShredded: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      })
    } else if (status === 'expired') {
      filters.push({
        isShredded: false,
        expiresAt: { lte: now },
      })
    } else if (status === 'deleted') {
      filters.push({ isShredded: true })
    } else if (status !== 'all') {
      throw new AdminError(422, 'status must be one of: all, active, expired, deleted')
    }

    if (query && query.length > 0) {
      filters.push({
        OR: [
          { id: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
          { user: { is: { email: { contains: query, mode: 'insensitive' } } } },
          { user: { is: { name: { contains: query, mode: 'insensitive' } } } },
        ],
      })
    }

    const sars = await this.sarRepository.findSARs({
      where: filters.length > 0 ? { AND: filters } : undefined,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return sars.map((sar) => toSarSummary(sar, now))
  }

  async getSarDetail(sarId: string): Promise<AdminSarDetail> {
    const sars = await this.sarRepository.findSARs({
      where: { id: sarId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      take: 1,
    })
    const sar = sars[0]
    if (!sar) {
      throw new AdminError(404, 'SAR not found')
    }
    return {
      ...toSarSummary(sar, new Date()),
      content: sar.content,
    }
  }

  async deleteSar(sarId: string): Promise<AdminSarSummary> {
    const detail = await this.getSarDetail(sarId)
    if (detail.status !== 'deleted') {
      await this.sarRepository.update(sarId, {
        isShredded: true,
        shredDate: new Date(),
      })
    }
    const refreshed = await this.getSarDetail(sarId)
    return refreshed
  }

  async getSettings(): Promise<AdminSettingsSummary> {
    const current = await this.expiryService.getGlobalLimit()
    return {
      globalExpiryLimit: simplifyExpiry(expiryToMinutes(current)),
      hardCap: GLOBAL_EXPIRY_HARD_CAP,
    }
  }

  async updateGlobalExpiryLimit(input: unknown): Promise<AdminSettingsSummary> {
    const expiry = parseExpiryRequest(input)
    const minutes = expiryToMinutes(expiry)
    if (minutes > expiryToMinutes(GLOBAL_EXPIRY_HARD_CAP)) {
      throw new AdminError(422, 'Global expiry limit cannot exceed 1 year')
    }

    await this.upsertSetting(
      GLOBAL_EXPIRY_LIMIT_MINUTES_KEY,
      String(minutes),
      'Global expiry limit in minutes for precise admin-configurable limits',
    )
    await this.upsertSetting(
      GLOBAL_EXPIRY_LIMIT_KEY,
      String(Math.max(1, Math.ceil(minutes / (24 * 60)))),
      'Legacy day-based global expiry limit kept in sync for compatibility',
    )

    return this.getSettings()
  }

  private async loadSummary(userId: string): Promise<AdminUserSummary> {
    const users = await this.userRepository.findUsers({
      where: { id: userId },
      include: {
        sar: {
          select: {
            id: true,
            isShredded: true,
            expiresAt: true,
          },
        },
      },
      take: 1,
    })

    const user = users[0]
    if (!user) {
      throw new AdminError(404, 'User not found')
    }

    return toUserSummary(user, new Date())
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.userRepository.findUserById({ id: userId })
    if (!user) {
      throw new AdminError(404, 'User not found')
    }
    return user
  }

  private async upsertSetting(key: string, value: string, description: string): Promise<void> {
    const existing = await this.appSettingsService.getAppSetting(key)
    if (existing) {
      await this.appSettingsService.updateAppSetting(key, value, description)
      return
    }
    await this.appSettingsService.createAppSetting({ key, value, description })
  }
}
