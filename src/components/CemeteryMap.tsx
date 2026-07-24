import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Ruler, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { CemeteryData, CemeteryLot, GraveSpaceSummary, GraveStatus, HeadstoneSummary } from "../types";
import { boundariesFeatureCollection, gravesFeatureCollection, headstonesFeatureCollection, lotRestrictedAreasFeatureCollection, lotsFeatureCollection, sectionsFeatureCollection } from "../lib/geojson";
import { graveSelectionKey, lotSelectionKey, statusLabels } from "../lib/format";
import { exteriorRing, fitMapToCemeteries, fitMapToData } from "./cemeteryMapBounds";
import {
  addBoundaryLayers,
  addGraveLayers,
  addHeadstoneLayers,
  addLotLayers,
  addRasterLayers,
  addSectionLabelLayer,
  addSectionLayers,
  applyMapViewMode,
  enforceMapLayerOrder,
  type MapViewMode,
  selectableGraveLayers,
  selectableHeadstoneLayers,
  selectableLotLayers,
} from "./cemeteryMapLayers";
import { syncCemeteryMarkers } from "./cemeteryMapMarkers";
import { mapScale, type MapScale } from "./cemeteryMapScale";

type CemeteryMapProps = {
  data: CemeteryData;
  selectedGrave?: GraveSpaceSummary;
  selectedLot?: CemeteryLot;
  selectedHeadstone?: HeadstoneSummary;
  visibleGraves: GraveSpaceSummary[];
  searchResultIds: Set<string>;
  initialFitCemeteryIds?: string[];
  isInitialFitReady: boolean;
  onSelectGrave: (grave: GraveSpaceSummary) => void;
  onSelectLot: (lot: CemeteryLot) => void;
  onSelectHeadstone: (headstone: HeadstoneSummary) => void;
  isPickingMarkerPoint?: boolean;
  onPickMarkerPoint?: (point: { latitude: number; longitude: number }) => void;
};

const center: [number, number] = [-76.70431, 39.19604];

const statuses: GraveStatus[] = ["available", "reserved", "occupied", "sold", "needs_review", "unknown"];
type SelectionMode = "gravesites" | "lots" | "markers";
type MeasurementPoint = [number, number];

const emptyMeasurementFeatureCollection = {
  type: "FeatureCollection",
  features: [],
} satisfies GeoJSON.FeatureCollection;

function graveSelectionIndex(graves: GraveSpaceSummary[]) {
  return new Map(graves.map((grave) => [graveSelectionKey(grave), grave]));
}

function lotSelectionIndex(lots: CemeteryLot[]) {
  return new Map(lots.map((lot) => [lotSelectionKey(lot), lot]));
}

function headstoneSelectionIndex(headstones: HeadstoneSummary[]) {
  return new Map(headstones.map((headstone) => [headstone.id, headstone]));
}

function veteranGraveKeySet(graves: GraveSpaceSummary[]) {
  return new Set(graves.filter((grave) => grave.hasVeteran).map((grave) => graveSelectionKey(grave)));
}

function getGeoJsonSource(map: MapLibreMap, sourceName: string) {
  return map.getSource(sourceName) as GeoJSONSource | undefined;
}

function refreshStaticSources(map: MapLibreMap, data: CemeteryData) {
  const boundarySource = getGeoJsonSource(map, "boundary");
  const sectionsSource = getGeoJsonSource(map, "sections");
  const lotRestrictedAreasSource = getGeoJsonSource(map, "lot-restricted-areas");

  boundarySource?.setData(boundariesFeatureCollection(data));
  sectionsSource?.setData(sectionsFeatureCollection(data));
  lotRestrictedAreasSource?.setData(lotRestrictedAreasFeatureCollection(data));

  return Boolean(boundarySource || sectionsSource || lotRestrictedAreasSource);
}

function refreshLotSource(map: MapLibreMap, data: CemeteryData, selectedLot: CemeteryLot | undefined) {
  const selectedLotKey = selectedLot ? lotSelectionKey(selectedLot) : undefined;
  getGeoJsonSource(map, "lots")?.setData(lotsFeatureCollection(data, selectedLotKey));
}

