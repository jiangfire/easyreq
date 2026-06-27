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

const PRIORITY_CHOICES = [
  { value: 'LOW', label: '低' },
  { value: 'MEDIUM', label: '中' },
  { value: 'HIGH', label: '高' },
  { value: 'CRITICAL', label: '紧急' },
]

export function EditablePriority({
  requirementId,
  initialPriority,
  canEdit,
}: {
  requirementId: string
  initialPriority: string
  canEdit: boolean
}) {
  const router = useRouter()
  const [priority, setPriority] = useState(initialPriority)
  const [saving, setSaving] = useState(false)

  async function save(next: string) {
    if (next === priority) return
    setSaving(true)
    try {
      const res = await fetch(`/api/requirements/${requirementId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: next }),
      })
      if (res.ok) {
        setPriority(next)
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  if (!canEdit) {
    return <span className="text-sm text-gray-600">{priority}</span>
  }

  return (
    <select
      value={priority}
      disabled={saving}
      onChange={(e) => save(e.target.value)}
      className="rounded-md border border-gray-300 px-2 py-0.5 text-sm focus:border-blue-500 focus:outline-none"
    >
      {PRIORITY_CHOICES.map((p) => (
        <option key={p.value} value={p.value}>
          {p.label}
        </option>
      ))}
    </select>
  )
}

export function EditableExpectedDate({
  requirementId,
  initialExpectedDate,
  canEdit,
}: {
  requirementId: string
  initialExpectedDate: string | null
  canEdit: boolean
}) {
  const router = useRouter()
  const [value, setValue] = useState(
    initialExpectedDate ? initialExpectedDate.slice(0, 10) : '',
  )
  const [saving, setSaving] = useState(false)

  async function save(next: string) {
    setSaving(true)
    try {
      const payload = next
        ? { expectedDate: new Date(next).toISOString() }
        : { expectedDate: null }
      const res = await fetch(`/api/requirements/${requirementId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setValue(next)
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  if (!canEdit) {
    return (
      <span className="text-sm text-gray-600">
        {initialExpectedDate
          ? new Date(initialExpectedDate).toLocaleDateString('zh-CN')
          : '未设置'}
      </span>
    )
  }

  return (
    <input
      type="date"
      value={value}
      disabled={saving}
      onChange={(e) => save(e.target.value)}
      className="rounded-md border border-gray-300 px-2 py-0.5 text-sm focus:border-blue-500 focus:outline-none"
    />
  )
}

export function EditableAcceptanceCriteria({
  requirementId,
  initialAcceptanceCriteria,
  canEdit,
}: {
  requirementId: string
  initialAcceptanceCriteria: string | null
  canEdit: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(initialAcceptanceCriteria ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/requirements/${requirementId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acceptanceCriteria: text }),
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

  if (!canEdit) {
    return initialAcceptanceCriteria ? (
      <p className="text-sm whitespace-pre-wrap text-gray-600">
        {initialAcceptanceCriteria}
      </p>
    ) : (
      <p className="text-sm text-gray-400">未设置</p>
    )
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={5000}
          autoFocus
          rows={4}
          className="w-full rounded-md border border-blue-300 px-2 py-1 text-sm focus:outline-none"
          placeholder="验收标准..."
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
              setText(initialAcceptanceCriteria ?? '')
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
    <div className="group">
      {initialAcceptanceCriteria ? (
        <p className="text-sm whitespace-pre-wrap text-gray-600">
          {initialAcceptanceCriteria}
        </p>
      ) : (
        <p className="text-sm text-gray-400 italic">未设置</p>
      )}
      <button
        onClick={() => setEditing(true)}
        className="mt-1 text-xs text-gray-400 hover:text-gray-600"
      >
        {initialAcceptanceCriteria ? '编辑验收标准' : '添加验收标准'}
      </button>
    </div>
  )
}
