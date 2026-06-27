import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/services/auth.service'
import { notificationChannel } from '@/lib/notifications/channel'
import { serializeSSE } from '@/lib/sse'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(serializeSSE('connected', { userId: user.id }))

      const unsubscribe = notificationChannel.subscribe(user.id, (event) => {
        controller.enqueue(serializeSSE(event.event, event.data))
      })

      // Spec: heartbeat every 30 seconds as `event: ping`
      const interval = setInterval(() => {
        controller.enqueue(serializeSSE('ping', { t: Date.now() }))
      }, 30000)

      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        unsubscribe()
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
