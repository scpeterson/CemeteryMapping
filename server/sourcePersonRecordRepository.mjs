import { withAuditContext } from "./auditContext.mjs";

const validSourceCodes = new Set(["CR", "CRG", "FH", "SK", "NOTE", "OTHER"]);
const validRecordTypes = new Set(["death_record", "burial_record", "funeral_record", "church_record", "family_history", "other"]);
const validStatuses = new Set(["unmatched", "candidate_match", "linked", "rejected"]);
const validConfidences = new Set(["high", "medium", "low", "review"]);

function compact(value) {
  const text = String(value ?? "").trim();
  return text || "";
}

function normalizeLimit(value) {
  const limit = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(limit)) return 50;
  return Math.min(Math.max(limit, 10), 250);
}

function normalizeInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const integer = Number.parseInt(String(value), 10);
  return Number.isFinite(integer) ? integer : null;
}

function normalizeDate(value) {
  const text = compact(value);
  return /^\d{4}-\d{2}-\d{2}$/u.test(text) ? text : null;
}

function normalizeSourcePersonRecordInput(input = {}) {
  const sourceCode = compact(input.sourceCode).toUpperCase() || "OTHER";
  const recordType = compact(input.recordType) || "death_record";
  const status = compact(input.status) || "unmatched";
  const confidence = compact(input.confidence) || "review";
  if (!validSourceCodes.has(sourceCode)) throw new Error(`Unsupported source code: ${sourceCode}`);
  if (!validRecordTypes.has(recordType)) throw new Error(`Unsupported source record type: ${recordType}`);
  if (!validStatuses.has(status)) throw new Error(`Unsupported source record status: ${status}`);
  if (!validConfidences.has(confidence)) throw new Error(`Unsupported source record confidence: ${confidence}`);

  return {
    cemeteryId: compact(input.cemeteryId),
    northHillsOcrEntryId: compact(input.northHillsOcrEntryId) || null,
    northHillsOcrSourceFactId: compact(input.northHillsOcrSourceFactId) || null,
    sourceName: compact(input.sourceName) || "North Hills Genealogists Trinity OCR",
    sourceCode,
    sourceLabel: compact(input.sourceLabel),
    sourcePageNumber: normalizeInteger(input.sourcePageNumber),
    sourceLocationText: compact(input.sourceLocationText),
    recordType,
    status,
    confidence,
    firstName: compact(input.firstName),
    middleName: compact(input.middleName),
    lastName: compact(input.lastName),
    maidenName: compact(input.maidenName),
    fullName: compact(input.fullName),
    birthDate: normalizeDate(input.birthDate),
    birthDateText: compact(input.birthDateText),
    deathDate: normalizeDate(input.deathDate),
    deathDateText: compact(input.deathDateText),
    burialDate: normalizeDate(input.burialDate),
    burialDateText: compact(input.burialDateText),
    funeralDate: normalizeDate(input.funeralDate),
    funeralDateText: compact(input.funeralDateText),
    ageText: compact(input.ageText),
    rawText: compact(input.rawText),
    notes: compact(input.notes),
  };
}

function scopedCemeteryValues(allowedCemeteryIds) {
  if (!Array.isArray(allowedCemeteryIds)) return null;
  return [...new Set(allowedCemeteryIds.map((id) => compact(id)).filter(Boolean))];
}

function toRecord(row) {
  return {
    id: row.id,
    cemeteryId: row.cemetery_id ?? "",
    cemeteryName: row.cemetery_name ?? "",
    northHillsOcrEntryId: row.north_hills_ocr_entry_id ?? "",
    northHillsOcrSourceFactId: row.north_hills_ocr_source_fact_id ?? "",
    sourceName: row.source_name ?? "",
    sourceCode: row.source_code ?? "",
    sourceLabel: row.source_label ?? "",
    sourcePageNumber: row.source_page_number,
    sourceLocationText: row.source_location_text ?? "",
    recordType: row.record_type,
    status: row.status,
    confidence: row.confidence,
    firstName: row.first_name ?? "",
    middleName: row.middle_name ?? "",
    lastName: row.last_name ?? "",
    maidenName: row.maiden_name ?? "",
    fullName: row.full_name ?? "",
    birthDate: row.birth_date ?? "",
    birthDateText: row.birth_date_text ?? "",
    deathDate: row.death_date ?? "",
    deathDateText: row.death_date_text ?? "",
    burialDate: row.burial_date ?? "",
    burialDateText: row.burial_date_text ?? "",
    funeralDate: row.funeral_date ?? "",
    funeralDateText: row.funeral_date_text ?? "",
    ageText: row.age_text ?? "",
    rawText: row.raw_text ?? "",
    notes: row.notes ?? "",
    reviewedByEmail: row.reviewed_by_email ?? "",
    reviewedAt: row.reviewed_at ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? "",
    links: row.links ?? [],
  };
}

