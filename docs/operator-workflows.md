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

### Deed Evidence Review

Use `Admin -> Deed Evidence` to review staged deed registry imports before any future promotion workflow writes ownership data.

1. Open `Admin -> Deed Evidence`.
2. Select the import batch.
3. Filter by parser confidence, evidence type, owner text, lot text, section text, or remarks.
4. Review raw row text, parsed allocations, parser notes, and related `Investigated` worksheet notes.
5. Treat `review` or `low` confidence rows as requiring human interpretation.
6. Treat `NA`, `OC`, passageway, and Section G plot references carefully because they may not map to ordinary section/lot/gravesite assumptions.

The current Deed Evidence tab is read-only. It does not create lots, gravesites, owners, or ownership events.

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

Use the normal grave-detail panel, not the Admin drawer, for operational marker/headstone updates.

1. Select a gravesite on the map or from search results.
2. Review the marker/headstone section in the detail panel.
3. Users with `reader` access can view marker information but cannot edit it.
4. `power-user` and `cemetery-admin` users can edit marker details for assigned cemeteries.
5. `admin` users can edit marker details for any cemetery.
6. Edit marker type, material, condition, condition notes, inscription, last inspected date, or photo URL.
7. For Section G, expect the marker type list to be restricted to flat markers. The API and database also enforce this rule.
8. Save the marker and confirm the detail panel reflects the update.

Linked North Hills evidence supports interpretation of a headstone or gravesite, but editing marker condition/material/type does not alter the linked reading evidence.

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
3. Plan to import the `Updated 2022` and `Investigated` sheets as separate staging batches when both are needed.

Run:

1. Dry run:

   ```bash
   APP_ENV=test npm run db:import:deed-registry -- "/path/to/Trinity Cemetery Registry 2022.xlsx" --dry-run
   ```

2. Import the primary registry:

   ```bash
   APP_ENV=test npm run db:import:deed-registry -- "/path/to/Trinity Cemetery Registry 2022.xlsx" --source-name "Trinity Cemetery Registry 2022" --imported-by "Name"
   ```

3. Import `Investigated` separately:

   ```bash
   APP_ENV=test npm run db:import:deed-registry -- "/path/to/Trinity Cemetery Registry 2022.xlsx" --sheet "Investigated" --source-name "Trinity Cemetery Registry 2022 - Investigated" --imported-by "Name"
   ```

Verify:

1. Open `Admin -> Deed Evidence`.
2. Review high-confidence rows and low/review-confidence rows separately.
3. Confirm `Investigated` notes appear with related registry entries.
4. Leave ambiguous aliases, passageways, and Section G plot references staged for human interpretation.

Do not promote deed registry evidence into owners, lots, or gravesites until explicit promotion rules exist.

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
