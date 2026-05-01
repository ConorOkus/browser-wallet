import { useEffect, useState } from 'react'

// Throwaway smoke test for `@xstoicunicornx/payjoin@0.0.4`. Verifies the
// fork's `/web-vite` entry can fetch + instantiate the wasm binary in this
// app's Vite + Vercel toolchain without the build hacks the previous
// integration required (sed patches, vendored submodule, custom Vercel
// installCommand). Lives on branch `payjoin-fork-smoke`; not for main.
// See docs/plans/2026-04-30-001-feat-payjoin-fork-smoke-test-plan.md.

// Mainnet P2WPKH bech32 from BIP 173 § Test vectors, with a contrived
// `pj=` so PDK exercises the payjoin URI parsing path (not just plain
// BIP 21). The relay URL is a placeholder — we never call it; we stop
// before any network step.
const FIXTURE_URI =
  'bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4' +
  '?amount=0.0001&pj=https://example.com/payjoin'

type SmokeStatus =
  | { kind: 'pending' }
  | { kind: 'ok'; address: string; amountSats: string; asString: string }
  | {
      kind: 'error'
      stage: 'import' | 'init' | 'pdk-call'
      message: string
      stack: string
    }

export function PayjoinSmoke() {
  const [status, setStatus] = useState<SmokeStatus>({ kind: 'pending' })

  useEffect(() => {
    let cancelled = false

    void (async () => {
      let pdk: typeof import('@xstoicunicornx/payjoin/web-vite')
      try {
        pdk = await import('@xstoicunicornx/payjoin/web-vite')
      } catch (e) {
        if (!cancelled) setStatus(toError('import', e))
        return
      }

      try {
        await pdk.uniffiInitAsync()
      } catch (e) {
        if (!cancelled) setStatus(toError('init', e))
        return
      }

      try {
        const uri = pdk.Uri.parse(FIXTURE_URI)
        const sats = uri.amountSats()
        if (!cancelled) {
          setStatus({
            kind: 'ok',
            address: uri.address(),
            amountSats: sats === undefined ? 'undefined' : sats.toString(),
            asString: uri.asString(),
          })
        }
      } catch (e) {
        if (!cancelled) setStatus(toError('pdk-call', e))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main
      style={{
        padding: 16,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 13,
        lineHeight: 1.5,
        maxWidth: 720,
        margin: '0 auto',
      }}
    >
      <h1 style={{ fontSize: 18, marginBottom: 8 }}>Payjoin Fork Smoke Test</h1>
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          columnGap: 12,
          rowGap: 4,
          marginBottom: 16,
        }}
      >
        <dt>Package</dt>
        <dd>@xstoicunicornx/payjoin@0.0.4</dd>
        <dt>Entry</dt>
        <dd>/web-vite</dd>
        <dt>Fixture</dt>
        <dd style={{ wordBreak: 'break-all' }}>{FIXTURE_URI}</dd>
      </dl>
      <h2 style={{ fontSize: 14, marginBottom: 8 }}>Result</h2>
      <pre
        style={{
          background: status.kind === 'error' ? '#3a0e0e' : '#0e2a16',
          color: '#e6e6e6',
          padding: 12,
          borderRadius: 4,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {JSON.stringify(status, null, 2)}
      </pre>
    </main>
  )
}

function toError(
  stage: 'import' | 'init' | 'pdk-call',
  e: unknown,
): SmokeStatus {
  const err = e instanceof Error ? e : new Error(String(e))
  return {
    kind: 'error',
    stage,
    message: err.message,
    stack: err.stack ?? '(no stack)',
  }
}
