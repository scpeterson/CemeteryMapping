# Changelog

This project uses semantic application versions and GitHub releases. Each release should describe user-facing changes, database migrations, data repair scripts, and verification notes.

## Unreleased

### Added

- Version metadata is exposed through the UI environment badge, `/api/version`, and `/api/health`.
- Release preparation scripts can bump `package.json` without creating a git tag.
- Historic lot map observations can be staged as auditable gravesite evidence before any lot assignment promotion.

### Database

- Added `historic_lot_map_gravesite_evidence` for reviewable Section C lot and passageway observations from historic Trinity lot map scans.

### Operations

- Use Git tags like `v0.2.0` for app releases.
- Tag migrated databases with the same version using `APP_ENV=<env> npm run db:tag -- v0.2.0`.
