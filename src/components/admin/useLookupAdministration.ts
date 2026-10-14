import { useConfirmation } from "../ui/confirmationContext";
import type * as React from "react";
import { useMemo, useState } from "react";
import {
  createLookupRecord,
  fetchLookupAdminRecords,
  updateLookupRecord
} from "../../api/cemeteryApi";
import type {
  AuditEventFilters,
  LookupAdminRecords,
  LookupRecord
} from "../../types";
import { defaultAuditFilters } from "../AdminEventDefaults";
import { AdminTab, blankLookupRecord, emptyLookupAdminRecords, lookupCodeFromLabel, lookupUsageText } from "./adminWorkflowConfig";

type Context = {
  setError: React.Dispatch<React.SetStateAction<string | undefined>>;
  setActiveTab: React.Dispatch<React.SetStateAction<AdminTab>>;
  setMessage: React.Dispatch<React.SetStateAction<string | undefined>>;
  setAuditSeedFilters: React.Dispatch<React.SetStateAction<AuditEventFilters | undefined>>
};

export function useLookupAdministration({ setError, setActiveTab, setMessage, setAuditSeedFilters }: Context) {
  const confirm = useConfirmation();
  const [lookupRecords, setLookupRecords] = useState<LookupAdminRecords>(emptyLookupAdminRecords);

  const [selectedLookupTable, setSelectedLookupTable] = useState("");

  const [showInactiveLookups, setShowInactiveLookups] = useState(false);

  const [newLookupRecord, setNewLookupRecord] = useState<LookupRecord>(blankLookupRecord);

  const [isLoadingLookups, setIsLoadingLookups] = useState(false);

  const [savingLookupKey, setSavingLookupKey] = useState<string>();

  const selectedLookupDefinition = useMemo(
    () => lookupRecords.tables.find((table) => table.table === selectedLookupTable),
    [lookupRecords.tables, selectedLookupTable],
  );

  const selectedLookupAllRows = useMemo(() => lookupRecords.lookups[selectedLookupTable] ?? [], [lookupRecords.lookups, selectedLookupTable]);

  const selectedLookupRows = useMemo(
    () => (showInactiveLookups ? selectedLookupAllRows : selectedLookupAllRows.filter((row) => row.isActive)),
    [selectedLookupAllRows, showInactiveLookups],
  );

  const loadLookupRecords = async () => {
    setIsLoadingLookups(true);
    setError(undefined);

    try {
      const nextLookups = await fetchLookupAdminRecords();
      setLookupRecords({ ...nextLookups, lookups: Object.fromEntries(
        Object.entries(nextLookups.lookups).map(([table, rows]) => [table, [...rows].sort(
          (a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()) || a.code.localeCompare(b.code),
        )]),
      ) });
      setSelectedLookupTable((current) => (nextLookups.tables.some((table) => table.table === current) ? current : (nextLookups.tables[0]?.table ?? "")));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load lookup records.");
    } finally {
      setIsLoadingLookups(false);
    }
  };

  const openLookupsTab = () => {
    setActiveTab("lookups");
    if (lookupRecords.tables.length === 0 && !isLoadingLookups) void loadLookupRecords();
  };

  const replaceLookupRecord = (table: string, saved: LookupRecord) => {
    setLookupRecords((current) => {
      const existingRows = current.lookups[table] ?? [];
      const exists = existingRows.some((row) => row.id === saved.id);
      const nextRows = exists ? existingRows.map((row) => (row.id === saved.id ? saved : row)) : [...existingRows, saved];

      return {
        ...current,
        lookups: {
          ...current.lookups,
          [table]: nextRows.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()) || a.code.localeCompare(b.code)),
        },
      };
    });
  };

  const updateLocalLookupRecord = (table: string, id: string, patch: Partial<LookupRecord>) => {
    setLookupRecords((current) => ({
      ...current,
      lookups: {
        ...current.lookups,
        [table]: (current.lookups[table] ?? []).map((row) => (row.id === id ? { ...row, ...patch } : row)),
      },
    }));
  };

  const saveLookupRecord = async (table: string, row: LookupRecord) => {
    const key = `${table}:${row.id}`;
    if (!row.isActive && row.usageCount > 0) {
      const shouldContinue = await confirm(`${row.label} is ${lookupUsageText(row).toLowerCase()} Deactivate it anyway?`);
      if (!shouldContinue) return;
    }

    setSavingLookupKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      const saved = await updateLookupRecord(table, row.id, row);
      replaceLookupRecord(table, saved);
      setMessage(`${saved.label} saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save lookup row.");
    } finally {
      setSavingLookupKey(undefined);
    }
  };

  const viewLookupAudit = (table: string, row: LookupRecord) => {
    const filters = { ...defaultAuditFilters, targetTable: table, targetRecordId: row.id };
    setAuditSeedFilters(filters);
    setActiveTab("audit");
  };

  const addLookupRecord = async () => {
    if (!selectedLookupDefinition) return;
    const key = `${selectedLookupDefinition.table}:new`;
    const existingCodes = new Set((lookupRecords.lookups[selectedLookupDefinition.table] ?? []).map((row) => row.code));
    const lookupToCreate = {
      ...newLookupRecord,
      code: lookupCodeFromLabel(newLookupRecord.label, existingCodes),
    };
    setSavingLookupKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      const saved = await createLookupRecord(selectedLookupDefinition.table, lookupToCreate);
      replaceLookupRecord(selectedLookupDefinition.table, saved);
      setNewLookupRecord(blankLookupRecord);
      setMessage(`${saved.label} added.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to add lookup row.");
    } finally {
      setSavingLookupKey(undefined);
    }
  };
  return {
    lookupRecords,
    selectedLookupTable,
    setSelectedLookupTable,
    showInactiveLookups,
    setShowInactiveLookups,
    newLookupRecord,
    setNewLookupRecord,
    isLoadingLookups,
    savingLookupKey,
    selectedLookupDefinition,
    selectedLookupRows,
    loadLookupRecords,
    openLookupsTab,
    updateLocalLookupRecord,
    saveLookupRecord,
    viewLookupAudit,
    addLookupRecord
  };
}
