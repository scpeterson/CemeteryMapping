import { useEffect, useMemo, type RefObject } from "react";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import type { CemeteryData, CemeteryLot, GraveSpaceSummary, GraveStatus, HeadstoneSummary } from "../types";
import { boundariesFeatureCollection, gravesFeatureCollection, headstonesFeatureCollection, lotRestrictedAreasFeatureCollection, lotsFeatureCollection, sectionsFeatureCollection } from "../lib/geojson";
import { graveSelectionKey, lotSelectionKey } from "../lib/format";
import { createMapHighlightState, markerIdsByGrave, linkedMarkerIds } from "./mapHighlightState";
import { applyGraveStatusFilters } from "./mapStatusFilters";
import { syncCemeteryMarkers } from "./cemeteryMapMarkers";

export function veteranGraveKeySet(graves: GraveSpaceSummary[]) {
  return new Set(graves.filter(grave => grave.hasVeteran).map(grave => graveSelectionKey(grave)));
}

export function getGeoJsonSource(map: MapLibreMap, sourceName: string) {
  return map.getSource(sourceName) as GeoJSONSource | undefined;
}

type Input = {
  mapRef: RefObject<MapLibreMap | null>;
  cemeteryMarkersRef: RefObject<Marker[]>;
  highlightStateRef: RefObject<ReturnType<typeof createMapHighlightState>>;
  mapLoaded: boolean;
  data: CemeteryData;
  selectedGrave?: GraveSpaceSummary;
  selectedLot?: CemeteryLot;
  selectedHeadstone?: HeadstoneSummary;
  selectedStatuses: ReadonlySet<GraveStatus>;
  searchResultIds: Set<string>;
};

export function useCemeteryMapSources({ mapRef, cemeteryMarkersRef, highlightStateRef, mapLoaded, data,
  selectedGrave, selectedLot, selectedHeadstone, selectedStatuses, searchResultIds }: Input) {
  const { boundary, boundaries, sections, lots, lotRestrictedAreas, headstones } = data;
  const markerIndex = useMemo(() => markerIdsByGrave(headstones ?? []), [headstones]);
  const veteranKeys = useMemo(() => veteranGraveKeySet(data.graves), [data.graves]);
  const selectedGraveKey = selectedGrave ? graveSelectionKey(selectedGrave) : undefined;
  const selectedLotKey = selectedLot ? lotSelectionKey(selectedLot) : undefined;
  const selectedMarkerId = selectedHeadstone?.id;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const geometry = { boundary, boundaries };
    getGeoJsonSource(map, "boundary")?.setData(boundariesFeatureCollection(geometry));
    syncCemeteryMarkers(map, geometry, cemeteryMarkersRef.current);
  }, [boundary, boundaries, mapLoaded, mapRef, cemeteryMarkersRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && mapLoaded) getGeoJsonSource(map, "sections")?.setData(sectionsFeatureCollection({ sections }));
  }, [sections, mapLoaded, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && mapLoaded) getGeoJsonSource(map, "lot-restricted-areas")?.setData(lotRestrictedAreasFeatureCollection({ lotRestrictedAreas }));
  }, [lotRestrictedAreas, mapLoaded, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && mapLoaded) getGeoJsonSource(map, "lots")?.setData(lotsFeatureCollection({ lots }));
  }, [lots, mapLoaded, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && mapLoaded) getGeoJsonSource(map, "graves")?.setData(gravesFeatureCollection(data.graves));
  }, [data.graves, mapLoaded, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && mapLoaded) getGeoJsonSource(map, "headstones")?.setData(headstonesFeatureCollection(headstones ?? [], veteranKeys));
  }, [headstones, veteranKeys, mapLoaded, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && mapLoaded) applyGraveStatusFilters(map, selectedStatuses);
  }, [data.graves, selectedStatuses, mapLoaded, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const sync = highlightStateRef.current;
    sync(map, "graves", "selected", new Set(selectedGraveKey ? [selectedGraveKey] : []));
    sync(map, "lots", "selected", new Set(selectedLotKey ? [selectedLotKey] : []));
    sync(map, "headstones", "selected", selectedMarkerId ? new Set([selectedMarkerId]) : linkedMarkerIds(markerIndex, selectedGraveKey ? [selectedGraveKey] : []));
    sync(map, "graves", "searchMatch", searchResultIds);
    sync(map, "headstones", "searchMatch", linkedMarkerIds(markerIndex, searchResultIds));
  }, [selectedGraveKey, selectedLotKey, selectedMarkerId, searchResultIds, markerIndex, mapLoaded, mapRef, highlightStateRef]);
}
