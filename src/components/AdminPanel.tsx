import { type Dispatch, FormEvent, type SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowDown, ArrowUp, BookOpenText, FileSearch, FileText, History, Landmark, ListChecks, ShieldAlert, ShieldCheck, UserCheck, UserCog, UserPlus, UserX, X } from "lucide-react";
import {
  bulkAddNorthHillsEntryNote,
  bulkAssignGravesitesToLot,
  bulkMarkNorthHillsReviewed,
  bulkUpdateHeadstones,
  createAdminUser,
  createDeedInvestigationAction,
  createDeedInvestigationCase,
  createLookupRecord,
  createSourcePersonRecord,
  deleteSourcePersonRecord,
  deleteNorthHillsOcrEvidence,
  fetchAdminRoles,
  fetchAdminUsers,
  fetchCemeteryAdminRecords,
  fetchDeedInvestigationCases,
  fetchDeedRegistryReview,
  fetchLookupAdminRecords,
  fetchHeadstoneLookups,
  fetchNorthHillsOcrReview,
  fetchSourcePersonRecords,
  linkDeedInvestigationCaseEntry,
  promoteNorthHillsSourceFact,
  resolveAuth0User,
  reviewNorthHillsSourceFact,
  saveNorthHillsOcrEvidence,
  type SaveUserInput,
  updateNorthHillsOcrEntry,
  updateAdminUser,
  updateCemeteryText,
  updateDeedInvestigationAction,
  updateDeedInvestigationCase,
  updateLookupRecord,
  updateLotText,
  updateSectionText,
  updateSourcePersonRecord,
} from "../api/cemeteryApi";
import { defaultAuditFilters } from "./AdminEventDefaults";
import { AuditAdminTab, SystemEventsAdminTab } from "./AdminEventTabs";
import { DataQualityAdminTab } from "./DataQualityAdminTab";
import type {
  AppRole,
  AppRoleName,
  AppUser,
  AuditEventFilters,
  BulkEditResult,
  CemeteryAdminRecords,
  CemeteryTextRecord,
  DeedInvestigationAction,
  DeedInvestigationActionType,
  DeedInvestigationAffidavitStatus,
  DeedInvestigationCase,
  DeedInvestigationCouncilStatus,
  DeedInvestigationDeedStatus,
  DeedInvestigationStatus,
  DeedRegistryReview,
  DeedRegistryReviewEntry,
  DeedRegistryReviewFilters,
  HeadstoneLookups,
  LookupAdminRecords,
  LookupRecord,
  LotTextRecord,
  NorthHillsOcrReview,
  NorthHillsOcrEvidenceStatus,
  NorthHillsOcrObservation,
  NorthHillsOcrReviewEntry,
  NorthHillsOcrReviewFilters,
  NorthHillsSourceFact,
  NorthHillsSourceFactStatus,
  SaveNorthHillsOcrEntryInput,
  SaveNorthHillsOcrObservationInput,
  SaveNorthHillsSourceFactInput,
  SaveSourcePersonRecordInput,
  SaveDeedInvestigationActionInput,
  SaveDeedInvestigationCaseInput,
  SectionTextRecord,
  SourcePersonRecord,
  SourcePersonRecordConfidence,
  SourcePersonRecordFilters,
  SourcePersonRecordReview,
  SourcePersonRecordSourceCode,
  SourcePersonRecordStatus,
  SourcePersonRecordType,
  CurrentUser,
} from "../types";

type AdminPanelProps = {
  currentUser: CurrentUser;
  onClose: () => void;
};

type UserFormState = SaveUserInput & {
  id?: string;
};

type AdminTab = "users" | "records" | "quality" | "bulk" | "deeds" | "readings" | "sourcePeople" | "audit" | "lookups" | "system";
type NorthHillsEditForm = SaveNorthHillsOcrEntryInput & {
  surnamesText: string;
  parsedYearsText: string;
  parseNotesText: string;
};

const blankUser: UserFormState = {
  externalSubject: "",
  email: "",
  displayName: "",
  role: "reader",
  assignedCemeteryIds: [],
  isActive: true,
};

const roleLabels: Record<AppRoleName, string> = {
  reader: "Read-only",
  "power-user": "Power user",
  "cemetery-admin": "Cemetery admin",
  admin: "Admin",
};

const roleDescriptions: Record<AppRoleName, string> = {
  reader: "Read-only users can view map, gravesite, and burial information, but cannot see deed or owner information.",
  "power-user": "Power users can view deed and owner information and update existing records for their assigned cemetery.",
  "cemetery-admin": "Cemetery admins can administer their assigned cemetery and have read-only access to others.",
  admin: "Admins can manage users, add cemetery records, update records, and soft-delete records.",
};

function roleLabel(role: AppRoleName) {
  return roleLabels[role] ?? role;
}

function roleTitle(role: AppRole) {
  return `${roleLabel(role.name)}: ${role.description}`;
}

function userTitle(user: AppUser) {
  return `Edit ${user.displayName || user.email}. Role: ${roleLabel(user.role)}. Status: ${user.isActive ? "active" : "inactive"}.`;
}

function userFormFromUser(user: AppUser): UserFormState {
  return {
    id: user.id,
    externalSubject: user.externalSubject,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    assignedCemeteryIds: user.assignedCemeteryIds,
    isActive: user.isActive,
  };
}

function parseBulkIdentifiers(value: string) {
  return [...new Set(value.split(/[\s,;]+/u).map((identifier) => identifier.trim()).filter(Boolean))];
}

function bulkResultMessage(label: string, result: BulkEditResult) {
  const missing = result.notFound.length ? ` ${result.notFound.length} not found: ${result.notFound.slice(0, 6).join(", ")}${result.notFound.length > 6 ? ", ..." : ""}.` : "";
  return `${label}: updated ${result.updatedCount} of ${result.requestedCount} selected record${result.requestedCount === 1 ? "" : "s"}.${missing}`;
}

const emptyCemeteryRecords: CemeteryAdminRecords = {
  cemeteries: [],
  sections: [],
  lots: [],
};

const emptyHeadstoneLookups: HeadstoneLookups = {
  markerTypes: [],
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
  maintenanceIssueTypes: [],
  maintenanceActionTypes: [],
  maintenancePriorities: [],
  headstones: [],
};

const defaultDeedReviewFilters: DeedRegistryReviewFilters = {
  batchId: "",
  confidence: "",
  ownershipScope: "",
  q: "",
  limit: 100,
};

const defaultDeedCaseFilters = {
  q: "",
  status: "",
  limit: 25,
};

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

const blankDeedCaseForm = (): SaveDeedInvestigationCaseInput => ({
  cemeteryId: "",
  caseNumber: `DI-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`,
  status: "open",
  subjectName: "",
  requesterName: "",
  requesterContact: "",
  plotReference: "",
  requestSummary: "",
  familySummary: "",
  findings: "",
  councilDecision: "",
  affidavitStatus: "not_needed",
  outcome: "",
  openedAt: todayIsoDate(),
  closedAt: "",
  reason: "Updated deed investigation case.",
});

const blankDeedActionForm = (): SaveDeedInvestigationActionInput => ({
  subjectName: "",
  actionType: "issue_deed",
  plotReference: "",
  councilStatus: "recommended",
  councilDecisionDate: "",
  councilDocumentReference: "",
  affidavitStatus: "needed",
  deedStatus: "pending",
  outcome: "",
  notes: "",
  sortOrder: 100,
  reason: "Updated deed investigation recommended action.",
});

const emptyDeedRegistryReview: DeedRegistryReview = {
  batches: [],
  selectedBatchId: "",
  summary: [],
  comparison: null,
  removedOriginalEntries: [],
  entries: [],
};

const defaultNorthHillsReviewFilters: NorthHillsOcrReviewFilters = {
  batchId: "",
  confidence: "",
  status: "",
  section: "",
  sort: "review",
  q: "",
  limit: 100,
};

const defaultBulkReason = "Bulk cleanup from admin tools.";

const emptyNorthHillsOcrReview: NorthHillsOcrReview = {
  batches: [],
  selectedBatchId: "",
  summary: [],
  entries: [],
};

const defaultSourcePersonFilters: SourcePersonRecordFilters = {
  q: "",
  status: "",
  sourceCode: "",
  cemeteryId: "",
  limit: 50,
};

const emptySourcePersonReview: SourcePersonRecordReview = {
  cemeteries: [],
  records: [],
};

const emptyLookupAdminRecords: LookupAdminRecords = {
  tables: [],
  lookups: {},
};

const blankLookupRecord: LookupRecord = {
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

const alternateNamesText = (alternateNames: string[]) => alternateNames.join("\n");
const parseAlternateNames = (value: string) =>
  [...new Set(value.split(/\r?\n|,/u).map((item) => item.trim()).filter(Boolean))];
const cemeteryPickerLabel = (cemetery: CemeteryTextRecord) => cemetery.name;
const sectionPickerLabel = (section: SectionTextRecord) => `Section ${section.name}`;
const lotPickerLabel = (lot: LotTextRecord) => `Lot ${lot.lotId} - ${lot.name}`;
const formatAdminTimestamp = (value: string) => (value ? new Date(value).toLocaleString() : "Not recorded");
const scopeLabels: Record<string, string> = {
  grave_count_only: "Grave count only",
  multiple_lots: "Multiple lots",
  passage: "Passage",
  section_g_gravesite: "Section G gravesite",
  specific_graves: "Specific graves",
  unknown: "Unknown",
  whole_lot: "Whole lot",
};
const confidenceLabels: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  review: "Review",
};
const comparisonLabels: Record<string, string> = {
  added: "Added since Original 2017",
  changed: "Changed since Original 2017",
  unchanged: "Unchanged from Original 2017",
};
const investigationStatusLabels: Record<DeedInvestigationStatus, string> = {
  open: "Open",
  researching: "Researching",
  awaiting_family: "Awaiting family",
  awaiting_council: "Awaiting council",
  approved: "Approved",
  denied: "Denied",
  closed: "Closed",
};
const affidavitStatusLabels: Record<DeedInvestigationAffidavitStatus, string> = {
  not_needed: "Not needed",
  needed: "Needed",
  sent: "Sent",
  received: "Received",
  waived: "Waived",
};
const deedActionTypeLabels: Record<DeedInvestigationActionType, string> = {
  issue_deed: "Issue deed",
  replacement_deed: "Replacement deed",
  inter_ashes: "Inter ashes",
  approve_marker: "Approve marker",
  deny_request: "Deny request",
  document_only: "Document only",
  other: "Other",
};
const councilStatusLabels: Record<DeedInvestigationCouncilStatus, string> = {
  not_submitted: "Not submitted",
  recommended: "Recommended",
  submitted: "Submitted",
  approved: "Approved",
  denied: "Denied",
  not_required: "Not required",
};
const deedStatusLabels: Record<DeedInvestigationDeedStatus, string> = {
  not_started: "Not started",
  pending: "Pending",
  issued: "Issued",
  not_issued: "Not issued",
  not_applicable: "Not applicable",
};
const deedScopeLabel = (scope: string) => scopeLabels[scope] ?? scope;
const deedConfidenceLabel = (confidence: string) => confidenceLabels[confidence] ?? confidence;
const deedComparisonLabel = (status: string) => comparisonLabels[status] ?? status;
const formatList = (values: string[]) => (values.length ? values.join(", ") : "None");
const deedEntryTitle = (entry: DeedRegistryReviewEntry) =>
  `Row ${entry.sourceRowNumber}. ${entry.ownerDisplayName || "No owner"}. ${deedConfidenceLabel(entry.parseConfidence)} confidence.${entry.comparisonStatus ? ` ${deedComparisonLabel(entry.comparisonStatus)}.` : ""}`;
const readingEntryTitle = (entry: NorthHillsOcrReviewEntry) =>
  `Page ${entry.sourcePageNumber ?? entry.sourcePageIndex}. ${entry.nameText || "Unnamed reading"}. ${deedConfidenceLabel(entry.parseConfidence)} confidence. ${entry.candidateMatchCount} possible match${entry.candidateMatchCount === 1 ? "" : "es"}.`;
const evidenceStatusLabels: Record<NorthHillsOcrEvidenceStatus, string> = {
  linked: "Linked",
  rejected: "Rejected",
  needs_field_check: "Needs field check",
};
const sourceFactStatusLabels: Record<NorthHillsSourceFactStatus, string> = {
  staged: "Staged",
  reviewed: "Reviewed",
  promoted: "Promoted",
  rejected: "Rejected",
};
const sourceFactTypeLabels: Record<NorthHillsSourceFact["factType"], string> = {
  death_date: "Death date",
  middle_initial: "Middle initial",
  age_at_death: "Age at death",
  note: "Source note",
};
const observationTypeLabels: Record<NorthHillsOcrObservation["observationType"], string> = {
  plot_marker: "Plot marker observed",
  gap: "Gap observed",
  marker_observation: "Marker observation",
  entry_note: "Entry note",
};
const observationStatusLabels: Record<NorthHillsOcrObservation["status"], string> = {
  staged: "Staged",
  reviewed: "Reviewed",
  rejected: "Rejected",
};
const hasNorthHillsEvidenceStatus = (evidence: { status: NorthHillsOcrEvidenceStatus }[], status: NorthHillsOcrEvidenceStatus) =>
  evidence.some((item) => item.status === status);
const markerScopeOptions = ["", "single", "couple", "monolith", "unknown"];
const entryStatusOptions = ["staged", "reviewed", "promoted", "rejected"];
const sourcePersonSourceLabels: Record<SourcePersonRecordSourceCode, string> = {
  CR: "Church Records",
  CRG: "Church Records in German",
  FH: "Family history",
  SK: "SK",
  NOTE: "Note",
  OTHER: "Other",
};
const sourcePersonTypeLabels: Record<SourcePersonRecordType, string> = {
  death_record: "Death record",
  burial_record: "Burial record",
  funeral_record: "Funeral record",
  church_record: "Church record",
  family_history: "Family history",
  other: "Other",
};
const sourcePersonStatusLabels: Record<SourcePersonRecordStatus, string> = {
  unmatched: "Unmatched",
  candidate_match: "Candidate match",
  linked: "Linked",
  rejected: "Rejected",
};
const sourcePersonConfidenceLabels: Record<SourcePersonRecordConfidence, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  review: "Review",
};
const sourcePersonSourceOptions = Object.keys(sourcePersonSourceLabels) as SourcePersonRecordSourceCode[];
const sourcePersonTypeOptions = Object.keys(sourcePersonTypeLabels) as SourcePersonRecordType[];
const sourcePersonStatusOptions = Object.keys(sourcePersonStatusLabels) as SourcePersonRecordStatus[];
const sourcePersonConfidenceOptions = Object.keys(sourcePersonConfidenceLabels) as SourcePersonRecordConfidence[];

function splitAdminList(value: string) {
  return [...new Set(value.split(/[\n,;]+/u).map((item) => item.trim()).filter(Boolean))];
}

function splitAdminYears(value: string) {
  return [...new Set(value.split(/[\n,;]+/u).map((item) => Number.parseInt(item.trim(), 10)).filter((item) => Number.isFinite(item)))].sort((left, right) => left - right);
}

