import { SarRepository } from '../repositories/sar.repository.js'
import { AppSettingsService } from './app-settings.service.js'
import { ExpiryService } from './expiry.service.js'
import { generateSARId, isValidSARId } from '../id.js'
import { hashPassword, verifyPassword } from '../security.js'
import type { Prisma, Sar } from '@prisma/client'
import type { ExpiryRequest } from '../expiry.js'

export const MAX_SAR_SIZE_KEY = 'max_sar_size_bytes'
const FALLBACK_MAX_SAR_SIZE_BYTES = 1048576
export const RETENTION_DAYS = 30

export class SarError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'SarError'
    this.status = status
  }
}

export interface SarMetadata {
  id: string
  passwordRequired: boolean
  isMarkdown: boolean
  createdAt: Date
  expiresAt: Date | null
}

export interface OwnedSarSummary extends SarMetadata {
  contentPreview: string
}

export interface SarContent extends SarMetadata {
  content: string
}

function toMetadata(sar: Sar): SarMetadata {
  return {
    id: sar.id,
    passwordRequired: sar.passwordRequired,
    isMarkdown: sar.isMarkdown,
    createdAt: sar.createdAt,
    expiresAt: sar.expiresAt,
  }
}

function isExpired(sar: Sar, now: Date): boolean {
  return sar.expiresAt !== null && sar.expiresAt <= now
}

export class SarService {
  private sarRepository: SarRepository
  private appSettingsService: AppSettingsService
  private expiryService: ExpiryService

  constructor() {
    this.sarRepository = new SarRepository()
    this.appSettingsService = new AppSettingsService()
    this.expiryService = new ExpiryService()
  }

