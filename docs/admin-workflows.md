---
---

# Admin Workflow Roadmap

[Documentation Home](index.md)

This page records the first administrative editing workflows for Cemetery Mapping. It exists so API endpoints, UI screens, tests, and audit logging are built around cemetery operations instead of isolated table edits.

## Guiding Rules

- Admin workflows require authenticated `admin` access.
- Reader workflows remain read-only and must not expose deed/owner information.
- Power-user workflows can view and edit deed/owner information and update existing cemetery records, but cannot add structural records, delete records, or manage users.
- Deletes are soft deletes and must create audit events.
- Creates and updates should create audit events before they are exposed in the UI.
- Spatial geometry edits should be handled carefully and should not be the first editing workflow unless the source data workflow is also defined.
- Spatial records should distinguish measured evidence, operational interpretation, and user-friendly presentation. GPS marker/headstone points are evidence; gravesite and lot polygons are often interpreted working geometry; historic scans and schematic layouts can support readable presentation without being survey-grade.

## Workflow Priority

### 0. User and Role Management

Implemented admin foundation.

Only admins can manage application users and roles. User management lives in a dedicated admin drawer rather than the left search panel or right grave-detail panel, so map workflows remain focused on cemetery records.

The Admin drawer uses compact left-side navigation instead of large top tabs. This keeps the panel usable as admin areas grow: Users, Cemetery Records, Lookups, Deed Evidence, Readings, Source People, Quality, Bulk, Audit Log, and System each get one focused workspace.

The Admin UI stores the Auth0 `user_id` as the local Auth0 user ID. When Management API credentials are configured, adding a new user can search Auth0 by email or create a database-connection Auth0 user before saving the local role assignment.

Existing users can be edited from the Users list. Each row also has a direct Deactivate or Reactivate action. Deactivation changes only the local `app_users.is_active` flag; it blocks CemeteryMapping access after Auth0 token validation but does not delete or disable the Auth0 account.

The Admin UI also has a Cemetery Records tab for text-only cemetery hierarchy edits. Admins first search for and select a cemetery, then the section picker is limited to that cemetery, and the lot picker is limited to the selected section. Admins can update cemetery name, address, municipality, agency, agency URL, operational hours, contact name, contact phone, contact email, image URL, and notes; the cemetery created and updated timestamps are visible but read-only. Admins can also update section names, alternate names, section notes, and lot names. Section alternate names are stored as a normalized text array; sections `B` and `D` are initially backfilled with `OC` and `Original Cemetery`, and sections `A` and `C` are backfilled with `NA` and `New Annex`. Section geometry is required in production data; use the focused FileGDB promotion workflow when a known section boundary needs to be refreshed without changing section text fields.

The Admin UI has a Deed Evidence tab for reviewing staged deed registry imports before any promotion into production lot, gravesite, owner, or ownership-event tables. Admins can select an import batch, filter by parser confidence, filter by staged evidence type, search owner/lot/section/remark text, and review parser notes alongside related `Investigated` worksheet notes. When an `Original 2017` staging batch exists, the tab compares the selected current batch, usually `Updated 2022`, to that original baseline and highlights added, changed, unchanged, and removed owner rows. Spreadsheet `Lot num` or `Lot Number` values are staged as candidate lot identifiers for future `lots.lot_id` promotion.

The same tab also supports deed investigation cases for real-world requests such as a family asking whether a plot exists, whether a lost deed can be replaced, or whether Council should approve an exception. Each case records the subject, requester, plot reference, request summary, family/claimant notes, findings, case status, affidavit status, and outcome. Admins can attach staged deed evidence rows to the case so the evidence trail remains visible. A case can have multiple recommended actions, each with a person, action type, plot/gravesite reference, Council status, Council decision date, Council minutes or document reference, affidavit status, deed status, notes, and final outcome.

Deed investigation cases are documentation and recommendation workflows. They do not directly create lots, gravesites, burials, owners, or ownership rights. If a recommendation results in an actual deed or ownership transfer, use the regular ownership maintenance workflow after the investigation and Council decision are resolved.

