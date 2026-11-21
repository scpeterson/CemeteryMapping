---
---

# ADR 0220: Separate location evidence operational geography and schematic layouts

- Status: Proposed
- Date: 2026-11-21
- Scope: Geometry provenance, representation and future publication workflows
- Related decisions: [spatial staging](0006-spatial-import-staging-validation.md),
  [spreadsheet placeholders](0008-headstone-spreadsheet-import.md),
  [historic map evidence](0017-historic-lot-map-evidence.md),
  [read-only repair previews](0194-local-database-review-tools.md),
  [stacked graves](0215-vertical-grave-stacks-and-cemetery-cutoff.md)

## Context

An observed marker point, an estimated grave boundary and a readable lot diagram
answer different questions. Treating them as interchangeable makes apparent
layout improvements capable of rewriting source evidence or changing operational
behavior. The [geometry guide](../geometry-model.md) gives operator examples.

Current implementation has useful foundations but one geometry per entity:

| Existing capability | Implication |
| --- | --- |
| `headstones.geometry` and latitude/longitude, introduced in migration 005, plus `source_properties` | Preserve imported locations, but do not provide a structured history of independent location observations and accepted selections. Some marker points are explicitly estimated. |
| Migration 096 classifies lot/gravesite geometry as evidence, operational or schematic, with source, confidence and notes | Classification applies to the single stored geographic polygon. Its confidence enum mixes acquisition (`gps`, `surveyed`) with review/interpretation (`reviewed`, `estimated`, `draft`, `unknown`). |
| `applyMapViewMode` in `src/components/cemeteryMapLayers.ts` | Diagram mode changes styling and external-layer visibility; it does not load independent layout coordinates. |
| Spreadsheet import and reviewed geometry migrations | Generated footprints are working interpretations. The importer can update marker locations and replace generated burial rows on rerun; it is not a merge-safe revision publisher. |
| `scripts/db-preview-spatial-repair.mjs` and ADR 0194 | Preserve exact original EWKB and fingerprints, project candidate copies into meters, report risks and provide no apply command. Current preview comparisons have limited scope. |
| Covering-lot creation queries, explicit lot/marker links and stack groups | Stored polygons already affect operational workflows. Geometry containment does not replace documented relationships or vertical authorization. |

In particular, a lot labeled `schematic` can still supply the current polygon
queried by the application. Extracting every such polygon into a display-only
store would change existing behavior without resolving its operational location.

## Proposed decision

Use three related representations with stable entity UUIDs. Keep source
observations immutable, publish operational geography through reviewed revisions,
and store schematic positions in independent named layouts. Accepted operational
revisions live in PostGIS; external GIS edits enter through candidate review.
The app and a File Geodatabase must not become independently writable masters
that silently overwrite one another.

This proposal extends the existing classification rather than retroactively
changing migration 096 or other accepted data-repair changesets. Approval and
implementation are separate from this documentation change.

## Evidence and marker locations

Retain raw source artifacts by checksum and stable source-feature/row identity.
For a location observation, retain the original coordinate values, declared CRS,
units and axis order, acquisition method, observed time if known, recorded time,
observer/device when known, accuracy value and its stated interpretation, source
references and review notes. Preserve an original source geometry alongside any
normalized copy. Unknown metadata stays unknown; digits do not prove accuracy.

Observations may be GNSS/GPS readings, survey control, imported GIS positions,
photo-derived estimates or manual interpretations. Capture method, positional
accuracy and review state are separate fields. An unreviewed survey import and a
reviewed estimate remain distinguishable. Existing `geometry_confidence` values
are retained during compatibility mapping and cannot create invented accuracy
values, collection dates or survey certification.

An accepted marker location points to a reviewed observation or explicit derived
estimate. Record which physical reference was measured, such as the marker's
base or center; its orientation bearing is a separate attribute. Repeated readings
do not automatically average into a new accepted point. Photo GPS belongs to the
camera observation unless a documented method supports a marker estimate.

Correction adds a successor observation and reason. Physical relocation adds a
new dated location while retaining the earlier one. Neither polygon alignment
nor diagram editing changes observations or the accepted marker point. Selecting
a new accepted point updates `headstones.geometry`, latitude/longitude and its
lineage reference atomically, preserving their agreement. Any existing dependent
polygons are flagged for review rather than silently following the point.

## Operational geography and relationships

Continue using the accepted geographic geometry on existing entity records for
the current map and spatial queries. These fields become the compatible current
projection of an approved revision, not a second independent editor. Keep an
unknown location unset where the current schema permits it, such as a marker
point. Unlocated source observations can remain source-only evidence; this
proposal does not implicitly relax required operational geometry constraints.
Do not invent a surveyed footprint or placeholder burial to represent a source.

Lot and gravesite footprints record the best supported interpretation, including
estimated or schematic-derived working footprints. Track the derivation, source
revisions, dimensions, anchors, geometry-specific review status and unresolved
exceptions. General record review (`reviewed_by`, inscriptions or biographical
verification) must not silently certify positional accuracy or boundary review.

