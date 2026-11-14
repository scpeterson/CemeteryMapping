import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import { loadApiConfig } from '../server/config.mjs';
import { integrationAdminDatabase } from './lib/integration-admin.mjs';

const sql = await readFile(new URL('../db/changelog/changes/518-assign-c-0384-to-c-88.sql', import.meta.url), 'utf8');
const tables = ['lots','gravesites','headstones','burials','headstone_gravesites','headstone_burials'];
async function fixture(run, seed = true) {
  const c = new pg.Client(integrationAdminDatabase(loadApiConfig())); await c.connect();
  try {
    await c.query('BEGIN');
    for (const table of tables) await c.query(`CREATE TEMP TABLE ${table}(LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`);
    // LIKE does not copy triggers; exercise the real assignment capacity rule too.
    await c.query(`CREATE TRIGGER fixture_capacity BEFORE INSERT OR UPDATE OF lot_uuid,deleted_at ON pg_temp.gravesites
      FOR EACH ROW EXECUTE FUNCTION public.enforce_lot_gravesite_limit()`);
    if (seed) {
      const {rows:[lot]} = await c.query(`INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,name,geometry)
        VALUES(gen_random_uuid(),'1','C','88','C-88',ST_Multi(ST_MakeEnvelope(-80.0805891,40.60112097,-80.080553,40.60117573,4326))) RETURNING *`);
      const {rows:[grave]} = await c.query(`INSERT INTO gravesites(cemetery_id,facility_id,section_id,grave_id,gravesite_id,name,
        width_feet,length_feet,status_type_id,geometry_type,geometry_confidence,geometry_notes,geometry)
        VALUES($1,'1','C','0384','TLC-GPS-0384','Allan J Watenpool',4,10,gen_random_uuid(),'operational','estimated',
        'Existing overlap requires separate review.',ST_Multi(ST_MakeEnvelope(-80.08058766,40.60111284,-80.08055165,40.60112382,4326))) RETURNING *`,[lot.cemetery_id]);
      await c.query(`INSERT INTO gravesites(cemetery_id,facility_id,section_id,grave_id,gravesite_id,name,status_type_id,geometry)
        VALUES($1,'1','C','0383','TLC-GPS-0383','William Hamilton DeCourcy',gen_random_uuid(),
        ST_Multi(ST_MakeEnvelope(-80.080588,40.6011032,-80.080552,40.6011142,4326)))`,[lot.cemetery_id]);
      const {rows:[marker]} = await c.query(`INSERT INTO headstones(headstone_id,gravesite_uuid,marker_type_id,material_type_id,condition_type_id,
        inscription,geometry,source_properties,faces)
        VALUES('TLC-HS-0384',$1,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'Allan J. Watenpool / 1911-1944',
        ST_SetSRID(ST_MakePoint(-80.08058691454379,40.60111803179733),4326),'{"Evidence":"preserve"}',
        '[{"id":"00000000-0000-0000-0000-000000000001","label":"Front","inscription":"Allan","burialIds":[],"mediaAssetIds":[]}]') RETURNING id`,[grave.id]);
      const {rows:[burial]} = await c.query(`INSERT INTO burials(gravesite_uuid,gravesite_id,full_name,first_name,last_name,
        interment_type_id,burial_record_status_type_id,death_date,notes)
        VALUES($1,'TLC-GPS-0384','Allan Joseph Watenpool','Allan Joseph','Watenpool',gen_random_uuid(),gen_random_uuid(),'1944-12-09','Existing source facts') RETURNING id`,[grave.id]);
      await c.query("INSERT INTO headstone_gravesites(headstone_uuid,gravesite_uuid,relationship_type) VALUES($1,$2,'primary')",[marker.id,grave.id]);
      await c.query('INSERT INTO headstone_burials(headstone_uuid,burial_uuid) VALUES($1,$2)',[marker.id,burial.id]);
    }
    await run(c);
  } finally { await c.query('ROLLBACK'); await c.end(); }
}
async function snapshot(c) {
  const out={};
  for (const t of tables) out[t]=(await c.query(`SELECT * FROM ${t} ORDER BY to_jsonb(${t})::text`)).rows;
  return out;
}
test('518 assigns both lot fields while preserving all geometry, marker, people, links and neighbors',async()=>fixture(async c=>{
  const before=await snapshot(c);
  assert.equal((await c.query(`SELECT ST_Covers(l.geometry,h.geometry) inside FROM lots l CROSS JOIN headstones h`)).rows[0].inside,false);
  await c.query(sql);const after=await snapshot(c);
  const lot=before.lots[0];
  for (const table of tables) {
    assert.equal(after[table].length,before[table].length);
    for (const row of after[table]) {
      const old=before[table].find(b=>table==='headstone_burials'?b.headstone_uuid===row.headstone_uuid&&b.burial_uuid===row.burial_uuid:b.id===row.id);
      const copy={...row};
      if (table==='gravesites'&&row.gravesite_id==='TLC-GPS-0384') {
        assert.equal(row.lot_id,'88');assert.equal(row.lot_uuid,lot.id);
        for(const k of ['lot_id','lot_uuid','updated_at']) copy[k]=old[k];
      }
      assert.deepEqual(copy,old);
    }
  }
  await c.query("UPDATE gravesites SET updated_at='2000-01-01T00:00:00Z' WHERE gravesite_id='TLC-GPS-0384'");
  const repeatedBefore=await snapshot(c);
  await c.query(sql);assert.deepEqual(await snapshot(c),repeatedBefore);
}));
for(const mutation of ['SELECT 1',"UPDATE gravesites SET deleted_at=now() WHERE gravesite_id='TLC-GPS-0384'"]) {
 test('518 skips absent or retired C-0384',async()=>fixture(async c=>{
   await c.query(mutation);const before=await snapshot(c);await c.query(sql);assert.deepEqual(await snapshot(c),before);
 },mutation!=='SELECT 1'));
}
for(const [name,mutation,message] of [
 ['missing target lot','DELETE FROM lots',/one active section-scoped/],
 ['deleted target lot','UPDATE lots SET deleted_at=now()',/one active section-scoped/],
 ['different cemetery','UPDATE lots SET cemetery_id=gen_random_uuid()',/one active section-scoped/],
 ['different section UUID','UPDATE lots SET section_uuid=gen_random_uuid()',/unassigned or already correctly/],
 ['non-burial lot',"UPDATE lots SET burial_use_status='non_burial'",/unassigned or already correctly/],
 ['conflicting assignment',"UPDATE gravesites SET lot_id='83',lot_uuid=gen_random_uuid() WHERE gravesite_id='TLC-GPS-0384'",/conflicting assignments/],
 ['partial assignment',"UPDATE gravesites SET lot_id='88' WHERE gravesite_id='TLC-GPS-0384'",/conflicting assignments/],
 ['wrong identity',"UPDATE gravesites SET name='Different person' WHERE gravesite_id='TLC-GPS-0384'",/Allan Watenpool/],
 ['missing marker','DELETE FROM headstones',/active marker/],
 ['deleted marker','UPDATE headstones SET deleted_at=now()',/active marker/],
 ['missing marker link','DELETE FROM headstone_gravesites',/active marker/],
 ['full lot',`INSERT INTO gravesites(cemetery_id,facility_id,section_id,grave_id,gravesite_id,status_type_id,lot_id,lot_uuid,geometry)
   SELECT l.cemetery_id,'1','C','F'||i,'FILLER-'||i,gen_random_uuid(),'88',l.id,l.geometry FROM lots l CROSS JOIN generate_series(1,5) i`,/five active gravesites/],
]) {
 test(`518 rejects ${name} without partial changes`,async()=>fixture(async c=>{
   await c.query(mutation);const before=await snapshot(c);await c.query('SAVEPOINT attempt');
   await assert.rejects(c.query(sql),message);await c.query('ROLLBACK TO SAVEPOINT attempt');assert.deepEqual(await snapshot(c),before);
 }));
}
