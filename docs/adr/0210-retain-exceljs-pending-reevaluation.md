---
---

# ADR 0210: Retain ExcelJS pending future reevaluation

- Status: Accepted
- Date: 2026-11-12
- Owners: Project owner and maintainers
- Related: [ADR 0008](0008-headstone-spreadsheet-import.md), [ADR 0208](0208-dependency-security-refresh.md)

## Decision

The owner chooses to keep **ExcelJS 4.4.0** for now and reevaluate replacements
later. Continue using it in the headstone and deed-registry XLSX importers. Do not
replace the reader or change import behavior as part of routine dependency cleanup.

This is a deferral of replacement, not an indefinite version freeze or a finding
that maintenance concerns have been resolved. Keep the existing dependency range,
lockfile and compatibility override unchanged by this decision. Do not add a
Dependabot block for ExcelJS; review future updates and security findings normally.

## Rationale

Both importers already rely on ExcelJS cell behavior and physical row numbers for
source provenance and generated identifiers. The replacement evaluation identified
behavior differences around merged cells, formula errors and formulas without
cached results. A SheetJS historical-date fixture also differed from ExcelJS by
one day. These observations require compatibility decisions and representative
source-workbook tests before a replacement can be trusted with cemetery records.

A temporary read-excel-file adapter reproduced the tested headstone normalization,
identifiers/geometry and deed-registry owner/note rows. However, that evaluation
used synthetic fixtures rather than the real source workbooks. ExcelJS's stale
release and deprecated transitive-dependency concerns remain reasons to revisit
this choice, rather than reasons to perform an immediate substitution.

## Reevaluation triggers

Revisit this decision when the owner requests it, a relevant security advisory or
unresolved import defect appears, Node compatibility becomes a problem, upstream
maintenance changes, or an alternative demonstrates the required behavior on
representative source workbooks. No scheduled replacement date is established.

Before switching, compare physical row numbers, worksheet/header selection,
blank and note-only rows, Unicode/rich text/hyperlinks, historical dates and both
Excel date systems, cached/uncached formulas, formula errors and merged cells.
Preserve generated identifiers, geometry and existing record associations. Define
explicit rejection or review behavior for ambiguous cells; retain importer tests
and add regression coverage for every intentional behavior change.

## Consequences

No package, lockfile, importer, database or deployment change accompanies this
record. Keep the current dependency review and import validation practices, and
record any later replacement decision with its evidence and migration plan.
