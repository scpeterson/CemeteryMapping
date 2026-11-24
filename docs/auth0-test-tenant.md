---
---

# Auth0 Test Tenant Setup

[Documentation Home](index.md)

Use a dedicated Auth0 tenant for TEST, separate from DEV, STAGE, and PROD. Each environment has its own applications, API audience, users, signing keys, and management credentials. Separate applications in one tenant do not provide this isolation. Keep frontend values in environment-specific ignored files such as `.env.test.local`, never a shared `.env.local`.

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
- `read:deeds`
- `write:deeds`

These permissions are Auth0 tenant configuration. CemeteryMapping requests and validates tokens, but it does not create Auth0 API permissions or assign them to Auth0 roles automatically.

You can configure these API permissions and role assignments from the command line instead of clicking through the dashboard:

```bash
AUTH0_DOMAIN=<your-auth0-test-tenant>.auth0.com \
AUTH0_AUDIENCE=https://cemetery-mapping.test/api \
AUTH0_MANAGEMENT_CLIENT_ID=<machine-to-machine-client-id> \
AUTH0_MANAGEMENT_CLIENT_SECRET=<machine-to-machine-client-secret> \
npm run auth0:configure
```

Use the same script for each environment by changing the Auth0 tenant, API audience, and Management API credentials. The machine-to-machine client needs `read:resource_servers`, `update:resource_servers`, `read:roles`, `create:roles`, and `update:roles`.

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

For concurrent DEV and local TEST, keep DEV on port **5173** and configure
local TEST's dedicated SPA client for port **5174**. On the TEST application,
retain any existing hosted TEST URLs and add the exact local origin to all three
lists:

```text
Allowed Callback URLs: http://127.0.0.1:5174
Allowed Logout URLs: http://127.0.0.1:5174
Allowed Web Origins: http://127.0.0.1:5174
```

Use the exact same origin in the browser. The managed local TEST runtime uses a
strict port; see [environment consistency](environment-consistency.md). DEV's
separate tenant/application continues to use `http://127.0.0.1:5173`.
If you choose `localhost` instead of `127.0.0.1`, that is a different origin and
requires a separately reviewed exact URL in all three fields. Do not add wildcards
or replace the hosted client's existing origins. Verify a fresh sign-in and
sign-out after changing these settings; a cached session does not prove callback
configuration works.

Add TEST/STAGE URLs when those deployments exist.

If the Auth0 dashboard has an **APIs** tab for the SPA application, authorize the SPA application to request tokens for:

```text
Cemetery Mapping API - Test
```

Enable these scopes for that application/API connection:

- `read:cemetery`
- `write:cemetery`
- `read:deeds`
- `write:deeds`

## Roles and Users

Create roles:

- `reader`
- `power-user`
- `cemetery-admin`
- `admin`

Assign API permissions:

- `reader`: `read:cemetery`
- `power-user`: `read:cemetery`, `write:cemetery`, `read:deeds`, `write:deeds`
- `cemetery-admin`: `read:cemetery`, `write:cemetery`, `read:deeds`, `write:deeds`
- `admin`: `read:cemetery`, `write:cemetery`, `read:deeds`, `write:deeds`

After adding or changing Auth0 permissions, sign out and sign back in so Auth0 issues a fresh access token with the updated permission set.

Create test users:

- `cemetery.reader.test@example.com`
- `cemetery.power.test@example.com`
- `cemetery.cemetery-admin.test@example.com`
- `cemetery.admin.test@example.com`

Assign Auth0 roles for the intended token/API permission context. CemeteryMapping authorizes the active local account: `app_users.role_name = 'admin'` grants system access, while `app_user_cemetery_access.role_name` assigns each other cemetery role independently. An Auth0 role alone does not create or upgrade a local membership. For a mixed-role test account, configure its different cemetery roles in Admin → Users.

## Optional Admin User Provisioning

