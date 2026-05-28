import { existsSync, statSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import ExcelJS from "exceljs";
import pg from "pg";
import { currentEnvironment, loadDbEnvironment } from "./lib/run-liquibase.mjs";

const { Pool } = pg;
const feetToMeters = 0.3048;
const defaultLengthFeet = 10;
const defaultWidthFeet = 4;
const defaultLotLengthFeet = 20;
const defaultLotWidthFeet = 10;
const northHillsSourceName = "North Hills Genealogists";

function usage() {
  console.error(
    "Usage: npm run db:import:headstones -- /path/to/headstones.xlsx [--facility-id 1] [--sheet SheetName] [--length-feet 10] [--width-feet 4] [--lot-length-feet 20] [--lot-width-feet 10] [--allow-spatial-errors] [--dry-run]",
  );
}

function parseArgs(args) {
  const [workbookPath, ...rest] = args;
  const options = {};

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg.startsWith("--")) {
      usage();
      process.exit(1);
    }

    const key = arg.slice(2);
    if (key === "dry-run" || key === "allow-spatial-errors") {
      options[key] = true;
      continue;
    }

    const value = rest[index + 1];
    if (!value || value.startsWith("--")) {
      console.error(`Missing value for --${key}`);
      process.exit(1);
    }

    options[key] = value;
    index += 1;
  }

  return { workbookPath, options };
}

function present(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function cell(row, columnName) {
  const entry = Object.entries(row).find(([key]) => key.toLowerCase() === columnName.toLowerCase());
  return entry?.[1];
}

function textCell(row, columnName) {
  const value = cell(row, columnName);
  return present(value) ? String(value).trim() : null;
}

function numberCell(row, columnName) {
  const value = cell(row, columnName);
  if (!present(value)) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateFromYear(value) {
  if (!present(value)) return null;

  const parsed = Number.parseInt(String(value).trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 1000 || parsed > 9999) return null;

  return `${String(parsed).padStart(4, "0")}-01-01`;
}

function personFields(row, personNumber) {
  if (personNumber === 2) {
    return {
      firstName: textCell(row, "Person2First") ?? textCell(row, "Persons26First"),
      lastName: textCell(row, "Person2Last") ?? textCell(row, "Persons26Last"),
      birthDate: dateFromYear(cell(row, "Person2Yob")),
      deathDate: dateFromYear(cell(row, "Person2Yod")),
    };
  }

  return {
    firstName: textCell(row, `Person${personNumber}First`),
    lastName: textCell(row, `Person${personNumber}Last`),
    birthDate: dateFromYear(cell(row, `Person${personNumber}Yob`)),
    deathDate: dateFromYear(cell(row, `Person${personNumber}Yod`)),
  };
}

function peopleFromRow(row) {
  const people = [];
  for (let personNumber = 1; personNumber <= 6; personNumber += 1) {
    const person = personFields(row, personNumber);
    if (present(person.firstName) || present(person.lastName) || present(person.birthDate) || present(person.deathDate)) {
      people.push({
        ...person,
        fullName: [person.firstName, person.lastName].filter(Boolean).join(" ") || null,
        personNumber,
      });
    }
  }

  return people;
}

const leftEdgeAnchoredSections = new Set(["A", "B", "C", "D"]);

function normalizedSectionId(sectionId) {
  return String(sectionId ?? "")
    .trim()
    .toUpperCase();
}

function shouldAnchorGravesiteOnLeftEdge(sectionId) {
  return leftEdgeAnchoredSections.has(normalizedSectionId(sectionId));
}

function rectangleMultiPolygon(longitude, latitude, eastWestMeters, northSouthMeters, { anchor = "center" } = {}) {
  const latMeters = 111_320;
  const lonMeters = latMeters * Math.cos((latitude * Math.PI) / 180);
  const widthDegrees = eastWestMeters / lonMeters;
  const halfHeightDegrees = northSouthMeters / 2 / latMeters;

  const west = anchor === "left-edge" ? longitude : longitude - widthDegrees / 2;
  const east = anchor === "left-edge" ? longitude + widthDegrees : longitude + widthDegrees / 2;
  const south = latitude - halfHeightDegrees;
  const north = latitude + halfHeightDegrees;

  return {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    ],
  };
}

function cellValue(value) {
  if (value && typeof value === "object" && "text" in value) return value.text;
  if (value && typeof value === "object" && "result" in value) return value.result;
  if (value && typeof value === "object" && "richText" in value) return value.richText.map((part) => part.text).join("");
  return value;
}

async function normalizedRows(workbookPath, sheetName) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  const worksheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.worksheets[0];
  if (!worksheet) {
    throw new Error(`Sheet not found: ${sheetName ?? "(first sheet)"}`);
  }

  const headerRow = worksheet.getRow(1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    headers[columnNumber] = present(cell.value) ? String(cellValue(cell.value)).trim() : null;
  });

  const rows = [];
  worksheet.eachRow({ includeEmpty: false }, (worksheetRow, rowNumber) => {
    if (rowNumber === 1) return;

    const row = {};
    for (let columnNumber = 1; columnNumber < headers.length; columnNumber += 1) {
      const header = headers[columnNumber];
      if (!header) continue;
      row[header] = cellValue(worksheetRow.getCell(columnNumber).value);
    }

    if (Object.values(row).some(present)) rows.push({ rowNumber, row });
  });

  return rows;
}

