import type { LookupOption } from "./common";

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
  isPrimary?: boolean;
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
