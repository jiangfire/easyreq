import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { AppError } from '@/lib/errors'
import type { Role } from '@/generated/prisma/client'

const BCRYPT_COST = 12
const MIN_PASSWORD_LENGTH = 8

const VALID_ROLES: Role[] = ['SUBMITTER', 'MANAGER', 'DEVELOPER', 'ADMIN']

export class UserService {
  async create(input: {
    email: string
    name: string
    password: string
    role: string
  }) {
    const email = input.email.trim().toLowerCase()
    const name = input.name.trim()

    if (!email || !name) {
      throw new AppError('VALIDATION_ERROR', '邮箱和姓名不能为空')
    }

    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new AppError('VALIDATION_ERROR', `密码至少 ${MIN_PASSWORD_LENGTH} 位`)
    }

    if (!VALID_ROLES.includes(input.role as Role)) {
      throw new AppError('VALIDATION_ERROR', '无效的角色')
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      throw new AppError('CONFLICT', '该邮箱已被注册')
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST)

    return db.user.create({
      data: { email, name, passwordHash, role: input.role as Role },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    })
  }

  async updateRole(userId: string, role: string) {
    if (!VALID_ROLES.includes(role as Role)) {
      throw new AppError('VALIDATION_ERROR', '无效的角色')
    }

    return db.user.update({
      where: { id: userId },
      data: { role: role as Role },
      select: { id: true, email: true, name: true, role: true },
    })
  }
}

export const userService = new UserService()
