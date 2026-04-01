---
title: 'Remove BOLT 12 offer (lno=) from unified BIP 321 URI'
category: logic-errors
date: 2026-04-01
tags:
  - bolt12
  - bip321
  - qr-code
  - receive
  - uri-builder
components:
  - src/pages/Receive.tsx
  - src/onchain/bip321.ts
severity: low
related_prs:
  - '#75'
---

## Problem

The unified BIP 321 URI on the receive screen's primary QR code included an `lno=` parameter containing the BOLT 12 offer alongside the on-chain address, amount, and Lightning invoice. This was wrong because:

1. The BOLT 12 offer already has its own dedicated QR on pager page 2 — including it in the unified URI was redundant
2. BOLT 12 offer strings are long, and `&lno=<offer>` massively bloated the QR code, degrading scannability
3. A one-time payment request (with a specific amount and invoice) should not contain a reusable offer

## Root Cause

When the swipeable QR pager feature was introduced, the `lno` parameter was added to both URI construction sites: the unified QR (page 1) and the standalone BOLT 12 QR (page 2). It should only have been on page 2. The condition `lno: showBolt12 ? bolt12Offer : null` guarded it by feature flag but still placed it in the wrong URI.

## Solution

Removed the `lno` parameter from the `buildBip321Uri()` call for the unified QR in `src/pages/Receive.tsx`.

**Before:**

```typescript
const bip321Uri = address
  ? buildBip321Uri({
      address,
      amountSats: confirmedAmountSats,
      invoice,
      lno: showBolt12 ? bolt12Offer : null,
    })
  : ''
```

**After:**

```typescript
// Build BIP 321 URIs — lno lives on its own pager page, not in the unified URI
const bip321Uri = address
  ? buildBip321Uri({
      address,
      amountSats: confirmedAmountSats,
      invoice,
    })
  : ''
```

The standalone BOLT 12 URI on pager page 2 is unchanged:

```typescript
const bolt12Uri = bolt12Offer ? buildBip321Uri({ lno: bolt12Offer }) : ''
```

## Prevention

**Each payment format should have exactly one canonical representation in the UI.** A format that has a dedicated pager page (BOLT 12) must not also appear as a parameter inside a different page's URI. When adding a new payment type to a pager-style UI, verify that each data field appears on exactly one page.

A stronger enforcement would be a narrower type at the call site:

```typescript
function buildUnifiedUri(opts: Omit<BuildBip321Options, 'lno'>): string
```

This makes it a type error to pass `lno` to the unified surface.

## Test Recommendations

- Assert the unified URI never contains `lno=` when `bolt12Offer` is non-null
- Assert the standalone `bolt12Uri` contains only `lno=` and no `address`, `lightning=`, or `amount=`
- Assert `copyValue` switches correctly between unified and bolt12 URIs based on `activeQrPage`

## Related Documentation

- [BOLT 12 offer receive pager](../ui-bugs/bolt12-offer-receive-pager.md) — the pager feature where `lno` was originally added to the unified URI
- [BIP 321 unified URI + BOLT 11 invoice generation](../integration-issues/bip321-unified-uri-bolt11-invoice-generation.md) — canonical reference for the unified URI format
- [BOLT 12 offer creation missing paths](../integration-issues/bolt12-offer-creation-missing-paths.md) — explains how `bolt12Offer` state is populated
