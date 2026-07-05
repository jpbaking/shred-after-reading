import { prisma } from '../db.js'
import type { EmailVerificationToken, Prisma } from '@prisma/client'

export interface FindEmailVerificationTokenByTokenInput {
  token: string
}

export interface FindEmailVerificationTokenByUserIdInput {
  userId: string
}

export interface FindEmailVerificationTokensInput {
  where?: Prisma.EmailVerificationTokenWhereInput
  include?: Prisma.EmailVerificationTokenInclude
  take?: number
  skip?: number
}

export interface CreateEmailVerificationTokenInput {
  userId: string
  token: string
  email: string
  expiresAt: Date
}

export interface UpdateEmailVerificationTokenInput {
  token: string
  used: boolean
}

export class EmailVerificationTokenRepository {
  async findEmailVerificationTokenByToken(input: FindEmailVerificationTokenByTokenInput): Promise<EmailVerificationToken | null> {
    return prisma.emailVerificationToken.findFirst({
      where: { token: input.token },
    })
  }

  async findEmailVerificationTokenByUserId(input: FindEmailVerificationTokenByUserIdInput): Promise<EmailVerificationToken[]> {
    return prisma.emailVerificationToken.findMany({
      where: { userId: input.userId },
    })
  }

  async findEmailVerificationTokens(input: FindEmailVerificationTokensInput): Promise<EmailVerificationToken[]> {
    return prisma.emailVerificationToken.findMany({
      where: input.where,
      include: input.include,
      take: input.take,
      skip: input.skip,
    })
  }

  async createEmailVerificationToken(data: CreateEmailVerificationTokenInput): Promise<EmailVerificationToken> {
    return prisma.emailVerificationToken.create({
      data,
    })
  }

  async updateEmailVerificationToken(input: UpdateEmailVerificationTokenInput): Promise<EmailVerificationToken> {
    return prisma.emailVerificationToken.update({
      where: { token: input.token },
      data: {
        used: input.used,
      },
    })
  }

  async deleteEmailVerificationToken(token: string): Promise<EmailVerificationToken> {
    return prisma.emailVerificationToken.delete({
      where: { token },
    })
  }

  async count(): Promise<number> {
    return prisma.emailVerificationToken.count()
  }
}
