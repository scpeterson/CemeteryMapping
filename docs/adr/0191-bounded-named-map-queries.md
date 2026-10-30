---
---

# ADR 0191: Load named map query results with bounded concurrency

- Date: 2026-10-30
- Status: Accepted

## Decision

Describe map query tasks by result name and map results back to those names.
Use the shared failure-draining bounded scheduler with at most three queries per
pool-backed map load, retaining sequential execution for checked-out-client paths.
Omit unrequested owner and burial queries entirely. Detailed-map loading also
omits headstone summary queries because that response never consumes their results.
The public response shapes and query semantics are unchanged. The limit is per
map request, not a global pool limit; reducing concurrency trades some individual
request parallelism for lower contention under concurrent loads.

## Validation and recovery

Run lint and the map-response, cemetery repository and query-batch server tests.
Controlled query gates verify the concurrency bound, named response mapping,
skipped headstone/ownership queries and draining before error propagation.
Compare old/new summary and detailed responses in one read-only database snapshot.
Revert the loader to restore positional/unbounded execution; no migration is needed.
