import type {
  AIProvider,
  AIRequirementInput,
  AIRequirementOutput,
  AIPriority,
  AIRequirementCandidate,
  AIDedupHit,
} from './types'

type ChatMessage = { role: 'system' | 'user'; content: string }

type ChatResponse = {
  choices?: Array<{ message?: { content?: string } }>
}

/**
 * OpenAI-compatible chat completions provider.
 *
 * Uses Node's built-in `fetch` to avoid adding an SDK dependency. Sends
 * classification / dedup requests with `response_format: json_object` so the
 * caller can parse reliably. Falls back gracefully on HTTP errors or parse
 * failures by returning neutral defaults.
 */
export class OpenAIProvider implements AIProvider {
  constructor(
    private readonly config: {
      apiKey: string
      baseUrl: string
      model: string
      timeoutMs?: number
    },
  ) {}

  async classify(input: AIRequirementInput): Promise<{
    priority: AIPriority
    category?: string
  }> {
    const priority = await this.suggestPriority(input)
    const category = await this.completeJSON<{ category?: string }>(
      [
        systemMessage(
          'You classify software requirements. Respond with JSON {"category": "<one short noun phrase>"}. ' +
            'No prose, no markdown.',
        ),
        userMessage(`Title: ${input.title}\nBody: ${input.body ?? ''}`),
      ],
      { category: 'general' },
    )
    return { priority, category: category.category }
  }

  async suggestPriority(input: AIRequirementInput): Promise<AIPriority> {
    const result = await this.completeJSON<{ priority?: string }>(
      [
        systemMessage(
          'You prioritize software requirements. Respond with JSON ' +
            '{"priority": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL"}. ' +
            'CRITICAL = outage / blocker / data loss / security. ' +
            'HIGH = core workflow broken or missing. ' +
            'LOW = nice-to-have, cosmetic, optimization. ' +
            'MEDIUM = everything else. No prose, no markdown.',
        ),
        userMessage(`Title: ${input.title}\nBody: ${input.body ?? ''}`),
      ],
      { priority: 'MEDIUM' },
    )
    return normalizePriority(result.priority)
  }

  async deduplicate(
    input: AIRequirementInput,
    candidates: AIRequirementCandidate[],
  ): Promise<AIDedupHit[]> {
    if (candidates.length === 0) return []
    const list = candidates
      .map((c, i) => `[${i}] ${c.title}`)
      .join('\n')

    type DedupResponse = { duplicates?: Array<{ index: number; score: number }> }
    const result = await this.completeJSON<DedupResponse>(
      [
        systemMessage(
          'You score duplicate risk between a new requirement and a list of candidates. ' +
            'Respond with JSON {"duplicates": [{"index": <int>, "score": <0..1>}, ...]}. ' +
            'Only include candidates whose score > 0.5. score=1 means essentially the same request.',
        ),
        userMessage(
          `NEW:\nTitle: ${input.title}\nBody: ${input.body ?? ''}\n\nCANDIDATES:\n${list}`,
        ),
      ],
      { duplicates: [] },
    )

    const map = new Map<number, number>()
    for (const d of result.duplicates ?? []) {
      if (typeof d?.index === 'number') {
        map.set(d.index, typeof d.score === 'number' ? d.score : 0.5)
      }
    }
    return candidates.map((candidate, index) => ({
      candidate,
      score: map.get(index) ?? 0,
    }))
  }

  async extractRequirements(text: string): Promise<AIRequirementOutput[]> {
    const result = await this.completeJSON<{ items?: AIRequirementOutput[] }>(
      [
        systemMessage(
          'You split a free-form text into individual requirements. Respond with JSON ' +
            '{"items": [{"title": "<short imperative sentence>", "body": "<optional context>", "priority": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL"}, ...]}. ' +
            'Skip prose, explanations, or markdown.',
        ),
        userMessage(text),
      ],
      { items: [] },
    )
    return Array.isArray(result.items) ? result.items : []
  }

  private async completeJSON<T>(messages: ChatMessage[], fallback: T): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 8_000)
    try {
      const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: 300,
        }),
      })
      if (!res.ok) {
        console.warn(`[ai] openai http ${res.status}; using fallback`)
        return fallback
      }
      const data = (await res.json()) as ChatResponse
      const content = data.choices?.[0]?.message?.content
      if (!content) return fallback
      try {
        return JSON.parse(content) as T
      } catch {
        console.warn('[ai] openai returned unparseable JSON; using fallback')
        return fallback
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[ai] openai request failed (${msg}); using fallback`)
      return fallback
    } finally {
      clearTimeout(timer)
    }
  }
}

function systemMessage(text: string): ChatMessage {
  return { role: 'system', content: text }
}

function userMessage(text: string): ChatMessage {
  return { role: 'user', content: text }
}

function normalizePriority(p: string | undefined): AIPriority {
  if (p === 'LOW' || p === 'HIGH' || p === 'CRITICAL' || p === 'MEDIUM') return p
  return 'MEDIUM'
}