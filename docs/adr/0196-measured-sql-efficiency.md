---
---

# ADR 0196: Reduce repeated SQL work and bound growing reads

- Status: Accepted; deployment pending
- Date: 2026-11-05
- Owners: Project maintainers
- Related: [ADR 0195](0195-search-transaction-local-jit.md), [PostgreSQL upgrade and measurement record](../postgresql-18-upgrade.md#sql-efficiency-implementation-2026-11-05)

## Context

PostgreSQL 18.6/PostGIS 3.6.4 measurements identified repeated NHG candidate
matching, relationship aggregation and JIT compilation as interactive bottlenecks.
Unbounded entity lookups, account listings and row-at-a-time staging imports also
create avoidable work as cemeteries and users grow.

## Decision

Compute NHG surname, printed-page and unknown-marker candidate relations in sets,
deduplicating entry/burial pairs before applying the existing ranking. Keep source
evidence, cemetery scope, first-five selection and additional linked candidates.
Add burial UUID as the final tie breaker where the old order was unspecified.
Group report relationship labels/evidence once and preserve fallback cemetery
resolution and complete report summaries.

Reuse connection-owned read-only transactions with `SET LOCAL jit = off` for the
three measured reports: marker burial pages, missing NHG links and unowned
gravesites. Search retains this policy. Other queries retain their existing JIT
settings; failed rollback discards the connection.

Materialize matching ownership names/dates only for broad searches that include
ownership. Preserve the complete rights relation for visibility and status, and
the existing fast paths for reader, empty and cemetery-scoped searches.

Read authorization on every request. Skip fresh activity writes, unchanged role,
user, profile and membership updates, and unchanged inspection/source refreshes.
Retain race guards, row serialization for account edits, manual inspection edits,
audit behavior and membership identity for unchanged assignments.

Batch reference lists into one query. The SPA requests references only; existing
clients can still request full entity lists. Add scoped, searchable and paginated
record selectors and an account directory, retaining the selected record across
pages and the existing form styles. Resolve marker ownership before applying
permissions. Do not cache permissions or reference lists across requests.

Batch GeoJSON, deed and NHG staging inserts with bound parameters, row/payload/
parameter caps and caller-owned transactions. Preassigned UUIDs preserve child
relationships. Keep direct domain promotion rules and parsing behavior.

Migration 511 guards inspection refreshes, removes five nonunique indexes that
duplicate retained unique indexes, and adds normalized marker-search and lower
account-email indexes. It does not change spatial records or uniqueness rules.
Migration 512 installs `pg_stat_statements` in a private diagnostics schema;
Compose preloads it on the next database restart. Runtime API roles receive no
diagnostic schema access. The owner-only reporting CLI omits query text by default.
Do not change global JIT, memory, parallelism or partitioning without new evidence.

## Validation and consequences

An isolated local TEST clone exercised migrations, rollback and reapplication,
real database regressions, staging imports crossing batch boundaries, no-op audit
and membership behavior, permissions, and result comparisons. Rollback of 511 uses
`rollbackSplitStatements:false` so function bodies remain intact. Browser checks
cover paging, selection retention and mobile controls. Production builds retain
the bundle budget by loading the gravesite editor on demand.

The measurement record contains local repeated timings and hosted read-only
comparisons. Small lookup-administration and directory fixtures did not become
faster; their changes bound or group future work. Query statistics provide
aggregate counts and means, not application p95. Deployment requires migrations,
database restart, API role configuration and application verification; writing
the configuration alone does not activate monitoring.
