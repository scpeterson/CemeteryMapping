export function parseGeometry(value) {
  if (!value) return undefined;
  return typeof value === "string" ? JSON.parse(value) : value;
}

export function dateOnly(value) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export function compactJoin(values, separator = " | ") {
  return values.filter(Boolean).join(separator) || undefined;
}

function recordedDate(value, fallbackDate) {
  return value || dateOnly(fallbackDate);
}

function ownerDisplayName(owner) {
  return owner.display_name ?? compactJoin([owner.owner, owner.co_owner], " and ") ?? "Unknown owner";
}

export function toOwner(owner) {
  return {
    id: owner.id,
    displayName: ownerDisplayName(owner),
    contactNote: compactJoin([owner.phone, owner.email, owner.full_address, owner.document_reference, owner.notes]),
  };
}

export function toBurial(burial) {
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

export function toOwnershipEvent(owner) {
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

export function toLookupValue(row, prefix) {
  return {
    id: row[`${prefix}_id`],
    code: row[`${prefix}_code`],
    label: row[`${prefix}_label`],
  };
}

export function toGraveFeature(row) {
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

export function toMaintenanceRecord(row) {
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

export function toHeadstoneRelationship(row) {
  return {
    id: row.id,
    fromHeadstoneUuid: row.from_headstone_uuid,
    fromHeadstoneId: row.from_headstone_id,
    toHeadstoneUuid: row.to_headstone_uuid,
    toHeadstoneId: row.to_headstone_id,
    relatedHeadstoneUuid: row.related_headstone_uuid,
    relatedHeadstoneId: row.related_headstone_id,
    relationshipType: row.relationship_type,
    sourceType: row.source_type ?? "manual",
    sourceText: row.source_text ?? "",
    confidence: row.confidence ?? "review",
    notes: row.notes ?? "",
    status: row.status ?? "active",
    direction: row.direction ?? "outgoing",
  };
}

export function toHeadstone(row) {
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
    relationships: (row.relationships ?? []).map(toHeadstoneRelationship),
    mediaAssets: row.media_assets ?? [],
  };
}

export function toMediaAsset(row) {
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

export function toNorthHillsEvidence(row) {
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
