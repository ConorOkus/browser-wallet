# Brainstorm: LSPS2 in Default Receive Flow

**Date:** 2026-03-31
**Status:** Draft

## What We're Building

Integrate LSPS2 JIT channel opens into the main `/receive` page so that new users (or users without sufficient inbound liquidity) can receive Lightning payments seamlessly. Today LSPS2 is a separate page under Advanced settings — we're making it the automatic fallback when standard invoices won't work.

The receive page will also adopt BIP 321 unified URIs (updated `bitcoin:` scheme) instead of the current BIP 21 format.

## Why This Approach

- **Auto-detect over manual selection**: Users shouldn't need to understand channel liquidity to receive payments. The app checks inbound capacity and picks the right path.
- **Fee transparency without friction**: The LSP opening fee is shown inline alongside the QR code, not as a blocking confirmation step. This keeps the flow fast while keeping the user informed.
- **Amount-conditional**: Zero-amount invoices work for standard path (existing inbound liquidity). LSPS2 path requires an amount since the LSP needs to calculate fees and size the channel. If LSPS2 is needed and no amount is set, prompt the user.

## Key Decisions

1. **Auto-detect liquidity**: Sum inbound capacity across all usable channels. If total inbound < requested amount (or no channels exist), use LSPS2 JIT path. Otherwise, use standard `create_invoice_from_channelmanager`.

2. **Fee shown inline**: When LSPS2 is used, display the opening fee as informational text below the QR code (e.g., "Channel open fee: X sats"). No confirmation gate.

3. **Amount required only for JIT**: Standard invoices can be zero-amount. If LSPS2 is needed and no amount entered, prompt the user to enter one before generating.

4. **BIP 321 unified URI**: Always include on-chain address + lightning invoice in a BIP 321 `bitcoin:` URI, regardless of which invoice path is used.

5. **Remove separate LSPS2 page**: Delete `Lsps2Receive.tsx` and its route — the functionality is fully absorbed into the main receive flow.

6. **Success state**: Reuse the payment-claimed detection pattern from the current `Lsps2Receive.tsx` (watch `paymentHistory` by `paymentHash`) to show a success screen on the main receive page.

## Resolved Questions

1. **Insufficient but non-zero liquidity**: Just show the opening fee inline — no need to explain the liquidity situation to the user.

2. **Error recovery**: If LSPS2 negotiation fails, fall back to showing on-chain address only. No error message or retry button.

## Open Questions

1. **BIP 321 specifics**: What are the exact URI format differences from BIP 21 that need to change? Need to verify the parameter naming and encoding rules during planning/implementation.
