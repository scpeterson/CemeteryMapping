import type { GraveSpaceSummary, GraveStatus } from "../types";

export const statusLabels: Record<GraveStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  occupied: "Occupied",
  sold: "Sold",
  unknown: "Needs review",
};

export const statusColors: Record<GraveStatus, string> = {
  available: "#5fa879",
  reserved: "#d9a441",
  occupied: "#6d7f91",
  sold: "#8e6fbb",
  unknown: "#c7524f",
};

export function formatDate(date?: string) {
  if (!date) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export function fullName(person: { firstName: string; middleName?: string; lastName: string }) {
  return [person.firstName, person.middleName, person.lastName].filter(Boolean).join(" ");
}

export function formatGraveLabel(grave: Pick<GraveSpaceSummary, "section" | "lot" | "space">) {
  return [grave.section, grave.lot, grave.space].map((value) => value.trim()).filter(Boolean).join("-");
}

export function formatGraveLocation(grave: Pick<GraveSpaceSummary, "section" | "lot" | "space">) {
  return [
    grave.section ? `Section ${grave.section}` : undefined,
    grave.lot ? `Lot ${grave.lot}` : undefined,
    grave.space ? `Space ${grave.space}` : undefined,
  ]
    .filter(Boolean)
    .join(", ");
}

export function normalize(value: string) {
  return value.trim().toLowerCase();
}
