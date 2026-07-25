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

/**
 * Augmented input for callers that need to correlate results back to DB
 * records. The provider only inspects `title`/`body`; `id` is opaque.
 */
export interface AIRequirementCandidate {
  id: string
  title: string
  body?: string | null
}

export interface AIDedupHit {
  candidate: AIRequirementCandidate
  score: number
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
    candidates: AIRequirementCandidate[],
  ): Promise<AIDedupHit[]>

  /**
   * Suggest priority based on content.
   */
  suggestPriority(input: AIRequirementInput): Promise<AIPriority>

  /**
   * Extract multiple requirements from a free-form text.
   */
  extractRequirements(text: string): Promise<AIRequirementOutput[]>
}
