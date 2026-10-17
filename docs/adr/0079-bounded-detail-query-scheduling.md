# ADR 0079: Bound Independent Detail Queries

Status: Accepted

Read-only gravesite and standalone marker details load the parent first, then run at most three independent relation queries through the PostgreSQL pool. This overlaps network round trips without pretending Promise.all on a single client provides database concurrency. It preserves the detail response, ownership redaction, ordering, and existing SQL selectors.

Writes still reload their details sequentially on their transaction's client, preserving uncommitted-write visibility and transaction semantics. Failed read batches stop queued queries and drain already-started work before rejecting. A missing parent starts no relation queries. Pool concurrency remains bounded and no connection is retained while idle.

This reduces serial waits rather than the total SQL statement count. Independent pool reads are not a repeatable-read snapshot; the previous read path also had no read transaction. Do not use the parallel path for transaction clients. More invasive query aggregation and tab-specific API contracts are deferred until query-plan measurements justify them.

The integration test clones only the burial table into a temporary schema and adds the latest birth-place projection column there when needed. It drops the schema afterward; existing TEST tables and migrations are unchanged.

Validation: deterministic scheduling/failure tests, existing repository/transaction tests, actual detail response parity through an isolated TEST fixture schema, and the full server suite.
