export type NorthHillsOcrImportBatch = {
  id: string;
  cemeteryName: string;
  sourceName: string;
  importedBy: string;
  notes: string;
  createdAt: string;
  entryCount: number;
  reviewCount: number;
  lowConfidenceCount: number;
  matchedCount: number;
};

export type NorthHillsOcrSummaryItem = {
  parseConfidence: string;
  status: string;
  count: number;
};

export type NorthHillsOcrCandidateMatch = {
  burialId: string;
  gravesiteUuid: string;
  gravesiteId: string;
  graveId: string;
  sectionId: string;
  fullName: string;
  birthDate?: string;
  deathDate?: string;
  score: number;
  notes: string;
  gravesiteEvidence: NorthHillsOcrEvidenceLink[];
  headstoneCandidates: NorthHillsOcrHeadstoneCandidate[];
};

export type NorthHillsOcrEvidenceStatus = "linked" | "rejected" | "needs_field_check";
export type NorthHillsSourceFactStatus = "staged" | "reviewed" | "promoted" | "rejected";
export type NorthHillsObservationType = "plot_marker" | "gap" | "marker_observation" | "entry_note";
export type NorthHillsObservationStatus = "staged" | "reviewed" | "rejected";

export type NorthHillsOcrEvidenceLink = {
  id: string;
  status: NorthHillsOcrEvidenceStatus;
  confidence: string;
  notes: string;
  reviewedByEmail: string;
  reviewedAt: string;
};

export type NorthHillsOcrHeadstoneCandidate = {
  id: string;
  headstoneId: string;
  evidence: NorthHillsOcrEvidenceLink[];
};

export type NorthHillsProcessingSummary = {
  isProcessed: boolean;
  pendingCount: number;
  totalCount: number;
  label: string;
  detail: string;
};

export type SaveNorthHillsOcrEvidenceInput = {
  targetType: "headstone" | "gravesite";
  targetId: string;
  status: NorthHillsOcrEvidenceStatus;
  confidence: "high" | "medium" | "low" | "review";
  notes: string;
};

export type NorthHillsSourceFact = {
  id: string;
  entryId: string;
  sourceCode: "CR" | "CRG";
  sourceLabel: string;
  factType: "death_date" | "middle_initial" | "age_at_death" | "note";
  factValue: string;
  factDate?: string;
  rawText: string;
  reviewNotes?: string;
  confidence: "high" | "medium" | "low" | "review";
  status: NorthHillsSourceFactStatus;
  promotedBurialId?: string;
  reviewedByEmail?: string;
  reviewedAt?: string;
};

export type ReviewNorthHillsSourceFactInput = {
  status: Exclude<NorthHillsSourceFactStatus, "promoted">;
  confidence: "high" | "medium" | "low" | "review";
  notes: string;
};

export type PromoteNorthHillsSourceFactInput = {
  burialId: string;
  notes: string;
  reason: string;
};

export type NorthHillsOcrObservation = {
  id: string;
  entryId: string;
  observationType: NorthHillsObservationType;
  observationText: string;
  status: NorthHillsObservationStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type SaveNorthHillsSourceFactInput = {
  id?: string;
  sourceCode: "CR" | "CRG";
  factType: NorthHillsSourceFact["factType"];
  factValue: string;
  factDate?: string;
  rawText: string;
  confidence: NorthHillsSourceFact["confidence"];
  status: NorthHillsSourceFactStatus;
  reviewNotes?: string;
};

export type SaveNorthHillsOcrObservationInput = {
  id?: string;
  observationType: NorthHillsObservationType;
  observationText: string;
  status: NorthHillsObservationStatus;
};

export type SaveNorthHillsOcrEntryInput = {
  sourcePageNumber?: number | null;
  sourceLineStart?: number | null;
  sourceLineEnd?: number | null;
  rawText: string;
  nameText: string;
  surnames: string[];
  parsedSectionName: string;
  parsedRowNumber?: number | null;
  parsedPositionNumber?: number | null;
  parsedMarkerScope: string;
  markerTypeText: string;
  materialText: string;
  conditionText: string;
  inscriptionText: string;
  parsedYears: number[];
  parseConfidence: string;
  parseNotes: string[];
  status: string;
  sourceEntry?: Record<string, unknown>;
  sourceFacts: SaveNorthHillsSourceFactInput[];
  observations: SaveNorthHillsOcrObservationInput[];
  reason: string;
};

export type BulkEditResult = {
  requestedCount: number;
  matchedCount: number;
  updatedCount: number;
  notFound: string[];
};

export type NorthHillsOcrReviewEntry = {
  id: string;
  batchId: string;
  sourcePageNumber?: number;
  sourcePageIndex: number;
  sourceLineStart: number;
  sourceLineEnd: number;
  nameText: string;
  surnames: string[];
  rawText: string;
  parsedSectionName: string;
  parsedRowNumber?: number;
  parsedPositionNumber?: number;
  parsedMarkerScope: string;
  markerTypeText: string;
  materialText: string;
  conditionText: string;
  inscriptionText: string;
  parsedYears: number[];
  parseConfidence: string;
  parseNotes: string[];
  status: string;
  candidateMatchCount: number;
  candidateMatches: NorthHillsOcrCandidateMatch[];
  sourceFacts: NorthHillsSourceFact[];
  observations: NorthHillsOcrObservation[];
  processingSummary: NorthHillsProcessingSummary;
};

export type NorthHillsOcrReviewFilters = {
  batchId?: string;
  confidence?: string;
  status?: string;
  section?: string;
  sort?: "review" | "page" | "";
  q?: string;
  limit?: number;
};

export type NorthHillsOcrReview = {
  batches: NorthHillsOcrImportBatch[];
  selectedBatchId: string;
  summary: NorthHillsOcrSummaryItem[];
  entries: NorthHillsOcrReviewEntry[];
};

