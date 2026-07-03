# IntellMeet — Architecture Report
*Generated: Phase 5 Production Hardening*

---

## 1. System Overview

IntellMeet is a multi-tenant, real-time collaboration platform built on a clean layered architecture. The system combines synchronous REST APIs, bidirectional WebSocket communication, WebRTC peer-to-peer video, and asynchronous AI processing.

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                               │
│  React 19 + Vite + TypeScript + Tailwind CSS 4                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────────┐   │
│  │  Redux   │ │  Zustand │ │  React   │ │  WebRTC (P2P Video)  │   │
│  │Toolkit   │ │  Stores  │ │  Query   │ │  + Socket.IO client  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────────┘   │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS / WSS
┌────────────────────────────▼────────────────────────────────────────┐
│                         NGINX (Reverse Proxy)                        │
│  TLS termination, rate limiting, WebSocket upgrade, SPA routing      │
└────────────────────────────┬────────────────────────────────────────┘
                    ┌────────┴────────┐
                    │                 │
         ┌──────────▼───────┐  ┌──────▼──────────┐
         │   REST API        │  │  Socket.IO       │
         │   Express 4       │  │  (same process)  │
         └──────────┬───────┘  └──────┬────────────┘
                    │                 │
         ┌──────────▼─────────────────▼──────────────┐
         │              SERVICE LAYER                  │
         │  auth | meeting | team | channel | AI       │
         │  notification | webrtc | email | jwt        │
         └──────────┬────────────────────────────────-─┘
                    │
         ┌──────────▼──────────────────────────────────┐
         │            REPOSITORY LAYER                  │
         │  user | meeting | team | channel | message   │
         │  notification | meetingNote                  │
         └──────────┬──────────────────────────────────┘
                    │
         ┌──────────▼───────────────────────────────────┐
         │            DATA LAYER                         │
         │  MongoDB 7 (Mongoose 8)  │  Redis 7           │
         └───────────────────────────────────────────────┘
                    │
         ┌──────────▼──────────┐
         │  EXTERNAL SERVICES   │
         │  OpenAI GPT-4o       │
         │  OpenAI Whisper-1    │
         │  Cloudinary          │
         │  SMTP (Nodemailer)   │
         │  Google OAuth 2.0    │
         └──────────────────────┘
```

---

## 3. Frontend Architecture

### State Management Strategy

| State Type         | Tool          | Rationale |
|--------------------|---------------|-----------|
| Auth + user        | Redux Toolkit | Needs middleware (token refresh), devtools |
| Team/notification  | Redux Toolkit | Complex normalised state |
| UI theme/sidebar   | Redux Toolkit | App-wide synchronisation |
| Active meeting     | Zustand       | Ephemeral, no persistence needed |
| AI results         | Zustand       | Component-local scope |
| Chat messages      | Zustand       | Real-time, frequent updates |
| Server data        | React Query   | Caching, refetching, pagination |

### Routing

- React Router v7 with data router
- `ProtectedRoute` wraps all authenticated pages
- Public routes: `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password/:token`
- Lazy loading is possible via `React.lazy()` for large pages (MeetingRoom, Analytics)

---

## 4. Backend Architecture

### Request Lifecycle

```
HTTP Request
→ requestId middleware (UUID injected)
→ Helmet (security headers)
→ CORS (allowlist check)
→ Morgan HTTP logger
→ express-rate-limit (per-IP)
→ express-json-sanitize (NoSQL injection)
→ xss-clean (XSS sanitisation)
→ hpp (parameter pollution)
→ authenticate() (JWT verification + user load)
→ scopeTenant() (injects req.tenantId)
→ validate() (Joi schema)
→ controller (calls service)
→ service (business logic, calls repository)
→ repository (Mongoose query)
→ ApiResponse.success() / ApiError thrown
→ error.middleware (formats to JSON envelope)
→ HTTP Response
```

### Socket.IO Lifecycle

```
WebSocket Upgrade
→ Auth middleware (verifies Bearer token from handshake)
→ User attached to socket.user
→ chatSocket registered
→ meetingSocket registered
→ notificationSocket registered
→ presenceSocket registered (joins presence:tenantId room)
→ Events dispatched to appropriate handlers
→ disconnect: presence cleanup, room leave
```

---

## 5. Data Model Relationships

```
Tenant ─────────────────── (1:N) ──── User
  │                                     │
  ├── (1:N) ── Team ──── (1:N) ── Channel ── (1:N) ── Message
  │              │
  │              └── (1:N) ── Meeting ── (1:N) ── Message (chat)
  │                               │
  │                               ├── AIResult
  │                               └── MeetingNote
  │
  └── (1:N) ── Notification ──── recipient (User)
  └── (1:N) ── Task ──── assignedTo (User)
```

---

## 6. Security Architecture

| Layer              | Control |
|--------------------|---------|
| Transport          | HTTPS (TLS 1.2/1.3), HSTS, nginx redirect |
| Authentication     | JWT HS256, 15-min access + 7-day refresh with rotation |
| Authorisation      | RBAC with role hierarchy, per-tenant scoping |
| Input validation   | Joi schemas on all mutation routes |
| NoSQL injection    | express-mongo-sanitize ($, . stripping) |
| XSS               | xss-clean middleware + CSP header (prod) |
| Rate limiting      | Per-IP: 100/15min API, 10/15min auth, 20/min AI |
| Brute force        | 5 login attempts → 15-min account lockout |
| Password security  | bcrypt rounds=12, min 8 chars with complexity rules |
| Secrets            | No secrets in code, Joi validation crashes on missing |
| Token storage      | Refresh tokens stored as SHA-256 hash, reuse detection |

---

## 7. Deployment Architecture

```
GitHub Actions
→ ECR (Docker images: backend + frontend)
→ ECS Fargate (backend service, 2-10 replicas via HPA)
→ ECS Fargate (frontend service, 2 replicas)
→ ALB (HTTPS, routing /api → backend, / → frontend)
→ ElastiCache Redis (session cache, presence, AI cache)
→ MongoDB Atlas (production DB with multi-region replica set)
```

---

## 8. Scalability Considerations

| Concern                     | Current Implementation | Scale Path |
|-----------------------------|----------------------|------------|
| Socket.IO multi-instance    | In-memory presence   | Redis adapter (`socket.io-redis`) |
| DB read scaling             | Single replica       | Read replicas + connection pooling |
| AI processing               | Synchronous OpenAI   | Queue with Bull/BullMQ |
| File uploads                | Cloudinary direct    | Pre-signed S3 URLs |
| Background jobs             | None (fire-and-forget emails) | Bull workers |

---

## 9. Architecture Score: 82/100

| Category              | Score | Notes |
|-----------------------|-------|-------|
| Separation of concerns| 95/100 | Controller → Service → Repository pattern enforced |
| Multi-tenancy         | 85/100 | tenantId on all models, scopeTenant middleware |
| Security layers       | 88/100 | Comprehensive middleware stack |
| Scalability           | 65/100 | Socket.IO in-memory presence won't scale horizontally |
| Observability         | 75/100 | Winston structured logging; no distributed tracing |
| API design            | 90/100 | RESTful, versioned, consistent envelopes |
| Frontend patterns     | 88/100 | Clean state separation, service abstraction |
