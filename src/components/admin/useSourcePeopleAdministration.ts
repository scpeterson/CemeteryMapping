import { useConfirmation } from "../ui/confirmationContext";
import { useDraftState } from "../../hooks/useDraftState";
import type * as React from "react";
import { FormEvent, useMemo, useState } from "react";
import {
  createSourcePersonRecord,
  deleteSourcePersonRecord,
  fetchSourcePersonRecords,
  updateSourcePersonRecord
} from "../../api/cemeteryApi";
import type {
  SaveSourcePersonRecordInput,
  SourcePersonRecord,
  SourcePersonRecordFilters,
  SourcePersonRecordReview
} from "../../types";
import { AdminTab, blankSourcePersonRecordForm, defaultSourcePersonFilters, emptySourcePersonReview, sourcePersonFormFromRecord } from "./adminWorkflowConfig";

type Context = {
  setError: React.Dispatch<React.SetStateAction<string | undefined>>;
  setActiveTab: React.Dispatch<React.SetStateAction<AdminTab>>;
  setMessage: React.Dispatch<React.SetStateAction<string | undefined>>;
  scrollAdminItemIntoView: (elementId: string) => void
};

export function useSourcePeopleAdministration({ setError, setActiveTab, setMessage, scrollAdminItemIntoView }: Context) {
  const confirm = useConfirmation();
  const [sourcePersonReview, setSourcePersonReview] = useState<SourcePersonRecordReview>(emptySourcePersonReview);

  const [sourcePersonFilters, setSourcePersonFilters] = useState<SourcePersonRecordFilters>(defaultSourcePersonFilters);

  const [selectedSourcePersonRecordId, setSelectedSourcePersonRecordId] = useState("");

  const [focusedSourcePersonRecordId, setFocusedSourcePersonRecordId] = useState("");

  const [sourcePersonForm, setSourcePersonForm] = useDraftState<SaveSourcePersonRecordInput>(() => blankSourcePersonRecordForm());

  const [isLoadingSourcePersonRecords, setIsLoadingSourcePersonRecords] = useState(false);

  const [savingSourcePersonKey, setSavingSourcePersonKey] = useState<string>();

  const selectedSourcePersonRecord = useMemo(
    () => sourcePersonReview.records.find((record) => record.id === selectedSourcePersonRecordId),
    [sourcePersonReview.records, selectedSourcePersonRecordId],
  );

  const nextUnresolvedSourcePersonRecord = useMemo(
    () => sourcePersonReview.records.find((record) => record.status === "unmatched" || record.status === "candidate_match"),
    [sourcePersonReview.records],
  );

  const loadSourcePersonRecords = async (filters = sourcePersonFilters) => {
    setIsLoadingSourcePersonRecords(true);
    setError(undefined);

    try {
      const nextReview = await fetchSourcePersonRecords(filters);
      const defaultCemeteryId = nextReview.cemeteries[0]?.id ?? sourcePersonForm.cemeteryId;
      setSourcePersonReview(nextReview);
      setSourcePersonFilters((current) => ({
        ...current,
        cemeteryId: current.cemeteryId || (nextReview.cemeteries.length === 1 ? nextReview.cemeteries[0].id : ""),
      }));
      setSelectedSourcePersonRecordId((current) => (nextReview.records.some((record) => record.id === current) ? current : ""));
      if (!sourcePersonForm.cemeteryId && defaultCemeteryId) {
        setSourcePersonForm((current) => ({ ...current, cemeteryId: defaultCemeteryId }));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load source-only person records.");
    } finally {
      setIsLoadingSourcePersonRecords(false);
    }
  };

  const updateSourcePersonFilter = (patch: Partial<SourcePersonRecordFilters>) => {
    setSourcePersonFilters((current) => ({ ...current, ...patch }));
  };

  const applySourcePersonFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadSourcePersonRecords(sourcePersonFilters);
  };

  const openSourcePeopleTab = () => {
    setActiveTab("sourcePeople");
    if (sourcePersonReview.records.length === 0 && !isLoadingSourcePersonRecords) void loadSourcePersonRecords();
  };

  const openSourcePeopleReviewQueue = () => {
    const filters = { ...defaultSourcePersonFilters, status: "unmatched", limit: 50 };
    setActiveTab("sourcePeople");
    setSourcePersonFilters(filters);
    void loadSourcePersonRecords(filters);
    setMessage("Showing unmatched source-only people first.");
  };

  const goToNextUnresolvedSourcePersonRecord = () => {
    if (!nextUnresolvedSourcePersonRecord) {
      setMessage("No unresolved source-only people are visible with the current filters.");
      return;
    }
    setFocusedSourcePersonRecordId(nextUnresolvedSourcePersonRecord.id);
    startSourcePersonRecordEdit(nextUnresolvedSourcePersonRecord);
    scrollAdminItemIntoView(`source-person-record-${nextUnresolvedSourcePersonRecord.id}`);
    setMessage(`Next unresolved source-only person: ${nextUnresolvedSourcePersonRecord.fullName || "unnamed record"}.`);
  };

  const startNewSourcePersonRecord = () => {
    const defaultCemeteryId = sourcePersonFilters.cemeteryId || sourcePersonReview.cemeteries[0]?.id || "";
    setSelectedSourcePersonRecordId("");
    setSourcePersonForm(blankSourcePersonRecordForm(defaultCemeteryId));
    setMessage(undefined);
    setError(undefined);
  };

  const startSourcePersonRecordEdit = (record: SourcePersonRecord) => {
    setSelectedSourcePersonRecordId(record.id);
    setSourcePersonForm(sourcePersonFormFromRecord(record));
    setMessage(undefined);
    setError(undefined);
  };

  const updateSourcePersonForm = (patch: Partial<SaveSourcePersonRecordInput>) => {
    setSourcePersonForm((current) => ({ ...current, ...patch }));
  };

  const saveSourcePersonRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingSourcePersonKey(selectedSourcePersonRecordId || "new");
    setMessage(undefined);
    setError(undefined);

    try {
      const saved = selectedSourcePersonRecordId
        ? await updateSourcePersonRecord(selectedSourcePersonRecordId, sourcePersonForm)
        : await createSourcePersonRecord(sourcePersonForm);
      setSelectedSourcePersonRecordId(saved.id);
      setSourcePersonForm(sourcePersonFormFromRecord(saved));
      setSourcePersonReview((current) => ({
        ...current,
        records: [saved, ...current.records.filter((record) => record.id !== saved.id)],
      }));
      setMessage(`Saved source-only person record for ${saved.fullName}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save source-only person record.");
    } finally {
      setSavingSourcePersonKey(undefined);
    }
  };

  const softDeleteSourcePersonRecord = async (record: SourcePersonRecord) => {
    if (!(await confirm(`Soft delete source-only person record for ${record.fullName}?`))) return;
    const reason = window.prompt("Reason for soft delete:", "Soft-delete source-only person record.");
    if (reason === null) return;
    setSavingSourcePersonKey(`delete:${record.id}`);
    setMessage(undefined);
    setError(undefined);

    try {
      await deleteSourcePersonRecord(record.id, reason);
      setSourcePersonReview((current) => ({
        ...current,
        records: current.records.filter((currentRecord) => currentRecord.id !== record.id),
      }));
      if (selectedSourcePersonRecordId === record.id) {
        setSelectedSourcePersonRecordId("");
        setSourcePersonForm(blankSourcePersonRecordForm(sourcePersonFilters.cemeteryId || sourcePersonReview.cemeteries[0]?.id || ""));
      }
      setMessage(`Soft-deleted source-only person record for ${record.fullName}.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to soft delete source-only person record.");
    } finally {
      setSavingSourcePersonKey(undefined);
    }
  };
  return {
    sourcePersonReview,
    sourcePersonFilters,
    setSourcePersonFilters,
    selectedSourcePersonRecordId,
    focusedSourcePersonRecordId,
    sourcePersonForm,
    isLoadingSourcePersonRecords,
    savingSourcePersonKey,
    selectedSourcePersonRecord,
    nextUnresolvedSourcePersonRecord,
    loadSourcePersonRecords,
    updateSourcePersonFilter,
    applySourcePersonFilters,
    openSourcePeopleTab,
    openSourcePeopleReviewQueue,
    goToNextUnresolvedSourcePersonRecord,
    startNewSourcePersonRecord,
    startSourcePersonRecordEdit,
    updateSourcePersonForm,
    saveSourcePersonRecord,
    softDeleteSourcePersonRecord
  };
}
