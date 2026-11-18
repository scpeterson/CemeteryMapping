import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHeadstoneRoutes } from './routes/headstoneRoutes.mjs';
import { validateCreateHeadstonePayload } from './routes/cemeteryRouteValidation.mjs';

for (const headstoneId of [undefined, '', '  ']) {
  test(`marker creation route accepts automatic ID (${JSON.stringify(headstoneId)})`, async () => {
    let handlers;
    const id = '11111111-1111-4111-8111-111111111111';
    const requirePowerUser = () => {};
    const created = { id, headstoneId: 'TLC-HS-0600', relationshipType: 'primary' };
    registerHeadstoneRoutes({
      get() {}, patch() {}, delete() {},
      post(path, ...registered) {
        if (path === '/api/cemeteries/:cemeteryId/gravesites/:graveSpaceId/headstones') handlers = registered;
      },
    }, {
      requirePowerUser,
      validateCemeteryId: value => value,
      validateGraveSpaceId: value => value,
      validateCreateHeadstonePayload,
      async createHeadstoneForGrave(_pool, cemetery, grave, payload) {
        assert.equal(cemetery, id);
        assert.equal(grave, 'G-015');
        assert.equal(payload.headstoneId, '');
        assert.equal(payload.relationshipType, 'primary');
        return created;
      },
    });
    assert.equal(handlers[0], requirePowerUser);
    let status, body;
    const response = { status(value) { status = value; return this; }, json(value) { body = value; } };
    await handlers.at(-1)({
      params: { cemeteryId: id, graveSpaceId: 'G-015' }, user: { role: 'admin' },
      body: { headstoneId, markerTypeId: id, markerScopeId: id, materialId: id, conditionId: id, relationshipType: 'primary' },
    }, response, error => { throw error; });
    assert.equal(status, 201);
    assert.deepEqual(body, created);
  });
}
