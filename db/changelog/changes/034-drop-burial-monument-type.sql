--liquibase formatted sql

--changeset scpeterson:034-drop-burial-monument-type splitStatements:false
-- Marker classification belongs to headstones.marker_type_id. The legacy burials.monument_type
-- column was empty and duplicated the newer physical marker model.
ALTER TABLE burials
  DROP COLUMN monument_type;

--rollback ALTER TABLE burials ADD COLUMN monument_type varchar(50);
