import type { AIProvider } from './types'
import { NullAIProvider } from './null-provider'

export function createAIProvider(): AIProvider {
  if (process.env.AI_ENABLED === 'true') {
    throw new Error('AI provider not implemented; set AI_ENABLED=false to use NullAIProvider')
  }
  return new NullAIProvider()
}

export const aiProvider = createAIProvider()
