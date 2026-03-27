---
status: complete
priority: p2
issue_id: '158'
tags: [code-review, quality]
dependencies: []
---

# fetchAndRouteInvoice has no abort controller when called from amount step

## Problem Statement

`fetchAndRouteInvoice` reads `resolveAbortRef.current` which may be `null` when called from `handleAmountNext` (if the user navigated to the amount screen without the ref being set). The fetch has no abort signal and cannot be cancelled by the user.

**File:** `src/pages/Send.tsx` lines 244-248

## Proposed Solutions

Create a fresh AbortController inside `fetchAndRouteInvoice` and assign it to `resolveAbortRef.current`:

```typescript
const controller = new AbortController()
resolveAbortRef.current = controller
```

- Effort: Small
- Risk: None

## Acceptance Criteria

- [ ] fetchAndRouteInvoice always has a valid AbortController
- [ ] User can cancel the invoice fetch from the amount screen
