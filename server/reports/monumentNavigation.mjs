// Selection metadata lets reports open monuments that are absent from loaded map data.
export function reportMonumentRecord(row) {
  return {
    id: row.uuid ?? row.marker_uuid,
    headstoneId: row.monument,
    cemeteryId: row.cemetery_id,
    cemeteryName: row.cemetery,
    gravesiteId: row.gravesite_id ?? null,
    graveKey: row.gravesite_id ? `${row.cemetery_id}:${row.gravesite_id}` : `${row.cemetery_id}:headstone:${row.monument}`,
    label: row.monument,
    markerTypeCode: "unknown", markerType: row.marker_type ?? "Unknown",
    markerScopeCode: "unknown", markerScope: row.marker_scope ?? "Unknown", condition: "unknown",
    geometry: row.geometry ?? null,
  };
}
