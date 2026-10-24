# ADR 0168: Audited inspection deletion

- Date: 2026-10-24

## Decision

Cemetery admins with access to the marker and system admins can delete a selected inspection after confirmation. Use the existing inspection-only marker mutation and audit transaction, checking the inspection ID, marker ID, and expected update timestamp. Hide deletion while editing or while a recoverable draft exists.

Migration 494 adds a deletion timestamp. Mark deleted inspections manually edited to keep the existing NHG and field refresh functions from recreating them. Exclude deleted observations from marker responses, reject edits and new photo links to deleted observations, and soft-delete their photo contexts in the same transaction. Preserve media assets and marker photo links so the gallery retains the photos. The existing audit triggers retain the deleted record, actor and reason.

## Validation

Browser regressions cover both admin roles, cancellation, and switching to the remaining inspection. A rollback-only database fixture covers unauthorized roles, cemetery scope, stale versions, repeated deletion, preserved gallery links, and source refreshes after deletion. Migration application through Liquibase on the local TEST database encounters a pre-existing migration 485 checksum mismatch; the new migration is exercised directly inside the rolled-back fixture without altering historical migration checksums.