export function importableRows(rows, options) {
  const lengthFeet = Number(options["length-feet"] ?? defaultLengthFeet);
  const widthFeet = Number(options["width-feet"] ?? defaultWidthFeet);
  const lotLengthFeet = Number(options["lot-length-feet"] ?? defaultLotLengthFeet);
  const lotWidthFeet = Number(options["lot-width-feet"] ?? defaultLotWidthFeet);
  const eastWestMeters = lengthFeet * feetToMeters;
  const northSouthMeters = widthFeet * feetToMeters;
  const lotEastWestMeters = lotLengthFeet * feetToMeters;
  const lotNorthSouthMeters = lotWidthFeet * feetToMeters;

  if (!Number.isFinite(lengthFeet) || lengthFeet <= 0) throw new Error("--length-feet must be a positive number.");
  if (!Number.isFinite(widthFeet) || widthFeet <= 0) throw new Error("--width-feet must be a positive number.");
  if (!Number.isFinite(lotLengthFeet) || lotLengthFeet <= 0) throw new Error("--lot-length-feet must be a positive number.");
  if (!Number.isFinite(lotWidthFeet) || lotWidthFeet <= 0) throw new Error("--lot-width-feet must be a positive number.");

  return rows
    .map(({ rowNumber, row }) => {
      const latitude = numberCell(row, "Latitude");
      const longitude = numberCell(row, "Longitude");
      const people = peopleFromRow(row);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      if (people.length === 0) return null;

      const graveId = String(rowNumber).padStart(4, "0");
      const tlcPlot = textCell(row, "TlcPlot");
      const sourceGraveNumber = textCell(row, "GraveNumber");
      const lotId = [tlcPlot, sourceGraveNumber].find((value) => value && value.length <= 5) ?? graveId;
      const sectionId = textCell(row, "NhgSection");
      const graveAnchor = shouldAnchorGravesiteOnLeftEdge(sectionId) ? "left-edge" : "center";
      return {
        rowNumber,
        graveId,
        lotId,
        gravesiteId: `TLC-GPS-${graveId}`,
        headstoneId: `TLC-HS-${graveId}`,
        name: people[0]?.fullName ?? `Imported headstone ${graveId}`,
        sectionId,
        nhgRow: textCell(row, "NhgRow"),
        nhgPage: textCell(row, "NhgPage"),
        tlcSec: textCell(row, "TlcSec"),
        tlcPlot,
        sourceGraveNumber,
        latitude,
        longitude,
        geometry: rectangleMultiPolygon(longitude, latitude, eastWestMeters, northSouthMeters, { anchor: graveAnchor }),
        lotGeometry: rectangleMultiPolygon(longitude, latitude, lotEastWestMeters, lotNorthSouthMeters),
        sourceProperties: row,
        people,
      };
    })
    .filter(Boolean);
}

