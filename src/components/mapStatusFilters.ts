import type { FilterSpecification, Map } from "maplibre-gl";
import type { GraveStatus } from "../types";

/** Keep sources stable: visibility changes belong to layer filters. */
export function applyGraveStatusFilters(
  map: Pick<Map, "getLayer" | "setFilter">,
  statuses: ReadonlySet<GraveStatus>,
) {
  const statusFilter: FilterSpecification = ["in", ["get", "status"], ["literal", [...statuses]]];
  for (const layer of ["graves-fill", "graves-line", "grave-labels", "veteran-grave-symbols"]) {
    if (!map.getLayer(layer)) continue;
    map.setFilter(layer, layer === "veteran-grave-symbols"
      ? ["all", statusFilter, ["==", ["get", "hasVeteran"], true]]
      : statusFilter);
  }
}
