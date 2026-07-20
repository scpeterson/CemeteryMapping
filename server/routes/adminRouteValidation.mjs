import { optionalText, requiredText, validateIdentifierList, validateUuid } from "../inputValidation.mjs";
import { BadRequestError, validateMutationReason } from "../requestValidation.mjs";
import { optionalDate } from "./routeValidationHelpers.mjs";

export function validateAdminUserPayload(body, roles) {
  const role = requiredText(body?.role, "Role", 50);
  if (!roles.includes(role)) throw new BadRequestError(`Unsupported role: ${role}.`);
  const assignedCemeteryIds = Array.isArray(body?.assignedCemeteryIds)
    ? [...new Set(body.assignedCemeteryIds.map((id, index) => validateUuid(id, `Assigned cemetery ${index + 1}`)))]
    : [];
  if ((role === "power-user" || role === "cemetery-admin") && assignedCemeteryIds.length === 0) {
    throw new BadRequestError("Assigned cemetery is required for this role.");
  }

  return {
    externalSubject: requiredText(body?.externalSubject, "Auth0 user ID", 300),
    email: requiredText(body?.email, "Email", 320),
    displayName: optionalText(body?.displayName, "Display name", 250),
    role,
    assignedCemeteryIds,
    isActive: body?.isActive !== false,
  };
}

export function validateAuth0UserResolutionPayload(body) {
  return {
    email: requiredText(body?.email, "Email", 320),
    displayName: optionalText(body?.displayName, "Display name", 250),
  };
}

export function validateCemeteryTextPayload(body) {
  return {
    name: requiredText(body?.name, "Cemetery name", 255),
    fullAddress: optionalText(body?.fullAddress, "Full address", 250),
    municipality: optionalText(body?.municipality, "Municipality", 150),
    agency: optionalText(body?.agency, "Agency", 50),
    agencyUrl: optionalText(body?.agencyUrl, "Agency URL", 300),
    operationalHours: optionalText(body?.operationalHours, "Operational hours", 150),
    contactName: optionalText(body?.contactName, "Contact name", 150),
    contactPhone: optionalText(body?.contactPhone, "Contact phone", 15),
    contactEmail: optionalText(body?.contactEmail, "Contact email", 100),
    imageUrl: optionalText(body?.imageUrl, "Image URL", 300),
    notes: optionalText(body?.notes, "Cemetery notes", 4000),
  };
}

export function validateSectionTextPayload(body) {
  const alternateNames = Array.isArray(body?.alternateNames)
    ? body.alternateNames.map((value, index) => optionalText(value, `Alternate name ${index + 1}`, 255)).filter(Boolean)
    : [];

  if (alternateNames.length > 25) throw new BadRequestError("Sections can have at most 25 alternate names.");

  return {
    name: optionalText(body?.name, "Section name", 255),
    alternateNames,
    notes: optionalText(body?.notes, "Section notes", 4000),
  };
}

export function validateLotTextPayload(body) {
  return {
    name: optionalText(body?.name, "Lot name", 255),
  };
}

export function validateLookupCode(value) {
  const code = requiredText(value, "Lookup code", 50);
  if (!/^[a-z0-9_]+$/u.test(code)) throw new BadRequestError("Lookup code can contain only lowercase letters, numbers, and underscores.");
  return code;
}

export function validateLookupTable(value) {
  const table = requiredText(value, "Lookup table", 100);
  if (!/^[a-z_]+$/u.test(table)) throw new BadRequestError("Lookup table is invalid.");
  return table;
}

export function validateLookupPayload(body) {
  const sortOrder = Number.parseInt(String(body?.sortOrder ?? ""), 10);
  if (!Number.isFinite(sortOrder)) throw new BadRequestError("Sort order is required.");

  return {
    code: validateLookupCode(body?.code),
    label: requiredText(body?.label, "Label", 100),
    description: requiredText(body?.description, "Description", 500),
    sortOrder,
    isActive: body?.isActive !== false,
    sourceNotes: optionalText(body?.sourceNotes, "Source notes", 500),
    sourceUrl: optionalText(body?.sourceUrl, "Source URL", 500),
  };
}

