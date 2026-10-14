import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { loadApiConfig } from '../server/config.mjs';
import { integrationAdminDatabase } from './lib/integration-admin.mjs';
import { createLookupRecord, updateLookupRecord, listLookupRecords } from '../server/lookupAdminRepository.mjs';
import { listHeadstoneLookupOptions } from '../server/cemeteryLookupQueries.mjs';
import { validateLookupPayload } from '../server/routes/adminRouteValidation.mjs';

test('lookup creation and rename need no sort value and preserve stored operational order', async () => {
  const pool = new pg.Pool(integrationAdminDatabase(loadApiConfig()));
  const client = await pool.connect();
  const session = { connect: async () => ({ query: client.query.bind(client), release() {} }) };
  try {
    await client.query('CREATE TEMP TABLE marker_material_types (LIKE public.marker_material_types INCLUDING ALL)');
    const input = (code, label) => validateLookupPayload({ code, label, description: 'Test material', isActive: true });
    const z = await createLookupRecord(session, 'marker_material_types', input('z_test', 'Zinc'));
    await createLookupRecord(session, 'marker_material_types', input('g_test', 'Granite, gray'));
    await createLookupRecord(session, 'marker_material_types', input('b_test', 'bronze'));
    await client.query('UPDATE marker_material_types SET sort_order = 7 WHERE id=$1', [z.id]);
    const rows = async () => (await listLookupRecords(session)).lookups.marker_material_types;
    assert.deepEqual((await rows()).map(r => r.label), ['bronze', 'Granite, gray', 'Zinc']);
    await updateLookupRecord(session, 'marker_material_types', z.id, input('z_test', 'Aluminum'));
    assert.deepEqual((await rows()).map(r => r.label), ['Aluminum', 'bronze', 'Granite, gray']);
    assert.equal((await client.query('SELECT sort_order FROM marker_material_types WHERE id=$1', [z.id])).rows[0].sort_order, 7);
    assert.equal((await rows())[0].sortOrder, undefined);
    const options = await listHeadstoneLookupOptions(session);
    assert.deepEqual(options.materials.map(r => r.label), ['Aluminum', 'bronze', 'Granite, gray']);
  } finally {
    await client.query('DROP TABLE IF EXISTS pg_temp.marker_material_types');
    client.release();
    await pool.end();
  }
});
