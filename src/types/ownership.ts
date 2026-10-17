export type Owner = {
  id: string;
  ownershipEventId?: string;
  ownershipEventRightId?: string;
  ownershipTargetType?: "gravesite" | "lot";
  displayName: string;
  firstName: string;
  lastName: string;
  fullAddress: string;
  municipality: string;
  state: string;
  zip: string;
  contactNote?: string;
  effectiveDate?: string;
  deedOnFile: boolean;
  deedRegisterOnFile: boolean;
};

export type UpdateOwnerInput = {
  firstName: string;
  lastName: string;
  fullAddress: string;
  municipality: string;
  state: string;
  zip: string;
  effectiveDate: string;
  deedOnFile: boolean;
  deedRegisterOnFile: boolean;
  reason?: string;
};

export type OwnershipEvent = {
  id: string;
  ownerIds: string[];
  eventType: "purchase" | "transfer" | "inheritance" | "correction" | "release";
  effectiveDate: string;
  deedOnFile: boolean;
  deedRegisterOnFile: boolean;
  recordedBy: string;
  documentReference?: string;
  notes?: string;
  fromOwnerNames: string[];
  toOwnerNames: string[];
};

export type OwnershipEventType = "deed" | "sale" | "gift" | "church_council_action" | "correction" | "release";

export type OwnershipTargetScope = "selected_gravesite" | "selected_lot" | "listed_gravesites";

export type OwnershipPartyInput = {
  firstName: string;
  lastName: string;
  fullAddress: string;
  municipality: string;
  state: string;
  zip: string;
  shareNumerator: string;
  shareDenominator: string;
};

export type SaveOwnershipEventInput = {
  owners: OwnershipPartyInput[];
  previousOwners: OwnershipPartyInput[];
  eventType: OwnershipEventType;
  targetScope: OwnershipTargetScope;
  targetGravesiteIds: string[];
  effectiveDate: string;
  deedOnFile: boolean;
  deedRegisterOnFile: boolean;
  documentReference: string;
  notes: string;
  reason?: string;
};

export type DeedRegistrySuggestion = {
  id: string;
  ownerDisplayName: string;
  address: string;
  city: string;
  state: string;
  effectiveDate: string;
  deedOnFile: boolean;
  deedRegisterOnFile: boolean;
  modernSection: string;
  lotText: string;
  documentReference: string;
  notes: string;
  originalRowNumber?: number;
  updatedRowNumber?: number;
};
