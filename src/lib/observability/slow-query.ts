export function getSlowQueryThreshold(value: string | undefined): number | null {
  if (!value) return null

  const threshold = Number(value)
  return Number.isInteger(threshold) && threshold > 0 ? threshold : null
}

export function isSlowQuery(durationMs: number, thresholdMs: number): boolean {
  return durationMs >= thresholdMs
}