Keep cemetery/section/block/lot membership, marker associations, ownership rights
and stack levels explicit. Spatial disagreement produces an issue for review;
it never reassigns a grave, creates a burial, rewrites a deed, or activates a
location policy automatically. A deliberate reassignment uses its existing
authorized workflow and resolves the target policy through canonical UUIDs.

A marker can span graves, sit on a boundary, be nearby or be standalone. Require
coverage only for a declared anchor/relationship constraint, not every linked
point. Stacked graves may share a horizontal footprint and remain separate
records. Do not shift them apart in geographic space to satisfy generic overlap
cleaning. Passageways, non-burial lots and approved exceptions retain their
existing meanings; an unfilled polygon gap is not proof of capacity.

## Schematic coordinates and historic scans

A schematic view has its own identity, cemetery scope, optional section scope,
revision, coordinate-space description, units, origin, extent and orientation.
Features reference existing entities and carry diagram positions/shapes and label
placements. More than one schematic view may depict the same entity. A shared
marker may have one linked symbol or explicitly identified display instances;
instances do not create additional physical markers or gravesites.

Use local XY diagram coordinates with a dedicated SVG/canvas renderer and a
distinct API payload. They must not enter geographic containment, navigation,
area, distance or default GeoJSON exports. Geographic GeoJSON uses WGS84
longitude/latitude under [RFC 7946 section 4](https://www.rfc-editor.org/rfc/rfc7946.html#section-4).
Do not label arbitrary diagram coordinates EPSG:4326 to reuse the map renderer.

A geographic overlay derived from a scan requires its own registration record:
source image/page and checksum, pixel origin/orientation, control-point identities
and coordinates, destination CRS, transform parameters, method/software versions,
fit residuals and independent checks where available. Fit residuals describe the
registration, not the scan's real-world accuracy. Retain alternate interpretations
when orientation or control is disputed. An unregistered scan can support an
explicit lot relationship or diagram without becoming a geographic boundary.

Diagram selection opens the same entity detail as geographic selection. Status
and membership permissions come from that entity, not the drawing. Display an
obvious diagram label and keep geolocation and geographic measurement controls
out of that surface. Schematic exports include their coordinate-space metadata
and entity references rather than masquerading as geographic records.

## Proposed persistence boundaries

Names below are conceptual, not migration or API contracts:

| Record group | Responsibility |
| --- | --- |
| Spatial sources | Immutable artifact references/checksums, original feature identities, CRS metadata and import versions; reuse existing staging/source-document references where suitable. |
| Marker location observations | Multiple source or derived observations linked to a marker, with successor links and accepted-location selection history. |
| Operational geometry revisions | Immutable original/proposed/accepted geographic geometry, lineage and geometry-specific review. Initial scope is lots and gravesites. Use typed target foreign keys and exactly-one-target constraints, not unchecked polymorphic UUIDs. |
| Geometry change sets | Bounded multi-record proposal, source revisions/hashes, derivation parameters, impact report, review and publication history. |
| Schematic views and features | Versioned local layouts, entity foreign keys and the operational revision each layout was based on. |
| Geometry review exceptions | Scoped, attributed reasons for accepted relationship/containment/overlap disagreements, tied to the affected revisions and rechecked when those revisions change. |

Enforce same-cemetery ancestry and target integrity in the database. Keep
observations and accepted revisions append-only to normal editors, retain audit
context, and protect access to source artifacts and private review exports. A
source refresh marks dependent candidates/layouts stale; it does not overwrite
accepted work. Deleted entities remain attributable in historical layouts, while
normal views follow existing soft-delete visibility rules.

## Coordinates and measurements

Keep accepted geographic interchange geometry in the existing EPSG:4326 model.
Perform row construction, offsets, areas and tolerance checks in an explicitly
chosen local projected CRS with known units, or an appropriate geodesic operation.
Record the input/output CRS, unit conversions and transformation pipeline/version.
Select the CRS per cemetery; the existing preview's UTM 17N example is local to
Trinity and must not become a global default. Preserve source survey-unit and
datum distinctions rather than guessing them from coordinate magnitude.

[ST_Transform](https://postgis.net/docs/ST_Transform.html) changes coordinates
between reference systems; [ST_SetSRID](https://postgis.net/docs/ST_SetSRID.html)
only labels a geometry's reference system. A missing/unknown source CRS requires
source review before transformation. Reprojection and snapping can create new
derived geometry but never replace the preserved original values.

## Candidate review and publication

1. Freeze the selected entity UUIDs, source files, parent/neighbor geometry,
   marker observations, relationship versions and applicable policy revision.
   Retain exact original EWKB and hashes as in ADR 0194.
2. Choose explicit anchors and their physical meaning, a common origin and row
   axis, dimensions/spacing and per-project tolerances. Known observations remain
   fixed. Estimated points are not automatically treated as strong control.
   Calculate each proposed position from the origin rather than its predecessor.
   Identify protected controls and reviewed boundaries explicitly; an estimated-row
   alignment cannot alter them without expanding and re-reviewing its scope.
3. Generate a separate candidate layer. Prefer explicit translations/rotations
   with preserved dimensions; resizing, clipping or changing a parent requires a
   separately visible decision. Coverage cleaning is a suggestion generator,
   not evidence that the result is correct.
4. Report changes in position, area, dimensions and orientation; anchor residuals;
   lost marker coverage; overlaps; parent containment; and effects on related
   lots, passageways and neighboring records. Include affected neighbors outside
   the selected row using a search extent sufficient for the proposed movement,
   plus explicitly related records. Show before/after metrics and exceptions.
5. Require valid, nonempty, correctly typed geographic geometry, preserved
   identity/ancestry and all current business constraints. Known overlap/containment
   exceptions need explicit review rather than blanket rejection or automatic
   repair. Tolerances and their rationale are recorded, not inferred from GPS
   decimal precision or an algorithm's snap parameter.
6. Proposed authority: power users may prepare candidates for editable cemeteries;
   assigned cemetery admins or system admins review/publish operational changes.
   Initial publication stays operator-controlled. Source-location corrections
   require a distinct evidence review action; approval cannot be hidden inside
   an alignment apply button. Broader boundary/survey editing remains a separate
   workflow decision.
7. On publication, recheck authorization and all affected geometry, relationship,
   parent and policy versions under a consistent locking order. Changed source
   data invalidates the preview. Apply the complete approved change set and its
   revision pointers/audit history atomically; partial rows and silent overwrite
   are rejected. The version/lock design is an implementation prerequisite, not
   something the current preview tool already supplies.
8. Recovery publishes a reviewed compensating revision against current state.
   It preserves later edits and historical observations. Keep an environment
   backup for disaster recovery; routine undo must not restore the whole database
   over subsequent cemetery work.

## Legacy transition and delivery sequence

First inventory geometry class/source/quality, original coordinates, UUIDs,
missing provenance and known exceptions. Capture a reversible baseline without
rewriting earlier migration checksums, renumbering records or normalizing every
polygon. Preserve the existing import and query contracts while mapping lineage.

Legacy geographic polygons labeled schematic remain the current working
footprints until individually reviewed. Copying a diagram or changing a label
does not improve their quality. Moving them into independent views must not
null their operational geometry, change covering-lot behavior, recompute
assignments or activate a new restriction. Each replacement needs an approved
geographic revision and before/after workflow checks.

Implement in this order:

1. Read-only inventory, source/quality labels, observation and revision schema,
   explicit unknown values, and a rehearsed compatibility migration.
2. A synthetic row-alignment pilot extending the existing read-only preview,
   including cross-scope neighbors and declared relationship exceptions.
3. Guarded geographic publication and compensation, rehearsed on a disposable
   copy before one narrowly reviewed real-row correction.
4. Independent schematic storage and rendering, with stale-layout indicators,
   stable selection and explicit exports.
5. Evaluate broader editing after the pilot. Retain external GIS authoring through
   staging; define conflict-aware import reconciliation before rerunning source
   importers against accepted revisions or manually edited burial records.

## Acceptance criteria before broader spatial editing

- Original marker observations and source hashes survive polygon and diagram edits
  byte-for-byte; accepted point geometry and latitude/longitude stay consistent.
- A new observation cannot silently replace a chosen point or its dependent
  polygons; unknown accuracy and estimated markers remain visible.
- One shared marker, a standalone marker, a non-contained documented lot assignment,
  a passageway, stacked graves and a legacy schematic lot each retain their
  existing identities, relationships and policy behavior.
- A second row alignment cannot accumulate rounding offsets from the first.
  Neighbors outside the selected row and modified parent constraints appear in
  the review; collapsed or invalid candidates cannot disappear from the report.
- Editing a diagram changes neither geographic query results nor ownership,
  capacity, marker locations or stack authorization. Geographic and diagram
  exports cannot confuse their coordinate spaces.
- Cross-cemetery, reader, stale-version, concurrent, partial-apply and import-rerun
  cases are tested. Rehearsal compares all non-target records and demonstrates
  compensation while retaining later edits.
- The selected cemetery's steward agrees on anchors, units, tolerances, acceptable
  exceptions and publication authority before the first real alignment is applied.

## Alternatives and consequences

Keeping every representation in one geometry column is simpler but makes a
readability edit change spatial behavior. Editing the File Geodatabase and app
independently creates competing masters. Automatically fitting all polygons to
marker points treats uncertain positions and relationship types as boundaries.
Accepting every cleaned coverage hides unresolved documentary or field conflicts.

Separate representations add revision storage, source management and a diagram
renderer. They preserve evidence, support reproducible corrections and let a
readable plan coexist with uncertain geography. Initial inventory and source
review are deliberate costs before wider editing. This ADR proposes those
boundaries; it creates no tables, editor, apply command or data changes.

## Documentation verification

From the repository root, with the documentation dependencies installed:

```sh
BUNDLE_GEMFILE=docs/Gemfile bundle exec jekyll build --source docs --destination /tmp/cemetery-geometry-docs
git diff --check
```

Check the new guide and ADR links, documentation navigation, diagram rendering
and desktop/phone page overflow. Implementation validation must additionally
satisfy the acceptance criteria above on synthetic fixtures and a disposable
database copy before any persistent geometry publication.