  private async getMaxSarSizeBytes(): Promise<number> {
    const setting = await this.appSettingsService.getAppSetting(MAX_SAR_SIZE_KEY)
    const parsed = setting?.value ? parseInt(setting.value, 10) : NaN
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return FALLBACK_MAX_SAR_SIZE_BYTES
    }
    return parsed
  }

  async createSarForOwner(input: {
    userId: string
    content: string
    isMarkdown?: boolean
    password?: string
    expiry?: ExpiryRequest
    title?: string
  }): Promise<SarMetadata> {
    if (typeof input.content !== 'string' || input.content.length === 0) {
      throw new SarError(422, 'Content is required')
    }

    const maxBytes = await this.getMaxSarSizeBytes()
    if (Buffer.byteLength(input.content, 'utf8') > maxBytes) {
      throw new SarError(413, `Content exceeds the maximum size of ${maxBytes} bytes`)
    }

    if (input.password !== undefined && input.password.length === 0) {
      throw new SarError(422, 'SAR password must not be empty')
    }

    const now = new Date()
    const expiresAt = await this.expiryService.resolveExpiry(now, input.expiry)

    const sar = await this.sarRepository.create({
      id: generateSARId(),
      userId: input.userId,
      title: input.title ?? '',
      content: input.content,
      isMarkdown: input.isMarkdown === true,
      passwordHash: input.password ? hashPassword(input.password) : undefined,
      passwordRequired: input.password !== undefined,
      expiresAt,
    })

    return toMetadata(sar)
  }

  async listActiveForOwner(userId: string): Promise<OwnedSarSummary[]> {
    const sars = await this.sarRepository.findActiveSARsByUserId(userId, new Date())
    return sars.map((sar) => ({
      ...toMetadata(sar),
      contentPreview: sar.content.slice(0, 160),
    }))
  }

  async readOwnedContent(userId: string, sarId: string): Promise<SarContent> {
    const sar = await this.loadOwnedSar(userId, sarId)
    return { ...toMetadata(sar), content: sar.content }
  }

  /** Loads an active (not expired, not shredded) SAR by public id. */
  private async loadActiveSar(sarId: string): Promise<Sar> {
    if (!isValidSARId(sarId)) {
      throw new SarError(422, 'Malformed SAR id')
    }

    const sar = await this.sarRepository.findSarById({ id: sarId })
    if (!sar) {
      throw new SarError(404, 'SAR not found')
    }

    if (sar.isShredded || isExpired(sar, new Date())) {
      throw new SarError(410, 'This SAR is no longer available')
    }

    return sar
  }

  async readPublicMetadata(sarId: string): Promise<SarMetadata> {
    const sar = await this.loadActiveSar(sarId)
    return toMetadata(sar)
  }

  async readPublicContent(sarId: string, password?: string): Promise<SarContent> {
    const sar = await this.loadActiveSar(sarId)

    if (sar.passwordRequired) {
      if (!password) {
        throw new SarError(401, 'Password required')
      }
      if (!sar.passwordHash || !verifyPassword(password, sar.passwordHash)) {
        throw new SarError(403, 'Incorrect password')
      }
    }

    return { ...toMetadata(sar), content: sar.content }
  }

  /** Loads an active SAR and proves ownership; 403 when owned by someone else. */
  private async loadOwnedSar(userId: string, sarId: string): Promise<Sar> {
    const sar = await this.loadActiveSar(sarId)
    if (sar.userId !== userId) {
      throw new SarError(403, 'You do not own this SAR')
    }
    return sar
  }

  async changeExpiryForOwner(
    userId: string,
    sarId: string,
    expiry: ExpiryRequest,
  ): Promise<SarMetadata> {
    const sar = await this.loadOwnedSar(userId, sarId)
    const expiresAt = await this.expiryService.resolveExpiry(new Date(), expiry)
    const updated = await this.sarRepository.update(sar.id, { expiresAt })
    return toMetadata(updated)
  }

  async setPasswordForOwner(
    userId: string,
    sarId: string,
    password: string,
  ): Promise<SarMetadata> {
    if (!password) {
      throw new SarError(422, 'SAR password must not be empty')
    }
    const sar = await this.loadOwnedSar(userId, sarId)
    const updated = await this.sarRepository.update(sar.id, {
      passwordHash: hashPassword(password),
      passwordRequired: true,
    })
    return toMetadata(updated)
  }

  async removePasswordForOwner(userId: string, sarId: string): Promise<SarMetadata> {
    const sar = await this.loadOwnedSar(userId, sarId)
    const updated = await this.sarRepository.update(sar.id, {
      passwordHash: null,
      passwordRequired: false,
    })
    return toMetadata(updated)
  }

  async deleteForOwner(userId: string, sarId: string): Promise<void> {
    const sar = await this.loadOwnedSar(userId, sarId)
    await this.sarRepository.update(sar.id, {
      isShredded: true,
      shredDate: new Date(),
    })
  }

  /**
   * Purge rows past the retention window: expired or owner-deleted more than
   * `retentionDays` ago. Safe to run repeatedly.
   */
  async purgeExpiredSars(retentionDays: number = RETENTION_DAYS, now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)
    return this.sarRepository.purgeBefore(cutoff)
  }

  // --- Basic persistence helpers kept for existing service tests ---

  async createSar(data: {
    userId: string
    title: string
    content: string
    passwordHash?: string
    passwordRequired?: boolean
    metadata?: Prisma.InputJsonValue
    expiresAt?: Date
  }): Promise<{ id: string; title: string; passwordRequired: boolean }> {
    const sar = await this.sarRepository.create(data)
    return {
      id: sar.id,
      title: sar.title,
      passwordRequired: sar.passwordRequired,
    }
  }

  async updateSar(
    id: string,
    data: {
      title?: string
      content?: string
      passwordHash?: string
      passwordRequired?: boolean
      metadata?: Prisma.InputJsonValue
      expiresAt?: Date
      isShredded?: boolean
      shredDate?: Date
    },
  ): Promise<{ id: string; title: string; isShredded: boolean }> {
    const sar = await this.sarRepository.update(id, data)
    return {
      id: sar.id,
      title: sar.title,
      isShredded: sar.isShredded,
    }
  }

  async findSarById(
    id: string,
  ): Promise<{
    id: string
    title: string
    content: string
    passwordRequired: boolean
    isShredded: boolean
  } | null> {
    const sar = await this.sarRepository.findSarById({ id })
    if (!sar) return null
    return {
      id: sar.id,
      title: sar.title,
      content: sar.content,
      passwordRequired: sar.passwordRequired,
      isShredded: sar.isShredded,
    }
  }

  async countSARs(): Promise<number> {
    return this.sarRepository.count()
  }
}
