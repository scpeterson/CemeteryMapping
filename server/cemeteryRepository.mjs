import { setAuditContext } from "./auditContext.mjs";

const statusMap = new Map([
  ["available", "available"],
  ["reserved", "reserved"],
  ["occupied", "occupied"],
  ["sold", "sold"],
  ["needs_review", "needs_review"],
  ["needs review", "needs_review"],
]);

function normalizeStatus(status) {
  return statusMap.get(String(status ?? "").trim().toLowerCase()) ?? "unknown";
}

function parseGeometry(value) {
  if (!value) return undefined;
  return typeof value === "string" ? JSON.parse(value) : value;
}

function dateOnly(value) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function compactJoin(values, separator = " | ") {
  return values.filter(Boolean).join(separator) || undefined;
}

function ownerDisplayName(owner) {
  return owner.display_name ?? compactJoin([owner.owner, owner.co_owner], " and ") ?? "Unknown owner";
}

function toOwner(owner) {
  return {
    id: owner.id,
    displayName: ownerDisplayName(owner),
    contactNote: compactJoin([owner.phone, owner.email, owner.full_address, owner.document_reference, owner.notes]),
  };
}

function toBurial(burial) {
  return {
    id: burial.id,
    person: {
      id: `person-${burial.id}`,
      firstName: burial.first_name ?? "",
      lastName: burial.last_name ?? burial.full_name ?? "Unknown",
      birthDate: dateOnly(burial.birth_date),
      deathDate: dateOnly(burial.death_date),
    },
    burialDate: dateOnly(burial.burial_date),
    intermentType: burial.interment_type ?? "casket",
    funeralHome: burial.funeral_home ?? "",
    recordNotes: burial.notes ?? "",
    notes: compactJoin([burial.funeral_home ? `Funeral home: ${burial.funeral_home}` : undefined, burial.notes]),
  };
}

function toOwnershipEvent(owner) {
  const eventTypeMap = new Map([
    ["deed", "purchase"],
    ["sale", "purchase"],
    ["gift", "transfer"],
    ["church_council_action", "correction"],
  ]);
  const eventType = eventTypeMap.get(owner.event_type) ?? owner.event_type ?? "purchase";

  return {
    id: owner.ownership_event_id ?? `owner-${owner.id}`,
    ownerIds: [owner.id],
    eventType,
    effectiveDate: dateOnly(owner.effective_date ?? owner.sale_date ?? owner.recorded_at ?? owner.created_at) ?? "1900-01-01",
    recordedBy: owner.recorded_by ?? "Cemetery database",
    documentReference: owner.document_reference ?? undefined,
    notes: owner.notes,
  };
}

function toLookupValue(row, prefix) {
  return {
    id: row[`${prefix}_id`],
    code: row[`${prefix}_code`],
    label: row[`${prefix}_label`],
  };
}

function toHeadstone(row) {
  return {
    id: row.id,
    headstoneId: row.headstone_id,
    markerType: toLookupValue(row, "marker_type"),
    material: toLookupValue(row, "material"),
    condition: toLookupValue(row, "condition"),
    conditionNotes: row.condition_notes ?? "",
    inscription: row.inscription ?? "",
    photoUrl: row.photo_url ?? "",
    lastInspectedAt: dateOnly(row.last_inspected_at),
    relationshipType: row.relationship_type ?? "primary",
    relationshipNotes: row.relationship_notes ?? "",
    burialIds: row.burial_ids ?? [],
    northHillsEvidence: row.north_hills_evidence ?? [],
    mediaAssets: row.media_assets ?? [],
  };
}

function toMediaAsset(row) {
  return {
    id: row.id,
    cemeteryId: row.cemetery_id,
    assetType: row.asset_type,
    fileUrl: row.file_url,
    thumbnailUrl: row.thumbnail_url ?? "",
    originalFilename: row.original_filename ?? "",
    contentType: row.content_type ?? "",
    byteSize: row.byte_size ?? 0,
    capturedAt: row.captured_at,
    uploadedAt: row.uploaded_at,
    capturedByEmail: row.captured_by_email ?? "",
    latitude: row.latitude === null || row.latitude === undefined ? undefined : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? undefined : Number(row.longitude),
    gpsAccuracy: row.gps_accuracy === null || row.gps_accuracy === undefined ? undefined : Number(row.gps_accuracy),
    deviceMake: row.device_make ?? "",
    deviceModel: row.device_model ?? "",
    notes: row.notes ?? "",
    source: row.source,
    status: row.status,
  };
}

function toNorthHillsEvidence(row) {
  return {
    id: row.id,
    entryId: row.entry_id,
    targetType: row.target_type,
    status: row.status,
    confidence: row.confidence,
    sourcePageNumber: row.source_page_number,
    nameText: row.name_text ?? "",
    parsedSectionName: row.parsed_section_name ?? "",
    parsedRowNumber: row.parsed_row_number,
    parsedPositionNumber: row.parsed_position_number,
    rawText: row.raw_text ?? "",
    reviewNotes: row.review_notes ?? "",
    reviewedByEmail: row.reviewed_by_email ?? "",
    reviewedAt: row.reviewed_at,
  };
}

function toHeadstoneSummary(row) {
  return {
    id: row.id,
    headstoneId: row.headstone_id,
    cemeteryId: row.cemetery_id,
    cemeteryName: row.cemetery_name,
    gravesiteId: row.gravesite_id,
    graveKey: `${row.cemetery_id}:${row.gravesite_id}`,
    label: row.headstone_id,
    markerType: row.marker_type_label ?? "Unknown",
    condition: row.condition_code ?? "unknown",
    geometry: parseGeometry(row.geometry),
  };
}

