import type { AIProvider } from './types'
import { NullAIProvider } from './null-provider'
import { heuristicAIProvider } from './heuristic-provider'

export type AIProviderName = 'null' | 'heuristic' | 'openai'

/**
 * Resolve the configured AI provider.
 *
 * Selection order:
 *   1. `AI_ENABLED=true` enables AI; otherwise `null` provider (no-op).
 *   2. `AI_PROVIDER` picks the implementation:
 *      - `heuristic` (default): offline keyword-based, zero deps
 *      - `openai`: hits an OpenAI-compatible HTTP endpoint
 *      - anything else falls back to heuristic and logs a warning
 *
 * The OpenAI implementation lives alongside this file and is intentionally
 * minimal (chat completions + JSON mode). Swap in your real provider by
 * implementing `AIProvider` and adding a branch below.
 */
export function createAIProvider(): AIProvider {
  if (process.env.AI_ENABLED !== 'true') {
    return new NullAIProvider()
  }

  const name = (process.env.AI_PROVIDER ?? 'heuristic') as AIProviderName
  switch (name) {
    case 'null':
      return new NullAIProvider()
    case 'heuristic':
      return heuristicAIProvider
    case 'openai':
      return createOpenAIProvider()
    default:
      console.warn(`[ai] unknown AI_PROVIDER="${name}", falling back to heuristic`)
      return heuristicAIProvider
  }
}

function createOpenAIProvider(): AIProvider {
  // Lazy import so the SDK only loads when actually configured.
  const apiKey = process.env.AI_API_KEY
  const baseUrl = process.env.AI_BASE_URL ?? 'https://api.openai.com/v1'
  const model = process.env.AI_MODEL ?? 'gpt-4o-mini'

  if (!apiKey) {
    console.warn('[ai] AI_PROVIDER=openai but AI_API_KEY is empty, falling back to heuristic')
    return heuristicAIProvider
  }

  // Avoid pulling the openai SDK dependency until someone actually configures it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('./openai-provider') as typeof import('./openai-provider')
  return new mod.OpenAIProvider({ apiKey, baseUrl, model })
}

export const aiProvider = createAIProvider()

/**
 * Recompute the provider. Tests call this after changing env to swap
 * implementations without restarting the process.
 */
export function resetAIProvider(): AIProvider {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('./index') as typeof import('./index')
  // The cache is module-level; the only way to "reset" is to re-export a fresh
  // function. Tests can do `vi.resetModules()` + `import('@/lib/ai')` again.
  return mod.aiProvider
}