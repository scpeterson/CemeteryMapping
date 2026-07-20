import { compactJoin } from "./cemeteryMappers.mjs";

export function ownershipRightNotes(right) {
  return compactJoin([right.right_type, right.target_type, right.notes]);
}

const legacyOwnerSelect = `
  owners.id::text AS id, owners.gravesite_uuid::text, owners.owner, owners.co_owner,
  NULL::text AS display_name, owners.full_address, owners.phone, owners.email, owners.sale_date,
  NULL::date AS effective_date, owners.created_at AS recorded_at, 'purchase'::text AS event_type,
  'Cemetery database'::text AS recorded_by, NULL::text AS document_reference, owners.notes,
  owners.created_at, NULL::text AS ownership_event_id
`;

export async function selectOwnersForCemeteries(client, cemeteryIds) {
  const result = await client.query(
    `
      SELECT ${legacyOwnerSelect}
      FROM owners
      WHERE owners.deleted_at IS NULL
        AND owners.gravesite_uuid IN (
          SELECT id FROM gravesites WHERE cemetery_id = ANY($1::uuid[]) AND deleted_at IS NULL
        )
      UNION ALL
      SELECT
        concat('ownership-party-', rights.ownership_party_uuid::text) AS id,
        COALESCE(rights.gravesite_uuid::text, target_gravesites.id::text) AS gravesite_uuid,
        NULL::text AS owner, NULL::text AS co_owner, rights.display_name,
        NULL::text AS full_address, NULL::text AS phone, NULL::text AS email, NULL::date AS sale_date,
        rights.effective_date, rights.recorded_at, rights.event_type, ownership_events.recorded_by,
        ownership_events.document_reference,
        concat_ws(' ', rights.right_type, rights.target_type, ownership_events.notes) AS notes,
        rights.recorded_at AS created_at,
        concat('ownership-event-', rights.ownership_event_uuid::text) AS ownership_event_id
      FROM current_ownership_right_owners rights
      JOIN ownership_events ON ownership_events.id = rights.ownership_event_uuid
      LEFT JOIN gravesites target_gravesites
        ON rights.target_type = 'lot' AND target_gravesites.lot_uuid = rights.lot_uuid
       AND target_gravesites.deleted_at IS NULL
      WHERE rights.target_type IN ('gravesite', 'lot')
        AND COALESCE(rights.gravesite_uuid, target_gravesites.id) IN (
          SELECT id FROM gravesites WHERE cemetery_id = ANY($1::uuid[]) AND deleted_at IS NULL
        )
      ORDER BY sale_date DESC NULLS LAST, effective_date DESC NULLS LAST, created_at DESC, id
    `,
    [cemeteryIds],
  );
  return result.rows;
}

export async function selectOwnersForGrave(client, graveUuid) {
  const result = await client.query(
    `
      WITH selected_grave AS (
        SELECT id, lot_uuid FROM gravesites WHERE id = $1 AND deleted_at IS NULL
      )
      SELECT ${legacyOwnerSelect}
      FROM owners
      WHERE owners.gravesite_uuid = $1 AND owners.deleted_at IS NULL
      UNION ALL
      SELECT
        concat('ownership-party-', current_ownership_right_owners.ownership_party_uuid::text) AS id,
        selected_grave.id::text AS gravesite_uuid,
        NULL::text AS owner, NULL::text AS co_owner, current_ownership_right_owners.display_name,
        NULL::text AS full_address, NULL::text AS phone, NULL::text AS email, NULL::date AS sale_date,
        current_ownership_right_owners.effective_date, current_ownership_right_owners.recorded_at,
        current_ownership_right_owners.event_type, ownership_events.recorded_by,
        ownership_events.document_reference,
        concat_ws(' ', current_ownership_right_owners.right_type, current_ownership_right_owners.target_type, ownership_events.notes) AS notes,
        current_ownership_right_owners.recorded_at AS created_at,
        concat('ownership-event-', current_ownership_right_owners.ownership_event_uuid::text) AS ownership_event_id
      FROM current_ownership_right_owners
      JOIN selected_grave ON (
        current_ownership_right_owners.target_type = 'gravesite'
        AND current_ownership_right_owners.gravesite_uuid = selected_grave.id
      ) OR (
        current_ownership_right_owners.target_type = 'lot'
        AND current_ownership_right_owners.lot_uuid = selected_grave.lot_uuid
      )
      JOIN ownership_events ON ownership_events.id = current_ownership_right_owners.ownership_event_uuid
      WHERE current_ownership_right_owners.target_type IN ('gravesite', 'lot')
      ORDER BY sale_date DESC NULLS LAST, effective_date DESC NULLS LAST, created_at DESC, id
    `,
    [graveUuid],
  );
  return result.rows;
}

export async function selectOwnershipTargets(client, cemeteryId, selectedGravesiteId, targetScope, targetGravesiteIds) {
  const selectedResult = await client.query(
    `SELECT id, cemetery_id::text, gravesite_id, lot_uuid
     FROM gravesites
     WHERE cemetery_id = $1 AND gravesite_id = $2 AND deleted_at IS NULL
     LIMIT 1`,
    [cemeteryId, selectedGravesiteId],
  );
  const selectedGrave = selectedResult.rows[0];
  if (!selectedGrave) return undefined;

  if (targetScope === "selected_lot") {
    if (!selectedGrave.lot_uuid) throw new Error("Selected gravesite is not linked to a lot.");
    return { selectedGrave, rights: [{ targetType: "lot", lotUuid: selectedGrave.lot_uuid, label: "selected lot" }] };
  }

  if (targetScope === "listed_gravesites") {
    const ids = [...new Set(targetGravesiteIds.map((id) => String(id ?? "").trim()).filter(Boolean))];
    if (ids.length === 0) throw new Error("At least one gravesite ID is required.");
    const result = await client.query(
      `SELECT id, gravesite_id FROM gravesites
       WHERE cemetery_id = $1 AND gravesite_id = ANY($2::text[]) AND deleted_at IS NULL
       ORDER BY gravesite_id`,
      [cemeteryId, ids],
    );
    if (result.rows.length !== ids.length) {
      const found = new Set(result.rows.map((row) => row.gravesite_id));
      throw new Error(`Unknown gravesite ID: ${ids.filter((id) => !found.has(id)).join(", ")}.`);
    }
    return {
      selectedGrave,
      rights: result.rows.map((row) => ({ targetType: "gravesite", gravesiteUuid: row.id, label: row.gravesite_id })),
    };
  }

  return {
    selectedGrave,
    rights: [{ targetType: "gravesite", gravesiteUuid: selectedGrave.id, label: selectedGrave.gravesite_id }],
  };
}
