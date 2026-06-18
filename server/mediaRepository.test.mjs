import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createGraveSpacePhoto, createHeadstonePhoto, moveMediaAssetLink, softDeleteMediaAsset } from "./mediaRepository.mjs";

function exifJpegWithOriginalDate(dateText) {
  const date = Buffer.from(`${dateText}\0`, "ascii");
  const tiffLength = 8 + 2 + 12 + 4 + 2 + 12 + 4 + date.length;
  const tiff = Buffer.alloc(tiffLength);
  tiff.write("MM", 0, "ascii");
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4);
  tiff.writeUInt16BE(1, 8);
  tiff.writeUInt16BE(0x8769, 10);
  tiff.writeUInt16BE(4, 12);
  tiff.writeUInt32BE(1, 14);
  tiff.writeUInt32BE(26, 18);
  tiff.writeUInt32BE(0, 22);
  tiff.writeUInt16BE(1, 26);
  tiff.writeUInt16BE(0x9003, 28);
  tiff.writeUInt16BE(2, 30);
  tiff.writeUInt32BE(date.length, 32);
  tiff.writeUInt32BE(44, 36);
  tiff.writeUInt32BE(0, 40);
  date.copy(tiff, 44);

  const exif = Buffer.concat([Buffer.from("Exif\0\0", "ascii"), tiff]);
  const app1Length = Buffer.alloc(2);
  app1Length.writeUInt16BE(exif.length + 2, 0);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1]), app1Length, exif, Buffer.from([0xff, 0xd9])]);
}

test("createGraveSpacePhoto stores a local file and links it to a gravesite and headstone", async () => {
  const uploadRoot = await mkdtemp(join(tmpdir(), "cemetery-media-test-"));
  const queries = [];
  const pool = {
    async connect() {
      return {
        async query(sql, values = []) {
          queries.push({ sql, values });
          if (sql.includes("FROM gravesites")) {
            return { rows: [{ id: "22222222-2222-4222-8222-222222222222", cemetery_id: "11111111-1111-4111-8111-111111111111" }] };
          }
          if (sql.includes("FROM headstones")) {
            return { rows: [{ id: "33333333-3333-4333-8333-333333333333" }] };
          }
          if (sql.includes("INSERT INTO media_assets")) {
            return {
              rows: [
                {
                  id: values[0],
                  cemetery_id: values[1],
                  asset_type: "photo",
                  file_url: `/media/${values[2]}`,
                  thumbnail_url: null,
                  original_filename: values[4],
                  content_type: values[5],
                  byte_size: values[6],
                  captured_at: values[7],
                  uploaded_at: "2026-05-31T12:00:00.000Z",
                  captured_by_email: "admin@example.test",
                  latitude: values[11],
                  longitude: values[12],
                  gps_accuracy: values[13],
                  device_make: values[14],
                  device_model: values[15],
                  notes: values[16],
                  source: values[17],
                  status: "linked",
                },
              ],
            };
          }
          return { rows: [] };
        },
        release() {
          queries.push({ sql: "RELEASE", values: [] });
        },
      };
    },
  };

  try {
    const photo = await createGraveSpacePhoto(
      pool,
      "11111111-1111-4111-8111-111111111111",
      "A-01-01",
      { bytes: Buffer.from("photo-bytes"), contentType: "image/jpeg", originalFilename: "marker.jpg" },
      {
        headstoneId: "33333333-3333-4333-8333-333333333333",
        notes: "East face",
        capturedAt: "2026-05-30",
        latitude: "40.1",
        longitude: "-80.1",
        gpsAccuracy: "5",
        source: "iphone",
      },
      {
        actorUser: {
          id: "44444444-4444-4444-8444-444444444444",
          subject: "auth0|admin",
          email: "admin@example.test",
          role: "admin",
        },
        uploadRoot,
      },
    );

    assert.equal(photo.originalFilename, "marker.jpg");
    assert.equal(photo.source, "iphone");
    assert.equal(photo.capturedAt, "2026-05-30T12:00:00.000Z");
    assert.equal(photo.fileUrl.startsWith("/media/"), true);
    assert.deepEqual(await readFile(join(uploadRoot, photo.fileUrl.replace("/media/", "")), "utf8"), "photo-bytes");
    assert.equal(queries[0].sql, "BEGIN");
    assert.equal(queries.at(-2).sql, "COMMIT");
    assert.match(queries.find((query) => query.sql.includes("INSERT INTO gravesite_media_assets"))?.sql ?? "", /gravesite_media_assets/u);
    assert.match(queries.find((query) => query.sql.includes("INSERT INTO headstone_media_assets"))?.sql ?? "", /headstone_media_assets/u);
  } finally {
    await rm(uploadRoot, { recursive: true, force: true });
  }
});

