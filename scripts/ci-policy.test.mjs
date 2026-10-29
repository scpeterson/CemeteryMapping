import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyChanges, assertCiResults } from './lib/ci-policy.mjs';
test('only recognized documentation-only PRs skip application checks', () => {
  assert.deepEqual(classifyChanges(['docs/adr/new.md', 'CHANGELOG.md'], 'pull_request'), { application: false, documentation: true });
  for (const paths of [[], ['server/api.mjs'], ['docs/new.md', 'package.json'], ['unknown.txt']]) assert.equal(classifyChanges(paths, 'pull_request').application, true);
  assert.equal(classifyChanges(['docs/new.md'], 'push').application, true);
});
function results(application = 'true', documentation = 'true') {
  return { changes: { result: 'success', outputs: { application, documentation } }, ...Object.fromEntries(['quick', 'database', 'browser'].map((job) => [job, { result: application === 'true' ? 'success' : 'skipped' }])), documentation: { result: documentation === 'true' ? 'success' : 'skipped' } };
}
test('required gate permits intentional skips only and rejects failed, canceled or missing jobs', () => {
  assert.doesNotThrow(() => assertCiResults(results()));
  assert.doesNotThrow(() => assertCiResults(results('false')));
  assert.doesNotThrow(() => assertCiResults(results('true', 'false')));
  for (const job of ['changes', 'quick', 'database', 'browser', 'documentation']) {
    for (const result of ['failure', 'cancelled', 'skipped', undefined]) {
      const needs = results(); needs[job].result = result;
      assert.throws(() => assertCiResults(needs));
    }
  }
  const invalid = results('false'); delete invalid.changes.outputs.application;
  assert.throws(() => assertCiResults(invalid));
  const needs = results('false'); needs.browser.result = 'success';
  assert.throws(() => assertCiResults(needs));
});
