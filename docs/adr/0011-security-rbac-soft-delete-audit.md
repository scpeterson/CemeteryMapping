# ADR 0011: Secure Access with RBAC, Soft Deletes, and Audit Logging

- Status: Accepted
- Date: 2026-05-20
- Owners: Project maintainers
- Related changes: PR #15, Phase 2 security schema, Phase 3 API authorization foundation, Phase 4 grave-space soft delete/restore API

## Context

The application is moving from read-oriented cemetery mapping toward authenticated administration. It needs a highest-level administrator role that can add, edit, and delete data, and a read-only role that many users can use to query cemetery data.

The data is operational cemetery data, including spatial cemetery assets, gravesites, burials, and headstones. Changes must be attributable, accidental destructive deletes must be recoverable, and read-only users must not be able to mutate records through either the UI or direct API calls.

## Decision

Adopt a phased security model built around these parts:

- External identity provider for sign-in.
- Server-side role-based access control.
- `admin` and `reader` application roles.
- Soft deletes for application data.
- Append-only audit logging for data changes.

The application will not implement its own password storage. Authentication should be delegated to a managed identity provider such as Microsoft Entra ID, Auth0, Google Workspace, AWS Cognito, Clerk, or another provider selected before production deployment.

Authorization must be enforced in the Express API, not only in the React UI. The UI can hide unavailable actions, but the API remains the enforcement boundary.

## Roles

Initial roles:

- `admin`: can view, create, update, and soft-delete cemetery data.
- `reader`: can view cemetery data but cannot create, update, or delete it.

Future roles can be added with a new ADR or an update if the access model changes materially. Examples might include `data_steward`, `inspector`, or `import_operator`.

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
- Action name, such as `create`, `update`, `soft_delete`, `restore`, or `import_promote`.
- Target table.
- Target record id.
- Previous values when available.
- New values when available.
- Reason or note when supplied.
- Timestamp.

Audit records should not be edited by normal application workflows.

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
- Audit events for grave-space soft delete and restore operations.

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

Update this ADR or add a superseding ADR when the identity provider is selected, roles change, public access rules change, hard-delete exceptions are introduced, audit retention rules are defined, or the admin editing workflow is implemented.
