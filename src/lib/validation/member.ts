import { z } from 'zod'

export const addMemberSchema = z
  .object({
    userId: z.string().min(1, '请提供用户 ID').optional(),
    email: z.string().email('请输入有效邮箱').optional(),
  })
  .refine((data) => data.userId || data.email, {
    message: '请提供 userId 或 email',
  })

export type AddMemberInput = z.infer<typeof addMemberSchema>
