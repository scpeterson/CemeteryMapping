---
---

# Operator Workflows

[Documentation Home](index.md)

This guide captures practical workflows for people maintaining Cemetery Mapping day to day. It complements the architecture and database reference docs by focusing on what to click, what to run, what to verify, and what not to change accidentally.

## Workflow Lifecycle

Most workflows fall into one of two phases:

- **One-time cemetery onboarding**: initial setup for a newly added cemetery, including spatial imports, source-data staging, first-pass validation, and any reviewed promotion into production tables. These workflows should be run deliberately and usually only once per cemetery/source snapshot.
- **Ongoing maintenance**: normal application operations after a cemetery is live, including user management, text edits, lookup maintenance, reading/deed evidence review, audit review, marker updates, and soft-delete/restore tasks.

For a brand-new cemetery, start with the one-time onboarding workflows, verify the map and records, then move the cemetery into ongoing maintenance mode. If a source file is later corrected or a cemetery sends a replacement GIS export, treat that as a new onboarding-style data change for that source rather than a routine maintenance edit.

## Ongoing Maintenance Workflows

### Admin User Management

Use `Admin -> Users` when adding, editing, deactivating, or reactivating application users.

1. Open `Admin -> Users`.
2. To add a user, enter the user's email address and choose the local application role.
3. If Auth0 Management API settings are configured, use the Auth0 lookup/create flow to find or create the Auth0 database user before saving the local app user.
4. Confirm the Auth0 user ID field is populated from Auth0. Do not invent this value manually unless you are copying the exact Auth0 `user_id`.
5. Select the role:
   - `reader` can view map, burial, gravesite, and marker information, but cannot see deed/owner sections.
   - `power-user` can do reader tasks and can view/edit deed-owner data and existing cemetery records for assigned cemeteries.
   - `cemetery-admin` can administer assigned cemeteries and has read-only access elsewhere.
   - `admin` can manage the whole system, including users, lookups, audit review, structural records, and deletes.
6. Assign the cemetery for `power-user` or `cemetery-admin` users. The database supports multiple assignments, but the current UI manages one assignment per user.
7. Save the user and have them sign out and back in so any Auth0 token and local role changes are reflected.
8. Use `Deactivate` when access should be blocked without deleting the Auth0 account or local history.
9. Use `Reactivate` only after confirming the user's role and cemetery assignment are still correct.

Local application roles are the authorization source for the app. Auth0 authenticates identity and may issue API permissions, but the local `app_users` row controls what the app shows and allows after login.

### Cemetery Records

Use `Admin -> Cemetery Records` for text-only cemetery hierarchy maintenance. This workflow does not edit map geometry.

1. Open `Admin -> Cemetery Records`.
2. Search for and select a cemetery. The cemetery form appears after a cemetery is selected.
3. Edit cemetery text fields such as name, full address, municipality, agency, agency URL, operational hours, contact name, contact phone, contact email, image URL, and notes.
4. Review `created_at` and `updated_at` as read-only context. They are not editable form fields.
5. Save the cemetery before moving to unrelated cemetery edits.
6. Select a section from the section picker. The picker only shows sections for the selected cemetery.
7. Edit the section name, alternate names, and notes. Enter alternate names as separate text values, such as `NA` and `New Annex`.
8. Do not try to edit the section's cemetery relationship by changing text. The cemetery relationship is maintained by IDs in the database.
9. Select a lot from the lot picker after selecting a section. The picker only shows lots for that section.
10. Edit lot text fields that are exposed in the form, then save the lot.

Sections may exist before they have geometry. A section with no geometry can still be edited in Admin, but it will not render on the map until surveyed or imported geometry is added.

### Lookup Maintenance

Use `Admin -> Lookups` to maintain controlled values such as marker types, marker materials, headstone conditions, gravesite statuses, and lot ownership event types.

1. Open `Admin -> Lookups`.
2. Choose the lookup table from the dropdown.
3. Edit user-facing labels, descriptions, sort order, active status, and source fields where applicable.
4. Keep labels clear for regular users. The hidden code remains the stable import/seed identifier and should not be exposed as the primary admin editing target.
5. Use the sort field or move controls to adjust display order. Check for duplicate sort values before saving if ordering looks odd.
6. Mark obsolete values inactive instead of deleting or repurposing them.
7. Use `Show inactive` when reviewing retired values or reactivating one.
8. Use the usage count before deactivating a value. If a value is already used by records, deactivation hides it from new choices but preserves historical data.
9. Use the audit jump link when you need to see who last changed a lookup row.

Gravesite status labels are not all manually assigned. `reserved` and `needs_review` are human workflow flags, while `occupied`, `sold`, `available`, and `unknown` are derived from active burials and current deed or ownership-right records. `sold` means the gravesite has a deed or ownership right, either directly or through its lot, but has no active burial.

Avoid renaming a lookup value to mean something unrelated. Add a new value when the meaning changes, then deactivate the old one after records are reviewed.

### Readings Review

