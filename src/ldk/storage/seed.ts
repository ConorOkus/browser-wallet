import { idbGet, idbPut } from './idb'

const SEED_KEY = 'primary'
const SEED_LENGTH = 32

export async function getSeed(): Promise<Uint8Array | undefined> {
  return idbGet<Uint8Array>('ldk_seed', SEED_KEY)
}

export async function generateAndStoreSeed(): Promise<Uint8Array> {
  const seed = new Uint8Array(SEED_LENGTH)
  crypto.getRandomValues(seed)
  await idbPut('ldk_seed', SEED_KEY, seed)
  return seed
}
