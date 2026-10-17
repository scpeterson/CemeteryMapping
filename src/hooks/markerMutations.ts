import { createGravesiteHeadstone, createHeadstoneRelationship, createHeadstoneGravesiteRelationship, deleteHeadstoneRelationship, deleteHeadstoneGravesiteRelationship, fetchHeadstone, updateHeadstone, updateHeadstoneRelationship, updateHeadstoneGravesiteRelationship } from "../api/cemeteryApi";
import { graveSelectionKey } from "../lib/format";
import { appendHeadstoneSummary, replaceHeadstoneInGrave, replaceHeadstoneSummary } from "./recordMutationState";
import type { GraveSpace, Headstone, HeadstoneSummary, SaveHeadstoneInput, SaveHeadstoneGravesiteRelationshipInput, SaveHeadstoneCreateInput, SaveHeadstoneRelationshipInput } from "../types";
import type { RecordMutationContext } from "./recordMutationContext";

function headstoneSummaryFromCreate(saved: Headstone, grave: GraveSpace, input: SaveHeadstoneCreateInput): HeadstoneSummary | undefined {
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  if (!input.latitude.trim() || !input.longitude.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;

  return {
    id: saved.id,
    headstoneId: saved.headstoneId,
    cemeteryId: grave.cemeteryId,
    cemeteryName: grave.cemeteryName,
    gravesiteId: grave.id,
    graveKey: graveSelectionKey(grave),
    label: saved.headstoneId,
    markerTypeCode: saved.markerType.code,
    markerType: saved.markerType.label,
    markerScopeCode: saved.markerScope.code,
    markerScope: saved.markerScope.label,
    condition: saved.condition.code,
    geometry: {
      type: "Point",
      coordinates: [longitude, latitude],
    },
  };
}

export function createMarkerMutations({ setData, setSelectedGraveDetails, setSelectedHeadstoneDetails, refreshDetails }: RecordMutationContext) {
  const saveHeadstone = async (id: string, headstone: SaveHeadstoneInput): Promise<Headstone> => {
    const saved = await updateHeadstone(id, headstone);
    setSelectedGraveDetails((current) => replaceHeadstoneInGrave(current, saved));
    setSelectedHeadstoneDetails((current) => (current?.id === saved.id ? saved : current));
    setData((current) => replaceHeadstoneSummary(current, saved));
    if (saved.burialNhgPropagation) {
      refreshDetails({ preserveCurrent: true });
    }
    return saved;
  };

  const createHeadstoneForGrave = async (grave: GraveSpace, headstone: SaveHeadstoneCreateInput): Promise<Headstone> => {
    const saved = await createGravesiteHeadstone(grave.cemeteryId, grave.id, headstone);
    const summary = headstoneSummaryFromCreate(saved, grave, headstone);
    setSelectedGraveDetails((current) =>
      current && graveSelectionKey(current) === graveSelectionKey(grave)
        ? {
            ...current,
            headstones: [...current.headstones, saved],
          }
        : current,
    );
    if (summary) {
      setData((current) => appendHeadstoneSummary(current, summary));
    }
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

  return { saveHeadstone, createHeadstoneForGrave, saveHeadstoneRelationship, updateSavedHeadstoneRelationship, deleteSavedHeadstoneRelationship, saveHeadstoneGravesiteRelationship, updateSavedHeadstoneGravesiteRelationship, deleteSavedHeadstoneGravesiteRelationship };
}
