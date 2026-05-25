import { getDetailedCemeteryData } from "./cemeteryRepository.mjs";

const statusLabels = {
  available: "Available",
  reserved: "Reserved",
  occupied: "Occupied",
  sold: "Sold",
  unknown: "Needs review",
};

function normalize(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "");
}

function formatDate(value) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function fullName(person) {
  return [person.firstName, person.middleName, person.lastName].filter(Boolean).join(" ");
}

function addReason(reasons, label, value, query) {
  if (!value) return;
  if (normalize(value).includes(query)) reasons.push(`${label}: ${value}`);
}

function toSearchSummary(grave) {
  return {
    id: grave.id,
    cemeteryId: grave.cemeteryId,
    cemeteryName: grave.cemeteryName,
    section: grave.section,
    lot: grave.lot,
    space: grave.space,
    status: grave.status,
    geometry: grave.geometry,
  };
}

export async function searchCemetery(pool, { query = "", statuses = [], includeOwnership = true } = {}) {
  const data = await getDetailedCemeteryData(pool, { includeOwnership });
  const cleaned = normalize(query);
  const allowedStatuses = new Set(statuses.length ? statuses : Object.keys(statusLabels));

  return data.graves
    .filter((grave) => allowedStatuses.has(grave.status))
    .map((grave) => {
      const owners = grave.currentOwnerIds.map((id) => data.owners.find((owner) => owner.id === id)?.displayName).filter(Boolean);
      const reasons = [];

      if (!cleaned) {
        reasons.push(statusLabels[grave.status]);
        return { grave: toSearchSummary(grave), reasons };
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

      return { grave: toSearchSummary(grave), reasons };
    })
    .filter((match) => match.reasons.length > 0)
    .sort((a, b) => `${a.grave.cemeteryId}:${a.grave.id}`.localeCompare(`${b.grave.cemeteryId}:${b.grave.id}`));
}
