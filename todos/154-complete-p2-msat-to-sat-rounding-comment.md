---
status: complete
priority: p2
issue_id: '154'
tags: [code-review, quality]
dependencies: []
---

# Inconsistent msat-to-sat rounding needs documentation

## Problem Statement

In Send.tsx lines 192-193, `minSat` uses `msatToSat` (ceiling division) while `maxSat` uses plain division (floor). This asymmetry is intentionally correct (round min up to ensure enough sats, round max down to stay within bounds), but the inconsistency looks like a bug to readers. Additionally, `msatToSat` is defined locally in Send.tsx while `src/utils/msat.ts` already has `msatToSatFloor`.

**File:** `src/pages/Send.tsx` lines 83-85 and 192-193

## Proposed Solutions

1. Add `msatToSatCeil` to `src/utils/msat.ts` and import it in Send.tsx
2. Add a brief comment explaining the intentional asymmetry at lines 192-193

- Effort: Small
- Risk: None

## Acceptance Criteria

- [ ] `msatToSatCeil` added to `src/utils/msat.ts`
- [ ] Comment explains intentional rounding asymmetry on min/max
