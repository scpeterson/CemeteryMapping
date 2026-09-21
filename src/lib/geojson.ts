import type { AreaGeometry, CemeteryData, GraveSpaceSummary, HeadstoneSummary } from "../types";
import { formatGraveLabel, graveSelectionKey, lotSelectionKey } from "./format";

export function gravesFeatureCollection(graves: GraveSpaceSummary[]) {
  return {
    type: "FeatureCollection",
    features: graves.map((grave) => {
      const key = graveSelectionKey(grave);

      return {
        type: "Feature",
        id: key,
        properties: {
          key,
          id: grave.id,
          cemeteryId: grave.cemeteryId,
          status: grave.status,
          hasVeteran: grave.hasVeteran ?? false,
          geometryType: grave.geometryType ?? "operational",
          geometryConfidence: grave.geometryConfidence ?? "estimated",
          label: formatGraveLabel(grave),
        },
        geometry: grave.geometry,
      };
    }),
  } satisfies GeoJSON.FeatureCollection<AreaGeometry>;
}

export function headstonesFeatureCollection(
  headstones: HeadstoneSummary[],
  veteranGraveKeys: Set<string> = new Set(),
) {
  return {
    type: "FeatureCollection",
    features: headstones.map((headstone) => ({
      type: "Feature",
      id: headstone.id,
      properties: {
        id: headstone.id,
        headstoneId: headstone.headstoneId,
        cemeteryId: headstone.cemeteryId,
        gravesiteId: headstone.gravesiteId,
        graveKey: headstone.graveKey,
        label: headstone.label,
        markerTypeCode: headstone.markerTypeCode,
        markerType: headstone.markerType,
        markerScopeCode: headstone.markerScopeCode,
        markerScope: headstone.markerScope,
        condition: headstone.condition,
        hasVeteran: veteranGraveKeys.has(headstone.graveKey),
      },
      geometry: headstone.geometry,
    })),
  } satisfies GeoJSON.FeatureCollection<GeoJSON.Point>;
}

export function sectionsFeatureCollection(data: Pick<CemeteryData, "sections">) {
  return {
    type: "FeatureCollection",
    features: data.sections.map((section) => ({
      type: "Feature",
      properties: {
        id: section.id,
        name: section.name,
        alternateNames: section.alternateNames,
      },
      geometry: section.geometry,
    })),
  } satisfies GeoJSON.FeatureCollection<AreaGeometry>;
}

export function lotsFeatureCollection(data: Pick<CemeteryData, "lots">) {
  return {
    type: "FeatureCollection",
    features: data.lots.map((lot) => {
      const key = lotSelectionKey(lot);

      return {
        type: "Feature",
        id: key,
        properties: {
          key,
          id: lot.id,
          cemeteryId: lot.cemeteryId,
          name: lot.name,
          section: lot.section,
          block: lot.block,
          burialUseStatus: lot.burialUseStatus ?? "standard",
          geometryType: lot.geometryType ?? "operational",
          geometryConfidence: lot.geometryConfidence ?? "estimated",
        },
        geometry: lot.geometry,
      };
    }),
  } satisfies GeoJSON.FeatureCollection<AreaGeometry>;
}

export function lotRestrictedAreasFeatureCollection(data: Pick<CemeteryData, "lotRestrictedAreas">) {
  return {
    type: "FeatureCollection",
    features: (data.lotRestrictedAreas ?? []).map((area) => ({
      type: "Feature",
      properties: {
        id: area.id,
        lotId: area.lotId,
        cemeteryId: area.cemeteryId,
        lotName: area.lotName,
        restrictionType: area.restrictionType,
        name: area.name,
        notes: area.notes,
      },
      geometry: area.geometry,
    })),
  } satisfies GeoJSON.FeatureCollection<AreaGeometry>;
}

export function boundariesFeatureCollection(data: Pick<CemeteryData, "boundary" | "boundaries">) {
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

export function cemeteryMarkersFeatureCollection(data: Pick<CemeteryData, "boundary" | "boundaries">) {
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
