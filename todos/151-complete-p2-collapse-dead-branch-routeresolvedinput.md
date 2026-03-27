---
status: complete
priority: p2
issue_id: '151'
tags: [code-review, quality]
dependencies: []
---

# Dead branch in routeResolvedInput — identical if/else

## Problem Statement

In `routeResolvedInput` (Send.tsx lines 222-229), both branches of `if (parsed.amountSats !== null)` do the exact same thing. This is leftover from a refactor and is misleading.

**File:** `src/pages/Send.tsx` lines 222-229

## Proposed Solutions

Collapse to a single `setSendStep` call:

```typescript
if (parsed.type === 'onchain') {
  setSendStep({ step: 'amount', parsedInput: parsed, rawInput: label })
  return
}
```

- Effort: Small
- Risk: None

## Acceptance Criteria

- [ ] Identical if/else branches collapsed into single statement
- [ ] Misleading comment removed
