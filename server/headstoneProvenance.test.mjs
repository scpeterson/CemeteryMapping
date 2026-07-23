import assert from "node:assert/strict";
import test from "node:test";
import { toHeadstone } from "./cemeteryMappers.mjs";
import { validateHeadstonePayload } from "./routes/cemeteryRouteValidation.mjs";

const validPayload = {
  markerTypeId: "11111111-1111-4111-8111-111111111111",
  materialId: "22222222-2222-4222-8222-222222222222",
  conditionId: "33333333-3333-4333-8333-333333333333",
};

test("headstone validation accepts structured NHG inclusion provenance", () => {
  const result = validateHeadstonePayload({
    ...validPayload,
    nhgInclusion: "not_listed",
    provenanceVerificationSource: "field_survey",
    provenanceVerifiedAt: "2026-07-23",
  });

  assert.equal(result.nhgInclusion, "not_listed");
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
    source_properties: {
      NormalizedProvenance: {
        nhgInclusion: "not_listed",
        markerGeometrySourceType: "field_survey",
        verifiedAt: "2026-07-23",
      },
    },
  });

  assert.equal(mapped.nhgInclusion, "not_listed");
  assert.equal(mapped.provenanceVerificationSource, "field_survey");
  assert.equal(mapped.provenanceVerifiedAt, "2026-07-23");
});
