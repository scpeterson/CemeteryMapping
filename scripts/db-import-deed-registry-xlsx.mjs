import { existsSync, statSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import ExcelJS from "exceljs";
import pg from "pg";
import { currentEnvironment, loadDbEnvironment } from "./lib/run-liquibase.mjs";

const { Pool } = pg;
const defaultWorksheetName = "Updated 2022";

function usage() {
  console.error(
    "Usage: npm run db:import:deed-registry -- /path/to/registry.xlsx [--facility-id 1] [--sheet \"Updated 2022\"] [--all-sheets true] [--source-name \"Trinity Cemetery Registry 2022\"] [--imported-by \"Name\"] [--notes \"Text\"] [--dry-run]",
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
    if (key === "dry-run") {
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

function cleanText(value) {
  return present(value) ? String(value).replace(/\s+/gu, " ").trim() : null;
}

function normalizeDate(value) {
  if (!present(value)) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function normalizeNumber(value) {
  return String(value).trim().replace(/^0+(?=\d)/u, "");
}

function expandNumbers(text) {
  const numbers = new Set();
  const normalized = String(text ?? "").replace(/[–—]/gu, "-");
  for (const [, , start, end] of normalized.matchAll(/(^|[^\d])(\d{1,3})\s*-\s*(\d{1,3})(?=$|[^\d])/gu)) {
    const first = Number.parseInt(start, 10);
    const last = Number.parseInt(end, 10);
    if (Number.isInteger(first) && Number.isInteger(last) && first <= last && last - first <= 100) {
      for (let number = first; number <= last; number += 1) numbers.add(String(number));
    }
  }

  const withoutRanges = normalized.replace(/\d{1,3}\s*-\s*\d{1,3}/gu, " ");
  for (const match of withoutRanges.matchAll(/\b\d{1,3}\b/gu)) numbers.add(normalizeNumber(match[0]));

  return [...numbers].sort((left, right) => Number(left) - Number(right));
}

function graveCountFromText(text) {
  const match = String(text ?? "").match(/\b(\d{1,2})\s+graves?\b/iu);
  if (!match) return null;
  const count = Number.parseInt(match[1], 10);
  return Number.isInteger(count) && count > 0 ? count : null;
}

function graveNumbersFromText(text) {
  const value = String(text ?? "");
  const numbers = new Set();
  for (const match of value.matchAll(/\bgraves?\s+((?:#?\d+\s*(?:,|and)?\s*){1,5})/giu)) {
    expandNumbers(match[1]).forEach((number) => numbers.add(number));
  }
  for (const match of value.matchAll(/\b#\s*(\d{1,2})\b/gu)) numbers.add(normalizeNumber(match[1]));
  return [...numbers].sort((left, right) => Number(left) - Number(right));
}

function ownerDisplayName(row) {
  return [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || row.lastName || row.firstName || null;
}

function sectionAlias(rawSectionText) {
  const value = cleanText(rawSectionText)?.toUpperCase();
  return value || null;
}

function headerKey(value, fallback) {
  const text = cleanText(value);
  if (!text) return fallback;
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
}

function findHeaderRow(worksheet) {
  for (let rowNumber = 1; rowNumber <= Math.min(10, worksheet.rowCount); rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const lotHeader = cleanText(row.getCell(6).value)?.toLowerCase();
    if (cleanText(row.getCell(1).value)?.toLowerCase() === "last name" && (lotHeader === "lot number" || lotHeader === "lot num")) {
      return rowNumber;
    }
  }
  return 3;
}

export function parseRegistryRow(row) {
  const rawLotText = cleanText(row.lot);
  const rawSectionText = cleanText(row.section);
  const rawRemarks = cleanText(row.remarks);
  const alias = sectionAlias(rawSectionText);
  const combined = [rawLotText, rawSectionText, rawRemarks].filter(Boolean).join(" ");
  const notes = [];
  const allocations = [];
  let parsedSectionName = null;
  let ownershipScope = "unknown";
  let confidence = "review";
  let parsedLotNumbers = [];
  let parsedPlotNumbers = [];

  const graveCount = graveCountFromText(combined);
  const graveNumbers = graveNumbersFromText(combined);
  let parsedGraveNumbers = graveNumbers;
  const isPassage = /\bpassage\b/iu.test(combined);
  const isSectionG = /^G\s*-?/iu.test(rawLotText ?? "") || alias === "G";

  if (isSectionG) {
    parsedSectionName = "G";
    parsedPlotNumbers = expandNumbers(rawLotText);
    parsedGraveNumbers = parsedPlotNumbers;
    ownershipScope = "section_g_gravesite";
    confidence = parsedPlotNumbers.length > 0 ? "high" : "review";
    if (parsedPlotNumbers.length > 0) {
      notes.push("Section G source uses plot numbers for 8 by 4 foot gravesites; north is shown at the bottom of the source plan.");
    }
    parsedPlotNumbers.forEach((plot) => {
      allocations.push({
        allocationType: "section_g_gravesite",
        sectionName: "G",
        sectionAlias: "G",
        plotIdentifier: plot,
        graveNumber: plot,
        rawText: rawLotText,
        parseConfidence: "high",
        parseNotes: ["Section G plot number is treated as an 8 by 4 foot gravesite number."],
      });
    });
  } else if (isPassage) {
    parsedLotNumbers = expandNumbers(rawLotText);
    ownershipScope = "passage";
    confidence = "medium";
    notes.push("Passage record needs manual spatial review.");
    allocations.push({
      allocationType: "passage",
      sectionAlias: alias,
      lotIdentifier: parsedLotNumbers.join("-") || null,
      rawText: rawLotText,
      parseConfidence: "medium",
      parseNotes: ["Passage location is not a standard lot."],
    });
  } else if (rawLotText) {
    parsedLotNumbers = expandNumbers(rawLotText);
    if (parsedLotNumbers.length > 1) {
      ownershipScope = "multiple_lots";
      confidence = "medium";
    } else if (parsedLotNumbers.length === 1) {
      ownershipScope = "whole_lot";
      confidence = alias ? "medium" : "low";
    }
    parsedLotNumbers.forEach((lot) => {
      allocations.push({
        allocationType: parsedLotNumbers.length > 1 ? "multiple_lot" : "lot",
        sectionAlias: alias,
        lotIdentifier: lot,
        rawText: rawLotText,
        parseConfidence: confidence,
        parseNotes: alias ? [] : ["No section alias in registry row."],
      });
    });
  }

  if (graveNumbers.length > 0) {
    ownershipScope = "specific_graves";
    confidence = confidence === "review" ? "medium" : confidence;
    graveNumbers.forEach((graveNumber) => {
      allocations.push({
        allocationType: "grave_number",
        sectionName: parsedSectionName,
        sectionAlias: alias,
        lotIdentifier: parsedLotNumbers[0] ?? null,
        graveNumber,
        rawText: rawRemarks,
        parseConfidence: "medium",
        parseNotes: ["Specific grave number inferred from remarks."],
      });
    });
  } else if (graveCount) {
    if (ownershipScope === "whole_lot") ownershipScope = "grave_count_only";
    allocations.push({
      allocationType: "grave_count",
      sectionName: parsedSectionName,
      sectionAlias: alias,
      lotIdentifier: parsedLotNumbers[0] ?? null,
      graveCount,
      rawText: rawRemarks,
      parseConfidence: "medium",
      parseNotes: ["Grave count inferred from remarks; exact grave numbers still need review."],
    });
  }

  if (alias === "NA" || alias === "OC") notes.push(`${alias} is an alternate section name and may map to more than one section.`);
  if (parsedLotNumbers.length === 0 && parsedPlotNumbers.length === 0 && !isPassage) notes.push("No lot, plot, or passage identifier parsed.");
  if (graveCount && graveCount > 5) notes.push("Grave count exceeds the standard five graves per 10 by 20 foot lot.");
  if (allocations.length === 0) {
    allocations.push({
      allocationType: "unknown",
      sectionAlias: alias,
      rawText: rawLotText,
      parseConfidence: "review",
      parseNotes: ["Registry row could not be parsed into a candidate allocation."],
    });
  }

  return {
    parsedSectionName,
    parsedSectionAlias: alias,
    normalizedLotText: rawLotText,
    parsedLotNumbers,
    parsedPlotNumbers,
    parsedGraveNumbers,
    parsedGraveCount: graveCount,
    ownershipScope,
    parseConfidence: confidence,
    parseNotes: notes,
    allocations,
  };
}

export async function registryRows(workbookPath, worksheetName = defaultWorksheetName) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  const worksheet = workbook.getWorksheet(worksheetName);
  if (!worksheet) throw new Error(`Worksheet not found: ${worksheetName}`);

  const headerRowNumber = findHeaderRow(worksheet);
  const headerRow = worksheet.getRow(headerRowNumber);
  const rows = [];
  worksheet.eachRow((worksheetRow, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;
    const hasRowData = Array.from({ length: worksheet.columnCount }, (_, index) => worksheetRow.getCell(index + 1).value).some(present);
    if (!hasRowData) return;
    const rawLotText = cleanText(worksheetRow.getCell(6).value);
    const rawRemarks = cleanText(worksheetRow.getCell(8).value);
    const hasOwnerFields = [1, 2, 3, 4, 5].some((cellNumber) => present(worksheetRow.getCell(cellNumber).value));
    const rowType = hasOwnerFields ? "owner_record" : "investigation_note";
    const extraCells = {};
    for (let cellNumber = 12; cellNumber <= worksheet.columnCount; cellNumber += 1) {
      const value = cleanText(worksheetRow.getCell(cellNumber).value);
      if (value) extraCells[headerKey(headerRow.getCell(cellNumber).value, `column_${cellNumber}`)] = value;
    }

    const row = {
      rowNumber,
      rowType,
      lastName: cleanText(worksheetRow.getCell(1).value),
      firstName: cleanText(worksheetRow.getCell(2).value),
      address: cleanText(worksheetRow.getCell(3).value),
      city: cleanText(worksheetRow.getCell(4).value),
      state: cleanText(worksheetRow.getCell(5).value),
      lot: rowType === "owner_record" ? rawLotText : null,
      section: cleanText(worksheetRow.getCell(7).value),
      remarks: rowType === "owner_record" ? rawRemarks : [rawLotText, rawRemarks].filter(Boolean).join(" ").trim() || null,
      lastKnownDate: normalizeDate(worksheetRow.getCell(9).value),
      deedOnFile: cleanText(worksheetRow.getCell(10).value),
      deedRegisterOnFile: cleanText(worksheetRow.getCell(11).value),
      rawLotCell: rawLotText,
      extraCells,
    };
    rows.push(row);
  });

  return rows;
}

async function findCemetery(client, facilityId) {
  const result = await client.query(
    `
      SELECT id, name
      FROM cemeteries
      WHERE facility_id = $1
        AND deleted_at IS NULL
      ORDER BY name
      LIMIT 1
    `,
    [facilityId],
  );
  if (!result.rows[0]) throw new Error(`Cemetery not found for facility id ${facilityId}`);
  return result.rows[0];
}

async function insertBatch(client, cemeteryId, { sourceName, sourcePath, worksheetName, importedBy, notes }) {
  const result = await client.query(
    `
      INSERT INTO deed_registry_import_batches (cemetery_id, source_name, source_path, worksheet_name, imported_by, notes, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, clock_timestamp())
      RETURNING id
    `,
    [cemeteryId, sourceName, sourcePath, worksheetName, importedBy, notes],
  );
  return result.rows[0].id;
}

async function insertEntry(client, batchId, cemeteryId, row, parsed) {
  const result = await client.query(
    `
      INSERT INTO deed_registry_entries (
        batch_id,
        cemetery_id,
        source_row_number,
        owner_last_name,
        owner_first_names,
        owner_display_name,
        address,
        city,
        state,
        raw_lot_text,
        raw_section_text,
        raw_remarks,
        last_known_date,
        deed_on_file,
        deed_register_on_file,
        parsed_section_name,
        parsed_section_alias,
        normalized_lot_text,
        parsed_lot_numbers,
        parsed_plot_numbers,
        parsed_grave_numbers,
        parsed_grave_count,
        ownership_scope,
        parse_confidence,
        parse_notes,
        source_row
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26::jsonb
      )
      RETURNING id
    `,
    [
      batchId,
      cemeteryId,
      row.rowNumber,
      row.lastName,
      row.firstName,
      ownerDisplayName(row),
      row.address,
      row.city,
      row.state,
      row.lot,
      row.section,
      row.remarks,
      row.lastKnownDate,
      row.deedOnFile,
      row.deedRegisterOnFile,
      parsed.parsedSectionName,
      parsed.parsedSectionAlias,
      parsed.normalizedLotText,
      parsed.parsedLotNumbers,
      parsed.parsedPlotNumbers,
      parsed.parsedGraveNumbers,
      parsed.parsedGraveCount,
      parsed.ownershipScope,
      parsed.parseConfidence,
      parsed.parseNotes,
      JSON.stringify(row),
    ],
  );
  return result.rows[0].id;
}

async function insertAllocation(client, entryId, allocation) {
  await client.query(
    `
      INSERT INTO deed_registry_entry_allocations (
        entry_id,
        allocation_type,
        section_name,
        section_alias,
        lot_identifier,
        plot_identifier,
        grave_number,
        grave_count,
        raw_text,
        parse_confidence,
        parse_notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `,
    [
      entryId,
      allocation.allocationType,
      allocation.sectionName ?? null,
      allocation.sectionAlias ?? null,
      allocation.lotIdentifier ?? null,
      allocation.plotIdentifier ?? null,
      allocation.graveNumber ?? null,
      allocation.graveCount ?? null,
      allocation.rawText ?? null,
      allocation.parseConfidence,
      allocation.parseNotes ?? [],
    ],
  );
}

async function importWorksheet(client, cemetery, workbookPath, worksheetName, options) {
  const rows = await registryRows(workbookPath, worksheetName);
  const parsedRows = rows.map((row) => ({ row, parsed: parseRegistryRow(row) }));
  const baseSourceName = options["source-name"] ?? basename(workbookPath);
  const sourceName = options["all-sheets"] ? `${baseSourceName} - ${worksheetName}` : baseSourceName;
  const batchNotes = [options.notes, worksheetName === "Original 2017" ? "Original 2017 is staged as the baseline for comparison with the investigated and updated registry sheets." : null]
    .filter(Boolean)
    .join(" ");
  const batchId = await insertBatch(client, cemetery.id, {
    sourceName,
    sourcePath: workbookPath,
    worksheetName,
    importedBy: options["imported-by"] ?? null,
    notes: batchNotes || null,
  });

  let allocationCount = 0;
  for (const { row, parsed } of parsedRows) {
    const entryId = await insertEntry(client, batchId, cemetery.id, row, parsed);
    for (const allocation of parsed.allocations) {
      await insertAllocation(client, entryId, allocation);
      allocationCount += 1;
    }
  }

  const reviewCount = parsedRows.filter(({ parsed }) => parsed.parseConfidence === "review" || parsed.parseConfidence === "low").length;
  const sectionGCount = parsedRows.filter(({ parsed }) => parsed.ownershipScope === "section_g_gravesite").length;
  const passageCount = parsedRows.filter(({ parsed }) => parsed.ownershipScope === "passage").length;

  return {
    batchId,
    worksheetName,
    rowCount: parsedRows.length,
    allocationCount,
    sectionGCount,
    passageCount,
    reviewCount,
  };
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

  const worksheetNames = options["all-sheets"]
    ? ["Original 2017", "Investigated", "Updated 2022"]
    : [options.sheet ?? defaultWorksheetName];
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
    const cemetery = await findCemetery(client, options["facility-id"] ?? "1");
    const importResults = [];
    for (const worksheetName of worksheetNames) {
      importResults.push(await importWorksheet(client, cemetery, workbookPath, worksheetName, options));
    }

    if (options["dry-run"]) {
      await client.query("ROLLBACK");
      console.log("Dry run complete. No data was written.");
    } else {
      await client.query("COMMIT");
      console.log(`Imported ${importResults.length} deed registry staging batch${importResults.length === 1 ? "" : "es"} for ${cemetery.name}.`);
    }

    console.log(`Workbook: ${basename(workbookPath)}`);
    for (const result of importResults) {
      console.log(`Worksheet: ${result.worksheetName}`);
      console.log(`Batch: ${result.batchId}`);
      console.log(`Registry rows staged: ${result.rowCount}.`);
      console.log(`Parsed allocation rows staged: ${result.allocationCount}.`);
      console.log(`Section G rows: ${result.sectionGCount}.`);
      console.log(`Passage rows: ${result.passageCount}.`);
      console.log(`Rows needing review: ${result.reviewCount}.`);
    }
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
