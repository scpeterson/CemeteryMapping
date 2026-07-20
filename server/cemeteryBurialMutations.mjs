import { setAuditContext } from "./auditContext.mjs";
import { auditEventIdForMutation } from "./cemeteryAudit.mjs";
import { toBurial } from "./cemeteryMappers.mjs";
import { recordReviewColumnsSql, tableColumnExists } from "./cemeterySchema.mjs";
import {
  activeBurialRecordStatusExists,
  activeIntermentTypeExists,
  burialIntermentTypeColumnExists,
  burialIntermentTypeSql,
  burialMilitaryBranchTypeColumnExists,
  burialMilitaryRankTypeColumnExists,
  burialMilitaryServiceColumnsExist,
  burialMilitaryServiceSql,
  burialMilitaryWarServiceTypeColumnExists,
  burialRecordedDateTextSql,
  burialRecordStatusColumnExists,
  burialRecordStatusSql,
  legacyBurialIntermentTypeColumnExists,
  legacyBurialMilitaryBranchColumnExists,
  legacyBurialMilitaryWarsColumnExists,
  splitRecordedDate,
} from "./burialRepository.mjs";

async function selectBurialMutationState(client, id) {
  const militaryServiceSql = await burialMilitaryServiceSql(client);
  const intermentTypeSql = await burialIntermentTypeSql(client);
  const recordStatusSql = await burialRecordStatusSql(client);
  const recordedDateTextSql = await burialRecordedDateTextSql(client);
  const reviewColumnsSql = await recordReviewColumnsSql(client, "burials");
  const result = await client.query(
    `
      SELECT
        burials.id::text,
        gravesites.cemetery_id::text,
        burials.gravesite_uuid::text,
        burials.first_name,
        burials.last_name,
        burials.maiden_name,
        burials.full_name,
        burials.birth_date,
        ${recordedDateTextSql.select},
        burials.death_date,
        burials.burial_date,
        ${intermentTypeSql.select},
        ${recordStatusSql.select},
        burials.funeral_home,
        ${militaryServiceSql.select},
        burials.notes,
        ${reviewColumnsSql},
        burials.updated_at
      FROM burials
      ${intermentTypeSql.join}
      ${recordStatusSql.join}
      ${militaryServiceSql.join}
      JOIN gravesites
        ON gravesites.id = burials.gravesite_uuid
      WHERE burials.id = $1
        AND burials.deleted_at IS NULL
        AND gravesites.deleted_at IS NULL
      FOR UPDATE OF burials
    `,
    [id],
  );

  return result.rows[0];
}

async function selectBurialById(client, id) {
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
      WHERE burials.id = $1
        AND burials.deleted_at IS NULL
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0];
}