export function validateNorthHillsEvidencePayload(body) {
  const targetType = requiredText(body?.targetType, "Evidence target type", 50);
  if (!["headstone", "gravesite"].includes(targetType)) throw new BadRequestError("Evidence target type must be headstone or gravesite.");
  const status = requiredText(body?.status, "Evidence status", 50);
  if (!["linked", "rejected", "needs_field_check"].includes(status)) {
    throw new BadRequestError("Evidence status must be linked, rejected, or needs_field_check.");
  }
  const confidence = optionalText(body?.confidence, "Evidence confidence", 50) || "review";
  if (!["high", "medium", "low", "review"].includes(confidence)) {
    throw new BadRequestError("Evidence confidence must be high, medium, low, or review.");
  }

  return {
    targetType,
    targetId: validateUuid(body?.targetId, "Evidence target"),
    status,
    confidence,
    notes: optionalText(body?.notes, "Evidence notes", 4000),
  };
}

export function validateNorthHillsEvidenceTargetPayload(body) {
  const targetType = requiredText(body?.targetType, "Evidence target type", 50);
  if (!["headstone", "gravesite"].includes(targetType)) throw new BadRequestError("Evidence target type must be headstone or gravesite.");

  return {
    targetType,
    targetId: validateUuid(body?.targetId, "Evidence target"),
  };
}

export function validateNorthHillsSourceFactReviewPayload(body) {
  const status = requiredText(body?.status, "Source fact status", 50);
  if (!["staged", "reviewed", "rejected"].includes(status)) {
    throw new BadRequestError("Source fact status must be staged, reviewed, or rejected.");
  }
  const confidence = optionalText(body?.confidence, "Source fact confidence", 50) || "review";
  if (!["high", "medium", "low", "review"].includes(confidence)) {
    throw new BadRequestError("Source fact confidence must be high, medium, low, or review.");
  }

  return {
    status,
    confidence,
    notes: optionalText(body?.notes, "Source fact notes", 4000),
  };
}

export function validateNorthHillsSourceFactPromotionPayload(body) {
  return {
    burialId: validateUuid(body?.burialId, "Burial"),
    notes: optionalText(body?.notes, "Promotion notes", 4000),
    reason: validateMutationReason(body?.reason),
  };
}

export function validateOptionalInteger(value, label) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number.parseInt(String(value), 10);
  if (!Number.isFinite(number)) throw new BadRequestError(`${label} must be a number.`);
  return number;
}

export function validateOptionalTextArray(value, label, maxItems = 50, maxLength = 500) {
  if (!Array.isArray(value)) return [];
  if (value.length > maxItems) throw new BadRequestError(`${label} has too many values.`);
  return value.map((item, index) => optionalText(item, `${label} ${index + 1}`, maxLength)).filter(Boolean);
}

export function validateOptionalIntegerArray(value, label, maxItems = 50) {
  if (!Array.isArray(value)) return [];
  if (value.length > maxItems) throw new BadRequestError(`${label} has too many values.`);
  return value
    .map((item, index) => validateOptionalInteger(item, `${label} ${index + 1}`))
    .filter((item) => item !== null);
}

