import type {
  BulkEditResult,
  CemeteryAdminRecords,
  CemeteryTextRecord,
  CurrentUser,
  DeedInvestigationAction,
  DeedInvestigationCase,
  DeedRegistryReview,
  HeadstoneLookups,
  LookupAdminRecords,
  LookupRecord,
  LotTextRecord,
  NorthHillsOcrEvidenceStatus,
  NorthHillsOcrObservation,
  NorthHillsOcrReview,
  NorthHillsOcrReviewEntry,
  NorthHillsOcrReviewFilters,
  NorthHillsSourceFact,
  NorthHillsSourceFactStatus,
  SaveDeedInvestigationActionInput,
  SaveDeedInvestigationCaseInput,
  SaveNorthHillsOcrEntryInput,
  SaveNorthHillsOcrObservationInput,
  SaveNorthHillsSourceFactInput,
  SaveSourcePersonRecordInput,
  SectionTextRecord,
  SourcePersonRecord,
  SourcePersonRecordConfidence,
  SourcePersonRecordFilters,
  SourcePersonRecordReview,
  SourcePersonRecordSourceCode,
  SourcePersonRecordStatus,
  SourcePersonRecordType
} from "../../types";
export function candidateGravesiteLabel(match: NorthHillsOcrReviewEntry["candidateMatches"][number]) {
  if (match.sectionId && match.graveId) return `${match.sectionId}-${match.graveId}`;

  const generatedRecordId = /^TLC-GPS-(\d+)(?:-(\d+))?$/u.exec(match.gravesiteId);
  if (match.sectionId && generatedRecordId) {
    const suffixNumber = Number.parseInt(generatedRecordId[2] ?? "", 10);
    const suffix = Number.isInteger(suffixNumber) && suffixNumber >= 1 && suffixNumber <= 26
      ? String.fromCharCode(64 + suffixNumber)
      : "";
    return `${match.sectionId}-${generatedRecordId[1]}${suffix}`;
  }

  return match.gravesiteId || "Unknown";
}

export type AdminPanelProps = {
  currentUser: CurrentUser;
  onClose: () => void;
};

export type AdminTab = "users" | "records" | "quality" | "bulk" | "deeds" | "readings" | "sourcePeople" | "audit" | "lookups" | "system";

export type NorthHillsEditForm = SaveNorthHillsOcrEntryInput & {
  surnamesText: string;
  parsedYearsText: string;
  parseNotesText: string;
};

export function parseBulkIdentifiers(value: string) {
  return [...new Set(value.split(/[\s,;]+/u).map((identifier) => identifier.trim()).filter(Boolean))];
}

export function bulkResultMessage(label: string, result: BulkEditResult) {
  const missing = result.notFound.length ? ` ${result.notFound.length} not found: ${result.notFound.slice(0, 6).join(", ")}${result.notFound.length > 6 ? ", ..." : ""}.` : "";
  return `${label}: updated ${result.updatedCount} of ${result.requestedCount} selected record${result.requestedCount === 1 ? "" : "s"}.${missing}`;
}

export const emptyCemeteryRecords: CemeteryAdminRecords = {
  cemeteries: [],
  sections: [],
  lots: [],
};

export const emptyHeadstoneLookups: HeadstoneLookups = {
  gravesites: [],
  markerTypes: [],
  markerScopes: [],
  materials: [],
  conditions: [],
  vaseTypes: [],
  vaseMaterials: [],
  vasePlacements: [],
  graveFeatureTypes: [],
  graveFeatureSubtypes: [],
  graveFeaturePlacements: [],
  graveFeatureMaterials: [],
  intermentTypes: [],
  burialRecordStatuses: [],
  militaryBranches: [],
  militaryRanks: [],
  militaryWarServices: [],
  militaryDecorations: [],
  verifiedPlaces: [],
  maintenanceIssueTypes: [],
  maintenanceActionTypes: [],
  maintenancePriorities: [],
  headstones: [],
};

export const emptyDeedRegistryReview: DeedRegistryReview = {
  batches: [],
  selectedBatchId: "",
  summary: [],
  comparison: null,
  removedOriginalEntries: [],
  entries: [],
};

export const defaultNorthHillsReviewFilters: NorthHillsOcrReviewFilters = {
  batchId: "",
  confidence: "",
  status: "",
  section: "",
  sort: "review",
  q: "",
  limit: 100,
};

