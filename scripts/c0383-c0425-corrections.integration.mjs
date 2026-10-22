import {createLegacyTableFixture} from "./lib/legacy-table-fixtures.mjs";
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import { loadApiConfig } from '../server/config.mjs';
import { integrationAdminDatabase } from './lib/integration-admin.mjs';
const retire = await readFile(new URL('../db/changelog/changes/474-retire-c-0425-plot-marker-placeholder.sql',import.meta.url),'utf8');
const align = await readFile(new URL('../db/changelog/changes/475-align-c-0383-decourcy-with-lot-83.sql',import.meta.url),'utf8');
const tables = ['lots','gravesites','burials','headstones','headstone_gravesites','headstone_burials'];
// Reviewed DEV and hosted TEST coordinates; no environment-specific record IDs.
const shapes = {
  "TLC-GPS-0382-01": "MULTIPOLYGON(((-80.0805876945449 40.601092106993924,-80.08055168336769 40.60109210698831,-80.08055168336179 40.601103086201825,-80.0805876945449 40.60110308620744,-80.0805876945449 40.601092106993924)))",
  "TLC-GPS-0383": "MULTIPOLYGON(((-80.08058801 40.60110323039324,-80.08055199881682 40.60110323038763,-80.08055199881092 40.60111420960113,-80.08058801 40.601114209606735,-80.08058801 40.60110323039324)))",
  "TLC-GPS-0384": "MULTIPOLYGON(((-80.08058766 40.60111284039325,-80.08055164881166 40.60111284038764,-80.08055164880577 40.60112381960111,-80.08058766 40.60112381960672,-80.08058766 40.60111284039325)))",
  "TLC-GPS-0425": "MULTIPOLYGON(((-80.08055249 40.60110446039325,-80.08051647881615 40.601104460387646,-80.08051647881027 40.601115439601124,-80.08055249 40.60111543960673,-80.08055249 40.60110446039325)))",
  "lot82": "MULTIPOLYGON(((-80.08055303595604 40.60106621102368,-80.08055303596045 40.601120972072934,-80.08051697379788 40.60112097207461,-80.0805169737935 40.60106621102535,-80.08055303595604 40.60106621102368)))",
  "lot83": "MULTIPOLYGON(((-80.08058909811864 40.60106621102199,-80.08058909812301 40.60112097207124,-80.08055303596045 40.601120972072934,-80.08055303595604 40.60106621102368,-80.08058909811864 40.60106621102199)))",
  "TLC-HS-0383": "POINT(-80.08058726454425 40.60110842179734)",
  "TLC-HS-0425": "POINT(-80.0805517445484 40.60110965179621)"
};
async function fixture(run, seed=true) {
  const c = new pg.Client(integrationAdminDatabase(loadApiConfig())); await c.connect();
  try {
    await c.query('BEGIN');
    for (const table of tables) await createLegacyTableFixture(c, table);
    if (seed) {
      const {rows:[lot]} = await c.query(`INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,name,geometry)
        VALUES(gen_random_uuid(),'1','C','83','C-83',ST_GeomFromText($1,4326)) RETURNING *`,[shapes.lot83]);
      await c.query(`INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,name,geometry)
        VALUES($1,'1','C','82','C-82',ST_GeomFromText($2,4326))`,[lot.cemetery_id,shapes.lot82]);
      for (const [id,name] of [['0382-01','Louise Hamilton DeCourcy'],['0383','William Hamilton DeCourcy'],['0384','Allan J Watenpool'],['0425','Plot marker, W']]) {
        const pub = `TLC-GPS-${id}`;
        const {rows:[g]} = await c.query(`INSERT INTO gravesites(cemetery_id,facility_id,section_id,lot_id,lot_uuid,grave_id,gravesite_id,name,
          width_feet,length_feet,status_type_id,geometry_type,geometry_confidence,geometry)
          VALUES($1,'1','C',$2,$3,$4,$5,$6,4,10,gen_random_uuid(),'operational','estimated',ST_GeomFromText($7,4326)) RETURNING id`,
        [lot.cemetery_id,id.startsWith('0382')||id==='0383'?'83':null,id.startsWith('0382')||id==='0383'?lot.id:null,id==='0382-01'?'0382A':id,pub,name,shapes[pub]]);
        if (id==='0382-01') {
          // Neighbors must use migration 473's corrected footprint.
          await c.query('UPDATE gravesites SET geometry=ST_Transform(ST_Translate(ST_Transform(geometry,32617),-0.38*0.3048,0),4326) WHERE id=$1',[g.id]);
          continue;
        }
        if (id==='0384') continue;
        const {rows:[h]} = await c.query(`INSERT INTO headstones(headstone_id,gravesite_uuid,marker_type_id,material_type_id,condition_type_id,
          inscription,geometry,source_properties,review_notes)
          VALUES($1,$2,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),$3,ST_GeomFromText($4,4326),
          '{"FieldEvidence":"preserve"}','Reviewed physical marker') RETURNING id`,
        [`TLC-HS-${id}`,g.id,id==='0425'?'W':'WILLIAM HAMILTON DeCOURCY',shapes[`TLC-HS-${id}`]]);
        const {rows:[b]} = await c.query(`INSERT INTO burials(gravesite_uuid,gravesite_id,full_name,first_name,last_name,interment_type_id,burial_record_status_type_id)
          VALUES($1,$2,$3,$4,$5,gen_random_uuid(),gen_random_uuid()) RETURNING id`,
        [g.id,pub,name,id==='0425'?null:'William Hamilton',id==='0425'?name:'DeCourcy']);
        await c.query("INSERT INTO headstone_gravesites(headstone_uuid,gravesite_uuid,relationship_type) VALUES($1,$2,'primary')",[h.id,g.id]);
        await c.query('INSERT INTO headstone_burials(headstone_uuid,burial_uuid) VALUES($1,$2)',[h.id,b.id]);
      }
    }
    await run(c);
  } finally {await c.query('ROLLBACK');await c.end();}
}
async function snapshot(c) {
  const result={};for(const table of tables) result[table]=(await c.query(`SELECT * FROM ${table} ORDER BY to_jsonb(${table})::text`)).rows;
  return result;
}
async function overlaps(c) {
  return (await c.query(`SELECT n.gravesite_id,ST_Area(ST_Intersection(g.geometry,n.geometry)::geography)/0.09290304 sqft
    FROM gravesites g JOIN gravesites n ON g.id<>n.id AND n.deleted_at IS NULL AND ST_Intersects(g.geometry,n.geometry)
    WHERE g.gravesite_id='TLC-GPS-0383' AND ST_Area(ST_Intersection(g.geometry,n.geometry)::geography)>0.00001 ORDER BY n.gravesite_id`)).rows;
}
test('474 retires only the plot-marker import artifacts and 475 aligns C-0383 without moving C-0384',async()=>fixture(async c=>{
  const before=await snapshot(c);
  assert.deepEqual((await overlaps(c)).map(r=>r.gravesite_id),['TLC-GPS-0384','TLC-GPS-0425']);
  await c.query(retire);await c.query(align);
  const after=await snapshot(c);
  assert.deepEqual(after.lots,before.lots);
  for(const table of tables.filter(t=>t!=='lots')) {
    for(const row of after[table]) {
      const key=table==='headstone_burials'?['headstone_uuid','burial_uuid']:['id'];
      const old=before[table].find(b=>key.every(k=>b[k]===row[k]));
      assert.ok(old);
      const copy={...row};
      const isPlaceholder=table==='gravesites'&&row.gravesite_id==='TLC-GPS-0425';
      const marker=before.headstones.find(h=>h.headstone_id==='TLC-HS-0425');
      const grave=before.gravesites.find(g=>g.gravesite_id==='TLC-GPS-0425');
      const isPseudo=table==='burials'&&row.gravesite_uuid===grave.id;
      const isLink=(table==='headstone_gravesites'&&row.gravesite_uuid===grave.id)||(table==='headstone_burials'&&row.headstone_uuid===marker.id);
      if(isPlaceholder||isPseudo||isLink) {
        assert.ok(row.deleted_at);assert.match(row.delete_reason,/plot-marker/);
        for(const k of ['deleted_at','deleted_by','delete_reason','updated_at']) if(k in copy)copy[k]=old[k];
      } else if(table==='headstones'&&row.id===marker.id) {
        assert.equal(row.gravesite_uuid,null);assert.equal(row.deleted_at,null);
        copy.gravesite_uuid=old.gravesite_uuid;copy.updated_at=old.updated_at;
      } else if(table==='gravesites'&&row.gravesite_id==='TLC-GPS-0383') {
        assert.notEqual(row.geometry,old.geometry);assert.match(row.geometry_notes,/C-0384.*separate review/);
        for(const k of ['geometry','geometry_source','geometry_notes','updated_at'])copy[k]=old[k];
      }
      assert.deepEqual(copy,old);
    }
  }
  const {rows:[g]}=await c.query(`SELECT ST_Covers(l.geometry,g.geometry) covered,ST_Area(g.geometry::geography)/0.09290304 sqft
    FROM gravesites g JOIN lots l ON l.id=g.lot_uuid WHERE g.gravesite_id='TLC-GPS-0383'`);
  assert.equal(g.covered,true);assert.ok(Math.abs(g.sqft-40)<0.01);
  const remaining=await overlaps(c);assert.equal(remaining.length,1);assert.equal(remaining[0].gravesite_id,'TLC-GPS-0384');
  assert.ok(Math.abs(remaining[0].sqft-4.8223)<0.001);
  await c.query(retire);await c.query(align);assert.deepEqual(await snapshot(c),after);
}));
test('474 recognizes the hosted legacy plot marker by provenance without inventing inscription or classification',async()=>fixture(async c=>{
  await c.query(`UPDATE headstones SET inscription=NULL,faces='[]',
    marker_type_id=(SELECT id FROM marker_types WHERE code='unknown'),source_properties=
    '{"Person1Last":"Plot marker, W","ShapefileGeometryUpdate":{"source":"TrinityCemeteryFinal3.shp","shapefileName":"Plot marker, W","matchConfidence":"high"}}'
    WHERE headstone_id='TLC-HS-0425'`);
  const {rows:[before]}=await c.query("SELECT * FROM headstones WHERE headstone_id='TLC-HS-0425'");
  await c.query(retire);
  const {rows:[after]}=await c.query("SELECT * FROM headstones WHERE headstone_id='TLC-HS-0425'");
  assert.equal(after.gravesite_uuid,null);assert.equal(after.deleted_at,null);
  after.gravesite_uuid=before.gravesite_uuid;after.updated_at=before.updated_at;
  assert.deepEqual(after,before);
  assert.equal((await c.query("SELECT count(*)::int n FROM burials WHERE gravesite_id='TLC-GPS-0425' AND deleted_at IS NULL")).rows[0].n,0);
  assert.ok((await c.query("SELECT deleted_at FROM gravesites WHERE gravesite_id='TLC-GPS-0425'")).rows[0].deleted_at);
}));
test('474 and 475 safely skip absent source records',async()=>fixture(async c=>{
  const before=await snapshot(c);await c.query(retire);await c.query(align);assert.deepEqual(await snapshot(c),before);
},false));

