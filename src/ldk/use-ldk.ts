import { useContext } from 'react'
import { LdkContext, type LdkContextValue } from './ldk-context'

/**
 * Access LDK context. Must be used within an LdkProvider.
 * Throws if called outside of any LdkContext provider tree.
 */
export function useLdk(): LdkContextValue {
  return useContext(LdkContext)
}
