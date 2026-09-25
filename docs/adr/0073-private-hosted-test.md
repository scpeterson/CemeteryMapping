---
---

# ADR 0073: Private TEST Deployment on a Separate Cloud Server

- Status: Accepted
- Date: 2026-09-24

Run hosted TEST on a dedicated Ubuntu 24.04 DigitalOcean Droplet with 2 vCPUs,
4 GB RAM, 80 GB storage, and daily provider backups. The application must keep
running when the developer's Mac is off. Local DEV and automated TEST remain
separate from this persistent hosted TEST database.

Cloudflare Access protects the entire `test.nhcemeteries.org` hostname using
an explicit email allowlist and email one-time PIN authentication. Auth0 remains
the application identity provider, and `app_users` remains its authorization
source. Cloudflare Access does not replace application roles.

DEV, TEST, STAGE, and PROD must each use a separate Auth0 tenant, application,
API audience, user directory, signing keys, and management credentials. Separate
applications within one tenant are not sufficient environment isolation.
Hosted TEST uses its dedicated TEST tenant; STAGE and PROD must remain
unconfigured until their own tenants and deployment resources are provisioned.
Never fall back to another environment's identity configuration.

An approved DEV data snapshot may initialize TEST cemetery records and media,
but inherited user mappings must be disabled. Explicitly map approved TEST users
to identities verified in the TEST tenant; do not assume an email match or a
copied subject grants access. Keep DEV's database and identities unchanged.

Use `deploy/test/compose.yaml` on Linux. PostgreSQL 17/PostGIS 3.5 publishes only
on loopback. The Node 24 API and Nginx use host networking so the existing API
loopback binding remains unchanged. Nginx listens only on loopback port 8080;
a remotely managed Cloudflare Tunnel provides the browser route. Public inbound
HTTP and PostgreSQL are not required. Keep a host firewall allowing SSH only.

Keep database passwords, Auth0 server settings, and the tunnel token in ignored
deployment files with restricted permissions. Ship the built TEST UI and the
selected source revision; never ship development credentials or the Git working
directory wholesale. Record resolved container image digests when deploying.

Initialize the hosted database from an explicitly selected, consistent database
dump, with the matching media. Subsequent deployments must preserve both data
volumes. Do not run automated TEST rebuild or rollback scripts against this host.

Provider snapshots supplement, but do not replace, logical database backups and
separate copies of media. Verify restore procedures before admitting more testers.
See [the deployment runbook](../hosted-test.md) for prerequisites and checks.