test("createHeadstonePhoto stores a local file and links it to a headstone", async () => {
  const uploadRoot = await mkdtemp(join(tmpdir(), "cemetery-marker-media-test-"));
  const queries = [];
  const pool = {
    async connect() {
      return {
        async query(sql, values = []) {
          queries.push({ sql, values });
          if (sql.includes("FROM headstones")) {
            return { rows: [{ id: "33333333-3333-4333-8333-333333333333", cemetery_id: "11111111-1111-4111-8111-111111111111" }] };
          }
          if (sql.includes("INSERT INTO media_assets")) {
            return {
              rows: [
                {
                  id: values[0],
                  cemetery_id: values[1],
                  asset_type: "photo",
                  file_url: `/media/${values[2]}`,
                  thumbnail_url: null,
                  original_filename: values[4],
                  content_type: values[5],
                  byte_size: values[6],
                  captured_at: values[7],
                  uploaded_at: "2026-05-31T12:00:00.000Z",
                  captured_by_email: "admin@example.test",
                  latitude: values[11],
                  longitude: values[12],
                  gps_accuracy: values[13],
                  device_make: values[14],
                  device_model: values[15],
                  notes: values[16],
                  source: values[17],
                  status: "linked",
                },
              ],
            };
          }
          return { rows: [] };
        },
        release() {
          queries.push({ sql: "RELEASE", values: [] });
        },
      };
    },
  };

  try {
    const photo = await createHeadstonePhoto(
      pool,
      "33333333-3333-4333-8333-333333333333",
      { bytes: Buffer.from("marker-photo"), contentType: "image/png", originalFilename: "marker.png" },
      {
        notes: "Marker face",
        source: "field_upload",
      },
      {
        actorUser: {
          id: "44444444-4444-4444-8444-444444444444",
          subject: "auth0|admin",
          email: "admin@example.test",
          role: "admin",
        },
        allowedCemeteryIds: ["11111111-1111-4111-8111-111111111111"],
        uploadRoot,
      },
    );

    assert.equal(photo.originalFilename, "marker.png");
    assert.equal(photo.fileUrl.startsWith("/media/"), true);
    assert.deepEqual(await readFile(join(uploadRoot, photo.fileUrl.replace("/media/", "")), "utf8"), "marker-photo");
    assert.equal(queries[0].sql, "BEGIN");
    assert.equal(queries.at(-2).sql, "COMMIT");
    assert.match(queries.find((query) => query.sql.includes("INSERT INTO headstone_media_assets"))?.sql ?? "", /headstone_media_assets/u);
    assert.equal(queries.some((query) => query.sql.includes("INSERT INTO gravesite_media_assets")), false);
  } finally {
    await rm(uploadRoot, { recursive: true, force: true });
  }
});

test("createHeadstonePhoto reads captured date from JPEG EXIF when no manual date is provided", async () => {
  const uploadRoot = await mkdtemp(join(tmpdir(), "cemetery-marker-exif-test-"));
  const pool = {
    async connect() {
      return {
        async query(sql, values = []) {
          if (sql.includes("FROM headstones")) {
            return { rows: [{ id: "33333333-3333-4333-8333-333333333333", cemetery_id: "11111111-1111-4111-8111-111111111111" }] };
          }
          if (sql.includes("INSERT INTO media_assets")) {
            return {
              rows: [
                {
                  id: values[0],
                  cemetery_id: values[1],
                  asset_type: "photo",
                  file_url: `/media/${values[2]}`,
                  thumbnail_url: null,
                  original_filename: values[4],
                  content_type: values[5],
                  byte_size: values[6],
                  captured_at: values[7],
                  uploaded_at: "2026-05-31T12:00:00.000Z",
                  captured_by_email: "admin@example.test",
                  latitude: values[11],
                  longitude: values[12],
                  gps_accuracy: values[13],
                  device_make: values[14],
                  device_model: values[15],
                  notes: values[16],
                  source: values[17],
                  status: "linked",
                },
              ],
            };
          }
          return { rows: [] };
        },
        release() {},
      };
    },
  };

  try {
    const photo = await createHeadstonePhoto(
      pool,
      "33333333-3333-4333-8333-333333333333",
      { bytes: exifJpegWithOriginalDate("2026:05:29 14:15:16"), contentType: "image/jpeg", originalFilename: "marker.jpg" },
      { notes: "Marker face", source: "field_upload" },
      {
        actorUser: {
          id: "44444444-4444-4444-8444-444444444444",
          subject: "auth0|admin",
          email: "admin@example.test",
          role: "admin",
        },
        uploadRoot,
      },
    );

    assert.equal(photo.capturedAt, "2026-05-29T14:15:16.000Z");
  } finally {
    await rm(uploadRoot, { recursive: true, force: true });
  }
});

