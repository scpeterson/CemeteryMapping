---
---

# ADR 0202: Permission-scoped CSV and GeoJSON exports

- Status: Accepted; not deployed
- Date: 2026-11-05

## Decision

Add an Export header action and authenticated `/exports/` page using the existing
form/card specifications. Readers export general records only for explicitly
assigned cemeteries; system administrators can choose any active cemetery. Server
checks use current assignments, not the broadest role or cached picker flags.
Maintenance exports require current edit access. Ownership names/contacts require
current ownership-view access and a separate explicit dataset selection and UI
confirmation. No private columns are joined into general output projections.

CSV datasets cover gravesites, people, markers, maintenance actions and historical
ownership event/party pairs. General people exports include recorded dates and
military unit information, excluding owner contacts, raw source files and private
workflow notes. Ownership CSV is historical event/party evidence, not certification
of current rights. General exports are not a database backup or source-import
roundtrip format. GeoJSON supports gravesite polygons and marker points in WGS84
with explicit safe properties and original geometry; no inferred repair is applied.
Use canonical marker cemetery resolution before applying export scope.

Each request selects one cemetery, dataset, format, optional escaped literal search
and a 1–5000 row limit. Exclude deleted records and inactive parents. Count and
measure bounded results in a repeatable-read, read-only transaction before
transferring them to the API. Refuse excessive matches or output over 10 MiB;
never silently truncate a file. Public/private authorization happens before data
queries. Responses use attachment filenames, no-store and nosniff headers.

Encode CSV as UTF-8 with BOM, CRLF and fully quoted/escaped cells. Prefix text
beginning with spreadsheet formula characters, including after whitespace, with
an apostrophe. Actual numeric values remain numeric text. GeoJSON retains literal
strings without spreadsheet-specific alteration. Import CSV columns explicitly as
text when preserving identifiers in spreadsheet applications.

The separately loaded export page has a 5 KiB gzip budget; existing core remains
700 KiB, and the independent offline field entry retains its 15 KiB budget. Shared
helpers and vendor chunks remain counted against core. No migration is required.

## Validation

Unit/HTTP tests cover formula/quote/newline escaping, invalid formats/limits,
actual cemetery assignments and denied private reads before database access.
PostgreSQL checks execute all dataset projections, verify scoped GeoJSON and safe
properties, preserve recorded person dates, omit deleted people and refuse partial
exports. Browser checks verify real file downloads, retained search filters after
an oversized-result response, private confirmation cancellation/approval and 320px
layout. Lint, server tests and production bundle budgets remain required.
