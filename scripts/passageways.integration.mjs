import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {updateGraveLotAssignment} from '../server/cemeteryGraveMutations.mjs';
import {createOwnershipEvent} from '../server/cemeteryOwnershipMutations.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
const schema=await readFile(new URL('../db/changelog/changes/502-passageway-area-type.sql',import.meta.url),'utf8');
const seed=await readFile(new URL('../db/changelog/changes/503-create-reviewed-passageways.sql',import.meta.url),'utf8');
const outlines=[{"name":"A","geometry":{"type":"MultiPolygon","coordinates":[[[[-80.0796166419,40.6013259465],[-80.0798446317,40.6013178015],[-80.0798446317,40.6013071096],[-80.0798655732,40.6013056412],[-80.0798768946,40.601295008],[-80.0800477704,40.6012899458],[-80.080037764,40.6011477037],[-80.0800334126,40.6010876019],[-80.0800319079,40.6010674785],[-80.0800304015,40.6010596997],[-80.0800271217,40.6010524365],[-80.0800178448,40.6010485727],[-80.0800055909,40.6010479568],[-80.0799848694,40.6010482726],[-80.0799422579,40.6010496264],[-80.0797822544,40.6010567792],[-80.0796166419,40.6013259465]]]]}},{"name":"C","geometry":{"type":"MultiPolygon","coordinates":[[[[-80.0806139983,40.6010526971],[-80.0806004211,40.6010467666],[-80.080587418,40.6010419267],[-80.0805422067,40.6010416662],[-80.0804763072,40.6010421982],[-80.0803432155,40.6010475537],[-80.08010146,40.6010539016],[-80.0800839985,40.6010564068],[-80.0800725244,40.6010661137],[-80.0800639014,40.6010927691],[-80.0800742958,40.6011788108],[-80.0800833482,40.6012679073],[-80.0801061465,40.6014511909],[-80.0801097263,40.6014671283],[-80.0801157486,40.6014799379],[-80.0801251243,40.6014904756],[-80.0801368958,40.6015006845],[-80.080148883,40.6015069484],[-80.080169157,40.6015157585],[-80.0801880989,40.6015208684],[-80.0805862619,40.6015198856],[-80.0806083901,40.6015197948],[-80.0806278359,40.6015183946],[-80.0806430911,40.6015158492],[-80.0806576753,40.601511776],[-80.0806718902,40.6015009928],[-80.0806834219,40.6014889369],[-80.0806740524,40.6012292848],[-80.0806735458,40.6012152324],[-80.0806601663,40.6011249177],[-80.0806505408,40.6010910626],[-80.0806386876,40.6010687888],[-80.0806263905,40.6010596888],[-80.0806139983,40.6010526971]]]]}},{"name":"B","geometry":{"type":"MultiPolygon","coordinates":[[[[-80.079850666,40.601334807],[-80.07968984700001,40.601338776000006],[-80.079694493,40.601715033000005],[-80.07997717,40.601802094],[-80.079973463,40.601610012],[-80.07996499500001,40.601607109],[-80.079954434,40.601599726],[-80.079943705,40.601586617],[-80.079933647,40.601571979],[-80.07992409100001,40.601568415],[-80.07991252400001,40.601565488000006],[-80.079902802,40.601562688],[-80.079895425,40.601558361],[-80.07989157,40.601550851000006],[-80.079890061,40.601525395],[-80.07984077500001,40.601524377000004],[-80.079840066,40.601491176],[-80.07983205800001,40.60148823],[-80.079828538,40.6013679],[-80.079839899,40.601366118],[-80.07984944,40.601363005],[-80.079851672,40.60135624],[-80.079850666,40.601334807]]]]}},{"name":"D","geometry":{"type":"MultiPolygon","coordinates":[[[[-80.0800220049,40.6016049739],[-80.0800142587,40.6016073051],[-80.0800209341,40.6018155725],[-80.0802188815,40.6018765372],[-80.080469586,40.60161246734887],[-80.0806870726,40.6016177671],[-80.0806864061,40.6015942398],[-80.080670081,40.6015779614],[-80.0806439292,40.601558615],[-80.0806278359,40.6015504693],[-80.0805909556,40.6015428324],[-80.0805534051,40.6015433412],[-80.0800816701,40.6015471689],[-80.0800683894,40.6015794598],[-80.08006122,40.6015901803],[-80.0800395553,40.6015994909],[-80.0800220049,40.6016049739]]]]}}];
async function fixture(run){
 const cfg=loadApiConfig();assert.equal(cfg.appEnv,'test');const c=new pg.Client(integrationAdminDatabase(cfg));await c.connect();
 try{await c.query('BEGIN');
 await c.query(`CREATE TEMP TABLE lots (LIKE public.lots INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP;
 ALTER TABLE lots DROP COLUMN IF EXISTS area_type; ALTER TABLE lots DROP COLUMN IF EXISTS location_references;
 CREATE TEMP TABLE cemeteries(id uuid DEFAULT gen_random_uuid(),facility_id text,deleted_at timestamptz) ON COMMIT DROP;
 CREATE TEMP TABLE sections(section_id uuid DEFAULT gen_random_uuid(),cemetery_id uuid,name text,geometry geometry(MultiPolygon,4326),deleted_at timestamptz) ON COMMIT DROP;
 CREATE TEMP TABLE gravesites(id uuid DEFAULT gen_random_uuid(),lot_uuid uuid,cemetery_id uuid,gravesite_id text,lot_id text,section_id text,section_uuid uuid,block_id text,block_uuid uuid,updated_at timestamptz,deleted_at timestamptz) ON COMMIT DROP;
 CREATE TEMP TABLE ownership_event_rights(id uuid DEFAULT gen_random_uuid(),lot_uuid uuid,target_type text,gravesite_uuid uuid,ownership_event_uuid uuid,right_type text,notes text,deleted_at timestamptz) ON COMMIT DROP;
 CREATE TEMP TABLE lot_ownership_events(id uuid DEFAULT gen_random_uuid(),lot_uuid uuid,deleted_at timestamptz) ON COMMIT DROP;
 CREATE TEMP TABLE ownership_events(id uuid DEFAULT gen_random_uuid(),cemetery_id uuid,event_type text,effective_date date,effective_date_text text,deed_on_file boolean,deed_register_on_file boolean,recorded_by text,document_reference text,notes text,source_table text) ON COMMIT DROP;
 CREATE TEMP TABLE ownership_parties(id uuid DEFAULT gen_random_uuid(),display_name text,first_name text,last_name text,full_address text,municipality text,state text,zip text) ON COMMIT DROP;
 CREATE TEMP TABLE ownership_event_parties(ownership_event_uuid uuid,ownership_party_uuid uuid,ownership_role text,share_numerator int,share_denominator int) ON COMMIT DROP;
 INSERT INTO cemeteries(facility_id) VALUES('1')`);
 for(const s of outlines)await c.query(`INSERT INTO sections(cemetery_id,name,geometry) SELECT id,$1,ST_SetSRID(ST_GeomFromGeoJSON($2),4326) FROM cemeteries`,[s.name,JSON.stringify(s.geometry)]);
 await c.query(`INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,geometry) SELECT id,'1','A','FIXED',ST_Multi(ST_MakeEnvelope(-80.08003,40.60118,-80.08002,40.60119,4326)) FROM cemeteries`);
 // CI has already installed the function; replace it only within this rollback fixture.
 await c.query(schema.replace("CREATE FUNCTION enforce_passageway_conversion()", "CREATE OR REPLACE FUNCTION enforce_passageway_conversion()"));
 await c.query(`CREATE TRIGGER passageway_fixture_capacity BEFORE INSERT OR UPDATE ON gravesites FOR EACH ROW EXECUTE FUNCTION enforce_lot_gravesite_limit()`);
 await run(c);
 }finally{await c.query('ROLLBACK');await c.end();}
}
test('ten typed passageways preserve ordinary lots, references, geometry and existing assignments',()=>fixture(async c=>{
 const before=(await c.query("SELECT to_jsonb(l) data FROM lots l WHERE area_type='lot'")).rows;
 await c.query(seed);
 const result=(await c.query(`SELECT count(*) count,sum(jsonb_array_length(location_references)) source_rows FROM lots WHERE area_type='passageway'`)).rows[0];
 assert.equal(result.count,'10');assert.equal(result.source_rows,'101');
 assert.deepEqual((await c.query("SELECT to_jsonb(l) data FROM lots l WHERE area_type='lot'")).rows,before);
 assert.equal((await c.query('SELECT count(*) count FROM gravesites')).rows[0].count,'0');
 assert.equal((await c.query(`SELECT count(*) count FROM lots p JOIN sections s ON s.name=p.section_id WHERE p.area_type='passageway' AND (NOT ST_IsValid(p.geometry) OR ST_IsEmpty(p.geometry) OR NOT ST_CoveredBy(p.geometry,ST_Buffer(s.geometry,1e-12)))`)).rows[0].count,'0');
 assert.equal((await c.query(`SELECT count(*) count FROM lots p JOIN lots l ON l.id<>p.id WHERE p.area_type='passageway' AND ST_Area(ST_Intersection(p.geometry,l.geometry)::geography)>.000001`)).rows[0].count,'0');
}));
for(const table of ['ownership_event_rights','lot_ownership_events'])test(`${table} cannot grant whole-passageway ownership`,()=>fixture(async c=>{
 await c.query(seed);await assert.rejects(c.query(`INSERT INTO ${table}(lot_uuid) SELECT id FROM lots WHERE area_type='passageway' LIMIT 1`),/passageway cannot have whole-area/);
}));
test('individual passageway gravesite deeds work beyond five gravesites',()=>fixture(async c=>{
 await c.query(seed);
 const lot=(await c.query("SELECT id FROM lots WHERE name='D-P03'")).rows[0].id;
 await c.query(`INSERT INTO gravesites(lot_uuid) SELECT $1 FROM generate_series(1,8)`,[lot]);
 await c.query(`INSERT INTO ownership_event_rights(target_type,gravesite_uuid) SELECT 'gravesite',id FROM gravesites`);
 assert.equal((await c.query('SELECT count(*) count FROM ownership_event_rights')).rows[0].count,'8');
}));
test('ordinary lots retain the five-gravesite limit',()=>fixture(async c=>{
 const lot=(await c.query("SELECT id FROM lots WHERE lot_id='FIXED'")).rows[0].id;
 await c.query(`INSERT INTO gravesites(lot_uuid) SELECT $1 FROM generate_series(1,5)`,[lot]);
 await assert.rejects(c.query('INSERT INTO gravesites(lot_uuid) VALUES($1)',[lot]),/five active/);
}));
test('existing whole-lot rights cannot silently become passageway rights',()=>fixture(async c=>{
 await c.query("INSERT INTO ownership_event_rights(lot_uuid) SELECT id FROM lots WHERE lot_id='FIXED'");
 await assert.rejects(c.query("UPDATE lots SET area_type='passageway' WHERE lot_id='FIXED'"),/Resolve existing whole-lot rights/);
}));
test('passageway creation refuses an occupied identifier',()=>fixture(async c=>{
 await c.query("UPDATE lots SET lot_id='P01'");await assert.rejects(c.query(seed),/identifiers must be unused/);
}));

