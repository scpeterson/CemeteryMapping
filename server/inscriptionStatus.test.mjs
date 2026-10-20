import assert from "node:assert/strict";
import test from "node:test";
import { inscriptionMissing } from "../shared/inscriptionStatus.mjs";
import { validateHeadstonePayload } from "./routes/cemeteryRouteValidation.mjs";
const id = "11111111-1111-4111-8111-111111111111";
const payload = { markerTypeId: id, markerScopeId: id, materialId: id, conditionId: id };
test("monument API rejects text for Blank/Illegible statuses", () => {
  for (const inscriptionStatus of ["blank", "illegible"]) {
    const result = validateHeadstonePayload({ ...payload, inscriptionStatus, inscription: "" });
    assert.equal(result.inscriptionStatus, inscriptionStatus);
    for (const inscription of ["Some text", " ", "[illegible]"]) {
      assert.throws(() => validateHeadstonePayload({ ...payload, inscriptionStatus, inscription }), /cannot contain text/);
    }
  }
  assert.throws(() => validateHeadstonePayload({ ...payload, inscriptionStatus: "invalid" }), /Invalid inscription status/);
});
test("missing inscription decisions honor status and preserve legacy and partial text", () => {
  for (const status of ["blank", "illegible"]) assert.equal(inscriptionMissing(status, ""), false);
  assert.equal(inscriptionMissing("not_recorded", ""), true);
  assert.equal(inscriptionMissing("transcribed", " \n"), true);
  for (const text of ["[blank]", "[illegible]", "ALICE\n[blank]\n[illegible lines]"]) {
    assert.equal(inscriptionMissing(undefined, text), false);
    assert.equal(inscriptionMissing("transcribed", text), false);
  }
});
