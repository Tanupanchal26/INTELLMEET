# IntellMeet — Developer Guide

---

## Project Structure

```
ZIDIO/
├── .github/
│   └── workflows/
│       └── ci-cd.yml                CI/CD pipeline (lint → test → build → deploy)
│
├── client/                          React 19 + Vite + TypeScript frontend
│   ├── public/                      Static assets (favicon, manifest)
│   ├── src/
│   │   ├── api/
│   │   │   └── axiosClient.ts       Centralised Axios instance with JWT interceptors
│   │   ├── components/
│   │   │   ├── ai/                  AI panel components (summary, transcript, actions)
│   │   │   ├── common/              Shared UI: Button, Badge, Card, Modal, Loader, ErrorBoundary
│   │   │   ├── dashboard/           Dashboard-specific: AnalyticsChart, MeetingHistory
│   │   │   ├── layout/              AppLayout, Navbar, Sidebar, PageContainer
│   │   │   ├── meeting/             VideoGrid, ChatBox, Controls, ParticipantList, ScreenShare
│   │   │   └── ui/                  Design-system primitives: Grid, Stack, VisuallyHidden
│   │   ├── constants/
│   │   │   └── index.ts             All frontend constants (routes, storage keys, API prefix)
│   │   ├── context/
│   │   │   └── MeetingContext.tsx   WebRTC + socket context for meeting room
│   │   ├── design-system/           Tokens: colors, spacing, typography, shadows, motion
│   │   ├── hooks/
│   │   │   ├── useAuth.ts           Auth state + actions
│   │   │   ├── useChat.ts           Socket.IO channel chat
│   │   │   ├── useMeeting.ts        Meeting CRUD queries
│   │   │   ├── usePresence.ts       Online presence state
│   │   │   ├── useSocket.ts         Centralised socket connection
│   │   │   ├── useWebRTC.ts         WebRTC peer management
│   │   │   └── useAI.ts             AI service queries
│   │   ├── pages/                   One file per route
│   │   ├── routes/
│   │   │   ├── index.tsx            Route definitions
│   │   │   └── ProtectedRoute.tsx   Auth guard (redirects to /login)
│   │   ├── services/                API service layer (wraps axiosClient)
│   │   ├── store/
│   │   │   ├── index.ts             Redux store configuration
│   │   │   ├── slices/              authSlice, uiSlice, teamSlice, notificationSlice
│   │   │   ├── ai.store.ts          Zustand store for AI panel state
│   │   │   ├── chat.store.ts        Zustand store for chat state
│   │   │   ├── meeting.store.ts     Zustand store for active meeting state
│   │   │   └── ui.store.ts          Zustand store for UI preferences
│   │   ├── styles/
│   │   │   └── global.css           CSS variables (theme tokens), global resets
│   │   ├── types/
│   │   │   └── user.ts              TypeScript type definitions
│   │   └── utils/
│   │       ├── helpers.ts           Formatting utilities
│   │       ├── socket.ts            Socket.IO singleton factory
│   │       └── webrtc.ts            WebRTC peer connection helpers
│   ├── .env.example                 Frontend environment variable template
│   ├── Dockerfile                   Multi-stage: builder (Vite) → nginx:alpine
│   ├── eslint.config.js
│   ├── tsconfig.json
│   └── vite.config.ts               Manual chunks, asset optimisation
│
├── server/                          Node.js 18 + Express backend
│   ├── src/
│   │   ├── ai/                      AI engine modules (OpenAI wrappers)
│   │   │   ├── openai.js            OpenAI client singleton
│   │   │   ├── summarizer.js        GPT-4 summarisation
│   │   │   ├── actionItems.js       Action item extraction
│   │   │   ├── minutesGenerator.js  Meeting minutes generation
│   │   │   ├── assistant.js         Chat assistant + task generation
│   │   │   ├── semanticSearch.js    Embedding-based semantic search
│   │   │   └── transcription.js     Whisper transcription
│   │   ├── config/
│   │   │   ├── env.js               Joi-validated environment config (crashes on misconfiguration)
│   │   │   ├── db.js                Mongoose connect/disconnect
│   │   │   ├── redis.js             Redis connect/disconnect + singleton getter
│   │   │   ├── passport.js          Google OAuth Passport strategy
│   │   │   └── cloudinary.js        Cloudinary SDK configuration
│   │   ├── constants/
│   │   │   └── index.js             Shared constants: HTTP codes, ROLES, AUTH config, PAGINATION
│   │   ├── controllers/             Thin HTTP layer — parse request, call service, send response
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js   authenticate, authorize, roleGuard, scopeTenant, verifyOwnerOrAdmin
│   │   │   ├── error.middleware.js  Global error handler — formats ApiError into JSON envelope
│   │   │   ├── rateLimit.middleware.js  apiLimiter, authLimiter, aiLimiter, uploadLimiter
│   │   │   ├── validate.middleware.js   Joi schema validation wrapper
│   │   │   └── requestId.middleware.js  UUID request ID injected into every response
│   │   ├── models/                  Mongoose schemas
│   │   ├── repositories/            Data access layer (abstracts Mongoose queries)
│   │   │   └── base.repository.js   Common CRUD + pagination for all repositories
│   │   ├── routes/
│   │   │   └── v1/index.js          v1 router — mounts all sub-routers
│   │   ├── services/                Business logic layer
│   │   ├── sockets/
│   │   │   ├── index.js             Auth middleware + connection handler
│   │   │   ├── chat.socket.js       Channel + meeting chat events
│   │   │   ├── meeting.socket.js    Meeting room events (join, leave, WebRTC signalling)
│   │   │   ├── notification.socket.js  Push notification events
│   │   │   └── presence.socket.js   Online presence tracking (per-tenant)
│   │   ├── utils/
│   │   │   ├── ApiError.js          Structured error class with HTTP status codes
│   │   │   ├── ApiResponse.js       Consistent success response envelope
│   │   │   ├── asyncHandler.js      Wraps async controllers — forwards errors to next()
│   │   │   └── logger.js            Winston logger with daily file rotation
│   │   ├── validators/              Joi schemas per route group
│   │   ├── app.js                   Express app (middleware stack, route mounting)
│   │   └── server.js                HTTP + Socket.IO server, DB connect, graceful shutdown
│   ├── tests/                       Jest test suite
│   ├── .env.example                 Server environment variable template
│   └── Dockerfile                   Multi-stage: deps → non-root production image
│
├── docs/
│   ├── api.md                       Full API endpoint reference
│   ├── ARCHITECTURE.md              System architecture overview
│   ├── ENV_VARIABLES.md             All environment variables documented
│   ├── DEPLOYMENT_GUIDE.md          Step-by-step deployment instructions
│   └── DEVELOPER_GUIDE.md           This file
│
├── infrastructure/
│   ├── k8s/
│   │   └── api-deployment.yaml     Deployment + Service + HPA + Secrets manifest
│   └── terraform/
│       ├── main.tf                  VPC, ECR, ECS, ALB, ElastiCache
│       └── variables.tf
│
├── nginx/
│   └── nginx.conf                   HTTPS, rate limiting, WebSocket proxy, SPA routing
│
├── docker-compose.yml               Full local stack: mongo + redis + backend + frontend + nginx
└── README.md
```

