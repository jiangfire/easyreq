'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MarkdownEditor } from '@/components/ui/markdown-editor'

const DRAFT_KEY = 'easyreq:draft:requirement'

export function RequirementForm({ projectSlug }: { projectSlug: string }) {
  const router = useRouter()

  // Load draft from localStorage via lazy initializer (no effect needed)
  const [draftData] = useState(() => {
    if (typeof window === 'undefined') return null
    const draft = localStorage.getItem(DRAFT_KEY)
    if (!draft) return null
    try {
      return JSON.parse(draft) as {
        title?: string
        body?: string
        priority?: string
        expectedDate?: string
        acceptanceCriteria?: string
      }
    } catch {
      return null
    }
  })

  const [title, setTitle] = useState(draftData?.title ?? '')
  const [body, setBody] = useState(draftData?.body ?? '')
  const [priority, setPriority] = useState(draftData?.priority ?? 'MEDIUM')
  const [expectedDate, setExpectedDate] = useState(draftData?.expectedDate ?? '')
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(draftData?.acceptanceCriteria ?? '')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [titleError, setTitleError] = useState<string | null>(null)

  // Auto-save draft to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      if (title || body) {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ title, body, priority, expectedDate, acceptanceCriteria }),
        )
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [title, body, priority, expectedDate, acceptanceCriteria])

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY)
  }

  async function handleSubmit() {
    const trimmedTitle = title.trim()
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
      const payload: Record<string, unknown> = { title: trimmedTitle }
      if (body.trim()) payload.body = body.trim()
      if (priority !== 'MEDIUM') payload.priority = priority
      if (expectedDate) payload.expectedDate = new Date(expectedDate).toISOString()
      if (acceptanceCriteria.trim()) payload.acceptanceCriteria = acceptanceCriteria.trim()

      const res = await fetch(`/api/projects/${projectSlug}/requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error?.message ?? '提交失败')
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
        {/* Title - the only required field */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            标题 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setTitleError(null)
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                handleSubmit()
              }
            }}
            maxLength={200}
            placeholder="一句话描述你的需求..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="mt-1 flex items-center justify-between">
            {titleError ? (
              <p className="text-xs text-red-600">{titleError}</p>
            ) : (
              <p className="text-xs text-gray-400">Ctrl+Enter 快捷提交</p>
            )}
            <span className="text-xs text-gray-400">{title.length}/200</span>
          </div>
        </div>

        {/* Body - optional Markdown */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">详细描述（可选）</label>
          <MarkdownEditor
            value={body}
            onChange={setBody}
            onSubmit={handleSubmit}
            minHeight="200px"
          />
        </div>

        {/* Advanced options - collapsible */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <svg
              className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            更多选项
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">优先级</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="LOW">低</option>
                  <option value="MEDIUM">中</option>
                  <option value="HIGH">高</option>
                  <option value="CRITICAL">紧急</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">期望交付日期</label>
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">验收标准</label>
                <textarea
                  value={acceptanceCriteria}
                  onChange={(e) => setAcceptanceCriteria(e.target.value)}
                  rows={3}
                  placeholder="怎样算完成了这个需求？"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-400">
            {title || body ? '草稿已自动保存' : ''}
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
              disabled={loading || !title.trim()}
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