Use `Admin -> Readings` for staged North Hills Genealogists OCR readings.

1. Open `Admin -> Readings`.
2. Select the North Hills OCR import batch to review.
3. Use confidence, status, section, search, and sort controls to narrow the staged readings. Page-order sort is useful when comparing against the printed source.
4. Open a staged reading and compare raw OCR text, parsed section/row/position, marker details, detected years, and parser notes against possible existing matches.
5. Use `Link gravesite` when the reading belongs to the candidate gravesite.
6. Use `Link headstone` when the reading belongs to the candidate physical marker.
7. Use `Reject match` or `Reject headstone` when the candidate appears incorrect.
8. Use `Needs field check` or `Field check` when the source and database do not provide enough certainty.
9. Add optional reviewer notes when prompted.
10. Open the regular grave-detail panel afterward to confirm linked North Hills evidence appears for the associated gravesite or headstone.

Readings review is an evidence workflow. It does not change burial names, dates, marker condition, owner/deed data, geometry, or lot/gravesite structure.

### Deed Evidence Review And Investigations

Use `Admin -> Deed Evidence` to review staged deed registry imports and document deed investigations before any future promotion workflow writes ownership data.

1. Open `Admin -> Deed Evidence`.
2. Use the case workbench when a person or family asks whether a deed, plot, replacement deed, marker approval, Council exception, or future burial right exists.
3. Search existing cases by case number, family, plot, requester, or findings before creating a new case.
4. Create or update the case with the subject, requester, plot reference, request summary, family or claimant notes, findings, case status, affidavit status, and outcome.
5. Add one or more recommended actions when the investigation may have several outcomes. Examples include issuing a replacement deed for one person, approving ashes in a specific plot, denying a request, documenting that no deed exists, or approving a marker.
6. For each recommended action, record the person, action type, plot or gravesite, Council status, Council decision date, Council minutes or document reference, affidavit status, deed status, notes, and final outcome.
7. Use the evidence filters to select the import batch.
8. Filter by parser confidence, evidence type, owner text, lot text, section text, remarks, family names, deed flags, parsed plot/grave identifiers, or related `Investigated` worksheet notes.
9. Review raw row text, parsed allocations, parser notes, and related `Investigated` worksheet notes.
10. Attach relevant evidence rows to the selected investigation case. Add a short note when the reason for attaching the row is not obvious.
11. When reviewing `Updated 2022`, use the comparison summary to see added, changed, unchanged, and removed rows relative to the latest `Original 2017` staging batch.
12. Treat `Lot num` or `Lot Number` values as candidate `lots.lot_id` values, not as spatial lot geometry.
13. Treat `review` or `low` confidence rows as requiring human interpretation.
14. Treat `NA`, `OC`, passageway, and Section G plot references carefully because they may not map to ordinary section/lot/gravesite assumptions.

Deed investigation cases, evidence links, and recommended actions are documentation records. They do not create lots, gravesites, legacy owners, generalized ownership parties/events/rights, or burial rows by themselves. After Council approval or a final decision, record any actual deed or ownership transfer through the ownership maintenance workflow.

The regular grave-detail panel and ownership-aware search include both legacy `owners` rows and generalized gravesite ownership rights. For example, Section G deed-holder rights imported from the plot plan appear as current owner/deed information even though Section G has no lots.

### Ownership Maintenance

Use the regular grave-detail panel to record new deeds and ownership transfers after the cemetery is live. This workflow writes generalized ownership rights and preserves event history instead of replacing old owner text.

1. Select the gravesite on the map or from search results.
2. Confirm you are in the correct cemetery and gravesite.
3. Open the `Current Owner` section.
4. Use `Record deed or transfer`.
5. Enter the owner or deed-holder name. This can be one person, a couple, a family, the church, or another organization.
6. Choose the event type:
   - `New deed` for a newly issued deed or first recorded owner.
   - `Sale / transfer` when ownership changes by sale.
   - `Gift` when ownership changes without sale.
   - `Church council action` when council assigns ownership or clears unclear ownership.
   - `Correction` when fixing a prior ownership record.
   - `Release` when rights are relinquished.
7. Choose what the event applies to:
   - `This gravesite` for Section G plots or a single transferred burial right.
   - `This whole lot` for a lot-level deed or transfer in sections that use lots.
   - `Listed gravesites` when a deed or transfer covers several specific gravesites but not the whole lot.
8. Enter the effective date from the deed, transfer, council record, or best known source date.
9. Add a document reference such as a deed book, page, scanned file name, council minutes reference, or source note.
10. Add notes when the deed language, transfer terms, or evidence confidence needs explanation.
11. Save and confirm the `Current Owner` and `Ownership Timeline` sections refresh.

`power-user` and `cemetery-admin` users can record ownership events only for assigned cemeteries. `admin` users can record ownership events for any cemetery. Readers cannot see this form.

