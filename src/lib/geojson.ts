import type { AreaGeometry, CemeteryData, GraveSpaceSummary } from "../types";

export function gravesFeatureCollection(graves: GraveSpaceSummary[], selectedId?: string, searchIds: Set<string> = new Set()) {
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

export function boundariesFeatureCollection(data: CemeteryData) {
  const boundaries = data.boundaries ?? (data.boundary ? [data.boundary] : []);

  return {
    type: "FeatureCollection",
    features: boundaries,
  } satisfies GeoJSON.FeatureCollection<AreaGeometry, { name: string }>;
}

function visitCoordinates(geometry: AreaGeometry, visit: (coordinate: [number, number]) => void) {
  if (geometry.type === "Polygon") {
    geometry.coordinates[0].forEach((coordinate) => visit(coordinate as [number, number]));
    return;
  }

  geometry.coordinates.forEach((polygon) => {
    polygon[0]?.forEach((coordinate) => visit(coordinate as [number, number]));
  });
}

export function cemeteryMarkersFeatureCollection(data: CemeteryData) {
  const boundaries = data.boundaries ?? (data.boundary ? [data.boundary] : []);

  return {
    type: "FeatureCollection",
    features: boundaries.flatMap((boundary, index) => {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      visitCoordinates(boundary.geometry, ([x, y]) => {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });

      if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return [];

      return [
        {
          type: "Feature",
          properties: {
            index,
            name: boundary.properties.name,
          },
          geometry: {
            type: "Point",
            coordinates: [(minX + maxX) / 2, (minY + maxY) / 2],
          },
        },
      ];
    }),
  } satisfies GeoJSON.FeatureCollection<GeoJSON.Point, { index: number; name: string }>;
}
