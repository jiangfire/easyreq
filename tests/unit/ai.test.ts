import { describe, it, expect } from 'vitest'
import { NullAIProvider } from '@/lib/ai/null-provider'
import { HeuristicAIProvider } from '@/lib/ai/heuristic-provider'

describe('NullAIProvider', () => {
  const provider = new NullAIProvider()

  it('returns MEDIUM priority for classify', async () => {
    const result = await provider.classify({ title: 'test' })
    expect(result.priority).toBe('MEDIUM')
  })

  it('returns zero scores for deduplicate', async () => {
    const candidates = [
      { id: 'a', title: 'a' },
      { id: 'b', title: 'b' },
    ]
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

describe('HeuristicAIProvider', () => {
  const provider = new HeuristicAIProvider()

  describe('suggestPriority', () => {
    it('returns CRITICAL for outage keywords (Chinese)', async () => {
      expect(await provider.suggestPriority({ title: '生产环境宕机' })).toBe('CRITICAL')
      expect(await provider.suggestPriority({ title: '系统崩溃' })).toBe('CRITICAL')
      expect(await provider.suggestPriority({ title: '登录阻塞' })).toBe('CRITICAL')
    })

    it('returns CRITICAL for outage keywords (English)', async () => {
      expect(await provider.suggestPriority({ title: 'Production outage' })).toBe('CRITICAL')
      expect(await provider.suggestPriority({ title: 'Service down' })).toBe('CRITICAL')
      expect(await provider.suggestPriority({ title: 'Blocker on login' })).toBe('CRITICAL')
    })

    it('returns HIGH for important keywords', async () => {
      expect(await provider.suggestPriority({ title: '重要功能缺失' })).toBe('HIGH')
      expect(await provider.suggestPriority({ title: '登录失败' })).toBe('HIGH')
    })

    it('returns LOW for nice-to-have keywords', async () => {
      expect(await provider.suggestPriority({ title: '优化建议' })).toBe('LOW')
      expect(await provider.suggestPriority({ title: '体验微调' })).toBe('LOW')
    })

    it('returns MEDIUM by default', async () => {
      expect(await provider.suggestPriority({ title: '添加报表导出' })).toBe('MEDIUM')
    })

    it('considers body text as well as title', async () => {
      expect(
        await provider.suggestPriority({
          title: '问题',
          body: '服务宕机，无法登录',
        }),
      ).toBe('CRITICAL')
    })

    it('CRITICAL wins over HIGH and LOW', async () => {
      expect(
        await provider.suggestPriority({
          title: '优化建议',
          body: '系统宕机紧急修复',
        }),
      ).toBe('CRITICAL')
    })
  })

  describe('deduplicate', () => {
    it('returns high score for near-identical titles', async () => {
      const result = await provider.deduplicate(
        { title: '修复登录页面无法访问' },
        [{ id: '1', title: '修复登录页面无法访问' }],
      )
      expect(result).toHaveLength(1)
      expect(result[0].score).toBeGreaterThan(0.8)
    })

    it('returns zero score for completely unrelated titles', async () => {
      const result = await provider.deduplicate(
        { title: '登录失败' },
        [{ id: '1', title: '报表导出优化' }],
      )
      expect(result[0].score).toBeLessThan(0.3)
    })

    it('returns partial score for shared keywords', async () => {
      const result = await provider.deduplicate(
        { title: '登录页面无法访问' },
        [{ id: '1', title: '登录失败报错' }],
      )
      expect(result[0].score).toBeGreaterThan(0)
      expect(result[0].score).toBeLessThan(0.8)
    })

    it('sorts results by descending score', async () => {
      const result = await provider.deduplicate(
        { title: '修复登录崩溃' },
        [
          { id: 'unrelated', title: '报表导出' },
          { id: 'similar', title: '登录崩溃修复' },
          { id: 'partial', title: '登录问题' },
        ],
      )
      expect(result[0].candidate.id).toBe('similar')
      expect(result[1].candidate.id).toBe('partial')
      expect(result[2].candidate.id).toBe('unrelated')
    })

    it('is case-insensitive', async () => {
      const result = await provider.deduplicate(
        { title: 'Login Broken' },
        [{ id: '1', title: 'login broken' }],
      )
      expect(result[0].score).toBeGreaterThan(0.7)
    })

    it('strips punctuation', async () => {
      const result = await provider.deduplicate(
        { title: '修复登录（紧急）' },
        [{ id: '1', title: '修复登录紧急' }],
      )
      expect(result[0].score).toBeGreaterThan(0.6)
    })

    it('returns empty array when no candidates', async () => {
      const result = await provider.deduplicate({ title: 'x' }, [])
      expect(result).toHaveLength(0)
    })
  })

  describe('classify', () => {
    it('wraps suggestPriority with priority + optional category', async () => {
      const result = await provider.classify({ title: '生产宕机' })
      expect(result.priority).toBe('CRITICAL')
    })
  })

  describe('extractRequirements', () => {
    it('returns empty array for empty input', async () => {
      expect(await provider.extractRequirements('')).toHaveLength(0)
      expect(await provider.extractRequirements('   \n\n  ')).toHaveLength(0)
    })

    it('returns single requirement for single-block text', async () => {
      const result = await provider.extractRequirements('Add a login button')
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Add a login button')
      expect(result[0].priority).toBe('MEDIUM')
    })

    it('splits on blank lines for multi-requirement text', async () => {
      const result = await provider.extractRequirements(
        'Fix login bug\n\nOptimize dashboard\n\nAdd export feature',
      )
      expect(result).toHaveLength(3)
      expect(result.map((r) => r.title)).toEqual([
        'Fix login bug',
        'Optimize dashboard',
        'Add export feature',
      ])
    })

    it('detects critical priority in extracted requirements', async () => {
      const result = await provider.extractRequirements(
        'Fix critical bug\n\nOptimize dashboard',
      )
      expect(result[0].priority).toBe('CRITICAL')
      expect(result[1].priority).toBe('LOW')
    })
  })
})