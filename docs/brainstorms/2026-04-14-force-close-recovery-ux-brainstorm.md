# Force Close Recovery UX Brainstorm

**Date:** 2026-04-14
**Status:** Draft

## What We're Building

A recovery UX flow for when a Lightning channel force closes and the automated fee bump (anchor CPFP) fails due to insufficient on-chain funds. This primarily affects Lightning-only users who receive via LSPS2 JIT channels and have no on-chain UTXOs.

### The Problem

1. User receives Lightning payments via LSPS2 JIT channels — they never interact with on-chain bitcoin
2. A channel force closes (counterparty-initiated, connectivity issue, etc.)
3. The app attempts to CPFP the commitment transaction using the anchor reserve
4. The fee bump fails because there are no on-chain UTXOs (or insufficient UTXOs) to fund the CPFP
5. The LSP may not bump on their side either — cannot be relied on
6. **User experience: balance disappears with no explanation**

### Target User

Non-technical users who don't understand channels, UTXOs, or fee bumping. They just want their money back.

## Why This Approach

### Recovery UX now, splicing later

We evaluated three approaches:

1. **Automated submarine swap** — swap Lightning sats to on-chain to maintain a reserve. Works but adds third-party dependency (Boltz), swap fees, and significant implementation complexity.
2. **LSP-facilitated reserve** — have the LSP include an on-chain output during channel open. Requires non-standard LSPS2 extensions and LSP cooperation that can't be guaranteed.
3. **Recovery UX (chosen)** — accept that force closes are rare, and invest in a clear recovery flow when they happen. Lowest complexity, no ongoing fees, no third-party dependencies.

**Prevention is hard for Lightning-only users** because they have no on-chain bitcoin to begin with. Asking them to acquire on-chain BTC is itself a major friction point. The current `ANCHOR_RESERVE_SATS = 10,000` only prevents spending below that threshold — it doesn't create the reserve for users who never had on-chain funds.

**Acknowledged trade-off:** The recovery flow still asks users to deposit on-chain bitcoin — the same action we rejected for proactive prevention. This is acceptable because it only happens during a rare emergency (force close + failed fee bump), not as a routine requirement. A one-time deposit to recover stuck funds is a fundamentally different ask than "always keep on-chain funds around just in case."

**Future prevention: splicing.** Once LDK supports splicing, the app can splice out a small amount from the Lightning channel to on-chain to maintain the anchor reserve. This is trustless, has no third-party dependency, and is native to the channel. This is the long-term solution.

## Key Decisions

### 1. Detection and visibility

- **Persistent non-dismissible banner** on the home screen when funds are stuck in a failed force close sweep
- Banner appears when: a force close is detected AND the fee bump fails due to insufficient funds
- Banner disappears when: funds are successfully recovered

### 2. Messaging tone

- **Calm and reassuring** — minimize alarm, build trust
- Example: "Your funds are safe but need a small deposit to unlock. Here's what to do."
- Avoid technical jargon (no "UTXO", "anchor", "CPFP", "commitment transaction")
- Clearly state the amount stuck and the small amount needed to recover

### 3. Recovery flow

- Banner taps through to a recovery screen
- Recovery screen shows:
  - How much is stuck (the channel balance)
  - How much needs to be deposited (estimated fee bump cost)
  - A bitcoin deposit address (QR code + copy)
  - Simple explanation of what's happening
- Once deposit is detected, **fully automatic** fee bump and sweep — no manual confirmation needed
- Banner clears and success message shown when funds are recovered

### UI Mockups

**Home screen with recovery banner:**

```
┌─────────────────────────────┐
│                    [~] [↻]  │
│                             │
│                             │
│        120,000 sats  👁     │
│     + 50,000 pending        │
│                             │
│ ┌─────────────────────────┐ │
│ │ ⚠ Your funds are safe   │ │
│ │ but need help to unlock. │ │
│ │ Tap to recover →         │ │
│ └─────────────────────────┘ │
│                             │
│  ┌───────────┐ ┌──────────┐ │
│  │  ↑ Send   │ │ Request ↓│ │
│  └───────────┘ └──────────┘ │
│                             │
│  [home]  [txns]  [settings] │
└─────────────────────────────┘
```

