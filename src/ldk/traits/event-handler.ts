import {
  EventHandler,
  Event_PaymentClaimable,
  Event_PaymentClaimed,
  Event_PaymentSent,
  Event_PaymentFailed,
  Event_PendingHTLCsForwardable,
  Event_SpendableOutputs,
  Event_ChannelPending,
  Event_ChannelReady,
  Event_ChannelClosed,
  Event_FundingGenerationReady,
  Event_FundingTxBroadcastSafe,
  Event_OpenChannelRequest,
  Event_ConnectionNeeded,
  Event_BumpTransaction,
  Event_DiscardFunding,
  Option_ThirtyTwoBytesZ_Some,
  Result_NoneReplayEventZ,
  type ChannelManager,
  type Event,
} from 'lightningdevkit'
import {
  Wallet,
  Recipient,
  ScriptBuf,
  Amount,
  SignOptions,
} from '@bitcoindevkit/bdk-wallet-web'
import { idbPut } from '../storage/idb'
import { bytesToHex } from '../utils'
import { putChangeset } from '../../onchain/storage/changeset'

const MAX_FORWARD_DELAY_MS = 10_000

export function createEventHandler(channelManager: ChannelManager): {
  handler: EventHandler
  cleanup: () => void
  setBdkWallet: (wallet: Wallet | null) => void
} {
  let forwardTimerId: ReturnType<typeof setTimeout> | null = null
  let bdkWallet: Wallet | null = null

  const handler = EventHandler.new_impl({
    handle_event(event: Event): Result_NoneReplayEventZ {
      try {
        handleEvent(event, channelManager, bdkWallet, (id) => {
          if (forwardTimerId !== null) clearTimeout(forwardTimerId)
          forwardTimerId = id
        })
      } catch (err: unknown) {
        console.error('[LDK Event] Unhandled error in event handler:', err)
      }
      return Result_NoneReplayEventZ.constructor_ok()
    },
  })

  return {
    handler,
    cleanup: () => {
      if (forwardTimerId !== null) {
        clearTimeout(forwardTimerId)
        forwardTimerId = null
      }
    },
    setBdkWallet: (wallet: Wallet | null) => {
      bdkWallet = wallet
    },
  }
}

