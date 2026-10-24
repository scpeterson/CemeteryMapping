# ADR 0167: Identify assigned lots by UUID

- Date: 2026-10-24

## Decision

Lot numbers are local labels and repeat across sections (for example A-8 and B-8). Include each lot's UUID in map responses, use it as the assignment option's identity, and send it as `lotUuid` with the existing `lotId` label. Resolve the UUID within the requested cemetery. Existing requests without a UUID remain accepted only when the label identifies exactly one active lot; ambiguous labels produce a clear 400 response instead of choosing the first row.

Retain cemetery authorization, audit context, and database burial-use/spatial restrictions. Non-burial assignments and database-rejected restricted-area overlap produce a clear conflict response. Assignment updates section/block IDs and UUIDs together, and returns the actual section so frontend caches stay consistent. Unlink clears the lot association while retaining the gravesite's section/block context. No schema migration is needed.

## Validation

The rollback-only TEST integration fixture creates prohibited A-8 and standard B-8. It verifies exact B-8 assignment, rejection of ambiguous legacy labels, nonexistent IDs, cemetery permissions, non-burial and spatial restrictions, cross-section hierarchy consistency, and unlinking. Desktop and phone browser fixtures verify duplicate option labels send distinct UUIDs, restriction failures retain the choice, and unlinking sends an empty assignment.

The originally reported gravesite/lot combination was also verified against DEV inside a rolled-back transaction. The existing record was not reassigned by that check.