For an unsold lot or gravesite, record a `New deed` when rights are first issued. For a transfer of one or more gravesites from a larger lot, choose `Listed gravesites` and enter the specific gravesite IDs. For a transfer of an entire lot, choose `This whole lot`; the lot-level right will appear when viewing each gravesite in that lot.

### Audit Log Review

Use `Admin -> Audit Log` when answering who changed a record, what changed, or whether a direct database edit occurred.

1. Open `Admin -> Audit Log`.
2. Filter by action when you know the kind of change, such as `create`, `update`, `soft_delete`, `restore`, `delete`, or `import_promote`.
3. Filter by table when reviewing a specific area, such as `sections`, `headstones`, `marker_types`, or `north_hills_ocr_entry_gravesite_links`.
4. Filter by actor email or external subject when reviewing a user's activity.
5. Filter by record ID when starting from a known UUID or source identifier.
6. Use date filters to narrow broad searches.
7. Open an audit row and compare `previous_values`, `new_values`, and `changed_fields`.
8. Check actor fields and database user fields. Application writes include app user context; direct database edits may only show PostgreSQL `current_user` and `session_user`.

Audit events are read-only. If an audit result looks wrong, correct the source record through the normal workflow and let that correction create a new audit event.

### Headstone And Marker Editing

Use the normal grave-detail panel or the Markers panel, not the Admin drawer, for operational marker/headstone updates.

1. Select a gravesite on the map or from search results.
2. Review the marker/headstone section in the detail panel.
3. Users with `reader` access can view marker information but cannot edit it.
4. `power-user` and `cemetery-admin` users can edit marker details for assigned cemeteries.
5. `admin` users can edit marker details for any cemetery.
6. Edit marker type, material, condition, condition notes, inscription, design/flourish notes, back-side description, or last inspected date.
7. For Section G, expect the marker type list to be restricted to flat markers. The API and database also enforce this rule.
8. Section G gravesites can contain either one casket burial or up to two funeral urn burials. The database enforces this capacity rule when burial rows are created, restored, or updated.
9. Save the marker and confirm the detail panel reflects the update.

For standalone cemetery markers that are not tied to a gravesite, open the marker from the Markers panel and use the same edit flow. The marker relationship label explains how a marker relates to a gravesite when one exists: `primary` is the normal relationship, `spans` means one marker covers multiple gravesites, `nearby` means the marker is close but not confidently placed on that gravesite, and `inferred` means the link came from records or import logic and may need field confirmation.

Linked North Hills evidence supports interpretation of a headstone or gravesite, but editing marker condition/material/type does not alter the linked reading evidence.

### Photo Collection

Use the normal grave-detail panel for field photo collection. Photos are stored as media evidence and linked to the selected gravesite, with an optional marker/headstone link.

1. On the iPhone, open the application and select the gravesite on the map or from search results.
2. Open the `Photos` section in the detail panel.
3. Tap the photo file control. On iPhone this should offer the camera or photo library.
4. Choose `Gravesite overview` when the image documents the full grave space.
5. Choose a marker/headstone when the image documents a specific physical marker.
6. Add short notes when useful, such as face, angle, inscription detail, or field uncertainty.
7. Upload the photo and confirm it appears in the photo gallery.

The gallery shows the latest linked photo for that gravesite or marker. If a photo is linked to a marker/headstone, it appears under that marker rather than being duplicated in the gravesite overview `Photos` section.

Readers can view linked photos. Power users, cemetery admins, and admins can upload photos for cemeteries they can edit. The upload workflow does not replace marker condition, inscription, or burial data; it adds reviewable visual evidence that supports later updates.

In local DEV and TEST environments, uploaded image files are written under `/Users/scottpeterson/Dev/CemeteryMapping/uploads/media` unless `MEDIA_UPLOAD_DIR` is set. Postgres stores the generated `/media/<uuid>.<extension>` URL, the original filename, upload metadata, and the gravesite/headstone links, but not the image bytes.

### Future Field Collection Workflow Concept

This concept captures a future mobile-first field workflow for collecting and correcting cemetery data while standing in front of a headstone or gravesite. It is not fully implemented yet. Treat it as a product/design note for future planning.

The future workflow should use a dedicated `Field Collection` mode or route, such as `/field`, instead of adding more controls to the Admin drawer. Field collection needs large touch targets, clear upload status, minimal navigation, and a checklist that shows which parts of the record have been captured.

The desired iPhone workflow is:

1. Find or create the field target by searching for a headstone ID, gravesite ID, name, section/row, or nearby map position.
2. Capture a headstone photo and store it as linked media evidence, including upload time, app user, selected cemetery, optional GPS metadata, and notes.
3. Capture a gravesite overview photo separately from the marker photo.
4. Transcribe the marker inscription with line breaks preserved exactly as they appear on the marker.
5. Capture names, birth dates, death dates, burial dates when known, and any other marker text.
6. Identify whether the marker is shared by multiple people.
7. Link the headstone to one or more gravesites.
8. Link each burial to the correct gravesite, allowing the rare case where more than one burial belongs to the same gravesite.
9. Update marker details such as marker type, material, condition, condition notes, inscription, and last inspected date.
10. Use guided geometry choices for field estimates, such as single gravesite, two side-by-side gravesites, marker spans existing gravesites, shift, rotate, or needs review.
11. Review a final checklist before saving the field record as complete or `needs_review`.

