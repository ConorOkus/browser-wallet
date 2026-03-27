---
status: complete
priority: p2
issue_id: '153'
tags: [code-review, quality, dead-code]
dependencies: []
---

# sendBip353Payment is now dead code

## Problem Statement

The `sendBip353Payment` function in `src/ldk/context.tsx` (line 310) and its type in `src/ldk/ldk-context.ts` (line 36) call `pay_for_offer_from_human_readable_name()` with an empty resolvers array. This bLIP 32 path has been replaced by the DoH resolution approach — resolved offers now go through `sendBolt12Payment`. The `bip353` case was removed from `handleLnConfirm` in Send.tsx.

**Files:** `src/ldk/context.tsx` line 310, `src/ldk/ldk-context.ts` line 36

## Proposed Solutions

Remove `sendBip353Payment` from context and type definitions. Update test mocks. Add a comment about future bLIP 32 support if desired.

- Effort: Small
- Risk: Low

## Acceptance Criteria

- [ ] `sendBip353Payment` removed from LdkContextValue type
- [ ] `sendBip353Payment` callback removed from context provider
- [ ] Test mocks updated
