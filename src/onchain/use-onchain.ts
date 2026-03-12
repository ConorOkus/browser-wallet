import { useContext } from 'react'
import { OnchainContext, type OnchainContextValue } from './onchain-context'

export function useOnchain(): OnchainContextValue {
  return useContext(OnchainContext)
}
