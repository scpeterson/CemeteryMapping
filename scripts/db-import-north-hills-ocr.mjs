import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { currentEnvironment, loadDbEnvironment } from "./lib/run-liquibase.mjs";
import { parseNorthHillsSourceFacts } from "../server/northHillsSourceFacts.mjs";

const { Pool } = pg;
const sourceName = "North Hills Genealogists Trinity OCR";

function usage() {
  console.error(
    "Usage: npm run db:import:north-hills-ocr -- /path/to/north-hills.pdf|txt [--cemetery-id uuid] [--facility-id 1] [--source-name \"Name\"] [--imported-by \"Name\"] [--notes \"Text\"] [--dry-run]",
  );
}

function parseArgs(args) {
  const [sourcePath, ...rest] = args;
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

  return { sourcePath, options };
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

function normalizeNumber(value) {
  const text = String(value ?? "")
    .trim()
    .replace(/[lI]/gu, "1")
    .replace(/J/gu, "3")
    .replace(/S/gu, "5")
    .replace(/O/gu, "0");
  const number = Number.parseInt(text, 10);
  return Number.isInteger(number) ? number : null;
}

function normalizeScope(value) {
  if (value === "s") return "single";
  if (value === "c") return "couple";
  return "unknown";
}

function normalizeSectionName(value, fallback) {
  const text = String(value ?? "").toUpperCase();
  if (text === "O") return fallback;
  if (text === "8") return "B";
  return text;
}

function surnameList(nameText) {
  return [
    ...new Set(
      cleanText(nameText)
        .replace(/^\[|\]$/gu, "")
        .split("/")
        .map((item) => item.replace(/[^\p{L}'-]/gu, "").trim())
        .filter((item) => item.length > 1),
    ),
  ];
}

function normalizeNameText(nameText) {
  return cleanText(nameText)
    .replace(/\b([A-Z])\[-[0-9Il]\b/gu, "$1[-]")
    .replace(/\bBRAND['’]r\b/giu, "BRANDT");
}

function yearsFromText(text) {
  return [...new Set([...String(text ?? "").matchAll(/\b(17|18|19|20)\d{2}\b/gu)].map((match) => Number.parseInt(match[0], 10)))].sort(
    (left, right) => left - right,
  );
}

function quotedText(text) {
  const matches = [...String(text ?? "").matchAll(/"([^"]+)"/gu)].map((match) => cleanText(match[1])).filter(Boolean);
  return matches.join(" ");
}

function descriptorText(text) {
  const afterMarker = String(text ?? "").replace(/^[^(]+\([^)]*\)\s*/u, "");
  return cleanText(afterMarker.split('"')[0]);
}

function markerMaterial(text) {
  const value = text.toLowerCase();
  const materials = ["granite", "marble", "bronze", "sandstone", "concrete", "metal", "slate", "limestone"];
  return materials.filter((material) => value.includes(material)).join(", ") || null;
}

function markerCondition(text) {
  const value = text.toLowerCase();
  if (/\bexc(?:ellent)?\s+cond\b/u.test(value) || /\bexcellent\b/u.test(value)) return "excellent";
  if (/\bgood\s+cond\b/u.test(value) || /\bgood\b/u.test(value)) return "good";
  if (/\bfair\s+cond\b/u.test(value) || /\bfair\b/u.test(value)) return "fair";
  if (/\bpoor\s+cond\b/u.test(value) || /\bpoor\b/u.test(value)) return "poor";
  return null;
}

function markerType(text) {
  const value = text.toLowerCase();
  const types = ["pillow", "upright", "flat", "monolith", "ledger", "obelisk", "marker", "stone"];
  return types.filter((type) => value.includes(type)).join(", ") || null;
}

function entryConfidence(entry) {
  if (entry.surnames.length && entry.parsedSectionName && entry.parsedRowNumber && entry.parsedPositionNumber && entry.parsedYears.length) return "high";
  if (entry.surnames.length && entry.parsedSectionName && entry.parsedRowNumber) return "medium";
  if (entry.surnames.length) return "low";
  return "review";
}

function entryNotes(entry) {
  const notes = [];
  if (!entry.sourcePageNumber) notes.push("Printed source page number was not detected.");
  if (!entry.surnames.length) notes.push("No surname could be parsed from the entry heading.");
  if (!entry.parsedYears.length) notes.push("No four-digit years were detected in the entry text.");
  if (!entry.parsedSectionName || !entry.parsedRowNumber || !entry.parsedPositionNumber) notes.push("Section, row, or position is incomplete.");
  return notes;
}

function printedPageNumber(pageText) {
  const match = String(pageText ?? "").match(/Franklin\s*Par(?:k|le)\.?\s+Borough\s+(\d{3})\b[\s\S]*?Allegheny\s+County/iu);
  return match ? Number.parseInt(match[1], 10) : null;
}

const sectionRowPattern = /^\s*Section\s+([A-G])\s*,\s*Row\s+([0-9lISOS]+)\b/iu;
const entryNamePattern = String.raw`(?:\[\p{Lu}[\p{L}0-9/[\]()? !.'&-]{1,90}?\]|\p{Lu}[\p{L}0-9/[\]()? .'&-]{1,90}?)`;
const entryStartPattern = new RegExp(
  String.raw`^\s*(${entryNamePattern})\s+[({]\s*([0-9lISOSJ?]{1,3})\s*([A-GO8])\s*,\s*([0-9lISOSJ?]{1,3})\s*(?:[,.]\s*|\s+)([sc])\s*,?\)`,
  "u",
);
const embeddedEntryStartPattern = new RegExp(
  String.raw`(${entryNamePattern})\s+[({]\s*[0-9lISOSJ?]{1,3}\s*[A-GO8]\s*,\s*[0-9lISOSJ?]{1,3}\s*(?:[,.]\s*|\s+)[sc]\s*,?\)`,
  "gu",
);
const coordinateStartPattern = /[({]\s*[0-9lISOSJ?]{1,3}\s*[A-GO8]\s*,/u;

function isNonEntryBoundary(line) {
  return (
    sectionRowPattern.test(line) ||
    /^\s*Franklin Park Borough\b/u.test(line) ||
    /^\s*Trinity German Evangelical Lutheran Church\b/u.test(line) ||
    /^\s*Gap,?\s+about\b/iu.test(line)
  );
}

function embeddedEntryStartIndexes(text) {
  return [
    ...String(text ?? "")
      .matchAll(embeddedEntryStartPattern),
  ]
    .map((match) => {
      const matchText = match[0] ?? "";
      const coordinateIndex = matchText.search(coordinateStartPattern);
      const headingText = coordinateIndex === -1 ? matchText : matchText.slice(0, coordinateIndex);
      const strayQuoteMatch = [...headingText.matchAll(/(?:^|\s)['’](?=[A-Z])/gu)].at(-1);
      const strayQuoteIndex = strayQuoteMatch ? (strayQuoteMatch.index ?? 0) + strayQuoteMatch[0].length - 1 : -1;
      return (match.index ?? 0) + (strayQuoteIndex === -1 ? 0 : strayQuoteIndex + 1);
    })
    .filter((start, index, starts) => start >= 0 && starts.indexOf(start) === index);
}

function stripTrailingGapNote(segment) {
  return cleanText(segment).replace(/\s+Gap,?\s+a(?:b|o)?out\s+[0-9]+\s+feet\.?$/iu, "");
}

function stripTrailingStandaloneNote(segment) {
  return cleanText(segment)
    .replace(/\s+[0-9]+\s+feet\s+to\s+end\s+of\s+row\.?$/iu, "")
    .replace(/\s+Balance\s+of\s+row,?\s+approximately\s+[0-9]+\s+feet,?\s+is\s+empty\.?$/iu, "")
    .replace(/\s+Sunken\s+area\s+to\s+east\s+toward\s+road\.?$/iu, "");
}

function stripTrailingPageFooter(segment) {
  return cleanText(segment).replace(/\s+Franklin\s*Par(?:k|le)\.?\s+Borough\s+\d{3}\s+Allegheny\s+County(?:,?\s+PA\.?)?$/iu, "");
}

function cleanEntrySegment(segment) {
  return stripTrailingPageFooter(stripTrailingStandaloneNote(stripTrailingGapNote(segment))).replace(/\s+['’]$/u, "");
}

function entryLineSegments(line) {
  const starts = embeddedEntryStartIndexes(line);
  if (starts.length <= 1) return [cleanEntrySegment(line)];

  const segments = [];
  if (starts[0] > 0) segments.push(line.slice(0, starts[0]));
  for (let index = 0; index < starts.length; index += 1) {
    segments.push(line.slice(starts[index], starts[index + 1]));
  }
  return segments.map((segment) => cleanEntrySegment(segment)).filter((segment) => cleanText(segment));
}

function entryTextSegments(text) {
  const starts = embeddedEntryStartIndexes(text);
  if (starts.length <= 1 || starts[0] !== 0) return [cleanEntrySegment(text)];

  return starts
    .map((start, index) => cleanEntrySegment(text.slice(start, starts[index + 1])))
    .filter((segment) => cleanText(segment));
}

export function parseNorthHillsOcrText(text) {
  const entries = [];
  const pages = String(text ?? "").split("\f");
  let currentEntry;

  const flushEntry = () => {
    if (!currentEntry) return;
    const rawText = cleanText(currentEntry.lines.join(" "));
    const rawSegments = entryTextSegments(rawText);

    rawSegments.forEach((rawSegment, segmentIndex) => {
      const entryMatch = rawSegment.match(entryStartPattern);
      if (!entryMatch) return;

      const parsedRowNumber = normalizeNumber(entryMatch[2]) ?? currentEntry.parsedRowNumber;
      const parsedSectionName = normalizeSectionName(entryMatch[3], currentEntry.parsedSectionName);
      const descriptor = descriptorText(rawSegment);
      const sourceLineStart = Math.min(currentEntry.sourceLineEnd, currentEntry.sourceLineStart + segmentIndex);
      const entry = {
        sourcePageIndex: currentEntry.sourcePageIndex,
        sourcePageNumber: currentEntry.sourcePageNumber,
        sourceLineStart,
        sourceLineEnd: segmentIndex === rawSegments.length - 1 ? currentEntry.sourceLineEnd : sourceLineStart,
        rawText: rawSegment,
        nameText: normalizeNameText(entryMatch[1]),
        surnames: surnameList(normalizeNameText(entryMatch[1])),
        parsedSectionName,
        parsedRowNumber,
        parsedPositionNumber: normalizeNumber(entryMatch[4]),
        parsedMarkerScope: normalizeScope(entryMatch[5]),
        markerTypeText: markerType(descriptor),
        materialText: markerMaterial(descriptor),
        conditionText: markerCondition(descriptor),
        inscriptionText: quotedText(rawSegment),
        parsedYears: yearsFromText(rawSegment),
        sourceEntry: {
          heading: segmentIndex === 0 ? currentEntry.heading : cleanText(rawSegment),
          descriptor,
        },
      };
      entry.parseConfidence = entryConfidence(entry);
      entry.parseNotes = entryNotes(entry);
      entries.push(entry);
    });
    currentEntry = undefined;
  };

  pages.forEach((pageText, pageIndex) => {
    const pageNumber = printedPageNumber(pageText);
    const lines = pageText.split(/\r?\n/u);
    let currentSectionName;
    let currentRowNumber;

    lines.forEach((line, lineIndex) => {
      const sectionMatch = line.match(sectionRowPattern);
      if (sectionMatch) {
        flushEntry();
        currentSectionName = sectionMatch[1].toUpperCase();
        currentRowNumber = normalizeNumber(sectionMatch[2]);
        return;
      }

      for (const segment of entryLineSegments(line)) {
        const entryMatch = segment.match(entryStartPattern);
        if (entryMatch) {
          flushEntry();
          const parsedRowNumber = normalizeNumber(entryMatch[2]) ?? currentRowNumber;
          const parsedSectionName = normalizeSectionName(entryMatch[3], currentSectionName);
          currentEntry = {
            sourcePageIndex: pageIndex + 1,
            sourcePageNumber: pageNumber,
            sourceLineStart: lineIndex + 1,
            sourceLineEnd: lineIndex + 1,
            heading: cleanText(segment),
            lines: [segment],
            nameText: entryMatch[1],
            parsedSectionName,
            parsedRowNumber,
            parsedPositionNumber: normalizeNumber(entryMatch[4]),
            parsedMarkerScope: normalizeScope(entryMatch[5]),
          };
          continue;
        }

        if (currentEntry) {
          if (isNonEntryBoundary(segment)) {
            flushEntry();
            continue;
          }
          if (cleanText(segment)) {
            currentEntry.lines.push(segment);
            currentEntry.sourceLineEnd = lineIndex + 1;
          }
        }
      }
    });

    flushEntry();
  });

  return entries;
}

function textFromSource(sourcePath) {
  const extension = extname(sourcePath).toLowerCase();
  if (extension === ".txt") return readFileSync(sourcePath, "utf8");
  if (extension !== ".pdf") throw new Error("North Hills OCR import expects a searchable PDF or a pdftotext output file.");

  const tempDirectory = mkdtempSync(join(tmpdir(), "north-hills-ocr-"));
  const outputPath = join(tempDirectory, "source.txt");
  try {
    const result = spawnSync("pdftotext", ["-layout", sourcePath, outputPath], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr || "pdftotext failed.");
    return readFileSync(outputPath, "utf8");
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}

async function findCemetery(client, options) {
  if (options["cemetery-id"]) {
    const result = await client.query("SELECT id, name FROM cemeteries WHERE id = $1", [options["cemetery-id"]]);
    if (!result.rows[0]) throw new Error(`No cemetery found for id ${options["cemetery-id"]}.`);
    return result.rows[0];
  }

  const values = [];
  const where = ["lower(name) LIKE '%trinity%'"];
  if (options["facility-id"]) {
    values.push(options["facility-id"]);
    where.push(`facility_id = $${values.length}`);
  }
  const result = await client.query(`SELECT id, name FROM cemeteries WHERE ${where.join(" AND ")} ORDER BY name LIMIT 1`, values);
  if (!result.rows[0]) throw new Error("No Trinity cemetery record found. Pass --cemetery-id to choose one explicitly.");
  return result.rows[0];
}

async function importEntries(client, cemetery, sourcePath, options, entries) {
  const batchResult = await client.query(
    `
      INSERT INTO north_hills_ocr_import_batches (cemetery_id, source_name, source_path, imported_by, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id::text
    `,
    [cemetery.id, options["source-name"] ?? sourceName, sourcePath, options["imported-by"] ?? null, options.notes ?? null],
  );
  const batchId = batchResult.rows[0].id;

  for (const entry of entries) {
    const entryResult = await client.query(
      `
        INSERT INTO north_hills_ocr_entries (
          batch_id,
          cemetery_id,
          source_page_index,
          source_page_number,
          source_line_start,
          source_line_end,
          raw_text,
          name_text,
          surnames,
          parsed_section_name,
          parsed_row_number,
          parsed_position_number,
          parsed_marker_scope,
          marker_type_text,
          material_text,
          condition_text,
          inscription_text,
          parsed_years,
          parse_confidence,
          parse_notes,
          source_entry
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10, $11, $12, $13, $14, $15, $16, $17, $18::integer[], $19, $20::text[], $21::jsonb
        )
        RETURNING id::text
      `,
      [
        batchId,
        cemetery.id,
        entry.sourcePageIndex,
        entry.sourcePageNumber,
        entry.sourceLineStart,
        entry.sourceLineEnd,
        entry.rawText,
        entry.nameText,
        entry.surnames,
        entry.parsedSectionName,
        entry.parsedRowNumber,
        entry.parsedPositionNumber,
        entry.parsedMarkerScope,
        entry.markerTypeText,
        entry.materialText,
        entry.conditionText,
        entry.inscriptionText,
        entry.parsedYears,
        entry.parseConfidence,
        entry.parseNotes,
        JSON.stringify(entry.sourceEntry),
      ],
    );

    const sourceFacts = parseNorthHillsSourceFacts(entry.rawText);
    for (const fact of sourceFacts) {
      await client.query(
        `
          INSERT INTO north_hills_ocr_source_facts (
            entry_id,
            source_code,
            source_label,
            fact_type,
            fact_value,
            fact_date,
            raw_text,
            confidence
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING
        `,
        [
          entryResult.rows[0].id,
          fact.sourceCode,
          fact.sourceLabel,
          fact.factType,
          fact.factValue,
          fact.factDate ?? null,
          fact.rawText,
          fact.confidence,
        ],
      );
    }
  }

  return batchId;
}

export async function importNorthHillsOcr(sourcePath, options = {}) {
  if (!sourcePath || !existsSync(sourcePath) || !statSync(sourcePath).isFile()) {
    throw new Error("Provide a readable North Hills OCR PDF or text file.");
  }

  const text = textFromSource(sourcePath);
  const entries = parseNorthHillsOcrText(text);
  if (entries.length === 0) throw new Error("No North Hills reading entries were parsed. Confirm the PDF contains searchable OCR text.");

  const dbEnv = loadDbEnvironment(currentEnvironment());
  const pool = new Pool({
    host: process.env.PGHOST ?? "127.0.0.1",
    port: Number(process.env.PGPORT ?? dbEnv.POSTGRES_PORT),
    database: process.env.PGDATABASE ?? dbEnv.POSTGRES_DB,
    user: process.env.PGUSER ?? dbEnv.POSTGRES_USER,
    password: process.env.PGPASSWORD ?? dbEnv.POSTGRES_PASSWORD,
  });
  const client = await pool.connect();

  try {
    const cemetery = await findCemetery(client, options);
    if (options["dry-run"]) {
      console.log(`Parsed ${entries.length} North Hills OCR entries for ${cemetery.name}.`);
      console.log("Dry run only; no staging rows were written.");
      return { batchId: null, cemetery, entries };
    }

    await client.query("BEGIN");
    const batchId = await importEntries(client, cemetery, sourcePath, options, entries);
    await client.query("COMMIT");
    console.log(`Imported ${entries.length} North Hills OCR entries into review batch ${batchId} for ${cemetery.name}.`);
    return { batchId, cemetery, entries };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { sourcePath, options } = parseArgs(process.argv.slice(2));
  importNorthHillsOcr(sourcePath, options).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