function toGraveSummary(grave) {
  return {
    id: grave.gravesite_id,
    cemeteryId: grave.cemetery_id,
    cemeteryName: grave.cemetery_name,
    section: grave.section_id ?? "",
    lot: grave.lot_id ?? "",
    space: grave.grave_id,
    status: normalizeStatus(grave.status),
    geometry: parseGeometry(grave.geometry),
  };
}

function ownershipRedactedGrave(grave) {
  return {
    ...grave,
    owners: [],
    currentOwnerIds: [],
    ownershipHistory: [],
  };
}

async function selectTriggeredAuditEventId(client, { action, targetTable, targetRecordId }) {
  const result = await client.query(
    `
      SELECT id::text
      FROM audit_events
      WHERE transaction_id = txid_current()
        AND action = $1
        AND target_table = $2
        AND target_record_id = $3
      ORDER BY occurred_at DESC, created_at DESC
      LIMIT 1
    `,
    [action, targetTable, targetRecordId],
  );

  return result.rows[0]?.id;
}

async function insertCompatibilityAuditEvent(client, { actorUser, action, targetTable, targetRecordId, previousValues, newValues, reason }) {
  const result = await client.query(
    `
      INSERT INTO audit_events (
        actor_user_id,
        actor_app_user_id,
        actor_external_subject,
        actor_email,
        actor_role,
        actor_database_user,
        actor_session_user,
        source,
        transaction_id,
        action,
        target_table,
        target_record_id,
        previous_values,
        new_values,
        changed_fields,
        reason,
        occurred_at
      )
      VALUES ($1::uuid, $1::uuid, $2, $3, $4, current_user, session_user, 'api', txid_current(), $5, $6, $7, $8::jsonb, $9::jsonb, '{}'::text[], $10, now())
      RETURNING id::text
    `,
    [
      actorUser?.id ?? null,
      actorUser?.subject ?? null,
      actorUser?.email ?? null,
      actorUser?.role ?? null,
      action,
      targetTable,
      targetRecordId,
      JSON.stringify(previousValues ?? null),
      JSON.stringify(newValues ?? null),
      reason,
    ],
  );

  return result.rows[0].id;
}

async function auditEventIdForMutation(client, event) {
  return (await selectTriggeredAuditEventId(client, event)) ?? (await insertCompatibilityAuditEvent(client, event));
}

async function selectGraveMutationState(client, cemeteryId, gravesiteId) {
  const result = await client.query(
    `
      SELECT
        id::text AS uuid,
        cemetery_id::text,
        gravesite_id,
        deleted_at,
        deleted_by::text,
        delete_reason,
        updated_at
      FROM gravesites
      WHERE cemetery_id = $1
        AND gravesite_id = $2
      FOR UPDATE
    `,
    [cemeteryId, gravesiteId],
  );

  return result.rows[0];
}

function groupBy(rows, key) {
  return rows.reduce((groups, row) => {
    const value = row[key];
    if (!value) return groups;
    const existing = groups.get(value) ?? [];
    existing.push(row);
    groups.set(value, existing);
    return groups;
  }, new Map());
}

async function selectActiveCemeteries(client) {
  const result = await client.query(`
    SELECT id::text, name, ST_AsGeoJSON(geometry)::json AS geometry
    FROM cemeteries
    WHERE deleted_at IS NULL
    ORDER BY name, id
  `);

  return result.rows;
}

