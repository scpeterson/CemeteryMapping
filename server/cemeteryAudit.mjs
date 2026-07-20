async function selectTriggeredAuditEventId(client, { action, targetTable, targetRecordId }) {
  const result = await client.query(
    `
      SELECT id::text
      FROM audit_events
      WHERE transaction_id = txid_current()
        AND action = $1
        AND target_table = $2
        AND target_record_id = $3
      ORDER BY occurred_at DESC, created_at DESC
      LIMIT 1
    `,
    [action, targetTable, targetRecordId],
  );
  return result.rows[0]?.id;
}

async function insertCompatibilityAuditEvent(client, { actorUser, action, targetTable, targetRecordId, previousValues, newValues, reason }) {
  const result = await client.query(
    `
      INSERT INTO audit_events (
        actor_user_id, actor_app_user_id, actor_external_subject, actor_email, actor_role, actor_database_user, actor_session_user,
        source, transaction_id, action, target_table, target_record_id, previous_values, new_values, changed_fields, reason, occurred_at
      )
      VALUES ($1::uuid, $1::uuid, $2, $3, $4, current_user, session_user, 'api', txid_current(), $5, $6, $7, $8::jsonb, $9::jsonb, '{}'::text[], $10, now())
      RETURNING id::text
    `,
    [actorUser?.id ?? null, actorUser?.subject ?? null, actorUser?.email ?? null, actorUser?.role ?? null, action, targetTable, targetRecordId, JSON.stringify(previousValues ?? null), JSON.stringify(newValues ?? null), reason],
  );
  return result.rows[0].id;
}

/** Returns the trigger-created audit event when available, otherwise writes a compatibility event. */
export async function auditEventIdForMutation(client, event) {
  return (await selectTriggeredAuditEventId(client, event)) ?? (await insertCompatibilityAuditEvent(client, event));
}
