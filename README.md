# JobPilot

JobPilot is a self-hosted job application tracker. It keeps applications,
status history, notes, interviews, email logs, and private documents in one
workspace without sending that data to a third-party tracking service.

## Features

- Search, filter, sort, archive, and restore applications.
- Record status changes, notes, interview rounds, offers, and email activity.
- Store reusable documents and per-application attachments behind
  authenticated routes.
- Start in a temporary guest workspace and transfer its contents to an account.
- Change passwords, revoke sessions, export account metadata, and delete an
  account.
- Import supported job pages through a restricted server-side fetcher, with
  manual entry as the fallback.

Keyboard-accessible application controls, unsaved-change warnings, responsive
layouts, and desktop/mobile browser tests cover the main workflow.

## Setup

### Docker

Docker Compose provides Node, SQLite, and persistent volumes for the database
and uploads:

```bash
docker compose up --build
```

Open http://localhost:3000 and create an account. To remove the local Docker
data, run `docker compose down --volumes`.

### Local

Use Node 24.21.0 from `.nvmrc`:

```bash
nvm use
npm ci
cp .env.example .env
npm run prisma:generate
npm run db:deploy
npm run dev
```

Set `DATABASE_URL` in `.env` to an absolute SQLite URL, for example
`file:/home/you/projects/jobpilot/dev.db`. Uploads are written to `uploads/`.
Both locations contain private data and are ignored by Git.

## Architecture

JobPilot uses Next.js App Router, React, TypeScript, Prisma, SQLite, and local
file storage. Server Actions handle mutations, Prisma queries are scoped to the
current owner, and private files are streamed through authenticated route
handlers. The design targets one Node process with persistent local disk.

Remote imports only allow configured HTTPS hosts. They revalidate redirects,
reject private IPv4 targets, pin resolved connections, limit response sizes,
and enforce a timeout. Uploaded images are decoded and re-encoded before
storage; PDFs and text files are treated as downloads rather than trusted
content.

See [deployment](docs/deployment.md) for the single-node production topology
and [demo capture](docs/demo-capture.md) for creating portfolio material with
fictional data.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Generate route types and check TypeScript |
| `npm test` | Run backend and database tests with temporary SQLite databases |
| `npm run build` | Generate Prisma Client and create a production build |
| `npm run test:e2e` | Run Chromium desktop and mobile tests |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:seed:demo` | Seed an empty database with fictional demo data |
| `npm run maintenance:cleanup` | Report expired records and orphaned files |

GitHub Actions runs linting, type checks, backend tests, a production build,
Playwright, and `npm audit`. Dependabot groups framework and Prisma updates.

## Tests

Backend tests use isolated temporary databases and cover schema constraints,
ownership filters, guest transfer, soft deletion, upload validation, private
file delivery, and URL-fetch policies. Playwright covers authentication,
application management, notes, documents, attachments, account controls, and
guest conversion on desktop and mobile Chromium.

Run the local verification sequence with:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm audit --audit-level=moderate
```

## Security And Limits

- Passwords are hashed, session tokens are stored as hashes, and production
  cookies are secure and HTTP-only.
- Uploads are limited by type and size. Private responses use no-store headers;
  raster images may preview inline, while PDFs are not sanitized.
- SQLite triggers enforce application and storage quotas. Rate limits cover
  authentication, guest creation, imports, and uploads.
- Guest workspaces expire after 24 hours. Deleted applications remain
  recoverable for 30 days.
- Email verification and password recovery are not configured.
- SQLite and local uploads require a single-node deployment with coordinated
  backups. Multi-replica and ephemeral serverless deployments are unsupported.
- A production operator must provide HTTPS, monitoring, tested backup and
  restore procedures, host-level resource limits, and an appropriate privacy
  policy before accepting real user data.

Current engineering priorities are tracked in
[development notes](docs/polish-roadmap.md).
