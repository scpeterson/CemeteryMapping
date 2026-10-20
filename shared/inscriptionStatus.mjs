export const inscriptionStatuses = ["not_recorded", "transcribed", "blank", "illegible"];
export function inscriptionStatus(status, text) {
  return status ?? (String(text ?? "").trim() ? "transcribed" : "not_recorded");
}
export function inscriptionAllowsText(status) {
  return status !== "blank" && status !== "illegible";
}
export function inscriptionMissing(status, text) {
  const resolved = inscriptionStatus(status, text);
  return resolved === "not_recorded" || (resolved === "transcribed" && !String(text ?? "").trim());
}
