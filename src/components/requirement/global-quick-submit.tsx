'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export function GlobalQuickSubmit() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState<{ id: string; name: string; slug: string }[]>([])
  const [selectedSlug, setSelectedSlug] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch('/api/projects')
        if (!res.ok) return
        const data = await res.json()
        setProjects(data)
        if (data.length > 0) setSelectedSlug(data[0].slug)
      } catch {
        // ignore
      }
    }
    loadProjects()
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      if (e.key === 'n' && !editing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setOpen(true)
        setTitle('')
        setError(null)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open])

  async function submit() {
    const trimmed = title.trim()
    if (!trimmed || !selectedSlug) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${selectedSlug}/requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error?.message ?? '提交失败')
        setLoading(false)
        return
      }
      const req = await res.json()
      setOpen(false)
      router.push(`/projects/${selectedSlug}/requirements/${req.id}`)
      router.refresh()
    } catch {
      setError('网络错误')
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-20">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">快速提交需求</h3>
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-gray-600">项目</label>
          <select
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.slug}>{p.name}</option>
            ))}
          </select>
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="输入需求标题，按 Enter 提交..."
          autoFocus
          disabled={loading}
          className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        {error && <p className="mb-3 text-xs text-red-600">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={loading || !title.trim() || !selectedSlug}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '提交中...' : '提交'}
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-400">按 N 打开此弹窗，按 Esc 关闭</p>
      </div>
    </div>
  )
}
