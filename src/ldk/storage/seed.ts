import { idbGet, idbPut } from './idb'

const SEED_KEY = 'primary'
const SEED_LENGTH = 32

export async function getSeed(): Promise<Uint8Array | undefined> {
  return idbGet<Uint8Array>('ldk_seed', SEED_KEY)
}

export async function storeDerivedSeed(seed: Uint8Array): Promise<void> {
  if (seed.length !== SEED_LENGTH) {
    throw new Error(`Expected ${SEED_LENGTH}-byte seed, got ${seed.length}`)
  }
  const existing = await getSeed()
  if (existing) {
    throw new Error(
      'Seed already exists. Refusing to overwrite — this would destroy access to existing funds.'
    )
  }
  await idbPut('ldk_seed', SEED_KEY, seed)
}
