# Auth0 Test Tenant Setup

[Documentation Home](index.md)

Use a separate Auth0 tenant for non-production authentication testing. This keeps test users, callback URLs, and API permissions away from future production identity configuration.

## Tenant

Record the Auth0 test tenant domain locally:

```text
<your-auth0-test-tenant>.auth0.com
```

Record the Auth0 SPA client id locally:

```text
<your-auth0-spa-client-id>
```

Do not commit tenant-specific identifiers unless the project intentionally wants them public. They are not secrets for a SPA, but keeping them in local ignored environment files reduces unwanted probing and configuration noise.

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

The application should be configured as:

```text
Application Type: Single Page Application
Token Endpoint Authentication Method: None
```

For local development, configure:

```text
Application Login URI: http://127.0.0.1:5173
Application Origin URL: http://127.0.0.1:5173
Allowed Callback URLs: http://127.0.0.1:5173
Allowed Logout URLs: http://127.0.0.1:5173
Allowed Web Origins: http://127.0.0.1:5173
```

Use the exact same origin in the browser. This project runs Vite on a strict port so Auth0 callbacks do not drift:

```text
http://127.0.0.1:5173
```

If you choose to open the app as `http://localhost:5173` instead, add that origin to all three Auth0 URL fields too. The protocol, host, and port must match exactly.

Add TEST/STAGE URLs when those deployments exist.

If the Auth0 dashboard has an **APIs** tab for the SPA application, authorize the SPA application to request tokens for:

```text
Cemetery Mapping API - Test
```

Enable these scopes for that application/API connection:

- `read:cemetery`
- `write:cemetery`

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

For TEST-mode local frontend runs, use `.env.test.local`:

```bash
VITE_AUTH0_DOMAIN=<your-auth0-test-tenant>.auth0.com
VITE_AUTH0_CLIENT_ID=<your-auth0-spa-client-id>
VITE_AUTH0_AUDIENCE=https://cemetery-mapping.test/api
VITE_AUTH0_SCOPE=read:cemetery write:cemetery
```

Vite reads `.env.test.local` when running:

```bash
npm run dev:web:test
```

If you edit `.env.test.local`, stop and restart Vite. Vite does not reload environment variables while the dev server is already running.

Playwright e2e tests intentionally clear the frontend Auth0 variables in `playwright.config.ts` so automated tests can keep using `AUTH_MODE=disabled` even when `.env.test.local` is configured for manual Auth0 testing.

Run the API with Auth0 validation:

```bash
AUTH_MODE=auth0 \
AUTH0_DOMAIN=<your-auth0-test-tenant>.auth0.com \
AUTH0_AUDIENCE=https://cemetery-mapping.test/api \
APP_ENV=test \
npm run api
```

Run the frontend:

```bash
npm run dev:web:test
```

Open exactly:

```text
http://127.0.0.1:5173
```

## Database User Mapping

Auth0 proves identity. The application database controls app authorization.

Start the TEST database if needed:

```bash
APP_ENV=test npm run db:up
```

Connect to TEST with `psql`:

```bash
docker compose \
  -p cemeterymapping-test \
  --env-file db/env/test.env \
  exec db psql \
  -U cemetery_app \
  -d cemetery_mapping_test
```

This project does not use `docker compose --profile test`. If that command reports `service "db" is not running`, use the project name and env file shown above.

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

For a single user while testing:

```sql
INSERT INTO app_users (external_subject, email, display_name, role_name)
VALUES ('auth0|YOUR_USER_ID', 'your.email@example.com', 'Your Name', 'admin')
ON CONFLICT (external_subject) DO UPDATE
SET email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    role_name = EXCLUDED.role_name,
    is_active = true,
    updated_at = now();
```

Verify mappings:

