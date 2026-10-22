import {createLegacyTableFixture} from "./lib/legacy-table-fixtures.mjs";
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import { loadApiConfig } from '../server/config.mjs';
import { integrationAdminDatabase } from './lib/integration-admin.mjs';

const sql = await readFile(new URL('../db/changelog/changes/473-align-c-0382-decourcy-with-lot-83.sql', import.meta.url), 'utf8');
const original = await readFile(new URL('../db/changelog/changes/346-split-c-0382-decourcy-gravesites.sql', import.meta.url), 'utf8');
const tables = ['lots', 'gravesites', 'burials', 'headstones', 'headstone_gravesites', 'headstone_burials'];
const shapes = {
  "lot82": "MULTIPOLYGON(((-80.08055303595604 40.60106621102368,-80.08055303596045 40.601120972072934,-80.08051697379788 40.60112097207461,-80.0805169737935 40.60106621102535,-80.08055303595604 40.60106621102368)))",
  "lot83": "MULTIPOLYGON(((-80.08058909811864 40.60106621102199,-80.08058909812301 40.60112097207124,-80.08055303596045 40.601120972072934,-80.08055303595604 40.60106621102368,-80.08058909811864 40.60106621102199)))",
  "TLC-GPS-0382": "MULTIPOLYGON(((-80.0805876945449 40.6010811277804,-80.08055168337359 40.60108112777479,-80.08055168336769 40.60109210698831,-80.0805876945449 40.601092106993924,-80.0805876945449 40.6010811277804)))",
  "TLC-GPS-0383": "MULTIPOLYGON(((-80.08058801 40.60110323039324,-80.08055199881682 40.60110323038763,-80.08055199881092 40.60111420960113,-80.08058801 40.601114209606735,-80.08058801 40.60110323039324)))",
  "marker": "POINT(-80.0805876945449 40.6010948517973)"
};
async function fixture(run, seed = true) {
  const c = new pg.Client(integrationAdminDatabase(loadApiConfig()));
  await c.connect();
  try {
    await c.query('BEGIN');
    for (const table of tables) await createLegacyTableFixture(c, table);
    if (seed) {
      const { rows: [lot] } = await c.query(`INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,name,geometry)
        VALUES(gen_random_uuid(),'1','C','83','C-83',ST_GeomFromText($1,4326)) RETURNING *`, [shapes.lot83]);
      await c.query(`INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,name,geometry)
        VALUES($1,'1','C','82','C-82',ST_GeomFromText($2,4326))`, [lot.cemetery_id, shapes.lot82]);
      const { rows: [grave] } = await c.query(`INSERT INTO gravesites(cemetery_id,facility_id,section_id,lot_id,lot_uuid,grave_id,gravesite_id,name,status_type_id,geometry)
        VALUES($1,'1','C','83',$2,'0382','TLC-GPS-0382','Shared DeCourcy grave',gen_random_uuid(),ST_GeomFromText($3,4326)) RETURNING id`, [lot.cemetery_id,lot.id,shapes['TLC-GPS-0382']]);
      await c.query(`INSERT INTO gravesites(cemetery_id,facility_id,section_id,lot_id,lot_uuid,grave_id,gravesite_id,name,status_type_id,geometry)
        VALUES($1,'1','C','83',$2,'0383','TLC-GPS-0383','William Hamilton DeCourcy',gen_random_uuid(),ST_GeomFromText($3,4326))`, [lot.cemetery_id,lot.id,shapes['TLC-GPS-0383']]);
      const { rows: [marker] } = await c.query(`INSERT INTO headstones(headstone_id,marker_type_id,material_type_id,condition_type_id,geometry)
        VALUES('TLC-HS-0382',gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),ST_GeomFromText($1,4326)) RETURNING id`, [shapes.marker]);
      for (const name of ['William DeWitt DeCourcy','Louise DeCourcy/Hamilton']) {
        const { rows: [burial] } = await c.query(`INSERT INTO burials(full_name,gravesite_uuid,gravesite_id,interment_type_id,burial_record_status_type_id)
          VALUES($1,$2,'TLC-GPS-0382',gen_random_uuid(),gen_random_uuid()) RETURNING id`, [name,grave.id]);
        await c.query('INSERT INTO headstone_burials(headstone_uuid,burial_uuid) VALUES($1,$2)', [marker.id,burial.id]);
      }
      await c.query(original);
    }
    await run(c);
  } finally { await c.query('ROLLBACK'); await c.end(); }
}
async function snapshot(c) {
  const rows = {};
  for (const table of tables) rows[table] = (await c.query(`SELECT * FROM ${table} ORDER BY to_jsonb(${table})::text`)).rows;
  return rows;
}

