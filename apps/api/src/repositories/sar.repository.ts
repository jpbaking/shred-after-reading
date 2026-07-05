import { prisma } from '../db.js'
import type { Prisma, Sar } from '@prisma/client'

export interface CreateSarInput {
  id?: string
  userId: string
  title: string
  content: string
  passwordHash?: string
  passwordRequired?: boolean
  isMarkdown?: boolean
  metadata?: Prisma.InputJsonValue
  expiresAt?: Date
}

export interface UpdateSarInput {
  title?: string
  content?: string
  passwordHash?: string | null
  passwordRequired?: boolean
  isMarkdown?: boolean
  metadata?: Prisma.InputJsonValue
  expiresAt?: Date
  isShredded?: boolean
  shredDate?: Date
}

export interface FindSarByIdInput {
  id: string
}

export interface FindSARByUserIdInput {
  userId: string
}

export class SarRepository {
  async create(data: CreateSarInput): Promise<Sar> {
    return prisma.sar.create({
      data,
    })
  }

  async update(id: string, data: UpdateSarInput): Promise<Sar> {
    return prisma.sar.update({
      where: { id },
      data,
    })
  }

  async findSarById(input: FindSarByIdInput): Promise<Sar | null> {
    return prisma.sar.findUnique({
      where: { id: input.id },
    })
  }

  async findSARByUserId(input: FindSARByUserIdInput): Promise<Sar[]> {
    return prisma.sar.findMany({
      where: { userId: input.userId, isShredded: false },
    })
  }

  async findActiveSARsByUserId(userId: string, now: Date): Promise<Sar[]> {
    return prisma.sar.findMany({
      where: {
        userId,
        isShredded: false,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async purgeBefore(cutoff: Date): Promise<number> {
    const result = await prisma.sar.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: cutoff } },
          { isShredded: true, shredDate: { lt: cutoff } },
        ],
      },
    })
    return result.count
  }

  async findSARs<T extends Prisma.SarFindManyArgs>(
    input: Prisma.SelectSubset<T, Prisma.SarFindManyArgs>,
  ): Promise<Prisma.SarGetPayload<T>[]> {
    return prisma.sar.findMany(input)
  }

  async count(): Promise<number> {
    return prisma.sar.count()
  }

  async delete(id: string): Promise<Sar> {
    return prisma.sar.delete({
      where: { id },
    })
  }
}
