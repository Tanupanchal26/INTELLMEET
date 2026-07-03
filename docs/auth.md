# IntellMeet — Authentication & Authorization Module

## Security Architecture

```
Client
  │
  ├── POST /api/v1/auth/login
  │       │
  │       ├── Rate Limit: 10 req / 15 min (failed only)
  │       ├── Joi Validation
  │       ├── Brute-force Check (lockout after 5 fails)
  │       ├── bcrypt.compare (salt rounds: 12)
  │       ├── Issue Access Token  (JWT, 15 min, Authorization header)
  │       └── Issue Refresh Token (JWT, 7 days, HTTP-only cookie)
  │
  ├── GET /api/v1/protected-route
  │       │
  │       ├── authenticate()  → verify Bearer access token
  │       ├── authorize()     → check exact role(s)
  │       └── roleGuard()     → check role hierarchy
  │
  └── POST /api/v1/auth/refresh-token
          │
          ├── Read from HTTP-only cookie
          ├── Verify JWT signature
          ├── Check hashed token exists in DB
          ├── Token reuse? → revoke ALL sessions (theft detected)
          └── Rotate: issue new pair, store new hash
```

---

## Roles & Permissions

| Role         | Level | Can Do |
|--------------|-------|--------|
| super_admin  | 0     | Everything — full platform access |
| admin        | 1     | Manage users, settings, meetings within tenant |
| manager      | 2     | Create meetings, assign tasks, view reports |
| employee     | 3     | Join meetings, create tasks, chat |
| guest        | 4     | View-only, join shared meetings |

**roleGuard('manager')** allows: super_admin, admin, manager
**authorize('admin', 'super_admin')** allows only those exact roles

---

## API Reference

### Base URL
```
http://localhost:5000/api/v1/auth
```

---

### POST /signup

**Rate limited:** 10 req / 15 min

**Request:**
```json
{
  "name":     "Jane Smith",
  "email":    "jane@company.com",
  "password": "MyP@ssw0rd!",
  "role":     "employee"
}
```

**Response 201:**
```json
{
  "success":    true,
  "statusCode": 201,
  "message":    "Account created. Please verify your email.",
  "data": {
    "user": {
      "id":         "64f...",
      "name":       "Jane Smith",
      "email":      "jane@company.com",
      "role":       "employee",
      "isVerified": false,
      "status":     "active"
    },
    "accessToken": "eyJhbGci..."
  }
}
```
Refresh token is set as `HttpOnly` cookie named `refreshToken`.

---

### POST /login

**Request:**
```json
{ "email": "jane@company.com", "password": "MyP@ssw0rd!" }
```

**Response 200:** Same shape as signup.

**Lockout Response 403** (after 5 failed attempts):
```json
{
  "success":    false,
  "statusCode": 403,
  "message":    "Account temporarily locked. Try again in 15 minute(s)."
}
```

---

### POST /logout

**Headers:** `Authorization: Bearer <accessToken>`

Removes the current session's refresh token from DB and clears the cookie.

---

### POST /logout-all

**Headers:** `Authorization: Bearer <accessToken>`

Clears ALL refresh tokens — terminates every active session.

---

### POST /refresh-token

Reads refresh token from `refreshToken` cookie (preferred) or `req.body.refreshToken` (mobile).

**Response 200:**
```json
{
  "data": {
    "accessToken": "eyJhbGci...",
    "user": { ... }
  }
}
```
New refresh token is rotated into the cookie automatically.

---

### POST /forgot-password

```json
{ "email": "jane@company.com" }
```
Always returns 200 — never reveals whether the email exists.

---

### POST /reset-password/:token

```json
{
  "password":        "NewP@ssw0rd!",
  "confirmPassword": "NewP@ssw0rd!"
}
```
Token expires in 1 hour. All sessions are invalidated on success.

---

### GET /verify-email/:token

Token expires in 24 hours.

---

### POST /change-password

**Headers:** `Authorization: Bearer <accessToken>`

```json
{
  "currentPassword": "OldP@ss1!",
  "newPassword":     "NewP@ss1!",
  "confirmPassword": "NewP@ss1!"
}
```
All other sessions are terminated on success.

---

### GET /me

**Headers:** `Authorization: Bearer <accessToken>`

Returns the current user profile.

---

## Security Controls (OWASP)

| Threat | Control |
|--------|---------|
| Brute Force | 5-attempt lockout, 15-min window, auth rate limiter |
| Credential Stuffing | bcrypt rounds 12, constant-time comparison |
| Token Theft | HTTP-only cookie, Secure flag in prod, short-lived access token |
| Token Reuse | Hashed refresh tokens in DB, reuse = revoke all sessions |
| XSS | HTTP-only cookie, CSP headers via helmet |
| CSRF | SameSite=Strict cookie, Bearer token for API |
| NoSQL Injection | express-mongo-sanitize strips $ and . |
| Password in Logs | password field select:false, toJSON strips it |
| Enumeration | Forgot-password always returns 200 |
| MITM | Secure cookie flag (HTTPS only in prod), HSTS header |
| Privilege Escalation | Role restricted on signup (only employee/guest), RBAC middleware |
| Mass Assignment | Joi strips unknown keys from all request bodies |

---

## Environment Variables Required

```env
JWT_SECRET=<min-32-chars>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<different-min-32-chars>
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_URL=https://app.intellmeet.com
```

---

## Using Middleware in Routes

```js
const { authenticate, authorize, roleGuard } = require('../middleware/auth.middleware');

// Anyone authenticated
router.get('/profile', authenticate, ctrl.getProfile);

// Exact role check
router.delete('/users/:id', authenticate, authorize('super_admin', 'admin'), ctrl.deleteUser);

// Hierarchy check (manager AND above)
router.post('/meetings', authenticate, roleGuard('manager'), ctrl.createMeeting);

// Owner OR admin
router.patch('/users/:id', authenticate, verifyOwnerOrAdmin, ctrl.updateUser);
```