```sql
SELECT external_subject, email, role_name, is_active
FROM app_users
ORDER BY email;
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

## Troubleshooting

### `npm` Cannot Find `package.json`

Symptom:

```text
npm error enoent Could not read package.json
```

Cause: the command was run from the wrong directory.

Fix:

```bash
cd /Users/scottpeterson/Dev/CemeteryMapping
npm run dev:web:test
```

### UI Shows `API unavailable: Cemetery API returned 401`

Meaning: the API did not receive a valid Auth0 bearer token.

Common causes:

- The frontend is not signed in.
- `.env.test.local` is missing `VITE_AUTH0_*` values.
- Vite was not restarted after editing `.env.test.local`.
- `VITE_AUTH0_AUDIENCE` does not match the Auth0 API identifier.
- The API is running with `AUTH_MODE=auth0` but the frontend is still running without Auth0 enabled.

Fix checklist:

1. Confirm `.env.test.local` contains `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, and `VITE_AUTH0_AUDIENCE`.
2. Restart `npm run dev:web:test`.
3. Confirm the frontend shows the Auth0 sign-in screen before the map.
4. Confirm the API was started with matching `AUTH0_DOMAIN` and `AUTH0_AUDIENCE`.

### Auth0 Shows `Callback URL mismatch`

Meaning: Auth0 received a `redirect_uri` that is not listed in the SPA application's Allowed Callback URLs.

Fix: add the exact browser origin to the Auth0 SPA application:

```text
Allowed Callback URLs: http://127.0.0.1:5173
Allowed Logout URLs: http://127.0.0.1:5173
Allowed Web Origins: http://127.0.0.1:5173
```

If the browser is opened at `http://localhost:5173`, either switch to `http://127.0.0.1:5173` or add the `localhost` origin to all three fields too.

### Auth0 Shows `Service not found: https://cemetery-mapping.test/api`

Meaning: the frontend requested an access token for an audience that Auth0 does not know.

Fix: create or correct the Auth0 API:

```text
Name: Cemetery Mapping API - Test
Identifier: https://cemetery-mapping.test/api
Signing Algorithm: RS256
```

The API identifier must match exactly:

```bash
VITE_AUTH0_AUDIENCE=https://cemetery-mapping.test/api
AUTH0_AUDIENCE=https://cemetery-mapping.test/api
```

Do not add a trailing slash.

### Auth0 Shows `Client ... is not authorized to access resource server`

Meaning: Auth0 recognizes both the SPA client and the API, but the SPA application is not authorized to request tokens for that API.

Fix:

1. Open the SPA application in Auth0.
2. Open its **APIs** tab if available.
3. Authorize the SPA application for `Cemetery Mapping API - Test`.
4. Enable scopes:
   - `read:cemetery`
   - `write:cemetery`
5. Save.

Also confirm the API has RBAC enabled and permissions added:

- `read:cemetery`
- `write:cemetery`

### UI Shows `API unavailable: Cemetery API returned 403`

Meaning: Auth0 token validation succeeded, but the application database did not authorize that user.

Common causes:

- No `app_users` row exists for the Auth0 `user_id`.
- `app_users.external_subject` does not exactly match the token `sub` claim.
- `app_users.is_active` is `false`.
- The user has role `reader` but attempted an admin-only action.

Fix:

1. In Auth0, open **User Management -> Users**.
2. Open the signed-in user.
3. Copy the `user_id`, such as `auth0|abc123`.
4. Insert or update the matching `app_users` row using the SQL in [Database User Mapping](#database-user-mapping).

### Status Code Summary

| Status or Message | Meaning | Usual Fix |
| --- | --- | --- |
| `401` from API | Missing or invalid bearer token | Check sign-in, frontend env, audience, and Vite restart |
| `403` from API | Token valid, local app authorization failed | Add/fix `app_users` row, role, or `is_active` |
| `Callback URL mismatch` | Auth0 callback URL config missing exact origin | Add `http://127.0.0.1:5173` to callback/logout/web origins |
| `Service not found` | Auth0 API identifier does not exist or does not match audience | Create/fix API identifier |
| `Client is not authorized to access resource server` | SPA is not authorized to request API tokens | Authorize SPA for the API and scopes |

## Sources

- [Auth0 React SDK Quickstart](https://dev.auth0.com/docs/quickstart/spa/react)
- [Auth0 React SDK API calls](https://dev.auth0.com/docs/quickstart/spa/react/02-calling-an-api)
- [Auth0 API RBAC documentation](https://auth0.com/docs/manage-users/access-control/configure-core-rbac/enable-role-based-access-control-for-apis)
