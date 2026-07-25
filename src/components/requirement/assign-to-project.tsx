'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export function AssignToProject({
  requirementId,
  projects,
}: {
  requirementId: string
  projects: { id: string; name: string; slug: string }[]
}) {
  const router = useRouter()
  const [projectId, setProjectId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId) return

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/requirements/${requirementId}/project`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error?.message || '归集失败')
        return
      }

      const updated = await res.json()
      router.push(`/projects/${updated.project.slug}/requirements/${requirementId}`)
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  if (projects.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        没有可归集的项目，请先
        <Link href="/projects/new" className="text-blue-600 hover:underline">
          创建项目
        </Link>
      </p>
    )
  }

  return (
    <form onSubmit={handleAssign} className="space-y-2">
      <select
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
      >
        <option value="">选择项目...</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={!projectId || isSubmitting}
        className="w-full rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? '归集中...' : '归集'}
      </button>
    </form>
  )
}
