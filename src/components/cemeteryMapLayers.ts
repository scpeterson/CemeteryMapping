import { type ImageSource, type Map } from "maplibre-gl";
import type { CemeteryData, GraveSpaceSummary, HeadstoneSummary } from "../types";
import { boundariesFeatureCollection, gravesFeatureCollection, headstonesFeatureCollection, lotsFeatureCollection, sectionsFeatureCollection } from "../lib/geojson";
import { statusColors } from "../lib/format";

export const selectableGraveLayers = ["graves-fill", "graves-line", "grave-labels"];
export const selectableHeadstoneLayers = ["headstones-circle", "headstones-halo"];

const mapLayerOrder = [
  "pasda-imagery-2017",
  "allegheny-parcels",
  "boundary-fill",
  "boundary-line",
  "sections-fill",
  "sections-line",
  "lots-fill",
  "lots-line",
  "graves-fill",
  "graves-line",
  "headstones-halo",
  "headstones-circle",
  "sections-label",
  "lots-label",
  "grave-labels",
];

const pasdaImageryExportUrl = "https://imagery.pasda.psu.edu/arcgis/rest/services/pasda/AlleghenyCountyImagery2017/MapServer/export";
const maxArcGisExportSize = 2048;
const pasdaToWebMercatorDatumTransformation = encodeURIComponent(
  JSON.stringify([{ wkid: 108190, transformForward: false }]),
);
const webMercatorEarthRadius = 6378137;
const webMercatorHalfWorld = 20037508.342789244;
const alleghenyParcelsExportUrl = "https://gisdata.alleghenycounty.us/arcgis/rest/services/EGIS/Web_Parcels/MapServer/export";
const alleghenyParcelsDynamicLayers = encodeURIComponent(
  JSON.stringify([
    {
      id: 0,
      source: {
        type: "mapLayer",
        mapLayerId: 0,
      },
      drawingInfo: {
        renderer: {
          type: "simple",
          symbol: {
            type: "esriSFS",
            style: "esriSFSSolid",
            color: [0, 0, 0, 0],
            outline: {
              type: "esriSLS",
              style: "esriSLSSolid",
              color: [255, 0, 0, 255],
              width: 3,
            },
          },
        },
      },
    },
  ]),
);
const alleghenyParcelsTileUrl = `${alleghenyParcelsExportUrl}?f=image&format=png32&transparent=true&bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&dynamicLayers=${alleghenyParcelsDynamicLayers}`;

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

function updatePasdaImagery(map: Map) {
  const source = map.getSource("pasda-imagery-2017") as ImageSource | undefined;
  source?.updateImage(pasdaExportForViewport(map));
}

export function addRasterLayers(map: Map) {
  map.addSource("pasda-imagery-2017", {
    type: "image",
    ...pasdaExportForViewport(map),
  });
  map.addLayer({
    id: "pasda-imagery-2017",
    type: "raster",
    source: "pasda-imagery-2017",
    paint: { "raster-fade-duration": 0 },
  });

  map.once("idle", () => updatePasdaImagery(map));
  map.on("moveend", () => updatePasdaImagery(map));
  map.on("resize", () => updatePasdaImagery(map));

  map.addSource("allegheny-parcels", {
    type: "raster",
    tiles: [alleghenyParcelsTileUrl],
    tileSize: 256,
    attribution: "Allegheny County",
  });
  map.addLayer({
    id: "allegheny-parcels",
    type: "raster",
    source: "allegheny-parcels",
    paint: { "raster-opacity": 1 },
  });
}

export function addBoundaryLayers(map: Map, data: CemeteryData) {
  map.addSource("boundary", { type: "geojson", data: boundariesFeatureCollection(data) });
  map.addLayer({
    id: "boundary-fill",
    type: "fill",
    source: "boundary",
    paint: { "fill-color": "#dfe7d9", "fill-opacity": 0.25 },
  });
  map.addLayer({
    id: "boundary-line",
    type: "line",
    source: "boundary",
    paint: { "line-color": "#3b4f3d", "line-width": 3 },
  });
}

export function addSectionLayers(map: Map, data: CemeteryData) {
  map.addSource("sections", { type: "geojson", data: sectionsFeatureCollection(data) });
  map.addLayer({
    id: "sections-fill",
    type: "fill",
    source: "sections",
    paint: { "fill-color": "#f7f4ea", "fill-opacity": 0.25 },
  });
  map.addLayer({
    id: "sections-line",
    type: "line",
    source: "sections",
    paint: { "line-color": "#77856e", "line-width": 1.4, "line-dasharray": [2, 2] },
  });
}