The Admin UI can find an Auth0 user by email or create one in the configured database connection, then save the returned Auth0 `user_id` as the local Auth0 user ID.

Create a machine-to-machine application authorized for the Auth0 Management API with:

- `read:users`
- `create:users`

Add these server-only environment variables when running the API:

```bash
AUTH0_MANAGEMENT_CLIENT_ID=<machine-to-machine-client-id>
AUTH0_MANAGEMENT_CLIENT_SECRET=<machine-to-machine-client-secret>
AUTH0_MANAGEMENT_CONNECTION=Username-Password-Authentication
AUTH0_PASSWORD_RESET_CLIENT_ID=<your-auth0-spa-client-id>
```

When a new Admin UI user is saved without an Auth0 user ID, the API searches Auth0 by email first. If no user exists, it creates one in `AUTH0_MANAGEMENT_CONNECTION` with a generated temporary password and asks Auth0 to send the verification email. When `AUTH0_PASSWORD_RESET_CLIENT_ID` is configured, it also asks Auth0 to send a password reset email so the user can set their own password. System access and cemetery membership roles remain in the application database; Auth0 provisioning does not assign those memberships.

The Admin UI can also deactivate or reactivate existing application users. This updates only `app_users.is_active`; it does not delete the local mapping and does not delete or disable the Auth0 account.

## Application Environment

For TEST-mode local frontend runs, use `.env.test.local`:

```bash
VITE_AUTH0_DOMAIN=<your-auth0-test-tenant>.auth0.com
VITE_AUTH0_CLIENT_ID=<your-auth0-spa-client-id>
VITE_AUTH0_AUDIENCE=https://cemetery-mapping.test/api
VITE_AUTH0_SCOPE=read:cemetery write:cemetery read:deeds write:deeds
```

Vite reads `.env.test.local` when running:

```bash
npm run dev:web:test
```

If you edit `.env.test.local`, stop and restart Vite. Vite does not reload environment variables while the dev server is already running.

Playwright e2e tests explicitly set `VITE_AUTH_MODE=disabled` for the frontend and `AUTH_MODE=disabled` for the API in `playwright.config.ts`, even when `.env.test.local` contains Auth0 settings for manual testing. Database access still uses the restricted account configured by `APP_ENV=test npm run db:configure-api`.

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

The setup order is:

1. Create or sign in with the Auth0 test user.
2. Copy that Auth0 user's `user_id`.
3. Connect to the TEST database.
4. Insert or update the matching `app_users` row.
5. Refresh the application.

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

For each Auth0 test user, find the Auth0 `user_id` value:

1. Open Auth0.
2. Go to **User Management -> Users**.
3. Open the test user you used to sign in.
4. Copy the `user_id`.

It usually looks like:

```text
auth0|abc123
```

The copied Auth0 `user_id` must exactly match `app_users.external_subject`.

Insert or update an admin test user:

```sql
INSERT INTO app_users (external_subject, email, display_name, role_name)
VALUES (
  'auth0|PASTE_AUTH0_USER_ID_HERE',
  'cemetery.admin.test@example.com',
  'Test Admin',
  'admin'
)
ON CONFLICT (external_subject) DO UPDATE
SET email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    role_name = EXCLUDED.role_name,
    is_active = true,
    updated_at = now();
```

Prefer **Admin → Users** to create a cemetery member and add one or more memberships. The controlled manual reader example below adds one membership; it does not limit the account to one cemetery. Replace the UUID with a verified existing TEST cemetery ID and run both inserts together. Direct SQL bypasses account validation.

```sql
\set cemetery_id 'PASTE_EXISTING_TEST_CEMETERY_UUID_HERE'
BEGIN;
INSERT INTO app_users (external_subject, email, display_name, role_name)
VALUES (
  'auth0|PASTE_AUTH0_USER_ID_HERE',
  'cemetery.reader.test@example.com',
  'Test Reader',
  'reader'
)
ON CONFLICT (external_subject) DO UPDATE
SET email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    role_name = EXCLUDED.role_name,
    is_active = true,
    updated_at = now();
```

