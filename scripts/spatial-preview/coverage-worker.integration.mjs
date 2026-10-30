// Explicit opt-in, read-only integration test: never create or truncate fixtures in DEV/TEST.
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readOnlyClient } from "../lib/local-db-review.mjs";

test("offline GEOS cleaning preserves identity, exact originals and reproducibility", async () => {
  const client = await readOnlyClient(process.env.APP_ENV ?? "dev");
  try {
    const inputs = (await client.query(`SELECT id,encode(ST_AsEWKB(ST_GeomFromText(wkt,32617)),'hex') AS wkb
      FROM (VALUES ('a','POLYGON((0 0,2 0,2 2,0 2,0 0))'),('b','POLYGON((1.9 0,3.9 0,3.9 2,1.9 2,1.9 0))')) v(id,wkt) ORDER BY id`)).rows;
    const original = JSON.stringify(inputs);
    const run = () => JSON.parse(execFileSync("docker", ["run", "--platform=linux/amd64", "--rm", "-i", "--network=none", "--read-only", "--cap-drop=ALL",
      "--security-opt=no-new-privileges", "cemetery-spatial-preview:geos314"], { input: JSON.stringify({ records: inputs, gap: 0, snap: 0 }), encoding: "utf8" }));
    const result = run();
    assert.deepEqual(result, run());
    assert.deepEqual(result.records.map(r => r.id), ["a", "b"]);
    assert.equal(JSON.stringify(inputs), original);
    const [a, b] = result.records;
    const measured = (await client.query(`SELECT ST_Area(ST_Intersection(ST_GeomFromEWKB(decode($1,'hex')),ST_GeomFromEWKB(decode($2,'hex')))) AS overlap,
      ST_IsValid(ST_GeomFromEWKB(decode($1,'hex'))) AND NOT ST_IsEmpty(ST_GeomFromEWKB(decode($1,'hex'))) AS valid,
      encode(ST_AsEWKB(ST_GeomFromEWKB(decode($3,'hex'))),'hex')=$3 AS original_exact`, [a.ewkb, b.ewkb, inputs[0].wkb])).rows[0];
    assert.ok(measured.overlap < 1e-9);
    assert.equal(measured.valid, true);
    assert.equal(measured.original_exact, true);
    await assert.rejects(client.query("CREATE TABLE forbidden_preview_write(id int)"), /read-only/);
  } finally { await client.end(); }
});