export async function updateBurial(pool, id, burial, { actorUser, reason, allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });
    const existing = await selectBurialMutationState(client, id);
    if (!existing) {
      await client.query("ROLLBACK");
      return undefined;
    }
    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(existing.cemetery_id)) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const fullName = [burial.firstName, burial.lastName].filter(Boolean).join(" ") || null;
    const effectiveIntermentType = burial.intermentType || "casket";
    if (!(await activeIntermentTypeExists(client, effectiveIntermentType))) {
      throw new Error(`Unsupported interment type: ${effectiveIntermentType}.`);
    }
    const effectiveRecordStatusCode = burial.recordStatusCode || "interred";
    if (!(await activeBurialRecordStatusExists(client, effectiveRecordStatusCode))) {
      throw new Error(`Unsupported burial record status: ${effectiveRecordStatusCode}.`);
    }
    const hasIntermentTypeLookup = await burialIntermentTypeColumnExists(client);
    const hasLegacyIntermentTypeColumn = !hasIntermentTypeLookup && (await legacyBurialIntermentTypeColumnExists(client));
    const hasRecordStatusLookup = await burialRecordStatusColumnExists(client);
    const hasMilitaryServiceColumns = await burialMilitaryServiceColumnsExist(client);
    const recordStatusParameter = hasMilitaryServiceColumns ? 16 : 13;
    const intermentTypeSetSql = hasIntermentTypeLookup
      ? "interment_type_id = (SELECT id FROM burial_interment_types WHERE code = $9 AND is_active)"
      : hasLegacyIntermentTypeColumn
        ? "interment_type = $9"
        : "id = id";
    const recordStatusSetSql = hasRecordStatusLookup
      ? `burial_record_status_type_id = (
              SELECT id
              FROM burial_record_status_types
              WHERE code = $${recordStatusParameter}
                AND is_active
            )`
      : "";
    const intermentTypeReturnSql = hasIntermentTypeLookup
      ? `(SELECT code FROM burial_interment_types WHERE burial_interment_types.id = burials.interment_type_id) AS interment_type,
          (SELECT label FROM burial_interment_types WHERE burial_interment_types.id = burials.interment_type_id) AS interment_type_label`
      : hasLegacyIntermentTypeColumn
        ? `COALESCE(NULLIF(interment_type, ''), 'casket') AS interment_type,
          CASE WHEN interment_type = 'urn' THEN 'Funeral urn' ELSE 'Casket' END AS interment_type_label`
        : `'casket'::text AS interment_type,
          'Casket'::text AS interment_type_label`;
    const recordStatusReturnSql = hasRecordStatusLookup
      ? `(SELECT code FROM burial_record_status_types WHERE burial_record_status_types.id = burials.burial_record_status_type_id) AS record_status_code,
          (SELECT label FROM burial_record_status_types WHERE burial_record_status_types.id = burials.burial_record_status_type_id) AS record_status_label`
      : `'interred'::text AS record_status_code,
          'Interred'::text AS record_status_label`;
    const firstRecordedDateTextParameter = hasMilitaryServiceColumns
      ? hasRecordStatusLookup
        ? 17
        : 16
      : hasRecordStatusLookup
        ? 14
        : 13;
    const recordedDateTextSql = await burialRecordedDateTextSql(client, firstRecordedDateTextParameter);
    const birthDate = splitRecordedDate(burial.birthDate);
    const deathDate = splitRecordedDate(burial.deathDate);
    const reviewedBy = actorUser?.email ?? actorUser?.displayName ?? actorUser?.subject ?? "";
    const hasMilitaryBranchLookup = hasMilitaryServiceColumns && (await burialMilitaryBranchTypeColumnExists(client));
    const hasMilitaryWarServiceLookup = hasMilitaryServiceColumns && (await burialMilitaryWarServiceTypeColumnExists(client));
    const hasMilitaryRankLookup = hasMilitaryServiceColumns && (await burialMilitaryRankTypeColumnExists(client));
    const hasLegacyMilitaryBranchColumn = hasMilitaryServiceColumns && !hasMilitaryBranchLookup && (await legacyBurialMilitaryBranchColumnExists(client));
    const hasLegacyMilitaryWarsColumn = hasMilitaryServiceColumns && !hasMilitaryWarServiceLookup && (await legacyBurialMilitaryWarsColumnExists(client));
    const effectiveMilitaryBranchCode = burial.veteran ? burial.militaryBranchCode : "";
    const effectiveMilitaryWarServiceCode = burial.veteran ? burial.militaryWarServiceCode : "";
    const effectiveMilitaryRankCode = burial.veteran && effectiveMilitaryBranchCode ? burial.militaryRankCode : "";
    const militaryBranchSetSql = hasMilitaryBranchLookup
      ? "military_branch_type_id = (SELECT id FROM military_branch_types WHERE code = NULLIF($12, '') AND is_active)"
      : hasLegacyMilitaryBranchColumn
        ? "military_branch = $12"
        : "";
    const militaryWarServiceSetSql = hasMilitaryWarServiceLookup
      ? "military_war_service_type_id = (SELECT id FROM military_war_service_types WHERE code = NULLIF($13, '') AND is_active)"
      : hasLegacyMilitaryWarsColumn
        ? "military_wars = $13"
        : "";
    const militaryRankSetSql = hasMilitaryRankLookup
      ? `military_rank_type_id = (
              SELECT military_rank_types.id
              FROM military_rank_types
              JOIN military_branch_types
                ON military_branch_types.id = military_rank_types.military_branch_type_id
              WHERE military_rank_types.code = NULLIF($14, '')
                AND military_branch_types.code = NULLIF($12, '')
                AND military_rank_types.is_active
                AND military_branch_types.is_active
            )`
      : "";
    const militaryServiceAssignments = [militaryBranchSetSql, militaryWarServiceSetSql, militaryRankSetSql, "notes = $15", recordStatusSetSql].filter(Boolean);
    const militaryServiceSetSql = hasMilitaryServiceColumns
      ? militaryServiceAssignments.join(",\n            ")
      : ["notes = $12", recordStatusSetSql].filter(Boolean).join(",\n            ");
    const militaryServiceReturnSql =
      hasMilitaryServiceColumns
        ? `${hasMilitaryBranchLookup ? "(SELECT code FROM military_branch_types WHERE military_branch_types.id = burials.military_branch_type_id)" : "NULL::text"} AS military_branch_code,
          ${hasMilitaryBranchLookup ? "(SELECT label FROM military_branch_types WHERE military_branch_types.id = burials.military_branch_type_id)" : hasLegacyMilitaryBranchColumn ? "military_branch" : "NULL::text"} AS military_branch,
          ${hasMilitaryRankLookup ? "(SELECT code FROM military_rank_types WHERE military_rank_types.id = burials.military_rank_type_id)" : "NULL::text"} AS military_rank_code,
          ${hasMilitaryRankLookup ? "(SELECT label FROM military_rank_types WHERE military_rank_types.id = burials.military_rank_type_id)" : "NULL::text"} AS military_rank,
          ${hasMilitaryRankLookup ? "(SELECT abbreviation FROM military_rank_types WHERE military_rank_types.id = burials.military_rank_type_id)" : "NULL::text"} AS military_rank_abbreviation,
          ${hasMilitaryRankLookup ? "(SELECT pay_grade FROM military_rank_types WHERE military_rank_types.id = burials.military_rank_type_id)" : "NULL::text"} AS military_rank_pay_grade,
          ${hasMilitaryWarServiceLookup ? "(SELECT code FROM military_war_service_types WHERE military_war_service_types.id = burials.military_war_service_type_id)" : "NULL::text"} AS military_war_service_code,
          ${hasMilitaryWarServiceLookup ? "(SELECT label FROM military_war_service_types WHERE military_war_service_types.id = burials.military_war_service_type_id)" : hasLegacyMilitaryWarsColumn ? "military_wars" : "NULL::text"} AS military_wars`
        : `NULL::text AS military_branch_code,
          NULL::text AS military_branch,
          NULL::text AS military_rank_code,
          NULL::text AS military_rank,
          NULL::text AS military_rank_abbreviation,
          NULL::text AS military_rank_pay_grade,
          NULL::text AS military_war_service_code,
          NULL::text AS military_wars`;
    const updateValues = hasMilitaryServiceColumns
      ? [
          id,
          burial.firstName || null,
          burial.lastName || null,
          burial.maidenName || null,
          fullName,
          birthDate.date,
          deathDate.date,
          burial.burialDate || null,
          effectiveIntermentType,
          burial.funeralHome || null,
          burial.veteran ? "Yes" : "No",
          effectiveMilitaryBranchCode || null,
          effectiveMilitaryWarServiceCode || null,
          effectiveMilitaryRankCode || null,
          burial.notes || null,
        ]
      : [
          id,
          burial.firstName || null,
          burial.lastName || null,
          burial.maidenName || null,
          fullName,
          birthDate.date,
          deathDate.date,
          burial.burialDate || null,
          effectiveIntermentType,
          burial.funeralHome || null,
          burial.veteran ? "Yes" : "No",
          burial.notes || null,
        ];
    if (hasRecordStatusLookup) updateValues.push(effectiveRecordStatusCode);
    if (recordedDateTextSql.hasColumns) updateValues.push(birthDate.text, deathDate.text);
    const recordedDateAssignments = recordedDateTextSql.hasColumns ? `,\n            ${recordedDateTextSql.set}` : "";
    const hasRecordReviewColumns = await tableColumnExists(client, "burials", "data_confidence");
    const reviewReturnSql = await recordReviewColumnsSql(client, "burials");
    let reviewAssignments = "";
    if (hasRecordReviewColumns) {
      const reviewParameterStart = updateValues.length + 1;
      updateValues.push(
        burial.dataConfidence || "unknown",
        burial.reviewStatus || "unreviewed",
        burial.reviewNotes || "",
        Boolean(burial.sourceConflict),
        reviewedBy,
      );
      reviewAssignments = `,
            data_confidence = $${reviewParameterStart},
            review_status = $${reviewParameterStart + 1},
            review_notes = NULLIF($${reviewParameterStart + 2}, ''),
            source_conflict = $${reviewParameterStart + 3}::boolean,
            reviewed_by = CASE WHEN $${reviewParameterStart + 1} = 'reviewed' THEN NULLIF($${reviewParameterStart + 4}, '') ELSE reviewed_by END,
            reviewed_at = CASE
              WHEN $${reviewParameterStart + 1} = 'reviewed' AND burials.review_status <> 'reviewed' THEN now()
              WHEN $${reviewParameterStart + 1} = 'reviewed' THEN COALESCE(reviewed_at, now())
              ELSE reviewed_at
            END`;
    }
    const updateResult = await client.query(
      `
        UPDATE burials
        SET first_name = $2,
            last_name = $3,
            maiden_name = $4,
            full_name = $5,
            birth_date = $6::date,
            death_date = $7::date,
            burial_date = $8::date,
            ${intermentTypeSetSql},
            funeral_home = $10,
            veteran = $11,
            ${militaryServiceSetSql}${recordedDateAssignments}${reviewAssignments}
        WHERE id = $1
        RETURNING
          id::text,
          gravesite_uuid::text,
          first_name,
          last_name,
          maiden_name,
          full_name,
          birth_date,
          ${recordedDateTextSql.return},
          death_date,
          burial_date,
          ${intermentTypeReturnSql},
          ${recordStatusReturnSql},
          funeral_home,
          veteran,
          ${militaryServiceReturnSql},
          notes,
          ${reviewReturnSql},
          updated_at
      `,
      updateValues,
    );
    const updatedState = updateResult.rows[0];
    const auditEventId = await auditEventIdForMutation(client, {
      actorUser,
      action: "update",
      targetTable: "burials",
      targetRecordId: id,
      previousValues: existing,
      newValues: updatedState,
      reason,
    });
    const updated = await selectBurialById(client, id);

    await client.query("COMMIT");
    return { ...toBurial(updated), auditEventId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
