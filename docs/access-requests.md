---
---

# Requesting and Approving Access

Cemetery records require an approved, active account with at least Read-only
access. There is no anonymous map or burial browsing in production.

## Applicant

Open `/request-access` on the application's website and provide your name, email,
cemetery of interest, and reason for access. Submit once. An administrator must
review the request before you can sign in to view records. The confirmation is
not an approval or proof that an account exists. Existing users should contact
an administrator about access problems rather than submit another request.

Do not send a password or private documents through the form. After approval,
follow the account verification/password setup instructions sent to you, then
return to the application's sign-in page.

## Administrator

1. Sign in as a global Admin and open **Admin → Users**. Check **Access requests**;
   the application does not currently email administrators about new requests.
2. Read the submitted details. Use **Reject request** for an unwanted request,
   or **Set up user** to populate the user form. New applicants default to
   **Read-only**; choose higher privileges only deliberately and select an
   assigned cemetery for Power user or Cemetery admin.
3. Keep the request's email and **Active user** enabled. Leave Auth0 user ID blank
   to use the configured find/create workflow, or enter the verified identity
   from the correct environment's Auth0 tenant if provisioning is manual.
4. Choose **Save user**. The application saves the user and approves the request
   together. A failed save leaves the request pending. **New user** exits the
   selected request without approving it.
5. Confirm password setup/invitation delivery. Automatic invitations require
   `AUTH0_PASSWORD_RESET_CLIENT_ID` and working Auth0 email delivery. Finding an
   existing identity does not resend an invitation; arrange a password-reset
   email when needed. A failed save after Auth0 creation can leave an identity
   without application access until you retry successfully.
6. Tell the approved user where to sign in. If the deployment uses a gateway
   email allowlist, add them there too. Application approval does not change
   Cloudflare Access policy.

The queue shows pending/hourly counts and warns at 80% of capacity. Check this regularly during onboarding.
The queue shows the oldest 200 pending requests; refresh after reviewing them to
load more. Reviewed requests remain stored for accountability. A repeat public
submission never overwrites a request or reopens a rejected request. If you
reconsider a rejection, provision the user through normal Admin → Users setup;
that does not rewrite the historical rejection.

## Hosting and release requirements

Apply migration 416 and rerun API database grants before restarting the API.
Deploy the API and frontend together. The public route is `/request-access`
(and `/request-access/`); the public POST endpoint is `/api/access-requests`.
Serve the SPA entry and its static assets for the public page. No public cemetery
lookup is needed because cemetery interest is entered as text.

Configure hosting so an unauthenticated browser can reach that page and submit
its form. If a gateway protects the host, arrange narrowly scoped routing for
this page, its assets, and the submission endpoint; do not broadly expose
`/api/*` or `/media/*`.

Apply migration 438 before releasing abuse protection. Create a managed Turnstile
widget for the request form and configure:

- Frontend build: `VITE_TURNSTILE_SITE_KEY` (public key). Hosted TEST also sets `VITE_TURNSTILE_REQUIRED=true`; STAGE/PROD always require the widget.
- Protected API runtime: `TURNSTILE_SECRET` and `TURNSTILE_HOSTNAMES` (comma-separated exact frontend hostnames).
- Hosted TEST allowlist: `test.nhcemeteries.org`; PROD: `nhcemeteries.org`. Do not include local domains or test keys in hosted API configuration.
- The supplied loopback Nginx/Tunnel deployment sets `ACCESS_REQUEST_TRUST_PROXY=loopback`; Nginx overwrites `X-Access-Request-IP`. Never enable this behind an externally exposed origin or a proxy that preserves client-supplied headers.

Hosted TEST with Auth0, STAGE and PROD reject unverified submissions even when configuration
is missing. Local DEV without a secret, and local TEST with authentication disabled and no Turnstile secret
can use the form without a widget; browser CI exercises it using an offline mock.
Turnstile scripts/frames need access to `https://challenges.cloudflare.com` if
adding a Content Security Policy. The normal map does not load the widget script.

Limits: 20 attempts per visitor and 100 total per API process per ten minutes;
Nginx five per visitor per minute (burst five), 30 total per minute (burst ten);
100 new stored requests per rolling hour and 200 pending across all instances.
Full capacity returns 429 with Retry-After; reviewing pending requests frees queue
space, while the hourly count naturally ages out. Already stored requests remain
available for review. The database-backed limits survive API restarts.

Monitor the admin queue warning, Nginx 429 counts, and Turnstile Analytics. No
per-rejection database logs or automatic emails are created. At release, submit
one real verified request, check that its token cannot be replayed, and confirm
missing/forged tokens produce no database rows.

In a signed-out browser, verify the page loads, a request succeeds, and cemetery,
search, photo, and admin endpoints still deny access. Then review a test request
and verify an approved Read-only account can browse while edits and deed/owner
information remain restricted.

For hosted TEST routing, tester assignments, and preservation of TEST users during
DEV data refreshes, see [Hosted TEST](hosted-test.md).
See [ADR 0076](adr/0076-public-access-requests.md) and [ADR 0088](adr/0088-access-request-abuse-protection.md).
