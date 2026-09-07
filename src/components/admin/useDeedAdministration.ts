import type * as React from "react";
import { FormEvent, useMemo, useState } from "react";
import {
  createDeedInvestigationAction,
  createDeedInvestigationCase,
  fetchDeedInvestigationCases,
  fetchDeedRegistryReview,
  linkDeedInvestigationCaseEntry,
  updateDeedInvestigationAction,
  updateDeedInvestigationCase
} from "../../api/cemeteryApi";
import type {
  DeedInvestigationAction,
  DeedInvestigationCase,
  DeedRegistryReview,
  DeedRegistryReviewEntry,
  DeedRegistryReviewFilters,
  SaveDeedInvestigationActionInput,
  SaveDeedInvestigationCaseInput
} from "../../types";
import {
  blankDeedActionForm,
  blankDeedCaseForm,
  defaultDeedCaseFilters,
  defaultDeedReviewFilters,
} from "../AdminPanelDeedConfig";
import { AdminTab, deedActionFormFromAction, deedCaseFormFromCase, deedSearchTerms, emptyDeedRegistryReview, uniqueFilled } from "./adminWorkflowConfig";

type Context = {
  setError: React.Dispatch<React.SetStateAction<string | undefined>>;
  setMessage: React.Dispatch<React.SetStateAction<string | undefined>>;
  setActiveTab: React.Dispatch<React.SetStateAction<AdminTab>>
};

