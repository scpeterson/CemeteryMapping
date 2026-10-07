export const veteranValues = Object.freeze(["yes", "y", "true", "1", "veteran"]);
export function isVeteran(value) {
  return veteranValues.includes(String(value ?? "").trim().toLowerCase());
}
export function normalizeSearchText(value) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/gu, "");
}
