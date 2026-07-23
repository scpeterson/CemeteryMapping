export type GraveStatus = "available" | "reserved" | "occupied" | "sold" | "needs_review" | "unknown";
export type AppRoleName = "reader" | "power-user" | "cemetery-admin" | "admin";
export type AreaGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;
export type GeometryType = "evidence" | "operational" | "schematic";
export type GeometryConfidence = "gps" | "surveyed" | "reviewed" | "estimated" | "draft" | "unknown";
export type DataConfidence = "unknown" | "low" | "medium" | "high";
export type DataReviewStatus = "unreviewed" | "needs_review" | "reviewed" | "conflict";

export type AppVersion = {
  version: string;
  gitSha: string;
  buildTime: string;
  environment: string;
};

export type AuditRetentionPolicy = {
  retentionDays: number;
  minimumProtectedDays: number;
  batchSize: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AuditRetentionPurgeResult = {
  retentionDays: number;
  batchSize: number;
  isEnabled: boolean;
  cutoffAt: string;
  selectedCount: number;
  deletedCount: number;
  durationMs?: number;
};

export type SystemEventRetentionPolicy = {
  retentionDays: number;
  minimumProtectedDays: number;
  batchSize: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SystemEventRetentionPurgeResult = AuditRetentionPurgeResult;

export type SystemEventType = "error" | "warning" | "job_run" | "health_check" | "integration_failure";
export type SystemEventSeverity = "info" | "warning" | "error" | "critical";

export type SystemEvent = {
  id: string;
  occurredAt: string;
  eventType: SystemEventType;
  severity: SystemEventSeverity;
  source: string;
  status: string;
  message: string;
  detail: string;
  requestMethod: string;
  requestPath: string;
  responseStatus?: number;
  actorEmail: string;
  actorRole: string;
  environment: string;
  appVersion: string;
  durationMs?: number;
  metadata: Record<string, unknown>;
};

export type SystemEventFilters = {
  eventType?: string;
  severity?: string;
  source?: string;
  status?: string;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

export type Person = {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  maidenName?: string;
  birthDate?: string;
  deathDate?: string;
};

export type Owner = {
  id: string;
  displayName: string;
  contactNote?: string;
};

export type VerifiedPlace = {
  id: string;
  displayName: string;
  locality: string;
  administrativeArea: string;
  countryName: string;
  countryCode: string;
  authorityName: string;
  authorityIdentifier: string;
  authorityUrl: string;
  verificationStatus: "verified" | "pending" | "rejected";
};

export type GeographicPlaceCandidate = {
  provider: "geonames";
  providerId: string;
  displayName: string;
  locality: string;
  administrativeArea: string;
  countryName: string;
  countryCode: string;
  featureClass: string;
  featureCode: string;
  latitude: number;
  longitude: number;
  authorityName: string;
  authorityIdentifier: string;
  authorityUrl: string;
};

export type PlaceSearchResponse = {
  available: boolean;
  results: GeographicPlaceCandidate[];
  message?: string;
};

export type Burial = {
  id: string;
  person: Person;
  burialDate?: string;
  deathPlace?: VerifiedPlace;
  recordStatusCode?: string;
  recordStatusLabel?: string;
  intermentType?: string;
  intermentTypeLabel?: string;
  funeralHome?: string;
  veteran: boolean;
  militaryBranchCode?: string;
  militaryBranch?: string;
  militaryRankCode?: string;
  militaryRank?: string;
  militaryRankAbbreviation?: string;
  militaryRankPayGrade?: string;
  militaryWarServiceCode?: string;
  militaryWars?: string;
  recordNotes?: string;
  dataConfidence?: DataConfidence;
  reviewStatus?: DataReviewStatus;
  reviewNotes?: string;
  sourceConflict?: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
  auditEventId?: string;
};

export type OwnershipEvent = {
  id: string;
  ownerIds: string[];
  eventType: "purchase" | "transfer" | "inheritance" | "correction" | "release";
  effectiveDate: string;
  recordedBy: string;
  documentReference?: string;
  notes?: string;
};

export type LookupOption = {
  id: string;
  code: string;
  label: string;
};

export type HeadstoneRelationshipType = "family_obelisk" | "references_marker" | "common_base" | "foot_marker" | "related_marker";

export type HeadstoneRelationship = {
  id: string;
  fromHeadstoneUuid: string;
  fromHeadstoneId: string;
  toHeadstoneUuid: string;
  toHeadstoneId: string;
  relatedHeadstoneUuid: string;
  relatedHeadstoneId: string;
  relationshipType: HeadstoneRelationshipType;
  sourceType: "manual" | "nhg" | "field_observation" | "import";
  sourceText: string;
  confidence: "high" | "medium" | "low" | "review";
  notes: string;
  status: "active" | "needs_review" | "retired";
  direction: "outgoing" | "incoming";
};

export type Headstone = {
  id: string;
  headstoneId: string;
  markerType: LookupOption;
  material: LookupOption;
  condition: LookupOption;
  vaseType?: LookupOption;
  vaseMaterial?: LookupOption;
  vasePlacement?: LookupOption;
  vaseNotes: string;
  conditionNotes: string;
  inscription: string;
  designNotes: string;
  backDescription: string;
  photoUrl: string;
  lastInspectedAt?: string;
  dataConfidence?: DataConfidence;
  reviewStatus?: DataReviewStatus;
  reviewNotes: string;
  sourceConflict: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  nhgInclusion: "listed" | "not_listed" | "not_checked" | "unclear";
  provenanceVerificationSource: "field_survey" | "documentary_record" | "manual_review" | "import";
  provenanceVerifiedAt?: string;
  relationshipType: string;
  relationshipNotes: string;
  associatedGravesiteIds: string[];
  burialIds: string[];
  northHillsEvidence: NorthHillsLinkedEvidence[];
  features: GraveFeature[];
  maintenanceRecords: MaintenanceRecord[];
  relationships: HeadstoneRelationship[];
  mediaAssets: MediaAsset[];
  auditEventId?: string;
};

export type GraveFeature = {
  id: string;
  cemeteryId: string;
  gravesiteUuid?: string;
  headstoneUuid?: string;
  featureType: LookupOption;
  featureSubtype?: LookupOption;
  placement?: LookupOption;
  material?: LookupOption;
  symbolText: string;
  sourceType: string;
  sourceText: string;
  notes: string;
  status: "active" | "needs_review" | "retired";
};

export type MaintenanceRecord = {
  id: string;
  cemeteryId: string;
  targetType: "gravesite" | "headstone";
  gravesiteUuid?: string;
  headstoneUuid?: string;
  issueType?: LookupOption;
  actionType?: LookupOption;
  priority: LookupOption;
  status: "open" | "scheduled" | "completed" | "deferred" | "not_needed";
  observedAt: string;
  completedAt?: string;
  performedBy: string;
  sourceType: "manual" | "inspection" | "work_order" | "photo" | "import";
  notes: string;
};

export type MediaAsset = {
  id: string;
  cemeteryId: string;
  assetType: "photo" | "document" | "scan" | "map" | "other";
  fileUrl: string;
  thumbnailUrl: string;
  originalFilename: string;
  contentType: string;
  byteSize: number;
  capturedAt?: string;
  uploadedAt: string;
  capturedByEmail: string;
  latitude?: number;
  longitude?: number;
  gpsAccuracy?: number;
  deviceMake: string;
  deviceModel: string;
  notes: string;
  source: string;
  status: "staged" | "linked" | "needs_review" | "rejected";
  mediaLinkId?: string;
  mediaLinkType?: "headstone" | "gravesite";
  displayOrder?: number;
};

export type NorthHillsLinkedEvidence = {
  id: string;
  entryId: string;
  targetType: "headstone" | "gravesite";
  status: NorthHillsOcrEvidenceStatus;
  confidence: string;
  sourcePageNumber?: number;
  nameText: string;
  parsedSectionName: string;
  parsedRowNumber?: number;
  parsedPositionNumber?: number;
  rawText: string;
  reviewNotes: string;
  reviewedByEmail: string;
  reviewedAt: string;
};

export type HeadstoneSummary = {
  id: string;
  headstoneId: string;
  cemeteryId: string;
  cemeteryName: string;
  gravesiteId: string | null;
  graveKey: string;
  label: string;
  markerTypeCode: string;
  markerType: string;
  condition: string;
  geometry: GeoJSON.Point;
};

export type HeadstoneLookups = {
  headstones: LookupOption[];
  markerTypes: LookupOption[];
  materials: LookupOption[];
  conditions: LookupOption[];
  vaseTypes: LookupOption[];
  vaseMaterials: LookupOption[];
  vasePlacements: LookupOption[];
  graveFeatureTypes: LookupOption[];
  graveFeatureSubtypes: Array<LookupOption & { featureTypeCode?: string }>;
  graveFeaturePlacements: LookupOption[];
  graveFeatureMaterials: LookupOption[];
  intermentTypes: LookupOption[];
  burialRecordStatuses: LookupOption[];
  militaryBranches: LookupOption[];
  militaryRanks: Array<
    LookupOption & {
      abbreviation: string;
      payGrade?: string;
      militaryBranchCode: string;
    }
  >;
  militaryWarServices: LookupOption[];
  verifiedPlaces: Array<LookupOption & Omit<VerifiedPlace, "id" | "displayName">>;
  maintenanceIssueTypes: LookupOption[];
  maintenanceActionTypes: LookupOption[];
  maintenancePriorities: LookupOption[];
};

export type SaveHeadstoneRelationshipInput = {
  relatedHeadstoneId: string;
  relationshipType: HeadstoneRelationshipType;
  sourceType: "manual" | "nhg" | "field_observation" | "import";
  sourceText: string;
  confidence: "high" | "medium" | "low" | "review";
  notes: string;
  status: "active" | "needs_review" | "retired";
  reason?: string;
};

export type SaveHeadstoneInput = {
  markerTypeId: string;
  materialId: string;
  conditionId: string;
  vaseTypeId: string;
  vaseMaterialId: string;
  vasePlacementId: string;
  vaseNotes: string;
  conditionNotes: string;
  inscription: string;
  designNotes: string;
  backDescription: string;
  photoUrl: string;
  lastInspectedAt: string;
  dataConfidence: DataConfidence;
  reviewStatus: DataReviewStatus;
  reviewNotes: string;
  sourceConflict: boolean;
  nhgInclusion: "listed" | "not_listed" | "not_checked" | "unclear";
  provenanceVerificationSource: "field_survey" | "documentary_record" | "manual_review" | "import";
  provenanceVerifiedAt: string;
  reason?: string;
};

export type SaveHeadstoneCreateInput = SaveHeadstoneInput & {
  headstoneId: string;
  graveSpaceId: string;
  relationshipType: "primary" | "spans" | "nearby" | "inferred" | "footstone" | "secondary";
  relationshipNotes: string;
  latitude: string;
  longitude: string;
};

export type SaveGraveFeatureInput = {
  graveSpaceId: string;
  headstoneId: string;
  featureTypeId: string;
  featureSubtypeId: string;
  placementTypeId: string;
  materialTypeId: string;
  symbolText: string;
  sourceType: string;
  sourceText: string;
  notes: string;
  status: "active" | "needs_review" | "retired";
  reason?: string;
};

export type SaveMaintenanceRecordInput = {
  targetType: "gravesite" | "headstone";
  graveSpaceId: string;
  headstoneId: string;
  issueTypeId: string;
  actionTypeId: string;
  priorityTypeId: string;
  status: "open" | "scheduled" | "completed" | "deferred" | "not_needed";
  observedAt: string;
  completedAt: string;
  performedBy: string;
  sourceType: "manual" | "inspection" | "work_order" | "photo" | "import";
  notes: string;
  reason?: string;
};

export type GraveSpaceSummary = {
  id: string;
  cemeteryId: string;
  cemeteryName: string;
  section: string;
  lot: string;
  space: string;
  status: GraveStatus;
  hasVeteran?: boolean;
  geometryType?: GeometryType;
  geometrySource?: string;
  geometryConfidence?: GeometryConfidence;
  geometryNotes?: string;
  geometry: AreaGeometry;
};

export type GraveSpace = GraveSpaceSummary & {
  name: string;
  cost?: number;
  lotGeometryType?: GeometryType;
  lotGeometrySource?: string;
  lotGeometryConfidence?: GeometryConfidence;
  lotGeometryNotes?: string;
  owners: Owner[];
  currentOwnerIds: string[];
  burials: Burial[];
  headstones: Headstone[];
  features: GraveFeature[];
  maintenanceRecords: MaintenanceRecord[];
  northHillsEvidence: NorthHillsLinkedEvidence[];
  mediaAssets: MediaAsset[];
  ownershipHistory: OwnershipEvent[];
  notes?: string;
};

export type SaveGraveSpaceInput = {
  name: string;
  status: GraveStatus;
  cost: string;
  reason?: string;
};

export type SaveBurialInput = {
  firstName: string;
  lastName: string;
  maidenName: string;
  birthDate: string;
  deathDate: string;
  deathPlaceId: string;
  burialDate: string;
  intermentType: string;
  recordStatusCode: string;
  funeralHome: string;
  veteran: boolean;
  militaryBranchCode: string;
  militaryRankCode: string;
  militaryWarServiceCode: string;
  notes: string;
  dataConfidence: DataConfidence;
  reviewStatus: DataReviewStatus;
  reviewNotes: string;
  sourceConflict: boolean;
  reason?: string;
};

export type OwnershipEventType = "deed" | "sale" | "gift" | "church_council_action" | "correction" | "release";
export type OwnershipTargetScope = "selected_gravesite" | "selected_lot" | "listed_gravesites";

export type SaveOwnershipEventInput = {
  ownerDisplayName: string;
  eventType: OwnershipEventType;
  targetScope: OwnershipTargetScope;
  targetGravesiteIds: string[];
  effectiveDate: string;
  documentReference: string;
  notes: string;
  reason?: string;
};

export type CemeterySection = {
  id: string;
  name: string;
  alternateNames: string[];
  geometry: AreaGeometry;
};

export type CemeteryLot = {
  id: string;
  cemeteryId: string;
  name: string;
  section: string;
  block?: string;
  burialUseStatus?: "standard" | "non_burial" | "partially_restricted";
  burialUseNotes?: string;
  geometryType?: GeometryType;
  geometrySource?: string;
  geometryConfidence?: GeometryConfidence;
  geometryNotes?: string;
  geometry: AreaGeometry;
};

export type LotRestrictedArea = {
  id: string;
  lotId: string;
  cemeteryId: string;
  lotName: string;
  restrictionType: "non_burial" | "no_gravesites_or_markers";
  name: string;
  notes?: string;
  geometry: AreaGeometry;
};

export type CemeteryData = {
  boundary?: GeoJSON.Feature<AreaGeometry, { id?: string; name: string }>;
  boundaries?: GeoJSON.Feature<AreaGeometry, { id?: string; name: string }>[];
  sections: CemeterySection[];
  lots: CemeteryLot[];
  lotRestrictedAreas?: LotRestrictedArea[];
  graves: GraveSpaceSummary[];
  headstones: HeadstoneSummary[];
};

export type SearchMatch = {
  grave: GraveSpaceSummary;
  reasons: string[];
};

export type ReportParameterDefinition = {
  name: string;
  label: string;
  type: "text";
  required: boolean;
};

export type ReportDefinition = {
  id: string;
  title: string;
  description: string;
  category: string;
  requiredRole: AppRoleName;
  parameters: ReportParameterDefinition[];
  examples: string[];
};

export type ReportResult = {
  report: ReportDefinition;
  summary: string;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  notes: string[];
  generatedAt: string;
  layout?: "marker-burial-pages";
};

export type ReportQueryResponse = {
  matched: boolean;
  message: string;
  report?: ReportDefinition;
  parameters?: Record<string, string>;
  missingParameters?: ReportParameterDefinition[];
  availableReports?: ReportDefinition[];
  result?: ReportResult;
};

export type CurrentUser = {
  subject: string;
  email?: string;
  displayName?: string;
  role: AppRoleName;
  permissions: {
    canViewOwnership: boolean;
    canManageUsers: boolean;
    canOpenAdminPanel: boolean;
    canCreateCemeteryRecords: boolean;
    canUpdateCemeteryRecords: boolean;
    canUpdateHeadstones: boolean;
    canUpdateGravesites: boolean;
    canUpdateBurials: boolean;
    canDeleteCemeteryRecords: boolean;
    canDeleteGraveFeatures: boolean;
    canDeletePhotos: boolean;
  };
  assignedCemeteryIds: string[];
};

export type AppRole = {
  name: AppRoleName;
  description: string;
  userCount: number;
};

export type AppUser = {
  id: string;
  externalSubject: string;
  email: string;
  displayName: string;
  role: AppRoleName;
  assignedCemeteryIds: string[];
  isActive: boolean;
  lastAuthenticatedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type Auth0ResolvedUser = {
  externalSubject: string;
  email: string;
  displayName: string;
  created: boolean;
  invitationSent: boolean;
};

export type CemeteryTextRecord = {
  id: string;
  name: string;
  fullAddress: string;
  municipality: string;
  agency: string;
  agencyUrl: string;
  operationalHours: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  imageUrl: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type SectionTextRecord = {
  id: string;
  cemeteryId: string;
  sectionId: string;
  name: string;
  alternateNames: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type LotTextRecord = {
  id: string;
  cemeteryId: string;
  sectionId: string;
  lotId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type CemeteryAdminRecords = {
  cemeteries: CemeteryTextRecord[];
  sections: SectionTextRecord[];
  lots: LotTextRecord[];
};

export type DataQualitySeverity = "high" | "medium" | "low" | "info";

export type DataQualityMetric = {
  id: string;
  label: string;
  description: string;
  count: number;
  severity: DataQualitySeverity;
  category: string;
};

export type DataQualityDashboard = {
  generatedAt: string;
  scope: "all" | "assigned";
  totalOpenItems: number;
  metrics: DataQualityMetric[];
};

export type LookupTableDefinition = {
  table: string;
  label: string;
  hasSourceFields: boolean;
};

export type LookupRecord = {
  id: string;
  code: string;
  label: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  usageCount: number;
  usageLabel: string;
  sourceNotes?: string;
  sourceUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type LookupAdminRecords = {
  tables: LookupTableDefinition[];
  lookups: Record<string, LookupRecord[]>;
};

export type AuditEvent = {
  id: string;
  occurredAt: string;
  action: string;
  targetTable: string;
  targetRecordId: string;
  actorEmail: string;
  actorRole: string;
  actorExternalSubject: string;
  actorDatabaseUser: string;
  actorSessionUser: string;
  source: string;
  reason: string;
  changedFields: string[];
  previousValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type AuditEventFilters = {
  action?: string;
  targetTable?: string;
  actor?: string;
  targetRecordId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

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
  rawRemarks: string;
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

export type SourcePersonRecordSourceCode = "CR" | "CRG" | "FH" | "SK" | "NOTE" | "OTHER";
export type SourcePersonRecordType = "death_record" | "burial_record" | "funeral_record" | "church_record" | "family_history" | "other";
export type SourcePersonRecordStatus = "unmatched" | "candidate_match" | "linked" | "rejected";
export type SourcePersonRecordConfidence = "high" | "medium" | "low" | "review";

export type SourcePersonRecordLink = {
  id: string;
  linkType: "candidate" | "matched" | "rejected";
  confidence: SourcePersonRecordConfidence;
  targetType: "burial" | "gravesite" | "headstone";
  targetId: string;
  targetLabel: string;
  notes: string;
};

export type SourcePersonRecord = {
  id: string;
  cemeteryId: string;
  cemeteryName: string;
  northHillsOcrEntryId?: string;
  northHillsOcrSourceFactId?: string;
  sourceName: string;
  sourceCode: SourcePersonRecordSourceCode;
  sourceLabel: string;
  sourcePageNumber?: number;
  sourceLocationText: string;
  recordType: SourcePersonRecordType;
  status: SourcePersonRecordStatus;
  confidence: SourcePersonRecordConfidence;
  firstName: string;
  middleName: string;
  lastName: string;
  maidenName: string;
  fullName: string;
  birthDate?: string;
  birthDateText: string;
  deathDate?: string;
  deathDateText: string;
  burialDate?: string;
  burialDateText: string;
  funeralDate?: string;
  funeralDateText: string;
  ageText: string;
  rawText: string;
  notes: string;
  reviewedByEmail: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  links: SourcePersonRecordLink[];
};

export type SourcePersonRecordCemetery = {
  id: string;
  name: string;
};

export type SourcePersonRecordReview = {
  cemeteries: SourcePersonRecordCemetery[];
  records: SourcePersonRecord[];
};

export type SourcePersonRecordFilters = {
  q?: string;
  status?: string;
  sourceCode?: string;
  cemeteryId?: string;
  limit?: number;
};

export type SaveSourcePersonRecordInput = {
  cemeteryId: string;
  northHillsOcrEntryId?: string;
  northHillsOcrSourceFactId?: string;
  sourceName: string;
  sourceCode: SourcePersonRecordSourceCode;
  sourceLabel: string;
  sourcePageNumber?: number | null;
  sourceLocationText: string;
  recordType: SourcePersonRecordType;
  status: SourcePersonRecordStatus;
  confidence: SourcePersonRecordConfidence;
  firstName: string;
  middleName: string;
  lastName: string;
  maidenName: string;
  fullName: string;
  birthDate?: string;
  birthDateText: string;
  deathDate?: string;
  deathDateText: string;
  burialDate?: string;
  burialDateText: string;
  funeralDate?: string;
  funeralDateText: string;
  ageText: string;
  rawText: string;
  notes: string;
  reason: string;
};
