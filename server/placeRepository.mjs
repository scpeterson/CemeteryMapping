import { setAuditContext } from "./auditContext.mjs";
import { getGeoNamesPlace } from "./placeSearchService.mjs";

function toVerifiedPlace(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    locality: row.locality ?? "",
    administrativeArea: row.administrative_area ?? "",
    countryName: row.country_name,
    countryCode: row.country_code,
    authorityName: row.authority_name,
    authorityIdentifier: row.authority_identifier,
    authorityUrl: row.authority_url,
    verificationStatus: row.verification_status,
  };
}

export async function importGeoNamesPlace(pool, providerId, config, { actorUser, fetchFn } = {}) {
  const candidate = await getGeoNamesPlace(config, providerId, { fetchFn });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason: `Verified GeoNames place import ${candidate.providerId}` });
    const result = await client.query(
      `
        INSERT INTO places (
          display_name, locality, administrative_area, country_name, country_code, geometry,
          authority_name, authority_identifier, authority_url, verification_status,
          verified_at, verified_by
        )
        VALUES (
          $1, $2, NULLIF($3, ''), $4, $5,
          ST_SetSRID(ST_MakePoint($6, $7), 4326)::geometry(Point, 4326),
          $8, $9, $10, 'verified', now(), $11
        )
        ON CONFLICT (authority_name, authority_identifier) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          locality = EXCLUDED.locality,
          administrative_area = EXCLUDED.administrative_area,
          country_name = EXCLUDED.country_name,
          country_code = EXCLUDED.country_code,
          geometry = EXCLUDED.geometry,
          authority_url = EXCLUDED.authority_url,
          verification_status = 'verified',
          verified_at = now(),
          verified_by = EXCLUDED.verified_by,
          is_active = true,
          deleted_at = NULL,
          deleted_by = NULL,
          delete_reason = NULL,
          updated_at = now()
        RETURNING *
      `,
      [
        candidate.displayName,
        candidate.locality,
        candidate.administrativeArea,
        candidate.countryName,
        candidate.countryCode,
        candidate.longitude,
        candidate.latitude,
        candidate.authorityName,
        candidate.authorityIdentifier,
        candidate.authorityUrl,
        actorUser?.email ?? actorUser?.displayName ?? actorUser?.subject ?? "GeoNames import",
      ],
    );
    await client.query("COMMIT");
    return toVerifiedPlace(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
