import * as maplibregl from "../lib/maplibre";
import type { Map as MapLibreMap } from "maplibre-gl";

export type MeasurementPoint = [number, number];

export function measurementFeatureCollection(points: MeasurementPoint[]): GeoJSON.FeatureCollection {
  const lineFeature: GeoJSON.Feature<GeoJSON.LineString> | undefined =
    points.length > 1
      ? {
          type: "Feature",
          properties: { kind: "line" },
          geometry: {
            type: "LineString",
            coordinates: points,
          },
        }
      : undefined;
  const pointFeatures = points.map(
    (point, index): GeoJSON.Feature<GeoJSON.Point> => ({
      type: "Feature",
      properties: { kind: "point", label: `${index + 1}` },
      geometry: {
        type: "Point",
        coordinates: point,
      },
    }),
  );

  return {
    type: "FeatureCollection",
    features: lineFeature ? [lineFeature, ...pointFeatures] : pointFeatures,
  };
}

export function totalMeasurementDistanceFeet(points: MeasurementPoint[]) {
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    return total + new maplibregl.LngLat(...previous).distanceTo(new maplibregl.LngLat(...point)) * 3.28084;
  }, 0);
}

export function formatMeasurementDistance(feet: number) {
  if (feet >= 5280) return `${(feet / 5280).toFixed(2)} mi`;
  if (feet >= 100) return `${Math.round(feet).toLocaleString()} ft`;
  return `${feet.toFixed(1)} ft`;
}

export function addMeasurementLayers(map: MapLibreMap) {
  map.addSource("measurement", {
    type: "geojson",
    data: measurementFeatureCollection([]),
  });
  map.addLayer({
    id: "measurement-line",
    type: "line",
    source: "measurement",
    filter: ["==", ["get", "kind"], "line"],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#b6423b",
      "line-width": 3,
      "line-dasharray": [1.2, 1],
    },
  });
  map.addLayer({
    id: "measurement-points",
    type: "circle",
    source: "measurement",
    filter: ["==", ["get", "kind"], "point"],
    paint: {
      "circle-color": "#fbfcf7",
      "circle-radius": 6,
      "circle-stroke-color": "#b6423b",
      "circle-stroke-width": 3,
    },
  });
}
