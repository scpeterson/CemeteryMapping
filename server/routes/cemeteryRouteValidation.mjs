import { optionalCoordinate, optionalText, requiredText, validateUuid } from "../inputValidation.mjs";
import { BadRequestError, validateMutationReason } from "../requestValidation.mjs";
import { optionalBoolean, optionalDate, optionalRecordedDate, validateDataConfidence, validateReviewStatus } from "./routeValidationHelpers.mjs";

export function validateReportId(value) {
  const id = requiredText(value, "Report", 100);
  if (!/^[a-z0-9-]+$/u.test(id)) throw new BadRequestError("Report is invalid.");
  return id;
}

export function validateReportParameters(value) {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new BadRequestError("Report parameters are invalid.");
  return value;
}

export function validateReportRunPayload(body) {
  return {
    reportId: validateReportId(body?.reportId),
    parameters: validateReportParameters(body?.parameters),
  };
}

export function validateReportQueryPayload(body) {
  return {
    query: requiredText(body?.query, "Question", 500),
  };
}

export function validateHeadstonePayload(body) {
  const lastInspectedAt = optionalText(body?.lastInspectedAt, "Last inspected date", 10);
  if (lastInspectedAt && !/^\d{4}-\d{2}-\d{2}$/u.test(lastInspectedAt)) throw new BadRequestError("Last inspected date must use YYYY-MM-DD format.");
  const nhgInclusion = optionalText(body?.nhgInclusion, "NHG inclusion", 30) || "not_checked";
  if (!["listed", "not_listed", "not_checked", "unclear"].includes(nhgInclusion)) throw new BadRequestError("NHG inclusion is invalid.");
  const provenanceVerificationSource = optionalText(body?.provenanceVerificationSource, "Provenance verification source", 50) || "manual_review";
  if (!["field_survey", "documentary_record", "manual_review", "import"].includes(provenanceVerificationSource)) {
    throw new BadRequestError("Provenance verification source is invalid.");
  }
  const provenanceVerifiedAt = optionalText(body?.provenanceVerifiedAt, "Source information verified date", 10);
  if (provenanceVerifiedAt && !/^\d{4}-\d{2}-\d{2}$/u.test(provenanceVerifiedAt)) {
    throw new BadRequestError("Source information verified date must use YYYY-MM-DD format.");
  }

  return {
    markerTypeId: validateUuid(body?.markerTypeId, "Marker type"),
    materialId: validateUuid(body?.materialId, "Marker material"),
    conditionId: validateUuid(body?.conditionId, "Condition"),
    conditionNotes: optionalText(body?.conditionNotes, "Condition notes", 4000),
    inscription: optionalText(body?.inscription, "Inscription", 20_000),
    designNotes: optionalText(body?.designNotes, "Design notes", 20_000),
    backDescription: optionalText(body?.backDescription, "Back description", 20_000),
    photoUrl: optionalText(body?.photoUrl, "Photo URL", 300),
    lastInspectedAt,
    dataConfidence: validateDataConfidence(body?.dataConfidence),
    reviewStatus: validateReviewStatus(body?.reviewStatus),
    reviewNotes: optionalText(body?.reviewNotes, "Review notes", 4000) ?? "",
    sourceConflict: optionalBoolean(body?.sourceConflict, "Source conflict"),
    nhgInclusion,
    provenanceVerificationSource,
    provenanceVerifiedAt,
    reason: validateMutationReason(body?.reason),
  };
}

export function validateHeadstoneGravesiteRelationshipType(value) {
  const relationshipType = optionalText(value, "Marker gravesite relationship", 50) || "secondary";
  if (!["primary", "spans", "nearby", "inferred", "footstone", "secondary"].includes(relationshipType)) {
    throw new BadRequestError("Marker gravesite relationship is invalid.");
  }
  return relationshipType;
}

export function validateCreateHeadstonePayload(body, graveSpaceId) {
  const latitude = optionalCoordinate(body?.latitude, "Latitude", { min: -90, max: 90 });
  const longitude = optionalCoordinate(body?.longitude, "Longitude", { min: -180, max: 180 });
  if ((latitude === null) !== (longitude === null)) throw new BadRequestError("Latitude and longitude must be provided together.");
  const headstone = validateHeadstonePayload(body);

  return {
    ...headstone,
    headstoneId: requiredText(body?.headstoneId, "Marker ID", 50),
    graveSpaceId,
    relationshipType: validateHeadstoneGravesiteRelationshipType(body?.relationshipType),
    relationshipNotes: optionalText(body?.relationshipNotes, "Marker relationship notes", 1000),
    latitude,
    longitude,
  };
}