async function sectionAlternateNamesSelect(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'sections'
        AND column_name = 'alternate_names'
    ) AS exists
  `);

  return result.rows[0]?.exists ? "alternate_names" : "'{}'::text[] AS alternate_names";
}

async function selectSectionsForCemeteries(client, cemeteryIds) {
  const alternateNamesSelect = await sectionAlternateNamesSelect(client);
  const result = await client.query(
    `
      SELECT section_id::text AS uuid, name AS section_id, name, ${alternateNamesSelect}, ST_AsGeoJSON(geometry)::json AS geometry
      FROM sections
      WHERE cemetery_id = ANY($1::uuid[])
        AND deleted_at IS NULL
        AND geometry IS NOT NULL
      ORDER BY name, section_id
    `,
    [cemeteryIds],
  );

  return result.rows;
}

async function selectLotsForCemeteries(client, cemeteryIds) {
  const result = await client.query(
    `
      SELECT
        lots.id::text,
        lot_id,
        section_id,
        block_id,
        COALESCE(name, lot_id) AS name,
        ST_AsGeoJSON(geometry)::json AS geometry
      FROM lots
      WHERE cemetery_id = ANY($1::uuid[])
        AND deleted_at IS NULL
      ORDER BY section_id, block_id, lot_id, name
    `,
    [cemeteryIds],
  );

  return result.rows;
}

async function selectGravesForCemeteries(client, cemeteryIds, { includeCost = false } = {}) {
  const result = await client.query(
    `
      SELECT
        ${includeCost ? "gravesites.id::text AS uuid," : ""}
        gravesites.cemetery_id::text,
        cemeteries.name AS cemetery_name,
        gravesites.section_id,
        gravesites.lot_id,
        gravesites.grave_id,
        gravesites.gravesite_id,
        gravesites.name,
        gravesites.status,
        ${includeCost ? "gravesites.cost," : ""}
        ST_AsGeoJSON(gravesites.geometry)::json AS geometry
      FROM gravesites
      JOIN cemeteries
        ON cemeteries.id = gravesites.cemetery_id
      WHERE gravesites.cemetery_id = ANY($1::uuid[])
        AND gravesites.deleted_at IS NULL
      ORDER BY cemeteries.name, gravesites.section_id, gravesites.lot_id, gravesites.grave_id, gravesites.gravesite_id
    `,
    [cemeteryIds],
  );

  return result.rows;
}

async function selectHeadstoneSummariesForCemeteries(client, cemeteryIds) {
  const result = await client.query(
    `
      SELECT
        headstones.id::text,
        headstones.headstone_id,
        gravesites.cemetery_id::text,
        cemeteries.name AS cemetery_name,
        gravesites.gravesite_id,
        marker_types.label AS marker_type_label,
        headstone_condition_types.code AS condition_code,
        ST_AsGeoJSON(headstones.geometry)::json AS geometry
      FROM headstones
      JOIN gravesites
        ON gravesites.id = headstones.gravesite_uuid
      JOIN cemeteries
        ON cemeteries.id = gravesites.cemetery_id
      JOIN marker_types
        ON marker_types.id = headstones.marker_type_id
      JOIN headstone_condition_types
        ON headstone_condition_types.id = headstones.condition_type_id
      WHERE gravesites.cemetery_id = ANY($1::uuid[])
        AND headstones.deleted_at IS NULL
        AND gravesites.deleted_at IS NULL
        AND cemeteries.deleted_at IS NULL
        AND headstones.geometry IS NOT NULL
      ORDER BY cemeteries.name, gravesites.gravesite_id, headstones.headstone_id
    `,
    [cemeteryIds],
  );

  return result.rows;
}

async function selectGraveByCemeteryAndId(client, cemeteryId, gravesiteId) {
  const result = await client.query(
    `
      SELECT
        gravesites.id::text AS uuid,
        gravesites.cemetery_id::text,
        cemeteries.name AS cemetery_name,
        gravesites.section_id,
        gravesites.lot_id,
        gravesites.grave_id,
        gravesites.gravesite_id,
        gravesites.status,
        gravesites.cost,
        ST_AsGeoJSON(gravesites.geometry)::json AS geometry
      FROM gravesites
      JOIN cemeteries
        ON cemeteries.id = gravesites.cemetery_id
      WHERE gravesites.cemetery_id = $1
        AND gravesites.gravesite_id = $2
        AND gravesites.deleted_at IS NULL
        AND cemeteries.deleted_at IS NULL
      LIMIT 1
    `,
    [cemeteryId, gravesiteId],
  );

  return result.rows[0];
}

async function selectGraveUpdateState(client, cemeteryId, gravesiteId) {
  const result = await client.query(
    `
      SELECT
        gravesites.id::text AS uuid,
        gravesites.cemetery_id::text,
        gravesites.name,
        gravesites.gravesite_id,
        gravesites.status,
        gravesites.cost,
        gravesites.updated_at
      FROM gravesites
      WHERE gravesites.cemetery_id = $1
        AND gravesites.gravesite_id = $2
        AND gravesites.deleted_at IS NULL
      FOR UPDATE
    `,
    [cemeteryId, gravesiteId],
  );

  return result.rows[0];
}

async function selectBurialMutationState(client, id) {
  const result = await client.query(
    `
      SELECT
        burials.id::text,
        gravesites.cemetery_id::text,
        burials.gravesite_uuid::text,
        burials.first_name,
        burials.last_name,
        burials.full_name,
        burials.birth_date,
        burials.death_date,
        burials.burial_date,
        burials.interment_type,
        burials.funeral_home,
        burials.notes,
        burials.updated_at
      FROM burials
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
  const result = await client.query(
    `
      SELECT id::text, gravesite_uuid::text, first_name, last_name, full_name, birth_date, death_date, burial_date, interment_type, funeral_home, notes
      FROM burials
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0];
}

async function selectOwnersForCemeteries(client, cemeteryIds) {
  const result = await client.query(
    `
      SELECT
        owners.id::text AS id,
        owners.gravesite_uuid::text,
        owners.owner,
        owners.co_owner,
        NULL::text AS display_name,
        owners.full_address,
        owners.phone,
        owners.email,
        owners.sale_date,
        NULL::date AS effective_date,
        owners.created_at AS recorded_at,
        'purchase'::text AS event_type,
        'Cemetery database'::text AS recorded_by,
        NULL::text AS document_reference,
        owners.notes,
        owners.created_at,
        NULL::text AS ownership_event_id
      FROM owners
      WHERE owners.deleted_at IS NULL
        AND owners.gravesite_uuid IN (SELECT id FROM gravesites WHERE cemetery_id = ANY($1::uuid[]) AND deleted_at IS NULL)

      UNION ALL

      SELECT
        concat('ownership-party-', current_ownership_right_owners.ownership_party_uuid::text) AS id,
        current_ownership_right_owners.gravesite_uuid::text,
        NULL::text AS owner,
        NULL::text AS co_owner,
        current_ownership_right_owners.display_name,
        NULL::text AS full_address,
        NULL::text AS phone,
        NULL::text AS email,
        NULL::date AS sale_date,
        current_ownership_right_owners.effective_date,
        current_ownership_right_owners.recorded_at,
        current_ownership_right_owners.event_type,
        ownership_events.recorded_by,
        ownership_events.document_reference,
        concat_ws(' ', current_ownership_right_owners.right_type, current_ownership_right_owners.target_type, ownership_events.notes) AS notes,
        current_ownership_right_owners.recorded_at AS created_at,
        concat('ownership-event-', current_ownership_right_owners.ownership_event_uuid::text) AS ownership_event_id
      FROM current_ownership_right_owners
      JOIN ownership_events
        ON ownership_events.id = current_ownership_right_owners.ownership_event_uuid
      WHERE current_ownership_right_owners.target_type = 'gravesite'
        AND current_ownership_right_owners.gravesite_uuid IN (SELECT id FROM gravesites WHERE cemetery_id = ANY($1::uuid[]) AND deleted_at IS NULL)
      ORDER BY sale_date DESC NULLS LAST, effective_date DESC NULLS LAST, created_at DESC, id
    `,
    [cemeteryIds],
  );

  return result.rows;
}

async function selectBurialsForCemeteries(client, cemeteryIds) {
  const result = await client.query(
    `
      SELECT id::text, gravesite_uuid::text, first_name, last_name, full_name, birth_date, death_date, burial_date, interment_type, funeral_home, notes
      FROM burials
      WHERE deleted_at IS NULL
        AND gravesite_uuid IN (SELECT id FROM gravesites WHERE cemetery_id = ANY($1::uuid[]) AND deleted_at IS NULL)
      ORDER BY burial_date DESC NULLS LAST, death_date DESC NULLS LAST, last_name, first_name
    `,
    [cemeteryIds],
  );

  return result.rows;
}

async function selectOwnersForGrave(client, graveUuid) {
  const result = await client.query(
    `
      SELECT
        owners.id::text AS id,
        owners.gravesite_uuid::text,
        owners.owner,
        owners.co_owner,
        NULL::text AS display_name,
        owners.full_address,
        owners.phone,
        owners.email,
        owners.sale_date,
        NULL::date AS effective_date,
        owners.created_at AS recorded_at,
        'purchase'::text AS event_type,
        'Cemetery database'::text AS recorded_by,
        NULL::text AS document_reference,
        owners.notes,
        owners.created_at,
        NULL::text AS ownership_event_id
      FROM owners
      WHERE owners.gravesite_uuid = $1
        AND owners.deleted_at IS NULL

      UNION ALL

      SELECT
        concat('ownership-party-', current_ownership_right_owners.ownership_party_uuid::text) AS id,
        current_ownership_right_owners.gravesite_uuid::text,
        NULL::text AS owner,
        NULL::text AS co_owner,
        current_ownership_right_owners.display_name,
        NULL::text AS full_address,
        NULL::text AS phone,
        NULL::text AS email,
        NULL::date AS sale_date,
        current_ownership_right_owners.effective_date,
        current_ownership_right_owners.recorded_at,
        current_ownership_right_owners.event_type,
        ownership_events.recorded_by,
        ownership_events.document_reference,
        concat_ws(' ', current_ownership_right_owners.right_type, current_ownership_right_owners.target_type, ownership_events.notes) AS notes,
        current_ownership_right_owners.recorded_at AS created_at,
        concat('ownership-event-', current_ownership_right_owners.ownership_event_uuid::text) AS ownership_event_id
      FROM current_ownership_right_owners
      JOIN ownership_events
        ON ownership_events.id = current_ownership_right_owners.ownership_event_uuid
      WHERE current_ownership_right_owners.target_type = 'gravesite'
        AND current_ownership_right_owners.gravesite_uuid = $1
      ORDER BY sale_date DESC NULLS LAST, effective_date DESC NULLS LAST, created_at DESC, id
    `,
    [graveUuid],
  );

  return result.rows;
}

async function selectBurialsForGrave(client, graveUuid) {
  const result = await client.query(
    `
      SELECT id::text, gravesite_uuid::text, first_name, last_name, full_name, birth_date, death_date, burial_date, interment_type, funeral_home, notes
      FROM burials
      WHERE gravesite_uuid = $1
        AND deleted_at IS NULL
      ORDER BY burial_date DESC NULLS LAST, death_date DESC NULLS LAST, last_name, first_name
    `,
    [graveUuid],
  );

  return result.rows;
}

async function selectHeadstonesForGrave(client, graveUuid) {
  const result = await client.query(
    `
      SELECT
        headstones.id::text,
        headstones.headstone_id,
        marker_types.id::text AS marker_type_id,
        marker_types.code AS marker_type_code,
        marker_types.label AS marker_type_label,
        marker_material_types.id::text AS material_id,
        marker_material_types.code AS material_code,
        marker_material_types.label AS material_label,
        headstone_condition_types.id::text AS condition_id,
        headstone_condition_types.code AS condition_code,
        headstone_condition_types.label AS condition_label,
        headstones.condition_notes,
        headstones.inscription,
        headstones.photo_url,
        headstones.last_inspected_at,
        COALESCE(headstone_gravesites.relationship_type, 'primary') AS relationship_type,
        headstone_gravesites.notes AS relationship_notes,
        array_remove(array_agg(DISTINCT headstone_burials.burial_uuid::text), NULL) AS burial_ids,
        COALESCE(headstone_evidence.evidence, '[]'::jsonb) AS north_hills_evidence,
        COALESCE(headstone_media.media_assets, '[]'::jsonb) AS media_assets
      FROM headstones
      LEFT JOIN headstone_gravesites
        ON headstone_gravesites.headstone_uuid = headstones.id
       AND headstone_gravesites.deleted_at IS NULL
      LEFT JOIN headstone_burials
        ON headstone_burials.headstone_uuid = headstones.id
       AND headstone_burials.deleted_at IS NULL
      JOIN marker_types
        ON marker_types.id = headstones.marker_type_id
      JOIN marker_material_types
        ON marker_material_types.id = headstones.material_type_id
      JOIN headstone_condition_types
        ON headstone_condition_types.id = headstones.condition_type_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', headstone_link.id::text,
            'entryId', entry.id::text,
            'targetType', 'headstone',
            'status', headstone_link.status,
            'confidence', headstone_link.confidence,
            'sourcePageNumber', entry.source_page_number,
            'nameText', entry.name_text,
            'parsedSectionName', entry.parsed_section_name,
            'parsedRowNumber', entry.parsed_row_number,
            'parsedPositionNumber', entry.parsed_position_number,
            'rawText', entry.raw_text,
            'reviewNotes', headstone_link.notes,
            'reviewedByEmail', headstone_link.reviewed_by_email,
            'reviewedAt', headstone_link.reviewed_at
          )
          ORDER BY entry.source_page_number NULLS LAST, entry.source_line_start, entry.id
        ) AS evidence
        FROM north_hills_ocr_entry_headstone_links headstone_link
        JOIN north_hills_ocr_entries entry
          ON entry.id = headstone_link.entry_id
        WHERE headstone_link.headstone_uuid = headstones.id
          AND headstone_link.status = 'linked'
      ) headstone_evidence ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', media_assets.id::text,
            'cemeteryId', media_assets.cemetery_id::text,
            'assetType', media_assets.asset_type,
            'fileUrl', media_assets.file_url,
            'thumbnailUrl', COALESCE(media_assets.thumbnail_url, ''),
            'originalFilename', COALESCE(media_assets.original_filename, ''),
            'contentType', COALESCE(media_assets.content_type, ''),
            'byteSize', COALESCE(media_assets.byte_size, 0),
            'capturedAt', media_assets.captured_at,
            'uploadedAt', media_assets.uploaded_at,
            'capturedByEmail', COALESCE(media_assets.captured_by_email, ''),
            'latitude', media_assets.latitude,
            'longitude', media_assets.longitude,
            'gpsAccuracy', media_assets.gps_accuracy,
            'deviceMake', COALESCE(media_assets.device_make, ''),
            'deviceModel', COALESCE(media_assets.device_model, ''),
            'notes', COALESCE(media_assets.notes, ''),
            'source', media_assets.source,
            'status', media_assets.status
          )
          ORDER BY media_assets.captured_at DESC NULLS LAST, media_assets.uploaded_at DESC, media_assets.id
        ) AS media_assets
        FROM headstone_media_assets
        JOIN media_assets
          ON media_assets.id = headstone_media_assets.media_asset_id
        WHERE headstone_media_assets.headstone_uuid = headstones.id
          AND headstone_media_assets.deleted_at IS NULL
          AND headstone_media_assets.status = 'linked'
          AND media_assets.deleted_at IS NULL
          AND media_assets.status = 'linked'
      ) headstone_media ON true
      WHERE headstones.deleted_at IS NULL
        AND (
          headstones.gravesite_uuid = $1
          OR headstone_gravesites.gravesite_uuid = $1
        )
      GROUP BY
        headstones.id,
        marker_types.id,
        marker_types.code,
        marker_types.label,
        marker_material_types.id,
        marker_material_types.code,
        marker_material_types.label,
        headstone_condition_types.id,
        headstone_condition_types.code,
        headstone_condition_types.label,
        headstone_gravesites.relationship_type,
        headstone_gravesites.notes,
        headstone_evidence.evidence,
        headstone_media.media_assets
      ORDER BY headstones.headstone_id, headstones.id
    `,
    [graveUuid],
  );

  return result.rows;
}

async function selectHeadstoneById(client, id) {
  const result = await client.query(
    `
      SELECT
        headstones.id::text,
        headstones.headstone_id,
        marker_types.id::text AS marker_type_id,
        marker_types.code AS marker_type_code,
        marker_types.label AS marker_type_label,
        marker_material_types.id::text AS material_id,
        marker_material_types.code AS material_code,
        marker_material_types.label AS material_label,
        headstone_condition_types.id::text AS condition_id,
        headstone_condition_types.code AS condition_code,
        headstone_condition_types.label AS condition_label,
        headstones.condition_notes,
        headstones.inscription,
        headstones.photo_url,
        headstones.last_inspected_at,
        'primary' AS relationship_type,
        NULL AS relationship_notes,
        array_remove(array_agg(DISTINCT headstone_burials.burial_uuid::text), NULL) AS burial_ids,
        COALESCE(headstone_evidence.evidence, '[]'::jsonb) AS north_hills_evidence,
        COALESCE(headstone_media.media_assets, '[]'::jsonb) AS media_assets
      FROM headstones
      LEFT JOIN headstone_burials
        ON headstone_burials.headstone_uuid = headstones.id
       AND headstone_burials.deleted_at IS NULL
      JOIN marker_types
        ON marker_types.id = headstones.marker_type_id
      JOIN marker_material_types
        ON marker_material_types.id = headstones.material_type_id
      JOIN headstone_condition_types
        ON headstone_condition_types.id = headstones.condition_type_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', headstone_link.id::text,
            'entryId', entry.id::text,
            'targetType', 'headstone',
            'status', headstone_link.status,
            'confidence', headstone_link.confidence,
            'sourcePageNumber', entry.source_page_number,
            'nameText', entry.name_text,
            'parsedSectionName', entry.parsed_section_name,
            'parsedRowNumber', entry.parsed_row_number,
            'parsedPositionNumber', entry.parsed_position_number,
            'rawText', entry.raw_text,
            'reviewNotes', headstone_link.notes,
            'reviewedByEmail', headstone_link.reviewed_by_email,
            'reviewedAt', headstone_link.reviewed_at
          )
          ORDER BY entry.source_page_number NULLS LAST, entry.source_line_start, entry.id
        ) AS evidence
        FROM north_hills_ocr_entry_headstone_links headstone_link
        JOIN north_hills_ocr_entries entry
          ON entry.id = headstone_link.entry_id
        WHERE headstone_link.headstone_uuid = headstones.id
          AND headstone_link.status = 'linked'
      ) headstone_evidence ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', media_assets.id::text,
            'cemeteryId', media_assets.cemetery_id::text,
            'assetType', media_assets.asset_type,
            'fileUrl', media_assets.file_url,
            'thumbnailUrl', COALESCE(media_assets.thumbnail_url, ''),
            'originalFilename', COALESCE(media_assets.original_filename, ''),
            'contentType', COALESCE(media_assets.content_type, ''),
            'byteSize', COALESCE(media_assets.byte_size, 0),
            'capturedAt', media_assets.captured_at,
            'uploadedAt', media_assets.uploaded_at,
            'capturedByEmail', COALESCE(media_assets.captured_by_email, ''),
            'latitude', media_assets.latitude,
            'longitude', media_assets.longitude,
            'gpsAccuracy', media_assets.gps_accuracy,
            'deviceMake', COALESCE(media_assets.device_make, ''),
            'deviceModel', COALESCE(media_assets.device_model, ''),
            'notes', COALESCE(media_assets.notes, ''),
            'source', media_assets.source,
            'status', media_assets.status
          )
          ORDER BY media_assets.captured_at DESC NULLS LAST, media_assets.uploaded_at DESC, media_assets.id
        ) AS media_assets
        FROM headstone_media_assets
        JOIN media_assets
          ON media_assets.id = headstone_media_assets.media_asset_id
        WHERE headstone_media_assets.headstone_uuid = headstones.id
          AND headstone_media_assets.deleted_at IS NULL
          AND headstone_media_assets.status = 'linked'
          AND media_assets.deleted_at IS NULL
          AND media_assets.status = 'linked'
      ) headstone_media ON true
      WHERE headstones.id = $1
        AND headstones.deleted_at IS NULL
      GROUP BY
        headstones.id,
        marker_types.id,
        marker_types.code,
        marker_types.label,
        marker_material_types.id,
        marker_material_types.code,
        marker_material_types.label,
        headstone_condition_types.id,
        headstone_condition_types.code,
        headstone_condition_types.label,
        headstone_evidence.evidence,
        headstone_media.media_assets
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0];
}

