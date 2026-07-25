import { db } from '@/lib/db'
import { AppError } from '@/lib/errors'

export type RequirementAccessInfo = {
  projectId: string | null
  authorId: string
}

/**
 * Verify a user can access / mutate a requirement based on its
 * project status and the user's relationship to it.
 *
 * - Assigned requirements: caller must be a project member, the
 *   requirement author, or a global MANAGER/ADMIN.
 * - Unassigned requirements: behavior depends on `unassignedMode`.
 *
 * Centralized so comment / vote / attachment / transition services
 * share one implementation of the rule.
 */
export async function requireRequirementAccess(
  requirement: RequirementAccessInfo,
  userId: string,
  options: { unassignedMode: 'any-authenticated' | 'author-and-managers' } = {
    unassignedMode: 'author-and-managers',
  },
) {
  if (!requirement.projectId) {
    if (options.unassignedMode === 'any-authenticated') return
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    const isAuthor = requirement.authorId === userId
    const isManagerOrAdmin = user?.role === 'MANAGER' || user?.role === 'ADMIN'
    if (!isAuthor && !isManagerOrAdmin) {
      throw new AppError('FORBIDDEN', '你没有权限访问该需求')
    }
    return
  }

  const membership = await db.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId: requirement.projectId } },
  })
  if (membership) return

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  // Spec: project members + global ADMIN can access; global MANAGER must be
  // explicitly added to the project before they can interact with it.
  if (user?.role === 'ADMIN') return
  throw new AppError('FORBIDDEN', '你不是该项目成员')
}
