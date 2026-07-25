import { db } from '@/lib/db'

const REQUIREMENT_COUNTER_NAME = 'requirement'

export class CounterService {
  /**
   * Atomically increment and return the next global requirement number.
   */
  async getNextRequirementNumber(): Promise<number> {
    return this.getNextNumber(REQUIREMENT_COUNTER_NAME)
  }

  /**
   * Atomically increment and return the next number for a named counter.
   */
  async getNextNumber(name: string): Promise<number> {
    const counter = await db.globalCounter.update({
      where: { name },
      data: { value: { increment: 1 } },
      select: { value: true },
    })
    return counter.value
  }

  /**
   * Ensure a counter exists. Used during seeding/testing.
   */
  async ensureCounter(name: string, initialValue = 0) {
    await db.globalCounter.upsert({
      where: { name },
      create: { name, value: initialValue },
      update: {},
    })
  }
}

export const counterService = new CounterService()
