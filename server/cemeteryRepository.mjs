import { setAuditContext } from "./auditContext.mjs";
import { derivedGravesiteStatusSql } from "./gravesiteStatusSql.mjs";

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

function recordedDate(value, fallbackDate) {
  return value || dateOnly(fallbackDate);
}

const recordedDateMonths = new Map([
  ["jan", "01"],
  ["january", "01"],
  ["feb", "02"],
  ["february", "02"],
  ["mar", "03"],
  ["march", "03"],
  ["apr", "04"],
  ["april", "04"],
  ["may", "05"],
  ["jun", "06"],
  ["june", "06"],
  ["jul", "07"],
  ["july", "07"],
  ["aug", "08"],
  ["august", "08"],
  ["sep", "09"],
  ["sept", "09"],
  ["september", "09"],
  ["oct", "10"],
  ["october", "10"],
  ["nov", "11"],
  ["november", "11"],
  ["dec", "12"],
  ["december", "12"],
]);

function splitRecordedDate(value) {
  const text = String(value ?? "").trim();
  if (!text) return { date: null, text: null };
  if (/^\d{4}-\d{2}-\d{2}$/u.test(text)) return { date: text, text };
  const monthDayYear = text.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/u);
  if (monthDayYear) {
    const month = recordedDateMonths.get(monthDayYear[1].toLowerCase());
    const day = Number(monthDayYear[2]);
    const year = Number(monthDayYear[3]);
    if (month && day >= 1 && day <= 31 && year >= 1000 && year <= 9999) {
      return { date: `${monthDayYear[3]}-${month}-${String(day).padStart(2, "0")}`, text };
    }
  }
  return { date: null, text };
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
  const veteranText = String(burial.veteran ?? "").trim().toLowerCase();
  const isVeteran = ["yes", "y", "true", "1"].includes(veteranText);

  return {
    id: burial.id,
    person: {
      id: `person-${burial.id}`,
      firstName: burial.first_name ?? "",
      lastName: burial.last_name ?? burial.full_name ?? "Unknown",
      maidenName: burial.maiden_name ?? "",
      birthDate: recordedDate(burial.birth_date_text, burial.birth_date),
      deathDate: recordedDate(burial.death_date_text, burial.death_date),
    },
    burialDate: dateOnly(burial.burial_date),
    recordStatusCode: burial.record_status_code ?? "interred",
    recordStatusLabel: burial.record_status_label ?? "Interred",
    intermentType: burial.interment_type ?? "casket",
    intermentTypeLabel: burial.interment_type_label ?? (burial.interment_type === "urn" ? "Funeral urn" : "Casket"),
    funeralHome: burial.funeral_home ?? "",
    veteran: isVeteran,
    militaryBranchCode: burial.military_branch_code ?? "",
    militaryBranch: burial.military_branch ?? "",
    militaryRankCode: burial.military_rank_code ?? "",
    militaryRank: burial.military_rank ?? "",
    militaryRankAbbreviation: burial.military_rank_abbreviation ?? "",
    militaryRankPayGrade: burial.military_rank_pay_grade ?? "",
    militaryWarServiceCode: burial.military_war_service_code ?? "",
    militaryWars: burial.military_wars ?? "",
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

const statusCodeSelect = derivedGravesiteStatusSql;

function ownershipRightNotes(right) {
  return compactJoin([right.right_type, right.target_type, right.notes]);
}

function toLookupValue(row, prefix) {
  return {
    id: row[`${prefix}_id`],
    code: row[`${prefix}_code`],
    label: row[`${prefix}_label`],
  };
}

function toGraveFeature(row) {
  return {
    id: row.id,
    cemeteryId: row.cemetery_id,
    gravesiteUuid: row.gravesite_uuid ?? "",
    headstoneUuid: row.headstone_uuid ?? "",
    featureType: toLookupValue(row, "feature_type"),
    featureSubtype: row.feature_subtype_id ? toLookupValue(row, "feature_subtype") : undefined,
    placement: row.placement_type_id ? toLookupValue(row, "placement") : undefined,
    material: row.material_type_id ? toLookupValue(row, "material") : undefined,
    symbolText: row.symbol_text ?? "",
    sourceType: row.source_type ?? "manual",
    sourceText: row.source_text ?? "",
    notes: row.notes ?? "",
    status: row.status ?? "active",
  };
}

function toMaintenanceRecord(row) {
  return {
    id: row.id,
    cemeteryId: row.cemetery_id,
    targetType: row.headstone_uuid ? "headstone" : "gravesite",
    gravesiteUuid: row.gravesite_uuid ?? "",
    headstoneUuid: row.headstone_uuid ?? "",
    issueType: row.issue_type_id ? toLookupValue(row, "issue_type") : undefined,
    actionType: row.action_type_id ? toLookupValue(row, "action_type") : undefined,
    priority: toLookupValue(row, "priority"),
    status: row.status ?? "open",
    observedAt: dateOnly(row.observed_at) ?? "",
    completedAt: dateOnly(row.completed_at),
    performedBy: row.performed_by ?? "",
    sourceType: row.source_type ?? "manual",
    notes: row.notes ?? "",
  };
}

function toHeadstone(row) {
  return {
    id: row.id,
    headstoneId: row.headstone_id,
    markerType: toLookupValue(row, "marker_type"),
    material: toLookupValue(row, "material"),
    condition: toLookupValue(row, "condition"),
    vaseType: row.vase_type_id ? toLookupValue(row, "vase_type") : undefined,
    vaseMaterial: row.vase_material_id ? toLookupValue(row, "vase_material") : undefined,
    vasePlacement: row.vase_placement_id ? toLookupValue(row, "vase_placement") : undefined,
    vaseNotes: row.vase_notes ?? "",
    conditionNotes: row.condition_notes ?? "",
    inscription: row.inscription ?? "",
    designNotes: row.design_notes ?? "",
    backDescription: row.back_description ?? "",
    photoUrl: row.photo_url ?? "",
    lastInspectedAt: dateOnly(row.last_inspected_at),
    relationshipType: row.relationship_type ?? "primary",
    relationshipNotes: row.relationship_notes ?? "",
    associatedGravesiteIds: row.associated_gravesite_ids ?? [],
    burialIds: row.burial_ids ?? [],
    northHillsEvidence: row.north_hills_evidence ?? [],
    features: (row.features ?? []).map(toGraveFeature),
    maintenanceRecords: (row.maintenance_records ?? []).map(toMaintenanceRecord),
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
  const gravesiteId = row.gravesite_id ?? null;

  return {
    id: row.id,
    headstoneId: row.headstone_id,
    cemeteryId: row.cemetery_id,
    cemeteryName: row.cemetery_name,
    gravesiteId,
    graveKey: gravesiteId ? `${row.cemetery_id}:${gravesiteId}` : `${row.cemetery_id}:headstone:${row.headstone_id}`,
    label: row.headstone_id,
    markerTypeCode: row.marker_type_code ?? "unknown",
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
    hasVeteran: Boolean(grave.has_veteran),
    geometryType: grave.geometry_type ?? "operational",
    geometrySource: grave.geometry_source ?? undefined,
    geometryConfidence: grave.geometry_confidence ?? "estimated",
    geometryNotes: grave.geometry_notes ?? undefined,
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

async function burialMilitaryServiceColumnsExist(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'burials'
        AND column_name = 'veteran'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

async function burialRecordedDateTextColumnsExist(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'burials'
        AND column_name = 'birth_date_text'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

async function burialRecordedDateTextSql(client, firstSetParameter = 15) {
  if (await burialRecordedDateTextColumnsExist(client)) {
    return {
      select: "burials.birth_date_text, burials.death_date_text",
      set: `birth_date_text = $${firstSetParameter},\n            death_date_text = $${firstSetParameter + 1}`,
      return: "birth_date_text,\n          death_date_text",
      hasColumns: true,
    };
  }

  return {
    select: "NULL::text AS birth_date_text, NULL::text AS death_date_text",
    set: "",
    return: "NULL::text AS birth_date_text,\n          NULL::text AS death_date_text",
    hasColumns: false,
  };
}

async function legacyBurialMilitaryBranchColumnExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'burials'
        AND column_name = 'military_branch'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

async function legacyBurialMilitaryWarsColumnExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'burials'
        AND column_name = 'military_wars'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

async function burialIntermentTypeLookupExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = 'burial_interment_types'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

async function burialIntermentTypeColumnExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'burials'
        AND column_name = 'interment_type_id'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

async function legacyBurialIntermentTypeColumnExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'burials'
        AND column_name = 'interment_type'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

async function burialIntermentTypeSql(client) {
  if (await burialIntermentTypeColumnExists(client)) {
    return {
      select: "burial_interment_types.code AS interment_type, burial_interment_types.label AS interment_type_label",
      join: "JOIN burial_interment_types ON burial_interment_types.id = burials.interment_type_id",
      hasLookup: true,
    };
  }

  if (await legacyBurialIntermentTypeColumnExists(client)) {
    return {
      select: "COALESCE(NULLIF(burials.interment_type, ''), 'casket') AS interment_type, CASE WHEN burials.interment_type = 'urn' THEN 'Funeral urn' ELSE 'Casket' END AS interment_type_label",
      join: "",
      hasLookup: false,
    };
  }

  return {
    select: "'casket'::text AS interment_type, 'Casket'::text AS interment_type_label",
    join: "",
    hasLookup: false,
  };
}

async function activeIntermentTypeExists(client, code) {
  if (!(await burialIntermentTypeColumnExists(client))) return true;
  const result = await client.query("SELECT EXISTS (SELECT 1 FROM burial_interment_types WHERE code = $1 AND is_active) AS exists", [code]);
  return Boolean(result.rows[0]?.exists);
}

async function burialRecordStatusColumnExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'burials'
        AND column_name = 'burial_record_status_type_id'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

async function burialRecordStatusSql(client) {
  if (await burialRecordStatusColumnExists(client)) {
    return {
      select: "burial_record_status_types.code AS record_status_code, burial_record_status_types.label AS record_status_label",
      join: "JOIN burial_record_status_types ON burial_record_status_types.id = burials.burial_record_status_type_id",
      hasLookup: true,
    };
  }

  return {
    select: "'interred'::text AS record_status_code, 'Interred'::text AS record_status_label",
    join: "",
    hasLookup: false,
  };
}

async function activeBurialRecordStatusExists(client, code) {
  if (!(await burialRecordStatusColumnExists(client))) return true;
  const result = await client.query("SELECT EXISTS (SELECT 1 FROM burial_record_status_types WHERE code = $1 AND is_active) AS exists", [code]);
  return Boolean(result.rows[0]?.exists);
}

async function burialMilitaryBranchLookupExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = 'military_branch_types'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

async function burialMilitaryBranchTypeColumnExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'burials'
        AND column_name = 'military_branch_type_id'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

async function burialMilitaryWarServiceLookupExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = 'military_war_service_types'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

async function burialMilitaryWarServiceTypeColumnExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'burials'
        AND column_name = 'military_war_service_type_id'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

async function burialMilitaryRankLookupExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = 'military_rank_types'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

async function burialMilitaryRankTypeColumnExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'burials'
        AND column_name = 'military_rank_type_id'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

async function burialMilitaryServiceSql(client) {
  if (!(await burialMilitaryServiceColumnsExist(client))) {
    return {
      select:
        "NULL::text AS veteran, NULL::text AS military_branch_code, NULL::text AS military_branch, NULL::text AS military_rank_code, NULL::text AS military_rank, NULL::text AS military_rank_abbreviation, NULL::text AS military_rank_pay_grade, NULL::text AS military_war_service_code, NULL::text AS military_wars",
      join: "",
      hasLookup: false,
    };
  }

  const hasBranchLookup = await burialMilitaryBranchTypeColumnExists(client);
  const hasWarServiceLookup = await burialMilitaryWarServiceTypeColumnExists(client);
  const hasRankLookup = await burialMilitaryRankTypeColumnExists(client);
  const hasLegacyBranchColumn = !hasBranchLookup && (await legacyBurialMilitaryBranchColumnExists(client));
  const hasLegacyWarsColumn = !hasWarServiceLookup && (await legacyBurialMilitaryWarsColumnExists(client));
  const branchCodeSelect = hasBranchLookup ? "military_branch_types.code AS military_branch_code" : "NULL::text AS military_branch_code";
  const branchLabelSelect = hasBranchLookup ? "military_branch_types.label AS military_branch" : hasLegacyBranchColumn ? "burials.military_branch" : "NULL::text AS military_branch";
  const rankCodeSelect = hasRankLookup ? "military_rank_types.code AS military_rank_code" : "NULL::text AS military_rank_code";
  const rankLabelSelect = hasRankLookup ? "military_rank_types.label AS military_rank" : "NULL::text AS military_rank";
  const rankAbbreviationSelect = hasRankLookup ? "military_rank_types.abbreviation AS military_rank_abbreviation" : "NULL::text AS military_rank_abbreviation";
  const rankPayGradeSelect = hasRankLookup ? "military_rank_types.pay_grade AS military_rank_pay_grade" : "NULL::text AS military_rank_pay_grade";
  const warServiceCodeSelect = hasWarServiceLookup ? "military_war_service_types.code AS military_war_service_code" : "NULL::text AS military_war_service_code";
  const warServiceLabelSelect = hasWarServiceLookup ? "military_war_service_types.label AS military_wars" : hasLegacyWarsColumn ? "burials.military_wars" : "NULL::text AS military_wars";
  const branchJoin = hasBranchLookup ? "LEFT JOIN military_branch_types ON military_branch_types.id = burials.military_branch_type_id" : "";
  const rankJoin = hasRankLookup ? "LEFT JOIN military_rank_types ON military_rank_types.id = burials.military_rank_type_id" : "";
  const warServiceJoin = hasWarServiceLookup ? "LEFT JOIN military_war_service_types ON military_war_service_types.id = burials.military_war_service_type_id" : "";

  return {
    select: `burials.veteran, ${branchCodeSelect}, ${branchLabelSelect}, ${rankCodeSelect}, ${rankLabelSelect}, ${rankAbbreviationSelect}, ${rankPayGradeSelect}, ${warServiceCodeSelect}, ${warServiceLabelSelect}`,
    join: [branchJoin, rankJoin, warServiceJoin].filter(Boolean).join("\n"),
    hasLookup: hasBranchLookup || hasRankLookup || hasWarServiceLookup,
  };
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
        lots.cemetery_id::text,
        lot_id,
        section_id,
        block_id,
        COALESCE(name, lot_id) AS name,
        geometry_type,
        geometry_source,
        geometry_confidence,
        geometry_notes,
        burial_use_status,
        burial_use_notes,
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

async function selectLotRestrictedAreasForCemeteries(client, cemeteryIds) {
  const result = await client.query(
    `
      SELECT
        lot_restricted_areas.id::text,
        lots.lot_id,
        lots.cemetery_id::text,
        COALESCE(lots.name, lots.lot_id) AS lot_name,
        lot_restricted_areas.restriction_type,
        lot_restricted_areas.name,
        lot_restricted_areas.notes,
        ST_AsGeoJSON(lot_restricted_areas.geometry)::json AS geometry
      FROM lot_restricted_areas
      JOIN lots
        ON lots.id = lot_restricted_areas.lot_uuid
      WHERE lots.cemetery_id = ANY($1::uuid[])
        AND lots.deleted_at IS NULL
        AND lot_restricted_areas.deleted_at IS NULL
      ORDER BY lots.section_id, lots.lot_id, lot_restricted_areas.name
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
        ${statusCodeSelect()} AS status,
        gravesites.geometry_type,
        gravesites.geometry_source,
        gravesites.geometry_confidence,
        gravesites.geometry_notes,
        EXISTS (
          SELECT 1
          FROM burials veteran_burials
          WHERE (
              veteran_burials.gravesite_uuid = gravesites.id
              OR (
                veteran_burials.gravesite_uuid IS NULL
                AND veteran_burials.gravesite_id = gravesites.gravesite_id
              )
            )
            AND veteran_burials.deleted_at IS NULL
            AND lower(btrim(coalesce(veteran_burials.veteran, ''))) IN ('yes', 'y', 'true', '1', 'veteran')
        ) AS has_veteran,
        ${includeCost ? "gravesites.cost," : ""}
        ST_AsGeoJSON(gravesites.geometry)::json AS geometry
      FROM gravesites
      JOIN cemeteries
        ON cemeteries.id = gravesites.cemetery_id
      LEFT JOIN gravesite_status_types status_type
        ON status_type.id = gravesites.status_type_id
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
        cemeteries.id::text AS cemetery_id,
        cemeteries.name AS cemetery_name,
        gravesites.gravesite_id,
        marker_types.code AS marker_type_code,
        marker_types.label AS marker_type_label,
        headstone_condition_types.code AS condition_code,
        ST_AsGeoJSON(headstones.geometry)::json AS geometry
      FROM headstones
      LEFT JOIN gravesites
        ON gravesites.id = headstones.gravesite_uuid
       AND gravesites.deleted_at IS NULL
      JOIN LATERAL (
        SELECT cemeteries.id, cemeteries.name
        FROM cemeteries
        WHERE cemeteries.deleted_at IS NULL
          AND cemeteries.id = ANY($1::uuid[])
          AND (
            cemeteries.id = gravesites.cemetery_id
            OR (
              gravesites.id IS NULL
              AND cemeteries.geometry IS NOT NULL
              AND ST_Covers(cemeteries.geometry, headstones.geometry)
            )
          )
        ORDER BY
          CASE WHEN cemeteries.id = gravesites.cemetery_id THEN 0 ELSE 1 END,
          cemeteries.name
        LIMIT 1
      ) cemeteries ON TRUE
      JOIN marker_types
        ON marker_types.id = headstones.marker_type_id
      JOIN headstone_condition_types
        ON headstone_condition_types.id = headstones.condition_type_id
      WHERE headstones.deleted_at IS NULL
        AND headstones.geometry IS NOT NULL
      ORDER BY cemeteries.name, COALESCE(gravesites.gravesite_id, headstones.headstone_id), headstones.headstone_id
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
        ${statusCodeSelect()} AS status,
        gravesites.cost,
        gravesites.geometry_type,
        gravesites.geometry_source,
        gravesites.geometry_confidence,
        gravesites.geometry_notes,
        lots.geometry_type AS lot_geometry_type,
        lots.geometry_source AS lot_geometry_source,
        lots.geometry_confidence AS lot_geometry_confidence,
        lots.geometry_notes AS lot_geometry_notes,
        ST_AsGeoJSON(gravesites.geometry)::json AS geometry
      FROM gravesites
      JOIN cemeteries
        ON cemeteries.id = gravesites.cemetery_id
      LEFT JOIN lots
        ON lots.id = gravesites.lot_uuid
       AND lots.deleted_at IS NULL
      LEFT JOIN gravesite_status_types status_type
        ON status_type.id = gravesites.status_type_id
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
        gravesites.status_type_id::text,
        ${statusCodeSelect()} AS status,
        gravesites.cost,
        gravesites.updated_at
      FROM gravesites
      LEFT JOIN gravesite_status_types status_type
        ON status_type.id = gravesites.status_type_id
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
  const militaryServiceSql = await burialMilitaryServiceSql(client);
  const intermentTypeSql = await burialIntermentTypeSql(client);
  const recordStatusSql = await burialRecordStatusSql(client);
  const recordedDateTextSql = await burialRecordedDateTextSql(client);
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
  const result = await client.query(
    `
      SELECT burials.id::text, burials.gravesite_uuid::text, burials.first_name, burials.last_name, burials.maiden_name, burials.full_name, burials.birth_date, ${recordedDateTextSql.select}, burials.death_date, burials.burial_date, ${intermentTypeSql.select}, ${recordStatusSql.select}, burials.funeral_home, ${militaryServiceSql.select}, burials.notes
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
        COALESCE(current_ownership_right_owners.gravesite_uuid::text, target_gravesites.id::text) AS gravesite_uuid,
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
      LEFT JOIN gravesites target_gravesites
        ON current_ownership_right_owners.target_type = 'lot'
       AND target_gravesites.lot_uuid = current_ownership_right_owners.lot_uuid
       AND target_gravesites.deleted_at IS NULL
      WHERE current_ownership_right_owners.target_type IN ('gravesite', 'lot')
        AND COALESCE(current_ownership_right_owners.gravesite_uuid, target_gravesites.id) IN (
          SELECT id
          FROM gravesites
          WHERE cemetery_id = ANY($1::uuid[])
            AND deleted_at IS NULL
        )
      ORDER BY sale_date DESC NULLS LAST, effective_date DESC NULLS LAST, created_at DESC, id
    `,
    [cemeteryIds],
  );

  return result.rows;
}

async function selectBurialsForCemeteries(client, cemeteryIds) {
  const militaryServiceSql = await burialMilitaryServiceSql(client);
  const intermentTypeSql = await burialIntermentTypeSql(client);
  const recordStatusSql = await burialRecordStatusSql(client);
  const recordedDateTextSql = await burialRecordedDateTextSql(client);
  const result = await client.query(
    `
      SELECT burials.id::text, burials.gravesite_uuid::text, burials.first_name, burials.last_name, burials.maiden_name, burials.full_name, burials.birth_date, ${recordedDateTextSql.select}, burials.death_date, burials.burial_date, ${intermentTypeSql.select}, ${recordStatusSql.select}, burials.funeral_home, ${militaryServiceSql.select}, burials.notes
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

async function selectOwnersForGrave(client, graveUuid) {
  const result = await client.query(
    `
      WITH selected_grave AS (
        SELECT id, lot_uuid
        FROM gravesites
        WHERE id = $1
          AND deleted_at IS NULL
      )
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
        selected_grave.id::text AS gravesite_uuid,
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
      JOIN selected_grave
        ON (
          current_ownership_right_owners.target_type = 'gravesite'
          AND current_ownership_right_owners.gravesite_uuid = selected_grave.id
        )
        OR (
          current_ownership_right_owners.target_type = 'lot'
          AND current_ownership_right_owners.lot_uuid = selected_grave.lot_uuid
        )
      JOIN ownership_events
        ON ownership_events.id = current_ownership_right_owners.ownership_event_uuid
      WHERE current_ownership_right_owners.target_type IN ('gravesite', 'lot')
      ORDER BY sale_date DESC NULLS LAST, effective_date DESC NULLS LAST, created_at DESC, id
    `,
    [graveUuid],
  );

  return result.rows;
}

async function selectOwnershipTargets(client, cemeteryId, selectedGravesiteId, targetScope, targetGravesiteIds) {
  const selectedResult = await client.query(
    `
      SELECT id, cemetery_id::text, gravesite_id, lot_uuid
      FROM gravesites
      WHERE cemetery_id = $1
        AND gravesite_id = $2
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [cemeteryId, selectedGravesiteId],
  );
  const selectedGrave = selectedResult.rows[0];
  if (!selectedGrave) return undefined;

  if (targetScope === "selected_lot") {
    if (!selectedGrave.lot_uuid) {
      throw new Error("Selected gravesite is not linked to a lot.");
    }
    return {
      selectedGrave,
      rights: [{ targetType: "lot", lotUuid: selectedGrave.lot_uuid, label: "selected lot" }],
    };
  }

  if (targetScope === "listed_gravesites") {
    const ids = [...new Set(targetGravesiteIds.map((id) => String(id ?? "").trim()).filter(Boolean))];
    if (ids.length === 0) throw new Error("At least one gravesite ID is required.");
    const result = await client.query(
      `
        SELECT id, gravesite_id
        FROM gravesites
        WHERE cemetery_id = $1
          AND gravesite_id = ANY($2::text[])
          AND deleted_at IS NULL
        ORDER BY gravesite_id
      `,
      [cemeteryId, ids],
    );
    if (result.rows.length !== ids.length) {
      const found = new Set(result.rows.map((row) => row.gravesite_id));
      const missing = ids.filter((id) => !found.has(id));
      throw new Error(`Unknown gravesite ID: ${missing.join(", ")}.`);
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

export async function createOwnershipEvent(
  pool,
  cemeteryId,
  selectedGravesiteId,
  { ownerDisplayName, eventType, targetScope, targetGravesiteIds = [], effectiveDate, documentReference, notes },
  { actorUser, reason, allowedCemeteryIds } = {},
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason: reason ?? "Ownership event update" });

    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(cemeteryId)) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const targets = await selectOwnershipTargets(client, cemeteryId, selectedGravesiteId, targetScope, targetGravesiteIds);
    if (!targets) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const partyResult = await client.query(
      `
        INSERT INTO ownership_parties (display_name)
        SELECT $1
        WHERE NOT EXISTS (
          SELECT 1
          FROM ownership_parties
          WHERE display_name = $1
            AND deleted_at IS NULL
        )
        RETURNING id::text
      `,
      [ownerDisplayName],
    );
    const partyId =
      partyResult.rows[0]?.id ??
      (
        await client.query(
          `
            SELECT id::text
            FROM ownership_parties
            WHERE display_name = $1
              AND deleted_at IS NULL
            ORDER BY created_at, id
            LIMIT 1
          `,
          [ownerDisplayName],
        )
      ).rows[0]?.id;

    const eventResult = await client.query(
      `
        INSERT INTO ownership_events (
          cemetery_id,
          event_type,
          effective_date,
          recorded_by,
          document_reference,
          notes,
          source_table
        )
        VALUES ($1, $2, NULLIF($3, '')::date, $4, NULLIF($5, ''), NULLIF($6, ''), 'manual_ownership_workflow')
        RETURNING id::text
      `,
      [cemeteryId, eventType, effectiveDate ?? "", actorUser?.email ?? "Cemetery database", documentReference ?? "", notes ?? ""],
    );
    const eventId = eventResult.rows[0].id;

    await client.query(
      `
        INSERT INTO ownership_event_parties (ownership_event_uuid, ownership_party_uuid, ownership_role)
        VALUES ($1, $2, 'owner')
      `,
      [eventId, partyId],
    );

    for (const right of targets.rights) {
      await client.query(
        `
          INSERT INTO ownership_event_rights (
            ownership_event_uuid,
            target_type,
            lot_uuid,
            gravesite_uuid,
            right_type,
            notes
          )
          VALUES ($1, $2, $3::uuid, $4::uuid, 'burial_right', $5)
        `,
        [
          eventId,
          right.targetType,
          right.lotUuid ?? null,
          right.gravesiteUuid ?? null,
          ownershipRightNotes({ right_type: "burial_right", target_type: right.targetType, notes: `Manual ownership workflow target: ${right.label}.` }),
        ],
      );
    }

    await client.query("COMMIT");
    return { id: eventId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function selectBurialsForGrave(client, graveUuid) {
  const militaryServiceSql = await burialMilitaryServiceSql(client);
  const intermentTypeSql = await burialIntermentTypeSql(client);
  const recordStatusSql = await burialRecordStatusSql(client);
  const recordedDateTextSql = await burialRecordedDateTextSql(client);
  const result = await client.query(
    `
      SELECT burials.id::text, burials.gravesite_uuid::text, burials.first_name, burials.last_name, burials.maiden_name, burials.full_name, burials.birth_date, ${recordedDateTextSql.select}, burials.death_date, burials.burial_date, ${intermentTypeSql.select}, ${recordStatusSql.select}, burials.funeral_home, ${militaryServiceSql.select}, burials.notes
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

  const featuresByHeadstone = await selectFeaturesForHeadstones(
    client,
    result.rows.map((row) => row.id),
  );
  const maintenanceByHeadstone = await selectMaintenanceForHeadstones(
    client,
    result.rows.map((row) => row.id),
  );

  return result.rows.map((row) => ({
    ...row,
    features: featuresByHeadstone.get(row.id) ?? [],
    maintenance_records: maintenanceByHeadstone.get(row.id) ?? [],
  }));
}

const graveFeatureSelectSql = `
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

const graveFeatureJoinSql = `
  JOIN grave_feature_types
    ON grave_feature_types.id = grave_features.feature_type_id
  LEFT JOIN grave_feature_subtypes
    ON grave_feature_subtypes.id = grave_features.feature_subtype_id
  LEFT JOIN grave_feature_placement_types
    ON grave_feature_placement_types.id = grave_features.placement_type_id
  LEFT JOIN grave_feature_material_types
    ON grave_feature_material_types.id = grave_features.material_type_id
`;

async function graveFeatureTablesExist(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = 'grave_features'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

async function selectFeaturesForGrave(client, graveUuid) {
  if (!(await graveFeatureTablesExist(client))) return [];

  const result = await client.query(
    `
      SELECT ${graveFeatureSelectSql}
      FROM grave_features
      ${graveFeatureJoinSql}
      WHERE grave_features.deleted_at IS NULL
        AND grave_features.gravesite_uuid = $1
      ORDER BY grave_feature_types.sort_order, grave_feature_subtypes.sort_order NULLS LAST, grave_features.created_at
    `,
    [graveUuid],
  );

  return result.rows;
}

async function selectFeaturesForHeadstones(client, headstoneUuids) {
  if (!headstoneUuids.length || !(await graveFeatureTablesExist(client))) return new Map();

  const result = await client.query(
    `
      SELECT ${graveFeatureSelectSql}
      FROM grave_features
      ${graveFeatureJoinSql}
      WHERE grave_features.deleted_at IS NULL
        AND grave_features.headstone_uuid = ANY($1::uuid[])
      ORDER BY grave_feature_types.sort_order, grave_feature_subtypes.sort_order NULLS LAST, grave_features.created_at
    `,
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

const maintenanceRecordSelectSql = `
  maintenance_records.id::text,
  maintenance_records.cemetery_id::text,
  maintenance_records.gravesite_uuid::text,
  maintenance_records.headstone_uuid::text,
  maintenance_issue_types.id::text AS issue_type_id,
  maintenance_issue_types.code AS issue_type_code,
  maintenance_issue_types.label AS issue_type_label,
  maintenance_action_types.id::text AS action_type_id,
  maintenance_action_types.code AS action_type_code,
  maintenance_action_types.label AS action_type_label,
  maintenance_priority_types.id::text AS priority_id,
  maintenance_priority_types.code AS priority_code,
  maintenance_priority_types.label AS priority_label,
  maintenance_records.status,
  maintenance_records.observed_at,
  maintenance_records.completed_at,
  maintenance_records.performed_by,
  maintenance_records.source_type,
  maintenance_records.notes
`;

const maintenanceRecordJoinSql = `
  LEFT JOIN maintenance_issue_types
    ON maintenance_issue_types.id = maintenance_records.issue_type_id
  LEFT JOIN maintenance_action_types
    ON maintenance_action_types.id = maintenance_records.action_type_id
  JOIN maintenance_priority_types
    ON maintenance_priority_types.id = maintenance_records.priority_type_id
`;

async function maintenanceTablesExist(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = 'maintenance_records'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

async function selectMaintenanceForGrave(client, graveUuid) {
  if (!(await maintenanceTablesExist(client))) return [];

  const result = await client.query(
    `
      SELECT ${maintenanceRecordSelectSql}
      FROM maintenance_records
      ${maintenanceRecordJoinSql}
      WHERE maintenance_records.deleted_at IS NULL
        AND maintenance_records.gravesite_uuid = $1
      ORDER BY
        CASE maintenance_records.status
          WHEN 'open' THEN 1
          WHEN 'scheduled' THEN 2
          WHEN 'deferred' THEN 3
          WHEN 'completed' THEN 4
          ELSE 5
        END,
        maintenance_records.observed_at DESC,
        maintenance_records.created_at DESC
    `,
    [graveUuid],
  );

  return result.rows;
}

async function selectMaintenanceForHeadstones(client, headstoneUuids) {
  if (!headstoneUuids.length || !(await maintenanceTablesExist(client))) return new Map();

  const result = await client.query(
    `
      SELECT ${maintenanceRecordSelectSql}
      FROM maintenance_records
      ${maintenanceRecordJoinSql}
      WHERE maintenance_records.deleted_at IS NULL
        AND maintenance_records.headstone_uuid = ANY($1::uuid[])
      ORDER BY
        CASE maintenance_records.status
          WHEN 'open' THEN 1
          WHEN 'scheduled' THEN 2
          WHEN 'deferred' THEN 3
          WHEN 'completed' THEN 4
          ELSE 5
        END,
        maintenance_records.observed_at DESC,
        maintenance_records.created_at DESC
    `,
    [headstoneUuids],
  );

  const byHeadstone = new Map();
  for (const row of result.rows) {
    const records = byHeadstone.get(row.headstone_uuid) ?? [];
    records.push(row);
    byHeadstone.set(row.headstone_uuid, records);
  }

  return byHeadstone;
}

const headstoneDetailColumnsSql = `
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
  headstone_vase_types.id::text AS vase_type_id,
  headstone_vase_types.code AS vase_type_code,
  headstone_vase_types.label AS vase_type_label,
  headstone_vase_material_types.id::text AS vase_material_id,
  headstone_vase_material_types.code AS vase_material_code,
  headstone_vase_material_types.label AS vase_material_label,
  headstone_vase_placement_types.id::text AS vase_placement_id,
  headstone_vase_placement_types.code AS vase_placement_code,
  headstone_vase_placement_types.label AS vase_placement_label,
  headstones.vase_notes,
  headstones.condition_notes,
  headstones.inscription,
  headstones.design_notes,
  headstones.back_description,
  headstones.photo_url,
  headstones.last_inspected_at
`;

const headstoneLookupJoinsSql = `
  JOIN marker_types
    ON marker_types.id = headstones.marker_type_id
  JOIN marker_material_types
    ON marker_material_types.id = headstones.material_type_id
  JOIN headstone_condition_types
    ON headstone_condition_types.id = headstones.condition_type_id
  LEFT JOIN headstone_vase_types
    ON headstone_vase_types.id = headstones.vase_type_id
  LEFT JOIN headstone_vase_material_types
    ON headstone_vase_material_types.id = headstones.vase_material_type_id
  LEFT JOIN headstone_vase_placement_types
    ON headstone_vase_placement_types.id = headstones.vase_placement_type_id
`;

const headstoneEvidenceJoinSql = `
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
`;

const headstoneMediaJoinSql = `
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
        'status', media_assets.status,
        'mediaLinkId', headstone_media_assets.id::text,
        'mediaLinkType', 'headstone',
        'displayOrder', headstone_media_assets.display_order
      )
      ORDER BY headstone_media_assets.display_order, media_assets.captured_at DESC NULLS LAST, media_assets.uploaded_at DESC, media_assets.id
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
`;

const headstoneDetailGroupBySql = `
  headstones.id,
  headstones.headstone_id,
  marker_types.id,
  marker_types.code,
  marker_types.label,
  marker_material_types.id,
  marker_material_types.code,
  marker_material_types.label,
  headstone_condition_types.id,
  headstone_condition_types.code,
  headstone_condition_types.label,
  headstone_vase_types.id,
  headstone_vase_types.code,
  headstone_vase_types.label,
  headstone_vase_material_types.id,
  headstone_vase_material_types.code,
  headstone_vase_material_types.label,
  headstone_vase_placement_types.id,
  headstone_vase_placement_types.code,
  headstone_vase_placement_types.label,
  headstones.vase_notes,
  headstones.condition_notes,
  headstones.inscription,
  headstones.design_notes,
  headstones.back_description,
  headstones.photo_url,
  headstones.last_inspected_at
`;

async function selectHeadstonesForGrave(client, graveUuid) {
  const result = await client.query(
    `
      WITH selected_headstones AS (
        SELECT DISTINCT ON (headstones.id, COALESCE(headstone_gravesites.relationship_type, 'primary'), headstone_gravesites.notes)
          headstones.*,
          COALESCE(headstone_gravesites.relationship_type, 'primary') AS selected_relationship_type,
          headstone_gravesites.notes AS selected_relationship_notes
        FROM headstones
        LEFT JOIN headstone_gravesites
          ON headstone_gravesites.headstone_uuid = headstones.id
         AND headstone_gravesites.deleted_at IS NULL
        WHERE headstones.deleted_at IS NULL
          AND (
            headstones.gravesite_uuid = $1
            OR headstone_gravesites.gravesite_uuid = $1
          )
        ORDER BY headstones.id, COALESCE(headstone_gravesites.relationship_type, 'primary'), headstone_gravesites.notes
      )
      SELECT
        ${headstoneDetailColumnsSql},
        headstones.selected_relationship_type AS relationship_type,
        headstones.selected_relationship_notes AS relationship_notes,
        array_remove(array_agg(DISTINCT headstone_burials.burial_uuid::text), NULL) AS burial_ids,
        COALESCE(headstone_evidence.evidence, '[]'::jsonb) AS north_hills_evidence,
        COALESCE(headstone_media.media_assets, '[]'::jsonb) AS media_assets
      FROM selected_headstones AS headstones
      LEFT JOIN headstone_burials
        ON headstone_burials.headstone_uuid = headstones.id
       AND headstone_burials.deleted_at IS NULL
      ${headstoneLookupJoinsSql}
      ${headstoneEvidenceJoinSql}
      ${headstoneMediaJoinSql}
      GROUP BY
        ${headstoneDetailGroupBySql},
        headstones.selected_relationship_type,
        headstones.selected_relationship_notes,
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
      WITH selected_headstones AS (
        SELECT headstones.*
        FROM headstones
        WHERE headstones.id = $1
          AND headstones.deleted_at IS NULL
      )
      SELECT
        ${headstoneDetailColumnsSql},
        COALESCE(headstone_relationship.relationship_type, 'primary') AS relationship_type,
        headstone_relationship.notes AS relationship_notes,
        COALESCE(associated_gravesites.gravesite_ids, ARRAY[]::text[]) AS associated_gravesite_ids,
        array_remove(array_agg(DISTINCT headstone_burials.burial_uuid::text), NULL) AS burial_ids,
        COALESCE(headstone_evidence.evidence, '[]'::jsonb) AS north_hills_evidence,
        COALESCE(headstone_media.media_assets, '[]'::jsonb) AS media_assets
      FROM selected_headstones AS headstones
      LEFT JOIN headstone_burials
        ON headstone_burials.headstone_uuid = headstones.id
       AND headstone_burials.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT relationship_type, notes
        FROM headstone_gravesites
        WHERE headstone_gravesites.headstone_uuid = headstones.id
          AND headstone_gravesites.deleted_at IS NULL
        ORDER BY
          CASE relationship_type
            WHEN 'spans' THEN 1
            WHEN 'nearby' THEN 2
            WHEN 'inferred' THEN 3
            ELSE 4
          END,
          created_at,
          id
        LIMIT 1
      ) headstone_relationship ON true
      LEFT JOIN LATERAL (
        SELECT array_remove(array_agg(DISTINCT associated_gravesite_rows.gravesite_id), NULL) AS gravesite_ids
        FROM (
          SELECT primary_gravesites.gravesite_id
          FROM gravesites primary_gravesites
          WHERE primary_gravesites.id = headstones.gravesite_uuid
            AND primary_gravesites.deleted_at IS NULL

          UNION

          SELECT linked_gravesites.gravesite_id
          FROM headstone_gravesites
          JOIN gravesites linked_gravesites
            ON linked_gravesites.id = headstone_gravesites.gravesite_uuid
           AND linked_gravesites.deleted_at IS NULL
          WHERE headstone_gravesites.headstone_uuid = headstones.id
            AND headstone_gravesites.deleted_at IS NULL
        ) associated_gravesite_rows
      ) associated_gravesites ON true
      ${headstoneLookupJoinsSql}
      ${headstoneEvidenceJoinSql}
      ${headstoneMediaJoinSql}
      GROUP BY
        ${headstoneDetailGroupBySql},
        headstone_relationship.relationship_type,
        headstone_relationship.notes,
        associated_gravesites.gravesite_ids,
        headstone_evidence.evidence,
        headstone_media.media_assets
      LIMIT 1
    `,
    [id],
  );

  const headstone = result.rows[0];
  if (!headstone) return undefined;

  const featuresByHeadstone = await selectFeaturesForHeadstones(client, [headstone.id]);
  const maintenanceByHeadstone = await selectMaintenanceForHeadstones(client, [headstone.id]);
  return {
    ...headstone,
    features: featuresByHeadstone.get(headstone.id) ?? [],
    maintenance_records: maintenanceByHeadstone.get(headstone.id) ?? [],
  };
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
        media_assets.status,
        gravesite_media_assets.id::text AS media_link_id,
        'gravesite' AS media_link_type,
        gravesite_media_assets.display_order
      FROM gravesite_media_assets
      JOIN media_assets
        ON media_assets.id = gravesite_media_assets.media_asset_id
      WHERE gravesite_media_assets.gravesite_uuid = $1
        AND gravesite_media_assets.deleted_at IS NULL
        AND gravesite_media_assets.status = 'linked'
        AND media_assets.deleted_at IS NULL
        AND media_assets.status = 'linked'
      ORDER BY gravesite_media_assets.display_order, media_assets.captured_at DESC NULLS LAST, media_assets.uploaded_at DESC, media_assets.id
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
        COALESCE(gravesite.cemetery_id, containing_cemetery.id)::text AS cemetery_id,
        headstones.headstone_id,
        headstones.marker_type_id::text,
        marker_types.code AS marker_type_code,
        headstones.material_type_id::text,
        marker_material_types.code AS material_type_code,
        headstones.condition_type_id::text,
        headstone_condition_types.code AS condition,
        headstones.vase_type_id::text,
        headstone_vase_types.code AS vase_type_code,
        headstones.vase_material_type_id::text,
        headstone_vase_material_types.code AS vase_material_type_code,
        headstones.vase_placement_type_id::text,
        headstone_vase_placement_types.code AS vase_placement_type_code,
        headstones.vase_notes,
        headstones.condition_notes,
        headstones.inscription,
        headstones.design_notes,
        headstones.back_description,
        headstones.photo_url,
        headstones.last_inspected_at,
        headstones.updated_at
      FROM headstones
      JOIN marker_types
        ON marker_types.id = headstones.marker_type_id
      JOIN marker_material_types
        ON marker_material_types.id = headstones.material_type_id
      JOIN headstone_condition_types
        ON headstone_condition_types.id = headstones.condition_type_id
      LEFT JOIN headstone_vase_types
        ON headstone_vase_types.id = headstones.vase_type_id
      LEFT JOIN headstone_vase_material_types
        ON headstone_vase_material_types.id = headstones.vase_material_type_id
      LEFT JOIN headstone_vase_placement_types
        ON headstone_vase_placement_types.id = headstones.vase_placement_type_id
      LEFT JOIN gravesites AS gravesite
        ON gravesite.id = headstones.gravesite_uuid
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
    const vaseTypes = await client.query("SELECT id::text, code, label FROM headstone_vase_types WHERE is_active ORDER BY sort_order, label");
    const vaseMaterials = await client.query("SELECT id::text, code, label FROM headstone_vase_material_types WHERE is_active ORDER BY sort_order, label");
    const vasePlacements = await client.query("SELECT id::text, code, label FROM headstone_vase_placement_types WHERE is_active ORDER BY sort_order, label");
    const graveFeatureLookupExists = await graveFeatureTablesExist(client);
    const graveFeatureTypes = graveFeatureLookupExists ? await client.query("SELECT id::text, code, label FROM grave_feature_types WHERE is_active ORDER BY sort_order, label") : { rows: [] };
    const graveFeatureSubtypes = graveFeatureLookupExists
      ? await client.query(`
          SELECT
            grave_feature_subtypes.id::text,
            grave_feature_subtypes.code,
            grave_feature_subtypes.label,
            grave_feature_types.code AS "featureTypeCode"
          FROM grave_feature_subtypes
          LEFT JOIN grave_feature_types
            ON grave_feature_types.id = grave_feature_subtypes.grave_feature_type_id
          WHERE grave_feature_subtypes.is_active
          ORDER BY grave_feature_subtypes.sort_order, grave_feature_subtypes.label
        `)
      : { rows: [] };
    const graveFeaturePlacements = graveFeatureLookupExists ? await client.query("SELECT id::text, code, label FROM grave_feature_placement_types WHERE is_active ORDER BY sort_order, label") : { rows: [] };
    const graveFeatureMaterials = graveFeatureLookupExists ? await client.query("SELECT id::text, code, label FROM grave_feature_material_types WHERE is_active ORDER BY sort_order, label") : { rows: [] };
    const intermentTypes = (await burialIntermentTypeLookupExists(client))
      ? await client.query("SELECT id::text, code, label FROM burial_interment_types WHERE is_active ORDER BY sort_order, label")
      : {
          rows: [
            { id: "legacy-casket", code: "casket", label: "Casket" },
            { id: "legacy-urn", code: "urn", label: "Funeral urn" },
          ],
        };
    const burialRecordStatuses = (await burialRecordStatusColumnExists(client))
      ? await client.query("SELECT id::text, code, label FROM burial_record_status_types WHERE is_active ORDER BY sort_order, label")
      : { rows: [{ id: "legacy-interred", code: "interred", label: "Interred" }] };
    const militaryBranches = (await burialMilitaryBranchLookupExists(client))
      ? await client.query("SELECT id::text, code, label FROM military_branch_types WHERE is_active ORDER BY sort_order, label")
      : { rows: [] };
    const militaryRanks = (await burialMilitaryRankLookupExists(client))
      ? await client.query(`
          SELECT
            military_rank_types.id::text,
            military_rank_types.code,
            military_rank_types.label,
            military_rank_types.abbreviation,
            military_rank_types.pay_grade AS "payGrade",
            military_branch_types.code AS "militaryBranchCode"
          FROM military_rank_types
          JOIN military_branch_types
            ON military_branch_types.id = military_rank_types.military_branch_type_id
          WHERE military_rank_types.is_active
            AND military_branch_types.is_active
          ORDER BY military_branch_types.sort_order, military_rank_types.sort_order, military_rank_types.label
        `)
      : { rows: [] };
    const militaryWarServices = (await burialMilitaryWarServiceLookupExists(client))
      ? await client.query("SELECT id::text, code, label FROM military_war_service_types WHERE is_active ORDER BY sort_order, label")
      : { rows: [] };
    const maintenanceLookupExists = await maintenanceTablesExist(client);
    const maintenanceIssueTypes = maintenanceLookupExists ? await client.query("SELECT id::text, code, label FROM maintenance_issue_types WHERE is_active ORDER BY sort_order, label") : { rows: [] };
    const maintenanceActionTypes = maintenanceLookupExists ? await client.query("SELECT id::text, code, label FROM maintenance_action_types WHERE is_active ORDER BY sort_order, label") : { rows: [] };
    const maintenancePriorities = maintenanceLookupExists ? await client.query("SELECT id::text, code, label FROM maintenance_priority_types WHERE is_active ORDER BY sort_order, label") : { rows: [] };

    return {
      markerTypes: markerTypes.rows,
      materials: materials.rows,
      conditions: conditions.rows,
      vaseTypes: vaseTypes.rows,
      vaseMaterials: vaseMaterials.rows,
      vasePlacements: vasePlacements.rows,
      graveFeatureTypes: graveFeatureTypes.rows,
      graveFeatureSubtypes: graveFeatureSubtypes.rows,
      graveFeaturePlacements: graveFeaturePlacements.rows,
      graveFeatureMaterials: graveFeatureMaterials.rows,
      intermentTypes: intermentTypes.rows,
      burialRecordStatuses: burialRecordStatuses.rows,
      militaryBranches: militaryBranches.rows,
      militaryRanks: militaryRanks.rows,
      militaryWarServices: militaryWarServices.rows,
      maintenanceIssueTypes: maintenanceIssueTypes.rows,
      maintenanceActionTypes: maintenanceActionTypes.rows,
      maintenancePriorities: maintenancePriorities.rows,
    };
  } finally {
    client.release();
  }
}

function toBoundaryFeature(cemetery) {
  return {
    type: "Feature",
    properties: { id: cemetery.id, name: cemetery.name },
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
    cemeteryId: lot.cemetery_id,
    name: lot.name,
    section: lot.section_id ?? "",
    block: lot.block_id ?? undefined,
    burialUseStatus: lot.burial_use_status ?? "standard",
    burialUseNotes: lot.burial_use_notes ?? undefined,
    geometryType: lot.geometry_type ?? "operational",
    geometrySource: lot.geometry_source ?? undefined,
    geometryConfidence: lot.geometry_confidence ?? "estimated",
    geometryNotes: lot.geometry_notes ?? undefined,
    geometry: parseGeometry(lot.geometry),
  };
}

function toLotRestrictedArea(area) {
  return {
    id: area.id,
    lotId: area.lot_id,
    cemeteryId: area.cemetery_id,
    lotName: area.lot_name,
    restrictionType: area.restriction_type ?? "non_burial",
    name: area.name,
    notes: area.notes ?? undefined,
    geometry: parseGeometry(area.geometry),
  };
}

function toDetailedGrave(grave, graveOwners, graveBurials, graveHeadstones, northHillsEvidence, mediaAssets, graveFeatures, maintenanceRecords, includeOwnership) {
  const detailedGrave = {
    ...toGraveSummary(grave),
    name: grave.name ?? "",
    cost: grave.cost === null || grave.cost === undefined ? undefined : Number(grave.cost),
    owners: graveOwners.map(toOwner),
    currentOwnerIds: graveOwners.map((owner) => owner.id),
    burials: graveBurials.map(toBurial),
    headstones: graveHeadstones.map(toHeadstone),
    features: graveFeatures.map(toGraveFeature),
    maintenanceRecords: maintenanceRecords.map(toMaintenanceRecord),
    northHillsEvidence: northHillsEvidence.map(toNorthHillsEvidence),
    mediaAssets: mediaAssets.map(toMediaAsset),
    ownershipHistory: graveOwners.map(toOwnershipEvent),
    notes: grave.cost ? `Recorded cost: $${grave.cost}` : undefined,
    lotGeometryType: grave.lot_geometry_type ?? undefined,
    lotGeometrySource: grave.lot_geometry_source ?? undefined,
    lotGeometryConfidence: grave.lot_geometry_confidence ?? undefined,
    lotGeometryNotes: grave.lot_geometry_notes ?? undefined,
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
    const lotRestrictedAreas = await selectLotRestrictedAreasForCemeteries(client, cemeteryIds);
    const graves = await selectGravesForCemeteries(client, cemeteryIds);
    const headstones = await selectHeadstoneSummariesForCemeteries(client, cemeteryIds);

    return {
      boundaries: cemeteries.map(toBoundaryFeature),
      boundary: {
        type: "Feature",
        properties: { id: cemeteries[0].id, name: cemeteries[0].name },
        geometry: parseGeometry(cemeteries[0].geometry),
      },
      sections: sections.map(toSection),
      lots: lots.map(toLot),
      lotRestrictedAreas: lotRestrictedAreas.map(toLotRestrictedArea),
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
    const lotRestrictedAreas = await selectLotRestrictedAreasForCemeteries(client, cemeteryIds);
    const graves = await selectGravesForCemeteries(client, cemeteryIds, { includeCost: true });
    const owners = includeOwnership ? await selectOwnersForCemeteries(client, cemeteryIds) : [];
    const burials = await selectBurialsForCemeteries(client, cemeteryIds);

    const ownersByGrave = groupBy(owners, "gravesite_uuid");
    const burialsByGrave = groupBy(burials, "gravesite_uuid");

    return {
      boundaries: cemeteries.map(toBoundaryFeature),
      boundary: {
        type: "Feature",
        properties: { id: cemeteries[0].id, name: cemeteries[0].name },
        geometry: parseGeometry(cemeteries[0].geometry),
      },
      sections: sections.map(toSection),
      lots: lots.map(toLot),
      lotRestrictedAreas: lotRestrictedAreas.map(toLotRestrictedArea),
      graves: graves.map((grave) => toDetailedGrave(grave, ownersByGrave.get(grave.uuid) ?? [], burialsByGrave.get(grave.uuid) ?? [], [], [], [], [], [], includeOwnership)),
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
    const features = await selectFeaturesForGrave(client, grave.uuid);
    const maintenanceRecords = await selectMaintenanceForGrave(client, grave.uuid);

    return toDetailedGrave(grave, owners, burials, headstones, northHillsEvidence, mediaAssets, features, maintenanceRecords, includeOwnership);
  } finally {
    client.release();
  }
}

export async function getHeadstone(pool, id) {
  const client = await pool.connect();
  try {
    const headstone = await selectHeadstoneById(client, id);
    return headstone ? toHeadstone(headstone) : undefined;
  } finally {
    client.release();
  }
}

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

export async function createMaintenanceRecord(pool, cemeteryId, record, { actorUser, reason, allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });

    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(cemeteryId)) {
      await client.query("ROLLBACK");
      return undefined;
    }

    let gravesiteUuid = null;
    if (record.graveSpaceId) {
      const graveResult = await client.query(
        `
          SELECT id::text
          FROM gravesites
          WHERE cemetery_id = $1
            AND gravesite_id = $2
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [cemeteryId, record.graveSpaceId],
      );
      gravesiteUuid = graveResult.rows[0]?.id ?? null;
      if (!gravesiteUuid) {
        await client.query("ROLLBACK");
        return undefined;
      }
    }

    let headstoneUuid = record.headstoneId || null;
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
        INSERT INTO maintenance_records (
          cemetery_id,
          gravesite_uuid,
          headstone_uuid,
          issue_type_id,
          action_type_id,
          priority_type_id,
          status,
          observed_at,
          completed_at,
          performed_by,
          source_type,
          notes
        )
        VALUES (
          $1,
          $2::uuid,
          $3::uuid,
          NULLIF($4, '')::uuid,
          NULLIF($5, '')::uuid,
          $6::uuid,
          $7,
          $8::date,
          NULLIF($9, '')::date,
          NULLIF($10, ''),
          $11,
          NULLIF($12, '')
        )
        RETURNING id::text
      `,
      [
        cemeteryId,
        gravesiteUuid,
        headstoneUuid,
        record.issueTypeId || "",
        record.actionTypeId || "",
        record.priorityTypeId,
        record.status || "open",
        record.observedAt,
        record.completedAt || "",
        record.performedBy || "",
        record.sourceType || "manual",
        record.notes || "",
      ],
    );

    const result = await client.query(
      `
        SELECT ${maintenanceRecordSelectSql}
        FROM maintenance_records
        ${maintenanceRecordJoinSql}
        WHERE maintenance_records.id = $1
      `,
      [insertResult.rows[0].id],
    );

    await client.query("COMMIT");
    return toMaintenanceRecord(result.rows[0]);
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

export async function updateMaintenanceRecord(pool, id, record, { actorUser, reason, allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });

    const existing = await client.query(
      `
        SELECT id::text, cemetery_id::text
        FROM maintenance_records
        WHERE id = $1
          AND deleted_at IS NULL
        FOR UPDATE
      `,
      [id],
    );
    const existingRecord = existing.rows[0];
    if (!existingRecord || (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(existingRecord.cemetery_id))) {
      await client.query("ROLLBACK");
      return undefined;
    }

    await client.query(
      `
        UPDATE maintenance_records
        SET
          issue_type_id = NULLIF($2, '')::uuid,
          action_type_id = NULLIF($3, '')::uuid,
          priority_type_id = $4::uuid,
          status = $5,
          observed_at = $6::date,
          completed_at = NULLIF($7, '')::date,
          performed_by = NULLIF($8, ''),
          source_type = $9,
          notes = NULLIF($10, '')
        WHERE id = $1
      `,
      [
        id,
        record.issueTypeId || "",
        record.actionTypeId || "",
        record.priorityTypeId,
        record.status || "open",
        record.observedAt,
        record.completedAt || "",
        record.performedBy || "",
        record.sourceType || "manual",
        record.notes || "",
      ],
    );

    const result = await client.query(
      `
        SELECT ${maintenanceRecordSelectSql}
        FROM maintenance_records
        ${maintenanceRecordJoinSql}
        WHERE maintenance_records.id = $1
      `,
      [id],
    );

    await client.query("COMMIT");
    return toMaintenanceRecord(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
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
            status_type_id = (
              SELECT id
              FROM gravesite_status_types
              WHERE code = $3
            ),
            cost = $4::numeric
        WHERE id = $1
        RETURNING
          id::text AS uuid,
          cemetery_id::text,
          name,
          gravesite_id,
          status_type_id::text,
          (
            SELECT code
            FROM gravesite_status_types
            WHERE id = gravesites.status_type_id
          ) AS status,
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
    const features = await selectFeaturesForGrave(client, grave.uuid);
    const maintenanceRecords = await selectMaintenanceForGrave(client, grave.uuid);

    await client.query("COMMIT");
    return { ...toDetailedGrave(grave, owners, burials, headstones, northHillsEvidence, mediaAssets, features, maintenanceRecords, true), auditEventId };
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
            ${militaryServiceSetSql}${recordedDateAssignments}
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
            vase_type_id = NULLIF($5, '')::uuid,
            vase_material_type_id = NULLIF($6, '')::uuid,
            vase_placement_type_id = NULLIF($7, '')::uuid,
            vase_notes = $8,
            condition_notes = $9,
            inscription = $10,
            design_notes = $11,
            back_description = $12,
            photo_url = $13,
            last_inspected_at = $14::date
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
          updated_at
      `,
      [
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
