import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createGraveSpacePhoto, createHeadstonePhoto } from "./mediaRepository.mjs";

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
