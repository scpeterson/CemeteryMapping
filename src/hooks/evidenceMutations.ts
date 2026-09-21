import { updateEvidenceInGrave, updateEvidenceInMarker } from "./evidenceMutationState";
import { createGraveFeature, createMaintenanceRecord, deleteGraveFeature, updateGraveFeature, updateMaintenanceRecord } from "../api/cemeteryApi";
import { removeFeatureFromGrave, removeFeatureFromHeadstone } from "./recordMutationState";
import type { SaveGraveFeatureInput, SaveMaintenanceRecordInput } from "../types";
import type { RecordMutationContext } from "./recordMutationContext";

export function createEvidenceMutations({ selectedGrave, selectedHeadstone, setSelectedGraveDetails, setSelectedHeadstoneDetails }: RecordMutationContext) {
  const saveGraveFeature = async (feature: SaveGraveFeatureInput) => {
    const cemeteryId = selectedGrave?.cemeteryId ?? selectedHeadstone?.cemeteryId;
    if (!cemeteryId) throw new Error("Select a grave site or marker before adding a feature.");
    const saved = await createGraveFeature(cemeteryId, feature);
    const update = { kind: "feature" as const, saved };
    setSelectedGraveDetails((current) => updateEvidenceInGrave(current, update, true, Boolean(feature.graveSpaceId)));
    setSelectedHeadstoneDetails((current) => updateEvidenceInMarker(current, update, true));
    return saved;
  };

  const saveMaintenanceRecord = async (record: SaveMaintenanceRecordInput) => {
    const cemeteryId = selectedGrave?.cemeteryId ?? selectedHeadstone?.cemeteryId;
    if (!cemeteryId) throw new Error("Select a grave site or marker before adding maintenance.");
    const saved = await createMaintenanceRecord(cemeteryId, record);
    const update = { kind: "maintenance" as const, saved };
    setSelectedGraveDetails((current) => updateEvidenceInGrave(current, update, true, Boolean(record.graveSpaceId)));
    setSelectedHeadstoneDetails((current) => updateEvidenceInMarker(current, update, true));
    return saved;
  };

  const updateSavedGraveFeature = async (id: string, feature: SaveGraveFeatureInput) => {
    const saved = await updateGraveFeature(id, feature);
    const update = { kind: "feature" as const, saved };
    setSelectedGraveDetails((current) => updateEvidenceInGrave(current, update));
    setSelectedHeadstoneDetails((current) => updateEvidenceInMarker(current, update));
    return saved;
  };

  const deleteSavedGraveFeature = async (id: string, reason?: string) => {
    await deleteGraveFeature(id, reason);
    setSelectedGraveDetails((current) => removeFeatureFromGrave(current, id));
    setSelectedHeadstoneDetails((current) => removeFeatureFromHeadstone(current, id));
  };

  const updateSavedMaintenanceRecord = async (id: string, record: SaveMaintenanceRecordInput) => {
    const saved = await updateMaintenanceRecord(id, record);
    const update = { kind: "maintenance" as const, saved };
    setSelectedGraveDetails((current) => updateEvidenceInGrave(current, update));
    setSelectedHeadstoneDetails((current) => updateEvidenceInMarker(current, update));
    return saved;
  };

  return { saveGraveFeature, saveMaintenanceRecord, updateSavedGraveFeature, deleteSavedGraveFeature, updateSavedMaintenanceRecord };
}
