# ADR 0168: Audited inspection deletion

- Date: 2026-10-24

## Decision

Cemetery admins with access to the marker and system admins can delete a selected inspection after confirmation. Use the existing inspection-only marker mutation and audit transaction, checking the inspection ID, marker ID, and expected update timestamp. Hide deletion while editing or while a recoverable draft exists.

Migration 494 adds a deletion timestamp. Mark deleted inspections manually edited to keep the existing NHG and field refresh functions from recreating them. Exclude deleted observations from marker responses, reject edits and new photo links to deleted observations, and soft-delete their photo contexts in the same transaction. Preserve media assets and marker photo links so the gallery retains the photos. The existing audit triggers retain the deleted record, actor and reason.

## Validation

Browser regressions cover both admin roles, cancellation, and switching to the remaining inspection. A rollback-only database fixture covers unauthorized roles, cemetery scope, stale versions, repeated deletion, preserved gallery links, and source refreshes after deletion. Migration application through Liquibase on the local TEST database encounters a pre-existing migration 485 checksum mismatch; the new migration is exercised directly inside the rolled-back fixture without altering historical migration checksums.


## Migration compatibility follow-up (2026-10-26)

Local TEST retained migration 485 checksum `9:80e840954817aa20f23a6eea565e034b`, independently reproduced with Liquibase 4.33.0 from original commit a61d2f9. The merged migration differs only in rollback instructions; forward SQL is identical. Accept this exact original checksum using `validCheckSum`, preserving execution history and preventing a rerun. DEV already held the current checksum. Do not clear checksums or rewrite migration history. A regression pins the accepted checksum and the unchanged forward SQL.

Liquibase update completed successfully in DEV and TEST, including migration 494. DEV also processed pending changesets 473–477 (zero affected rows in the run summary); TEST processed pending 490–493 before 494. Verified that both environments retain their original 485 history/checksums, have the new deletion column, and record 494 as executed. The restarted DEV API returns healthy marker responses, and the rollback-only deletion integration passes against the migrated TEST schema. No user inspection was deleted during verification.

CI's full schema rollback/replay exposed an orphan helper function left by 494's initial empty rollback. Its schema rollback now drops the trigger, function, and deletion column in dependency order; operational recovery still uses forward corrections/backups. Accept the exact initial 494 checksum so already migrated DEV/TEST retain their execution history and do not replay the migration.
