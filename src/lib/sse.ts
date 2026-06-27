const encoder = new TextEncoder()

/**
 * Serialize an SSE frame with an `event:` field per the spec.
 */
export function serializeSSE(event: string, data: unknown): Uint8Array {
  const payload = typeof data === 'string' ? data : JSON.stringify(data)
  return encoder.encode(`event: ${event}\ndata: ${payload}\n\n`)
}

/**
 * Serialize a comment-only keepalive frame.
 */
export function serializeSSEComment(text: string): Uint8Array {
  return encoder.encode(`:${text}\n\n`)
}
