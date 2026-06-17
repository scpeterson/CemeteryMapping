--liquibase formatted sql

--changeset cemeterymapping:100-shift-selected-lot-rows-west splitStatements:false
WITH target_lots AS (
  SELECT lots.id
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND lots.block_id IS NULL
    AND (
      (
        upper(COALESCE(lots.section_id, '')) = 'C'
        AND lots.lot_id IN (
          '10', '11', '12', '13', '14', '15', '16', '17', '18', '19',
          '39',
          '96', '97', '98', '99', '100',
          '20', '21', '22', '23', '24', '25', '26', '27', '28', '29',
          '40',
          '91', '92', '93', '94', '95'
        )
      )
      OR (
        upper(COALESCE(lots.section_id, '')) = 'A'
        AND lots.lot_id IN (
          '1', '2', '3', '4', '5', '6', '7', '8', '9',
          '30', '31', '32', '33', '34', '35', '36', '37', '38'
        )
      )
    )
),
shifted_lots AS (
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
  FROM target_lots
  WHERE lots.id = target_lots.id
  RETURNING lots.id
),
shifted_gravesites AS (
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
  FROM target_lots
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.lot_uuid = target_lots.id
  RETURNING gravesites.id
)
SELECT
  (SELECT count(*) FROM shifted_lots) AS shifted_lot_count,
  (SELECT count(*) FROM shifted_gravesites) AS shifted_gravesite_count;

--rollback empty
