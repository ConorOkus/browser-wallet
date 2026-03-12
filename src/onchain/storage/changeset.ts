import { idbGet, idbPut } from '../../ldk/storage/idb'

const CHANGESET_KEY = 'primary'

export async function getChangeset(): Promise<string | undefined> {
  return idbGet<string>('bdk_changeset', CHANGESET_KEY)
}

export async function putChangeset(json: string): Promise<void> {
  await idbPut('bdk_changeset', CHANGESET_KEY, json)
}
