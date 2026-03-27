---
status: complete
priority: p1
issue_id: '167'
tags: [code-review, security, fund-safety]
dependencies: []
---

# Manifest write race condition permanently breaks updates for session

## Problem Statement

`writeManifest()` is fire-and-forget: it reads `versionCache` synchronously, then fires an async `putObject`. Two rapid calls (e.g., two channel opens, or open + close) both read the same cached version before either `.then` updates it. The second write hits `CONFLICT_EXCEPTION`, which is silently swallowed by `console.warn`. Crucially, the version cache is never corrected on failure, so **every subsequent manifest write also fails** until the process restarts.

This means a single transient conflict permanently breaks manifest updates for the session. If the user then loses their device, the manifest on VSS is stale and recovery will miss channels.

**Files:** `src/ldk/traits/persist.ts:64-73`

## Findings

- Flagged by TypeScript reviewer, security sentinel, and architecture strategist
- The existing `persistWithRetry` has proper conflict resolution (re-fetch server version, retry) but `writeManifest` has none
- The VSS `putObjects` API supports atomic multi-key writes and is already used in the migration path
- docs/solutions/design-patterns/vss-dual-write-persistence recommends capping conflict retries at 5 with re-fetch

## Proposed Solutions

### Option A: Atomic manifest + monitor writes via `putObjects`

Write the monitor data and updated manifest in a single `putObjects` transaction inside `persistWithRetry`. Eliminates the race entirely.

- **Pros:** No window where monitor exists but manifest doesn't reference it; no separate conflict handling needed for manifest
- **Effort:** Medium — requires refactoring `persistWithRetry` to accept an additional key-value pair
- **Risk:** Low — `putObjects` is already used in migration

### Option B: Serialize manifest writes with a queue

Queue manifest writes so only one is in flight at a time. Each write uses the latest version from cache.

- **Pros:** Simple to reason about, keeps manifest writes decoupled from monitor writes
- **Effort:** Small
- **Risk:** Low

### Option C: Add conflict retry to `writeManifest`

Mirror the conflict resolution from `persistWithRetry`: on CONFLICT_EXCEPTION, re-fetch server version and retry (capped at 3).

- **Pros:** Minimal change, fixes the permanent-break issue
- **Effort:** Small
- **Risk:** Low — but still has a brief desync window between monitor and manifest

## Acceptance Criteria

- [ ] Two rapid channel opens do not cause the manifest to permanently stop updating
- [ ] After a manifest version conflict, the version cache is corrected and subsequent writes succeed
- [ ] The manifest always reflects all active monitor keys (eventually, within one write cycle)