function northHillsEditFormFromEntry(entry: NorthHillsOcrReviewEntry): NorthHillsEditForm {
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

function northHillsEditPayload(form: NorthHillsEditForm): SaveNorthHillsOcrEntryInput {
  return {
    ...form,
    surnames: splitAdminList(form.surnamesText),
    parsedYears: splitAdminYears(form.parsedYearsText),
    parseNotes: splitAdminList(form.parseNotesText),
    sourceFacts: form.sourceFacts.filter((fact) => fact.factValue.trim()),
    observations: form.observations.filter((observation) => observation.observationText.trim()),
  };
}

const blankNorthHillsSourceFact = (): SaveNorthHillsSourceFactInput => ({
  sourceCode: "CR",
  factType: "note",
  factValue: "",
  factDate: "",
  rawText: "",
  confidence: "review",
  status: "staged",
  reviewNotes: "",
});

const blankNorthHillsObservation = (): SaveNorthHillsOcrObservationInput => ({
  observationType: "entry_note",
  observationText: "",
  status: "staged",
});

const blankSourcePersonRecordForm = (cemeteryId = ""): SaveSourcePersonRecordInput => ({
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

function sourcePersonFormFromRecord(record: SourcePersonRecord): SaveSourcePersonRecordInput {
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

const sourcePersonRecordTitle = (record: SourcePersonRecord) =>
  `${record.fullName}. ${sourcePersonSourceLabels[record.sourceCode] ?? record.sourceCode}. ${sourcePersonStatusLabels[record.status] ?? record.status}.`;

function deedSearchTerms(value: string) {
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

function uniqueFilled(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function deedCaseFormFromCase(investigation: DeedInvestigationCase): SaveDeedInvestigationCaseInput {
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

function deedActionFormFromAction(action: DeedInvestigationAction): SaveDeedInvestigationActionInput {
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
const lookupRowTitle = (row: LookupRecord) => `${row.label}. ${row.isActive ? "Active" : "Inactive"}.`;
const lookupUsageText = (row: LookupRecord) => `Used by ${row.usageCount} ${row.usageLabel || "records"}.`;

function lookupCodeFromLabel(label: string, existingCodes: Set<string>) {
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

function lookupDuplicateSortOrders(rows: LookupRecord[]) {
  const sortCounts = rows.reduce((counts, row) => counts.set(row.sortOrder, (counts.get(row.sortOrder) ?? 0) + 1), new Map<number, number>());
  return new Set([...sortCounts.entries()].filter(([, count]) => count > 1).map(([sortOrder]) => sortOrder));
}

type DeedsAdminTabProps = {
  deedCaseFilters: typeof defaultDeedCaseFilters;
  setDeedCaseFilters: Dispatch<SetStateAction<typeof defaultDeedCaseFilters>>;
  isLoadingDeedCases: boolean;
  loadDeedCases: () => Promise<void>;
  startNewDeedCase: () => void;
  deedCases: DeedInvestigationCase[];
  selectedDeedCaseId: string;
  selectDeedCase: (investigation: DeedInvestigationCase) => void;
  deedCaseForm: SaveDeedInvestigationCaseInput;
  setDeedCaseForm: Dispatch<SetStateAction<SaveDeedInvestigationCaseInput>>;
  selectedDeedCase: DeedInvestigationCase | undefined;
  savingDeedCaseKey: string | undefined;
  saveDeedCase: (event: FormEvent<HTMLFormElement>) => void;
  startNewDeedAction: () => void;
  selectedDeedActionId: string;
  selectDeedAction: (action: DeedInvestigationAction) => void;
  deedActionForm: SaveDeedInvestigationActionInput;
  setDeedActionForm: Dispatch<SetStateAction<SaveDeedInvestigationActionInput>>;
  savingDeedActionKey: string | undefined;
  saveDeedAction: (event: FormEvent<HTMLFormElement>) => void;
  deedReviewFilters: DeedRegistryReviewFilters;
  updateDeedReviewFilter: (patch: Partial<DeedRegistryReviewFilters>) => void;
  deedRegistryReview: DeedRegistryReview;
  applyDeedReviewFilters: (event: FormEvent<HTMLFormElement>) => void;
  isLoadingDeedReview: boolean;
  setDeedReviewFilters: Dispatch<SetStateAction<DeedRegistryReviewFilters>>;
  loadDeedRegistryReview: (filters?: DeedRegistryReviewFilters) => Promise<void>;
  selectedDeedBatch: DeedRegistryReview["batches"][number] | undefined;
  deedResearchTerms: string[];
  deedInvestigationOwners: string[];
  deedInvestigationLots: string[];
  deedOnFileCount: number;
  deedRegisterOnFileCount: number;
  deedInvestigationNoteCount: number;
  attachEntryToSelectedDeedCase: (entry: DeedRegistryReviewEntry) => Promise<void>;
  removedOriginalDeedEntries: DeedRegistryReview["removedOriginalEntries"];
};

function DeedsAdminTab({
  deedCaseFilters,
  setDeedCaseFilters,
  isLoadingDeedCases,
  loadDeedCases,
  startNewDeedCase,
  deedCases,
  selectedDeedCaseId,
  selectDeedCase,
  deedCaseForm,
  setDeedCaseForm,
  selectedDeedCase,
  savingDeedCaseKey,
  saveDeedCase,
  startNewDeedAction,
  selectedDeedActionId,
  selectDeedAction,
  deedActionForm,
  setDeedActionForm,
  savingDeedActionKey,
  saveDeedAction,
  deedReviewFilters,
  updateDeedReviewFilter,
  deedRegistryReview,
  applyDeedReviewFilters,
  isLoadingDeedReview,
  setDeedReviewFilters,
  loadDeedRegistryReview,
  selectedDeedBatch,
  deedResearchTerms,
  deedInvestigationOwners,
  deedInvestigationLots,
  deedOnFileCount,
  deedRegisterOnFileCount,
  deedInvestigationNoteCount,
  attachEntryToSelectedDeedCase,
  removedOriginalDeedEntries,
}: DeedsAdminTabProps) {
  return (
        <>
          <section className="admin-section">
            <div className="section-title">
              <FileSearch size={17} aria-hidden="true" />
              <h3>Deed Evidence</h3>
            </div>

            <section className="deed-case-workbench" aria-label="Deed investigation cases">
              <div className="deed-case-toolbar">
                <label>
                  Case search
                  <input
                    value={deedCaseFilters.q}
                    onChange={(event) => setDeedCaseFilters((current) => ({ ...current, q: event.target.value }))}
                    placeholder="Case, family, plot, findings"
                    title="Search deed investigation cases by case number, subject, requester, plot, family summary, or findings."
                  />
                </label>
                <label>
                  Case status
                  <select
                    value={deedCaseFilters.status}
                    onChange={(event) => setDeedCaseFilters((current) => ({ ...current, status: event.target.value }))}
                    title="Filter deed investigation cases by status."
                  >
                    <option value="">All statuses</option>
                    {Object.entries(investigationStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="admin-form-actions deed-case-actions">
                  <button type="button" onClick={() => void loadDeedCases()} disabled={isLoadingDeedCases} title="Load matching deed investigation cases.">
                    {isLoadingDeedCases ? "Loading..." : "Find cases"}
                  </button>
                  <button type="button" className="secondary-button" onClick={startNewDeedCase} title="Start a new deed investigation case.">
                    New case
                  </button>
                </div>
              </div>

              {deedCases.length ? (
                <div className="deed-case-list" aria-label="Recent deed investigation cases">
                  {deedCases.slice(0, 6).map((investigation) => (
                    <button
                      key={investigation.id}
                      type="button"
                      className={`deed-case-card ${selectedDeedCaseId === investigation.id ? "is-selected" : ""}`}
                      onClick={() => selectDeedCase(investigation)}
                      title={`${investigation.caseNumber}: ${investigation.subjectName}. ${investigationStatusLabels[investigation.status]}.`}
                    >
                      <strong>{investigation.caseNumber}</strong>
                      <span>{investigation.subjectName}</span>
                      <small>{investigation.plotReference || investigationStatusLabels[investigation.status]} · {investigation.linkedEntryCount} evidence row{investigation.linkedEntryCount === 1 ? "" : "s"}</small>
                    </button>
                  ))}
                </div>
              ) : null}

              <form className="deed-case-form" onSubmit={saveDeedCase}>
                <label>
                  Case number
                  <input
                    value={deedCaseForm.caseNumber}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, caseNumber: event.target.value }))}
                    required
                    title="Short unique identifier for this investigation."
                  />
                </label>
                <label>
                  Subject
                  <input
                    value={deedCaseForm.subjectName}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, subjectName: event.target.value }))}
                    required
                    placeholder="Elaine Krepps Wasko"
                    title="Person or family at the center of this deed investigation."
                  />
                </label>
                <label>
                  Plot
                  <input
                    value={deedCaseForm.plotReference}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, plotReference: event.target.value }))}
                    placeholder="61 OC"
                    title="Best-known plot, lot, section, or gravesite reference."
                  />
                </label>
                <label>
                  Status
                  <select
                    value={deedCaseForm.status}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, status: event.target.value as DeedInvestigationStatus }))}
                    title="Current investigation status."
                  >
                    {Object.entries(investigationStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Affidavit
                  <select
                    value={deedCaseForm.affidavitStatus}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, affidavitStatus: event.target.value as DeedInvestigationAffidavitStatus }))}
                    title="Lost deed affidavit state, if one is needed."
                  >
                    {Object.entries(affidavitStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Requester
                  <input
                    value={deedCaseForm.requesterName}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, requesterName: event.target.value }))}
                    placeholder="Barb Porti"
                    title="Person asking for the deed investigation."
                  />
                </label>
                <label className="deed-case-wide">
                  Request summary
                  <textarea
                    value={deedCaseForm.requestSummary}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, requestSummary: event.target.value }))}
                    rows={3}
                    title="What the family or pastor asked the cemetery to determine."
                  />
                </label>
                <label className="deed-case-wide">
                  Family / claimant notes
                  <textarea
                    value={deedCaseForm.familySummary}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, familySummary: event.target.value }))}
                    rows={3}
                    title="Living relatives, deceased relatives, possible deed holders, obituary notes, and claimant context."
                  />
                </label>
                <label className="deed-case-wide">
                  Findings and outcome
                  <textarea
                    value={deedCaseForm.findings}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, findings: event.target.value }))}
                    rows={3}
                    title="Evidence summary, recommendation, council decision, and final outcome."
                  />
                </label>
                {selectedDeedCase?.linkedEntries.length ? (
                  <div className="deed-case-linked deed-case-wide" aria-label="Linked deed evidence">
                    <strong>Linked evidence</strong>
                    {selectedDeedCase.linkedEntries.map((entry) => (
                      <span key={entry.id}>Row {entry.sourceRowNumber}: {entry.ownerDisplayName || "No owner"} {entry.rawLotText ? `(${entry.rawLotText})` : ""}</span>
                    ))}
                  </div>
                ) : null}
                <div className="admin-form-actions deed-case-save-actions">
                  <button type="submit" disabled={Boolean(savingDeedCaseKey) || !deedCaseForm.caseNumber.trim() || !deedCaseForm.subjectName.trim()} title="Save this deed investigation case.">
                    {savingDeedCaseKey === (selectedDeedCaseId || "new") ? "Saving..." : selectedDeedCaseId ? "Save case" : "Create case"}
                  </button>
                </div>
              </form>

              <section className="deed-action-workbench" aria-label="Recommended actions">
                <div className="deed-action-heading">
                  <strong>Recommended actions</strong>
                  <button type="button" className="secondary-button" onClick={startNewDeedAction} disabled={!selectedDeedCaseId} title="Add another recommended action to this investigation.">
                    New action
                  </button>
                </div>
                {selectedDeedCase?.recommendedActions.length ? (
                  <div className="deed-action-list">
                    {selectedDeedCase.recommendedActions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        className={`deed-action-card ${selectedDeedActionId === action.id ? "is-selected" : ""}`}
                        onClick={() => selectDeedAction(action)}
                        title={`${action.subjectName}. ${deedActionTypeLabels[action.actionType]}. Council: ${councilStatusLabels[action.councilStatus]}.`}
                      >
                        <strong>{action.subjectName}</strong>
                        <span>{deedActionTypeLabels[action.actionType]} · {action.plotReference || "No plot"}</span>
                        <small>
                          Council {councilStatusLabels[action.councilStatus]}
                          {action.councilDecisionDate ? ` ${action.councilDecisionDate}` : ""} · Affidavit {affidavitStatusLabels[action.affidavitStatus]} · Deed {deedStatusLabels[action.deedStatus]}
                        </small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="record-editor-empty">No recommended actions have been added to this case yet.</p>
                )}

                <form className="deed-action-form" onSubmit={saveDeedAction}>
                  <label>
                    Person
                    <input
                      value={deedActionForm.subjectName}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, subjectName: event.target.value }))}
                      required
                      placeholder="Elaine Krepps Wasko"
                      title="Person or party this recommended action is for."
                    />
                  </label>
                  <label>
                    Action
                    <select
                      value={deedActionForm.actionType}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, actionType: event.target.value as DeedInvestigationActionType }))}
                      title="Recommended action type."
                    >
                      {Object.entries(deedActionTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Plot / gravesite
                    <input
                      value={deedActionForm.plotReference}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, plotReference: event.target.value }))}
                      placeholder="61 OC grave 4"
                      title="Plot, gravesite, or location this action concerns."
                    />
                  </label>
                  <label>
                    Council
                    <select
                      value={deedActionForm.councilStatus}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, councilStatus: event.target.value as DeedInvestigationCouncilStatus }))}
                      title="Council approval status for this action."
                    >
                      {Object.entries(councilStatusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Decision date
                    <input
                      type="date"
                      value={deedActionForm.councilDecisionDate}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, councilDecisionDate: event.target.value }))}
                      title="Date Council made or recorded its decision for this action."
                    />
                  </label>
                  <label>
                    Minutes / reference
                    <input
                      value={deedActionForm.councilDocumentReference}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, councilDocumentReference: event.target.value }))}
                      placeholder="Council minutes 2026-03-17"
                      title="Council minutes, agenda item, email approval, or other decision reference."
                    />
                  </label>
                  <label>
                    Affidavit
                    <select
                      value={deedActionForm.affidavitStatus}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, affidavitStatus: event.target.value as DeedInvestigationAffidavitStatus }))}
                      title="Lost deed affidavit status for this action."
                    >
                      {Object.entries(affidavitStatusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Deed / outcome
                    <select
                      value={deedActionForm.deedStatus}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, deedStatus: event.target.value as DeedInvestigationDeedStatus }))}
                      title="Deed or action outcome status."
                    >
                      {Object.entries(deedStatusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="deed-action-wide">
                    Notes
                    <textarea
                      value={deedActionForm.notes}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, notes: event.target.value }))}
                      rows={2}
                      title="Recommendation notes, restrictions, or conditions for this action."
                    />
                  </label>
                  <label className="deed-action-wide">
                    Final outcome
                    <textarea
                      value={deedActionForm.outcome}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, outcome: event.target.value }))}
                      rows={2}
                      title="Final result once the recommended action is resolved."
                    />
                  </label>
                  <div className="admin-form-actions deed-action-save-actions">
                    <button
                      type="submit"
                      disabled={!selectedDeedCaseId || Boolean(savingDeedActionKey) || !deedActionForm.subjectName.trim()}
                      title="Save this recommended action."
                    >
                      {savingDeedActionKey === (selectedDeedActionId || "new") ? "Saving..." : selectedDeedActionId ? "Save action" : "Add action"}
                    </button>
                  </div>
                </form>
              </section>
            </section>

            <form className="deed-review-filter-form" onSubmit={applyDeedReviewFilters}>
              <label>
                Import batch
                <select
                  value={deedReviewFilters.batchId ?? ""}
                  onChange={(event) => updateDeedReviewFilter({ batchId: event.target.value })}
                  title="Choose the staged deed registry import batch to review."
                >
                  <option value="">Latest batch</option>
                  {deedRegistryReview.batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.worksheetName} - {formatAdminTimestamp(batch.createdAt)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Confidence
                <select
                  value={deedReviewFilters.confidence ?? ""}
                  onChange={(event) => updateDeedReviewFilter({ confidence: event.target.value })}
                  title="Filter rows by parser confidence."
                >
                  <option value="">All confidence levels</option>
                  {Object.entries(confidenceLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Evidence type
                <select
                  value={deedReviewFilters.ownershipScope ?? ""}
                  onChange={(event) => updateDeedReviewFilter({ ownershipScope: event.target.value })}
                  title="Filter rows by the staged ownership or allocation interpretation."
                >
                  <option value="">All evidence types</option>
                  {Object.entries(scopeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Search
                <input
                  value={deedReviewFilters.q ?? ""}
                  onChange={(event) => updateDeedReviewFilter({ q: event.target.value })}
                  placeholder="Family names, plot, deed, remarks"
                  title="Search staged names, plot and lot text, deed flags, remarks, parsed identifiers, and related Investigated notes."
                />
              </label>
              <label>
                Limit
                <select
                  value={deedReviewFilters.limit ?? 100}
                  onChange={(event) => updateDeedReviewFilter({ limit: Number(event.target.value) })}
                  title="Limit the number of evidence rows returned."
                >
                  <option value={50}>50 rows</option>
                  <option value={100}>100 rows</option>
                  <option value={250}>250 rows</option>
                </select>
              </label>
              <div className="admin-form-actions deed-review-filter-actions">
                <button type="submit" disabled={isLoadingDeedReview} title="Apply deed evidence filters.">
                  {isLoadingDeedReview ? "Loading..." : "Apply filters"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setDeedReviewFilters(defaultDeedReviewFilters);
                    void loadDeedRegistryReview(defaultDeedReviewFilters);
                  }}
                  title="Clear deed evidence filters and reload the latest import batch."
                >
                  Clear
                </button>
              </div>
            </form>

            {isLoadingDeedReview ? <div className="admin-message" role="status">Loading deed evidence...</div> : null}

            {selectedDeedBatch ? (
              <article className="deed-batch-summary" title="Summary of the selected staged import batch.">
                <div>
                  <strong>{selectedDeedBatch.sourceName}</strong>
                  <small>{selectedDeedBatch.cemeteryName} · {selectedDeedBatch.worksheetName}</small>
                </div>
                <dl>
                  <div>
                    <dt>Rows</dt>
                    <dd>{selectedDeedBatch.entryCount}</dd>
                  </div>
                  <div>
                    <dt>Review</dt>
                    <dd>{selectedDeedBatch.reviewCount}</dd>
                  </div>
                  <div>
                    <dt>Low</dt>
                    <dd>{selectedDeedBatch.lowConfidenceCount}</dd>
                  </div>
                  <div>
                    <dt>Imported</dt>
                    <dd>{formatAdminTimestamp(selectedDeedBatch.createdAt)}</dd>
                  </div>
                </dl>
                {selectedDeedBatch.notes ? <p>{selectedDeedBatch.notes}</p> : null}
              </article>
            ) : null}

            {deedResearchTerms.length ? (
              <section className="deed-investigation-summary" aria-label="Deed investigation search">
                <header>
                  <strong>Investigation</strong>
                  <small>{deedRegistryReview.entries.length} matching row{deedRegistryReview.entries.length === 1 ? "" : "s"}</small>
                </header>
                <div className="deed-investigation-terms" aria-label="Search terms">
                  {deedResearchTerms.map((term) => (
                    <span key={term}>{term}</span>
                  ))}
                </div>
                <dl>
                  <div title="Distinct owner names returned by this deed evidence search.">
                    <dt>Names</dt>
                    <dd>{deedInvestigationOwners.length ? deedInvestigationOwners.join(", ") : "None"}</dd>
                  </div>
                  <div title="Lot, plot, and raw worksheet location references returned by this search.">
                    <dt>Lots / plots</dt>
                    <dd>{deedInvestigationLots.length ? deedInvestigationLots.join(", ") : "None"}</dd>
                  </div>
                  <div title="Rows that explicitly indicate a deed or deed register entry is on file.">
                    <dt>Deed flags</dt>
                    <dd>{deedOnFileCount} deed, {deedRegisterOnFileCount} register</dd>
                  </div>
                  <div title="Related notes pulled from the latest Investigated worksheet.">
                    <dt>Investigated notes</dt>
                    <dd>{deedInvestigationNoteCount}</dd>
                  </div>
                </dl>
              </section>
            ) : null}

            {deedRegistryReview.summary.length ? (
              <div className="deed-summary-grid" aria-label="Deed evidence summary">
                {deedRegistryReview.summary.map((item) => (
                  <article key={`${item.ownershipScope}:${item.parseConfidence}`} title={`${deedScopeLabel(item.ownershipScope)} rows with ${deedConfidenceLabel(item.parseConfidence)} confidence.`}>
                    <strong>{item.count}</strong>
                    <span>{deedScopeLabel(item.ownershipScope)}</span>
                    <small>{deedConfidenceLabel(item.parseConfidence)}</small>
                  </article>
                ))}
              </div>
            ) : null}

            {deedRegistryReview.comparison ? (
              <section className="deed-comparison-summary" aria-label="Original 2017 comparison">
                <header>
                  <strong>Compared with Original 2017</strong>
                  <small>{deedRegistryReview.comparison.originalBatchLabel}</small>
                </header>
                <dl>
                  <div title="Rows in this selected batch that do not have a matching owner row in Original 2017.">
                    <dt>Added</dt>
                    <dd>{deedRegistryReview.comparison.addedCount}</dd>
                  </div>
                  <div title="Rows with a matching Original 2017 owner but changed lot_id candidate, section, remarks, or deed flags.">
                    <dt>Changed</dt>
                    <dd>{deedRegistryReview.comparison.changedCount}</dd>
                  </div>
                  <div title="Rows that match the Original 2017 owner and staged values.">
                    <dt>Unchanged</dt>
                    <dd>{deedRegistryReview.comparison.unchangedCount}</dd>
                  </div>
                  <div title="Original 2017 rows whose owner does not appear in the selected batch.">
                    <dt>Removed</dt>
                    <dd>{deedRegistryReview.comparison.removedCount}</dd>
                  </div>
                </dl>
              </section>
            ) : selectedDeedBatch?.worksheetName === "Updated 2022" ? (
              <p className="record-editor-empty">Import the `Original 2017` worksheet to compare this updated registry with the original baseline.</p>
            ) : null}

            <div className="deed-entry-list" role="table" aria-label="Staged deed registry evidence">
              {deedRegistryReview.entries.length === 0 && !isLoadingDeedReview ? <p className="record-editor-empty">No deed evidence rows match these filters.</p> : null}
              {deedRegistryReview.entries.map((entry) => (
                <article key={entry.id} className={`deed-entry-row confidence-${entry.parseConfidence} comparison-${entry.comparisonStatus || "none"}`} title={deedEntryTitle(entry)}>
                  <header>
                    <span>
                      <strong>Row {entry.sourceRowNumber}</strong>
                      <small>{entry.rowType === "investigation_note" ? "Investigation note" : "Owner record"}</small>
                    </span>
                    <span>
                      <strong>{entry.ownerDisplayName || "No owner"}</strong>
                      <small>{deedConfidenceLabel(entry.parseConfidence)}</small>
                    </span>
                    <span>
                      <strong>{deedScopeLabel(entry.ownershipScope)}</strong>
                      <small>{entry.allocationCount} allocation{entry.allocationCount === 1 ? "" : "s"}</small>
                    </span>
                    {entry.comparisonStatus ? (
                      <span>
                        <strong>{deedComparisonLabel(entry.comparisonStatus)}</strong>
                        <small>{entry.originalSourceRowNumber ? `Original row ${entry.originalSourceRowNumber}` : "No original row match"}</small>
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="secondary-button deed-entry-link-button"
                      onClick={() => void attachEntryToSelectedDeedCase(entry)}
                      disabled={savingDeedCaseKey === `${selectedDeedCaseId}:${entry.id}`}
                      title={selectedDeedCaseId ? `Attach row ${entry.sourceRowNumber} to the selected investigation case.` : "Select or create an investigation case before attaching evidence."}
                    >
                      {savingDeedCaseKey === `${selectedDeedCaseId}:${entry.id}` ? "Linking..." : "Attach"}
                    </button>
                  </header>
                  <dl className="deed-entry-fields">
                    <div title="Raw lot or plot text from the worksheet.">
                      <dt>Lot num / lot_id candidate</dt>
                      <dd>{entry.rawLotText || "None"}</dd>
                    </div>
                    <div title="Raw section text from the worksheet.">
                      <dt>Raw section</dt>
                      <dd>{entry.rawSectionText || "None"}</dd>
                    </div>
                    <div title="Parsed lot numbers staged from this row.">
                      <dt>Lots</dt>
                      <dd>{formatList(entry.parsedLotNumbers)}</dd>
                    </div>
                    <div title="Parsed gravesite numbers staged from this row.">
                      <dt>Graves</dt>
                      <dd>{formatList(entry.parsedGraveNumbers)}</dd>
                    </div>
                    <div title="Whether a deed was found in the source worksheet.">
                      <dt>Deed</dt>
                      <dd>{entry.deedOnFile || "Unknown"}</dd>
                    </div>
                    <div title="Whether a deed register entry was found in the source worksheet.">
                      <dt>Register</dt>
                      <dd>{entry.deedRegisterOnFile || "Unknown"}</dd>
                    </div>
                  </dl>
                  {entry.rawRemarks ? <p className="deed-entry-remarks">{entry.rawRemarks}</p> : null}
                  {entry.comparisonStatus === "changed" ? (
                    <section className="deed-comparison-detail" aria-label="Original 2017 values">
                      <h4>Original 2017 values</h4>
                      <dl>
                        <div>
                          <dt>Lot num / lot_id candidate</dt>
                          <dd>{entry.originalRawLotText || "None"}</dd>
                        </div>
                        <div>
                          <dt>Section</dt>
                          <dd>{entry.originalRawSectionText || "None"}</dd>
                        </div>
                        <div>
                          <dt>Remarks</dt>
                          <dd>{entry.originalRawRemarks || "None"}</dd>
                        </div>
                      </dl>
                    </section>
                  ) : null}
                  {entry.parseNotes.length ? (
                    <ul className="deed-entry-notes" aria-label="Parser notes">
                      {entry.parseNotes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  ) : null}
                  {entry.relatedInvestigationNotes.length ? (
                    <section className="deed-investigation-links" aria-label="Related investigation notes">
                      <h4>Related investigation notes</h4>
                      {entry.relatedInvestigationNotes.map((note) => (
                        <p key={`${note.sourceRowNumber}:${note.rawRemarks}`}>
                          <strong>Investigated row {note.sourceRowNumber}:</strong> {note.rawRemarks}
                        </p>
                      ))}
                    </section>
                  ) : null}
                </article>
              ))}
            </div>

            {removedOriginalDeedEntries.length ? (
              <section className="deed-removed-list" aria-label="Original 2017 rows missing from selected batch">
                <h4>Original 2017 rows not found in selected batch</h4>
                {removedOriginalDeedEntries.map((entry) => (
                  <article key={entry.id}>
                    <strong>Row {entry.sourceRowNumber}: {entry.ownerDisplayName || "No owner"}</strong>
                    <span>Lot num / lot_id candidate: {entry.rawLotText || formatList(entry.parsedLotNumbers)}</span>
                    {entry.rawRemarks ? <p>{entry.rawRemarks}</p> : null}
                  </article>
                ))}
              </section>
            ) : null}
          </section>
        </>
  );
}

export function AdminPanel({ currentUser, onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>(currentUser.permissions.canManageUsers ? "users" : "records");
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [auditSeedFilters, setAuditSeedFilters] = useState<AuditEventFilters>();
  const [deedRegistryReview, setDeedRegistryReview] = useState<DeedRegistryReview>(emptyDeedRegistryReview);
  const [deedReviewFilters, setDeedReviewFilters] = useState<DeedRegistryReviewFilters>(defaultDeedReviewFilters);
  const [deedCases, setDeedCases] = useState<DeedInvestigationCase[]>([]);
  const [deedCaseFilters, setDeedCaseFilters] = useState(defaultDeedCaseFilters);
  const [selectedDeedCaseId, setSelectedDeedCaseId] = useState("");
  const [deedCaseForm, setDeedCaseForm] = useState<SaveDeedInvestigationCaseInput>(() => blankDeedCaseForm());
  const [selectedDeedActionId, setSelectedDeedActionId] = useState("");
  const [deedActionForm, setDeedActionForm] = useState<SaveDeedInvestigationActionInput>(() => blankDeedActionForm());
  const [northHillsOcrReview, setNorthHillsOcrReview] = useState<NorthHillsOcrReview>(emptyNorthHillsOcrReview);
  const [northHillsReviewFilters, setNorthHillsReviewFilters] = useState<NorthHillsOcrReviewFilters>(defaultNorthHillsReviewFilters);
  const [editingNorthHillsEntryId, setEditingNorthHillsEntryId] = useState("");
  const [northHillsEntryForm, setNorthHillsEntryForm] = useState<NorthHillsEditForm | null>(null);
  const [selectedNorthHillsEntryIds, setSelectedNorthHillsEntryIds] = useState<Set<string>>(() => new Set());
  const [sourcePersonReview, setSourcePersonReview] = useState<SourcePersonRecordReview>(emptySourcePersonReview);
  const [sourcePersonFilters, setSourcePersonFilters] = useState<SourcePersonRecordFilters>(defaultSourcePersonFilters);
  const [selectedSourcePersonRecordId, setSelectedSourcePersonRecordId] = useState("");
  const [sourcePersonForm, setSourcePersonForm] = useState<SaveSourcePersonRecordInput>(() => blankSourcePersonRecordForm());
  const [lookupRecords, setLookupRecords] = useState<LookupAdminRecords>(emptyLookupAdminRecords);
  const [headstoneLookups, setHeadstoneLookups] = useState<HeadstoneLookups>(emptyHeadstoneLookups);
  const [selectedLookupTable, setSelectedLookupTable] = useState("");
  const [showInactiveLookups, setShowInactiveLookups] = useState(false);
  const [newLookupRecord, setNewLookupRecord] = useState<LookupRecord>(blankLookupRecord);
  const [cemeteryRecords, setCemeteryRecords] = useState<CemeteryAdminRecords>(emptyCemeteryRecords);
  const [form, setForm] = useState<UserFormState>(blankUser);
  const [selectedCemeteryId, setSelectedCemeteryId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedLotId, setSelectedLotId] = useState("");
  const [cemeteryPickerValue, setCemeteryPickerValue] = useState("");
  const [sectionPickerValue, setSectionPickerValue] = useState("");
  const [lotPickerValue, setLotPickerValue] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDeedReview, setIsLoadingDeedReview] = useState(false);
  const [isLoadingDeedCases, setIsLoadingDeedCases] = useState(false);
  const [isLoadingNorthHillsReview, setIsLoadingNorthHillsReview] = useState(false);
  const [isLoadingSourcePersonRecords, setIsLoadingSourcePersonRecords] = useState(false);
  const [isLoadingLookups, setIsLoadingLookups] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResolvingAuth0User, setIsResolvingAuth0User] = useState(false);
  const [togglingUserIds, setTogglingUserIds] = useState<Set<string>>(() => new Set());
  const [savingRecordKey, setSavingRecordKey] = useState<string>();
  const [savingLookupKey, setSavingLookupKey] = useState<string>();
  const [savingEvidenceKey, setSavingEvidenceKey] = useState<string>();
  const [savingSourcePersonKey, setSavingSourcePersonKey] = useState<string>();
  const [savingDeedCaseKey, setSavingDeedCaseKey] = useState<string>();
  const [savingDeedActionKey, setSavingDeedActionKey] = useState<string>();
  const [savingBulkKey, setSavingBulkKey] = useState<string>();
  const [bulkMarkerIdentifiers, setBulkMarkerIdentifiers] = useState("");
  const [bulkMarkerTypeId, setBulkMarkerTypeId] = useState("");
  const [bulkMarkerMaterialId, setBulkMarkerMaterialId] = useState("");
  const [bulkMarkerConditionId, setBulkMarkerConditionId] = useState("");
  const [bulkGravesiteIdentifiers, setBulkGravesiteIdentifiers] = useState("");
  const [bulkLotId, setBulkLotId] = useState("");
  const [bulkNorthHillsNote, setBulkNorthHillsNote] = useState("");
  const [bulkReason, setBulkReason] = useState(defaultBulkReason);
  const [recentlyMovedLookupIds, setRecentlyMovedLookupIds] = useState<Set<string>>(() => new Set());
  const movedLookupTimeoutRef = useRef<number | undefined>(undefined);

  const roleOptions = useMemo(() => roles.map((role) => role.name), [roles]);
  const selectedCemetery = useMemo(
    () => cemeteryRecords.cemeteries.find((cemetery) => cemetery.id === selectedCemeteryId),
    [cemeteryRecords.cemeteries, selectedCemeteryId],
  );
  const sectionsForSelectedCemetery = useMemo(
    () => cemeteryRecords.sections.filter((section) => section.cemeteryId === selectedCemeteryId),
    [cemeteryRecords.sections, selectedCemeteryId],
  );
  const selectedSection = useMemo(
    () => sectionsForSelectedCemetery.find((section) => section.id === selectedSectionId),
    [sectionsForSelectedCemetery, selectedSectionId],
  );
  const lotsForSelectedSection = useMemo(
    () => cemeteryRecords.lots.filter((lot) => lot.cemeteryId === selectedCemeteryId && lot.sectionId === selectedSection?.sectionId),
    [cemeteryRecords.lots, selectedCemeteryId, selectedSection?.sectionId],
  );
  const selectedLot = useMemo(
    () => lotsForSelectedSection.find((lot) => lot.id === selectedLotId),
    [lotsForSelectedSection, selectedLotId],
  );
  const selectedDeedBatch = useMemo(
    () => deedRegistryReview.batches.find((batch) => batch.id === deedRegistryReview.selectedBatchId),
    [deedRegistryReview.batches, deedRegistryReview.selectedBatchId],
  );
  const removedOriginalDeedEntries = deedRegistryReview.removedOriginalEntries ?? [];
  const selectedDeedCase = useMemo(() => deedCases.find((investigation) => investigation.id === selectedDeedCaseId), [deedCases, selectedDeedCaseId]);
  const deedResearchTerms = useMemo(() => deedSearchTerms(deedReviewFilters.q ?? ""), [deedReviewFilters.q]);
  const deedInvestigationOwners = useMemo(
    () => uniqueFilled(deedRegistryReview.entries.map((entry) => entry.ownerDisplayName)).slice(0, 8),
    [deedRegistryReview.entries],
  );
  const deedInvestigationLots = useMemo(
    () =>
      uniqueFilled(
        deedRegistryReview.entries.flatMap((entry) => [
          ...entry.parsedLotNumbers,
          ...entry.parsedPlotNumbers,
          entry.rawLotText,
          entry.parsedSectionAlias ? `${entry.parsedSectionAlias} ${entry.rawLotText}` : "",
        ]),
      ).slice(0, 10),
    [deedRegistryReview.entries],
  );
  const deedInvestigationNoteCount = useMemo(
    () => deedRegistryReview.entries.reduce((count, entry) => count + entry.relatedInvestigationNotes.length, 0),
    [deedRegistryReview.entries],
  );
  const deedOnFileCount = useMemo(
    () => deedRegistryReview.entries.filter((entry) => /^(yes|y|true|1)$/iu.test(entry.deedOnFile.trim())).length,
    [deedRegistryReview.entries],
  );
  const deedRegisterOnFileCount = useMemo(
    () => deedRegistryReview.entries.filter((entry) => /^(yes|y|true|1)$/iu.test(entry.deedRegisterOnFile.trim())).length,
    [deedRegistryReview.entries],
  );
  const selectedNorthHillsBatch = useMemo(
    () => northHillsOcrReview.batches.find((batch) => batch.id === northHillsOcrReview.selectedBatchId),
    [northHillsOcrReview.batches, northHillsOcrReview.selectedBatchId],
  );
  const selectedNorthHillsEntries = useMemo(
    () => northHillsOcrReview.entries.filter((entry) => selectedNorthHillsEntryIds.has(entry.id)),
    [northHillsOcrReview.entries, selectedNorthHillsEntryIds],
  );
  const visibleNorthHillsEntryIds = useMemo(() => northHillsOcrReview.entries.map((entry) => entry.id), [northHillsOcrReview.entries]);
  const selectedSourcePersonRecord = useMemo(
    () => sourcePersonReview.records.find((record) => record.id === selectedSourcePersonRecordId),
    [sourcePersonReview.records, selectedSourcePersonRecordId],
  );
  const selectedLookupDefinition = useMemo(
    () => lookupRecords.tables.find((table) => table.table === selectedLookupTable),
    [lookupRecords.tables, selectedLookupTable],
  );
  const selectedLookupAllRows = useMemo(() => lookupRecords.lookups[selectedLookupTable] ?? [], [lookupRecords.lookups, selectedLookupTable]);
  const selectedLookupRows = useMemo(
    () => (showInactiveLookups ? selectedLookupAllRows : selectedLookupAllRows.filter((row) => row.isActive)),
    [selectedLookupAllRows, showInactiveLookups],
  );
  const duplicateLookupSortOrders = useMemo(() => lookupDuplicateSortOrders(selectedLookupAllRows), [selectedLookupAllRows]);
  const canManageUsers = currentUser.permissions.canManageUsers;
  const canUseSystemAdminTabs = currentUser.role === "admin";
  const canUseBulkTools = currentUser.role === "cemetery-admin" || currentUser.role === "admin";
  const canUseSourcePersonTab = currentUser.role === "cemetery-admin" || currentUser.role === "admin";
  const canUnlinkNorthHillsEvidence = currentUser.role === "cemetery-admin" || currentUser.role === "admin";
  const canEditNorthHillsEntries = currentUser.role === "cemetery-admin" || currentUser.role === "admin";
  const canEditSelectedCemetery = currentUser.role === "admin" || (selectedCemeteryId ? currentUser.assignedCemeteryIds.includes(selectedCemeteryId) : false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    setSelectedNorthHillsEntryIds((current) => {
      const visible = new Set(visibleNorthHillsEntryIds);
      const next = new Set([...current].filter((id) => visible.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [visibleNorthHillsEntryIds]);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);

    Promise.all([
      canManageUsers ? fetchAdminRoles() : Promise.resolve([]),
      canManageUsers ? fetchAdminUsers() : Promise.resolve([]),
      fetchCemeteryAdminRecords(),
    ])
      .then(([nextRoles, nextUsers, nextCemeteryRecords]) => {
        if (!isCurrent) return;
        setRoles(nextRoles);
        setUsers(nextUsers);
        setCemeteryRecords(nextCemeteryRecords);
        setError(undefined);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) setError(loadError instanceof Error ? loadError.message : "Unable to load admin records.");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [canManageUsers]);

  useEffect(() => {
    if (!cemeteryPickerValue || selectedCemeteryId) return;
    const match = cemeteryRecords.cemeteries.find((cemetery) => cemeteryPickerLabel(cemetery) === cemeteryPickerValue);
    if (match) setSelectedCemeteryId(match.id);
  }, [cemeteryPickerValue, cemeteryRecords.cemeteries, selectedCemeteryId]);

  useEffect(() => {
    if (!sectionPickerValue || selectedSectionId) return;
    const match = sectionsForSelectedCemetery.find(
      (section) => sectionPickerLabel(section) === sectionPickerValue || section.name === sectionPickerValue || section.sectionId === sectionPickerValue,
    );
    if (match) setSelectedSectionId(match.id);
  }, [sectionPickerValue, sectionsForSelectedCemetery, selectedSectionId]);

  useEffect(() => {
    if (!lotPickerValue || selectedLotId) return;
    const match = lotsForSelectedSection.find((lot) => lotPickerLabel(lot) === lotPickerValue || lot.name === lotPickerValue || lot.lotId === lotPickerValue);
    if (match) setSelectedLotId(match.id);
  }, [lotPickerValue, lotsForSelectedSection, selectedLotId]);

  useEffect(
    () => () => {
      if (movedLookupTimeoutRef.current) window.clearTimeout(movedLookupTimeoutRef.current);
    },
    [],
  );

  const openSystemTab = () => {
    setActiveTab("system");
  };

  const openAuditTab = () => {
    setActiveTab("audit");
  };

  const loadDeedRegistryReview = async (filters = deedReviewFilters) => {
    setIsLoadingDeedReview(true);
    setError(undefined);

    try {
      const nextReview = await fetchDeedRegistryReview(filters);
      setDeedRegistryReview(nextReview);
      setDeedReviewFilters((current) => ({ ...current, batchId: nextReview.selectedBatchId }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load deed registry evidence.");
    } finally {
      setIsLoadingDeedReview(false);
    }
  };

  const updateDeedReviewFilter = (patch: Partial<DeedRegistryReviewFilters>) => {
    setDeedReviewFilters((current) => ({ ...current, ...patch }));
  };

  const applyDeedReviewFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadDeedRegistryReview(deedReviewFilters);
  };

  const loadDeedCases = async (filters = deedCaseFilters) => {
    setIsLoadingDeedCases(true);
    setError(undefined);

    try {
      const nextCases = await fetchDeedInvestigationCases(filters);
      setDeedCases(nextCases);
      setSelectedDeedCaseId((current) => (nextCases.some((investigation) => investigation.id === current) ? current : (nextCases[0]?.id ?? "")));
      if (!selectedDeedCaseId && nextCases[0]) setDeedCaseForm(deedCaseFormFromCase(nextCases[0]));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load deed investigation cases.");
    } finally {
      setIsLoadingDeedCases(false);
    }
  };

  const selectDeedCase = (investigation: DeedInvestigationCase) => {
    setSelectedDeedCaseId(investigation.id);
    setDeedCaseForm(deedCaseFormFromCase(investigation));
    setSelectedDeedActionId("");
    setDeedActionForm(blankDeedActionForm());
  };

  const startNewDeedCase = () => {
    setSelectedDeedCaseId("");
    setDeedCaseForm(blankDeedCaseForm());
    setSelectedDeedActionId("");
    setDeedActionForm(blankDeedActionForm());
  };

  const saveDeedCase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingDeedCaseKey(selectedDeedCaseId || "new");
    setError(undefined);
    setMessage(undefined);

    try {
      const saved = selectedDeedCaseId
        ? await updateDeedInvestigationCase(selectedDeedCaseId, deedCaseForm)
        : await createDeedInvestigationCase(deedCaseForm);
      setSelectedDeedCaseId(saved.id);
      setDeedCaseForm(deedCaseFormFromCase(saved));
      setDeedCases((current) => [saved, ...current.filter((investigation) => investigation.id !== saved.id)]);
      setMessage(`Saved deed investigation case ${saved.caseNumber}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save deed investigation case.");
    } finally {
      setSavingDeedCaseKey(undefined);
    }
  };

  const selectDeedAction = (action: DeedInvestigationAction) => {
    setSelectedDeedActionId(action.id);
    setDeedActionForm(deedActionFormFromAction(action));
  };

  const startNewDeedAction = () => {
    setSelectedDeedActionId("");
    setDeedActionForm({
      ...blankDeedActionForm(),
      subjectName: deedCaseForm.subjectName,
      plotReference: deedCaseForm.plotReference,
    });
  };

  const saveDeedAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedDeedCaseId) {
      setError("Save or select an investigation case before adding recommended actions.");
      return;
    }

    setSavingDeedActionKey(selectedDeedActionId || "new");
    setError(undefined);
    setMessage(undefined);

    try {
      const saved = selectedDeedActionId
        ? await updateDeedInvestigationAction(selectedDeedCaseId, selectedDeedActionId, deedActionForm)
        : await createDeedInvestigationAction(selectedDeedCaseId, deedActionForm);
      setSelectedDeedActionId(saved.id);
      setDeedActionForm(deedActionFormFromAction(saved));
      setDeedCases((current) =>
        current.map((investigation) =>
          investigation.id === selectedDeedCaseId
            ? {
                ...investigation,
                recommendedActions: [
                  ...investigation.recommendedActions.filter((action) => action.id !== saved.id),
                  saved,
                ].sort((left, right) => left.sortOrder - right.sortOrder || left.subjectName.localeCompare(right.subjectName)),
              }
            : investigation,
        ),
      );
      setMessage(`Saved recommended action for ${saved.subjectName}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save recommended action.");
    } finally {
      setSavingDeedActionKey(undefined);
    }
  };

  const attachEntryToSelectedDeedCase = async (entry: DeedRegistryReviewEntry) => {
    if (!selectedDeedCaseId) {
      setError("Select or create an investigation case before attaching deed evidence.");
      return;
    }
    const note = window.prompt(`Optional note for row ${entry.sourceRowNumber}:`, "");
    if (note === null) return;
    const key = `${selectedDeedCaseId}:${entry.id}`;
    setSavingDeedCaseKey(key);
    setError(undefined);
    setMessage(undefined);

    try {
      const saved = await linkDeedInvestigationCaseEntry(selectedDeedCaseId, entry.id, note);
      setDeedCases((current) => current.map((investigation) => (investigation.id === saved.id ? saved : investigation)));
      setMessage(`Linked row ${entry.sourceRowNumber} to ${saved.caseNumber}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to link deed evidence to the selected case.");
    } finally {
      setSavingDeedCaseKey(undefined);
    }
  };

  const openDeedReviewTab = () => {
    setActiveTab("deeds");
    if (deedRegistryReview.batches.length === 0 && !isLoadingDeedReview) void loadDeedRegistryReview();
    if (deedCases.length === 0 && !isLoadingDeedCases) void loadDeedCases();
  };

  const loadNorthHillsOcrReview = async (filters = northHillsReviewFilters) => {
    setIsLoadingNorthHillsReview(true);
    setError(undefined);

    try {
      const nextReview = await fetchNorthHillsOcrReview(filters);
      setNorthHillsOcrReview(nextReview);
      setNorthHillsReviewFilters((current) => ({ ...current, batchId: nextReview.selectedBatchId }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load North Hills readings.");
    } finally {
      setIsLoadingNorthHillsReview(false);
    }
  };

  const updateNorthHillsReviewFilter = (patch: Partial<NorthHillsOcrReviewFilters>) => {
    setNorthHillsReviewFilters((current) => ({ ...current, ...patch }));
  };

  const applyNorthHillsReviewFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadNorthHillsOcrReview(northHillsReviewFilters);
  };

  const toggleNorthHillsEntrySelection = (entryId: string) => {
    setSelectedNorthHillsEntryIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  const toggleVisibleNorthHillsEntries = () => {
    setSelectedNorthHillsEntryIds((current) => {
      const allVisibleSelected = visibleNorthHillsEntryIds.length > 0 && visibleNorthHillsEntryIds.every((id) => current.has(id));
      if (allVisibleSelected) return new Set();
      return new Set(visibleNorthHillsEntryIds);
    });
  };

  const openNorthHillsReviewTab = () => {
    setActiveTab("readings");
    if (northHillsOcrReview.batches.length === 0 && !isLoadingNorthHillsReview) void loadNorthHillsOcrReview();
  };

  const loadSourcePersonRecords = async (filters = sourcePersonFilters) => {
    setIsLoadingSourcePersonRecords(true);
    setError(undefined);

    try {
      const nextReview = await fetchSourcePersonRecords(filters);
      const defaultCemeteryId = nextReview.cemeteries[0]?.id ?? sourcePersonForm.cemeteryId;
      setSourcePersonReview(nextReview);
      setSourcePersonFilters((current) => ({
        ...current,
        cemeteryId: current.cemeteryId || (nextReview.cemeteries.length === 1 ? nextReview.cemeteries[0].id : ""),
      }));
      setSelectedSourcePersonRecordId((current) => (nextReview.records.some((record) => record.id === current) ? current : ""));
      if (!sourcePersonForm.cemeteryId && defaultCemeteryId) {
        setSourcePersonForm((current) => ({ ...current, cemeteryId: defaultCemeteryId }));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load source-only person records.");
    } finally {
      setIsLoadingSourcePersonRecords(false);
    }
  };

  const updateSourcePersonFilter = (patch: Partial<SourcePersonRecordFilters>) => {
    setSourcePersonFilters((current) => ({ ...current, ...patch }));
  };

  const applySourcePersonFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadSourcePersonRecords(sourcePersonFilters);
  };

  const openSourcePeopleTab = () => {
    setActiveTab("sourcePeople");
    if (sourcePersonReview.records.length === 0 && !isLoadingSourcePersonRecords) void loadSourcePersonRecords();
  };

  const loadHeadstoneLookupRecords = async () => {
    if (headstoneLookups.markerTypes.length || savingBulkKey === "lookups") return;
    setSavingBulkKey("lookups");
    setError(undefined);
    try {
      setHeadstoneLookups(await fetchHeadstoneLookups());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load marker lookup values.");
    } finally {
      setSavingBulkKey(undefined);
    }
  };

  const openBulkToolsTab = () => {
    setActiveTab("bulk");
    void loadHeadstoneLookupRecords();
  };

  const saveBulkHeadstoneUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const identifiers = parseBulkIdentifiers(bulkMarkerIdentifiers);
    if (identifiers.length === 0) {
      setError("Enter at least one marker ID.");
      return;
    }
    if (!bulkMarkerTypeId && !bulkMarkerMaterialId && !bulkMarkerConditionId) {
      setError("Choose at least one marker field to update.");
      return;
    }

    setSavingBulkKey("headstones");
    setMessage(undefined);
    setError(undefined);
    try {
      const result = await bulkUpdateHeadstones({
        identifiers,
        markerTypeId: bulkMarkerTypeId || undefined,
        materialId: bulkMarkerMaterialId || undefined,
        conditionId: bulkMarkerConditionId || undefined,
        reason: bulkReason,
      });
      setMessage(bulkResultMessage("Bulk marker update", result));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update selected markers.");
    } finally {
      setSavingBulkKey(undefined);
    }
  };

  const saveBulkGravesiteLotAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const identifiers = parseBulkIdentifiers(bulkGravesiteIdentifiers);
    if (identifiers.length === 0) {
      setError("Enter at least one gravesite ID.");
      return;
    }
    if (!bulkLotId) {
      setError("Choose a target lot.");
      return;
    }

    setSavingBulkKey("gravesites");
    setMessage(undefined);
    setError(undefined);
    try {
      const result = await bulkAssignGravesitesToLot({ identifiers, lotId: bulkLotId, reason: bulkReason });
      setMessage(bulkResultMessage("Bulk gravesite lot assignment", result));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to assign selected gravesites to the lot.");
    } finally {
      setSavingBulkKey(undefined);
    }
  };

  const markSelectedNorthHillsReviewed = async () => {
    const entryIds = [...selectedNorthHillsEntryIds];
    if (entryIds.length === 0) {
      setError("Select at least one NHG reading.");
      return;
    }

    setSavingBulkKey("northHillsReviewed");
    setMessage(undefined);
    setError(undefined);
    try {
      const result = await bulkMarkNorthHillsReviewed({ entryIds, reason: bulkReason });
      setMessage(bulkResultMessage("Bulk NHG review", result));
      setSelectedNorthHillsEntryIds(new Set());
      await loadNorthHillsOcrReview(northHillsReviewFilters);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to mark selected NHG readings reviewed.");
    } finally {
      setSavingBulkKey(undefined);
    }
  };

  const addNoteToSelectedNorthHillsEntries = async () => {
    const entryIds = [...selectedNorthHillsEntryIds];
    if (entryIds.length === 0) {
      setError("Select at least one NHG reading.");
      return;
    }
    if (!bulkNorthHillsNote.trim()) {
      setError("Enter a note to apply to selected NHG readings.");
      return;
    }

    setSavingBulkKey("northHillsNote");
    setMessage(undefined);
    setError(undefined);
    try {
      const result = await bulkAddNorthHillsEntryNote({ entryIds, note: bulkNorthHillsNote, reason: bulkReason });
      setMessage(bulkResultMessage("Bulk NHG note", result));
      setBulkNorthHillsNote("");
      await loadNorthHillsOcrReview(northHillsReviewFilters);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to add the note to selected NHG readings.");
    } finally {
      setSavingBulkKey(undefined);
    }
  };

  const startNewSourcePersonRecord = () => {
    const defaultCemeteryId = sourcePersonFilters.cemeteryId || sourcePersonReview.cemeteries[0]?.id || "";
    setSelectedSourcePersonRecordId("");
    setSourcePersonForm(blankSourcePersonRecordForm(defaultCemeteryId));
    setMessage(undefined);
    setError(undefined);
  };

  const startSourcePersonRecordEdit = (record: SourcePersonRecord) => {
    setSelectedSourcePersonRecordId(record.id);
    setSourcePersonForm(sourcePersonFormFromRecord(record));
    setMessage(undefined);
    setError(undefined);
  };

  const updateSourcePersonForm = (patch: Partial<SaveSourcePersonRecordInput>) => {
    setSourcePersonForm((current) => ({ ...current, ...patch }));
  };

  const saveSourcePersonRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingSourcePersonKey(selectedSourcePersonRecordId || "new");
    setMessage(undefined);
    setError(undefined);

    try {
      const saved = selectedSourcePersonRecordId
        ? await updateSourcePersonRecord(selectedSourcePersonRecordId, sourcePersonForm)
        : await createSourcePersonRecord(sourcePersonForm);
      setSelectedSourcePersonRecordId(saved.id);
      setSourcePersonForm(sourcePersonFormFromRecord(saved));
      setSourcePersonReview((current) => ({
        ...current,
        records: [saved, ...current.records.filter((record) => record.id !== saved.id)],
      }));
      setMessage(`Saved source-only person record for ${saved.fullName}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save source-only person record.");
    } finally {
      setSavingSourcePersonKey(undefined);
    }
  };

  const softDeleteSourcePersonRecord = async (record: SourcePersonRecord) => {
    if (!window.confirm(`Soft delete source-only person record for ${record.fullName}?`)) return;
    const reason = window.prompt("Reason for soft delete:", "Soft-delete source-only person record.");
    if (reason === null) return;
    setSavingSourcePersonKey(`delete:${record.id}`);
    setMessage(undefined);
    setError(undefined);

    try {
      await deleteSourcePersonRecord(record.id, reason);
      setSourcePersonReview((current) => ({
        ...current,
        records: current.records.filter((currentRecord) => currentRecord.id !== record.id),
      }));
      if (selectedSourcePersonRecordId === record.id) {
        setSelectedSourcePersonRecordId("");
        setSourcePersonForm(blankSourcePersonRecordForm(sourcePersonFilters.cemeteryId || sourcePersonReview.cemeteries[0]?.id || ""));
      }
      setMessage(`Soft-deleted source-only person record for ${record.fullName}.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to soft delete source-only person record.");
    } finally {
      setSavingSourcePersonKey(undefined);
    }
  };

  const startNorthHillsEntryEdit = (entry: NorthHillsOcrReviewEntry) => {
    setEditingNorthHillsEntryId(entry.id);
    setNorthHillsEntryForm(northHillsEditFormFromEntry(entry));
    setMessage(undefined);
    setError(undefined);
  };

  const cancelNorthHillsEntryEdit = () => {
    setEditingNorthHillsEntryId("");
    setNorthHillsEntryForm(null);
  };

  const updateNorthHillsEntryForm = (patch: Partial<NorthHillsEditForm>) => {
    setNorthHillsEntryForm((current) => (current ? { ...current, ...patch } : current));
  };

  const updateNorthHillsSourceFactForm = (index: number, patch: Partial<SaveNorthHillsSourceFactInput>) => {
    setNorthHillsEntryForm((current) =>
      current
        ? {
            ...current,
            sourceFacts: current.sourceFacts.map((fact, factIndex) => (factIndex === index ? { ...fact, ...patch } : fact)),
          }
        : current,
    );
  };

  const updateNorthHillsObservationForm = (index: number, patch: Partial<SaveNorthHillsOcrObservationInput>) => {
    setNorthHillsEntryForm((current) =>
      current
        ? {
            ...current,
            observations: current.observations.map((observation, observationIndex) => (observationIndex === index ? { ...observation, ...patch } : observation)),
          }
        : current,
    );
  };

  const saveNorthHillsEntryEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingNorthHillsEntryId || !northHillsEntryForm) return;
    setSavingEvidenceKey(`${editingNorthHillsEntryId}:entry-edit`);
    setMessage(undefined);
    setError(undefined);

    try {
      await updateNorthHillsOcrEntry(editingNorthHillsEntryId, northHillsEditPayload(northHillsEntryForm));
      setMessage(`Saved North Hills reading ${northHillsEntryForm.nameText || "entry"}.`);
      cancelNorthHillsEntryEdit();
      await loadNorthHillsOcrReview(northHillsReviewFilters);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save North Hills reading.");
    } finally {
      setSavingEvidenceKey(undefined);
    }
  };

  const saveNorthHillsEvidence = async (
    entryId: string,
    targetType: "headstone" | "gravesite",
    targetId: string,
    status: NorthHillsOcrEvidenceStatus,
    label: string,
  ) => {
    const notes = window.prompt(`Optional notes for ${evidenceStatusLabels[status].toLowerCase()} ${label}:`, "");
    if (notes === null) return;
    const key = `${entryId}:${targetType}:${targetId}:${status}`;
    setSavingEvidenceKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      await saveNorthHillsOcrEvidence(entryId, {
        targetType,
        targetId,
        status,
        confidence: status === "linked" ? "high" : status === "rejected" ? "low" : "review",
        notes,
      });
      setMessage(`${label} marked ${evidenceStatusLabels[status].toLowerCase()}.`);
      await loadNorthHillsOcrReview(northHillsReviewFilters);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save North Hills evidence review.");
    } finally {
      setSavingEvidenceKey(undefined);
    }
  };

  const unlinkNorthHillsEvidence = async (entryId: string, targetType: "headstone" | "gravesite", targetId: string, label: string) => {
    if (!window.confirm(`Unlink this North Hills reading from ${label}?`)) return;
    const key = `${entryId}:${targetType}:${targetId}:unlink`;
    setSavingEvidenceKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      await deleteNorthHillsOcrEvidence(entryId, { targetType, targetId });
      setMessage(`Unlinked North Hills reading from ${label}.`);
      await loadNorthHillsOcrReview(northHillsReviewFilters);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to unlink North Hills evidence.");
    } finally {
      setSavingEvidenceKey(undefined);
    }
  };

  const saveNorthHillsSourceFactReview = async (fact: NorthHillsSourceFact, status: Exclude<NorthHillsSourceFactStatus, "promoted">) => {
    const notes = window.prompt(`Optional notes for ${sourceFactStatusLabels[status].toLowerCase()} ${sourceFactTypeLabels[fact.factType].toLowerCase()}:`, "");
    if (notes === null) return;
    const key = `${fact.id}:source-fact:${status}`;
    setSavingEvidenceKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      await reviewNorthHillsSourceFact(fact.id, {
        status,
        confidence: status === "reviewed" ? fact.confidence : status === "rejected" ? "low" : "review",
        notes,
      });
      setMessage(`${sourceFactTypeLabels[fact.factType]} marked ${sourceFactStatusLabels[status].toLowerCase()}.`);
      await loadNorthHillsOcrReview(northHillsReviewFilters);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save North Hills source fact review.");
    } finally {
      setSavingEvidenceKey(undefined);
    }
  };

  const promoteNorthHillsDeathDate = async (fact: NorthHillsSourceFact, match: NorthHillsOcrReviewEntry["candidateMatches"][number]) => {
    const defaultNote = `${fact.sourceCode} evidence from North Hills reading: ${fact.factValue}.`;
    const notes = window.prompt(`Optional burial note for promoting ${fact.factValue} to ${match.fullName || match.gravesiteId}:`, defaultNote);
    if (notes === null) return;
    const key = `${fact.id}:promote:${match.burialId}`;
    setSavingEvidenceKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      await promoteNorthHillsSourceFact(fact.id, {
        burialId: match.burialId,
        notes,
        reason: `Promote ${fact.sourceCode} death date from North Hills reading`,
      });
      setMessage(`Promoted ${fact.factValue} to ${match.fullName || match.gravesiteId}.`);
      await loadNorthHillsOcrReview(northHillsReviewFilters);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to promote North Hills source fact.");
    } finally {
      setSavingEvidenceKey(undefined);
    }
  };

  const loadLookupRecords = async () => {
    setIsLoadingLookups(true);
    setError(undefined);

    try {
      const nextLookups = await fetchLookupAdminRecords();
      setLookupRecords(nextLookups);
      setSelectedLookupTable((current) => (nextLookups.tables.some((table) => table.table === current) ? current : (nextLookups.tables[0]?.table ?? "")));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load lookup records.");
    } finally {
      setIsLoadingLookups(false);
    }
  };

  const openLookupsTab = () => {
    setActiveTab("lookups");
    if (lookupRecords.tables.length === 0 && !isLoadingLookups) void loadLookupRecords();
  };

  const resetForm = () => {
    setForm(blankUser);
    setMessage(undefined);
    setError(undefined);
  };

  const resolveAuth0Subject = async (user: UserFormState) => {
    const resolved = await resolveAuth0User({ email: user.email, displayName: user.displayName });
    setForm((current) => ({
      ...current,
      externalSubject: resolved.externalSubject,
      email: resolved.email,
      displayName: current.displayName || resolved.displayName,
    }));
    const invitationStatus = resolved.invitationSent ? " and sent an invitation email" : "";
    setMessage(`${resolved.email} ${resolved.created ? `created in Auth0${invitationStatus}` : "found in Auth0"}.`);
    return {
      ...user,
      externalSubject: resolved.externalSubject,
      email: resolved.email,
      displayName: user.displayName || resolved.displayName,
    };
  };

  const resolveAuth0SubjectFromForm = async () => {
    setIsResolvingAuth0User(true);
    setMessage(undefined);
    setError(undefined);

    try {
      await resolveAuth0Subject(form);
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Unable to find or create Auth0 user.");
    } finally {
      setIsResolvingAuth0User(false);
    }
  };

  const saveUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(undefined);
    setError(undefined);

    try {
      const userToSave = form.id || form.externalSubject.trim() ? form : await resolveAuth0Subject(form);
      const saved = form.id ? await updateAdminUser(form.id, userToSave) : await createAdminUser(userToSave);
      setUsers((current) => {
        const existingIndex = current.findIndex((user) => user.id === saved.id);
        if (existingIndex === -1) return [...current, saved].sort((a, b) => a.email.localeCompare(b.email));
        return current.map((user) => (user.id === saved.id ? saved : user));
      });
      setForm(userFormFromUser(saved));
      setMessage(`${saved.email} saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save user.");
    } finally {
      setIsSaving(false);
    }
  };

  const replaceUser = (saved: AppUser) => {
    setUsers((current) => current.map((user) => (user.id === saved.id ? saved : user)));
    setForm((current) => (current.id === saved.id ? userFormFromUser(saved) : current));
  };

  const toggleUserActive = async (user: AppUser) => {
    setTogglingUserIds((current) => new Set(current).add(user.id));
    setMessage(undefined);
    setError(undefined);

    try {
      const saved = await updateAdminUser(user.id, {
        externalSubject: user.externalSubject,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        assignedCemeteryIds: user.assignedCemeteryIds,
        isActive: !user.isActive,
      });
      replaceUser(saved);
      setMessage(`${saved.email} ${saved.isActive ? "reactivated" : "deactivated"}.`);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Unable to update user status.");
    } finally {
      setTogglingUserIds((current) => {
        const next = new Set(current);
        next.delete(user.id);
        return next;
      });
    }
  };

  const updateCemeteryRecord = (id: string, patch: Partial<CemeteryTextRecord>) => {
    setCemeteryRecords((current) => ({
      ...current,
      cemeteries: current.cemeteries.map((cemetery) => (cemetery.id === id ? { ...cemetery, ...patch } : cemetery)),
    }));
  };

  const updateSectionRecord = (id: string, patch: Partial<SectionTextRecord>) => {
    setCemeteryRecords((current) => ({
      ...current,
      sections: current.sections.map((section) => (section.id === id ? { ...section, ...patch } : section)),
    }));
  };

  const updateLotRecord = (id: string, patch: Partial<LotTextRecord>) => {
    setCemeteryRecords((current) => ({
      ...current,
      lots: current.lots.map((lot) => (lot.id === id ? { ...lot, ...patch } : lot)),
    }));
  };

  const saveCemeteryRecord = async (cemetery: CemeteryTextRecord) => {
    const key = `cemetery:${cemetery.id}`;
    setSavingRecordKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      const saved = await updateCemeteryText(cemetery.id, {
        name: cemetery.name,
        fullAddress: cemetery.fullAddress,
        municipality: cemetery.municipality,
        agency: cemetery.agency,
        agencyUrl: cemetery.agencyUrl,
        operationalHours: cemetery.operationalHours,
        contactName: cemetery.contactName,
        contactPhone: cemetery.contactPhone,
        contactEmail: cemetery.contactEmail,
        imageUrl: cemetery.imageUrl,
        notes: cemetery.notes,
      });
      updateCemeteryRecord(saved.id, saved);
      if (saved.id === selectedCemeteryId) setCemeteryPickerValue(cemeteryPickerLabel(saved));
      setMessage(`${saved.name} saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save cemetery.");
    } finally {
      setSavingRecordKey(undefined);
    }
  };

  const saveSectionRecord = async (section: SectionTextRecord) => {
    const key = `section:${section.id}`;
    setSavingRecordKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      const saved = await updateSectionText(section.id, { name: section.name, alternateNames: section.alternateNames, notes: section.notes });
      updateSectionRecord(saved.id, saved);
      if (saved.id === selectedSectionId) setSectionPickerValue(sectionPickerLabel(saved));
      setMessage(`Section ${saved.sectionId} saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save section.");
    } finally {
      setSavingRecordKey(undefined);
    }
  };

  const saveLotRecord = async (lot: LotTextRecord) => {
    const key = `lot:${lot.id}`;
    setSavingRecordKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      const saved = await updateLotText(lot.id, { name: lot.name });
      updateLotRecord(saved.id, saved);
      if (saved.id === selectedLotId) setLotPickerValue(lotPickerLabel(saved));
      setMessage(`Lot ${saved.lotId} saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save lot.");
    } finally {
      setSavingRecordKey(undefined);
    }
  };

  const replaceLookupRecord = (table: string, saved: LookupRecord) => {
    setLookupRecords((current) => {
      const existingRows = current.lookups[table] ?? [];
      const exists = existingRows.some((row) => row.id === saved.id);
      const nextRows = exists ? existingRows.map((row) => (row.id === saved.id ? saved : row)) : [...existingRows, saved];

      return {
        ...current,
        lookups: {
          ...current.lookups,
          [table]: nextRows.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label) || a.code.localeCompare(b.code)),
        },
      };
    });
  };

  const updateLocalLookupRecord = (table: string, id: string, patch: Partial<LookupRecord>) => {
    setLookupRecords((current) => ({
      ...current,
      lookups: {
        ...current.lookups,
        [table]: (current.lookups[table] ?? []).map((row) => (row.id === id ? { ...row, ...patch } : row)),
      },
    }));
  };

  const saveLookupRecord = async (table: string, row: LookupRecord) => {
    const key = `${table}:${row.id}`;
    if (!row.isActive && row.usageCount > 0) {
      const shouldContinue = window.confirm(`${row.label} is ${lookupUsageText(row).toLowerCase()} Deactivate it anyway?`);
      if (!shouldContinue) return;
    }

    setSavingLookupKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      const saved = await updateLookupRecord(table, row.id, row);
      replaceLookupRecord(table, saved);
      setMessage(`${saved.label} saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save lookup row.");
    } finally {
      setSavingLookupKey(undefined);
    }
  };

  const moveLookupRecord = async (table: string, row: LookupRecord, direction: -1 | 1) => {
    const rows = [...(showInactiveLookups ? lookupRecords.lookups[table] ?? [] : (lookupRecords.lookups[table] ?? []).filter((candidate) => candidate.isActive))].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label) || a.code.localeCompare(b.code),
    );
    const rowIndex = rows.findIndex((candidate) => candidate.id === row.id);
    const swapWith = rows[rowIndex + direction];
    if (!swapWith) return;

    const key = `${table}:move:${row.id}`;
    const nextRow = { ...row, sortOrder: swapWith.sortOrder };
    const nextSwapWith = { ...swapWith, sortOrder: row.sortOrder };
    setSavingLookupKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      const [savedRow, savedSwapWith] = await Promise.all([updateLookupRecord(table, nextRow.id, nextRow), updateLookupRecord(table, nextSwapWith.id, nextSwapWith)]);
      replaceLookupRecord(table, savedRow);
      replaceLookupRecord(table, savedSwapWith);
      setRecentlyMovedLookupIds(new Set([savedRow.id, savedSwapWith.id]));
      if (movedLookupTimeoutRef.current) window.clearTimeout(movedLookupTimeoutRef.current);
      movedLookupTimeoutRef.current = window.setTimeout(() => setRecentlyMovedLookupIds(new Set()), 1600);
      setMessage(`${row.label} moved ${direction < 0 ? "up" : "down"}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to reorder lookup rows.");
    } finally {
      setSavingLookupKey(undefined);
    }
  };

  const viewLookupAudit = (table: string, row: LookupRecord) => {
    const filters = { ...defaultAuditFilters, targetTable: table, targetRecordId: row.id };
    setAuditSeedFilters(filters);
    setActiveTab("audit");
  };

  const addLookupRecord = async () => {
    if (!selectedLookupDefinition) return;
    const key = `${selectedLookupDefinition.table}:new`;
    const existingCodes = new Set((lookupRecords.lookups[selectedLookupDefinition.table] ?? []).map((row) => row.code));
    const lookupToCreate = {
      ...newLookupRecord,
      code: lookupCodeFromLabel(newLookupRecord.label, existingCodes),
    };
    setSavingLookupKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      const saved = await createLookupRecord(selectedLookupDefinition.table, lookupToCreate);
      replaceLookupRecord(selectedLookupDefinition.table, saved);
      setNewLookupRecord(blankLookupRecord);
      setMessage(`${saved.label} added.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to add lookup row.");
    } finally {
      setSavingLookupKey(undefined);
    }
  };

  const selectCemeteryById = (id: string) => {
    const match = cemeteryRecords.cemeteries.find((cemetery) => cemetery.id === id);
    setSelectedCemeteryId(match?.id ?? "");
    setCemeteryPickerValue(match ? cemeteryPickerLabel(match) : "");
    setSelectedSectionId("");
    setSelectedLotId("");
    setSectionPickerValue("");
    setLotPickerValue("");
  };

  const selectSectionById = (id: string) => {
    const match = sectionsForSelectedCemetery.find((section) => section.id === id);
    setSelectedSectionId(match?.id ?? "");
    setSectionPickerValue(match ? sectionPickerLabel(match) : "");
    setSelectedLotId("");
    setLotPickerValue("");
  };

  const selectLotById = (id: string) => {
    const match = lotsForSelectedSection.find((lot) => lot.id === id);
    setSelectedLotId(match?.id ?? "");
    setLotPickerValue(match ? lotPickerLabel(match) : "");
  };

  return (
    <aside className="admin-panel" aria-label="Admin management">
      <div className="admin-panel-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Administration</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close admin panel" title="Close the admin panel.">
          <X size={18} />
        </button>
      </div>

      {isLoading ? <div className="admin-message" role="status">Loading admin records...</div> : null}
      {error ? <div className="admin-message is-error" role="alert">{error}</div> : null}
      {message ? <div className="admin-message" role="status">{message}</div> : null}

      <div className="admin-workspace">
        <nav className="admin-nav" aria-label="Admin sections">
          {canManageUsers ? <button
            type="button"
            aria-current={activeTab === "users" ? "page" : undefined}
            className={activeTab === "users" ? "is-active" : undefined}
            onClick={() => setActiveTab("users")}
            title="Manage application users and role assignments."
          >
            <UserCog size={16} aria-hidden="true" />
            <span>Users</span>
          </button> : null}
          <button
            type="button"
            aria-current={activeTab === "records" ? "page" : undefined}
            className={activeTab === "records" ? "is-active" : undefined}
            onClick={() => setActiveTab("records")}
            title="Edit cemetery, section, and lot text records."
          >
            <Landmark size={16} aria-hidden="true" />
            <span>Records</span>
          </button>
          <button
            type="button"
            aria-current={activeTab === "quality" ? "page" : undefined}
            className={activeTab === "quality" ? "is-active" : undefined}
            onClick={() => setActiveTab("quality")}
            title="Review data cleanup counts for readings, map links, burials, photos, and maintenance."
          >
            <ShieldAlert size={16} aria-hidden="true" />
            <span>Quality</span>
          </button>
          {canUseBulkTools ? <button
            type="button"
            aria-current={activeTab === "bulk" ? "page" : undefined}
            className={activeTab === "bulk" ? "is-active" : undefined}
            onClick={openBulkToolsTab}
            title="Apply carefully scoped updates to selected markers, gravesites, and NHG readings."
          >
            <ListChecks size={16} aria-hidden="true" />
            <span>Bulk</span>
          </button> : null}
          {canUseSystemAdminTabs ? <button
            type="button"
            aria-current={activeTab === "lookups" ? "page" : undefined}
            className={activeTab === "lookups" ? "is-active" : undefined}
            onClick={openLookupsTab}
            title="Maintain lookup values for statuses, marker types, materials, and ownership event types."
          >
            <ListChecks size={16} aria-hidden="true" />
            <span>Lookups</span>
          </button> : null}
          {canUseSystemAdminTabs ? <button
            type="button"
            aria-current={activeTab === "deeds" ? "page" : undefined}
            className={activeTab === "deeds" ? "is-active" : undefined}
            onClick={openDeedReviewTab}
            title="Review staged deed registry imports before promotion."
          >
            <FileSearch size={16} aria-hidden="true" />
            <span>Deeds</span>
          </button> : null}
          {canUseSystemAdminTabs ? <button
            type="button"
            aria-current={activeTab === "readings" ? "page" : undefined}
            className={activeTab === "readings" ? "is-active" : undefined}
            onClick={openNorthHillsReviewTab}
            title="Review staged North Hills Genealogists OCR readings against existing burials."
          >
            <FileText size={16} aria-hidden="true" />
            <span>Readings</span>
          </button> : null}
          {canUseSourcePersonTab ? <button
            type="button"
            aria-current={activeTab === "sourcePeople" ? "page" : undefined}
            className={activeTab === "sourcePeople" ? "is-active" : undefined}
            onClick={openSourcePeopleTab}
            title="Enter and review source-only people from church records, family history, and other source notes."
          >
            <BookOpenText size={16} aria-hidden="true" />
            <span>Source People</span>
          </button> : null}
          {canUseSystemAdminTabs ? <button
            type="button"
            aria-current={activeTab === "audit" ? "page" : undefined}
            className={activeTab === "audit" ? "is-active" : undefined}
            onClick={openAuditTab}
            title="Review create, update, delete, and restore audit events."
          >
            <History size={16} aria-hidden="true" />
            <span>Audit</span>
          </button> : null}
          {canUseSystemAdminTabs ? <button
            type="button"
            aria-current={activeTab === "system" ? "page" : undefined}
            className={activeTab === "system" ? "is-active" : undefined}
            onClick={openSystemTab}
            title="Review API errors, scheduled job runs, health checks, and integration failures."
          >
            <Activity size={16} aria-hidden="true" />
            <span>System</span>
          </button> : null}
        </nav>

        <div className="admin-content">

      {activeTab === "users" && canManageUsers ? (
        <>
      <section className="admin-section">
        <div className="section-title">
          <UserCog size={17} aria-hidden="true" />
          <h3>{form.id ? "Edit User" : "Add User"}</h3>
        </div>
        <form className="admin-form" onSubmit={(event) => void saveUser(event)}>
          <label>
            Email
            <input
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              required
              title="The user's email address. This is used to find or create the matching Auth0 account."
            />
          </label>
          <label>
            Display name
            <input
              value={form.displayName}
              onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
              title="Optional name shown in the admin user list and saved with the local user record."
            />
          </label>
          <label>
            Auth0 user ID
            <span
              className="auth0-user-id-row"
              title="The Auth0 user_id for this person. Leave it blank for a new user to find or create the Auth0 account during save."
            >
              <input
                value={form.externalSubject}
                onChange={(event) => setForm((current) => ({ ...current, externalSubject: event.target.value }))}
                title="The Auth0 user_id value, usually shaped like auth0|abc123. This must match the token subject from Auth0."
              />
              <button
                type="button"
                className="icon-button auth0-resolve-button"
                onClick={() => void resolveAuth0SubjectFromForm()}
                disabled={isResolvingAuth0User || !form.email.trim()}
                aria-label="Find or create Auth0 user"
                title="Find an Auth0 user by email, or create one if no Auth0 user exists yet."
              >
                <UserPlus size={17} />
              </button>
            </span>
          </label>
          <label>
            Role
            <select
              value={form.role}
              onChange={(event) => {
                const role = event.target.value as AppRoleName;
                setForm((current) => ({
                  ...current,
                  role,
                  assignedCemeteryIds: role === "power-user" || role === "cemetery-admin" ? current.assignedCemeteryIds : [],
                }));
              }}
              title={roleDescriptions[form.role]}
            >
              {roleOptions.map((role) => (
                <option key={role} value={role} title={roleDescriptions[role]}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
          </label>
          {form.role === "power-user" || form.role === "cemetery-admin" ? (
            <label>
              Assigned cemetery
              <select
                value={form.assignedCemeteryIds[0] ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    assignedCemeteryIds: event.target.value ? [event.target.value] : [],
                  }))
                }
                required
                title="The cemetery this user can edit. They retain read-only access to other cemeteries."
              >
                <option value="">Select cemetery</option>
                {cemeteryRecords.cemeteries.map((cemetery) => (
                  <option key={cemetery.id} value={cemetery.id}>
                    {cemeteryPickerLabel(cemetery)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="checkbox-row" title="Inactive users are kept in the database but cannot access the application.">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
              title="Controls whether this user is allowed to sign in and use the application."
            />
            Active user
          </label>
          <div className="admin-form-actions">
            <button type="submit" disabled={isSaving} title="Save this local user record and role assignment. New users with no Auth0 user ID will be resolved in Auth0 first.">
              {isSaving ? "Saving..." : "Save user"}
            </button>
            <button type="button" className="secondary-button" onClick={resetForm} title="Clear the form so you can add a new user.">
              New user
            </button>
          </div>
        </form>
      </section>

      <section className="admin-section">
        <div className="section-title">
          <UserCog size={17} aria-hidden="true" />
          <h3>Users</h3>
        </div>
        <div className="admin-table" role="table" aria-label="Application users">
          {users.map((user) => (
            <article key={user.id} className="admin-user-row" title={userTitle(user)}>
              <button type="button" className="admin-user-edit" onClick={() => setForm(userFormFromUser(user))} title={userTitle(user)}>
                <span>
                  <strong>{user.displayName || user.email}</strong>
                  <small>{user.email}</small>
                </span>
                <span title={roleDescriptions[user.role]}>{roleLabel(user.role)}</span>
                <small>{user.assignedCemeteryIds.length ? `${user.assignedCemeteryIds.length} assigned cemeter${user.assignedCemeteryIds.length === 1 ? "y" : "ies"}` : "No cemetery assignment"}</small>
                <span
                  className={user.isActive ? "status-active" : "status-inactive"}
                  title={user.isActive ? "This user can currently access the application." : "This user is blocked from application access."}
                >
                  {user.isActive ? "Active" : "Inactive"}
                </span>
              </button>
              <button
                type="button"
                className={`user-status-action ${user.isActive ? "is-deactivate" : "is-reactivate"}`}
                onClick={() => void toggleUserActive(user)}
                disabled={togglingUserIds.has(user.id)}
                aria-label={`${user.isActive ? "Deactivate" : "Reactivate"} ${user.displayName || user.email}`}
                title={
                  user.isActive
                    ? "Deactivate this user. The local account remains in the database, but access is blocked."
                    : "Reactivate this user so they can access the application again."
                }
              >
                {user.isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                <span>{user.isActive ? "Deactivate" : "Reactivate"}</span>
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <div className="section-title">
          <ShieldCheck size={17} aria-hidden="true" />
          <h3>Roles</h3>
        </div>
        <div className="role-list">
          {roles.map((role) => (
            <article key={role.name} className="role-row" title={roleTitle(role)}>
              <strong title={roleDescriptions[role.name]}>{roleLabel(role.name)}</strong>
              <p>{role.description}</p>
              <small title={`There ${role.userCount === 1 ? "is" : "are"} ${role.userCount} active or inactive local user record${role.userCount === 1 ? "" : "s"} assigned to this role.`}>
                {role.userCount} user{role.userCount === 1 ? "" : "s"}
              </small>
            </article>
          ))}
        </div>
      </section>
        </>
      ) : activeTab === "records" ? (
        <>
          <section className="admin-section">
            <div className="section-title">
              <Landmark size={17} aria-hidden="true" />
              <h3>Cemetery Records</h3>
            </div>

            <div className="record-picker-grid">
              <label className="record-picker">
                Cemetery
                <select
                  value={selectedCemeteryId}
                  onChange={(event) => selectCemeteryById(event.target.value)}
                  title="Search for and select the cemetery record to edit."
                >
                  <option value="">Select cemetery</option>
                  {cemeteryRecords.cemeteries.map((cemetery) => (
                    <option key={cemetery.id} value={cemetery.id}>
                      {cemeteryPickerLabel(cemetery)}
                    </option>
                  ))}
                </select>
              </label>

              {selectedCemetery ? (
                <label className="record-picker">
                  Section
                  <select
                    value={selectedSectionId}
                    onChange={(event) => selectSectionById(event.target.value)}
                    title="Search for and select a section in the selected cemetery."
                  >
                    <option value="">Select section</option>
                    {sectionsForSelectedCemetery.map((section) => (
                      <option key={section.id} value={section.id}>
                        {sectionPickerLabel(section)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {selectedSection ? (
                <label className="record-picker">
                  Lot
                  <select
                    value={selectedLotId}
                    onChange={(event) => selectLotById(event.target.value)}
                    title="Search for and select a lot in the selected section."
                  >
                    <option value="">Select lot</option>
                    {lotsForSelectedSection.map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        {lotPickerLabel(lot)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <div className="record-editor-list">
              {selectedCemetery ? (
                <article className="record-editor-row record-editor-row-cemetery">
                  <h4>Cemetery</h4>
                  <label className="record-editor-name">
                    Name
                    <input
                      value={selectedCemetery.name}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { name: event.target.value })}
                      title="The cemetery name shown on the map, search results, and cemetery marker."
                    />
                  </label>
                  <label>
                    Full address
                    <input
                      value={selectedCemetery.fullAddress}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { fullAddress: event.target.value })}
                      title="The cemetery's street address or full mailing/location address."
                    />
                  </label>
                  <label>
                    Municipality
                    <input
                      value={selectedCemetery.municipality}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { municipality: event.target.value })}
                      title="The municipality where the cemetery is located."
                    />
                  </label>
                  <label>
                    Agency
                    <input
                      value={selectedCemetery.agency}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { agency: event.target.value })}
                      title="The agency or organization associated with the cemetery."
                    />
                  </label>
                  <label>
                    Agency URL
                    <input
                      value={selectedCemetery.agencyUrl}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { agencyUrl: event.target.value })}
                      title="The agency website URL associated with the cemetery."
                    />
                  </label>
                  <label>
                    Operational hours
                    <input
                      value={selectedCemetery.operationalHours}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { operationalHours: event.target.value })}
                      title="Public or operational hours for the cemetery."
                    />
                  </label>
                  <label>
                    Contact name
                    <input
                      value={selectedCemetery.contactName}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { contactName: event.target.value })}
                      title="Primary contact person for this cemetery record."
                    />
                  </label>
                  <label>
                    Contact phone
                    <input
                      value={selectedCemetery.contactPhone}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { contactPhone: event.target.value })}
                      title="Primary contact phone number for this cemetery record."
                    />
                  </label>
                  <label>
                    Contact email
                    <input
                      value={selectedCemetery.contactEmail}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { contactEmail: event.target.value })}
                      title="Primary contact email address for this cemetery record."
                    />
                  </label>
                  <label>
                    Image URL
                    <input
                      value={selectedCemetery.imageUrl}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { imageUrl: event.target.value })}
                      title="URL for an image associated with this cemetery."
                    />
                  </label>
                  <label>
                    Notes
                    <textarea
                      value={selectedCemetery.notes}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { notes: event.target.value })}
                      rows={8}
                      title="Administrative notes stored with the cemetery record."
                    />
                  </label>
                  <dl className="record-audit-fields" aria-label="Cemetery audit timestamps">
                    <div title="When this cemetery record was created. This field cannot be edited here.">
                      <dt>Created</dt>
                      <dd>{formatAdminTimestamp(selectedCemetery.createdAt)}</dd>
                    </div>
                    <div title="When this cemetery record was last updated. This field cannot be edited here.">
                      <dt>Updated</dt>
                      <dd>{formatAdminTimestamp(selectedCemetery.updatedAt)}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => void saveCemeteryRecord(selectedCemetery)}
                    disabled={savingRecordKey === `cemetery:${selectedCemetery.id}` || !selectedCemetery.name.trim() || !canEditSelectedCemetery}
                    title={canEditSelectedCemetery ? "Save this cemetery text." : "You have read-only access to this cemetery."}
                  >
                    {savingRecordKey === `cemetery:${selectedCemetery.id}` ? "Saving..." : "Save cemetery"}
                  </button>
                </article>
              ) : (
                <p className="record-editor-empty">Select a cemetery to edit its text records.</p>
              )}

              {selectedCemetery && sectionsForSelectedCemetery.length === 0 ? (
                <p className="record-editor-empty">No sections are available for this cemetery.</p>
              ) : null}

              {selectedSection ? (
                <article className="record-editor-row record-editor-row-section">
                  <h4>Section</h4>
                  <label>
                    Name
                    <input
                      value={selectedSection.name}
                      onChange={(event) => updateSectionRecord(selectedSection.id, { name: event.target.value })}
                      title="The section display name shown on the map label."
                    />
                  </label>
                  <label>
                    Alternate names
                    <textarea
                      value={alternateNamesText(selectedSection.alternateNames)}
                      onChange={(event) => updateSectionRecord(selectedSection.id, { alternateNames: parseAlternateNames(event.target.value) })}
                      rows={3}
                      title="Alternate section names, one per line or separated by commas. For example: OC and Original Cemetery."
                    />
                  </label>
                  <label className="record-editor-notes">
                    Notes
                    <textarea
                      value={selectedSection.notes}
                      onChange={(event) => updateSectionRecord(selectedSection.id, { notes: event.target.value })}
                      rows={6}
                      title="Administrative notes stored with the section record."
                    />
                  </label>
                  <dl className="record-audit-fields" aria-label="Section audit timestamps">
                    <div title="When this section record was created. This field cannot be edited here.">
                      <dt>Created</dt>
                      <dd>{formatAdminTimestamp(selectedSection.createdAt)}</dd>
                    </div>
                    <div title="When this section record was last updated. This field cannot be edited here.">
                      <dt>Updated</dt>
                      <dd>{formatAdminTimestamp(selectedSection.updatedAt)}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => void saveSectionRecord(selectedSection)}
                    disabled={savingRecordKey === `section:${selectedSection.id}` || !canEditSelectedCemetery}
                    title={canEditSelectedCemetery ? "Save this section name and alternate names." : "You have read-only access to this cemetery."}
                  >
                    {savingRecordKey === `section:${selectedSection.id}` ? "Saving..." : "Save section"}
                  </button>
                </article>
              ) : null}

              {selectedSection && lotsForSelectedSection.length === 0 ? (
                <p className="record-editor-empty">No lots are available for this section.</p>
              ) : null}

              {selectedLot ? (
                <article className="record-editor-row record-editor-row-lot">
                  <h4>Lot</h4>
                  <label>
                    Name
                    <input
                      value={selectedLot.name}
                      onChange={(event) => updateLotRecord(selectedLot.id, { name: event.target.value })}
                      title="The lot display name shown on the map label."
                    />
                  </label>
                  <dl className="record-audit-fields" aria-label="Lot audit timestamps">
                    <div title="When this lot record was created. This field cannot be edited here.">
                      <dt>Created</dt>
                      <dd>{formatAdminTimestamp(selectedLot.createdAt)}</dd>
                    </div>
                    <div title="When this lot record was last updated. This field cannot be edited here.">
                      <dt>Updated</dt>
                      <dd>{formatAdminTimestamp(selectedLot.updatedAt)}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => void saveLotRecord(selectedLot)}
                    disabled={savingRecordKey === `lot:${selectedLot.id}` || !canEditSelectedCemetery}
                    title={canEditSelectedCemetery ? "Save this lot text." : "You have read-only access to this cemetery."}
                  >
                    {savingRecordKey === `lot:${selectedLot.id}` ? "Saving..." : "Save lot"}
                  </button>
                </article>
              ) : null}
            </div>
          </section>
        </>
      ) : activeTab === "quality" ? (
        <DataQualityAdminTab onError={setError} />
      ) : activeTab === "bulk" && canUseBulkTools ? (
        <>
          <section className="admin-section">
            <div className="section-title">
              <ListChecks size={17} aria-hidden="true" />
              <h3>Bulk Edit Tools</h3>
            </div>
            <label>
              Change reason
              <input
                value={bulkReason}
                onChange={(event) => setBulkReason(event.target.value)}
                title="Required audit reason used for all bulk edits from this tab."
              />
            </label>
          </section>

          <section className="admin-section bulk-tool-grid">
            <form className="admin-form bulk-tool-card" onSubmit={(event) => void saveBulkHeadstoneUpdate(event)}>
              <h4>Markers</h4>
              <label className="wide-field">
                Marker IDs
                <textarea
                  value={bulkMarkerIdentifiers}
                  onChange={(event) => setBulkMarkerIdentifiers(event.target.value)}
                  rows={5}
                  placeholder={"TLC-HS-0179\nTLC-HS-0180"}
                  title="Enter marker public IDs or UUIDs separated by lines, commas, semicolons, or spaces."
                />
              </label>
              <label>
                Marker type
                <select value={bulkMarkerTypeId} onChange={(event) => setBulkMarkerTypeId(event.target.value)}>
                  <option value="">No change</option>
                  {headstoneLookups.markerTypes.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Material
                <select value={bulkMarkerMaterialId} onChange={(event) => setBulkMarkerMaterialId(event.target.value)}>
                  <option value="">No change</option>
                  {headstoneLookups.materials.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Condition
                <select value={bulkMarkerConditionId} onChange={(event) => setBulkMarkerConditionId(event.target.value)}>
                  <option value="">No change</option>
                  {headstoneLookups.conditions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <div className="admin-form-actions">
                <button type="submit" disabled={savingBulkKey === "headstones" || !bulkReason.trim()}>
                  {savingBulkKey === "headstones" ? "Saving..." : "Update markers"}
                </button>
              </div>
            </form>

            <form className="admin-form bulk-tool-card" onSubmit={(event) => void saveBulkGravesiteLotAssignment(event)}>
              <h4>Gravesites</h4>
              <label className="wide-field">
                Gravesite IDs
                <textarea
                  value={bulkGravesiteIdentifiers}
                  onChange={(event) => setBulkGravesiteIdentifiers(event.target.value)}
                  rows={5}
                  placeholder={"C-0198A\nC-0198B"}
                  title="Enter gravesite public IDs or UUIDs separated by lines, commas, semicolons, or spaces."
                />
              </label>
              <label className="wide-field">
                Assign to lot
                <select value={bulkLotId} onChange={(event) => setBulkLotId(event.target.value)}>
                  <option value="">Select lot</option>
                  {cemeteryRecords.lots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.sectionId ? `${lot.sectionId}-` : ""}{lot.lotId}{lot.name ? `: ${lot.name}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="admin-form-actions">
                <button type="submit" disabled={savingBulkKey === "gravesites" || !bulkReason.trim()}>
                  {savingBulkKey === "gravesites" ? "Saving..." : "Assign lot"}
                </button>
              </div>
            </form>

            <section className="admin-form bulk-tool-card">
              <h4>NHG Readings</h4>
              <p className="bulk-tool-help">Select NHG readings on the Readings tab, then apply one of these actions.</p>
              <dl className="bulk-tool-summary">
                <div>
                  <dt>Selected</dt>
                  <dd>{selectedNorthHillsEntries.length}</dd>
                </div>
              </dl>
              <label className="wide-field">
                Shared note
                <textarea
                  value={bulkNorthHillsNote}
                  onChange={(event) => setBulkNorthHillsNote(event.target.value)}
                  rows={4}
                  placeholder="Apply this source note to selected readings"
                />
              </label>
              <div className="admin-form-actions">
                <button type="button" onClick={() => void markSelectedNorthHillsReviewed()} disabled={savingBulkKey === "northHillsReviewed" || !selectedNorthHillsEntries.length || !bulkReason.trim()}>
                  {savingBulkKey === "northHillsReviewed" ? "Saving..." : "Mark reviewed"}
                </button>
                <button type="button" className="secondary-button" onClick={() => void addNoteToSelectedNorthHillsEntries()} disabled={savingBulkKey === "northHillsNote" || !selectedNorthHillsEntries.length || !bulkNorthHillsNote.trim() || !bulkReason.trim()}>
                  {savingBulkKey === "northHillsNote" ? "Saving..." : "Apply note"}
                </button>
                <button type="button" className="secondary-button" onClick={openNorthHillsReviewTab}>
                  Go to Readings
                </button>
              </div>
            </section>
          </section>
        </>
      ) : activeTab === "lookups" ? (
        <>
          <section className="admin-section">
            <div className="section-title">
              <ListChecks size={17} aria-hidden="true" />
              <h3>Lookups</h3>
            </div>

            <div className="lookup-toolbar">
              <label>
                Lookup table
                <select
                  value={selectedLookupTable}
                  onChange={(event) => setSelectedLookupTable(event.target.value)}
                  title="Choose which controlled lookup list to maintain."
                >
                  {lookupRecords.tables.map((table) => (
                    <option key={table.table} value={table.table}>
                      {table.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="secondary-button" onClick={() => void loadLookupRecords()} disabled={isLoadingLookups} title="Reload lookup values from the database.">
                {isLoadingLookups ? "Loading..." : "Refresh"}
              </button>
              <label className="checkbox-row lookup-show-inactive" title="Show inactive lookup values in this maintenance list.">
                <input type="checkbox" checked={showInactiveLookups} onChange={(event) => setShowInactiveLookups(event.target.checked)} />
                Show inactive
              </label>
            </div>

            {isLoadingLookups ? <div className="admin-message" role="status">Loading lookup records...</div> : null}

            {selectedLookupDefinition ? (
              <>
                <div className="lookup-row-list" role="table" aria-label={`${selectedLookupDefinition.label} lookup values`}>
                  {selectedLookupRows.map((row, rowIndex) => {
                    const hasDuplicateSortOrder = duplicateLookupSortOrders.has(row.sortOrder);
                    const moveKey = `${selectedLookupTable}:move:${row.id}`;
                    const isSavingRow = savingLookupKey === `${selectedLookupTable}:${row.id}` || savingLookupKey === moveKey;
                    const sortWasRecentlyMoved = recentlyMovedLookupIds.has(row.id);

                    return (
                      <article
                        key={row.id}
                        className={`${row.isActive ? "lookup-row" : "lookup-row is-inactive"} ${selectedLookupDefinition.hasSourceFields ? "has-source-fields" : ""}`}
                        title={lookupRowTitle(row)}
                      >
                        <label className="lookup-label">
                          Label
                          <input
                            value={row.label}
                            onChange={(event) => updateLocalLookupRecord(selectedLookupTable, row.id, { label: event.target.value })}
                            title="Human-readable label shown in admin screens and future form controls."
                          />
                        </label>
                        <div className={`lookup-sort lookup-field ${sortWasRecentlyMoved ? "was-reordered" : ""}`}>
                          <span>Sort</span>
                          <div className="lookup-sort-control">
                            <input
                              type="number"
                              value={row.sortOrder}
                              onChange={(event) => updateLocalLookupRecord(selectedLookupTable, row.id, { sortOrder: Number(event.target.value) })}
                              title="Display order for this lookup value."
                            />
                            <span className="lookup-sort-buttons" aria-label={`Change sort order for ${row.label}`}>
                              <button
                                type="button"
                                className="icon-button"
                                onClick={() => void moveLookupRecord(selectedLookupTable, row, -1)}
                                disabled={rowIndex === 0 || isSavingRow}
                                title="Move this lookup value up by swapping sort order with the previous visible value."
                                aria-label={`Move ${row.label} up`}
                              >
                                <ArrowUp size={16} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className="icon-button"
                                onClick={() => void moveLookupRecord(selectedLookupTable, row, 1)}
                                disabled={rowIndex === selectedLookupRows.length - 1 || isSavingRow}
                                title="Move this lookup value down by swapping sort order with the next visible value."
                                aria-label={`Move ${row.label} down`}
                              >
                                <ArrowDown size={16} aria-hidden="true" />
                              </button>
                            </span>
                          </div>
                          {hasDuplicateSortOrder ? <small className="lookup-warning">Duplicate sort order</small> : null}
                        </div>
                      <label className="lookup-description">
                        Description
                        <textarea
                          value={row.description}
                          onChange={(event) => updateLocalLookupRecord(selectedLookupTable, row.id, { description: event.target.value })}
                          rows={selectedLookupDefinition.hasSourceFields ? 3 : 2}
                          title="Admin-facing explanation of when this value should be used."
                        />
                      </label>
                      {selectedLookupDefinition.hasSourceFields ? (
                        <>
                          <label className="lookup-source-notes">
                            Source notes
                            <textarea
                              value={row.sourceNotes ?? ""}
                              onChange={(event) => updateLocalLookupRecord(selectedLookupTable, row.id, { sourceNotes: event.target.value })}
                              rows={3}
                              title="Optional note describing where this lookup value came from."
                            />
                          </label>
                          <label className="lookup-source-url">
                            Source URL
                            <input
                              value={row.sourceUrl ?? ""}
                              onChange={(event) => updateLocalLookupRecord(selectedLookupTable, row.id, { sourceUrl: event.target.value })}
                              title="Optional source URL for this lookup value."
                            />
                          </label>
                        </>
                      ) : null}
                      <div className="lookup-usage" title={lookupUsageText(row)}>
                        {lookupUsageText(row)}
                      </div>
                      <label className="checkbox-row lookup-active" title="Inactive lookup values stay in the database for history but are hidden from active-only pickers.">
                        <input
                          type="checkbox"
                          checked={row.isActive}
                          onChange={(event) => updateLocalLookupRecord(selectedLookupTable, row.id, { isActive: event.target.checked })}
                          title="Controls whether this lookup value is active."
                        />
                        Active
                      </label>
                      <div className="lookup-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => viewLookupAudit(selectedLookupTable, row)}
                          title="Open audit log entries for this lookup value."
                          aria-label={`View audit log for ${row.label}`}
                        >
                          <History size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveLookupRecord(selectedLookupTable, row)}
                          disabled={isSavingRow || !row.label.trim() || !row.description.trim()}
                          title="Save changes to this lookup value."
                        >
                          {savingLookupKey === `${selectedLookupTable}:${row.id}` ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </article>
                    );
                  })}
                </div>

                <article
                  className={`lookup-row lookup-row-new ${selectedLookupDefinition.hasSourceFields ? "has-source-fields" : ""}`}
                  title={`Add a new value to ${selectedLookupDefinition.label}.`}
                >
                  <h4>Add lookup value</h4>
                  <label className="lookup-label">
                    Label
                    <input
                      value={newLookupRecord.label}
                      onChange={(event) => setNewLookupRecord((current) => ({ ...current, label: event.target.value }))}
                      title="Human-readable label for the new lookup value."
                    />
                  </label>
                  <label className="lookup-sort">
                    Sort
                    <input
                      type="number"
                      value={newLookupRecord.sortOrder}
                      onChange={(event) => setNewLookupRecord((current) => ({ ...current, sortOrder: Number(event.target.value) }))}
                      title="Display order for the new lookup value."
                    />
                  </label>
                  <label className="lookup-description">
                    Description
                    <textarea
                      value={newLookupRecord.description}
                      onChange={(event) => setNewLookupRecord((current) => ({ ...current, description: event.target.value }))}
                      rows={selectedLookupDefinition.hasSourceFields ? 3 : 2}
                      title="Admin-facing explanation of when this value should be used."
                    />
                  </label>
                  {selectedLookupDefinition.hasSourceFields ? (
                    <>
                      <label className="lookup-source-notes">
                        Source notes
                        <textarea
                          value={newLookupRecord.sourceNotes ?? ""}
                          onChange={(event) => setNewLookupRecord((current) => ({ ...current, sourceNotes: event.target.value }))}
                          rows={3}
                          title="Optional note describing where this lookup value came from."
                        />
                      </label>
                      <label className="lookup-source-url">
                        Source URL
                        <input
                          value={newLookupRecord.sourceUrl ?? ""}
                          onChange={(event) => setNewLookupRecord((current) => ({ ...current, sourceUrl: event.target.value }))}
                          title="Optional source URL for this lookup value."
                        />
                      </label>
                    </>
                  ) : null}
                  <label className="checkbox-row lookup-active" title="New lookup values are active by default.">
                    <input
                      type="checkbox"
                      checked={newLookupRecord.isActive}
                      onChange={(event) => setNewLookupRecord((current) => ({ ...current, isActive: event.target.checked }))}
                      title="Controls whether this new lookup value is active."
                    />
                    Active
                  </label>
                  <button
                    type="button"
                    onClick={() => void addLookupRecord()}
                    disabled={
                      savingLookupKey === `${selectedLookupTable}:new` ||
                      !newLookupRecord.label.trim() ||
                      !newLookupRecord.description.trim()
                    }
                    title="Add this lookup value."
                  >
                    {savingLookupKey === `${selectedLookupTable}:new` ? "Adding..." : "Add value"}
                  </button>
                </article>
              </>
            ) : (
              <p className="record-editor-empty">Lookup records have not been loaded yet.</p>
            )}
          </section>
        </>
      ) : activeTab === "deeds" ? (
        <DeedsAdminTab
          deedCaseFilters={deedCaseFilters}
          setDeedCaseFilters={setDeedCaseFilters}
          isLoadingDeedCases={isLoadingDeedCases}
          loadDeedCases={loadDeedCases}
          startNewDeedCase={startNewDeedCase}
          deedCases={deedCases}
          selectedDeedCaseId={selectedDeedCaseId}
          selectDeedCase={selectDeedCase}
          deedCaseForm={deedCaseForm}
          setDeedCaseForm={setDeedCaseForm}
          selectedDeedCase={selectedDeedCase}
          savingDeedCaseKey={savingDeedCaseKey}
          saveDeedCase={saveDeedCase}
          startNewDeedAction={startNewDeedAction}
          selectedDeedActionId={selectedDeedActionId}
          selectDeedAction={selectDeedAction}
          deedActionForm={deedActionForm}
          setDeedActionForm={setDeedActionForm}
          savingDeedActionKey={savingDeedActionKey}
          saveDeedAction={saveDeedAction}
          deedReviewFilters={deedReviewFilters}
          updateDeedReviewFilter={updateDeedReviewFilter}
          deedRegistryReview={deedRegistryReview}
          applyDeedReviewFilters={applyDeedReviewFilters}
          isLoadingDeedReview={isLoadingDeedReview}
          setDeedReviewFilters={setDeedReviewFilters}
          loadDeedRegistryReview={loadDeedRegistryReview}
          selectedDeedBatch={selectedDeedBatch}
          deedResearchTerms={deedResearchTerms}
          deedInvestigationOwners={deedInvestigationOwners}
          deedInvestigationLots={deedInvestigationLots}
          deedOnFileCount={deedOnFileCount}
          deedRegisterOnFileCount={deedRegisterOnFileCount}
          deedInvestigationNoteCount={deedInvestigationNoteCount}
          attachEntryToSelectedDeedCase={attachEntryToSelectedDeedCase}
          removedOriginalDeedEntries={removedOriginalDeedEntries}
        />
      ) : activeTab === "sourcePeople" ? (
        <>
          <section className="admin-section">
            <div className="section-title">
              <BookOpenText size={17} aria-hidden="true" />
              <h3>Source People</h3>
            </div>

            <form className="deed-review-filter-form" onSubmit={applySourcePersonFilters}>
              <label>
                Cemetery
                <select
                  value={sourcePersonFilters.cemeteryId ?? ""}
                  onChange={(event) => updateSourcePersonFilter({ cemeteryId: event.target.value })}
                  title="Filter source-only people by cemetery."
                >
                  <option value="">All available cemeteries</option>
                  {sourcePersonReview.cemeteries.map((cemetery) => (
                    <option key={cemetery.id} value={cemetery.id}>
                      {cemetery.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Source
                <select
                  value={sourcePersonFilters.sourceCode ?? ""}
                  onChange={(event) => updateSourcePersonFilter({ sourceCode: event.target.value })}
                  title="Filter by source code."
                >
                  <option value="">All sources</option>
                  {sourcePersonSourceOptions.map((sourceCode) => (
                    <option key={sourceCode} value={sourceCode}>
                      {sourcePersonSourceLabels[sourceCode]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  value={sourcePersonFilters.status ?? ""}
                  onChange={(event) => updateSourcePersonFilter({ status: event.target.value })}
                  title="Filter by review/link status."
                >
                  <option value="">All statuses</option>
                  {sourcePersonStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {sourcePersonStatusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Search
                <input
                  value={sourcePersonFilters.q ?? ""}
                  onChange={(event) => updateSourcePersonFilter({ q: event.target.value })}
                  placeholder="Name, page, source text, or notes"
                  title="Search names, source page numbers, raw source text, source location text, and notes."
                />
              </label>
              <label>
                Limit
                <select
                  value={sourcePersonFilters.limit ?? 50}
                  onChange={(event) => updateSourcePersonFilter({ limit: Number(event.target.value) })}
                  title="Limit the number of source-only person records returned."
                >
                  <option value={25}>25 records</option>
                  <option value={50}>50 records</option>
                  <option value={100}>100 records</option>
                  <option value={250}>250 records</option>
                </select>
              </label>
              <div className="admin-form-actions deed-review-filter-actions">
                <button type="submit" disabled={isLoadingSourcePersonRecords}>
                  {isLoadingSourcePersonRecords ? "Loading..." : "Apply filters"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setSourcePersonFilters(defaultSourcePersonFilters);
                    void loadSourcePersonRecords(defaultSourcePersonFilters);
                  }}
                >
                  Clear
                </button>
                <button type="button" className="secondary-button" onClick={startNewSourcePersonRecord}>
                  New record
                </button>
              </div>
            </form>

            {isLoadingSourcePersonRecords ? <div className="admin-message" role="status">Loading source-only people...</div> : null}

            <div className="source-person-workspace">
              <div className="source-person-list" role="table" aria-label="Source-only person records">
                {sourcePersonReview.records.length === 0 && !isLoadingSourcePersonRecords ? <p className="record-editor-empty">No source-only person records match these filters.</p> : null}
                {sourcePersonReview.records.map((record) => (
                  <article
                    key={record.id}
                    className={`source-person-row confidence-${record.confidence} ${selectedSourcePersonRecordId === record.id ? "is-selected" : ""}`}
                    title={sourcePersonRecordTitle(record)}
                  >
                    <header>
                      <div className="source-person-heading">
                        <strong>{record.fullName}</strong>
                        <small>{record.cemeteryName || "No cemetery"}</small>
                      </div>
                      <button type="button" className="deed-entry-link-button" onClick={() => startSourcePersonRecordEdit(record)}>
                        Edit
                      </button>
                    </header>
                    <dl className="source-person-meta">
                      <div>
                        <dt>Source</dt>
                        <dd>{sourcePersonSourceLabels[record.sourceCode] ?? record.sourceCode}</dd>
                      </div>
                      <div>
                        <dt>Type</dt>
                        <dd>{sourcePersonTypeLabels[record.recordType] ?? record.recordType}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{sourcePersonStatusLabels[record.status] ?? record.status}</dd>
                      </div>
                      <div>
                        <dt>Confidence</dt>
                        <dd>{sourcePersonConfidenceLabels[record.confidence] ?? record.confidence}</dd>
                      </div>
                      <div>
                        <dt>Location</dt>
                        <dd>{record.sourcePageNumber ? `Page ${record.sourcePageNumber}` : record.sourceLocationText || "No page"}</dd>
                      </div>
                    </dl>
                    <p className="deed-entry-remarks">{record.rawText}</p>
                    {record.links.length ? (
                      <ul className="deed-entry-notes" aria-label="Linked cemetery records">
                        {record.links.map((link) => (
                          <li key={link.id}>
                            {link.linkType}: {link.targetLabel || link.targetId}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                ))}
              </div>

              <form className="reading-entry-edit-form source-person-editor" onSubmit={saveSourcePersonRecord}>
                <div className="section-title">
                  <BookOpenText size={16} aria-hidden="true" />
                  <h4>{selectedSourcePersonRecord ? `Edit ${selectedSourcePersonRecord.fullName}` : "New source-only person"}</h4>
                </div>
                <div className="reading-edit-grid source-person-edit-grid">
                  <label>
                    Cemetery
                    <select value={sourcePersonForm.cemeteryId} onChange={(event) => updateSourcePersonForm({ cemeteryId: event.target.value })} required>
                      <option value="">Select cemetery</option>
                      {sourcePersonReview.cemeteries.map((cemetery) => (
                        <option key={cemetery.id} value={cemetery.id}>
                          {cemetery.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Source
                    <select value={sourcePersonForm.sourceCode} onChange={(event) => updateSourcePersonForm({ sourceCode: event.target.value as SourcePersonRecordSourceCode })}>
                      {sourcePersonSourceOptions.map((sourceCode) => (
                        <option key={sourceCode} value={sourceCode}>
                          {sourcePersonSourceLabels[sourceCode]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Record type
                    <select value={sourcePersonForm.recordType} onChange={(event) => updateSourcePersonForm({ recordType: event.target.value as SourcePersonRecordType })}>
                      {sourcePersonTypeOptions.map((recordType) => (
                        <option key={recordType} value={recordType}>
                          {sourcePersonTypeLabels[recordType]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Status
                    <select value={sourcePersonForm.status} onChange={(event) => updateSourcePersonForm({ status: event.target.value as SourcePersonRecordStatus })}>
                      {sourcePersonStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {sourcePersonStatusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Confidence
                    <select value={sourcePersonForm.confidence} onChange={(event) => updateSourcePersonForm({ confidence: event.target.value as SourcePersonRecordConfidence })}>
                      {sourcePersonConfidenceOptions.map((confidence) => (
                        <option key={confidence} value={confidence}>
                          {sourcePersonConfidenceLabels[confidence]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Page
                    <input
                      type="number"
                      min="1"
                      value={sourcePersonForm.sourcePageNumber ?? ""}
                      onChange={(event) => updateSourcePersonForm({ sourcePageNumber: event.target.value ? Number(event.target.value) : null })}
                    />
                  </label>
                  <label>
                    First name
                    <input value={sourcePersonForm.firstName} onChange={(event) => updateSourcePersonForm({ firstName: event.target.value })} />
                  </label>
                  <label>
                    Middle name
                    <input value={sourcePersonForm.middleName} onChange={(event) => updateSourcePersonForm({ middleName: event.target.value })} />
                  </label>
                  <label>
                    Last name
                    <input value={sourcePersonForm.lastName} onChange={(event) => updateSourcePersonForm({ lastName: event.target.value })} />
                  </label>
                  <label>
                    Maiden name
                    <input value={sourcePersonForm.maidenName} onChange={(event) => updateSourcePersonForm({ maidenName: event.target.value })} />
                  </label>
                  <label className="wide-field">
                    Full name
                    <input value={sourcePersonForm.fullName} onChange={(event) => updateSourcePersonForm({ fullName: event.target.value })} required />
                  </label>
                  <label>
                    Birth date
                    <input type="date" value={sourcePersonForm.birthDate ?? ""} onChange={(event) => updateSourcePersonForm({ birthDate: event.target.value })} />
                  </label>
                  <label>
                    Birth text
                    <input value={sourcePersonForm.birthDateText} onChange={(event) => updateSourcePersonForm({ birthDateText: event.target.value })} placeholder="1876 or Sept. 1876" />
                  </label>
                  <label>
                    Death date
                    <input type="date" value={sourcePersonForm.deathDate ?? ""} onChange={(event) => updateSourcePersonForm({ deathDate: event.target.value })} />
                  </label>
                  <label>
                    Death text
                    <input value={sourcePersonForm.deathDateText} onChange={(event) => updateSourcePersonForm({ deathDateText: event.target.value })} placeholder="1876 or Sept. 1876" />
                  </label>
                  <label>
                    Burial date
                    <input type="date" value={sourcePersonForm.burialDate ?? ""} onChange={(event) => updateSourcePersonForm({ burialDate: event.target.value })} />
                  </label>
                  <label>
                    Burial text
                    <input value={sourcePersonForm.burialDateText} onChange={(event) => updateSourcePersonForm({ burialDateText: event.target.value })} placeholder="1876 or Sept. 1876" />
                  </label>
                  <label>
                    Funeral date
                    <input type="date" value={sourcePersonForm.funeralDate ?? ""} onChange={(event) => updateSourcePersonForm({ funeralDate: event.target.value })} />
                  </label>
                  <label>
                    Funeral text
                    <input value={sourcePersonForm.funeralDateText} onChange={(event) => updateSourcePersonForm({ funeralDateText: event.target.value })} placeholder="1876 or Sept. 1876" />
                  </label>
                  <label>
                    Age text
                    <input value={sourcePersonForm.ageText} onChange={(event) => updateSourcePersonForm({ ageText: event.target.value })} />
                  </label>
                  <label>
                    Source label
                    <input value={sourcePersonForm.sourceLabel} onChange={(event) => updateSourcePersonForm({ sourceLabel: event.target.value })} />
                  </label>
                  <label className="wide-field">
                    Source location
                    <input value={sourcePersonForm.sourceLocationText} onChange={(event) => updateSourcePersonForm({ sourceLocationText: event.target.value })} />
                  </label>
                  <label className="wide-field">
                    Source name
                    <input value={sourcePersonForm.sourceName} onChange={(event) => updateSourcePersonForm({ sourceName: event.target.value })} required />
                  </label>
                  <label className="wide-field">
                    Raw source text
                    <textarea value={sourcePersonForm.rawText} onChange={(event) => updateSourcePersonForm({ rawText: event.target.value })} rows={4} required />
                  </label>
                  <label className="wide-field">
                    Notes
                    <textarea value={sourcePersonForm.notes} onChange={(event) => updateSourcePersonForm({ notes: event.target.value })} rows={3} />
                  </label>
                  <label className="wide-field">
                    Change reason
                    <input value={sourcePersonForm.reason} onChange={(event) => updateSourcePersonForm({ reason: event.target.value })} required />
                  </label>
                </div>
                <div className="admin-form-actions source-person-editor-actions">
                  <button type="submit" disabled={Boolean(savingSourcePersonKey) || !sourcePersonForm.cemeteryId || !sourcePersonForm.fullName.trim() || !sourcePersonForm.rawText.trim()}>
                    {savingSourcePersonKey === (selectedSourcePersonRecordId || "new") ? "Saving..." : "Save record"}
                  </button>
                  <button type="button" className="secondary-button" onClick={startNewSourcePersonRecord}>
                    Clear form
                  </button>
                  {selectedSourcePersonRecord ? (
                    <button
                      type="button"
                      className="danger-button"
                      disabled={Boolean(savingSourcePersonKey)}
                      onClick={() => void softDeleteSourcePersonRecord(selectedSourcePersonRecord)}
                    >
                      {savingSourcePersonKey === `delete:${selectedSourcePersonRecord.id}` ? "Deleting..." : "Soft delete"}
                    </button>
                  ) : null}
                </div>
              </form>
            </div>
          </section>
        </>
      ) : activeTab === "readings" ? (
        <>
          <section className="admin-section">
            <div className="section-title">
              <FileText size={17} aria-hidden="true" />
              <h3>North Hills Readings</h3>
            </div>

            <form className="deed-review-filter-form" onSubmit={applyNorthHillsReviewFilters}>
              <label>
                Import batch
                <select
                  value={northHillsReviewFilters.batchId ?? ""}
                  onChange={(event) => updateNorthHillsReviewFilter({ batchId: event.target.value })}
                  title="Choose the staged North Hills OCR import batch to review."
                >
                  <option value="">Latest batch</option>
                  {northHillsOcrReview.batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.sourceName} - {formatAdminTimestamp(batch.createdAt)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Confidence
                <select
                  value={northHillsReviewFilters.confidence ?? ""}
                  onChange={(event) => updateNorthHillsReviewFilter({ confidence: event.target.value })}
                  title="Filter OCR rows by parser confidence."
                >
                  <option value="">All confidence levels</option>
                  {Object.entries(confidenceLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Section
                <select
                  value={northHillsReviewFilters.section ?? ""}
                  onChange={(event) => updateNorthHillsReviewFilter({ section: event.target.value })}
                  title="Filter OCR readings by parsed cemetery section."
                >
                  <option value="">All sections</option>
                  {["A", "B", "C", "D", "E"].map((section) => (
                    <option key={section} value={section}>
                      Section {section}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sort
                <select
                  value={northHillsReviewFilters.sort ?? "review"}
                  onChange={(event) => updateNorthHillsReviewFilter({ sort: event.target.value as NorthHillsOcrReviewFilters["sort"] })}
                  title="Choose whether readings use the review-priority order or printed page order."
                >
                  <option value="review">Review priority</option>
                  <option value="page">Page number</option>
                </select>
              </label>
              <label>
                Search
                <input
                  value={northHillsReviewFilters.q ?? ""}
                  onChange={(event) => updateNorthHillsReviewFilter({ q: event.target.value })}
                  placeholder="Name, page number, inscription, or OCR text"
                  title="Search staged names, printed page numbers, inscriptions, and raw OCR text."
                />
              </label>
              <label>
                Limit
                <select
                  value={northHillsReviewFilters.limit ?? 100}
                  onChange={(event) => updateNorthHillsReviewFilter({ limit: Number(event.target.value) })}
                  title="Limit the number of OCR reading rows returned."
                >
                  <option value={50}>50 rows</option>
                  <option value={100}>100 rows</option>
                  <option value={250}>250 rows</option>
                </select>
              </label>
              <div className="admin-form-actions deed-review-filter-actions">
                <button type="submit" disabled={isLoadingNorthHillsReview} title="Apply North Hills reading filters.">
                  {isLoadingNorthHillsReview ? "Loading..." : "Apply filters"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setNorthHillsReviewFilters(defaultNorthHillsReviewFilters);
                    void loadNorthHillsOcrReview(defaultNorthHillsReviewFilters);
                  }}
                  title="Clear North Hills reading filters and reload the latest import batch."
                >
                  Clear
                </button>
              </div>
            </form>

            {isLoadingNorthHillsReview ? <div className="admin-message" role="status">Loading North Hills readings...</div> : null}

            {selectedNorthHillsBatch ? (
              <article className="deed-batch-summary" title="Summary of the selected staged OCR import batch.">
                <div>
                  <strong>{selectedNorthHillsBatch.sourceName}</strong>
                  <small>{selectedNorthHillsBatch.cemeteryName}</small>
                </div>
                <dl>
                  <div>
                    <dt>Rows</dt>
                    <dd>{selectedNorthHillsBatch.entryCount}</dd>
                  </div>
                  <div>
                    <dt>Review</dt>
                    <dd>{selectedNorthHillsBatch.reviewCount}</dd>
                  </div>
                  <div>
                    <dt>Candidates</dt>
                    <dd>{selectedNorthHillsBatch.matchedCount}</dd>
                  </div>
                  <div>
                    <dt>Imported</dt>
                    <dd>{formatAdminTimestamp(selectedNorthHillsBatch.createdAt)}</dd>
                  </div>
                </dl>
                {selectedNorthHillsBatch.notes ? <p>{selectedNorthHillsBatch.notes}</p> : null}
              </article>
            ) : null}

            {northHillsOcrReview.summary.length ? (
              <div className="deed-summary-grid" aria-label="North Hills readings summary">
                {northHillsOcrReview.summary.map((item) => (
                  <article key={`${item.status}:${item.parseConfidence}`} title={`${item.status} rows with ${deedConfidenceLabel(item.parseConfidence)} confidence.`}>
                    <strong>{item.count}</strong>
                    <span>{item.status}</span>
                    <small>{deedConfidenceLabel(item.parseConfidence)}</small>
                  </article>
                ))}
              </div>
            ) : null}

            {canEditNorthHillsEntries ? (
              <div className="bulk-selection-toolbar" aria-label="Selected North Hills reading actions">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={visibleNorthHillsEntryIds.length > 0 && visibleNorthHillsEntryIds.every((id) => selectedNorthHillsEntryIds.has(id))}
                    onChange={toggleVisibleNorthHillsEntries}
                  />
                  Select visible
                </label>
                <span>{selectedNorthHillsEntries.length} selected</span>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void markSelectedNorthHillsReviewed()}
                  disabled={!selectedNorthHillsEntries.length || Boolean(savingBulkKey)}
                  title="Mark the selected NHG readings as reviewed."
                >
                  Mark reviewed
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={openBulkToolsTab}
                  disabled={!selectedNorthHillsEntries.length}
                  title="Open Bulk tools to apply a shared source note to selected readings."
                >
                  Bulk note
                </button>
              </div>
            ) : null}

            <div className="deed-entry-list" role="table" aria-label="Staged North Hills readings">
              {northHillsOcrReview.entries.length === 0 && !isLoadingNorthHillsReview ? <p className="record-editor-empty">No North Hills readings match these filters.</p> : null}
              {northHillsOcrReview.entries.map((entry) => {
                const processingSummary = entry.processingSummary;
                return (
                <article key={entry.id} className={`deed-entry-row confidence-${entry.parseConfidence}`} title={readingEntryTitle(entry)}>
                  <header>
                    {canEditNorthHillsEntries ? (
                      <label className="reading-select-checkbox" title="Select this NHG reading for bulk actions.">
                        <input
                          type="checkbox"
                          checked={selectedNorthHillsEntryIds.has(entry.id)}
                          onChange={() => toggleNorthHillsEntrySelection(entry.id)}
                        />
                        <span className="sr-only">Select {entry.nameText || "NHG reading"}</span>
                      </label>
                    ) : null}
                    <span>
                      <strong>Page {entry.sourcePageNumber ?? entry.sourcePageIndex}</strong>
                      <small>Lines {entry.sourceLineStart}-{entry.sourceLineEnd}</small>
                    </span>
                    <span>
                      <strong>{entry.nameText || "Unnamed reading"}</strong>
                      <small>{deedConfidenceLabel(entry.parseConfidence)}</small>
                    </span>
                    <span>
                      <strong>{entry.candidateMatchCount} possible match{entry.candidateMatchCount === 1 ? "" : "es"}</strong>
                      <small>{entry.status}</small>
                    </span>
                    <span className={`reading-processing-status ${processingSummary.isProcessed ? "processed" : "pending"}`} title={processingSummary.detail}>
                      <strong>{processingSummary.label}</strong>
                      <small>{processingSummary.totalCount ? `${processingSummary.totalCount - processingSummary.pendingCount}/${processingSummary.totalCount} handled` : "Nothing to review"}</small>
                    </span>
                    {canEditNorthHillsEntries ? (
                      <span className="reading-entry-header-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => startNorthHillsEntryEdit(entry)}
                          disabled={Boolean(savingEvidenceKey)}
                          title="Edit this staged North Hills reading, parsed fields, source facts, and observations."
                        >
                          Edit
                        </button>
                      </span>
                    ) : null}
                  </header>
                  <dl className="deed-entry-fields">
                    <div title="Parsed section, row, and position from the North Hills coordinate.">
                      <dt>Location</dt>
                      <dd>
                        {entry.parsedSectionName ? `Section ${entry.parsedSectionName}` : "Unknown"}
                        {entry.parsedRowNumber ? `, row ${entry.parsedRowNumber}` : ""}
                        {entry.parsedPositionNumber ? `, #${entry.parsedPositionNumber}` : ""}
                      </dd>
                    </div>
                    <div title="Marker type text parsed from the OCR descriptor.">
                      <dt>Marker</dt>
                      <dd>{entry.markerTypeText || "Unknown"}</dd>
                    </div>
                    <div title="Material text parsed from the OCR descriptor.">
                      <dt>Material</dt>
                      <dd>{entry.materialText || "Unknown"}</dd>
                    </div>
                    <div title="Condition text parsed from the OCR descriptor.">
                      <dt>Condition</dt>
                      <dd>{entry.conditionText || "Unknown"}</dd>
                    </div>
                    <div title="Four-digit years detected in the OCR reading.">
                      <dt>Years</dt>
                      <dd>{entry.parsedYears.length ? entry.parsedYears.join(", ") : "None"}</dd>
                    </div>
                    <div title="Surnames parsed from the reading heading.">
                      <dt>Surnames</dt>
                      <dd>{formatList(entry.surnames)}</dd>
                    </div>
                  </dl>
                  {entry.rawText ? <p className="deed-entry-remarks">{entry.rawText}</p> : null}
                  {entry.parseNotes.length ? (
                    <ul className="deed-entry-notes" aria-label="Parser notes">
                      {entry.parseNotes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  ) : null}
                  {entry.observations.length ? (
                    <section className="deed-investigation-links" aria-label="North Hills observations">
                      <h4>Observations</h4>
                      {entry.observations.map((observation) => (
                        <article key={observation.id} className="reading-match-review">
                          <p>
                            <strong>{observationTypeLabels[observation.observationType]}:</strong> {observation.observationText}
                          </p>
                          <small>{observationStatusLabels[observation.status]}</small>
                        </article>
                      ))}
                    </section>
                  ) : null}
                  {editingNorthHillsEntryId === entry.id && northHillsEntryForm ? (
                    <form className="reading-entry-edit-form" onSubmit={saveNorthHillsEntryEdit}>
                      <div className="section-title">
                        <FileText size={16} aria-hidden="true" />
                        <h4>Edit NHG Entry</h4>
                      </div>
                      <label className="wide-field">
                        Raw entry text
                        <textarea
                          value={northHillsEntryForm.rawText}
                          onChange={(event) => updateNorthHillsEntryForm({ rawText: event.target.value })}
                          rows={5}
                        />
                      </label>
                      <div className="reading-edit-grid">
                        <label>
                          Name
                          <input value={northHillsEntryForm.nameText} onChange={(event) => updateNorthHillsEntryForm({ nameText: event.target.value })} />
                        </label>
                        <label>
                          Surnames
                          <input value={northHillsEntryForm.surnamesText} onChange={(event) => updateNorthHillsEntryForm({ surnamesText: event.target.value })} />
                        </label>
                        <label>
                          Page
                          <input
                            type="number"
                            value={northHillsEntryForm.sourcePageNumber ?? ""}
                            onChange={(event) => updateNorthHillsEntryForm({ sourcePageNumber: event.target.value ? Number(event.target.value) : null })}
                          />
                        </label>
                        <label>
                          Line start
                          <input
                            type="number"
                            value={northHillsEntryForm.sourceLineStart ?? ""}
                            onChange={(event) => updateNorthHillsEntryForm({ sourceLineStart: event.target.value ? Number(event.target.value) : null })}
                          />
                        </label>
                        <label>
                          Line end
                          <input
                            type="number"
                            value={northHillsEntryForm.sourceLineEnd ?? ""}
                            onChange={(event) => updateNorthHillsEntryForm({ sourceLineEnd: event.target.value ? Number(event.target.value) : null })}
                          />
                        </label>
                        <label>
                          Section
                          <input value={northHillsEntryForm.parsedSectionName} onChange={(event) => updateNorthHillsEntryForm({ parsedSectionName: event.target.value.toUpperCase() })} />
                        </label>
                        <label>
                          Row
                          <input
                            type="number"
                            value={northHillsEntryForm.parsedRowNumber ?? ""}
                            onChange={(event) => updateNorthHillsEntryForm({ parsedRowNumber: event.target.value ? Number(event.target.value) : null })}
                          />
                        </label>
                        <label>
                          Position
                          <input
                            type="number"
                            value={northHillsEntryForm.parsedPositionNumber ?? ""}
                            onChange={(event) => updateNorthHillsEntryForm({ parsedPositionNumber: event.target.value ? Number(event.target.value) : null })}
                          />
                        </label>
                        <label>
                          Scope
                          <select value={northHillsEntryForm.parsedMarkerScope} onChange={(event) => updateNorthHillsEntryForm({ parsedMarkerScope: event.target.value })}>
                            {markerScopeOptions.map((scope) => (
                              <option key={scope || "blank"} value={scope}>
                                {scope || "Not recorded"}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Marker
                          <input value={northHillsEntryForm.markerTypeText} onChange={(event) => updateNorthHillsEntryForm({ markerTypeText: event.target.value })} />
                        </label>
                        <label>
                          Material
                          <input value={northHillsEntryForm.materialText} onChange={(event) => updateNorthHillsEntryForm({ materialText: event.target.value })} />
                        </label>
                        <label>
                          Condition
                          <input value={northHillsEntryForm.conditionText} onChange={(event) => updateNorthHillsEntryForm({ conditionText: event.target.value })} />
                        </label>
                        <label>
                          Years
                          <input value={northHillsEntryForm.parsedYearsText} onChange={(event) => updateNorthHillsEntryForm({ parsedYearsText: event.target.value })} />
                        </label>
                        <label>
                          Confidence
                          <select value={northHillsEntryForm.parseConfidence} onChange={(event) => updateNorthHillsEntryForm({ parseConfidence: event.target.value })}>
                            {Object.entries(confidenceLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Status
                          <select value={northHillsEntryForm.status} onChange={(event) => updateNorthHillsEntryForm({ status: event.target.value })}>
                            {entryStatusOptions.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="wide-field">
                        Inscription text
                        <textarea
                          value={northHillsEntryForm.inscriptionText}
                          onChange={(event) => updateNorthHillsEntryForm({ inscriptionText: event.target.value })}
                          rows={3}
                        />
                      </label>
                      <label className="wide-field">
                        Parser notes
                        <textarea
                          value={northHillsEntryForm.parseNotesText}
                          onChange={(event) => updateNorthHillsEntryForm({ parseNotesText: event.target.value })}
                          rows={2}
                        />
                      </label>
                      <section className="reading-edit-subsection">
                        <div className="reading-edit-subsection-title">
                          <h5>CR/CRG source facts</h5>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => updateNorthHillsEntryForm({ sourceFacts: [...northHillsEntryForm.sourceFacts, blankNorthHillsSourceFact()] })}
                          >
                            Add fact
                          </button>
                        </div>
                        {northHillsEntryForm.sourceFacts.map((fact, index) => (
                          <div key={fact.id || `new-fact-${index}`} className="reading-edit-repeat-row">
                            <select value={fact.sourceCode} onChange={(event) => updateNorthHillsSourceFactForm(index, { sourceCode: event.target.value as "CR" | "CRG" })}>
                              <option value="CR">CR</option>
                              <option value="CRG">CRG</option>
                            </select>
                            <select value={fact.factType} onChange={(event) => updateNorthHillsSourceFactForm(index, { factType: event.target.value as NorthHillsSourceFact["factType"] })}>
                              {Object.entries(sourceFactTypeLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <input value={fact.factValue} onChange={(event) => updateNorthHillsSourceFactForm(index, { factValue: event.target.value })} placeholder="Value" />
                            <input type="date" value={fact.factDate ?? ""} onChange={(event) => updateNorthHillsSourceFactForm(index, { factDate: event.target.value })} />
                            <select value={fact.confidence} onChange={(event) => updateNorthHillsSourceFactForm(index, { confidence: event.target.value as NorthHillsSourceFact["confidence"] })}>
                              {Object.entries(confidenceLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <select value={fact.status} onChange={(event) => updateNorthHillsSourceFactForm(index, { status: event.target.value as NorthHillsSourceFactStatus })}>
                              {Object.entries(sourceFactStatusLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <textarea value={fact.rawText} onChange={(event) => updateNorthHillsSourceFactForm(index, { rawText: event.target.value })} placeholder="Raw source text" rows={2} />
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => updateNorthHillsEntryForm({ sourceFacts: northHillsEntryForm.sourceFacts.filter((_, factIndex) => factIndex !== index) })}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </section>
                      <section className="reading-edit-subsection">
                        <div className="reading-edit-subsection-title">
                          <h5>Observations</h5>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => updateNorthHillsEntryForm({ observations: [...northHillsEntryForm.observations, blankNorthHillsObservation()] })}
                          >
                            Add observation
                          </button>
                        </div>
                        {northHillsEntryForm.observations.map((observation, index) => (
                          <div key={observation.id || `new-observation-${index}`} className="reading-edit-repeat-row reading-edit-observation-row">
                            <select
                              value={observation.observationType}
                              onChange={(event) => updateNorthHillsObservationForm(index, { observationType: event.target.value as NorthHillsOcrObservation["observationType"] })}
                            >
                              {Object.entries(observationTypeLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <select value={observation.status} onChange={(event) => updateNorthHillsObservationForm(index, { status: event.target.value as NorthHillsOcrObservation["status"] })}>
                              {Object.entries(observationStatusLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <textarea
                              value={observation.observationText}
                              onChange={(event) => updateNorthHillsObservationForm(index, { observationText: event.target.value })}
                              rows={2}
                            />
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => updateNorthHillsEntryForm({ observations: northHillsEntryForm.observations.filter((_, observationIndex) => observationIndex !== index) })}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </section>
                      <label className="wide-field">
                        Change reason
                        <input value={northHillsEntryForm.reason} onChange={(event) => updateNorthHillsEntryForm({ reason: event.target.value })} />
                      </label>
                      <div className="admin-form-actions">
                        <button type="submit" disabled={savingEvidenceKey === `${entry.id}:entry-edit`}>
                          {savingEvidenceKey === `${entry.id}:entry-edit` ? "Saving..." : "Save entry"}
                        </button>
                        <button type="button" className="secondary-button" onClick={cancelNorthHillsEntryEdit}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : null}
                  {entry.sourceFacts.length ? (
                    <section className="deed-investigation-links" aria-label="Church record source facts">
                      <h4>Church record facts</h4>
                      {entry.sourceFacts.map((fact) => {
                        const factReviewed = fact.status === "reviewed";
                        const factRejected = fact.status === "rejected";
                        return (
                        <article key={fact.id} className="reading-match-review">
                          <p>
                            <strong>{fact.sourceCode} {sourceFactTypeLabels[fact.factType]}:</strong> {fact.factValue}
                            {fact.factDate ? ` (${fact.factDate})` : ""}
                          </p>
                          <small>
                            {fact.sourceLabel} · {sourceFactStatusLabels[fact.status] ?? fact.status} · {deedConfidenceLabel(fact.confidence)}
                            {fact.reviewedByEmail ? ` · ${fact.reviewedByEmail}` : ""}
                          </small>
                          {fact.rawText ? <p className="deed-entry-remarks">{fact.rawText}</p> : null}
                          {fact.reviewNotes ? <p className="deed-entry-remarks">{fact.reviewNotes}</p> : null}
                          <div className="reading-match-actions">
                            {fact.status !== "promoted" ? (
                              <>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  disabled={Boolean(savingEvidenceKey) || factReviewed}
                                  onClick={() => void saveNorthHillsSourceFactReview(fact, "reviewed")}
                                  title={factReviewed ? "This church record fact is already reviewed." : "Mark this church record fact as reviewed."}
                                >
                                  Mark reviewed
                                </button>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  disabled={Boolean(savingEvidenceKey) || factRejected}
                                  onClick={() => void saveNorthHillsSourceFactReview(fact, "rejected")}
                                  title={factRejected ? "This church record fact is already rejected." : "Reject this church record fact."}
                                >
                                  Reject fact
                                </button>
                              </>
                            ) : null}
                            {fact.factType === "death_date" && fact.status !== "promoted"
                              ? entry.candidateMatches.map((match) => (
                                  <button
                                    key={`${fact.id}:${match.burialId}`}
                                    type="button"
                                    className="secondary-button"
                                    disabled={Boolean(savingEvidenceKey) || fact.promotedBurialId === match.burialId}
                                    onClick={() => void promoteNorthHillsDeathDate(fact, match)}
                                    title={`Promote this church record death date to ${match.fullName || match.gravesiteId}.`}
                                  >
                                    Promote to {match.fullName || match.gravesiteId}
                                  </button>
                                ))
                              : null}
                          </div>
                        </article>
                        );
                      })}
                    </section>
                  ) : null}
                  {entry.candidateMatches.length ? (
                    <section className="deed-investigation-links" aria-label="Possible existing burial matches">
                      <h4>Possible existing matches</h4>
                      {entry.candidateMatches.map((match) => {
                        const gravesiteLinked = hasNorthHillsEvidenceStatus(match.gravesiteEvidence, "linked");
                        const gravesiteRejected = hasNorthHillsEvidenceStatus(match.gravesiteEvidence, "rejected");
                        const gravesiteNeedsFieldCheck = hasNorthHillsEvidenceStatus(match.gravesiteEvidence, "needs_field_check");
                        return (
                        <article key={`${entry.id}:${match.burialId}`} className="reading-match-review">
                          <p>
                            <strong>{match.fullName || "Unnamed burial"}:</strong> {match.gravesiteId} · Section {match.sectionId} · score {match.score}
                          </p>
                          {match.gravesiteEvidence.length ? (
                            <small>
                              Gravesite review:{" "}
                              {match.gravesiteEvidence.map((evidence) => evidenceStatusLabels[evidence.status] ?? evidence.status).join(", ")}
                            </small>
                          ) : null}
                          <div className="reading-match-actions">
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={Boolean(savingEvidenceKey) || gravesiteLinked}
                              onClick={() => void saveNorthHillsEvidence(entry.id, "gravesite", match.gravesiteUuid, "linked", `gravesite ${match.gravesiteId}`)}
                              title={gravesiteLinked ? "This North Hills reading is already linked to this gravesite." : "Confirm this North Hills reading belongs to this gravesite."}
                            >
                              Link gravesite
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={Boolean(savingEvidenceKey) || gravesiteRejected}
                              onClick={() => void saveNorthHillsEvidence(entry.id, "gravesite", match.gravesiteUuid, "rejected", `gravesite ${match.gravesiteId}`)}
                              title={gravesiteRejected ? "This possible gravesite match is already rejected." : "Reject this possible gravesite match."}
                            >
                              Reject match
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={Boolean(savingEvidenceKey) || gravesiteNeedsFieldCheck}
                              onClick={() => void saveNorthHillsEvidence(entry.id, "gravesite", match.gravesiteUuid, "needs_field_check", `gravesite ${match.gravesiteId}`)}
                              title={gravesiteNeedsFieldCheck ? "This possible gravesite match is already marked for field review." : "Mark this possible match for field review."}
                            >
                              Needs field check
                            </button>
                            {canUnlinkNorthHillsEvidence && match.gravesiteEvidence.length ? (
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={Boolean(savingEvidenceKey)}
                                onClick={() => void unlinkNorthHillsEvidence(entry.id, "gravesite", match.gravesiteUuid, `gravesite ${match.gravesiteId}`)}
                                title="Remove this North Hills reading from this gravesite."
                              >
                                Unlink gravesite
                              </button>
                            ) : null}
                          </div>
                          {match.headstoneCandidates.length ? (
                            <div className="reading-headstone-candidates">
                              {match.headstoneCandidates.map((headstone) => {
                                const headstoneLinked = hasNorthHillsEvidenceStatus(headstone.evidence, "linked");
                                const headstoneRejected = hasNorthHillsEvidenceStatus(headstone.evidence, "rejected");
                                const headstoneNeedsFieldCheck = hasNorthHillsEvidenceStatus(headstone.evidence, "needs_field_check");
                                return (
                                <span key={headstone.id}>
                                  <strong>{headstone.headstoneId}</strong>
                                  {headstone.evidence.length ? ` (${headstone.evidence.map((evidence) => evidenceStatusLabels[evidence.status] ?? evidence.status).join(", ")})` : ""}
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    disabled={Boolean(savingEvidenceKey) || headstoneLinked}
                                    onClick={() => void saveNorthHillsEvidence(entry.id, "headstone", headstone.id, "linked", `headstone ${headstone.headstoneId}`)}
                                    title={headstoneLinked ? "This North Hills reading is already linked to this headstone." : "Confirm this North Hills reading belongs to this headstone."}
                                  >
                                    Link headstone
                                  </button>
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    disabled={Boolean(savingEvidenceKey) || headstoneRejected}
                                    onClick={() => void saveNorthHillsEvidence(entry.id, "headstone", headstone.id, "rejected", `headstone ${headstone.headstoneId}`)}
                                    title={headstoneRejected ? "This possible headstone match is already rejected." : "Reject this possible headstone match."}
                                  >
                                    Reject headstone
                                  </button>
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    disabled={Boolean(savingEvidenceKey) || headstoneNeedsFieldCheck}
                                    onClick={() => void saveNorthHillsEvidence(entry.id, "headstone", headstone.id, "needs_field_check", `headstone ${headstone.headstoneId}`)}
                                    title={headstoneNeedsFieldCheck ? "This possible headstone match is already marked for field review." : "Mark this possible headstone match for field review."}
                                  >
                                    Field check
                                  </button>
                                  {canUnlinkNorthHillsEvidence && headstone.evidence.length ? (
                                    <button
                                      type="button"
                                      className="secondary-button"
                                      disabled={Boolean(savingEvidenceKey)}
                                      onClick={() => void unlinkNorthHillsEvidence(entry.id, "headstone", headstone.id, `headstone ${headstone.headstoneId}`)}
                                      title="Remove this North Hills reading from this headstone."
                                    >
                                      Unlink headstone
                                    </button>
                                  ) : null}
                                </span>
                                );
                              })}
                            </div>
                          ) : null}
                        </article>
                        );
                      })}
                    </section>
                  ) : null}
                </article>
                );
              })}
            </div>
          </section>
        </>
      ) : activeTab === "system" ? (
        <SystemEventsAdminTab onError={setError} onMessage={setMessage} />
      ) : (
        <AuditAdminTab seedFilters={auditSeedFilters} onError={setError} onMessage={setMessage} />
      )}
        </div>
      </div>
    </aside>
  );
}
