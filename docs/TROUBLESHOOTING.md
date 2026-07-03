# IntellMeet — Troubleshooting Guide

This guide covers the most common errors encountered during local development, Docker Compose setup, and production deployment. Each entry includes the symptom, root cause, and fix.

---

## Contents

- [Server Won't Start](#server-wont-start)
- [Database Connection Errors](#database-connection-errors)
- [Redis Connection Errors](#redis-connection-errors)
- [Authentication Errors](#authentication-errors)
- [API Errors](#api-errors)
- [Frontend Build and Runtime Errors](#frontend-build-and-runtime-errors)
- [WebRTC / Video Issues](#webrtc--video-issues)
- [Socket.IO Issues](#socketio-issues)
- [AI Features Not Working](#ai-features-not-working)
- [Docker Compose Issues](#docker-compose-issues)
- [CI/CD Pipeline Failures](#cicd-pipeline-failures)
- [Production Issues](#production-issues)

---

## Server Won't Start

### `[CONFIG ERROR] Environment validation failed`

**Symptom:** Server exits immediately with a validation error message.

**Cause:** A required environment variable is missing or has an invalid value. The Joi schema in `server/src/config/env.ts` crashes the process intentionally on misconfiguration.

**Fix:**
```bash
# Check which variable is failing
cd server && npm run dev 2>&1 | grep "CONFIG ERROR"

# Required variables — the server cannot start without these:
MONGO_URI=mongodb://localhost:27017/intellmeet
JWT_SECRET=<min 32 characters>
JWT_REFRESH_SECRET=<min 32 characters, different from JWT_SECRET>

# Generate strong secrets
openssl rand -hex 64
```

---

### `Cannot find module` / `Error: Cannot find module './config/env'`

**Cause:** TypeScript source has not been compiled and you are running the production start command.

**Fix:**
```bash
# For development, always use:
npm run dev   # uses ts-node-dev, no compilation needed

# For production:
npm run build && npm start
```

---

## Database Connection Errors

### `MongoServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017`

**Cause:** MongoDB is not running.

**Fix:**
```bash
# Option 1 — start MongoDB locally
mongod --dbpath /usr/local/var/mongodb

# Option 2 — start with Docker
docker run -d -p 27017:27017 --name mongo mongo:7.0

# Option 3 — use MongoDB Atlas (update MONGO_URI in .env)
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/intellmeet
```

---

### `MongoServerError: Authentication failed`

**Cause:** Wrong username/password in `MONGO_URI`, or `authSource` is missing.

**Fix:**
```bash
# Local with authentication
MONGO_URI=mongodb://<user>:<pass>@localhost:27017/intellmeet?authSource=admin

# Atlas
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/intellmeet
```

---

### `MongooseError: Operation 'users.findOne()' buffering timed out`

**Cause:** Mongoose buffered a query before the connection was established. Usually caused by a slow or failed connection.

**Fix:** Check that `MONGO_URI` is correct and MongoDB is reachable. Look at the server startup logs for the `[DB]` connection message.

---

## Redis Connection Errors

### `[REDIS] Redis unavailable — running without cache`

**Symptom:** Warning in logs, app continues. Rate limiting falls back to in-memory. AI results are not cached.

**Cause:** Redis is not running or `REDIS_URL` is incorrect.

**Fix:**
```bash
# Start Redis locally
redis-server

# Start with Docker
docker run -d -p 6379:6379 --name redis redis:7-alpine

# Verify connection
redis-cli ping  # should return PONG

# Default URL
REDIS_URL=redis://localhost:6379
```

---

### `[SOCKET] Redis unavailable — running single-node Socket.IO`

**Symptom:** Warning in logs. App works normally in development with a single server instance.

**Cause:** Same as above. The `@socket.io/redis-adapter` requires Redis.

**Impact in production:** With multiple ECS replicas, users on different instances will not see each other's presence updates. **Redis must be available in production.**

---

## Authentication Errors

### `401 Unauthorized` on all API requests after login

**Cause 1:** `VITE_API_BASE_URL` in `client/.env` is wrong. The most common mistake is using `/api` instead of `/api/v1`.

**Fix:**
```env
# client/.env — this must be exactly:
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

**Cause 2:** The access token has expired and the refresh interceptor is failing.

**Fix:** Check the browser console and network tab. If `/auth/refresh-token` is returning 401, it means the refresh token cookie has expired or been revoked. The user must log in again.

---

### `403 Account temporarily locked`

**Cause:** The account has been locked after 5 failed login attempts. Lock duration is 15 minutes.

**Fix (development):** Unlock manually via the API:
```bash
# Login as admin first, then:
curl -X POST http://localhost:5000/api/v1/auth/unlock/<userId> \
  -H "Authorization: Bearer <admin_access_token>"
```

Or update the user document directly in MongoDB:
```js
// mongosh
db.users.updateOne(
  { email: "user@example.com" },
  { $set: { loginAttempts: 0, lockUntil: null } }
)
```

---

### `JsonWebTokenError: invalid signature` or `jwt malformed`

**Cause:** `JWT_SECRET` or `JWT_REFRESH_SECRET` was changed after tokens were issued, or a token from a different environment was used.

**Fix:** Log the user out (clear localStorage and cookies) and log back in.

---

### Google OAuth redirect loop or `google_failed` error

**Cause 1:** `GOOGLE_CALLBACK_URL` does not match the redirect URI registered in Google Cloud Console.

**Fix:** In Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client ID, ensure `http://localhost:5000/api/v1/auth/google/callback` is listed as an authorised redirect URI.

**Cause 2:** `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` is not set or is incorrect.

---

## API Errors

### `404 Not Found` on `/api/v1/*`

**Cause:** The request URL is missing `/v1`. For example, calling `/api/meetings` instead of `/api/v1/meetings`.

**Fix:** Ensure `VITE_API_BASE_URL` ends with `/api/v1` (not `/api`).

---

### `400 Validation failed` with unexpected fields

**Cause:** Joi validators use `unknown: false` by default — extra fields in the request body are rejected.

**Fix:** Remove the unexpected fields from the request body or check the validator schema in `server/src/validators/`.

---

### `429 Too Many Requests`

**Cause:** You have hit a rate limit. Limits are per IP:
- General API: 100 requests / 15 minutes
- Auth routes: 10 requests / 15 minutes
- AI routes: 20 requests / minute
- Upload routes: 20 requests / hour

**Fix (development):** Restart the server to reset in-memory rate limit counters. In production with Redis rate limiting, the counter is stored in Redis and persists across restarts.

---

### `500 Internal Server Error` with no details

**Cause:** An unhandled error in a service or repository. In production, the stack trace is hidden.

**Fix:** Check the server logs:
```bash
# Local
# Check terminal output where npm run dev is running

# Docker Compose
docker compose logs -f backend

# ECS
aws logs tail /ecs/intellmeet-api --follow
```

Look for `[ERROR]` lines with the `requestId` matching the one in the response header `X-Request-ID`.

---

## Frontend Build and Runtime Errors

### Vite build fails: `Cannot find module` for a local import

**Cause:** A path alias is wrong or a file was moved without updating imports.

**Fix:**
```bash
cd client && npx tsc --noEmit
# TypeScript will show the exact file and line
```

---

### `CORS error: blocked by CORS policy`

**Cause:** The frontend origin is not in `ALLOWED_ORIGINS`.

**Fix:**
```env
# server/.env
ALLOWED_ORIGINS=http://localhost:5173
```

In `server/src/app.ts`, `isDev` mode allows all origins — so this error should only occur in production or staging. Check that `NODE_ENV=development` is set in your local `.env`.

---

### `useSelector` / `useDispatch` TypeScript errors after adding a new slice

**Cause:** The new slice was not added to the root store in `client/src/app/store.ts`.

**Fix:** Import and add the slice reducer to the `combineReducers` call in `store.ts`.

---

## WebRTC / Video Issues

### Video/audio not connecting between users

**Cause 1:** Both users are behind symmetric NAT and STUN alone is insufficient.

**Fix:** This requires a TURN server. STUN is configured in `client/src/utils/webrtc.ts`. Add a TURN server URL:
```typescript
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:<your-turn-server>:3478',
    username: '<username>',
    credential: '<password>',
  },
];
```

**Cause 2:** The browser did not grant camera/microphone permission.

**Fix:** Check for `NotAllowedError` in the browser console. The user must grant media device permissions.

---

### `ICE connection failed` after a few seconds

**Cause:** WebRTC ICE negotiation failed. Common on corporate networks with restrictive firewalls.

**Fix:** A TURN server is required for reliable connectivity through firewalls. See above.

---

### Screen share not working

**Cause:** `getDisplayMedia` requires HTTPS in most browsers (except `localhost`).

**Fix:** For local testing, `localhost` is fine. For any non-localhost domain, HTTPS is required.

---

## Socket.IO Issues

### Socket connects but no events are received

**Cause 1:** The access token was not passed in the Socket.IO handshake.

**Fix:** Check `client/src/utils/socket.ts` — the token must be passed in the `auth` option:
```typescript
const socket = io(SOCKET_URL, {
  auth: { token: accessToken },
  withCredentials: true,
});
```

**Cause 2:** The user hasn't joined the relevant room. Check that the `channel:join` or `meeting:join` event is emitted after connecting.

---

### `Transport close` / disconnects frequently

**Cause:** The server is not configured with a sufficiently long ping timeout.

**Fix:** Check `server/src/server.ts`. The server is configured with `pingTimeout: 60000` and `pingInterval: 25000`. Ensure Nginx is not closing idle WebSocket connections prematurely.

In `devops/nginx/nginx.conf`, add:
```nginx
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
```

---

## AI Features Not Working

### AI endpoints return empty results silently

**Cause:** `OPENAI_API_KEY` is not set. The AI service degrades gracefully — no errors are thrown, results are simply empty.

**Fix:**
```env
# server/.env
OPENAI_API_KEY=sk-...
```

---

### `OpenAI API error: insufficient_quota`

**Cause:** Your OpenAI account has no remaining credits.

**Fix:** Add billing details to your OpenAI account at [platform.openai.com](https://platform.openai.com).

---

### AI summary takes a very long time

**Cause:** The synchronous OpenAI call blocks until GPT-4o returns a response (typically 10–30 seconds for long transcripts).

**Expected behaviour:** This is a known limitation. The BullMQ queue infrastructure exists to move this to async processing. For now, expect long response times on AI endpoints with large transcripts.

---

## Docker Compose Issues

### `MONGO_ROOT_USER must be set` error on `docker compose up`

**Cause:** The `devops/.env` file does not exist or is missing required variables.

**Fix:**
```bash
# Create devops/.env with at minimum:
MONGO_ROOT_USER=intellmeet
MONGO_ROOT_PASS=localpassword
REDIS_PASSWORD=localpassword
JWT_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)
```

---

### Backend container exits with `Cannot connect to MongoDB`

**Cause:** The backend container started before MongoDB passed its health check.

**Fix:** The `docker-compose.yml` has `depends_on` with `condition: service_healthy`. If this still fails, MongoDB's health check may be taking longer than usual. Increase the `start_period` in the healthcheck config or run `docker compose up mongo redis` first, wait for them to be healthy, then run `docker compose up backend frontend`.

---

### Port already in use (`bind: address already in use`)

**Cause:** A process on your machine is already using port 5000, 5173, 27017, or 6379.

**Fix:**
```bash
# Find and kill the process using port 5000 (example)
lsof -i :5000
kill -9 <PID>
```

---

## CI/CD Pipeline Failures

### `npm audit` fails with high severity vulnerabilities

**Fix:** The `continue-on-error: true` flag prevents this from blocking the pipeline. However, investigate the advisory:
```bash
npm audit --audit-level=high
npm audit fix   # auto-fix safe updates
```

---

### `docker build` fails in CI but works locally

**Cause 1:** `.dockerignore` is excluding files that the Dockerfile needs.

**Cause 2:** A build argument (`VITE_API_BASE_URL`) is missing.

**Fix:** Check the build step in `.github/workflows/ci-cd.yml` — ensure all required `--build-arg` values are present.

---

### ECS service fails to reach STABLE state

**Cause:** The new task definition is failing its health check (`GET /health` not returning 200). The old task definition is still running.

**Fix:**
```bash
# Check ECS task logs
aws logs tail /ecs/intellmeet-api --follow --since 10m

# Check task stop reason
aws ecs describe-tasks \
  --cluster intellmeet-cluster \
  --tasks <task-arn> \
  --query 'tasks[0].stoppedReason'
```

---

## Production Issues

### `status: degraded` on `/health`

**Cause:** MongoDB or Redis is not reachable from the backend container.

**Fix:**
- Check ECS security group rules — the backend service SG must allow outbound to MongoDB Atlas (port 27017) and ElastiCache (port 6379)
- Check Atlas IP allowlist — the ECS task's outbound IP must be allowed
- Check ElastiCache SG — inbound from ECS service SG on port 6379 must be allowed

---

### Frontend returns 502 Bad Gateway

**Cause:** The backend ECS service is not healthy. The ALB cannot forward `/api/v1/*` requests.

**Fix:** Check ECS service events and task logs. Verify the health check endpoint `GET /health` is responding within 10 seconds.

---

### `Mixed Content` errors in browser console

**Cause:** The frontend (served over HTTPS) is trying to connect to the Socket.IO server over `ws://` (HTTP).

**Fix:** Ensure `VITE_SOCKET_URL` uses `https://` (Socket.IO upgrades to `wss://` automatically):
```env
VITE_SOCKET_URL=https://api.intellmeet.com
```
