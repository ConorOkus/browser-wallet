import type { Wallet } from '@bitcoindevkit/bdk-wallet-web'
import { putChangeset } from './storage/changeset'

/**
 * Reveal the next unused external address from the BDK wallet and persist
 * the changeset so BDK will sync this address after restart.
 *
 * Returns the raw script_pubkey bytes for the revealed address.
 */
export function revealNextAddress(wallet: Wallet, tag: string): Uint8Array {
  const addressInfo = wallet.next_unused_address('external')
  const scriptBytes = addressInfo.address.script_pubkey.as_bytes()

  const staged = wallet.take_staged()
  if (staged && !staged.is_empty()) {
    void putChangeset(staged.to_json()).catch((err: unknown) =>
      console.warn(`[${tag}] Failed to persist address reveal changeset:`, err)
    )
  }

  return scriptBytes
}

/**
 * Derive a BDK address index deterministically from a channel_keys_id.
 * Takes the first 4 bytes as big-endian uint32, modulo 10,000.
 */
function channelKeysIdToIndex(channelKeysId: Uint8Array): number {
  const view = new DataView(channelKeysId.buffer, channelKeysId.byteOffset, channelKeysId.byteLength)
  const raw = view.getUint32(0, false) // big-endian
  return raw % 10_000
}

/**
 * Deterministically derive a BDK address from a channel_keys_id.
 *
 * Maps channel_keys_id → derivation index, then uses peek_address to get
 * the address without advancing the internal counter. Calls reveal_addresses_to
 * so BDK tracks this address for syncing, and persists the changeset.
 *
 * The same channel_keys_id always produces the same address on any device
 * with the same mnemonic, which is critical for cross-device VSS recovery.
 */
export function peekAddressAtIndex(wallet: Wallet, channelKeysId: Uint8Array): Uint8Array {
  const index = channelKeysIdToIndex(channelKeysId)
  const addressInfo = wallet.peek_address('external', index)
  const scriptBytes = addressInfo.address.script_pubkey.as_bytes()

  // Reveal addresses up to this index so BDK tracks them for syncing
  wallet.reveal_addresses_to('external', index)

  const staged = wallet.take_staged()
  if (staged && !staged.is_empty()) {
    void putChangeset(staged.to_json()).catch((err: unknown) =>
      console.warn('[peekAddressAtIndex] Failed to persist changeset:', err)
    )
  }

  return scriptBytes
}
