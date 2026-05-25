import type { Map } from "maplibre-gl";

const earthCircumferenceMeters = 40_075_016.686;
const cssPixelsPerInch = 96;
const metersPerInch = 0.0254;
const feetPerMeter = 3.28084;

export type MapScale = {
  segments: { width: number; label: string }[];
  totalWidth: number;
  totalLabel: string;
  representativeFraction: string;
};

function niceDistance(meters: number) {
  const exponent = Math.floor(Math.log10(meters));
  const magnitude = 10 ** exponent;
  const normalized = meters / magnitude;
  const niceNormalized = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;
  return niceNormalized * magnitude;
}

function formatScaleDistance(meters: number) {
  const feet = meters * feetPerMeter;
  if (feet < 1_000) return `${Math.round(feet).toLocaleString()} ft`;

  const miles = feet / 5_280;
  if (miles < 10) return `${Number(miles.toFixed(miles < 2 ? 2 : 1)).toLocaleString()} mi`;
  return `${Math.round(miles).toLocaleString()} mi`;
}

export function mapScale(map: Map): MapScale {
  const latitude = map.getCenter().lat;
  const metersPerPixel = (Math.cos((latitude * Math.PI) / 180) * earthCircumferenceMeters) / (512 * 2 ** map.getZoom());
  const denominator = Math.max(1, Math.round((metersPerPixel * cssPixelsPerInch) / metersPerInch));
  const totalDistanceMeters = niceDistance(metersPerPixel * 180);
  const totalWidth = Math.max(80, Math.round(totalDistanceMeters / metersPerPixel));
  const segmentDistances = [0, totalDistanceMeters / 2, totalDistanceMeters];
  const segments = segmentDistances.map((distanceMeters, index) => ({
    width: index === 0 ? 0 : Math.round((distanceMeters - segmentDistances[index - 1]) / metersPerPixel),
    label: index === 0 ? "0" : formatScaleDistance(distanceMeters),
  }));

  return {
    segments,
    totalWidth,
    totalLabel: formatScaleDistance(totalDistanceMeters),
    representativeFraction: `1:${denominator.toLocaleString()}`,
  };
}
