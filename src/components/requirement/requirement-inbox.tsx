'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { StatusBadge, PriorityBadge } from './status-badge'
import { AssignToProject } from './assign-to-project'

export function RequirementInbox({
  projects,
}: {
  projects: { id: string; name: string; slug: string }[]
}) {
  const [requirements, setRequirements] = useState<
    {
      id: string
      globalNumber: number
      title: string
      status: string
      priority: string
      createdAt: string
      updatedAt: string
      author: { id: string; name: string }
      _count: { votes: number; comments: number }
    }[]
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/requirements/inbox')
      .then((res) => res.json())
      .then((data) => {
        setRequirements(Array.isArray(data) ? data : [])
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <p className="text-sm text-gray-500">加载中...</p>
  }

  if (requirements.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
        <p className="text-sm text-gray-400">需求池为空</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {requirements.map((r) => (
        <div
          key={r.id}
          className="rounded-lg border border-gray-200 bg-white p-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <StatusBadge status={r.status} />
                <span className="text-xs text-gray-400">#{r.globalNumber}</span>
              </div>
              <Link
                href={`/requirements/${r.id}`}
                className="block truncate text-sm font-medium text-gray-900 hover:text-blue-600"
              >
                {r.title}
              </Link>
              <p className="mt-1 text-xs text-gray-500">
                {r.author.name} · {r._count.votes} 票 · {r._count.comments} 评论 ·{' '}
                {new Date(r.createdAt).toLocaleDateString('zh-CN')}
              </p>
            </div>
            <div className="shrink-0">
              <div className="flex items-center gap-2">
                <PriorityBadge priority={r.priority} />
                <AssignToProject
                  requirementId={r.id}
                  projects={projects}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
