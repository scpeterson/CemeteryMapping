import { useEffect, useRef } from "react";
import maplibregl, { type Map, type GeoJSONSource } from "maplibre-gl";
import type { CemeteryData, GraveSpace } from "../types";
import { gravesFeatureCollection, sectionsFeatureCollection } from "../lib/geojson";
import { statusColors } from "../lib/format";

type CemeteryMapProps = {
  data: CemeteryData;
  selectedGrave?: GraveSpace;
  visibleGraves: GraveSpace[];
  searchResultIds: Set<string>;
  onSelectGrave: (grave: GraveSpace) => void;
};

const center: [number, number] = [-76.70431, 39.19604];

export function CemeteryMap({ data, selectedGrave, visibleGraves, searchResultIds, onSelectGrave }: CemeteryMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const selectedRef = useRef(selectedGrave?.id);
  const onSelectRef = useRef(onSelectGrave);

  useEffect(() => {
    selectedRef.current = selectedGrave?.id;
    onSelectRef.current = onSelectGrave;
  }, [onSelectGrave, selectedGrave?.id]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      center,
      zoom: 18.5,
      minZoom: 17,
      maxZoom: 22,
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

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");

    map.on("load", () => {
      if (data.boundary) {
        map.addSource("boundary", { type: "geojson", data: data.boundary });
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
      }

      map.addSource("sections", { type: "geojson", data: sectionsFeatureCollection(data) });
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
        data: gravesFeatureCollection(data.graves, selectedRef.current),
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

      map.on("mouseenter", "graves-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "graves-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("click", "graves-fill", (event) => {
        const id = event.features?.[0]?.properties?.id;
        const grave = data.graves.find((item) => item.id === id);
        if (grave) onSelectRef.current(grave);
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [data]);

  useEffect(() => {
    const source = mapRef.current?.getSource("graves") as GeoJSONSource | undefined;
    source?.setData(gravesFeatureCollection(visibleGraves, selectedGrave?.id, searchResultIds));
  }, [searchResultIds, selectedGrave?.id, visibleGraves]);

  useEffect(() => {
    if (!selectedGrave || !mapRef.current) return;
    const ring = selectedGrave.geometry.coordinates[0];
    const bounds = ring.reduce((mapBounds, coordinate) => mapBounds.extend(coordinate as [number, number]), new maplibregl.LngLatBounds(ring[0] as [number, number], ring[0] as [number, number]));
    mapRef.current.fitBounds(bounds, { padding: 140, maxZoom: 20.5, duration: 450 });
  }, [selectedGrave]);

  return <div ref={containerRef} className="map-canvas" aria-label="Interactive cemetery map" />;
}
