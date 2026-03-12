import { createContext } from 'react'
import type { Wallet } from '@bitcoindevkit/bdk-wallet-web'
import type { OnchainBalance } from './sync'

export type OnchainContextValue =
  | { status: 'loading'; balance: null; wallet: null; error: null }
  | {
      status: 'ready'
      balance: OnchainBalance
      wallet: Wallet
      generateAddress: () => string
      error: null
    }
  | { status: 'error'; balance: null; wallet: null; error: Error }

export const defaultOnchainContextValue: OnchainContextValue = {
  status: 'loading',
  balance: null,
  wallet: null,
  error: null,
}

export const OnchainContext = createContext<OnchainContextValue>(defaultOnchainContextValue)
