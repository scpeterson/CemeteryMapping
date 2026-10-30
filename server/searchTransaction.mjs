// Own the connection and transaction so SET LOCAL cannot affect another request.
export async function withSearchTransaction(pool, run) {
  const client = await pool.connect();
  let discard;
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL jit = off");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); }
    catch (rollbackError) { discard = rollbackError; }
    throw error;
  } finally {
    client.release(discard);
  }
}
