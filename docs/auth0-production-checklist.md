---
---

# Auth0 Production Checklist

Use this checklist when preparing a production Cemetery Mapping deployment. The application already supports Auth0 production mode; production setup is mostly tenant configuration, environment variables, and user mapping.

## Auth0 Tenant

- Create or select the production Auth0 tenant.
- Keep production separate from DEV, TEST, and STAGE tenants unless there is a documented operational reason to share one.
- Record the production tenant domain:

```text
<your-auth0-prod-tenant>.auth0.com
```

## API Resource Server

- Create an Auth0 API for the production Cemetery Mapping API.
- Set the API identifier. This value becomes `AUTH0_AUDIENCE` and `VITE_AUTH0_AUDIENCE`.
- Enable RBAC.
- Enable adding permissions to access tokens.
- Add these API permissions:
  - `read:cemetery`
  - `write:cemetery`
  - `read:deeds`
  - `write:deeds`

## Auth0 Roles

Create these Auth0 roles:

- `reader`
- `power-user`
- `cemetery-admin`
- `admin`

Assign permissions:

- `reader`: `read:cemetery`
- `power-user`: `read:cemetery`, `write:cemetery`, `read:deeds`, `write:deeds`
- `cemetery-admin`: `read:cemetery`, `write:cemetery`, `read:deeds`, `write:deeds`
- `admin`: `read:cemetery`, `write:cemetery`, `read:deeds`, `write:deeds`

You can configure the API permissions and roles with the existing setup script:

```bash
AUTH0_DOMAIN=<your-auth0-prod-tenant>.auth0.com \
AUTH0_AUDIENCE=<prod-api-identifier> \
AUTH0_MANAGEMENT_CLIENT_ID=<machine-to-machine-client-id> \
AUTH0_MANAGEMENT_CLIENT_SECRET=<machine-to-machine-client-secret> \
npm run auth0:configure
```

The machine-to-machine client needs `read:resource_servers`, `update:resource_servers`, `read:roles`, `create:roles`, and `update:roles`.

## SPA Application

- Create a production Single Page Application in Auth0 for the React frontend.
- Record the production SPA client ID. This value becomes `VITE_AUTH0_CLIENT_ID`.
- Configure allowed callback URLs for the production site URL.
- Configure allowed logout URLs for the production site URL.
- Configure allowed web origins for the production site URL.
- If the Auth0 dashboard requires authorizing the SPA for the API, authorize it for the production API identifier.

## Production Environment Variables

Set server-side values:

```bash
AUTH_MODE=auth0
AUTH0_DOMAIN=<your-auth0-prod-tenant>.auth0.com
AUTH0_AUDIENCE=<prod-api-identifier>
```

Set frontend build/runtime values:

```bash
VITE_AUTH0_DOMAIN=<your-auth0-prod-tenant>.auth0.com
VITE_AUTH0_CLIENT_ID=<prod-spa-client-id>
VITE_AUTH0_AUDIENCE=<prod-api-identifier>
VITE_AUTH0_SCOPE="read:cemetery write:cemetery read:deeds write:deeds"
```

Optional Admin UI Auth0 user provisioning:

```bash
AUTH0_MANAGEMENT_CLIENT_ID=<machine-to-machine-client-id>
AUTH0_MANAGEMENT_CLIENT_SECRET=<machine-to-machine-client-secret>
AUTH0_MANAGEMENT_CONNECTION=Username-Password-Authentication
AUTH0_PASSWORD_RESET_CLIENT_ID=<prod-spa-client-id>
```

The Management API client needs `read:users` and `create:users` for user lookup/create workflows.

## Application User Mapping

Auth0 authenticates the user. Cemetery Mapping authorizes the user from local database rows.

For each production user:

- Create or invite the user in Auth0.
- Assign the matching Auth0 role.
- Copy the Auth0 `user_id`, such as `auth0|abc123`.
- Create or update the local `app_users` row:
  - `external_subject` must exactly match the Auth0 `user_id`.
  - `role_name` must be `reader`, `power-user`, `cemetery-admin`, or `admin`.
  - `is_active` must be `true`.
- Add `app_user_cemetery_access` rows for `power-user` and `cemetery-admin` users who need cemetery-scoped edit/deed access.

## Production Database Access

- Keep the API on its service database account.
- For direct database access, create unique PostgreSQL login roles per person or automation.
- Grant those login roles through group roles that mirror the application roles:
  - `cemetery_reader`
  - `cemetery_power_user`
  - `cemetery_admin`
  - `cemetery_system_admin`
- See [Database Auditing](database-auditing.md) for the direct-access role pattern.

## Smoke Test

- Start the API with `AUTH_MODE=auth0`.
- Open the production frontend URL.
- Confirm the Auth0 sign-in screen appears.
- Sign in as a `reader` and confirm deed/owner sections are hidden.
- Sign in as a `power-user` or `cemetery-admin` with cemetery access and confirm assigned cemetery edits work.
- Sign in as an `admin` and confirm user management and audit/system event tabs are visible.
- Confirm an audit event records the application user fields and database user/session fields after an edit.
