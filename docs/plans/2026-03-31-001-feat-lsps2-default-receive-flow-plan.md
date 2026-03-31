---
title: "feat: Integrate LSPS2 JIT receive into default request flow"
type: feat
status: completed
date: 2026-03-31
origin: docs/brainstorms/2026-03-31-lsps2-default-receive-brainstorm.md
---

# feat: Integrate LSPS2 JIT receive into default request flow

## Overview

Merge the standalone LSPS2 JIT receive page into the main `/receive` page so that Lightning receive "just works" for all users. The page auto-detects inbound liquidity and transparently falls back to LSPS2 JIT channel opens when needed. The separate `Lsps2Receive.tsx` page is removed.

## Problem Statement / Motivation

New users with no Lightning channels cannot receive via Lightning on the current `/receive` page -- it silently generates an unpayable invoice. The LSPS2 JIT receive flow exists but is buried under Settings > Advanced, requiring users to understand channel liquidity to find it. This creates a broken first-time receive experience.

## Proposed Solution

A single `/receive` page that:

1. **Auto-detects** whether the user has sufficient inbound capacity for the requested amount
2. **Uses standard `createInvoice()`** when inbound capacity is sufficient
3. **Falls back to `requestJitInvoice()`** when capacity is insufficient or no channels exist
4. **Shows the opening fee inline** below the QR when JIT is used (no confirmation gate)
5. **Requires an amount** only when the JIT path is needed (standard invoices support zero-amount)
6. **Falls back to on-chain only** if LSPS2 negotiation fails
7. **Detects payment success** and shows a success screen for both paths
8. **Builds a BIP 321 URI** with on-chain + lightning in all cases (already compliant -- rename only)

## Technical Considerations

### Inbound Capacity Detection

Sum `get_inbound_capacity_msat()` across channels where `get_is_usable() === true`. LDK's reported inbound capacity already accounts for channel reserves, so no additional margin is needed.

Compute inline in `Receive.tsx` using `ldk.listChannels()` -- no need to add a new context field. Recompute when `channelChangeCounter` increments.

### Peer Reconnection Timing

Before `peersReconnected === true`, channels may exist but not be usable yet. To avoid routing returning users to JIT unnecessarily:
- If `peersReconnected` is false but channels exist (from `listChannels()`), show a brief "Reconnecting..." state
- Proceed with current state after 5 seconds

### State Machine

The merged page needs a clear state type combining both current pages:

```typescript
type ReceiveState =
  | { step: 'loading' }                    // wallet loading or peers reconnecting
  | { step: 'ready'; invoicePath: 'none' | 'standard' | 'jit' }
  | { step: 'negotiating-jit' }            // LSPS2 negotiation in progress
  | { step: 'jit-failed' }                 // on-chain fallback only
  | { step: 'success'; amountSats: bigint } // payment received
```

The `editingAmount` boolean overlay operates independently of these states (same as today).

### Invoice Path Decision Logic

```
On mount or amount change:
  1. Compute totalInboundMsat = sum of get_inbound_capacity_msat() for usable channels
  2. If no amount entered:
     a. If totalInboundMsat > 0: generate zero-amount standard invoice
     b. If no usable channels: show on-chain only (no Lightning invoice)
  3. If amount entered:
     a. If totalInboundMsat >= amountMsat: generate standard invoice (sync)
     b. Else: initiate requestJitInvoice (async, show negotiating state)
```

### Success Detection

Both paths need paymentHash tracking:
- **JIT path**: `requestJitInvoice` already returns `paymentHash`
- **Standard path**: Parse paymentHash from the returned BOLT11 string, or modify `createInvoice()` to return `{ bolt11, paymentHash }` -- the latter is cleaner

Watch `paymentHistory` for a matching inbound payment with `status === 'succeeded'`.

### BIP 321 URI

