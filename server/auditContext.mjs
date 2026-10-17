function auditSettings({ actorUser, reason, source = "api", requestId } = {}) {
  return [
    ["app.audit.user_id", actorUser?.id],
    ["app.audit.external_subject", actorUser?.subject],
    ["app.audit.email", actorUser?.email],
    ["app.audit.role", actorUser?.role],
    ["app.audit.reason", reason],
    ["app.audit.source", source],
    ["app.audit.request_id", requestId],
  ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");
}

export async function setAuditContext(client, context) {
  for (const [setting, value] of auditSettings(context)) {
    await client.query("SELECT set_config($1, $2, true)", [setting, String(value)]);
  }
}

class TransactionRollback {
  constructor(value) { this.value = value; }
}

// Call rollback(value) for a deliberate no-op exit. All paths release exactly
// once, and a rollback failure never hides the original mutation error.
export async function withAuditContext(pool, context, callback) {
  const client = await pool.connect();
  let releaseError;
  try {
    await client.query("BEGIN");
    await setAuditContext(client, context);
    const result = await callback(client, (value) => { throw new TransactionRollback(value); });
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); }
    catch (rollbackError) { releaseError = rollbackError; }
    if (error instanceof TransactionRollback) {
      if (releaseError) throw releaseError;
      return error.value;
    }
    throw error;
  } finally {
    client.release(releaseError);
  }
}
