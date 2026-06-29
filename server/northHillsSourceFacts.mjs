const sourceLabels = {
  CR: "Church Records",
  CRG: "Church Records in German",
};

const monthNumbers = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function compact(value) {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

function factKey(fact) {
  return `${fact.sourceCode}|${fact.factType}|${fact.factValue}`;
}

function titleMonth(value) {
  const normalized = String(value ?? "").replace(/\.$/u, "").toLowerCase();
  return normalized ? `${normalized[0].toUpperCase()}${normalized.slice(1)}` : "";
}

function isoDate(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDeathDate(segment) {
  const match = compact(segment).match(
    /\bd\.?\s+([A-Z][a-z]{2,8})\.?\s+([0-9]{1,2})(?:st|nd|rd|th)?(?:,)?\s+((?:17|18|19|20)[0-9]{2})\b/u,
  );
  if (!match) return undefined;

  const month = monthNumbers[match[1].replace(/\.$/u, "").toLowerCase()];
  const day = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);
  if (!month || day < 1 || day > 31) return undefined;

  return {
    factType: "death_date",
    factValue: `${titleMonth(match[1])} ${day}, ${year}`,
    factDate: isoDate(year, month, day),
    confidence: "high",
  };
}

function parseMiddleInitial(segment) {
  const match = compact(segment).match(/\bMiddle initial\s+([A-Z])\.?/iu);
  if (!match) return undefined;
  return {
    factType: "middle_initial",
    factValue: `${match[1].toUpperCase()}.`,
    confidence: "medium",
  };
}

function parseAgeAtDeath(segment) {
  const text = compact(segment).replace(/\bS(?=\s*m)/gu, "5").replace(/\bl(?=\s*(?:m|0))/gu, "1");
  const match = text.match(/\b([0-9]{1,3})\s*y(?:rs?|ears?)?\.?,?\s*(?:([0-9]{1,2})\s*m(?:o|os|onths?)?\.?,?\s*)?(?:([0-9]{1,2})\s*d(?:a|ays?)?\.?)?/iu);
  if (!match) return undefined;

  const parts = [`${Number.parseInt(match[1], 10)}y`];
  if (match[2]) parts.push(`${Number.parseInt(match[2], 10)}m`);
  if (match[3]) parts.push(`${Number.parseInt(match[3], 10)}d`);
  return {
    factType: "age_at_death",
    factValue: parts.join(" "),
    confidence: "medium",
  };
}

function parseQuotedNote(segment) {
  const match = String(segment ?? "").match(/["']([^"']{2,160})["']/u);
  if (!match) return undefined;
  return {
    factType: "note",
    factValue: compact(match[1]),
    confidence: "medium",
  };
}

function parseChurchPosition(segment) {
  if (!/\bCouncilman\b/iu.test(segment)) return undefined;
  return {
    factType: "note",
    factValue: "Church position: Councilman",
    confidence: "medium",
  };
}

function churchRecordFactText(segment) {
  return compact(segment)
    .replace(/\s+Flower holder with flowers\b\.?$/iu, "")
    .replace(/\bMiddle name Charles\.\s+Councilman\b/iu, "Middle name Charles. Church position: Councilman")
    .trim();
}

export function sourceLabel(sourceCode) {
  return sourceLabels[sourceCode] ?? sourceCode;
}

export function parseNorthHillsSourceFacts(text) {
  const facts = [];
  const rawText = String(text ?? "");
  const sourcePattern = /\b(CRG|CR)\s*:\s*([\s\S]*?)(?=\b(?:CRG|CR)\s*:|$)/giu;

  for (const match of rawText.matchAll(sourcePattern)) {
    const sourceCode = match[1].toUpperCase();
    const sourceText = churchRecordFactText(match[2]);
    if (!sourceText) continue;

    const rawFact = {
      sourceCode,
      sourceLabel: sourceLabel(sourceCode),
      factType: "note",
      factValue: sourceText,
      factDate: undefined,
      rawText: `${sourceCode}: ${sourceText}`,
      confidence: "review",
    };
    facts.push(rawFact);

    for (const parsedFact of [
      parseMiddleInitial(sourceText),
      parseDeathDate(sourceText),
      parseAgeAtDeath(sourceText),
      parseQuotedNote(sourceText),
      parseChurchPosition(sourceText),
    ].filter(Boolean)) {
      facts.push({
        sourceCode,
        sourceLabel: sourceLabel(sourceCode),
        rawText: rawFact.rawText,
        factDate: undefined,
        ...parsedFact,
      });
    }
  }

  const seen = new Set();
  return facts.filter((fact) => {
    const key = factKey(fact);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
