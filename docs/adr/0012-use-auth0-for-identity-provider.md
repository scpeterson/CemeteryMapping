---
---

# ADR 0012: Use Auth0 as the Identity Provider

- Status: Accepted
- Date: 2026-05-20
- Owners: Project maintainers
- Related changes: Identity provider decision phase, Auth0 API validation phase, Auth0 test tenant frontend phase

## Context

ADR 0011 established that the application should not store passwords and should use an external identity provider. The application needs:

- A highest-level `admin` role.
- A `power-user` role for deed/owner access and existing-record updates.
- A broadly usable `reader` role.
- Standards-based login for the React frontend.
- Verifiable access tokens for the Express API.
- A path from local development to production without rewriting the authorization model.

The application is not currently tied to a Microsoft 365, Google Workspace, or other enterprise tenant. It should remain deployable by a future maintainer who has repository access and identity-provider administrator access, but not access to the original implementer.

## Decision

Use Auth0 by Okta as the production identity provider for the first authenticated release.

Auth0 will provide:

- Hosted login.
- OpenID Connect / OAuth 2.0 authentication flows.
- JWT access tokens for the Express API.
- API authorization with RBAC enabled.
- Application roles/permissions mapped into API access tokens.

Initial Auth0 roles:

- `admin`
- `power-user`
- `reader`

Initial API permissions:

- `read:cemetery`
- `write:cemetery`

The application database remains the system of record for application role assignment after token validation. Auth0 is the sign-in and token issuer. The API should map a validated token subject and email to `app_users`, then enforce the local role from `app_users`.

## Rationale

Auth0 is a good fit for this project because it is provider-neutral, standards-based, and designed to secure custom APIs with JWT access tokens and RBAC. It lets the project avoid password storage and account recovery code while still supporting a custom authorization model in PostgreSQL.

Microsoft Entra ID remains a strong alternative if the cemetery application later becomes part of an organization that already manages users in Microsoft 365 or Azure. Clerk is also a reasonable alternative for product-style React applications, but Auth0 is the cleaner fit for custom API authorization and provider-neutral deployment.

## Consequences

Production use of `AUTH_MODE=trusted-header` is replaced by `AUTH_MODE=auth0`, which validates JWT bearer tokens against Auth0 before checking local application authorization.

Required configuration placeholders:

- `AUTH_MODE=auth0`
- `AUTH0_DOMAIN`
- `AUTH0_AUDIENCE`
- `AUTH0_MANAGEMENT_CLIENT_ID` for optional Admin UI Auth0 user provisioning
- `AUTH0_MANAGEMENT_CLIENT_SECRET` for optional Admin UI Auth0 user provisioning
- `AUTH0_MANAGEMENT_CONNECTION` for optional Admin UI Auth0 user provisioning
- `AUTH0_PASSWORD_RESET_CLIENT_ID` for optional Admin UI invitation emails
- Frontend Auth0 application client id
- Frontend Auth0 authorization domain

The repository must not commit Auth0 secrets. Local, stage, and production deployments should inject them through environment-specific secret management.

Development and CI can continue using `AUTH_MODE=disabled` until Auth0 test tenant credentials are available.

The Express API uses Auth0's `express-oauth2-jwt-bearer` middleware for JWT validation. After validation, the API loads `app_users` using the token `sub` claim and enforces the local `role_name`. Token permissions are useful context from Auth0, but the database remains the final application authorization source.

When Management API credentials are configured, the Admin UI can find an Auth0 user by email or create an Auth0 database-connection user before saving the local `app_users` row. If `AUTH0_PASSWORD_RESET_CLIENT_ID` is also configured, newly created users receive Auth0's password reset email so they can set their own password. This keeps Auth0 responsible for identity while keeping application roles local.

Admins can deactivate and reactivate application users by updating `app_users.is_active`. Deactivation blocks CemeteryMapping access after Auth0 token validation without deleting or disabling the Auth0 identity.

The React frontend uses the Auth0 React SDK when `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, and `VITE_AUTH0_AUDIENCE` are configured. If those variables are absent, the frontend does not show the sign-in flow, which keeps local development and CI compatible with `AUTH_MODE=disabled`.

Local Auth0 testing uses Vite on a strict `http://127.0.0.1:5173` origin. Auth0 callback, logout, and web-origin settings must match that origin exactly.

## Rebuild Notes

Auth0 tenant setup checklist:

1. Create an Auth0 tenant.
2. Create an API for Cemetery Mapping.
3. Set the API identifier, which becomes `AUTH0_AUDIENCE`.
4. Enable RBAC for the API.
5. Enable adding permissions to access tokens.
6. Add permissions `read:cemetery` and `write:cemetery`.
7. Create roles `reader`, `power-user`, and `admin`.
8. Assign `read:cemetery` to `reader`.
9. Assign `read:cemetery` and `write:cemetery` to `power-user` and `admin`.
10. Create a Single Page Application for the React frontend.
11. Configure allowed callback, logout, and web origin URLs for DEV, TEST, STAGE, and PROD.
12. Create application users and map their Auth0 subjects into `app_users.external_subject`.
13. Set `AUTH_MODE=auth0`, `AUTH0_DOMAIN`, and `AUTH0_AUDIENCE` in the target deployment environment.
14. Set `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, and `VITE_AUTH0_AUDIENCE` in the frontend environment.
15. Optionally create a machine-to-machine Management API client with `read:users` and `create:users`, then set `AUTH0_MANAGEMENT_CLIENT_ID`, `AUTH0_MANAGEMENT_CLIENT_SECRET`, `AUTH0_MANAGEMENT_CONNECTION`, and `AUTH0_PASSWORD_RESET_CLIENT_ID` for Admin UI user provisioning and invitation emails.

Detailed setup is documented in [Auth0 Test Tenant Setup](../auth0-test-tenant.md).

Validation commands after implementation:

```bash
npm ci
APP_ENV=test npm run db:migrate
npm run test:server
npm run lint
npm run build:test
APP_ENV=test npm run test:e2e
```

## Sources

- [Auth0 API RBAC documentation](https://auth0.com/docs/manage-users/access-control/configure-core-rbac/enable-role-based-access-control-for-apis)
- [Auth0 access token profiles](https://auth0.com/docs/secure/tokens/access-tokens/access-token-profiles)
- [Auth0 Management API user management](https://dev.auth0.com/docs/manage-users/user-accounts/manage-users-using-the-management-api)
- [Microsoft Entra External ID documentation](https://learn.microsoft.com/en-us/entra/external-id/)
- [Clerk roles and permissions documentation](https://clerk.com/docs/organizations/create-roles-permissions)

## Update Triggers

Update this ADR if the identity provider changes, Auth0 token/role mapping changes, a Microsoft or Google tenant becomes the preferred source of truth, public unauthenticated access is introduced, or the API stops using JWT access tokens.
