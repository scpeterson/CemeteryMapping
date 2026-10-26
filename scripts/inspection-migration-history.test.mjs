import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

test('inspection 485 accepts only its verified original checksum and preserves forward SQL',async()=>{
 const sql=await readFile(new URL('../db/changelog/changes/485-monument-inspections.sql',import.meta.url),'utf8');
 // Liquibase 4.33 independently verified the original a61d2f9 checksum.
 assert.deepEqual([...sql.matchAll(/^--validCheckSum (.+)$/gm)].map(match=>match[1]),['9:80e840954817aa20f23a6eea565e034b']);
 const forward=sql.split(/\r?\n/).filter(line=>line.trim() && !line.trimStart().startsWith('--')).join('\n');
 assert.equal(createHash('sha256').update(forward).digest('hex'),'270c1db78331535be039d0d96ea5639776e1426660382d5c8f2e8711e154eccd');
});
