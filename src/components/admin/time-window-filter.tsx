'use client'

import Link from 'next/link'
import type { StatsWindow } from '@/services/stats.service'

/**
 * Time-window filter chips for the admin stats page.
 * Preserves the rest of the query string so it composes with future filters.
 */
export function TimeWindowFilter({
  current,
  labels,
}: {
  current: StatsWindow
  labels: Record<StatsWindow, string>
}) {
  const options: StatsWindow[] = ['all', 'week', 'month', 'quarter']
  return (
    <div className="flex gap-1 rounded-md border border-gray-200 bg-white p-1 text-sm">
      {options.map((opt) => (
        <Link
          key={opt}
          href={`/admin?window=${opt}`}
          className={`rounded px-3 py-1 transition-colors ${
            current === opt
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {labels[opt]}
        </Link>
      ))}
    </div>
  )
}