async function selectNorthHillsEvidenceForGrave(client, graveUuid) {
  const result = await client.query(
    `
      SELECT
        gravesite_link.id::text,
        entry.id::text AS entry_id,
        'gravesite' AS target_type,
        gravesite_link.status,
        gravesite_link.confidence,
        entry.source_page_number,
        entry.name_text,
        entry.parsed_section_name,
        entry.parsed_row_number,
        entry.parsed_position_number,
        entry.raw_text,
        gravesite_link.notes AS review_notes,
        gravesite_link.reviewed_by_email,
        gravesite_link.reviewed_at
      FROM north_hills_ocr_entry_gravesite_links gravesite_link
      JOIN north_hills_ocr_entries entry
        ON entry.id = gravesite_link.entry_id
      WHERE gravesite_link.gravesite_uuid = $1
        AND gravesite_link.status = 'linked'
      ORDER BY entry.source_page_number NULLS LAST, entry.source_line_start, entry.id
    `,
    [graveUuid],
  );

  return result.rows;
}

async function selectMediaAssetsForGrave(client, graveUuid) {
  const result = await client.query(
    `
      SELECT
        media_assets.id::text,
        media_assets.cemetery_id::text,
        media_assets.asset_type,
        media_assets.file_url,
        media_assets.thumbnail_url,
        media_assets.original_filename,
        media_assets.content_type,
        media_assets.byte_size,
        media_assets.captured_at,
        media_assets.uploaded_at,
        media_assets.captured_by_email,
        media_assets.latitude,
        media_assets.longitude,
        media_assets.gps_accuracy,
        media_assets.device_make,
        media_assets.device_model,
        media_assets.notes,
        media_assets.source,
        media_assets.status
      FROM gravesite_media_assets
      JOIN media_assets
        ON media_assets.id = gravesite_media_assets.media_asset_id
      WHERE gravesite_media_assets.gravesite_uuid = $1
        AND gravesite_media_assets.deleted_at IS NULL
        AND gravesite_media_assets.status = 'linked'
        AND media_assets.deleted_at IS NULL
        AND media_assets.status = 'linked'
      ORDER BY media_assets.captured_at DESC NULLS LAST, media_assets.uploaded_at DESC, media_assets.id
    `,
    [graveUuid],
  );

  return result.rows;
}