export function validateHeadstoneRelationshipPayload(body) {
  const relationshipType = optionalText(body?.relationshipType, "Relationship type", 50) || "related_marker";
  if (!["family_obelisk", "references_marker", "common_base", "foot_marker", "related_marker"].includes(relationshipType)) {
    throw new BadRequestError("Relationship type is invalid.");
  }
  const sourceType = optionalText(body?.sourceType, "Relationship source", 50) || "manual";
  if (!["manual", "nhg", "field_observation", "import"].includes(sourceType)) {
    throw new BadRequestError("Relationship source is invalid.");
  }
  const confidence = optionalText(body?.confidence, "Relationship confidence", 50) || "review";
  if (!["high", "medium", "low", "review"].includes(confidence)) {
    throw new BadRequestError("Relationship confidence is invalid.");
  }
  const status = optionalText(body?.status, "Relationship status", 50) || "active";
  if (!["active", "needs_review", "retired"].includes(status)) {
    throw new BadRequestError("Relationship status is invalid.");
  }

  return {
    relatedHeadstoneId: validateUuid(body?.relatedHeadstoneId, "Related marker"),
    relationshipType,
    sourceType,
    sourceText: optionalText(body?.sourceText, "Relationship source text", 4000) ?? "",
    confidence,
    notes: optionalText(body?.notes, "Relationship notes", 4000) ?? "",
    status,
    reason: validateMutationReason(body?.reason),
  };
}

export function validateGraveFeaturePayload(body, { requireTarget = true } = {}) {
  const sourceType = optionalText(body?.sourceType, "Feature source", 50) || "manual";
  if (!["manual", "nhg", "photo", "field_survey", "import"].includes(sourceType)) {
    throw new BadRequestError("Feature source is invalid.");
  }
  const status = optionalText(body?.status, "Feature status", 30) || "active";
  if (!["active", "needs_review", "retired"].includes(status)) throw new BadRequestError("Feature status is invalid.");

  const graveSpaceId = optionalText(body?.graveSpaceId, "Gravesite", 100) ?? "";
  const headstoneId = body?.headstoneId ? validateUuid(body.headstoneId, "Marker") : "";
  if (requireTarget && !graveSpaceId && !headstoneId) throw new BadRequestError("Feature must be linked to a gravesite or marker.");

  return {
    graveSpaceId,
    headstoneId,
    featureTypeId: validateUuid(body?.featureTypeId, "Feature type"),
    featureSubtypeId: body?.featureSubtypeId ? validateUuid(body.featureSubtypeId, "Feature subtype") : "",
    placementTypeId: body?.placementTypeId ? validateUuid(body.placementTypeId, "Feature placement") : "",
    materialTypeId: body?.materialTypeId ? validateUuid(body.materialTypeId, "Feature material") : "",
    symbolText: optionalText(body?.symbolText, "Symbol text", 200) ?? "",
    sourceType,
    sourceText: optionalText(body?.sourceText, "Source text", 4000) ?? "",
    notes: optionalText(body?.notes, "Feature notes", 4000) ?? "",
    status,
    reason: validateMutationReason(body?.reason),
  };
}

export function validateMaintenanceRecordPayload(body, { requireTarget = true } = {}) {
  const targetType = optionalText(body?.targetType, "Maintenance target", 30) || "gravesite";
  if (!["gravesite", "headstone"].includes(targetType)) throw new BadRequestError("Maintenance target is invalid.");

  const status = optionalText(body?.status, "Maintenance status", 30) || "open";
  if (!["open", "scheduled", "completed", "deferred", "not_needed"].includes(status)) throw new BadRequestError("Maintenance status is invalid.");

  const sourceType = optionalText(body?.sourceType, "Maintenance source", 50) || "manual";
  if (!["manual", "inspection", "work_order", "photo", "import"].includes(sourceType)) throw new BadRequestError("Maintenance source is invalid.");

  const observedAt = optionalText(body?.observedAt, "Observed date", 10) || new Date().toISOString().slice(0, 10);
  const completedAt = optionalText(body?.completedAt, "Completed date", 10) || "";
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(observedAt)) throw new BadRequestError("Observed date must use YYYY-MM-DD format.");
  if (completedAt && !/^\d{4}-\d{2}-\d{2}$/u.test(completedAt)) throw new BadRequestError("Completed date must use YYYY-MM-DD format.");

  const graveSpaceId = optionalText(body?.graveSpaceId, "Gravesite", 100) ?? "";
  const headstoneId = body?.headstoneId ? validateUuid(body.headstoneId, "Marker") : "";
  if (requireTarget && !graveSpaceId && !headstoneId) throw new BadRequestError("Maintenance must be linked to a gravesite or marker.");

  const issueTypeId = body?.issueTypeId ? validateUuid(body.issueTypeId, "Maintenance issue") : "";
  const actionTypeId = body?.actionTypeId ? validateUuid(body.actionTypeId, "Maintenance action") : "";
  if (!issueTypeId && !actionTypeId) throw new BadRequestError("Maintenance must include an issue or action.");

  return {
    targetType,
    graveSpaceId,
    headstoneId,
    issueTypeId,
    actionTypeId,
    priorityTypeId: validateUuid(body?.priorityTypeId, "Maintenance priority"),
    status,
    observedAt,
    completedAt,
    performedBy: optionalText(body?.performedBy, "Performed by", 200) ?? "",
    sourceType,
    notes: optionalText(body?.notes, "Maintenance notes", 4000) ?? "",
    reason: validateMutationReason(body?.reason),
  };
}