function refreshSelectableSources(
  map: MapLibreMap,
  headstones: HeadstoneSummary[] | undefined,
  visibleGraves: GraveSpaceSummary[],
  selectedGrave: GraveSpaceSummary | undefined,
  selectedHeadstone: HeadstoneSummary | undefined,
  searchResultIds: Set<string>,
) {
  const selectedGraveKey = selectedGrave ? graveSelectionKey(selectedGrave) : undefined;
  const veteranGraveKeys = veteranGraveKeySet(visibleGraves);

  getGeoJsonSource(map, "graves")?.setData(gravesFeatureCollection(visibleGraves, selectedGraveKey, searchResultIds));
  getGeoJsonSource(map, "headstones")?.setData(headstonesFeatureCollection(headstones ?? [], selectedGraveKey, searchResultIds, selectedHeadstone?.id, veteranGraveKeys));
}

function existingLayers(map: MapLibreMap, layers: readonly string[]) {
  return layers.filter((layer) => map.getLayer(layer));
}

function measurementFeatureCollection(points: MeasurementPoint[]): GeoJSON.FeatureCollection {
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

function totalMeasurementDistanceFeet(points: MeasurementPoint[]) {
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    return total + new maplibregl.LngLat(previous[0], previous[1]).distanceTo(new maplibregl.LngLat(point[0], point[1])) * 3.28084;
  }, 0);
}

function formatMeasurementDistance(feet: number) {
  if (feet >= 5280) return `${(feet / 5280).toFixed(2)} mi`;
  if (feet >= 100) return `${Math.round(feet).toLocaleString()} ft`;
  return `${feet.toFixed(1)} ft`;
}

function registerSelectableLayerHandlers(map: MapLibreMap, layers: readonly string[], isBusy: () => boolean) {
  layers.forEach((layer) => {
    map.on("mouseenter", layer, () => {
      if (isBusy()) return;
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", layer, () => {
      if (isBusy()) return;
      map.getCanvas().style.cursor = "";
    });
  });
}

