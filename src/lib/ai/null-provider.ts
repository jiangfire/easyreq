import type {
  AIProvider,
  AIRequirementInput,
  AIRequirementOutput,
  AIPriority,
} from './types'

export class NullAIProvider implements AIProvider {
  async classify(_input: AIRequirementInput): Promise<{
    priority: AIPriority
    category?: string
  }> {
    return { priority: 'MEDIUM' }
  }

  async deduplicate(
    _input: AIRequirementInput,
    candidates: AIRequirementInput[],
  ): Promise<Array<{ candidate: AIRequirementInput; score: number }>> {
    return candidates.map((candidate) => ({ candidate, score: 0 }))
  }

  async suggestPriority(_input: AIRequirementInput): Promise<AIPriority> {
    return 'MEDIUM'
  }

  async extractRequirements(text: string): Promise<AIRequirementOutput[]> {
    return [
      {
        title: text.slice(0, 200),
        priority: 'MEDIUM',
      },
    ]
  }
}

export const nullAIProvider = new NullAIProvider()
