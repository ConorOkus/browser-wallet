---
status: pending
priority: p3
issue_id: '183'
tags: [code-review, security]
dependencies: []
---

# Add Content-Security-Policy header to vercel.json

## Problem Statement

`vercel.json` sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Strict-Transport-Security` but has no `Content-Security-Policy` header. With the VSS proxy now routing through same-origin, the `connect-src` surface is fully enumerable for the first time.

**Files:** `vercel.json`

## Findings

- Flagged by security sentinel (PR #46 review)
- Pre-existing gap, not introduced by this PR
- Without `connect-src`, a hypothetical XSS could make requests to any origin including `/__vss_proxy/*`
- The proxy makes `'self'` a meaningful `connect-src` anchor
- LNURL proxy is dev-only (returns direct URL in production), so doesn't affect production CSP

## Proposed Solutions

### Option A: Add CSP to vercel.json headers

A reasonable production CSP:

```
connect-src 'self' wss://p.mutinynet.com wss://ln-ws-proxy-dev.conor-okus.workers.dev https://mutinynet.com https://rgs.mutinynet.com
```

- **Pros:** Defense-in-depth against XSS-to-data-exfiltration
- **Cons:** Must be kept in sync with service URLs; incorrect CSP breaks functionality
- **Effort:** Small
- **Risk:** Medium (wrong CSP breaks the app)
