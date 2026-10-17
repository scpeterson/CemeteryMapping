import type { Map as MapLibreMap } from "maplibre-gl";

type Highlight = "selected" | "searchMatch";

// Stable GeoJSON feature IDs let paint changes avoid source serialization.
export function createMapHighlightState() {
  const previous = new Map<string, Set<string>>();
  return (map: Pick<MapLibreMap, "getSource" | "setFeatureState">, source: string, field: Highlight, ids: Set<string>) => {
    if (!map.getSource(source)) return;
    const key = `${source}:${field}`;
    const old = previous.get(key) ?? new Set<string>();
    for (const id of old) {
      if (!ids.has(id)) map.setFeatureState({ source, id }, { [field]: false });
    }
    for (const id of ids) {
      if (!old.has(id)) map.setFeatureState({ source, id }, { [field]: true });
    }
    previous.set(key, new Set(ids));
  };
}

export function markerIdsByGrave(markers: Array<{ id: string; graveKey: string }>) {
  const index = new Map<string, string[]>();
  for (const marker of markers) {
    const ids = index.get(marker.graveKey);
    if (ids) ids.push(marker.id);
    else index.set(marker.graveKey, [marker.id]);
  }
  return index;
}

export function linkedMarkerIds(index: Map<string, string[]>, graves: Iterable<string>) {
  const ids = new Set<string>();
  for (const grave of graves) for (const id of index.get(grave) ?? []) ids.add(id);
  return ids;
}
