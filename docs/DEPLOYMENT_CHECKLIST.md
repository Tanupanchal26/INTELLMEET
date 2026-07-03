# IntellMeet — Deployment Checklist
*Generated: Phase 5 Production Hardening*

Use this checklist before every production deployment.

---

## Pre-Deployment

### Infrastructure
- [ ] Terraform state is up to date: `terraform plan` shows no unexpected changes
- [ ] ECR repositories exist: `intellmeet-backend`, `intellmeet-frontend`
- [ ] ECS cluster `intellmeet-cluster` is running
- [ ] ElastiCache Redis is accessible from ECS security group
- [ ] MongoDB Atlas connection string is valid and IP allowlisted
- [ ] SSL certificate is valid and not expiring within 30 days
- [ ] DNS records point to correct ALB

### Secrets
- [ ] `JWT_SECRET` is a randomly generated 64-char hex string (`openssl rand -hex 64`)
- [ ] `JWT_REFRESH_SECRET` is a different 64-char hex string
- [ ] Secrets are stored in AWS Secrets Manager (not in code, not in ECS task definition plaintext)
- [ ] `MONGO_URI` uses TLS: `mongodb+srv://...?ssl=true`
- [ ] `REDIS_URL` uses TLS: `rediss://...`
- [ ] `OPENAI_API_KEY` is set (AI features won't work without it)
- [ ] `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` set for OAuth
- [ ] `CLOUDINARY_*` keys set for file uploads

### Code Quality
- [ ] `cd server && npm run lint` — 0 errors
- [ ] `cd client && npm run lint` — 0 errors
- [ ] `cd client && npx tsc --noEmit` — 0 TypeScript errors
- [ ] `cd server && npm test` — all tests pass
- [ ] `cd server && npm run test:coverage` — coverage acceptable
- [ ] `cd server && npm audit --audit-level=high` — 0 high/critical vulnerabilities
- [ ] `cd client && npm audit --audit-level=high` — 0 high/critical vulnerabilities

### Build
- [ ] Backend Docker image builds successfully: `docker build ./server`
- [ ] Frontend Docker image builds with correct env vars: `docker build --build-arg VITE_API_BASE_URL=... ./client`
- [ ] `docker compose up --build` starts all services without errors

---

## Deployment

### Docker / ECR
- [ ] Images tagged with `github.sha` AND `latest`
- [ ] Both images pushed to ECR
- [ ] ECR image scan shows no critical vulnerabilities

### ECS Deploy
- [ ] Backend ECS service force-updated
- [ ] Frontend ECS service force-updated
- [ ] ECS services reach STABLE state (not in deployment errors)
- [ ] ECS task logs show no startup errors

### Kubernetes (if applicable)
- [ ] `kubectl apply -f infrastructure/k8s/api-deployment.yaml -n intellmeet`
- [ ] All pods reach `Running` state: `kubectl get pods -n intellmeet`
- [ ] No `CrashLoopBackOff` or `OOMKilled` events
- [ ] Secrets are not stored in plaintext in manifests

---

## Post-Deployment Verification

### Health Checks
- [ ] `curl https://api.intellmeet.com/health` returns `{"status":"ok"}`
- [ ] `curl -sI https://intellmeet.com` returns `HTTP/2 200`
- [ ] `curl -sI http://intellmeet.com` returns `301 Moved Permanently`

### Functional Smoke Tests
- [ ] Signup: create a new account — user appears in DB
- [ ] Login: receives `accessToken` and `refreshToken`
- [ ] Token refresh: `POST /auth/refresh-token` — returns new token pair
- [ ] Protected route: `GET /meetings` with valid token — returns 200
- [ ] Protected route: `GET /meetings` without token — returns 401
- [ ] Create meeting: `POST /meetings` — returns created meeting with `roomId`
- [ ] Frontend loads: navigate to `https://intellmeet.com` — login page renders
- [ ] WebSocket: Socket.IO connects after login (no console errors)
- [ ] Google OAuth: clicking Google login button redirects to Google

### Performance
- [ ] Page load time < 3 seconds on desktop (Lighthouse)
- [ ] API response time < 200ms for authenticated GET requests (CloudWatch)
- [ ] Redis is caching (verify `ai:summary:*` keys in Redis)

### Monitoring
- [ ] CloudWatch alarms are configured for: CPU > 80%, memory > 80%, 5xx error rate > 1%
- [ ] CloudWatch log groups are receiving logs from backend and frontend
- [ ] Uptime monitor (if configured) shows services as UP

---

## Rollback Plan

If deployment fails:

1. **ECS rollback:**
   ```bash
   aws ecs update-service --cluster intellmeet-cluster --service intellmeet-api-service --task-definition intellmeet-api:<PREVIOUS_REVISION>
   ```

2. **Kubernetes rollback:**
   ```bash
   kubectl rollout undo deployment/intellmeet-api -n intellmeet
   kubectl rollout status deployment/intellmeet-api -n intellmeet
   ```

3. **Verify rollback health:** `curl https://api.intellmeet.com/health`

4. **Post-incident:** Review logs in CloudWatch, create incident ticket, fix forward.

---

## Sign-off

| Role          | Name | Date | Approved |
|---------------|------|------|---------|
| Dev Lead      |      |      | ☐ |
| QA            |      |      | ☐ |
| DevOps        |      |      | ☐ |
| Security      |      |      | ☐ |
