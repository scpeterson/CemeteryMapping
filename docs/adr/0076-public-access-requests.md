---
---

# ADR 0076: Public Access Requests with Private Cemetery Records

- Status: Accepted
- Date: 2026-09-29

## Decision

Cemetery records are not publicly browsable. Production visitors need an active
application account with at least the `reader` role. Auth0 registration alone
is insufficient, and moving to PROD does not enable anonymous data access.

Expose `/request-access` as a public page. It collects name, email, cemetery of
interest as free text, and reason. It does not fetch cemetery lists, map records,
photos, ownership information, or user information. The only public data mutation
is `POST /api/access-requests`; existing cemetery and media authorization remains
unchanged. The page bypasses the Auth0 UI wrapper so it is usable before sign-in.

A request creates only a pending `access_requests` row. It does not create an
Auth0 identity, application user, cemetery assignment, or email notification.
Existing account emails and repeated request emails receive the same generic
response as new requests. Repeat requests do not overwrite earlier content or
reopen rejected requests. There is no public request-status lookup.

Only a global `admin` may list or reject requests. Admin → Users → Set up user
loads the existing user form and defaults new users to Read-only. The administrator
can deliberately choose a different supported role and its required cemetery
assignment. Saving an active user with the original request email approves the
request atomically with the application user change. A row lock prevents a
concurrent rejection or second approval from silently changing an already
reviewed request. Request creation and decisions use the existing audit trigger.

Account provisioning uses the existing Auth0 find/create and invitation workflow.
Auth0 operations are external to the database transaction: a failed save may
leave an Auth0 identity without application access. The request remains pending
and the administrator can retry using that identity. Invitation delivery requires
the existing password-reset client configuration; review is not an automatic
email-delivery guarantee. Administrators check the queue and contact applicants
as needed; there is no background notification service in this change.

## Abuse controls and hosting

The API validates field lengths and email shape, ignores a honeypot submission,
limits each observed client IP to 20 submissions per ten minutes, and bounds its
in-memory limiter to 1,000 buckets. It does not trust forwarded-IP headers. Behind
a reverse proxy, clients can therefore share a limit. Production must configure
edge rate limiting for this public endpoint; the process-local limiter resets on
restart and is not a distributed abuse-control system.

The public page and its static assets must be reachable without gateway login,
as must its submission endpoint. This is a deployment requirement, not permission
to bypass the gateway for all API or media routes. All record endpoints continue
to require application authorization. Hosted TEST keeps its
whole-host allowlist and uses a separate, narrowly scoped Access application with
a reusable Bypass policy for the request page, assets, and submission endpoint.
Nginx rejects unused descendants of the public page and endpoint. Production
hosting remains separate.

## Deployment and validation

Migration 416 creates the request table. Apply migrations and rerun restricted
API account grants before starting the new API; the schema startup contract now
requires `416-access-requests`. Keep identity tenants separate by environment.

Validation covers public submission without record reads, global-admin-only
review, duplicate protection, rate limiting, transactional approval, rejection,
failed-save rollback, and mobile/desktop request forms. No Trinity data changes
are part of this feature.
