export const validConfidence = new Set(["high", "medium", "low", "review"]);
export const validStatuses = new Set(["staged", "reviewed", "promoted", "rejected"]);
export const validSorts = new Set(["review", "page"]);
export const validEvidenceTargetTypes = new Set(["headstone", "gravesite"]);
export const validEvidenceStatuses = new Set(["linked", "rejected", "needs_field_check"]);
const validSourceFactStatuses = new Set(["staged", "reviewed", "promoted", "rejected"]);
const validObservationTypes = new Set(["plot_marker", "gap", "marker_observation", "entry_note"]);
const validObservationStatuses = new Set(["staged", "reviewed", "rejected"]);

export function compact(value) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

export function normalizeLimit(value) {
  const limit = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(limit)) return 100;
  return Math.min(Math.max(limit, 25), 250);
}

export function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

export function normalizeIntegerArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => Number.parseInt(String(item ?? ""), 10)).filter((item) => Number.isFinite(item)))].sort((left, right) => left - right);
}

export function normalizeNullableInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number.parseInt(String(value), 10);
  if (!Number.isFinite(number)) throw new Error("North Hills location numbers must be integers.");
  return number;
}

export function normalizeSourceFactInput(fact) {
  const sourceCode = String(fact?.sourceCode ?? "").trim().toUpperCase();
  const factType = String(fact?.factType ?? "").trim();
  const factValue = String(fact?.factValue ?? "").trim();
  const confidence = String(fact?.confidence ?? "review").trim() || "review";
  const status = String(fact?.status ?? "staged").trim() || "staged";
  if (!["CR", "CRG"].includes(sourceCode)) throw new Error("Source fact code must be CR or CRG.");
  if (!["death_date", "death_place", "middle_initial", "age_at_death", "note"].includes(factType)) throw new Error(`Unsupported North Hills source fact type: ${factType}`);
  if (!factValue) throw new Error("Source fact value is required.");
  if (!validConfidence.has(confidence)) throw new Error(`Unsupported North Hills source fact confidence: ${confidence}`);
  if (!validSourceFactStatuses.has(status)) throw new Error(`Unsupported North Hills source fact status: ${status}`);
  return {
    id: String(fact?.id ?? "").trim() || null,
    sourceCode,
    sourceLabel: sourceCode === "CRG" ? "Church Records in German" : "Church Records",
    factType,
    factValue,
    factDate: String(fact?.factDate ?? "").trim() || null,
    rawText: String(fact?.rawText ?? "").trim() || `${sourceCode}: ${factValue}`,
    confidence,
    status,
    reviewNotes: String(fact?.reviewNotes ?? "").trim() || null,
  };
}

export function normalizeObservationInput(observation) {
  const observationType = String(observation?.observationType ?? "").trim();
  const observationText = String(observation?.observationText ?? "").trim();
  const status = String(observation?.status ?? "staged").trim() || "staged";
  if (!validObservationTypes.has(observationType)) throw new Error(`Unsupported North Hills observation type: ${observationType}`);
  if (!observationText) throw new Error("Observation text is required.");
  if (!validObservationStatuses.has(status)) throw new Error(`Unsupported North Hills observation status: ${status}`);
  return {
    id: String(observation?.id ?? "").trim() || null,
    observationType,
    observationText,
    status,
  };
}

