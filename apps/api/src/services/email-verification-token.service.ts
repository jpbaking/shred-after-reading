import { EmailVerificationTokenRepository } from '../repositories/email-verification-token.repository.js'

export interface EmailVerificationToken {
  id: string
  userId: string
  token: string
  email: string
  expiresAt: Date
  used: boolean
}

export class EmailVerificationTokenService {
  private emailVerificationTokenRepository: EmailVerificationTokenRepository

  constructor() {
    this.emailVerificationTokenRepository = new EmailVerificationTokenRepository()
  }

  async findEmailVerificationTokenByToken(token: string): Promise<EmailVerificationToken | null> {
    const tokenData = await this.emailVerificationTokenRepository.findEmailVerificationTokenByToken({ token })
    if (!tokenData) return null
    return {
      id: tokenData.id,
      userId: tokenData.userId,
      token: tokenData.token,
      email: tokenData.email,
      expiresAt: tokenData.expiresAt,
      used: tokenData.used,
    }
  }

  async findEmailVerificationTokenByUserId(userId: string): Promise<EmailVerificationToken[]> {
    const tokens = await this.emailVerificationTokenRepository.findEmailVerificationTokenByUserId({ userId })
    return tokens.map((tokenData) => ({
      id: tokenData.id,
      userId: tokenData.userId,
      token: tokenData.token,
      email: tokenData.email,
      expiresAt: tokenData.expiresAt,
      used: tokenData.used,
    }))
  }

  async createEmailVerificationToken(data: {
    userId: string
    token: string
    email: string
    expiresAt: Date
  }): Promise<EmailVerificationToken> {
    const tokenData = await this.emailVerificationTokenRepository.createEmailVerificationToken(data)
    return {
      id: tokenData.id,
      userId: tokenData.userId,
      token: tokenData.token,
      email: tokenData.email,
      expiresAt: tokenData.expiresAt,
      used: tokenData.used,
    }
  }

  async updateEmailVerificationToken(token: string, used: boolean): Promise<EmailVerificationToken> {
    const tokenData = await this.emailVerificationTokenRepository.updateEmailVerificationToken({ token, used })
    return {
      id: tokenData.id,
      userId: tokenData.userId,
      token: tokenData.token,
      email: tokenData.email,
      expiresAt: tokenData.expiresAt,
      used: tokenData.used,
    }
  }

  async deleteEmailVerificationToken(token: string): Promise<EmailVerificationToken> {
    const tokenData = await this.emailVerificationTokenRepository.deleteEmailVerificationToken(token)
    return {
      id: tokenData.id,
      userId: tokenData.userId,
      token: tokenData.token,
      email: tokenData.email,
      expiresAt: tokenData.expiresAt,
      used: tokenData.used,
    }
  }

  async countEmailVerificationTokens(): Promise<number> {
    return this.emailVerificationTokenRepository.count()
  }
}
