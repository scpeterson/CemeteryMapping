import { primaryPhotoUpdater } from "./primaryPhotoUpdates";
import { deleteMediaAsset, moveMediaAsset, uploadHeadstonePhoto } from "../api/cemeteryApi";
import { moveMediaAssetInGrave, moveMediaAssetInRecord, removeMediaAsset } from "./recordMutationState";
import type { RecordMutationContext } from "./recordMutationContext";

export function createMediaMutations({ selectedHeadstone, setSelectedGraveDetails, setSelectedHeadstoneDetails, refreshDetails }: RecordMutationContext) {
  const saveMonumentPhoto = async ({ file, headstoneId, notes, capturedAt, inspectionId, maintenanceRecordId, faceId, phase }: { file: File; headstoneId?: string; notes?: string; capturedAt?: string; inspectionId?: string; maintenanceRecordId?: string; faceId?: string; phase?: "unspecified" | "before" | "during" | "after" }) => {
    const source = /iPhone|iPad|iPod/u.test(navigator.userAgent) ? "iphone" : "field_upload";
    const monumentId = headstoneId || selectedHeadstone?.id;
    if (!monumentId) throw new Error("Select a monument before uploading a photo.");
    await uploadHeadstonePhoto({ headstoneId: monumentId, file, notes, capturedAt, source, inspectionId, maintenanceRecordId, faceId, phase });
    refreshDetails({ preserveCurrent: true });
  };

  const deletePhoto = async (assetId: string, reason?: string) => {
    await deleteMediaAsset(assetId, reason);
    setSelectedGraveDetails((current) => current ? { ...removeMediaAsset(current, assetId), headstones: current.headstones.map((marker) => removeMediaAsset(marker, assetId)) } : current);
    setSelectedHeadstoneDetails((current) => removeMediaAsset(current, assetId));
  };

  const movePhoto = async (asset: { id: string; mediaLinkId?: string; mediaLinkType?: "headstone" | "gravesite" }, direction: "earlier" | "later" | "primary" | "automatic") => {
    if (!asset.mediaLinkId || !asset.mediaLinkType) throw new Error("Photo link information is missing.");
    const result = await moveMediaAsset({
      id: asset.id,
      linkId: asset.mediaLinkId,
      linkType: asset.mediaLinkType,
      direction,
    });
    if (!result.moved) {
      if (direction === "primary" || direction === "automatic") throw new Error("Photo link is no longer available. Refresh the record and try again.");
      return;
    }
    if (direction === "primary" || direction === "automatic") {
      const apply = primaryPhotoUpdater(result.updates);
      setSelectedGraveDetails((current) => current ? { ...current, mediaAssets: apply(current.mediaAssets), headstones: current.headstones.map((marker) => ({ ...marker, mediaAssets: apply(marker.mediaAssets) })) } : current);
      setSelectedHeadstoneDetails((current) => current ? { ...current, mediaAssets: apply(current.mediaAssets) } : current);
      return;
    }
    setSelectedGraveDetails((current) => moveMediaAssetInGrave(current, asset.id, direction));
    setSelectedHeadstoneDetails((current) => moveMediaAssetInRecord(current, asset.id, direction));
  };

  return { saveMonumentPhoto, deletePhoto, movePhoto };
}