async function selectHeadstoneMutationState(client, id) {
  const result = await client.query(
    `
      SELECT
        headstones.id::text,
        gravesite.cemetery_id::text AS cemetery_id,
        headstones.headstone_id,
        headstones.marker_type_id::text,
        headstones.marker_type_code,
        headstones.material_type_id::text,
        headstones.material_type_code,
        headstones.condition_type_id::text,
        headstones.condition,
        headstones.condition_notes,
        headstones.inscription,
        headstones.photo_url,
        headstones.last_inspected_at,
        headstones.updated_at
      FROM headstones
      LEFT JOIN gravesites AS gravesite
        ON gravesite.id = headstones.gravesite_uuid
      WHERE headstones.id = $1
        AND headstones.deleted_at IS NULL
      FOR UPDATE OF headstones
    `,
    [id],
  );

  return result.rows[0];
}

export async function listHeadstoneLookupOptions(pool) {
  const client = await pool.connect();
  try {
    const markerTypes = await client.query("SELECT id::text, code, label FROM marker_types WHERE is_active ORDER BY sort_order, label");
    const materials = await client.query("SELECT id::text, code, label FROM marker_material_types WHERE is_active ORDER BY sort_order, label");
    const conditions = await client.query("SELECT id::text, code, label FROM headstone_condition_types WHERE is_active ORDER BY sort_order, label");

    return {
      markerTypes: markerTypes.rows,
      materials: materials.rows,
      conditions: conditions.rows,
    };
  } finally {
    client.release();
  }
}

