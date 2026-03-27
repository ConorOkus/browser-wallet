---
status: complete
priority: p2
issue_id: '168'
tags: [code-review, performance]
dependencies: []
---

# Seed version cache from VSS recovery responses

## Problem Statement

After recovery downloads monitors and the ChannelManager from VSS, the `versionCache` and `cmVersionRef` both start at 0. The `getObject` calls during recovery already return `obj.version` but these values are discarded. The first post-recovery write for every key sends `version: 0`, triggering `CONFLICT_EXCEPTION` against the server's actual version. The conflict resolution loop self-heals, but this costs one unnecessary round trip per key (N monitors + CM + manifest).

**Files:** `src/ldk/init.ts:175-189`

## Findings

- Flagged by TypeScript reviewer, architecture strategist, and learnings researcher
- The migration path (line 452-458) correctly seeds versions to 1
- The `getObject` return type is `{ value: Uint8Array; version: number } | null` — version is already available
- docs/solutions/design-patterns/vss-dual-write-persistence explicitly notes: "Seed the version cache to 1 after migration to avoid unnecessary conflict round trips"

## Acceptance Criteria

- [ ] During recovery, capture `version` from each `getObject` response
- [ ] After creating the persister, seed `versionCache` with recovered monitor versions
- [ ] Seed `cmVersionRef.current` with the recovered ChannelManager version
- [ ] Seed `versionCache` with the manifest version
- [ ] First post-recovery write does not trigger a CONFLICT_EXCEPTION
