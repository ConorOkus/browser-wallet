---
status: complete
priority: p2
issue_id: '152'
tags: [code-review, quality]
dependencies: []
---

# DoH TXT record parsing doesn't handle multi-segment records

## Problem Statement

DNS TXT records longer than 255 bytes are split into multiple quoted segments in DoH JSON responses (e.g., `"part1" "part2"`). The current regex `record.data.replace(/^"|"$/g, '')` only strips outer quotes, leaving internal `" "` boundaries intact. BIP 353 URIs with BOLT 12 offers can exceed 255 characters.

**File:** `src/ldk/resolve-bip353.ts` line 56

## Proposed Solutions

Handle multi-segment TXT records:

```typescript
const txt = record.data.replace(/^"|"$/g, '').replace(/" "/g, '')
```

- Effort: Small
- Risk: Low

## Acceptance Criteria

- [ ] Multi-segment TXT records are correctly concatenated
- [ ] Test added for a multi-segment TXT record
