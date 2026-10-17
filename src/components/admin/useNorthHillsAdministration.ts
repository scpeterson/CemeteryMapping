import { useConfirmation } from "../ui/confirmationContext";
import { useDraftState } from "../../hooks/useDraftState";
import type * as React from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  deleteNorthHillsOcrEvidence,
  fetchNorthHillsOcrReview,
  promoteNorthHillsSourceFact,
  reviewNorthHillsSourceFact,
  saveNorthHillsOcrEvidence,
  updateNorthHillsOcrEntry
} from "../../api/cemeteryApi";
import type {
  NorthHillsOcrEvidenceStatus,
  NorthHillsOcrReview,
  NorthHillsOcrReviewEntry,
  NorthHillsOcrReviewFilters,
  NorthHillsSourceFact,
  NorthHillsSourceFactStatus,
  SaveNorthHillsOcrObservationInput,
  SaveNorthHillsSourceFactInput
} from "../../types";
import {
  AdminTab,
  defaultNorthHillsReviewFilters,
  emptyNorthHillsOcrReview,
  evidenceStatusLabels,
  NorthHillsEditForm,
  northHillsEditFormFromEntry,
  northHillsEditPayload,
  sourceFactStatusLabels,
  sourceFactTypeLabels
} from "./adminWorkflowConfig";

type Context = {
  setError: React.Dispatch<React.SetStateAction<string | undefined>>;
  setActiveTab: React.Dispatch<React.SetStateAction<AdminTab>>;
  setMessage: React.Dispatch<React.SetStateAction<string | undefined>>;
  scrollAdminItemIntoView: (elementId: string) => void
};

