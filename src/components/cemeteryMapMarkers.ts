import maplibregl, { type Map } from "maplibre-gl";
import type { CemeteryData } from "../types";
import { cemeteryMarkersFeatureCollection } from "../lib/geojson";
import { fitMapToGeometry } from "./cemeteryMapBounds";

export function syncCemeteryMarkers(map: Map, data: CemeteryData, markers: maplibregl.Marker[]) {
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
