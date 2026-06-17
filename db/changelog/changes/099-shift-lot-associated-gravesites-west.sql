--liquibase formatted sql

--changeset cemeterymapping:099-shift-lot-associated-gravesites-west splitStatements:false
WITH shifted_gravesites AS (
  UPDATE gravesites
  SET
    geometry = ST_Transform(
      ST_Translate(
        ST_Transform(gravesites.geometry, 2272),
        -1.5,
        0
      ),
      4326
    )::geometry(MultiPolygon, 4326),
    updated_at = now()
  WHERE gravesites.deleted_at IS NULL
    AND (
      gravesites.lot_uuid IS NOT NULL
      OR gravesites.lot_id IS NOT NULL
      OR gravesites.gravesite_id IN ('TLC-GPS-0172-01', 'TLC-GPS-0172-02')
    )
  RETURNING gravesites.id
)
SELECT count(*) FROM shifted_gravesites;

--rollback empty