export function useNorthHillsAdministration({ setError, setActiveTab, setMessage, scrollAdminItemIntoView }: Context) {
  const confirm = useConfirmation();
  const [northHillsOcrReview, setNorthHillsOcrReview] = useState<NorthHillsOcrReview>(emptyNorthHillsOcrReview);

  const [northHillsReviewFilters, setNorthHillsReviewFilters] = useState<NorthHillsOcrReviewFilters>(defaultNorthHillsReviewFilters);

  const [editingNorthHillsEntryId, setEditingNorthHillsEntryId] = useState("");

  const [focusedNorthHillsEntryId, setFocusedNorthHillsEntryId] = useState("");

  const [northHillsEntryForm, setNorthHillsEntryForm] = useDraftState<NorthHillsEditForm | null>(null);

  const [selectedNorthHillsEntryIds, setSelectedNorthHillsEntryIds] = useState<Set<string>>(() => new Set());

  const [isLoadingNorthHillsReview, setIsLoadingNorthHillsReview] = useState(false);

  const [savingEvidenceKey, setSavingEvidenceKey] = useState<string>();

  const selectedNorthHillsBatch = useMemo(
    () => northHillsOcrReview.batches.find((batch) => batch.id === northHillsOcrReview.selectedBatchId),
    [northHillsOcrReview.batches, northHillsOcrReview.selectedBatchId],
  );

  const selectedNorthHillsEntries = useMemo(
    () => northHillsOcrReview.entries.filter((entry) => selectedNorthHillsEntryIds.has(entry.id)),
    [northHillsOcrReview.entries, selectedNorthHillsEntryIds],
  );

  const visibleNorthHillsEntryIds = useMemo(() => northHillsOcrReview.entries.map((entry) => entry.id), [northHillsOcrReview.entries]);

  const nextUnresolvedNorthHillsEntry = useMemo(
    () => northHillsOcrReview.entries.find((entry) => entry.processingSummary.pendingCount > 0),
    [northHillsOcrReview.entries],
  );

  useEffect(() => {
    setSelectedNorthHillsEntryIds((current) => {
      const visible = new Set(visibleNorthHillsEntryIds);
      const next = new Set([...current].filter((id) => visible.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [visibleNorthHillsEntryIds]);

  const loadNorthHillsOcrReview = async (filters = northHillsReviewFilters) => {
    setIsLoadingNorthHillsReview(true);
    setError(undefined);

    try {
      const nextReview = await fetchNorthHillsOcrReview(filters);
      setNorthHillsOcrReview(nextReview);
      setNorthHillsReviewFilters((current) => ({ ...current, batchId: nextReview.selectedBatchId }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load North Hills readings.");
    } finally {
      setIsLoadingNorthHillsReview(false);
    }
  };

  const updateNorthHillsReviewFilter = (patch: Partial<NorthHillsOcrReviewFilters>) => {
    setNorthHillsReviewFilters((current) => ({ ...current, ...patch }));
  };

  const applyNorthHillsReviewFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadNorthHillsOcrReview(northHillsReviewFilters);
  };

  const toggleNorthHillsEntrySelection = (entryId: string) => {
    setSelectedNorthHillsEntryIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  const toggleVisibleNorthHillsEntries = () => {
    setSelectedNorthHillsEntryIds((current) => {
      const allVisibleSelected = visibleNorthHillsEntryIds.length > 0 && visibleNorthHillsEntryIds.every((id) => current.has(id));
      if (allVisibleSelected) return new Set();
      return new Set(visibleNorthHillsEntryIds);
    });
  };

  const openNorthHillsReviewTab = () => {
    setActiveTab("readings");
    if (northHillsOcrReview.batches.length === 0 && !isLoadingNorthHillsReview) void loadNorthHillsOcrReview();
  };

  const openNorthHillsReviewQueue = () => {
    const filters = { ...defaultNorthHillsReviewFilters, sort: "review" as const, limit: 100 };
    setActiveTab("readings");
    setNorthHillsReviewFilters(filters);
    void loadNorthHillsOcrReview(filters);
    setMessage("Showing North Hills readings in review-priority order.");
  };

  const goToNextUnresolvedNorthHillsEntry = () => {
    if (!nextUnresolvedNorthHillsEntry) {
      setMessage("No unresolved North Hills readings are visible with the current filters.");
      return;
    }
    setFocusedNorthHillsEntryId(nextUnresolvedNorthHillsEntry.id);
    scrollAdminItemIntoView(`north-hills-entry-${nextUnresolvedNorthHillsEntry.id}`);
    setMessage(`Next unresolved NHG reading: ${nextUnresolvedNorthHillsEntry.nameText || "unnamed reading"}.`);
  };

  const startNorthHillsEntryEdit = (entry: NorthHillsOcrReviewEntry) => {
    setEditingNorthHillsEntryId(entry.id);
    setNorthHillsEntryForm(northHillsEditFormFromEntry(entry));
    setMessage(undefined);
    setError(undefined);
  };

  const cancelNorthHillsEntryEdit = () => {
    setEditingNorthHillsEntryId("");
    setNorthHillsEntryForm(null);
  };

  const updateNorthHillsEntryForm = (patch: Partial<NorthHillsEditForm>) => {
    setNorthHillsEntryForm((current) => (current ? { ...current, ...patch } : current));
  };

  const updateNorthHillsSourceFactForm = (index: number, patch: Partial<SaveNorthHillsSourceFactInput>) => {
    setNorthHillsEntryForm((current) =>
      current
        ? {
          ...current,
          sourceFacts: current.sourceFacts.map((fact, factIndex) => (factIndex === index ? { ...fact, ...patch } : fact)),
        }
        : current,
    );
  };

  const updateNorthHillsObservationForm = (index: number, patch: Partial<SaveNorthHillsOcrObservationInput>) => {
    setNorthHillsEntryForm((current) =>
      current
        ? {
          ...current,
          observations: current.observations.map((observation, observationIndex) => (observationIndex === index ? { ...observation, ...patch } : observation)),
        }
        : current,
    );
  };

  const saveNorthHillsEntryEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingNorthHillsEntryId || !northHillsEntryForm) return;
    setSavingEvidenceKey(`${editingNorthHillsEntryId}:entry-edit`);
    setMessage(undefined);
    setError(undefined);

    try {
      await updateNorthHillsOcrEntry(editingNorthHillsEntryId, northHillsEditPayload(northHillsEntryForm));
      setMessage(`Saved North Hills reading ${northHillsEntryForm.nameText || "entry"}.`);
      cancelNorthHillsEntryEdit();
      await loadNorthHillsOcrReview(northHillsReviewFilters);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save North Hills reading.");
    } finally {
      setSavingEvidenceKey(undefined);
    }
  };

  const saveNorthHillsEvidence = async (
    entryId: string,
    targetType: "headstone" | "gravesite",
    targetId: string,
    status: NorthHillsOcrEvidenceStatus,
    label: string,
  ) => {
    const notes = window.prompt(`Optional notes for ${evidenceStatusLabels[status].toLowerCase()} ${label}:`, "");
    if (notes === null) return;
    const key = `${entryId}:${targetType}:${targetId}:${status}`;
    setSavingEvidenceKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      await saveNorthHillsOcrEvidence(entryId, {
        targetType,
        targetId,
        status,
        confidence: status === "linked" ? "high" : status === "rejected" ? "low" : "review",
        notes,
      });
      setMessage(`${label} marked ${evidenceStatusLabels[status].toLowerCase()}.`);
      await loadNorthHillsOcrReview(northHillsReviewFilters);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save North Hills evidence review.");
    } finally {
      setSavingEvidenceKey(undefined);
    }
  };

  const unlinkNorthHillsEvidence = async (entryId: string, targetType: "headstone" | "gravesite", targetId: string, label: string) => {
    if (!(await confirm(`Unlink this North Hills reading from ${label}?`))) return;
    const key = `${entryId}:${targetType}:${targetId}:unlink`;
    setSavingEvidenceKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      await deleteNorthHillsOcrEvidence(entryId, { targetType, targetId });
      setMessage(`Unlinked North Hills reading from ${label}.`);
      await loadNorthHillsOcrReview(northHillsReviewFilters);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to unlink North Hills evidence.");
    } finally {
      setSavingEvidenceKey(undefined);
    }
  };

  const saveNorthHillsSourceFactReview = async (fact: NorthHillsSourceFact, status: Exclude<NorthHillsSourceFactStatus, "promoted">) => {
    const notes = window.prompt(`Optional notes for ${sourceFactStatusLabels[status].toLowerCase()} ${sourceFactTypeLabels[fact.factType].toLowerCase()}:`, "");
    if (notes === null) return;
    const key = `${fact.id}:source-fact:${status}`;
    setSavingEvidenceKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      await reviewNorthHillsSourceFact(fact.id, {
        status,
        confidence: status === "reviewed" ? fact.confidence : status === "rejected" ? "low" : "review",
        notes,
      });
      setMessage(`${sourceFactTypeLabels[fact.factType]} marked ${sourceFactStatusLabels[status].toLowerCase()}.`);
      await loadNorthHillsOcrReview(northHillsReviewFilters);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save North Hills source fact review.");
    } finally {
      setSavingEvidenceKey(undefined);
    }
  };

  const promoteNorthHillsDeathDate = async (fact: NorthHillsSourceFact, match: NorthHillsOcrReviewEntry["candidateMatches"][number]) => {
    const defaultNote = `${fact.sourceCode} evidence from North Hills reading: ${fact.factValue}.`;
    const notes = window.prompt(`Optional burial note for promoting ${fact.factValue} to ${match.fullName || match.gravesiteId}:`, defaultNote);
    if (notes === null) return;
    const key = `${fact.id}:promote:${match.burialId}`;
    setSavingEvidenceKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      await promoteNorthHillsSourceFact(fact.id, {
        burialId: match.burialId,
        notes,
        reason: `Promote ${fact.sourceCode} death date from North Hills reading`,
      });
      setMessage(`Promoted ${fact.factValue} to ${match.fullName || match.gravesiteId}.`);
      await loadNorthHillsOcrReview(northHillsReviewFilters);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to promote North Hills source fact.");
    } finally {
      setSavingEvidenceKey(undefined);
    }
  };
  return {
    northHillsOcrReview,
    northHillsReviewFilters,
    setNorthHillsReviewFilters,
    editingNorthHillsEntryId,
    focusedNorthHillsEntryId,
    northHillsEntryForm,
    selectedNorthHillsEntryIds,
    setSelectedNorthHillsEntryIds,
    isLoadingNorthHillsReview,
    savingEvidenceKey,
    selectedNorthHillsBatch,
    selectedNorthHillsEntries,
    visibleNorthHillsEntryIds,
    nextUnresolvedNorthHillsEntry,
    loadNorthHillsOcrReview,
    updateNorthHillsReviewFilter,
    applyNorthHillsReviewFilters,
    toggleNorthHillsEntrySelection,
    toggleVisibleNorthHillsEntries,
    openNorthHillsReviewTab,
    openNorthHillsReviewQueue,
    goToNextUnresolvedNorthHillsEntry,
    startNorthHillsEntryEdit,
    cancelNorthHillsEntryEdit,
    updateNorthHillsEntryForm,
    updateNorthHillsSourceFactForm,
    updateNorthHillsObservationForm,
    saveNorthHillsEntryEdit,
    saveNorthHillsEvidence,
    unlinkNorthHillsEvidence,
    saveNorthHillsSourceFactReview,
    promoteNorthHillsDeathDate
  };
}
