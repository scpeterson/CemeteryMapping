import type { Dispatch, SetStateAction } from "react";
import {
  createOwnershipEvent,
  removeGravesiteOwnershipRight,
  updateOwner,
  updateGraveLot,
  createGraveFeature,
  createGravesiteHeadstone,
  createHeadstoneRelationship,
  createHeadstoneGravesiteRelationship,
  createMaintenanceRecord,
  deleteHeadstoneRelationship,
  deleteHeadstoneGravesiteRelationship,
  deleteGraveFeature,
  deleteMediaAsset,
  fetchCemeteryData,
  fetchHeadstone,
  updateBurial,
  updateGraveFeature,
  updateGraveSpace,
  updateHeadstone,
  updateHeadstoneRelationship,
  updateHeadstoneGravesiteRelationship,
  updateMaintenanceRecord,
  moveMediaAsset,
  uploadGravePhoto,
  uploadHeadstonePhoto,
} from "../api/cemeteryApi";
import { graveSelectionKey } from "../lib/format";
import type {
  Burial,
  CemeteryData,
  GraveSpace,
  GraveSpaceSummary,
  Headstone,
  HeadstoneSummary,
  SaveBurialInput,
  SaveGraveSpaceInput,
  SaveGraveFeatureInput,
  SaveHeadstoneInput,
  SaveHeadstoneGravesiteRelationshipInput,
  SaveHeadstoneCreateInput,
  SaveHeadstoneRelationshipInput,
  SaveMaintenanceRecordInput,
  SaveOwnershipEventInput,
  UpdateOwnerInput,
} from "../types";

type UseRecordMutationsInput = {
  selectedGrave?: GraveSpaceSummary;
  selectedHeadstone?: HeadstoneSummary;
  setSelectedGrave: Dispatch<SetStateAction<GraveSpaceSummary | undefined>>;
  setData: Dispatch<SetStateAction<CemeteryData>>;
  setSelectedGraveDetails: Dispatch<SetStateAction<GraveSpace | undefined>>;
  setSelectedHeadstoneDetails: Dispatch<SetStateAction<Headstone | undefined>>;
  refreshDetails: (options?: { preserveCurrent?: boolean }) => void;
};

