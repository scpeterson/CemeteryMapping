import { mkdir, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { setAuditContext } from "./auditContext.mjs";
import { capturedAtFromExif } from "./mediaExif.mjs";

const allowedImageTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/heic", ".heic"],
  ["image/heif", ".heif"],
]);

const defaultUploadRoot = resolve(process.cwd(), "uploads", "media");

function cleanText(value, maxLength) {
  const text = String(value ?? "").trim();
  return text.slice(0, maxLength);
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number.parseFloat(String(value));
  return Number.isFinite(number) ? number : null;
}

function optionalDate(value) {
  const text = cleanText(value, 40);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/u.test(text)) return `${text}T12:00:00.000Z`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function capturedAtForUpload(file, metadata) {
  return optionalDate(metadata.capturedAt) ?? capturedAtFromExif(file);
}

function fileExtension(contentType, originalFilename) {
  const byType = allowedImageTypes.get(String(contentType ?? "").toLowerCase());
  if (byType) return byType;
  const byName = extname(String(originalFilename ?? "")).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"].includes(byName) ? byName : ".jpg";
}

function publicFileUrl(storageKey) {
  return `/media/${storageKey}`;
}

function toMediaAsset(row) {
  return {
    id: row.id,
    cemeteryId: row.cemetery_id,
    assetType: row.asset_type,
    fileUrl: row.file_url,
    thumbnailUrl: row.thumbnail_url ?? "",
    originalFilename: row.original_filename ?? "",
    contentType: row.content_type ?? "",
    byteSize: row.byte_size ?? 0,
    capturedAt: row.captured_at ?? undefined,
    uploadedAt: row.uploaded_at,
    capturedByEmail: row.captured_by_email ?? "",
    latitude: row.latitude === null || row.latitude === undefined ? undefined : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? undefined : Number(row.longitude),
    gpsAccuracy: row.gps_accuracy === null || row.gps_accuracy === undefined ? undefined : Number(row.gps_accuracy),
    deviceMake: row.device_make ?? "",
    deviceModel: row.device_model ?? "",
    notes: row.notes ?? "",
    source: row.source,
    status: row.status,
    mediaLinkId: row.media_link_id ?? undefined,
    mediaLinkType: row.media_link_type ?? undefined,
    displayOrder: row.display_order === null || row.display_order === undefined ? undefined : Number(row.display_order),
  };
}

async function graveForCemeteryId(client, cemeteryId, gravesiteId) {
  const result = await client.query(
    `
      SELECT id::text, cemetery_id::text
      FROM gravesites
      WHERE cemetery_id = $1
        AND gravesite_id = $2
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [cemeteryId, gravesiteId],
  );
  return result.rows[0];
}

async function headstoneIsLinkedToGrave(client, headstoneId, graveUuid) {
  const result = await client.query(
    `
      SELECT headstones.id::text
      FROM headstones
      LEFT JOIN headstone_gravesites
        ON headstone_gravesites.headstone_uuid = headstones.id
       AND headstone_gravesites.deleted_at IS NULL
      WHERE headstones.id = $1
        AND headstones.deleted_at IS NULL
        AND (
          headstones.gravesite_uuid = $2
          OR headstone_gravesites.gravesite_uuid = $2
        )
      LIMIT 1
    `,
    [headstoneId, graveUuid],
  );
  return Boolean(result.rows[0]);
}

async function headstoneForId(client, headstoneId) {
  const result = await client.query(
    `
      SELECT id::text, cemetery_id::text
      FROM headstones
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [headstoneId],
  );
  return result.rows[0];
}