The Admin UI also has a Readings tab for staged North Hills Genealogists OCR imports. The OCR importer preserves each raw reading entry, parsed section/row/position, marker descriptor text, surnames, inscription text, detected years, parser confidence, and parser notes. The review screen compares staged readings to existing burial rows by source page, surname, and birth/death years. Admins can edit a staged reading when OCR or parser cleanup is needed, link a reading to a candidate gravesite, link it to a candidate headstone, reject a candidate match, or flag a candidate for field checking. These review actions write evidence-link rows with reviewer identity, timestamp, confidence, status, and optional notes; they do not overwrite burials, headstones, lots, owners, or deeds. Linked North Hills evidence appears in the regular grave-detail panel for the associated gravesite or headstone.

How to use the Readings tab:

1. Open `Admin -> Readings`.
2. Select the North Hills OCR import batch to review.
3. Use the confidence, status, section, search, and sort controls to narrow the staged readings. The page-order sort is useful when reviewing against the original printed source.
4. Open a staged reading and compare its raw OCR text, parsed section/row/position, marker details, detected years, and parser notes against the possible existing matches.
5. Use `Edit entry` when the staged OCR text, parsed location, marker descriptors, notes, or extracted source facts need correction before review.
6. Use `Link gravesite` when the reading belongs to the candidate gravesite. This creates a linked gravesite evidence record.
7. Use `Link headstone` when the reading belongs to a candidate physical marker/headstone. This creates a linked headstone evidence record.
8. Use `Reject match` or `Reject headstone` when the candidate appears incorrect. This records the review decision without deleting the staged reading or changing production cemetery records.
9. Use `Needs field check` or `Field check` when the source and database do not provide enough certainty. This keeps the candidate visible as reviewed but unresolved for later field verification.
10. Add optional reviewer notes when prompted. Notes should capture why the match was linked, rejected, or deferred.
11. After linking evidence, open the normal grave-detail panel for the gravesite or headstone to confirm that the North Hills evidence appears where regular users review cemetery records.

Readings review is an evidence workflow, not a promotion workflow. A linked reading supports interpretation of a gravesite or headstone, but it does not change burial names, dates, marker condition, owner/deed data, geometry, or lot/gravesite structure.

The Admin UI also has a Source People tab for source-only people from church records, funeral-home notes, family-history notes, and similar evidence where no matching tombstone, gravesite, or marker is known yet. These records preserve names, partial dates, ages, source wording, confidence, status, source labels, and source locations without creating fake operational cemetery objects. Cemetery admins can review and edit records for assigned cemeteries, and system admins can review all cemeteries. Deleting a source person is a soft delete with a required reason, so accidental or duplicate source-only entries can be removed from normal review without losing accountability.

The Admin UI also has a Quality tab for data cleanup triage. The dashboard is read-only and counts records that likely need review, including staged North Hills readings, unlinked readings, gravesites without markers, markers without gravesites, lots without gravesites, burials with partial date text, veterans missing service details, photos without a date taken, and open maintenance records. Power users and cemetery admins see only assigned cemetery counts; admins can view all cemeteries or select a cemetery when the dashboard exposes cemetery filtering. Action buttons on actionable cards can open the related cleanup workspace, such as Readings, Source People, or Bulk tools, with review-oriented defaults. The dashboard points reviewers toward cleanup work but does not mutate cemetery records by itself.

Readings and Source People also include lightweight review queue controls. `Next unresolved` in Readings jumps to the next visible NHG entry whose processing summary still has pending links, rejected/field-check decisions, or source facts. `Next unresolved` in Source People opens the next visible source-only record with `unmatched` or `candidate_match` status. These controls work within the current filters, so reviewers can narrow to a page, section, cemetery, source, or status and then move through that subset without manually scanning the whole list.

