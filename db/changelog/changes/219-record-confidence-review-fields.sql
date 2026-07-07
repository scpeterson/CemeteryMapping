--liquibase formatted sql

--changeset codex:219-record-confidence-review-fields
ALTER TABLE burials
  ADD COLUMN IF NOT EXISTS data_confidence text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS source_conflict boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_by text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE burials
  DROP CONSTRAINT IF EXISTS burials_data_confidence_check,
  DROP CONSTRAINT IF EXISTS burials_review_status_check,
  ADD CONSTRAINT burials_data_confidence_check CHECK (data_confidence IN ('unknown', 'low', 'medium', 'high')),
  ADD CONSTRAINT burials_review_status_check CHECK (review_status IN ('unreviewed', 'needs_review', 'reviewed', 'conflict'));

ALTER TABLE headstones
  ADD COLUMN IF NOT EXISTS data_confidence text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS source_conflict boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_by text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE headstones
  DROP CONSTRAINT IF EXISTS headstones_data_confidence_check,
  DROP CONSTRAINT IF EXISTS headstones_review_status_check,
  ADD CONSTRAINT headstones_data_confidence_check CHECK (data_confidence IN ('unknown', 'low', 'medium', 'high')),
  ADD CONSTRAINT headstones_review_status_check CHECK (review_status IN ('unreviewed', 'needs_review', 'reviewed', 'conflict'));

CREATE INDEX IF NOT EXISTS burials_review_status_idx ON burials (review_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS burials_source_conflict_idx ON burials (source_conflict) WHERE deleted_at IS NULL AND source_conflict;
CREATE INDEX IF NOT EXISTS headstones_review_status_idx ON headstones (review_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS headstones_source_conflict_idx ON headstones (source_conflict) WHERE deleted_at IS NULL AND source_conflict;

--rollback DROP INDEX IF EXISTS headstones_source_conflict_idx;
--rollback DROP INDEX IF EXISTS headstones_review_status_idx;
--rollback DROP INDEX IF EXISTS burials_source_conflict_idx;
--rollback DROP INDEX IF EXISTS burials_review_status_idx;
--rollback ALTER TABLE headstones DROP CONSTRAINT IF EXISTS headstones_review_status_check, DROP CONSTRAINT IF EXISTS headstones_data_confidence_check;
--rollback ALTER TABLE headstones DROP COLUMN IF EXISTS reviewed_at, DROP COLUMN IF EXISTS reviewed_by, DROP COLUMN IF EXISTS source_conflict, DROP COLUMN IF EXISTS review_notes, DROP COLUMN IF EXISTS review_status, DROP COLUMN IF EXISTS data_confidence;
--rollback ALTER TABLE burials DROP CONSTRAINT IF EXISTS burials_review_status_check, DROP CONSTRAINT IF EXISTS burials_data_confidence_check;
--rollback ALTER TABLE burials DROP COLUMN IF EXISTS reviewed_at, DROP COLUMN IF EXISTS reviewed_by, DROP COLUMN IF EXISTS source_conflict, DROP COLUMN IF EXISTS review_notes, DROP COLUMN IF EXISTS review_status, DROP COLUMN IF EXISTS data_confidence;
