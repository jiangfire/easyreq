import { z } from 'zod'

export const createCommentSchema = z.object({
  body: z.string().min(1, '评论不能为空').max(10000, '评论最多10000个字符'),
})

export type CreateCommentInput = z.infer<typeof createCommentSchema>
