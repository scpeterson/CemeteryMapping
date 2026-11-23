import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createApp } from './index.mjs';
import { validateCreateBurialPayload } from './routes/cemeteryRouteValidation.mjs';

test('new burial validates identity, record status, source holder and retry token', () => {
  const input = { firstName: 'Jane', lastName: 'Example', expectedVersion: '1', operationId: randomUUID() };
  assert.equal(validateCreateBurialPayload(input).recordStatusCode, 'interred');
  assert.throws(() => validateCreateBurialPayload({ ...input, firstName: '', lastName: '' }), /name/);
  assert.equal(validateCreateBurialPayload({ ...input, recordStatusCode: 'pre_need_inscription' }).recordStatusCode, 'pre_need_inscription');
  assert.throws(() => validateCreateBurialPayload({ ...input, recordStatusCode: 'invalid' }), /status/);
  assert.throws(() => validateCreateBurialPayload({ ...input, operationId: 'invalid' }), /Request ID/);
  assert.throws(() => validateCreateBurialPayload({ ...input, sourceOwnerId: 'invalid' }), /Deed holder/);
  assert.throws(() => validateCreateBurialPayload({ ...input, expectedVersion: undefined }), /version/);
});

test('Add burial rejects anonymous, readers and unassigned editors before querying data', async t => {
  let queries = 0;
  const app = createApp({ appEnv: 'test', auth: { mode: 'trusted-header', roleHeader: 'x-role', emailHeader: 'x-email', subjectHeader: 'x-subject', auth0: { management: {} } } },
    { query: async () => { queries++; throw Error('Unauthorized request queried data'); } });
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  t.after(() => new Promise(r => server.close(r)));
  const url = `http://127.0.0.1:${server.address().port}/api/cemeteries/11111111-1111-4111-8111-111111111111/grave-spaces/A-TEST/burials`;
  assert.equal((await fetch(url, { method: 'POST' })).status, 401);
  for (const role of ['reader', 'power-user', 'cemetery-admin']) {
    assert.equal((await fetch(url, { method: 'POST', headers: { 'x-role': role, 'x-email': 'test@example.test', 'x-cemetery-user-cemetery-ids': '22222222-2222-4222-8222-222222222222' } })).status, 403);
  }
  assert.equal(queries, 0);
});