The Admin UI also has a Bulk tab for narrow, audited cleanup actions that would be tedious one record at a time. Cemetery admins can use it for assigned cemeteries, and system admins can use it across the system. The current tools can update selected marker lookup fields, assign selected gravesites to a lot, mark selected North Hills readings reviewed, or apply the same source note to selected North Hills readings. Each bulk action requires an audit reason, accepts explicit record identifiers, reports how many records were matched, and leaves unmatched identifiers visible for follow-up. Bulk tools should be used only when the same correction clearly applies to every selected record; use the normal detail panel or Readings editor when individual evidence differs.

The Admin UI also has a Lookups tab for maintaining controlled values. Admins can update labels, descriptions, sort order, active status, and source metadata where applicable for marker types, marker materials, headstone conditions, gravesite statuses, and lot ownership event types. Lookup rows use UUID primary keys; lowercase codes remain hidden stable identifiers for imports, seed data, and compatibility. Obsolete values should be marked inactive instead of deleted. The lookup editor hides inactive values by default, shows reference counts, confirms deactivation of values that are already in use, supports move up/down sort-order controls, warns about duplicate sort orders, and can jump to the Audit Log filtered to a lookup row.

The regular detail panel has a Photos section for field collection. Editors can upload an image from a phone or desktop, link it to the selected gravesite, and optionally link it to a specific marker/headstone. Uploaded files are represented by `media_assets` rows and related through `gravesite_media_assets` and `headstone_media_assets`; the image files themselves are stored outside Postgres. In local environments, the files live under `uploads/media` unless `MEDIA_UPLOAD_DIR` points somewhere else. Readers can view linked photos but cannot upload them.

Current role behavior:

- `reader`: map, gravesites, burial information, and marker/headstone information; no deed/owner sections and no edit controls.
- `power-user`: reader access everywhere, plus deed/owner visibility and update access for assigned cemeteries.
- `cemetery-admin`: can administer assigned cemeteries and has read-only access to other cemeteries.
- `admin`: full system access, including user management, lookup maintenance, audit review, adding structural records, and soft deletes.

Power users and cemetery admins receive cemetery assignments through the local `app_user_cemetery_access` table. The Admin UI currently treats this as one assigned cemetery per user, while the database allows multiple assignments if a future workflow needs them.

Admin UI hover explanations should avoid exposing Auth0 user IDs in list-row tooltips. The Auth0 user ID is shown only when intentionally editing a user record.

### 1. Headstone Marker Updates

First regular record-editing workflow.

Readers can see marker/headstone details in the normal grave detail panel. Power users and cemetery admins can edit marker details for assigned cemeteries from that same panel without opening the Admin UI; global admins can edit marker details anywhere. This keeps operational cemetery record work near the map and leaves Admin focused on users, lookups, audit review, and setup data.

Standalone markers that are not linked to an active gravesite, such as graveyard markers or field markers, can also be opened and edited from the Markers panel. These records use the same marker edit form and authorization rules as gravesite-linked headstones.

The marker detail panel also has a Related Markers section. This is where editors record physical marker-to-marker relationships such as a small marker referring to a family obelisk, two markers sharing a common base, or a foot marker belonging with a primary marker. Related-marker records store relationship type, source, source text, confidence, status, and notes. Power users, cemetery admins, and admins can add or edit related markers when they have edit access to the marker's cemetery; deletes are soft deletes with an audit reason.

Do not use Related Markers for general gap notes or unavailable grave/lot observations. Gap notes are source observations. Plot markers should be modeled as actual marker records once their locations are known, and then linked only if there is a real marker-to-marker relationship.

Editable fields:

- `marker_type_id`
- `material_type_id`
- `condition_type_id`
- `condition_notes`
- `inscription`
- `design_notes`
- `back_description`
- `last_inspected_at`
- `photo_url`

Implemented API:

- `GET /api/headstone-lookups`
- `PATCH /api/headstones/:id`

Authorization:

- `reader`: can see marker details but cannot update.
- `power-user`: can update existing marker details for assigned cemeteries.
- `cemetery-admin`: can update existing marker details for assigned cemeteries.
- `admin`: can update existing marker details.

