'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { STATUS_CONFIG } from '@/lib/constants'
import type { ReqStatus } from '@/lib/transitions'

export function StatusActions({
  requirementId,
  availableTargets,
}: {
  requirementId: string
  availableTargets: ReqStatus[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState('')
  const [selectedTarget, setSelectedTarget] = useState<ReqStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (availableTargets.length === 0) return null

  async function doTransition(toStatus: ReqStatus) {
    setLoading(toStatus)
    setError(null)

    try {
      const res = await fetch(`/api/requirements/${requirementId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus, note: note.trim() || undefined }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error?.message ?? '操作失败')
        setLoading(null)
        return
      }

      setShowNote(false)
      setNote('')
      setSelectedTarget(null)
      router.refresh()
    } catch {
      setError('网络错误')
      setLoading(null)
    }
  }

  function handleAction(target: ReqStatus) {
    setSelectedTarget(target)
    if (target === 'REJECTED' || target === 'IN_DEVELOPMENT') {
      setShowNote(true)
    } else {
      doTransition(target)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {availableTargets.map((target) => {
          const config = STATUS_CONFIG[target]
          const isPrimary = target === 'ACCEPTED' || target === 'DELIVERED'
          const isDanger = target === 'REJECTED'

          return (
            <button
              key={target}
              onClick={() => handleAction(target)}
              disabled={loading !== null}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                isDanger
                  ? 'border border-red-300 text-red-700 hover:bg-red-50'
                  : isPrimary
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : `border border-gray-300 text-gray-700 hover:bg-gray-50 ${config.color}`
              }`}
            >
              {loading === target ? '处理中...' : config.label}
            </button>
          )
        })}
      </div>

      {showNote && selectedTarget && (
        <div className="rounded-md border border-gray-200 p-3">
          <label className="mb-1 block text-xs text-gray-500">
            备注（可选）
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={selectedTarget === 'REJECTED' ? '驳回原因...' : '退回原因...'}
            className="mb-2 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => doTransition(selectedTarget)}
              disabled={loading !== null}
              className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            >
              确认
            </button>
            <button
              onClick={() => {
                setShowNote(false)
                setSelectedTarget(null)
                setNote('')
              }}
              className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
