# IntellMeet

An AI-powered meeting collaboration platform. IntellMeet combines HD video conferencing (WebRTC), real-time team chat (Socket.IO), AI meeting intelligence (live transcription, smart summarisation, action-item extraction), and project task boards — all in a single multi-tenant application.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start — Local Dev](#quick-start--local-dev)
- [Quick Start — Docker Compose](#quick-start--docker-compose)
- [Environment Variables](#environment-variables)
- [Running Tests](#running-tests)
- [Documentation](#documentation)
- [Contributing](#contributing)

---

## Features

- **Video Conferencing** — WebRTC peer-to-peer video/audio with screen sharing, mute, and participant controls
- **Real-Time Chat** — Channel and direct-message chat with typing indicators, reactions, threads, and message pinning
- **AI Meeting Intelligence** — GPT-4o summarisation, action-item extraction, meeting minutes, and an AI assistant powered by OpenAI
- **Live Transcription** — Whisper-1 speech-to-text with per-speaker labelling and chunk storage
- **Semantic Search** — Embedding-based search across all meeting summaries within a tenant
- **Task Board** — Kanban task management with AI-assisted task generation from meeting transcripts
- **Notifications** — Real-time push notifications via socket with email fallback via SMTP
- **Google OAuth** — One-click sign-in alongside email/password authentication
- **Multi-Tenant** — Full tenant isolation with per-tenant RBAC (super_admin → admin → member)
- **Media Library** — File upload and management via Cloudinary
- **Meeting Recordings** — Recording upload and storage
- **Analytics** — Dashboard and CSV export for meeting and task metrics
- **Export** — PDF summary and CSV action-item export per meeting

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, TypeScript 5, Tailwind CSS 4 |
| State Management | Redux Toolkit (auth, teams, notifications, UI) + Zustand (meeting, chat, AI) |
| Server Data | TanStack React Query v5 |
| Backend | Node.js 18, Express 4, TypeScript 6 |
| Real-Time | Socket.IO 4 (chat, meeting, notifications, presence) |
| Database | MongoDB 7 via Mongoose 8 |
| Cache / Pub-Sub | Redis 7 via ioredis / node-redis |
| AI | OpenAI GPT-4o + Whisper-1 |
| Media | Cloudinary |
| Auth | JWT (HS256, 15 min access / 7 day refresh with rotation) + Google OAuth 2.0 |
| Job Queue | BullMQ (AI processing queue) |
| Metrics | Prometheus (`prom-client`) on `GET /metrics` |
| Error Tracking | Sentry |
| Infrastructure | Docker, Nginx, Kubernetes, Terraform, AWS ECS Fargate, ECR, ElastiCache |
| CI/CD | GitHub Actions with AWS OIDC |

---

## Project Structure

```
ZIDIO/
├── client/                   # React 19 + Vite frontend
│   ├── src/
│   │   ├── api/              # Axios service modules (one per resource)
│   │   ├── app/              # Redux store + React Router config
│   │   ├── components/       # Shared UI components
│   │   ├── design-system/    # Design tokens (colors, spacing, typography)
│   │   ├── features/         # Feature-scoped components (chat)
│   │   ├── hooks/            # Custom React hooks
│   │   ├── pages/            # One file per route
│   │   ├── store/            # Redux slices + Zustand stores
│   │   └── utils/            # Helpers, socket factory, WebRTC utilities
│   ├── .env.example
│   └── Dockerfile
│
├── server/                   # Node.js + Express backend
│   ├── src/
│   │   ├── ai/               # OpenAI wrappers (summariser, transcription, etc.)
│   │   ├── config/           # env, db, redis, passport, cloudinary, sentry
│   │   ├── constants/        # Shared enums and constants (ROLES, HTTP, etc.)
│   │   ├── controllers/      # HTTP layer — parse request, call service, respond
│   │   ├── middleware/        # auth, error, rateLimit, validate, requestId, etc.
│   │   ├── models/           # Mongoose schemas
│   │   ├── queues/           # BullMQ AI job queue and worker
│   │   ├── repositories/     # Data access layer (abstracts Mongoose)
│   │   ├── routes/v1/        # All v1 API routes
│   │   ├── services/         # Business logic layer
│   │   ├── sockets/          # Socket.IO event handlers
│   │   └── validators/       # Joi schemas
│   ├── tests/                # Jest integration tests
│   ├── .env.example
│   └── Dockerfile
│
├── devops/                   # Infrastructure and deployment
│   ├── docker-compose.yml    # Production Docker Compose (full stack)
│   ├── docker-compose.override.yml  # Local dev overrides (hot-reload, exposed ports)
│   ├── nginx/                # Nginx reverse-proxy config
│   ├── k8s/                  # Kubernetes manifests
│   └── terraform/            # AWS infrastructure (ECS, ECR, ALB, ElastiCache)
│
├── docs/                     # Full project documentation
│   ├── api.md
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT_GUIDE.md
│   ├── ENV_VARIABLES.md
│   ├── CONTRIBUTING.md
│   ├── TROUBLESHOOTING.md
│   └── RELEASE_NOTES.md
│
└── .github/workflows/        # GitHub Actions CI/CD pipeline
```

---

## Quick Start — Local Dev

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 18+ | Use [nvm](https://github.com/nvm-sh/nvm) to manage versions |
| MongoDB | 7.0 | Local install or [Atlas free tier](https://www.mongodb.com/atlas) |
| Redis | 7.x | Local install or Docker: `docker run -p 6379:6379 redis:7-alpine` |

### 1. Clone and install

```bash
git clone <repo-url>
cd ZIDIO
```

### 2. Configure environment

```bash
# Server
cp server/.env.example server/.env

# Client
cp client/.env.example client/.env
```

Edit `server/.env` — at minimum set:

```env
MONGO_URI=mongodb://localhost:27017/intellmeet
JWT_SECRET=<generate with: openssl rand -hex 64>
JWT_REFRESH_SECRET=<generate with: openssl rand -hex 64>
```

Edit `client/.env` — at minimum set:

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
```

See [`docs/ENV_VARIABLES.md`](docs/ENV_VARIABLES.md) for every variable documented with type, default, and description.

### 3. Start the backend

```bash
cd server
npm install
npm run dev
# API running on http://localhost:5000
```

### 4. Start the frontend

```bash
cd client
npm install
npm run dev
# App running on http://localhost:5173
```

### Verification

```bash
curl http://localhost:5000/health
# {"status":"ok","timestamp":"...","uptime":...,"dependencies":{"mongo":true,"redis":true}}
```

---

## Quick Start — Docker Compose

The full stack (MongoDB, Redis, backend, frontend, Nginx) runs with a single command.

### 1. Create a `.env` file in `devops/`

```bash
cp devops/.env.example devops/.env   # if it exists, otherwise create manually
```

Minimum required variables:

```env
MONGO_ROOT_USER=intellmeet
MONGO_ROOT_PASS=<strong-password>
REDIS_PASSWORD=<strong-password>
JWT_SECRET=<openssl rand -hex 64>
JWT_REFRESH_SECRET=<openssl rand -hex 64>
ALLOWED_ORIGINS=http://localhost
CLIENT_URL=http://localhost
VITE_API_BASE_URL=/api/v1
```

### 2. Start the stack

```bash
cd devops
docker compose up --build
```

The override file (`docker-compose.override.yml`) is loaded automatically and exposes MongoDB (`27017`), Redis (`6379`), backend (`5000`), and frontend (`5173`) on the host with hot-reload enabled.

### Useful commands

```bash
docker compose logs -f backend      # tail backend logs
docker compose logs -f frontend     # tail frontend logs
docker compose down                 # stop all containers
docker compose down -v              # stop and remove volumes (wipes DB)
docker compose up --build backend   # rebuild only the backend
```

---

## Environment Variables

Full reference in [`docs/ENV_VARIABLES.md`](docs/ENV_VARIABLES.md).

**Minimum required to start locally:**

| Variable | Where | Description |
|---|---|---|
| `MONGO_URI` | `server/.env` | MongoDB connection string |
| `JWT_SECRET` | `server/.env` | Access token secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | `server/.env` | Refresh token secret (min 32 chars, different from above) |
| `VITE_API_BASE_URL` | `client/.env` | Must be `http://localhost:5000/api/v1` |
| `VITE_SOCKET_URL` | `client/.env` | Must be `http://localhost:5000` |

**Optional (features degrade gracefully without them):**

| Variable | Feature |
|---|---|
| `OPENAI_API_KEY` | AI summary, transcription, action items, assistant |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth sign-in |
| `CLOUDINARY_*` | File and media upload |
| `SMTP_*` | Email notifications and password reset emails |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | Error tracking |

---

## Running Tests

### Backend

```bash
cd server
npm test                  # run all tests
npm run test:coverage     # run with coverage report
npm run test:watch        # watch mode
```

Tests require MongoDB. The CI pipeline spins up a MongoDB service container automatically. Locally, ensure MongoDB is running or use the Docker Compose stack.

### Frontend

```bash
cd client
npm run lint              # ESLint
npx tsc --noEmit          # TypeScript type check
npm run build             # full production build (catches TS + Vite errors)
```

> **Note:** The frontend does not yet have a unit test suite (Vitest). This is tracked as a known gap in [`docs/RELEASE_NOTES.md`](docs/RELEASE_NOTES.md).

---

## Documentation

| Document | Description |
|---|---|
| [`docs/API.md`](docs/API.md) | Complete REST API and Socket.IO event reference |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture, data models, request lifecycle |
| [`docs/DEPLOYMENT_GUIDE.md`](docs/DEPLOYMENT_GUIDE.md) | Docker, Kubernetes, and AWS ECS deployment instructions |
| [`docs/ENV_VARIABLES.md`](docs/ENV_VARIABLES.md) | All environment variables with types, defaults, and descriptions |
| [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) | Branch strategy, PR process, coding conventions, commit format |
| [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) | Common errors and how to fix them |
| [`docs/RELEASE_NOTES.md`](docs/RELEASE_NOTES.md) | Changelog and known issues |

---

## Contributing

See [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) for the full guide including branch naming, commit format, PR template, and coding conventions.

Quick summary:

- Branch from `main`: `feature/<name>`, `fix/<name>`, `chore/<name>`
- Run `npm run lint` and `npm test` before pushing
- PRs require passing CI (lint + type check + tests) before merge
- `main` is protected and deploys to production automatically on merge
