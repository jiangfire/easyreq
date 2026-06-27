'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { StatusBadge } from '@/components/requirement/status-badge'

type SearchResult = {
  id: string
  number: number
  title: string
  status: string
  priority: string
  createdAt: string
  project: { slug: string; name: string }
  _count: { votes: number; comments: number }
}

export function SearchResults({ query }: { query: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [q, setQ] = useState(query)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!query) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        if (cancelled) return
        setResults(data.data ?? [])
        setTotal(data.pagination?.totalItems ?? 0)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [query])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = q.trim()
    if (!trimmed) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('q', trimmed)
    router.push(`/search?${params.toString()}`)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索需求标题和正文..."
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          搜索
        </button>
      </form>

      {query && (
        <p className="text-sm text-gray-500">
          {loading ? '搜索中...' : `找到 ${total} 条结果`}
        </p>
      )}

      {results.length === 0 && query && !loading ? (
        <p className="text-sm text-gray-400">未找到匹配的需求</p>
      ) : (
        <div className="space-y-2">
          {results.map((r) => (
            <Link
              key={r.id}
              href={`/projects/${r.project.slug}/requirements/${r.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-3 hover:border-blue-300"
            >
              <div className="flex items-center gap-2">
                <StatusBadge status={r.status} />
                <span className="text-xs text-gray-400">#{r.number}</span>
              </div>
              <p className="mt-1 text-sm font-medium text-gray-900">{r.title}</p>
              <p className="text-xs text-gray-500">
                {r.project.name} · {new Date(r.createdAt).toLocaleDateString('zh-CN')} · {r._count.votes} 票 ·{' '}
                {r._count.comments} 评论
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
