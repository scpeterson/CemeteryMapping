--liquibase formatted sql

--changeset cemeterymapping:076-north-hills-source-fact-review-notes
ALTER TABLE north_hills_ocr_source_facts
  ADD COLUMN review_notes text;

--rollback ALTER TABLE north_hills_ocr_source_facts DROP COLUMN IF EXISTS review_notes;
