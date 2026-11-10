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

test("exact NHG locations lead main suggestions without displacing matches or reopening completed work", () => {
  const exact = { ...match(5), graveId: "0567", exactNhgLocation: true, headstoneCandidates: [{ id: "567", evidence: [] }] };
  const before = toEntry({ candidate_matches: [...original, exact, match(6)] });
  const baseline = toEntry({ candidate_matches: [...original, { ...exact, exactNhgLocation: false }, match(6)] });
  assert.equal(before.candidateMatches[0].graveId, "0567");
  assert.equal(before.candidateMatches.length, 6);
  assert.deepEqual(before.candidateMatches.slice(1), baseline.candidateMatches);
  assert.deepEqual(before.additionalCandidateMatches.map((m) => m.burialId), ["burial-6"]);
  assert.deepEqual(before.processingSummary, baseline.processingSummary);
  assert.equal(before.processingSummary.isProcessed, true);
  assert.deepEqual(before.candidateMatches[0].gravesiteEvidence, []);
});

test("exact location display priority preserves stable score order and original pending work", () => {
  const matches = [match(0), { ...match(1), exactNhgLocation: true }, match(2), match(3), match(4), { ...match(5), exactNhgLocation: true }, match(6)];
  const entry = toEntry({ candidate_matches: matches });
  assert.deepEqual(entry.candidateMatches.map((m) => m.burialId), ["burial-1", "burial-5", "burial-0", "burial-2", "burial-3", "burial-4"]);
  assert.equal(entry.processingSummary.pendingCount, 5);
  assert.equal(entry.processingSummary.isProcessed, false);
  assert.deepEqual(entry.additionalCandidateMatches.map((m) => m.burialId), ["burial-6"]);
});