The first implementation should avoid freehand polygon editing on the phone. Preset geometry actions and small nudges are safer for field use. Examples include:

- create a single `4' x 10'` gravesite from a marker point;
- create two side-by-side gravesites for a shared marker;
- link a marker to existing gravesites without changing geometry;
- mark the geometry as `field_estimate` or `needs_review`.

Recommended review statuses for future field changes are:

- `confirmed`: the field user is confident the relationship or geometry is correct;
- `field_estimate`: the record was adjusted in the field without survey-grade certainty;
- `needs_review`: the record needs office review before being treated as authoritative;
- `conflicting_source`: the field observation conflicts with an imported spreadsheet, deed registry, OCR reading, or map source.

Permissions should follow the existing cemetery-scoped editing model. Readers can view field photos and data. Power users, cemetery admins, and admins can collect and edit field data only for cemeteries they are allowed to edit, while global admins can work across all cemeteries.

The recommended minimum viable field collection feature is photo capture, inscription transcription, marker detail editing, people/burial editing, and linking to existing gravesites/headstones. Geometry presets for shared markers and side-by-side gravesites can follow after the record-linking workflow is stable.

### Future Hosting Options

This concept captures future hosting considerations for Cemetery Mapping. It is not an accepted deployment decision yet. Re-check current provider pricing before making a final choice because hosting plans and included quotas change over time.

The application is expected to have low public traffic, but it has a real database, uploaded media, authentication, audit history, and import/rebuild needs. Hosting should therefore optimize for predictable cost, backups, maintainability, and a simple recovery path rather than raw scale.

Options to compare:

1. **Single low-cost virtual server**: run the Node API, built React frontend, PostgreSQL/PostGIS, reverse proxy, TLS, backups, and media storage on one VPS.
   - Typical examples include a DigitalOcean Droplet or similar VPS.
   - This is usually the cheapest predictable option.
   - It also creates the most maintenance responsibility: operating system updates, database upgrades, firewall rules, backup verification, TLS renewal, monitoring, and restore drills.
   - It may be appropriate if a technical maintainer is comfortable owning server operations.

2. **Managed application platform plus managed Postgres**: host the app on a platform such as Render, Railway, Fly.io, or DigitalOcean App Platform, and use hosted PostgreSQL where possible.
   - This reduces server maintenance and can simplify deploys from GitHub.
   - It usually costs more than one small VPS once a persistent production database is included.
   - Check whether the hosted database supports required PostgreSQL/PostGIS behavior before committing.
   - File/photo storage may need object storage or a persistent disk, depending on provider.

3. **Hybrid approach**: host the static frontend cheaply or free, run the API on a small app service, and use a managed Postgres database.
   - This can lower operational work while keeping costs moderate.
   - It introduces more moving parts and environment variables.
   - It may be useful if the database is the only piece that should be managed professionally.

4. **Institutional or donated hosting**: ask whether the church, synod, borough, a member, or a local nonprofit technology group can provide hosting credits, a managed server, or sponsorship.
   - This can keep direct cost low.
   - Confirm who is responsible for backups, security updates, domain/DNS, and emergency recovery.
   - Avoid arrangements where only one volunteer has undocumented access.

Cost notes captured in June 2026 for future comparison:

- DigitalOcean Droplets are advertised as starting at about `$4/month`, with the user responsible for managing the operating system, applications, and data.
- DigitalOcean Managed PostgreSQL is advertised as starting at about `$15/month`.
- DigitalOcean App Platform has a low or free static tier, but its development database is not a production replacement because it has limited capabilities and is not backed up by default.
- Render has free/static and low-cost service tiers, with paid web services and paid Postgres tiers; a small paid web service plus a basic paid Postgres instance should be compared against a VPS.
- Railway's Hobby plan is about `$5/month` and includes usage credit, but resource usage can exceed the base amount.
- Fly.io can run small machines at low monthly compute prices, but persistent Postgres is more self-managed unless using a managed database offering or another provider.

PostGIS support notes captured in June 2026:

- DigitalOcean Managed PostgreSQL, Render Postgres, Supabase, Neon, AWS RDS PostgreSQL, Heroku Postgres, and Aiven PostgreSQL document PostGIS support.
- Railway can support PostGIS through marketplace templates, but its default PostgreSQL template is intentionally simpler and does not include those extensions by default.
- For this application, the required baseline is ordinary PostGIS geometry support, including `geometry`, `ST_AsGeoJSON`, `ST_Covers`, `ST_GeomFromGeoJSON`, spatial indexes, and SRID handling.
- PostGIS raster support is probably not required because imagery is consumed from map services rather than stored as raster data in PostgreSQL.
- Before selecting a provider or plan, run this smoke test on the target database:

  ```sql
  CREATE EXTENSION IF NOT EXISTS postgis;
  SELECT postgis_full_version();
  ```

