---
---

# ADR 0074: Restricted API Database Accounts

- Status: Accepted
- Date: 2026-09-25
- Implementation: PR #581

## Context

The API previously used the same PostgreSQL account as database initialization and
migrations. The container bootstrap account has superuser privileges, expanding
the impact of an API compromise. Automated schema fixtures also need permissions
that normal application requests must not receive.

## Decision

Use a separate `cemetery_api` login and password for API runtime access in local
DEV, local automated TEST, and hosted TEST. Retain administrative credentials for
migrations, imports, backups, and schema fixture setup. The runtime account has
no superuser, database creation, role creation, replication, or RLS-bypass power.
Grant application-table DML, table reads, sequence usage, and schema usage, while
withholding schema creation and writes to migration metadata and extension tables.

Local setup uses `APP_ENV=dev npm run db:configure-api` or
`APP_ENV=test npm run db:configure-api` after migrations/restores. The command
preserves an existing runtime password, or generates one in the ignored local
environment file with mode 0600. CI configures the account before application
tests. Hosted setup follows the [deployment runbook](../hosted-test.md).

## Consequences and validation

New tables do not automatically receive runtime grants. Re-run setup after schema
changes or restores; restart the API after initial credential setup. Explicit
`PGUSER`/`PGPASSWORD` overrides still take precedence, so operators must avoid
supplying administrative credentials to API launch commands. Existing unconfigured
local checkouts retain the legacy fallback until setup is run.

Schema-creating tests use administrative fixture connections; application writers
use restricted connections. Regression tests verify denied administrative
privileges, audited writes, and cemetery-scoped evidence deletion. Local DEV,
local automated TEST, and hosted TEST were verified with restricted accounts.

Hosted TEST remains separate from local automated TEST. CI success and merging
source do not deploy the hosted application or replace its persistent data.
