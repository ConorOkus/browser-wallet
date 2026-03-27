---
status: complete
priority: p2
issue_id: '177'
tags: [code-review, testing]
dependencies: []
---

# Add unit tests for parseMonitorManifest and backfillManifest

## Problem Statement

`parseMonitorManifest` is a pure exported function guarding fund-critical recovery with zero test coverage. `backfillManifest` is a new public API surface on the persister, also untested. Both have well-defined edge cases that should be exercised.

**Files:** `src/ldk/traits/persist.ts`, `src/ldk/traits/persist.test.ts`

## Findings

- Flagged by TypeScript reviewer, architecture strategist, and security sentinel (PR #38 review)
- `parseMonitorManifest` is a pure function — trivial to test
- Edge cases: valid input, non-array, empty array, oversized array, invalid key format, duplicates
- `backfillManifest`: no-op when manifest version cached, fires writeManifest when not cached, no-op when monitorKeys empty

## Acceptance Criteria

- [ ] Test: valid manifest parses correctly
- [ ] Test: non-array input throws
- [ ] Test: empty array throws
- [ ] Test: array exceeding MAX_MANIFEST_ENTRIES throws
- [ ] Test: invalid key format throws
- [ ] Test: duplicate entries are deduplicated
- [ ] Test: backfillManifest calls writeManifest when appropriate
- [ ] Test: backfillManifest is no-op when manifest version is cached
