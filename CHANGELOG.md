# Changelog

This project uses semantic application versions and GitHub releases. Each release should describe user-facing changes, database migrations, data repair scripts, and verification notes.

## Unreleased

### Fixed

- Align the five-lot northern Section D row with the row below; clip D-33, D-TMP14 and D-TMP13 to the cemetery boundary and prohibit gravesites and monuments in both lots (migration 497).

- Remove thirteen owner-confirmed defunct Section D temporary lots from the active map, preserving their outlines and history without changing gravesites or monuments (migration 496).

- Move A-1 through A-9 and A-30 through A-38 together one foot north, placing the fixed TLC-HS-0053 marker strictly inside A-34 while preserving lot dimensions and alignment (migration 495).

- Show a clear lot-capacity conflict when a sixth gravesite is assigned to a full lot, retaining the selected lot and existing assignments instead of displaying a generic server error.

- Upgrade the hosted TEST tunnel to cloudflared 2026.10.3 for the eMudhra certificate trust-store security fix; pin the image digest, restrict metrics to loopback, and allow graceful shutdown.

- Give the hosted API image’s copied TEST environment file to the Node runtime user so deployments built from a mode-0600 file start successfully without weakening host permissions.

- Accept the verified original migration 485 checksum after its rollback-only revision, allowing inspection deletion migration 494 to run without replaying inspection history.

- Assign gravesites to the exact selected lot using its UUID, avoiding duplicate lot numbers across sections. Reject ambiguous older requests and return clear burial-restriction messages; keep section/block hierarchy and cached assignments consistent.

- Remove the redundant Flourishes or designs field from marker information; retain face-level editing and existing marker-level notes.

- Restore Flourishes or designs on every inspection face, preserving those notes when copying, saving, editing, and clearing individual face observations.

- Fix new marker creation failing with a server error by explicitly typing provenance values passed to PostgreSQL JSON construction. Add a real database regression for default and explicitly supplied provenance.

### Added

- Add `npm run deploy:test` for CI-gated hosted TEST releases with private configuration (preserving file ownership and modes), validated backups, candidate startup/health checks, live verification, and automatic code rollback. Pending schema changes require separate rehearsal.

- Check hosted API Docker startup in CI using a mode-0600 environment file, the default Node user, and a database-backed health request.

- Reopen saved ownership records from People → Current Owner with Edit ownership. Cemetery and system admins can update all owners, deed details, and whole-lot or listed-gravesite assignments in one audited, version-checked transaction; failed saves retain the draft.

- Allow cemetery and system admins to delete inspections with confirmation and version checks. Keep photos in the marker gallery, unlink inspection photo contexts, and retain audited deletion history without source refreshes recreating the inspection (migration 494).

- Validate the complete touch-phone inspection workflow at 320px and 390px, including slow/failed uploads, required corrections, reload recovery, and nonduplicating retries; clarify filtered gallery photo counts.

- Recover account- and marker-scoped unfinished inspections after reload, retaining visit/face edits and photo metadata with explicit file reselection before save.

- Announce unsaved inspection changes, inspection save progress, pending photo retries, and completion separately.

- Use consistent uncropped photo thumbnails and concise captions, with primary and deletion actions in accessible per-photo menus.

- Compact inspection correction actions into one row and move display preferences outside the sticky panel.

- Keep gallery browsing focused on photos with one Add photos action; reveal existing-photo linking only for a selected record.

- Compact the photo gallery toolbar, collapse optional face/timing filters with an active count, and reveal full photo editing controls only when adding or linking photos.

- Replace the oversized marker form with focused inspection, marker-information, and source/review editors; organize Details into five sections and add Overview inspection summaries and quick actions.
- Unify marker, inspection, and maintenance photo browsing and controls in one gallery, preserving authenticated previews, record/face associations, primary ordering, and upload retry behavior.
- Guide inspections one face at a time, showing saved and draft photos in face cards, editors, and Review & save, with direct edit/return actions that retain drafts.
- Show missing required information before save and on workflow steps; provide focused corrections, Previous/Next navigation, a selectable keyboard-accessible issue list, and return-to-review focus.
- Keep correction controls and display reset accessible in a sticky, collapsible phone-friendly panel. Persist four display preferences through a shared settings definition used by controls, startup, saves, reset, confirmation, and counts.
- Replace the marker section button grid with a compact sticky Jump to section menu that tracks the viewed section while preserving pending edits and photos.

- Select and preview photos under each face while creating or editing an inspection. Save uploads and links them to that face; partial failures retain a retry queue without duplicating the saved inspection or completed uploads.