async function selectSourcePersonRecordById(client, id) {
  const result = await client.query(
    `
      SELECT
        record.id::text,
        record.cemetery_id::text,
        cemeteries.name AS cemetery_name,
        record.north_hills_ocr_entry_id::text,
        record.north_hills_ocr_source_fact_id::text,
        record.source_name,
        record.source_code,
        record.source_label,
        record.source_page_number,
        record.source_location_text,
        record.record_type,
        record.status,
        record.confidence,
        record.first_name,
        record.middle_name,
        record.last_name,
        record.maiden_name,
        record.full_name,
        record.birth_date::text,
        record.birth_date_text,
        record.death_date::text,
        record.death_date_text,
        record.burial_date::text,
        record.burial_date_text,
        record.funeral_date::text,
        record.funeral_date_text,
        record.age_text,
        record.raw_text,
        record.notes,
        record.reviewed_by_email,
        record.reviewed_at,
        record.created_at,
        record.updated_at,
        record.deleted_at,
        COALESCE(links.links, '[]'::jsonb) AS links
      FROM source_person_records record
      LEFT JOIN cemeteries ON cemeteries.id = record.cemetery_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', link.id::text,
            'linkType', link.link_type,
            'confidence', link.confidence,
            'targetType', CASE
              WHEN link.burial_uuid IS NOT NULL THEN 'burial'
              WHEN link.gravesite_uuid IS NOT NULL THEN 'gravesite'
              ELSE 'headstone'
            END,
            'targetId', COALESCE(link.burial_uuid::text, link.gravesite_uuid::text, link.headstone_uuid::text),
            'targetLabel', COALESCE(burials.full_name, gravesites.gravesite_id, headstones.headstone_id),
            'notes', link.notes
          )
          ORDER BY link.created_at, link.id
        ) AS links
        FROM source_person_record_links link
        LEFT JOIN burials ON burials.id = link.burial_uuid
        LEFT JOIN gravesites ON gravesites.id = link.gravesite_uuid
        LEFT JOIN headstones ON headstones.id = link.headstone_uuid
        WHERE link.source_person_record_id = record.id
          AND link.deleted_at IS NULL
      ) links ON true
      WHERE record.id = $1
    `,
    [id],
  );
  return result.rows[0] ? toRecord(result.rows[0]) : undefined;
}