Other cloud geospatial data services to keep in mind:

- MongoDB Atlas supports GeoJSON, geospatial indexes, and geospatial queries. It could store spatial cemetery data, but using it as the primary database would require rewriting the relational model for cemeteries, lots, gravesites, burials, deeds, users, evidence links, and audits.
- ArcGIS Online hosted feature layers are useful for publishing, editing, or consuming GIS layers on the web. They may be useful as external spatial data sources or publishing targets, but they should not replace the application database for ownership, burial, user, and audit records.
- Firebase / Cloud Firestore can support location queries through geohashes, but those queries can produce false positives and are not a strong fit for precise cemetery polygons or relational audit-heavy data.
- Google BigQuery GIS supports a `GEOGRAPHY` type and spatial SQL functions. It is more appropriate for analytics than for operational application editing.
- Elasticsearch or OpenSearch support geospatial search and could help with spatial/text search in the future, but they are not a good primary transactional store for this application.
- Some MySQL-compatible cloud databases support spatial types and functions, but switching away from PostgreSQL/PostGIS would require rewriting schema, migrations, data access, and validation behavior.

Current database direction: keep PostgreSQL/PostGIS as the system of record. The application data is relational, historical, audited, and permission-sensitive. PostGIS provides spatial capability while preserving SQL relationships, transactions, constraints, triggers, Liquibase migrations, and audit behavior.

Decision criteria:

1. Can it run PostgreSQL/PostGIS at the needed version?
2. Are automated backups included, and has restore been tested?
3. Where are uploaded media files stored, and how are they backed up?
4. Is monthly cost predictable enough for a church budget?
5. Who receives alerts and who can restore service if the maintainer is unavailable?
6. How easy is it to deploy from GitHub after a merged PR?
7. How easy is it to run Liquibase migrations safely?
8. Can DEV/TEST/STAGE/PROD stay understandable without expensive duplicate infrastructure?

Current leaning for a low-traffic church project: start by comparing a single small VPS with self-managed Postgres/PostGIS against one managed platform option with managed Postgres. The VPS is likely cheapest, but the managed platform may be worth the extra cost if it avoids fragile volunteer-only server maintenance. Make the final decision only after pricing the full monthly stack, including database, backups, media storage, domain/DNS, monitoring, and any email/Auth0 costs.

### Soft Delete And Restore

Deletes in Cemetery Mapping are soft deletes unless a technical maintenance task explicitly says otherwise.

1. Use delete actions only when a record should disappear from normal map/search/detail reads.
2. Provide a clear delete reason when prompted.
3. Confirm the deleted record no longer appears in normal reads.
4. Use the Audit Log to confirm the `soft_delete` event captured the actor, reason, and changed values.
5. Use restore workflows when a soft-deleted record should return to normal reads.
6. Confirm the restore creates a `restore` audit event.

Do not hard-delete cemetery business records from the application UI. Hard deletes should be reserved for controlled maintenance where the audit and rollback implications are understood.

## Supporting Environment Maintenance

Use these checks when switching between DEV, TEST, STAGE, and PROD.

1. Confirm which environment you are targeting. Database commands default to DEV unless `APP_ENV` is set.
2. Start the database container for the environment:

   ```bash
   npm run db:up
   APP_ENV=test npm run db:up
   ```

3. Apply schema changes:

   ```bash
   APP_ENV=dev npm run db:migrate
   APP_ENV=test npm run db:migrate
   ```

4. Check migration status when unsure:

   ```bash
   APP_ENV=dev npm run db:status
   APP_ENV=test npm run db:status
   ```

5. Check PostgreSQL/PostGIS versions from the target container when diagnosing environment drift:

   ```bash
   docker compose -p cemeterymapping-dev --env-file db/env/dev.env exec db psql -U cemetery_app -d cemetery_mapping_dev -c "SELECT version(), postgis_full_version();"
   ```

6. If port `5173` is already in use, stop the old Vite process before starting the dev server.
7. If port `3001` is already in use, stop the old API process before starting the API.
8. Use `AUTH_MODE=disabled` only for local development and automated tests. Use `AUTH_MODE=auth0` when testing real Auth0 behavior.

Before running imports or promotions, apply migrations in that environment first.

## Environment Promotion Workflow

Use this workflow to move application changes, schema changes, and reviewed data changes through `DEV`, `TEST`, `STAGE`, and `PROD`. The environments form a ladder:

| Environment | Purpose | Promotion Gate |
| --- | --- | --- |
| DEV | Local implementation and exploratory data work. | Developer verification is complete and the branch is ready for PR. |
| TEST | Automated CI and repeatable test database validation. | PR checks pass against a rebuilt TEST database. |
| STAGE | Production-like rehearsal with copied configuration shape and representative data. | Maintainer approves the release after smoke testing and migration rehearsal. |
| PROD | Live cemetery records and field/photo workflows. | Stage has passed, backups are current, and a rollback plan exists. |