export function useRecordMutations({
  selectedGrave,
  selectedHeadstone,
  setSelectedGrave,
  setData,
  setSelectedGraveDetails,
  setSelectedHeadstoneDetails,
  refreshDetails,
}: UseRecordMutationsInput) {
  const saveHeadstone = async (id: string, headstone: SaveHeadstoneInput): Promise<Headstone> => {
    const saved = await updateHeadstone(id, headstone);
    setSelectedGraveDetails((current) =>
      current
        ? {
            ...current,
            headstones: current.headstones.map((candidate) => (candidate.id === saved.id ? saved : candidate)),
          }
        : current,
    );
    setSelectedHeadstoneDetails((current) => (current?.id === saved.id ? saved : current));
    setData((current) => ({
      ...current,
      headstones: (current.headstones ?? []).map((candidate) =>
        candidate.id === saved.id
          ? {
              ...candidate,
              markerTypeCode: saved.markerType.code,
              markerType: saved.markerType.label,
              markerScopeCode: saved.markerScope.code,
              markerScope: saved.markerScope.label,
              condition: saved.condition.code,
            }
          : candidate,
        ),
    }));
    if (saved.burialNhgPropagation) {
      refreshDetails({ preserveCurrent: true });
    }
    return saved;
  };

  const createHeadstoneForGrave = async (grave: GraveSpace, headstone: SaveHeadstoneCreateInput): Promise<Headstone> => {
    const saved = await createGravesiteHeadstone(grave.cemeteryId, grave.id, headstone);
    setSelectedGraveDetails((current) =>
      current?.id === grave.id
        ? {
            ...current,
            headstones: [...current.headstones, saved],
          }
        : current,
    );
    refreshDetails({ preserveCurrent: true });
    fetchCemeteryData()
      .then((nextData) => setData(nextData))
      .catch(() => undefined);
    return saved;
  };


  const refreshHeadstoneDetails = async (id: string) => {
    const refreshed = await fetchHeadstone(id);
    setSelectedHeadstoneDetails((current) => (current?.id === refreshed.id ? refreshed : current));
    setSelectedGraveDetails((current) =>
      current
        ? {
            ...current,
            headstones: current.headstones.map((candidate) => (candidate.id === refreshed.id ? refreshed : candidate)),
          }
        : current,
    );
    return refreshed;
  };

  const saveHeadstoneRelationship = async (headstoneId: string, relationship: SaveHeadstoneRelationshipInput) => {
    await createHeadstoneRelationship(headstoneId, relationship);
    return refreshHeadstoneDetails(headstoneId);
  };

  const updateSavedHeadstoneRelationship = async (headstoneId: string, relationshipId: string, relationship: SaveHeadstoneRelationshipInput) => {
    await updateHeadstoneRelationship(relationshipId, relationship);
    return refreshHeadstoneDetails(headstoneId);
  };

  const deleteSavedHeadstoneRelationship = async (headstoneId: string, relationshipId: string, reason?: string) => {
    await deleteHeadstoneRelationship(relationshipId, reason);
    await refreshHeadstoneDetails(headstoneId);
  };

  const saveHeadstoneGravesiteRelationship = async (headstoneId: string, relationship: SaveHeadstoneGravesiteRelationshipInput) => {
    await createHeadstoneGravesiteRelationship(headstoneId, relationship);
    return refreshHeadstoneDetails(headstoneId);
  };

  const updateSavedHeadstoneGravesiteRelationship = async (headstoneId: string, relationshipId: string, relationship: SaveHeadstoneGravesiteRelationshipInput) => {
    await updateHeadstoneGravesiteRelationship(relationshipId, relationship);
    return refreshHeadstoneDetails(headstoneId);
  };

  const deleteSavedHeadstoneGravesiteRelationship = async (headstoneId: string, relationshipId: string, reason?: string) => {
    await deleteHeadstoneGravesiteRelationship(relationshipId, reason);
    await refreshHeadstoneDetails(headstoneId);
  };

  const saveGraveSpace = async (graveSpace: SaveGraveSpaceInput): Promise<GraveSpace> => {
    if (!selectedGrave) throw new Error("Select a grave site before saving.");
    const saved = await updateGraveSpace(selectedGrave.cemeteryId, selectedGrave.id, graveSpace);
    setSelectedGraveDetails(saved);
    setSelectedGrave(saved);
    setData((current) => ({
      ...current,
      graves: current.graves.map((candidate) => (graveSelectionKey(candidate) === graveSelectionKey(saved) ? saved : candidate)),
    }));
    return saved;
  };

  const saveBurial = async (id: string, burial: SaveBurialInput): Promise<Burial> => {
    const saved = await updateBurial(id, burial);
    setSelectedGraveDetails((current) =>
      current
        ? {
            ...current,
            burials: current.burials.map((candidate) => (candidate.id === saved.id ? saved : candidate)),
          }
        : current,
    );
    return saved;
  };

  const saveGraveFeature = async (feature: SaveGraveFeatureInput) => {
    const cemeteryId = selectedGrave?.cemeteryId ?? selectedHeadstone?.cemeteryId;
    if (!cemeteryId) throw new Error("Select a grave site or marker before adding a feature.");
    const saved = await createGraveFeature(cemeteryId, feature);
    setSelectedGraveDetails((current) =>
      current
        ? {
            ...current,
            features: feature.graveSpaceId ? [...(current.features ?? []), saved] : (current.features ?? []),
            headstones: current.headstones.map((headstone) => (headstone.id === saved.headstoneUuid ? { ...headstone, features: [...(headstone.features ?? []), saved] } : headstone)),
          }
        : current,
    );
    setSelectedHeadstoneDetails((current) => {
      if (!current || current.id !== saved.headstoneUuid) return current;
      return { ...current, features: [...(current.features ?? []), saved] };
    });
    return saved;
  };

  const saveMaintenanceRecord = async (record: SaveMaintenanceRecordInput) => {
    const cemeteryId = selectedGrave?.cemeteryId ?? selectedHeadstone?.cemeteryId;
    if (!cemeteryId) throw new Error("Select a grave site or marker before adding maintenance.");
    const saved = await createMaintenanceRecord(cemeteryId, record);
    setSelectedGraveDetails((current) => {
      if (!current) return current;
      return {
        ...current,
        maintenanceRecords: record.graveSpaceId ? [...(current.maintenanceRecords ?? []), saved] : (current.maintenanceRecords ?? []),
        headstones: current.headstones.map((headstone) =>
          headstone.id === saved.headstoneUuid ? { ...headstone, maintenanceRecords: [...(headstone.maintenanceRecords ?? []), saved] } : headstone,
        ),
      };
    });
    setSelectedHeadstoneDetails((current) => {
      if (!current || current.id !== saved.headstoneUuid) return current;
      return { ...current, maintenanceRecords: [...(current.maintenanceRecords ?? []), saved] };
    });
    return saved;
  };

  const updateSavedGraveFeature = async (id: string, feature: SaveGraveFeatureInput) => {
    const saved = await updateGraveFeature(id, feature);
    setSelectedGraveDetails((current) =>
      current
        ? {
            ...current,
            features: (current.features ?? []).map((currentFeature) => (currentFeature.id === saved.id ? saved : currentFeature)),
            headstones: current.headstones.map((headstone) =>
              headstone.id === saved.headstoneUuid
                ? { ...headstone, features: (headstone.features ?? []).map((currentFeature) => (currentFeature.id === saved.id ? saved : currentFeature)) }
                : headstone,
            ),
          }
        : current,
    );
    setSelectedHeadstoneDetails((current) => {
      if (!current || current.id !== saved.headstoneUuid) return current;
      return { ...current, features: (current.features ?? []).map((currentFeature) => (currentFeature.id === saved.id ? saved : currentFeature)) };
    });
    return saved;
  };

  const deleteSavedGraveFeature = async (id: string, reason?: string) => {
    await deleteGraveFeature(id, reason);
    refreshDetails({ preserveCurrent: true });
  };

  const updateSavedMaintenanceRecord = async (id: string, record: SaveMaintenanceRecordInput) => {
    const saved = await updateMaintenanceRecord(id, record);
    setSelectedGraveDetails((current) =>
      current
        ? {
            ...current,
            maintenanceRecords: (current.maintenanceRecords ?? []).map((currentRecord) => (currentRecord.id === saved.id ? saved : currentRecord)),
            headstones: current.headstones.map((headstone) =>
              headstone.id === saved.headstoneUuid
                ? { ...headstone, maintenanceRecords: (headstone.maintenanceRecords ?? []).map((currentRecord) => (currentRecord.id === saved.id ? saved : currentRecord)) }
                : headstone,
            ),
          }
        : current,
    );
    setSelectedHeadstoneDetails((current) => {
      if (!current || current.id !== saved.headstoneUuid) return current;
      return { ...current, maintenanceRecords: (current.maintenanceRecords ?? []).map((currentRecord) => (currentRecord.id === saved.id ? saved : currentRecord)) };
    });
    return saved;
  };

  const saveGravePhoto = async ({ file, headstoneId, notes, capturedAt }: { file: File; headstoneId?: string; notes?: string; capturedAt?: string }) => {
    const source = /iPhone|iPad|iPod/u.test(navigator.userAgent) ? "iphone" : "field_upload";
    if (selectedGrave) {
      await uploadGravePhoto({
        cemeteryId: selectedGrave.cemeteryId,
        graveSpaceId: selectedGrave.id,
        file,
        headstoneId,
        notes,
        capturedAt,
        source,
      });
    } else if (selectedHeadstone) {
      await uploadHeadstonePhoto({
        cemeteryId: selectedHeadstone.cemeteryId,
        headstoneId: selectedHeadstone.id,
        file,
        notes,
        capturedAt,
        source,
      });
    } else {
      throw new Error("Select a grave site or marker before uploading a photo.");
    }
    refreshDetails({ preserveCurrent: true });
  };

  const deletePhoto = async (assetId: string, reason?: string) => {
    await deleteMediaAsset(assetId, reason);
    refreshDetails({ preserveCurrent: true });
  };

  const movePhoto = async (asset: { id: string; mediaLinkId?: string; mediaLinkType?: "headstone" | "gravesite" }, direction: "earlier" | "later") => {
    if (!asset.mediaLinkId || !asset.mediaLinkType) throw new Error("Photo link information is missing.");
    await moveMediaAsset({
      id: asset.id,
      linkId: asset.mediaLinkId,
      linkType: asset.mediaLinkType,
      direction,
    });
    refreshDetails({ preserveCurrent: true });
  };

  const saveOwnershipEvent = async (event: SaveOwnershipEventInput) => {
    if (!selectedGrave) throw new Error("Select a grave site before recording ownership.");
    await createOwnershipEvent(selectedGrave.cemeteryId, selectedGrave.id, event);
    refreshDetails();
  };

  const saveOwner = async (partyId: string, eventId: string, owner: UpdateOwnerInput) => {
    await updateOwner(partyId, eventId, owner);
    refreshDetails();
  };

  const removeOwnershipConnection = async (rightId: string) => {
    await removeGravesiteOwnershipRight(rightId);
    refreshDetails();
  };

  const saveGraveLot = async (lotId: string) => {
    if (!selectedGrave) throw new Error("Select a gravesite before assigning a lot.");
    await updateGraveLot(selectedGrave.cemeteryId, selectedGrave.id, lotId);
    const nextData = await fetchCemeteryData();
    setData(nextData);
    setSelectedGrave((current) => current ? nextData.graves.find((grave) => graveSelectionKey(grave) === graveSelectionKey(current)) : undefined);
    refreshDetails();
  };

  return {
    saveHeadstone,
    createHeadstoneForGrave,
    saveHeadstoneRelationship,
    updateSavedHeadstoneRelationship,
    deleteSavedHeadstoneRelationship,
    saveHeadstoneGravesiteRelationship,
    updateSavedHeadstoneGravesiteRelationship,
    deleteSavedHeadstoneGravesiteRelationship,
    saveGraveSpace,
    saveBurial,
    saveGraveFeature,
    updateSavedGraveFeature,
    deleteSavedGraveFeature,
    saveMaintenanceRecord,
    updateSavedMaintenanceRecord,
    saveGravePhoto,
    deletePhoto,
    movePhoto,
    saveOwnershipEvent,
    saveOwner,
    removeOwnershipConnection,
    saveGraveLot,
  };
}
