import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { loadApiConfig } from '../server/config.mjs';
import { integrationAdminDatabase } from './lib/integration-admin.mjs';
import { listNorthHillsOcrReview } from '../server/northHillsOcrReviewRepository.mjs';

test('unknown readings suggest same-row markers across page breaks without confirming evidence', async () => {
  const pool = new pg.Pool(integrationAdminDatabase(loadApiConfig()));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const table of ['north_hills_ocr_import_batches', 'north_hills_ocr_entries', 'burials', 'gravesites', 'headstones', 'headstone_gravesites', 'headstone_burials', 'north_hills_ocr_source_facts', 'north_hills_ocr_entry_observations', 'north_hills_ocr_entry_gravesite_links', 'north_hills_ocr_entry_headstone_links']) {
      await client.query(`CREATE TEMP TABLE ${table} ON COMMIT DROP AS SELECT * FROM public.${table} WHERE false`);
    }
    await client.query('ALTER TABLE north_hills_ocr_import_batches ADD PRIMARY KEY (id)');
    const { rows: [ids] } = await client.query('SELECT gen_random_uuid() AS batch, gen_random_uuid() AS cemetery, gen_random_uuid() AS entry, gen_random_uuid() AS grave, gen_random_uuid() AS burial, gen_random_uuid() AS marker');
    await client.query('INSERT INTO north_hills_ocr_import_batches (id,cemetery_id) VALUES ($1,$2)', [ids.batch, ids.cemetery]);
    await client.query(`INSERT INTO north_hills_ocr_entries (id,batch_id,cemetery_id,source_page_number,name_text,surnames,parsed_years,parsed_section_name,parsed_row_number)
      VALUES ($1,$2,$3,222,'UNKNOWN',ARRAY['UNKNOWN'],ARRAY[]::integer[],'D',3)`, [ids.entry, ids.batch, ids.cemetery]);
    await client.query(`INSERT INTO gravesites (id,cemetery_id,gravesite_id,grave_id,section_id) VALUES ($1,$2,'TLC-GPS-0455','0455','D')`, [ids.grave, ids.cemetery]);
    await client.query(`INSERT INTO burials (id,gravesite_uuid,full_name,notes) VALUES ($1,$2,'Johann Conrad Soergel','North Hills Genealogists page: 223.')`, [ids.burial, ids.grave]);
    await client.query(`INSERT INTO headstones (id,gravesite_uuid,headstone_id,source_properties) VALUES ($1,$2,'TLC-HS-0455','{"NhgSection":"D","NhgRow":"3","NhgPage":223}')`, [ids.marker, ids.grave]);
    const matches = async () => {
      const result = await listNorthHillsOcrReview(client, { q: '222' });
      return result.entries[0].candidateMatches;
    };
    const [match] = await matches();
    assert.equal(match.gravesiteId, 'TLC-GPS-0455');
    assert.equal(match.headstoneCandidates[0].headstoneId, 'TLC-HS-0455');
    assert.deepEqual(match.gravesiteEvidence, []);
    assert.deepEqual(match.headstoneCandidates[0].evidence, []);
    for (const properties of [
      { NhgSection: 'C', NhgRow: '3', NhgPage: 223 },
      { NhgSection: 'D', NhgRow: '4', NhgPage: 223 },
      { NhgSection: 'D', NhgRow: '3', NhgPage: 224 },
      { NhgSection: 'D', NhgRow: '3', NhgPage: 'unreadable' },
    ]) {
      await client.query('UPDATE headstones SET source_properties=$1', [properties]);
      assert.deepEqual(await matches(), []);
    }
    await client.query(`UPDATE headstones SET source_properties='{"NhgSection":"D","NhgRow":"3","NhgPage":221}'`);
    assert.equal((await matches()).length, 1);
    await client.query("UPDATE north_hills_ocr_entries SET name_text='MILLER',surnames=ARRAY['MILLER']");
    assert.deepEqual(await matches(), []);
    await client.query("UPDATE north_hills_ocr_entries SET name_text='UNKNOWN',surnames=ARRAY['UNKNOWN']");

    // E-0567: the imported location survives even though its name is Illegible
    // and neither the burial nor marker has an NHG page reference.
    await client.query(`UPDATE north_hills_ocr_entries SET source_page_number=230,
      parsed_section_name='E',parsed_row_number=6,parsed_position_number=3`);
    await client.query("UPDATE gravesites SET gravesite_id='TLC-GPS-0567',grave_id='0567',section_id='E'");
    await client.query(`UPDATE burials SET full_name='Illegible',notes=
      'Imported feature. North Hills Genealogists section: E. North Hills Genealogists row: 6. North Hills Genealogists site: 3. Person column: 1.'`);
    await client.query(`UPDATE headstones SET headstone_id='TLC-HS-0567',source_properties='{"NhgSection":"E","NhgRow":"6"}'`);
    const locationReview = async () => listNorthHillsOcrReview(client, { q: '230' });
    const locationMatches = async () => (await locationReview()).entries[0].candidateMatches;
    const review = await locationReview();
    assert.equal(review.batches[0].matchedCount, 1);
    assert.equal(review.entries[0].candidateMatches.length, 1);
    const [locationMatch] = review.entries[0].candidateMatches;
    assert.equal(locationMatch.gravesiteId, 'TLC-GPS-0567');
    assert.equal(locationMatch.headstoneCandidates[0].headstoneId, 'TLC-HS-0567');
    assert.deepEqual(locationMatch.gravesiteEvidence, []);
    assert.deepEqual(locationMatch.headstoneCandidates[0].evidence, []);
    const originalNotes = 'North Hills Genealogists section: E. North Hills Genealogists row: 6. North Hills Genealogists site: 3.';
    for (const notes of [
      originalNotes.replace('section: E', 'section: D'),
      originalNotes.replace('row: 6', 'row: 60'),
      originalNotes.replace('site: 3', 'site: 30'),
      originalNotes.replace('site: 3.', ''),
      null,
    ]) {
      await client.query('UPDATE burials SET notes=$1', [notes]);
      assert.deepEqual(await locationMatches(), []);
    }
    await client.query('UPDATE burials SET notes=$1', [originalNotes]);
    await client.query('UPDATE north_hills_ocr_entries SET parsed_position_number=NULL');
    assert.deepEqual(await locationMatches(), []);
    await client.query('UPDATE north_hills_ocr_entries SET parsed_position_number=3,cemetery_id=gen_random_uuid()');
    assert.deepEqual(await locationMatches(), []);
    await client.query('UPDATE north_hills_ocr_entries SET cemetery_id=$1', [ids.cemetery]);
    // Existing page/surname paths still work and UNION must not duplicate them.
    await client.query("UPDATE burials SET notes=notes || ' North Hills Genealogists page: 230.'");
    assert.equal((await locationMatches()).length, 1);
    await client.query("UPDATE north_hills_ocr_entries SET name_text='Illegible',surnames=ARRAY['Illegible']");
    assert.equal((await locationMatches()).length, 1);
    await client.query('UPDATE gravesites SET deleted_at=now()');
    assert.deepEqual(await locationMatches(), []);
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
});
