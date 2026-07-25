import { z } from 'zod'
import type { Priority } from '@/hooks/use-requirement-draft'

/**
 * Build the create-requirement API payload from form input.
 * Drops empty fields so the server applies defaults.
 * The Date input is converted to an ISO string for `expectedDate`.
 */
export function buildCreatePayload(input: {
  title: string
  body: string
  priority: Priority
  expectedDate: string
  acceptanceCriteria: string
}): Record<string, unknown> {
  const payload: Record<string, unknown> = { title: input.title.trim() }
  const body = input.body.trim()
  if (body) payload.body = body
  if (input.priority !== 'MEDIUM') payload.priority = input.priority
  if (input.expectedDate) payload.expectedDate = new Date(input.expectedDate).toISOString()
  const criteria = input.acceptanceCriteria.trim()
  if (criteria) payload.acceptanceCriteria = criteria
  return payload
}

/**
 * Map validation errors from the API to a human-readable title error message.
 */
export function readErrorMessage(data: unknown, fallback: string): string {
  if (typeof data === 'object' && data !== null) {
    const err = (data as { error?: { message?: string } }).error
    if (err?.message) return err.message
  }
  return fallback
}

export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'LOW', label: '低' },
  { value: 'MEDIUM', label: '中' },
  { value: 'HIGH', label: '高' },
  { value: 'CRITICAL', label: '紧急' },
]

export const requirementInputSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(50000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  expectedDate: z.string().datetime().optional(),
  acceptanceCriteria: z.string().max(5000).optional(),
})
