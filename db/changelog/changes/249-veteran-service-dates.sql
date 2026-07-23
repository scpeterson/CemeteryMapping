--liquibase formatted sql

--changeset cemeterymapping:249-veteran-service-dates
ALTER TABLE burials
  ADD COLUMN IF NOT EXISTS military_enlisted_date date,
  ADD COLUMN IF NOT EXISTS military_discharged_date date;

ALTER TABLE burials
  DROP CONSTRAINT IF EXISTS burials_military_service_dates_order_check;

ALTER TABLE burials
  ADD CONSTRAINT burials_military_service_dates_order_check
  CHECK (
    military_enlisted_date IS NULL
    OR military_discharged_date IS NULL
    OR military_discharged_date >= military_enlisted_date
  );

CREATE INDEX IF NOT EXISTS burials_military_service_dates_idx
  ON burials (military_enlisted_date, military_discharged_date)
  WHERE military_enlisted_date IS NOT NULL
     OR military_discharged_date IS NOT NULL;

--rollback DROP INDEX IF EXISTS burials_military_service_dates_idx;
--rollback ALTER TABLE burials DROP CONSTRAINT IF EXISTS burials_military_service_dates_order_check;
--rollback ALTER TABLE burials DROP COLUMN IF EXISTS military_discharged_date, DROP COLUMN IF EXISTS military_enlisted_date;
