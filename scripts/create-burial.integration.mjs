import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { loadApiConfig } from '../server/config.mjs';
import { integrationAdminDatabase } from './lib/integration-admin.mjs';
import { fieldTransactionPool } from '../server/fieldOperationReceipts.mjs';
import { createBurial } from '../server/createBurial.mjs';
import { validateCreateBurialPayload } from '../server/routes/cemeteryRouteValidation.mjs';
import { getGraveSpace } from '../server/cemeteryRepository.mjs';
import { createOwnershipEvent } from '../server/cemeteryOwnershipMutations.mjs';
import { selectOwnersForGrave } from '../server/cemeteryOwnershipQueries.mjs';
import { validateOwnershipEventPayload } from '../server/routes/cemeteryRouteValidation.mjs';

const config = loadApiConfig(); assert.equal(config.appEnv, 'test');
const area = "ST_Multi(ST_MakeEnvelope(-80,40,-79.99,40.01,4326))";
async function fixture(run) {
  const c = new pg.Client(integrationAdminDatabase(config)); await c.connect();
  try {
    await c.query('BEGIN');
    const cemetery = randomUUID(), section = randomUUID(), grave = randomUUID(), lot = randomUUID();
    await c.query(`INSERT INTO cemeteries(id,name,geometry) VALUES($1,'Burial regression',${area})`, [cemetery]);
    await c.query(`INSERT INTO sections(section_id,cemetery_id,name,geometry) VALUES($1,$2,'A',${area})`, [section, cemetery]);
    await c.query(`INSERT INTO lots(id,cemetery_id,section_uuid,section_id,lot_id,geometry) VALUES($1,$2,$3,'A','1',${area})`, [lot, cemetery, section]);
    await c.query(`INSERT INTO gravesites(id,cemetery_id,section_uuid,section_id,grave_id,gravesite_id,lot_uuid,lot_id,status_type_id,geometry)
      VALUES($1,$2,$3,'A','1','A-ADD',$4,'1',(SELECT id FROM gravesite_status_types WHERE code='sold'),${area})`, [grave, cemetery, section, lot]);
    const owner = (await c.query("INSERT INTO owners(gravesite_uuid,owner) VALUES($1,'Existing Purchaser') RETURNING id::text", [grave])).rows[0];
    const pool = fieldTransactionPool(c), actorUser = { subject: 'burial-test-'+randomUUID(), role: 'admin', email: 'burial@example.test' };
    const input = async patch => validateCreateBurialPayload({ firstName: 'Jane', lastName: 'Example', birthDate: '1940', burialDate: '2026-11-21', intermentType: 'casket',
      expectedVersion: (await c.query('SELECT xmin::text AS version FROM gravesites WHERE id=$1', [grave])).rows[0].version, operationId: randomUUID(), ...patch });
    const call = data => createBurial(pool, cemetery, 'A-ADD', data, { actorUser, allowedCemeteryIds: [cemetery] });
    await run({ c, cemetery, section, grave, lot, owner, pool, actorUser, input, call });
  } finally { await c.query('ROLLBACK'); await c.end(); }
}

test('purchased gravesite accepts deed holder or another person without changing deeds, geometry or markers; retries are idempotent', () => fixture(async f => {
  const snapshot = async () => (await f.c.query(`SELECT (SELECT to_jsonb(g) FROM gravesites g WHERE id=$1) AS grave,
    (SELECT jsonb_agg(to_jsonb(o)) FROM owners o WHERE gravesite_uuid=$1) AS owners,
    (SELECT count(*)::int FROM ownership_events) AS deeds,(SELECT count(*)::int FROM headstones) AS markers`, [f.grave])).rows[0];
  const before = await snapshot();
  const first = await f.input({ sourceOwnerId: f.owner.id, firstName: 'Existing', lastName: 'Purchaser' });
  const saved = await f.call(first); assert.equal(saved.person.firstName, 'Existing'); assert.ok(saved.auditEventId);
  assert.equal((await f.call(first)).id, saved.id);
  await assert.rejects(f.call({ ...first, firstName: 'Changed retry' }), /already used/);
  const other = await f.call(await f.input({ firstName: 'Family', lastName: 'Member' })); assert.notEqual(other.id, saved.id);
  assert.equal((await getGraveSpace(f.pool, f.cemetery, 'A-ADD')).status, 'occupied');
  assert.deepEqual(await snapshot(), before);
  assert.equal((await f.c.query('SELECT count(*)::int AS n FROM burials WHERE gravesite_uuid=$1', [f.grave])).rows[0].n, 2);
  await assert.rejects(f.call(await f.input({ firstName: 'Family', lastName: 'Member' })), /matching person/);
  await assert.rejects(f.call(await f.input({ firstName: 'Wrong', sourceOwnerId: randomUUID() })), /deed holder changed/);
  await assert.rejects(f.call(await f.input({ firstName: 'Stale', expectedVersion: '0' })), /changed|conflict/i);
}));

