--liquibase formatted sql

--changeset cemeterymapping:444-remove-d-0482-plot-marker-pseudo-burial splitStatements:false
SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0482' AND deleted_at IS NULL)
  OR EXISTS (
    SELECT 1 FROM headstones h JOIN gravesites g ON g.id = h.gravesite_uuid
    WHERE g.gravesite_id = 'TLC-GPS-0482' AND g.deleted_at IS NULL
      AND h.headstone_id = 'TLC-HS-0482' AND h.deleted_at IS NULL
  ),
  'D-0482 must retain its active TLC-HS-0482 marker before removing the plot-marker pseudo-burial'
);

UPDATE headstone_burials hb
SET deleted_at = now(), deleted_by = NULL,
    delete_reason = 'Removed plot marker label incorrectly imported as a burial: Plot Marker, MP.'
FROM burials b, gravesites g
WHERE hb.burial_uuid = b.id AND b.gravesite_uuid = g.id
  AND g.gravesite_id = 'TLC-GPS-0482' AND g.deleted_at IS NULL
  AND b.full_name = 'Plot Marker, MP'
  AND trim(coalesce(b.first_name, '')) = '' AND b.last_name = 'Plot Marker, MP'
  AND b.deleted_at IS NULL AND hb.deleted_at IS NULL;

UPDATE burials b
SET deleted_at = now(), deleted_by = NULL,
    delete_reason = 'Removed plot marker label incorrectly imported as a burial: Plot Marker, MP.',
    updated_at = now()
FROM gravesites g
WHERE b.gravesite_uuid = g.id
  AND g.gravesite_id = 'TLC-GPS-0482' AND g.deleted_at IS NULL
  AND b.full_name = 'Plot Marker, MP'
  AND trim(coalesce(b.first_name, '')) = '' AND b.last_name = 'Plot Marker, MP'
  AND b.deleted_at IS NULL;

--rollback empty