function handleEvent(
  event: Event,
  channelManager: ChannelManager,
  bdkWallet: Wallet | null,
  setForwardTimer: (id: ReturnType<typeof setTimeout>) => void,
): void {
  // Payment events
  if (event instanceof Event_PaymentClaimable) {
    const preimage = event.purpose.preimage()
    if (preimage instanceof Option_ThirtyTwoBytesZ_Some) {
      console.log(
        '[LDK Event] PaymentClaimable: claiming',
        bytesToHex(event.payment_hash),
        'amount_msat:',
        event.amount_msat.toString(),
      )
      channelManager.claim_funds(preimage.some)
    } else {
      // No preimage available — this can happen for keysend payments where
      // the preimage is not provided via purpose.preimage(). The payment
      // cannot be claimed without a preimage and will timeout.
      console.warn(
        '[LDK Event] PaymentClaimable: no preimage available for',
        bytesToHex(event.payment_hash),
        '— payment cannot be claimed and will timeout',
      )
    }
    return
  }

  if (event instanceof Event_PaymentClaimed) {
    console.log(
      '[LDK Event] PaymentClaimed:',
      bytesToHex(event.payment_hash),
      'amount_msat:',
      event.amount_msat.toString(),
    )
    return
  }

  if (event instanceof Event_PaymentSent) {
    console.log(
      '[LDK Event] PaymentSent:',
      bytesToHex(event.payment_hash),
    )
    return
  }

  if (event instanceof Event_PaymentFailed) {
    console.warn(
      '[LDK Event] PaymentFailed:',
      bytesToHex(event.payment_hash),
    )
    return
  }

  // HTLC forwarding — deduplicate by clearing previous timer
  if (event instanceof Event_PendingHTLCsForwardable) {
    const delayMs = Math.min(
      Number(event.time_forwardable) * 1000,
      MAX_FORWARD_DELAY_MS,
    )
    setForwardTimer(
      setTimeout(() => {
        channelManager.process_pending_htlc_forwards()
      }, delayMs),
    )
    return
  }

  // Channel lifecycle
  if (event instanceof Event_ChannelPending) {
    console.log(
      '[LDK Event] ChannelPending:',
      bytesToHex(event.channel_id.write()),
    )
    return
  }

  if (event instanceof Event_ChannelReady) {
    console.log(
      '[LDK Event] ChannelReady:',
      bytesToHex(event.channel_id.write()),
    )
    return
  }

  if (event instanceof Event_ChannelClosed) {
    console.log(
      '[LDK Event] ChannelClosed:',
      bytesToHex(event.channel_id.write()),
      'reason:',
      event.reason,
    )
    return
  }

  // Spendable outputs — persist descriptors to IDB for future sweep.
  // Note: The IDB write is async but handle_event is sync. If the browser
  // crashes before the write commits, descriptors may be lost. This is a
  // known limitation of the sync/async bridge — the risk window is small
  // (IDB writes are typically <10ms) but not zero.
  if (event instanceof Event_SpendableOutputs) {
    const key = crypto.randomUUID()
    const serialized = event.outputs.map((o) => o.write())
    void idbPut('ldk_spendable_outputs', key, serialized).catch(
      (err: unknown) => {
        console.error(
          '[LDK Event] CRITICAL: Failed to persist SpendableOutputs:',
          err,
        )
      },
    )
    console.log(
      '[LDK Event] SpendableOutputs: persisting',
      event.outputs.length,
      'descriptor(s) for future sweep',
    )
    return
  }

  // Peer reconnection — SocketAddress parsing not yet implemented
  if (event instanceof Event_ConnectionNeeded) {
    console.warn(
      '[LDK Event] ConnectionNeeded:',
      bytesToHex(event.node_id),
      '— SocketAddress parsing not yet implemented',
    )
    return
  }

  // Channel funding — build funding tx with BDK wallet
  if (event instanceof Event_FundingGenerationReady) {
    if (!bdkWallet) {
      console.warn(
        '[LDK Event] FundingGenerationReady: BDK wallet not available — cannot fund channel',
      )
      return
    }

    try {
      const scriptPubkey = ScriptBuf.from_bytes(event.output_script)
      const amount = Amount.from_sat(event.channel_value_satoshis)
      const recipient = new Recipient(scriptPubkey, amount)

      const txBuilder = bdkWallet.build_tx()
      txBuilder.add_recipient(recipient)
      const psbt = txBuilder.finish()
      bdkWallet.sign(psbt, new SignOptions())

      // BDK's Transaction type doesn't expose raw byte serialization.
      // We broadcast the signed tx via BDK's Esplora client and pass
      // the PSBT to LDK via funding_transaction_generated once a
      // cross-WASM serialization bridge is implemented.
      // For now, log the signed PSBT for debugging.
      console.log(
        '[LDK Event] FundingGenerationReady: signed PSBT ready',
        'channel_value:', event.channel_value_satoshis.toString(), 'sats',
        'psbt:', psbt.toString().substring(0, 40) + '...',
      )

      // TODO: Bridge BDK Transaction → raw bytes → LDK funding_transaction_generated()
      // This requires either:
      // 1. BDK-WASM exposing Transaction.to_bytes() (feature request)
      // 2. Parsing the PSBT base64 to extract the finalized tx
      // 3. Using a shared serialization format between the two WASM modules

      // Persist wallet state after funding
      const changeset = bdkWallet.take_staged()
      if (changeset && !changeset.is_empty()) {
        void putChangeset(changeset.to_json()).catch((err: unknown) =>
          console.error('[BDK] CRITICAL: failed to persist changeset after funding tx', err),
        )
      }
    } catch (err: unknown) {
      console.error(
        '[LDK Event] FundingGenerationReady: failed to build funding tx:',
        err,
      )
    }
    return
  }

  if (event instanceof Event_FundingTxBroadcastSafe) {
    console.log('[LDK Event] FundingTxBroadcastSafe:', bytesToHex(event.channel_id.write()))
    return
  }

  if (event instanceof Event_BumpTransaction) {
    // TODO: Implement CPFP with BDK UTXOs for anchor channels
    console.warn(
      '[LDK Event] BumpTransaction: not yet implemented — cannot bump fees',
    )
    return
  }

  if (event instanceof Event_DiscardFunding) {
    console.log('[LDK Event] DiscardFunding')
    return
  }

  // Inbound channel requests — no acceptance policy yet, will timeout
  if (event instanceof Event_OpenChannelRequest) {
    console.log(
      '[LDK Event] OpenChannelRequest: ignoring (no acceptance policy, will timeout)',
    )
    return
  }

  // Catch-all for unhandled event types (future LDK versions may add new events)
  console.log('[LDK Event] Unhandled event type:', event.constructor.name)
}