test('location burial capacity rejects new casket/urn conflicts atomically, including receipt rollback', () => fixture(async f => {
  await f.c.query("INSERT INTO location_policies(cemetery_id,section_uuid,rule_key,enabled,reason) VALUES($1,$2,'casket_or_two_urns',true,'Regression')", [f.cemetery,f.section]);
  await f.call(await f.input({ firstName: 'First', intermentType: 'urn' }));
  await f.call(await f.input({ firstName: 'Second', intermentType: 'urn' }));
  const third = await f.input({ firstName: 'Third', intermentType: 'urn' });
  const assertRejected = async data => {
    await f.c.query('SAVEPOINT capacity_attempt');
    try { await assert.rejects(async () => { await f.call(data); await f.c.query('SET CONSTRAINTS ALL IMMEDIATE'); }, e => e.code === '23514'); }
    finally { await f.c.query('ROLLBACK TO SAVEPOINT capacity_attempt'); await f.c.query('RELEASE SAVEPOINT capacity_attempt'); }
  };
  await assertRejected(third);
  await assertRejected(await f.input({ firstName: 'Casket', intermentType: 'casket' }));
  assert.equal((await f.c.query('SELECT count(*)::int AS n FROM burials WHERE gravesite_uuid=$1', [f.grave])).rows[0].n, 2);
  assert.equal((await f.c.query('SELECT count(*)::int AS n FROM field_operations WHERE actor_subject=$1 AND operation_id=$2', [f.actorUser.subject,third.operationId])).rows[0].n, 0);
}));

test('pre-need unknown interment is allowed beside an urn; only actual interment enforces urn type', () => fixture(async f => {
  await f.c.query("INSERT INTO location_policies(cemetery_id,section_uuid,rule_key,enabled,reason) VALUES($1,$2,'casket_or_two_urns',true,'Regression')", [f.cemetery,f.section]);
  await f.call(await f.input({ firstName: 'First', intermentType: 'urn' }));
  const planned = await f.call(await f.input({ firstName: 'Future', intermentType: 'unknown', recordStatusCode: 'pre_need_inscription', burialDate: '' }));
  assert.equal(planned.intermentType, 'unknown');
  assert.equal(planned.recordStatusCode, 'pre_need_inscription');
  assert.equal((await getGraveSpace(f.pool, f.cemetery, 'A-ADD')).status, 'occupied');
  await f.c.query('SET CONSTRAINTS ALL IMMEDIATE');
  for (const intermentType of ['unknown', 'casket']) {
    await f.c.query('SAVEPOINT incompatible_interment');
    try {
      await assert.rejects(f.c.query(`UPDATE burials SET burial_record_status_type_id=(SELECT id FROM burial_record_status_types WHERE code='interred'), interment_type_id=(SELECT id FROM burial_interment_types WHERE code=$2) WHERE id=$1`, [planned.id, intermentType]), e => e.code === '23514');
    } finally { await f.c.query('ROLLBACK TO SAVEPOINT incompatible_interment'); }
  }
  await f.c.query('SAVEPOINT second_interment');
  await f.c.query(`UPDATE burials SET burial_record_status_type_id=(SELECT id FROM burial_record_status_types WHERE code='interred'), interment_type_id=(SELECT id FROM burial_interment_types WHERE code='urn') WHERE id=$1`, [planned.id]);
  await f.c.query('SET CONSTRAINTS ALL IMMEDIATE');
  assert.equal((await getGraveSpace(f.pool, f.cemetery, 'A-ADD')).burials.length, 2);
  await f.c.query('ROLLBACK TO SAVEPOINT second_interment');
  await f.call(await f.input({ firstName: 'Second', intermentType: 'urn' }));
  await f.c.query('SET CONSTRAINTS ALL IMMEDIATE');
  assert.equal((await getGraveSpace(f.pool, f.cemetery, 'A-ADD')).burials.length, 3);
  await f.call(await f.input({ firstName: 'Another inscription', intermentType: 'unknown', recordStatusCode: 'pre_need_inscription', burialDate: '' }));
  await f.c.query('SAVEPOINT planned_interment');
  try {
    await assert.rejects(f.c.query(`UPDATE burials SET burial_record_status_type_id=(SELECT id FROM burial_record_status_types WHERE code='interred') WHERE id=$1`, [planned.id]), e => e.code === '23514');
  } finally { await f.c.query('ROLLBACK TO SAVEPOINT planned_interment'); }
}));

