import type * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  fetchCemeteryAdminRecords,
  updateCemeteryText,
  updateLotText,
  updateSectionText
} from "../../api/cemeteryApi";
import type {
  CemeteryAdminRecords,
  CemeteryTextRecord,
  CurrentUser,
  LotTextRecord,
  SectionTextRecord
} from "../../types";
import { cemeteryPickerLabel, emptyCemeteryRecords, lotPickerLabel, sectionPickerLabel } from "./adminWorkflowConfig";

type Context = {
  currentUser: CurrentUser;
  setError: React.Dispatch<React.SetStateAction<string | undefined>>;
  canManageUsers: boolean;
  setMessage: React.Dispatch<React.SetStateAction<string | undefined>>
};

export function useCemeteryAdministration({ currentUser, setError, canManageUsers, setMessage }: Context) {
  const [cemeteryRecords, setCemeteryRecords] = useState<CemeteryAdminRecords>(emptyCemeteryRecords);

  const [selectedCemeteryId, setSelectedCemeteryId] = useState("");

  const [selectedSectionId, setSelectedSectionId] = useState("");

  const [selectedLotId, setSelectedLotId] = useState("");

  const [cemeteryPickerValue, setCemeteryPickerValue] = useState("");

  const [sectionPickerValue, setSectionPickerValue] = useState("");

  const [lotPickerValue, setLotPickerValue] = useState("");

  const [isLoading, setIsLoading] = useState(true);

  const [savingRecordKey, setSavingRecordKey] = useState<string>();

  const selectedCemetery = useMemo(
    () => cemeteryRecords.cemeteries.find((cemetery) => cemetery.id === selectedCemeteryId),
    [cemeteryRecords.cemeteries, selectedCemeteryId],
  );

  const sectionsForSelectedCemetery = useMemo(
    () => cemeteryRecords.sections.filter((section) => section.cemeteryId === selectedCemeteryId),
    [cemeteryRecords.sections, selectedCemeteryId],
  );

  const selectedSection = useMemo(
    () => sectionsForSelectedCemetery.find((section) => section.id === selectedSectionId),
    [sectionsForSelectedCemetery, selectedSectionId],
  );

  const lotsForSelectedSection = useMemo(
    () => cemeteryRecords.lots.filter((lot) => lot.cemeteryId === selectedCemeteryId && lot.sectionId === selectedSection?.sectionId),
    [cemeteryRecords.lots, selectedCemeteryId, selectedSection?.sectionId],
  );

  const selectedLot = useMemo(
    () => lotsForSelectedSection.find((lot) => lot.id === selectedLotId),
    [lotsForSelectedSection, selectedLotId],
  );

  const canEditSelectedCemetery = currentUser.role === "admin" || (selectedCemeteryId ? currentUser.assignedCemeteryIds.includes(selectedCemeteryId) : false);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);

    Promise.all([
      fetchCemeteryAdminRecords(),
    ])
      .then(([nextCemeteryRecords]) => {
        if (!isCurrent) return;
        setCemeteryRecords(nextCemeteryRecords);
        setError(undefined);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) setError(loadError instanceof Error ? loadError.message : "Unable to load admin records.");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [canManageUsers, setError]);

  useEffect(() => {
    if (!cemeteryPickerValue || selectedCemeteryId) return;
    const match = cemeteryRecords.cemeteries.find((cemetery) => cemeteryPickerLabel(cemetery) === cemeteryPickerValue);
    if (match) setSelectedCemeteryId(match.id);
  }, [cemeteryPickerValue, cemeteryRecords.cemeteries, selectedCemeteryId]);

  useEffect(() => {
    if (!sectionPickerValue || selectedSectionId) return;
    const match = sectionsForSelectedCemetery.find(
      (section) => sectionPickerLabel(section) === sectionPickerValue || section.name === sectionPickerValue || section.sectionId === sectionPickerValue,
    );
    if (match) setSelectedSectionId(match.id);
  }, [sectionPickerValue, sectionsForSelectedCemetery, selectedSectionId]);

  useEffect(() => {
    if (!lotPickerValue || selectedLotId) return;
    const match = lotsForSelectedSection.find((lot) => lotPickerLabel(lot) === lotPickerValue || lot.name === lotPickerValue || lot.lotId === lotPickerValue);
    if (match) setSelectedLotId(match.id);
  }, [lotPickerValue, lotsForSelectedSection, selectedLotId]);

  const updateCemeteryRecord = (id: string, patch: Partial<CemeteryTextRecord>) => {
    setCemeteryRecords((current) => ({
      ...current,
      cemeteries: current.cemeteries.map((cemetery) => (cemetery.id === id ? { ...cemetery, ...patch } : cemetery)),
    }));
  };

  const updateSectionRecord = (id: string, patch: Partial<SectionTextRecord>) => {
    setCemeteryRecords((current) => ({
      ...current,
      sections: current.sections.map((section) => (section.id === id ? { ...section, ...patch } : section)),
    }));
  };

  const updateLotRecord = (id: string, patch: Partial<LotTextRecord>) => {
    setCemeteryRecords((current) => ({
      ...current,
      lots: current.lots.map((lot) => (lot.id === id ? { ...lot, ...patch } : lot)),
    }));
  };

  const saveCemeteryRecord = async (cemetery: CemeteryTextRecord) => {
    const key = `cemetery:${cemetery.id}`;
    setSavingRecordKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      const saved = await updateCemeteryText(cemetery.id, {
        name: cemetery.name,
        fullAddress: cemetery.fullAddress,
        municipality: cemetery.municipality,
        agency: cemetery.agency,
        agencyUrl: cemetery.agencyUrl,
        operationalHours: cemetery.operationalHours,
        contactName: cemetery.contactName,
        contactPhone: cemetery.contactPhone,
        contactEmail: cemetery.contactEmail,
        imageUrl: cemetery.imageUrl,
        notes: cemetery.notes,
      });
      updateCemeteryRecord(saved.id, saved);
      if (saved.id === selectedCemeteryId) setCemeteryPickerValue(cemeteryPickerLabel(saved));
      setMessage(`${saved.name} saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save cemetery.");
    } finally {
      setSavingRecordKey(undefined);
    }
  };

  const saveSectionRecord = async (section: SectionTextRecord) => {
    const key = `section:${section.id}`;
    setSavingRecordKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      const saved = await updateSectionText(section.id, { name: section.name, alternateNames: section.alternateNames, notes: section.notes });
      updateSectionRecord(saved.id, saved);
      if (saved.id === selectedSectionId) setSectionPickerValue(sectionPickerLabel(saved));
      setMessage(`Section ${saved.sectionId} saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save section.");
    } finally {
      setSavingRecordKey(undefined);
    }
  };

  const saveLotRecord = async (lot: LotTextRecord) => {
    const key = `lot:${lot.id}`;
    setSavingRecordKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      const saved = await updateLotText(lot.id, { name: lot.name });
      updateLotRecord(saved.id, saved);
      if (saved.id === selectedLotId) setLotPickerValue(lotPickerLabel(saved));
      setMessage(`Lot ${saved.lotId} saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save lot.");
    } finally {
      setSavingRecordKey(undefined);
    }
  };

  const selectCemeteryById = (id: string) => {
    const match = cemeteryRecords.cemeteries.find((cemetery) => cemetery.id === id);
    setSelectedCemeteryId(match?.id ?? "");
    setCemeteryPickerValue(match ? cemeteryPickerLabel(match) : "");
    setSelectedSectionId("");
    setSelectedLotId("");
    setSectionPickerValue("");
    setLotPickerValue("");
  };

  const selectSectionById = (id: string) => {
    const match = sectionsForSelectedCemetery.find((section) => section.id === id);
    setSelectedSectionId(match?.id ?? "");
    setSectionPickerValue(match ? sectionPickerLabel(match) : "");
    setSelectedLotId("");
    setLotPickerValue("");
  };

  const selectLotById = (id: string) => {
    const match = lotsForSelectedSection.find((lot) => lot.id === id);
    setSelectedLotId(match?.id ?? "");
    setLotPickerValue(match ? lotPickerLabel(match) : "");
  };
  return {
    cemeteryRecords,
    selectedCemeteryId,
    selectedSectionId,
    selectedLotId,
    isLoading,
    savingRecordKey,
    selectedCemetery,
    sectionsForSelectedCemetery,
    selectedSection,
    lotsForSelectedSection,
    selectedLot,
    canEditSelectedCemetery,
    updateCemeteryRecord,
    updateSectionRecord,
    updateLotRecord,
    saveCemeteryRecord,
    saveSectionRecord,
    saveLotRecord,
    selectCemeteryById,
    selectSectionById,
    selectLotById
  };
}
