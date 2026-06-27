import { describe, it, expect } from 'vitest'
import { NullAIProvider } from '@/lib/ai/null-provider'

describe('NullAIProvider', () => {
  const provider = new NullAIProvider()

  it('returns MEDIUM priority for classify', async () => {
    const result = await provider.classify({ title: 'test' })
    expect(result.priority).toBe('MEDIUM')
  })

  it('returns zero scores for deduplicate', async () => {
    const candidates = [{ title: 'a' }, { title: 'b' }]
    const result = await provider.deduplicate({ title: 'test' }, candidates)
    expect(result).toHaveLength(2)
    expect(result.every((r) => r.score === 0)).toBe(true)
  })

  it('suggests MEDIUM priority', async () => {
    expect(await provider.suggestPriority({ title: 'urgent' })).toBe('MEDIUM')
  })

  it('extracts a single requirement from text', async () => {
    const result = await provider.extractRequirements('some long requirement description')
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('some long requirement description')
    expect(result[0].priority).toBe('MEDIUM')
  })
})
