import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

test('inspection 485 accepts only its two verified historical checksums and preserves forward SQL',async()=>{
 const sql=await readFile(new URL('../db/changelog/changes/485-monument-inspections.sql',import.meta.url),'utf8');
 // Liquibase 4.33.0 independently reproduced a61d2f9 and c2f2ad9 checksums.
 assert.deepEqual([...sql.matchAll(/^--validCheckSum (.+)$/gm)].map(match=>match[1]),['9:80e840954817aa20f23a6eea565e034b','9:60043b74ad3258d56775dc20560d1e9b']);
 const forward=sql.split(/\r?\n/).filter(line=>line.trim() && !line.trimStart().startsWith('--')).join('\n');
 assert.equal(createHash('sha256').update(forward).digest('hex'),'270c1db78331535be039d0d96ea5639776e1426660382d5c8f2e8711e154eccd');
});


test('inspection deletion schema rollback cleans up its trigger, function and column in dependency order',async()=>{
 const sql=await readFile(new URL('../db/changelog/changes/494-delete-monument-inspections.sql',import.meta.url),'utf8');
 assert.ok(sql.includes('--validCheckSum 9:d23e64dddeaa1faba3b5081cc513d5d5'));
 const rollback=sql.split('\n').filter(line=>line.startsWith('--rollback '));
 assert.deepEqual(rollback,[
  '--rollback DROP TRIGGER IF EXISTS reject_deleted_inspection_photo_context ON monument_photo_contexts;',
  '--rollback DROP FUNCTION IF EXISTS reject_deleted_inspection_photo_context();',
  '--rollback ALTER TABLE monument_inspections DROP COLUMN deleted_at;',
 ]);
});
