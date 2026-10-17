import { createOwnershipEvent, removeGravesiteOwnershipRight, updateOwner, updateGraveLot } from "../api/cemeteryApi";
import { assignLotInMapData, assignLotToSelectedGrave } from "./recordMutationState";
import type { SaveOwnershipEventInput, UpdateOwnerInput } from "../types";
import type { RecordMutationContext } from "./recordMutationContext";

export function createOwnershipMutations({ selectedGrave, setSelectedGrave, setData, setSelectedGraveDetails, refreshDetails }: RecordMutationContext) {
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
    const saved = await updateGraveLot(selectedGrave.cemeteryId, selectedGrave.id, lotId);
    setData((current) => assignLotInMapData(current, selectedGrave, saved.lotId));
    setSelectedGrave((current) => assignLotToSelectedGrave(current, selectedGrave, saved.lotId));
    setSelectedGraveDetails((current) => current?.id === selectedGrave.id ? { ...current, lot: saved.lotId } : current);
  };

  return { saveOwnershipEvent, saveOwner, removeOwnershipConnection, saveGraveLot };
}
