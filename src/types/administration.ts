import type { AppRoleName } from "./common";

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
