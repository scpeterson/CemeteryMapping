import { useBulkAdministration } from "../../admin/useBulkAdministration";
import { useNorthHillsAdministration } from "../../admin/useNorthHillsAdministration";

export type Props = Pick<ReturnType<typeof useNorthHillsAdministration>, "applyNorthHillsReviewFilters" | "northHillsReviewFilters" | "updateNorthHillsReviewFilter" | "northHillsOcrReview" | "isLoadingNorthHillsReview" | "setNorthHillsReviewFilters" | "loadNorthHillsOcrReview" | "selectedNorthHillsBatch" | "nextUnresolvedNorthHillsEntry" | "goToNextUnresolvedNorthHillsEntry" | "visibleNorthHillsEntryIds" | "selectedNorthHillsEntryIds" | "toggleVisibleNorthHillsEntries" | "selectedNorthHillsEntries" | "focusedNorthHillsEntryId" | "toggleNorthHillsEntrySelection" | "startNorthHillsEntryEdit" | "savingEvidenceKey" | "editingNorthHillsEntryId" | "northHillsEntryForm" | "saveNorthHillsEntryEdit" | "updateNorthHillsEntryForm" | "updateNorthHillsSourceFactForm" | "updateNorthHillsObservationForm" | "cancelNorthHillsEntryEdit" | "saveNorthHillsSourceFactReview" | "promoteNorthHillsDeathDate" | "saveNorthHillsEvidence" | "unlinkNorthHillsEvidence"> &
  Pick<ReturnType<typeof useBulkAdministration>, "markSelectedNorthHillsReviewed" | "savingBulkKey" | "openBulkToolsTab"> &
{
  canEditNorthHillsEntries: boolean;
  canUnlinkNorthHillsEvidence: boolean;
};

