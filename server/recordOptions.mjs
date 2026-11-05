import { BadRequestError } from "./requestValidation.mjs";
import { headstoneCemeteryIdSql, headstoneCemeteryJoinsSql } from "./headstoneCemeterySql.mjs";

export async function listRecordOptions(pool, kind, { query = "", allowedCemeteryIds, limit = 51, offset = 0, excludeId } = {}) {
  if (!["headstones", "gravesites"].includes(kind)) throw new BadRequestError("Unsupported record option type.");
  const pattern = `%${query.replace(/[\\%_]/gu, "\\$&")}%`;
  const scope = Array.isArray(allowedCemeteryIds) ? allowedCemeteryIds : null;
  const { rows } = kind === "headstones"
    ? await pool.query(`SELECT headstones.id::text, headstones.headstone_id AS code, headstones.headstone_id AS label
        FROM headstones ${headstoneCemeteryJoinsSql}
        WHERE headstones.deleted_at IS NULL
          AND ($1::uuid[] IS NULL OR ${headstoneCemeteryIdSql}=ANY($1::uuid[]))
          AND lower(headstones.headstone_id) LIKE lower($2) AND ($5::uuid IS NULL OR headstones.id<>$5)
        ORDER BY headstones.headstone_id,headstones.id LIMIT $3 OFFSET $4`, [scope,pattern,limit,offset,excludeId ?? null])
    : await pool.query(`SELECT gravesites.id::text,
        concat_ws('-',NULLIF(section_id,''),NULLIF(grave_id,'')) AS code,
        concat(concat_ws('-',NULLIF(section_id,''),NULLIF(grave_id,'')),
          CASE WHEN name IS NULL OR name='' THEN '' ELSE concat(' — ',name) END) AS label
        FROM gravesites WHERE deleted_at IS NULL AND ($1::uuid[] IS NULL OR cemetery_id=ANY($1::uuid[]))
          AND concat_ws(' ',display_label,gravesite_id,name) ILIKE $2
        ORDER BY gravesite_id,id LIMIT $3 OFFSET $4`, [scope,pattern,limit,offset]);
  return rows;
}
