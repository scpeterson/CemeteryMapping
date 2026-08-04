import type { CemeteryData, GraveStatus, LotSearchMatch, SearchMatch } from "../types";
import { formatGraveLabel, graveSelectionKey, lotSelectionKey, normalize, statusLabels } from "./format";

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

      addReason(reasons, "Grave", formatGraveLabel(grave), cleaned);
      addReason(reasons, "Status", statusLabels[grave.status], cleaned);

      return { grave, reasons };
    })
    .filter((match) => match.reasons.length > 0)
    .sort((a, b) => graveSelectionKey(a.grave).localeCompare(graveSelectionKey(b.grave)));
}

export function searchLots(data: CemeteryData, query: string): LotSearchMatch[] {
  const cleaned = normalize(query);
  if (!cleaned) return [];

  return data.lots
    .map((lot) => {
      const reasons: string[] = [];
      const sectionLot = [lot.section, lot.block, lot.id].map((value) => value?.trim()).filter(Boolean).join("-");

      addReason(reasons, "Lot", sectionLot, cleaned);
      addReason(reasons, "Lot name", lot.name, cleaned);

      return { lot, reasons };
    })
    .filter((match) => match.reasons.length > 0)
    .sort((a, b) => lotSelectionKey(a.lot).localeCompare(lotSelectionKey(b.lot)));
}
