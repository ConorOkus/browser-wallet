import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useLdk } from '../ldk/use-ldk'
import { useOnchain } from '../onchain/use-onchain'
import { bytesToHex, hexToBytes } from '../ldk/utils'
import { formatBtc } from '../utils/format-btc'
import { SIGNET_CONFIG } from '../ldk/config'
import { ScreenHeader } from '../components/ScreenHeader'
import { Numpad, type NumpadKey } from '../components/Numpad'
import { Check, XClose } from '../components/icons'

interface ConnectedPeer {
  pubkey: string
  host?: string
  port?: number
}

type OpenChannelStep =
  | { step: 'select-peer' }
  | { step: 'amount'; peer: ConnectedPeer }
  | { step: 'reviewing'; peer: ConnectedPeer; amountSats: bigint; estimatedFeeSats: bigint; feeRate: bigint }
  | { step: 'opening' }
  | { step: 'success' }
  | { step: 'error'; message: string }

const MIN_CHANNEL_SATS = 20_000n
const MAX_DIGITS = 8
// Approximate funding tx vsize: 1-input P2TR → ~140 vB
const APPROX_FUNDING_TX_VBYTES = 140n

export function OpenChannel() {
  const navigate = useNavigate()
  const ldk = useLdk()
  const onchain = useOnchain()
  const [currentStep, setCurrentStep] = useState<OpenChannelStep>({ step: 'select-peer' })
  const [amountDigits, setAmountDigits] = useState('')
  const [amountError, setAmountError] = useState<string | null>(null)
  const [peers, setPeers] = useState<ConnectedPeer[]>([])
  const [feeRate, setFeeRate] = useState<bigint | null>(null)
  const openingRef = useRef(false)

  const balance =
    onchain.status === 'ready'
      ? onchain.balance.confirmed + onchain.balance.trustedPending
      : 0n

  // Fetch connected peers
  const refreshPeers = useCallback(() => {
    if (ldk.status !== 'ready') return
    const connectedList = ldk.node.peerManager.list_peers()
    const entries: ConnectedPeer[] = connectedList.map((p) => ({
      pubkey: bytesToHex(p.get_counterparty_node_id()),
    }))
    setPeers(entries)
  }, [ldk])

  useEffect(() => {
    refreshPeers()
  }, [refreshPeers])

  // Fetch fee rate from Esplora
  useEffect(() => {
    fetch(`${SIGNET_CONFIG.esploraUrl}/fee-estimates`)
      .then((res) => res.json() as Promise<Record<string, number>>)
      .then((estimates) => {
        const satPerVb = estimates['6']
        if (typeof satPerVb === 'number' && satPerVb > 0) {
          setFeeRate(BigInt(Math.ceil(satPerVb)))
        } else {
          setFeeRate(1n)
        }
      })
      .catch(() => setFeeRate(1n))
  }, [])

  // --- Numpad handler ---
  const handleNumpadKey = useCallback((key: NumpadKey) => {
    setAmountError(null)
    setAmountDigits((prev) => {
      if (key === 'backspace') return prev.slice(0, -1)
      if (prev.length >= MAX_DIGITS) return prev
      if (prev === '0' && key === '0') return prev
      if (prev === '' && key === '0') return '0'
      if (prev === '0') return key
      return prev + key
    })
  }, [])

  const amountSats = amountDigits ? BigInt(amountDigits) : 0n

  // --- Select peer ---
  const handleSelectPeer = useCallback((peer: ConnectedPeer) => {
    setAmountDigits('')
    setAmountError(null)
    setCurrentStep({ step: 'amount', peer })
  }, [])

  // --- Amount next (go to review) ---
  const handleAmountNext = useCallback(() => {
    if (currentStep.step !== 'amount') return
    setAmountError(null)

    if (amountSats < MIN_CHANNEL_SATS) {
      setAmountError(`Minimum channel size is ${MIN_CHANNEL_SATS.toLocaleString()} sats`)
      return
    }

    const rate = feeRate ?? 1n
    const estimatedFee = rate * APPROX_FUNDING_TX_VBYTES

    if (amountSats + estimatedFee > balance) {
      setAmountError('Amount plus fees exceeds available balance')
      return
    }

    setCurrentStep({
      step: 'reviewing',
      peer: currentStep.peer,
      amountSats,
      estimatedFeeSats: estimatedFee,
      feeRate: rate,
    })
  }, [currentStep, amountSats, balance, feeRate])

  // --- Confirm open channel ---
  const handleConfirm = useCallback(() => {
    if (openingRef.current) return
    if (ldk.status !== 'ready' || currentStep.step !== 'reviewing') return

    openingRef.current = true
    setCurrentStep({ step: 'opening' })

    try {
      const pubkeyBytes = hexToBytes(currentStep.peer.pubkey)
      const ok = ldk.createChannel(pubkeyBytes, currentStep.amountSats)
      if (ok) {
        setCurrentStep({ step: 'success' })
      } else {
        setCurrentStep({ step: 'error', message: 'Failed to initiate channel opening. The peer may have disconnected.' })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[OpenChannel] create_channel error:', err)
      setCurrentStep({ step: 'error', message })
    } finally {
      openingRef.current = false
    }
  }, [ldk, currentStep])

  // --- Loading / error gates ---
  if (ldk.status === 'loading' || onchain.status === 'loading') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-dark">
        <p className="text-[var(--color-on-dark-muted)]">Loading...</p>
      </div>
    )
  }

  if (ldk.status === 'error') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-dark px-6">
        <p className="text-lg font-semibold text-on-dark">Lightning node error</p>
        <p className="mt-2 text-sm text-red-400">{ldk.error.message}</p>
        <button
          className="mt-6 text-sm text-accent"
          onClick={() => void navigate('/settings/advanced')}
        >
          Back to Advanced
        </button>
      </div>
    )
  }

  if (onchain.status === 'error') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-dark px-6">
        <p className="text-lg font-semibold text-on-dark">Wallet error</p>
        <p className="mt-2 text-sm text-red-400">{onchain.error.message}</p>
        <button
          className="mt-6 text-sm text-accent"
          onClick={() => void navigate('/settings/advanced')}
        >
          Back to Advanced
        </button>
      </div>
    )
  }

  // --- Success screen ---
  if (currentStep.step === 'success') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-dark px-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent">
          <Check className="h-10 w-10 text-white" />
        </div>
        <div>
          <div className="font-display text-2xl font-bold text-on-dark">
            Channel Opening
          </div>
          <div className="mt-2 text-sm text-[var(--color-on-dark-muted)]">
            Your channel is being set up. It will be ready once the funding transaction confirms on-chain.
          </div>
        </div>
        <button
          className="mt-4 h-14 w-full max-w-[280px] rounded-xl bg-white font-display text-lg font-bold text-dark transition-transform active:scale-[0.98]"
          onClick={() => void navigate('/')}
        >
          Done
        </button>
      </div>
    )
  }

  // --- Error screen ---
  if (currentStep.step === 'error') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-dark px-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
          <XClose className="h-10 w-10 text-red-400" />
        </div>
        <div>
          <div className="font-display text-2xl font-bold text-on-dark">
            Channel Open Failed
          </div>
          <div className="mt-2 text-sm text-red-400">{currentStep.message}</div>
          <div className="mt-1 text-sm text-[var(--color-on-dark-muted)]">
            Your funds are safe.
          </div>
        </div>
        <button
          className="mt-4 h-14 w-full max-w-[280px] rounded-xl bg-white font-display text-lg font-bold text-dark transition-transform active:scale-[0.98]"
          onClick={() => setCurrentStep({ step: 'select-peer' })}
        >
          Try Again
        </button>
      </div>
    )
  }

  // --- Opening screen ---
  if (currentStep.step === 'opening') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-dark">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        <p className="text-[var(--color-on-dark-muted)]">Opening channel...</p>
      </div>
    )
  }

  // --- Review screen ---
  if (currentStep.step === 'reviewing') {
    return (
      <div className="flex min-h-dvh flex-col justify-between bg-dark text-on-dark">
        <ScreenHeader title="Review" onBack={() => setCurrentStep({ step: 'amount', peer: currentStep.peer })} />
        <div className="flex flex-1 flex-col gap-6 px-6 pt-8">
          <div className="flex justify-between">
            <span className="text-sm font-medium text-[var(--color-on-dark-muted)]">Peer</span>
            <span className="max-w-[60%] break-all text-right font-mono text-sm font-semibold">
              {currentStep.peer.pubkey.slice(0, 12)}...{currentStep.peer.pubkey.slice(-8)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium text-[var(--color-on-dark-muted)]">Channel Size</span>
            <span className="font-semibold">{formatBtc(currentStep.amountSats)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium text-[var(--color-on-dark-muted)]">
              Est. fee (~{currentStep.feeRate.toString()} sat/vB)
            </span>
            <span className="font-semibold">≈ {formatBtc(currentStep.estimatedFeeSats)}</span>
          </div>
          <hr className="border-dark-border" />
          <div className="flex justify-between">
            <span className="text-lg font-semibold">Total</span>
            <span className="font-display text-3xl font-bold">
              ≈ {formatBtc(currentStep.amountSats + currentStep.estimatedFeeSats)}
            </span>
          </div>
        </div>
        <div className="px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-4">
          <button
            className="h-14 w-full rounded-xl bg-accent font-display text-lg font-bold text-white transition-transform active:scale-[0.98]"
            onClick={handleConfirm}
          >
            Open Channel
          </button>
        </div>
      </div>
    )
  }

  // --- Amount screen (numpad) ---
  if (currentStep.step === 'amount') {
    return (
      <div className="flex min-h-dvh flex-col justify-between bg-dark text-on-dark">
        <ScreenHeader title="Channel Size" onBack={() => setCurrentStep({ step: 'select-peer' })} />
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <span className="text-sm text-[var(--color-on-dark-muted)]">
            {formatBtc(balance)} available
          </span>
          <div
            className={`font-display font-bold leading-none tracking-tight ${
              amountDigits.length > 5 ? 'text-5xl' : 'text-7xl'
            }`}
            aria-live="polite"
          >
            {formatBtc(amountSats)}
          </div>
          {amountError && (
            <p className="mt-1 text-sm text-red-400">{amountError}</p>
          )}
        </div>
        <Numpad
          onKey={handleNumpadKey}
          onNext={handleAmountNext}
          nextDisabled={amountSats <= 0n}
        />
      </div>
    )
  }

  // --- Peer selection screen ---
  return (
    <div className="flex min-h-dvh flex-col bg-dark text-on-dark">
      <ScreenHeader title="Open Channel" backTo="/settings/advanced" />
      <div className="flex flex-col gap-4 px-6 pt-2">
        <span className="text-sm font-medium text-[var(--color-on-dark-muted)]">
          Select a connected peer
        </span>

        {peers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-[var(--color-on-dark-muted)]">No peers connected</p>
            <button
              className="text-sm text-accent"
              onClick={() => void navigate('/settings/advanced/peers')}
            >
              Go to Peers
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {peers.map((peer) => (
              <button
                key={peer.pubkey}
                className="flex items-center gap-3 rounded-xl bg-dark-elevated p-4 transition-colors active:bg-white/5"
                onClick={() => handleSelectPeer(peer)}
              >
                <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" />
                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left font-mono text-sm">
                  {peer.pubkey.slice(0, 16)}...{peer.pubkey.slice(-8)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
