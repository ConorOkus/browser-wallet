---
status: complete
priority: p2
issue_id: '169'
tags: [code-review, security]
dependencies: []
---

# Validate manifest contents during VSS recovery

## Problem Statement

The recovery path parses the manifest with `JSON.parse` and casts with `as string[]` — a compile-time assertion with zero runtime safety. If the manifest is corrupted or tampered with, arbitrary strings are used as IDB keys and VSS lookup keys. There is no format validation, length bound, or deduplication.

**Files:** `src/ldk/init.ts:178`

## Findings

- Flagged by TypeScript reviewer and security sentinel
- Monitor keys should match the pattern `[64-hex-chars]:[integer]` (funding outpoint)
- While VSS values are encrypted (ChaCha20-Poly1305), the decrypted manifest is trusted completely
- A corrupted manifest could cause unbounded VSS requests or write garbage to IDB

## Acceptance Criteria

- [ ] Runtime type guard: verify parsed JSON is an array of strings
- [ ] Format validation: each key matches `/^[0-9a-f]{64}:\d+$/`
- [ ] Length cap: reject manifests with more than a reasonable max (e.g., 100 entries)
- [ ] Invalid entries are logged and skipped (or abort recovery entirely)
