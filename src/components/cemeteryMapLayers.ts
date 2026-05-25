import { type Map } from "maplibre-gl";
import type { CemeteryData, GraveSpaceSummary } from "../types";
import { boundariesFeatureCollection, gravesFeatureCollection, lotsFeatureCollection, sectionsFeatureCollection } from "../lib/geojson";
import { statusColors } from "../lib/format";

export const selectableGraveLayers = ["graves-fill", "graves-line", "grave-labels"];

const pasdaImageryExportUrl = "https://imagery.pasda.psu.edu/arcgis/rest/services/pasda/AlleghenyCountyImagery2017/MapServer/export";
const pasdaImageryTileUrl = `${pasdaImageryExportUrl}?f=image&format=jpg&transparent=false&bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&layers=show:4`;
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

export function addRasterLayers(map: Map) {
  map.addSource("pasda-imagery-2017", {
    type: "raster",
    tiles: [pasdaImageryTileUrl],
    tileSize: 256,
    attribution: "PASDA Allegheny County Imagery 2017",
  });
  map.addLayer({
    id: "pasda-imagery-2017",
    type: "raster",
    source: "pasda-imagery-2017",
  });

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
  map.addLayer({
    id: "sections-label",
    type: "symbol",
    source: "sections",
    layout: {
      "text-field": ["get", "name"],
      "text-size": 14,
      "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
    },
    paint: {
      "text-color": "#3d473c",
      "text-halo-color": "#f4f6ee",
      "text-halo-width": 1,
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
      "line-color": ["case", ["boolean", ["get", "selected"], false], "#111827", ["boolean", ["get", "searchMatch"], false], "#f9fafb", "#31413c"],
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
