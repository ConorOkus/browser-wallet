---
title: "BDK-signed PSBT fails @scure/btc-signer finalize() — already finalized by BDK"
category: integration-issues
severity: high
date: 2026-03-15
tags:
  - bdk
  - ldk
  - psbt
  - scure
  - channel-funding
  - transaction-signing
module: src/onchain/tx-bridge
symptoms:
  - "@scure/btc-signer finalize() throws 'Not enough partial sign'"
  - "FundingGenerationReady event handler fails to build funding tx"
  - "Channel open succeeds (create_channel returns ok) but funding tx never broadcasts"
  - "Error only appears in console — UI shows success"
---

# BDK-signed PSBT Fails @scure/btc-signer finalize()

## Problem

After `channelManager.create_channel()` succeeds, the `FundingGenerationReady` event handler builds a funding transaction using BDK, signs it, then passes the PSBT to `@scure/btc-signer` for raw byte extraction. The `tx.finalize()` call throws:

```
Error: Not enough partial sign
    at _Transaction.finalizeIdx (@scure/btc-signer)
    at _Transaction.finalize
    at extractTxBytes (tx-bridge.ts:13)
    at handleEvent (event-handler.ts:232)
```

The channel creation appears to succeed from the UI perspective (the `create_channel()` call returns ok), but the funding transaction is never built or broadcast. The channel silently times out.

## Root Cause

BDK's `Wallet.sign(psbt, SignOptions)` both signs **and finalizes** the PSBT inputs. After BDK signing, the PSBT contains `PSBT_IN_FINAL_SCRIPTWITNESS` (finalized witness data) but no `PSBT_IN_PARTIAL_SIG` entries — BDK consumes partial signatures during finalization per BIP174.

`@scure/btc-signer`'s `finalize()` expects to find `partialSig` entries to construct the witness. Finding none, it throws "Not enough partial sign." The PSBT is actually fully signed and ready to extract — it just doesn't need finalization.

This was a latent bug in the tx-bridge module. The unit tests passed because they used `@scure/btc-signer` to both sign and finalize (same library, compatible format). The real BDK-signed PSBTs were never tested because channel opening wasn't implemented until now.

## Solution

Try `extract()` first (for already-finalized PSBTs from BDK), fall back to `finalize()` + `extract()` for PSBTs with only partial signatures:

```typescript
// src/onchain/tx-bridge.ts
export function extractTxBytes(psbtBase64: string): Uint8Array {
  const psbtBytes = base64ToBytes(psbtBase64)
  const tx = Transaction.fromPSBT(psbtBytes)
  try {
    return tx.extract()
  } catch {
    tx.finalize()
    return tx.extract()
  }
}
```

This handles both cases:
- **BDK-signed PSBTs**: Already finalized → `extract()` succeeds immediately
- **Partially-signed PSBTs**: `extract()` fails → `finalize()` completes signing → `extract()` succeeds

## Prevention Strategies

### Test with real producer libraries

Unit tests for cross-library bridges should use PSBTs produced by the actual signing library (BDK), not just the consuming library (@scure/btc-signer). A PSBT signed by library A may have different internal structure than one signed by library B, even if both are BIP174-compliant.

### Don't assume PSBT state

PSBT processing should not assume whether inputs are partially signed or fully finalized. Check capabilities rather than asserting a specific state. The try/extract/catch/finalize pattern handles both cases gracefully.

### Log intermediate states in fund-critical paths

The original error was caught and logged by the event handler, but the UI had no visibility. For fund-critical operations, consider logging the PSBT state (has partial sigs? has final witness?) before processing to aid debugging.

## Related Documentation

- [BDK-LDK Cross-WASM Transaction Bridge](./bdk-ldk-cross-wasm-transaction-bridge.md) — Original tx-bridge design, documents the two-phase funding flow
- [LDK Event Handler Patterns](./ldk-event-handler-patterns.md) — Sync/async bridging where the FundingGenerationReady handler runs
- Upstream: [bitcoindevkit/bdk-wasm#38](https://github.com/bitcoindevkit/bdk-wasm/issues/38) — When resolved, this entire tx-bridge module can be removed
- PR: [#16](https://github.com/ConorOkus/browser-wallet/pull/16)
