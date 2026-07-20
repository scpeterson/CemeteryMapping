import { setAuditContext } from "./auditContext.mjs";
import { auditEventIdForMutation } from "./cemeteryAudit.mjs";
import { selectHeadstoneById } from "./cemeteryHeadstoneQueries.mjs";
import { toHeadstone } from "./cemeteryMappers.mjs";
import { selectGraveUpdateState, selectHeadstoneMutationState } from "./cemeteryMutationTargets.mjs";
import { recordReviewColumnsSql, tableColumnExists } from "./cemeterySchema.mjs";

export async function updateHeadstone(pool, id, headstone, { actorUser, reason, allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });
    const existing = await selectHeadstoneMutationState(client, id);
    if (!existing) {
      await client.query("ROLLBACK");
      return undefined;
    }
    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(existing.cemetery_id)) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const reviewedBy = actorUser?.email ?? actorUser?.displayName ?? actorUser?.subject ?? "";
    const hasRecordReviewColumns = await tableColumnExists(client, "headstones", "data_confidence");
    const reviewReturnSql = await recordReviewColumnsSql(client, "headstones");
    const reviewAssignments = hasRecordReviewColumns
      ? `,
            data_confidence = $15,
            review_status = $16,
            review_notes = NULLIF($17, ''),
            source_conflict = $18::boolean,
            reviewed_by = CASE WHEN $16 = 'reviewed' THEN NULLIF($19, '') ELSE reviewed_by END,
            reviewed_at = CASE
              WHEN $16 = 'reviewed' AND headstones.review_status <> 'reviewed' THEN now()
              WHEN $16 = 'reviewed' THEN COALESCE(reviewed_at, now())
              ELSE reviewed_at
            END`
      : "";
    const updateValues = [
      id,
      headstone.markerTypeId,
      headstone.materialId,
      headstone.conditionId,
      headstone.vaseTypeId || "",
      headstone.vaseMaterialId || "",
      headstone.vasePlacementId || "",
      headstone.vaseNotes || null,
      headstone.conditionNotes || null,
      headstone.inscription || null,
      headstone.designNotes || null,
      headstone.backDescription || null,
      headstone.photoUrl || null,
      headstone.lastInspectedAt || null,
    ];
    if (hasRecordReviewColumns) {
      updateValues.push(
        headstone.dataConfidence || "unknown",
        headstone.reviewStatus || "unreviewed",
        headstone.reviewNotes || "",
        Boolean(headstone.sourceConflict),
        reviewedBy,
      );
    }
    const updateResult = await client.query(
      `
        UPDATE headstones
        SET marker_type_id = $2::uuid,
            material_type_id = $3::uuid,
            condition_type_id = $4::uuid,
            vase_type_id = NULLIF($5, '')::uuid,
            vase_material_type_id = NULLIF($6, '')::uuid,
            vase_placement_type_id = NULLIF($7, '')::uuid,
            vase_notes = $8,
            condition_notes = $9,
            inscription = $10,
            design_notes = $11,
            back_description = $12,
            photo_url = $13,
            last_inspected_at = $14::date${reviewAssignments}
        WHERE id = $1
        RETURNING
          id::text,
          headstone_id,
          marker_type_id::text,
          (SELECT code FROM marker_types WHERE marker_types.id = headstones.marker_type_id) AS marker_type_code,
          material_type_id::text,
          (SELECT code FROM marker_material_types WHERE marker_material_types.id = headstones.material_type_id) AS material_type_code,
          condition_type_id::text,
          (SELECT code FROM headstone_condition_types WHERE headstone_condition_types.id = headstones.condition_type_id) AS condition,
          vase_type_id::text,
          (SELECT code FROM headstone_vase_types WHERE headstone_vase_types.id = headstones.vase_type_id) AS vase_type_code,
          vase_material_type_id::text,
          (SELECT code FROM headstone_vase_material_types WHERE headstone_vase_material_types.id = headstones.vase_material_type_id) AS vase_material_type_code,
          vase_placement_type_id::text,
          (SELECT code FROM headstone_vase_placement_types WHERE headstone_vase_placement_types.id = headstones.vase_placement_type_id) AS vase_placement_type_code,
          vase_notes,
          condition_notes,
          inscription,
          design_notes,
          back_description,
          photo_url,
          last_inspected_at,
          ${reviewReturnSql},
          updated_at
      `,
      updateValues,
    );
    const updatedState = updateResult.rows[0];
    const auditEventId = await auditEventIdForMutation(client, {
      actorUser,
      action: "update",
      targetTable: "headstones",
      targetRecordId: id,
      previousValues: existing,
      newValues: updatedState,
      reason,
    });
    const updated = await selectHeadstoneById(client, id);

    await client.query("COMMIT");
    return { ...toHeadstone(updated), auditEventId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createHeadstoneForGrave(pool, cemeteryId, gravesiteId, headstone, { actorUser, reason, allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });

    const grave = await selectGraveUpdateState(client, cemeteryId, gravesiteId);
    if (!grave) {
      await client.query("ROLLBACK");
      return undefined;
    }
    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(grave.cemetery_id)) {
      await client.query("ROLLBACK");
      return { forbidden: true };
    }

    const insertResult = await client.query(
      `
        INSERT INTO headstones (
          gravesite_uuid,
          headstone_id,
          marker_type,
          marker_type_id,
          material_type_id,
          condition_type_id,
          latitude,
          longitude,
          geometry,
          condition_notes,
          inscription,
          design_notes,
          back_description,
          photo_url,
          last_inspected_at,
          data_confidence,
          review_status,
          review_notes,
          source_conflict,
          updated_at
        )
        VALUES (
          $1,
          $2,
          'headstone',
          $3::uuid,
          $4::uuid,
          $5::uuid,
          $6::numeric,
          $7::numeric,
          CASE
            WHEN $6::numeric IS NULL OR $7::numeric IS NULL THEN NULL
            ELSE ST_SetSRID(ST_MakePoint($7::double precision, $6::double precision), 4326)::geometry(Point, 4326)
          END,
          NULLIF($8, ''),
          NULLIF($9, ''),
          NULLIF($10, ''),
          NULLIF($11, ''),
          NULLIF($12, ''),
          NULLIF($13, '')::date,
          $14,
          $15,
          NULLIF($16, ''),
          $17::boolean,
          now()
        )
        RETURNING id::text
      `,
      [
        grave.uuid,
        headstone.headstoneId,
        headstone.markerTypeId,
        headstone.materialId,
        headstone.conditionId,
        headstone.latitude ?? null,
        headstone.longitude ?? null,
        headstone.conditionNotes || "",
        headstone.inscription || "",
        headstone.designNotes || "",
        headstone.backDescription || "",
        headstone.photoUrl || "",
        headstone.lastInspectedAt || "",
        headstone.dataConfidence || "unknown",
        headstone.reviewStatus || "needs_review",
        headstone.reviewNotes || "",
        Boolean(headstone.sourceConflict),
      ],
    );
    const headstoneUuid = insertResult.rows[0].id;

    await client.query(
      `
        INSERT INTO headstone_gravesites (
          headstone_uuid,
          gravesite_uuid,
          relationship_type,
          notes,
          updated_at
        )
        VALUES ($1, $2, $3, NULLIF($4, ''), now())
        ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
          relationship_type = EXCLUDED.relationship_type,
          notes = EXCLUDED.notes,
          updated_at = now(),
          deleted_at = NULL,
          deleted_by = NULL,
          delete_reason = NULL
      `,
      [headstoneUuid, grave.uuid, headstone.relationshipType || "secondary", headstone.relationshipNotes || ""],
    );

    const created = await selectHeadstoneById(client, headstoneUuid);
    await client.query("COMMIT");
    return toHeadstone(created);
  } catch (error) {
    await client.query("ROLLBACK");
    if (error?.code === "23505") return { invalid: "duplicate_headstone_id" };
    throw error;
  } finally {
    client.release();
  }
}