test("softDeleteMediaAsset soft-deletes the media asset and active links", async () => {
  const queries = [];
  const pool = {
    async connect() {
      return {
        async query(sql, values = []) {
          queries.push({ sql, values });
          if (sql.includes("FROM media_assets")) {
            return {
              rows: [
                {
                  id: values[0],
                  cemetery_id: "11111111-1111-4111-8111-111111111111",
                  asset_type: "photo",
                  storage_key: "photo.jpg",
                  file_url: "/media/photo.jpg",
                  deleted_at: null,
                },
              ],
            };
          }
          if (sql.includes("UPDATE media_assets")) {
            return {
              rowCount: 1,
              rows: [
                {
                  id: values[0],
                  cemetery_id: "11111111-1111-4111-8111-111111111111",
                  deleted_at: "2026-06-18T12:00:00.000Z",
                },
              ],
            };
          }
          return { rows: [], rowCount: 1 };
        },
        release() {
          queries.push({ sql: "RELEASE", values: [] });
        },
      };
    },
  };

  const deleted = await softDeleteMediaAsset(
    pool,
    "55555555-5555-4555-8555-555555555555",
    {
      actorUser: {
        id: "44444444-4444-4444-8444-444444444444",
        subject: "auth0|admin",
        email: "admin@example.test",
        role: "admin",
      },
      reason: "Replacing incorrect photo",
    },
  );

  assert.equal(deleted.id, "55555555-5555-4555-8555-555555555555");
  assert.equal(deleted.alreadyDeleted, false);
  assert.equal(queries[0].sql, "BEGIN");
  assert.match(queries.find((query) => query.sql.includes("UPDATE gravesite_media_assets"))?.sql ?? "", /deleted_at = now/u);
  assert.match(queries.find((query) => query.sql.includes("UPDATE headstone_media_assets"))?.sql ?? "", /deleted_at = now/u);
  assert.match(queries.find((query) => query.sql.includes("UPDATE media_assets"))?.sql ?? "", /delete_reason/u);
  assert.equal(queries.at(-2).sql, "COMMIT");
});

test("moveMediaAssetLink swaps a photo with its adjacent link", async () => {
  const queries = [];
  const pool = {
    async connect() {
      return {
        async query(sql, values = []) {
          queries.push({ sql, values });
          if (sql.includes("SELECT cemetery_id::text")) {
            return { rows: [{ cemetery_id: "11111111-1111-4111-8111-111111111111" }] };
          }
          if (sql.includes("AS target_id")) {
            return { rows: [{ target_id: "99999999-9999-4999-8999-999999999999" }] };
          }
          if (sql.includes("ORDER BY link.display_order")) {
            return {
              rows: [
                {
                  id: "77777777-7777-4777-8777-777777777777",
                  media_asset_id: "88888888-8888-4888-8888-888888888888",
                  display_order: 0,
                },
                {
                  id: "66666666-6666-4666-8666-666666666666",
                  media_asset_id: "55555555-5555-4555-8555-555555555555",
                  display_order: 1,
                },
              ],
            };
          }
          return { rows: [] };
        },
        release() {
          queries.push({ sql: "RELEASE", values: [] });
        },
      };
    },
  };

  const result = await moveMediaAssetLink(pool, "55555555-5555-4555-8555-555555555555", {
    linkId: "66666666-6666-4666-8666-666666666666",
    linkType: "headstone",
    direction: "earlier",
    actorUser: {
      id: "44444444-4444-4444-8444-444444444444",
      subject: "auth0|admin",
      email: "admin@example.test",
      role: "admin",
    },
    reason: "Reordered photo display",
  });

  assert.equal(result.moved, true);
  assert.equal(result.updates.length, 2);
  assert.equal(queries[0].sql, "BEGIN");
  assert.match(queries.find((query) => query.sql.includes("ORDER BY link.display_order"))?.sql ?? "", /headstone_media_assets/u);
  assert.equal(queries.filter((query) => query.sql.includes("UPDATE headstone_media_assets SET display_order")).length, 2);
  assert.equal(queries.at(-2).sql, "COMMIT");
});
