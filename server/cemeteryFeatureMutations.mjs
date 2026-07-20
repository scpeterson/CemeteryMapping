import { setAuditContext } from "./auditContext.mjs";
import { graveFeatureJoinSql, graveFeatureSelectSql } from "./cemeteryFeatureQueries.mjs";
import { toGraveFeature } from "./cemeteryMappers.mjs";

export async function createGraveFeature(pool, cemeteryId, feature, { actorUser, reason, allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });

    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(cemeteryId)) {
      await client.query("ROLLBACK");
      return undefined;
    }

    let gravesiteUuid = null;
    if (feature.graveSpaceId) {
      const graveResult = await client.query(
        `
          SELECT id::text
          FROM gravesites
          WHERE cemetery_id = $1
            AND gravesite_id = $2
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [cemeteryId, feature.graveSpaceId],
      );
      gravesiteUuid = graveResult.rows[0]?.id ?? null;
      if (!gravesiteUuid) {
        await client.query("ROLLBACK");
        return undefined;
      }
    }

    let headstoneUuid = feature.headstoneId || null;
    if (headstoneUuid) {
      const headstoneResult = await client.query(
        `
          SELECT headstones.id::text
          FROM headstones
          LEFT JOIN gravesites AS direct_gravesite
            ON direct_gravesite.id = headstones.gravesite_uuid
           AND direct_gravesite.deleted_at IS NULL
          LEFT JOIN LATERAL (
            SELECT gravesites.cemetery_id
            FROM headstone_gravesites
            JOIN gravesites
              ON gravesites.id = headstone_gravesites.gravesite_uuid
             AND gravesites.deleted_at IS NULL
            WHERE headstone_gravesites.headstone_uuid = headstones.id
              AND headstone_gravesites.deleted_at IS NULL
              AND gravesites.cemetery_id = $2
            LIMIT 1
          ) linked_gravesite ON true
          LEFT JOIN LATERAL (
            SELECT cemeteries.id
            FROM cemeteries
            WHERE headstones.geometry IS NOT NULL
              AND cemeteries.deleted_at IS NULL
              AND ST_Covers(cemeteries.geometry, headstones.geometry)
            ORDER BY cemeteries.name, cemeteries.id
            LIMIT 1
          ) containing_cemetery ON true
          WHERE headstones.id = $1
            AND headstones.deleted_at IS NULL
            AND COALESCE(direct_gravesite.cemetery_id, linked_gravesite.cemetery_id, containing_cemetery.id) = $2
          LIMIT 1
        `,
        [headstoneUuid, cemeteryId],
      );
      headstoneUuid = headstoneResult.rows[0]?.id ?? null;
      if (!headstoneUuid) {
        await client.query("ROLLBACK");
        return undefined;
      }
    }

    const insertResult = await client.query(
      `
        INSERT INTO grave_features (
          cemetery_id,
          gravesite_uuid,
          headstone_uuid,
          feature_type_id,
          feature_subtype_id,
          placement_type_id,
          material_type_id,
          symbol_text,
          source_type,
          source_text,
          notes,
          status
        )
        VALUES (
          $1,
          $2::uuid,
          $3::uuid,
          $4::uuid,
          NULLIF($5, '')::uuid,
          NULLIF($6, '')::uuid,
          NULLIF($7, '')::uuid,
          $8,
          $9,
          $10,
          $11,
          $12
        )
        RETURNING id::text
      `,
      [
        cemeteryId,
        gravesiteUuid,
        headstoneUuid,
        feature.featureTypeId,
        feature.featureSubtypeId || "",
        feature.placementTypeId || "",
        feature.materialTypeId || "",
        feature.symbolText || null,
        feature.sourceType || "manual",
        feature.sourceText || null,
        feature.notes || null,
        feature.status || "active",
      ],
    );

    const result = await client.query(
      `
        SELECT ${graveFeatureSelectSql}
        FROM grave_features
        ${graveFeatureJoinSql}
        WHERE grave_features.id = $1
      `,
      [insertResult.rows[0].id],
    );

    await client.query("COMMIT");
    return toGraveFeature(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateGraveFeature(pool, id, feature, { actorUser, reason, allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });

    const existing = await client.query(
      `
        SELECT id::text, cemetery_id::text
        FROM grave_features
        WHERE id = $1
          AND deleted_at IS NULL
        FOR UPDATE
      `,
      [id],
    );
    const existingFeature = existing.rows[0];
    if (!existingFeature || (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(existingFeature.cemetery_id))) {
      await client.query("ROLLBACK");
      return undefined;
    }

    await client.query(
      `
        UPDATE grave_features
        SET
          feature_type_id = $2::uuid,
          feature_subtype_id = NULLIF($3, '')::uuid,
          placement_type_id = NULLIF($4, '')::uuid,
          material_type_id = NULLIF($5, '')::uuid,
          symbol_text = NULLIF($6, ''),
          source_type = $7,
          source_text = NULLIF($8, ''),
          notes = NULLIF($9, ''),
          status = $10
        WHERE id = $1
      `,
      [
        id,
        feature.featureTypeId,
        feature.featureSubtypeId || "",
        feature.placementTypeId || "",
        feature.materialTypeId || "",
        feature.symbolText || "",
        feature.sourceType || "manual",
        feature.sourceText || "",
        feature.notes || "",
        feature.status || "active",
      ],
    );

    const result = await client.query(
      `
        SELECT ${graveFeatureSelectSql}
        FROM grave_features
        ${graveFeatureJoinSql}
        WHERE grave_features.id = $1
      `,
      [id],
    );

    await client.query("COMMIT");
    return toGraveFeature(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function softDeleteGraveFeature(pool, id, { actorUser, reason, allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });

    const existing = await client.query(
      `
        SELECT id::text, cemetery_id::text, deleted_at
        FROM grave_features
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );
    const existingFeature = existing.rows[0];
    if (!existingFeature) {
      await client.query("ROLLBACK");
      return undefined;
    }

    if (existingFeature.deleted_at) {
      await client.query("COMMIT");
      return {
        id: existingFeature.id,
        cemeteryId: existingFeature.cemetery_id,
        deletedAt: existingFeature.deleted_at,
        alreadyDeleted: true,
      };
    }

    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(existingFeature.cemetery_id)) {
      await client.query("ROLLBACK");
      return { forbidden: true };
    }

    const updateResult = await client.query(
      `
        UPDATE grave_features
        SET deleted_at = now(),
            deleted_by = $2,
            delete_reason = $3
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING id::text, cemetery_id::text, deleted_at
      `,
      [id, actorUser?.id ?? actorUser?.subject ?? null, reason ?? null],
    );
    const updated = updateResult.rows[0];

    await client.query("COMMIT");
    return {
      id: updated.id,
      cemeteryId: updated.cemetery_id,
      deletedAt: updated.deleted_at,
      alreadyDeleted: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

