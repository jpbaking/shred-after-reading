import { prisma } from '../db.js'
import type { Prisma, Session } from '@prisma/client'

export interface FindSessionByTokenInput {
  token: string
}

export interface FindSessionByUserIdInput {
  userId: string
}

export interface FindSessionsInput {
  where?: Prisma.SessionWhereInput
  include?: Prisma.SessionInclude
  take?: number
  skip?: number
}

export interface CreateSessionInput {
  userId: string
  token: string
  expiresAt: Date
}

export interface UpdateSessionInput {
  token: string
  expiresAt: Date
}

export class SessionRepository {
  async findSessionByToken(input: FindSessionByTokenInput): Promise<Session | null> {
    return prisma.session.findFirst({
      where: { token: input.token },
    })
  }

  async findSessionByUserId(input: FindSessionByUserIdInput): Promise<Session[]> {
    return prisma.session.findMany({
      where: { userId: input.userId },
    })
  }

  async findSessions(input: FindSessionsInput): Promise<Session[]> {
    return prisma.session.findMany({
      where: input.where,
      include: input.include,
      take: input.take,
      skip: input.skip,
    })
  }

  async createSession(data: CreateSessionInput): Promise<Session> {
    return prisma.session.create({
      data,
    })
  }

  async updateSession(input: UpdateSessionInput): Promise<Session> {
    return prisma.session.update({
      where: { token: input.token },
      data: {
        expiresAt: input.expiresAt,
      },
    })
  }

  async deleteSession(token: string): Promise<Session> {
    return prisma.session.delete({
      where: { token },
    })
  }

  async count(): Promise<number> {
    return prisma.session.count()
  }
}
