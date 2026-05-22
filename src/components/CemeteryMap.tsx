import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import maplibregl, { type Map, type GeoJSONSource } from "maplibre-gl";
import type { CemeteryData, GraveSpaceSummary, GraveStatus } from "../types";
import { boundariesFeatureCollection, cemeteryMarkersFeatureCollection, gravesFeatureCollection, sectionsFeatureCollection } from "../lib/geojson";
import { graveSelectionKey, statusColors, statusLabels } from "../lib/format";

type CemeteryMapProps = {
  data: CemeteryData;
  selectedGrave?: GraveSpaceSummary;
  visibleGraves: GraveSpaceSummary[];
  searchResultIds: Set<string>;
  onSelectGrave: (grave: GraveSpaceSummary) => void;
};

const center: [number, number] = [-76.70431, 39.19604];
const earthCircumferenceMeters = 40_075_016.686;
const cssPixelsPerInch = 96;
const metersPerInch = 0.0254;
const feetPerMeter = 3.28084;

type MapScale = {
  segments: { width: number; label: string }[];
  totalWidth: number;
  totalLabel: string;
  representativeFraction: string;
};

type ScaleSegment = {
  width: number;
  label: string;
};

const statuses: GraveStatus[] = ["available", "reserved", "occupied", "sold", "unknown"];
const selectableGraveLayers = ["graves-fill", "graves-line", "grave-labels"];

const exteriorRing = (geometry: GraveSpaceSummary["geometry"]) => (geometry.type === "Polygon" ? geometry.coordinates[0] : geometry.coordinates[0]?.[0]);

function extendGeometryBounds(bounds: maplibregl.LngLatBounds | undefined, geometry: GeoJSON.Geometry): maplibregl.LngLatBounds | undefined {
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

function dataBounds(data: CemeteryData) {
  const boundaries = data.boundaries ?? (data.boundary ? [data.boundary] : []);
  const boundaryBounds = boundaries.reduce((bounds, boundary) => extendGeometryBounds(bounds, boundary.geometry), undefined as maplibregl.LngLatBounds | undefined);
  if (boundaryBounds) return boundaryBounds;

  return data.graves.reduce((bounds, grave) => extendGeometryBounds(bounds, grave.geometry), undefined as maplibregl.LngLatBounds | undefined);
}

function fitMapToData(map: Map, data: CemeteryData, duration = 350) {
  const bounds = dataBounds(data);
  if (bounds) map.fitBounds(bounds, { padding: 90, maxZoom: 19, duration });
}

function fitMapToGeometry(map: Map, geometry: GeoJSON.Geometry, duration = 350) {
  const bounds = extendGeometryBounds(undefined, geometry);
  if (bounds) map.fitBounds(bounds, { padding: 110, maxZoom: 19, duration });
}

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

function mapScale(map: Map): MapScale {
  const latitude = map.getCenter().lat;
  const metersPerPixel = (Math.cos((latitude * Math.PI) / 180) * earthCircumferenceMeters) / (512 * 2 ** map.getZoom());
  const denominator = Math.max(1, Math.round((metersPerPixel * cssPixelsPerInch) / metersPerInch));
  const totalDistanceMeters = niceDistance(metersPerPixel * 180);
  const totalWidth = Math.max(80, Math.round(totalDistanceMeters / metersPerPixel));
  const segmentDistances = [0, totalDistanceMeters / 2, totalDistanceMeters];
  const segments: ScaleSegment[] = segmentDistances.map((distanceMeters, index) => ({
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

function syncCemeteryMarkers(map: Map, data: CemeteryData, markers: maplibregl.Marker[]) {
  markers.splice(0).forEach((marker) => marker.remove());

  cemeteryMarkersFeatureCollection(data).features.forEach((feature) => {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "cemetery-map-marker";
    element.textContent = feature.properties.name;
    element.setAttribute("aria-label", `Zoom to ${feature.properties.name}`);
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      const boundaries = data.boundaries ?? (data.boundary ? [data.boundary] : []);
      const boundary = boundaries[feature.properties.index];
      if (boundary) fitMapToGeometry(map, boundary.geometry);
    });

    const marker = new maplibregl.Marker({ element }).setLngLat(feature.geometry.coordinates as [number, number]).addTo(map);
    markers.push(marker);
  });
}

export function CemeteryMap({ data, selectedGrave, visibleGraves, searchResultIds, onSelectGrave }: CemeteryMapProps) {
  const [scale, setScale] = useState<MapScale>();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const cemeteryMarkersRef = useRef<maplibregl.Marker[]>([]);
  const dataRef = useRef(data);
  const visibleGravesRef = useRef(visibleGraves);
  const searchResultIdsRef = useRef(searchResultIds);
  const selectedRef = useRef(selectedGrave ? graveSelectionKey(selectedGrave) : undefined);
  const onSelectRef = useRef(onSelectGrave);
  const didSkipInitialSelectionFitRef = useRef(false);

  useEffect(() => {
    dataRef.current = data;
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

      map.addSource("boundary", { type: "geojson", data: boundariesFeatureCollection(dataRef.current) });
      map.addLayer({
        id: "boundary-fill",
        type: "fill",
        source: "boundary",
        paint: { "fill-color": "#dfe7d9", "fill-opacity": 0.9 },
      });
      map.addLayer({
        id: "boundary-line",
        type: "line",
        source: "boundary",
        paint: { "line-color": "#3b4f3d", "line-width": 3 },
      });

      fitMapToData(map, dataRef.current, 0);

      map.addSource("sections", { type: "geojson", data: sectionsFeatureCollection(dataRef.current) });
      map.addLayer({
        id: "sections-fill",
        type: "fill",
        source: "sections",
        paint: { "fill-color": "#f7f4ea", "fill-opacity": 0.28 },
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

      map.addSource("graves", {
        type: "geojson",
        data: gravesFeatureCollection(visibleGravesRef.current, selectedRef.current, searchResultIdsRef.current),
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

      syncCemeteryMarkers(map, dataRef.current, cemeteryMarkers);

      const selectGraveFeature = (event: maplibregl.MapLayerMouseEvent) => {
        const key = event.features?.[0]?.properties?.key;
        const grave = dataRef.current.graves.find((item) => graveSelectionKey(item) === key);
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

    if (boundarySource || sectionsSource) {
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
            <i className="legend-symbol legend-boundary" />
            Cemetery boundary
          </span>
          <span>
            <i className="legend-symbol legend-section" />
            Section polygon
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
