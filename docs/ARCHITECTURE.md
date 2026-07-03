# IntellMeet — Architecture Guide

---

## 1. System Overview

IntellMeet is a multi-tenant, real-time collaboration platform built on a clean layered architecture. The system combines synchronous REST APIs, bidirectional WebSocket communication, WebRTC peer-to-peer video, asynchronous AI job processing via BullMQ, and Prometheus metrics.

---

## 2. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                            CLIENT LAYER                              │
│  React 19 + Vite 8 + TypeScript 5 + Tailwind CSS 4                  │
│  ┌────────────┐ ┌──────────┐ ┌───────────────┐ ┌──────────────────┐ │
│  │Redux Toolkit│ │ Zustand  │ │ React Query v5│ │ WebRTC + Socket  │ │
│  │auth/teams  │ │meeting/  │ │  server state  │ │  .IO client      │ │
│  │notif/ui    │ │chat/ai   │ │  + pagination  │ │                  │ │
│  └────────────┘ └──────────┘ └───────────────┘ └──────────────────┘ │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ HTTPS / WSS
┌──────────────────────────────▼───────────────────────────────────────┐
│                    NGINX (Reverse Proxy)                              │
│  TLS termination · rate limiting · WebSocket upgrade · SPA routing   │
└──────────────────────────────┬───────────────────────────────────────┘
                       ┌───────┴───────┐
                       │               │
           ┌───────────▼─────┐  ┌──────▼──────────┐
           │   REST API       │  │  Socket.IO 4     │
           │   Express 4      │  │  (same process)  │
           └───────────┬─────┘  └──────┬────────────┘
                       │               │
           ┌───────────▼───────────────▼──────────────┐
           │              MIDDLEWARE STACK              │
           │  Sentry · requestId · Helmet · CORS        │
           │  Morgan · compression · body-parser        │
           │  session (RedisStore) · Passport           │
           │  mongo-sanitize · xss-clean · hpp          │
           │  apiLimiter · authenticate · scopeTenant   │
           │  validate (Joi) · asyncHandler             │
           └───────────┬──────────────────────────────-┘
                       │
           ┌───────────▼──────────────────────────────┐
           │              SERVICE LAYER                 │
           │  auth · meeting · team · channel · AI      │
           │  notification · webrtc · email · jwt       │
           │  analytics · export · recording · media    │
           └───────────┬──────────────────────────────-┘
                       │
           ┌───────────▼──────────────────────────────┐
           │            REPOSITORY LAYER               │
           │  base · user · meeting · team · channel   │
           │  message · notification · meetingNote     │
           └───────────┬──────────────────────────────┘
                       │
           ┌───────────▼─────────────────────────────────┐
           │              DATA LAYER                       │
           │  MongoDB 7 (Mongoose 8)  │  Redis 7           │
           │  Persistent documents   │  Session · cache    │
           │                         │  Socket adapter     │
           │                         │  BullMQ queues      │
           └─────────────────────────────────────────────-┘
                       │
           ┌───────────▼──────────────────────────────────┐
           │           ASYNC PROCESSING                    │
           │  BullMQ AI Queue → AI Worker                  │
           │  (summarise · action items · minutes)         │
           └───────────┬──────────────────────────────────┘
                       │
           ┌───────────▼──────────────────────────────────┐
           │           EXTERNAL SERVICES                   │
           │  OpenAI GPT-4o (summary · assistant · tasks)  │
           │  OpenAI Whisper-1 (transcription)             │
           │  Cloudinary (media · recordings upload)       │
           │  SMTP / Nodemailer (email notifications)      │
           │  Google OAuth 2.0 (social sign-in)            │
           │  Sentry (error tracking)                      │
           └──────────────────────────────────────────────┘
