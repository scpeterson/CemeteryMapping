import type { ImageSource, Map } from "maplibre-gl";

const pasdaImageryExportUrl = "https://imagery.pasda.psu.edu/arcgis/rest/services/pasda/AlleghenyCountyImagery2017/MapServer/export";
const maxArcGisExportSize = 2048;
const pasdaToWebMercatorDatumTransformation = encodeURIComponent(
  JSON.stringify([{ wkid: 108190, transformForward: false }]),
);
const webMercatorEarthRadius = 6378137;
const webMercatorHalfWorld = 20037508.342789244;

function clampWebMercatorLatitude(latitude: number) {
  return Math.max(-85.05112878, Math.min(85.05112878, latitude));
}

function longitudeToWebMercatorX(longitude: number) {
  return (longitude * webMercatorHalfWorld) / 180;
}

function latitudeToWebMercatorY(latitude: number) {
  const clampedLatitude = clampWebMercatorLatitude(latitude);
  return webMercatorEarthRadius * Math.log(Math.tan(Math.PI / 4 + (clampedLatitude * Math.PI) / 360));
}

function pasdaExportForViewport(map: Map) {
  const bounds = map.getBounds();
  const west = bounds.getWest();
  const east = bounds.getEast();
  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const pixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const canvas = map.getCanvas();
  const width = Math.max(1, Math.min(maxArcGisExportSize, Math.round(canvas.clientWidth * pixelRatio)));
  const height = Math.max(1, Math.min(maxArcGisExportSize, Math.round(canvas.clientHeight * pixelRatio)));
  const bbox = [longitudeToWebMercatorX(west), latitudeToWebMercatorY(south), longitudeToWebMercatorX(east), latitudeToWebMercatorY(north)].join(",");

  return {
    url: `${pasdaImageryExportUrl}?f=image&format=jpg&transparent=false&bbox=${bbox}&bboxSR=3857&imageSR=3857&size=${width},${height}&layers=show:1&datumTransformations=${pasdaToWebMercatorDatumTransformation}`,
    coordinates: [
      [west, north],
      [east, north],
      [east, south],
      [west, south],
    ] as [[number, number], [number, number], [number, number], [number, number]],
  };
}

const updates = new WeakMap<Map, (force?: boolean) => void>();

export function addPasdaImagery(map: Map) {
  const bounds = map.getBounds();
  // Start without a URL: a map can first load in a hidden mobile workspace.
  map.addSource("pasda-imagery-2017", {
    type: "image",
    coordinates: [
      [bounds.getWest(), bounds.getNorth()],
      [bounds.getEast(), bounds.getNorth()],
      [bounds.getEast(), bounds.getSouth()],
      [bounds.getWest(), bounds.getSouth()],
    ],
  });
  map.addLayer({
    id: "pasda-imagery-2017",
    type: "raster",
    source: "pasda-imagery-2017",
    paint: { "raster-fade-duration": 0, "raster-saturation": -0.65, "raster-opacity": 0.8 },
  });

  let lastUrl: string | undefined;
  const update = (force = false) => {
    const canvas = map.getCanvas();
    if (canvas.clientWidth <= 0 || canvas.clientHeight <= 0) return;
    if (map.getLayoutProperty("pasda-imagery-2017", "visibility") === "none") return;
    const source = map.getSource("pasda-imagery-2017") as ImageSource | undefined;
    if (!source) return;
    const image = pasdaExportForViewport(map);
    // A normal resize also emits moveend. Do not restart the same image load.
    if (!force && image.url === lastUrl) return;
    lastUrl = image.url;
    source.updateImage(image);
  };
  updates.set(map, update);
  map.on("error", event => {
    // Allow a later viewport update to recover a genuinely failed request.
    if ((event as { sourceId?: string }).sourceId === "pasda-imagery-2017") lastUrl = undefined;
  });
  map.once("idle", () => update());
  map.on("moveend", () => update());
  map.on("resize", () => update());
}

export function updatePasdaImagery(map: Map, force = false) {
  // Explicit retries must work even when bounds and dimensions are unchanged.
  updates.get(map)?.(force);
}