export function buildSourceNotes(imported) {
  return [
    `Imported from headstone spreadsheet row ${imported.rowNumber}.`,
    imported.sectionId ? `${northHillsSourceName} section: ${imported.sectionId}.` : null,
    imported.nhgRow ? `${northHillsSourceName} row: ${imported.nhgRow}.` : null,
    imported.nhgPage ? `${northHillsSourceName} page: ${imported.nhgPage}.` : null,
    imported.tlcSec ? `Trinity Lutheran Church section: ${imported.tlcSec}.` : null,
    imported.tlcPlot ? `Trinity Lutheran Church plot: ${imported.tlcPlot}.` : null,
    imported.sourceGraveNumber ? `Source grave number: ${imported.sourceGraveNumber}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildBurialNotes(sourceNotes, person) {
  return `${sourceNotes} Person column: ${person.personNumber}.`;
}

async function findCemetery(client, facilityId) {
  const result = await client.query(
    `
      SELECT id, facility_id, name
      FROM cemeteries
      WHERE facility_id = $1
      LIMIT 1
    `,
    [facilityId],
  );

  const cemetery = result.rows[0];
  if (!cemetery) throw new Error(`No cemetery found for facility_id ${facilityId}. Import cemetery and section polygons first.`);

  return cemetery;
}

async function findSection(client, cemeteryId, facilityId, sectionId, longitude, latitude) {
  const result = await client.query(
    `
      SELECT section_id, name
      FROM sections
      WHERE cemetery_id = $1
        AND facility_id IS NOT DISTINCT FROM $2
        AND ST_Covers(geometry, ST_SetSRID(ST_MakePoint($3, $4), 4326))
      ORDER BY
        CASE WHEN name IS NOT DISTINCT FROM $5 THEN 0 ELSE 1 END,
        section_id
      LIMIT 1
    `,
    [cemeteryId, facilityId, longitude, latitude, sectionId],
  );

  return result.rows[0] ?? null;
}

async function upsertLot(client, cemetery, facilityId, imported, section) {
  const result = await client.query(
    `
      INSERT INTO lots (
        cemetery_id,
        section_uuid,
        name,
        facility_id,
        section_id,
        block_id,
        lot_id,
        geometry,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        NULL,
        $6,
        ST_SetSRID(ST_GeomFromGeoJSON($7), 4326)::geometry(MultiPolygon, 4326),
        now()
      )
      ON CONFLICT (facility_id, section_id, lot_id) WHERE block_id IS NULL DO UPDATE SET
        cemetery_id = EXCLUDED.cemetery_id,
        section_uuid = EXCLUDED.section_uuid,
        name = EXCLUDED.name,
        geometry = EXCLUDED.geometry,
        updated_at = now()
      RETURNING id
    `,
    [
      cemetery.id,
      section?.section_id ?? null,
      `Lot ${imported.lotId}`,
      facilityId,
      section?.name ?? imported.sectionId,
      imported.lotId,
      JSON.stringify(imported.lotGeometry),
    ],
  );

  return { id: result.rows[0].id };
}

async function upsertGravesite(client, cemetery, facilityId, imported) {
  const section = await findSection(client, cemetery.id, facilityId, imported.sectionId, imported.longitude, imported.latitude);
  const lot = await upsertLot(client, cemetery, facilityId, imported, section);
  const notes = buildSourceNotes(imported);

  const result = await client.query(
    `
      INSERT INTO gravesites (
        cemetery_id,
        section_uuid,
        lot_uuid,
        name,
        facility_id,
        section_id,
        lot_id,
        grave_id,
        gravesite_id,
        status,
        geometry,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        'occupied',
        ST_SetSRID(ST_GeomFromGeoJSON($10), 4326)::geometry(MultiPolygon, 4326),
        now()
      )
      ON CONFLICT (cemetery_id, gravesite_id) DO UPDATE SET
        cemetery_id = EXCLUDED.cemetery_id,
        section_uuid = EXCLUDED.section_uuid,
        lot_uuid = EXCLUDED.lot_uuid,
        name = EXCLUDED.name,
        facility_id = EXCLUDED.facility_id,
        section_id = EXCLUDED.section_id,
        lot_id = EXCLUDED.lot_id,
        grave_id = EXCLUDED.grave_id,
        status = EXCLUDED.status,
        geometry = EXCLUDED.geometry,
        updated_at = now()
      RETURNING id
    `,
    [
      cemetery.id,
      section?.section_id ?? null,
      lot.id,
      imported.name,
      facilityId,
      section?.name ?? imported.sectionId,
      imported.lotId,
      imported.graveId,
      imported.gravesiteId,
      JSON.stringify(imported.geometry),
    ],
  );

  return { gravesiteUuid: result.rows[0].id, sectionLinked: Boolean(section), lotLinked: Boolean(lot), notes };
}

export async function upsertHeadstone(client, imported, gravesiteUuid) {
  const result = await client.query(
    `
      INSERT INTO headstones (
        gravesite_uuid,
        headstone_id,
        marker_type,
        marker_type_code,
        condition,
        material_type_code,
        latitude,
        longitude,
        geometry,
        source_properties,
        updated_at
      )
      VALUES (
        $1,
        $2,
        'headstone',
        'unknown',
        'unknown',
        'unknown',
        $3::numeric,
        $4::numeric,
        ST_SetSRID(ST_MakePoint($4::double precision, $3::double precision), 4326),
        $5::jsonb,
        now()
      )
      ON CONFLICT (headstone_id) DO UPDATE SET
        gravesite_uuid = EXCLUDED.gravesite_uuid,
        marker_type = EXCLUDED.marker_type,
        marker_type_code = CASE
          WHEN headstones.marker_type_code IS NULL OR headstones.marker_type_code = 'unknown' THEN EXCLUDED.marker_type_code
          ELSE headstones.marker_type_code
        END,
        material_type_code = CASE
          WHEN headstones.material_type_code IS NULL OR headstones.material_type_code = 'unknown' THEN EXCLUDED.material_type_code
          ELSE headstones.material_type_code
        END,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        geometry = EXCLUDED.geometry,
        source_properties = EXCLUDED.source_properties,
        updated_at = now()
      RETURNING id
    `,
    [gravesiteUuid, imported.headstoneId, imported.latitude, imported.longitude, JSON.stringify(imported.sourceProperties)],
  );

  return result.rows[0].id;
}

export async function upsertHeadstoneGravesite(client, headstoneUuid, gravesiteUuid, relationshipType = "primary") {
  await client.query(
    `
      INSERT INTO headstone_gravesites (
        headstone_uuid,
        gravesite_uuid,
        relationship_type,
        updated_at
      )
      VALUES ($1, $2, $3, now())
      ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
        relationship_type = EXCLUDED.relationship_type,
        updated_at = now(),
        deleted_at = NULL,
        deleted_by = NULL,
        delete_reason = NULL
    `,
    [headstoneUuid, gravesiteUuid, relationshipType],
  );
}

async function replaceBurials(client, imported, gravesiteUuid, headstoneUuid, notes) {
  await client.query("DELETE FROM burials WHERE gravesite_uuid = $1", [gravesiteUuid]);

  let burialCount = 0;
  for (const person of imported.people) {
    const result = await client.query(
      `
        INSERT INTO burials (
          gravesite_uuid,
          first_name,
          last_name,
          full_name,
          birth_date,
          death_date,
          notes,
          gravesite_id,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8, now())
        RETURNING id
      `,
      [
        gravesiteUuid,
        person.firstName,
        person.lastName,
        person.fullName,
        person.birthDate,
        person.deathDate,
        buildBurialNotes(notes, person),
        imported.gravesiteId,
      ],
    );

    await client.query(
      `
        INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
      [headstoneUuid, result.rows[0].id],
    );
    burialCount += 1;
  }

  return burialCount;
}

