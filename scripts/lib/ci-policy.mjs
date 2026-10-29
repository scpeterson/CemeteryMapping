// Unknown paths take the full application path; do not skip required checks at workflow level.
export function documentationPath(path) {
  return path.startsWith('docs/') || ['README.md', 'CHANGELOG.md', 'db/README.md', 'deploy/test/README.md'].includes(path);
}
export function classifyChanges(paths, event) {
  return { application: event !== 'pull_request' || paths.length === 0 || paths.some((path) => !documentationPath(path)), documentation: paths.some(documentationPath) };
}
export function assertCiResults(needs) {
  if (needs.changes?.result !== 'success') throw new Error('Change classification did not succeed.');
  if (!['true', 'false'].includes(needs.changes.outputs?.application) || !['true', 'false'].includes(needs.changes.outputs?.documentation)) throw new Error('Missing or invalid classification outputs.');
  for (const job of ['quick', 'database', 'browser']) {
    const expected = needs.changes.outputs.application === 'true' ? 'success' : 'skipped';
    if (needs[job]?.result !== expected) throw new Error(`${job} must be ${expected}.`);
  }
  const expected = needs.changes.outputs.documentation === 'true' ? 'success' : 'skipped';
  if (needs.documentation?.result !== expected) throw new Error(`documentation must be ${expected}.`);
}
