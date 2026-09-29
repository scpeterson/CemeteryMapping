import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { createUser } from "../server/adminRepository.mjs";
import { submitAccessRequest, rejectAccessRequest } from "../server/accessRequestRepository.mjs";

test("access request approval is atomic, cannot be replayed, and preserves duplicate requests", async () => {
  const config = loadApiConfig(); assert.equal(config.appEnv, "test");
  const pool = new pg.Pool(config.database), client = await pool.connect();
  const nested = { connect: async () => ({ release() {}, query: (sql, values) => client.query(
    sql === "BEGIN" ? "SAVEPOINT access_write" : sql === "COMMIT" ? "RELEASE SAVEPOINT access_write" : sql === "ROLLBACK" ? "ROLLBACK TO SAVEPOINT access_write" : sql, values) }) };
  try {
    await client.query("BEGIN");
    const email = `access-${randomUUID()}@example.test`;
    const request = { email, displayName: "Test visitor", cemeteryInterest: "Fictional", reason: "Research" };
    await submitAccessRequest(client, request);
    await submitAccessRequest(client, { ...request, reason: "Changed without permission" });
    const { rows: [row] } = await client.query("SELECT * FROM access_requests WHERE email=$1", [email]);
    assert.equal(row.reason, "Research"); assert.equal(row.status, "pending");
    assert.equal((await client.query("SELECT count(*) FROM app_users WHERE email=$1", [email])).rows[0].count, "0");
    const user = { email, displayName: "Visitor", externalSubject: `test|${randomUUID()}`, role: "reader", isActive: true, assignedCemeteryIds: [], accessRequestId: row.id };
    await assert.rejects(createUser(nested, { ...user, email: "other@example.test" }), { statusCode: 400 });
    await assert.rejects(createUser(nested, { ...user, isActive: false }), { statusCode: 400 });
    const saved = await createUser(nested, user);
    assert.equal(saved.role, "reader"); assert.equal(saved.isActive, true);
    assert.equal((await client.query("SELECT approved_user_id FROM access_requests WHERE id=$1", [row.id])).rows[0].approved_user_id, saved.id);
    await assert.rejects(createUser(nested, { ...user, externalSubject: `test|${randomUUID()}` }), { name: "ConflictError" });
    await assert.rejects(rejectAccessRequest(nested, row.id, {}), { name: "ConflictError" });
    const second = { ...request, email: `access-${randomUUID()}@example.test` };
    await submitAccessRequest(client, second);
    const { rows: [rejected] } = await client.query("SELECT id FROM access_requests WHERE email=$1", [second.email]);
    await rejectAccessRequest(nested, rejected.id, {});
    await assert.rejects(createUser(nested, { ...user, email: second.email, accessRequestId: rejected.id }), { name: "ConflictError" });
    // A failed account creation must leave the request pending.
    const third = { ...request, email: `access-${randomUUID()}@example.test` };
    await submitAccessRequest(client, third);
    const { rows: [pending] } = await client.query("SELECT id FROM access_requests WHERE email=$1", [third.email]);
    await assert.rejects(createUser(nested, { ...user, email: third.email, accessRequestId: pending.id }));
    assert.equal((await client.query("SELECT status FROM access_requests WHERE id=$1", [pending.id])).rows[0].status, "pending");
  } finally { await client.query("ROLLBACK"); client.release(); await pool.end(); }
});