export async function listSourcePersonRecords(pool, filters = {}, { allowedCemeteryIds } = {}) {
  const cemeteryIds = scopedCemeteryValues(allowedCemeteryIds);
  const conditions = ["record.deleted_at IS NULL"];
  const values = [];
  const q = compact(filters.q).toLowerCase();
  const status = compact(filters.status);
  const sourceCode = compact(filters.sourceCode).toUpperCase();
  const cemeteryId = compact(filters.cemeteryId);

  if (cemeteryIds) {
    values.push(cemeteryIds);
    conditions.push(`record.cemetery_id = ANY($${values.length}::uuid[])`);
  } else if (cemeteryId) {
    values.push(cemeteryId);
    conditions.push(`record.cemetery_id = $${values.length}::uuid`);
  }

  if (status && validStatuses.has(status)) {
    values.push(status);
    conditions.push(`record.status = $${values.length}`);
  }

  if (sourceCode && validSourceCodes.has(sourceCode)) {
    values.push(sourceCode);
    conditions.push(`record.source_code = $${values.length}`);
  }

  if (q) {
    values.push(`%${q}%`);
    conditions.push(`(
      lower(record.full_name) LIKE $${values.length}
      OR lower(coalesce(record.raw_text, '')) LIKE $${values.length}
      OR lower(coalesce(record.notes, '')) LIKE $${values.length}
      OR lower(coalesce(record.source_location_text, '')) LIKE $${values.length}
      OR record.source_page_number::text LIKE $${values.length}
    )`);
  }

  values.push(normalizeLimit(filters.limit));
  const result = await pool.query(
    `
      SELECT
        record.id::text,
        record.cemetery_id::text,
        cemeteries.name AS cemetery_name,
        record.north_hills_ocr_entry_id::text,
        record.north_hills_ocr_source_fact_id::text,
        record.source_name,
        record.source_code,
        record.source_label,
        record.source_page_number,
        record.source_location_text,
        record.record_type,
        record.status,
        record.confidence,
        record.first_name,
        record.middle_name,
        record.last_name,
        record.maiden_name,
        record.full_name,
        record.birth_date::text,
        record.birth_date_text,
        record.death_date::text,
        record.death_date_text,
        record.burial_date::text,
        record.burial_date_text,
        record.funeral_date::text,
        record.funeral_date_text,
        record.age_text,
        record.raw_text,
        record.notes,
        record.reviewed_by_email,
        record.reviewed_at,
        record.created_at,
        record.updated_at,
        record.deleted_at,
        '[]'::jsonb AS links
      FROM source_person_records record
      LEFT JOIN cemeteries ON cemeteries.id = record.cemetery_id
      WHERE ${conditions.join("\n        AND ")}
      ORDER BY record.source_page_number NULLS LAST, lower(record.full_name), record.created_at DESC
      LIMIT $${values.length}
    `,
    values,
  );

  const cemeteryResult = await pool.query(
    `
      SELECT id::text, name
      FROM cemeteries
      WHERE deleted_at IS NULL
        AND ($1::uuid[] IS NULL OR id = ANY($1::uuid[]))
      ORDER BY name, id
    `,
    [cemeteryIds],
  );

  return {
    cemeteries: cemeteryResult.rows.map((row) => ({ id: row.id, name: row.name })),
    records: result.rows.map(toRecord),
  };
}

export async function createSourcePersonRecord(pool, input, audit = {}) {
  const record = normalizeSourcePersonRecordInput(input);
  return withAuditContext(pool, audit, async (client) => {
    const result = await client.query(
      `
        INSERT INTO source_person_records (
          cemetery_id,
          north_hills_ocr_entry_id,
          north_hills_ocr_source_fact_id,
          source_name,
          source_code,
          source_label,
          source_page_number,
          source_location_text,
          record_type,
          status,
          confidence,
          first_name,
          middle_name,
          last_name,
          maiden_name,
          full_name,
          birth_date,
          birth_date_text,
          death_date,
          death_date_text,
          burial_date,
          burial_date_text,
          funeral_date,
          funeral_date_text,
          age_text,
          raw_text,
          notes,
          reviewed_by_app_user_id,
          reviewed_by_external_subject,
          reviewed_by_email,
          reviewed_at
        )
        VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17::date, $18, $19::date, $20, $21::date, $22, $23::date, $24, $25, $26, $27,
          $28::uuid, $29, $30, now()
        )
        RETURNING id::text
      `,
      [
        record.cemeteryId,
        record.northHillsOcrEntryId,
        record.northHillsOcrSourceFactId,
        record.sourceName,
        record.sourceCode,
        record.sourceLabel,
        record.sourcePageNumber,
        record.sourceLocationText,
        record.recordType,
        record.status,
        record.confidence,
        record.firstName,
        record.middleName,
        record.lastName,
        record.maidenName,
        record.fullName,
        record.birthDate,
        record.birthDateText,
        record.deathDate,
        record.deathDateText,
        record.burialDate,
        record.burialDateText,
        record.funeralDate,
        record.funeralDateText,
        record.ageText,
        record.rawText,
        record.notes,
        audit.actorUser?.id ?? null,
        audit.actorUser?.subject ?? null,
        audit.actorUser?.email ?? null,
      ],
    );
    return selectSourcePersonRecordById(client, result.rows[0].id);
  });
}

