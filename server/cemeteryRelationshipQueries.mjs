export const headstoneRelationshipSelectSql = `
  headstone_relationships.id::text,
  headstone_relationships.from_headstone_uuid::text,
  from_headstones.headstone_id AS from_headstone_id,
  headstone_relationships.to_headstone_uuid::text,
  to_headstones.headstone_id AS to_headstone_id,
  CASE WHEN headstone_relationships.from_headstone_uuid = $1::uuid
    THEN headstone_relationships.to_headstone_uuid::text ELSE headstone_relationships.from_headstone_uuid::text END AS related_headstone_uuid,
  CASE WHEN headstone_relationships.from_headstone_uuid = $1::uuid
    THEN to_headstones.headstone_id ELSE from_headstones.headstone_id END AS related_headstone_id,
  headstone_relationships.relationship_type,
  headstone_relationships.source_type,
  headstone_relationships.source_text,
  headstone_relationships.confidence,
  headstone_relationships.notes,
  headstone_relationships.status,
  CASE WHEN headstone_relationships.from_headstone_uuid = $1::uuid THEN 'outgoing' ELSE 'incoming' END AS direction
`;

export const headstoneRelationshipJoinSql = `
  JOIN headstones AS from_headstones ON from_headstones.id = headstone_relationships.from_headstone_uuid AND from_headstones.deleted_at IS NULL
  JOIN headstones AS to_headstones ON to_headstones.id = headstone_relationships.to_headstone_uuid AND to_headstones.deleted_at IS NULL
`;

export async function headstoneRelationshipTableExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = 'headstone_relationships'
    ) AS exists
  `);
  return Boolean(result.rows[0]?.exists);
}

export async function selectRelationshipsForHeadstone(client, headstoneUuid) {
  if (!(await headstoneRelationshipTableExists(client))) return [];
  const result = await client.query(
    `SELECT ${headstoneRelationshipSelectSql}
     FROM headstone_relationships ${headstoneRelationshipJoinSql}
     WHERE headstone_relationships.deleted_at IS NULL
       AND (headstone_relationships.from_headstone_uuid = $1 OR headstone_relationships.to_headstone_uuid = $1)
     ORDER BY CASE headstone_relationships.status WHEN 'active' THEN 1 WHEN 'needs_review' THEN 2 ELSE 3 END,
       headstone_relationships.relationship_type, related_headstone_id`,
    [headstoneUuid],
  );
  return result.rows;
}
