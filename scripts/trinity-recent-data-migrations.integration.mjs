import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";

const { Pool } = pg;

async function migrationSql(number, name) {
  return readFile(new URL(`../db/changelog/changes/${number}-${name}.sql`, import.meta.url), "utf8");
}

async function insertGravesite(client, { cemeteryId, sectionUuid, graveId, gravesiteId, name, latitude }) {
  const result = await client.query(
    `
      INSERT INTO gravesites (
        cemetery_id, section_uuid, name, facility_id, section_id, grave_id, gravesite_id,
        width_feet, length_feet, status_type_id, geometry
      )
      VALUES (
        $1, $2, $3, '1', 'C', $4, $5, 4, 10,
        (SELECT id FROM gravesite_status_types WHERE code = 'occupied'),
        ST_Multi(ST_MakeEnvelope(-80.08045, $6::double precision, -80.08041, $6::double precision + 0.00001, 4326))
      )
      RETURNING id, geometry
    `,
    [cemeteryId, sectionUuid, name, graveId, gravesiteId, latitude],
  );
  return result.rows[0];
}

async function insertHeadstone(client, { gravesiteUuid, headstoneId, latitude }) {
  const result = await client.query(
    `
      INSERT INTO headstones (
        gravesite_uuid, headstone_id, marker_type_id, material_type_id, condition_type_id,
        latitude, longitude, geometry
      )
      VALUES (
        $1, $2,
        (SELECT id FROM marker_types WHERE code = 'upright_headstone'),
        (SELECT id FROM marker_material_types WHERE code = 'pink_granite'),
        (SELECT id FROM headstone_condition_types WHERE code = 'excellent'),
        $3::double precision, -80.080445,
        ST_SetSRID(ST_MakePoint(-80.080445, $3::double precision), 4326)
      )
      RETURNING id
    `,
    [gravesiteUuid, headstoneId, latitude],
  );
  return result.rows[0].id;
}

async function insertBurial(client, { gravesiteUuid, gravesiteId, fullName, firstName, lastName }) {
  const result = await client.query(
    `
      INSERT INTO burials (
        gravesite_uuid, gravesite_id, first_name, last_name, full_name,
        interment_type_id, burial_record_status_type_id
      )
      VALUES (
        $1, $2, $3, $4, $5,
        (SELECT id FROM burial_interment_types WHERE code = 'casket'),
        (SELECT id FROM burial_record_status_types WHERE code = 'interred')
      )
      RETURNING id
    `,
    [gravesiteUuid, gravesiteId, firstName, lastName, fullName],
  );
  return result.rows[0].id;
}

