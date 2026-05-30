import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";

const { Pool } = pg;

function uniqueSuffix() {
  return `${Date.now().toString(36).slice(-6)}${Math.random().toString(36).slice(2, 8)}`;
}

async function lookupId(client, table, code) {
  const result = await client.query(`SELECT id::text FROM ${table} WHERE code = $1`, [code]);
  assert.equal(result.rowCount, 1, `${table}.${code} should exist`);
  return result.rows[0].id;
}

async function expectRuleViolation(client, sql, values, messagePattern) {
  await client.query("SAVEPOINT expected_rule_violation");
  try {
    await client.query(sql, values);
    assert.fail("Expected database business rule violation.");
  } catch (error) {
    assert.match(error.message, messagePattern);
    await client.query("ROLLBACK TO SAVEPOINT expected_rule_violation");
  } finally {
    await client.query("RELEASE SAVEPOINT expected_rule_violation");
  }
}

function sectionPolygon(offset) {
  return `MULTIPOLYGON(((${offset} 0, ${offset + 0.0001} 0, ${offset + 0.0001} 0.0001, ${offset} 0.0001, ${offset} 0)))`;
}

function gravePolygon(offset) {
  return `MULTIPOLYGON(((${offset + 0.00001} 0.00001, ${offset + 0.00002} 0.00001, ${offset + 0.00002} 0.00002, ${offset + 0.00001} 0.00002, ${offset + 0.00001} 0.00001)))`;
}

async function insertSection(client, cemeteryId, suffix, name, offset) {
  const result = await client.query(
    `
      INSERT INTO sections (cemetery_id, name, facility_id, geometry)
      VALUES ($1, $2, $3, ST_GeomFromText($4, 4326))
      RETURNING section_id::text
    `,
    [cemeteryId, name, `TEST-${suffix}`, sectionPolygon(offset)],
  );
  return result.rows[0].section_id;
}

async function insertGravesite(client, { cemeteryId, sectionUuid, sectionName, suffix, graveId, statusId, offset }) {
  const result = await client.query(
    `
      INSERT INTO gravesites (
        cemetery_id,
        section_uuid,
        facility_id,
        section_id,
        grave_id,
        gravesite_id,
        status,
        status_type_id,
        geometry
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'available', $7, ST_GeomFromText($8, 4326))
      RETURNING id::text
    `,
    [cemeteryId, sectionUuid, `TEST-${suffix}`, sectionName, graveId, `${sectionName}-${suffix}-${graveId}`, statusId, gravePolygon(offset)],
  );
  return result.rows[0].id;
}

async function insertHeadstone(client, { gravesiteId, headstoneId, markerTypeId, materialId, conditionId, offset }) {
  const result = await client.query(
    `
      INSERT INTO headstones (
        gravesite_uuid,
        headstone_id,
        marker_type_id,
        material_type_id,
        condition_type_id,
        geometry
      )
      VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, 0.000015), 4326))
      RETURNING id::text
    `,
    [gravesiteId, headstoneId, markerTypeId, materialId, conditionId, offset + 0.000015],
  );
  return result.rows[0].id;
}

test("database enforces Section F and Section G marker business rules", async () => {
  const pool = new Pool(loadApiConfig().database);
  const client = await pool.connect();
  const suffix = uniqueSuffix();

  try {
    await client.query("BEGIN");

    const availableStatusId = await lookupId(client, "gravesite_status_types", "available");
    const uprightMarkerId = await lookupId(client, "marker_types", "upright_headstone");
    const flatMarkerId = await lookupId(client, "marker_types", "flat_marker");
    const graniteMaterialId = await lookupId(client, "marker_material_types", "granite");
    const goodConditionId = await lookupId(client, "headstone_condition_types", "good");

    const cemeteryResult = await client.query(
      `
        INSERT INTO cemeteries (name, facility_id, geometry)
        VALUES ($1, $2, ST_GeomFromText('MULTIPOLYGON(((0 0, 0.001 0, 0.001 0.001, 0 0.001, 0 0)))', 4326))
        RETURNING id::text
      `,
      [`Business Rule Test Cemetery ${suffix}`, `TEST-${suffix}`],
    );
    const cemeteryId = cemeteryResult.rows[0].id;

    const sectionAId = await insertSection(client, cemeteryId, suffix, "A", 0.0001);
    const sectionFId = await insertSection(client, cemeteryId, suffix, "F", 0.0003);
    const sectionGId = await insertSection(client, cemeteryId, suffix, "G", 0.0005);

    await expectRuleViolation(
      client,
      `
        INSERT INTO gravesites (
          cemetery_id,
          section_uuid,
          facility_id,
          section_id,
          grave_id,
          gravesite_id,
          status,
          status_type_id,
          geometry
        )
        VALUES ($1, $2, $3, 'F', '1', $4, 'available', $5, ST_GeomFromText($6, 4326))
      `,
      [cemeteryId, sectionFId, `TEST-${suffix}`, `F-${suffix}-1`, availableStatusId, gravePolygon(0.0003)],
      /Section F cannot contain gravesites/u,
    );

    const sectionAGravesiteId = await insertGravesite(client, {
      cemeteryId,
      sectionUuid: sectionAId,
      sectionName: "A",
      suffix,
      graveId: "1",
      statusId: availableStatusId,
      offset: 0.0001,
    });
    const sectionGGravesiteId = await insertGravesite(client, {
      cemeteryId,
      sectionUuid: sectionGId,
      sectionName: "G",
      suffix,
      graveId: "47",
      statusId: availableStatusId,
      offset: 0.0005,
    });

    await insertHeadstone(client, {
      gravesiteId: sectionAGravesiteId,
      headstoneId: `A-UPRIGHT-${suffix}`,
      markerTypeId: uprightMarkerId,
      materialId: graniteMaterialId,
      conditionId: goodConditionId,
      offset: 0.0001,
    });

    await expectRuleViolation(
      client,
      `
        INSERT INTO headstones (
          gravesite_uuid,
          headstone_id,
          marker_type_id,
          material_type_id,
          condition_type_id,
          geometry
        )
        VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, 0.000015), 4326))
      `,
      [sectionGGravesiteId, `G-UPRIGHT-${suffix}`, uprightMarkerId, graniteMaterialId, goodConditionId, 0.000515],
      /Section G can contain only flat markers/u,
    );

    await insertHeadstone(client, {
      gravesiteId: sectionGGravesiteId,
      headstoneId: `G-FLAT-${suffix}`,
      markerTypeId: flatMarkerId,
      materialId: graniteMaterialId,
      conditionId: goodConditionId,
      offset: 0.0005,
    });

    await client.query("ROLLBACK");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
});
