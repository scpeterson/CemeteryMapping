import { definitionById, reportDefinitions, toDefinition } from "./definitions.mjs";
import { compactText } from "./shared.mjs";

function extractOwnerName(text) {
  const byMatch = text.match(/\b(?:by|for|owner|owned by|person)\s+([a-z0-9 .,'-]{2,80})/iu);
  if (!byMatch) return "";
  return compactText(byMatch[1].replace(/\b(?:own|owns|owned|holding|holdings|lots?|gravesites?)\b.*$/iu, "").replace(/[?.!,;:]+$/u, ""), 80);
}

function extractSectionName(text) {
  const match = text.match(/\bsection\s+([a-z0-9-]{1,40})\b/iu);
  if (!match) return "";
  return compactText(match[1].replace(/[?.!,;:]+$/u, ""), 40);
}

function extractMarkerType(text) {
  const typeMatch = text.match(/\b(?:marker\s+type|type)\s+([a-z0-9 .,'-]{2,80})/iu);
  if (typeMatch) {
    return compactText(typeMatch[1].replace(/\b(?:markers?|headstones?|in|for|section|cemetery)\b.*$/iu, "").replace(/[?.!,;:]+$/u, ""), 80);
  }
  const listMatch = text.match(/\blist\s+([a-z0-9 .,'-]{2,80})\s+(?:markers?|headstones?)\b/iu);
  if (!listMatch) return "";
  const candidate = compactText(listMatch[1].replace(/\b(?:all|the)\b/giu, "").replace(/[?.!,;:]+$/u, ""), 80);
  if (!candidate || /\bby\s+type\b/iu.test(candidate)) return "";
  return candidate;
}

export function matchReportQuery(query) {
  const text = compactText(query, 500);
  const lower = text.toLowerCase();
  let reportId = "";
  const parameters = {};

  if (/\b(oldest|latest|earliest|recent)\b/u.test(lower) && /\bburial\b/u.test(lower)) {
    reportId = "burial-date-extremes";
  } else if (/\bveterans?\b/u.test(lower) || /\bmilitary\b/u.test(lower) || /\bwar(?:s)?\b/u.test(lower) || /\bservice branches?\b/u.test(lower)) {
    reportId = "veteran-service-summary";
  } else if (/\b(marker|headstone)\s+burial\s+pages?\b/u.test(lower) || (/\b(print|page|pages)\b/u.test(lower) && /\b(markers?|headstones?)\b/u.test(lower) && /\bburials?\b/u.test(lower))) {
    reportId = "marker-burial-pages";
    const markerMatch = text.match(/\b(?:marker|headstone)\s+(TLC-HS-[A-Z0-9-]+)\b/iu);
    if (markerMatch) parameters.markerId = markerMatch[1];
    parameters.sectionName = extractSectionName(text);
    const personMatch = text.match(/\bfor\s+(?!marker\b|headstone\b|section\b)([a-z][a-z .,'-]{1,119})[?.!]*$/iu);
    if (personMatch) parameters.personName = compactText(personMatch[1].replace(/[?.!,;:]+$/u, ""), 120);
  } else if (/\b(markers?|headstones?)\b/u.test(lower) && /\b(types?|by type|list)\b/u.test(lower)) {
    reportId = "marker-type-inventory";
    parameters.sectionName = extractSectionName(text);
    parameters.markerType = extractMarkerType(text);
  } else if (/\b(how many|count|counts?|number of)\b/u.test(lower) && /\b(markers?|headstones?|gravesites?)\b/u.test(lower) && /\b(section|cemeter(?:y|ies)|here)\b/u.test(lower)) {
    reportId = "spatial-inventory-counts";
    parameters.sectionName = extractSectionName(text);
  } else if (/\b(clean(?:ed|ing)?|illegible|listing|leaning|broken|grass|level(?:ed|ing)?|maintenance|repair|repaired|smooth|sunken)\b/u.test(lower)) {
    reportId = "maintenance-needs";
    if (/\b(markers?|headstones?)\b/u.test(lower)) parameters.targetType = "headstone";
    if (/\bgravesites?\b/u.test(lower)) parameters.targetType = "gravesite";
    if (/\billegible\b/u.test(lower)) parameters.issueCode = "illegible";
    if (/\b(listing|leaning)\b/u.test(lower)) parameters.issueCode = "listing";
    if (/\bbroken\b/u.test(lower)) parameters.issueCode = "broken";
    if (/\bgrass\b/u.test(lower)) parameters.issueCode = "grass_needed";
    if (/\blevel(?:ed|ing)?|smooth\b/u.test(lower)) parameters.issueCode = "needs_leveling";
    if (/\bsunken\b/u.test(lower)) parameters.issueCode = "sunken_soil";
    if (/\bclean(?:ed|ing)?\b/u.test(lower)) parameters.actionCode = "cleaned";
    if (/\bcompleted|done|finished\b/u.test(lower)) parameters.status = "completed";
    if (/\bopen|needs?|needed|not\b/u.test(lower)) parameters.status = "open";
    if (/\bnot\b/u.test(lower) && /\bclean(?:ed)?\b/u.test(lower)) {
      parameters.daysSinceCleaned = /\byear\b/u.test(lower) ? "365" : /\bmonth\b/u.test(lower) ? "30" : "365";
      delete parameters.status;
      delete parameters.actionCode;
    }
  } else if (/\bavailable\b/u.test(lower) && /\b(lots?|gravesites?|purchase)\b/u.test(lower)) {
    reportId = "available-inventory";
  } else if (/\b(unowned|without (?:an? )?owner|no (?:current )?owner|do not have an owner|don't have an owner)\b/u.test(lower) && /\bgravesites?\b/u.test(lower)) {
    reportId = "unowned-gravesites";
    parameters.sectionName = extractSectionName(text);
  } else if (
    (/\b(deed|paperwork|trace|claim|parents?)\b/u.test(lower) && /\b(lot|gravesite|owned|ownership|rights?)\b/u.test(lower)) ||
    (/\b(deed|claim|trace)\b/u.test(lower) && /\bpaperwork|documents?\b/u.test(lower))
  ) {
    reportId = "deed-claim-trace-guide";
  } else if (/\b(owner|owned|owns|holdings?|lots?|gravesites?)\b/u.test(lower)) {
    reportId = "owner-holdings";
    parameters.ownerName = extractOwnerName(text);
  }

  const definition = definitionById(reportId);
  if (!definition) {
    return {
      matched: false,
      message: "No approved report matched that question.",
      availableReports: reportDefinitions.map(toDefinition),
    };
  }

  const missingParameters = definition.parameters.filter((parameter) => parameter.required && !parameters[parameter.name]);
  return {
    matched: true,
    report: toDefinition(definition),
    parameters,
    missingParameters,
    message: missingParameters.length ? "More information is needed before this report can run." : "Matched an approved report.",
  };
}
