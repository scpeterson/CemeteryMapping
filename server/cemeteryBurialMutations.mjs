import { burialProjectionSql } from "./burialProjection.mjs";
import { BadRequestError } from "./requestValidation.mjs";
import { withAuditContext } from "./auditContext.mjs";
import { auditEventIdForMutation } from "./cemeteryAudit.mjs";
import { toBurial } from "./cemeteryMappers.mjs";
import { recordReviewColumnsSql } from "./cemeterySchema.mjs";
import { activeBurialRecordStatusExists, activeIntermentTypeExists, burialRecordedDateTextSql, splitRecordedDate } from "./burialRepository.mjs";

async function verifiedDeathPlaceExists(client, id) {
  if (!id) return true;
  const result = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM places
        WHERE id = $1
          AND verification_status = 'verified'
          AND is_active
          AND deleted_at IS NULL
      ) AS exists
    `,
    [id],
  );
  return Boolean(result.rows[0]?.exists);
}

async function selectBurialMutationState(client, id) {
  const projection = burialProjectionSql();
  const result = await client.query(
    `
      SELECT ${projection.select}, gravesites.cemetery_id::text, burials.updated_at
      FROM burials
      ${projection.joins}
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
  const projection = burialProjectionSql();
  const result = await client.query(
    `
      SELECT ${projection.select}
      FROM burials
      ${projection.joins}
      WHERE burials.id = $1
        AND burials.deleted_at IS NULL
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0];
}

export async function updateBurial(pool, id, burial, { actorUser, reason, allowedCemeteryIds } = {}) {
  return withAuditContext(pool, { actorUser, reason }, async (client, rollback) => {
    const existing = await selectBurialMutationState(client, id);
    if (!existing) {
      return rollback(undefined);
    }
    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(existing.cemetery_id)) {
      return rollback(undefined);
    }

    const fullName = [burial.namePrefix, burial.firstName, burial.lastName, burial.nameSuffix].filter(Boolean).join(" ") || null;
    const effectiveIntermentType = burial.intermentType || "unknown";
    if (!(await activeIntermentTypeExists(client, effectiveIntermentType))) {
      throw new BadRequestError("Interment type is no longer available. Reload the record and select an active interment type.");
    }
    const effectiveRecordStatusCode = burial.recordStatusCode || "interred";
    if (!(await activeBurialRecordStatusExists(client, effectiveRecordStatusCode))) {
      throw new BadRequestError("Burial record status is no longer available. Reload the record and select an active status.");
    }
    if (!(await verifiedDeathPlaceExists(client, burial.deathPlaceId))) {
      throw new BadRequestError("Death place is no longer available. Search for and select a verified place again.");
    }

    const recordStatusParameter = 18;
    const intermentTypeSetSql = "interment_type_id = (SELECT id FROM burial_interment_types WHERE code = $9 AND is_active)";
    const recordStatusSetSql = `burial_record_status_type_id = (
              SELECT id
              FROM burial_record_status_types
              WHERE code = $${recordStatusParameter}
                AND is_active
            )`;
    const intermentTypeReturnSql = `(SELECT code FROM burial_interment_types WHERE burial_interment_types.id = burials.interment_type_id) AS interment_type,
          (SELECT label FROM burial_interment_types WHERE burial_interment_types.id = burials.interment_type_id) AS interment_type_label`;
    const recordStatusReturnSql = `(SELECT code FROM burial_record_status_types WHERE burial_record_status_types.id = burials.burial_record_status_type_id) AS record_status_code,
          (SELECT label FROM burial_record_status_types WHERE burial_record_status_types.id = burials.burial_record_status_type_id) AS record_status_label`;
    const firstRecordedDateTextParameter = 19;
    const recordedDateTextSql = burialRecordedDateTextSql(firstRecordedDateTextParameter);
    const birthDate = splitRecordedDate(burial.birthDate);
    const deathDate = splitRecordedDate(burial.deathDate);
    const reviewedBy = actorUser?.email ?? actorUser?.displayName ?? actorUser?.subject ?? "";

    const effectiveMilitaryBranchCode = burial.veteran ? burial.militaryBranchCode : "";
    const effectiveMilitaryWarServiceCode = burial.veteran ? burial.militaryWarServiceCode : "";
    const effectiveMilitaryRankCode = burial.veteran && effectiveMilitaryBranchCode ? burial.militaryRankCode : "";
    const effectiveMilitaryEnlistedDate = burial.veteran ? burial.militaryEnlistedDate : "";
    const effectiveMilitaryDischargedDate = burial.veteran ? burial.militaryDischargedDate : "";
    const militaryBranchSetSql = "military_branch_type_id = (SELECT id FROM military_branch_types WHERE code = NULLIF($12, '') AND is_active)";
    const militaryWarServiceSetSql = "military_war_service_type_id = (SELECT id FROM military_war_service_types WHERE code = NULLIF($13, '') AND is_active)";
    const militaryRankSetSql = `military_rank_type_id = (
              SELECT military_rank_types.id
              FROM military_rank_types
              JOIN military_branch_types
                ON military_branch_types.id = military_rank_types.military_branch_type_id
              WHERE military_rank_types.code = NULLIF($14, '')
                AND military_branch_types.code = NULLIF($12, '')
                AND military_rank_types.is_active
                AND military_branch_types.is_active
            )`;
    const militaryServiceAssignments = [
      militaryBranchSetSql,
      militaryWarServiceSetSql,
      militaryRankSetSql,
      "military_enlisted_date = $15::date",
      "military_discharged_date = $16::date",
      "notes = $17",
      recordStatusSetSql,
    ].filter(Boolean);
    const militaryServiceSetSql = militaryServiceAssignments.join(",\n            ");
    const militaryServiceReturnSql =
      `(SELECT code FROM military_branch_types WHERE military_branch_types.id = burials.military_branch_type_id) AS military_branch_code,
          (SELECT label FROM military_branch_types WHERE military_branch_types.id = burials.military_branch_type_id) AS military_branch,
          (SELECT code FROM military_rank_types WHERE military_rank_types.id = burials.military_rank_type_id) AS military_rank_code,
          (SELECT label FROM military_rank_types WHERE military_rank_types.id = burials.military_rank_type_id) AS military_rank,
          (SELECT abbreviation FROM military_rank_types WHERE military_rank_types.id = burials.military_rank_type_id) AS military_rank_abbreviation,
          (SELECT pay_grade FROM military_rank_types WHERE military_rank_types.id = burials.military_rank_type_id) AS military_rank_pay_grade,
          (SELECT code FROM military_war_service_types WHERE military_war_service_types.id = burials.military_war_service_type_id) AS military_war_service_code,
          (SELECT label FROM military_war_service_types WHERE military_war_service_types.id = burials.military_war_service_type_id) AS military_wars,
          military_enlisted_date,
          military_discharged_date`;
    const updateValues = [
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
      effectiveMilitaryEnlistedDate || null,
      effectiveMilitaryDischargedDate || null,
      burial.notes || null,
    ];
    updateValues.push(effectiveRecordStatusCode);
    updateValues.push(birthDate.text, deathDate.text);
    const recordedDateAssignments = `,\n            ${recordedDateTextSql.set}`;

    const reviewReturnSql = recordReviewColumnsSql("burials");

    const reviewParameterStart = updateValues.length + 1;
    updateValues.push(
      burial.dataConfidence || "unknown",
      burial.reviewStatus || "unreviewed",
      burial.reviewNotes || "",
      Boolean(burial.sourceConflict),
      reviewedBy,
    );
    const reviewAssignments = `,
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

    const nameSuffixParameter = updateValues.length + 1;
    updateValues.push(burial.nameSuffix || null);
    const deathPlaceParameter = updateValues.length + 1;
    updateValues.push(burial.deathPlaceId || null);
    const sourceUrlParameter = updateValues.length + 1;
    updateValues.push(burial.sourceUrl || null);
    const nameStatusParameter = updateValues.length + 1;
    updateValues.push(burial.givenNameStatus ?? (burial.firstName?.trim() ? "recorded" : existing.given_name_status === "no_given_name" ? "no_given_name" : "unknown"));
    const displayNameParameter = updateValues.length + 1;
    updateValues.push(burial.displayName === undefined ? existing.display_name ?? null : burial.displayName || null);
    const namePrefixParameter = updateValues.length + 1;
    updateValues.push(burial.namePrefix || null);
    const updateResult = await client.query(
      `
        UPDATE burials
        SET first_name = $2,
            last_name = $3,
            maiden_name = $4,
            name_prefix = $${namePrefixParameter},
            name_suffix = $${nameSuffixParameter},
            given_name_status = $${nameStatusParameter},
            display_name = $${displayNameParameter},
            full_name = $5,
            birth_date = $6::date,
            death_date = $7::date,
            burial_date = $8::date,
            ${intermentTypeSetSql},
            funeral_home = $10,
            veteran = $11,
            ${militaryServiceSetSql}${recordedDateAssignments}${reviewAssignments},
            death_place_uuid = $${deathPlaceParameter}::uuid,
            source_url = $${sourceUrlParameter}
        WHERE id = $1
        RETURNING
          id::text,
          gravesite_uuid::text,
          first_name,
          last_name,
          maiden_name,
          name_prefix,
          name_suffix,
          given_name_status,
          display_name,
          full_name,
          birth_date,
          ${recordedDateTextSql.return},
          death_date,
          death_place_uuid::text,
          burial_date,
          ${intermentTypeReturnSql},
          ${recordStatusReturnSql},
          funeral_home,
          source_url,
          veteran,
          ${militaryServiceReturnSql},
          notes,
          ${reviewReturnSql},
          updated_at
      `,
      updateValues,
    );
    const updatedState = updateResult.rows[0];
    const effectiveDecorationCodes = burial.veteran ? burial.militaryDecorationCodes ?? [] : [];
    await client.query("DELETE FROM burial_military_decorations WHERE burial_uuid = $1", [id]);
    if (effectiveDecorationCodes.length) {
      const decorationResult = await client.query(
        `
          INSERT INTO burial_military_decorations (burial_uuid, military_decoration_type_id)
          SELECT $1, military_decoration_types.id
          FROM military_decoration_types
          WHERE military_decoration_types.code = ANY($2::text[])
            AND military_decoration_types.is_active
          RETURNING military_decoration_type_id
        `,
        [id, effectiveDecorationCodes],
      );
      if (decorationResult.rows.length !== effectiveDecorationCodes.length) {
        throw new BadRequestError("One or more military decorations are no longer available. Reload the record and select active decorations.");
      }
    }
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

    return { ...toBurial(updated), auditEventId };

  });
}
