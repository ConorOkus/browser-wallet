---
status: complete
priority: p2
resolution: proxy-query-param-fix
issue_id: '157'
tags: [code-review, architecture]
dependencies: []
---

# No production CORS strategy for LNURL requests

## Problem Statement

In development, LNURL requests route through the Vite CORS proxy (`/__lnurl_proxy/`). In production, `proxyUrl()` returns the raw HTTPS URL. The CSP `connect-src` does not include arbitrary LNURL domains, and many LNURL servers have broken or missing CORS headers. This means **LNURL resolution will fail in production builds** for most providers.

**Files:** `src/lnurl/resolve-lnurl.ts` line 15, `index.html` line 9

## Findings

- TS reviewer flagged as CRITICAL — LNURL silently fails in production
- Architecture reviewer noted as future work item
- This is a known limitation from the original plan (Option A: try direct fetch, show error on CORS failure)

## Proposed Solutions

### Option A: Deploy Cloudflare Worker CORS proxy (Recommended)

Add LNURL proxying to the existing Cloudflare Workers proxy at `proxy/`. Route production LNURL requests through it.

- Effort: Medium
- Risk: Low — existing proxy infra

### Option B: Add `https:` to CSP connect-src

Allow connections to any HTTPS endpoint. Only works for servers that DO send CORS headers.

- Effort: Small
- Risk: Widens CSP, doesn't fix servers with broken/missing CORS

### Option C: Accept the limitation

BIP 353 is the primary path (no CORS issues). LNURL works for servers with proper CORS. Show clear error for others.

- Effort: None
- Risk: Poor UX for LNURL-only addresses

## Acceptance Criteria

- [ ] LNURL resolution works in production builds
- [ ] Addresses like refund@lnurl.mutinynet.com resolve in production