export const defaultBulkReason = "Bulk cleanup from admin tools.";

export const emptyNorthHillsOcrReview: NorthHillsOcrReview = {
  batches: [],
  selectedBatchId: "",
  summary: [],
  entries: [],
};

export const defaultSourcePersonFilters: SourcePersonRecordFilters = {
  q: "",
  status: "",
  sourceCode: "",
  cemeteryId: "",
  limit: 50,
};

export const emptySourcePersonReview: SourcePersonRecordReview = {
  cemeteries: [],
  records: [],
};

export const emptyLookupAdminRecords: LookupAdminRecords = {
  tables: [],
  lookups: {},
};

export const blankLookupRecord: LookupRecord = {
  id: "",
  code: "",
  label: "",
  description: "",
  sortOrder: 100,
  isActive: true,
  usageCount: 0,
  usageLabel: "",
  sourceNotes: "",
  sourceUrl: "",
  createdAt: "",
  updatedAt: "",
};

export const cemeteryPickerLabel = (cemetery: CemeteryTextRecord) => cemetery.name;

export const sectionPickerLabel = (section: SectionTextRecord) => `Section ${section.name}`;

export const lotPickerLabel = (lot: LotTextRecord) => `Lot ${lot.lotId} - ${lot.name}`;

export const confidenceLabels: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  review: "Review",
};

export const deedConfidenceLabel = (confidence: string) => confidenceLabels[confidence] ?? confidence;

export const formatList = (values: string[]) => (values.length ? values.join(", ") : "None");

export const readingEntryTitle = (entry: NorthHillsOcrReviewEntry) =>
  `Page ${entry.sourcePageNumber ?? entry.sourcePageIndex}. ${entry.nameText || "Unnamed reading"}. ${deedConfidenceLabel(entry.parseConfidence)} confidence. ${entry.candidateMatchCount} possible match${entry.candidateMatchCount === 1 ? "" : "es"}.`;

export const evidenceStatusLabels: Record<NorthHillsOcrEvidenceStatus, string> = {
  linked: "Linked",
  rejected: "Rejected",
  needs_field_check: "Needs field check",
};

export const sourceFactStatusLabels: Record<NorthHillsSourceFactStatus, string> = {
  staged: "Staged",
  reviewed: "Reviewed",
  promoted: "Promoted",
  rejected: "Rejected",
};

export const sourceFactTypeLabels: Record<NorthHillsSourceFact["factType"], string> = {
  death_date: "Death date",
  middle_initial: "Middle initial",
  age_at_death: "Age at death",
  note: "Source note",
};

export const observationTypeLabels: Record<NorthHillsOcrObservation["observationType"], string> = {
  plot_marker: "Plot marker observed",
  gap: "Gap observed",
  marker_observation: "Marker observation",
  entry_note: "Entry note",
};

export const observationStatusLabels: Record<NorthHillsOcrObservation["status"], string> = {
  staged: "Staged",
  reviewed: "Reviewed",
  rejected: "Rejected",
};

export const hasNorthHillsEvidenceStatus = (evidence: { status: NorthHillsOcrEvidenceStatus }[], status: NorthHillsOcrEvidenceStatus) =>
  evidence.some((item) => item.status === status);

export const markerScopeOptions = ["", "single", "couple", "monolith", "unknown"];

export const entryStatusOptions = ["staged", "reviewed", "promoted", "rejected"];

export const sourcePersonSourceLabels: Record<SourcePersonRecordSourceCode, string> = {
  CR: "Church Records",
  CRG: "Church Records in German",
  FH: "Family history",
  SK: "SK",
  NOTE: "Note",
  OTHER: "Other",
};

export const sourcePersonTypeLabels: Record<SourcePersonRecordType, string> = {
  death_record: "Death record",
  burial_record: "Burial record",
  funeral_record: "Funeral record",
  church_record: "Church record",
  family_history: "Family history",
  other: "Other",
};

export const sourcePersonStatusLabels: Record<SourcePersonRecordStatus, string> = {
  unmatched: "Unmatched",
  candidate_match: "Candidate match",
  linked: "Linked",
  rejected: "Rejected",
};

export const sourcePersonConfidenceLabels: Record<SourcePersonRecordConfidence, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  review: "Review",
};

export const sourcePersonSourceOptions = Object.keys(sourcePersonSourceLabels) as SourcePersonRecordSourceCode[];

