import type {
  AIProvider,
  AIRequirementInput,
  AIRequirementOutput,
  AIPriority,
  AIRequirementCandidate,
  AIDedupHit,
} from './types'

/**
 * HeuristicAIProvider — zero-dependency default when AI is enabled.
 *
 * Implements:
 * - priority suggestion via keyword matching (Chinese + English)
 * - duplicate detection via normalized title bigram Jaccard similarity
 * - acceptance-criteria extraction (stub: returns the input unchanged)
 * - multi-requirement extraction (splits on blank lines / list markers)
 *
 * Deterministic, offline, no network. Useful as a sane default and as a
 * fallback when the configured provider fails. When `AI_PROVIDER=openai`
 * (or similar) is set, the factory in `./index.ts` swaps this out for the
 * real provider instead.
 */
export class HeuristicAIProvider implements AIProvider {
  classify(input: AIRequirementInput): Promise<{ priority: AIPriority; category?: string }> {
    return Promise.resolve({ priority: this.suggestPrioritySync(input) })
  }

  suggestPriority(input: AIRequirementInput): Promise<AIPriority> {
    return Promise.resolve(this.suggestPrioritySync(input))
  }

  private suggestPrioritySync(input: AIRequirementInput): AIPriority {
    const text = `${input.title}\n${input.body ?? ''}`.toLowerCase()

    if (matchesAny(text, CRITICAL_KEYWORDS)) return 'CRITICAL'
    if (matchesAny(text, HIGH_KEYWORDS)) return 'HIGH'
    if (matchesAny(text, LOW_KEYWORDS)) return 'LOW'
    return 'MEDIUM'
  }

  deduplicate(
    input: AIRequirementInput,
    candidates: AIRequirementCandidate[],
  ): Promise<AIDedupHit[]> {
    const inputBigrams = bigramsOf(normalize(input.title))
    const scored: AIDedupHit[] = candidates.map((candidate) => ({
      candidate,
      score: jaccard(inputBigrams, bigramsOf(normalize(candidate.title))),
    }))
    // Sort descending so callers can take the first hit.
    scored.sort((a, b) => b.score - a.score)
    return Promise.resolve(scored)
  }

  extractRequirements(text: string): Promise<AIRequirementOutput[]> {
    // Split on blank lines, numbered list markers, or bullet markers.
    const blocks = text
      .split(/\n\s*\n|\n(?=\s*(?:\d+[\.、]|[*\-+])\s)/)
      .map((b) => b.trim())
      .filter(Boolean)

    if (blocks.length === 0) return Promise.resolve([])
    if (blocks.length === 1) {
      const title = firstLine(blocks[0]).slice(0, 200)
      return Promise.resolve([{ title, priority: 'MEDIUM' }])
    }

    return Promise.resolve(
      blocks.map((block) => {
        const title = firstLine(block).slice(0, 200)
        const priority = this.suggestPrioritySync({ title, body: block })
        return { title, priority, body: block.length > title.length ? block : undefined }
      }),
    )
  }
}

export const heuristicAIProvider = new HeuristicAIProvider()

const CRITICAL_KEYWORDS = [
  // Chinese
  '紧急', '加急', '崩溃', '宕机', '无法使用', '故障', '阻断', '阻塞',
  '严重', '立刻', '马上', '立即', 'p0', '最高优先级',
  // English
  'urgent', 'critical', 'outage', 'down', 'broken', 'blocker', 'p0', 'asap',
]

const HIGH_KEYWORDS = [
  // Chinese
  '重要', '尽快', '需要', '必填', '不允许', '缺失', '报错', '失败',
  '性能问题', '安全', '权限', '登录', '认证',
  // English
  'important', 'high', 'broken', 'failure', 'security', 'permission', 'login',
]

const LOW_KEYWORDS = [
  // Chinese
  '优化', '建议', '体验', '美化', '微调', '锦上添花', '可选', 'nice to have',
  // English
  'nice to have', 'optimize', 'tweak', 'cosmetic', 'polish', 'optional', 'minor',
]

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw.toLowerCase()))
}

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\s\u3000]+/g, ' ') // collapse whitespace including full-width space
    .replace(/[^\p{L}\p{N}\s]/gu, '') // strip punctuation
    .trim()
}

function bigramsOf(input: string): Set<string> {
  const out = new Set<string>()
  const padded = ` ${input} `
  for (let i = 0; i < padded.length - 1; i++) {
    out.add(padded.slice(i, i + 2))
  }
  return out
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const token of a) if (b.has(token)) intersection++
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

function firstLine(text: string): string {
  return text.split('\n', 1)[0]?.trim() ?? text.slice(0, 200)
}