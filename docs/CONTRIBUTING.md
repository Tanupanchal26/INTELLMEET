# IntellMeet — Contributing Guide

Thank you for contributing to IntellMeet. This guide covers everything you need to open a pull request: environment setup, branch naming, commit format, coding conventions, and the review process.

---

## Contents

- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Branch Strategy](#branch-strategy)
- [Commit Message Format](#commit-message-format)
- [Development Workflow](#development-workflow)
- [Coding Conventions](#coding-conventions)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Adding a New Feature](#adding-a-new-feature)

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | [nvm](https://github.com/nvm-sh/nvm) recommended |
| MongoDB | 7.x | Local or Docker |
| Redis | 7.x | Local or Docker |
| Git | Any recent | — |

Quick Docker alternative for MongoDB and Redis:
```bash
docker run -d -p 27017:27017 --name mongo mongo:7.0
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

---

## Local Setup

```bash
# 1. Fork and clone
git clone https://github.com/<your-fork>/IntellMeet.git
cd IntellMeet/ZIDIO

# 2. Install dependencies
cd server && npm install && cd ..
cd client && npm install && cd ..

# 3. Configure environment
cp server/.env.example server/.env
cp client/.env.example client/.env
# Edit server/.env — set MONGO_URI, JWT_SECRET, JWT_REFRESH_SECRET
# client/.env is pre-configured for local dev

# 4. Start services
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

Verify: `curl http://localhost:5000/health` should return `{"status":"ok"}`.

---

## Branch Strategy

| Branch | Purpose | Deploys to |
|--------|---------|------------|
| `main` | Production-ready code, protected | Production (auto on merge) |
| `staging` | Pre-production integration | Staging |
| `feature/<name>` | New features | — |
| `fix/<name>` | Bug fixes | — |
| `chore/<name>` | Dependencies, tooling, docs | — |
| `hotfix/<name>` | Critical production fixes | Production (after fast merge) |

**Rules:**
- Always branch from `main`
- Never commit directly to `main` or `staging`
- Keep branches short-lived — merge or close within 2 weeks
- Delete branches after merge

```bash
# Create a feature branch
git checkout main
git pull origin main
git checkout -b feature/ai-streaming-responses
```

---

## Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <short summary>

[optional body]

[optional footer: BREAKING CHANGE or closes #issue]
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, whitespace (no logic change) |
| `refactor` | Code restructuring (no feature or bug) |
| `test` | Adding or updating tests |
| `chore` | Build tooling, dependencies, CI |
| `perf` | Performance improvement |

### Scopes

`auth` · `meeting` · `team` · `channel` · `chat` · `ai` · `task` · `notification` · `recording` · `media` · `export` · `analytics` · `socket` · `ui` · `api` · `infra` · `docs`

### Examples

```
feat(ai): add streaming response support for assistant endpoint
fix(auth): correct refresh token cookie path on logout
docs(api): document recording and media endpoints
chore(deps): upgrade socket.io to 4.8.1
test(meeting): add integration tests for meeting invite flow
```

---

## Development Workflow

```bash
# 1. Create branch
git checkout -b feature/my-feature

# 2. Make changes

# 3. Lint before committing
cd server && npm run lint
cd client && npm run lint

# 4. Type check
cd client && npx tsc --noEmit

# 5. Run tests
cd server && npm test

# 6. Commit
git add .
git commit -m "feat(scope): description"

# 7. Push
git push origin feature/my-feature

# 8. Open pull request on GitHub
```

---

## Coding Conventions

### Backend (TypeScript / Node.js)

**Controller pattern — thin, no business logic:**
```typescript
export const createMeeting = asyncHandler(async (req: Request, res: Response) => {
  const meeting = await meetingService.create(req.user._id, req.tenantId, req.body);
  return ApiResponse.created(res, meeting, 'Meeting created');
});
```

- All controllers use `asyncHandler` — no try/catch blocks
- All errors use `ApiError.badRequest()`, `ApiError.unauthorized()`, etc.
- All responses use `ApiResponse.success()` or `ApiResponse.created()`
- Business logic lives in services — controllers are HTTP adapters only
- DB queries live in repositories — services never call Mongoose directly
- Constants are imported from `src/constants/index.ts` — never hardcode strings
- Every mutation route has a Joi validator in `src/validators/`

**Validation example:**
```typescript
// validators/task.validator.ts
export const createTask = Joi.object({
  title:      Joi.string().min(1).max(200).required(),
  status:     Joi.string().valid(...Object.values(TASK_STATUS)).default('todo'),
  priority:   Joi.string().valid(...Object.values(TASK_PRIORITY)).default('medium'),
  dueDate:    Joi.date().iso().optional(),
  assignedTo: Joi.string().hex().length(24).optional(),
  meeting:    Joi.string().hex().length(24).optional(),
});
```

**Repository pattern:**
```typescript
// repositories/task.repository.ts extends BaseRepository
export class TaskRepository extends BaseRepository<ITask> {
  constructor() { super(Task); }

  findByTenant(tenantId: string, filters = {}) {
    return this.model.find({ tenantId, ...filters }).lean();
  }
}
```

### Frontend (TypeScript / React)

- All API calls go through modules in `src/api/` — never call axios directly in components
- Server state uses React Query — client state uses Redux Toolkit or Zustand
- All routes are defined in `src/app/router.tsx` — never scatter routes in components
- Protected pages use `ProtectedRoute` component
- Components use named exports, not default exports (except pages)
- Use `clsx` / `tailwind-merge` for conditional class names

**API module pattern:**
```typescript
// api/task.api.ts
export const taskApi = {
  list: ()                => api.get<Task[]>('/tasks'),
  create: (data: CreateTaskDto) => api.post<Task>('/tasks', data),
  update: (id: string, data: Partial<Task>) => api.put<Task>(`/tasks/${id}`, data),
  delete: (id: string)    => api.delete(`/tasks/${id}`),
};
```

**Hook pattern (React Query):**
```typescript
// hooks/useTask.ts
export const useTasks = () =>
  useQuery({ queryKey: ['tasks'], queryFn: () => taskApi.list() });

export const useCreateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: taskApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
};
```

### General

- No magic numbers — use constants
- No commented-out code in PRs
- No `console.log` — use the Winston logger (backend) or remove (frontend)
- No `// @ts-nocheck` in new files
- Import order: external packages → internal absolute → relative

---

## Testing Requirements

### Backend

Every new endpoint or service method requires a test. Tests live in `server/tests/`.

```bash
cd server

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

**Test file naming:** `<feature>.test.ts`

**Minimum coverage expectations:**
- Services: 80%+
- Controllers: covered via integration tests
- Utilities: 90%+

**Test structure:**
```typescript
describe('POST /api/v1/tasks', () => {
  it('creates a task for authenticated user', async () => {
    const token = await loginAndGetToken();
    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Test task', status: 'todo' });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Test task');
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app).post('/api/v1/tasks').send({ title: 'Test' });
    expect(res.status).toBe(401);
  });
});
```

### Frontend

```bash
cd client

npm run lint           # ESLint — must pass with 0 errors
npx tsc --noEmit       # TypeScript — must pass with 0 errors
npm run build          # Production build — must succeed
```

> A Vitest unit test suite is not yet configured. When it is added, all new components and hooks will require tests. Track progress in [RELEASE_NOTES.md](RELEASE_NOTES.md).

---

## Pull Request Process

### Before opening a PR

- [ ] Branch is up to date with `main` (`git rebase main`)
- [ ] `npm run lint` passes in both `server/` and `client/`
- [ ] `npx tsc --noEmit` passes in `client/`
- [ ] `npm test` passes in `server/`
- [ ] New endpoints are documented in `docs/API.md`
- [ ] New environment variables are documented in `docs/ENV_VARIABLES.md`
- [ ] No secrets or credentials in any committed file

### PR description template

```markdown
## What this changes
<!-- 1-3 sentence summary -->

## Why
<!-- Link to issue or brief context -->

## How to test
<!-- Steps a reviewer can follow to verify this works -->

## Checklist
- [ ] Lint passes
- [ ] Tests pass (or new tests added)
- [ ] API docs updated (if applicable)
- [ ] ENV docs updated (if applicable)
- [ ] No breaking changes (or breaking changes documented)
```

### Review requirements

- At least **1 approval** from a maintainer before merging
- All CI checks must be green
- No unresolved review comments
- Squash merge preferred for feature branches (keeps `main` history clean)

### Merge policy

| Branch target | Strategy |
|---------------|----------|
| `main` | Squash merge |
| `staging` | Merge commit |
