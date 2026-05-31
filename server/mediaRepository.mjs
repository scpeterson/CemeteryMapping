import { mkdir, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { setAuditContext } from "./auditContext.mjs";

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
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
        optionalDate(metadata.capturedAt),
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

export function mediaUploadRoot() {
  return process.env.MEDIA_UPLOAD_DIR ? resolve(process.env.MEDIA_UPLOAD_DIR) : defaultUploadRoot;
}
