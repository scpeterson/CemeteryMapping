// Photo evidence is manually reviewed, not a field survey. Keep the evidence
// itself in source_properties while exposing the supported verification method.
export function normalizeProvenanceVerificationSource(value) {
  return value === "field_photo" ? "manual_review" : value;
}
