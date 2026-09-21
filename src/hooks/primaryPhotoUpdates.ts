import type { MediaAsset } from "../types";

// The last update for a link wins, matching the API's ordered update list.
export function primaryPhotoUpdater(updates: Array<{ id: string; is_primary?: boolean }>) {
  const byLink = new Map(updates.map((update) => [update.id, update]));
  return (assets: MediaAsset[]) => assets.map((photo) => {
    const update = photo.mediaLinkId ? byLink.get(photo.mediaLinkId) : undefined;
    return !update || photo.isPrimary === update.is_primary ? photo : { ...photo, isPrimary: update.is_primary };
  });
}