test('the assignment and deed APIs link a grave to a passageway and retain individual rights',()=>fixture(async c=>{
 await c.query(seed);
 const cemetery=(await c.query('SELECT id FROM cemeteries')).rows[0].id;
 const passage=(await c.query("SELECT id FROM lots WHERE name='D-P03'")).rows[0].id;
 await c.query("INSERT INTO gravesites(cemetery_id,gravesite_id,section_id) VALUES($1,'FIXTURE-GRAVE','D')",[cemetery]);
 const pool={connect:async()=>({release(){},query:(sql,values)=>c.query(sql==='BEGIN'?'SAVEPOINT operation':sql==='COMMIT'?'RELEASE SAVEPOINT operation':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT operation':sql,values)})};
 const assignment=await updateGraveLotAssignment(pool,cemetery,'FIXTURE-GRAVE','P03',{lotUuid:passage,allowedCemeteryIds:[cemetery]});
 assert.equal(assignment.areaType,'passageway');assert.equal(assignment.lotId,'P03');
 const event=await createOwnershipEvent(pool,cemetery,'FIXTURE-GRAVE',{owners:[{firstName:'Fixture',lastName:'Owner',shareNumerator:1,shareDenominator:1}],eventType:'deed',targetScope:'selected_gravesite',effectiveDate:'2026-10-29',documentReference:'Fixture deed'}, {allowedCemeteryIds:[cemetery]});
 const right=(await c.query('SELECT * FROM ownership_event_rights WHERE ownership_event_uuid=$1',[event.id])).rows[0];
 assert.equal(right.target_type,'gravesite');assert.equal(right.lot_uuid,null);assert.ok(right.gravesite_uuid);
 await assert.rejects(createOwnershipEvent(pool,cemetery,'FIXTURE-GRAVE',{owners:[],eventType:'deed',targetScope:'selected_lot'}, {allowedCemeteryIds:[cemetery]}),/passageway cannot have whole-area ownership/);
 assert.equal((await c.query('SELECT count(*) count FROM ownership_events')).rows[0].count,'1');
}));
