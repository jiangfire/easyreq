'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Dropdown button for bulk-deleting notifications.
 *
 * Two modes:
 *  - "clear read" (default): deletes only already-read notifications
 *  - "clear all": deletes everything
 *
 * Both actions call DELETE /api/notifications and refresh the page.
 */
export function ClearReadForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleClear(mode: 'read' | 'all') {
    setLoading(true)
    setOpen(false)
    try {
      await fetch('/api/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {loading ? '清理中...' : '清理 ▾'}
      </button>
      {open && (
        <div
          className="absolute right-0 z-10 mt-1 w-40 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => handleClear('read')}
            className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
          >
            清除已读
          </button>
          <button
            type="button"
            onClick={() => handleClear('all')}
            className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
          >
            清除全部
          </button>
        </div>
      )}
    </div>
  )
}