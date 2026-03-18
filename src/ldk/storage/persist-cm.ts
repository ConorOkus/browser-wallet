import type { ChannelManager } from 'lightningdevkit'
import { idbPut } from './idb'
import type { VssClient } from './vss-client'

const CM_VSS_KEY = 'channel_manager'
const CM_IDB_KEY = 'primary'

export interface CmPersistContext {
  vssClient?: VssClient | null
  /** Mutable ref holding the current VSS version for the ChannelManager key. */
  cmVersionRef?: { current: number }
}

/**
 * Persist ChannelManager to VSS (if available) then IDB.
 *
 * Unlike ChannelMonitor persistence, this does NOT retry indefinitely —
 * the caller (chain-sync or event timer) is responsible for retry scheduling.
 * This function throws on failure so the caller can set a retry flag.
 */
export async function persistChannelManager(
  cm: ChannelManager,
  ctx: CmPersistContext = {},
): Promise<void> {
  const data = cm.write()
  const vssClient = ctx.vssClient ?? null
  const versionRef = ctx.cmVersionRef

  // VSS first (durable remote)
  if (vssClient && versionRef) {
    const newVersion = await vssClient.putObject(CM_VSS_KEY, data, versionRef.current)
    versionRef.current = newVersion
  }

  // IDB second (fast local)
  await idbPut('ldk_channel_manager', CM_IDB_KEY, data)
}

/**
 * Best-effort IDB-only persist for the visibility change handler.
 *
 * The browser may kill the tab before a network request completes,
 * so this path skips VSS entirely.
 */
export function persistChannelManagerIdbOnly(cm: ChannelManager): Promise<void> {
  return idbPut('ldk_channel_manager', CM_IDB_KEY, cm.write())
}
