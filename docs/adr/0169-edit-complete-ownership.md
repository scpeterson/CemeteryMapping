# ADR 0169: Edit complete saved ownership records

- Date: 2026-10-26

## Decision

Add Edit ownership under the current owners on a gravesite's People tab. Load the full ownership event through a cemetery-scoped, admin-only endpoint, then reuse the existing deed/transfer form for all recipients, previous owners, shares, date precision, file statuses, reference, notes, and assignments. The editor includes all directly assigned gravesites, not just the currently selected grave. Whole-lot records reopen with their whole-lot scope. Existing per-owner contact editing remains available.

Use a dedicated PATCH route and the existing audited ownership transaction. Preserve the event ID and original recording attribution; retire removed rights, preserve retained rights and their metadata, and add new targets through the existing cemetery validation and whole-lot conflict checks. Replacement party links use new party rows so editing this event cannot silently change another event's shared party. Retain source contact metadata on those replacement rows and retain the original parties and audit history. Legacy section/unlocated/mixed rights or unsupported event types require administrator review rather than silently dropping data.

Fingerprint the event, its parties and active rights; lock them and reject a stale or missing revision. This detects contact edits and separately removed rights as well as changes to the event itself. Exclude internal database rows from the editor response. Reuse the existing draft guard, including assignment-only changes, and keep the form open on API errors. No schema migration is required.

## Validation

Desktop and phone browser regressions cover complete record loading, changing recipients and grave assignments, declining draft discard, retrying a failed save, and refreshing the selected grave when its ownership assignment is removed. A rollback-only database fixture covers whole-lot to listed-grave conversion, previous owners, partial dates, metadata preservation, removing assignments, unrelated ownership preservation, cemetery and role restrictions, invalid party references, missing/stale revisions, and atomic rollback on conflicts. Existing server tests, lint and production build pass.

This change is prepared on its own branch; it has not been deployed to hosted TEST.
