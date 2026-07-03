# IntellMeet — Technical Debt Report
*Generated: Phase 5 Production Hardening*

---

## Priority Matrix

| Priority | Count | Description |
|----------|-------|-------------|
| 🔴 Critical | 2 | Must fix before production traffic |
| 🟠 High | 5 | Should fix before launch |
| 🟡 Medium | 7 | Fix in next sprint |
| 🟢 Low | 6 | Nice-to-have improvements |

---

## 🔴 Critical (Fix Before Production)

### TD-C1 — Task controller missing ownership check
**File:** `server/src/controllers/task.controller.js`  
**Issue:** Any authenticated user can update or delete any other user's task.  
**Fix:**
```javascript
const task = await Task.findById(req.params.id);
const isAdmin = [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(req.user.role);
if (task.createdBy.toString() !== req.user._id.toString() && !isAdmin) {
  throw ApiError.forbidden('Not authorised to modify this task');
}
```
**Effort:** 30 minutes

### TD-C2 — GET /users/ accessible to any authenticated user
**File:** `server/src/routes/user.routes.js`  
**Issue:** Any logged-in user can list all users in the system.  
**Fix:** Add `authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN)` middleware on the route.  
**Effort:** 5 minutes

---

## 🟠 High (Before Launch)

### TD-H1 — Socket.IO in-memory presence won't scale to multiple instances
**File:** `server/src/sockets/presence.socket.js`  
**Issue:** `presenceMap` is a process-local Map. With 2+ server instances, presence events won't propagate.  
**Fix:** Install `@socket.io/redis-adapter` and configure in `server.js`.  
**Effort:** 2 hours

### TD-H2 — `authorize('tenant_admin')` role doesn't exist in ROLES constants
**File:** `server/src/routes/tenant.routes.js`  
**Issue:** `authorize('tenant_admin')` will always throw forbidden since the role doesn't exist.  
**Fix:** Change to `authorize(ROLES.ADMIN)` or add `TENANT_ADMIN: 'tenant_admin'` to constants.  
**Effort:** 15 minutes

### TD-H3 — No frontend email verification page
**Issue:** Backend sends verification emails with `/verify-email/:token` link but no frontend page handles it.  
**Fix:** Add `VerifyEmail.tsx` page and register route `/verify-email/:token`.  
**Effort:** 1 hour

### TD-H4 — No frontend test suite
**Issue:** Zero frontend tests configured. No Vitest, no testing-library.  
**Fix:** Install `vitest`, `@testing-library/react`, `@testing-library/user-event`. Write tests for: AuthForm validation, ProtectedRoute redirect, Dashboard data rendering.  
**Effort:** 4-8 hours

### TD-H5 — AI processing is synchronous and blocks the response
**Issue:** `POST /ai/:meetingId/summary` waits for the full OpenAI call (~10-30s). No streaming.  
**Fix:** Return 202 Accepted immediately, process with a job queue (Bull), notify via socket when done. OR use streaming responses with `res.write()`.  
**Effort:** 1 day

---

## 🟡 Medium (Next Sprint)

### TD-M1 — `client/src/utils/constants.ts` is a stale duplicate
**File:** `client/src/utils/constants.ts`  
**Issue:** Exports `API_BASE_URL = '/api'` (missing `/v1`). Any import from this file gets the wrong URL.  
**Fix:** Delete file. Update any imports to use `client/src/constants/index.ts`.

### TD-M2 — `client/src/pages/Register.tsx` is unreferenced dead code
**Fix:** Delete the file.

### TD-M3 — Meeting `roomId` has no index
**File:** `server/src/models/Meeting.model.js`  
**Issue:** Socket events look up meetings by `roomId` frequently. No index.  
**Fix:** `meetingSchema.index({ roomId: 1 })`.

### TD-M4 — Task model has no `tenantId` field
**File:** `server/src/models/Task.model.js`  
**Issue:** Tasks are not scoped to a tenant, creating potential cross-tenant data exposure.  
**Fix:** Add `tenantId: { type: ObjectId, ref: 'Tenant', required: true, index: true }` + migration.

### TD-M5 — No Analytics API — Analytics page uses no real data
**File:** `client/src/pages/Analytics.tsx`  
**Issue:** Charts show no meaningful data. No backend analytics aggregation endpoint.  
**Fix:** Add `GET /api/v1/analytics` with MongoDB aggregation pipeline for meeting counts, participant stats, task completion rates.

### TD-M6 — Profile and Settings pages not wired to API
**Files:** `client/src/pages/Profile.tsx`, `client/src/pages/Settings.tsx`  
**Issue:** Profile updates and password changes don't call the API.  
**Fix:** Wire to `PUT /users/me` and `POST /auth/change-password`.

### TD-M7 — WebRTC uses STUN only — no TURN server
**File:** `client/src/utils/webrtc.ts`  
**Issue:** STUN only works for direct P2P. Behind symmetric NAT, connections fail.  
**Fix:** Add a TURN server (Coturn self-hosted or Twilio TURN). Configure in `VITE_TURN_URL`.

---

## 🟢 Low (Nice-to-Have)

### TD-L1 — No database seed scripts
**Status:** `/scripts/` folder is empty.  
**Fix:** Add `scripts/seed.js` with sample users, teams, meetings, and tasks for development.

### TD-L2 — No Brotli compression on nginx
**Fix:** Add nginx-brotli module; enable `brotli_static on; brotli_types ...;`.

### TD-L3 — No request/response logging to external service
**Fix:** Forward Winston logs to CloudWatch Logs, Datadog, or similar using a Winston transport.

### TD-L4 — Socket.IO sticky sessions not configured for multi-instance
**Fix:** Configure ALB cookie-based sticky sessions or use `@socket.io/redis-adapter`.

### TD-L5 — No DB migration system
**Fix:** Consider `migrate-mongoose` or raw migration scripts for schema changes.

### TD-L6 — Meeting recording playback not implemented
**Status:** `recordingUrl` field exists in Meeting model, no UI or backend for playback.  
**Fix:** Integrate with Cloudinary video API or AWS S3 + CloudFront.

---

## Debt Score

| Metric | Value |
|--------|-------|
| Critical items | 2 |
| High items | 5 |
| Medium items | 7 |
| Low items | 6 |
| Total estimated hours to resolve all | ~40 hours |
| **Technical Debt Ratio** | **Medium** |
