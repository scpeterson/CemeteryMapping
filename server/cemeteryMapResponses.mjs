import { selectBurialsForCemeteries } from "./cemeteryBurialQueries.mjs";
import { toDetailedGrave, toGraveSummary } from "./cemeteryGraveQueries.mjs";
import {
  selectActiveCemeteries,
  selectGravesForCemeteries,
  selectHeadstoneSummariesForCemeteries,
  selectLotRestrictedAreasForCemeteries,
  selectLotsForCemeteries,
  selectSectionsForCemeteries,
} from "./cemeteryMapQueries.mjs";
import { parseGeometry, toOwner } from "./cemeteryMappers.mjs";
import { selectOwnersForCemeteries } from "./cemeteryOwnershipQueries.mjs";

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
