import type { DataConfidence, DataReviewStatus, LookupOption } from "./common";

export type GivenNameStatus = "recorded" | "unknown" | "no_given_name";

export type Person = {
  givenNameStatus?: GivenNameStatus;
  displayName?: string;
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  maidenName?: string;
  namePrefix?: string;
  nameSuffix?: string;
  birthDate?: string;
  deathDate?: string;
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
  sourceUrl?: string;
  veteran: boolean;
  militaryBranchCode?: string;
  militaryBranch?: string;
  militaryRankCode?: string;
  militaryRank?: string;
  militaryRankAbbreviation?: string;
  militaryRankPayGrade?: string;
  militaryWarServiceCode?: string;
  militaryWars?: string;
  militaryDecorations?: LookupOption[];
  militaryEnlistedDate?: string;
  militaryDischargedDate?: string;
  recordNotes?: string;
  dataConfidence?: DataConfidence;
  reviewStatus?: DataReviewStatus;
  reviewNotes?: string;
  sourceConflict?: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
  auditEventId?: string;
  nhgInclusion?: "listed" | "not_listed" | "not_checked" | "unclear";
};

export type SaveBurialInput = {
  givenNameStatus?: GivenNameStatus;
  displayName?: string;
  firstName: string;
  lastName: string;
  maidenName: string;
  namePrefix: string;
  nameSuffix: string;
  birthDate: string;
  deathDate: string;
  deathPlaceId: string;
  burialDate: string;
  intermentType: string;
  recordStatusCode: string;
  funeralHome: string;
  sourceUrl: string;
  veteran: boolean;
  militaryBranchCode: string;
  militaryRankCode: string;
  militaryWarServiceCode: string;
  militaryDecorationCodes: string[];
  militaryEnlistedDate: string;
  militaryDischargedDate: string;
  notes: string;
  dataConfidence: DataConfidence;
  reviewStatus: DataReviewStatus;
  reviewNotes: string;
  sourceConflict: boolean;
  reason?: string;
};
