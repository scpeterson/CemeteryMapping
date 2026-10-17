import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const path = 'changes/346-split-c-0382-decourcy-gravesites.sql';
test('migration history preserves the original 346 bytes and ordered root registration', async () => {
  const sql = await readFile(new URL(`../db/changelog/${path}`, import.meta.url));
  // Original branch cfc76bf5; Liquibase 4.33.0 independently verifies v9 checksum
  // 9:c000ed388b4420abf954b08bf3f2a4d1 in the database integration suite.
  assert.equal(createHash('sha256').update(sql).digest('hex'),
    '6c17fdc0c930cfa5f29d22d246cfd3725939b7e42f90c083f72ac149b4d50176');
  const root = await readFile(new URL('../db/changelog/db.changelog-root.yaml', import.meta.url), 'utf8');
  const files = Array.from(root.matchAll(/file: (changes\/[^\s]+)/gu), match => match[1]);
  const index = files.indexOf(path);
  assert.equal(files.filter(file => file === path).length, 1);
  assert.equal(files[index - 1], 'changes/345-split-c-0381-brandt-gravesites.sql');
  assert.equal(files[index + 1], 'changes/347-remove-c-0424-placeholder-gravesite.sql');
});
