import { prisma } from '../db.js'
import type { Prisma, User } from '@prisma/client'

export interface CreateUserInput {
  email: string
  passwordHash: string
  name?: string
  emailVerified?: Date
}

export interface UpdateUserInput {
  email?: string
  passwordHash?: string
  name?: string
  emailVerified?: Date
  isBanned?: boolean
  isAdmin?: boolean
}

export interface FindUserByEmailInput {
  email: string
}

export interface FindUserByIdInput {
  id: string
}

export class UserRepository {
  async create(data: CreateUserInput): Promise<User> {
    return prisma.user.create({
      data,
    })
  }

  async update(id: string, data: UpdateUserInput): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    })
  }

  async updateByEmail(data: UpdateUserInput & { email: string }): Promise<User> {
    return prisma.user.update({
      where: { email: data.email },
      data,
    })
  }

  async findUserByEmail(input: FindUserByEmailInput): Promise<User | null> {
    return prisma.user.findFirst({
      where: { email: input.email },
    })
  }

  async findUserById(input: FindUserByIdInput): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id: input.id },
    })
  }

  async findUsers<T extends Prisma.UserFindManyArgs>(
    input: Prisma.SelectSubset<T, Prisma.UserFindManyArgs>,
  ): Promise<Prisma.UserGetPayload<T>[]> {
    return prisma.user.findMany(input)
  }

  async count(): Promise<number> {
    return prisma.user.count()
  }
}
