import type * as React from "react";
import { FormEvent, useState } from "react";
import {
  bulkAddNorthHillsEntryNote,
  bulkAssignGravesitesToLot,
  bulkMarkNorthHillsReviewed,
  bulkUpdateHeadstones,
  fetchHeadstoneLookups
} from "../../api/cemeteryApi";
import type {
  HeadstoneLookups,
  NorthHillsOcrReviewFilters
} from "../../types";
import { AdminTab, bulkResultMessage, defaultBulkReason, emptyHeadstoneLookups, parseBulkIdentifiers } from "./adminWorkflowConfig";

type Context = {
  setError: React.Dispatch<React.SetStateAction<string | undefined>>;
  setActiveTab: React.Dispatch<React.SetStateAction<AdminTab>>;
  setMessage: React.Dispatch<React.SetStateAction<string | undefined>>;
  selectedNorthHillsEntryIds: Set<string>;
  setSelectedNorthHillsEntryIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  loadNorthHillsOcrReview: (filters?: NorthHillsOcrReviewFilters) => Promise<void>;
  northHillsReviewFilters: NorthHillsOcrReviewFilters
};

export function useBulkAdministration({
  setError,
  setActiveTab,
  setMessage,
  selectedNorthHillsEntryIds,
  setSelectedNorthHillsEntryIds,
  loadNorthHillsOcrReview,
  northHillsReviewFilters
}: Context) {
  const [headstoneLookups, setHeadstoneLookups] = useState<HeadstoneLookups>(emptyHeadstoneLookups);

  const [savingBulkKey, setSavingBulkKey] = useState<string>();

  const [bulkMarkerIdentifiers, setBulkMarkerIdentifiers] = useState("");

  const [bulkMarkerTypeId, setBulkMarkerTypeId] = useState("");

  const [bulkMarkerMaterialId, setBulkMarkerMaterialId] = useState("");

  const [bulkMarkerConditionId, setBulkMarkerConditionId] = useState("");

  const [bulkGravesiteIdentifiers, setBulkGravesiteIdentifiers] = useState("");

  const [bulkLotId, setBulkLotId] = useState("");

  const [bulkNorthHillsNote, setBulkNorthHillsNote] = useState("");

  const [bulkReason, setBulkReason] = useState(defaultBulkReason);

  const loadHeadstoneLookupRecords = async () => {
    if (headstoneLookups.markerTypes.length || savingBulkKey === "lookups") return;
    setSavingBulkKey("lookups");
    setError(undefined);
    try {
      setHeadstoneLookups(await fetchHeadstoneLookups());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load marker lookup values.");
    } finally {
      setSavingBulkKey(undefined);
    }
  };

  const openBulkToolsTab = () => {
    setActiveTab("bulk");
    void loadHeadstoneLookupRecords();
  };

  const saveBulkHeadstoneUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const identifiers = parseBulkIdentifiers(bulkMarkerIdentifiers);
    if (identifiers.length === 0) {
      setError("Enter at least one marker ID.");
      return;
    }
    if (!bulkMarkerTypeId && !bulkMarkerMaterialId && !bulkMarkerConditionId) {
      setError("Choose at least one marker field to update.");
      return;
    }

    setSavingBulkKey("headstones");
    setMessage(undefined);
    setError(undefined);
    try {
      const result = await bulkUpdateHeadstones({
        identifiers,
        markerTypeId: bulkMarkerTypeId || undefined,
        materialId: bulkMarkerMaterialId || undefined,
        conditionId: bulkMarkerConditionId || undefined,
        reason: bulkReason,
      });
      setMessage(bulkResultMessage("Bulk marker update", result));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update selected markers.");
    } finally {
      setSavingBulkKey(undefined);
    }
  };

  const saveBulkGravesiteLotAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const identifiers = parseBulkIdentifiers(bulkGravesiteIdentifiers);
    if (identifiers.length === 0) {
      setError("Enter at least one gravesite ID.");
      return;
    }
    if (!bulkLotId) {
      setError("Choose a target lot.");
      return;
    }

    setSavingBulkKey("gravesites");
    setMessage(undefined);
    setError(undefined);
    try {
      const result = await bulkAssignGravesitesToLot({ identifiers, lotId: bulkLotId, reason: bulkReason });
      setMessage(bulkResultMessage("Bulk gravesite lot assignment", result));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to assign selected gravesites to the lot.");
    } finally {
      setSavingBulkKey(undefined);
    }
  };

  const markSelectedNorthHillsReviewed = async () => {
    const entryIds = [...selectedNorthHillsEntryIds];
    if (entryIds.length === 0) {
      setError("Select at least one NHG reading.");
      return;
    }

    setSavingBulkKey("northHillsReviewed");
    setMessage(undefined);
    setError(undefined);
    try {
      const result = await bulkMarkNorthHillsReviewed({ entryIds, reason: bulkReason });
      setMessage(bulkResultMessage("Bulk NHG review", result));
      setSelectedNorthHillsEntryIds(new Set());
      await loadNorthHillsOcrReview(northHillsReviewFilters);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to mark selected NHG readings reviewed.");
    } finally {
      setSavingBulkKey(undefined);
    }
  };

  const addNoteToSelectedNorthHillsEntries = async () => {
    const entryIds = [...selectedNorthHillsEntryIds];
    if (entryIds.length === 0) {
      setError("Select at least one NHG reading.");
      return;
    }
    if (!bulkNorthHillsNote.trim()) {
      setError("Enter a note to apply to selected NHG readings.");
      return;
    }

    setSavingBulkKey("northHillsNote");
    setMessage(undefined);
    setError(undefined);
    try {
      const result = await bulkAddNorthHillsEntryNote({ entryIds, note: bulkNorthHillsNote, reason: bulkReason });
      setMessage(bulkResultMessage("Bulk NHG note", result));
      setBulkNorthHillsNote("");
      await loadNorthHillsOcrReview(northHillsReviewFilters);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to add the note to selected NHG readings.");
    } finally {
      setSavingBulkKey(undefined);
    }
  };
  return {
    headstoneLookups,
    savingBulkKey,
    bulkMarkerIdentifiers,
    setBulkMarkerIdentifiers,
    bulkMarkerTypeId,
    setBulkMarkerTypeId,
    bulkMarkerMaterialId,
    setBulkMarkerMaterialId,
    bulkMarkerConditionId,
    setBulkMarkerConditionId,
    bulkGravesiteIdentifiers,
    setBulkGravesiteIdentifiers,
    bulkLotId,
    setBulkLotId,
    bulkNorthHillsNote,
    setBulkNorthHillsNote,
    bulkReason,
    setBulkReason,
    openBulkToolsTab,
    saveBulkHeadstoneUpdate,
    saveBulkGravesiteLotAssignment,
    markSelectedNorthHillsReviewed,
    addNoteToSelectedNorthHillsEntries
  };
}
