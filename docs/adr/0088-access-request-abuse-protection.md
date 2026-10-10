# ADR 0088: Bound and verify public access requests

Date: 2026-10-10

Status: Accepted

## Context

Public access requests previously had a honeypot, bounded fields, duplicate-email
protection, and per-IP rate limits. Behind Nginx the API saw one shared proxy IP.
Distributed submissions could still fill the administrator queue and audit tables.

## Decision

Use a managed Cloudflare Turnstile widget on the public form with action
`request_access`. The API verifies every real submission through Siteverify,
requires a genuine success, the expected action, and an exact environment-specific
hostname. Missing configuration, invalid/expired/replayed tokens, network errors,
and malformed verification responses deny storage. The browser clears and resets
tokens after every submission attempt, handles expiry, and offers widget-load retry.
Only local DEV/TEST with disabled/trusted-header authentication and no configured
Turnstile secret may omit verification. Hosted Auth0, STAGE and PROD require it.

Nginx overwrites `X-Access-Request-IP` using Cloudflare's visitor IP. The API uses
it only from a loopback peer when `ACCESS_REQUEST_TRUST_PROXY=loopback` is explicitly
set. Other deployments retain the directly observed peer; raw forwarding headers
are ignored. The tunnel and both origin listeners must remain private/loopback.

Keep 20 attempts per visitor per ten minutes with at most 1,000 in-memory visitor
buckets, plus 100 attempts total per API process per ten minutes, before JSON
parsing or verification. The public route accepts at most 16 KiB of uncompressed
JSON. Hosted Nginx additionally limits each visitor to five per minute (burst five)
and all visitors together to 30 per minute (burst ten).

Use a PostgreSQL transaction advisory try-lock to atomically check capacity and
insert across API instances: at most 100 new stored requests per rolling hour
and 200 pending requests. A busy lock or full queue returns 429 with Retry-After.
Migration 438 indexes creation time for the rolling-hour count. Existing pending
rows are retained, even if already over capacity. Reviewed rows remain historical;
reviewing a request frees pending capacity but does not reset the rolling-hour count.
Generic confirmations and duplicate protection remain unchanged below capacity.

An admin-only summary reports pending/hourly counts. Admin → Users warns at 80%
of either ceiling. Do not generate one database event or notification per rejected
attempt; that would create a second flooding target. Operators inspect Nginx 429s,
Turnstile Analytics, and the queue summary. Automated external alerts remain an
operator integration rather than an implicit email or recurring automation.

## Validation and consequences

Server tests cover fail-closed validation, action/hostname mismatch, replay failure,
trusted headers, distributed rate limiting, body size, and private admin/record
routes. Database integration tests exercise simultaneous clients and both capacity
ceilings. Browser tests cover token forwarding, expiry, failed-submit reset, script
load retry, mobile layout, and approval defaults. CI uses an offline widget mock,
not production credentials. A real hosted single-use/replay smoke test is required
once the widget secret and public site key are installed.

Deploy API/frontend/Nginx together after migration 438. Keep the private secret in
the protected runtime environment; only the public site key belongs in build config.
The hostname allowlist for TEST must contain only `test.nhcemeteries.org`; PROD uses
`nhcemeteries.org`. Do not use a test secret or local hostname in hosted environments.
Limits deliberately trade temporary submission availability for bounded workload;
administrators can review the queue before increasing limits with measured evidence.
