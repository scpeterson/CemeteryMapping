import type { DataConfidence, DataReviewStatus, LookupOption } from "./common";
import type { GraveFeature, MaintenanceRecord, MediaAsset } from "./evidence";
import type { NorthHillsOcrEvidenceStatus } from "./northHills";
import type { VerifiedPlace } from "./burials";

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

export type HeadstoneGravesiteRelationshipType = "primary" | "spans" | "nearby" | "inferred" | "footstone" | "secondary";

export type HeadstoneGravesiteRelationship = {
  id: string;
  gravesiteUuid: string;
  gravesiteId: string;
  graveId?: string;
  gravesiteName: string;
  relationshipType: HeadstoneGravesiteRelationshipType;
  notes: string;
};

export type MarkerFace = {
  id: string;
  label: string;
  inscription: string;
  notes: string;
  burialIds: string[];
  mediaAssetIds: string[];
};

export type Headstone = {
  id: string;
  headstoneId: string;
  markerType: LookupOption;
  markerScope: LookupOption;
  material: LookupOption;
  condition: LookupOption;
  vaseType?: LookupOption;
  vaseMaterial?: LookupOption;
  vasePlacement?: LookupOption;
  vaseNotes: string;
  conditionNotes: string;
  inscription: string;
  faces?: MarkerFace[];
  facesRevision?: number;
  facePeople?: { id: string; fullName: string }[];
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
  nhgInclusionRecorded: boolean;
  provenanceVerificationSource: "field_photo" | "field_survey" | "documentary_record" | "manual_review" | "import";
  provenanceVerifiedAt?: string;
  relationshipType: string;
  relationshipNotes: string;
  associatedGravesiteIds: string[];
  burialIds: string[];
  northHillsEvidence: NorthHillsLinkedEvidence[];
  features: GraveFeature[];
  maintenanceRecords: MaintenanceRecord[];
  relationships: HeadstoneRelationship[];
  gravesiteRelationships: HeadstoneGravesiteRelationship[];
  mediaAssets: MediaAsset[];
  auditEventId?: string;
  burialNhgPropagation?: { updated: number; skipped: number };
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
  markerScopeCode: string;
  markerScope: string;
  condition: string;
  geometry: GeoJSON.Point;
};

export type HeadstoneLookups = {
  headstones: LookupOption[];
  gravesites: LookupOption[];
  markerTypes: LookupOption[];
  markerScopes: LookupOption[];
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
  militaryDecorations: LookupOption[];
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

export type SaveHeadstoneGravesiteRelationshipInput = {
  gravesiteId: string;
  relationshipType: HeadstoneGravesiteRelationshipType;
  notes: string;
  reason?: string;
};

export type SaveHeadstoneInput = {
  markerTypeId: string;
  markerScopeId: string;
  materialId: string;
  conditionId: string;
  vaseTypeId: string;
  vaseMaterialId: string;
  vasePlacementId: string;
  vaseNotes: string;
  conditionNotes: string;
  inscription: string;
  faces?: MarkerFace[];
  facesRevision?: number;
  designNotes: string;
  backDescription: string;
  photoUrl: string;
  lastInspectedAt: string;
  dataConfidence: DataConfidence;
  reviewStatus: DataReviewStatus;
  reviewNotes: string;
  sourceConflict: boolean;
  nhgInclusion: "listed" | "not_listed" | "not_checked" | "unclear";
  provenanceVerificationSource: "field_photo" | "field_survey" | "documentary_record" | "manual_review" | "import";
  provenanceVerifiedAt: string;
  applyNhgInclusionToBurials: boolean;
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
