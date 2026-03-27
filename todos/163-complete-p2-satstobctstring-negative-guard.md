---
status: complete
priority: p2
issue_id: '163'
tags: [code-review, security, quality]
dependencies: []
---

# satsToBtcString should reject negative input

## Problem Statement

`satsToBtcString` in `src/onchain/bip21.ts` produces malformed output for negative bigints. `(-1n % 100_000_000n)` yields `"-1"` in JavaScript, producing `"0.-0000001"` — an invalid BIP 21 amount string. The function is a public export and could be called from contexts beyond the numpad.

**File:** `src/onchain/bip21.ts` lines 18-22

## Findings

- Flagged by TypeScript reviewer, security sentinel, and architecture strategist
- Current UI path is safe (numpad only emits non-negative digits)
- But `satsToBtcString` is exported and could be misused

## Acceptance Criteria

- [ ] `satsToBtcString` throws `RangeError` for negative input
- [ ] Add test case for negative input