The existing `buildBip21Uri()` already produces BIP 321 compliant URIs (`bitcoin:<address>?amount=<btc>&lightning=<bolt11>`). BIP 321 formally standardizes the `lightning=` parameter that BIP 21 implementations already support. Changes needed:
- Rename function/file from `bip21` to `bip321` for accuracy
- Update comments and variable names

### Amount Editing Across Boundaries

When the user edits the amount and crosses the standard/JIT threshold:
- Clear the current invoice immediately (don't show stale data)
- If crossing from standard to JIT: start async negotiation, show spinner
- If crossing from JIT to standard: cancel in-flight negotiation via stale flag, generate sync invoice
- Use `processingRef` pattern (from `Lsps2Receive.tsx`) to guard against concurrent JIT requests

## System-Wide Impact

- **Routing**: Remove `/settings/advanced/lsps2-receive` route, remove link from `Advanced.tsx`
- **Context API**: Modify `createInvoice()` return type from `string` to `{ bolt11: string, paymentHash: string }` -- update all call sites
- **File deletion**: `src/pages/Lsps2Receive.tsx` removed entirely
- **No new dependencies**: All building blocks exist

## Acceptance Criteria

- [x] `/receive` auto-detects inbound capacity and uses JIT when needed
- [x] Zero-amount standard invoices work when user has inbound capacity
- [x] User is prompted for amount when JIT is needed and no amount set (on-chain QR shown with "Add amount" button)
- [x] Opening fee displayed inline below QR when JIT path is used
- [x] "Setting up Lightning receive..." shown during JIT negotiation
- [x] On LSPS2 failure, page falls back to on-chain address only (no Lightning in URI)
- [x] BIP 321 URI includes on-chain address + lightning invoice in all success cases
- [x] Success screen shown when payment received (both standard and JIT paths)
- [x] `Lsps2Receive.tsx` deleted, route and Advanced settings link removed
- [x] `buildBip21Uri` renamed to `buildBip321Uri` with updated references
- [x] Peers reconnecting state handled -- brief loading before generating invoice for returning users
- [x] Amount editing works across standard/JIT boundary without stale invoices

## Success Metrics

- New users can receive Lightning payment from `/receive` without visiting Advanced settings
- No regression for users with existing channels (standard invoice path unchanged)
- JIT opening fee is visible before sender pays

## Dependencies & Risks

- **LSP availability**: JIT path depends on LSP being reachable. Mitigated by on-chain fallback.
- **`createInvoice()` return type change**: Breaking change to context API. All call sites must be updated. Low risk -- only used in `Receive.tsx` currently.
- **Race conditions on amount edit**: The stale flag + processingRef pattern from `Lsps2Receive.tsx` handles this, but needs careful porting.

## Sources & References

- **Origin brainstorm:** [docs/brainstorms/2026-03-31-lsps2-default-receive-brainstorm.md](docs/brainstorms/2026-03-31-lsps2-default-receive-brainstorm.md) -- Key decisions: auto-detect liquidity, fee inline, amount-only-for-JIT, on-chain fallback on failure, remove separate page
- **BIP 321 spec:** https://github.com/bitcoin/bips/blob/master/bip-0321.mediawiki -- confirms `lightning=` parameter is standard; existing `buildBip21Uri` is already compliant
- **Existing LSPS2 implementation:** `src/ldk/lsps2/` (client, types, message-handler, bolt11-encoder)
- **Current receive page:** `src/pages/Receive.tsx`
- **Current JIT receive page:** `src/pages/Lsps2Receive.tsx` (to be merged and deleted)
- **LDK context:** `src/ldk/context.tsx:194-292` (createInvoice, requestJitInvoice)
- **URI builder:** `src/onchain/bip21.ts` (to be renamed)
- **Institutional learning:** `docs/solutions/design-patterns/react-send-flow-amount-first-state-machine.md` -- discriminated union state machine pattern, processingRef for async guards
- **Institutional learning:** `docs/solutions/ui-bugs/channel-state-ui-update-10s-delay.md` -- channel state change reactivity pattern
