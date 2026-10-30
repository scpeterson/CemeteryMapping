---
---

# ADR 0184: Cancel abandoned detail requests

- Date: 2026-10-30
- Status: Accepted

## Decision

Create an AbortController for each selected grave or marker detail request and
abort it when the selection, refresh request or component lifetime changes. Pass
its signal through both detail API helpers to fetch. Use the signal's aborted
state to retain the existing protection against stale responses and suppress
cancellation errors. Only the active request can clear its loading indicator.
The preserve-current refresh option is unchanged. API callers that omit a signal
retain their current behavior. Browser cancellation does not guarantee cancellation
of a database query already executing on the server.

## Validation and recovery

Run `npx tsc -b`, `npm run lint`, and the detail-request-cancellation and overview
Playwright specs. The cancellation regression holds a grave or marker response
pending, switches selection, observes its abort signal and verifies the new detail
loads without a cancellation error. Revert the hook and optional marker API
argument to restore stale-response suppression without cancellation. No migration
is required.
