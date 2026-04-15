import { useState, useEffect, useCallback } from 'react'
import {
  readRecoveryState,
  writeRecoveryState,
  clearRecoveryState,
  roundUpDepositNeeded,
  type RecoveryState,
  type RecoveryStatus,
} from './recovery-state'
import type { RecoveryNeededInfo } from '../traits/event-handler'
import type { VssClient } from '../storage/vss-client'
import { captureError } from '../../storage/error-log'
import { getFeeRate } from '../../shared/fee-cache'

/** Custom event name used to bridge LDK event handler → React state. */
const RECOVERY_EVENT = 'zinqq:recovery-state-changed'

/** Fire from anywhere to trigger a re-read of recovery state in the hook. */
export function notifyRecoveryStateChanged(): void {
  window.dispatchEvent(new Event(RECOVERY_EVENT))
}

// Fee estimate: anchor CPFP typically needs ~140 vbytes. At current fee rate,
// calculate the approximate cost and round up with buffer.
const CPFP_VBYTES_ESTIMATE = 140
const FEE_TARGET_BLOCKS = 6

async function estimateDepositNeeded(): Promise<number> {
  try {
    const feeRate = await getFeeRate(FEE_TARGET_BLOCKS)
    const exactFee = Math.ceil(feeRate * CPFP_VBYTES_ESTIMATE)
    return roundUpDepositNeeded(exactFee)
  } catch {
    // Default to a safe amount if fee estimation fails
    return 25_000
  }
}

/**
 * Enter recovery state when a force-close CPFP fails.
 * Called from the LDK event handler callback (outside React).
 */
export async function enterRecovery(
  info: RecoveryNeededInfo,
  depositAddress: string,
  vssClient: VssClient | null
): Promise<void> {
  const existing = await readRecoveryState()

  if (existing) {
    // Aggregate: add channel to existing recovery
    if (!existing.channelIds.includes(info.channelId)) {
      existing.channelIds.push(info.channelId)
      existing.stuckBalanceSat += info.localBalanceSat
      existing.depositNeededSat = await estimateDepositNeeded()
      existing.updatedAt = Date.now()
      await writeRecoveryState(existing, vssClient)
    }
  } else {
    const depositNeeded = await estimateDepositNeeded()
    const state: RecoveryState = {
      status: 'needs_recovery',
      stuckBalanceSat: info.localBalanceSat,
      depositAddress,
      depositNeededSat: depositNeeded,
      channelIds: [info.channelId],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await writeRecoveryState(state, vssClient)
  }

  notifyRecoveryStateChanged()
}

export interface UseRecoveryResult {
  recovery: RecoveryState | null
  /** Update status (e.g. when user opens the recovery screen). */
  setStatus: (status: RecoveryStatus) => Promise<void>
  /** Dismiss the success banner — clears all recovery state. */
  dismiss: () => Promise<void>
  /** Refresh the deposit needed amount based on current fee estimates. */
  refreshDepositNeeded: () => Promise<void>
}

/**
 * React hook that exposes force-close recovery state.
 * Reads from IDB on mount and re-reads when notified via custom event.
 */
export function useRecovery(vssClient: VssClient | null): UseRecoveryResult {
  const [recovery, setRecovery] = useState<RecoveryState | null>(null)

  // Load on mount + listen for changes
  useEffect(() => {
    const load = () => {
      readRecoveryState()
        .then(setRecovery)
        .catch((err: unknown) =>
          captureError('error', 'useRecovery', 'Failed to load recovery state', String(err))
        )
    }

    load()
    window.addEventListener(RECOVERY_EVENT, load)
    return () => window.removeEventListener(RECOVERY_EVENT, load)
  }, [])

  const setStatus = useCallback(
    async (status: RecoveryStatus) => {
      const current = await readRecoveryState()
      if (!current) return
      const updated = { ...current, status, updatedAt: Date.now() }
      await writeRecoveryState(updated, vssClient)
      setRecovery(updated)
    },
    [vssClient]
  )

  const dismiss = useCallback(async () => {
    await clearRecoveryState(vssClient)
    setRecovery(null)
  }, [vssClient])

  const refreshDepositNeeded = useCallback(async () => {
    const current = await readRecoveryState()
    if (!current) return
    const newAmount = await estimateDepositNeeded()
    if (newAmount !== current.depositNeededSat) {
      const updated = { ...current, depositNeededSat: newAmount, updatedAt: Date.now() }
      await writeRecoveryState(updated, vssClient)
      setRecovery(updated)
    }
  }, [vssClient])

  return { recovery, setStatus, dismiss, refreshDepositNeeded }
}
