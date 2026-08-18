export type DeedRegistryImportBatch = {
  id: string;
  cemeteryName: string;
  sourceName: string;
  worksheetName: string;
  importedBy: string;
  notes: string;
  createdAt: string;
  entryCount: number;
  reviewCount: number;
  lowConfidenceCount: number;
};

export type DeedRegistrySummaryItem = {
  ownershipScope: string;
  parseConfidence: string;
  count: number;
};

export type DeedRegistryInvestigationNote = {
  sourceRowNumber: number;
  ownerDisplayName: string;
  rawRemarks: string;
};

export type DeedRegistryComparisonStatus = "added" | "changed" | "unchanged" | "";

export type DeedRegistryComparisonSummary = {
  originalBatchId: string;
  originalBatchLabel: string;
  addedCount: number;
  changedCount: number;
  unchangedCount: number;
  removedCount: number;
};

export type DeedRegistryRemovedOriginalEntry = {
  id: string;
  sourceRowNumber: number;
  ownerDisplayName: string;
  rawLotText: string;
  rawSectionText: string;
  rawRemarks: string;
  parsedLotNumbers: string[];
};

export type DeedRegistryReviewEntry = {
  id: string;
  batchId: string;
  sourceRowNumber: number;
  rowType: string;
  ownerDisplayName: string;
  rawLotText: string;
  rawSectionText: string;
  lastKnownDate: string;
  modernSection: string;
  correctedLotText: string;
  correctedLastKnownDate: string;
  mappingUpdatedBy: string;
  mappingUpdatedAt?: string;
  rawRemarks: string;
  correctedRemarks: string;
  deedOnFile: string;
  deedRegisterOnFile: string;
  parsedSectionName: string;
  parsedSectionAlias: string;
  parsedLotNumbers: string[];
  parsedPlotNumbers: string[];
  parsedGraveNumbers: string[];
  parsedGraveCount?: number;
  ownershipScope: string;
  parseConfidence: string;
  parseNotes: string[];
  status: string;
  allocationCount: number;
  relatedInvestigationNotes: DeedRegistryInvestigationNote[];
  comparisonStatus: DeedRegistryComparisonStatus;
  originalSourceRowNumber?: number;
  originalRawLotText: string;
  originalRawSectionText: string;
  originalRawRemarks: string;
};

export type DeedRegistryReviewFilters = {
  batchId?: string;
  confidence?: string;
  ownershipScope?: string;
  q?: string;
  limit?: number;
};

export type DeedRegistryReview = {
  batches: DeedRegistryImportBatch[];
  selectedBatchId: string;
  summary: DeedRegistrySummaryItem[];
  comparison: DeedRegistryComparisonSummary | null;
  removedOriginalEntries: DeedRegistryRemovedOriginalEntry[];
  entries: DeedRegistryReviewEntry[];
};

export type SaveDeedRegistryMappingInput = {
  modernSection: string;
  correctedLotText: string;
  correctedLastKnownDate: string;
  correctedRemarks: string;
  reason: string;
};

export type DeedInvestigationStatus = "open" | "researching" | "awaiting_family" | "awaiting_council" | "approved" | "denied" | "closed";
export type DeedInvestigationAffidavitStatus = "not_needed" | "needed" | "sent" | "received" | "waived";
export type DeedInvestigationActionType =
  | "issue_deed"
  | "replacement_deed"
  | "inter_ashes"
  | "approve_marker"
  | "deny_request"
  | "document_only"
  | "other";
export type DeedInvestigationCouncilStatus = "not_submitted" | "recommended" | "submitted" | "approved" | "denied" | "not_required";
export type DeedInvestigationDeedStatus = "not_started" | "pending" | "issued" | "not_issued" | "not_applicable";

export type DeedInvestigationLinkedEntry = {
  id: string;
  sourceRowNumber: number;
  ownerDisplayName: string;
  rawLotText: string;
  rawSectionText: string;
  rawRemarks: string;
  note: string;
};

export type DeedInvestigationAction = {
  id: string;
  caseId: string;
  subjectName: string;
  actionType: DeedInvestigationActionType;
  plotReference: string;
  councilStatus: DeedInvestigationCouncilStatus;
  councilDecisionDate: string;
  councilDocumentReference: string;
  affidavitStatus: DeedInvestigationAffidavitStatus;
  deedStatus: DeedInvestigationDeedStatus;
  outcome: string;
  notes: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type DeedInvestigationCase = {
  id: string;
  cemeteryId: string;
  cemeteryName: string;
  caseNumber: string;
  status: DeedInvestigationStatus;
  subjectName: string;
  requesterName: string;
  requesterContact: string;
  plotReference: string;
  requestSummary: string;
  familySummary: string;
  findings: string;
  councilDecision: string;
  affidavitStatus: DeedInvestigationAffidavitStatus;
  outcome: string;
  openedAt: string;
  closedAt: string;
  createdAt: string;
  updatedAt: string;
  linkedEntryCount: number;
  linkedEntries: DeedInvestigationLinkedEntry[];
  recommendedActions: DeedInvestigationAction[];
};

export type SaveDeedInvestigationCaseInput = Omit<
  DeedInvestigationCase,
  "id" | "cemeteryName" | "createdAt" | "updatedAt" | "linkedEntryCount" | "linkedEntries" | "recommendedActions"
> & {
  reason?: string;
};

export type SaveDeedInvestigationActionInput = Omit<DeedInvestigationAction, "id" | "caseId" | "createdAt" | "updatedAt"> & {
  reason?: string;
};

