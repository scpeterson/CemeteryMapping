import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import type { CemeteryData, GraveSpaceSummary, GraveStatus } from "../types";
import { boundariesFeatureCollection, gravesFeatureCollection, lotsFeatureCollection, sectionsFeatureCollection } from "../lib/geojson";
import { graveSelectionKey, statusLabels } from "../lib/format";
import { exteriorRing, fitMapToData } from "./cemeteryMapBounds";
import { addBoundaryLayers, addGraveLayers, addLotLayers, addRasterLayers, addSectionLabelLayer, addSectionLayers, selectableGraveLayers } from "./cemeteryMapLayers";
import { syncCemeteryMarkers } from "./cemeteryMapMarkers";
import { mapScale, type MapScale } from "./cemeteryMapScale";

type CemeteryMapProps = {
  data: CemeteryData;
  selectedGrave?: GraveSpaceSummary;
  visibleGraves: GraveSpaceSummary[];
  searchResultIds: Set<string>;
  onSelectGrave: (grave: GraveSpaceSummary) => void;
};

const center: [number, number] = [-76.70431, 39.19604];

const statuses: GraveStatus[] = ["available", "reserved", "occupied", "sold", "needs_review", "unknown"];

function graveSelectionIndex(graves: GraveSpaceSummary[]) {
  return new Map(graves.map((grave) => [graveSelectionKey(grave), grave]));
}

export function CemeteryMap({ data, selectedGrave, visibleGraves, searchResultIds, onSelectGrave }: CemeteryMapProps) {
  const [scale, setScale] = useState<MapScale>();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const cemeteryMarkersRef = useRef<maplibregl.Marker[]>([]);
  const dataRef = useRef(data);
  const gravesBySelectionKeyRef = useRef(graveSelectionIndex(data.graves));
  const visibleGravesRef = useRef(visibleGraves);
  const searchResultIdsRef = useRef(searchResultIds);
  const selectedRef = useRef(selectedGrave ? graveSelectionKey(selectedGrave) : undefined);
  const onSelectRef = useRef(onSelectGrave);
  const didSkipInitialSelectionFitRef = useRef(false);

  useEffect(() => {
    dataRef.current = data;
    gravesBySelectionKeyRef.current = graveSelectionIndex(data.graves);
    visibleGravesRef.current = visibleGraves;
    searchResultIdsRef.current = searchResultIds;
    selectedRef.current = selectedGrave ? graveSelectionKey(selectedGrave) : undefined;
    onSelectRef.current = onSelectGrave;
  }, [data, onSelectGrave, searchResultIds, selectedGrave, visibleGraves]);

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
      addSectionLabelLayer(map);

      syncCemeteryMarkers(map, dataRef.current, cemeteryMarkers);

      const selectGraveFeature = (event: maplibregl.MapLayerMouseEvent) => {
        const key = event.features?.[0]?.properties?.key;
        const grave = typeof key === "string" ? gravesBySelectionKeyRef.current.get(key) : undefined;
        if (grave) onSelectRef.current(grave);
      };

      selectableGraveLayers.forEach((layer) => {
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });

        map.on("click", layer, selectGraveFeature);
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
    const map = mapRef.current;
    if (!map) return;

    const boundarySource = map.getSource("boundary") as GeoJSONSource | undefined;
    boundarySource?.setData(boundariesFeatureCollection(data));

    const sectionsSource = map.getSource("sections") as GeoJSONSource | undefined;
    sectionsSource?.setData(sectionsFeatureCollection(data));

    const lotsSource = map.getSource("lots") as GeoJSONSource | undefined;
    lotsSource?.setData(lotsFeatureCollection(data));

    if (boundarySource || sectionsSource || lotsSource) {
      syncCemeteryMarkers(map, data, cemeteryMarkersRef.current);
      fitMapToData(map, data);
    }
  }, [data]);

  useEffect(() => {
    const source = mapRef.current?.getSource("graves") as GeoJSONSource | undefined;
    source?.setData(gravesFeatureCollection(visibleGraves, selectedGrave ? graveSelectionKey(selectedGrave) : undefined, searchResultIds));
  }, [searchResultIds, selectedGrave, visibleGraves]);

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
            <i className="legend-symbol legend-gravesite" />
            Gravesite polygon
          </span>
          <span>
            <i className="legend-symbol legend-marker" />
            Cemetery marker
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
