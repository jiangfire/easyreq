'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRequirementDraft } from '@/hooks/use-requirement-draft'
import { RequirementFormFields } from './requirement-form-fields'
import { buildCreatePayload, readErrorMessage } from '@/lib/requirement-form'

const DRAFT_KEY = 'easyreq:draft:quick-submit'

export function GlobalQuickSubmit({ userRole }: { userRole: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [projects, setProjects] = useState<{ id: string; name: string; slug: string }[]>([])
  const [selectedSlug, setSelectedSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [titleError, setTitleError] = useState<string | null>(null)

  const isSubmitter = userRole === 'SUBMITTER'
  const { draft, updateField, clearDraft } = useRequirementDraft(DRAFT_KEY)

  // Load project list for internal roles only.
  useEffect(() => {
    if (isSubmitter) return
    fetch('/api/projects')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: { id: string; name: string; slug: string }[]) => {
        setProjects(data)
        if (data.length > 0) setSelectedSlug(data[0].slug)
      })
      .catch(() => undefined)
  }, [isSubmitter])

  // N to open, Esc to close.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      if (e.key === 'n' && !editing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        openDialog()
      }
      if (e.key === 'Escape' && open) setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open])

  function openDialog() {
    setOpen(true)
    setError(null)
    setTitleError(null)
  }

  function handleClose() {
    if (loading) return
    setOpen(false)
  }

  async function submit() {
    const trimmedTitle = draft.title.trim()
    if (!trimmedTitle) {
      setTitleError('请输入需求标题')
      return
    }
    if (!isSubmitter && !selectedSlug) return

    setLoading(true)
    setError(null)
    setTitleError(null)

    try {
      const url = isSubmitter ? '/api/requirements' : `/api/projects/${selectedSlug}/requirements`
      const res = await fetch(url, {
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
      setOpen(false)
      clearDraft()
      const destination = isSubmitter
        ? `/requirements/${req.id}`
        : `/projects/${selectedSlug}/requirements/${req.id}`
      router.push(destination)
      router.refresh()
    } catch {
      setError('网络错误')
      setLoading(false)
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={openDialog}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-colors hover:bg-blue-700 lg:bottom-8 lg:right-8"
          title="提交需求 (N)"
          aria-label="提交需求"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-10" onClick={handleClose}>
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">提交需求</h3>
              <button
                onClick={handleClose}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="关闭"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 px-6 py-4">
              {!isSubmitter && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    项目 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedSlug}
                    onChange={(e) => setSelectedSlug(e.target.value)}
                    disabled={loading}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {projects.length === 0 ? (
                      <option value="">暂无可用项目</option>
                    ) : (
                      projects.map((p) => (
                        <option key={p.id} value={p.slug}>{p.name}</option>
                      ))
                    )}
                  </select>
                </div>
              )}

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

              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
              <p className="text-xs text-gray-400">
                {isSubmitter ? '提交后管理员会归集到项目' : '按 N 打开此弹窗，按 Esc 关闭'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClose}
                  disabled={loading}
                  className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={submit}
                  disabled={loading || !draft.title.trim() || (!isSubmitter && !selectedSlug)}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? '提交中...' : '提交'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
