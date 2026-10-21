import assert from "node:assert/strict";
import test from "node:test";
import { runReport } from "./reportsRepository.mjs";
import { reportMonumentRecord } from "./reports/monumentNavigation.mjs";

for (const reportId of ["missing-monument-inscriptions", "monument-photo-exceptions"]) {
  test(`${reportId} includes the monument target and location for each exception`, async () => {
    const row = {
      marker_uuid: "marker-1", monument: "TLC-HS-0270", cemetery_id: "cemetery-1", cemetery: "Test Cemetery",
      gravesite_id: "GPS-270", gravesites: "C-0270", section: "C", marker_type: "Upright", marker_scope: "Single",
      geometry: { type: "Point", coordinates: [-80, 40] },
      faces: [], inscription: "", inscription_status: "not_recorded", photo_count: 0, primary_count: 0, legacy_photo: false,
    };
    const pool = { async connect() { return { async query() { return { rows: [row] }; }, release() {} }; } };
    const result = await runReport(pool, reportId, {}, { role: "admin" });
    assert.equal(result.rows.length, 1);
    const target = result.rows[0].monumentRecord;
    assert.equal(target.id, row.marker_uuid);
    assert.equal(target.headstoneId, row.monument);
    assert.equal(target.cemeteryId, row.cemetery_id);
    assert.equal(target.gravesiteId, row.gravesite_id);
    assert.deepEqual(target.geometry, row.geometry);
  });
}

test("standalone monument targets preserve null geometry without inventing a map location", () => {
  const target = reportMonumentRecord({ marker_uuid: "marker-2", monument: "TLC-HS-0165", cemetery_id: "cemetery-1" });
  assert.equal(target.id, "marker-2");
  assert.equal(target.gravesiteId, null);
  assert.equal(target.geometry, null);
  assert.equal(target.graveKey, "cemetery-1:headstone:TLC-HS-0165");
});
