import type { MonumentInspection } from "../types";

/** Keep Overview and inspection history on the same visit, including year-only records. */
export function sortedMonumentInspections(inspections: MonumentInspection[] = []) {
  const dateKey = (inspection: MonumentInspection) => inspection.inspectedAt || `${String(inspection.inspectionYear).padStart(4, "0")}-00-00`;
  return [...inspections].sort((a, b) => dateKey(b).localeCompare(dateKey(a))
    || (b.updatedAt || "").localeCompare(a.updatedAt || "") || b.id.localeCompare(a.id));
}

export const inspectionTypeLabels = { field_survey: "Field inspection", nhg: "NHG", historical: "Historical inspection" };
