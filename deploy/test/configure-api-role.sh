#!/bin/sh
# Run after restoring/migrating the schema, as the database administrator.
set -eu
: "${CEMETERY_API_PASSWORD:?Set a separate API database password}"
if [ "$CEMETERY_API_PASSWORD" = "${POSTGRES_PASSWORD:-}" ]; then
  echo 'The API and administrative database passwords must differ.' >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-cemetery_app}" -d "${POSTGRES_DB:-cemetery_mapping_test}" <<'SQL'
\getenv api_password CEMETERY_API_PASSWORD
BEGIN;
SELECT 'CREATE ROLE cemetery_api LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cemetery_api') \gexec
ALTER ROLE cemetery_api NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
SELECT format('ALTER ROLE cemetery_api PASSWORD %L', :'api_password') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO cemetery_api', current_database()) \gexec
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO cemetery_api;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM cemetery_api;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO cemetery_api;
-- Runtime mutations and audit triggers need DML, but not migration metadata,
-- extension-owned objects, schema ownership, TRUNCATE, or trigger management.
SELECT format('GRANT INSERT, UPDATE, DELETE ON TABLE %I.%I TO cemetery_api', n.nspname, c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  AND c.relname NOT IN ('databasechangelog', 'databasechangeloglock')
  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_class'::regclass
                  AND d.objid = c.oid AND d.deptype = 'e') \gexec
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cemetery_api;
COMMIT;
SQL
