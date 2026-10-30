import { useMemo } from "react";
import type { CemeteryData, CurrentUser } from "../types";

export function useCemeteryScope(data: CemeteryData, currentUser: CurrentUser | undefined, adminCemeteryScope: string) {
  const cemeteryScope = currentUser?.role === "admin"
    ? adminCemeteryScope
    : currentUser?.assignedCemeteryIds.length === 1 ? currentUser.assignedCemeteryIds[0] : null;

  const availableBoundaries = useMemo(() => data.boundaries ?? (data.boundary ? [data.boundary] : []), [data.boundaries, data.boundary]);
  const cemeteries = useMemo(() => {
    const names = new Map<string, string>();
    for (const boundary of availableBoundaries) {
      if (boundary.properties.id) names.set(boundary.properties.id, boundary.properties.name);
    }
    for (const grave of data.graves) names.set(grave.cemeteryId, grave.cemeteryName);
    return [...names].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [availableBoundaries, data.graves]);
  const scopeName = cemeteries.find((cemetery) => cemetery.id === cemeteryScope)?.name;
  const boundaries = useMemo(() => {
    if (cemeteryScope === "") return availableBoundaries;
    if (cemeteryScope === null) return [];
    return availableBoundaries.filter((boundary) => boundary.properties.id
      ? boundary.properties.id === cemeteryScope : boundary.properties.name === scopeName);
  }, [availableBoundaries, cemeteryScope, scopeName]);
  const graves = useMemo(() => cemeteryScope === "" ? data.graves
    : data.graves.filter((grave) => grave.cemeteryId === cemeteryScope), [data.graves, cemeteryScope]);
  const lots = useMemo(() => cemeteryScope === "" ? data.lots
    : data.lots.filter((lot) => lot.cemeteryId === cemeteryScope), [data.lots, cemeteryScope]);
  const headstones = useMemo(() => cemeteryScope === "" ? data.headstones
    : data.headstones.filter((marker) => marker.cemeteryId === cemeteryScope), [data.headstones, cemeteryScope]);
  const lotRestrictedAreas = useMemo(() => cemeteryScope === "" ? data.lotRestrictedAreas
    : data.lotRestrictedAreas?.filter((area) => area.cemeteryId === cemeteryScope), [data.lotRestrictedAreas, cemeteryScope]);
  const sections = useMemo(() => cemeteryScope === null ? [] : data.sections, [data.sections, cemeteryScope]);
  const mapData = useMemo<CemeteryData>(() => cemeteryScope === "" ? data : {
    ...data, boundary: boundaries[0], boundaries, graves, lots, headstones, lotRestrictedAreas, sections,
  }, [data, cemeteryScope, boundaries, graves, lots, headstones, lotRestrictedAreas, sections]);
  const cemeteryScopeLabel = useMemo(() => {
    if (!currentUser) return "Loading cemetery…";
    if (currentUser.role !== "admin") {
      if (cemeteryScope === null) return "Contact your administrator to register one cemetery.";
      return cemeteries.find((cemetery) => cemetery.id === cemeteryScope)?.name ?? "Your registered cemetery";
    }
    const cemeteryNames = [...new Set((data.boundaries ?? (data.boundary ? [data.boundary] : [])).map((boundary) => boundary.properties.name))];
    if (cemeteryNames.length === 0) return "Cemetery records";
    if (cemeteryNames.length === 1) return "1 cemetery";
    return `${cemeteryNames.length} cemeteries`;
  }, [data.boundaries, data.boundary, currentUser, cemeteryScope, cemeteries]);

  return { cemeteryScope, cemeteries, mapData, cemeteryScopeLabel };
}
