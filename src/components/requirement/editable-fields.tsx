'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { MarkdownEditor } from '@/components/ui/markdown-editor'

export function EditableTitle({
  requirementId,
  initialTitle,
  canEdit,
}: {
  requirementId: string
  initialTitle: string
  canEdit: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!title.trim() || title === initialTitle) {
      setEditing(false)
      setTitle(initialTitle)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/requirements/${requirementId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error?.message ?? '保存失败')
        setSaving(false)
        return
      }
      setEditing(false)
      router.refresh()
    } catch {
      setError('网络错误')
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') {
              setTitle(initialTitle)
              setEditing(false)
            }
          }}
          maxLength={200}
          autoFocus
          className="w-full rounded-md border border-blue-300 px-2 py-1 text-2xl font-bold text-gray-900"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving || !title.trim()}
            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
          <button
            onClick={() => {
              setTitle(initialTitle)
              setEditing(false)
            }}
            className="rounded-md px-3 py-1 text-xs text-gray-500 hover:bg-gray-100"
          >
            取消
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-start gap-2">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {canEdit && (
        <button
          onClick={() => setEditing(true)}
          className="mt-1 opacity-0 transition group-hover:opacity-100"
          title="编辑标题"
        >
          <svg className="h-4 w-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      )}
    </div>
  )
}

export function EditableBody({
  requirementId,
  initialBody,
  canEdit,
}: {
  requirementId: string
  initialBody: string | null
  canEdit: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(initialBody ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/requirements/${requirementId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error?.message ?? '保存失败')
        setSaving(false)
        return
      }
      setEditing(false)
      router.refresh()
    } catch {
      setError('网络错误')
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="mb-6 space-y-2">
        <MarkdownEditor
          value={body}
          onChange={setBody}
          onSubmit={save}
          placeholder="详细描述需求... 支持 Markdown"
          minHeight="120px"
          requirementId={requirementId}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
          <button
            onClick={() => {
              setBody(initialBody ?? '')
              setEditing(false)
            }}
            className="rounded-md px-3 py-1 text-xs text-gray-500 hover:bg-gray-100"
          >
            取消
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="group mb-6">
      {body ? (
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
            {body}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">暂无详细描述</p>
      )}
      {canEdit && (
        <button
          onClick={() => setEditing(true)}
          className="mt-2 text-xs text-gray-400 hover:text-gray-600"
        >
          {body ? '编辑描述' : '添加描述'}
        </button>
      )}
    </div>
  )
}
