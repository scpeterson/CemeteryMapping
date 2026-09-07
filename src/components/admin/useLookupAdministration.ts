import type * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { AdminTab, blankLookupRecord, emptyLookupAdminRecords, lookupCodeFromLabel, lookupDuplicateSortOrders, lookupUsageText } from "./adminWorkflowConfig";

type Context = {
  setError: React.Dispatch<React.SetStateAction<string | undefined>>;
  setActiveTab: React.Dispatch<React.SetStateAction<AdminTab>>;
  setMessage: React.Dispatch<React.SetStateAction<string | undefined>>;
  setAuditSeedFilters: React.Dispatch<React.SetStateAction<AuditEventFilters | undefined>>
};

export function useLookupAdministration({ setError, setActiveTab, setMessage, setAuditSeedFilters }: Context) {
  const [lookupRecords, setLookupRecords] = useState<LookupAdminRecords>(emptyLookupAdminRecords);

  const [selectedLookupTable, setSelectedLookupTable] = useState("");

  const [showInactiveLookups, setShowInactiveLookups] = useState(false);

  const [newLookupRecord, setNewLookupRecord] = useState<LookupRecord>(blankLookupRecord);

  const [isLoadingLookups, setIsLoadingLookups] = useState(false);

  const [savingLookupKey, setSavingLookupKey] = useState<string>();

  const [recentlyMovedLookupIds, setRecentlyMovedLookupIds] = useState<Set<string>>(() => new Set());

  const movedLookupTimeoutRef = useRef<number | undefined>(undefined);

  const selectedLookupDefinition = useMemo(
    () => lookupRecords.tables.find((table) => table.table === selectedLookupTable),
    [lookupRecords.tables, selectedLookupTable],
  );

  const selectedLookupAllRows = useMemo(() => lookupRecords.lookups[selectedLookupTable] ?? [], [lookupRecords.lookups, selectedLookupTable]);

  const selectedLookupRows = useMemo(
    () => (showInactiveLookups ? selectedLookupAllRows : selectedLookupAllRows.filter((row) => row.isActive)),
    [selectedLookupAllRows, showInactiveLookups],
  );

  const duplicateLookupSortOrders = useMemo(() => lookupDuplicateSortOrders(selectedLookupAllRows), [selectedLookupAllRows]);

  useEffect(
    () => () => {
      if (movedLookupTimeoutRef.current) window.clearTimeout(movedLookupTimeoutRef.current);
    },
    [],
  );

  const loadLookupRecords = async () => {
    setIsLoadingLookups(true);
    setError(undefined);

    try {
      const nextLookups = await fetchLookupAdminRecords();
      setLookupRecords(nextLookups);
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
          [table]: nextRows.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label) || a.code.localeCompare(b.code)),
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
      const shouldContinue = window.confirm(`${row.label} is ${lookupUsageText(row).toLowerCase()} Deactivate it anyway?`);
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

  const moveLookupRecord = async (table: string, row: LookupRecord, direction: -1 | 1) => {
    const rows = [...(showInactiveLookups ? lookupRecords.lookups[table] ?? [] : (lookupRecords.lookups[table] ?? []).filter((candidate) => candidate.isActive))].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label) || a.code.localeCompare(b.code),
    );
    const rowIndex = rows.findIndex((candidate) => candidate.id === row.id);
    const swapWith = rows[rowIndex + direction];
    if (!swapWith) return;

    const key = `${table}:move:${row.id}`;
    const nextRow = { ...row, sortOrder: swapWith.sortOrder };
    const nextSwapWith = { ...swapWith, sortOrder: row.sortOrder };
    setSavingLookupKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      const [savedRow, savedSwapWith] = await Promise.all([updateLookupRecord(table, nextRow.id, nextRow), updateLookupRecord(table, nextSwapWith.id, nextSwapWith)]);
      replaceLookupRecord(table, savedRow);
      replaceLookupRecord(table, savedSwapWith);
      setRecentlyMovedLookupIds(new Set([savedRow.id, savedSwapWith.id]));
      if (movedLookupTimeoutRef.current) window.clearTimeout(movedLookupTimeoutRef.current);
      movedLookupTimeoutRef.current = window.setTimeout(() => setRecentlyMovedLookupIds(new Set()), 1600);
      setMessage(`${row.label} moved ${direction < 0 ? "up" : "down"}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to reorder lookup rows.");
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
    recentlyMovedLookupIds,
    selectedLookupDefinition,
    selectedLookupRows,
    duplicateLookupSortOrders,
    loadLookupRecords,
    openLookupsTab,
    updateLocalLookupRecord,
    saveLookupRecord,
    moveLookupRecord,
    viewLookupAudit,
    addLookupRecord
  };
}
