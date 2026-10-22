import {createLegacyTableFixture} from "./lib/legacy-table-fixtures.mjs";
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import { loadApiConfig } from '../server/config.mjs';
import { integrationAdminDatabase } from './lib/integration-admin.mjs';

const migration = await readFile(new URL('../db/changelog/changes/454-correct-tlc-hs-0505-burial-link.sql', import.meta.url), 'utf8');
async function fixture(run) {
  const c = new pg.Client(integrationAdminDatabase(loadApiConfig()));
  await c.connect();
  try {
    await c.query('BEGIN');
    for (const table of ['gravesites','headstones','burials','headstone_burials','headstone_gravesites']) {
      await createLegacyTableFixture(c, table);
    }
    const {rows:[grave]} = await c.query(`INSERT INTO gravesites(cemetery_id,section_id,grave_id,gravesite_id,status_type_id,geometry)
      VALUES(gen_random_uuid(),'D','0499','TLC-GPS-0499',gen_random_uuid(),ST_Multi(ST_MakeEnvelope(-80.08050,40.60155,-80.08046,40.60157,4326))) RETURNING id`);
    const {rows:[marker]} = await c.query(`INSERT INTO headstones(headstone_id,gravesite_uuid,marker_type_id,material_type_id,condition_type_id,geometry)
      VALUES('TLC-HS-0505',$1,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),ST_SetSRID(ST_MakePoint(-80.08049551453139,40.60155927179527),4326)) RETURNING id`,[grave.id]);
    const people=[];
    for (const name of ['Clifford Chester Brant','Jacoueline Lois Brant']) {
      const {rows:[person]}=await c.query(`INSERT INTO burials(gravesite_uuid,gravesite_id,full_name,interment_type_id,burial_record_status_type_id)
        VALUES($1,'TLC-GPS-0499',$2,gen_random_uuid(),gen_random_uuid()) RETURNING id`,[grave.id,name]);
      people.push(person.id);
    }
    await c.query("INSERT INTO headstone_gravesites(headstone_uuid,gravesite_uuid,relationship_type) VALUES($1,$2,'footstone')",[marker.id,grave.id]);
    await run(c,{marker:marker.id,clifford:people[0],jacoueline:people[1]});
  } finally {await c.query('ROLLBACK');await c.end();}
}
async function preserved(c) {
  const result={};
  for (const table of ['gravesites','headstones','burials','headstone_gravesites']) result[table]=(await c.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
  return result;
}
test('explicit Clifford link replaces fallback without changing marker, people or graves; repeat is harmless',async()=>{
  await fixture(async(c,{marker,clifford})=>{
    const before=await preserved(c);
    await c.query(migration);
    assert.deepEqual((await c.query('SELECT burial_uuid FROM headstone_burials WHERE headstone_uuid=$1 AND deleted_at IS NULL',[marker])).rows,[{burial_uuid:clifford}]);
    assert.deepEqual(await preserved(c),before);
    const links=(await c.query('SELECT * FROM headstone_burials')).rows;
    await c.query(migration);
    assert.deepEqual((await c.query('SELECT * FROM headstone_burials')).rows,links);
  });
});
test('incorrect Jacoueline link is retired while Clifford is restored and retired history survives',async()=>{
  await fixture(async(c,{marker,clifford,jacoueline})=>{
    await c.query(`INSERT INTO headstone_burials(headstone_uuid,burial_uuid,deleted_at,delete_reason)
      VALUES($1,$2,now(),'Previously retired'),($1,$3,NULL,NULL)`,[marker,clifford,jacoueline]);
    const before=await preserved(c);
    await c.query(migration);
    const links=(await c.query('SELECT * FROM headstone_burials ORDER BY burial_uuid')).rows;
    assert.equal(links.find(l=>l.burial_uuid===clifford).deleted_at,null);
    assert.ok(links.find(l=>l.burial_uuid===jacoueline).deleted_at);
    assert.deepEqual(await preserved(c),before);
  });
});
test('unexpected source records are rejected before changing links',async()=>{
  for(const setup of ["UPDATE burials SET full_name='Unknown' WHERE full_name='Clifford Chester Brant'", "UPDATE gravesites SET gravesite_id='TLC-GPS-OTHER'"]) {
    await fixture(async c=>{
      await c.query(setup);await c.query('SAVEPOINT correction');
      await assert.rejects(c.query(migration),/Migration prerequisite failed/);
      await c.query('ROLLBACK TO SAVEPOINT correction');
      assert.equal((await c.query('SELECT count(*)::int n FROM headstone_burials')).rows[0].n,0);
    });
  }
});
test('no active marker leaves records unchanged',async()=>{
  await fixture(async c=>{
    await c.query('DELETE FROM headstones');const before=await preserved(c);
    await c.query(migration);assert.deepEqual(await preserved(c),before);
  });
});
