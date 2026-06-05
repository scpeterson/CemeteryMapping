--liquibase formatted sql

--changeset cemeterymapping:048-deed-action-council-decision-fields
ALTER TABLE deed_investigation_case_actions
  ADD COLUMN council_decision_date date,
  ADD COLUMN council_document_reference varchar(250);

--rollback ALTER TABLE deed_investigation_case_actions
--rollback   DROP COLUMN IF EXISTS council_document_reference,
--rollback   DROP COLUMN IF EXISTS council_decision_date;
