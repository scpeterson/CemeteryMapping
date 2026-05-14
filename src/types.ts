export type GraveStatus = "available" | "reserved" | "occupied" | "sold" | "unknown";

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

export type GraveSpace = {
  id: string;
  section: string;
  lot: string;
  space: string;
  status: GraveStatus;
  geometry: GeoJSON.Polygon;
  currentOwnerIds: string[];
  burials: Burial[];
  ownershipHistory: OwnershipEvent[];
  notes?: string;
};

export type CemeterySection = {
  id: string;
  name: string;
  geometry: GeoJSON.Polygon;
};

export type CemeteryData = {
  boundary: GeoJSON.Feature<GeoJSON.Polygon, { name: string }>;
  sections: CemeterySection[];
  graves: GraveSpace[];
  owners: Owner[];
};

export type SearchMatch = {
  grave: GraveSpace;
  reasons: string[];
};