Add the assignment before committing the manual reader setup:

```sql
INSERT INTO app_user_cemetery_access (app_user_id, cemetery_id, role_name, can_edit)
SELECT id, :'cemetery_id'::uuid, 'reader', false
FROM app_users
WHERE external_subject = 'auth0|PASTE_AUTH0_USER_ID_HERE'
ON CONFLICT (app_user_id, cemetery_id) DO UPDATE
SET role_name = EXCLUDED.role_name, can_edit = EXCLUDED.can_edit;
COMMIT;
```

Admin → Users and the user API require at least one membership when creating or saving a non-admin account, including a reader. Use **Add cemetery** to assign several cemeteries, with a separate role for each. System admins are exempt. The header lets non-admin users switch among assigned cemeteries; My profile sets their preferred initial cemetery.

Use `app_users.role_name = 'admin'` for system administrators. For other accounts, set each membership's `role_name` to `reader`, `power-user` or `cemetery-admin`; the two editable roles use `can_edit = true` and readers use `false`. The non-admin `app_users.role_name` is a compatibility summary, not a substitute for these rows. A `cemetery-admin` membership in one cemetery does not grant edits, deeds or admin actions in another cemetery where the same person is a reader.

Verify mappings and run the [assignment audit](hosted-test.md#cemetery-assignment-audit). Review each membership before sign-in and retain legitimate multiple assignments:

```sql
SELECT u.external_subject, u.email, u.role_name AS account_role, u.is_active,
       c.name AS cemetery, a.role_name AS cemetery_role, a.can_edit
FROM app_users u
LEFT JOIN app_user_cemetery_access a ON a.app_user_id = u.id
LEFT JOIN cemeteries c ON c.id = a.cemetery_id
ORDER BY u.email, c.name;
```

After inserting or updating the row, refresh the browser. If the app still returns `403`, confirm:

- `external_subject` exactly matches the Auth0 `user_id`.
- `is_active` is `true`.
- `role_name` is `reader`, `power-user`, `cemetery-admin`, or `admin`.
- For scoped edits, the target membership has the required role and `can_edit = true`; reader memberships do not gain edit rights from another cemetery's role.
- The API is connected to the same TEST database where the row was inserted.

If a user should be blocked without deleting the mapping:

```sql
UPDATE app_users
SET is_active = false
WHERE external_subject = 'auth0|SUBJECT';
```

The Admin UI Deactivate button performs the same local access block. Use Reactivate in the Admin UI, or set `is_active = true`, to restore application access.

## Manual Security Checks

With `AUTH_MODE=auth0`:

- Not signed in: the frontend should show the sign-in screen.
- Reader test user: has one or more reader memberships, opens the preferred or first assigned cemetery, and can switch between assignments without receiving edit or deed/owner access.
- Non-admin account creation/update: rejects missing assignments; reader assignments do not grant edits.
- Admin test user without a preferred cemetery: initial map fits all cemeteries; a preferred active cemetery sets its initial scope.
- Reader test user: cannot call admin mutation endpoints.
- Power-user and cemetery-admin test users: can update assigned cemetery records and cannot update unassigned cemetery records.
- Mixed-role test user: cemetery-admin in A and reader in B; can administer A, but cannot edit records, see deeds/owners, edit inspections, delete photos or manage Members/Policies in B. System Users/Lookups remain unavailable. General record reads keep their existing visibility rules; map scoping is not tenant isolation.
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
   - `read:deeds`
   - `write:deeds`
5. Save.

Also confirm the API has RBAC enabled and permissions added:

- `read:cemetery`
- `write:cemetery`
- `read:deeds`
- `write:deeds`

If the API or role permissions were just changed, sign out and sign back in before retesting. Existing access tokens keep their original permissions until they expire or are replaced.

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
