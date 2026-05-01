# 🤝 Contributing — Sentinel Tour

Thank you for considering a contribution to Sentinel Tour! This document outlines the workflow, code standards, and review process to keep the codebase clean and the team productive.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Branch Strategy](#branch-strategy)
3. [Commit Conventions](#commit-conventions)
4. [Code Style](#code-style)
5. [Testing Requirements](#testing-requirements)
6. [Pull Request Process](#pull-request-process)
7. [Folder Ownership](#folder-ownership)
8. [Reporting Bugs](#reporting-bugs)

---

## Getting Started

1. Fork the repository (external contributors) or clone directly (team members)
2. Follow the [Setup Guide](setup-guide.md) to get a working local environment
3. Create a feature branch from `main` (see Branch Strategy below)
4. Make your changes, write tests, and commit
5. Open a Pull Request against `main`

---

## Branch Strategy

We follow a simplified **GitHub Flow**:

```text
main  ← always deployable, protected branch
  └── feature/short-description       ← new features
  └── fix/short-description           ← bug fixes
  └── docs/short-description          ← documentation only
  └── chore/short-description         ← dependencies, tooling, config
  └── refactor/short-description      ← code restructuring (no behaviour change)
```

### Rules

- Never push directly to `main` — all changes go through PRs
- Branch names are lowercase with hyphens: `feature/geofence-alert-cooldown`
- Delete branches after they are merged
- Keep PRs small and focused — one logical change per PR

---

## Commit Conventions

We follow **Conventional Commits** for clean, machine-readable history:

```text
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

### Types

| Type | When to use |
| ------ | ------------ |
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only changes |
| `style` | Formatting, no logic change |
| `refactor` | Code change that is neither a fix nor a feature |
| `test` | Adding or fixing tests |
| `chore` | Build process, dependency updates, CI |
| `perf` | A code change that improves performance |

### Scopes

Use the folder name as scope: `backend`, `ai_engine`, `frontend`, `iot`, `blockchain`, `mqtt_ingestion`, `devops`, `docs`

### Examples

```text
feat(backend): add geo-fence breach webhook endpoint
fix(ai_engine): correct shapely polygon CRS handling for Southern hemisphere
docs(readme): update quick start with Firebase setup step
chore(backend): upgrade FastAPI to 0.115.0
test(mqtt_ingestion): add unit tests for Kafka producer retry logic
```

---

## Code Style

### Python (backend, ai_engine)

- Formatter: **Ruff** (replaces Black + isort + flake8)
- Type hints: **required** for all function signatures
- Docstrings: Google style for public functions and classes
- Max line length: 100

```bash
cd backend
ruff format .
ruff check . --fix
```

CI will fail on any ruff violations.

### TypeScript (frontend)

- Formatter: **Prettier**
- Linter: **ESLint** with TypeScript rules
- No `any` types — use proper interfaces or `unknown`

```bash
cd frontend/web-dashboard
npm run lint
npm run format
```

### Go (mqtt_ingestion)

- Formatter: `gofmt` (run automatically by `golangci-lint`)
- Linter: `golangci-lint`

```bash
cd mqtt_ingestion
golangci-lint run
```

### C++/C (iot)

- Follow Arduino/PlatformIO community style
- Use `clang-format` with the project's `.clang-format` config

### Solidity (blockchain)

- Follow [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- Use `solhint` for linting

---

## Testing Requirements

All PRs must include appropriate tests. CI will block merge if coverage drops.

### Coverage Targets

| Module | Minimum Coverage |
| -------- | ----------------- |
| `backend` | 75% |
| `ai_engine` | 70% |
| `mqtt_ingestion` | 70% |
| `blockchain` | 80% (contract logic) |
| `frontend` | 60% (component tests) |

### Running Tests

```bash
# Backend
cd backend && pytest tests/ -v --cov=app --cov-fail-under=75

# AI Engine
cd ai_engine && pytest tests/ -v --cov=app

# MQTT Ingestion
cd mqtt_ingestion && go test ./... -cover

# Frontend
cd frontend/web-dashboard && npm run test

# Blockchain
cd blockchain && npx hardhat test
```

---

## Pull Request Process

### Before Opening a PR

- [ ] Branch is up to date with `main` (`git rebase main`)
- [ ] All tests pass locally
- [ ] Linter passes with no errors
- [ ] New environment variables documented in `.env.example`
- [ ] README updated if the PR changes setup steps or folder structure
- [ ] No secrets, credentials, or `.env` files committed

### PR Template

When you open a PR, fill in:

```markdown
## Summary
What does this PR do? Link to issue if applicable.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Refactor
- [ ] Chore

## Testing
How was this tested? What test cases were added?

## Screenshots (if UI change)

## Checklist
- [ ] Tests pass
- [ ] Linter passes
- [ ] Docs updated
- [ ] No secrets committed
```

### Review Process

- PRs require **1 approval** from a team member before merging
- The CI pipeline must be green (lint + tests + build)
- Reviewer leaves comments; author resolves and re-requests review
- Merge with **Squash and Merge** to keep `main` history clean

---

## Folder Ownership

| Folder | Primary Owner | Reviewer |
| -------- | -------------- | --------- |
| `backend/` | Backend team | All |
| `ai_engine/` | AI/ML team | Backend team |
| `frontend/` | Frontend team | All |
| `iot/` | Hardware team | Backend team |
| `blockchain/` | Blockchain team | Backend team |
| `mqtt_ingestion/` | Backend team | DevOps |
| `devops/` | DevOps | All |
| `docs/` | All | All |

---

## Reporting Bugs

Open a GitHub Issue with:

1. **Title**: Clear one-line description (e.g., `SOS endpoint returns 500 when lat/lng is null`)
2. **Steps to Reproduce**: Numbered list
3. **Expected Behaviour**: What should happen
4. **Actual Behaviour**: What actually happens
5. **Environment**: OS, Docker version, branch/commit
6. **Logs**: Relevant container logs (`docker compose logs <service>`)

For security vulnerabilities, do **not** open a public issue — email the maintainers directly.
