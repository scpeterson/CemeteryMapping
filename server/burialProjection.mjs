import { burialDeathPlaceSql, burialIntermentTypeSql, burialMilitaryServiceSql, burialRecordedDateTextSql, burialRecordStatusSql } from "./burialRepository.mjs";
import { recordReviewColumnsSql } from "./cemeterySchema.mjs";

// Shared fields only: each caller owns its scope, deleted-row policy and locks.
export function burialProjectionSql() {
  const deathPlaceSql = burialDeathPlaceSql();
  const militaryServiceSql = burialMilitaryServiceSql();
  const intermentTypeSql = burialIntermentTypeSql();
  const recordStatusSql = burialRecordStatusSql();
  const recordedDateTextSql = burialRecordedDateTextSql();
  const reviewColumnsSql = recordReviewColumnsSql("burials");
  return {
    select: `burials.id::text,
      burials.gravesite_uuid::text,
      burials.first_name,
      burials.last_name,
      burials.maiden_name,
      burials.name_prefix,
      burials.name_suffix,
      burials.given_name_status,
      burials.display_name,
      burials.full_name,
      burials.birth_date,
      ${recordedDateTextSql.select},
      burials.death_date,
      ${deathPlaceSql.select},
      burials.burial_date,
      ${intermentTypeSql.select},
      ${recordStatusSql.select},
      burials.funeral_home,
      burials.source_url,
      ${militaryServiceSql.select},
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id', military_decoration_types.id::text, 'code', military_decoration_types.code, 'label', military_decoration_types.label) ORDER BY military_decoration_types.sort_order, military_decoration_types.label) FROM burial_military_decorations JOIN military_decoration_types ON military_decoration_types.id = burial_military_decorations.military_decoration_type_id WHERE burial_military_decorations.burial_uuid = burials.id), '[]'::jsonb) AS military_decorations,
      burials.notes,
      ${reviewColumnsSql}`,
    joins: `      ${deathPlaceSql.join}
      ${intermentTypeSql.join}
      ${recordStatusSql.join}
      ${militaryServiceSql.join}`,
  };
}
