import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { integrationAdminDatabase } from "./lib/integration-admin.mjs";
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
        status_type_id,
        geometry
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, ST_GeomFromText($8, 4326))
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

async function insertBurial(client, { gravesiteId, firstName, lastName, intermentType }) {
  const result = await client.query(
    `
      INSERT INTO burials (
        gravesite_uuid,
        first_name,
        last_name,
        full_name,
        interment_type_id,
        burial_record_status_type_id
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        (SELECT id FROM burial_interment_types WHERE code = $5),
        (SELECT id FROM burial_record_status_types WHERE code = 'interred')
      )
      RETURNING id::text
    `,
    [gravesiteId, firstName, lastName, [firstName, lastName].filter(Boolean).join(" "), intermentType],
  );
  return result.rows[0].id;
}

test("database enforces Section F and Section G marker business rules", async () => {
  const pool = new Pool(integrationAdminDatabase(loadApiConfig()));
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

    await client.query(`INSERT INTO location_policies(cemetery_id,section_uuid,rule_key,enabled,reason)
      VALUES($1,$2,'no_gravesites',true,'Regression utility exclusion'),
      ($1,$3,'flat_markers_only',true,'Regression flat marker policy'),
      ($1,$3,'casket_or_two_urns',true,'Regression capacity policy')`,[cemeteryId,sectionFId,sectionGId]);

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
          status_type_id,
          geometry
        )
        VALUES ($1, $2, $3, 'F', '1', $4, $5, ST_GeomFromText($6, 4326))
      `,
      [cemeteryId, sectionFId, `TEST-${suffix}`, `F-${suffix}-1`, availableStatusId, gravePolygon(0.0003)],
      /Location policy prohibits gravesites/u,
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
    const sectionGUrnGravesiteId = await insertGravesite(client, {
      cemeteryId,
      sectionUuid: sectionGId,
      sectionName: "G",
      suffix,
      graveId: "48",
      statusId: availableStatusId,
      offset: 0.00055,
    });
    const sectionGCasketGravesiteId = await insertGravesite(client, {
      cemeteryId,
      sectionUuid: sectionGId,
      sectionName: "G",
      suffix,
      graveId: "49",
      statusId: availableStatusId,
      offset: 0.0006,
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
      /Location policy permits only flat markers/u,
    );

    await insertHeadstone(client, {
      gravesiteId: sectionGGravesiteId,
      headstoneId: `G-FLAT-${suffix}`,
      markerTypeId: flatMarkerId,
      materialId: graniteMaterialId,
      conditionId: goodConditionId,
      offset: 0.0005,
    });

    await insertBurial(client, {
      gravesiteId: sectionGUrnGravesiteId,
      firstName: "First",
      lastName: "Urn",
      intermentType: "urn",
    });
    await insertBurial(client, {
      gravesiteId: sectionGUrnGravesiteId,
      firstName: "Second",
      lastName: "Urn",
      intermentType: "urn",
    });
    await expectRuleViolation(
      client,
      `
        INSERT INTO burials (
          gravesite_uuid,
          first_name,
          last_name,
          full_name,
          interment_type_id,
          burial_record_status_type_id
        )
        VALUES (
          $1,
          'Third',
          'Urn',
          'Third Urn',
          (SELECT id FROM burial_interment_types WHERE code = 'urn'),
          (SELECT id FROM burial_record_status_types WHERE code = 'interred')
        )
      `,
      [sectionGUrnGravesiteId],
      /Location policy permits either one casket burial or up to two funeral urn burials/u,
    );

    await insertBurial(client, {
      gravesiteId: sectionGCasketGravesiteId,
      firstName: "Only",
      lastName: "Casket",
      intermentType: "casket",
    });
    await expectRuleViolation(
      client,
      `
        INSERT INTO burials (
          gravesite_uuid,
          first_name,
          last_name,
          full_name,
          interment_type_id,
          burial_record_status_type_id
        )
        VALUES (
          $1,
          'Additional',
          'Urn',
          'Additional Urn',
          (SELECT id FROM burial_interment_types WHERE code = 'urn'),
          (SELECT id FROM burial_record_status_types WHERE code = 'interred')
        )
      `,
      [sectionGCasketGravesiteId],
      /Location policy permits either one casket burial or up to two funeral urn burials/u,
    );

    await client.query("ROLLBACK");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
});

test("Trinity Section G enforces standard capacity and the signed G-72 exception", async () => {
  const pool = new Pool(integrationAdminDatabase(loadApiConfig()));
  const client = await pool.connect();
  const suffix = uniqueSuffix();
  try {
    await client.query("BEGIN");
    const geometry = sectionPolygon(0.002);
    const cemetery = (await client.query(`
      INSERT INTO cemeteries (name, facility_id, geometry)
      VALUES ('Trinity capacity fixture', '1', ST_GeomFromText($1, 4326))
      ON CONFLICT (facility_id) DO UPDATE SET facility_id = EXCLUDED.facility_id
      RETURNING id`, [geometry])).rows[0].id;
    const section = await insertSection(client, cemetery, suffix, `G${suffix.slice(-4)}`, 0.002);
    await client.query(`INSERT INTO location_policies(cemetery_id, section_uuid, rule_key, enabled, reason)
      VALUES ($1, $2, 'casket_or_two_urns', true, 'Capacity regression fixture')`, [cemetery, section]);
    const statusId = await lookupId(client, "gravesite_status_types", "available");
    const common = { cemeteryId: cemetery, sectionUuid: section, sectionName: `G${suffix.slice(-4)}`, suffix, statusId, offset: 0.002 };
    const standard = await insertGravesite(client, { ...common, graveId: "1" });
    const ashesOnly = await insertGravesite(client, { ...common, graveId: "2" });
    const exceptionPlot = await insertGravesite(client, { ...common, graveId: "72" });
    await client.query(`INSERT INTO burial_capacity_exceptions
      VALUES ($1, 3, 0, 'Signed fixture deed authorizes up to three sets of ashes')`, [exceptionPlot]);
    const realPlot = await client.query(`
      SELECT e.max_ashes_without_casket, e.max_ashes_with_casket
      FROM gravesites g LEFT JOIN burial_capacity_exceptions e ON e.gravesite_uuid = g.id
      WHERE g.cemetery_id = $1 AND g.gravesite_id = 'G-072' AND g.deleted_at IS NULL`, [cemetery]);
    if (realPlot.rowCount) assert.deepEqual(realPlot.rows, [{ max_ashes_without_casket: 3, max_ashes_with_casket: 0 }]);
    await client.query("SET CONSTRAINTS ALL IMMEDIATE");
    const add = (gravesiteId, intermentType) => insertBurial(client, {
      gravesiteId, intermentType, firstName: "Fixture", lastName: uniqueSuffix(),
    });
    await add(standard, "casket");
    await add(standard, "urn");
    const reject = async (grave, type) => {
      await client.query("SAVEPOINT capacity");
      await assert.rejects(add(grave, type), { constraint: "location_policy_capacity" });
      await client.query("ROLLBACK TO SAVEPOINT capacity");
      await client.query("RELEASE SAVEPOINT capacity");
    };
    await reject(standard, "urn");
    await reject(standard, "casket");
    await add(ashesOnly, "urn");
    await add(ashesOnly, "urn");
    await reject(ashesOnly, "urn");
    for (let i = 0; i < 3; i++) await add(exceptionPlot, "urn");
    await reject(exceptionPlot, "urn");
    await reject(exceptionPlot, "casket");
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});

test("Trinity marker dimensions enforce standard limits and isolate the signed G-72 width exception", async () => {
  const pool = new Pool(integrationAdminDatabase(loadApiConfig()));
  const client = await pool.connect();
  const suffix = uniqueSuffix();
  try {
    await client.query("BEGIN");
    const cemetery = (await client.query(`
      INSERT INTO cemeteries (name, facility_id, geometry)
      VALUES ('Trinity marker fixture', '1', ST_GeomFromText($1, 4326))
      ON CONFLICT (facility_id) DO UPDATE SET facility_id = EXCLUDED.facility_id
      RETURNING id`, [sectionPolygon(0.003)])).rows[0].id;
    const sectionName = `M${suffix.slice(-4)}`;
    const section = await insertSection(client, cemetery, suffix, sectionName, 0.003);
    const common = {
      cemeteryId: cemetery, sectionUuid: section, sectionName, suffix,
      statusId: await lookupId(client, "gravesite_status_types", "available"), offset: 0.003,
    };
    const standard = await insertGravesite(client, { ...common, graveId: "1" });
    const exceptionPlot = await insertGravesite(client, { ...common, graveId: "72" });
    const adjoining = await insertGravesite(client, { ...common, graveId: "2", offset: 0.00301 });
    await client.query(`INSERT INTO marker_width_exceptions VALUES ($1, 36, 'Signed fixture deed')`, [exceptionPlot]);
    const actualException = await client.query(`
      SELECT e.max_width_inches FROM gravesites g
      LEFT JOIN marker_width_exceptions e ON e.gravesite_uuid = g.id
      WHERE g.cemetery_id = $1 AND g.gravesite_id = 'G-072' AND g.deleted_at IS NULL`, [cemetery]);
    if (actualException.rowCount) assert.deepEqual(actualException.rows, [{ max_width_inches: "36" }]);

    const materialId = await lookupId(client, "marker_material_types", "granite");
    const conditionId = await lookupId(client, "headstone_condition_types", "good");
    const add = async (grave, type) => insertHeadstone(client, {
      gravesiteId: grave, headstoneId: `DIM-${uniqueSuffix()}`, materialId, conditionId,
      markerTypeId: await lookupId(client, "marker_types", type), offset: 0.003,
    });
    const measure = (marker, width, height, depth, rise) => client.query(
      "UPDATE headstones SET width_inches=$2, height_inches=$3, depth_inches=$4, rise_inches=$5 WHERE id=$1",
      [marker, width, height, depth, rise],
    );
    await client.query("SET CONSTRAINTS ALL IMMEDIATE");
    const flat = await add(standard, "flat_marker");
    const approved = await add(exceptionPlot, "flat_marker");
    const upright = await add(standard, "upright_headstone");
    const footstone = await add(exceptionPlot, "footstone");
    await measure(flat, 28, null, 18, 0.5);
    await measure(approved, 36, null, 18, 0.5);
    await measure(upright, 36, 36, 16, null);
    await measure(footstone, 24, null, 12, 0.5);
    for (const values of [
      [flat, 36, null, 18, 0.5], [approved, 36.01, null, 18, 0.5],
      [flat, 28, null, 18, 0.51], [approved, 36, null, 19, 0.5],
      [upright, 36, 37, 16, null], [footstone, 25, null, 12, 0.5],
    ]) {
      await client.query("SAVEPOINT dimension_limit");
      await assert.rejects(measure(...values), { constraint: "trinity_marker_size" });
      await client.query("ROLLBACK TO SAVEPOINT dimension_limit");
      await client.query("RELEASE SAVEPOINT dimension_limit");
    }
    await expectRuleViolation(client, "UPDATE headstones SET gravesite_uuid=$2 WHERE id=$1",
      [approved, standard], /Trinity marker limits/u);
    await client.query("INSERT INTO headstone_gravesites(headstone_uuid, gravesite_uuid, relationship_type) VALUES ($1,$2,'spans'), ($3,$2,'spans')",
      [flat, adjoining, upright]);
    await measure(flat, 54, null, 18, 0.5);
    await measure(upright, 50, 36, 16, null);
    await expectRuleViolation(client, "UPDATE headstones SET width_inches=54.01 WHERE id=$1",
      [flat], /Trinity marker limits/u);
    await expectRuleViolation(client, "DELETE FROM headstone_gravesites WHERE headstone_uuid=$1 AND gravesite_uuid=$2",
      [flat, adjoining], /Trinity marker limits/u);
    await measure(flat, 28, null, 18, 0.5);
    await client.query("DELETE FROM headstone_gravesites WHERE headstone_uuid=$1 AND gravesite_uuid=$2", [flat, adjoining]);
    for (const firstName of ["First", "Second"]) {
      await insertBurial(client, { gravesiteId: standard, firstName, lastName: suffix, intermentType: "urn" });
    }
    await measure(flat, 28, null, 34, 0.5);
    await expectRuleViolation(client, `UPDATE burials SET deleted_at=now()
      WHERE id=(SELECT id FROM burials WHERE gravesite_uuid=$1 AND first_name='Second')`,
      [standard], /Trinity marker limits/u);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