- Link active monument photos to the sole Front face on single-face monuments, and label existing observation photo links without copying photos into other inspections (migration 493).

- Use Front for new default monument faces and rename existing single-face monuments and their single-face inspection snapshots, preserving readings, face IDs and photo links (migration 492).

- Require at least one face on every monument and inspection. Backfill missing faces from each record’s own inscription and statuses, preserve historical readings and photo links, and prevent removal of the last face (migration 491, ADR 0110).

- Represent back-of-stone information as ordinary Front/Back face inscriptions, migrate the matching field inspection without changing NHG readings or photo links, and remove the separate back field from forms, API and reports (migration 490, ADR 0109).

- Add dated monument inspection history with independent condition, source, notes, inscriptions, and face readings. New inspections copy the selected readings without photo links; Trinity NHG visits use October 11, 2005 (migrations 479–480 and 485–489, PR #707).
- Associate monument photos with inspections or maintenance actions while retaining All monument photos. Existing 2026 field photos belong to their field inspections; gravesite previews use linked monument photos instead of a separate Gravesite Photos section (PR #707).
- Add thumbnail photo selection, selected-photo previews, explicit face and maintenance timing labels, gallery filenames, and Cancel for unsaved photo link selections (PR #708).

- Add Trinity Section B lots B-24 and B-18, plus irregular B-1 following the cemetery boundary, six feet north of B-23 (migration 419).

- Add eight Trinity Section B lots in two adjoining four-lot rows, with a six-foot gap north of B-4 (migration 418).

### Security

- Enforce cemetery assignments when deleting North Hills evidence links, including denying unassigned cemetery administrators (PR #581).
- Separate API runtime database privileges from administrative accounts in hosted TEST, local DEV, local automated TEST, and CI; add repeatable role setup and authorization regressions (PR #581).
- Update vulnerable transitive dependencies (PR #581).

### Maintenance

- Merge MapLibre GL 6.10.0, Auth0 React 2.27.0, React DOM/type updates, and Node type updates (PRs #576–#579). Source merges do not automatically update running deployments.

### Fixed

- Preserve loaded photo previews while record links refresh after uploads, with regression coverage for delayed refreshes and inspection/maintenance selection cancellation (PR #708).

- Retire the C-0425 plot-marker placeholder and imported pseudo-burial while retaining standalone marker TLC-HS-0425 and its evidence (migration 474).
- Align C-0383 3.54 inches west within schematic C-83; preserve its marker, burial and lot assignment, and record the remaining C-0384 overlap for separate review (migration 475).

- Align the two estimated DeCourcy gravesites C-0382/C-0382A 4.56 inches west inside schematic lot C-83, preserving marker coordinates, assignments, burial links, and C-0383 (migration 473).

- Shift B-21, B-15, B-4, B-14, and B-5 together one additional foot north, preserving footprints and alignment (migration 422).

- Shift the eight Section B lots B-23/B-19/B-17/B-2 and B-22/B-20/B-16/B-3 together 1.5 feet west and one foot north, preserving their footprints (migration 421).

- Shift B-24, B-18, and boundary-shaped B-1 two feet west to contain TLC-HS-0138 and TLC-HS-0139, preserving standard footprints and B-1 southern/western edge lengths (migration 420).

- Normalize Mary Mashey’s legacy combined surname before migration 415 on older TEST snapshots, preserving her burial and marker links and all TEST access records (migration 417).

- Include `cemetery-admin` and its cemetery/deed permissions in Auth0 setup; application roles and cemetery assignments remain enforced by the application database.
- Improve spacing around the Manage faces control in marker details (PR #583).

- Correct TLC-HS-0098 to link B-0092, B-0093, B-0099 and B-0100, remove the incorrect B-0094 association, and associate the Front, Left and Back faces with Nannie/F. Myrtle, Mary and William Deer respectively (migration 411).

- Retire B-0098 and its imported Deer Family Headstone pseudo-burial. Preserve family monument TLC-HS-0098, face inscriptions and photos, and real gravesite links; remove obsolete pseudo-person associations from its faces (migration 410).

- Report API startup failures accurately, including an occupied port, and release database connections before exiting instead of falsely reporting that the API is listening.

- Restored the missing NHG SNYDER/SOERGEL entry from printed page 189 (8A, 7, s) and linked it to TLC-HS-0072 and A-0072 in each existing source batch. Preserved Katherine Snyder’s existing burial details and the original OCR variant (migration 402).

- Restored the missing NHG STEELE/MEHRLICK reading on page 188, linked it to TLC-HS-0066 and both Steele gravesites, and recorded the quoted Church Records dates and Anna's reported age. Preserved OCR variants and existing burial names and dates (migration 397).

- Distinguish failed editing-option, photo, report, and saved control-point loads from empty data, with retry actions and actionable messages. Disable lookup-dependent saves until options load, label retained report results after failures, preserve place-search error guidance, and protect unreadable control-point storage from overwrite.

- Show provider-specific notices when PASDA imagery or Allegheny County parcels cannot load, with per-layer retry and Diagram view actions. Notices clear on recovery; Diagram view hides external layers.

- Show actionable API messages for connection failures, expired sessions, permissions, missing records, conflicts, and oversized photo uploads. Unexpected server errors include a reference ID recorded in system-event metadata and console logs.
- Validate marker and maintenance calendar dates and report unavailable burial selections as user-correctable errors. Announce detail-form errors accessibly and associate date errors with affected fields while preserving edits.

- Reject impossible calendar dates before saving and show field-specific validation messages without API jargon. People edits remain available for correction; partial birth and death dates are still supported.

### Added

- Add a public access-request form and global administrator review in Users. Requests grant no access until an active application user is approved; new users default to Read-only. Requires migration 416 and public-page hosting configuration (ADR 0076).

- Add B-0103A north of B-0103 for Mary (Gollmar) Mashey, retaining Amos Mashey in B-0103 and fixed TLC-HS-0103 linked to both. Owner-approved 2.4-by-10-foot estimated outlines fit between unchanged neighboring graves (migration 415, ADR 0075).

- Add B-0097A north of B-0097 for Mary Miller, retaining Johannes (John) Mülller (Miller) in B-0097 and fixed TLC-HS-0097 linked to both. Estimated boundaries avoid mapped neighboring gravesites (migration 414, ADR 0072).

- Add B-0096A north of B-0096 for Obbie Mae Deer, retaining Charles W Deer in B-0096 and fixed TLC-HS-0096 linked to both. Estimated 4-by-10-foot boundaries avoid mapped neighboring gravesites (migration 413, ADR 0071).

- Split the six Opperman burials into B-0094 and B-0094A–E around fixed TLC-HS-0094. Caroline and Ida are east of the monument; Carl, Anna, Mary and William are west. Preserve faces, photos and burial details; boundaries and within-group order are estimated (migration 412, ADR 0070).

- Added multiple labeled faces per marker, with separate inscriptions, notes, linked people, and photos. Existing inscriptions migrate to Unspecified face; ordinary inscription entry needs no face setup. Face-assigned photos display once with their controls, and face edits detect stale saves. Requires migration 409.

- Added A-0085A north of A-0085 for Lena G Ringeisen, retaining Andrew G Ringeisen in the southern gravesite and the fixed TLC-HS-0085 marker spanning both (migration 408). The estimated boundary overlap with A-0086 is documented in ADR 0068.

- Added historical U.S. Navy Fireman First Class (F1c) to military rank options with no assigned modern pay grade (migration 407).

- Added A-0081A north of A-0081 for Charlotte M Balz, retaining William J Balz in the southern gravesite and the fixed TLC-HS-0081 marker spanning both (migration 406). Estimated boundary overlaps are documented in ADR 0067.

- Added A-0078A north of A-0078 for Corinne E Dozer, retaining Charles E Dozer in the southern gravesite and the fixed TLC-HS-0078 marker spanning both (migration 405). Estimated boundary overlaps are documented in ADR 0066.

- Added Prefix / Title to People records for names such as Reverend John Smith, and renamed Title / Credentials to Suffix / Credentials (migration 404). Prefixes appear before names in the app, search, and reports.

- Added A-0077A north of A-0077 for Mildred Frampton, retaining William Walker Frampton in the southern gravesite and the fixed TLC-HS-0077 marker spanning both (migration 403). Estimated boundary overlaps are documented in ADR 0065.

- Added A-0070A north of A-0070 for Marion Milford Brady, retaining Charles M Brady in the southern gravesite and the fixed TLC-HS-0070 marker spanning both (migration 401). Estimated boundary overlaps are documented in ADR 0063.

- Added A-0069A north of A-0069 for Bertha M Blend, retaining Henry L Blend in the southern gravesite and the fixed TLC-HS-0069 marker spanning both (migration 400). Small estimated boundary overlaps are documented in ADR 0062.

- Added explicit given-name status and an optional descriptive display name to burial records (migration 399). The People tab distinguishes confirmed no given name from unknown information; display names appear in search and reports without changing structured names or marker inscriptions.

- Added A-0067A north of A-0067 for Bertie I Steele, retaining George H Steele in the southern gravesite and the fixed TLC-HS-0067 marker spanning both (migration 398). Estimated boundary overlaps are documented in ADR 0061.

- Added A-0066A north of A-0066 for Anna S Steele, retaining Wilbert B Steele in the southern gravesite and the fixed TLC-HS-0066 marker spanning both (migration 396). Small estimated boundary overlaps are documented in ADR 0059.

- Added A-0057A north of A-0057 for Almira C Alexander, retaining Clyde R Alexander in the southern gravesite and the fixed TLC-HS-0057 marker spanning both (migration 395). Estimated boundary overlaps are documented in ADR 0058.

- Added A-0049A north of A-0049 for Eleanor H Elser, retaining William G Elser in the southern gravesite and the fixed TLC-HS-0049 marker spanning both (migration 394). Estimated boundary overlaps are documented in ADR 0057.

- Added A-0048A north of A-0048 for Malinda C Scott, retaining Charles D Scott in the southern gravesite and the fixed TLC-HS-0048 marker spanning both (migration 393). Estimated southern boundary overlaps are documented in ADR 0056.

- Added A-0044A north of A-0044 for Beulah M Scott, retaining Freeman Paul Scott in the southern gravesite and the fixed TLC-HS-0044 marker spanning both (migration 392). Estimated boundary overlaps are documented in ADR 0055.

- Added reserved A-0006A north of A-0006 for Patricia Scott, preserving her pre-need inscription status and the fixed TLC-HS-0006 marker spanning both Scott gravesites (migration 391). Herb remains in A-0006; estimated boundary overlaps are documented in ADR 0054.

- Added A-0041A north of A-0041 for Nettie Schnabel while retaining Philip Schnabel Jr. in the southern gravesite and the fixed TLC-HS-0041 marker spanning both (migration 390). Small estimated boundary overlaps are documented in ADR 0053.

- Added A-0038A and TLC-HS-0038A north of James H Crea for Ella R Pfeiffer, with separate burial links and a common-base marker relationship (migration 389). Original marker and gravesite geometry are preserved; new placement is estimated.

- Added a saved primary-photo choice per marker or gravesite. Primary photos lead galleries and Overviews; removing the choice restores newest-first sorting. Includes migration 379.

- Added read-only gravesite and marker Overviews with the latest available photo or an explicit no-photo message, associated people, permitted current-owner information, and links to related records. Overview opens by default on every feature selection, including repeat selections.

- Added phone Search/Map/Details navigation, search progress/retry/fallback feedback, and accessible filter/selection states.
- Added shared UI controls, labeled fields, feedback, and confirmations; standardized dialog keyboard focus and Escape behavior.
- Added in-memory draft protection for tracked record and administration editors, including guarded record switching and page-exit warnings.
- Added concurrent gravesite-edit detection with explicit reload/reconciliation and regression coverage for delayed saves.
- Added interrupted media-upload reconciliation with preview mode and retention of referenced evidence.
- Expanded HTTP, database, keyboard, dialog, mobile, and responsive screenshot regression coverage.

- Added an optional burial information-source URL, including safe web-link validation and a direct source link in burial details.
- Added a full-history photo gallery modal so older gravesite and marker photos remain accessible after the inline preview reaches four images.
- Added the World War II U.S. Army rank `Technician Fifth Grade` (`T/5`) to the controlled military-rank data.
- Added structured multi-owner deed entry with separate names, addresses, optional shares, grantor/grantee roles, mixed lot and gravesite rights, and visual `From → To` transfer history.
- Added removal of an incorrect direct owner-to-gravesite connection while preserving the remaining ownership event and audit history.
- Added cemetery-admin controls to assign, change, or unlink a gravesite's explicit lot relationship without moving its geometry.
- Added deed-registry assisted fill for ownership entry, including source references, remarks, dates, deed-file flags, owner names, and available addresses.
- Added an Unowned Gravesites report that excludes both directly owned gravesites and gravesites covered by current whole-lot ownership.
- Added display and editing of imported deed-registry last-known dates while preserving the original spreadsheet value.
- Added editing of imported deed-registry remarks while preserving the original spreadsheet value.
- Preserve year-only deed-registry dates instead of inventing January 1, including Roy Soergel's recorded `1944` value.
- Added reusable military decorations for burials, seeded with Purple Heart and Bronze Star Medal, plus a labeled Purple Heart badge and the Navy `MM2` rating.
- Added a burial name suffix/title field for professional credentials and post-nominal titles such as `M.D.`.
- Version metadata is exposed through the UI environment badge, `/api/version`, and `/api/health`.
- Release preparation scripts can bump `package.json` without creating a git tag.
- Historic lot map observations can be staged as auditable gravesite evidence before any lot assignment promotion.
- Lot polygons render above gravesites with transparent orange styling and section-lot labels.
- Added memorial-plaque grave features, including a government-issued veteran plaque subtype.
- Added repeatable vase grave features so each physical vase can be recorded independently on a marker or gravesite.

### Changed

- Updated Auth0 React to 2.25.0, MapLibre GL JS to 6.9.1, Lucide React to 1.46.0, and Node.js type definitions to 26.5.1. The CI runtime remains Node.js 24; TypeScript remains 6.0.3.
- Expanded People editing, name data-model, and error-recovery guidance; refreshed the dependency inventory and restored documentation-site navigation through ADR 0068.

- Updated Auth0 React to 2.24.1, MapLibre GL JS to 6.8.0, Playwright to 1.63.0, and `eslint-plugin-react-refresh` to 0.5.6.

- Automatically scope non-admin users to their one registered cemetery and zoom there; only system admins can choose a cemetery.
- Added a system-admin cemetery selector that narrows search and map records, single-status filtering and filter reset, and visible search guidance.
- Wrapped detail tabs with a full Maintenance label, made the map legend collapsible, softened aerial imagery, and fitted phone workspaces to the available screen height.
- Fixed the first gravesite selection so it zooms to the selected record.

- Consolidated the application title, cemetery count, Reports/Control/Admin actions, and account controls in the header, with a Menu for application actions on phones.
- Restored the six distinct status colors in search badges to match the filters and map legend.
- Moved gravesite record and lot-assignment editing to Location and standalone marker editing to Details, keeping Overview read-only.

- Moved signed-in account controls into a dedicated header so they cannot overlap map actions or phone navigation; sign-out now checks tracked unsaved drafts. Added authenticated-layout and report-print regression coverage.

- Coordinated map actions in a wrapping toolbar, separated zoom controls, and moved measurement feedback into toolbar flow.
- Split large detail and administration views into focused components; centralized common design tokens and moved report/control-point styles alongside their components.
- Protected media downloads with reader authentication and active-asset checks; galleries and reports now fetch protected photos with authentication. Uploads and downloads share the configured media directory.
- Hardened media failure cleanup, preserved expected API error statuses, and added bounded graceful API shutdown.
- Centralized audited transaction handling and canonical marker cemetery resolution across repository consumers.
- Updated operational and developer documentation for navigation, drafts, conflicts, media recovery, and deployment behavior. Photo-viewer backdrop clicks no longer dismiss the dialog.

- Limited inline photo galleries to four images and ordered them newest first by date taken, falling back to upload date.
- Clarified that the deed ownership event supports both newly issued deeds and historical deeds entered later.
- Prevented a conflicting whole-lot ownership event when a gravesite in the lot already has a different direct owner.
- Refined the Owner Holdings report to show a single cemetery beneath the title, omit its repeated Cemetery column, and show ownership Remarks instead of the internal Source label.
- Upgraded React and React DOM together to 19.2.8.
- Upgraded the Auth0 React SDK to 2.22.0 and `@auth0/auth0-spa-js` to 2.23.0.
- Upgraded MapLibre GL JS to 6.0.0 and migrated map code to its ESM namespace imports.
- Excluded MapLibre from Vite dependency optimization so its relative ESM worker loads from the package distribution instead of a missing `.vite/deps` path.
- Upgraded `@emnapi/runtime` to 1.11.2.
- Upgraded the Auth0 React SDK to 2.22.1, MapLibre GL JS to 6.1.0, Playwright to 1.62.1, ESLint to 10.8.0, and `jekyll-relative-links` to 0.8.0.

### Database

- Retired imported placeholder gravesite `A-0017` and its generated `Burgess Monolith` pseudo-burial; family monument `TLC-HS-0017` remains active as a standalone monolith and retains both marker photos.
- Split reviewed Trinity shared-marker gravesites `C-0392`, `C-0395`, `C-0398`, `C-0401`, `C-0402`, `C-0403`, `C-0409`, `C-0410`, `C-0413`, `C-0416`, `C-0419`, and `C-0420`; each original identifier remains with the southern burial, each new `A` gravesite contains the northern burial, and every observed marker remains fixed while spanning both gravesites.
- Corrected the `C-0392A` Kaelin placement so Elizabeth A Kaelin is immediately north of Elmer B Kaelin in `C-0392`.
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