for(const [name,mutation,migration,expected] of [
  ['unidentified blank marker',"UPDATE headstones SET inscription=NULL WHERE headstone_id='TLC-HS-0425'",retire,/active W plot marker/],
  ['conflicting inscription despite provenance',`UPDATE headstones SET inscription='Real person',source_properties='{"Person1Last":"Plot marker, W","ShapefileGeometryUpdate":{"source":"TrinityCemeteryFinal3.shp","shapefileName":"Plot marker, W","matchConfidence":"high"}}' WHERE headstone_id='TLC-HS-0425'`,retire,/active W plot marker/],
  ['missing plot marker',"DELETE FROM headstones WHERE headstone_id='TLC-HS-0425'",retire,/active W plot marker/],
  ['real burial name',"UPDATE burials SET full_name='Real Person' WHERE gravesite_id='TLC-GPS-0425'",retire,/no real burial/],
  ['interment date on pseudo-burial',"UPDATE burials SET burial_date='1957-12-02' WHERE gravesite_id='TLC-GPS-0425'",retire,/no real burial/],
  ['another marker link',`INSERT INTO headstone_gravesites(headstone_uuid,gravesite_uuid,relationship_type)
    SELECT h.id,g.id,'spans' FROM headstones h CROSS JOIN gravesites g WHERE h.headstone_id='TLC-HS-0383' AND g.gravesite_id='TLC-GPS-0425'`,retire,/no real burial/],
  ['active C-0425 placeholder','SELECT 1',align,/retired C-0425/],
  ['changed C-0383 assignment',"UPDATE gravesites SET lot_id='82' WHERE gravesite_id='TLC-GPS-0383'",align,/unchanged C-83/],
  ['later C-0383 geometry',"UPDATE gravesites SET geometry=ST_Translate(geometry,0,0.000001) WHERE gravesite_id='TLC-GPS-0383'",align,/reviewed original/],
  ['new overlap',`INSERT INTO gravesites(cemetery_id,facility_id,section_id,grave_id,gravesite_id,status_type_id,geometry)
    SELECT cemetery_id,'1','C','BLKR','BLOCKER',status_type_id,geometry FROM gravesites WHERE gravesite_id='TLC-GPS-0383'`,align,/no new overlaps/],
  ['changed C-0384 overlap',"UPDATE gravesites SET geometry=ST_Translate(geometry,0,-0.000001) WHERE gravesite_id='TLC-GPS-0384'",align,/no new overlaps/],
]) {
  test(`correction rejects ${name} without partial changes`,async()=>fixture(async c=>{
    if(migration===align&&name!=='active C-0425 placeholder')await c.query(retire);
    await c.query(mutation);const before=await snapshot(c);await c.query('SAVEPOINT attempt');
    await assert.rejects(c.query(migration),expected);await c.query('ROLLBACK TO SAVEPOINT attempt');
    assert.deepEqual(await snapshot(c),before);
  }));
}
