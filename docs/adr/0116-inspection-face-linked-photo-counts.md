---
---

# ADR 0116: Include Linked Inspection Photos In Face Cards

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0115; supersedes its draft-only photo counts for existing inspections.

## Decision

Fetch photo contexts when editing an inspection. Face cards show total, linked and selected counts, scoped to that inspection and face. Ignore missing/non-photo media assets and duplicate contexts. Draft library assignments override saved assignments, so selecting an already linked image or assigning it to another face never doubles its count. Pending files remain separate selections. New inspections still copy readings without photo links.

Key count results by marker, inspection and request generation. Abort requests when the editor closes or changes inspection; reopening fetches current links. Display loading or unavailable linked counts explicitly rather than zero. Offer retry independently of draft state. Counting performs no writes and leaves inspection save/photo retry behavior unchanged.

## Validation

Run `npm run lint`, `npm run build`, and `npm run test:inspections:browser`. Browser tests cover combined totals, duplicate and cross-visit links, missing assets, draft reassignment/removal, cancel/reopen, new-inspection isolation, loading/error/retry, draft retention and phone layout. No schema or API changes are needed.
