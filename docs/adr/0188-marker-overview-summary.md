---
---

# ADR 0188: Load marker overview people and owners in one request

- Date: 2026-10-30
- Status: Accepted

## Decision

Add the reader-authenticated GET /api/headstones/:id/overview endpoint. Resolve
active direct and linked graves once, batch only person display fields and current
owner names, and return cemetery-qualified summaries. Apply the existing per-cemetery
ownership permission before issuing the owner query; readers do not load ownership.
Inherited lot rights retain direct-right precedence. No contact details, media,
maintenance, evidence or geometry are returned. The browser makes one cancellable
request, retains retry and missing-record handling, and uses full grave detail only
when a grave is actually opened. A summary failure marks the linked set unavailable
and retry reloads that set. No schema change is required.

## Validation and recovery

Run TypeScript, lint, server tests, marker overview/cancellation browser specs, and
APP_ENV=test node --test scripts/marker-overview.integration.mjs. Rollback-only fixtures
cover duplicate/direct/deleted links, partial birth dates, inherited/direct owners,
cemetery ownership scoping and soft-deleted markers. A browser regression verifies
one summary request and zero full grave requests. Revert endpoint and hook together
to restore per-grave loading.
