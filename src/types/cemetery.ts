import type { AreaGeometry, GeometryConfidence, GeometryType } from "./common";
import type { Owner, OwnershipEvent } from "./ownership";
import type { Burial } from "./burials";
import type { Headstone, HeadstoneSummary, NorthHillsLinkedEvidence } from "./markers";
import type { GraveFeature, MaintenanceRecord, MediaAsset } from "./evidence";

export type GraveStatus = "available" | "reserved" | "occupied" | "sold" | "needs_review" | "unknown";

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
  version: string;
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
  expectedVersion: string;
  name: string;
  status: GraveStatus;
  cost: string;
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

export type LotSearchMatch = {
  lot: CemeteryLot;
  reasons: string[];
};

export type CemeterySearchMatch = SearchMatch | LotSearchMatch;
