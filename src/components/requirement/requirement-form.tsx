'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRequirementDraft } from '@/hooks/use-requirement-draft'
import { RequirementFormFields } from './requirement-form-fields'
import { buildCreatePayload, readErrorMessage } from '@/lib/requirement-form'

const DRAFT_KEY = 'easyreq:draft:requirement'

export function RequirementForm({ projectSlug }: { projectSlug: string }) {
  const router = useRouter()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [titleError, setTitleError] = useState<string | null>(null)

  const { draft, updateField, clearDraft } = useRequirementDraft(DRAFT_KEY)

  async function handleSubmit() {
    const trimmedTitle = draft.title.trim()
    if (!trimmedTitle) {
      setTitleError('请输入需求标题')
      return
    }
    if (trimmedTitle.length > 200) {
      setTitleError('标题最多200个字符')
      return
    }

    setLoading(true)
    setError(null)
    setTitleError(null)

    try {
      const res = await fetch(`/api/projects/${projectSlug}/requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCreatePayload(draft)),
      })

      if (!res.ok) {
        setError(readErrorMessage(await res.json().catch(() => null), '提交失败'))
        setLoading(false)
        return
      }

      const req = await res.json()
      clearDraft()
      router.push(`/projects/${projectSlug}/requirements/${req.id}`)
      router.refresh()
    } catch {
      setError('网络错误，请重试')
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← 返回
        </button>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">提交需求</h1>
        <p className="mt-1 text-sm text-gray-500">只需标题即可提交，其他信息可选</p>
      </div>

      <div className="space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <RequirementFormFields
          title={draft.title}
          body={draft.body}
          priority={draft.priority}
          expectedDate={draft.expectedDate}
          acceptanceCriteria={draft.acceptanceCriteria}
          showAdvanced={showAdvanced}
          titleError={titleError}
          loading={loading}
          onTitleChange={(v) => updateField('title', v)}
          onTitleErrorClear={() => setTitleError(null)}
          onBodyChange={(v) => updateField('body', v)}
          onPriorityChange={(v) => updateField('priority', v)}
          onExpectedDateChange={(v) => updateField('expectedDate', v)}
          onAcceptanceCriteriaChange={(v) => updateField('acceptanceCriteria', v)}
          onToggleAdvanced={() => setShowAdvanced((v) => !v)}
        />

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-400">
            {draft.title || draft.body ? '草稿已自动保存' : 'Ctrl+Enter 快捷提交'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => router.back()}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !draft.title.trim()}
              className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '提交中...' : '提交需求'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
