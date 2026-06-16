import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import type { CemeteryData, CemeteryLot, GraveSpaceSummary, GraveStatus, HeadstoneSummary } from "../types";
import { boundariesFeatureCollection, gravesFeatureCollection, headstonesFeatureCollection, lotsFeatureCollection, sectionsFeatureCollection } from "../lib/geojson";
import { graveSelectionKey, lotSelectionKey, statusLabels } from "../lib/format";
import { exteriorRing, fitMapToData } from "./cemeteryMapBounds";
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
  onSelectGrave: (grave: GraveSpaceSummary) => void;
  onSelectLot: (lot: CemeteryLot) => void;
  onSelectHeadstone: (headstone: HeadstoneSummary) => void;
};

const center: [number, number] = [-76.70431, 39.19604];

const statuses: GraveStatus[] = ["available", "reserved", "occupied", "sold", "needs_review", "unknown"];
type SelectionMode = "gravesites" | "lots" | "markers";

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

function refreshStaticSources(map: MapLibreMap, data: CemeteryData, selectedLot: CemeteryLot | undefined) {
  const boundarySource = getGeoJsonSource(map, "boundary");
  const sectionsSource = getGeoJsonSource(map, "sections");
  const lotsSource = getGeoJsonSource(map, "lots");
  const selectedLotKey = selectedLot ? lotSelectionKey(selectedLot) : undefined;

  boundarySource?.setData(boundariesFeatureCollection(data));
  sectionsSource?.setData(sectionsFeatureCollection(data));
  lotsSource?.setData(lotsFeatureCollection(data, selectedLotKey));

  return Boolean(boundarySource || sectionsSource || lotsSource);
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

function registerSelectableLayerHandlers(map: MapLibreMap, layers: readonly string[]) {
  layers.forEach((layer) => {
    map.on("mouseenter", layer, () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", layer, () => {
      map.getCanvas().style.cursor = "";
    });
  });
}

export function CemeteryMap({ data, selectedGrave, selectedLot, selectedHeadstone, visibleGraves, searchResultIds, onSelectGrave, onSelectLot, onSelectHeadstone }: CemeteryMapProps) {
  const [scale, setScale] = useState<MapScale>();
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>("geographic");
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("gravesites");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapViewModeRef = useRef<MapViewMode>("geographic");
  const selectionModeRef = useRef<SelectionMode>("gravesites");
  const cemeteryMarkersRef = useRef<maplibregl.Marker[]>([]);
  const dataRef = useRef(data);
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
  const didSkipInitialSelectionFitRef = useRef(false);
  const didFitDynamicDataRef = useRef(false);

  useEffect(() => {
    dataRef.current = data;
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
  }, [data, onSelectGrave, onSelectHeadstone, onSelectLot, searchResultIds, selectedGrave, selectedHeadstone, selectedLot, visibleGraves]);

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

      fitMapToData(map, dataRef.current, 0);

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
      syncCemeteryMarkers(map, dataRef.current, cemeteryMarkers);

      registerSelectableLayerHandlers(map, selectableGraveLayers);
      registerSelectableLayerHandlers(map, selectableLotLayers);
      registerSelectableLayerHandlers(map, selectableHeadstoneLayers);
      map.on("click", (event) => {
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
    const map = mapRef.current;
    if (!map) return;

    if (refreshStaticSources(map, data, selectedLot)) {
      syncCemeteryMarkers(map, data, cemeteryMarkersRef.current);
      if (!didFitDynamicDataRef.current && !selectedGrave && !selectedLot && !selectedHeadstone) {
        didFitDynamicDataRef.current = true;
        fitMapToData(map, data);
      }
    }
  }, [data, selectedGrave, selectedHeadstone, selectedLot]);

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

  return (
    <>
      <div ref={containerRef} className="map-canvas" aria-label="Interactive cemetery map" />
      <div className="map-view-toggle" aria-label="Map view">
        <button type="button" className={mapViewMode === "geographic" ? "is-active" : ""} onClick={() => setMapViewMode("geographic")} aria-pressed={mapViewMode === "geographic"}>
          Geographic
        </button>
        <button type="button" className={mapViewMode === "diagram" ? "is-active" : ""} onClick={() => setMapViewMode("diagram")} aria-pressed={mapViewMode === "diagram"}>
          Diagram
        </button>
      </div>
      <div className="map-selection-toggle" aria-label="Select map features">
        <button type="button" className={selectionMode === "gravesites" ? "is-active" : ""} onClick={() => setSelectionMode("gravesites")} aria-pressed={selectionMode === "gravesites"}>
          Graves
        </button>
        <button type="button" className={selectionMode === "lots" ? "is-active" : ""} onClick={() => setSelectionMode("lots")} aria-pressed={selectionMode === "lots"}>
          Lots
        </button>
        <button type="button" className={selectionMode === "markers" ? "is-active" : ""} onClick={() => setSelectionMode("markers")} aria-pressed={selectionMode === "markers"}>
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
      <div className="map-legend" aria-label="Map legend">
        <section>
          <h2>Layers</h2>
          <span>
            <i className="legend-symbol legend-imagery" />
            PASDA imagery
          </span>
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
            <i className="legend-symbol legend-lot" />
            Lot polygon
          </span>
          <span>
            <i className="legend-symbol legend-schematic-lot" />
            Diagram lot
          </span>
          <span>
            <i className="legend-symbol legend-gravesite" />
            Gravesite polygon
          </span>
          <span>
            <i className="legend-symbol legend-marker" />
            Headstone marker
          </span>
          <span>
            <i className="legend-symbol legend-highlighted-marker" />
            Highlighted marker
          </span>
          <span>
            <i className="legend-symbol legend-veteran-grave" />
            Veteran grave
          </span>
          <span>
            <i className="legend-symbol legend-other-marker" />
            Other marker
          </span>
          <span>
            <i className="legend-symbol legend-cemetery-label" />
            Cemetery label
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
