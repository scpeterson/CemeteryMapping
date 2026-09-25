import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { assignedEditableCemeteryIds, requireRole } from "../server/auth.mjs";
import { registerAdminReviewRoutes } from "../server/routes/adminReviewRoutes.mjs";
import { deleteNorthHillsOcrEvidenceLink } from "../server/northHillsReview/evidenceMutations.mjs";
import { validateNorthHillsEvidenceTargetPayload } from "../server/routes/adminRouteValidation.mjs";
import { validateUuid } from "../server/inputValidation.mjs";

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("evidence deletion enforces cemetery assignments through the authenticated route", async () => {
  // One connection keeps all fixtures in session-local tables, never real records.
  const pool = new pg.Pool({ ...loadApiConfig().database, max: 1 });
  try {
    await pool.query(`
      CREATE TEMP TABLE north_hills_ocr_entries (id uuid, cemetery_id uuid);
      CREATE TEMP TABLE north_hills_ocr_entry_headstone_links (
        id uuid, entry_id uuid, headstone_uuid uuid, status text, confidence text,
        notes text, reviewed_by_email text, reviewed_at timestamptz
      );
      CREATE TEMP TABLE north_hills_ocr_entry_gravesite_links (
        LIKE north_hills_ocr_entry_headstone_links
      );
      ALTER TABLE north_hills_ocr_entry_gravesite_links RENAME COLUMN headstone_uuid TO gravesite_uuid;
    `);
    await pool.query("INSERT INTO north_hills_ocr_entries VALUES ($1, $2), ($3, NULL)", [uuid(1), uuid(2), uuid(3)]);
    let handlers;
    const app = Object.fromEntries(["get", "post", "put", "delete"].map((method) => [method, (path, ...registered) => {
      if (method === "delete" && path.endsWith("/:entryId/evidence")) handlers = registered;
    }]));
    registerAdminReviewRoutes(app, {
      pool, assignedEditableCemeteryIds, deleteNorthHillsOcrEvidenceLink,
      validateUuid, validateNorthHillsEvidenceTargetPayload,
      requireCemeteryAdmin: requireRole({ mode: "trusted-header", roleHeader: "role", emailHeader: "email", subjectHeader: "subject" }, "cemetery-admin"),
    });
    for (const targetType of ["headstone", "gravesite"]) {
      const table = `north_hills_ocr_entry_${targetType}_links`;
      const column = `${targetType}_uuid`;
      for (const [role, assignment, entry, expected] of [
        ["reader", uuid(2), uuid(1), 403],
        ["cemetery-admin", "", uuid(1), 404],
        ["cemetery-admin", uuid(9), uuid(1), 404],
        ["cemetery-admin", uuid(2), uuid(3), 404],
        ["cemetery-admin", uuid(2), uuid(1), 200],
        ["admin", "", uuid(1), 200],
        ["admin", "", uuid(3), 200],
      ]) {
        await pool.query(`DELETE FROM ${table}`);
        await pool.query(`INSERT INTO ${table} (id, entry_id, ${column}) VALUES ($1, $2, $3)`, [uuid(4), entry, uuid(5)]);
        const headers = { role, email: "security-test@example.test", "x-cemetery-user-cemetery-ids": assignment };
        const request = { get: (name) => headers[name], params: { entryId: entry }, body: { targetType, targetId: uuid(5) } };
        let status = 200;
        const response = { status(value) { status = value; return this; }, json() {} };
        let authenticated = false;
        await handlers[0](request, response, () => { authenticated = true; });
        if (authenticated) await handlers[1](request, response, (error) => { throw error; });
        assert.equal(status, expected, `${targetType}: ${role}, assignment=${assignment}, entry=${entry}`);
        assert.equal((await pool.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count, expected === 200 ? 0 : 1);
      }
    }
  } finally {
    await pool.end();
  }
});
