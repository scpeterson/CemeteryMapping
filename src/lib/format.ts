import type { GraveSpaceSummary, GraveStatus } from "../types";

export const statusLabels: Record<GraveStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  occupied: "Occupied",
  sold: "Sold",
  needs_review: "Needs review",
  unknown: "Unknown",
};

export const statusColors: Record<GraveStatus, string> = {
  available: "#5fa879",
  reserved: "#d9a441",
  occupied: "#2f6fbd",
  sold: "#8e6fbb",
  needs_review: "#c7524f",
  unknown: "#b8c0c8",
};

export function formatDate(date?: string) {
  if (!date) return "Unknown";
  if (/^\d{4}$/u.test(date)) return date;
  const yearMonth = /^(\d{4})-(\d{2})$/u.exec(date);
  if (yearMonth) {
    const parsedMonth = new Date(`${yearMonth[1]}-${yearMonth[2]}-01T00:00:00`);
    if (!Number.isNaN(parsedMonth.getTime())) {
      return new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
      }).format(parsedMonth);
    }
  }
  if (/^(?:Jan\.?|January|Feb\.?|February|Mar\.?|March|Apr\.?|April|May|Jun\.?|June|Jul\.?|July|Aug\.?|August|Sep\.?|Sept\.?|September|Oct\.?|October|Nov\.?|November|Dec\.?|December)\s+\d{4}$/iu.test(date)) return date;
  const normalizedDate = /^\d{4}-\d{2}-\d{2}$/u.test(date) ? `${date}T00:00:00` : date;
  const parsedDate = new Date(normalizedDate);
  if (Number.isNaN(parsedDate.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsedDate);
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

export function graveSelectionKey(grave: Pick<GraveSpaceSummary, "cemeteryId" | "id">) {
  return `${grave.cemeteryId}:${grave.id}`;
}

export function normalize(value: string) {
  return value.trim().toLowerCase();
}
