---
status: complete
priority: p1
issue_id: '150'
tags: [code-review, security]
dependencies: []
---

# LNURL callback domain not validated against original domain

## Problem Statement

`resolveLnurlPay` validates that the callback URL starts with `https://` but does not verify the callback domain matches the original LNURL domain. A malicious LNURL server at `evil.com` can return a callback pointing to any HTTPS endpoint, enabling SSRF or payment tracking via a different domain.

**File:** `src/lnurl/resolve-lnurl.ts` lines 53-55

## Findings

- Security sentinel flagged as HIGH (SSRF via callback)
- LUD-06 spec recommends callback domain validation

## Proposed Solutions

### Option A: Validate callback hostname matches original domain (Recommended)

```typescript
function isCallbackDomainValid(callback: string, originalDomain: string): boolean {
  try {
    const callbackHost = new URL(callback).hostname
    return callbackHost === originalDomain || callbackHost.endsWith('.' + originalDomain)
  } catch {
    return false
  }
}
```

Apply check in `resolveLnurlPay` before returning metadata. Return null if invalid.

- Effort: Small
- Risk: Low (some LNURL servers may legitimately use a different callback subdomain)

## Acceptance Criteria

- [ ] Callback URL hostname is validated against the original LNURL domain
- [ ] Subdomains of the original domain are allowed
- [ ] Non-matching domains cause `resolveLnurlPay` to return null
- [ ] Test added for callback domain validation
