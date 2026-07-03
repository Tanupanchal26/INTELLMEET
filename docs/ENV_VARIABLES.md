# IntellMeet — Environment Variables Reference

All variables for both `server/.env` and `client/.env` are documented here with type, requirement status, default value, and description.

---

## Quick Reference — Minimum to Run Locally

Copy these into `server/.env` to get started:

```env
MONGO_URI=mongodb://localhost:27017/intellmeet
JWT_SECRET=<run: openssl rand -hex 64>
JWT_REFRESH_SECRET=<run: openssl rand -hex 64>
```

Copy these into `client/.env` to get started:

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
```

All other variables are optional — features degrade gracefully when they are absent.

---

## Server (`server/.env`)

### Application

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `NODE_ENV` | string | No | `development` | Runtime environment. Accepted values: `development`, `staging`, `production`, `test`. Controls CSP, cookie `Secure` flag, and error stack traces. |
| `PORT` | number | No | `5000` | HTTP server port. |

### Database

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `MONGO_URI` | string | **Yes** | — | MongoDB connection string. For Atlas: `mongodb+srv://<user>:<pass>@cluster.mongodb.net/intellmeet`. Include `?ssl=true` in production. |

### Redis

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `REDIS_URL` | string | No | `redis://localhost:6379` | Redis connection URL. Use `rediss://` for TLS (required in production). The app starts without Redis but loses caching, Socket.IO cross-pod messaging, and BullMQ. |

### JWT Security

Generate strong secrets: `openssl rand -hex 64`

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `JWT_SECRET` | string | **Yes** | — | HMAC secret for access tokens. Minimum 32 characters. Use 64+ characters in production. |
| `JWT_EXPIRES_IN` | string | No | `15m` | Access token lifetime. Standard duration notation: `15m`, `1h`, `1d`. |
| `JWT_REFRESH_SECRET` | string | **Yes** | — | HMAC secret for refresh tokens. **Must be different from `JWT_SECRET`.** Minimum 32 characters. |
| `JWT_REFRESH_EXPIRES_IN` | string | No | `7d` | Refresh token lifetime. |

### CORS and Cookies

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `ALLOWED_ORIGINS` | string | No | `http://localhost:5173` | Comma-separated list of allowed frontend origins. Example for production: `https://app.intellmeet.com`. In `development` mode, all origins are allowed regardless of this setting. |
| `CLIENT_URL` | string | No | `http://localhost:5173` | Base URL of the frontend, used in email links (password reset, email verification). |
| `COOKIE_DOMAIN` | string | No | — | Cookie domain for multi-subdomain setups. Example: `.intellmeet.com` allows cookies on `app.intellmeet.com` and `api.intellmeet.com`. Leave unset for single-domain deployments. |

### Google OAuth

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | string | No | — | OAuth 2.0 client ID from [Google Cloud Console](https://console.cloud.google.com/). Google sign-in is disabled when absent. |
| `GOOGLE_CLIENT_SECRET` | string | No | — | OAuth 2.0 client secret. |
| `GOOGLE_CALLBACK_URL` | string | No | `http://localhost:5000/api/v1/auth/google/callback` | Must exactly match the redirect URI registered in Google Cloud Console. Production: `https://api.intellmeet.com/api/v1/auth/google/callback`. |

### Cloudinary (File and Media Uploads)

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `CLOUDINARY_CLOUD_NAME` | string | No | — | Cloudinary cloud name from your dashboard. File uploads return an error when absent. |
| `CLOUDINARY_API_KEY` | string | No | — | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | string | No | — | Cloudinary API secret. |

### OpenAI (AI Features)

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `OPENAI_API_KEY` | string | No | — | OpenAI API key. Required for AI summary, transcription (Whisper-1), action-item extraction, meeting minutes, assistant chat, semantic search, and AI task generation. Without this key, all AI endpoints return empty results without throwing an error. |

### SMTP (Email Notifications)

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `SMTP_HOST` | string | No | — | SMTP server hostname. Examples: `smtp.sendgrid.net`, `smtp.mailgun.org`. Email delivery is disabled when absent. |
| `SMTP_PORT` | number | No | `587` | SMTP port. Use `587` for STARTTLS, `465` for implicit SSL. |
| `SMTP_USER` | string | No | — | SMTP username or API key username. |
| `SMTP_PASS` | string | No | — | SMTP password or API key. |
| `SMTP_FROM` | string | No | `noreply@intellmeet.com` | Sender address shown in emails. |
| `SMTP_SECURE` | boolean | No | `false` | Set to `true` to use SSL on connect (port 465). |

### Sentry (Error Tracking)

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `SENTRY_DSN` | string | No | — | Sentry Data Source Name from your Sentry project settings. Error tracking is disabled when absent. |

---

## Client (`client/.env`)

> **Important:** `VITE_API_BASE_URL` must include the `/api/v1` path suffix. A common mistake is setting it to `/api` or `http://localhost:5000/api` — this causes all API calls to 404.

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `VITE_API_BASE_URL` | string | **Yes** | — | Full backend API URL **including the `/api/v1` suffix**. Local: `http://localhost:5000/api/v1`. Production: `https://api.intellmeet.com/api/v1`. |
| `VITE_SOCKET_URL` | string | **Yes** | — | Socket.IO server URL **without a path**. Local: `http://localhost:5000`. Production: `https://api.intellmeet.com`. Socket.IO automatically upgrades to `wss://` when the URL uses `https://`. |
| `VITE_GOOGLE_CLIENT_ID` | string | No | — | Google OAuth client ID (same value as server `GOOGLE_CLIENT_ID`). Used to render the Google login button. Google sign-in is hidden when absent. |
| `VITE_SENTRY_DSN` | string | No | — | Sentry DSN for frontend error tracking. Client-side error tracking is disabled when absent. |

---

## Production Checklist

Before deploying to production, verify every item in this list:

### Secrets

- [ ] `JWT_SECRET` is a randomly generated 64-character hex string (`openssl rand -hex 64`)
- [ ] `JWT_REFRESH_SECRET` is a **different** 64-character hex string
- [ ] Neither secret is committed to version control
- [ ] Secrets are stored in AWS Secrets Manager or an equivalent secrets manager
- [ ] No plaintext secrets appear in ECS task definitions or Kubernetes manifests

### Database and Cache

- [ ] `MONGO_URI` uses Atlas with TLS (`mongodb+srv://...`) and the IP allowlist is restricted to ECS security group
- [ ] `REDIS_URL` uses TLS (`rediss://...`)

### Application

- [ ] `NODE_ENV=production` is set
- [ ] `ALLOWED_ORIGINS` contains only the exact production frontend URL (no trailing slash)
- [ ] `CLIENT_URL` points to the production frontend URL
- [ ] `COOKIE_DOMAIN` is set if serving from multiple subdomains
- [ ] `GOOGLE_CALLBACK_URL` matches the redirect URI in Google Cloud Console exactly
- [ ] `SENTRY_DSN` and `VITE_SENTRY_DSN` are set for error tracking in production
