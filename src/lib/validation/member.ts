import { z } from 'zod'

export const addMemberSchema = z.object({
  userId: z.string().min(1, '请选择用户'),
})

export type AddMemberInput = z.infer<typeof addMemberSchema>
