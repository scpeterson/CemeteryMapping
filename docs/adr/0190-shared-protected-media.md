---
---

# ADR 0190: Share active protected photo downloads within an authentication session

- Date: 2026-10-30
- Status: Accepted

## Decision

Share a protected photo download and its blob URL among currently mounted consumers.
Reference counts keep the URL alive until the last consumer releases it, then abort
pending work and revoke the URL. No entries persist without consumers. Failed
requests are removed so later subscribers can retry. Explicit retry starts a fresh
download while existing consumers retain their old URL until released.

Changing the access-token provider or authenticated subject invalidates every
active URL and download. Media hooks subscribe to the session version, hide old
results immediately and reload using the new session. Disposed or superseded
requests cannot populate the new session. HTTP no-store headers remain unchanged;
no disk cache or service worker is added. External image handling is unchanged.

## Validation and recovery

Run TypeScript, lint, and shared-media-downloads, photo-loading, overview,
photo-orientation and recovery-messaging Playwright regressions. Tests cover
coalescing, last-consumer cancellation, failure/retry, superseded URLs, session
invalidation, preview/modal reuse and authentication reload. Revert the shared
store, hook and session notifications together to restore per-consumer downloads.
