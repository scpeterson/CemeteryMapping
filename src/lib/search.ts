import type { CemeteryData, GraveStatus, SearchMatch } from "../types";
import { formatDate, fullName, normalize, statusLabels } from "./format";

const addReason = (reasons: string[], label: string, value: string | undefined, query: string) => {
  if (!value) return;
  if (normalize(value).includes(query)) reasons.push(`${label}: ${value}`);
};

export function searchGraves(data: CemeteryData, query: string, statuses: Set<GraveStatus>): SearchMatch[] {
  const cleaned = normalize(query);

  return data.graves
    .filter((grave) => statuses.has(grave.status))
    .map((grave) => {
      const owners = grave.currentOwnerIds.map((id) => data.owners.find((owner) => owner.id === id)?.displayName).filter(Boolean);
      const reasons: string[] = [];

      if (!cleaned) {
        reasons.push(statusLabels[grave.status]);
        return { grave, reasons };
      }

      addReason(reasons, "Grave", `${grave.section}-${grave.lot}-${grave.space}`, cleaned);
      addReason(reasons, "Status", statusLabels[grave.status], cleaned);
      owners.forEach((owner) => addReason(reasons, "Owner", owner, cleaned));

      grave.burials.forEach((burial) => {
        addReason(reasons, "Burial", fullName(burial.person), cleaned);
        addReason(reasons, "Birth", burial.person.birthDate, cleaned);
        addReason(reasons, "Birth", formatDate(burial.person.birthDate), cleaned);
        addReason(reasons, "Death", burial.person.deathDate, cleaned);
        addReason(reasons, "Death", formatDate(burial.person.deathDate), cleaned);
        addReason(reasons, "Burial date", burial.burialDate, cleaned);
        addReason(reasons, "Burial date", formatDate(burial.burialDate), cleaned);
      });

      grave.ownershipHistory.forEach((event) => {
        event.ownerIds
          .map((id) => data.owners.find((owner) => owner.id === id)?.displayName)
          .filter(Boolean)
          .forEach((owner) => addReason(reasons, "Historical owner", owner, cleaned));
        addReason(reasons, "Ownership date", event.effectiveDate, cleaned);
        addReason(reasons, "Ownership date", formatDate(event.effectiveDate), cleaned);
        addReason(reasons, "Document", event.documentReference, cleaned);
      });

      return { grave, reasons };
    })
    .filter((match) => match.reasons.length > 0)
    .sort((a, b) => a.grave.id.localeCompare(b.grave.id));
}
