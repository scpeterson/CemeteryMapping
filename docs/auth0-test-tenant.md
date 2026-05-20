# Auth0 Test Tenant Setup

[Documentation Home](index.md)

Use a separate Auth0 tenant for non-production authentication testing. This keeps test users, callback URLs, and API permissions away from future production identity configuration.

## Tenant

Create a separate Auth0 tenant, for example:

```text
cemetery-mapping-test
```

Record the tenant domain:

```text
<tenant>.auth0.com
```

## API

Create an Auth0 API:

```text
Name: Cemetery Mapping API - Test
Identifier: https://cemetery-mapping.test/api
Signing Algorithm: RS256
```

Enable:

- RBAC
- Add Permissions in the Access Token

Add permissions:

- `read:cemetery`
- `write:cemetery`

## Frontend Application

Create an Auth0 application:

```text
Name: Cemetery Mapping Web - Test
Type: Single Page Application
```

For local development, configure:

```text
Allowed Callback URLs: http://127.0.0.1:5173
Allowed Logout URLs: http://127.0.0.1:5173
Allowed Web Origins: http://127.0.0.1:5173
```

Add TEST/STAGE URLs when those deployments exist.

## Roles and Users

Create roles:

- `reader`
- `admin`

Assign API permissions:

- `reader`: `read:cemetery`
- `admin`: `read:cemetery`, `write:cemetery`

Create test users:

- `cemetery.reader.test@example.com`
- `cemetery.admin.test@example.com`

Assign the `reader` role to the reader test user and the `admin` role to the admin test user.

## Application Environment

Copy `.env.local.example` to `.env.local` and set:

```bash
VITE_AUTH0_DOMAIN=<tenant>.auth0.com
VITE_AUTH0_CLIENT_ID=<single-page-application-client-id>
VITE_AUTH0_AUDIENCE=https://cemetery-mapping.test/api
VITE_AUTH0_SCOPE=read:cemetery write:cemetery
```

Run the API with Auth0 validation:

```bash
AUTH_MODE=auth0 \
AUTH0_DOMAIN=<tenant>.auth0.com \
AUTH0_AUDIENCE=https://cemetery-mapping.test/api \
APP_ENV=test \
npm run api
```

Run the frontend:

```bash
npm run dev:web:test
```

## Database User Mapping

Auth0 proves identity. The application database controls app authorization.

For each Auth0 test user, find the Auth0 `user_id` value. It usually looks like:

```text
auth0|abc123
```

Insert matching `app_users` rows:

```sql
INSERT INTO app_users (external_subject, email, display_name, role_name)
VALUES
  ('auth0|READER_SUBJECT', 'cemetery.reader.test@example.com', 'Test Reader', 'reader'),
  ('auth0|ADMIN_SUBJECT', 'cemetery.admin.test@example.com', 'Test Admin', 'admin');
```

If a user should be blocked without deleting the mapping:

```sql
UPDATE app_users
SET is_active = false
WHERE external_subject = 'auth0|SUBJECT';
```

## Manual Security Checks

With `AUTH_MODE=auth0`:

- Not signed in: the frontend should show the sign-in screen.
- Reader test user: can load map, detail, and search data.
- Reader test user: cannot call admin mutation endpoints.
- Admin test user: can call admin mutation endpoints.
- Missing `app_users` row: API returns `403`.
- Inactive `app_users` row: API returns `403`.

## Sources

- [Auth0 React SDK Quickstart](https://dev.auth0.com/docs/quickstart/spa/react)
- [Auth0 React SDK API calls](https://dev.auth0.com/docs/quickstart/spa/react/02-calling-an-api)
- [Auth0 API RBAC documentation](https://auth0.com/docs/manage-users/access-control/configure-core-rbac/enable-role-based-access-control-for-apis)
