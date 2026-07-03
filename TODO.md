# TODO — Phase 1: Platform Foundation & Architecture Audit

## Step 1 — Repo understanding
- [x] Inspect routing, auth pages, and settings/profile pages
- [x] Inspect Google OAuth success handling

## Step 2 — Architecture audit report
- [x] Build architecture report covering:
  - [x] Authentication duplication (Signup/Register)
  - [x] Route integrity audit (ROUTES.* + navigation)
  - [x] Profile consolidation into Settings
  - [x] OAuth hardening (refresh-safe, query/hash parsing, error fallback)

## Step 3 — Refactor implementation
- [ ] Remove duplicate auth flow by unifying Signup/Register
- [x] Redirect /profile → /settings?tab=profile (and update routing)
- [ ] Ensure GoogleAuthSuccess supports refresh recovery + query/hash parsing + state validation

## Step 4 — Validation
- [ ] Verify no broken routes / orphan pages
- [ ] Run typecheck/lint/build (if available)

