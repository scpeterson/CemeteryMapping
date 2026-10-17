// Canonical ownership precedence: active direct grave, first active linked
// grave (stable public-id/UUID order), then active containing cemetery. Resolve
// first and apply caller permissions afterwards; scope must not change ownership.
export const headstoneCemeteryIdSql = "COALESCE(direct_gravesite.cemetery_id, linked_gravesite.cemetery_id, containing_cemetery.id)";

export const headstoneCemeteryJoinsSql = `
  LEFT JOIN gravesites AS direct_gravesite
    ON direct_gravesite.id = headstones.gravesite_uuid
   AND direct_gravesite.deleted_at IS NULL
   AND EXISTS (
     SELECT 1 FROM cemeteries
     WHERE cemeteries.id = direct_gravesite.cemetery_id AND cemeteries.deleted_at IS NULL
   )
  LEFT JOIN LATERAL (
    SELECT gravesites.cemetery_id, gravesites.gravesite_id, gravesites.section_id, gravesites.grave_id
    FROM headstone_gravesites
    JOIN gravesites ON gravesites.id = headstone_gravesites.gravesite_uuid
      AND gravesites.deleted_at IS NULL
    JOIN cemeteries ON cemeteries.id = gravesites.cemetery_id AND cemeteries.deleted_at IS NULL
    WHERE headstone_gravesites.headstone_uuid = headstones.id
      AND headstone_gravesites.deleted_at IS NULL
    ORDER BY gravesites.gravesite_id, gravesites.id
    LIMIT 1
  ) linked_gravesite ON true
  LEFT JOIN LATERAL (
    SELECT cemeteries.id
    FROM cemeteries
    WHERE direct_gravesite.id IS NULL AND linked_gravesite.cemetery_id IS NULL
      AND headstones.geometry IS NOT NULL
      AND cemeteries.deleted_at IS NULL
      AND ST_Covers(cemeteries.geometry, headstones.geometry)
    ORDER BY cemeteries.name, cemeteries.id
    LIMIT 1
  ) containing_cemetery ON true
`;