Section-specific cemetery rules are enforced below the UI as database triggers. Section F cannot contain gravesites because of underground utility lines. Section G can contain only flat markers, so the marker edit form filters the marker type list to `Flat marker` for Section G and the API rejects non-flat marker updates before the database trigger would fail.

Expected audit action:

- `update`

### 2. Burial Biographical Corrections

Second admin edit workflow.

Admins need to correct names and dates imported from the spreadsheet or later source documents.

Initial fields:

- `first_name`
- `last_name`
- `full_name`
- `birth_date`
- `death_date`
- `burial_date`
- `notes`

Expected API:

- `PATCH /api/burials/:id`

Expected audit action:

- `update`

### 3. Gravesite Status and Notes

Third admin edit workflow.

Admins can adjust gravesite notes and limited status flags without changing geometry. Most visible status values are derived from underlying records: active burials display as `occupied`; gravesites with no active burial and a current deed or ownership right display as `sold`; gravesites with no active burial and no current deed or ownership right display as `available`. Use the editable status field for human workflow exceptions, especially `reserved` when someone has claimed a gravesite before a deed exists, or `needs_review` when deed and burial evidence conflicts.

Initial fields:

- `status`
- `name`
- `cost`

Expected API:

- `PATCH /api/cemeteries/:cemeteryId/grave-spaces/:id`

Expected audit action:

- `update`

### 4. Headstone-to-Burial Association Fixes

Fourth admin edit workflow.

Admins may need to correct which burials are listed on a physical headstone.

Expected API:

- `POST /api/headstones/:id/burials`
- `DELETE /api/headstones/:id/burials/:burialId`

Expected audit actions:

- `create`
- `soft_delete`
- `restore` if restoring a previously removed association

### 5. Geometry Edits and New Spatial Records

Defer until the spatial editing source of truth is decided.

Geometry editing has higher risk because existing data originates from an Esri File Geodatabase and the spreadsheet-derived gravesite boxes are placeholders. Before exposing geometry edits, decide whether edits happen in this application, ArcGIS Pro, or another GIS editing workflow.

Future task: define and implement the cemetery geometry philosophy before adding broad spatial editing tools.

The working principle should be:

- Headstones and markers are evidence. GPS marker points should remain fixed unless the source observation itself is corrected.
- Gravesites and lots are operational interpretation. Their polygons may be best-fit, estimated, reviewed, or aligned to local cemetery structure.
- Historic scans, old TIF diagrams, and future schematic layouts are presentation and evidence aids. They may be easier for users to read without being geographically precise.

Expected future work:

- Add an ADR for separating evidence geometry, operational geometry, and schematic presentation geometry.
- Add geometry metadata such as source type, confidence, review notes, reviewed timestamp, and reviewer where useful.
- Consider a separate schematic geometry layer instead of forcing readable diagram layouts into the same PostGIS geometry used for geographic display.
- Add map modes or layers such as `Geographic`, `Diagram`, and `Evidence`.
- Add legends and detail-panel labels that tell users whether a marker point is GPS-observed and whether a gravesite or lot polygon is estimated, reviewed, or schematic.
- Build alignment-run tools for sections such as C so gravesite polygons can be regularized between anchors without moving GPS marker points or accumulating east-west spacing error one grave at a time.

## Explicitly Deferred

- Editing cemetery or section polygons in the web UI.
- Creating surveyed gravesite polygons.
- Adding broad gravesite geometry editing before the evidence/interpretation/presentation model is documented.
- Bulk import approval screens.
- Automatic deed registry promotion from staged evidence into production ownership records.
- Hard delete operations.

## Validation Expectations

Each workflow should include:

- API authorization tests showing `reader` is denied and `admin` is allowed.
- API behavior tests for validation errors and audit event creation.
- E2E coverage for the visible admin UI once the UI exists.
- Documentation updates in the relevant ADR.
