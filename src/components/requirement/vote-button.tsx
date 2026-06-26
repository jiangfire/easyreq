'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function VoteButton({
  requirementId,
  initialVoted,
  initialCount,
}: {
  requirementId: string
  initialVoted: boolean
  initialCount: number
}) {
  const router = useRouter()
  const [voted, setVoted] = useState(initialVoted)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    try {
      const res = await fetch(`/api/requirements/${requirementId}/vote`, { method: 'POST' })
      if (!res.ok) return

      const data = await res.json()
      setVoted(data.voted)
      setCount(data.count)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
        voted
          ? 'border-blue-300 bg-blue-50 text-blue-700'
          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
      }`}
      title={voted ? '取消投票' : '投票支持'}
    >
      <svg
        className="h-4 w-4"
        fill={voted ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
      </svg>
      <span className="font-medium">{count}</span>
    </button>
  )
}
