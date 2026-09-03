import assert from "node:assert/strict";
import test from "node:test";
import { toHeadstone } from "./cemeteryMappers.mjs";
import { validateHeadstonePayload } from "./routes/cemeteryRouteValidation.mjs";

const validPayload = {
  markerTypeId: "11111111-1111-4111-8111-111111111111",
  markerScopeId: "44444444-4444-4444-8444-444444444444",
  materialId: "22222222-2222-4222-8222-222222222222",
  conditionId: "33333333-3333-4333-8333-333333333333",
};

test("legacy field-photo provenance round-trips through marker editing", () => {
  for (const key of ["verificationSourceType", "markerGeometrySourceType"]) {
    const source = { Photos: [{ filename: "IMG_6211.HEIC" }], NormalizedProvenance: {
      [key]: "field_photo", nhgInclusion: "not_listed", verifiedAt: "2026-09-03",
    } };
    const before = structuredClone(source);
    const mapped = toHeadstone({ source_properties: source });
    assert.equal(mapped.provenanceVerificationSource, "manual_review");
    const result = validateHeadstonePayload({ ...validPayload,
      provenanceVerificationSource: mapped.provenanceVerificationSource,
      nhgInclusion: mapped.nhgInclusion, provenanceVerifiedAt: mapped.provenanceVerifiedAt });
    assert.equal(result.provenanceVerificationSource, "manual_review");
    assert.equal(result.nhgInclusion, "not_listed");
    assert.deepEqual(source, before);
  }
});

test("stale edit forms normalize field_photo but unsupported values remain rejected", () => {
  assert.equal(validateHeadstonePayload({ ...validPayload, provenanceVerificationSource: "field_photo" })
    .provenanceVerificationSource, "manual_review");
  for (const value of ["field_survey", "documentary_record", "manual_review", "import"]) {
    assert.equal(validateHeadstonePayload({ ...validPayload, provenanceVerificationSource: value })
      .provenanceVerificationSource, value);
  }
  assert.throws(() => validateHeadstonePayload({ ...validPayload, provenanceVerificationSource: "invalid" }),
    /Provenance verification source is invalid/u);
});

test("headstone validation accepts structured NHG inclusion provenance", () => {
  const result = validateHeadstonePayload({
    ...validPayload,
    nhgInclusion: "not_listed",
    provenanceVerificationSource: "field_survey",
    provenanceVerifiedAt: "2026-07-23",
  });

  assert.equal(result.nhgInclusion, "not_listed");
  assert.equal(result.markerScopeId, validPayload.markerScopeId);
  assert.equal(result.provenanceVerificationSource, "field_survey");
  assert.equal(result.provenanceVerifiedAt, "2026-07-23");
});

test("headstone validation rejects unsupported NHG inclusion values", () => {
  assert.throws(
    () => validateHeadstonePayload({ ...validPayload, nhgInclusion: "row_zero" }),
    /NHG inclusion is invalid/u,
  );
});

test("headstone mapping reads normalized provenance and supports legacy survey keys", () => {
  const mapped = toHeadstone({
    id: "marker-1",
    headstone_id: "TLC-HS-0161",
    marker_scope_id: "44444444-4444-4444-8444-444444444444",
    marker_scope_code: "monolith",
    marker_scope_label: "Monolith",
    source_properties: {
      NormalizedProvenance: {
        nhgInclusion: "not_listed",
        markerGeometrySourceType: "field_survey",
        verifiedAt: "2026-07-23",
      },
    },
  });

  assert.equal(mapped.nhgInclusion, "not_listed");
  assert.equal(mapped.markerScope.code, "monolith");
  assert.equal(mapped.provenanceVerificationSource, "field_survey");
  assert.equal(mapped.provenanceVerifiedAt, "2026-07-23");
});
