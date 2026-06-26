import { STATUS_CONFIG } from '@/lib/constants'
import type { ReqStatus } from '@/lib/transitions'

type StatusLogItem = {
  id: string
  fromStatus: ReqStatus
  toStatus: ReqStatus
  note: string | null
  isQuickPath: boolean
  createdAt: Date
  operator: { id: string; name: string }
}

export function StatusTimeline({ logs }: { logs: StatusLogItem[] }) {
  if (logs.length === 0) {
    return <p className="text-xs text-gray-400">暂无状态变更记录</p>
  }

  return (
    <div className="space-y-3">
      {logs.map((log, i) => {
        const fromConfig = STATUS_CONFIG[log.fromStatus]
        const toConfig = STATUS_CONFIG[log.toStatus]

        return (
          <div key={log.id} className="flex gap-3">
            {/* Timeline dot */}
            <div className="flex flex-col items-center">
              <span className={`mt-1 h-2 w-2 rounded-full ${toConfig.dotColor}`} />
              {i < logs.length - 1 && <span className="w-px flex-1 bg-gray-200" />}
            </div>

            {/* Content */}
            <div className="flex-1 pb-3">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className={`rounded-full px-1.5 py-0.5 ${fromConfig.bgColor} ${fromConfig.color}`}>
                  {fromConfig.label}
                </span>
                <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <span className={`rounded-full px-1.5 py-0.5 ${toConfig.bgColor} ${toConfig.color}`}>
                  {toConfig.label}
                </span>
                {log.isQuickPath && (
                  <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-purple-600">
                    快速通道
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {log.operator.name} · {formatDateTime(log.createdAt)}
              </p>
              {log.note && <p className="mt-1 text-sm text-gray-600">{log.note}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function formatDateTime(date: Date) {
  return new Date(date).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
