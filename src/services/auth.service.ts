import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import type { Role } from '@/lib/transitions'

export type CurrentUser = {
  id: string
  email: string
  name: string
  role: Role
  avatar: string | null
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth()
  if (!session?.user?.id) {
    return null
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatar: true,
    },
  })

  if (!user) {
    return null
  }

  return user as CurrentUser
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }
  return user
}

export async function requireRole(...roles: string[]) {
  const user = await requireUser()
  if (!roles.includes(user.role)) {
    throw new Error('FORBIDDEN')
  }
  return user
}
