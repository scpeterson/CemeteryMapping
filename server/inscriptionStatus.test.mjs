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

test("current legibility and historical transcription validation remain independent", async () => {
  const { validateHistoricalTranscriptions, validateCurrentLegibility } = await import("./markerFaces.mjs");
  const historical = [{ id, text: "  OLD\n[illegible lines]  ", source: "NHG", sourceDate: "2005" }];
  assert.deepEqual(validateHistoricalTranscriptions(historical), [{ ...historical[0], sourceDate: "2005-10-11" }]);
  assert.equal(validateCurrentLegibility("illegible", ""), "illegible");
  assert.throws(() => validateCurrentLegibility("illegible", "current text"), /cannot contain text/);
  assert.throws(() => validateCurrentLegibility("invented", ""), /Invalid current legibility/);
  for (const sourceDate of ["2005-02-30", "0000", "yesterday"]) assert.throws(() => validateHistoricalTranscriptions([{ ...historical[0], sourceDate }]));
  assert.throws(() => validateHistoricalTranscriptions([{ ...historical[0], source: "" }]), /need text and a source/);
  const result = validateHeadstonePayload({ ...payload, inscription: "", inscriptionStatus: "illegible", currentLegibility: "illegible", historicalTranscriptions: historical });
  assert.deepEqual(result.historicalTranscriptions, [{ ...historical[0], sourceDate: "2005-10-11" }]);
  assert.equal(result.currentLegibility, "illegible");
});

test("retired back field cannot silently discard a client's reading", () => {
  assert.throws(() => validateHeadstonePayload({...payload,backDescription:"Legacy Back"}), /Back face inscription/);
  assert.equal(Object.hasOwn(validateHeadstonePayload({...payload,backDescription:""}),"backDescription"),false);
});


test("whole-face placeholders match only complete bracketed values and preserve all other transcription bytes", async () => {
  const { inscriptionPlaceholder, normalizeInscriptionPlaceholder, wholeFaceInscription } = await import("../shared/inscriptionStatus.mjs");
  assert.deepEqual(wholeFaceInscription(), { inscription: "", inscriptionStatus: "not_recorded", currentLegibility: "unknown" });
  for (const [text, status] of [["[blank]", "blank"], [" \n[ILLEGIBLE]\t", "illegible"], ["[Blank]", "blank"]]) {
    const face = { id, label: "Front", inscription: text, inscriptionStatus: "transcribed", currentLegibility: "unknown", burialIds: [id], mediaAssetIds: [], historicalTranscriptions: [{ text: "Old reading" }] };
    assert.equal(inscriptionPlaceholder(text), status);
    assert.deepEqual(normalizeInscriptionPlaceholder(face), { ...face, inscription: "", inscriptionStatus: status, currentLegibility: status });
    assert.equal(face.inscription, text, "normalization must not mutate the source record");
  }
  for (const inscription of ["", " \n", "blank", "illegible", "Blank family", "Illegible inscription noted", "  ALICE\n[blank]\n[illegible]  ", "[blank] surname", "[illegible lines]", "[blank] [illegible]", "[ blank ]"]) {
    const face = { inscription, inscriptionStatus: "transcribed" };
    assert.equal(inscriptionPlaceholder(inscription), undefined);
    assert.equal(normalizeInscriptionPlaceholder(face), face);
    assert.equal(normalizeInscriptionPlaceholder(face).inscription, inscription);
  }
});
