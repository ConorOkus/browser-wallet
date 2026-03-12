import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import type { Wallet } from '@bitcoindevkit/bdk-wallet-web'
import {
  OnchainContext,
  defaultOnchainContextValue,
  type OnchainContextValue,
} from './onchain-context'
import { initializeBdkWallet } from './init'
import { startOnchainSyncLoop, type OnchainBalance } from './sync'

export function OnchainProvider({
  children,
  bdkDescriptors,
}: {
  children: ReactNode
  bdkDescriptors: { external: string; internal: string }
}) {
  const [state, setState] = useState<OnchainContextValue>(defaultOnchainContextValue)
  const walletRef = useRef<Wallet | null>(null)

  const generateAddress = useCallback((): string => {
    if (!walletRef.current) throw new Error('BDK wallet not initialized')
    const info = walletRef.current.next_unused_address('external')
    return info.address.toString()
  }, [])

  useEffect(() => {
    let cancelled = false
    let syncHandle: { stop: () => void } | null = null

    initializeBdkWallet(bdkDescriptors, 'signet')
      .then(({ wallet, esploraClient }) => {
        if (cancelled) return

        walletRef.current = wallet

        syncHandle = startOnchainSyncLoop(
          wallet,
          esploraClient,
          (balance: OnchainBalance) => {
            if (cancelled) return
            setState({
              status: 'ready',
              balance,
              wallet,
              generateAddress,
              error: null,
            })
          },
        )
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({
          status: 'error',
          balance: null,
          wallet: null,
          error: err instanceof Error ? err : new Error(String(err)),
        })
      })

    return () => {
      cancelled = true
      syncHandle?.stop()
      walletRef.current = null
    }
  }, [bdkDescriptors, generateAddress])

  return <OnchainContext value={state}>{children}</OnchainContext>
}
