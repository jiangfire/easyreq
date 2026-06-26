export type ReqStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'PLANNED'
  | 'IN_DEVELOPMENT'
  | 'IN_TESTING'
  | 'DELIVERED'
  | 'ACCEPTED'
  | 'REJECTED'

export type Role = 'SUBMITTER' | 'MANAGER' | 'DEVELOPER' | 'ADMIN'

/**
 * All legal transitions (standard + quick path + retreat).
 * Keys are from-status, values are sets of valid to-statuses.
 */
const STANDARD_TRANSITIONS: Record<ReqStatus, ReqStatus[]> = {
  SUBMITTED: ['UNDER_REVIEW', 'PLANNED', 'IN_DEVELOPMENT'],
  UNDER_REVIEW: ['PLANNED', 'REJECTED'],
  PLANNED: ['IN_DEVELOPMENT', 'REJECTED'],
  IN_DEVELOPMENT: ['IN_TESTING', 'DELIVERED'],
  IN_TESTING: ['DELIVERED', 'IN_DEVELOPMENT'],
  DELIVERED: ['ACCEPTED', 'IN_DEVELOPMENT'],
  ACCEPTED: ['IN_DEVELOPMENT'],
  REJECTED: ['SUBMITTED'],
}

/**
 * Quick path transitions (Manager/Admin only).
 * These skip intermediate steps.
 */
const QUICK_PATH_TRANSITIONS: Array<[ReqStatus, ReqStatus]> = [
  ['SUBMITTED', 'PLANNED'],
  ['SUBMITTED', 'IN_DEVELOPMENT'],
  ['IN_DEVELOPMENT', 'DELIVERED'],
]

/**
 * Role-based transition permissions.
 * Defines which to-statuses each role can execute.
 * ADMIN can do everything MANAGER can.
 */
const ROLE_PERMISSIONS: Record<Exclude<Role, 'ADMIN'>, ReqStatus[]> = {
  MANAGER: [
    'UNDER_REVIEW',
    'PLANNED',
    'IN_DEVELOPMENT',
    'IN_TESTING',
    'DELIVERED',
    'ACCEPTED',
    'REJECTED',
  ],
  DEVELOPER: [
    'IN_DEVELOPMENT',
    'IN_TESTING',
    'DELIVERED',
  ],
  SUBMITTER: [
    'SUBMITTED',
    'ACCEPTED',
  ],
}

/**
 * Check if a transition is legally possible (ignoring permissions).
 */
export function canTransition(from: ReqStatus, to: ReqStatus): boolean {
  if (from === to) return false
  return STANDARD_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Check if a transition is a quick path (skips intermediate steps).
 * Only applies to the defined quick path pairs.
 */
export function isQuickPathTransition(from: ReqStatus, to: ReqStatus): boolean {
  return QUICK_PATH_TRANSITIONS.some(([f, t]) => f === from && t === to)
}

/**
 * Check if a role has permission to execute a specific transition.
 */
export function hasTransitionPermission(from: ReqStatus, to: ReqStatus, role: Role): boolean {
  // ADMIN is superuser — can do everything
  if (role === 'ADMIN') return true

  // Must be a legal transition first
  if (!canTransition(from, to)) return false

  // Quick path transitions require MANAGER or ADMIN
  if (isQuickPathTransition(from, to)) {
    return role === 'MANAGER'
  }

  // Check role permissions
  const allowedTargets = ROLE_PERMISSIONS[role]
  return allowedTargets.includes(to)
}

/**
 * Get all available transition targets for a given status and role.
 * Useful for rendering action buttons in the UI.
 */
export function getAvailableTransitions(from: ReqStatus, role: Role): ReqStatus[] {
  const allTargets = STANDARD_TRANSITIONS[from] ?? []
  return allTargets.filter((to) => hasTransitionPermission(from, to, role))
}