export function validateGraveSpacePayload(body) {
  const status = optionalText(body?.status, "Gravesite status", 30) || "unknown";
  if (!["available", "reserved", "occupied", "sold", "needs_review", "unknown"].includes(status)) {
    throw new BadRequestError("Gravesite status is invalid.");
  }
  const costText = optionalText(body?.cost, "Cost", 30);
  const cost = costText ? Number(costText) : null;
  if (costText && (!Number.isFinite(cost) || cost < 0)) throw new BadRequestError("Cost must be a non-negative number.");

  return {
    name: optionalText(body?.name, "Name", 255) ?? "",
    status,
    cost,
    reason: validateMutationReason(body?.reason),
  };
}

export function validateBurialPayload(body) {
  const intermentType = optionalText(body?.intermentType, "Interment type", 20) || "casket";
  if (!/^[a-z0-9_]+$/u.test(intermentType)) throw new BadRequestError("Interment type is invalid.");
  const recordStatusCode = optionalText(body?.recordStatusCode, "Burial record status", 50) || "interred";
  if (!["interred", "pre_need_inscription", "memorial", "unknown"].includes(recordStatusCode)) {
    throw new BadRequestError("Burial record status is invalid.");
  }
  const deathPlaceIdText = optionalText(body?.deathPlaceId, "Death place", 36) ?? "";
  const deathPlaceId = deathPlaceIdText ? validateUuid(deathPlaceIdText, "Death place") : "";

  return {
    firstName: optionalText(body?.firstName, "First name", 100) ?? "",
    lastName: optionalText(body?.lastName, "Last name", 100) ?? "",
    maidenName: optionalText(body?.maidenName, "Maiden name", 150) ?? "",
    birthDate: optionalRecordedDate(body?.birthDate, "Birth date") ?? "",
    deathDate: optionalRecordedDate(body?.deathDate, "Death date") ?? "",
    deathPlaceId,
    burialDate: optionalDate(body?.burialDate, "Burial date") ?? "",
    intermentType,
    recordStatusCode,
    funeralHome: optionalText(body?.funeralHome, "Funeral home", 255) ?? "",
    veteran: optionalBoolean(body?.veteran, "Veteran"),
    militaryBranchCode: optionalText(body?.militaryBranchCode, "Military branch", 50) ?? "",
    militaryRankCode: optionalText(body?.militaryRankCode, "Military rank", 50) ?? "",
    militaryWarServiceCode: optionalText(body?.militaryWarServiceCode, "War service", 50) ?? "",
    notes: optionalText(body?.notes, "Burial notes", 4000) ?? "",
    dataConfidence: validateDataConfidence(body?.dataConfidence),
    reviewStatus: validateReviewStatus(body?.reviewStatus),
    reviewNotes: optionalText(body?.reviewNotes, "Review notes", 4000) ?? "",
    sourceConflict: optionalBoolean(body?.sourceConflict, "Source conflict"),
    reason: validateMutationReason(body?.reason),
  };
}

export function validateOwnershipEventPayload(body) {
  const eventType = requiredText(body?.eventType, "Ownership event type", 50);
  if (!["deed", "sale", "gift", "church_council_action", "correction", "release"].includes(eventType)) {
    throw new BadRequestError("Ownership event type is invalid.");
  }

  const targetScope = requiredText(body?.targetScope, "Ownership target", 50);
  if (!["selected_gravesite", "selected_lot", "listed_gravesites"].includes(targetScope)) {
    throw new BadRequestError("Ownership target is invalid.");
  }

  const targetGravesiteIds = Array.isArray(body?.targetGravesiteIds)
    ? [...new Set(body.targetGravesiteIds.map((value) => optionalText(value, "Target gravesite ID", 80)).filter(Boolean))]
    : [];

  return {
    ownerDisplayName: requiredText(body?.ownerDisplayName, "Owner name", 250),
    eventType,
    targetScope,
    targetGravesiteIds,
    effectiveDate: optionalDate(body?.effectiveDate, "Effective date"),
    documentReference: optionalText(body?.documentReference, "Document reference", 250),
    notes: optionalText(body?.notes, "Ownership notes", 4000),
    reason: validateMutationReason(body?.reason),
  };
}