export async function updateSourcePersonRecord(pool, id, input, audit = {}) {
  const record = normalizeSourcePersonRecordInput(input);
  const cemeteryIds = scopedCemeteryValues(audit.allowedCemeteryIds);
  return withAuditContext(pool, audit, async (client) => {
    const result = await client.query(
      `
        UPDATE source_person_records
        SET cemetery_id = $2::uuid,
            north_hills_ocr_entry_id = $3::uuid,
            north_hills_ocr_source_fact_id = $4::uuid,
            source_name = $5,
            source_code = $6,
            source_label = $7,
            source_page_number = $8,
            source_location_text = $9,
            record_type = $10,
            status = $11,
            confidence = $12,
            first_name = $13,
            middle_name = $14,
            last_name = $15,
            maiden_name = $16,
            full_name = $17,
            birth_date = $18::date,
            birth_date_text = $19,
            death_date = $20::date,
            death_date_text = $21,
            burial_date = $22::date,
            burial_date_text = $23,
            funeral_date = $24::date,
            funeral_date_text = $25,
            age_text = $26,
            raw_text = $27,
            notes = $28,
            reviewed_by_app_user_id = $29::uuid,
            reviewed_by_external_subject = $30,
            reviewed_by_email = $31,
            reviewed_at = now()
        WHERE id = $1
          AND deleted_at IS NULL
          AND ($32::uuid[] IS NULL OR cemetery_id = ANY($32::uuid[]))
        RETURNING id::text
      `,
      [
        id,
        record.cemeteryId,
        record.northHillsOcrEntryId,
        record.northHillsOcrSourceFactId,
        record.sourceName,
        record.sourceCode,
        record.sourceLabel,
        record.sourcePageNumber,
        record.sourceLocationText,
        record.recordType,
        record.status,
        record.confidence,
        record.firstName,
        record.middleName,
        record.lastName,
        record.maidenName,
        record.fullName,
        record.birthDate,
        record.birthDateText,
        record.deathDate,
        record.deathDateText,
        record.burialDate,
        record.burialDateText,
        record.funeralDate,
        record.funeralDateText,
        record.ageText,
        record.rawText,
        record.notes,
        audit.actorUser?.id ?? null,
        audit.actorUser?.subject ?? null,
        audit.actorUser?.email ?? null,
        cemeteryIds,
      ],
    );
    return result.rows[0] ? selectSourcePersonRecordById(client, result.rows[0].id) : undefined;
  });
}

export async function softDeleteSourcePersonRecord(pool, id, { actorUser, reason, allowedCemeteryIds } = {}) {
  const cemeteryIds = scopedCemeteryValues(allowedCemeteryIds);
  return withAuditContext(pool, { actorUser, reason }, async (client) => {
    const existingResult = await client.query(
      `
        SELECT id::text, cemetery_id::text, deleted_at
        FROM source_person_records
        WHERE id = $1
          AND ($2::uuid[] IS NULL OR cemetery_id = ANY($2::uuid[]))
      `,
      [id, cemeteryIds],
    );
    const existing = existingResult.rows[0];
    if (!existing) return undefined;
    if (existing.deleted_at) {
      return { id: existing.id, cemeteryId: existing.cemetery_id, deletedAt: existing.deleted_at, alreadyDeleted: true };
    }

    await client.query(
      `
        UPDATE source_person_record_links
        SET deleted_at = now(),
            deleted_by = $2::uuid,
            delete_reason = $3
        WHERE source_person_record_id = $1
          AND deleted_at IS NULL
      `,
      [id, actorUser?.id ?? null, reason ?? null],
    );
    const result = await client.query(
      `
        UPDATE source_person_records
        SET deleted_at = now(),
            deleted_by = $2::uuid,
            delete_reason = $3
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING id::text, cemetery_id::text, deleted_at
      `,
      [id, actorUser?.id ?? null, reason ?? null],
    );
    const deleted = result.rows[0];
    return deleted ? { id: deleted.id, cemeteryId: deleted.cemetery_id, deletedAt: deleted.deleted_at, alreadyDeleted: false } : undefined;
  });
}
