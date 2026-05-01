---
date: 2026-04-30
topic: payjoin-fork-smoke-test
---

# Payjoin Fork Smoke Test (`@xstoicunicornx/payjoin`)

## What We're Building

A short-lived, throwaway smoke test that proves the upstream-pending fork
of the Payjoin Dev Kit (`@xstoicunicornx/payjoin@0.0.4`, branch
`xstoicunicornx/rust-payjoin#js-web-bindings`) loads cleanly in Zinqq's
Vite + Vercel toolchain **without any of the build-time hacks** the
previous integration required (sed patches on `ubrn.config.yaml` and
`dist/index.web.js`, custom Vercel `installCommand`, vendored
submodule, brew/llvm/wasm-bindgen-cli pinning).

Output: a yes/no signal back to the fork author so they can move their
upstream PR forward. If it works, full restoration of the BIP 77 v2
sender (deleted in commit 91f9b75) becomes a separate planning effort.

## Why This Approach

Previous integration (commits 2f846d4 → 91f9b75) carried ~80 files of
build-system glue around a vendored Rust submodule. That was removed
specifically pending upstream changes to the PDK's wasm-bindgen build.
The fork advertises that those changes have landed — confirmed by
inspecting the published tarball:

- `dist/web/vite.index.js` already appends `?url` to the wasm import
  (one of our two seds, baked in).
- `--target web` output (other sed) is the default for the `/web` and
  `/web-vite` exports.
- `index_bg.wasm` ships in the npm tarball; no local Rust toolchain or
  wasm-bindgen-cli needed at install time.

A smoke test isolates the **one risky claim** (wasm loads under Vite +
Vercel with stock tooling) without re-litigating the whole sender flow.
If it fails, we iterate with the fork author cheaply. If it passes, the
follow-up restore is mostly a `git revert` + import-path swap.

## Key Decisions

- **Package**: `@xstoicunicornx/payjoin@0.0.4` pinned exact (pre-1.0,
  personal fork, not for long-term production).
- **Import path**: `import * as payjoin from '@xstoicunicornx/payjoin/web-vite'`
  — the Vite-aware entry point that handles wasm asset URL resolution.
- **Verification surface**: a dev-only route (e.g. `/__payjoin_smoke`)
  that calls `uniffiInitAsync()`, then exercises a non-trivial WASM
  symbol (e.g. parse a fixture BIP 21 URI with `pj=`) and renders
  pass/fail + version info. Not gated by feature flag — just a route
  the user navigates to.
- **Environments to verify** (all required):
  1. Local Vite dev (`pnpm dev`)
  2. Local Vite production preview (`pnpm build && pnpm preview`)
  3. Vercel preview deployment from the PR branch
  4. iOS Safari against the Vercel preview (mobile is the binding
     surface that broke first historically)
- **No proxy, no validator, no Send.tsx wiring, no CSP changes** —
  smoke test exercises only the loader + a synchronous WASM call.
  No outbound network from the WASM means no OHTTP relay or CSP
  `connect-src` additions.
- **Cleanup**: smoke route + dependency removed in the same PR that
  restores the full integration, or in a follow-up cleanup PR if the
  fork is rejected. Do not leave the dev route in main indefinitely.
- **Branch + CI**: feature branch (e.g. `payjoin-fork-smoke`), wait
  for CI to pass before merging.

## Resolved Questions

1. **Land path**: Feature branch + Vercel preview, no merge to main.
   If the fork is accepted upstream we restore the full integration
   on top of upstream `payjoin`; if rejected, the branch is deleted.
2. **WASM exercise**: Loader + a real PDK call. After
   `uniffiInitAsync()`, exercise a non-trivial symbol (e.g. construct
   a `SenderBuilder` from a fixture BIP 21 with `pj=`, or parse a
   fixture OHTTP keys blob). Loader-only doesn't catch binding /
   checksum mismatches.
3. **Version pin**: `0.0.4` exact (no caret). Personal-fork pre-1.0
   evaluation dependency — silent patch updates would defeat the
   purpose of the smoke test.

## Open Questions

None. Ready for `/ce:plan`.

## Next Steps

→ `/ce:plan` for the smoke-test implementation. Plan should be small:
  1 dependency add, 1 dev-only route component, 1 fixture, 1 manual
  test matrix (Vite dev / Vite preview / Vercel preview / iOS Safari
  on preview).