**Recovery detail screen:**

```
┌─────────────────────────────┐
│  ← Back                     │
│                             │
│      Recover Your Funds     │
│                             │
│  Your payment channel closed │
│  unexpectedly. Your funds   │
│  are safe — a small deposit │
│  is needed to move them     │
│  back to your wallet.       │
│                             │
│  ┌─────────────────────────┐│
│  │ Stuck balance           ││
│  │          120,000 sats   ││
│  ├─────────────────────────┤│
│  │ Deposit needed          ││
│  │           25,000 sats   ││
│  └─────────────────────────┘│
│                             │
│       ┌─────────────┐       │
│       │  ▓▓▓▓▓▓▓▓▓  │       │
│       │  ▓ QR CODE▓  │       │
│       │  ▓▓▓▓▓▓▓▓▓  │       │
│       └─────────────┘       │
│                             │
│   bc1q...xyz     [Copy]     │
│                             │
│  After recovery, funds will │
│  be available in ~14 days.  │
│                             │
│  [home]  [txns]  [settings] │
└─────────────────────────────┘
```

**Success state (after auto-recovery):**

```
┌─────────────────────────────┐
│                    [~] [↻]  │
│                             │
│                             │
│        145,000 sats  👁     │
│                             │
│ ┌─────────────────────────┐ │
│ │ ✓ Funds recovered!      │ │
│ │ Available in ~14 days.  │ │
│ │              [Dismiss]  │ │
│ └─────────────────────────┘ │
│                             │
│  ┌───────────┐ ┌──────────┐ │
│  │  ↑ Send   │ │ Request ↓│ │
│  └───────────┘ └──────────┘ │
│                             │
│  [home]  [txns]  [settings] │
└─────────────────────────────┘
```

### 4. Design notes

- **[P2] Balance text scaling** — The home screen balance (e.g. ₿100,000,000) currently overflows to two lines at high amounts. The font size clamp and `word-break: break-all` need adjustment so large balances always fit on one line. This is a pre-existing issue but matters here because the recovery banner sits below the balance — a two-line balance pushes the banner and action buttons further down.
- **Design prototype** — Recovery banner, recovery screen, and success banner are implemented in `design/index.html`, `design/styles.css`, and `design/app.js`. Navigate to `#recover` to preview the recovery detail screen.

### 5. Technical implementation notes

- Detect failed fee bumps via `BumpTransactionEventHandler` failures or insufficient UTXO detection
- Persist the "needs recovery" state so it survives app restarts
- On-chain wallet sync should detect new deposits and automatically retry the fee bump
- The sweep logic in `Event_SpendableOutputs` + startup sweep should handle the actual recovery once funds are available

## Resolved Questions

1. **Deposit amount display** — Use a comfortable round number displayed in sats per BIP 177 (e.g. "25,000 sats"). Avoid confusing precision; give a buffer for fee fluctuations.
2. **Fee changes after deposit** — Update the recovery screen dynamically on each wallet sync. If fees rise and the deposit is no longer sufficient, show the updated amount needed rather than silently failing. Keep this simple — recalculate on sync, not a real-time ticker.
3. **Timelock awareness** — Yes, mention the timelock upfront on the recovery screen: "After recovery, your funds will be available in approximately X days." Set expectations early.
4. **State storage** — Persist the recovery state in VSS so it's visible across devices, not just IDB.

## Future Enhancements

- **Splicing for prevention** — once LDK supports splicing, automatically maintain an anchor reserve by splicing out small amounts from Lightning channels
- **Dynamic anchor reserve** — adjust the reserve target based on current fee market conditions
- **LSP coordination** — work with LSPs to ensure they reliably CPFP force close transactions on their side
