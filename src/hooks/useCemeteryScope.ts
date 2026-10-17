import { useMemo } from "react";
import type { CemeteryData, CurrentUser } from "../types";

export function useCemeteryScope(data: CemeteryData, currentUser: CurrentUser | undefined, adminCemeteryScope: string) {
  const cemeteryScope = currentUser?.role === "admin"
    ? adminCemeteryScope
    : currentUser?.assignedCemeteryIds.length === 1 ? currentUser.assignedCemeteryIds[0] : null;

  const cemeteries = useMemo(() => {
    const names = new Map<string, string>();
    for (const boundary of data.boundaries ?? (data.boundary ? [data.boundary] : [])) {
      if (boundary.properties.id) names.set(boundary.properties.id, boundary.properties.name);
    }
    for (const grave of data.graves) names.set(grave.cemeteryId, grave.cemeteryName);
    return [...names].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);
  const mapData = useMemo<CemeteryData>(() => {
    if (cemeteryScope === "") return data;
    if (cemeteryScope === null) return { boundaries: [], sections: [], lots: [], graves: [], headstones: [], lotRestrictedAreas: [] };
    const name = cemeteries.find((cemetery) => cemetery.id === cemeteryScope)?.name;
    const boundaries = (data.boundaries ?? (data.boundary ? [data.boundary] : [])).filter((boundary) =>
      boundary.properties.id ? boundary.properties.id === cemeteryScope : boundary.properties.name === name);
    return {
      ...data,
      boundary: boundaries[0],
      boundaries,
      graves: data.graves.filter((grave) => grave.cemeteryId === cemeteryScope),
      lots: data.lots.filter((lot) => lot.cemeteryId === cemeteryScope),
      headstones: data.headstones.filter((marker) => marker.cemeteryId === cemeteryScope),
      lotRestrictedAreas: data.lotRestrictedAreas?.filter((area) => area.cemeteryId === cemeteryScope),
    };
  }, [data, cemeteryScope, cemeteries]);
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
