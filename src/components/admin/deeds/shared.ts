import { type Dispatch,FormEvent,type SetStateAction } from "react";
import type {
DeedInvestigationAction,
DeedInvestigationCase,
DeedRegistryReview,
DeedRegistryReviewEntry,
DeedRegistryReviewFilters,
SaveDeedInvestigationActionInput,
SaveDeedInvestigationCaseInput
} from "../../../types";
import {
defaultDeedCaseFilters
} from "../../AdminPanelDeedConfig";

export const scopeLabels: Record<string, string> = {
  grave_count_only: "Grave count only",
  multiple_lots: "Multiple lots",
  passage: "Passage",
  section_g_gravesite: "Section G gravesite",
  specific_graves: "Specific graves",
  unknown: "Unknown",
  whole_lot: "Whole lot",
};
export const confidenceLabels: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  review: "Review",
};
export const comparisonLabels: Record<string, string> = {
  added: "Added since Original 2017",
  changed: "Changed since Original 2017",
  unchanged: "Unchanged from Original 2017",
};
export const deedScopeLabel = (scope: string) => scopeLabels[scope] ?? scope;
export const deedConfidenceLabel = (confidence: string) => confidenceLabels[confidence] ?? confidence;
export const deedComparisonLabel = (status: string) => comparisonLabels[status] ?? status;
export const formatList = (values: string[]) => (values.length ? values.join(", ") : "None");
export const deedEntryTitle = (entry: DeedRegistryReviewEntry) =>
  `Row ${entry.sourceRowNumber}. ${entry.ownerDisplayName || "No owner"}. ${deedConfidenceLabel(entry.parseConfidence)} confidence.${entry.comparisonStatus ? ` ${deedComparisonLabel(entry.comparisonStatus)}.` : ""}`;

export type DeedsAdminTabProps = {
  deedCaseFilters: typeof defaultDeedCaseFilters;
  setDeedCaseFilters: Dispatch<SetStateAction<typeof defaultDeedCaseFilters>>;
  isLoadingDeedCases: boolean;
  loadDeedCases: () => Promise<void>;
  startNewDeedCase: () => void;
  deedCases: DeedInvestigationCase[];
  selectedDeedCaseId: string;
  selectDeedCase: (investigation: DeedInvestigationCase) => void;
  deedCaseForm: SaveDeedInvestigationCaseInput;
  setDeedCaseForm: Dispatch<SetStateAction<SaveDeedInvestigationCaseInput>>;
  selectedDeedCase: DeedInvestigationCase | undefined;
  savingDeedCaseKey: string | undefined;
  saveDeedCase: (event: FormEvent<HTMLFormElement>) => void;
  startNewDeedAction: () => void;
  selectedDeedActionId: string;
  selectDeedAction: (action: DeedInvestigationAction) => void;
  deedActionForm: SaveDeedInvestigationActionInput;
  setDeedActionForm: Dispatch<SetStateAction<SaveDeedInvestigationActionInput>>;
  savingDeedActionKey: string | undefined;
  saveDeedAction: (event: FormEvent<HTMLFormElement>) => void;
  deedReviewFilters: DeedRegistryReviewFilters;
  updateDeedReviewFilter: (patch: Partial<DeedRegistryReviewFilters>) => void;
  deedRegistryReview: DeedRegistryReview;
  applyDeedReviewFilters: (event: FormEvent<HTMLFormElement>) => void;
  isLoadingDeedReview: boolean;
  setDeedReviewFilters: Dispatch<SetStateAction<DeedRegistryReviewFilters>>;
  loadDeedRegistryReview: (filters?: DeedRegistryReviewFilters) => Promise<void>;
  selectedDeedBatch: DeedRegistryReview["batches"][number] | undefined;
  deedResearchTerms: string[];
  deedInvestigationOwners: string[];
  deedInvestigationLots: string[];
  deedOnFileCount: number;
  deedRegisterOnFileCount: number;
  deedInvestigationNoteCount: number;
  attachEntryToSelectedDeedCase: (entry: DeedRegistryReviewEntry) => Promise<void>;
  removedOriginalDeedEntries: DeedRegistryReview["removedOriginalEntries"];
};

