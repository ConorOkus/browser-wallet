import { describe, it, expect, beforeEach, vi } from 'vitest'

let seedModule: typeof import('./seed')

beforeEach(async () => {
  vi.resetModules()
  seedModule = await import('./seed')
})

describe('seed storage', () => {
  it('returns undefined when no seed exists', async () => {
    const seed = await seedModule.getSeed()
    expect(seed).toBeUndefined()
  })

  it('generates a 32-byte seed and persists it', async () => {
    const seed = await seedModule.generateAndStoreSeed()
    expect(seed).toBeInstanceOf(Uint8Array)
    expect(seed.length).toBe(32)

    const retrieved = await seedModule.getSeed()
    expect(Array.from(retrieved!)).toEqual(Array.from(seed))
  })

  it('generates different seeds each time', async () => {
    const seed1 = await seedModule.generateAndStoreSeed()

    vi.resetModules()
    const freshModule = await import('./seed')
    const seed2 = await freshModule.generateAndStoreSeed()

    // Extremely unlikely to be equal with crypto.getRandomValues
    expect(seed1).not.toEqual(seed2)
  })
})
