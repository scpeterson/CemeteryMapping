import { useCemeteryMapSources, veteranGraveKeySet, getGeoJsonSource } from "./useCemeteryMapSources";
import { Maximize2, Ruler, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { addMeasurementLayers, measurementFeatureCollection, totalMeasurementDistanceFeet, formatMeasurementDistance, type MeasurementPoint } from "./cemeteryMapMeasurement";
import { applyGraveStatusFilters } from "./mapStatusFilters";
import { createMapHighlightState } from "./mapHighlightState";
import { createMapLayerHealth, externalMapLayers, type ExternalMapLayer } from "./mapLayerHealth";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import * as maplibregl from "../lib/maplibre";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { CemeteryData, CemeteryLot, GraveSpaceSummary, GraveStatus, HeadstoneSummary } from "../types";
import { graveSelectionKey, lotSelectionKey, statusLabels } from "../lib/format";
import { extendGeometryBounds, exteriorRing, fitMapToCemeteries, fitMapToData } from "./cemeteryMapBounds";
import {
  addBoundaryLayers,
  addGraveLayers,
  addHeadstoneLayers,
  addLotLayers,
  addRasterLayers,
  retryExternalMapLayer,
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
  selectedStatuses: ReadonlySet<GraveStatus>;
  searchResultIds: Set<string>;
  initialFitCemeteryIds?: string[];
  cemeteryScope?: string;
  isInitialFitReady: boolean;
  onSelectGrave: (grave: GraveSpaceSummary) => void;
  onSelectLot: (lot: CemeteryLot) => void;
  onSelectHeadstone: (headstone: HeadstoneSummary) => void;
  isPickingMarkerPoint?: boolean;
  isPickingGravesiteMonument?: boolean;
  onPickMarkerPoint?: (point: { latitude: number; longitude: number }) => void;
};

const statuses: GraveStatus[] = ["available", "reserved", "occupied", "sold", "needs_review", "unknown"];
type SelectionMode = "gravesites" | "lots" | "markers";

const center: [number, number] = [-76.70431, 39.19604];

function existingLayers(map: MapLibreMap, layers: readonly string[]) {
  return layers.filter((layer) => map.getLayer(layer));
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
  selectedStatuses,
  searchResultIds,
  initialFitCemeteryIds,
  cemeteryScope = "",
  isInitialFitReady,
  onSelectGrave,
  onSelectLot,
  onSelectHeadstone,
  isPickingMarkerPoint = false,
  isPickingGravesiteMonument = false,
  onPickMarkerPoint,
}: CemeteryMapProps) {
  const [failedLayers, setFailedLayers] = useState<ExternalMapLayer[]>([]);
  const layerHealthRef = useRef<ReturnType<typeof createMapLayerHealth> | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
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
  const isPickingGravesiteMonumentRef = useRef(false);
  const cemeteryMarkersRef = useRef<maplibregl.Marker[]>([]);
  const { lots, headstones } = data;
  const highlightStateRef = useRef(createMapHighlightState());
  const dataRef = useRef(data);
  const cemeteryScopeRef = useRef(cemeteryScope);
  const initialFitCemeteryIdsRef = useRef(initialFitCemeteryIds);
  const isInitialFitReadyRef = useRef(isInitialFitReady);
  const gravesBySelectionKeyRef = useRef<Map<string, GraveSpaceSummary>>(new Map());
  const lotsBySelectionKeyRef = useRef<Map<string, CemeteryLot>>(new Map());
  const headstonesByIdRef = useRef<Map<string, HeadstoneSummary>>(new Map());
  const selectedStatusesRef = useRef(selectedStatuses);
  const onSelect = useEffectEvent(onSelectGrave);
  const selectLot = useEffectEvent(onSelectLot);
  const selectHeadstone = useEffectEvent(onSelectHeadstone);
  const pickMarkerPoint = useEffectEvent((point: { latitude: number; longitude: number }) => onPickMarkerPoint?.(point));
  const previousCemeteryScopeRef = useRef(cemeteryScope);
  const didFitInitialScopeRef = useRef(false);

  useEffect(() => { gravesBySelectionKeyRef.current = new Map(data.graves.map(grave => [graveSelectionKey(grave), grave])); }, [data.graves]);
  useEffect(() => { lotsBySelectionKeyRef.current = new Map(lots.map(lot => [lotSelectionKey(lot), lot])); }, [lots]);
  useEffect(() => { headstonesByIdRef.current = new Map((headstones ?? []).map(headstone => [headstone.id, headstone])); }, [headstones]);

  useEffect(() => {
    dataRef.current = data;
    cemeteryScopeRef.current = cemeteryScope;
    initialFitCemeteryIdsRef.current = initialFitCemeteryIds;
    isInitialFitReadyRef.current = isInitialFitReady;
    selectedStatusesRef.current = selectedStatuses;
    isPickingMarkerPointRef.current = isPickingMarkerPoint;
    isPickingGravesiteMonumentRef.current = isPickingGravesiteMonument;
  }, [data, cemeteryScope, initialFitCemeteryIds, isInitialFitReady, isPickingMarkerPoint, isPickingGravesiteMonument, selectedStatuses]);

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

    const layerHealth = createMapLayerHealth(setFailedLayers);
    layerHealthRef.current = layerHealth;
    const handleLayerError = (event: maplibregl.ErrorEvent) => {
      const sourceEvent = event as maplibregl.ErrorEvent & { sourceId?: string };
      if (sourceEvent.sourceId && Object.hasOwn(externalMapLayers, sourceEvent.sourceId)) layerHealth.error(sourceEvent);
      else console.error(event.error);
    };
    const beginViewportLoad = () => {
      // Failed tiles from the old viewport must not keep a recovered layer in error.
      layerHealth.retry("pasda-imagery-2017");
      layerHealth.retry("allegheny-parcels");
    };
    map.on("movestart", beginViewportLoad);
    map.on("error", handleLayerError);
    map.on("sourcedata", layerHealth.data);

    map.on("load", () => {
      setMapLoaded(true);
      updateScale();

      addRasterLayers(map);
      addBoundaryLayers(map, dataRef.current);

      addSectionLayers(map, dataRef.current);
      addLotLayers(map, dataRef.current);
      addGraveLayers(map, dataRef.current.graves);
      addHeadstoneLayers(
        map,
        dataRef.current.headstones ?? [],
        veteranGraveKeySet(dataRef.current.graves),
      );
      applyGraveStatusFilters(map, selectedStatusesRef.current);
      addSectionLabelLayer(map);

      enforceMapLayerOrder(map);
      applyMapViewMode(map, mapViewModeRef.current);

      addMeasurementLayers(map);

      syncCemeteryMarkers(map, dataRef.current, cemeteryMarkers);
      if (isInitialFitReadyRef.current) {
        fitMapToCemeteries(map, dataRef.current, cemeteryScopeRef.current ? [cemeteryScopeRef.current] : initialFitCemeteryIdsRef.current, 0);
        didFitInitialScopeRef.current = true;
      }

      for (const layers of [selectableGraveLayers, selectableLotLayers, selectableHeadstoneLayers]) {
        registerSelectableLayerHandlers(map, layers, () => isMeasuringRef.current || isPickingMarkerPointRef.current || isPickingGravesiteMonumentRef.current);
      }
      map.on("click", (event) => {
        if (isPickingMarkerPointRef.current) {
          pickMarkerPoint({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
          return;
        }

        if (isPickingGravesiteMonumentRef.current) {
          const feature = map.queryRenderedFeatures(event.point, { layers: existingLayers(map, selectableHeadstoneLayers) })[0];
          const id = feature?.properties?.id;
          const headstone = typeof id === "string" ? headstonesByIdRef.current.get(id) : undefined;
          if (headstone) selectHeadstone(headstone);
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
          if (lot) selectLot(lot);
          return;
        }

        if (mode === "markers") {
          const id = feature.properties?.id;
          const headstone = typeof id === "string" ? headstonesByIdRef.current.get(id) : undefined;
          if (headstone) selectHeadstone(headstone);
          return;
        }

        const key = feature.properties?.key;
        const grave = typeof key === "string" ? gravesBySelectionKeyRef.current.get(key) : undefined;
        if (grave) onSelect(grave);
      });
    });

    map.on("move", updateScale);
    map.on("zoom", updateScale);

    mapRef.current = map;

    return () => {
      map.off("move", updateScale);
      map.off("zoom", updateScale);
      cemeteryMarkers.splice(0).forEach((marker) => marker.remove());
      map.off("movestart", beginViewportLoad);
      map.off("error", handleLayerError);
      map.off("sourcedata", layerHealth.data);
      layerHealthRef.current = null;
      highlightStateRef.current = createMapHighlightState();
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

  useCemeteryMapSources({ mapRef, cemeteryMarkersRef, highlightStateRef, mapLoaded, data,
    selectedGrave, selectedLot, selectedHeadstone, selectedStatuses, searchResultIds });

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isInitialFitReady || didFitInitialScopeRef.current || selectedGrave || selectedLot || selectedHeadstone) return;
    didFitInitialScopeRef.current = true;
    fitMapToCemeteries(map, data, initialFitCemeteryIds);
  }, [data, initialFitCemeteryIds, isInitialFitReady, selectedGrave, selectedHeadstone, selectedLot]);

  useEffect(() => {
    if (!selectedGrave || !mapRef.current || !mapLoaded) return;

    const ring = exteriorRing(selectedGrave.geometry);
    if (!ring?.length) return;
    const bounds = extendGeometryBounds(undefined, { type: "Polygon", coordinates: [ring] })!;
    mapRef.current.fitBounds(bounds, { padding: 140, maxZoom: 20.5, duration: 450 });
  }, [selectedGrave, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    const point = selectedHeadstone?.geometry;
    if (!map || !mapLoaded || !point) return;

    map.easeTo({ center: point.coordinates as [number, number], zoom: 20.5, duration: 450 });
  }, [selectedHeadstone, mapLoaded]);

  useEffect(() => {
    if (!selectedLot || !mapRef.current) return;

    const bounds = extendGeometryBounds(undefined, selectedLot.geometry);
    if (!bounds) return;
    mapRef.current.fitBounds(bounds, { padding: 140, maxZoom: 20.5, duration: 450 });
  }, [selectedLot]);

  useEffect(() => {
    if (previousCemeteryScopeRef.current === cemeteryScope) return;
    previousCemeteryScopeRef.current = cemeteryScope;
    const map = mapRef.current;
    if (map) fitMapToCemeteries(map, data, cemeteryScope ? [cemeteryScope] : undefined);
  }, [cemeteryScope, data]);

  const zoomIn = () => {
    mapRef.current?.zoomIn({ duration: 250 });
  };

  const zoomOut = () => {
    mapRef.current?.zoomOut({ duration: 250 });
  };

  const fitAll = () => {
    const map = mapRef.current;
    if (map) {
      if (cemeteryScope) fitMapToCemeteries(map, data, [cemeteryScope]);
      else fitMapToData(map, data);
    }
  };

  const toggleMeasure = () => {
    setIsMeasuring((current) => !current);
  };

  const clearMeasurement = () => {
    setMeasurementPoints([]);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => mapRef.current?.resize());
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const measurementDistanceFeet = totalMeasurementDistanceFeet(measurementPoints);

  return (
    <>
      <div ref={containerRef} className="map-canvas" aria-label="Interactive cemetery map" />
      <div className="map-toolbar" aria-label="Map tools">
        {mapViewMode === "geographic" && failedLayers.length > 0 ? (
          <section className="map-layer-notice" aria-label="Map layer availability">
            <div role="status" aria-live="polite">
              {failedLayers.map((id) => <p key={id}><strong>{externalMapLayers[id]}</strong> couldn't be loaded.</p>)}
              <p>Cemetery records remain available.</p>
            </div>
            <div className="map-layer-actions">
              {failedLayers.map((id) => <button key={id} type="button" onClick={() => {
                const map = mapRef.current;
                if (!map) return;
                layerHealthRef.current?.retry(id);
                retryExternalMapLayer(map, id);
              }}>Retry {externalMapLayers[id]}</button>)}
              <button type="button" onClick={() => setMapViewMode("diagram")}>Switch to Diagram view</button>
            </div>
          </section>
        ) : null}
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
          aria-label="Select lots and passageways: clicks open area details and associated gravesites"
          aria-pressed={selectionMode === "lots"}
          title="Select lots and passageways: clicks open area details and associated gravesites."
        >
          Lots & passageways
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
        <button type="button" onClick={fitAll} aria-label={cemeteryScope ? "Fit selected cemetery" : "Fit all cemetery data"} title={cemeteryScope ? "Fit selected cemetery" : "Fit all cemetery data"}>
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
      <details className="map-legend" aria-label="Map legend">
        <summary>Map legend</summary>
        <div className="map-legend-content">
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
          <span>
            <i className={`legend-symbol ${mapViewMode === "geographic" ? "legend-lot" : "legend-schematic-lot"}`} />
            Lot polygon
          </span>
          <span><i className="legend-symbol" style={{ background: "#b8871d", opacity: 0.7 }} />Passageway polygon</span>
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
            <i className="legend-symbol legend-plot-marker" />
            Plot marker
          </span>
          <span>
            <i className="legend-symbol legend-monolith-marker" />
            Monolith marker
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
      </details>
    </>
  );
}
