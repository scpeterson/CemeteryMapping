import { randomUUID } from "node:crypto";
import { setAuditContext } from "../auditContext.mjs";
import { canViewOwnershipForCemetery } from "../auth.mjs";
import { optionalText, validateUuid } from "../inputValidation.mjs";
import { canManagePolicy } from "../locationPolicyAdministration.mjs";
import { stageMediaFile } from "../media/uploadStorage.mjs";
import { BadRequestError } from "../requestValidation.mjs";

const collection = "/api/cemeteries/:cemeteryId/grave-spaces/:id/deeds";
const deedQuery = `
  SELECT asset.id, asset.original_filename AS filename, asset.storage_key
  FROM gravesites AS grave
  JOIN gravesite_media_assets AS link ON link.gravesite_uuid = grave.id
  JOIN media_assets AS asset ON asset.id = link.media_asset_id AND asset.cemetery_id = grave.cemetery_id
  WHERE grave.cemetery_id = $1 AND grave.id = $2 AND grave.deleted_at IS NULL
    AND link.deleted_at IS NULL AND link.status = 'linked'
    AND asset.deleted_at IS NULL AND asset.status = 'linked'
    AND asset.asset_type = 'document' AND asset.content_type = 'application/pdf'
    AND asset.file_url LIKE '/api/cemeteries/%/grave-spaces/%/deeds/%'
`;

export async function hasGravesiteDeed(pool, cemeteryId, graveId) {
  const { rows } = await pool.query(`${deedQuery} LIMIT 1`, [cemeteryId, graveId]);
  return rows.length > 0;
}

export function canUploadGravesiteDeed(user, cemeteryId) {
  return Boolean(user?.id && canViewOwnershipForCemetery(user, cemeteryId) && canManagePolicy(user, { cemeteryId }));
}

export function validateDeedUpload(filename, bytes) {
  const name = optionalText(filename, "Deed filename", 255);
  if (!name || !/^[^/\\\p{Cc}]+\.pdf$/iu.test(name) || !Buffer.isBuffer(bytes)
      || !/^%PDF-\d\.\d(?:\r|\n)/u.test(bytes.subarray(0, 10).toString("latin1"))
      || !/%%EOF\s*$/u.test(bytes.subarray(-1024).toString("latin1"))) {
    throw new BadRequestError("Choose a PDF deed file.");
  }
  return name;
}

async function storeDeed(pool, uploadRoot, cemeteryId, graveId, filename, bytes, user) {
  const client = await pool.connect();
  const id = randomUUID();
  const storageKey = `${id}.pdf`;
  let staged;
  let commitAttempted = false;
  try {
    await client.query("BEGIN");
    const grave = await client.query(
      "SELECT id FROM gravesites WHERE cemetery_id = $1 AND id = $2 AND deleted_at IS NULL FOR UPDATE",
      [cemeteryId, graveId],
    );
    if (!grave.rows.length) {
      await client.query("ROLLBACK");
      return;
    }
    await setAuditContext(client, { actorUser: user, reason: "Gravesite deed upload" });
    staged = await stageMediaFile(uploadRoot, storageKey, bytes);
    await client.query(`
      INSERT INTO media_assets (id, cemetery_id, asset_type, storage_key, file_url, original_filename,
        content_type, byte_size, captured_by_app_user_id)
      VALUES ($1, $2, 'document', $3, $4, $5, 'application/pdf', $6, $7)
    `, [id, cemeteryId, storageKey, `/api/cemeteries/${cemeteryId}/grave-spaces/${graveId}/deeds/${id}`, filename, bytes.length, user.id]);
    await client.query(`
      INSERT INTO gravesite_media_assets (media_asset_id, gravesite_uuid, linked_by_app_user_id)
      VALUES ($1, $2, $3)
    `, [id, graveId, user.id]);
    await staged.publish();
    commitAttempted = true;
    await client.query("COMMIT");
    return { id, filename };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (!commitAttempted) await staged?.discard();
    throw error;
  } finally {
    client.release();
  }
}

export function registerGravesiteDeedRoutes(app, { express, pool, requireReader, requireCemeteryAdmin, uploadRoot }) {
  function authorize(permission) {
    return (request, response, next) => {
      try {
        const cemeteryId = validateUuid(request.params.cemeteryId, "Cemetery");
        if (!permission(request.user, cemeteryId)) {
          response.status(403).json({ error: "Forbidden" });
          return;
        }
        response.locals.deedScope = [cemeteryId, validateUuid(request.params.id, "Gravesite")];
        response.set("Cache-Control", "private, no-store");
        next();
      } catch (error) {
        next(error);
      }
    };
  }

  const canRead = authorize(canViewOwnershipForCemetery);
  app.get(collection, requireReader, canRead, async (_request, response, next) => {
    try {
      const { rows } = await pool.query(`${deedQuery} ORDER BY asset.uploaded_at DESC, asset.id`, response.locals.deedScope);
      response.json(rows.map(({ id, filename }) => ({ id, filename })));
    } catch (error) {
      next(error);
    }
  });

  app.get(`${collection}/:deedId`, requireReader, canRead, async (request, response, next) => {
    try {
      const id = validateUuid(request.params.deedId, "Deed");
      const { rows: [deed] } = await pool.query(`${deedQuery} AND asset.id = $3`, [...response.locals.deedScope, id]);
      if (!deed || !/^[0-9a-f-]{36}\.pdf$/iu.test(deed.storage_key)) {
        response.status(404).json({ error: "Deed not found" });
        return;
      }
      response.set("X-Content-Type-Options", "nosniff");
      response.download(deed.storage_key, deed.filename, { root: uploadRoot, cacheControl: false }, (error) => {
        if (error) next(error);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post(collection, requireCemeteryAdmin, authorize(canUploadGravesiteDeed),
    express.raw({ type: "application/pdf", limit: "25mb" }), async (request, response, next) => {
      try {
        const filename = validateDeedUpload(request.query.filename, request.body);
        const [cemeteryId, graveId] = response.locals.deedScope;
        const deed = await storeDeed(pool, uploadRoot, cemeteryId, graveId, filename, request.body, request.user);
        if (!deed) {
          response.status(404).json({ error: "Gravesite not found" });
          return;
        }
        response.status(201).json(deed);
      } catch (error) {
        next(error);
      }
    });
}
