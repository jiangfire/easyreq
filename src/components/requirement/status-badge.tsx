import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/constants'

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.SUBMITTED
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.bgColor} ${config.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotColor}`} />
      {config.label}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: string }) {
  const config = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.MEDIUM
  return <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
}
