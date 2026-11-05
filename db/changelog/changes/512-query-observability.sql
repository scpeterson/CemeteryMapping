--liquibase formatted sql

--changeset cemeterymapping:512-query-observability
-- Query text may contain private diagnostic context. Keep it out of the runtime
-- role's public-schema grants; only the schema owner/DBA can inspect this schema.
CREATE SCHEMA diagnostics;
REVOKE ALL ON SCHEMA diagnostics FROM PUBLIC;
CREATE EXTENSION pg_stat_statements WITH SCHEMA diagnostics;
REVOKE ALL ON ALL TABLES IN SCHEMA diagnostics FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA diagnostics FROM PUBLIC;

--rollback DROP EXTENSION pg_stat_statements;
--rollback DROP SCHEMA diagnostics;
