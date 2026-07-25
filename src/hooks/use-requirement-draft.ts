import { useState, useEffect, useCallback } from 'react'

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type RequirementDraft = {
  title: string
  body: string
  priority: Priority
  expectedDate: string
  acceptanceCriteria: string
}

export const EMPTY_DRAFT: RequirementDraft = {
  title: '',
  body: '',
  priority: 'MEDIUM',
  expectedDate: '',
  acceptanceCriteria: '',
}

function readDraft(key: string): RequirementDraft {
  if (typeof window === 'undefined') return EMPTY_DRAFT
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return EMPTY_DRAFT
    const data = JSON.parse(raw) as Partial<RequirementDraft>
    return {
      title: data.title ?? '',
      body: data.body ?? '',
      priority: data.priority ?? 'MEDIUM',
      expectedDate: data.expectedDate ?? '',
      acceptanceCriteria: data.acceptanceCriteria ?? '',
    }
  } catch {
    return EMPTY_DRAFT
  }
}

/**
 * Manages the localStorage-backed draft for the new-requirement form.
 * Single source of truth — replaces the duplicated 5-useState pattern.
 */
export function useRequirementDraft(key: string) {
  const [draft, setDraft] = useState<RequirementDraft>(() => readDraft(key))

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!draft.title && !draft.body) return
    const timer = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify(draft))
    }, 500)
    return () => clearTimeout(timer)
  }, [key, draft])

  const updateField = useCallback(
    <K extends keyof RequirementDraft>(field: K, value: RequirementDraft[K]) => {
      setDraft((prev) => ({ ...prev, [field]: value }))
    },
    [],
  )

  const clearDraft = useCallback(() => {
    setDraft(EMPTY_DRAFT)
    if (typeof window !== 'undefined') localStorage.removeItem(key)
  }, [key])

  return { draft, updateField, clearDraft, setDraft }
}