export async function createGraveSpacePhoto(pool, cemeteryId, gravesiteId, file, metadata = {}, { actorUser, allowedCemeteryIds, uploadRoot = defaultUploadRoot } = {}) {
  if (!allowedImageTypes.has(String(file.contentType ?? "").toLowerCase())) {
    throw new Error("Unsupported photo type.");
  }
  if (!file.bytes?.length) throw new Error("Photo file is required.");
  if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(cemeteryId)) return undefined;

  const client = await pool.connect();
  let savedFilePath;
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason: "Photo upload" });
    const grave = await graveForCemeteryId(client, cemeteryId, gravesiteId);
    if (!grave) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const headstoneId = cleanText(metadata.headstoneId, 100);
    if (headstoneId && !(await headstoneIsLinkedToGrave(client, headstoneId, grave.id))) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const assetId = randomUUID();
    const extension = fileExtension(file.contentType, file.originalFilename);
    const storageKey = `${assetId}${extension}`;
    savedFilePath = join(uploadRoot, storageKey);
    await mkdir(uploadRoot, { recursive: true });
    await writeFile(savedFilePath, file.bytes);

    const assetResult = await client.query(
      `
        INSERT INTO media_assets (
          id,
          cemetery_id,
          asset_type,
          storage_key,
          file_url,
          original_filename,
          content_type,
          byte_size,
          captured_at,
          captured_by_app_user_id,
          captured_by_external_subject,
          captured_by_email,
          latitude,
          longitude,
          gps_accuracy,
          device_make,
          device_model,
          notes,
          source,
          status
        )
        VALUES (
          $1, $2, 'photo', $3, $4, $5, $6, $7, $8::timestamptz,
          $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'linked'
        )
        RETURNING
          id::text,
          cemetery_id::text,
          asset_type,
          file_url,
          thumbnail_url,
          original_filename,
          content_type,
          byte_size,
          captured_at,
          uploaded_at,
          captured_by_email,
          latitude,
          longitude,
          gps_accuracy,
          device_make,
          device_model,
          notes,
          source,
          status
      `,
      [
        assetId,
        cemeteryId,
        storageKey,
        publicFileUrl(storageKey),
        cleanText(file.originalFilename, 255) || null,
        file.contentType,
        file.bytes.length,
        capturedAtForUpload(file, metadata),
        actorUser?.id ?? null,
        actorUser?.subject ?? null,
        actorUser?.email ?? null,
        optionalNumber(metadata.latitude),
        optionalNumber(metadata.longitude),
        optionalNumber(metadata.gpsAccuracy),
        cleanText(metadata.deviceMake, 100) || null,
        cleanText(metadata.deviceModel, 100) || null,
        cleanText(metadata.notes, 4000) || null,
        cleanText(metadata.source, 50) || "field_upload",
      ],
    );

    await client.query(
      `
        INSERT INTO gravesite_media_assets (
          media_asset_id,
          gravesite_uuid,
          relationship_type,
          status,
          notes,
          linked_by_app_user_id,
          linked_by_external_subject,
          linked_by_email
        )
        VALUES ($1, $2, 'documents', 'linked', $3, $4, $5, $6)
      `,
      [assetId, grave.id, cleanText(metadata.notes, 4000) || null, actorUser?.id ?? null, actorUser?.subject ?? null, actorUser?.email ?? null],
    );

    if (headstoneId) {
      await client.query(
        `
          INSERT INTO headstone_media_assets (
            media_asset_id,
            headstone_uuid,
            relationship_type,
            status,
            notes,
            linked_by_app_user_id,
            linked_by_external_subject,
            linked_by_email
          )
          VALUES ($1, $2, 'documents', 'linked', $3, $4, $5, $6)
        `,
        [assetId, headstoneId, cleanText(metadata.notes, 4000) || null, actorUser?.id ?? null, actorUser?.subject ?? null, actorUser?.email ?? null],
      );
    }

    await client.query("COMMIT");
    return toMediaAsset(assetResult.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function createHeadstonePhoto(pool, headstoneId, file, metadata = {}, { actorUser, allowedCemeteryIds, uploadRoot = defaultUploadRoot } = {}) {
  if (!allowedImageTypes.has(String(file.contentType ?? "").toLowerCase())) {
    throw new Error("Unsupported photo type.");
  }
  if (!file.bytes?.length) throw new Error("Photo file is required.");

  const client = await pool.connect();
  let savedFilePath;
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason: "Photo upload" });
    const headstone = await headstoneForId(client, headstoneId);
    if (!headstone || (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(headstone.cemetery_id))) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const assetId = randomUUID();
    const extension = fileExtension(file.contentType, file.originalFilename);
    const storageKey = `${assetId}${extension}`;
    savedFilePath = join(uploadRoot, storageKey);
    await mkdir(uploadRoot, { recursive: true });
    await writeFile(savedFilePath, file.bytes);

    const assetResult = await client.query(
      `
        INSERT INTO media_assets (
          id,
          cemetery_id,
          asset_type,
          storage_key,
          file_url,
          original_filename,
          content_type,
          byte_size,
          captured_at,
          captured_by_app_user_id,
          captured_by_external_subject,
          captured_by_email,
          latitude,
          longitude,
          gps_accuracy,
          device_make,
          device_model,
          notes,
          source,
          status
        )
        VALUES (
          $1, $2, 'photo', $3, $4, $5, $6, $7, $8::timestamptz,
          $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'linked'
        )
        RETURNING
          id::text,
          cemetery_id::text,
          asset_type,
          file_url,
          thumbnail_url,
          original_filename,
          content_type,
          byte_size,
          captured_at,
          uploaded_at,
          captured_by_email,
          latitude,
          longitude,
          gps_accuracy,
          device_make,
          device_model,
          notes,
          source,
          status
      `,
      [
        assetId,
        headstone.cemetery_id,
        storageKey,
        publicFileUrl(storageKey),
        cleanText(file.originalFilename, 255) || null,
        file.contentType,
        file.bytes.length,
        capturedAtForUpload(file, metadata),
        actorUser?.id ?? null,
        actorUser?.subject ?? null,
        actorUser?.email ?? null,
        optionalNumber(metadata.latitude),
        optionalNumber(metadata.longitude),
        optionalNumber(metadata.gpsAccuracy),
        cleanText(metadata.deviceMake, 100) || null,
        cleanText(metadata.deviceModel, 100) || null,
        cleanText(metadata.notes, 4000) || null,
        cleanText(metadata.source, 50) || "field_upload",
      ],
    );

    await client.query(
      `
        INSERT INTO headstone_media_assets (
          media_asset_id,
          headstone_uuid,
          relationship_type,
          status,
          notes,
          linked_by_app_user_id,
          linked_by_external_subject,
          linked_by_email
        )
        VALUES ($1, $2, 'documents', 'linked', $3, $4, $5, $6)
      `,
      [assetId, headstone.id, cleanText(metadata.notes, 4000) || null, actorUser?.id ?? null, actorUser?.subject ?? null, actorUser?.email ?? null],
    );

    await client.query("COMMIT");
    return toMediaAsset(assetResult.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function softDeleteMediaAsset(pool, mediaAssetId, { actorUser, reason, allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });

    const existingResult = await client.query(
      `
        SELECT
          id::text,
          cemetery_id::text,
          asset_type,
          storage_key,
          file_url,
          deleted_at
        FROM media_assets
        WHERE id = $1
        LIMIT 1
      `,
      [mediaAssetId],
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      await client.query("ROLLBACK");
      return undefined;
    }

    if (existing.deleted_at) {
      await client.query("COMMIT");
      return {
        id: existing.id,
        cemeteryId: existing.cemetery_id,
        deletedAt: existing.deleted_at,
        alreadyDeleted: true,
      };
    }
    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(existing.cemetery_id)) {
      await client.query("ROLLBACK");
      return { forbidden: true };
    }

    await client.query(
      `
        UPDATE gravesite_media_assets
        SET deleted_at = now(),
            deleted_by = $2::uuid,
            delete_reason = $3
        WHERE media_asset_id = $1
          AND deleted_at IS NULL
      `,
      [mediaAssetId, actorUser?.id ?? null, reason ?? null],
    );
    await client.query(
      `
        UPDATE headstone_media_assets
        SET deleted_at = now(),
            deleted_by = $2::uuid,
            delete_reason = $3
        WHERE media_asset_id = $1
          AND deleted_at IS NULL
      `,
      [mediaAssetId, actorUser?.id ?? null, reason ?? null],
    );

    const updateResult = await client.query(
      `
        UPDATE media_assets
        SET deleted_at = now(),
            deleted_by = $2::uuid,
            delete_reason = $3
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING id::text, cemetery_id::text, deleted_at
      `,
      [mediaAssetId, actorUser?.id ?? null, reason ?? null],
    );
    const updated = updateResult.rows[0];
    await client.query("COMMIT");

    return {
      id: updated.id,
      cemeteryId: updated.cemetery_id,
      deletedAt: updated.deleted_at,
      alreadyDeleted: false,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function moveMediaAssetLink(pool, mediaAssetId, { linkId, linkType, direction, actorUser, reason, allowedCemeteryIds } = {}) {
  const tableName = linkType === "gravesite" ? "gravesite_media_assets" : linkType === "headstone" ? "headstone_media_assets" : "";
  const targetColumn = linkType === "gravesite" ? "gravesite_uuid" : linkType === "headstone" ? "headstone_uuid" : "";
  if (!tableName || !targetColumn) throw new Error("Unsupported media link type.");
  const moveOffset = direction === "later" ? 1 : direction === "earlier" ? -1 : 0;
  if (!moveOffset) throw new Error("Unsupported media move direction.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });

    const assetResult = await client.query(
      `
        SELECT cemetery_id::text
        FROM media_assets
        WHERE id = $1
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [mediaAssetId],
    );
    const asset = assetResult.rows[0];
    if (!asset) {
      await client.query("ROLLBACK");
      return undefined;
    }
    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(asset.cemetery_id)) {
      await client.query("ROLLBACK");
      return { forbidden: true };
    }

    const selectedLinkResult = await client.query(
      `
        SELECT link.${targetColumn}::text AS target_id
        FROM ${tableName} link
        WHERE link.id = $1
          AND link.media_asset_id = $2
          AND link.deleted_at IS NULL
          AND link.status = 'linked'
        LIMIT 1
      `,
      [linkId, mediaAssetId],
    );
    const selectedLink = selectedLinkResult.rows[0];
    if (!selectedLink) {
      await client.query("COMMIT");
      return { moved: false, updates: [] };
    }

    const linksResult = await client.query(
      `
        SELECT
          link.id::text,
          link.media_asset_id::text,
          link.display_order,
          media_assets.captured_at,
          media_assets.uploaded_at
        FROM ${tableName} link
        JOIN media_assets
          ON media_assets.id = link.media_asset_id
        WHERE link.${targetColumn} = $1
          AND link.deleted_at IS NULL
          AND link.status = 'linked'
          AND media_assets.deleted_at IS NULL
          AND media_assets.status = 'linked'
        ORDER BY link.display_order, media_assets.captured_at DESC NULLS LAST, media_assets.uploaded_at DESC, media_assets.id
      `,
      [selectedLink.target_id],
    );
    const links = linksResult.rows;
    const currentIndex = links.findIndex((link) => link.id === linkId && link.media_asset_id === mediaAssetId);
    const swapIndex = currentIndex + moveOffset;

    if (currentIndex === -1 || swapIndex < 0 || swapIndex >= links.length) {
      await client.query("COMMIT");
      return { moved: false, updates: [] };
    }

    for (const [index, link] of links.entries()) {
      if (Number(link.display_order) !== index) {
        await client.query(`UPDATE ${tableName} SET display_order = $2 WHERE id = $1`, [link.id, index]);
      }
      link.display_order = index;
    }

    const currentLink = links[currentIndex];
    const swapLink = links[swapIndex];
    await client.query(`UPDATE ${tableName} SET display_order = $2 WHERE id = $1`, [currentLink.id, swapIndex]);
    await client.query(`UPDATE ${tableName} SET display_order = $2 WHERE id = $1`, [swapLink.id, currentIndex]);

    await client.query("COMMIT");
    return {
      moved: true,
      updates: [
        { id: currentLink.id, media_asset_id: currentLink.media_asset_id, display_order: swapIndex },
        { id: swapLink.id, media_asset_id: swapLink.media_asset_id, display_order: currentIndex },
      ],
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export function mediaUploadRoot() {
  return process.env.MEDIA_UPLOAD_DIR ? resolve(process.env.MEDIA_UPLOAD_DIR) : defaultUploadRoot;
}
