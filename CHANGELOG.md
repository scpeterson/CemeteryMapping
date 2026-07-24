# Changelog

This project uses semantic application versions and GitHub releases. Each release should describe user-facing changes, database migrations, data repair scripts, and verification notes.

## Unreleased

### Added

- Version metadata is exposed through the UI environment badge, `/api/version`, and `/api/health`.
- Release preparation scripts can bump `package.json` without creating a git tag.
- Historic lot map observations can be staged as auditable gravesite evidence before any lot assignment promotion.
- Lot polygons render above gravesites with transparent orange styling and section-lot labels.

### Changed

- Upgraded React and React DOM together to 19.2.8.
- Upgraded the Auth0 React SDK to 2.22.0 and `@auth0/auth0-spa-js` to 2.23.0.
- Upgraded MapLibre GL JS to 6.0.0 and migrated map code to its ESM namespace imports.
- Excluded MapLibre from Vite dependency optimization so its relative ESM worker loads from the package distribution instead of a missing `.vite/deps` path.
- Upgraded `@emnapi/runtime` to 1.11.2.

### Database

- Added `historic_lot_map_gravesite_evidence` for reviewable Section C lot and passageway observations from historic Trinity lot map scans.
- Added reviewed Trinity Section C lot `70` from the perimeter of gravesites `C-0168`, `C-0167A`, `C-0167B`, `C-0166A`, and `C-0166B`.
- Added reviewed Trinity Section C lot `51` from the perimeter of gravesites `C-0171A`, `C-0171B`, `C-0170`, `C-0169`, and new available gravesite `C-51-0168A`.
- Shifted passageway gravesites `C-0172A` and `C-0172B` 2 feet north while leaving shared headstone `TLC-HS-0172` unmoved for later verification.
- Added reviewed Trinity Section C lot `29` 2 feet north of the `C-0172A` passageway gravesite, with no gravesites assigned yet.
- Added reviewed Trinity Section C lot `10` directly north of lot `29`, with no gravesites assigned yet.
- Split Trinity gravesite `C-0257`: James M Sarver remains in the original southern gravesite, Margaret E Sarver is assigned to new northern `C-0257A`, and fixed marker `TLC-HS-0257` spans both.
- Split Trinity gravesite `C-0258`: Walter H Schuessler remains in the original southern gravesite, Armella M Schuessler is assigned to new northern `C-0258A`, and fixed marker `TLC-HS-0258` spans both.

### Operations

- Use Git tags like `v0.2.0` for app releases.
- Tag migrated databases with the same version using `APP_ENV=<env> npm run db:tag -- v0.2.0`.
