import { toBurial, toOwner } from "./cemeteryMappers.mjs";
import { runBoundedQueries } from "./queryBatch.mjs";

export async function getHeadstoneOverview(pool, id, { canViewOwnership = () => false } = {}) {
  const result = await pool.query(`
    SELECT h.id::text AS marker_id, g.id::text AS uuid, g.gravesite_id, g.cemetery_id::text
    FROM headstones h
    LEFT JOIN (gravesites g JOIN cemeteries c ON c.id = g.cemetery_id AND c.deleted_at IS NULL)
      ON g.deleted_at IS NULL AND (
        g.id = h.gravesite_uuid OR EXISTS (
          SELECT 1 FROM headstone_gravesites hg
          WHERE hg.headstone_uuid = h.id AND hg.gravesite_uuid = g.id AND hg.deleted_at IS NULL
        )
      )
    WHERE h.id = $1 AND h.deleted_at IS NULL
    ORDER BY g.cemetery_id, g.gravesite_id
  `, [id]);
  if (!result.rows.length) return undefined;
  const graves = result.rows.filter((row) => row.uuid);
  if (!graves.length) return [];
  const graveUuids = graves.map((grave) => grave.uuid);
  const ownerGraveUuids = graves.filter((grave) => canViewOwnership(grave.cemetery_id)).map((grave) => grave.uuid);
  const [burials, owners] = await runBoundedQueries([
    async () => (await pool.query(`
      SELECT id::text, gravesite_uuid::text, first_name, last_name, maiden_name, name_prefix, name_suffix,
        given_name_status, display_name, full_name, birth_date, birth_date_text, death_date, death_date_text
      FROM burials
      WHERE gravesite_uuid = ANY($1::uuid[]) AND deleted_at IS NULL
      ORDER BY burial_date DESC NULLS LAST, death_date DESC NULLS LAST, last_name, first_name, id
    `, [graveUuids])).rows,
    async () => ownerGraveUuids.length ? (await pool.query(`
      WITH selected_graves AS MATERIALIZED (
        SELECT id, lot_uuid FROM gravesites WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL
      )
      SELECT owners.id::text, owners.gravesite_uuid::text, owners.owner, owners.co_owner,
        NULL::text AS display_name, NULL::text AS first_name, NULL::text AS last_name,
        owners.sale_date, NULL::date AS effective_date, owners.created_at
      FROM owners JOIN selected_graves ON selected_graves.id = owners.gravesite_uuid
      WHERE owners.deleted_at IS NULL
      UNION ALL
      SELECT concat('ownership-party-', rights.ownership_party_uuid::text), selected_graves.id::text,
        NULL::text, NULL::text, rights.display_name, rights.first_name, rights.last_name,
        NULL::date, rights.effective_date, rights.recorded_at
      FROM current_ownership_right_owners rights
      JOIN selected_graves ON (rights.target_type = 'gravesite' AND rights.gravesite_uuid = selected_graves.id)
        OR (rights.target_type = 'lot' AND rights.lot_uuid = selected_graves.lot_uuid)
      WHERE rights.target_type IN ('gravesite', 'lot')
        AND (rights.target_type <> 'lot' OR NOT EXISTS (
          SELECT 1 FROM current_ownership_events direct_right
          WHERE direct_right.target_type = 'gravesite' AND direct_right.gravesite_uuid = selected_graves.id
        ))
      ORDER BY sale_date DESC NULLS LAST, effective_date DESC NULLS LAST, created_at DESC, id
    `, [ownerGraveUuids])).rows : [],
  ], 2);
  const burialsByGrave = new Map(), ownersByGrave = new Map();
  for (const row of burials) {
    const group = burialsByGrave.get(row.gravesite_uuid) ?? [];
    group.push({ id: row.id, person: toBurial(row).person });
    burialsByGrave.set(row.gravesite_uuid, group);
  }
  for (const row of owners) {
    const group = ownersByGrave.get(row.gravesite_uuid) ?? [];
    const { id, displayName, firstName, lastName } = toOwner(row);
    group.push({ id, displayName, firstName, lastName });
    ownersByGrave.set(row.gravesite_uuid, group);
  }
  return graves.map((grave) => {
    const owners = ownersByGrave.get(grave.uuid) ?? [];
    return { id: grave.gravesite_id, cemeteryId: grave.cemetery_id,
      burials: burialsByGrave.get(grave.uuid) ?? [], owners, currentOwnerIds: owners.map((owner) => owner.id) };
  });
}