Do not skip environments for schema, permission, import, or data-repair changes. A documentation-only or styling-only change may not need database promotion, but it should still pass CI before merge.

### Promotion Principles

1. Promote code by Git history, not by copying edited files between environments.
2. Promote schema by Liquibase migrations, not by manual table edits.
3. Promote data by reviewed scripts or Admin workflows, not by ad hoc SQL, except for documented maintenance with an audit reason.
4. Promote configuration by environment-specific secrets and variables, not by committing credentials.
5. Treat media files as deployment data. Database rows reference media URLs, but image files also need backup and environment-specific storage.
6. Record every production-affecting release in the project notes or release history with the PR number, migration range, data scripts run, and verification result.

### DEV To TEST

Use DEV while building and doing first-pass local checks.

Before opening or merging a PR:

1. Create a branch for the change.
2. Apply migrations locally when the change includes database work:

   ```bash
   APP_ENV=dev npm run db:migrate
   ```

3. Run the relevant local checks. Use the full set for schema, authorization, import, map, or detail-panel changes:

   ```bash
   npm run lint
   npm run test:server
   npm run build
   APP_ENV=test npm run db:validate
   APP_ENV=test npm run db:rollback:one
   APP_ENV=test npm run db:migrate
   APP_ENV=test npm run test:db-rules
   ```

4. Open a PR to `main`.
5. Let GitHub Actions rebuild TEST from migrations, seed demo data, run rollback checks, run unit/integration tests, build, and run end-to-end tests.

The change is promoted to TEST when the PR checks pass. It is promoted into the main code line when the PR merges.

### TEST To STAGE

Use STAGE as the dress rehearsal for production. STAGE should have the same major services as PROD: PostgreSQL/PostGIS version, Auth0 mode, required Auth0 permissions, storage settings, and public URLs. It may use scrubbed or representative data instead of live personal data.

Before promoting to STAGE:

1. Confirm `main` contains the merged PRs intended for release.
2. Confirm no unrelated PRs are accidentally included.
3. Start or connect to the STAGE database.
4. Check pending migrations:

   ```bash
   APP_ENV=stage npm run db:status
   ```

5. Apply migrations:

   ```bash
   APP_ENV=stage npm run db:migrate
   ```

6. Run any reviewed data import or data repair scripts against STAGE first.
7. Configure Auth0 and environment variables for STAGE if roles, permissions, callback URLs, audiences, or API scopes changed.
8. Smoke test STAGE:
   - Sign in as each relevant role.
   - Load the map.
   - Open a cemetery, section, lot, gravesite, marker, burial, and owner/deed detail where applicable.
   - Test the specific workflow changed by the release.
   - Confirm audit events appear for any staged write test.
   - Confirm uploaded or existing photos render if media behavior changed.

Do not promote to PROD until STAGE uses the same migration level and the smoke test passes.

### STAGE To PROD

Promote to PROD only from a known-good `main` commit that has passed TEST and STAGE.

Before PROD migration:

1. Announce the maintenance window if users may be affected.
2. Confirm the exact commit or tag to deploy.
3. Confirm database and media backups are current and restorable.
4. Confirm the rollback plan:
   - For code-only changes, identify the prior deployable commit.
   - For schema changes, confirm whether rollback is safe or whether forward-fix is the safer path.
   - For data changes, confirm the script output, affected record count, and backup point.
5. Confirm Auth0 tenant settings and application secrets are correct for PROD.
6. Confirm `AUTH_MODE=auth0` for PROD unless a documented emergency exception exists.

During PROD promotion:

1. Deploy the approved code.
2. Apply migrations:

   ```bash
   APP_ENV=prod npm run db:migrate
   ```

3. Run reviewed data scripts only if they were already rehearsed in STAGE.
4. Run a short smoke test:
   - Reader can view map and non-deed detail.
   - Power user can edit assigned cemetery data.
   - Cemetery admin can manage assigned cemetery data.
   - Admin can access Admin UI.
   - Deed/owner data remains hidden from read-only users.
   - Photos render and uploads work if field collection is in scope.
5. Review recent audit events for expected migration or application writes.

After PROD promotion:

1. Record the PRs, commit, migration numbers, data scripts, and smoke-test result.
2. Monitor API logs and database errors.
3. Keep the backup from before the release until the next stable backup cycle.

### Data Promotion Rules

Application releases and data imports are separate decisions. Merging code does not automatically mean new source data should be imported into every environment.

Use this order for data:

1. Import raw source data into staging tables in TEST.
2. Validate and review TEST output.
3. Promote into authoritative TEST tables only when the import rules are understood.
4. Repeat the import and promotion in STAGE as a rehearsal.
5. Promote into PROD only after STAGE output matches expectations.

Geometry-only updates should use geometry-only promotion commands when names, notes, contact fields, or other application-maintained text should not be overwritten.

### Emergency Fixes

Emergency fixes may move faster, but they still need a written trail.

