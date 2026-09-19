# Demo Capture Guide

This guide prepares fictional data for screenshots or a short local
walkthrough. Do not use a personal database, real employer data, or a
production deployment for portfolio material.

## Prepare The Fixture

Use Node 24.21.0 and keep the following commands in one terminal so the
temporary database location remains in the environment:

```bash
nvm use
demo_dir=$(mktemp -d)
export DATABASE_URL="file:$demo_dir/demo.sqlite"
npm ci
npm run prisma:generate
npm run db:deploy
SEED_DEMO=1 npm run db:seed:demo
npm run dev
```

Open http://localhost:3000 and sign in as `alex@example.test` with
`Demo-only-password-2026!`. These public fixture credentials only work in the
disposable database created above. The seed refuses production mode and any
database that already contains users.

## Prepare Screenshot-Only Content

The seed creates four applications in different statuses, but deliberately
does not create file bytes, notes, or interview records. Before capturing the
detail and document screens, create a disposable text fixture in the same
temporary directory:

```bash
printf '%s\n' 'Fictional JobPilot portfolio fixture. No personal data.' > "$demo_dir/fictional-resume.txt"
```

Upload that file from the Documents page. In one application detail view, add
a short fictional note or interview round. Do not use a real resume, employer
name, email, or meeting link. These additions stay in the disposable database
and disappear when you complete cleanup below.

## Suggested Capture Set

If screenshots are needed, use a 1440x900 viewport at 100% browser zoom, a
fresh browser profile, and a desktop with notifications disabled. A useful set
would include:

1. The applications dashboard, showing the four fictional records across
   different statuses.
2. An application detail view, showing a status history and the fictional note
   or interview created above.
3. The document library, showing the uploaded fictional text fixture.
4. Account settings, showing account-management controls without exposing a
   real email address, password, export, or session token.

For a short walkthrough, filter applications, open a record, change a status,
show a note or interview entry, open the document library, then show settings.
Keep the browser URL bar out of the recording and do not present the local
fixture as a public demo. Avoid showing sign-in because the fixture password is
public.

Before publishing, inspect every image or video frame for browser profiles,
local paths, extensions, system notifications, personal data, and unredacted
credentials. Label the material as using fictional data. Store source captures
outside this repository unless they have been reviewed as intentional public
assets.

## Clean Up

Stop the development server, then remove the disposable data and clear the
environment variable:

```bash
rm -rf "$demo_dir"
unset DATABASE_URL
```

Never run these cleanup commands against a normal development or production
database.
