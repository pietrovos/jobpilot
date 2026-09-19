# Development Notes

## Completed Work

- Added a reproducible Docker Compose and Dev Container environment using the
  pinned Node runtime, SQLite, persistent uploads, and Prisma migrations.
- Added skip links and keyboard-accessible application selection and detail
  controls without removing click, double-click, or drag interactions.
- Added unsaved-change warnings, interview editing, retryable mutation forms,
  and browser coverage for cancellation and failed saves.
- Added ownership constraints for application child records, linked documents,
  note folders, and guest transfers.
- Added upload, download, preview, quota, failed-write, document, and attachment
  coverage.
- Added a deterministic fictional demo seed and a safe capture guide.

## Next Improvements

- Measure dashboard performance with representative fixture data, fetch detail
  records on demand, and split the application list along feature boundaries.
- Expand action-level cross-account tests for every mutation and private-file
  route, including concurrent edits and retry behavior.
- Complete a focused accessibility review covering keyboard navigation, focus
  order, dialogs, status controls, contrast, and reduced motion.
- Extend responsive browser coverage beyond the primary desktop and mobile
  flows.
- Add optimistic concurrency handling for simultaneous edits to the same field.
- Add trusted-proxy request controls and production observability after a host
  environment is selected.

## Deployment Follow-Up

The application supports a single-node deployment with persistent SQLite and
file storage. Before using it with real data, configure HTTPS, service
supervision, resource limits, monitoring, encrypted off-host backups, and a
tested restore procedure. The [deployment guide](deployment.md) describes the
required topology and release process.
