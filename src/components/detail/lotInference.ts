import type { AreaGeometry, CemeteryLot, GraveSpace, HeadstoneSummary } from "../../types";

export function pointInRing([x, y]: GeoJSON.Position, ring: GeoJSON.Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInArea(point: GeoJSON.Position, geometry: AreaGeometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((polygon) => pointInRing(point, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(point, hole)));
}

export function areaCenter(geometry: AreaGeometry): GeoJSON.Position | undefined {
  const ring = geometry.type === "Polygon" ? geometry.coordinates[0] : geometry.coordinates[0]?.[0];
  if (!ring?.length) return undefined;
  const points = ring.slice(0, -1);
  return [points.reduce((sum, point) => sum + point[0], 0) / points.length, points.reduce((sum, point) => sum + point[1], 0) / points.length];
}

export function inferredLotForGrave(grave: GraveSpace, lots: CemeteryLot[], headstones: HeadstoneSummary[]) {
  if (grave.lot) return undefined;
  const markerPoints = headstones.filter((marker) => marker.gravesiteId === grave.id).map((marker) => marker.geometry.coordinates);
  const markerMatches = lots.filter((lot) => markerPoints.some((point) => pointInArea(point, lot.geometry)));
  if (markerMatches.length === 1) return { lot: markerMatches[0], source: "marker location", confidence: "high" as const };
  const center = areaCenter(grave.geometry);
  const graveMatches = center ? lots.filter((lot) => pointInArea(center, lot.geometry)) : [];
  if (graveMatches.length === 1) return { lot: graveMatches[0], source: "gravesite center", confidence: "review" as const };
  return undefined;
}

