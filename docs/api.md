# IntellMeet — API Reference

**Base URL:** `http://localhost:5000/api/v1`  
**Production:** `https://api.intellmeet.com/api/v1`

All authenticated endpoints require:
```
Authorization: Bearer <access_token>
```

---

## Contents

- [Response Envelopes](#response-envelopes)
- [Authentication](#authentication)
- [Users](#users)
- [Meetings](#meetings)
- [Teams](#teams)
- [Channels](#channels)
- [Chat (Meeting Room)](#chat-meeting-room)
- [Notifications](#notifications)
- [AI](#ai)
- [Tasks](#tasks)
- [Recordings](#recordings)
- [Media](#media)
- [Export](#export)
- [Analytics](#analytics)
- [Tenants](#tenants)
- [System](#system)
- [Socket.IO Events](#socketio-events)
- [Error Codes](#error-codes)

---

## Response Envelopes

All REST endpoints return a consistent JSON envelope.

### Success

```json
{
  "success": true,
  "statusCode": 200,
  "message": "OK",
  "data": { }
}
```

### Paginated

```json
{
  "success": true,
  "statusCode": 200,
  "data": [ ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20
  }
}
```

### Error

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    { "field": "title", "message": "title is required" }
  ]
}
```

---

## Authentication

Rate limited to **10 requests / 15 minutes** per IP on all auth routes.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/signup` | — | Register new user |
| POST | `/auth/login` | — | Login — returns access token + sets refresh cookie |
| POST | `/auth/logout` | ✓ | Revoke current session's refresh token |
| POST | `/auth/logout-all` | ✓ | Revoke all sessions for the current user |
| POST | `/auth/refresh-token` | — | Rotate refresh token — returns new access token |
| POST | `/auth/forgot-password` | — | Send password reset email |
| POST | `/auth/reset-password/:token` | — | Reset password using emailed token |
| GET | `/auth/verify-email/:token` | — | Verify email address |
| POST | `/auth/change-password` | ✓ | Change password (invalidates all other sessions) |
| POST | `/auth/unlock/:id` | ✓ admin | Unlock a locked account |
| GET | `/auth/me` | ✓ | Get current user profile |
| GET | `/auth/google` | — | Redirect to Google OAuth consent screen |
| GET | `/auth/google/callback` | — | Google OAuth callback (handled server-side) |

### POST /auth/signup

```json
{
  "name": "Jane Smith",
  "email": "jane@company.com",
  "password": "MyP@ssw0rd!",
  "role": "member"
}
```

Password requirements: min 8 chars, at least one uppercase, one lowercase, one digit, one special character.  
Allowed roles on signup: `member` only. `admin` and `super_admin` must be assigned by an existing admin.

**Response 201:**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "user": { "id": "...", "name": "Jane Smith", "email": "jane@company.com", "role": "member" },
    "accessToken": "eyJhbGci..."
  }
}
```

The refresh token is set as an `HttpOnly; SameSite=Strict` cookie named `refreshToken`.

### POST /auth/login

```json
{ "email": "jane@company.com", "password": "MyP@ssw0rd!" }
```

After **5 failed attempts**, the account is locked for **15 minutes**.

**Lockout response 403:**
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Account temporarily locked. Try again in 15 minute(s)."
}
```

### POST /auth/refresh-token

Reads the `refreshToken` cookie (browser) or accepts `refreshToken` in the request body (mobile clients).

```json
{ "refreshToken": "<token>" }
```

Returns a new access token and rotates the refresh token cookie. If a previously used refresh token is detected, **all sessions are immediately revoked** (theft detection).

### POST /auth/reset-password/:token

Token expires in **1 hour**. All sessions are invalidated on success.

```json
{
  "password": "NewP@ssw0rd!",
  "confirmPassword": "NewP@ssw0rd!"
}
```

### POST /auth/change-password

```json
{
  "currentPassword": "OldP@ss1!",
  "newPassword": "NewP@ss1!",
  "confirmPassword": "NewP@ss1!"
}
```

---

## Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/me` | ✓ | Get current user profile |
| PUT | `/users/me` | ✓ | Update current user profile |
| DELETE | `/users/me` | ✓ | Delete own account |
| GET | `/users` | ✓ admin | List all users (paginated) |

### PUT /users/me

```json
{
  "name": "Jane Smith",
  "avatar": "https://res.cloudinary.com/..."
}
```

---

## Meetings

All meeting routes require authentication and tenant scoping.

| Method | Endpoint | Auth | Min Role | Description |
|--------|----------|------|----------|-------------|
| POST | `/meetings` | ✓ | member | Create a meeting |
| GET | `/meetings` | ✓ | member | List meetings (paginated) |
| POST | `/meetings/join` | ✓ | member | Join a meeting by roomId |
| GET | `/meetings/:id` | ✓ | participant | Get meeting detail |
| PUT | `/meetings/:id` | ✓ | host/admin | Update meeting |
| DELETE | `/meetings/:id` | ✓ | host/admin | Delete meeting |
| POST | `/meetings/:id/invite` | ✓ | host | Invite participants |
| POST | `/meetings/:id/rsvp` | ✓ | invitee | Respond to invite |
| POST | `/meetings/:id/start` | ✓ | host | Start meeting |
| POST | `/meetings/:id/end` | ✓ | host/admin | End meeting |
| GET | `/meetings/:id/notes` | ✓ | participant | Get meeting notes |
| PUT | `/meetings/:id/notes` | ✓ | participant | Create or update meeting notes |

### POST /meetings — Request Body

```json
{
  "title": "Q4 Planning",
  "description": "Quarterly planning session",
  "scheduledAt": "2025-02-01T10:00:00Z",
  "maxDuration": 60,
  "participants": ["<userId>"],
  "team": "<teamId>",
  "agenda": [
    { "title": "Review goals", "duration": 15, "order": 0 }
  ],
  "isRecurring": false,
  "settings": {
    "waitingRoom": false,
    "muteOnEntry": false,
    "recordingEnabled": false,
    "chatEnabled": true
  }
}
```

### GET /meetings — Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `status` | string | — | Filter: `scheduled`, `active`, `ended` |
| `search` | string | — | Search by title |

### Meeting Status Values

| Status | Description |
|--------|-------------|
| `scheduled` | Created, not yet started |
| `active` | Currently in progress |
| `ended` | Completed |

---

## Teams

All team routes require authentication and tenant scoping.

| Method | Endpoint | Auth | Min Role | Description |
|--------|----------|------|----------|-------------|
| POST | `/teams` | ✓ | admin | Create a team |
| GET | `/teams` | ✓ | member | List my teams |
| GET | `/teams/:id` | ✓ | member | Get team detail |
| PUT | `/teams/:id` | ✓ | admin | Update team |
| DELETE | `/teams/:id` | ✓ | admin | Delete team |
| POST | `/teams/:id/members` | ✓ | admin | Invite a member |
| DELETE | `/teams/:id/members/:userId` | ✓ | admin | Remove a member |
| PATCH | `/teams/:id/members/:userId/role` | ✓ | admin | Update member role |
| POST | `/teams/:teamId/channels` | ✓ | member | Create a channel |
| GET | `/teams/:teamId/channels` | ✓ | member | List channels in team |

### POST /teams — Request Body

```json
{
  "name": "Engineering",
  "description": "Backend and frontend engineers",
  "isPrivate": false,
  "settings": {
    "allowGuestInvite": false,
    "notifyOnMessage": true
  }
}
```

### RBAC Roles

| Role | Level | Permissions |
|------|-------|-------------|
| `super_admin` | 0 | Full platform access |
| `admin` | 1 | Manage users, teams, meetings within tenant |
| `member` | 2 | Create meetings, join channels, create tasks |

---

## Channels

All channel routes require authentication and tenant scoping.

| Method | Endpoint | Auth | Min Role | Description |
|--------|----------|------|----------|-------------|
| GET | `/channels/:id` | ✓ | member | Get channel detail |
| PUT | `/channels/:id` | ✓ | admin | Update channel |
| DELETE | `/channels/:id` | ✓ | admin | Archive channel |
| GET | `/channels/:id/messages` | ✓ | member | List messages (paginated) |
| POST | `/channels/:id/messages` | ✓ | member | Send a message |
| PUT | `/channels/:id/messages/:msgId` | ✓ | sender | Edit a message |
| DELETE | `/channels/:id/messages/:msgId` | ✓ | sender | Soft-delete a message |
| POST | `/channels/:id/messages/:msgId/react` | ✓ | member | Toggle emoji reaction |
| POST | `/channels/:id/messages/:msgId/pin` | ✓ | admin | Pin a message |
| DELETE | `/channels/:id/messages/:msgId/pin` | ✓ | admin | Unpin a message |

### POST /channels/:id/messages — Request Body

```json
{
  "content": "Hello team!",
  "mentions": ["<userId>"],
  "attachments": [
    { "url": "https://...", "name": "file.pdf", "mimeType": "application/pdf", "size": 102400 }
  ],
  "parentId": "<messageId>"
}
```

### GET /channels/:id/messages — Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number |
| `limit` | number | Items per page (max 100) |
| `before` | ISO 8601 | Load messages before this timestamp (cursor pagination) |

### Channel Types

| Type | Description |
|------|-------------|
| `public` | Visible and joinable by all team members |
| `private` | Invite-only |
| `announcement` | Admin-post only, members read-only |
| `dm` | Direct message between two users |

---

## Chat (Meeting Room)

In-meeting chat is separate from channel chat and scoped to a meeting room.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/chat/:meetingId` | ✓ | Get all messages for a meeting |
| POST | `/chat/:meetingId` | ✓ | Send a message in meeting chat |
| DELETE | `/chat/:messageId` | ✓ | Delete a meeting chat message |

---

## Notifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/notifications` | ✓ | List notifications (paginated) |
| POST | `/notifications/read-all` | ✓ | Mark all as read |
| PATCH | `/notifications/:id/read` | ✓ | Mark single notification as read |
| DELETE | `/notifications/:id` | ✓ | Delete notification |

### GET /notifications — Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number |
| `limit` | number | Items per page |
| `unreadOnly` | boolean | Return only unread notifications |

### Notification Types

| Type | Trigger |
|------|---------|
| `meeting_invite` | Invited to a meeting |
| `meeting_started` | A meeting you are in has started |
| `meeting_ended` | A meeting has ended |
| `meeting_reminder` | Pre-meeting reminder |
| `team_invite` | Added to a team |
| `team_role_changed` | Your role in a team was updated |
| `channel_mention` | Mentioned in a channel message |
| `message_reply` | Someone replied to your message |
| `task_assigned` | A task was assigned to you |
| `task_due` | A task is due soon |
| `system` | System-generated notification |

---

## AI

All AI routes require authentication, tenant scoping, and are rate-limited to **20 requests / minute** per IP.  
AI features require `OPENAI_API_KEY` to be set. Without it, endpoints return empty results without error.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/ai/search?q=<query>` | ✓ | Semantic search across meeting summaries |
| GET | `/ai/:meetingId` | ✓ | Get stored AI result for a meeting |
| POST | `/ai/:meetingId/summary` | ✓ | Generate or retrieve cached summary |
| GET | `/ai/:meetingId/transcript` | ✓ | Get stored transcript |
| POST | `/ai/:meetingId/transcript` | ✓ | Save transcript for a meeting |
| GET | `/ai/:meetingId/action-items` | ✓ | Get or extract action items |
| POST | `/ai/:meetingId/minutes` | ✓ | Generate formal meeting minutes |
| POST | `/ai/:meetingId/assistant` | ✓ | Chat with the AI assistant about a meeting |
| POST | `/ai/:meetingId/tasks` | ✓ | Generate task suggestions from transcript |
| POST | `/ai/:meetingId/extract-tasks` | ✓ | Extract and save tasks directly to the task board |

### POST /ai/:meetingId/summary

No request body required. Generates a markdown summary using the stored transcript.  
Results are cached in Redis for 24 hours (`ai:summary:<meetingId>`).

### POST /ai/:meetingId/assistant — Request Body

```json
{
  "message": "What were the main decisions from this meeting?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

### GET /ai/search

```
GET /ai/search?q=product roadmap decisions
```

Returns meetings ranked by semantic similarity. Results are scoped to the authenticated user's tenant.

---

## Tasks

All task routes require authentication and tenant scoping.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/tasks` | ✓ | List tasks for the current user/tenant |
| POST | `/tasks` | ✓ | Create a task |
| PUT | `/tasks/:id` | ✓ | Update a task |
| DELETE | `/tasks/:id` | ✓ | Delete a task |

### POST /tasks — Request Body

```json
{
  "title": "Update API documentation",
  "description": "Cover new export and recording endpoints",
  "status": "todo",
  "priority": "high",
  "dueDate": "2025-03-01T00:00:00Z",
  "assignedTo": "<userId>",
  "meeting": "<meetingId>"
}
```

### Task Status Values

`todo` | `in_progress` | `in_review` | `done`

### Task Priority Values

`low` | `medium` | `high` | `urgent`

---

## Recordings

All recording routes require authentication and tenant scoping.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/recordings` | ✓ | List recordings |
| GET | `/recordings/:id` | ✓ | Get recording detail |
| POST | `/recordings/upload` | ✓ | Upload a recording file (multipart `video`) |
| POST | `/recordings/start` | ✓ | Signal the start of a recording session |
| POST | `/recordings/:id/stop` | ✓ | Signal the end of a recording session |
| DELETE | `/recordings/:id` | ✓ | Delete a recording |

### POST /recordings/upload

`Content-Type: multipart/form-data`  
Field name: `video`

---

## Media

All media routes require authentication and tenant scoping.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/media/upload` | ✓ | Upload a file (multipart `file`) |
| GET | `/media` | ✓ | List uploaded media |
| DELETE | `/media/:id` | ✓ | Delete a media item |

### POST /media/upload

`Content-Type: multipart/form-data`  
Field name: `file`  
Requires `CLOUDINARY_*` environment variables to be configured.

---

## Export

All export routes require authentication and tenant scoping.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/export/summary/:meetingId` | ✓ | Export meeting summary as PDF |
| GET | `/export/action-items/:meetingId` | ✓ | Export action items as CSV |
| GET | `/export/analytics` | ✓ | Export analytics data as CSV |

Responses are binary file downloads with appropriate `Content-Disposition` headers.

---

## Analytics

All analytics routes require authentication and tenant scoping.

| Method | Endpoint | Auth | Min Role | Description |
|--------|----------|------|----------|-------------|
| GET | `/analytics/dashboard` | ✓ | member | Get dashboard metrics for current user |
| GET | `/analytics` | ✓ | admin | Get full tenant analytics data |

---

## Tenants

| Method | Endpoint | Auth | Min Role | Description |
|--------|----------|------|----------|-------------|
| GET | `/tenants` | ✓ | super_admin | List all tenants |
| GET | `/tenants/me` | ✓ | member | Get current user's tenant |
| PATCH | `/tenants/me/settings` | ✓ | admin | Update tenant settings |

---

## System

These endpoints are unauthenticated.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check — returns `{ status, timestamp, uptime, dependencies }` |
| GET | `/metrics` | Prometheus metrics (prom-client default metrics) |

### GET /health — Response

```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "uptime": 3600.123,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "dependencies": {
    "mongo": true,
    "redis": true
  }
}
```

`status` is `"ok"` when all dependencies are healthy, `"degraded"` otherwise. HTTP status is `200` for `ok` and `503` for `degraded`.

---

## Socket.IO Events

Connect to: `ws://localhost:5000` (dev) or `wss://api.intellmeet.com` (prod)

Authentication: pass the access token in the handshake `auth` object:
```js
const socket = io(SOCKET_URL, {
  auth: { token: accessToken },
  withCredentials: true,
});
```

---

### Channel Chat

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `channel:join` | client → server | `channelId: string` | Join a channel room |
| `channel:leave` | client → server | `channelId: string` | Leave a channel room |
| `channel:message` | client → server | `{ channelId, content, mentions?, attachments?, parentId? }` | Send a message |
| `channel:typing` | client → server | `{ channelId }` | Broadcast typing indicator |
| `channel:message` | server → client | Message object | New message broadcast to room |
| `channel:typing` | server → client | `{ userId, name }` | Typing indicator broadcast |

---

### Meeting Room

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `meeting:join` | client → server | `roomId: string` | Join a meeting room |
| `meeting:leave` | client → server | `roomId: string` | Leave a meeting room |
| `meeting:signal` | client → server | `{ roomId, signal, to }` | Forward WebRTC signalling data to a peer |
| `meeting:user-joined` | server → client | `{ socketId }` | Peer joined the meeting room |
| `meeting:user-left` | server → client | `{ socketId }` | Peer left the meeting room |
| `meeting:signal` | server → client | `{ signal, from }` | WebRTC signalling data from a peer |

---

### Notifications

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `notification:subscribe` | client → server | `userId: string` | Subscribe to user-specific notification room |
| `notification:new` | server → client | Notification object | Real-time push notification |

---

### Presence

Presence is tracked per tenant. Users are marked online when connected and offline on disconnect.

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `presence:online` | server → client | `{ userId }` | User came online in the tenant |
| `presence:offline` | server → client | `{ userId }` | User went offline in the tenant |

---

## Error Codes

| HTTP Status | Meaning | Common Cause |
|-------------|---------|--------------|
| 400 | Bad Request | Joi validation failed |
| 401 | Unauthorized | Missing or expired access token |
| 403 | Forbidden | Insufficient role or locked account |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Duplicate resource (e.g. email already registered) |
| 422 | Unprocessable Entity | Business logic rejection |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unhandled server error |
| 503 | Service Unavailable | Dependency (MongoDB/Redis) is down |
