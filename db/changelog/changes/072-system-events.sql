--liquibase formatted sql

--changeset cemeterymapping:072-system-events
CREATE TABLE system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event_type varchar(50) NOT NULL,
  severity varchar(20) NOT NULL,
  source varchar(100) NOT NULL,
  status varchar(50),
  message varchar(1000) NOT NULL,
  detail text,
  request_method varchar(10),
  request_path varchar(500),
  response_status integer,
  actor_email varchar(320),
  actor_role varchar(50),
  environment varchar(20),
  app_version varchar(100),
  duration_ms integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT system_events_event_type_check CHECK (
    event_type IN ('error', 'warning', 'job_run', 'health_check', 'integration_failure')
  ),
  CONSTRAINT system_events_severity_check CHECK (
    severity IN ('info', 'warning', 'error', 'critical')
  ),
  CONSTRAINT system_events_response_status_check CHECK (
    response_status IS NULL OR response_status BETWEEN 100 AND 599
  ),
  CONSTRAINT system_events_duration_ms_check CHECK (
    duration_ms IS NULL OR duration_ms >= 0
  )
);

CREATE INDEX system_events_occurred_at_idx ON system_events (occurred_at DESC, id DESC);
CREATE INDEX system_events_type_time_idx ON system_events (event_type, occurred_at DESC);
CREATE INDEX system_events_source_time_idx ON system_events (source, occurred_at DESC);
CREATE INDEX system_events_severity_time_idx ON system_events (severity, occurred_at DESC);

--rollback DROP INDEX IF EXISTS system_events_severity_time_idx;
--rollback DROP INDEX IF EXISTS system_events_source_time_idx;
--rollback DROP INDEX IF EXISTS system_events_type_time_idx;
--rollback DROP INDEX IF EXISTS system_events_occurred_at_idx;
--rollback DROP TABLE IF EXISTS system_events;