test('source holder must belong to the target grave; stale holder and disallowed cemetery do not create rows', () => fixture(async f => {
  const input = await f.input({ sourceOwnerId: f.owner.id, sourceOwnerVersion: '0' });
  await assert.rejects(f.call(input), /deed holder changed/);
  assert.equal(await createBurial(f.pool,f.cemetery,'A-ADD',await f.input(),{actorUser:f.actorUser,allowedCemeteryIds:[]}),undefined);
  assert.equal(await createBurial(f.pool,f.cemetery,'missing',await f.input(),{actorUser:f.actorUser,allowedCemeteryIds:[f.cemetery]}),undefined);
  assert.equal((await f.c.query('SELECT count(*)::int AS n FROM burials WHERE gravesite_uuid=$1',[f.grave])).rows[0].n,0);
}));

test('an inherited lot deed holder can be buried without transferring or rewriting ownership', () => fixture(async f => {
  await f.c.query('DELETE FROM owners WHERE gravesite_uuid=$1', [f.grave]);
  await createOwnershipEvent(f.pool, f.cemetery, 'A-ADD', validateOwnershipEventPayload({
    owners: [{ firstName: 'Lot', lastName: 'Purchaser' }], eventType: 'deed', targetScope: 'selected_lot', effectiveDate: '2001',
  }), { actorUser: f.actorUser });
  const owners = await selectOwnersForGrave(f.c, f.grave);
  assert.equal(owners.length, 1);
  const snapshot = async () => (await f.c.query(`SELECT
    (SELECT jsonb_agg(to_jsonb(e)) FROM ownership_events e WHERE cemetery_id=$1) AS events,
    (SELECT jsonb_agg(to_jsonb(r)) FROM ownership_event_rights r WHERE cemetery_id=$1) AS rights,
    (SELECT jsonb_agg(to_jsonb(p)) FROM ownership_parties p) AS parties,
    (SELECT jsonb_agg(to_jsonb(p)) FROM ownership_event_parties p) AS event_parties`, [f.cemetery])).rows[0];
  const before = await snapshot();
  const saved = await f.call(await f.input({ firstName: 'Lot', lastName: 'Purchaser', sourceOwnerId: owners[0].id, sourceOwnerVersion: owners[0].version }));
  assert.equal(saved.person.firstName, 'Lot');
  assert.deepEqual(await snapshot(), before);
  assert.deepEqual(await selectOwnersForGrave(f.c, f.grave), owners);
}));

test('restricted runtime database role can create an attributed burial', () => fixture(async f => {
  const input = await f.input();
  await f.c.query('SET LOCAL ROLE cemetery_api');
  try {
    const saved = await f.call(input);
    assert.ok(saved.id);
    assert.ok(saved.auditEventId);
  } finally { await f.c.query('RESET ROLE'); }
}));

test('Add burial honors an approved three-ashes exception only on the associated plot', () => fixture(async f => {
  await f.c.query(`INSERT INTO location_policies(cemetery_id,section_uuid,rule_key,enabled,reason)
    VALUES($1,$2,'casket_or_two_urns',true,'Regression')`, [f.cemetery, f.section]);
  const { rows: [approved] } = await f.c.query(`
    INSERT INTO gravesites(cemetery_id,section_uuid,section_id,grave_id,gravesite_id,status_type_id,geometry)
    VALUES($1,$2,'A','72','A-EXCEPTION',(SELECT id FROM gravesite_status_types WHERE code='sold'),${area})
    RETURNING id, xmin::text AS version`, [f.cemetery, f.section]);
  await f.c.query("INSERT INTO burial_capacity_exceptions VALUES($1,3,0,'Fixture approved deed')", [approved.id]);
  await f.c.query('SET CONSTRAINTS ALL IMMEDIATE');

  const add = async (name, exception = false) => {
    const data = await f.input({ firstName: name, intermentType: 'urn', ...(exception ? { expectedVersion: approved.version } : {}) });
    return exception
      ? createBurial(f.pool, f.cemetery, 'A-EXCEPTION', data, { actorUser: f.actorUser, allowedCemeteryIds: [f.cemetery] })
      : f.call(data);
  };
  for (const name of ['First', 'Second']) {
    await add(name);
    await add(name, true);
  }
  await f.c.query('SAVEPOINT third_standard');
  await assert.rejects(add('Third'), { constraint: 'location_policy_capacity' });
  await f.c.query('ROLLBACK TO SAVEPOINT third_standard');
  await f.c.query('RELEASE SAVEPOINT third_standard');
  assert.equal((await add('Third', true)).intermentType, 'urn');
  assert.equal((await getGraveSpace(f.pool, f.cemetery, 'A-ADD')).burials.length, 2);
  assert.equal((await getGraveSpace(f.pool, f.cemetery, 'A-EXCEPTION')).burials.length, 3);
}));
