--liquibase formatted sql

--changeset cemeterymapping:098-shift-current-lot-polygons-west splitStatements:false
WITH shifted_lots AS (
  UPDATE lots
  SET
    geometry = ST_Transform(
      ST_Translate(
        ST_Transform(lots.geometry, 2272),
        -1.5,
        0
      ),
      4326
    )::geometry(MultiPolygon, 4326),
    updated_at = now()
  WHERE lots.deleted_at IS NULL
  RETURNING lots.id
)
SELECT count(*) FROM shifted_lots;

--rollback empty
