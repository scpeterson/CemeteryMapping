const statusMap = new Map([
  ["available", "available"],
  ["reserved", "reserved"],
  ["occupied", "occupied"],
  ["sold", "sold"],
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
  return compactJoin([owner.owner, owner.co_owner], " and ") ?? "Unknown owner";
}

function toOwner(owner) {
  return {
    id: owner.id,
    displayName: ownerDisplayName(owner),
    contactNote: compactJoin([owner.phone, owner.email, owner.full_address, owner.notes]),
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
    notes: compactJoin([burial.funeral_home ? `Funeral home: ${burial.funeral_home}` : undefined, burial.notes]),
  };
}

function toOwnershipEvent(owner) {
  return {
    id: `owner-${owner.id}`,
    ownerIds: [owner.id],
    eventType: "purchase",
    effectiveDate: dateOnly(owner.sale_date ?? owner.created_at) ?? "1900-01-01",
    recordedBy: "Cemetery database",
    notes: owner.notes,
  };
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

export async function getCemeteryData(pool) {
  const client = await pool.connect();
  try {
    const cemeteryResult = await client.query(`
      SELECT id::text, name, ST_AsGeoJSON(geometry)::json AS geometry
      FROM cemeteries
      ORDER BY name, id
      LIMIT 1
    `);

    const cemetery = cemeteryResult.rows[0];
    if (!cemetery) return { sections: [], graves: [], owners: [] };

    const [sectionsResult, gravesitesResult, ownersResult, burialsResult] = await Promise.all([
      client.query(
        `
          SELECT id::text, section_id, COALESCE(name, section_id) AS name, ST_AsGeoJSON(geometry)::json AS geometry
          FROM sections
          WHERE cemetery_id = $1
          ORDER BY section_id, name
        `,
        [cemetery.id],
      ),
      client.query(
        `
          SELECT id::text AS uuid, section_id, lot_id, grave_id, gravesite_id, status, cost, ST_AsGeoJSON(geometry)::json AS geometry
          FROM gravesites
          WHERE cemetery_id = $1
          ORDER BY section_id, lot_id, grave_id, gravesite_id
        `,
        [cemetery.id],
      ),
      client.query(
        `
          SELECT id::text, gravesite_uuid::text, owner, co_owner, full_address, phone, email, sale_date, notes, created_at
          FROM owners
          WHERE gravesite_uuid IN (SELECT id FROM gravesites WHERE cemetery_id = $1)
          ORDER BY sale_date DESC NULLS LAST, created_at DESC, id
        `,
        [cemetery.id],
      ),
      client.query(
        `
          SELECT id::text, gravesite_uuid::text, first_name, last_name, full_name, birth_date, death_date, burial_date, funeral_home, notes
          FROM burials
          WHERE gravesite_uuid IN (SELECT id FROM gravesites WHERE cemetery_id = $1)
          ORDER BY burial_date DESC NULLS LAST, death_date DESC NULLS LAST, last_name, first_name
        `,
        [cemetery.id],
      ),
    ]);

    const ownersByGrave = groupBy(ownersResult.rows, "gravesite_uuid");
    const burialsByGrave = groupBy(burialsResult.rows, "gravesite_uuid");

    return {
      boundary: {
        type: "Feature",
        properties: { name: cemetery.name },
        geometry: parseGeometry(cemetery.geometry),
      },
      sections: sectionsResult.rows.map((section) => ({
        id: section.section_id,
        name: section.name,
        geometry: parseGeometry(section.geometry),
      })),
      graves: gravesitesResult.rows.map((grave) => {
        const graveOwners = ownersByGrave.get(grave.uuid) ?? [];

        return {
          id: grave.gravesite_id,
          section: grave.section_id ?? "",
          lot: grave.lot_id ?? "",
          space: grave.grave_id,
          status: normalizeStatus(grave.status),
          geometry: parseGeometry(grave.geometry),
          currentOwnerIds: graveOwners.map((owner) => owner.id),
          burials: (burialsByGrave.get(grave.uuid) ?? []).map(toBurial),
          ownershipHistory: graveOwners.map(toOwnershipEvent),
          notes: grave.cost ? `Recorded cost: $${grave.cost}` : undefined,
        };
      }),
      owners: ownersResult.rows.map(toOwner),
    };
  } finally {
    client.release();
  }
}

export async function getGraveSpace(pool, gravesiteId) {
  const data = await getCemeteryData(pool);
  return data.graves.find((grave) => grave.id === gravesiteId);
}
