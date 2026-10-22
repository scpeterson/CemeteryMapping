// Historical migrations are tested with isolated copies of their original
// schema. LIKE INCLUDING ALL copies modern checks but not the insert triggers
// that supply mandatory faces, so omit that post-491 check in the temp copy.
export async function createLegacyTableFixture(client, table) {
 if (!/^[a-z_]+$/.test(table)) throw new Error('Invalid fixture table');
 await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`);
 if (table === 'headstones') await client.query('ALTER TABLE pg_temp.headstones DROP CONSTRAINT IF EXISTS headstones_require_face');
}