function toBoundaryFeature(cemetery) {
  return {
    type: "Feature",
    properties: { name: cemetery.name },
    geometry: parseGeometry(cemetery.geometry),
  };
}

function toSection(section) {
  return {
    id: section.section_id,
    name: section.name,
    alternateNames: section.alternate_names ?? [],
    geometry: parseGeometry(section.geometry),
  };
}

function toLot(lot) {
  return {
    id: lot.lot_id,
    name: lot.name,
    section: lot.section_id ?? "",
    block: lot.block_id ?? undefined,
    geometry: parseGeometry(lot.geometry),
  };
}

function toDetailedGrave(grave, graveOwners, graveBurials, graveHeadstones, northHillsEvidence, mediaAssets, includeOwnership) {
  const detailedGrave = {
    ...toGraveSummary(grave),
    name: grave.name ?? "",
    cost: grave.cost === null || grave.cost === undefined ? undefined : Number(grave.cost),
    owners: graveOwners.map(toOwner),
    currentOwnerIds: graveOwners.map((owner) => owner.id),
    burials: graveBurials.map(toBurial),
    headstones: graveHeadstones.map(toHeadstone),
    northHillsEvidence: northHillsEvidence.map(toNorthHillsEvidence),
    mediaAssets: mediaAssets.map(toMediaAsset),
    ownershipHistory: graveOwners.map(toOwnershipEvent),
    notes: grave.cost ? `Recorded cost: $${grave.cost}` : undefined,
  };

  return includeOwnership ? detailedGrave : ownershipRedactedGrave(detailedGrave);
}

