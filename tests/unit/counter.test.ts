import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/lib/db'
import { counterService } from '@/services/counter.service'

const TEST_COUNTER = 'counter-test'

async function cleanCounter() {
  await db.globalCounter.deleteMany({ where: { name: TEST_COUNTER } })
}

describe('CounterService', () => {
  beforeEach(async () => {
    await cleanCounter()
    await counterService.ensureCounter(TEST_COUNTER, 0)
  })

  afterAll(async () => {
    await cleanCounter()
  })

  it('increments global counter atomically', async () => {
    const n1 = await counterService.getNextNumber(TEST_COUNTER)
    const n2 = await counterService.getNextNumber(TEST_COUNTER)
    const n3 = await counterService.getNextNumber(TEST_COUNTER)

    expect(n2).toBe(n1 + 1)
    expect(n3).toBe(n2 + 1)
  })

  it('starts from the configured initial value', async () => {
    await cleanCounter()
    await counterService.ensureCounter(TEST_COUNTER, 100)

    const n1 = await counterService.getNextNumber(TEST_COUNTER)
    const n2 = await counterService.getNextNumber(TEST_COUNTER)

    expect(n1).toBe(101)
    expect(n2).toBe(102)
  })
})
