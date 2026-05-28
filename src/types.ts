export type GraveStatus = "available" | "reserved" | "occupied" | "sold" | "needs_review" | "unknown";
export type AppRoleName = "reader" | "power-user" | "cemetery-admin" | "admin";
export type AreaGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

export type Person = {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  birthDate?: string;
  deathDate?: string;
};

export type Owner = {
  id: string;
  displayName: string;
  contactNote?: string;
};

export type Burial = {
  id: string;
  person: Person;
  burialDate?: string;
  notes?: string;
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

export type Headstone = {
  id: string;
  headstoneId: string;
  markerType: LookupOption;
  material: LookupOption;
  condition: LookupOption;
  conditionNotes: string;
  inscription: string;
  photoUrl: string;
  lastInspectedAt?: string;
  relationshipType: string;
  relationshipNotes: string;
  burialIds: string[];
  auditEventId?: string;
};

export type HeadstoneSummary = {
  id: string;
  headstoneId: string;
  cemeteryId: string;
  cemeteryName: string;
  gravesiteId: string;
  graveKey: string;
  label: string;
  markerType: string;
  condition: string;
  geometry: GeoJSON.Point;
};

export type HeadstoneLookups = {
  markerTypes: LookupOption[];
  materials: LookupOption[];
  conditions: LookupOption[];
};

export type SaveHeadstoneInput = {
  markerTypeId: string;
  materialId: string;
  conditionId: string;
  conditionNotes: string;
  inscription: string;
  photoUrl: string;
  lastInspectedAt: string;
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
  geometry: AreaGeometry;
};

export type GraveSpace = GraveSpaceSummary & {
  owners: Owner[];
  currentOwnerIds: string[];
  burials: Burial[];
  headstones: Headstone[];
  ownershipHistory: OwnershipEvent[];
  notes?: string;
};

export type CemeterySection = {
  id: string;
  name: string;
  alternateNames: string[];
  geometry: AreaGeometry;
};

export type CemeteryLot = {
  id: string;
  name: string;
  section: string;
  block?: string;
  geometry: AreaGeometry;
};

export type CemeteryData = {
  boundary?: GeoJSON.Feature<AreaGeometry, { name: string }>;
  boundaries?: GeoJSON.Feature<AreaGeometry, { name: string }>[];
  sections: CemeterySection[];
  lots: CemeteryLot[];
  graves: GraveSpaceSummary[];
  headstones: HeadstoneSummary[];
};

export type SearchMatch = {
  grave: GraveSpaceSummary;
  reasons: string[];
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
    canDeleteCemeteryRecords: boolean;
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
  entries: DeedRegistryReviewEntry[];
};