export async function getCemeteryData(pool) {
  const client = await pool.connect();
  try {
    const cemeteries = await selectActiveCemeteries(client);
    const cemeteryIds = cemeteries.map((cemetery) => cemetery.id);
    if (cemeteryIds.length === 0) return { sections: [], lots: [], graves: [] };

    const sections = await selectSectionsForCemeteries(client, cemeteryIds);
    const lots = await selectLotsForCemeteries(client, cemeteryIds);
    const graves = await selectGravesForCemeteries(client, cemeteryIds);
    const headstones = await selectHeadstoneSummariesForCemeteries(client, cemeteryIds);

    return {
      boundaries: cemeteries.map(toBoundaryFeature),
      boundary: {
        type: "Feature",
        properties: { name: cemeteries[0].name },
        geometry: parseGeometry(cemeteries[0].geometry),
      },
      sections: sections.map(toSection),
      lots: lots.map(toLot),
      graves: graves.map(toGraveSummary),
      headstones: headstones.map(toHeadstoneSummary),
    };
  } finally {
    client.release();
  }
}

export async function getDetailedCemeteryData(pool, { includeOwnership = true } = {}) {
  const client = await pool.connect();
  try {
    const cemeteries = await selectActiveCemeteries(client);
    const cemeteryIds = cemeteries.map((cemetery) => cemetery.id);
    if (cemeteryIds.length === 0) return { sections: [], lots: [], graves: [], owners: [] };

    const sections = await selectSectionsForCemeteries(client, cemeteryIds);
    const lots = await selectLotsForCemeteries(client, cemeteryIds);
    const graves = await selectGravesForCemeteries(client, cemeteryIds, { includeCost: true });
    const owners = includeOwnership ? await selectOwnersForCemeteries(client, cemeteryIds) : [];
    const burials = await selectBurialsForCemeteries(client, cemeteryIds);

    const ownersByGrave = groupBy(owners, "gravesite_uuid");
    const burialsByGrave = groupBy(burials, "gravesite_uuid");

    return {
      boundaries: cemeteries.map(toBoundaryFeature),
      boundary: {
        type: "Feature",
        properties: { name: cemeteries[0].name },
        geometry: parseGeometry(cemeteries[0].geometry),
      },
      sections: sections.map(toSection),
      lots: lots.map(toLot),
      graves: graves.map((grave) => toDetailedGrave(grave, ownersByGrave.get(grave.uuid) ?? [], burialsByGrave.get(grave.uuid) ?? [], [], [], [], includeOwnership)),
      owners: owners.map(toOwner),
    };
  } finally {
    client.release();
  }
}

export async function getGraveSpace(pool, cemeteryId, gravesiteId, { includeOwnership = true } = {}) {
  const client = await pool.connect();
  try {
    const grave = await selectGraveByCemeteryAndId(client, cemeteryId, gravesiteId);
    if (!grave) return undefined;

    const owners = includeOwnership ? await selectOwnersForGrave(client, grave.uuid) : [];
    const burials = await selectBurialsForGrave(client, grave.uuid);
    const headstones = await selectHeadstonesForGrave(client, grave.uuid);
    const northHillsEvidence = await selectNorthHillsEvidenceForGrave(client, grave.uuid);
    const mediaAssets = await selectMediaAssetsForGrave(client, grave.uuid);

    return toDetailedGrave(grave, owners, burials, headstones, northHillsEvidence, mediaAssets, includeOwnership);
  } finally {
    client.release();
  }
}

