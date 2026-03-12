import { describe, it, expect, beforeEach, vi } from 'vitest'

let changesetModule: typeof import('./changeset')

beforeEach(async () => {
  const { closeDb } = await import('../../ldk/storage/idb')
  closeDb()
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('browser-wallet-ldk')
    req.onsuccess = () => resolve()
    req.onerror = () => reject(new Error(req.error?.message ?? 'Failed to delete DB'))
  })
  vi.resetModules()
  changesetModule = await import('./changeset')
})

describe('changeset storage', () => {
  it('returns undefined when no changeset stored', async () => {
    const result = await changesetModule.getChangeset()
    expect(result).toBeUndefined()
  })

  it('stores and retrieves a changeset JSON string', async () => {
    const json = '{"descriptor":{},"change_descriptor":{},"network":"signet"}'
    await changesetModule.putChangeset(json)
    const result = await changesetModule.getChangeset()
    expect(result).toBe(json)
  })

  it('overwrites existing changeset', async () => {
    await changesetModule.putChangeset('{"v":1}')
    await changesetModule.putChangeset('{"v":2}')
    const result = await changesetModule.getChangeset()
    expect(result).toBe('{"v":2}')
  })
})
