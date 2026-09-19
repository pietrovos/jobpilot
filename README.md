# JobPilot

JobPilot is a self-hosted job application tracker built with Next.js, Prisma,
and SQLite. It keeps applications, notes, interviews, email logs, and documents
in one place. The data stays on the machine or server running the application.

The dashboard supports search, filters, custom sorting, archiving, and recovery
of deleted applications. Each application has its own status history, notes,
interview rounds, offer details, and attachments. Documents can also be stored
once and linked to several applications.

You can try the application as a guest before creating an account. Signing up
moves the guest workspace into the new account in a database transaction, so a
partial transfer cannot leave records split between owners.

## Running it with Docker

Docker Compose sets up Node, SQLite, and persistent storage for the database and
uploads:

```bash
docker compose up --build
```

Open http://localhost:3000 and create an account. To delete the local Docker
data, run `docker compose down --volumes`.

## Running it locally

The project uses Node 24.21.0, recorded in `.nvmrc`.

```bash
nvm use
npm ci
cp .env.example .env
npm run prisma:generate
npm run db:deploy
npm run dev
```

Set `DATABASE_URL` in `.env` to an absolute SQLite URL, such as
`file:/home/you/projects/jobpilot/dev.db`. Uploaded files go in `uploads/`.
Git ignores both locations because they can contain private information.

## How it is put together

JobPilot uses the Next.js App Router and React for the interface. Server Actions
handle changes to application data, and Prisma queries scope records to the
current account. Private files are returned through authenticated route
handlers instead of being placed in a public directory.

The job-page importer accepts configured HTTPS hosts only. It checks redirects,
rejects private IPv4 targets, pins the resolved connection, and limits response
size and duration. Uploaded images are decoded and written back in a known
format. PDFs and text files are always served as downloads.

The application is designed for one Node process with persistent local storage.
See [deployment](docs/deployment.md) for that setup. The
[demo capture guide](docs/demo-capture.md) explains how to seed fictional data
for screenshots or a recording.

## Tests and checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm audit --audit-level=moderate
```

The backend tests create temporary SQLite databases. They cover migrations,
ownership rules, guest transfer, soft deletion, uploads, private file delivery,
and URL-fetch restrictions. Playwright runs the main workflows in desktop and
mobile Chromium, including authentication, applications, notes, documents,
attachments, account settings, and guest conversion.

GitHub Actions runs the same lint, type-check, test, build, browser-test, and
dependency-audit steps on each change.

Other useful commands:

| Command | Purpose |
| --- | --- |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:seed:demo` | Seed an empty database with fictional demo data |
| `npm run maintenance:cleanup` | Report expired records and orphaned files |

## Security limits

Passwords are hashed, session tokens are stored as hashes, and production
cookies are HTTP-only and secure. Authenticated database queries and file routes
check record ownership. SQLite triggers also enforce ownership and storage
quotas at the database layer.

Uploads have type and size limits. Raster images can be previewed after they are
decoded and rewritten; PDFs are not sanitized. Authentication, guest creation,
imports, and uploads have rate limits. Guest workspaces expire after 24 hours,
and deleted applications remain recoverable for 30 days.

Email verification and password recovery are not implemented. A real deployment
still needs HTTPS, monitoring, host-level resource limits, and tested backups.
SQLite and local uploads also rule out ephemeral or multi-replica hosting.

Planned work is listed in [development notes](docs/polish-roadmap.md).
