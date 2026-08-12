# Changelog

This project uses semantic application versions and GitHub releases. Each release should describe user-facing changes, database migrations, data repair scripts, and verification notes.

## Unreleased

### Added

- Added display and editing of imported deed-registry last-known dates while preserving the original spreadsheet value.
- Added reusable military decorations for burials, seeded with Purple Heart and Bronze Star Medal, plus a labeled Purple Heart badge and the Navy `MM2` rating.
- Added a burial name suffix/title field for professional credentials and post-nominal titles such as `M.D.`.
- Version metadata is exposed through the UI environment badge, `/api/version`, and `/api/health`.
- Release preparation scripts can bump `package.json` without creating a git tag.
- Historic lot map observations can be staged as auditable gravesite evidence before any lot assignment promotion.
- Lot polygons render above gravesites with transparent orange styling and section-lot labels.
- Added memorial-plaque grave features, including a government-issued veteran plaque subtype.
- Added repeatable vase grave features so each physical vase can be recorded independently on a marker or gravesite.

### Changed

- Upgraded React and React DOM together to 19.2.8.
- Upgraded the Auth0 React SDK to 2.22.0 and `@auth0/auth0-spa-js` to 2.23.0.
- Upgraded MapLibre GL JS to 6.0.0 and migrated map code to its ESM namespace imports.
- Excluded MapLibre from Vite dependency optimization so its relative ESM worker loads from the package distribution instead of a missing `.vite/deps` path.
- Upgraded `@emnapi/runtime` to 1.11.2.
- Upgraded the Auth0 React SDK to 2.22.1, MapLibre GL JS to 6.1.0, Playwright to 1.62.1, ESLint to 10.8.0, and `jekyll-relative-links` to 0.8.0.

### Database

- Added audited in-application editing of `ModernSection` and corrected lot-number mappings for imported `Original 2017` and `Updated 2022` deed registry rows while preserving original spreadsheet values.
- Added an explicit unknown-or-not-applicable interment type so pre-need and unverified records no longer need a provisional casket classification.
- Added a reusable fail-fast prerequisite assertion for data migrations so missing source records cannot silently produce successful zero-row changesets.
- Added transactional integration coverage for the Gropp gravesite split and Eckendahl field-photo migration, including resulting statuses and marker relationships.
- Replaced the blanket Trinity gravesite-overlap suppression with audited, exact-match spatial validation exceptions so newly introduced overlaps fail validation.
- Added the field-verified pink-granite Eckendahl marker between `TLC-HS-0328` and `TLC-HS-0329`, with separate estimated spaces for Bruce W. Eckendahl and Terry M. Eckendahl; Terry's record is explicitly pre-need.
- Split Trinity gravesite `C-0156`: Manfred Joseph Gropp remains in the unchanged original gravesite, Alice J. Gropp is assigned to new northern `C-0156A`, and fixed marker `TLC-HS-0156` spans both.
- Added `black_granite` as a controlled marker material type.
- Added `historic_lot_map_gravesite_evidence` for reviewable Section C lot and passageway observations from historic Trinity lot map scans.
- Added reviewed Trinity Section C lot `70` from the perimeter of gravesites `C-0168`, `C-0167A`, `C-0167B`, `C-0166A`, and `C-0166B`.
- Added reviewed Trinity Section C lot `51` from the perimeter of gravesites `C-0171A`, `C-0171B`, `C-0170`, `C-0169`, and new available gravesite `C-51-0168A`.
- Shifted passageway gravesites `C-0172A` and `C-0172B` 2 feet north while leaving shared headstone `TLC-HS-0172` unmoved for later verification.
- Added reviewed Trinity Section C lot `29` 2 feet north of the `C-0172A` passageway gravesite, with no gravesites assigned yet.
- Added reviewed Trinity Section C lot `10` directly north of lot `29`, with no gravesites assigned yet.
- Split Trinity gravesite `C-0257`: James M Sarver remains in the original southern gravesite, Margaret E Sarver is assigned to new northern `C-0257A`, and fixed marker `TLC-HS-0257` spans both.
- Split Trinity gravesite `C-0258`: Walter H Schuessler remains in the original southern gravesite, Armella M Schuessler is assigned to new northern `C-0258A`, and fixed marker `TLC-HS-0258` spans both.
- Added report text-search indexes and normalized several field-photo marker records and their provenance.
- Added normalized marker scope classification and removed the obsolete Knobloch monolith pseudo-burial and placeholder gravesite.
- Split reviewed Trinity Section C gravesites `C-0266`, `C-0274`, `C-0288`, `C-0289`, `C-0290`, `C-0294`, `C-0299`, `C-0301`, `C-0306`, `C-0307`, `C-0311`, `C-0314`, `C-0317`, `C-0328`, `C-0329`, `C-0432`, and `C-0434` so separately mapped burials have distinct gravesites while shared markers retain the appropriate relationships.
- Modeled the Kummer `C-0290` common-base markers and corrected William King's name while splitting `C-0311`.
- Added reviewed Trinity Section C lots `101` through `120` and the non-standard lot rows `42A` through `73A`, `41A` through `74A`, and `39A` through `76A`.
- Added and aligned reviewed Trinity Section B lots `4` through `15` and lot `21`, including the follow-up shared-edge and position corrections recorded in migrations `281` through `292`.
- Shifted the paired Trinity Section C lot `18` gravesite rows south to their reviewed position.
- Added text-preserving ownership-event effective dates for incomplete or source-specific date values.

### Operations

- Use Git tags like `v0.2.0` for app releases.
- Tag migrated databases with the same version using `APP_ENV=<env> npm run db:tag -- v0.2.0`.
