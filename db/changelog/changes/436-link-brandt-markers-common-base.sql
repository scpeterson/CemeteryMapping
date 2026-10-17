--liquibase formatted sql

--changeset cemeterymapping:436-link-brandt-markers-common-base splitStatements:false
SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM headstones
    WHERE headstone_id IN ('TLC-HS-0451', 'TLC-HS-0452') AND deleted_at IS NULL
  ) OR EXISTS (
    SELECT 1 FROM headstones a
    JOIN gravesites ga ON ga.id = a.gravesite_uuid AND ga.deleted_at IS NULL
    JOIN headstones b ON b.headstone_id = 'TLC-HS-0452' AND b.deleted_at IS NULL
    JOIN gravesites gb ON gb.id = b.gravesite_uuid AND gb.deleted_at IS NULL
    WHERE a.headstone_id = 'TLC-HS-0451' AND a.deleted_at IS NULL
      AND ga.cemetery_id = gb.cemetery_id
      AND ga.gravesite_id = 'TLC-GPS-0451' AND gb.gravesite_id = 'TLC-GPS-0452'
  ),
  'both Brandt markers must belong to their separate active gravesites in the same cemetery'
);

INSERT INTO headstone_relationships (
  from_headstone_uuid, to_headstone_uuid, relationship_type, source_type,
  source_text, confidence, notes, status
)
SELECT a.id, b.id, 'common_base', 'manual',
  'User confirmed on 2026-10-07 that TLC-HS-0451 and TLC-HS-0452 are separate markers sharing the same physical base.',
  'high',
  'Separate markers for Philip Brandt and Christina A Brandt share one physical base. Each marker retains its own burial and gravesite associations.',
  'active'
FROM headstones a
JOIN headstones b ON b.headstone_id = 'TLC-HS-0452' AND b.deleted_at IS NULL
WHERE a.headstone_id = 'TLC-HS-0451' AND a.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM headstone_relationships r
    WHERE r.relationship_type = 'common_base' AND r.deleted_at IS NULL
      AND ((r.from_headstone_uuid = a.id AND r.to_headstone_uuid = b.id)
        OR (r.from_headstone_uuid = b.id AND r.to_headstone_uuid = a.id))
  );

--rollback empty
