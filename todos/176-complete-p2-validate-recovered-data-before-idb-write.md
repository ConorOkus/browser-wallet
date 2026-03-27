---
status: complete
priority: p2
issue_id: '176'
tags: [code-review, security, fund-safety]
dependencies: []
---

# Validate recovered VSS data before writing to IDB

## Problem Statement

Monitor and ChannelManager blobs downloaded from VSS during recovery are written directly to IDB without integrity validation. If VSS returns corrupted data (server bug, storage corruption, truncated response), recovery writes garbage to IDB. Deserialization at startup then fails, and since IDB is now populated, the recovery path won't trigger again — the user is stuck until they manually clear browser data.

**Files:** `src/ldk/init.ts:184-196`

## Findings

- Flagged by security sentinel (PR #38 review)
- The VSS client decrypts data (ChaCha20-Poly1305), but decryption success does not guarantee valid LDK serialization
- The deserialization functions (`Result_C2Tuple_ThirtyTwoBytesChannelMonitorZDecodeErrorZ_OK`) are already used later in init.ts for normal startup
- The existing rollback logic would cleanly handle a deserialization failure if it were checked during recovery

## Proposed Solutions

### Option A: Deserialize each monitor before writing to IDB

Attempt `ChannelMonitor.read()` on each downloaded blob before `idbPut`. If deserialization fails, throw to trigger rollback.

- **Pros:** Prevents IDB pollution from corrupt VSS data entirely
- **Effort:** Medium — needs access to deserialization utilities during recovery
- **Risk:** Low — rollback already handles failures

### Option B: Write a "recovery pending" flag to IDB

Set a flag before recovery, clear it after success. On next startup, if the flag exists, wipe IDB and retry recovery.

- **Pros:** Simpler, handles any corruption scenario including partial writes
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] Corrupt monitor data from VSS does not persist to IDB
- [ ] Corrupt ChannelManager data from VSS does not persist to IDB
- [ ] After a failed recovery due to corrupt data, the app can start fresh on next attempt