export const sourcePersonTypeOptions = Object.keys(sourcePersonTypeLabels) as SourcePersonRecordType[];

export const sourcePersonStatusOptions = Object.keys(sourcePersonStatusLabels) as SourcePersonRecordStatus[];

export const sourcePersonConfidenceOptions = Object.keys(sourcePersonConfidenceLabels) as SourcePersonRecordConfidence[];

export function splitAdminList(value: string) {
  return [...new Set(value.split(/[\n,;]+/u).map((item) => item.trim()).filter(Boolean))];
}

export function splitAdminYears(value: string) {
  return [...new Set(value.split(/[\n,;]+/u).map((item) => Number.parseInt(item.trim(), 10)).filter((item) => Number.isFinite(item)))].sort((left, right) => left - right);
}

export function northHillsEditFormFromEntry(entry: NorthHillsOcrReviewEntry): NorthHillsEditForm {
  const base: SaveNorthHillsOcrEntryInput = {
    sourcePageNumber: entry.sourcePageNumber ?? null,
    sourceLineStart: entry.sourceLineStart,
    sourceLineEnd: entry.sourceLineEnd,
    rawText: entry.rawText,
    nameText: entry.nameText,
    surnames: entry.surnames,
    parsedSectionName: entry.parsedSectionName,
    parsedRowNumber: entry.parsedRowNumber ?? null,
    parsedPositionNumber: entry.parsedPositionNumber ?? null,
    parsedMarkerScope: entry.parsedMarkerScope,
    markerTypeText: entry.markerTypeText,
    materialText: entry.materialText,
    conditionText: entry.conditionText,
    inscriptionText: entry.inscriptionText,
    parsedYears: entry.parsedYears,
    parseConfidence: entry.parseConfidence,
    parseNotes: entry.parseNotes,
    status: entry.status,
    sourceFacts: entry.sourceFacts.map((fact) => ({
      id: fact.id,
      sourceCode: fact.sourceCode,
      factType: fact.factType,
      factValue: fact.factValue,
      factDate: fact.factDate ?? "",
      rawText: fact.rawText,
      confidence: fact.confidence,
      status: fact.status,
      reviewNotes: fact.reviewNotes ?? "",
    })),
    observations: entry.observations.map((observation) => ({
      id: observation.id,
      observationType: observation.observationType,
      observationText: observation.observationText,
      status: observation.status,
    })),
    reason: "Edit North Hills reading.",
  };
  return {
    ...base,
    surnamesText: entry.surnames.join(", "),
    parsedYearsText: entry.parsedYears.join(", "),
    parseNotesText: entry.parseNotes.join("\n"),
  };
}

export function northHillsEditPayload(form: NorthHillsEditForm): SaveNorthHillsOcrEntryInput {
  return {
    ...form,
    surnames: splitAdminList(form.surnamesText),
    parsedYears: splitAdminYears(form.parsedYearsText),
    parseNotes: splitAdminList(form.parseNotesText),
    sourceFacts: form.sourceFacts.filter((fact) => fact.factValue.trim()),
    observations: form.observations.filter((observation) => observation.observationText.trim()),
  };
}

export const blankNorthHillsSourceFact = (): SaveNorthHillsSourceFactInput => ({
  sourceCode: "CR",
  factType: "note",
  factValue: "",
  factDate: "",
  rawText: "",
  confidence: "review",
  status: "staged",
  reviewNotes: "",
});

export const blankNorthHillsObservation = (): SaveNorthHillsOcrObservationInput => ({
  observationType: "entry_note",
  observationText: "",
  status: "staged",
});

export const blankSourcePersonRecordForm = (cemeteryId = ""): SaveSourcePersonRecordInput => ({
  cemeteryId,
  northHillsOcrEntryId: "",
  northHillsOcrSourceFactId: "",
  sourceName: "North Hills Genealogists Trinity OCR",
  sourceCode: "CR",
  sourceLabel: "",
  sourcePageNumber: null,
  sourceLocationText: "",
  recordType: "death_record",
  status: "unmatched",
  confidence: "review",
  firstName: "",
  middleName: "",
  lastName: "",
  maidenName: "",
  fullName: "",
  birthDate: "",
  birthDateText: "",
  deathDate: "",
  deathDateText: "",
  burialDate: "",
  burialDateText: "",
  funeralDate: "",
  funeralDateText: "",
  ageText: "",
  rawText: "",
  notes: "",
  reason: "Updated source-only person record.",
});