---

## Coding Conventions

### Backend

- All controllers use `asyncHandler` — no try/catch blocks in controllers
- All errors use `ApiError.badRequest()`, `ApiError.unauthorized()`, etc.
- All responses use `ApiResponse.success()` or `ApiResponse.created()`
- Business logic lives in services — controllers are thin
- DB queries live in repositories — services never touch Mongoose directly
- Constants are imported from `src/constants/index.js` — never hardcoded

### Frontend

- All API calls go through `axiosClient` (handles JWT refresh automatically)
- Server state uses React Query (`@tanstack/react-query`)
- UI/auth state uses Redux Toolkit slices
- Ephemeral real-time state uses Zustand stores
- All routes in `src/routes/index.tsx` — no route scattered in components
- Protected routes use `ProtectedRoute` component
- All API base URLs come from `src/constants/index.ts` (`API_BASE_URL`, `ROUTES`)

### API Design

- Base: `/api/v1/`
- Resource naming: plural nouns (`/meetings`, `/teams`, `/channels`)
- Auth: Bearer token in `Authorization` header
- Success envelope: `{ success: true, data: {...}, message: "..." }`
- Error envelope: `{ success: false, message: "...", statusCode: 4xx }`
- Pagination: `?page=1&limit=20` → `{ data: [], total, page, limit, pages }`

---

## Adding a New Feature

1. **Backend route** — Add to `server/src/routes/` and mount in `routes/v1/index.js`
2. **Validator** — Create Joi schema in `validators/`
3. **Controller** — Thin handler in `controllers/`
4. **Service** — Business logic in `services/`
5. **Repository** — DB queries in `repositories/`
6. **Tests** — Add test file in `tests/`
7. **Frontend service** — Add API calls in `client/src/services/`
8. **Frontend page/component** — Add in `pages/` or `components/`
9. **Route** — Register in `client/src/routes/index.tsx`

---

## Git Workflow

- `main` — production, protected, requires passing CI
- `staging` — pre-production, CI runs on push
- Feature branches: `feature/<name>`, `fix/<name>`, `chore/<name>`
- PRs must pass lint, type check, and tests before merge
