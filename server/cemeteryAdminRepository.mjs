function normalizeTextArray(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function toCemeteryRecord(row) {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes ?? "",
  };
}

function toSectionRecord(row) {
  return {
    id: row.id,
    cemeteryId: row.cemetery_id,
    sectionId: row.name,
    name: row.name ?? "",
    alternateNames: row.alternate_names ?? [],
  };
}

function toLotRecord(row) {
  return {
    id: row.id,
    cemeteryId: row.cemetery_id,
    sectionId: row.section_id ?? "",
    lotId: row.lot_id,
    name: row.name ?? "",
  };
}

async function hasSectionAlternateNamesColumn(clientOrPool) {
  const result = await clientOrPool.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'sections'
        AND column_name = 'alternate_names'
    ) AS exists
  `);

  return result.rows[0]?.exists === true;
}

export async function listCemeteryAdminRecords(pool) {
  const client = await pool.connect();
  try {
    const cemeteriesResult = await client.query(`
      SELECT id::text, name, notes
      FROM cemeteries
      WHERE deleted_at IS NULL
      ORDER BY name, id
    `);

    const cemeteryIds = cemeteriesResult.rows.map((cemetery) => cemetery.id);
    if (cemeteryIds.length === 0) return { cemeteries: [], sections: [], lots: [] };

    const alternateNamesSelect = (await hasSectionAlternateNamesColumn(client)) ? "alternate_names" : "'{}'::text[] AS alternate_names";
    const sectionsResult = await client.query(
      `
        SELECT section_id::text AS id, cemetery_id::text, name, ${alternateNamesSelect}
        FROM sections
        WHERE cemetery_id = ANY($1::uuid[])
          AND deleted_at IS NULL
        ORDER BY name, section_id
      `,
      [cemeteryIds],
    );

    const lotsResult = await client.query(
      `
        SELECT id::text, cemetery_id::text, section_id, lot_id, name
        FROM lots
        WHERE cemetery_id = ANY($1::uuid[])
          AND deleted_at IS NULL
        ORDER BY section_id, lot_id, name, id
      `,
      [cemeteryIds],
    );

    return {
      cemeteries: cemeteriesResult.rows.map(toCemeteryRecord),
      sections: sectionsResult.rows.map(toSectionRecord),
      lots: lotsResult.rows.map(toLotRecord),
    };
  } finally {
    client.release();
  }
}

export async function updateCemeteryText(pool, id, { name, notes }) {
  const result = await pool.query(
    `
      UPDATE cemeteries
      SET name = $2,
          notes = NULLIF($3, ''),
          updated_at = now()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING id::text, name, notes
    `,
    [id, name, notes],
  );

  return result.rows[0] ? toCemeteryRecord(result.rows[0]) : undefined;
}

export async function updateSectionText(pool, id, { name, alternateNames }) {
  if (!(await hasSectionAlternateNamesColumn(pool))) {
    throw new Error("Section alternate names require database migration 012-section-alternate-names. Run npm run db:migrate before saving section aliases.");
  }

  const result = await pool.query(
    `
      UPDATE sections
      SET name = NULLIF($2, ''),
          alternate_names = $3::text[],
          updated_at = now()
      WHERE section_id = $1
        AND deleted_at IS NULL
      RETURNING section_id::text AS id, cemetery_id::text, name, alternate_names
    `,
    [id, name, normalizeTextArray(alternateNames)],
  );

  return result.rows[0] ? toSectionRecord(result.rows[0]) : undefined;
}

export async function updateLotText(pool, id, { name }) {
  const result = await pool.query(
    `
      UPDATE lots
      SET name = NULLIF($2, ''),
          updated_at = now()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING id::text, cemetery_id::text, section_id, lot_id, name
    `,
    [id, name],
  );

  return result.rows[0] ? toLotRecord(result.rows[0]) : undefined;
}
