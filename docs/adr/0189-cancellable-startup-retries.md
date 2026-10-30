---
---

# ADR 0189: Retry only transient startup failures and cancel abandoned loads

- Date: 2026-10-30
- Status: Accepted

## Decision

Map startup retries network failures and HTTP 408, 429, 500, 502, 503 and 504,
with the existing bounded attempt count and increasing 200 ms delays. Other HTTP
errors and invalid response JSON fail immediately. Pass an AbortSignal through
fetch and retry delays; unmounting application data aborts both. Cancellation
retains stale-response guards. The retry helper rejects invalid attempt counts.
No other API receives implicit retries, and writes are never replayed.

## Validation and recovery

Run TypeScript, lint, and startup-retry Playwright tests. Regressions cover permanent
errors, transient recovery, attempt bounds, malformed responses, cancellation in
backoff and one-request startup authorization failure. Revert helper and hook
integration to restore previous retry behavior; no persisted data is changed.
