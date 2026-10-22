import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import { loadApiConfig } from '../server/config.mjs';
import { integrationAdminDatabase } from './lib/integration-admin.mjs';
import { dockerComposeArgs, loadDbEnvironment } from './lib/run-liquibase.mjs';

const path = 'changes/346-split-c-0382-decourcy-gravesites.sql';
const checksum = '9:c000ed388b4420abf954b08bf3f2a4d1';
const tables = ['gravesites', 'burials', 'headstones', 'headstone_gravesites', 'headstone_burials'];

// Real Liquibase history in an isolated schema; never rewrite public data/history.
async function fixture(run) {
  const config = loadApiConfig();
  const client = new pg.Client(integrationAdminDatabase(config));
  const schema = `decourcy_${randomUUID().replaceAll('-', '')}`;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}, public`);
    for (const table of tables) {
      await client.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
      // This fixture replays migration 346, before mandatory faces existed.
      if (table === 'headstones') await client.query(`ALTER TABLE ${schema}.headstones DROP CONSTRAINT IF EXISTS headstones_require_face`);
    }
    const db = loadDbEnvironment('test');
    function liquibase(command) {
      const result = spawnSync('docker', [
        ...dockerComposeArgs('test'), 'run', '--rm', '--no-deps',
        '-e', 'LIQUIBASE_COMMAND_PASSWORD', 'liquibase',
        '--search-path=/liquibase/changelog', `--changelog-file=${path}`,
        `--url=jdbc:postgresql://db:5432/${db.POSTGRES_DB}?currentSchema=${schema},public`,
        `--username=${db.POSTGRES_USER}`, `--default-schema-name=${schema}`,
        `--liquibase-schema-name=${schema}`, command,
      ], { encoding: 'utf8', env: { ...process.env, LIQUIBASE_COMMAND_PASSWORD: db.POSTGRES_PASSWORD } });
      assert.equal(result.status, 0, result.error?.message ?? result.stderr);
      return result.stdout;
    }
    await run(client, liquibase);
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  }
}

async function seed(client) {
  const { rows: [grave] } = await client.query(`
    INSERT INTO gravesites(cemetery_id, facility_id, section_id, lot_id, lot_uuid,
      grave_id, gravesite_id, name, status_type_id, geometry)
    VALUES(gen_random_uuid(), '1', 'C', '83', gen_random_uuid(), '0382', 'TLC-GPS-0382',
      'Shared DeCourcy grave', (SELECT id FROM gravesite_status_types WHERE code='occupied'),
      ST_Multi(ST_MakeEnvelope(-80.081,40.60,-80.0809,40.6001,4326))) RETURNING *`);
  const { rows: [marker] } = await client.query(`
    INSERT INTO headstones(headstone_id, marker_type_id, material_type_id, condition_type_id, geometry)
    VALUES('TLC-HS-0382', gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
      ST_SetSRID(ST_MakePoint(-80.08,40.60),4326)) RETURNING *`);
  await client.query(`INSERT INTO headstone_gravesites(headstone_uuid, gravesite_uuid, relationship_type)
    VALUES($1,$2,'primary')`, [marker.id, grave.id]);
  for (const name of ['William DeWitt DeCourcy', 'Louise DeCourcy/Hamilton']) {
    const { rows: [burial] } = await client.query(`
      INSERT INTO burials(full_name, gravesite_uuid, gravesite_id, notes, interment_type_id, burial_record_status_type_id)
      VALUES($1,$2,'TLC-GPS-0382','Preserve source facts',gen_random_uuid(),gen_random_uuid()) RETURNING id`, [name, grave.id]);
    await client.query('INSERT INTO headstone_burials(headstone_uuid,burial_uuid) VALUES($1,$2)', [marker.id, burial.id]);
  }
  return { grave, marker };
}

async function snapshot(client) {
  const result = [];
  for (const table of tables) {
    result.push((await client.query(`SELECT * FROM ${table} ORDER BY to_jsonb(${table})::text`)).rows);
  }
  return result;
}

