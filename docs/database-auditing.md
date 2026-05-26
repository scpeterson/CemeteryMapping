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
- `burials`
- `owners`
- `lot_owner_parties`
- `memorials`
- `headstones`
- `headstone_burials`
- `app_users`
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

Example:

```sql
CREATE ROLE cemetery_direct_read NOLOGIN;
CREATE ROLE cemetery_direct_write NOLOGIN;

GRANT CONNECT ON DATABASE cemetery_mapping_dev TO cemetery_direct_read, cemetery_direct_write;
GRANT USAGE ON SCHEMA public TO cemetery_direct_read, cemetery_direct_write;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO cemetery_direct_read;
GRANT cemetery_direct_read TO cemetery_direct_write;

GRANT INSERT, UPDATE ON
  cemeteries,
  sections,
  blocks,
  lots,
  gravesites,
  burials,
  owners,
  lot_owner_parties,
  memorials,
  headstones,
  headstone_burials
TO cemetery_direct_write;

GRANT INSERT ON audit_events TO cemetery_direct_write;

CREATE ROLE scott_peterson LOGIN PASSWORD '<use a generated password>';
GRANT cemetery_direct_write TO scott_peterson;
```

For hosted production databases, prefer managed authentication or a database access proxy when available. The same rule still applies: the database session must preserve a unique per-person or per-automation identity.

## Querying The Audit Log

Administrators can review recent audit events in the application under **Admin > Audit Log**. The tab is read-only and supports filtering by date range, actor, entity type, operation, record ID, and result limit. Selecting an audit row shows captured actor details, database user/session user, changed fields, reason, and the old/new JSON values stored in `audit_events`.

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
