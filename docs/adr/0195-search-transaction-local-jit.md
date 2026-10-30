---
---

# ADR 0195: Disable JIT only within application search transactions

- Status: Accepted
- Date: 2026-10-30
- Owners: Project maintainers
- Related decisions: [ADR 0194](0194-local-database-review-tools.md), [ADR 0180](0180-search-ownership-query.md)

## Context

PostgreSQL 18.6 benchmarks of the local restored databases showed search latency
being dominated by JIT compilation. Refreshing statistics also moved DEV's
exact/no-match search estimates above the JIT threshold. Broad search took seconds
while the same query completed in tens of milliseconds with JIT disabled.

Database-wide, role-wide or general API pool settings would affect unrelated
queries and reports. A session-level setting on a reusable pooled connection could
leak into later requests. Setting JIT from within the SELECT is too late to control
planning of that statement.

## Decision

The request-facing `searchCemetery` acquires one pooled connection, begins a
read-only transaction, executes `SET LOCAL jit = off`, runs the existing
parameterized search, and commits before releasing the connection. On failure,
roll back before release. If rollback fails, discard the connection and preserve
the original error. PostgreSQL restores the prior JIT setting at transaction end.

The SQL and result mapping remain in `selectSearchMatches`. Caller-owned
transaction fixtures and explicit benchmark baselines use that query-level entry
point. Request handlers use `searchCemetery`; do not bypass its transaction policy.
No database/role configuration, migration or schema change is required. This also
works with the separately hosted PostgreSQL 17 stack.

The benchmark tool uses the request-facing function by default. Its explicit
`--baseline-search` option runs the same SELECT without the wrapper for comparison.
Captured EXPLAIN plans for scoped search use the same transaction-local JIT policy;
transaction-control statements are excluded from EXPLAIN input.

## Consequences

Search adds transaction setup and completion round trips and holds one connection
until completion. Current short interactive searches avoid much greater compiler
cost. Large future search workloads could benefit from JIT, so retain repeatable
measurements and revisit the decision if the workload changes materially.

Unrelated queries keep their existing settings, including those queued behind a
search on the same pooled backend. Ownership visibility, filters, result ordering,
complete reasons, geometry and pagination remain governed by the unchanged SQL.
Read-only queries and result comparisons do not modify existing records.

## Rebuild and Validation

```bash
npm run test:server
npm run lint
APP_ENV=dev node --test scripts/search-jit.integration.mjs
APP_ENV=test node --test scripts/search-jit.integration.mjs
npm run db:benchmark -- --env dev --runs 5 --baseline-search
npm run db:benchmark -- --env dev --runs 5
```

Repeat benchmarks with `--env test`. They require the existing restricted API
credentials and at least one active mapped grave and headstone. The baseline
option is diagnostic and changes no runtime configuration. Keep detailed plans
and parameters private under ignored backups. See [the benchmark guide](../postgresql-18-upgrade.md#planner-statistics-and-query-benchmarks).

Unit tests cover success, acquisition/setup/query/commit errors and failed rollback.
The read-only database regression verifies JIT restoration on the same backend,
recovery after a SQL error, isolation of queued unrelated work and equality with
the baseline across ownership scopes, statuses, pagination and SQL-like text.
Existing caller-owned fixture tests continue to exercise query semantics without
committing their surrounding transactions.

## Update Triggers

Revisit when search query shape, dataset size, PostgreSQL version or measured JIT
cost changes, or when callers require an explicit caller-owned transaction API.
Do not broaden the setting to other requests without independent measurements.
