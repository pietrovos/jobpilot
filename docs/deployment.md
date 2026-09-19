# Single-Node Deployment

## Storage And Runtime

Run Node 24.21.0 on a Linux host with persistent local disk. Use exactly one application process, not clustered PM2, autoscaling replicas, NFS-backed SQLite, or an ephemeral serverless filesystem. The app uses native `better-sqlite3`; install dependencies on the target OS/architecture and Node version. Build tools may be needed if native prebuilds are unavailable.

Set `DATABASE_URL=file:/srv/jobpilot-data/jobpilot.sqlite` in a service-manager environment file readable only by the service account. The parent must exist and be writable. SQLite's journal/WAL sidecars also need writable persistent space. Set `NODE_ENV=production` at runtime. Session tokens are hashed in SQLite; the app does not consume an `AUTH_SECRET` variable.

The process working directory must be the application release root. Mount `/srv/jobpilot-data/uploads` at `<release>/uploads` or create a symlink there before startup. There is currently **no configurable uploads environment variable**. Keep all upload subdirectories (documents, application files, profile pictures, company logos) on that mount. Do not put uploads in `public/`, serve them directly with nginx, or bake them into releases. Access-controlled routes serve them. The service account also needs a writable `.next/cache`.

## Release Procedure

1. Provision an unprivileged service account, persistent storage, and a process supervisor. Install the pinned Node runtime. Obtain a reviewed release including all schema migrations.
2. Stop the existing process and block writes. Take a consistent backup of both the SQLite database and the entire uploads tree. Record the release and migration versions. Keep backups encrypted and off-host.
3. In the new release directory, attach the persistent uploads mount. Export the absolute `DATABASE_URL` and install **including dev dependencies**, because the build and Prisma migration CLI need them: `npm ci`.
4. Run `npm run deploy:prepare`. This validates writable storage directories, runs explicit Prisma generation plus the production build, and then runs `prisma migrate deploy`. It never runs `migrate dev`, resets data, or seeds. Do not start if any step fails. Build requires access to Google Fonts with the current layout.
5. Start `npm start -- --hostname 127.0.0.1 --port 3000` under the supervisor, with `NODE_ENV=production`, the same `DATABASE_URL`, and the release root as working directory. Restart on failure with backoff, not multiple workers.
6. Check `/login` over HTTPS, then create a private test account and verify login, persistence after restart, and an upload/download. Do not run the disposable E2E harness against production. Monitor logs and disk usage before reopening traffic.

`deploy:prepare` does not provision storage, install dependencies, stop/start a service, create backups, configure HTTPS, or deploy to a cloud. Those remain operator responsibilities. A build failure occurs before migration, but a migration failure still needs investigation; never blindly reset or mark migrations applied.

## Reverse Proxy

Terminate TLS at a trusted reverse proxy and expose only that proxy publicly. Forward the original Host and scheme correctly; Server Actions use origin checks. Do not add wildcard allowed origins. Production session cookies are Secure and require HTTPS outside localhost.

Apply request timeouts, connection limits, and rate limits, particularly to signup/login, guest creation, uploads, and URL-import operations. The app permits a 32 MiB Server Action body, providing multipart headroom above the 30 MiB accepted file payload. Keep the proxy limit aligned and test actual uploads. Avoid caching authenticated pages or private downloads. Basic security headers are configured in Next; a restrictive application-wide CSP needs review of current scripts/styles and external resources rather than a blind default.

## Backup And Recovery

The database holds metadata and sessions; uploads hold the bytes. A database-only backup is incomplete. For the simplest consistent backup, stop the process and copy the database plus sidecars (if present) and uploads as one snapshot. Do not copy a live SQLite file alone. For online backups, use SQLite's backup API and coordinate file writes; that automation is not supplied here.

Regularly restore a backup to an isolated host with outbound traffic disabled, run `prisma migrate status`, and verify account and attachment access. Record recovery time and acceptable data loss. A rollback after schema migration is not necessarily compatible with the prior application: restore the matched database/uploads backup and previous release if necessary, accepting loss of post-backup writes. Never use `prisma migrate reset` on production.

## Operational Gaps

No hosted deployment, TLS/proxy configuration, service unit, uptime monitor, automated backup, or restore drill has been verified by this repository. Add external health checks, alerting for errors/disk capacity, retention policies for private documents and expired sessions/guest accounts, resource limits, and host security updates before treating the instance as production-ready. SQLite and local files are an intentional single-node constraint, not a high-availability design.

## Maintenance

`GET /health` returns 200 when a database probe succeeds and 503 otherwise; it does not reveal internal paths or database errors and does not prove upload-volume health. Configure your external monitor against it.

Run `npm run maintenance:cleanup` with an absolute `DATABASE_URL` to report expired sessions, abandoned guests, expired deleted applications, and unreferenced files. To apply, first stop the app, take a consistent backup, and run `MAINTENANCE_MODE=1 npm run maintenance:cleanup -- --apply` from the release root with the persistent upload mount attached. The explicit maintenance requirement avoids deleting a file between its write and metadata commit. The script ignores symlinks and leaves unreferenced files newer than 24 hours alone. In read-only mode file counts precede any hypothetical database deletions; applied counts may therefore differ. Schedule a maintenance window rather than running this destructive mode alongside traffic.
