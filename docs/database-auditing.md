---
---

# Database Auditing

Database auditing is enforced in PostgreSQL so changes are captured whether they come from the Cemetery Mapping API, an import script, or a direct database session.

## What Is Audited

Migration `014-database-audit-triggers.sql` attaches row-level audit triggers to the core business and administration tables:

- `cemeteries`
- `sections`
- `blocks`
- `lots`
- `gravesites`
- `gravesite_status_types`
- `burials`
- `headstone_condition_types`
- `owners`
- `ownership_parties`
- `ownership_events`
- `ownership_event_parties`
- `ownership_event_rights`
- `lot_owner_parties`
- `lot_ownership_event_types`
- `marker_types`
- `marker_material_types`
- `memorials`
- `headstones`
- `headstone_gravesites`
- `headstone_burials`
- `deed_investigation_cases`
- `deed_investigation_case_entries`
- `deed_investigation_case_actions`
- `historic_lot_map_gravesite_evidence`
- `app_users`
- `app_user_cemetery_access`
- `app_roles`

Each insert, update, soft delete, restore, and hard delete creates an `audit_events` row. Update events store only the changed fields in `previous_values` and `new_values`; create and hard-delete events store the full new or old row.

Row lifecycle timestamps remain on the source tables. Migration `015-updated-at-triggers.sql` maintains `updated_at` in PostgreSQL with `BEFORE UPDATE` triggers, so application write paths do not need to set it manually. The audit log remains the historical record of who changed what.

## Actor Identity

Application writes set transaction-local audit context before changing data:

```sql
SELECT set_config('app.audit.user_id', '<app user uuid>', true);
SELECT set_config('app.audit.external_subject', '<identity provider subject>', true);
SELECT set_config('app.audit.email', '<email>', true);
SELECT set_config('app.audit.role', '<app role>', true);
SELECT set_config('app.audit.source', 'api', true);
```

The trigger records that application identity plus the PostgreSQL `current_user` and `session_user`.

Direct database users do not have application audit context unless they set it explicitly. Their changes are still audited with the database login identity. For real accountability, each person or automation that connects directly to PostgreSQL must use a unique login role. Do not share a human-facing `postgres`, `cemetery_app`, or other common login.

## Direct Access Roles

Use group roles for privileges and one login role per human or automation. That keeps grants manageable while preserving the actual login identity in `session_user`.

The database group roles should mirror the application role model:

- `cemetery_reader`
- `cemetery_power_user`
- `cemetery_admin`
- `cemetery_system_admin`

Do not create one PostgreSQL login for every normal web application session. The API should continue to connect through its service account and set application audit context from Auth0 and `app_users`; that is what records the signed-in user's email, role, and identity-provider subject for application writes. Mirrored PostgreSQL roles are for direct database sessions, maintenance scripts, import jobs, and break-glass administration where PostgreSQL `current_user` and `session_user` become the primary actor evidence.

Each direct human or automation login should be granted exactly one of the mirrored group roles by default. If temporary elevated access is needed, grant it deliberately, document the reason, and revoke it after the task.

Example:

```sql
CREATE ROLE cemetery_reader NOLOGIN;
CREATE ROLE cemetery_power_user NOLOGIN;
CREATE ROLE cemetery_admin NOLOGIN;
CREATE ROLE cemetery_system_admin NOLOGIN;

GRANT CONNECT ON DATABASE cemetery_mapping_dev
TO cemetery_reader, cemetery_power_user, cemetery_admin, cemetery_system_admin;

GRANT USAGE ON SCHEMA public
TO cemetery_reader, cemetery_power_user, cemetery_admin, cemetery_system_admin;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO cemetery_reader;
GRANT cemetery_reader TO cemetery_power_user;
GRANT cemetery_power_user TO cemetery_admin;
GRANT cemetery_admin TO cemetery_system_admin;

GRANT INSERT, UPDATE ON
  cemeteries,
  sections,
  blocks,
  lots,
  gravesites,
  gravesite_status_types,
  burials,
  headstone_condition_types,
  owners,
  ownership_parties,
  ownership_events,
  ownership_event_parties,
  ownership_event_rights,
  lot_owner_parties,
  lot_ownership_event_types,
  marker_types,
  marker_material_types,
  memorials,
  headstones,
  headstone_gravesites,
  headstone_burials,
  deed_investigation_cases,
  deed_investigation_case_entries,
  deed_investigation_case_actions,
  historic_lot_map_gravesite_evidence
TO cemetery_power_user;

GRANT INSERT ON audit_events TO cemetery_power_user;

-- System-admin-only direct maintenance, such as user/role repair.
GRANT INSERT, UPDATE ON app_users, app_user_cemetery_access, app_roles
TO cemetery_system_admin;

CREATE ROLE scott_peterson LOGIN PASSWORD '<use a generated password>';
GRANT cemetery_system_admin TO scott_peterson;
```

For hosted production databases, prefer managed authentication or a database access proxy when available. The same rule still applies: the database session must preserve a unique per-person or per-automation identity.

## Querying The Audit Log

Administrators can review recent audit events in the application under **Admin > Audit Log**. The tab is read-only and supports filtering by date range, actor, entity type, operation, record ID, and result limit. Selecting an audit row shows captured actor details, database user/session user, changed fields, reason, and the old/new JSON values stored in `audit_events`.

## Retention

Migration `071-audit-retention-policy.sql` adds a singleton `audit_retention_policies` row that controls audit cleanup. The default policy keeps seven years of audit history (`2555` days), preserves at least one year as the minimum configurable retention, and deletes at most `5000` audit rows per run.

Run audit retention as a scheduled maintenance job rather than during normal API requests:

```sh
npm run db:purge:audit
```

The job reads the active policy and deletes one oldest-first batch of `audit_events` older than the cutoff. It prints the environment, cutoff, selected row count, and deleted row count as JSON so schedulers can capture the result. Admin-only API endpoints can read or update the policy and trigger a manual purge when needed.

Recent changes:

```sql
SELECT
  occurred_at,
  action,
  target_table,
  target_record_id,
  actor_email,
  actor_database_user,
  actor_session_user,
  source,
  changed_fields
FROM audit_events
ORDER BY occurred_at DESC
LIMIT 25;
```

Changes for one row:

```sql
SELECT occurred_at, action, previous_values, new_values, changed_fields
FROM audit_events
WHERE target_table = 'cemeteries'
  AND target_record_id = '<cemetery uuid>'
ORDER BY occurred_at;
```
