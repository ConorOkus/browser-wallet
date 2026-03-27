---
status: complete
priority: p1
issue_id: '149'
tags: [code-review, security, payments]
dependencies: []
---

# LNURL invoice amount not validated against requested amount

## Problem Statement

When `fetchAndRouteInvoice` receives a BOLT 11 invoice from an LNURL callback, it passes the original `amountMsat` to the review screen but does not verify that the invoice's embedded amount matches. A malicious LNURL server could return an invoice for a larger amount. The review screen shows the user-requested amount, but `sendBolt11Payment` uses the invoice's embedded amount (since `parsed.amountMsat !== null`).

**File:** `src/pages/Send.tsx` lines 248-264

## Findings

- Security sentinel flagged as HIGH severity
- TypeScript reviewer noted the discrepancy between displayed and actual payment amount
- The plan itself acknowledged this as follow-up work but it is a payment safety issue

## Proposed Solutions

### Option A: Validate amount match in fetchAndRouteInvoice (Recommended)

After parsing the invoice, compare its embedded amount against the requested amount. Reject if mismatched.

```typescript
const parsed = classifyPaymentInput(invoiceStr)
if (parsed.type === 'bolt11') {
  if (parsed.amountMsat !== null && parsed.amountMsat !== amountMsat) {
    setSendStep({
      step: 'error',
      message: 'Invoice amount does not match requested amount',
      retryStep: null,
    })
    return
  }
  setSendStep({
    step: 'ln-review',
    parsed,
    amountMsat: parsed.amountMsat ?? amountMsat,
    fromStep: 'amount',
    label,
  })
}
```

- Effort: Small
- Risk: Low

### Option B: Display actual invoice amount on review screen

Use `parsed.amountMsat` instead of the requested amount on the review screen, so the user always sees what they will actually pay.

- Effort: Small
- Risk: Low, but doesn't prevent overpayment if user doesn't notice

## Acceptance Criteria

- [ ] LNURL invoice amount is compared against requested amount
- [ ] Mismatched amounts result in an error shown to the user
- [ ] Review screen shows the actual amount that will be paid