export function validateNorthHillsSourceFactInput(fact, index) {
  const id = optionalText(fact?.id, `Source fact ${index + 1} id`, 50);
  if (id) validateUuid(id, `Source fact ${index + 1}`);
  const sourceCode = requiredText(fact?.sourceCode, `Source fact ${index + 1} source`, 10).toUpperCase();
  if (!["CR", "CRG"].includes(sourceCode)) throw new BadRequestError("Source fact source must be CR or CRG.");
  const factType = requiredText(fact?.factType, `Source fact ${index + 1} type`, 50);
  if (!["death_date", "middle_initial", "age_at_death", "note"].includes(factType)) throw new BadRequestError("Source fact type is invalid.");
  const confidence = optionalText(fact?.confidence, `Source fact ${index + 1} confidence`, 50) || "review";
  if (!["high", "medium", "low", "review"].includes(confidence)) throw new BadRequestError("Source fact confidence is invalid.");
  const status = optionalText(fact?.status, `Source fact ${index + 1} status`, 50) || "staged";
  if (!["staged", "reviewed", "promoted", "rejected"].includes(status)) throw new BadRequestError("Source fact status is invalid.");

  return {
    id,
    sourceCode,
    factType,
    factValue: requiredText(fact?.factValue, `Source fact ${index + 1} value`, 2000),
    factDate: optionalText(fact?.factDate, `Source fact ${index + 1} date`, 20),
    rawText: optionalText(fact?.rawText, `Source fact ${index + 1} raw text`, 4000),
    confidence,
    status,
    reviewNotes: optionalText(fact?.reviewNotes, `Source fact ${index + 1} review notes`, 4000),
  };
}

export function validateNorthHillsObservationInput(observation, index) {
  const id = optionalText(observation?.id, `Observation ${index + 1} id`, 50);
  if (id) validateUuid(id, `Observation ${index + 1}`);
  const observationType = requiredText(observation?.observationType, `Observation ${index + 1} type`, 50);
  if (!["plot_marker", "gap", "marker_observation", "entry_note"].includes(observationType)) throw new BadRequestError("Observation type is invalid.");
  const status = optionalText(observation?.status, `Observation ${index + 1} status`, 50) || "staged";
  if (!["staged", "reviewed", "rejected"].includes(status)) throw new BadRequestError("Observation status is invalid.");

  return {
    id,
    observationType,
    observationText: requiredText(observation?.observationText, `Observation ${index + 1} text`, 4000),
    status,
  };
}

export function validateNorthHillsEntryPayload(body) {
  const parsedMarkerScope = optionalText(body?.parsedMarkerScope, "Marker scope", 50);
  if (parsedMarkerScope && !["single", "couple", "monolith", "unknown"].includes(parsedMarkerScope)) throw new BadRequestError("Marker scope is invalid.");
  const parseConfidence = optionalText(body?.parseConfidence, "Parse confidence", 50) || "review";
  if (!["high", "medium", "low", "review"].includes(parseConfidence)) throw new BadRequestError("Parse confidence is invalid.");
  const status = optionalText(body?.status, "Reading status", 50) || "staged";
  if (!["staged", "reviewed", "promoted", "rejected"].includes(status)) throw new BadRequestError("Reading status is invalid.");
  const sourceFacts = Array.isArray(body?.sourceFacts) ? body.sourceFacts.map(validateNorthHillsSourceFactInput) : [];
  if (sourceFacts.length > 50) throw new BadRequestError("A North Hills entry can have at most 50 source facts.");
  const observations = Array.isArray(body?.observations) ? body.observations.map(validateNorthHillsObservationInput) : [];
  if (observations.length > 50) throw new BadRequestError("A North Hills entry can have at most 50 observations.");

  return {
    sourcePageNumber: validateOptionalInteger(body?.sourcePageNumber, "Source page"),
    sourceLineStart: validateOptionalInteger(body?.sourceLineStart, "Source line start"),
    sourceLineEnd: validateOptionalInteger(body?.sourceLineEnd, "Source line end"),
    rawText: requiredText(body?.rawText, "Raw entry text", 12000),
    nameText: optionalText(body?.nameText, "Parsed name", 500),
    surnames: validateOptionalTextArray(body?.surnames, "Surname", 25, 250),
    parsedSectionName: optionalText(body?.parsedSectionName, "Parsed section", 50).toUpperCase(),
    parsedRowNumber: validateOptionalInteger(body?.parsedRowNumber, "Parsed row"),
    parsedPositionNumber: validateOptionalInteger(body?.parsedPositionNumber, "Parsed position"),
    parsedMarkerScope,
    markerTypeText: optionalText(body?.markerTypeText, "Marker type", 250),
    materialText: optionalText(body?.materialText, "Material", 250),
    conditionText: optionalText(body?.conditionText, "Condition", 250),
    inscriptionText: optionalText(body?.inscriptionText, "Inscription", 12000),
    parsedYears: validateOptionalIntegerArray(body?.parsedYears, "Parsed year", 50),
    parseConfidence,
    parseNotes: validateOptionalTextArray(body?.parseNotes, "Parser note", 50, 1000),
    status,
    sourceEntry: body?.sourceEntry && typeof body.sourceEntry === "object" ? body.sourceEntry : {},
    sourceFacts,
    observations,
    reason: validateMutationReason(body?.reason),
  };
}