1. Create a small branch from `main`.
2. Make the smallest safe fix.
3. Run the most relevant local checks.
4. Open and merge a PR after CI passes.
5. Promote to STAGE if time allows; otherwise record why STAGE was skipped.
6. Promote to PROD with a backup and rollback plan.
7. Add follow-up documentation or tests after service is stable.

## One-Time Cemetery Onboarding Workflows

Use these workflows when bringing a new cemetery or new source snapshot into the system. They are intentionally staging-first and verification-heavy. After a cemetery has been onboarded, routine updates should usually happen through the ongoing maintenance workflows unless a source system sends corrected replacement data.

A typical onboarding sequence is:

1. Apply migrations in the target environment.
2. Import and validate spatial cemetery/section/lot data.
3. Promote the appropriate spatial data into production tables.
4. Import headstone spreadsheet data if available.
5. Stage deed registry evidence if available.
6. Stage OCR reading evidence if available.
7. Review the map, detail panel, Admin evidence screens, and audit records before considering the cemetery live.

### Spatial Import Checklist

Use this checklist for File Geodatabase imports and geometry-only updates.

Before you run:

1. Confirm the target environment.
2. Confirm the source geodatabase path.
3. Inspect available layers:

   ```bash
   npm run geodatabase:inspect -- /path/to/cemetery.gdb
   ```

4. Confirm whether you need a full staging import/promotion or only geometry updates.

Run:

1. Import to staging:

   ```bash
   APP_ENV=test npm run db:import:geodatabase -- /path/to/cemetery.gdb --source-name "Cemetery Data Management"
   ```

2. Validate spatial data:

   ```bash
   APP_ENV=test npm run db:validate:spatial
   ```

3. Promote a full staging batch only when text and hierarchy data should be updated:

   ```bash
   APP_ENV=test npm run db:promote:spatial -- --batch-id <batch-uuid>
   ```

4. Promote only cemetery/section boundary geometry when application text should remain authoritative:

   ```bash
   APP_ENV=test npm run db:promote:boundary-geometry -- --batch-id <batch-uuid> --facility-id 1 --sections A,B,C,D,E,F
   ```

5. Promote only section geometry when only section boundaries changed:

   ```bash
   APP_ENV=test npm run db:promote:section-geometry -- --batch-id <batch-uuid> --facility-id 1 --sections B,D,F
   ```

Verify:

1. Review spatial validation output.
2. Check the map at cemetery, section, lot, and gravesite zoom levels.
3. Confirm cemetery and section text fields were not overwritten if a geometry-only command was used.
4. Review audit events for promoted production-table changes.

Do not use full spatial promotion when the source geodatabase contains stale names, notes, contact fields, or other text values that should not replace application-maintained text.

### Historic Lot Map Control Points

Use the map's admin-only `Control` tool to collect paired control points for historic lot maps such as scanned TIFF deed-holder plans. The tool does not write to Postgres; it stores points in browser local storage and exports JSON or CSV for later georeferencing and lot-staging work.

Before you collect points:

1. Open the app as an admin user.
2. Convert TIFF scans to PNG or JPEG if the browser cannot display the TIFF directly.
3. Pick the archival file being georeferenced in the `Georeferencing file` selector, such as `TIFF2042-01.tif` or `TIFF2043-01.tif`. If you load a converted PNG/JPEG, keep the selector on the original TIFF so exported points still reference the archival source.
4. Choose control points that are visible on both the scan and the map, such as cemetery/section corners, passage or drive intersections, lot-grid corners, or clearly matching headstone clusters.
5. Spread points across the scan. Avoid using only one corner or one row of lots.

Collect:

1. Click `Control` on the map.
2. Select the georeferencing file and load the scan or converted image.
3. Use the source-image zoom controls and map zoom controls to inspect the same feature on both panes. Drag inside the source image pane to pan around a zoomed scan.
4. Click a feature on the source image.
5. Click the same feature on the map.
6. Add a note such as `Lot 42 southwest corner` and set confidence to `High`, `Medium`, or `Low`.
7. Repeat until there are enough points to evaluate alignment.
8. Export JSON or CSV.

Georeference the image:

1. Print the GDAL commands first:

   ```bash
   npm run georef:image -- \
     --control-points "/path/to/cemetery-control-points.json" \
     --source-name "TIFF2042-01.tif" \
     --image "/path/to/TIFF2042-01.png" \
     --output "/path/to/TIFF2042-01-georeferenced.tif"
   ```

2. Review the generated `gdal_translate` and `gdalwarp` commands.
3. Run the commands when they look right:

   ```bash
   npm run georef:image -- \
     --control-points "/path/to/cemetery-control-points.json" \
     --source-name "TIFF2042-01.tif" \
     --image "/path/to/TIFF2042-01.png" \
     --output "/path/to/TIFF2042-01-georeferenced.tif" \
     --run
   ```