async function validateImportedGravesites(client, gravesiteUuids) {
  if (gravesiteUuids.length === 0) return [];

  const result = await client.query(
    `
      WITH imported AS (
        SELECT
          grave.id,
          grave.gravesite_id,
          grave.section_id,
          grave.section_uuid,
          grave.geometry,
          ST_Centroid(grave.geometry) AS center_point,
          cemetery.geometry AS cemetery_geometry,
          section.geometry AS section_geometry
        FROM gravesites grave
        JOIN cemeteries cemetery ON cemetery.id = grave.cemetery_id
        LEFT JOIN sections section ON section.section_id = grave.section_uuid
        WHERE grave.id = ANY($1::uuid[])
      ),
      cemetery_containment AS (
        SELECT
          'center_outside_cemetery' AS issue_code,
          gravesite_id,
          'error' AS severity,
          'Generated gravesite center point falls outside its cemetery geometry.' AS issue_detail
        FROM imported
        WHERE NOT ST_Covers(cemetery_geometry, center_point)
      ),
      section_containment AS (
        SELECT
          'center_outside_section' AS issue_code,
          gravesite_id,
          'error' AS severity,
          'Generated gravesite center point falls outside its linked section geometry.' AS issue_detail
        FROM imported
        WHERE section_geometry IS NOT NULL
          AND NOT ST_Covers(section_geometry, center_point)
      ),
      missing_section AS (
        SELECT
          'section_not_linked' AS issue_code,
          gravesite_id,
          'warning' AS severity,
          'Gravesite could not be linked to a matching section.' AS issue_detail
        FROM imported
        WHERE section_id IS NOT NULL
          AND section_uuid IS NULL
      )
      SELECT
        severity,
        issue_code,
        gravesite_id,
        issue_detail
      FROM (
        SELECT * FROM cemetery_containment
        UNION ALL
        SELECT * FROM section_containment
        UNION ALL
        SELECT * FROM missing_section
      ) issues
      ORDER BY severity, issue_code, gravesite_id
    `,
    [gravesiteUuids],
  );

  return result.rows;
}

