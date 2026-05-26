export type GraveStatus = "available" | "reserved" | "occupied" | "sold" | "unknown";
export type AppRoleName = "reader" | "power-user" | "admin";
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
    canCreateCemeteryRecords: boolean;
    canUpdateCemeteryRecords: boolean;
    canDeleteCemeteryRecords: boolean;
  };
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