export async function updateGraveSpace(pool, cemeteryId, gravesiteId, graveSpace, { actorUser, reason, allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });
    const existing = await selectGraveUpdateState(client, cemeteryId, gravesiteId);
    if (!existing) {
      await client.query("ROLLBACK");
      return undefined;
    }
    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(existing.cemetery_id)) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const updateResult = await client.query(
      `
        UPDATE gravesites
        SET name = $2,
            status = $3,
            cost = $4::numeric
        WHERE id = $1
        RETURNING
          id::text AS uuid,
          cemetery_id::text,
          name,
          gravesite_id,
          status,
          cost,
          updated_at
      `,
      [existing.uuid, graveSpace.name || null, graveSpace.status, graveSpace.cost ?? null],
    );
    const updatedState = updateResult.rows[0];
    const auditEventId = await auditEventIdForMutation(client, {
      actorUser,
      action: "update",
      targetTable: "gravesites",
      targetRecordId: existing.uuid,
      previousValues: existing,
      newValues: updatedState,
      reason,
    });

    const grave = await selectGraveByCemeteryAndId(client, cemeteryId, gravesiteId);
    const owners = await selectOwnersForGrave(client, grave.uuid);
    const burials = await selectBurialsForGrave(client, grave.uuid);
    const headstones = await selectHeadstonesForGrave(client, grave.uuid);
    const northHillsEvidence = await selectNorthHillsEvidenceForGrave(client, grave.uuid);
    const mediaAssets = await selectMediaAssetsForGrave(client, grave.uuid);

    await client.query("COMMIT");
    return { ...toDetailedGrave(grave, owners, burials, headstones, northHillsEvidence, mediaAssets, true), auditEventId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
    const updateResult = await client.query(
      `
        UPDATE burials
        SET first_name = $2,
            last_name = $3,
            full_name = $4,
            birth_date = $5::date,
            death_date = $6::date,
            burial_date = $7::date,
            interment_type = $8,
            funeral_home = $9,
            notes = $10
        WHERE id = $1
        RETURNING
          id::text,
          gravesite_uuid::text,
          first_name,
          last_name,
          full_name,
          birth_date,
          death_date,
          burial_date,
          interment_type,
          funeral_home,
          notes,
          updated_at
      `,
      [
        id,
        burial.firstName || null,
        burial.lastName || null,
        fullName,
        burial.birthDate || null,
        burial.deathDate || null,
        burial.burialDate || null,
        burial.intermentType || "casket",
        burial.funeralHome || null,
        burial.notes || null,
      ],
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

    const updateResult = await client.query(
      `
        UPDATE headstones
        SET marker_type_id = $2::uuid,
            material_type_id = $3::uuid,
            condition_type_id = $4::uuid,
            condition_notes = $5,
            inscription = $6,
            photo_url = $7,
            last_inspected_at = $8::date
        WHERE id = $1
        RETURNING
          id::text,
          headstone_id,
          marker_type_id::text,
          marker_type_code,
          material_type_id::text,
          material_type_code,
          condition_type_id::text,
          condition,
          condition_notes,
          inscription,
          photo_url,
          last_inspected_at,
          updated_at
      `,
      [
        id,
        headstone.markerTypeId,
        headstone.materialId,
        headstone.conditionId,
        headstone.conditionNotes || null,
        headstone.inscription || null,
        headstone.photoUrl || null,
        headstone.lastInspectedAt || null,
      ],
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

export async function softDeleteGraveSpace(pool, cemeteryId, gravesiteId, { actorUser, reason } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });
    const existing = await selectGraveMutationState(client, cemeteryId, gravesiteId);
    if (!existing) {
      await client.query("ROLLBACK");
      return undefined;
    }

    if (existing.deleted_at) {
      await client.query("COMMIT");
      return {
        graveSpaceId: existing.gravesite_id,
        cemeteryId: existing.cemetery_id,
        deletedAt: existing.deleted_at,
        alreadyDeleted: true,
      };
    }

    const updateResult = await client.query(
      `
        UPDATE gravesites
        SET deleted_at = now(),
            deleted_by = $3::uuid,
            delete_reason = $2
        WHERE id = $1
        RETURNING id::text AS uuid, gravesite_id, deleted_at, deleted_by::text, delete_reason, updated_at
      `,
      [existing.uuid, reason, actorUser?.id ?? null],
    );
    const updated = updateResult.rows[0];
    const auditEventId = await auditEventIdForMutation(client, {
      actorUser,
      action: "soft_delete",
      targetTable: "gravesites",
      targetRecordId: existing.uuid,
      previousValues: existing,
      newValues: updated,
      reason,
    });

    await client.query("COMMIT");
    return {
      graveSpaceId: updated.gravesite_id,
      cemeteryId: existing.cemetery_id,
      deletedAt: updated.deleted_at,
      auditEventId,
      alreadyDeleted: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function restoreGraveSpace(pool, cemeteryId, gravesiteId, { actorUser, reason } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });
    const existing = await selectGraveMutationState(client, cemeteryId, gravesiteId);
    if (!existing) {
      await client.query("ROLLBACK");
      return undefined;
    }

    if (!existing.deleted_at) {
      await client.query("COMMIT");
      return {
        graveSpaceId: existing.gravesite_id,
        cemeteryId: existing.cemetery_id,
        restored: true,
        alreadyActive: true,
      };
    }

    const updateResult = await client.query(
      `
        UPDATE gravesites
        SET deleted_at = NULL,
            deleted_by = NULL,
            delete_reason = NULL
        WHERE id = $1
        RETURNING id::text AS uuid, gravesite_id, deleted_at, deleted_by::text, delete_reason, updated_at
      `,
      [existing.uuid],
    );
    const updated = updateResult.rows[0];
    const auditEventId = await auditEventIdForMutation(client, {
      actorUser,
      action: "restore",
      targetTable: "gravesites",
      targetRecordId: existing.uuid,
      previousValues: existing,
      newValues: updated,
      reason,
    });

    await client.query("COMMIT");
    return {
      graveSpaceId: updated.gravesite_id,
      cemeteryId: existing.cemetery_id,
      restored: true,
      auditEventId,
      alreadyActive: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
