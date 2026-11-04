import assert from 'node:assert/strict';
import test from 'node:test';
import { validateProfile, updateProfile } from './profileRepository.mjs';
import { validateAdminUserPayload } from './routes/adminRouteValidation.mjs';
import { assertInspectionEditor } from './monumentInspections.mjs';
const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';

test('profile input cannot change roles, identity or account status', () => {
  assert.deepEqual(validateProfile({ displayName: ' Name ', role: 'admin', email: 'other@example.test', isActive: true }), {
    displayName: 'Name', phone: '', organization: '', preferredCemeteryId: null,
  });
  assert.throws(() => validateProfile({ phone: 'x'.repeat(51) }), /too long/);
  assert.throws(() => validateProfile({ preferredCemeteryId: 'invalid' }), /UUID/);
});

test('profile cannot choose an unassigned preferred cemetery and rolls back', async () => {
  const calls = [];
  const client = { query: async sql => { calls.push(sql); return { rows: [] }; }, release() {} };
  await assert.rejects(updateProfile({ connect: async () => client }, { id: a, role: 'reader' }, validateProfile({ preferredCemeteryId: b })), /assigned cemeteries/);
  assert.ok(calls.includes('ROLLBACK'));
  assert.ok(!calls.some(sql => sql.startsWith('UPDATE app_users')));
});

test('admin membership validation rejects duplicate cemeteries and global admin membership', () => {
  const base = { externalSubject: 'auth0|user', email: 'user@example.test', role: 'reader' };
  const roles = ['admin', 'cemetery-admin', 'power-user', 'reader'];
  const valid = validateAdminUserPayload({ ...base, cemeteryMemberships: [{ cemeteryId: a, role: 'cemetery-admin' }, { cemeteryId: b, role: 'reader' }] }, roles);
  assert.equal(valid.role, 'cemetery-admin');
  assert.deepEqual(valid.assignedCemeteryIds, [a, b]);
  assert.throws(() => validateAdminUserPayload({ ...base, cemeteryMemberships: [{ cemeteryId: a, role: 'reader' }, { cemeteryId: a, role: 'power-user' }] }, roles), /only be assigned once/);
  assert.throws(() => validateAdminUserPayload({ ...base, cemeteryMemberships: [{ cemeteryId: a, role: 'admin' }] }, roles), /Invalid cemetery role/);
});

test('inspection editing uses the role of the target cemetery', () => {
  const user = { role: 'cemetery-admin', cemeteryAccess: [{ cemeteryId: a, role: 'cemetery-admin', canEdit: true }, { cemeteryId: b, role: 'power-user', canEdit: true }] };
  assert.doesNotThrow(() => assertInspectionEditor(user, a));
  assert.throws(() => assertInspectionEditor(user, b), { statusCode: 403 });
});

test('admin reports exclude lower-role memberships in the same account', async () => {
  const { runReport } = await import('./reportsRepository.mjs');
  const scopes = [];
  const client = { query: async (_sql, values = []) => { scopes.push(values); return { rows: [] }; }, release() {} };
  const pool = { connect: async () => client };
  await runReport(pool, 'missing-nhg-links', {}, { role: 'cemetery-admin', cemeteryAccess: [
    { cemeteryId: a, role: 'cemetery-admin', canEdit: true }, { cemeteryId: b, role: 'reader', canEdit: false },
  ] });
  assert.ok(scopes.some(values => JSON.stringify(values).includes(a)));
  assert.ok(scopes.every(values => !JSON.stringify(values).includes(b)));
});
