import { z } from 'zod'

export const createRequirementSchema = z.object({
  title: z
    .string()
    .min(1, '请输入需求标题')
    .max(200, '标题最多200个字符')
    .trim(),
  body: z.string().max(50000, '描述最多50000个字符').optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  expectedDate: z.string().datetime().optional(),
  acceptanceCriteria: z.string().max(5000).optional(),
})

export type CreateRequirementInput = z.input<typeof createRequirementSchema>

export const updateRequirementSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  body: z.string().max(50000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  expectedDate: z.string().datetime().optional(),
  acceptanceCriteria: z.string().max(5000).optional(),
  assigneeId: z.string().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
})

export type UpdateRequirementInput = z.infer<typeof updateRequirementSchema>

export const transitionSchema = z.object({
  toStatus: z.enum([
    'SUBMITTED',
    'UNDER_REVIEW',
    'PLANNED',
    'IN_DEVELOPMENT',
    'IN_TESTING',
    'DELIVERED',
    'ACCEPTED',
    'REJECTED',
  ]),
  note: z.string().max(1000).optional(),
})

export type TransitionInput = z.infer<typeof transitionSchema>
