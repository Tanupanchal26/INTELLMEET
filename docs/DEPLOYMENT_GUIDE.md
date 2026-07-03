# IntellMeet — Deployment Guide

---

## Contents

- [Local Development (Docker Compose)](#1-local-development-docker-compose)
- [Infrastructure Provisioning (Terraform)](#2-infrastructure-provisioning-terraform)
- [Secrets Configuration](#3-secrets-configuration)
- [Docker Image Build and Push](#4-docker-image-build-and-push)
- [Kubernetes Deployment](#5-kubernetes-deployment)
- [GitHub Actions CI/CD](#6-github-actions-cicd)
- [SSL / TLS](#7-ssl--tls)
- [Health Checks](#8-health-checks)
- [Post-Deployment Verification](#9-post-deployment-verification)
- [Rollback](#10-rollback)
- [Monitoring](#11-monitoring)

---

## 1. Local Development (Docker Compose)

The `devops/docker-compose.yml` defines the full production-like stack (MongoDB, Redis, backend, frontend, Nginx). The `devops/docker-compose.override.yml` is loaded automatically in local dev and overrides it with hot-reload, exposed host ports, and no Nginx.

### Prerequisites

- Docker Desktop (or Docker Engine + Compose v2)
- No local MongoDB or Redis required — Docker provides them

### Setup

**Create the devops environment file:**

```bash
# Create devops/.env (not committed — add to .gitignore)
cat > devops/.env << 'EOF'
MONGO_ROOT_USER=intellmeet
MONGO_ROOT_PASS=change_me_local
REDIS_PASSWORD=change_me_local
JWT_SECRET=<run: openssl rand -hex 64>
JWT_REFRESH_SECRET=<run: openssl rand -hex 64>
ALLOWED_ORIGINS=http://localhost:5173
CLIENT_URL=http://localhost:5173
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
# Optional — features degrade gracefully without these
OPENAI_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
EOF
```

**Start the stack:**

```bash
cd devops
docker compose up --build
```

Dev override exposes these ports on the host:

| Service | Host Port | Description |
|---------|-----------|-------------|
| Backend | `5000` | Express API + Socket.IO |
| Frontend | `5173` | Vite dev server (hot-reload) |
| MongoDB | `27017` | Direct access for Compass / mongosh |
| Redis | `6379` | Direct access for Redis CLI |
| Node debugger | `9229` | Attach VS Code debugger to backend |

**Nginx is disabled in local dev.** Vite's built-in dev proxy handles `/api` and Socket.IO requests.

### Common commands

```bash
docker compose logs -f backend        # tail backend logs
docker compose logs -f frontend       # tail frontend logs
docker compose ps                     # check container status
docker compose restart backend        # restart only the backend
docker compose up --build backend     # rebuild and restart backend
docker compose down                   # stop all containers
docker compose down -v                # stop and wipe all data volumes
```

---

## 2. Infrastructure Provisioning (Terraform)

Terraform files are in `devops/terraform/`.

### Prerequisites

- Terraform >= 1.6
- AWS CLI v2 configured with IAM permissions for ECS, ECR, VPC, ElastiCache, IAM

```bash
cd devops/terraform

# Initialise (downloads providers, configures S3 state backend)
terraform init

# Preview planned changes
terraform plan -var="region=us-east-1"

# Apply
terraform apply -var="region=us-east-1"
```

**Resources created:**

- VPC with public/private subnets across 2 AZs
- ECR repositories: `intellmeet-backend`, `intellmeet-frontend`
- ECS Fargate cluster: `intellmeet-cluster`
- ECS services: `intellmeet-api-service`, `intellmeet-web-service`
- Application Load Balancer with HTTPS listener (ACM certificate)
- ElastiCache Redis cluster (TLS enabled)
- Security groups, IAM roles, CloudWatch log groups

---

## 3. Secrets Configuration

**Never store plaintext secrets in Kubernetes manifests, Terraform state, or ECS task definition environment fields.**

### AWS Secrets Manager

```bash
# Store each secret individually
aws secretsmanager create-secret \
  --name /intellmeet/prod/JWT_SECRET \
  --secret-string "$(openssl rand -hex 64)"

aws secretsmanager create-secret \
  --name /intellmeet/prod/JWT_REFRESH_SECRET \
  --secret-string "$(openssl rand -hex 64)"

aws secretsmanager create-secret \
  --name /intellmeet/prod/MONGO_URI \
  --secret-string "mongodb+srv://<user>:<pass>@cluster.mongodb.net/intellmeet"
```

Reference them in your ECS task definition via the `secrets` array:

```json
{
  "secrets": [
    { "name": "JWT_SECRET", "valueFrom": "arn:aws:secretsmanager:us-east-1:...:secret:/intellmeet/prod/JWT_SECRET" }
  ]
}
```

### Kubernetes Secrets

```bash
kubectl create secret generic intellmeet-secrets \
  --from-literal=MONGO_URI="mongodb+srv://..." \
  --from-literal=REDIS_URL="rediss://..." \
  --from-literal=JWT_SECRET="$(openssl rand -hex 64)" \
  --from-literal=JWT_REFRESH_SECRET="$(openssl rand -hex 64)" \
  --from-literal=OPENAI_API_KEY="sk-..." \
  -n intellmeet
```

Use [External Secrets Operator](https://external-secrets.io/) or [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets) to sync from AWS Secrets Manager to Kubernetes.

---

## 4. Docker Image Build and Push

### Login to ECR

```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS \
    --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com
```

### Build and push backend

```bash
docker build -t intellmeet-backend ./server

docker tag intellmeet-backend:latest \
  <ECR_URI>/intellmeet-backend:latest

docker push <ECR_URI>/intellmeet-backend:latest
```

### Build and push frontend

```bash
docker build \
  --build-arg VITE_API_BASE_URL=https://api.intellmeet.com/api/v1 \
  --build-arg VITE_SOCKET_URL=https://api.intellmeet.com \
  -t intellmeet-frontend ./client

docker tag intellmeet-frontend:latest \
  <ECR_URI>/intellmeet-frontend:latest

docker push <ECR_URI>/intellmeet-frontend:latest
```

The frontend Dockerfile accepts `VITE_API_BASE_URL` and `VITE_SOCKET_URL` as build arguments. These are baked into the static build at build time — they cannot be changed at runtime.

---

## 5. Kubernetes Deployment

Kubernetes manifests are in `devops/k8s/`.

```bash
# Create namespace
kubectl create namespace intellmeet

# Apply secrets first (see Section 3)
# Then apply all manifests
kubectl apply -f devops/k8s/api-deployment.yaml -n intellmeet

# Verify pods are running
kubectl get pods -n intellmeet

# Check logs
kubectl logs -l app=intellmeet-api -n intellmeet --tail=100

# Port-forward to test locally
kubectl port-forward svc/intellmeet-api-svc 5000:80 -n intellmeet
curl http://localhost:5000/health
```

The manifest includes a Deployment, Service, and HorizontalPodAutoscaler. The HPA scales the API service between 2 and 10 replicas based on CPU utilisation (target: 70%).

---

## 6. GitHub Actions CI/CD

The pipeline at `.github/workflows/ci-cd.yml` runs on:
- **Push to `main`** — runs full pipeline (lint → test → build → deploy)
- **Push to `staging`** — runs lint + test only
- **Pull request to `main`** — runs lint + test only

### Pipeline stages

| Stage | Steps |
|-------|-------|
| **Lint, Test & Audit** | ESLint (backend + frontend) · `tsc --noEmit` · Jest with coverage · `npm audit --audit-level=high` · Vite production build |
| **Build & Push** | ECR login via OIDC · Docker build + push (backend) · Docker build + push (frontend) |
| **Deploy** | ECS task definition update (backend) · ECS task definition update (frontend) · Wait for service stability · Smoke test `/health` |

### AWS authentication

The pipeline uses **AWS OIDC** — no static `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` are stored in GitHub Secrets. Instead, the workflow assumes an IAM role via GitHub's OIDC identity provider.

**Required GitHub Secrets:**

| Secret | Description |
|--------|-------------|
| `AWS_DEPLOY_ROLE_ARN` | ARN of the IAM role to assume via OIDC |
| `ECS_TASK_DEF_BACKEND_ARN` | ARN of the backend ECS task definition |
| `ECS_TASK_DEF_FRONTEND_ARN` | ARN of the frontend ECS task definition |

---

## 7. SSL / TLS

**Production:** HTTPS is terminated at the AWS ALB using an ACM certificate (free, auto-renews).

**Local HTTPS testing with Docker:**

```bash
mkdir -p devops/nginx/certs

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout devops/nginx/certs/privkey.pem \
  -out devops/nginx/certs/fullchain.pem \
  -subj "/CN=localhost"
```

Mount `devops/nginx/certs` into the Nginx container and update `nginx.conf` to enable the HTTPS server block.

---

## 8. Health Checks

| Endpoint | Expected Response | Used By |
|----------|-------------------|---------|
| `GET /health` | `{ "status": "ok" }` HTTP 200 | Docker, ECS, K8s, ALB |
| `GET /health` (degraded) | `{ "status": "degraded" }` HTTP 503 | Triggers ECS service replacement |

**Kubernetes probe configuration** (from `devops/k8s/api-deployment.yaml`):

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 5000
  initialDelaySeconds: 20
  periodSeconds: 15
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health
    port: 5000
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
```

---

## 9. Post-Deployment Verification

Run these checks after every production deployment:

```bash
# 1. Health check
curl https://api.intellmeet.com/health

# 2. HTTPS redirect
curl -sI http://intellmeet.com | grep "301"

# 3. Frontend loads
curl -sI https://intellmeet.com | grep "200"

# 4. API responds
curl -X POST https://api.intellmeet.com/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Test","email":"smoke@test.com","password":"TestP@ss1!"}'

# 5. Protected route rejects unauthenticated request
curl -sI https://api.intellmeet.com/api/v1/meetings | grep "401"
```

---

## 10. Rollback

### ECS rollback

```bash
# List recent task definition revisions
aws ecs list-task-definitions \
  --family-prefix intellmeet-api \
  --sort DESC \
  --max-items 5

# Roll back to a previous revision
aws ecs update-service \
  --cluster intellmeet-cluster \
  --service intellmeet-api-service \
  --task-definition intellmeet-api:<PREVIOUS_REVISION>

# Wait for stability
aws ecs wait services-stable \
  --cluster intellmeet-cluster \
  --services intellmeet-api-service
```

### Kubernetes rollback

```bash
kubectl rollout undo deployment/intellmeet-api -n intellmeet
kubectl rollout status deployment/intellmeet-api -n intellmeet

# Verify
curl https://api.intellmeet.com/health
```

### Rollback decision criteria

Initiate a rollback if any of these occur within 10 minutes of deployment:
- `GET /health` returns non-200 for more than 2 minutes
- Error rate (5xx) on the ALB exceeds 1% for more than 2 minutes
- Any ECS task is stuck in a crash loop (`STOPPED` state repeatedly)

---

## 11. Monitoring

### CloudWatch (AWS)

- **Container Insights** — enabled on the ECS cluster via Terraform
- **Recommended alarms:**

| Alarm | Threshold | Action |
|-------|-----------|--------|
| CPU utilisation | > 80% for 5 min | Alert + trigger HPA |
| Memory utilisation | > 80% for 5 min | Alert |
| ALB 5xx error rate | > 1% for 2 min | Alert + potential rollback |
| ALB response time | > 500ms p99 for 5 min | Alert |

### Application logs

Backend logs are structured JSON written to stdout (captured by ECS/Docker) and to rotating daily files in `server/logs/`. Log fields include: `level`, `message`, `requestId`, `timestamp`, `stack` (dev only).

### Prometheus metrics

The backend exposes Prometheus default metrics at `GET /metrics`. Scrape with a Prometheus server and visualise with Grafana dashboards.

### Sentry

Error tracking is configured via `SENTRY_DSN` (server) and `VITE_SENTRY_DSN` (client). Both are optional — the app starts normally without them.