export function addSectionLabelLayer(map: Map) {
  map.addLayer({
    id: "sections-label",
    type: "symbol",
    source: "sections",
    layout: {
      "text-field": ["get", "name"],
      "text-size": 15,
      "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
      "text-allow-overlap": false,
      "text-ignore-placement": false,
      "symbol-sort-key": 1,
    },
    paint: {
      "text-color": "#24342d",
      "text-halo-color": "#fffdf5",
      "text-halo-width": 1.6,
    },
  });
}

export function addLotLayers(map: Map, data: CemeteryData) {
  map.addSource("lots", { type: "geojson", data: lotsFeatureCollection(data) });
  map.addLayer({
    id: "lots-fill",
    type: "fill",
    source: "lots",
    paint: { "fill-color": "#f3ead2", "fill-opacity": 0.38 },
  });
  map.addLayer({
    id: "lots-line",
    type: "line",
    source: "lots",
    paint: { "line-color": "#a07738", "line-width": 1.2 },
  });
  map.addLayer({
    id: "lots-label",
    type: "symbol",
    source: "lots",
    layout: {
      "text-field": ["get", "name"],
      "text-size": 12,
      "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
    },
    paint: {
      "text-color": "#5b4630",
      "text-halo-color": "#fbf8ee",
      "text-halo-width": 1,
    },
  });
}

export function addGraveLayers(map: Map, graves: GraveSpaceSummary[], selectedKey: string | undefined, searchResultIds: Set<string>) {
  map.addSource("graves", {
    type: "geojson",
    data: gravesFeatureCollection(graves, selectedKey, searchResultIds),
  });

  map.addLayer({
    id: "graves-fill",
    type: "fill",
    source: "graves",
    paint: {
      "fill-color": [
        "match",
        ["get", "status"],
        "available",
        statusColors.available,
        "reserved",
        statusColors.reserved,
        "occupied",
        statusColors.occupied,
        "sold",
        statusColors.sold,
        "needs_review",
        statusColors.needs_review,
        statusColors.unknown,
      ],
      "fill-opacity": ["case", ["boolean", ["get", "searchMatch"], false], 0.9, 0.72],
    },
  });

  map.addLayer({
    id: "graves-line",
    type: "line",
    source: "graves",
    paint: {
      "line-color": ["case", ["boolean", ["get", "selected"], false], "#ff1493", ["boolean", ["get", "searchMatch"], false], "#f9fafb", "#31413c"],
      "line-width": ["case", ["boolean", ["get", "selected"], false], 4, ["boolean", ["get", "searchMatch"], false], 2.8, 1.1],
    },
  });

  map.addLayer({
    id: "grave-labels",
    type: "symbol",
    source: "graves",
    layout: {
      "text-field": ["get", "label"],
      "text-size": 11,
      "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
    },
    paint: {
      "text-color": "#17201d",
      "text-halo-color": "#f8faf5",
      "text-halo-width": 1,
    },
  });
}

export function addHeadstoneLayers(map: Map, headstones: HeadstoneSummary[], selectedKey: string | undefined, searchResultIds: Set<string>, selectedHeadstoneId?: string) {
  map.addSource("headstones", {
    type: "geojson",
    data: headstonesFeatureCollection(headstones, selectedKey, searchResultIds, selectedHeadstoneId),
  });

  map.addLayer({
    id: "headstones-halo",
    type: "circle",
    source: "headstones",
    paint: {
      "circle-radius": [
        "case",
        ["boolean", ["get", "selected"], false],
        7,
        ["boolean", ["get", "searchMatch"], false],
        6,
        ["==", ["get", "markerTypeCode"], "other"],
        6,
        4,
      ],
      "circle-color": "#fbfcf7",
      "circle-opacity": 0.95,
    },
  });

  map.addLayer({
    id: "headstones-circle",
    type: "circle",
    source: "headstones",
    paint: {
      "circle-radius": [
        "case",
        ["boolean", ["get", "selected"], false],
        5,
        ["boolean", ["get", "searchMatch"], false],
        4.5,
        ["==", ["get", "markerTypeCode"], "other"],
        4.6,
        3.2,
      ],
      "circle-color": [
        "case",
        ["boolean", ["get", "selected"], false],
        "#ff1493",
        ["boolean", ["get", "searchMatch"], false],
        "#f8d465",
        ["==", ["get", "markerTypeCode"], "other"],
        "#d97706",
        "#203a33",
      ],
      "circle-stroke-color": ["case", ["==", ["get", "markerTypeCode"], "other"], "#5f2d08", "#10211c"],
      "circle-stroke-width": ["case", ["==", ["get", "markerTypeCode"], "other"], 1.2, 0.7],
    },
  });
}

export function enforceMapLayerOrder(map: Map) {
  mapLayerOrder.forEach((layer) => {
    if (map.getLayer(layer)) map.moveLayer(layer);
  });
}
