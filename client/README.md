# IntellMeet — Frontend

React 19 + Vite 8 + TypeScript 5 + Tailwind CSS 4 frontend for the IntellMeet platform.

For full project documentation see the [root README](../README.md) and the [`docs/`](../docs/) directory.

---

## Prerequisites

- Node.js 18+
- The backend server running on `http://localhost:5000` (see [`server/`](../server/))

## Setup

```bash
cp .env.example .env
# .env is pre-configured for local development
npm install
npm run dev
# App available at http://localhost:5173
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | TypeScript compile + Vite production build |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE_URL` | Yes | Backend API URL — must end with `/api/v1` |
| `VITE_SOCKET_URL` | Yes | Socket.IO server URL (no path) |
| `VITE_GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `VITE_SENTRY_DSN` | No | Sentry DSN for error tracking |

See [`docs/ENV_VARIABLES.md`](../docs/ENV_VARIABLES.md) for full documentation.

## Key Directories

```
src/
├── api/            Axios service modules (one file per resource)
├── app/            Redux store + React Router config
├── components/     Shared UI components
├── design-system/  Design tokens
├── hooks/          Custom React hooks
├── pages/          One file per route
├── store/          Redux slices + Zustand stores
└── utils/          helpers, socket factory, webrtc utilities
```
