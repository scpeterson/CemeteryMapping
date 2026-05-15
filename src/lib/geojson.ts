import type { AreaGeometry, CemeteryData, GraveSpace } from "../types";

export function gravesFeatureCollection(graves: GraveSpace[], selectedId?: string, searchIds: Set<string> = new Set()) {
  return {
    type: "FeatureCollection",
    features: graves.map((grave) => ({
      type: "Feature",
      properties: {
        id: grave.id,
        status: grave.status,
        label: `${grave.section}-${grave.lot}-${grave.space}`,
        selected: grave.id === selectedId,
        searchMatch: searchIds.has(grave.id),
      },
      geometry: grave.geometry,
    })),
  } satisfies GeoJSON.FeatureCollection<AreaGeometry>;
}

export function sectionsFeatureCollection(data: CemeteryData) {
  return {
    type: "FeatureCollection",
    features: data.sections.map((section) => ({
      type: "Feature",
      properties: {
        id: section.id,
        name: section.name,
      },
      geometry: section.geometry,
    })),
  } satisfies GeoJSON.FeatureCollection<AreaGeometry>;
}
