import { SessionRepository } from '../repositories/session.repository.js'

export interface Session {
  id: string
  userId: string
  token: string
  expiresAt: Date
}

export class SessionService {
  private sessionRepository: SessionRepository

  constructor() {
    this.sessionRepository = new SessionRepository()
  }

  async findSessionByToken(token: string): Promise<Session | null> {
    const session = await this.sessionRepository.findSessionByToken({ token })
    if (!session) return null
    return {
      id: session.id,
      userId: session.userId,
      token: session.token,
      expiresAt: session.expiresAt,
    }
  }

  async findSessionByUserId(userId: string): Promise<Session[]> {
    const sessions = await this.sessionRepository.findSessionByUserId({ userId })
    return sessions.map((session) => ({
      id: session.id,
      userId: session.userId,
      token: session.token,
      expiresAt: session.expiresAt,
    }))
  }

  async createSession(data: {
    userId: string
    token: string
    expiresAt: Date
  }): Promise<Session> {
    const session = await this.sessionRepository.createSession(data)
    return {
      id: session.id,
      userId: session.userId,
      token: session.token,
      expiresAt: session.expiresAt,
    }
  }

  async updateSession(token: string, expiresAt: Date): Promise<Session> {
    const session = await this.sessionRepository.updateSession({ token, expiresAt })
    return {
      id: session.id,
      userId: session.userId,
      token: session.token,
      expiresAt: session.expiresAt,
    }
  }

  async deleteSession(token: string): Promise<Session> {
    const session = await this.sessionRepository.deleteSession(token)
    return {
      id: session.id,
      userId: session.userId,
      token: session.token,
      expiresAt: session.expiresAt,
    }
  }

  async countSessions(): Promise<number> {
    return this.sessionRepository.count()
  }
}
