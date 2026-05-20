# ADR 0012: Use Auth0 as the Identity Provider

- Status: Accepted
- Date: 2026-05-20
- Owners: Project maintainers
- Related changes: Identity provider decision phase

## Context

ADR 0011 established that the application should not store passwords and should use an external identity provider. The application needs:

- A highest-level `admin` role.
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
- `reader`

Initial API permissions:

- `read:cemetery`
- `write:cemetery`

The application database remains the system of record for application role assignment after token validation. Auth0 is the sign-in and token issuer. The API should map a validated token subject and email to `app_users`, then enforce the local role from `app_users`.

## Rationale

Auth0 is a good fit for this project because it is provider-neutral, standards-based, and designed to secure custom APIs with JWT access tokens and RBAC. It lets the project avoid password storage and account recovery code while still supporting a custom authorization model in PostgreSQL.

Microsoft Entra ID remains a strong alternative if the cemetery application later becomes part of an organization that already manages users in Microsoft 365 or Azure. Clerk is also a reasonable alternative for product-style React applications, but Auth0 is the cleaner fit for custom API authorization and provider-neutral deployment.

## Consequences

The next implementation phase should replace production use of `AUTH_MODE=trusted-header` with JWT validation against Auth0.

Required configuration placeholders:

- `AUTH_MODE=auth0`
- `AUTH0_DOMAIN`
- `AUTH0_AUDIENCE`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET` if a confidential server-side flow is later needed
- Frontend Auth0 application client id
- Frontend Auth0 authorization domain

The repository must not commit Auth0 secrets. Local, stage, and production deployments should inject them through environment-specific secret management.

Development and CI can continue using `AUTH_MODE=disabled` until Auth0 test tenant credentials are available.

## Rebuild Notes

Auth0 tenant setup checklist:

1. Create an Auth0 tenant.
2. Create an API for Cemetery Mapping.
3. Set the API identifier, which becomes `AUTH0_AUDIENCE`.
4. Enable RBAC for the API.
5. Enable adding permissions to access tokens.
6. Add permissions `read:cemetery` and `write:cemetery`.
7. Create roles `reader` and `admin`.
8. Assign `read:cemetery` to `reader`.
9. Assign `read:cemetery` and `write:cemetery` to `admin`.
10. Create a Single Page Application for the React frontend.
11. Configure allowed callback, logout, and web origin URLs for DEV, TEST, STAGE, and PROD.
12. Create application users and map their Auth0 subjects into `app_users`.

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
- [Microsoft Entra External ID documentation](https://learn.microsoft.com/en-us/entra/external-id/)
- [Clerk roles and permissions documentation](https://clerk.com/docs/organizations/create-roles-permissions)

## Update Triggers

Update this ADR if the identity provider changes, Auth0 token/role mapping changes, a Microsoft or Google tenant becomes the preferred source of truth, public unauthenticated access is introduced, or the API stops using JWT access tokens.
