import { extname, resolve } from "node:path";
import { capturedAtFromExif } from "../mediaExif.mjs";

const allowedImageTypes = new Map([["image/jpeg", ".jpg"], ["image/png", ".png"], ["image/webp", ".webp"], ["image/heic", ".heic"], ["image/heif", ".heif"]]);
export const defaultMediaUploadRoot = resolve(process.cwd(), "uploads", "media");

export function cleanMediaText(value, maxLength) { return String(value ?? "").trim().slice(0, maxLength); }
export function optionalMediaNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number.parseFloat(String(value));
  return Number.isFinite(number) ? number : null;
}
function optionalDate(value) {
  const text = cleanMediaText(value, 40);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/u.test(text)) return `${text}T12:00:00.000Z`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
export function capturedAtForUpload(file, metadata) { return optionalDate(metadata.capturedAt) ?? capturedAtFromExif(file); }
export const isAllowedImageType = (contentType) => allowedImageTypes.has(String(contentType ?? "").toLowerCase());
export function mediaFileExtension(contentType, originalFilename) {
  const byType = allowedImageTypes.get(String(contentType ?? "").toLowerCase());
  if (byType) return byType;
  const byName = extname(String(originalFilename ?? "")).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"].includes(byName) ? byName : ".jpg";
}
export const publicMediaFileUrl = (storageKey) => `/media/${storageKey}`;
export function toMediaAsset(row) {
  return {
    id: row.id, cemeteryId: row.cemetery_id, assetType: row.asset_type, fileUrl: row.file_url,
    thumbnailUrl: row.thumbnail_url ?? "", originalFilename: row.original_filename ?? "", contentType: row.content_type ?? "",
    byteSize: row.byte_size ?? 0, capturedAt: row.captured_at ?? undefined, uploadedAt: row.uploaded_at,
    capturedByEmail: row.captured_by_email ?? "",
    latitude: row.latitude === null || row.latitude === undefined ? undefined : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? undefined : Number(row.longitude),
    gpsAccuracy: row.gps_accuracy === null || row.gps_accuracy === undefined ? undefined : Number(row.gps_accuracy),
    deviceMake: row.device_make ?? "", deviceModel: row.device_model ?? "", notes: row.notes ?? "", source: row.source,
    status: row.status, mediaLinkId: row.media_link_id ?? undefined, mediaLinkType: row.media_link_type ?? undefined,
    displayOrder: row.display_order === null || row.display_order === undefined ? undefined : Number(row.display_order),
  };
}
export function mediaUploadRoot() { return process.env.MEDIA_UPLOAD_DIR ? resolve(process.env.MEDIA_UPLOAD_DIR) : defaultMediaUploadRoot; }
