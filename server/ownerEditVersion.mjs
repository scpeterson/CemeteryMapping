export async function readOwnerEdit(pool, partyId, eventId, allowedCemeteryIds, { lock = false } = {}) {
  if (lock) {
    const event = await pool.query(`SELECT e.id FROM ownership_events e WHERE e.id=$2 AND e.deleted_at IS NULL
      AND ($3::uuid[] IS NULL OR e.cemetery_id=ANY($3::uuid[]))
      AND EXISTS(SELECT 1 FROM ownership_event_parties ep WHERE ep.ownership_event_uuid=e.id AND ep.ownership_party_uuid=$1)
      FOR UPDATE`,[partyId,eventId,allowedCemeteryIds??null]);
    if (!event.rows.length) return undefined;
    await pool.query("SELECT id FROM ownership_parties WHERE id=$1 FOR UPDATE",[partyId]);
  }
  const { rows } = await pool.query(`SELECT concat(p.xmin::text,':',e.xmin::text) AS version,
    coalesce(p.first_name,'') AS "firstName",coalesce(p.last_name,'') AS "lastName",
    coalesce(p.full_address,'') AS "fullAddress",coalesce(p.municipality,'') AS municipality,
    coalesce(p.state,'') AS state,coalesce(p.zip,'') AS zip,
    coalesce(e.effective_date_text,to_char(e.effective_date,'YYYY-MM-DD'),'') AS "effectiveDate",
    coalesce(e.deed_on_file,false) AS "deedOnFile",coalesce(e.deed_register_on_file,false) AS "deedRegisterOnFile"
    FROM ownership_parties p JOIN ownership_event_parties ep ON ep.ownership_party_uuid=p.id
    JOIN ownership_events e ON e.id=ep.ownership_event_uuid
    WHERE p.id=$1 AND e.id=$2 AND p.deleted_at IS NULL AND e.deleted_at IS NULL
      AND ($3::uuid[] IS NULL OR e.cemetery_id=ANY($3::uuid[]))`,[partyId,eventId,allowedCemeteryIds??null]);
  return rows[0];
}