async function main() {
  const { workbookPath, options } = parseArgs(process.argv.slice(2));
  if (!workbookPath) {
    usage();
    process.exit(1);
  }

  if (!existsSync(workbookPath) || !statSync(workbookPath).isFile()) {
    console.error(`Workbook not found: ${workbookPath}`);
    process.exit(1);
  }

  const facilityId = options["facility-id"] ?? "1";
  const rows = await normalizedRows(workbookPath, options.sheet);
  const rowsWithCoordinates = rows.filter(({ row }) => Number.isFinite(numberCell(row, "Latitude")) && Number.isFinite(numberCell(row, "Longitude"))).length;
  const importedRows = importableRows(rows, options);

  const environment = currentEnvironment();
  const dbEnv = loadDbEnvironment(environment);
  const pool = new Pool({
    host: process.env.PGHOST ?? "127.0.0.1",
    port: Number(process.env.PGPORT ?? dbEnv.POSTGRES_PORT ?? 5432),
    database: process.env.PGDATABASE ?? dbEnv.POSTGRES_DB,
    user: process.env.PGUSER ?? dbEnv.POSTGRES_USER,
    password: process.env.PGPASSWORD ?? dbEnv.POSTGRES_PASSWORD,
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cemetery = await findCemetery(client, facilityId);

    let linkedSections = 0;
    let linkedLots = 0;
    let burialCount = 0;
    let headstoneCount = 0;
    const gravesiteUuids = [];
    for (const imported of importedRows) {
      const gravesiteResult = await upsertGravesite(client, cemetery, facilityId, imported);
      const headstoneUuid = await upsertHeadstone(client, imported, gravesiteResult.gravesiteUuid);
      await upsertHeadstoneGravesite(client, headstoneUuid, gravesiteResult.gravesiteUuid);
      const importedBurialCount = await replaceBurials(client, imported, gravesiteResult.gravesiteUuid, headstoneUuid, gravesiteResult.notes);
      if (gravesiteResult.sectionLinked) linkedSections += 1;
      if (gravesiteResult.lotLinked) linkedLots += 1;
      burialCount += importedBurialCount;
      headstoneCount += 1;
      gravesiteUuids.push(gravesiteResult.gravesiteUuid);
    }

    const spatialIssues = await validateImportedGravesites(client, gravesiteUuids);
    for (const issue of spatialIssues) {
      console.log(`${issue.severity}: ${issue.gravesite_id} ${issue.issue_code} - ${issue.issue_detail}`);
    }

    const errorCount = spatialIssues.filter((issue) => issue.severity === "error").length;
    if (errorCount > 0 && !options["allow-spatial-errors"]) {
      throw new Error(`Refusing to import headstones: generated gravesite geometry has ${errorCount} spatial error${errorCount === 1 ? "" : "s"}.`);
    }

    if (options["dry-run"]) {
      await client.query("ROLLBACK");
      console.log("Dry run complete. No data was written.");
    } else {
      await client.query("COMMIT");
      console.log(`Imported ${importedRows.length} gravesites, ${headstoneCount} headstones, and ${burialCount} burials into ${cemetery.name}.`);
    }

    console.log(`Workbook: ${basename(workbookPath)}`);
    console.log(`Rows with coordinates: ${rowsWithCoordinates}.`);
    console.log(`Rows with coordinates and burial data: ${importedRows.length}.`);
    console.log(`Headstones imported: ${headstoneCount}.`);
    console.log(`Burials imported: ${burialCount}.`);
    console.log(`Gravesites linked to sections: ${linkedSections}.`);
    console.log(`Gravesites linked to lots: ${linkedLots}.`);
    console.log(`Generated gravesite spatial warnings: ${spatialIssues.length - errorCount}.`);
    console.log(`Generated gravesite spatial errors: ${errorCount}.`);
    console.log(`Generated rectangle size: ${options["length-feet"] ?? defaultLengthFeet}ft east-west x ${options["width-feet"] ?? defaultWidthFeet}ft north-south.`);
    console.log(`Generated lot rectangle size: ${options["lot-length-feet"] ?? defaultLotLengthFeet}ft east-west x ${options["lot-width-feet"] ?? defaultLotWidthFeet}ft north-south.`);
    console.log("Run npm run db:validate:spatial to review generated gravesite geometry.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