export function validateSourcePersonRecordPayload(body) {
  const sourceCode = optionalText(body?.sourceCode, "Source code", 20).toUpperCase() || "OTHER";
  if (!["CR", "CRG", "FH", "SK", "NOTE", "OTHER"].includes(sourceCode)) throw new BadRequestError("Source code is invalid.");
  const recordType = optionalText(body?.recordType, "Record type", 50) || "death_record";
  if (!["death_record", "burial_record", "funeral_record", "church_record", "family_history", "other"].includes(recordType)) {
    throw new BadRequestError("Record type is invalid.");
  }
  const status = optionalText(body?.status, "Status", 50) || "unmatched";
  if (!["unmatched", "candidate_match", "linked", "rejected"].includes(status)) throw new BadRequestError("Status is invalid.");
  const confidence = optionalText(body?.confidence, "Confidence", 50) || "review";
  if (!["high", "medium", "low", "review"].includes(confidence)) throw new BadRequestError("Confidence is invalid.");

  return {
    cemeteryId: validateUuid(body?.cemeteryId, "Cemetery"),
    northHillsOcrEntryId: body?.northHillsOcrEntryId ? validateUuid(body.northHillsOcrEntryId, "North Hills entry") : "",
    northHillsOcrSourceFactId: body?.northHillsOcrSourceFactId ? validateUuid(body.northHillsOcrSourceFactId, "North Hills source fact") : "",
    sourceName: optionalText(body?.sourceName, "Source name", 250) || "North Hills Genealogists Trinity OCR",
    sourceCode,
    sourceLabel: optionalText(body?.sourceLabel, "Source label", 150),
    sourcePageNumber: validateOptionalInteger(body?.sourcePageNumber, "Source page"),
    sourceLocationText: optionalText(body?.sourceLocationText, "Source location", 250),
    recordType,
    status,
    confidence,
    firstName: optionalText(body?.firstName, "First name", 150),
    middleName: optionalText(body?.middleName, "Middle name", 150),
    lastName: optionalText(body?.lastName, "Last name", 150),
    maidenName: optionalText(body?.maidenName, "Maiden name", 150),
    fullName: requiredText(body?.fullName, "Full name", 500),
    birthDate: optionalDate(body?.birthDate, "Birth date"),
    birthDateText: optionalText(body?.birthDateText, "Birth date text", 100),
    deathDate: optionalDate(body?.deathDate, "Death date"),
    deathDateText: optionalText(body?.deathDateText, "Death date text", 100),
    burialDate: optionalDate(body?.burialDate, "Burial date"),
    burialDateText: optionalText(body?.burialDateText, "Burial date text", 100),
    funeralDate: optionalDate(body?.funeralDate, "Funeral date"),
    funeralDateText: optionalText(body?.funeralDateText, "Funeral date text", 100),
    ageText: optionalText(body?.ageText, "Age text", 100),
    rawText: requiredText(body?.rawText, "Raw source text", 12000),
    notes: optionalText(body?.notes, "Notes", 4000),
    reason: validateMutationReason(body?.reason),
  };
}

