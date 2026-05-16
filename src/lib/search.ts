import type { CemeteryData, GraveStatus, SearchMatch } from "../types";
import { normalize, statusLabels } from "./format";

const addReason = (reasons: string[], label: string, value: string | undefined, query: string) => {
  if (!value) return;
  if (normalize(value).includes(query)) reasons.push(`${label}: ${value}`);
};

export function searchGraves(data: CemeteryData, query: string, statuses: Set<GraveStatus>): SearchMatch[] {
  const cleaned = normalize(query);

  return data.graves
    .filter((grave) => statuses.has(grave.status))
    .map((grave) => {
      const reasons: string[] = [];

      if (!cleaned) {
        reasons.push(statusLabels[grave.status]);
        return { grave, reasons };
      }

      addReason(reasons, "Grave", `${grave.section}-${grave.lot}-${grave.space}`, cleaned);
      addReason(reasons, "Status", statusLabels[grave.status], cleaned);

      return { grave, reasons };
    })
    .filter((match) => match.reasons.length > 0)
    .sort((a, b) => a.grave.id.localeCompare(b.grave.id));
}
