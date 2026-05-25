import maplibregl, { type Map } from "maplibre-gl";
import type { CemeteryData, GraveSpaceSummary } from "../types";

export const exteriorRing = (geometry: GraveSpaceSummary["geometry"]) => (geometry.type === "Polygon" ? geometry.coordinates[0] : geometry.coordinates[0]?.[0]);

export function extendGeometryBounds(bounds: maplibregl.LngLatBounds | undefined, geometry: GeoJSON.Geometry): maplibregl.LngLatBounds | undefined {
  if (geometry.type === "Polygon") {
    return geometry.coordinates[0].reduce(
      (nextBounds, coordinate) => nextBounds.extend(coordinate as [number, number]),
      bounds ?? new maplibregl.LngLatBounds(geometry.coordinates[0][0] as [number, number], geometry.coordinates[0][0] as [number, number]),
    );
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.reduce((nextBounds, polygon) => {
      const ring = polygon[0];
      if (!ring?.length) return nextBounds;
      return ring.reduce(
        (ringBounds, coordinate) => ringBounds.extend(coordinate as [number, number]),
        nextBounds ?? new maplibregl.LngLatBounds(ring[0] as [number, number], ring[0] as [number, number]),
      );
    }, bounds);
  }

  return bounds;
}

export function dataBounds(data: CemeteryData) {
  const boundaries = data.boundaries ?? (data.boundary ? [data.boundary] : []);
  const boundaryBounds = boundaries.reduce((bounds, boundary) => extendGeometryBounds(bounds, boundary.geometry), undefined as maplibregl.LngLatBounds | undefined);
  if (boundaryBounds) return boundaryBounds;

  const lotBounds = data.lots.reduce((bounds, lot) => extendGeometryBounds(bounds, lot.geometry), undefined as maplibregl.LngLatBounds | undefined);
  if (lotBounds) return lotBounds;

  return data.graves.reduce((bounds, grave) => extendGeometryBounds(bounds, grave.geometry), undefined as maplibregl.LngLatBounds | undefined);
}

export function fitMapToData(map: Map, data: CemeteryData, duration = 350) {
  const bounds = dataBounds(data);
  if (bounds) map.fitBounds(bounds, { padding: 90, maxZoom: 19, duration });
}

export function fitMapToGeometry(map: Map, geometry: GeoJSON.Geometry, duration = 350) {
  const bounds = extendGeometryBounds(undefined, geometry);
  if (bounds) map.fitBounds(bounds, { padding: 110, maxZoom: 19, duration });
}
