import assert from "node:assert/strict";
import test from "node:test";
import { toEntry } from "./northHillsReview/reviewMapping.mjs";

function match(index, evidence = []) {
  return {
    burialId: `burial-${index}`,
    fullName: index === 5 ? "William Opperman" : `Person ${index}`,
    graveId: index === 5 ? "0094E" : `grave-${index}`,
    gravesiteEvidence: evidence,
    headstoneCandidates: [{ id: "shared-marker", evidence: [{ status: "linked" }] }],
  };
}
const original = Array.from({ length: 5 }, (_, index) => match(index, [{ status: "linked" }]));

test("extra suggestions preserve completed readings, including shared marker decisions", () => {
  const before = toEntry({ candidate_matches: original });
  const after = toEntry({ candidate_matches: [...original, match(5), match(6)] });
  assert.deepEqual(after.processingSummary, before.processingSummary);
  assert.equal(after.processingSummary.isProcessed, true);
  assert.equal(after.candidateMatchCount, 5);
  assert.equal(after.additionalCandidateMatches[0].fullName, "William Opperman");
  assert.equal(after.additionalCandidateMatches[0].graveId, "0094E");
  assert.deepEqual(after.candidateMatches, before.candidateMatches);
});

for (const status of ["linked", "rejected", "needs_field_check"]) {
  test(`explicit ${status} decisions keep extra gravesites visible without adding pending markers`, () => {
    const extra = { ...match(5, [{ status }]), headstoneCandidates: [{ id: "unreviewed-marker", evidence: [] }] };
    const entry = toEntry({ candidate_matches: [...original, extra, match(6)] });
    assert.equal(entry.candidateMatches.length, 6);
    assert.equal(entry.candidateMatches[5].gravesiteEvidence[0].status, status);
    assert.equal(entry.additionalCandidateMatches.length, 1);
    assert.equal(entry.processingSummary.isProcessed, true);
    assert.equal(entry.processingSummary.pendingCount, 0);
    assert.equal(entry.processingSummary.totalCount, 11);
  });
}

test("unlinking an extra match returns it to optional suggestions without reopening the reading", () => {
  const entry = toEntry({ candidate_matches: [...original, match(5)] });
  assert.equal(entry.candidateMatches.length, 5);
  assert.equal(entry.additionalCandidateMatches.length, 1);
  assert.equal(entry.processingSummary.isProcessed, true);
});

test("original pending work and source facts still count", () => {
  const row = { candidate_matches: [match(0), ...original.slice(1)], source_facts: [{ status: "staged" }] };
  const before = toEntry(row);
  const after = toEntry({ ...row, candidate_matches: [...row.candidate_matches, match(5)] });
  assert.deepEqual(after.processingSummary, before.processingSummary);
  assert.equal(after.processingSummary.pendingCount, 2);
  assert.equal(after.processingSummary.isProcessed, false);
});
