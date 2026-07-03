# IntellMeet — Release Notes

---

## v1.0.0 — Current Release

**Status:** Development / Internal Preview  
**Stack:** Node.js 18 · Express 4 · React 19 · Vite 8 · MongoDB 7 · Redis 7 · Socket.IO 4 · BullMQ 5

---

### What's Included

#### Authentication and Security

- Email/password signup and login with bcrypt (rounds=12)
- JWT access tokens (15 min, HS256) + refresh token rotation with theft detection
- Refresh tokens stored as SHA-256 hashes in MongoDB
- Account lockout after 5 failed attempts (15-minute window)
- Google OAuth 2.0 sign-in (Passport.js strategy)
- Password reset via emailed token (1-hour expiry)
- Email verification flow
- RBAC: `super_admin` → `admin` → `member`
- Per-tenant scoping on all data queries
- Comprehensive security middleware: Helmet, CORS allowlist, mongo-sanitize, xss-clean, HPP, rate limiting

#### Video Conferencing

- WebRTC peer-to-peer video and audio
- Screen sharing
- Mute/unmute controls
- Participant list with presence indicators
- Meeting room join by `roomId`
- STUN server configured (Google public STUN)

#### Real-Time Chat

- Channel chat: public, private, announcement, and direct message channel types
- Meeting room chat (separate from channel chat)
- Typing indicators
- Emoji reactions
- Message threading (reply to parent message)
- Message pinning (admin)
- Soft delete
- Real-time delivery via Socket.IO

#### AI Meeting Intelligence

- **Summarisation** — GPT-4o generates a markdown summary from meeting transcript
- **Action-item extraction** — structured list of assignees, actions, and due dates
- **Meeting minutes** — formal minutes document with participant list
- **AI assistant** — conversational Q&A about any meeting's content with conversation history
- **Semantic search** — embedding-based search across all meeting summaries within a tenant
- **Transcription** — Whisper-1 speech-to-text with per-speaker chunk storage
- **AI task generation** — generates and optionally saves tasks from meeting transcripts
- Results cached in Redis (24-hour TTL for summaries and minutes)
- BullMQ queue and worker initialised for async processing

#### Teams and Channels

- Team creation with private/public visibility
- Member invitation by user ID
- Role management (owner/admin/member within a team)
- Channel creation under teams (public, private, announcement)
- Direct messages

#### Tasks

- Kanban task board (todo, in_progress, in_review, done)
- Priority levels (low, medium, high, urgent)
- Due dates and assignee
- AI-assisted task generation from meeting transcripts

#### Notifications

- Real-time push notifications via Socket.IO
- Email fallback via SMTP
- 11 notification types (meeting lifecycle, team events, mentions, tasks)
- Mark-as-read and delete

#### Media and Export

- File upload to Cloudinary
- Media library (list, delete)
- Meeting recording upload (Cloudinary)
- PDF export of meeting summary
- CSV export of action items
- CSV export of analytics data

#### Infrastructure

- Multi-stage Docker builds for backend and frontend
- Docker Compose for full local stack
- Nginx reverse proxy configuration
- Kubernetes manifests (Deployment, Service, HPA)
- Terraform for AWS ECS Fargate, ECR, ALB, ElastiCache
- GitHub Actions CI/CD pipeline with AWS OIDC (no static keys)
- Socket.IO Redis adapter for cross-pod messaging
- Prometheus metrics on `GET /metrics`
- Sentry error tracking (optional)
- Winston structured logging with daily rotation

---

### Known Issues

The following issues are tracked and will be resolved in upcoming releases. They are documented here to avoid confusion for developers and testers.

#### High Priority

| ID | Description | Affected Area |
|----|-------------|---------------|
| KI-001 | `GET /users` has no role guard — any authenticated user can list all users | Backend · Security |
| KI-002 | Task controller has no ownership check on update/delete — any authenticated user can modify any task | Backend · Security |
| KI-003 | `authorize('tenant_admin')` in the tenant settings route — this role does not exist in `ROLES` constants, causing all settings updates to return 403 | Backend |

#### Medium Priority

| ID | Description | Affected Area |
|----|-------------|---------------|
| KI-004 | AI endpoints are synchronous — GPT-4o calls block the HTTP response for up to 30 seconds on long transcripts | Backend · Performance |
| KI-005 | No frontend unit test suite — Vitest is not configured. Frontend coverage relies entirely on TypeScript type checking and ESLint | Frontend · Quality |
| KI-006 | Analytics page (`/analytics`) uses no real backend data. Dashboard stats are hardcoded. The `GET /analytics` endpoint exists but is not wired to the frontend | Frontend |
| KI-007 | Profile and Settings pages do not call the API — profile update and change-password forms have no backend integration | Frontend |
| KI-008 | WebRTC uses STUN only — video/audio will fail for users behind symmetric NAT or restrictive firewalls. No TURN server is configured | Frontend · Infrastructure |

#### Low Priority

| ID | Description | Affected Area |
|----|-------------|---------------|
| KI-009 | `scripts/` directory is empty — no database seed scripts. New developers must create test data manually | Developer Experience |
| KI-010 | `client/src/utils/constants.ts` exports a stale `API_BASE_URL` pointing to `/api` (missing `/v1`). Any file importing from this path will get the wrong base URL | Frontend |
| KI-011 | Meeting recording playback not implemented — `recordingUrl` field exists on the Meeting model but there is no UI or streaming implementation | Frontend |
| KI-012 | `xss-clean` is deprecated upstream — should be replaced with `DOMPurify` (server-side) in a future release | Backend |
| KI-013 | `framer-motion` has a peer dependency on React 18 but the project uses React 19 — `skipLibCheck: true` masks this. Monitor for official React 19 support | Frontend |

---

### Breaking Changes

None — this is the initial release.

---

## Roadmap

Items planned for upcoming releases, in rough priority order.

### Next (v1.1.0)

- Fix KI-001: Add `authorize('admin')` to `GET /users/`
- Fix KI-002: Add ownership check to task update/delete
- Fix KI-003: Fix `tenant_admin` role reference
- Fix KI-007: Wire Profile and Settings pages to `PUT /users/me` and `POST /auth/change-password`
- Fix KI-010: Remove stale `client/src/utils/constants.ts`
- Add email verification frontend page (`/verify-email/:token`)
- Add database seed script (`scripts/seed.ts`)

### v1.2.0

- Fix KI-004: Move AI processing fully to BullMQ async queue with socket notification on completion
- Fix KI-006: Connect Analytics page to `GET /analytics/dashboard` API
- Configure Vitest + Testing Library for frontend unit tests (KI-005)
- Add TURN server support for WebRTC (KI-008)

### v1.3.0

- Meeting recording playback (KI-011)
- Scheduled meeting calendar view
- Socket.IO sticky session configuration for ALB
- Replace `xss-clean` with `DOMPurify` server-side (KI-012)
- Distributed rate limiting with `rate-limit-redis`

---

## Upgrade Notes

### Upgrading from any pre-v1.0 state

1. Regenerate `JWT_SECRET` and `JWT_REFRESH_SECRET` — all existing sessions will be invalidated
2. Verify `VITE_API_BASE_URL` includes `/api/v1` (not just `/api`)
3. Verify `MONGO_URI` includes the `intellmeet` database name
4. Redis is now used for Socket.IO cross-pod messaging — ensure `REDIS_URL` is set in production

### Dependency notes

- Node.js 18 is the minimum supported version. Node.js 20 LTS is recommended for new installations.
- MongoDB 7.x is required. MongoDB 6.x is not tested.
- Redis 7.x is required for `@socket.io/redis-adapter` compatibility.
