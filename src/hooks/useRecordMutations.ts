import { updateBurial, updateGraveSpace } from "../api/cemeteryApi";
import { graveSelectionKey } from "../lib/format";
import { updateMatchingGrave, replaceBurialInGrave } from "./recordMutationState";
import type { Burial, GraveSpace, SaveBurialInput, SaveGraveSpaceInput } from "../types";
import type { RecordMutationContext } from "./recordMutationContext";
import { createMarkerMutations } from "./markerMutations";
import { createEvidenceMutations } from "./evidenceMutations";
import { createMediaMutations } from "./mediaMutations";
import { createOwnershipMutations } from "./ownershipMutations";

export function useRecordMutations({
  selectedGrave,
  selectedHeadstone,
  setSelectedGrave: updateSelectedGrave,
  setData,
  setSelectedGraveDetails: updateSelectedGraveDetails,
  setSelectedHeadstoneDetails,
  refreshDetails,
}: RecordMutationContext) {
  const setSelectedGrave: RecordMutationContext["setSelectedGrave"] = (update) =>
    updateSelectedGrave((current) => updateMatchingGrave(current, selectedGrave, update));
  const setSelectedGraveDetails: RecordMutationContext["setSelectedGraveDetails"] = (update) =>
    updateSelectedGraveDetails((current) => updateMatchingGrave(current, selectedGrave, update));

  const context = { selectedGrave, selectedHeadstone, setSelectedGrave, setData, setSelectedGraveDetails, setSelectedHeadstoneDetails, refreshDetails };
  const marker = createMarkerMutations(context);
  const evidence = createEvidenceMutations(context);
  const media = createMediaMutations(context);
  const ownership = createOwnershipMutations(context);

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
    setSelectedGraveDetails((current) => replaceBurialInGrave(current, saved));
    return saved;
  };

  return { ...marker, ...evidence, ...media, ...ownership, saveGraveSpace, saveBurial };
}
