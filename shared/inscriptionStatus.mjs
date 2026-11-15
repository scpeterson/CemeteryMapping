export const inscriptionStatuses = ["not_recorded", "transcribed", "blank", "illegible"];
export function inscriptionStatus(status, text) {
  return status ?? (String(text ?? "").trim() ? "transcribed" : "not_recorded");
}
export function inscriptionAllowsText(status) {
  return status !== "blank" && status !== "illegible";
}
export function inscriptionMissing(status, text, legibility) {
  if (["blank", "illegible"].includes(legibility)) return false;
  const resolved = inscriptionStatus(status, text);
  return resolved === "not_recorded" || (resolved === "transcribed" && !String(text ?? "").trim());
}

export function inscriptionPlaceholder(text) {
  const match = /^\[(blank|illegible)\]$/iu.exec(String(text ?? "").trim());
  return match?.[1].toLowerCase();
}

export function wholeFaceInscription(status) {
  return { inscription: "", inscriptionStatus: status ?? "not_recorded", currentLegibility: status ?? "unknown" };
}

export function normalizeInscriptionPlaceholder(value) {
  const status = inscriptionPlaceholder(value.inscription);
  return status ? { ...value, ...wholeFaceInscription(status) } : value;
}
