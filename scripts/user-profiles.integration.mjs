import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { loadApiConfig } from '../server/config.mjs';
import { integrationAdminDatabase } from './lib/integration-admin.mjs';
import { createUser, updateUser, listUsers } from '../server/adminRepository.mjs';
import { updateProfile, getProfile, listUserActivity } from '../server/profileRepository.mjs';

test('profile migration preserves access and supports multi-cemetery roles, profile edits and activity', async () => {
 const config = loadApiConfig();
 assert.equal(config.appEnv, 'test');
 const client = new pg.Client(integrationAdminDatabase(config));
 await client.connect();
 try {
  await client.query('BEGIN');
  const before = (await client.query(`SELECT a.id, a.can_edit, u.role_name FROM app_user_cemetery_access a JOIN app_users u ON u.id=a.app_user_id ORDER BY a.id`)).rows;
  if (!(await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='app_user_cemetery_access' AND column_name='role_name'`)).rows.length) {
   await client.query(await readFile(new URL('../db/changelog/changes/509-user-profiles-and-cemetery-memberships.sql', import.meta.url), 'utf8'));
   const after = (await client.query('SELECT id, role_name FROM app_user_cemetery_access ORDER BY id')).rows;
   assert.deepEqual(after.map(row => row.role_name), before.map(row => row.can_edit && ['power-user','cemetery-admin'].includes(row.role_name) ? row.role_name : 'reader'));
  }
  const cemeteries = (await client.query('SELECT id::text FROM cemeteries WHERE deleted_at IS NULL ORDER BY id LIMIT 2')).rows;
  assert.equal(cemeteries.length, 2, 'Two test cemeteries required');
  const [a,b] = cemeteries.map(row => row.id);
  // Nested repository transactions use savepoints; outer test always rolls back.
  const scoped = { query: (sql, values) => client.query(sql === 'BEGIN' ? 'SAVEPOINT repository' : sql === 'COMMIT' ? 'RELEASE SAVEPOINT repository' : sql === 'ROLLBACK' ? 'ROLLBACK TO SAVEPOINT repository' : sql, values), release() {} };
  const pool = { query: scoped.query, connect: async () => scoped };
  const input = { externalSubject: `profile-test|${randomUUID()}`, email: `profile-${randomUUID()}@example.test`, displayName: 'Test Member', role: 'cemetery-admin', isActive: true, assignedCemeteryIds: [a,b], cemeteryMemberships: [{ cemeteryId: a, role: 'cemetery-admin' }, { cemeteryId: b, role: 'reader' }] };
  const user = await createUser(pool, input);
  assert.equal(user.cemeteryMemberships.find(entry => entry.cemeteryId === b).role, 'reader');
  const actor = { id: user.id, subject: input.externalSubject, email: input.email, role: 'cemetery-admin' };
  await updateProfile(pool, actor, { displayName: 'Updated Member', phone: '555-0100', organization: 'Test organization', preferredCemeteryId: b });
  const profile = await getProfile(pool, actor);
  assert.equal(profile.displayName, 'Updated Member');
  assert.equal(profile.preferredCemeteryId, b);
  const listed = (await listUsers(pool)).find(entry => entry.id === user.id);
  assert.equal(listed.phone, '555-0100');
  assert.equal(listed.role, 'cemetery-admin');
  assert.ok((await listUserActivity(pool,user.id)).some(event => event.tableName === 'app_users' && event.reason === 'Updated own profile'));
  const updated = await updateUser(pool, user.id, { ...input, cemeteryMemberships: [{ cemeteryId: a, role: 'reader' }, { cemeteryId: b, role: 'power-user' }], actorUser: actor });
  assert.equal(updated.cemeteryMemberships.find(entry => entry.cemeteryId === b).role, 'power-user');
 } finally { await client.query('ROLLBACK'); await client.end(); }
});