test('473 fits the historical pair in C-83 and preserves dimensions, marker, assignments, links and C-0383', async () => fixture(async c => {
  const before = await snapshot(c);
  const { rows: initial } = await c.query(`SELECT ST_Area(ST_Difference(g.geometry,l.geometry)::geography)/0.09290304 spill
    FROM gravesites g JOIN lots l ON l.id=g.lot_uuid WHERE g.gravesite_id<>'TLC-GPS-0383'`);
  for (const row of initial) assert.ok(Math.abs(row.spill-1.5024)<0.001);
  await c.query(sql);
  const after = await snapshot(c);
  for (const table of tables.filter(t => t !== 'gravesites')) assert.deepEqual(after[table],before[table]);
  for (const row of after.gravesites) {
    const old = before.gravesites.find(g => g.id === row.id);
    if (row.gravesite_id === 'TLC-GPS-0383') { assert.deepEqual(row,old); continue; }
    const preserved = { ...row };
    for (const field of ['geometry','geometry_source','geometry_notes','updated_at']) preserved[field] = old[field];
    assert.deepEqual(preserved,old);
    assert.notEqual(row.geometry,old.geometry);
  }
  const { rows } = await c.query(`SELECT g.gravesite_id,ST_Covers(l.geometry,g.geometry) covered,
    ST_Area(g.geometry::geography)/0.09290304 sqft,ST_Y(ST_Centroid(g.geometry)) latitude
    FROM gravesites g JOIN lots l ON l.id=g.lot_uuid WHERE g.gravesite_id<>'TLC-GPS-0383' ORDER BY g.gravesite_id`);
  assert.equal(rows.length,2);
  for (const g of rows) { assert.equal(g.covered,true); assert.ok(Math.abs(g.sqft-40)<0.01); }
  assert.ok(rows[1].latitude>rows[0].latitude);
  assert.equal((await c.query(`SELECT count(*)::int n FROM gravesites a JOIN gravesites b ON a.id<b.id
    WHERE ST_Area(ST_Intersection(a.geometry,b.geometry)::geography)>0.00001`)).rows[0].n,0);
  await c.query(sql);
  assert.deepEqual(await snapshot(c),after);
}));

test('473 is a no-op without source graves', async () => fixture(async c => {
  const before = await snapshot(c); await c.query(sql); assert.deepEqual(await snapshot(c),before);
}, false));

for (const [name, mutation, message] of [
  ['missing partner', "DELETE FROM gravesites WHERE gravesite_id='TLC-GPS-0382-01'", /both active/],
  ['changed lot assignment', "UPDATE gravesites SET lot_id='82' WHERE gravesite_id='TLC-GPS-0382-01'", /unchanged C-83/],
  ['missing shared link', 'DELETE FROM headstone_gravesites', /unchanged C-83/],
  ['later geometry edit', "UPDATE gravesites SET geometry=ST_Translate(geometry,0,0.000001) WHERE gravesite_id='TLC-GPS-0382-01'", /unchanged migration-346/],
  ['partially aligned pair', "UPDATE gravesites SET geometry=ST_Transform(ST_Translate(ST_Transform(geometry,32617),-0.38*0.3048,0),4326) WHERE gravesite_id='TLC-GPS-0382-01'", /partially aligned/],
  ['changed dimensions', "UPDATE gravesites SET width_feet=5 WHERE gravesite_id='TLC-GPS-0382-01'", /unchanged C-83/],
  ['changed lot geometry', "UPDATE lots SET geometry=ST_Translate(geometry,0.000001,0) WHERE lot_id='83'", /must fit C-83/],
  ['new neighboring overlap', `INSERT INTO gravesites(cemetery_id,facility_id,section_id,grave_id,gravesite_id,status_type_id,geometry)
    SELECT cemetery_id,'1','C','BLKR','BLOCKER',status_type_id,geometry FROM gravesites WHERE gravesite_id='TLC-GPS-0382'`, /must fit C-83/],
]) {
  test(`473 rejects ${name} without partial changes`, async () => fixture(async c => {
    await c.query(mutation);
    const before = await snapshot(c);
    await c.query('SAVEPOINT attempted');
    await assert.rejects(c.query(sql),message);
    await c.query('ROLLBACK TO SAVEPOINT attempted');
    assert.deepEqual(await snapshot(c),before);
  }));
}
