---
status: complete
priority: p1
issue_id: '166'
tags: [code-review, security, fund-safety]
dependencies: []
---

# Partial VSS recovery leaves IDB in unrecoverable state

## Problem Statement

If VSS recovery fails midway (e.g., 2 of 3 monitors are downloaded but the ChannelManager fetch throws), the `catch` block logs a warning and continues with "fresh state." But IDB now contains orphaned monitors with no ChannelManager. The existing safety guard at `init.ts:278-284` then throws a fatal error, blocking startup entirely. The user is stuck — they can't start the app without manually clearing browser data.

Additionally, if some monitors fail to download (the `if (obj)` check silently skips nulls) but the ChannelManager succeeds, we get a CM restored with incomplete monitors. LDK won't know about skipped channels, potentially missing force-close deadlines.

**Files:** `src/ldk/init.ts:174-193`

## Findings

- Flagged by TypeScript reviewer, security sentinel, and architecture strategist
- The try/catch on line 191 catches all errors but does not clean up partial IDB writes
- The `if (obj)` guard on line 182 silently skips missing monitors instead of treating them as errors
- Known pattern: docs/solutions/design-patterns/vss-dual-write-persistence notes that state-generating operations must be persisted atomically

## Proposed Solutions

### Option A: Clean up IDB on recovery failure

On catch, delete any monitors written during the recovery attempt before falling through to fresh state.

- **Pros:** Simple, restores the "empty IDB = fresh start" invariant
- **Effort:** Small
- **Risk:** Low

### Option B: Treat missing monitors as fatal recovery errors

If any monitor listed in the manifest returns null from `getObject`, abort the entire recovery and clean up.

- **Pros:** Prevents incomplete state, surfaces the real problem
- **Effort:** Small
- **Risk:** Low — falls back to fresh state after cleanup

### Option C: Both A and B combined (recommended)

Track which keys were written during recovery. On any failure (network error or missing monitor), delete all written keys and fall back to fresh state.

- **Pros:** Comprehensive, handles both failure modes
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] If recovery fails partway, all partially-written IDB entries are cleaned up
- [ ] A missing monitor (manifest says it exists but `getObject` returns null) aborts recovery
- [ ] After a failed recovery, the app starts fresh with no monitors and no CM in IDB
- [ ] The existing "orphaned monitors" safety guard is never triggered by recovery failures
