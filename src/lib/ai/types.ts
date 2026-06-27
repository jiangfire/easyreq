export type AIPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface AIRequirementInput {
  title: string
  body?: string | null
}

export interface AIRequirementOutput {
  title: string
  body?: string
  priority?: AIPriority
  acceptanceCriteria?: string
}

export interface AIProvider {
  /**
   * Classify a requirement into a priority and category.
   */
  classify(input: AIRequirementInput): Promise<{
    priority: AIPriority
    category?: string
  }>

  /**
   * Detect duplicate requirements by title/body similarity.
   */
  deduplicate(
    input: AIRequirementInput,
    candidates: AIRequirementInput[],
  ): Promise<Array<{ candidate: AIRequirementInput; score: number }>>

  /**
   * Suggest priority based on content.
   */
  suggestPriority(input: AIRequirementInput): Promise<AIPriority>

  /**
   * Extract multiple requirements from a free-form text.
   */
  extractRequirements(text: string): Promise<AIRequirementOutput[]>
}
