--liquibase formatted sql

--changeset cemeterymapping:312-migration-prerequisite-assertions splitStatements:false
CREATE OR REPLACE FUNCTION assert_migration_prerequisite(
  p_condition boolean,
  p_requirement text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = format('Migration prerequisite failed: %s', p_requirement);
  END IF;
END;
$$;

COMMENT ON FUNCTION assert_migration_prerequisite(boolean, text) IS
  'Fails the current transaction when a data-migration prerequisite is absent. Call before mutation CTEs to prevent silent zero-row migrations.';

--rollback DROP FUNCTION IF EXISTS assert_migration_prerequisite(boolean, text);
