import { useMemo } from 'react'
import { useOnchain } from '../onchain/use-onchain'
import { useLdk } from '../ldk/use-ldk'
import { msatToSatFloor } from '../utils/msat'

export type UnifiedTransaction = {
  id: string
  direction: 'sent' | 'received'
  amountSats: bigint
  timestamp: number // unix ms for sorting
  label: string
  status: 'confirmed' | 'pending' | 'failed'
  layer: 'onchain' | 'lightning'
}

export function useTransactionHistory(): {
  transactions: UnifiedTransaction[]
  isLoading: boolean
} {
  const onchain = useOnchain()
  const ldk = useLdk()

  const isLoading = onchain.status === 'loading' || ldk.status === 'loading'

  const transactions = useMemo(() => {
    const items: UnifiedTransaction[] = []

    // On-chain transactions
    if (onchain.status === 'ready') {
      for (const tx of onchain.listTransactions()) {
        const netSent = tx.sent - tx.received
        const netReceived = tx.received - tx.sent
        const isSend = tx.sent > tx.received
        items.push({
          id: tx.txid,
          direction: isSend ? 'sent' : 'received',
          amountSats: isSend ? netSent : netReceived,
          timestamp: tx.confirmationTime
            ? Number(tx.confirmationTime) * 1000
            : tx.firstSeen
              ? Number(tx.firstSeen) * 1000
              : 0,
          label: isSend ? 'Sent' : 'Received',
          status: tx.isConfirmed ? 'confirmed' : 'pending',
          layer: 'onchain',
        })
      }
    }

    // Lightning payments from persisted history
    if (ldk.status === 'ready') {
      for (const p of ldk.paymentHistory) {
        if (p.status === 'failed') continue
        items.push({
          id: p.paymentHash,
          direction: p.direction === 'outbound' ? 'sent' : 'received',
          amountSats: msatToSatFloor(p.amountMsat),
          timestamp: p.createdAt,
          label: p.direction === 'outbound' ? 'Sent' : 'Received',
          status: p.status === 'pending' ? 'pending' : 'confirmed',
          layer: 'lightning',
        })
      }
    }

    items.sort((a, b) => b.timestamp - a.timestamp)
    return items
  }, [onchain, ldk])

  return { transactions, isLoading }
}
