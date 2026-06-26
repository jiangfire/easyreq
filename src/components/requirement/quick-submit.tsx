'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function QuickSubmit({ projectSlug }: { projectSlug: string }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const trimmed = title.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/projects/${projectSlug}/requirements`, {
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
      setTitle('')
      router.push(`/projects/${projectSlug}/requirements/${req.id}`)
      router.refresh()
    } catch {
      setError('网络错误，请重试')
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
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
          disabled={loading}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={submit}
          disabled={loading || !title.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? '提交中...' : '提交'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <p className="mt-2 text-xs text-gray-400">
        只需标题即可提交，其他信息可后续补充。也可{' '}
        <a href={`/projects/${projectSlug}/requirements/new`} className="text-blue-600 hover:underline">
          填写详细需求
        </a>
      </p>
    </div>
  )
}
