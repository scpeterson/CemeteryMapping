--liquibase formatted sql

--changeset cemeterymapping:062-shift-trinity-c-0172-passageway-gravesites splitStatements:false
WITH shifted_gravesites AS (
  UPDATE gravesites
  SET
    lot_uuid = NULL,
    lot_id = NULL,
    geometry = ST_Transform(
      ST_Translate(
        ST_Transform(gravesites.geometry, 2272),
        0,
        2
      ),
      4326
    )::geometry(MultiPolygon, 4326),
    updated_at = now()
  WHERE gravesites.deleted_at IS NULL
    AND upper(COALESCE(gravesites.section_id, '')) = 'C'
    AND gravesites.gravesite_id IN ('TLC-GPS-0172-01', 'TLC-GPS-0172-02')
  RETURNING gravesites.id
)
SELECT count(*) FROM shifted_gravesites;

--rollback empty
