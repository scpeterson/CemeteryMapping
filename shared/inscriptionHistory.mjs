export const legibilityValues = ["unknown", "legible", "partially_legible", "blank", "illegible"];
export const legibilityLabels = { unknown: "Not assessed", legible: "Legible", partially_legible: "Partially legible", blank: "Blank", illegible: "Illegible" };
export function currentLegibility(value, status) {
  return value ?? (["blank", "illegible"].includes(status) ? status : "unknown");
}
export function preserveTranscription(history, text) {
  const existing = history ?? [];
  if (!String(text ?? "").trim() || existing.some((entry) => entry.text === text)) return existing;
  return [...existing, { id: globalThis.crypto.randomUUID(), text, source: "Previous current transcription (source not recorded)", sourceDate: "" }];
}
