import {
  burialIntermentTypeSql,
  burialMilitaryServiceSql,
  burialRecordedDateTextSql,
  burialRecordStatusSql,
} from "./burialRepository.mjs";
import { recordReviewColumnsSql } from "./cemeterySchema.mjs";

export async function selectBurialsForCemeteries(client, cemeteryIds) {
  const militaryServiceSql = await burialMilitaryServiceSql(client);
  const intermentTypeSql = await burialIntermentTypeSql(client);
  const recordStatusSql = await burialRecordStatusSql(client);
  const recordedDateTextSql = await burialRecordedDateTextSql(client);
  const reviewColumnsSql = await recordReviewColumnsSql(client, "burials");
  const result = await client.query(
    `
      SELECT burials.id::text, burials.gravesite_uuid::text, burials.first_name, burials.last_name, burials.maiden_name, burials.full_name, burials.birth_date, ${recordedDateTextSql.select}, burials.death_date, burials.burial_date, ${intermentTypeSql.select}, ${recordStatusSql.select}, burials.funeral_home, ${militaryServiceSql.select}, burials.notes, ${reviewColumnsSql}
      FROM burials
      ${intermentTypeSql.join}
      ${recordStatusSql.join}
      ${militaryServiceSql.join}
      WHERE burials.deleted_at IS NULL
        AND burials.gravesite_uuid IN (SELECT id FROM gravesites WHERE cemetery_id = ANY($1::uuid[]) AND deleted_at IS NULL)
      ORDER BY burials.burial_date DESC NULLS LAST, burials.death_date DESC NULLS LAST, burials.last_name, burials.first_name
    `,
    [cemeteryIds],
  );

  return result.rows;
}


export async function selectBurialsForGrave(client, graveUuid) {
  const militaryServiceSql = await burialMilitaryServiceSql(client);
  const intermentTypeSql = await burialIntermentTypeSql(client);
  const recordStatusSql = await burialRecordStatusSql(client);
  const recordedDateTextSql = await burialRecordedDateTextSql(client);
  const reviewColumnsSql = await recordReviewColumnsSql(client, "burials");
  const result = await client.query(
    `
      SELECT burials.id::text, burials.gravesite_uuid::text, burials.first_name, burials.last_name, burials.maiden_name, burials.full_name, burials.birth_date, ${recordedDateTextSql.select}, burials.death_date, burials.burial_date, ${intermentTypeSql.select}, ${recordStatusSql.select}, burials.funeral_home, ${militaryServiceSql.select}, burials.notes, ${reviewColumnsSql}
      FROM burials
      ${intermentTypeSql.join}
      ${recordStatusSql.join}
      ${militaryServiceSql.join}
      WHERE burials.gravesite_uuid = $1
        AND burials.deleted_at IS NULL
      ORDER BY burials.burial_date DESC NULLS LAST, burials.death_date DESC NULLS LAST, burials.last_name, burials.first_name
    `,
    [graveUuid],
  );

  return result.rows;
}