4. Start with the default affine transform. If the paper scan is warped and you have many well-distributed points, compare with thin-plate spline:

   ```bash
   npm run georef:image -- \
     --control-points "/path/to/cemetery-control-points.json" \
     --source-name "TIFF2042-01.tif" \
     --image "/path/to/TIFF2042-01.png" \
     --output "/path/to/TIFF2042-01-georeferenced-tps.tif" \
     --transform tps \
     --run
   ```

Use exported points as review evidence for a later lot georeferencing/import step. Do not treat the historic scan as survey-grade geometry. It should help build a best-guess lot layer that is consistent with known lot dimensions, gravesite orientation, headstone-derived gravesite polygons, and reviewed deed-holder/lot-number text.

### Headstone Spreadsheet Import Checklist

Before you run:

1. Confirm cemetery and section polygons exist in the target environment.
2. Confirm the spreadsheet has latitude/longitude columns and the expected person columns.
3. Run against TEST before DEV or other persistent environments when evaluating a new file.

Run:

1. Dry run first:

   ```bash
   APP_ENV=test npm run db:import:headstones -- "/path/to/TLC Gravesite Registry Geo Locations.xlsx" --dry-run
   ```

2. Import after reviewing dry-run output:

   ```bash
   APP_ENV=test npm run db:import:headstones -- "/path/to/TLC Gravesite Registry Geo Locations.xlsx"
   ```

3. Use geometry options only when the source file requires different lot or gravesite dimensions:

   ```bash
   APP_ENV=test npm run db:import:headstones -- "/path/to/headstones.xlsx" --facility-id 1 --lot-length-feet 20 --lot-width-feet 10 --length-feet 10 --width-feet 4
   ```

Verify:

1. Run spatial validation.
2. Review warnings for GPS points outside sections.
3. Check generated lots, gravesites, headstone points, and burial links on the map and detail panel.
4. Confirm source notes use the official `North Hills Genealogists` spelling.

Do not treat generated gravesite boxes as surveyed grave geometry. They are placeholders around headstone GPS coordinates until surveyed boundaries are available.

### Deed Registry Import Checklist

Before you run:

1. Confirm the workbook path and target sheet.
2. Remember that the deed registry is ownership evidence, not authoritative spatial geometry.
3. Treat `Original 2017` as the baseline, `Investigated` as supporting research rows/notes, and `Updated 2022` as the investigation result.
4. Treat `Lot num` or `Lot Number` values as candidate `lots.lot_id` values. Do not promote them into `lots` until the future lot promotion workflow is explicitly approved.

Run:

1. Dry run:

   ```bash
   APP_ENV=test npm run db:import:deed-registry -- "/path/to/Trinity Cemetery Registry 2022.xlsx" --dry-run
   ```

2. Import all three worksheets together:

   ```bash
   APP_ENV=test npm run db:import:deed-registry -- "/path/to/Trinity Cemetery Registry 2022.xlsx" --all-sheets true --source-name "Trinity Cemetery Registry 2022" --imported-by "Name"
   ```

3. Or import a single worksheet for a targeted reimport:

   ```bash
   APP_ENV=test npm run db:import:deed-registry -- "/path/to/Trinity Cemetery Registry 2022.xlsx" --source-name "Trinity Cemetery Registry 2022" --imported-by "Name"
   ```

4. Import `Investigated` separately only when you need to refresh that worksheet without touching the others:

   ```bash
   APP_ENV=test npm run db:import:deed-registry -- "/path/to/Trinity Cemetery Registry 2022.xlsx" --sheet "Investigated" --source-name "Trinity Cemetery Registry 2022 - Investigated" --imported-by "Name"
   ```

Verify:

1. Open `Admin -> Deed Evidence`.
2. Review high-confidence rows and low/review-confidence rows separately.
3. Confirm `Investigated` notes appear with related registry entries.
4. For an `Updated 2022` batch, confirm the comparison summary appears against the latest `Original 2017` batch.
5. Review added, changed, unchanged, and removed rows before designing any promotion to `lots`, gravesites, legacy owners, or generalized ownership parties/events/rights.
6. Leave ambiguous aliases, passageways, and Section G plot references staged for human interpretation.

Do not promote deed registry evidence into owners, lots, gravesites, or generalized ownership rights until explicit promotion rules exist.

### North Hills OCR Import Checklist

Before you run:

1. Confirm the PDF is searchable or has already had OCR applied.
2. Confirm the source covers the intended cemetery excerpt.
3. Apply migrations before importing so staging and evidence-link tables exist.

Run:

```bash
APP_ENV=test npm run db:import:north-hills-ocr -- "/path/to/FedEx Scan 2026-05-29_10-13-35.pdf" --imported-by "Name"
```

Verify:

1. Open `Admin -> Readings`.
2. Select the new import batch.
3. Review parser confidence and candidate matches.
4. Link, reject, or flag candidate gravesite/headstone matches as evidence.
5. Confirm linked evidence appears in the regular detail panel.

Do not load OCR readings directly into production burial or headstone fields. The OCR data remains staged evidence until reviewed.
