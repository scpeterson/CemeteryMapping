---
---

# ADR 0214: Face-level illegibility and latest/previous inspection comparison

- Status: Proposed
- Date: 2026-11-16
- Related: [ADR 0213](0213-inspection-face-status-and-reading-source.md)

## Decision

Extend the existing power-user unreadable-inscriptions report without a migration
or edits to cemetery evidence. Provide scoped cemetery and section selectors,
a plot-marker exclusion covering both type and scope, current full/partial
filters, and a current-or-previous view that includes recovered readings.

Classify each face or independent unassigned reading. Structured whole-face
Illegible or exact standalone `[illegible]` means full; partial-legibility
assessment or cues mixed with surviving letters/numbers means partial. Bare
unreadable fragments without extent evidence stay unknown. Blank is separate,
not unreadable. Text cues retain compatibility but are labeled as inference;
legitimate words may require human review. Historical transcription entries do
not substitute for inspection observations, and combined text is not duplicated.

Compare the latest active visit with the immediately preceding active visit,
as chosen by the owner. Use year, exact date, updated time and stable ID, matching
the UI ordering; legacy null updated time falls back to creation time. A single
query snapshots both visits. Preserve year-only uncertainty and both sources/texts.
Reserve stable-ID face matches globally before unique case-insensitive label
fallback. Never pair unrelated or ambiguous faces by array position.

Improvement/worsening ranks recorded readable/no-illegibility-noted, partial and
full observations. Empty/not-assessed, missing/unmatched faces, blank or unknown
extent are not comparable. Results describe recorded assessments, not proof of
physical deterioration or successful photographic recovery. Default results show
current illegibility; the history view includes previous illegibility and
explicitly identifies faces absent from the latest visit.

Cemetery selection is intersected with authorized power-user/admin memberships;
reader memberships cannot be used for this report. An unauthorized selection
returns no scoped data, rather than broadening to all authorized cemeteries.
Other report filtering/authorization behavior is unchanged. Section options come
from map boundaries/sections/graves and reset with cemetery selection. Standard
report rows retain direct monument navigation and scrollable evidence columns.

## Validation and rollout

Pure regressions cover classification, matching, exact text preservation and
comparison uncertainty. Rolled-back PostgreSQL fixtures cover structured flags,
filters, type/scope exclusion, access, duplicate locations, deleted visits and
date/update ordering. Desktop/mobile browser checks exercise selectors, visible
table geometry, full/partial/recovered results and direct monument navigation.
Run lint, server tests, documentation validation and the production bundle check.
Existing application size caps stay unchanged.

Deploy explicitly after review/CI. Source documentation supersedes the earlier
text-only limitation for this implementation; dated November 15 hosted evidence
and private operations notes continue to describe the older deployed revision.