export function useDeedAdministration({ setError, setMessage, setActiveTab }: Context) {
  const [deedRegistryReview, setDeedRegistryReview] = useState<DeedRegistryReview>(emptyDeedRegistryReview);

  const [deedReviewFilters, setDeedReviewFilters] = useState<DeedRegistryReviewFilters>(defaultDeedReviewFilters);

  const [deedCases, setDeedCases] = useState<DeedInvestigationCase[]>([]);

  const [deedCaseFilters, setDeedCaseFilters] = useState(defaultDeedCaseFilters);

  const [selectedDeedCaseId, setSelectedDeedCaseId] = useState("");

  const [deedCaseForm, setDeedCaseForm] = useState<SaveDeedInvestigationCaseInput>(() => blankDeedCaseForm());

  const [selectedDeedActionId, setSelectedDeedActionId] = useState("");

  const [deedActionForm, setDeedActionForm] = useState<SaveDeedInvestigationActionInput>(() => blankDeedActionForm());

  const [isLoadingDeedReview, setIsLoadingDeedReview] = useState(false);

  const [isLoadingDeedCases, setIsLoadingDeedCases] = useState(false);

  const [savingDeedCaseKey, setSavingDeedCaseKey] = useState<string>();

  const [savingDeedActionKey, setSavingDeedActionKey] = useState<string>();

  const selectedDeedBatch = useMemo(
    () => deedRegistryReview.batches.find((batch) => batch.id === deedRegistryReview.selectedBatchId),
    [deedRegistryReview.batches, deedRegistryReview.selectedBatchId],
  );

  const removedOriginalDeedEntries = deedRegistryReview.removedOriginalEntries ?? [];

  const selectedDeedCase = useMemo(() => deedCases.find((investigation) => investigation.id === selectedDeedCaseId), [deedCases, selectedDeedCaseId]);

  const deedResearchTerms = useMemo(() => deedSearchTerms(deedReviewFilters.q ?? ""), [deedReviewFilters.q]);

  const deedInvestigationOwners = useMemo(
    () => uniqueFilled(deedRegistryReview.entries.map((entry) => entry.ownerDisplayName)).slice(0, 8),
    [deedRegistryReview.entries],
  );

  const deedInvestigationLots = useMemo(
    () =>
      uniqueFilled(
        deedRegistryReview.entries.flatMap((entry) => [
          ...entry.parsedLotNumbers,
          ...entry.parsedPlotNumbers,
          entry.rawLotText,
          entry.parsedSectionAlias ? `${entry.parsedSectionAlias} ${entry.rawLotText}` : "",
        ]),
      ).slice(0, 10),
    [deedRegistryReview.entries],
  );

  const deedInvestigationNoteCount = useMemo(
    () => deedRegistryReview.entries.reduce((count, entry) => count + entry.relatedInvestigationNotes.length, 0),
    [deedRegistryReview.entries],
  );

  const deedOnFileCount = useMemo(
    () => deedRegistryReview.entries.filter((entry) => /^(yes|y|true|1)$/iu.test(entry.deedOnFile.trim())).length,
    [deedRegistryReview.entries],
  );

  const deedRegisterOnFileCount = useMemo(
    () => deedRegistryReview.entries.filter((entry) => /^(yes|y|true|1)$/iu.test(entry.deedRegisterOnFile.trim())).length,
    [deedRegistryReview.entries],
  );

  const loadDeedRegistryReview = async (filters = deedReviewFilters) => {
    setIsLoadingDeedReview(true);
    setError(undefined);

    try {
      const nextReview = await fetchDeedRegistryReview(filters);
      setDeedRegistryReview(nextReview);
      setDeedReviewFilters((current) => ({ ...current, batchId: nextReview.selectedBatchId }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load deed registry evidence.");
    } finally {
      setIsLoadingDeedReview(false);
    }
  };

  const updateDeedReviewFilter = (patch: Partial<DeedRegistryReviewFilters>) => {
    setDeedReviewFilters((current) => ({ ...current, ...patch }));
  };

  const applyDeedReviewFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadDeedRegistryReview(deedReviewFilters);
  };

  const loadDeedCases = async (filters = deedCaseFilters) => {
    setIsLoadingDeedCases(true);
    setError(undefined);

    try {
      const nextCases = await fetchDeedInvestigationCases(filters);
      setDeedCases(nextCases);
      setSelectedDeedCaseId((current) => (nextCases.some((investigation) => investigation.id === current) ? current : (nextCases[0]?.id ?? "")));
      if (!selectedDeedCaseId && nextCases[0]) setDeedCaseForm(deedCaseFormFromCase(nextCases[0]));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load deed investigation cases.");
    } finally {
      setIsLoadingDeedCases(false);
    }
  };

  const selectDeedCase = (investigation: DeedInvestigationCase) => {
    setSelectedDeedCaseId(investigation.id);
    setDeedCaseForm(deedCaseFormFromCase(investigation));
    setSelectedDeedActionId("");
    setDeedActionForm(blankDeedActionForm());
  };

  const startNewDeedCase = () => {
    setSelectedDeedCaseId("");
    setDeedCaseForm(blankDeedCaseForm());
    setSelectedDeedActionId("");
    setDeedActionForm(blankDeedActionForm());
  };

  const saveDeedCase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingDeedCaseKey(selectedDeedCaseId || "new");
    setError(undefined);
    setMessage(undefined);

    try {
      const saved = selectedDeedCaseId
        ? await updateDeedInvestigationCase(selectedDeedCaseId, deedCaseForm)
        : await createDeedInvestigationCase(deedCaseForm);
      setSelectedDeedCaseId(saved.id);
      setDeedCaseForm(deedCaseFormFromCase(saved));
      setDeedCases((current) => [saved, ...current.filter((investigation) => investigation.id !== saved.id)]);
      setMessage(`Saved deed investigation case ${saved.caseNumber}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save deed investigation case.");
    } finally {
      setSavingDeedCaseKey(undefined);
    }
  };

  const selectDeedAction = (action: DeedInvestigationAction) => {
    setSelectedDeedActionId(action.id);
    setDeedActionForm(deedActionFormFromAction(action));
  };

  const startNewDeedAction = () => {
    setSelectedDeedActionId("");
    setDeedActionForm({
      ...blankDeedActionForm(),
      subjectName: deedCaseForm.subjectName,
      plotReference: deedCaseForm.plotReference,
    });
  };

  const saveDeedAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedDeedCaseId) {
      setError("Save or select an investigation case before adding recommended actions.");
      return;
    }

    setSavingDeedActionKey(selectedDeedActionId || "new");
    setError(undefined);
    setMessage(undefined);

    try {
      const saved = selectedDeedActionId
        ? await updateDeedInvestigationAction(selectedDeedCaseId, selectedDeedActionId, deedActionForm)
        : await createDeedInvestigationAction(selectedDeedCaseId, deedActionForm);
      setSelectedDeedActionId(saved.id);
      setDeedActionForm(deedActionFormFromAction(saved));
      setDeedCases((current) =>
        current.map((investigation) =>
          investigation.id === selectedDeedCaseId
            ? {
              ...investigation,
              recommendedActions: [
                ...investigation.recommendedActions.filter((action) => action.id !== saved.id),
                saved,
              ].sort((left, right) => left.sortOrder - right.sortOrder || left.subjectName.localeCompare(right.subjectName)),
            }
            : investigation,
        ),
      );
      setMessage(`Saved recommended action for ${saved.subjectName}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save recommended action.");
    } finally {
      setSavingDeedActionKey(undefined);
    }
  };

  const attachEntryToSelectedDeedCase = async (entry: DeedRegistryReviewEntry) => {
    if (!selectedDeedCaseId) {
      setError("Select or create an investigation case before attaching deed evidence.");
      return;
    }
    const note = window.prompt(`Optional note for row ${entry.sourceRowNumber}:`, "");
    if (note === null) return;
    const key = `${selectedDeedCaseId}:${entry.id}`;
    setSavingDeedCaseKey(key);
    setError(undefined);
    setMessage(undefined);

    try {
      const saved = await linkDeedInvestigationCaseEntry(selectedDeedCaseId, entry.id, note);
      setDeedCases((current) => current.map((investigation) => (investigation.id === saved.id ? saved : investigation)));
      setMessage(`Linked row ${entry.sourceRowNumber} to ${saved.caseNumber}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to link deed evidence to the selected case.");
    } finally {
      setSavingDeedCaseKey(undefined);
    }
  };

  const openDeedReviewTab = () => {
    setActiveTab("deeds");
    if (deedRegistryReview.batches.length === 0 && !isLoadingDeedReview) void loadDeedRegistryReview();
    if (deedCases.length === 0 && !isLoadingDeedCases) void loadDeedCases();
  };
  return {
    deedRegistryReview,
    deedReviewFilters,
    setDeedReviewFilters,
    deedCases,
    deedCaseFilters,
    setDeedCaseFilters,
    selectedDeedCaseId,
    deedCaseForm,
    setDeedCaseForm,
    selectedDeedActionId,
    deedActionForm,
    setDeedActionForm,
    isLoadingDeedReview,
    isLoadingDeedCases,
    savingDeedCaseKey,
    savingDeedActionKey,
    selectedDeedBatch,
    removedOriginalDeedEntries,
    selectedDeedCase,
    deedResearchTerms,
    deedInvestigationOwners,
    deedInvestigationLots,
    deedInvestigationNoteCount,
    deedOnFileCount,
    deedRegisterOnFileCount,
    loadDeedRegistryReview,
    updateDeedReviewFilter,
    applyDeedReviewFilters,
    loadDeedCases,
    selectDeedCase,
    startNewDeedCase,
    saveDeedCase,
    selectDeedAction,
    startNewDeedAction,
    saveDeedAction,
    attachEntryToSelectedDeedCase,
    openDeedReviewTab
  };
}
