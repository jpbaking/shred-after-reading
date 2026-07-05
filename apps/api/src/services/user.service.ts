import { UserRepository } from '../repositories/user.repository.js'
import type { User } from '@prisma/client'

export class UserService {
  private userRepository: UserRepository

  constructor() {
    this.userRepository = new UserRepository()
  }

  async createUser(data: {
    email: string
    passwordHash: string
    name?: string
    emailVerified?: Date
  }): Promise<{ id: string; email: string; name: string | null }> {
    const user = await this.userRepository.create({
      email: data.email,
      passwordHash: data.passwordHash,
      name: data.name,
      emailVerified: data.emailVerified,
    })
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    }
  }

  async updateUser(id: string, data: {
    email?: string
    passwordHash?: string
    name?: string
    emailVerified?: Date
  }): Promise<{ id: string; email: string; name: string | null }> {
    const user = await this.userRepository.update(id, data)
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    }
  }

  async findUserByEmail(email: string): Promise<{ id: string; email: string; name: string | null } | null> {
    const user = await this.userRepository.findUserByEmail({ email })
    if (!user) return null
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    }
  }

  async findUserById(id: string): Promise<{ id: string; email: string; name: string | null } | null> {
    const user = await this.userRepository.findUserById({ id })
    if (!user) return null
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    }
  }

  async findUsers(): Promise<{ id: string; email: string; name: string | null }[]> {
    const users = await this.userRepository.findUsers({})
    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
    }))
  }

  async countUsers(): Promise<number> {
    return this.userRepository.count()
  }

  async findFullUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findUserByEmail({ email })
  }

  async findFullUserById(id: string): Promise<User | null> {
    return this.userRepository.findUserById({ id })
  }

  async markEmailVerified(id: string): Promise<User> {
    return this.userRepository.update(id, { emailVerified: new Date() })
  }
}
