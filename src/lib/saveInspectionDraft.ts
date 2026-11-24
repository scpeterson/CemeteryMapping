import { savePhotoContext, type UploadHeadstonePhotoInput } from "../api/mediaApi";
import type { Headstone, InspectionInput } from "../types";
import type { InspectionDraft } from "./inspectionDraftRecovery";

type SaveInspectionDraftOptions = {
  draft: InspectionDraft;
  updating: boolean;
  headstone: Headstone;
  saveInspection: (entry: InspectionInput, updating: boolean) => Promise<unknown>;
  uploadPhoto?: (input: UploadHeadstonePhotoInput) => Promise<unknown>;
  onInspectionSaved: () => void;
  onPhotoSaved: (photoId: string) => void;
};

export async function saveInspectionDraft({
  draft, updating, headstone, saveInspection, uploadPhoto, onInspectionSaved, onPhotoSaved,
}: SaveInspectionDraftOptions) {
  const { photos = [], recordSaved, ...entry } = draft;

  if (!recordSaved) {
    await saveInspection(entry, updating);
    onInspectionSaved();
  }

  const failures: string[] = [];
  for (const photo of photos) {
    if (photo.saved) continue;

    try {
      if (photo.file) {
        if (!uploadPhoto) throw new Error("Photo uploads are unavailable. The inspection has been saved.");
        await uploadPhoto({
          file: photo.file,
          headstoneId: headstone.id,
          inspectionId: entry.id,
          faceId: photo.faceId,
          notes: photo.notes,
          capturedAt: photo.capturedAt || undefined,
        });
      } else if (photo.mediaAssetId) {
        await savePhotoContext(headstone.id, photo.mediaAssetId, {
          inspectionId: entry.id,
          faceId: photo.faceId,
          phase: "unspecified",
        });
      }
      onPhotoSaved(photo.id);
    } catch (cause) {
      const name = photo.file?.name || photo.missingFileName ||
        headstone.mediaAssets?.find(asset => asset.id === photo.mediaAssetId)?.originalFilename || "Photo";
      failures.push(`${name}: ${cause instanceof Error ? cause.message : "Unable to save photo."}`);
    }
  }

  if (failures.length) throw new Error(failures.join(" "));
}