```

---

## 3. Frontend Architecture

### State Management

| State Type | Tool | Rationale |
|---|---|---|
| Auth + user session | Redux Toolkit | Needs middleware (token refresh), persistent devtools |
| Teams | Redux Toolkit | Normalised state shared across many components |
| Notifications | Redux Toolkit | App-wide badge count and list |
| UI (theme, sidebar) | Redux Toolkit | App-wide synchronisation |
| Active meeting | Zustand | Ephemeral, no Redux devtools needed |
| AI results | Zustand | Component-local scope, frequent updates |
| Chat messages | Zustand | Real-time, high update frequency |
| Server data | React Query v5 | Caching, background refetch, pagination |

### Routing

- React Router v7 (`react-router-dom`)
- All routes defined in `client/src/app/router.tsx`
- `ProtectedRoute` component in `client/src/components/auth/` wraps all authenticated pages
- Public routes: `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password/:token`, `/auth/google/success`

### API Layer

All HTTP calls go through a single Axios instance at `client/src/api/axios.ts`:
- Attaches `Authorization: Bearer <token>` from Redux store on every request
- On `401`, pauses concurrent requests, calls `POST /auth/refresh-token`, replays the queue
- Normalises error messages from the server envelope into a standard `Error`

### Key Frontend Directories

```
client/src/
├── api/            Axios service modules (auth, meeting, team, channel, ai, ...)
├── app/            router.tsx + store.ts (Redux configuration)
├── components/     Shared UI (ai/, auth/, common/, layout/, meeting/)
├── design-system/  Design tokens (colors, spacing, typography, motion, shadows)
├── features/       Feature-scoped components (chat/)
├── hooks/          useAuth, useChat, useMeeting, useWebRTC, useAI, usePresence, useSocket
├── pages/          One file per route (Dashboard, MeetingRoom, Teams, ...)
├── store/          Redux slices (auth, team, notifications, ui) + Zustand stores
└── utils/          helpers.ts, socket.ts (singleton factory), webrtc.ts, sentry.ts
```

---

## 4. Backend Architecture

### Request Lifecycle

```
HTTP Request
→ Sentry request handler
→ requestId middleware  (UUID injected, returned in X-Request-ID header)
→ Helmet               (security headers including CSP)
→ CORS                 (allowlist check from ALLOWED_ORIGINS env)
→ Morgan               (HTTP access log via Winston)
→ compression          (gzip)
→ express.json         (1 MB limit)
→ cookieParser
→ session              (RedisStore — short-lived OAuth session only)
→ Passport             (Google OAuth strategy initialisation)
→ mongo-sanitize       (strips $ and . from request body/query)
→ xss-clean            (sanitises HTML entities)
→ hpp                  (HTTP parameter pollution prevention)
→ apiLimiter           (100 req / 15 min per IP on /api/*)
→ authenticate()       (verifies Bearer JWT, loads user from DB)
→ scopeTenant()        (injects req.tenantId from req.user.tenantId)
→ validate()           (Joi schema validation — rejects on error)
→ controller           (calls service, returns ApiResponse)
→ service              (business logic, calls repository)
→ repository           (Mongoose query, returns plain objects)
→ ApiResponse.success() / throws ApiError
→ Sentry error handler
→ error.middleware     (formats ApiError → JSON envelope, strips stack in prod)
→ HTTP Response
```

### Socket.IO Lifecycle

```
WebSocket Upgrade
→ Auth middleware  (verifies Bearer token from socket.handshake.auth.token)
→ User attached to socket.data.user
→ Redis adapter    (cross-pod pub/sub via @socket.io/redis-adapter)
→ chatSocket registered
→ meetingSocket registered
→ notificationSocket registered
→ presenceSocket registered (joins presence:<tenantId> room)
→ Events dispatched to appropriate handlers
→ disconnect: presence cleanup, room leave broadcast
```

### AI Processing

AI jobs can be processed either synchronously (direct service call) or asynchronously via BullMQ:

```
POST /ai/:meetingId/summary
→ ai.controller  → ai.service (synchronous path: direct OpenAI call)
                 → ai.queue   (async path: enqueue job, return 202)
                               → ai.worker: processes job, notifies via socket
```

The queue infrastructure (`queues/ai.queue.ts`, `queues/ai.worker.ts`) is initialised in `server.ts` at startup.

### Key Backend Directories

```
server/src/
├── ai/             OpenAI wrappers (summarizer, transcription, actionItems, assistant, semanticSearch)
├── config/         env (Joi validation), db, redis, passport, cloudinary, sentry
├── constants/      ROLES, HTTP, MEETING_STATUS, TASK_STATUS, CACHE_TTL, JWT_CLAIMS, ...
├── controllers/    HTTP layer (auth, user, meeting, team, channel, chat, ai, task, ...)
├── middleware/     auth, error, httpLogger, rateLimit, validate, requestId, notFound, socketRateLimiter
├── models/         Mongoose schemas (User, Meeting, Team, Channel, Message, Task, ...)
├── queues/         BullMQ ai.queue.ts + ai.worker.ts
├── repositories/   Data access layer (base + user, meeting, team, channel, message, ...)
├── routes/v1/      Single index.ts — all API routes
├── services/       Business logic (auth, meeting, team, channel, ai, email, jwt, ...)
├── sockets/        Socket.IO handlers (chat, meeting, notification, presence)
└── validators/     Joi schemas (auth, meeting, team, channel, notification)
```

---

## 5. Data Model Relationships

```
Tenant ─────────────────────────────── (1:N) ── User
  │                                              │
  ├── (1:N) ── Team ─── (1:N) ── Channel ─── (1:N) ── Message
  │              │
  │              └── (1:N) ── Meeting ─── (1:N) ── Message (meeting chat)
  │                               │
  │                               ├── (1:1) ── AIResult
  │                               │            (transcript, summary, actionItems, minutes)
  │                               └── (1:1) ── MeetingNote
  │                                            (agenda, collaborative notes)
  │
  ├── (1:N) ── Task ─── assignedTo (User)
  ├── (1:N) ── Notification ─── recipient (User)
  ├── (1:N) ── Recording
  └── (1:N) ── Media
```

### Model Summary

| Model | Key Fields | Tenant Scoped |
|-------|-----------|---------------|
| User | name, email, password, role, status, tenantId, loginAttempts, lockUntil | ✓ |
| Tenant | name, slug, domain, plan, settings, isActive | — |
| Meeting | tenantId, title, host, participants, roomId, status, scheduledAt, agenda, settings | ✓ |
| Team | tenantId, name, slug, members[], isPrivate, createdBy | ✓ |
| Channel | tenantId, team, name, type, members[], pinnedMessages[], lastMessageAt | ✓ |
| Message | tenantId, channel/meeting, sender, content, reactions[], mentions[], parentId | ✓ |
| Task | tenantId, title, status, priority, assignedTo, dueDate, meeting | ✓ |
| Notification | tenantId, recipient, type, title, body, isRead, refModel, refId | ✓ |
| AIResult | meeting, transcript, transcriptChunks[], summary, minutes, actionItems[] | Via Meeting |
| MeetingNote | tenantId, meeting, content, actionItems[], agenda[], isPrivate | ✓ |
| Recording | tenantId, meeting, url, duration, size | ✓ |
| Media | tenantId, uploader, url, mimeType, name, size | ✓ |
| RefreshToken | user, tokenHash, expiresAt | Via User |

---

## 6. Security Architecture

| Layer | Control |
|---|---|
| Transport | HTTPS (TLS 1.2/1.3), HSTS, Nginx 301 redirect |
| Authentication | JWT HS256, 15-min access + 7-day refresh with SHA-256 hash storage |
| Token rotation | Old token removed on refresh; reuse detected → all sessions revoked |
| Authorisation | RBAC (super_admin → admin → member), per-tenant scoping via `scopeTenant()` |
| Input validation | Joi schemas on all mutation routes, `unknown: false` strips extra fields |
| NoSQL injection | `express-mongo-sanitize` strips `$` and `.` prefixes |
| XSS | `xss-clean` middleware + Helmet CSP header in production |
| Rate limiting | Per-IP: 100/15min API, 10/15min auth, 20/min AI, 20/hr uploads |
| Brute force | 5 login attempts → 15-min account lockout (stored in User model) |
| Password security | bcrypt rounds=12, complexity rules enforced via Joi |
| Cookies | `HttpOnly`, `Secure` (prod), `SameSite=Strict`, path-scoped to `/auth` |
| Session | Short-lived (10 min) Redis session for OAuth flow only |
| Error leaking | Stack traces only in `development`; production returns generic message |

---

## 7. Deployment Architecture

```
GitHub Actions (push to main)
  → Lint + Type Check + Tests (MongoDB service container)
  → npm audit
  → Docker build (backend + frontend)
  → Push to Amazon ECR (tagged with github.sha)
  → AWS OIDC (no static keys — role assumption)
  → ECS Fargate: force new deployment (backend service)
  → ECS Fargate: force new deployment (frontend service)
  → Smoke test: curl /health
```

**Infrastructure (Terraform):**

```
VPC (public + private subnets, 2 AZs)
  └── ALB (HTTPS, ACM certificate, /api → backend, / → frontend)
  └── ECS Fargate cluster: intellmeet-cluster
        ├── intellmeet-api-service   (backend, 2–10 replicas)
        └── intellmeet-web-service   (frontend, 2 replicas)
  └── ElastiCache Redis (TLS, session + cache + Socket.IO adapter + BullMQ)
  └── MongoDB Atlas (multi-region replica set, TLS, IP allowlisted to ECS SG)
  └── ECR repositories: intellmeet-backend, intellmeet-frontend
```

---

## 8. Scalability

| Concern | Current Status | Scale Path |
|---|---|---|
| Socket.IO multi-instance | `@socket.io/redis-adapter` configured in `server.ts` | Already implemented |
| AI processing | BullMQ queue + worker initialised at startup | Add more workers or dedicated worker process |
| DB read scaling | Single primary (Atlas) | Read replicas + Mongoose `readPreference: secondary` |
| File uploads | Cloudinary direct upload | Pre-signed S3 URLs for large files |
| Rate limiting | `express-rate-limit` (in-memory) | `rate-limit-redis` store for multi-instance accuracy |
| Metrics | Prometheus `/metrics` endpoint | Scrape with Prometheus, visualise with Grafana |

---

## 9. Observability

| Signal | Implementation |
|---|---|
| Structured logs | Winston with daily file rotation (`logs/`) + stdout JSON |
| HTTP access logs | Morgan via `httpLogger.middleware.ts` |
| Request tracing | UUID injected per request via `requestId.middleware.ts`, returned in `X-Request-ID` |
| Error tracking | Sentry — request handler + error handler wired in `app.ts` |
| Health check | `GET /health` — reports MongoDB and Redis connection state |
| Metrics | `GET /metrics` — Prometheus default process metrics via `prom-client` |
| Uptime | ECS health checks + ALB target group health checks |