export function CemeteryMap({
  data,
  selectedGrave,
  selectedLot,
  selectedHeadstone,
  visibleGraves,
  searchResultIds,
  initialFitCemeteryIds,
  isInitialFitReady,
  onSelectGrave,
  onSelectLot,
  onSelectHeadstone,
  isPickingMarkerPoint = false,
  onPickMarkerPoint,
}: CemeteryMapProps) {
  const [scale, setScale] = useState<MapScale>();
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>("geographic");
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("gravesites");
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurementPoints, setMeasurementPoints] = useState<MeasurementPoint[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapViewModeRef = useRef<MapViewMode>("geographic");
  const selectionModeRef = useRef<SelectionMode>("gravesites");
  const isMeasuringRef = useRef(false);
  const isPickingMarkerPointRef = useRef(false);
  const cemeteryMarkersRef = useRef<maplibregl.Marker[]>([]);
  const dataRef = useRef(data);
  const initialFitCemeteryIdsRef = useRef(initialFitCemeteryIds);
  const isInitialFitReadyRef = useRef(isInitialFitReady);
  const gravesBySelectionKeyRef = useRef(graveSelectionIndex(data.graves));
  const lotsBySelectionKeyRef = useRef(lotSelectionIndex(data.lots));
  const headstonesByIdRef = useRef(headstoneSelectionIndex(data.headstones ?? []));
  const visibleGravesRef = useRef(visibleGraves);
  const searchResultIdsRef = useRef(searchResultIds);
  const selectedRef = useRef(selectedGrave ? graveSelectionKey(selectedGrave) : undefined);
  const selectedHeadstoneIdRef = useRef(selectedHeadstone?.id);
  const onSelectRef = useRef(onSelectGrave);
  const onSelectLotRef = useRef(onSelectLot);
  const onSelectHeadstoneRef = useRef(onSelectHeadstone);
  const onPickMarkerPointRef = useRef(onPickMarkerPoint);
  const didSkipInitialSelectionFitRef = useRef(false);
  const didFitInitialScopeRef = useRef(false);

  useEffect(() => {
    dataRef.current = data;
    initialFitCemeteryIdsRef.current = initialFitCemeteryIds;
    isInitialFitReadyRef.current = isInitialFitReady;
    gravesBySelectionKeyRef.current = graveSelectionIndex(data.graves);
    lotsBySelectionKeyRef.current = lotSelectionIndex(data.lots);
    headstonesByIdRef.current = headstoneSelectionIndex(data.headstones ?? []);
    visibleGravesRef.current = visibleGraves;
    searchResultIdsRef.current = searchResultIds;
    selectedRef.current = selectedGrave ? graveSelectionKey(selectedGrave) : undefined;
    selectedHeadstoneIdRef.current = selectedHeadstone?.id;
    onSelectRef.current = onSelectGrave;
    onSelectLotRef.current = onSelectLot;
    onSelectHeadstoneRef.current = onSelectHeadstone;
    isPickingMarkerPointRef.current = isPickingMarkerPoint;
    onPickMarkerPointRef.current = onPickMarkerPoint;
  }, [data, initialFitCemeteryIds, isInitialFitReady, isPickingMarkerPoint, onPickMarkerPoint, onSelectGrave, onSelectHeadstone, onSelectLot, searchResultIds, selectedGrave, selectedHeadstone, selectedLot, visibleGraves]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const cemeteryMarkers = cemeteryMarkersRef.current;
    const updateScale = () => {
      setScale(mapScale(map));
    };
    const map = new maplibregl.Map({
      container: containerRef.current,
      center,
      zoom: 18.5,
      minZoom: 5,
      maxZoom: 22,
      scrollZoom: true,
      pitch: 0,
      attributionControl: false,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#e7ece5" },
          },
        ],
      },
    });

    map.on("load", () => {
      updateScale();

      addRasterLayers(map);
      addBoundaryLayers(map, dataRef.current);

      addSectionLayers(map, dataRef.current);
      addLotLayers(map, dataRef.current);
      addGraveLayers(map, visibleGravesRef.current, selectedRef.current, searchResultIdsRef.current);
      addHeadstoneLayers(
        map,
        dataRef.current.headstones ?? [],
        selectedRef.current,
        searchResultIdsRef.current,
        selectedHeadstoneIdRef.current,
        veteranGraveKeySet(visibleGravesRef.current),
      );
      addSectionLabelLayer(map);

      enforceMapLayerOrder(map);
      applyMapViewMode(map, mapViewModeRef.current);

      map.addSource("measurement", {
        type: "geojson",
        data: emptyMeasurementFeatureCollection,
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

      syncCemeteryMarkers(map, dataRef.current, cemeteryMarkers);
      if (isInitialFitReadyRef.current) {
        fitMapToCemeteries(map, dataRef.current, initialFitCemeteryIdsRef.current, 0);
        didFitInitialScopeRef.current = true;
      }

      registerSelectableLayerHandlers(map, selectableGraveLayers, () => isMeasuringRef.current || isPickingMarkerPointRef.current);
      registerSelectableLayerHandlers(map, selectableLotLayers, () => isMeasuringRef.current || isPickingMarkerPointRef.current);
      registerSelectableLayerHandlers(map, selectableHeadstoneLayers, () => isMeasuringRef.current || isPickingMarkerPointRef.current);
      map.on("click", (event) => {
        if (isPickingMarkerPointRef.current) {
          onPickMarkerPointRef.current?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
          return;
        }

        if (isMeasuringRef.current) {
          const nextPoint: MeasurementPoint = [event.lngLat.lng, event.lngLat.lat];
          setMeasurementPoints((currentPoints) => [...currentPoints, nextPoint]);
          return;
        }

        const mode = selectionModeRef.current;
        const layers = mode === "lots" ? selectableLotLayers : mode === "markers" ? selectableHeadstoneLayers : selectableGraveLayers;
        const features = map.queryRenderedFeatures(event.point, { layers: existingLayers(map, layers) });
        const feature = features[0];
        if (!feature) return;

        if (mode === "lots") {
          const key = feature.properties?.key;
          const lot = typeof key === "string" ? lotsBySelectionKeyRef.current.get(key) : undefined;
          if (lot) onSelectLotRef.current(lot);
          return;
        }

        if (mode === "markers") {
          const id = feature.properties?.id;
          const headstone = typeof id === "string" ? headstonesByIdRef.current.get(id) : undefined;
          if (headstone) onSelectHeadstoneRef.current(headstone);
          return;
        }

        const key = feature.properties?.key;
        const grave = typeof key === "string" ? gravesBySelectionKeyRef.current.get(key) : undefined;
        if (grave) onSelectRef.current(grave);
      });
    });

    map.on("move", updateScale);
    map.on("zoom", updateScale);

    mapRef.current = map;

    return () => {
      map.off("move", updateScale);
      map.off("zoom", updateScale);
      cemeteryMarkers.splice(0).forEach((marker) => marker.remove());
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapViewModeRef.current = mapViewMode;
    const map = mapRef.current;
    if (map) applyMapViewMode(map, mapViewMode);
  }, [mapViewMode]);

  useEffect(() => {
    selectionModeRef.current = selectionMode;
  }, [selectionMode]);

  useEffect(() => {
    isMeasuringRef.current = isMeasuring;
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = isMeasuring || isPickingMarkerPoint ? "crosshair" : "";
  }, [isMeasuring, isPickingMarkerPoint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    getGeoJsonSource(map, "measurement")?.setData(measurementFeatureCollection(measurementPoints));
  }, [measurementPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (refreshStaticSources(map, data)) {
      syncCemeteryMarkers(map, data, cemeteryMarkersRef.current);
    }
  }, [data]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isInitialFitReady || didFitInitialScopeRef.current || selectedGrave || selectedLot || selectedHeadstone) return;
    didFitInitialScopeRef.current = true;
    fitMapToCemeteries(map, data, initialFitCemeteryIds);
  }, [data, initialFitCemeteryIds, isInitialFitReady, selectedGrave, selectedHeadstone, selectedLot]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    refreshLotSource(map, data, selectedLot);
  }, [data, selectedLot]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    refreshSelectableSources(map, data.headstones, visibleGraves, selectedGrave, selectedHeadstone, searchResultIds);
  }, [data.headstones, searchResultIds, selectedGrave, selectedHeadstone, visibleGraves]);

  useEffect(() => {
    if (!selectedGrave || !mapRef.current) return;
    if (!didSkipInitialSelectionFitRef.current) {
      didSkipInitialSelectionFitRef.current = true;
      return;
    }

    const ring = exteriorRing(selectedGrave.geometry);
    if (!ring?.length) return;
    const bounds = ring.reduce((mapBounds, coordinate) => mapBounds.extend(coordinate as [number, number]), new maplibregl.LngLatBounds(ring[0] as [number, number], ring[0] as [number, number]));
    mapRef.current.fitBounds(bounds, { padding: 140, maxZoom: 20.5, duration: 450 });
  }, [selectedGrave]);

  const zoomIn = useCallback(() => {
    mapRef.current?.zoomIn({ duration: 250 });
  }, []);

  const zoomOut = useCallback(() => {
    mapRef.current?.zoomOut({ duration: 250 });
  }, []);

  const fitAll = useCallback(() => {
    const map = mapRef.current;
    if (map) fitMapToData(map, data);
  }, [data]);

  const toggleMeasure = useCallback(() => {
    setIsMeasuring((current) => !current);
  }, []);

  const clearMeasurement = useCallback(() => {
    setMeasurementPoints([]);
  }, []);

  const measurementDistanceFeet = totalMeasurementDistanceFeet(measurementPoints);

  return (
    <>
      <div ref={containerRef} className="map-canvas" aria-label="Interactive cemetery map" />
      <div className="map-view-toggle" aria-label="Map view">
        <button
          type="button"
          className={mapViewMode === "geographic" ? "is-active" : ""}
          onClick={() => setMapViewMode("geographic")}
          aria-label="Geographic view: show features in their mapped GPS or operational locations"
          aria-pressed={mapViewMode === "geographic"}
          title="Geographic view: show features in their mapped GPS or operational locations."
        >
          Geographic
        </button>
        <button
          type="button"
          className={mapViewMode === "diagram" ? "is-active" : ""}
          onClick={() => setMapViewMode("diagram")}
          aria-label="Diagram view: emphasize schematic lot and grave layout for readability"
          aria-pressed={mapViewMode === "diagram"}
          title="Diagram view: emphasize schematic lot and grave layout for readability."
        >
          Diagram
        </button>
      </div>
      <div className="map-selection-toggle" aria-label="Select map features">
        <button
          type="button"
          className={selectionMode === "gravesites" ? "is-active" : ""}
          onClick={() => setSelectionMode("gravesites")}
          aria-label="Select gravesites: clicks open grave space details"
          aria-pressed={selectionMode === "gravesites"}
          title="Select gravesites: clicks open grave space details."
        >
          Graves
        </button>
        <button
          type="button"
          className={selectionMode === "lots" ? "is-active" : ""}
          onClick={() => setSelectionMode("lots")}
          aria-label="Select lots: clicks open lot details and associated gravesites"
          aria-pressed={selectionMode === "lots"}
          title="Select lots: clicks open lot details and associated gravesites."
        >
          Lots
        </button>
        <button
          type="button"
          className={selectionMode === "markers" ? "is-active" : ""}
          onClick={() => setSelectionMode("markers")}
          aria-label="Select markers: clicks open headstone or marker details"
          aria-pressed={selectionMode === "markers"}
          title="Select markers: clicks open headstone or marker details."
        >
          Markers
        </button>
      </div>
      <div className="map-controls" aria-label="Map controls">
        <div className="north-arrow" role="img" aria-label="North arrow" title="North">
          <span>N</span>
          <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
            <path className="north-arrow-needle" d="M20 3 L32 37 L20 30 L8 37 Z" />
            <path className="north-arrow-cutout" d="M20 14 L25 29 L20 26 L15 29 Z" />
          </svg>
        </div>
        <button type="button" onClick={zoomIn} aria-label="Zoom in" title="Zoom in">
          <ZoomIn size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={zoomOut} aria-label="Zoom out" title="Zoom out">
          <ZoomOut size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={fitAll} aria-label="Fit all cemetery data" title="Fit all cemetery data">
          <Maximize2 size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={isMeasuring ? "is-active" : ""}
          onClick={toggleMeasure}
          aria-label={isMeasuring ? "Stop measuring distances" : "Measure distances between map points"}
          aria-pressed={isMeasuring}
          title={isMeasuring ? "Stop measuring distances." : "Measure distances between map points."}
        >
          <Ruler size={18} aria-hidden="true" />
        </button>
      </div>
      {!isPickingMarkerPoint && (isMeasuring || measurementPoints.length) ? (
        <div className="map-measurement" aria-live="polite">
          <div>
            <strong>{measurementPoints.length > 1 ? formatMeasurementDistance(measurementDistanceFeet) : "Click map points"}</strong>
            <span>
              {measurementPoints.length === 0
                ? "Choose a starting point."
                : measurementPoints.length === 1
                  ? "Choose an ending point."
                  : `${measurementPoints.length} points measured.`}
            </span>
          </div>
          <button type="button" onClick={clearMeasurement} disabled={!measurementPoints.length} aria-label="Clear measurement" title="Clear measurement">
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {isPickingMarkerPoint ? (
        <div className="map-measurement map-placement" aria-live="polite">
          <div>
            <strong>Pick marker point</strong>
            <span>Click the map where the new marker is located.</span>
          </div>
        </div>
      ) : null}
      {scale ? (
        <div className="map-scale" aria-label="Map scale">
          <div className="map-scale-fraction">Scale {scale.representativeFraction}</div>
          <div className="map-scale-labels" style={{ width: `${scale.totalWidth}px` }} aria-hidden="true">
            {scale.segments.map((segment) => (
              <span key={segment.label}>{segment.label}</span>
            ))}
          </div>
          <div className="map-scale-bar" style={{ width: `${scale.totalWidth}px` }} aria-label={`Bar scale ${scale.totalLabel}`}>
            {scale.segments.slice(1).map((segment, index) => (
              <span key={segment.label} className={index % 2 === 0 ? "is-dark" : "is-light"} style={{ width: `${segment.width}px` }} />
            ))}
          </div>
        </div>
      ) : null}
      <div className="map-legend" aria-label="Map legend">
        <section>
          <h2>Layers</h2>
          <span>
            <i className="legend-symbol legend-boundary" />
            Cemetery boundary
          </span>
          <span>
            <i className="legend-symbol legend-parcel" />
            Parcel boundary
          </span>
          <span>
            <i className="legend-symbol legend-section" />
            Section polygon
          </span>
          {mapViewMode === "geographic" ? (
            <span>
              <i className="legend-symbol legend-lot" />
              Lot polygon
            </span>
          ) : (
            <span>
              <i className="legend-symbol legend-schematic-lot" />
              Lot polygon
            </span>
          )}
          <span>
            <i className="legend-symbol legend-gravesite" />
            Gravesite polygon
          </span>
          <span>
            <i className="legend-symbol legend-non-burial-lot" />
            Gravesites and markers prohibited
          </span>
          <span>
            <i className="legend-symbol legend-marker" />
            Headstone marker
          </span>
          <span>
            <i className="legend-symbol legend-veteran-grave" />
            Veteran grave
          </span>
          <span>
            <i className="legend-symbol legend-other-marker" />
            Other marker
          </span>
        </section>
        <section>
          <h2>Gravesite Status</h2>
          <div className="legend-status-grid">
            {statuses.map((status) => (
              <span key={status}>
                <i className={`legend-dot legend-${status}`} />
                {statusLabels[status]}
              </span>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
