import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";

const { Pool } = pg;

function uniqueSuffix() {
  return `${Date.now().toString(36).slice(-6)}${Math.random().toString(36).slice(2, 8)}`;
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

function envelope(west, south, east, north) {
  return `MULTIPOLYGON(((${west} ${south}, ${east} ${south}, ${east} ${north}, ${west} ${north}, ${west} ${south})))`;
}

async function insertLot(client, { cemeteryId, sectionUuid, suffix, lotId, status, geometry }) {
  const result = await client.query(
    `
      INSERT INTO lots (
        cemetery_id,
        section_uuid,
        facility_id,
        section_id,
        lot_id,
        name,
        burial_use_status,
        geometry
      )
      VALUES ($1, $2, $3, 'A', $4, $5, $6, ST_GeomFromText($7, 4326))
      RETURNING id::text
    `,
    [cemeteryId, sectionUuid, `TEST-${suffix}`, lotId, `A-${lotId}`, status, geometry],
  );
  return result.rows[0].id;
}

async function insertGravesite(client, { cemeteryId, sectionUuid, lotUuid, suffix, lotId, graveId, statusId, geometry }) {
  const result = await client.query(
    `
      INSERT INTO gravesites (
        cemetery_id,
        section_uuid,
        lot_uuid,
        facility_id,
        section_id,
        lot_id,
        grave_id,
        gravesite_id,
        status_type_id,
        geometry
      )
      VALUES ($1, $2, $3, $4, 'A', $5, $6, $7, $8, ST_GeomFromText($9, 4326))
      RETURNING id::text
    `,
    [cemeteryId, sectionUuid, lotUuid, `TEST-${suffix}`, lotId, graveId, `A-${lotId}-${suffix}-${graveId}`, statusId, geometry],
  );
  return result.rows[0].id;
}

test("database enforces lot burial use restrictions for gravesites", async () => {
  const pool = new Pool(loadApiConfig().database);
  const client = await pool.connect();
  const suffix = uniqueSuffix();

  try {
    await client.query("BEGIN");

    const statusResult = await client.query("SELECT id::text FROM gravesite_status_types WHERE code = 'available'");
    assert.equal(statusResult.rowCount, 1, "gravesite_status_types.available should exist");
    const availableStatusId = statusResult.rows[0].id;

    const cemeteryResult = await client.query(
      `
        INSERT INTO cemeteries (name, facility_id, geometry)
        VALUES ($1, $2, ST_GeomFromText($3, 4326))
        RETURNING id::text
      `,
      [`Lot Restriction Test Cemetery ${suffix}`, `TEST-${suffix}`, envelope(0, 0, 0.001, 0.001)],
    );
    const cemeteryId = cemeteryResult.rows[0].id;

    const sectionResult = await client.query(
      `
        INSERT INTO sections (cemetery_id, name, facility_id, geometry)
        VALUES ($1, 'A', $2, ST_GeomFromText($3, 4326))
        RETURNING section_id::text
      `,
      [cemeteryId, `TEST-${suffix}`, envelope(0, 0, 0.001, 0.001)],
    );
    const sectionUuid = sectionResult.rows[0].section_id;

    const standardLotUuid = await insertLot(client, {
      cemeteryId,
      sectionUuid,
      suffix,
      lotId: "1",
      status: "standard",
      geometry: envelope(0.0001, 0.0001, 0.0002, 0.0002),
    });
    await insertGravesite(client, {
      cemeteryId,
      sectionUuid,
      lotUuid: standardLotUuid,
      suffix,
      lotId: "1",
      graveId: "1",
      statusId: availableStatusId,
      geometry: envelope(0.00011, 0.00011, 0.00012, 0.00012),
    });

    const nonBurialLotUuid = await insertLot(client, {
      cemeteryId,
      sectionUuid,
      suffix,
      lotId: "2",
      status: "non_burial",
      geometry: envelope(0.0003, 0.0001, 0.0004, 0.0002),
    });
    await expectRuleViolation(
      client,
      `
        INSERT INTO gravesites (
          cemetery_id,
          section_uuid,
          lot_uuid,
          facility_id,
          section_id,
          lot_id,
          grave_id,
          gravesite_id,
          status_type_id,
          geometry
        )
        VALUES ($1, $2, $3, $4, 'A', '2', '1', $5, $6, ST_GeomFromText($7, 4326))
      `,
      [cemeteryId, sectionUuid, nonBurialLotUuid, `TEST-${suffix}`, `A-2-${suffix}-1`, availableStatusId, envelope(0.00031, 0.00011, 0.00032, 0.00012)],
      /Lot A-2 cannot contain gravesites or markers/u,
    );

    const partialLotUuid = await insertLot(client, {
      cemeteryId,
      sectionUuid,
      suffix,
      lotId: "3",
      status: "partially_restricted",
      geometry: envelope(0.0005, 0.0001, 0.0006, 0.0002),
    });
    await client.query(
      `
        INSERT INTO lot_restricted_areas (lot_uuid, restriction_type, name, notes, geometry)
        VALUES ($1, 'no_gravesites_or_markers', 'A-3 southern half', 'Test restricted area.', ST_GeomFromText($2, 4326))
      `,
      [partialLotUuid, envelope(0.0005, 0.0001, 0.0006, 0.00015)],
    );
    await expectRuleViolation(
      client,
      `
        INSERT INTO gravesites (
          cemetery_id,
          section_uuid,
          lot_uuid,
          facility_id,
          section_id,
          lot_id,
          grave_id,
          gravesite_id,
          status_type_id,
          geometry
        )
        VALUES ($1, $2, $3, $4, 'A', '3', '1', $5, $6, ST_GeomFromText($7, 4326))
      `,
      [cemeteryId, sectionUuid, partialLotUuid, `TEST-${suffix}`, `A-3-${suffix}-1`, availableStatusId, envelope(0.00051, 0.00012, 0.00052, 0.00016)],
      /Gravesite geometry overlaps prohibited lot area "A-3 southern half"/u,
    );
    await insertGravesite(client, {
      cemeteryId,
      sectionUuid,
      lotUuid: partialLotUuid,
      suffix,
      lotId: "3",
      graveId: "2",
      statusId: availableStatusId,
      geometry: envelope(0.00051, 0.00015, 0.00052, 0.00018),
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