export function sourcePersonFormFromRecord(record: SourcePersonRecord): SaveSourcePersonRecordInput {
  return {
    cemeteryId: record.cemeteryId,
    northHillsOcrEntryId: record.northHillsOcrEntryId ?? "",
    northHillsOcrSourceFactId: record.northHillsOcrSourceFactId ?? "",
    sourceName: record.sourceName,
    sourceCode: record.sourceCode,
    sourceLabel: record.sourceLabel,
    sourcePageNumber: record.sourcePageNumber ?? null,
    sourceLocationText: record.sourceLocationText,
    recordType: record.recordType,
    status: record.status,
    confidence: record.confidence,
    firstName: record.firstName,
    middleName: record.middleName,
    lastName: record.lastName,
    maidenName: record.maidenName,
    fullName: record.fullName,
    birthDate: record.birthDate ?? "",
    birthDateText: record.birthDateText,
    deathDate: record.deathDate ?? "",
    deathDateText: record.deathDateText,
    burialDate: record.burialDate ?? "",
    burialDateText: record.burialDateText,
    funeralDate: record.funeralDate ?? "",
    funeralDateText: record.funeralDateText,
    ageText: record.ageText,
    rawText: record.rawText,
    notes: record.notes,
    reason: "Updated source-only person record.",
  };
}

export const sourcePersonRecordTitle = (record: SourcePersonRecord) =>
  `${record.fullName}. ${sourcePersonSourceLabels[record.sourceCode] ?? record.sourceCode}. ${sourcePersonStatusLabels[record.status] ?? record.status}.`;

export function deedSearchTerms(value: string) {
  return [
    ...new Set(
      value
        .toLowerCase()
        .split(/[\s,;|/]+/u)
        .map((term) => term.trim())
        .filter((term) => term.length >= 2),
    ),
  ].slice(0, 12);
}

export function uniqueFilled(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function deedCaseFormFromCase(investigation: DeedInvestigationCase): SaveDeedInvestigationCaseInput {
  return {
    cemeteryId: investigation.cemeteryId,
    caseNumber: investigation.caseNumber,
    status: investigation.status,
    subjectName: investigation.subjectName,
    requesterName: investigation.requesterName,
    requesterContact: investigation.requesterContact,
    plotReference: investigation.plotReference,
    requestSummary: investigation.requestSummary,
    familySummary: investigation.familySummary,
    findings: investigation.findings,
    councilDecision: investigation.councilDecision,
    affidavitStatus: investigation.affidavitStatus,
    outcome: investigation.outcome,
    openedAt: investigation.openedAt,
    closedAt: investigation.closedAt,
    reason: "Updated deed investigation case.",
  };
}

export function deedActionFormFromAction(action: DeedInvestigationAction): SaveDeedInvestigationActionInput {
  return {
    subjectName: action.subjectName,
    actionType: action.actionType,
    plotReference: action.plotReference,
    councilStatus: action.councilStatus,
    councilDecisionDate: action.councilDecisionDate,
    councilDocumentReference: action.councilDocumentReference,
    affidavitStatus: action.affidavitStatus,
    deedStatus: action.deedStatus,
    outcome: action.outcome,
    notes: action.notes,
    sortOrder: action.sortOrder,
    reason: "Updated deed investigation recommended action.",
  };
}

export const lookupRowTitle = (row: LookupRecord) => `${row.label}. ${row.isActive ? "Active" : "Inactive"}.`;

export const lookupUsageText = (row: LookupRecord) => `Used by ${row.usageCount} ${row.usageLabel || "records"}.`;

export function lookupCodeFromLabel(label: string, existingCodes: Set<string>) {
  const baseCode =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "_")
      .replace(/^_+|_+$/gu, "")
      .slice(0, 40) || "lookup_value";
  let code = baseCode;
  let suffix = 2;

  while (existingCodes.has(code)) {
    code = `${baseCode.slice(0, Math.max(1, 49 - String(suffix).length))}_${suffix}`;
    suffix += 1;
  }

  return code;
}

export function lookupDuplicateSortOrders(rows: LookupRecord[]) {
  const sortCounts = rows.reduce((counts, row) => counts.set(row.sortOrder, (counts.get(row.sortOrder) ?? 0) + 1), new Map<number, number>());
  return new Set([...sortCounts.entries()].filter(([, count]) => count > 1).map(([sortOrder]) => sortOrder));
}