export function validateBulkHeadstoneUpdatePayload(body) {
  const markerTypeId = body?.markerTypeId ? validateUuid(body.markerTypeId, "Marker type") : "";
  const materialId = body?.materialId ? validateUuid(body.materialId, "Marker material") : "";
  const conditionId = body?.conditionId ? validateUuid(body.conditionId, "Marker condition") : "";
  if (!markerTypeId && !materialId && !conditionId) throw new BadRequestError("At least one marker field is required.");
  return {
    identifiers: validateIdentifierList(body?.identifiers, "Marker identifiers"),
    markerTypeId,
    materialId,
    conditionId,
    reason: validateMutationReason(body?.reason),
  };
}

export function validateBulkGravesiteLotPayload(body) {
  return {
    identifiers: validateIdentifierList(body?.identifiers, "Gravesite identifiers"),
    lotId: validateUuid(body?.lotId, "Lot"),
    reason: validateMutationReason(body?.reason),
  };
}

export function validateBulkNorthHillsReviewedPayload(body) {
  return {
    entryIds: validateIdentifierList(body?.entryIds, "North Hills reading identifiers"),
    reason: validateMutationReason(body?.reason),
  };
}

export function validateBulkNorthHillsNotePayload(body) {
  return {
    entryIds: validateIdentifierList(body?.entryIds, "North Hills reading identifiers"),
    note: requiredText(body?.note, "Shared note", 4000),
    reason: validateMutationReason(body?.reason),
  };
}

export function validateDeedInvestigationCasePayload(body) {
  return {
    cemeteryId: body?.cemeteryId ? validateUuid(body.cemeteryId, "Cemetery") : "",
    caseNumber: requiredText(body?.caseNumber, "Case number", 50),
    status: requiredText(body?.status, "Case status", 50),
    subjectName: requiredText(body?.subjectName, "Subject name", 250),
    requesterName: optionalText(body?.requesterName, "Requester name", 250),
    requesterContact: optionalText(body?.requesterContact, "Requester contact", 500),
    plotReference: optionalText(body?.plotReference, "Plot reference", 250),
    requestSummary: optionalText(body?.requestSummary, "Request summary", 4000),
    familySummary: optionalText(body?.familySummary, "Family summary", 4000),
    findings: optionalText(body?.findings, "Findings", 4000),
    councilDecision: optionalText(body?.councilDecision, "Council decision", 4000),
    affidavitStatus: requiredText(body?.affidavitStatus, "Affidavit status", 50),
    outcome: optionalText(body?.outcome, "Outcome", 4000),
    openedAt: optionalDate(body?.openedAt, "Opened date"),
    closedAt: optionalDate(body?.closedAt, "Closed date"),
    reason: validateMutationReason(body?.reason),
  };
}

export function validateDeedInvestigationCaseLinkPayload(body) {
  return {
    entryId: validateUuid(body?.entryId, "Deed evidence row"),
    note: optionalText(body?.note, "Evidence note", 1000),
    reason: validateMutationReason(body?.reason),
  };
}

export function validateDeedInvestigationCaseActionPayload(body) {
  const sortOrder = Number.parseInt(String(body?.sortOrder ?? "100"), 10);
  return {
    subjectName: requiredText(body?.subjectName, "Action subject", 250),
    actionType: requiredText(body?.actionType, "Action type", 50),
    plotReference: optionalText(body?.plotReference, "Action plot reference", 250),
    councilStatus: requiredText(body?.councilStatus, "Council status", 50),
    councilDecisionDate: optionalDate(body?.councilDecisionDate, "Council decision date"),
    councilDocumentReference: optionalText(body?.councilDocumentReference, "Council document reference", 250),
    affidavitStatus: requiredText(body?.affidavitStatus, "Affidavit status", 50),
    deedStatus: requiredText(body?.deedStatus, "Deed status", 50),
    outcome: optionalText(body?.outcome, "Action outcome", 4000),
    notes: optionalText(body?.notes, "Action notes", 4000),
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 100,
    reason: validateMutationReason(body?.reason),
  };
}

