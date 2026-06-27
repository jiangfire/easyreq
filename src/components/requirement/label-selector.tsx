'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Label = {
  id: string
  name: string
  color: string
}

export function LabelSelector({
  requirementId,
  labels,
  selected,
  canEdit,
}: {
  requirementId: string
  labels: Label[]
  selected: Label[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function toggleLabel(labelId: string) {
    setLoading(true)
    const currentIds = selected.map((l) => l.id)
    const nextIds = currentIds.includes(labelId)
      ? currentIds.filter((id) => id !== labelId)
      : [...currentIds, labelId]

    try {
      const res = await fetch(`/api/requirements/${requirementId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labelIds: nextIds }),
      })
      if (res.ok) router.refresh()
    } finally {
      setLoading(false)
      setIsOpen(false)
    }
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1">
        {selected.map((l) => (
          <span
            key={l.id}
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: l.color, color: getContrastColor(l.color) }}
          >
            {l.name}
          </span>
        ))}
        {canEdit && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            disabled={loading}
            className="rounded-full border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
          >
            {loading ? '...' : '+'}
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-48 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
          {labels.length === 0 ? (
            <p className="px-2 py-1 text-xs text-gray-400">暂无标签</p>
          ) : (
            labels.map((l) => {
              const active = selected.some((s) => s.id === l.id)
              return (
                <button
                  key={l.id}
                  onClick={() => toggleLabel(l.id)}
                  className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs ${active ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }}></span>
                    {l.name}
                  </span>
                  {active && <span>✓</span>}
                </button>
              )
            })
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="mt-1 w-full rounded px-2 py-1 text-center text-xs text-gray-500 hover:bg-gray-50"
          >
            关闭
          </button>
        </div>
      )}
    </div>
  )
}

function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '')
  const r = Number.parseInt(hex.substring(0, 2), 16)
  const g = Number.parseInt(hex.substring(2, 4), 16)
  const b = Number.parseInt(hex.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#1f2937' : '#ffffff'
}