test("recent Trinity data migrations create the intended graves, people, statuses, and marker links", async () => {
  const pool = new Pool(loadApiConfig().database);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const cemetery = await client.query(
      `
        INSERT INTO cemeteries (name, facility_id, geometry)
        VALUES (
          'Trinity migration integration fixture', '1',
          ST_Multi(ST_MakeEnvelope(-80.081, 40.600, -80.079, 40.603, 4326))
        )
        RETURNING id
      `,
    );
    const section = await client.query(
      `
        INSERT INTO sections (cemetery_id, name, facility_id, geometry)
        VALUES (
          $1, 'C', '1',
          ST_Multi(ST_MakeEnvelope(-80.081, 40.600, -80.079, 40.603, 4326))
        )
        RETURNING section_id
      `,
      [cemetery.rows[0].id],
    );
    const cemeteryId = cemetery.rows[0].id;
    const sectionUuid = section.rows[0].section_id;

    const groppGrave = await insertGravesite(client, {
      cemeteryId,
      sectionUuid,
      graveId: "0156",
      gravesiteId: "TLC-GPS-0156",
      name: "Manfred Joseph Gropp and Alice J. Gropp",
      latitude: 40.6010,
    });
    const groppMarker = await insertHeadstone(client, {
      gravesiteUuid: groppGrave.id,
      headstoneId: "TLC-HS-0156",
      latitude: 40.60101,
    });
    const manfred = await insertBurial(client, {
      gravesiteUuid: groppGrave.id,
      gravesiteId: "TLC-GPS-0156",
      fullName: "Manfred Joseph Gropp",
      firstName: "Manfred Joseph",
      lastName: "Gropp",
    });
    const alice = await insertBurial(client, {
      gravesiteUuid: groppGrave.id,
      gravesiteId: "TLC-GPS-0156",
      fullName: "Alice J. Gropp",
      firstName: "Alice J.",
      lastName: "Gropp",
    });
    await client.query(
      "INSERT INTO headstone_burials (headstone_uuid, burial_uuid) VALUES ($1, $2), ($1, $3)",
      [groppMarker, manfred, alice],
    );

    await client.query(await migrationSql("309", "split-c-0156-gropp-gravesites"));

    const groppResult = await client.query(
      `
        SELECT burials.full_name, gravesites.gravesite_id
        FROM burials
        JOIN gravesites ON gravesites.id = burials.gravesite_uuid
        WHERE lower(burials.last_name) = 'gropp'
        ORDER BY burials.full_name
      `,
    );
    assert.deepEqual(groppResult.rows, [
      { full_name: "Alice J. Gropp", gravesite_id: "TLC-GPS-0156-01" },
      { full_name: "Manfred Joseph Gropp", gravesite_id: "TLC-GPS-0156" },
    ]);

    for (const neighbor of [
      { id: "0328", latitude: 40.60133984 },
      { id: "0329", latitude: 40.60136399 },
    ]) {
      const grave = await insertGravesite(client, {
        cemeteryId,
        sectionUuid,
        graveId: neighbor.id,
        gravesiteId: `TLC-GPS-${neighbor.id}`,
        name: `Neighbor ${neighbor.id}`,
        latitude: neighbor.latitude,
      });
      await insertHeadstone(client, {
        gravesiteUuid: grave.id,
        headstoneId: `TLC-HS-${neighbor.id}`,
        latitude: neighbor.latitude,
      });
    }

    await client.query(await migrationSql("310", "add-eckendahl-field-photo-marker"));

    const eckendahlResult = await client.query(
      `
        SELECT
          burials.full_name,
          gravesites.gravesite_id,
          gravesite_status_types.code AS gravesite_status,
          burial_record_status_types.code AS record_status
        FROM burials
        JOIN gravesites ON gravesites.id = burials.gravesite_uuid
        JOIN gravesite_status_types ON gravesite_status_types.id = gravesites.status_type_id
        JOIN burial_record_status_types ON burial_record_status_types.id = burials.burial_record_status_type_id
        WHERE lower(burials.last_name) = 'eckendahl'
        ORDER BY burials.full_name
      `,
    );
    assert.deepEqual(eckendahlResult.rows, [
      {
        full_name: "Bruce W Eckendahl",
        gravesite_id: "TLC-GPS-0328-02",
        gravesite_status: "occupied",
        record_status: "interred",
      },
      {
        full_name: "Terry M Eckendahl",
        gravesite_id: "TLC-GPS-0328-03",
        gravesite_status: "reserved",
        record_status: "pre_need_inscription",
      },
    ]);

    const links = await client.query(
      `
        SELECT
          (SELECT count(*)::integer FROM headstone_gravesites hg JOIN headstones h ON h.id = hg.headstone_uuid WHERE h.headstone_id = 'TLC-HS-0328A' AND hg.deleted_at IS NULL) AS grave_links,
          (SELECT count(*)::integer FROM headstone_burials hb JOIN headstones h ON h.id = hb.headstone_uuid WHERE h.headstone_id = 'TLC-HS-0328A' AND hb.deleted_at IS NULL) AS burial_links
      `,
    );
    assert.deepEqual(links.rows[0], { grave_links: 2, burial_links: 2 });
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
