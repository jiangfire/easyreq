export const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; dotColor: string }
> = {
  SUBMITTED: { label: '待评审', color: 'text-gray-700', bgColor: 'bg-gray-100', dotColor: 'bg-gray-400' },
  UNDER_REVIEW: { label: '评审中', color: 'text-blue-700', bgColor: 'bg-blue-100', dotColor: 'bg-blue-500' },
  PLANNED: { label: '已规划', color: 'text-purple-700', bgColor: 'bg-purple-100', dotColor: 'bg-purple-500' },
  IN_DEVELOPMENT: { label: '开发中', color: 'text-amber-700', bgColor: 'bg-amber-100', dotColor: 'bg-amber-500' },
  IN_TESTING: { label: '测试中', color: 'text-cyan-700', bgColor: 'bg-cyan-100', dotColor: 'bg-cyan-500' },
  DELIVERED: { label: '已交付', color: 'text-green-700', bgColor: 'bg-green-100', dotColor: 'bg-green-500' },
  ACCEPTED: { label: '已验收', color: 'text-emerald-700', bgColor: 'bg-emerald-100', dotColor: 'bg-emerald-500' },
  REJECTED: { label: '已驳回', color: 'text-red-700', bgColor: 'bg-red-100', dotColor: 'bg-red-500' },
}

export const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  LOW: { label: '低', color: 'text-gray-500' },
  MEDIUM: { label: '中', color: 'text-blue-600' },
  HIGH: { label: '高', color: 'text-orange-600' },
  CRITICAL: { label: '紧急', color: 'text-red-600' },
}

export const STATUS_ORDER = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'PLANNED',
  'IN_DEVELOPMENT',
  'IN_TESTING',
  'DELIVERED',
  'ACCEPTED',
  'REJECTED',
] as const

export const VOTE_MILESTONES = [5, 10, 20, 50] as const
