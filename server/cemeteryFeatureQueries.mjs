export const graveFeatureSelectSql = `
  grave_features.id::text,
  grave_features.cemetery_id::text,
  grave_features.gravesite_uuid::text,
  grave_features.headstone_uuid::text,
  grave_feature_types.id::text AS feature_type_id,
  grave_feature_types.code AS feature_type_code,
  grave_feature_types.label AS feature_type_label,
  grave_feature_subtypes.id::text AS feature_subtype_id,
  grave_feature_subtypes.code AS feature_subtype_code,
  grave_feature_subtypes.label AS feature_subtype_label,
  grave_feature_placement_types.id::text AS placement_id,
  grave_feature_placement_types.code AS placement_code,
  grave_feature_placement_types.label AS placement_label,
  grave_feature_material_types.id::text AS material_id,
  grave_feature_material_types.code AS material_code,
  grave_feature_material_types.label AS material_label,
  grave_features.symbol_text,
  grave_features.source_type,
  grave_features.source_text,
  grave_features.notes,
  grave_features.status
`;

export const graveFeatureJoinSql = `
  JOIN grave_feature_types ON grave_feature_types.id = grave_features.feature_type_id
  LEFT JOIN grave_feature_subtypes ON grave_feature_subtypes.id = grave_features.feature_subtype_id
  LEFT JOIN grave_feature_placement_types ON grave_feature_placement_types.id = grave_features.placement_type_id
  LEFT JOIN grave_feature_material_types ON grave_feature_material_types.id = grave_features.material_type_id
`;

export async function graveFeatureTablesExist(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = 'grave_features'
    ) AS exists
  `);
  return Boolean(result.rows[0]?.exists);
}

export async function selectFeaturesForGrave(client, graveUuid) {
  if (!(await graveFeatureTablesExist(client))) return [];
  const result = await client.query(
    `SELECT ${graveFeatureSelectSql}
     FROM grave_features ${graveFeatureJoinSql}
     WHERE grave_features.deleted_at IS NULL AND grave_features.gravesite_uuid = $1
     ORDER BY grave_feature_types.sort_order, grave_feature_subtypes.sort_order NULLS LAST, grave_features.created_at`,
    [graveUuid],
  );
  return result.rows;
}

export async function selectFeaturesForHeadstones(client, headstoneUuids) {
  if (!headstoneUuids.length || !(await graveFeatureTablesExist(client))) return new Map();
  const result = await client.query(
    `SELECT ${graveFeatureSelectSql}
     FROM grave_features ${graveFeatureJoinSql}
     WHERE grave_features.deleted_at IS NULL AND grave_features.headstone_uuid = ANY($1::uuid[])
     ORDER BY grave_feature_types.sort_order, grave_feature_subtypes.sort_order NULLS LAST, grave_features.created_at`,
    [headstoneUuids],
  );
  const byHeadstone = new Map();
  for (const row of result.rows) {
    const features = byHeadstone.get(row.headstone_uuid) ?? [];
    features.push(row);
    byHeadstone.set(row.headstone_uuid, features);
  }
  return byHeadstone;
}
