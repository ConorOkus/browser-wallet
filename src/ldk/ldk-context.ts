import { createContext } from 'react'
import type { LdkNode } from './init'

type LdkStatus = 'loading' | 'ready' | 'error'

export interface LdkContextValue {
  status: LdkStatus
  node: LdkNode | null
  nodeId: string | null
  error: Error | null
}

export const defaultLdkContextValue: LdkContextValue = {
  status: 'loading',
  node: null,
  nodeId: null,
  error: null,
}

export const LdkContext = createContext<LdkContextValue>(defaultLdkContextValue)
