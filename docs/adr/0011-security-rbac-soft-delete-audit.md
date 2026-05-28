---
---

# ADR 0011: Secure Access with RBAC, Soft Deletes, and Audit Logging

- Status: Accepted
- Date: 2026-05-20
- Owners: Project maintainers
- Related changes: PR #15, Phase 2 security schema, Phase 3 API authorization foundation, Phase 4 grave-space soft delete/restore API, power-user role and admin user management UI

## Context

The application is moving from read-oriented cemetery mapping toward authenticated administration. It needs a highest-level administrator role that can add, edit, and delete data, and a read-only role that many users can use to query cemetery data.

The data is operational cemetery data, including spatial cemetery assets, gravesites, burials, and headstones. Changes must be attributable, accidental destructive deletes must be recoverable, and read-only users must not be able to mutate records through either the UI or direct API calls.

## Decision

Adopt a phased security model built around these parts:

- External identity provider for sign-in.
- Server-side role-based access control.
- `admin`, `power-user`, and `reader` application roles.
- Soft deletes for application data.
- Append-only audit logging for data changes.

The application will not implement its own password storage. Authentication should be delegated to a managed identity provider such as Microsoft Entra ID, Auth0, Google Workspace, AWS Cognito, Clerk, or another provider selected before production deployment.

Authorization must be enforced in the Express API, not only in the React UI. The UI can hide unavailable actions, but the API remains the enforcement boundary.

Request input that reaches data access paths must be validated before repository calls. Grave-space route ids are limited to the known application identifier shape, search queries are length-capped, status filters are allowlisted, and administrative mutation reasons are type-checked and length-capped. SQL statements must continue to use PostgreSQL parameter placeholders for request, token, import, and spreadsheet values rather than concatenating dynamic SQL.

## Roles

Application roles:

- `reader`: can view the map, gravesites, and burial information, but cannot view deed/owner information.
- `power-user`: can do everything a `reader` can do, plus view and edit deed/owner information and update existing burials, gravesites, lots, and sections.
- `admin`: can manage users and roles, view and edit all cemetery data, add burials, gravesites, lots, and sections, and soft-delete records.

Authorization is ranked as `reader` < `power-user` < `admin`. Deed and owner fields must be omitted from API responses for `reader` requests, not merely hidden in the UI. Future roles can be added with a new ADR or an update if the access model changes materially.

## Soft Delete Model

Deletes must be represented as data state, not physical row removal, for business records.

Tables that represent cemetery data should receive these columns when mutation support is added:

- `deleted_at`
- `deleted_by`
- `delete_reason`

Default read queries must filter out deleted records. Administrative recovery or audit screens can include deleted rows explicitly.

Join tables that represent cemetery facts should also support soft deletion when removing the association has business meaning. Temporary staging tables can continue to be truncated or cleared during imports because they are not authoritative business records.

## Audit Model

Create an append-only audit trail for administrative mutations.

Each audit event should capture:

- Actor user id or external subject.
- Actor role at the time of change.
- Database user and session user for direct database accountability.
- Action name, such as `create`, `update`, `soft_delete`, `restore`, `delete`, or `import_promote`.
- Target table.
- Target record id.
- Previous values when available.
- New values when available.
- Changed fields for updates.
- Reason or note when supplied.
- Timestamp.

Audit records should not be edited by normal application workflows. Row-level database triggers enforce auditing across core business and admin tables so direct database changes are captured even when they bypass the application API. Application mutation paths set transaction-local audit context so trigger-generated rows include the authenticated application user where available.

Tables with `updated_at` use database triggers to maintain that lifecycle timestamp on row updates. `created_at`, `updated_at`, `deleted_at`, `deleted_by`, and `delete_reason` stay on business rows for current-state inspection; `audit_events` stores historical old/new values and actor identity.

## Authentication Direction

Production authentication should use standards-based tokens from the selected identity provider, preferably OpenID Connect and JWT access tokens. The Express API should validate tokens server-side and map the authenticated subject to an application user and role.

Local development and automated tests can use a controlled test authentication mode, but it must be clearly separated from production configuration and documented.

## Rationale

External identity reduces the risk of custom password handling and account recovery code. Server-side RBAC prevents read-only users from bypassing hidden UI controls. Soft deletes protect cemetery records from accidental loss. Audit logging supports accountability, troubleshooting, and future administrative review.

Keeping the initial roles simple matches the current need while leaving a path for more specialized roles later.

## Consequences

Before building admin editing screens, the project needs:

- Production identity-provider selection and token validation.
- Documentation for local, test, stage, and production auth configuration.

Existing public or unauthenticated read behavior must be explicitly reviewed before production deployment. If public map access is desired, that should be documented separately from the authenticated `reader` role.

The first API security implementation supports:

- `AUTH_MODE=disabled` for local development and tests.
- `AUTH_MODE=trusted-header` for controlled integration behind a trusted local proxy.
- Reader-or-admin authorization on existing read endpoints.
- Default API reads that exclude soft-deleted cemetery records.
- Admin-only grave-space soft delete and restore endpoints.
- Admin-only user management endpoints and a dedicated admin drawer for user access management.
- Reader redaction of owner/deed sections in grave details and owner/deed search reasons.
- Audit events for grave-space soft delete and restore operations.
- API-edge request validation and SQL-injection regression tests for grave-space ids, search queries, status filters, and mutation reasons.

## Rebuild Notes

Apply migration:

```bash
APP_ENV=test npm run db:migrate
```

Validate with:

```bash
npm ci
APP_ENV=test npm run db:up
APP_ENV=test npm run db:validate
APP_ENV=test npm run db:migrate
npm run lint
npm run test:server
npm run build:test
APP_ENV=test npm run test:e2e
```

When the security schema is added, verify:

```sql
SELECT * FROM app_users LIMIT 5;
SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 5;
```

## Data Origins

This ADR governs access to records from the existing application data sources:

- Cemetery and section geometry from the Esri File Geodatabase documented in ADR 0007.
- Gravesite, headstone, and burial data generated from the headstone GPS spreadsheet documented in ADR 0008.
- Demo data from local seed scripts.

Identity-provider user data source: TBD.

## Update Triggers

Update this ADR or add a superseding ADR when the identity provider is selected, roles change, public access rules change, request validation policy changes, hard-delete exceptions are introduced, audit retention rules are defined, or the admin editing workflow is implemented.
