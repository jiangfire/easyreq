'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { STATUS_CONFIG } from '@/lib/constants'
import { hasTransitionPermission } from '@/lib/transitions'
import type { ReqStatus } from '@/lib/transitions'

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

type Card = {
  id: string
  globalNumber: number
  number: number | null
  title: string
  priority: Priority
  assignee: { id: string; name: string } | null
  author: { id: string; name: string }
  updatedAt: string
}

const BOARD_COLUMNS: ReqStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'PLANNED',
  'IN_DEVELOPMENT',
  'IN_TESTING',
  'DELIVERED',
  'ACCEPTED',
  'REJECTED',
]

/**
 * Drag-and-drop kanban for a project. Cards can be dragged between columns
 * to change status; the server-side transition endpoint enforces permissions
 * and the standard IPD transition matrix.
 *
 * Drag protocol (HTML5):
 *  - dragstart: stash the card id and source status
 *  - dragover (on column): preventDefault to mark as drop target, highlight
 *  - drop: call API; revert card position on error
 *  - dragend: clear state
 *
 * Permissions: a card is draggable only if the current user can transition
 * it to at least one other status. The card itself is not draggable if no
 * transition is allowed from its current status for the user.
 */
export function KanbanBoard({
  projectSlug,
  cards,
  currentUserId,
  currentUserRole,
}: {
  projectSlug: string
  cards: Card[]
  currentUserId: string
  currentUserRole: 'SUBMITTER' | 'MANAGER' | 'DEVELOPER' | 'ADMIN'
}) {
  const router = useRouter()
  const [dragging, setDragging] = useState<{
    cardId: string
    from: ReqStatus
  } | null>(null)
  const [dragOverCol, setDragOverCol] = useState<ReqStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [optimistic, setOptimistic] = useState<Record<string, ReqStatus>>(() => {
    const m: Record<string, ReqStatus> = {}
    for (const c of cards) m[c.id] = statusOf(c)
    return m
  })

  function statusOf(card: Card): ReqStatus {
    return optimistic[card.id] ?? 'SUBMITTED'
  }

  function canDrag(card: Card): boolean {
    const from = statusOf(card)
    return BOARD_COLUMNS.some(
      (to) => to !== from && hasTransitionPermission(from, to, currentUserRole),
    )
  }

  function onDragStart(e: React.DragEvent, card: Card) {
    if (!canDrag(card)) {
      e.preventDefault()
      return
    }
    setDragging({ cardId: card.id, from: statusOf(card) })
    setError(null)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e: React.DragEvent, col: ReqStatus) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverCol !== col) setDragOverCol(col)
  }

  function onDragLeave(col: ReqStatus) {
    if (dragOverCol === col) setDragOverCol(null)
  }

  async function onDrop(e: React.DragEvent, col: ReqStatus) {
    e.preventDefault()
    if (!dragging) return
    const cardId = dragging.cardId
    const from = dragging.from
    setDragOverCol(null)
    setDragging(null)

    if (col === from) return
    if (!hasTransitionPermission(from, col, currentUserRole)) {
      setError(`不允许从 ${STATUS_CONFIG[from].label} 转为 ${STATUS_CONFIG[col].label}`)
      return
    }

    // Optimistic move
    const prev = optimistic[cardId]
    setOptimistic((m) => ({ ...m, [cardId]: col }))
    setBusy(true)
    setError(null)

    try {
      const res = await fetch(`/api/requirements/${cardId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus: col }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error?.message ?? '状态变更失败')
        setOptimistic((m) => ({ ...m, [cardId]: prev }))
        return
      }
      router.refresh()
    } catch {
      setError('网络错误')
      setOptimistic((m) => ({ ...m, [cardId]: prev }))
    } finally {
      setBusy(false)
    }
  }

  const grouped: Record<ReqStatus, Card[]> = {
    SUBMITTED: [],
    UNDER_REVIEW: [],
    PLANNED: [],
    IN_DEVELOPMENT: [],
    IN_TESTING: [],
    DELIVERED: [],
    ACCEPTED: [],
    REJECTED: [],
  }
  for (const c of cards) {
    grouped[statusOf(c)].push(c)
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {BOARD_COLUMNS.map((col) => {
          const colCards = grouped[col]
          const config = STATUS_CONFIG[col]
          const isDragTarget = dragOverCol === col
          return (
            <div
              key={col}
              data-testid={`kanban-col-${col}`}
              onDragOver={(e) => onDragOver(e, col)}
              onDragLeave={() => onDragLeave(col)}
              onDrop={(e) => onDrop(e, col)}
              className={`flex w-72 shrink-0 flex-col rounded-lg border bg-gray-50 p-2 transition-colors ${
                isDragTarget
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className={`text-xs font-semibold ${config.color}`}>
                  {config.label}
                </h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-500">
                  {colCards.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {colCards.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-gray-400">无需求</p>
                ) : (
                  colCards.map((c) => (
                    <KanbanCard
                      key={c.id}
                      card={c}
                      draggable={canDrag(c) && !busy}
                      onDragStart={(e) => onDragStart(e, c)}
                      currentUserId={currentUserId}
                      projectSlug={projectSlug}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function KanbanCard({
  card,
  draggable,
  onDragStart,
  currentUserId,
  projectSlug,
}: {
  card: Card
  draggable: boolean
  onDragStart: (e: React.DragEvent) => void
  currentUserId: string
  projectSlug: string
}) {
  const href = `/projects/${projectSlug}/requirements/${card.id}`
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      data-testid={`kanban-card-${card.id}`}
      className={`group rounded-md border border-gray-200 bg-white p-2 shadow-sm transition-shadow ${
        draggable ? 'cursor-grab active:cursor-grabbing hover:shadow' : 'cursor-default'
      }`}
    >
      <div className="flex items-center justify-between text-[10px] text-gray-400">
        <span>#{card.number ?? card.globalNumber}</span>
        <PriorityDot priority={card.priority} />
      </div>
      <Link href={href} className="mt-1 block text-xs font-medium text-gray-900 hover:text-blue-600">
        {card.title}
      </Link>
      <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
        <span>{card.author.name}</span>
        {card.assignee && card.assignee.id !== currentUserId && (
          <span>→ {card.assignee.name}</span>
        )}
      </div>
    </div>
  )
}

function PriorityDot({ priority }: { priority: Priority }) {
  const color = {
    LOW: 'bg-gray-300',
    MEDIUM: 'bg-blue-400',
    HIGH: 'bg-orange-400',
    CRITICAL: 'bg-red-500',
  }[priority]
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} title={priority} />
}