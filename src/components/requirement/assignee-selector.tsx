'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Member = {
  userId: string
  name: string
}

export function AssigneeSelector({
  requirementId,
  members,
  assignee,
  canEdit,
}: {
  requirementId: string
  members: Member[]
  assignee: Member | null
  canEdit: boolean
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function selectAssignee(userId: string | null) {
    setLoading(true)
    try {
      const res = await fetch(`/api/requirements/${requirementId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeId: userId }),
      })
      if (res.ok) router.refresh()
    } finally {
      setLoading(false)
      setIsOpen(false)
    }
  }

  if (!canEdit) {
    return (
      <span className="text-sm text-gray-600">
        {assignee ? assignee.name : '未指派'}
      </span>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-blue-600"
      >
        {assignee ? (
          <>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs text-blue-700">
              {assignee.name.charAt(0)}
            </span>
            {assignee.name}
          </>
        ) : (
          <span className="text-gray-400">指派给...</span>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-48 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
          <button
            onClick={() => selectAssignee(null)}
            className="w-full rounded px-2 py-1 text-left text-xs text-gray-500 hover:bg-gray-50"
          >
            取消指派
          </button>
          {members.map((m) => (
            <button
              key={m.userId}
              onClick={() => selectAssignee(m.userId)}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-gray-50"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-600">
                {m.name.charAt(0)}
              </span>
              {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
