import { z } from 'zod'

export const createProjectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空').max(50, '项目名称最多50个字符'),
  slug: z
    .string()
    .min(1, '项目标识不能为空')
    .max(30, '项目标识最多30个字符')
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, '项目标识只能包含小写字母、数字和连字符'),
  description: z.string().max(500, '描述最多500个字符').optional(),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