test('historical 346 splits original records and Liquibase skips it after later edits', async () => fixture(async (client, liquibase) => {
  const { grave, marker } = await seed(client);
  liquibase('update');
  const { rows: graves } = await client.query('SELECT *, ST_Y(ST_Centroid(geometry)) latitude, ST_Area(geometry::geography)/0.09290304 sqft FROM gravesites ORDER BY gravesite_id');
  assert.equal(graves.length, 2);
  assert.equal(graves[0].id, grave.id);
  assert.deepEqual(graves.map(g => g.name), ['William DeWitt DeCourcy', 'Louise Hamilton DeCourcy']);
  assert.ok(graves[1].latitude > graves[0].latitude);
  for (const g of graves) {
    assert.ok(Math.abs(g.sqft - 40) < 0.01);
    assert.equal(g.lot_uuid, grave.lot_uuid);
    assert.equal(g.lot_id, '83');
    assert.equal(Number(g.width_feet), 4);
    assert.equal(Number(g.length_feet), 10);
  }
  assert.equal((await client.query(`SELECT ST_Area(ST_Intersection(a.geometry,b.geometry)::geography) area
    FROM gravesites a CROSS JOIN gravesites b WHERE a.id=$1 AND b.id=$2`, [graves[0].id, graves[1].id])).rows[0].area, 0);
  const { rows: burials } = await client.query('SELECT * FROM burials ORDER BY full_name');
  assert.deepEqual(burials.map(b => [b.full_name, b.gravesite_uuid]), [
    ['Louise Hamilton DeCourcy', graves[1].id], ['William DeWitt DeCourcy', grave.id],
  ]);
  for (const b of burials) {
    assert.equal(b.notes, 'Preserve source facts');
    assert.equal(b.birth_date, null);
    assert.equal(b.death_date, null);
  }
  const { rows: [afterMarker] } = await client.query('SELECT * FROM headstones');
  assert.equal(afterMarker.geometry, marker.geometry);
  assert.equal(afterMarker.gravesite_uuid, grave.id);
  assert.deepEqual((await client.query('SELECT relationship_type FROM headstone_gravesites')).rows.map(r => r.relationship_type), ['spans', 'spans']);
  assert.deepEqual((await client.query('SELECT burial_uuid FROM headstone_burials WHERE headstone_uuid=$1 ORDER BY burial_uuid', [marker.id])).rows.map(r => r.burial_uuid), burials.map(b => b.id).sort());
  assert.deepEqual((await client.query('SELECT gravesite_uuid FROM headstone_gravesites WHERE headstone_uuid=$1 ORDER BY gravesite_uuid', [marker.id])).rows.map(r => r.gravesite_uuid), graves.map(g => g.id).sort());
  const { rows: [history] } = await client.query('SELECT id, author, filename, md5sum FROM databasechangelog');
  assert.deepEqual(history, { id: '346-split-c-0382-decourcy-gravesites', author: 'cemeterymapping', filename: path, md5sum: checksum });
  // Re-executing the original SQL would fail its old-name prerequisite and overwrite notes.
  await client.query("UPDATE gravesites SET geometry_notes='Later reviewed evidence'");
  const before = await snapshot(client);
  liquibase('validate');
  liquibase('update');
  assert.deepEqual(await snapshot(client), before);
  assert.equal((await client.query('SELECT count(*)::int n FROM databasechangelog')).rows[0].n, 1);
}));

test('historical 346 records successful execution without Trinity source data', async () => fixture(async (client, liquibase) => {
  liquibase('update');
  for (const rows of await snapshot(client)) assert.equal(rows.length, 0);
  assert.equal((await client.query('SELECT md5sum FROM databasechangelog')).rows[0].md5sum, checksum);
}));

test('historical 346 rejects incomplete source data without partial changes', async () => fixture(async (client) => {
  await seed(client);
  await client.query("DELETE FROM burials WHERE full_name='Louise DeCourcy/Hamilton'");
  const before = await snapshot(client);
  const { readFile } = await import('node:fs/promises');
  const sql = await readFile(new URL(`../db/changelog/${path}`, import.meta.url), 'utf8');
  await client.query('BEGIN');
  await assert.rejects(client.query(sql), /exactly one active William/);
  await client.query('ROLLBACK');
  assert.deepEqual(await snapshot(client), before);
}));
